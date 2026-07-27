"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typings for the Web Speech API (not in lib.dom for all TS versions).
interface SRResult {
  transcript: string;
  confidence: number;
}
interface SRAlternative {
  0: SRResult;
  isFinal: boolean;
  length: number;
}
interface SREvent {
  resultIndex: number;
  results: { length: number; [i: number]: SRAlternative };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

interface Options {
  lang?: string;
  onFinal?: (text: string) => void;
}

/**
 * Thin wrapper over the Web Speech API. Provides continuous recognition with
 * interim results, auto-restart, and a `supported` flag for graceful fallback.
 */
export function useSpeechRecognition({ lang = "ko-KR", onFinal }: Options = {}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantOnRef = useRef(false);
  // 권한 거부 시 true — 무한 재시도(알림 깜빡임)를 막는다.
  const deniedRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    const rec = getRecognition();
    if (!rec) {
      setSupported(false);
      return;
    }
    setSupported(true);
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript;
        if (r.isFinal) {
          const finalText = text.trim();
          if (finalText) onFinalRef.current?.(finalText);
          setInterim("");
        } else {
          interimText += text;
        }
      }
      if (interimText) setInterim(interimText);
    };

    rec.onerror = (e) => {
      // 권한 거부/차단이면 재시도를 멈춘다 (마이크 없는 환경에서 알림이
      // 무한히 깜빡이는 것 방지). 사용자가 다시 켜면 그때 재시도.
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        deniedRef.current = true;
        wantOnRef.current = false;
        setListening(false);
        return;
      }
      if (e.error !== "no-speech" && e.error !== "aborted") {
        console.warn("SpeechRecognition error:", e.error);
      }
    };

    rec.onend = () => {
      setListening(false);
      // Auto-restart so OMNI keeps an ear open — 단, 권한 거부 상태면 재시작 안 함.
      if (wantOnRef.current && !deniedRef.current) {
        try {
          rec.start();
          setListening(true);
        } catch {
          /* already starting */
        }
      }
    };

    recRef.current = rec;
    return () => {
      wantOnRef.current = false;
      rec.abort();
    };
  }, [lang]);

  const start = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    wantOnRef.current = true;
    deniedRef.current = false; // 사용자가 명시적으로 켰으니 거부 플래그 리셋
    try {
      rec.start();
      setListening(true);
    } catch {
      /* already running */
    }
  }, []);

  const stop = useCallback(() => {
    wantOnRef.current = false;
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, interim, start, stop };
}
