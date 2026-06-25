"use client";

import { useEffect, useRef, useState } from "react";
import { useHandTracking, type HandFrame } from "@/hooks/useHandTracking";
import { useDraggable } from "@/hooks/useDraggable";

interface Props {
  active: boolean;
  /** 매 프레임 손 데이터를 부모로 전달 (줌/셀렉 매핑용). */
  onFrame?: (f: HandFrame) => void;
  /** 웹캠 프리뷰 표시 여부. */
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

const HEADER_H = 28;

/**
 * 웹캠 손 인식 + 드래그 이동/모서리 리사이즈 가능한 프리뷰.
 * 부품으로 분리돼 있어 나중에 메인 OMNI에도 끼울 수 있다.
 */
export function HandTracker({ active, onFrame, showPreview = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ready, error, frame, frameRef } = useHandTracking(videoRef, active);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const [collapsed, setCollapsed] = useState(false);

  // 초기 우하단 배치 (창 기준). 4:3 비율 고정 리사이즈.
  const init =
    typeof window !== "undefined"
      ? { x: window.innerWidth - 220, y: window.innerHeight - 200, w: 200, h: 150 }
      : { x: 20, y: 20, w: 200, h: 150 };
  const { box, dragProps, resizeProps } = useDraggable({
    initial: init,
    resizable: true,
    minW: 120,
    minH: 90,
    maxW: 420,
    maxH: 315,
    aspect: 4 / 3,
  });

  // 부모로 프레임 전달
  useEffect(() => {
    onFrameRef.current?.(frame);
  }, [frame]);

  // 프리뷰 캔버스에 스켈레톤 그리기
  useEffect(() => {
    if (!showPreview || collapsed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = (canvas.width = box.w);
    const H = (canvas.height = box.h);
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const f = frameRef.current;
      if (f.detected) {
        const px = (x: number) => (1 - x) * W; // 거울모드
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
        const t = f.landmarks[4];
        const i = f.landmarks[8];
        if (t && i) {
          ctx.strokeStyle = f.pinch < 0.06 ? "#34d399" : "rgba(255,255,255,0.5)";
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
  }, [showPreview, frameRef, collapsed, box.w, box.h]);

  // showPreview=false 여도 video는 마운트(추적 유지), 화면만 숨김.
  if (!showPreview) {
    return (
      <video ref={videoRef} playsInline muted className="hidden" aria-hidden />
    );
  }

  return (
    <div
      className="glass fixed z-50 select-none overflow-hidden rounded-xl"
      style={{
        left: box.x,
        top: box.y,
        width: box.w,
        height: collapsed ? HEADER_H : HEADER_H + box.h,
        touchAction: "none",
      }}
    >
      {/* 헤더 = 드래그 핸들 */}
      <div
        {...dragProps}
        className="flex h-7 items-center justify-between px-2"
        style={{ ...dragProps.style, height: HEADER_H }}
      >
        <div className="flex items-center gap-1.5 text-[10px] tracking-wider">
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
            {error ? "오류" : frame.detected ? "손 감지" : ready ? "손 없음" : "로딩…"}
          </span>
        </div>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "펼치기" : "최소화"}
          className="rounded px-1.5 text-[11px] text-slate-300 transition hover:text-sky-200"
        >
          {collapsed ? "▢" : "—"}
        </button>
      </div>

      {/* 미디어 영역 — video는 항상 마운트, 접으면 display:none */}
      <div
        className={`relative ${collapsed ? "hidden" : "block"}`}
        style={{ width: box.w, height: box.h }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className="block -scale-x-100 object-cover opacity-70"
          style={{ width: box.w, height: box.h }}
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0"
          style={{ width: box.w, height: box.h }}
        />
        {frame.detected && (
          <div className="absolute bottom-1.5 left-1.5 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-sky-200">
            pinch {frame.pinch.toFixed(2)}
          </div>
        )}

        {/* 우하단 리사이즈 핸들 */}
        <div
          {...resizeProps}
          className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
          style={{ touchAction: "none" }}
        >
          <div className="absolute bottom-1 right-1 h-2 w-2 border-b-2 border-r-2 border-sky-300/70" />
        </div>
      </div>
    </div>
  );
}
