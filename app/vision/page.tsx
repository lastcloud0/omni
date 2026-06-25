"use client";

import { useRef, useState } from "react";
import { HandTracker } from "@/components/HandTracker";
import { ParticleField } from "@/components/ParticleField";
import type { HandFrame } from "@/hooks/useHandTracking";

// 핀치 변화량 → 카메라 거리 변화에 곱하는 이득. 클수록 줌이 민감.
const ZOOM_GAIN = 12;

export default function VisionPage() {
  const [active, setActive] = useState(false);
  const [frame, setFrame] = useState<HandFrame | null>(null);

  // 카메라 거리(=줌). 작아질수록 줌인. ParticleField가 ref로 읽음.
  const camRef = useRef(3.0);
  const lastPinch = useRef<number | null>(null);

  const onFrame = (f: HandFrame) => {
    setFrame(f);
    if (f.detected) {
      if (lastPinch.current != null) {
        const delta = f.pinch - lastPinch.current; // 음수면 오므리는 중 → 줌인
        camRef.current += delta * ZOOM_GAIN;
        camRef.current = Math.max(0.5, Math.min(3.4, camRef.current));
      }
      lastPinch.current = f.pinch;
    } else {
      lastPinch.current = null;
    }
  };

  const pinching = frame ? frame.pinch < 0.06 : false;

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      {/* 전체 화면 파티클 (프레임 없음) */}
      <div className="absolute inset-0">
        <ParticleField camRef={camRef} count={900} />
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

      {/* 하단 중앙 글래스 컨트롤 박스 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
        <div className="glass pointer-events-auto flex items-center gap-4 rounded-2xl px-5 py-3 text-xs">
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
