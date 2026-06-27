"use client";

// 현재 재생 중인 ElevenLabs 오디오 — 중단(barge-in)용.
let currentAudio: HTMLAudioElement | null = null;

/** 지금 말하고 있는 걸 즉시 멈춘다 (브라우저 TTS + ElevenLabs 오디오). */
export function stopSpeaking() {
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  } catch {
    /* ignore */
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

/**
 * Speaks text via ElevenLabs (/api/tts) when a server key is configured,
 * otherwise falls back to the browser's SpeechSynthesis. Resolves when audio
 * finishes so the caller can return OMNI to its idle/listening state.
 */
export async function speak(text: string): Promise<void> {
  if (!text.trim()) return;

  // Try server-side ElevenLabs first.
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok && res.headers.get("content-type")?.includes("audio")) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;
      await new Promise<void>((resolve) => {
        const done = () => {
          URL.revokeObjectURL(url);
          if (currentAudio === audio) currentAudio = null;
          resolve();
        };
        audio.onended = done;
        audio.onerror = done;
        audio.onpause = done; // 중단 시에도 resolve
        audio.play().catch(() => done());
      });
      return;
    }
  } catch {
    /* fall through to browser TTS */
  }

  // Fallback: browser speech synthesis.
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const synth = window.speechSynthesis;
  // 음성 목록은 비동기로 로드됨 — 비어 있으면 한 번 기다린다.
  const getVoices = () =>
    new Promise<SpeechSynthesisVoice[]>((resolve) => {
      const v = synth.getVoices();
      if (v.length) return resolve(v);
      const onVoices = () => {
        synth.removeEventListener("voiceschanged", onVoices);
        resolve(synth.getVoices());
      };
      synth.addEventListener("voiceschanged", onVoices);
      setTimeout(() => resolve(synth.getVoices()), 800); // 안전망
    });

  const voices = await getVoices();
  const koVoice =
    voices.find((v) => v.lang === "ko-KR") ||
    voices.find((v) => v.lang?.startsWith("ko"));

  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    if (koVoice) u.voice = koVoice;
    u.rate = 1.02;
    u.pitch = 0.9;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.cancel();
    synth.speak(u);
    // 크롬이 가끔 멈춤 → 살짝 깨워줌
    setTimeout(() => synth.resume(), 100);
  });
}
