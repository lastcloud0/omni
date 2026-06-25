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
        // 핀치가 줄면(오므림) → 카메라 거리 감소(줌인).
        // 변화량 자체가 클수록(=빠른 핀치) 줌도 빠르게 → 속도 연동.
        const delta = f.pinch - lastPinch.current; // 음수면 오므리는 중
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
    <main className="relative flex min-h-screen flex-col items-center justify-start gap-5 px-6 py-8">
      <div className="z-10 text-center">
        <h1 className="text-xl font-light tracking-[0.35em] text-sky-300">
          OMNI · VISION
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          손을 비추고 <b className="text-sky-300">오므리면 줌인</b> · 펴면 줌아웃
          (속도는 핀치 속도에 비례)
        </p>
      </div>

      {/* 파티클 구체 무대 */}
      <div className="relative h-[58vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-black/40">
        <ParticleField camRef={camRef} count={900} />

        {/* 손 포인터 */}
        {frame?.detected && frame.pointer && (
          <div
            className="pointer-events-none absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors"
            style={{
              left: `${(1 - frame.pointer.x) * 100}%`,
              top: `${frame.pointer.y * 100}%`,
              borderColor: pinching ? "#34d399" : "rgba(56,189,248,0.7)",
              boxShadow: `0 0 20px ${pinching ? "#34d399" : "rgba(56,189,248,0.5)"}`,
            }}
          />
        )}

        {!active && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
            아래 버튼으로 카메라를 켜세요
          </div>
        )}
      </div>

      {/* 실시간 수치 */}
      <div className="z-10 flex gap-6 text-center text-xs text-slate-400">
        <div>
          <div className="text-slate-500">감지</div>
          <div className={frame?.detected ? "text-emerald-400" : "text-slate-500"}>
            {frame?.detected ? "YES" : "NO"}
          </div>
        </div>
        <div>
          <div className="text-slate-500">핀치값</div>
          <div className="text-sky-300">{frame ? frame.pinch.toFixed(3) : "—"}</div>
        </div>
        <div>
          <div className="text-slate-500">상태</div>
          <div className={pinching ? "text-emerald-400" : "text-sky-300"}>
            {pinching ? "PINCH" : frame?.detected ? "OPEN" : "—"}
          </div>
        </div>
      </div>

      <button
        onClick={() => setActive((v) => !v)}
        className={`z-10 rounded-2xl px-6 py-3 text-sm font-medium transition ${
          active
            ? "border border-red-400/40 bg-red-500/15 text-red-200"
            : "bg-gradient-to-br from-sky-400 to-indigo-600 text-white hover:brightness-110"
        }`}
      >
        {active ? "카메라 끄기" : "카메라 켜기"}
      </button>

      <a href="/" className="z-10 text-xs tracking-widest text-slate-500 hover:text-sky-300">
        ← OMNI 메인으로
      </a>

      <HandTracker active={active} onFrame={onFrame} showPreview={active} />
    </main>
  );
}
