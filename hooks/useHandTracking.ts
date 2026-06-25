"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** 손 21개 랜드마크 중 하나 (정규화 좌표 0..1). */
export interface HandPoint {
  x: number;
  y: number;
  z: number;
}

export interface HandFrame {
  /** 손이 감지됐는가. */
  detected: boolean;
  /** 21개 관절 (감지 시). */
  landmarks: HandPoint[];
  /** 엄지끝-검지끝 거리(정규화) → 핀치 판정용. 0에 가까울수록 오므림. */
  pinch: number;
  /** 검지끝 위치(포인터). */
  pointer: HandPoint | null;
}

const EMPTY: HandFrame = { detected: false, landmarks: [], pinch: 1, pointer: null };

// MediaPipe Hands를 CDN에서 동적 로드 (npm 의존성 없이).
const HANDS_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`load fail: ${src}`));
    document.head.appendChild(s);
  });
}

function dist(a: HandPoint, b: HandPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 웹캠 + MediaPipe Hands로 손을 추적한다.
 * @param videoRef 카메라 영상을 그릴 <video> 엘리먼트 ref
 * @param active   true일 때만 카메라/추론 가동
 */
export function useHandTracking(
  videoRef: React.RefObject<HTMLVideoElement>,
  active: boolean
) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState<HandFrame>(EMPTY);
  const frameRef = useRef<HandFrame>(EMPTY);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handsRef = useRef<any>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setFrame(EMPTY);
    frameRef.current = EMPTY;
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        await loadScript(HANDS_URL);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Hands = (window as any).Hands;
        if (!Hands) throw new Error("Hands 로드 실패");

        const hands = new Hands({
          locateFile: (f: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
        });
        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 0,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hands.onResults((res: any) => {
          const lm = res.multiHandLandmarks?.[0];
          if (!lm) {
            const f = EMPTY;
            frameRef.current = f;
            setFrame(f);
            return;
          }
          const landmarks: HandPoint[] = lm.map((p: HandPoint) => ({
            x: p.x,
            y: p.y,
            z: p.z,
          }));
          const thumb = landmarks[4];
          const index = landmarks[8];
          const f: HandFrame = {
            detected: true,
            landmarks,
            pinch: dist(thumb, index),
            pointer: index,
          };
          frameRef.current = f;
          setFrame(f);
        });
        handsRef.current = hands;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setReady(true);

        const loop = async () => {
          if (cancelled || !handsRef.current || !videoRef.current) return;
          try {
            await handsRef.current.send({ image: videoRef.current });
          } catch {
            /* 프레임 스킵 */
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "카메라/모델 오류");
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [active, stop, videoRef]);

  return { ready, error, frame, frameRef };
}
