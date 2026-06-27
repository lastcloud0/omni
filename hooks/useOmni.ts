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
interface OmniOptions {
  /** AI가 응답에 패널을 포함하면 호출됨 → 껍데기가 화면에 출력. */
  onPanel?: (panel: Panel) => void;
}

export function useOmni({ onPanel }: OmniOptions = {}) {
  const onPanelRef = useRef(onPanel);
  onPanelRef.current = onPanel;
  const [status, setStatus] = useState<OmniStatus>("idle");
  const [awake, setAwake] = useState(false); // wake-word toggle (mic armed)
  const [interacted, setInteracted] = useState(false); // "옴니" 인식으로 활성화됐는지
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const busyRef = useRef(false);
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
      if (busyRef.current) return;
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
      if (panel) onPanelRef.current?.(panel);

      // 클라이언트 검증규칙 통과 — 금지답안 차단/교정.
      const checked = validateReply(reply);
      if (checked.issues.length) {
        console.warn("검증규칙 위반:", checked.issues);
      }

      pushMessage({ id: uid(), role: "assistant", content: checked.reply, createdAt: Date.now() });
      setStatus("responding");
      await speak(checked.reply);
      busyRef.current = false;
      setStatus(awake ? "listening" : "idle");
    },
    [awake, pushMessage]
  );

  // 말/생성 중단 (barge-in). 코어 클릭·"그만"·새 명령에서 호출.
  const interrupt = useCallback(() => {
    stopSpeaking();
    busyRef.current = false;
    setStatus(awake ? "listening" : "idle");
  }, [awake]);

  const handleFinal = useCallback(
    (text: string) => {
      // "그만"류는 busy 가드보다 먼저 — 말하는 중에도 멈출 수 있게.
      if (isStopWord(text)) {
        interrupt();
        return;
      }
      if (busyRef.current) return;
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
    [respondTo, interrupt]
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
      setInteracted(true);
      respondTo(t);
    },
    [respondTo, interrupt]
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
