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
      if (e.error !== "no-speech" && e.error !== "aborted") {
        console.warn("SpeechRecognition error:", e.error);
      }
    };

    rec.onend = () => {
      setListening(false);
      // Auto-restart so OMNI keeps an ear open.
      if (wantOnRef.current) {
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
