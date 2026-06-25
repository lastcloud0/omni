"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Captures the microphone and exposes a live frequency-domain byte array plus a
 * normalized 0..1 overall level. Used to drive the HUD waveform/ring reactivity.
 *
 * The analyser is only attached while `active` is true so the mic indicator in
 * the browser matches what OMNI is actually doing.
 */
export function useAudioLevel(active: boolean) {
  const [level, setLevel] = useState(0);
  const dataRef = useRef<Uint8Array>(new Uint8Array(64));
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    analyserRef.current = null;
    setLevel(0);
    dataRef.current = new Uint8Array(64);
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new Ctx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);

        streamRef.current = stream;
        ctxRef.current = ctx;
        analyserRef.current = analyser;
        dataRef.current = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          const analyser = analyserRef.current;
          if (!analyser) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          analyser.getByteFrequencyData(dataRef.current as any);
          let sum = 0;
          for (let i = 0; i < dataRef.current.length; i++) {
            sum += dataRef.current[i];
          }
          const avg = sum / dataRef.current.length / 255;
          setLevel(avg);
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch (err) {
        console.warn("Microphone unavailable:", err);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [active, stop]);

  return { level, data: dataRef };
}
