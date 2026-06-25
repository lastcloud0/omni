"use client";

import { useEffect, useRef } from "react";
import { useHandTracking, type HandFrame } from "@/hooks/useHandTracking";

interface Props {
  active: boolean;
  /** 매 프레임 손 데이터를 부모로 전달 (줌/셀렉 매핑용). */
  onFrame?: (f: HandFrame) => void;
  /** 우하단 웹캠 프리뷰 표시 여부. */
  showPreview?: boolean;
}

// MediaPipe 손 연결 (관절 쌍) — 스켈레톤 라인.
const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

/**
 * 웹캠 손 인식 + 우하단 프리뷰(스켈레톤 오버레이).
 * 부품으로 분리돼 있어 나중에 메인 OMNI에도 끼울 수 있다.
 */
export function HandTracker({ active, onFrame, showPreview = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ready, error, frame, frameRef } = useHandTracking(videoRef, active);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  // 부모로 프레임 전달
  useEffect(() => {
    onFrameRef.current?.(frame);
  }, [frame]);

  // 프리뷰 캔버스에 스켈레톤 그리기
  useEffect(() => {
    if (!showPreview) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = (canvas.width = 200);
    const H = (canvas.height = 150);
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const f = frameRef.current;
      if (f.detected) {
        // 거울모드(좌우반전)로 그려 자연스럽게
        const px = (x: number) => (1 - x) * W;
        const py = (y: number) => y * H;
        ctx.strokeStyle = "rgba(56,189,248,0.9)";
        ctx.lineWidth = 2;
        for (const [a, b] of CONNECTIONS) {
          const p = f.landmarks[a];
          const q = f.landmarks[b];
          if (!p || !q) continue;
          ctx.beginPath();
          ctx.moveTo(px(p.x), py(p.y));
          ctx.lineTo(px(q.x), py(q.y));
          ctx.stroke();
        }
        ctx.fillStyle = "#a5f3ff";
        for (const p of f.landmarks) {
          ctx.beginPath();
          ctx.arc(px(p.x), py(p.y), 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        // 핀치 포인트 강조 (엄지4 + 검지8)
        const t = f.landmarks[4];
        const i = f.landmarks[8];
        if (t && i) {
          ctx.strokeStyle =
            f.pinch < 0.06 ? "#34d399" : "rgba(255,255,255,0.5)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px(t.x), py(t.y));
          ctx.lineTo(px(i.x), py(i.y));
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [showPreview, frameRef]);

  if (!showPreview) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[200px] overflow-hidden rounded-xl border border-sky-400/30 bg-black/60 shadow-lg backdrop-blur">
      <div className="relative">
        {/* 웹캠 영상 (거울모드) */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="block h-[150px] w-[200px] -scale-x-100 object-cover opacity-70"
        />
        {/* 스켈레톤 오버레이 */}
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-[150px] w-[200px]"
        />
        {/* 상태 배지 */}
        <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-1 text-[10px] tracking-wider">
          <span
            className={`h-2 w-2 rounded-full ${
              error
                ? "bg-red-400"
                : frame.detected
                ? "bg-emerald-400"
                : ready
                ? "bg-amber-400"
                : "bg-slate-500"
            }`}
          />
          <span className="text-sky-100">
            {error
              ? "오류"
              : frame.detected
              ? "손 감지"
              : ready
              ? "손 없음"
              : "로딩…"}
          </span>
        </div>
        {frame.detected && (
          <div className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-[10px] text-sky-200">
            pinch {frame.pinch.toFixed(2)}
          </div>
        )}
      </div>
      {error && (
        <div className="px-2 py-1 text-[10px] text-red-300">{error}</div>
      )}
    </div>
  );
}
