"use client";

import { useRef, useState } from "react";
import { HandTracker } from "@/components/HandTracker";
import { ParticleField } from "@/components/ParticleField";
import { useDraggable } from "@/hooks/useDraggable";
import type { HandFrame } from "@/hooks/useHandTracking";
import type { LinkNode } from "@/lib/linkNodes";

// 핀치 변화량 → 카메라 거리 변화에 곱하는 이득. 클수록 줌이 민감.
const ZOOM_GAIN = 12;

export default function VisionPage() {
  const [active, setActive] = useState(false);
  const [frame, setFrame] = useState<HandFrame | null>(null);

  // 카메라 거리(=줌). 작아질수록 줌인. ParticleField가 ref로 읽음.
  const camRef = useRef(3.0);
  const lastPinch = useRef<number | null>(null);
  // 손 위치 기반 회전 목표. null이면 자동회전.
  const rotRef = useRef<{ yaw: number; pitch: number } | null>(null);
  // 노드 상호작용용
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef(1);
  const hoverRef = useRef<LinkNode | null>(null);

  const openLink = (node: LinkNode) => {
    window.open(node.url, "_blank", "noopener,noreferrer");
  };

  const onFrame = (f: HandFrame) => {
    setFrame(f);
    if (f.detected) {
      pinchRef.current = f.pinch;

      // 노드 위에 호버 중이면 줌 억제(핀치=선택 의도) — 아니면 줌
      const overNode = hoverRef.current != null;
      if (lastPinch.current != null && !overNode) {
        const delta = f.pinch - lastPinch.current;
        camRef.current += delta * ZOOM_GAIN;
        camRef.current = Math.max(0.5, Math.min(3.4, camRef.current));
      }
      lastPinch.current = f.pinch;

      // 손 위치(거울모드) → 회전 + 포인터
      const pt = f.pointer ?? f.landmarks[9] ?? null;
      if (pt) {
        const mx = 1 - pt.x;
        const my = pt.y;
        pointerRef.current = { x: mx, y: my };
        rotRef.current = {
          yaw: (mx - 0.5) * 4.4,
          pitch: (my - 0.5) * -3.0,
        };
      }
    } else {
      lastPinch.current = null;
      rotRef.current = null;
      pointerRef.current = null;
      pinchRef.current = 1;
    }
  };

  const pinching = frame ? frame.pinch < 0.06 : false;

  // 하단 중앙 시작, 드래그로 이동 가능한 컨트롤 박스.
  const ctrlInit =
    typeof window !== "undefined"
      ? { x: window.innerWidth / 2 - 215, y: window.innerHeight - 80, w: 430, h: 56 }
      : { x: 40, y: 40, w: 430, h: 56 };
  const { box: ctrl, dragProps: ctrlDrag } = useDraggable({ initial: ctrlInit });

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      {/* 전체 화면 파티클 (프레임 없음) */}
      <div className="absolute inset-0">
        <ParticleField
          camRef={camRef}
          rotRef={rotRef}
          pointerRef={pointerRef}
          pinchRef={pinchRef}
          hoverRef={hoverRef}
          onActivate={openLink}
          count={400}
        />
      </div>

      {/* 손 포인터 (전체 화면 기준) */}
      {frame?.detected && frame.pointer && (
        <div
          className="pointer-events-none absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors"
          style={{
            left: `${(1 - frame.pointer.x) * 100}%`,
            top: `${frame.pointer.y * 100}%`,
            borderColor: pinching ? "#34d399" : "rgba(56,189,248,0.7)",
            boxShadow: `0 0 24px ${pinching ? "#34d399" : "rgba(56,189,248,0.5)"}`,
          }}
        />
      )}

      {/* 드래그 가능한 글래스 컨트롤 박스 */}
      <div
        className="glass fixed z-40 flex select-none items-center gap-3 rounded-2xl py-3 pl-2 pr-4 text-xs"
        style={{ left: ctrl.x, top: ctrl.y, touchAction: "none" }}
      >
        {/* 그립 핸들 (이걸 잡고 이동) */}
        <div
          {...ctrlDrag}
          className="flex h-7 w-5 items-center justify-center text-slate-500 hover:text-sky-300"
          aria-label="이동"
        >
          <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
            <circle cx="2.5" cy="3" r="1.2" /><circle cx="7.5" cy="3" r="1.2" />
            <circle cx="2.5" cy="8" r="1.2" /><circle cx="7.5" cy="8" r="1.2" />
            <circle cx="2.5" cy="13" r="1.2" /><circle cx="7.5" cy="13" r="1.2" />
          </svg>
        </div>
        <div className="flex items-center gap-4">
          {/* 감지 */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] tracking-wider text-slate-400">감지</span>
            <span
              className={`flex items-center gap-1 ${
                frame?.detected ? "text-emerald-300" : "text-slate-500"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  frame?.detected ? "bg-emerald-400" : "bg-slate-600"
                }`}
              />
              {frame?.detected ? "YES" : "NO"}
            </span>
          </div>

          <span className="h-7 w-px bg-white/10" />

          {/* 핀치값 */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] tracking-wider text-slate-400">핀치</span>
            <span className="font-mono text-sky-200">
              {frame ? frame.pinch.toFixed(3) : "—"}
            </span>
          </div>

          <span className="h-7 w-px bg-white/10" />

          {/* 상태 */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] tracking-wider text-slate-400">상태</span>
            <span className={pinching ? "text-emerald-300" : "text-sky-200"}>
              {pinching ? "PINCH" : frame?.detected ? "OPEN" : "—"}
            </span>
          </div>

          <span className="h-7 w-px bg-white/10" />

          {/* 카메라 토글 */}
          <button
            onClick={() => setActive((v) => !v)}
            className="flex items-center gap-2"
            aria-label="카메라 토글"
          >
            <span className="text-[10px] tracking-wider text-slate-400">CAM</span>
            <span
              className={`relative h-5 w-9 rounded-full transition-colors ${
                active ? "bg-sky-500/70" : "bg-slate-600/60"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                  active ? "left-[18px]" : "left-0.5"
                }`}
              />
            </span>
          </button>

          <span className="h-7 w-px bg-white/10" />

          {/* OMNI 메인 */}
          <a
            href="/"
            className="rounded-lg px-2 py-1 tracking-widest text-slate-300 transition hover:text-sky-300"
          >
            OMNI
          </a>
        </div>
      </div>

      <HandTracker active={active} onFrame={onFrame} showPreview={active} />
    </main>
  );
}
