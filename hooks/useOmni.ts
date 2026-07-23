"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, OmniStatus, Panel } from "@/lib/types";
import { speak, stopSpeaking } from "@/lib/speak";
import { askAI } from "@/lib/aiClient";
import { validateReply } from "@/lib/validation";
import { useSpeechRecognition } from "./useSpeechRecognition";

// "옴니"는 음성인식에서 없니/엄니/온니 등으로 자주 오인식됨 → 변형 폭넓게 허용.
const WAKE_WORDS = [
  "옴니", "오므니", "옴리", "omni",
  "없니", "엄니", "온니", "옹니", "음니", "어미니", "오미니", "옴니야",
];
const STORAGE_KEY = "omni.chatlog.v1";

// 말 멈춤(barge-in) 키워드.
const STOP_WORDS = ["그만", "그만해", "그만말해", "멈춰", "멈춰줘", "스탑", "stop"];

function hasWakeWord(text: string): boolean {
  const t = text.toLowerCase().replace(/\s/g, "");
  return WAKE_WORDS.some((w) => t.includes(w.replace(/\s/g, "")));
}

function isStopWord(text: string): boolean {
  const t = text.toLowerCase().replace(/\s/g, "");
  return STOP_WORDS.some((w) => t.includes(w.replace(/\s/g, "")));
}

// 모드 전환 CTA 감지. AI 없이 즉시 처리.
function detectCTA(text: string): { action: CtaAction; reply: string } | null {
  const t = text.replace(/\s/g, "");
  const ON = "(켜|켜줘|키|킬|활성|온|start|on)";
  const OFF = "(꺼|꺼줘|끄|끌|종료|비활성|오프|꺼져|stop|off)";
  if (new RegExp(`(맵|지도)모드.*${OFF}`).test(t))
    return { action: "map-off", reply: "맵 모드를 종료했습니다." };
  if (new RegExp(`(맵|지도)모드.*${ON}`).test(t))
    return { action: "map-on", reply: "맵 모드가 활성화되었습니다." };
  if (new RegExp(`비전모드.*${OFF}`).test(t))
    return { action: "vision-off", reply: "비전 모드를 종료했습니다." };
  if (new RegExp(`비전모드.*${ON}`).test(t))
    return { action: "vision-on", reply: "비전 모드가 활성화되었습니다." };
  if (new RegExp(`(채팅|챗)모드.*${OFF}`).test(t))
    return { action: "chat-off", reply: "채팅 모드를 종료했습니다." };
  if (new RegExp(`(채팅|챗)모드.*${ON}`).test(t))
    return { action: "chat-on", reply: "채팅 모드가 활성화되었습니다." };
  return null;
}

function stripWakeWord(text: string): string {
  let out = text;
  for (const w of WAKE_WORDS) {
    out = out.replace(new RegExp(w, "gi"), "");
  }
  return out.replace(/^[\s,!?.]+/, "").trim();
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Top-level OMNI state machine. Owns wake-word detection, the conversation
 * turn (STT -> OpenAI -> TTS), status transitions, and persisted chat log.
 */
export type CtaAction =
  | "vision-on"
  | "vision-off"
  | "chat-on"
  | "chat-off"
  | "map-on"
  | "map-off";

interface OmniOptions {
  /** AI가 응답에 패널을 포함하면 호출됨 → 껍데기가 화면에 출력. */
  onPanel?: (panel: Panel) => void;
  /** 모드 전환 CTA 감지 시 호출 (페이지가 실제 전환 수행). */
  onCta?: (action: CtaAction) => void;
}

export function useOmni({ onPanel, onCta }: OmniOptions = {}) {
  const onPanelRef = useRef(onPanel);
  onPanelRef.current = onPanel;
  const onCtaRef = useRef(onCta);
  onCtaRef.current = onCta;
  const [status, setStatus] = useState<OmniStatus>("idle");
  const [awake, setAwake] = useState(false); // wake-word toggle (mic armed)
  const [interacted, setInteracted] = useState(false); // "옴니" 인식으로 활성화됐는지
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const busyRef = useRef(false);
  const turnRef = useRef(0); // 대화 턴 ID — 새 입력이 오면 이전 턴 결과를 버린다.
  // respondTo에서 최신 대화 기록을 stale 없이 읽기 위한 거울.
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  // Load persisted log.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Persist on change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100)));
    } catch {
      /* ignore */
    }
  }, [messages]);

  const pushMessage = useCallback((m: ChatMessage) => {
    setMessages((prev) => [...prev, m]);
  }, []);

  const respondTo = useCallback(
    async (userText: string) => {
      // 새 입력이 오면 하던 말/생성을 즉시 끊고 이번 턴으로 교체.
      stopSpeaking();
      const myTurn = ++turnRef.current;
      busyRef.current = true;
      // 직전 대화 기록을 캡처(새 user 메시지 추가 전) → 맥락 유지.
      const history = messagesRef.current.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      pushMessage({ id: uid(), role: "user", content: userText, createdAt: Date.now() });
      setStatus("thinking");

      // 두뇌는 어댑터(askAI)에 위임 — 껍데기는 결과만 받아 출력한다.
      const { reply, panel } = await askAI(userText, history);
      if (turnRef.current !== myTurn) return; // 새 입력으로 무효화됨
      if (panel) onPanelRef.current?.(panel);

      // 클라이언트 검증규칙 통과 — 금지답안 차단/교정.
      const checked = validateReply(reply);
      if (checked.issues.length) {
        console.warn("검증규칙 위반:", checked.issues);
      }

      pushMessage({ id: uid(), role: "assistant", content: checked.reply, createdAt: Date.now() });
      setStatus("responding");
      await speak(checked.reply);
      if (turnRef.current !== myTurn) return; // 말하는 중 새 입력이 들어옴
      busyRef.current = false;
      setStatus(awake ? "listening" : "idle");
    },
    [awake, pushMessage]
  );

  // 말/생성 중단 (barge-in). 코어 클릭·"그만"·새 명령에서 호출.
  const interrupt = useCallback(() => {
    turnRef.current++; // 진행 중인 응답 무효화
    stopSpeaking();
    busyRef.current = false;
    setStatus(awake ? "listening" : "idle");
  }, [awake]);

  // 모드 전환 CTA 실행 — AI 없이 즉시 전환 + 상태 안내.
  const runCTA = useCallback(
    (cta: { action: CtaAction; reply: string }) => {
      stopSpeaking();
      busyRef.current = false;
      setInteracted(true);
      onCtaRef.current?.(cta.action);
      pushMessage({ id: uid(), role: "assistant", content: cta.reply, createdAt: Date.now() });
      setStatus("responding");
      speak(cta.reply).then(() => setStatus(awake ? "listening" : "idle"));
    },
    [awake, pushMessage]
  );

  const handleFinal = useCallback(
    (text: string) => {
      // "그만"류는 busy 가드보다 먼저 — 말하는 중에도 멈출 수 있게.
      if (isStopWord(text)) {
        interrupt();
        return;
      }
      // 모드 전환 CTA — 웨이크워드 없이도 인식.
      const cta = detectCTA(text);
      if (cta) {
        runCTA(cta);
        return;
      }
      // 말하는 중에도 웨이크워드가 있으면 끊고 새 질문 처리(에코 오작동 방지 위해
      // 웨이크워드 없는 음성은 무시).
      if (hasWakeWord(text)) {
        setInteracted(true); // "옴니" 인식 → 활성화
        const command = stripWakeWord(text);
        if (command) {
          respondTo(command);
        } else {
          setStatus("listening");
        }
      }
    },
    [respondTo, interrupt, runCTA]
  );

  const { supported, listening, interim, start, stop } = useSpeechRecognition({
    lang: "ko-KR",
    onFinal: handleFinal,
  });

  // 접속 시 기본 상태 = 음성 인식 ON (브라우저가 막으면 사용자 조작 시 시작).
  const autoStarted = useRef(false);
  useEffect(() => {
    if (supported && !autoStarted.current) {
      autoStarted.current = true;
      setAwake(true);
      start();
      setStatus("listening");
    }
  }, [supported, start]);

  const toggleAwake = useCallback(() => {
    setAwake((prev) => {
      const next = !prev;
      if (next) {
        start();
        setStatus("listening");
      } else {
        stop();
        setStatus("idle");
      }
      return next;
    });
  }, [start, stop]);

  // Manual text command (typed in the console input) — bypasses wake word.
  const sendText = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      if (isStopWord(t)) {
        interrupt();
        return;
      }
      const cta = detectCTA(t);
      if (cta) {
        runCTA(cta);
        return;
      }
      setInteracted(true);
      respondTo(t);
    },
    [respondTo, interrupt, runCTA]
  );

  const clearLog = useCallback(() => setMessages([]), []);

  return {
    status,
    awake,
    interacted,
    listening,
    interim,
    supported,
    messages,
    interrupt,
    toggleAwake,
    sendText,
    clearLog,
  };
}
