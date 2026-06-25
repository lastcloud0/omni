"use client";

import { useState } from "react";
import { HandTracker } from "@/components/HandTracker";
import type { HandFrame } from "@/hooks/useHandTracking";

export default function VisionPage() {
  const [active, setActive] = useState(false);
  const [frame, setFrame] = useState<HandFrame | null>(null);

  const pointer = frame?.pointer;
  const pinching = frame ? frame.pinch < 0.06 : false;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <h1 className="text-xl font-light tracking-[0.35em] text-sky-300">
          OMNI · VISION
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          손 인식 테스트 — 카메라를 켜고 손을 화면에 비춰보세요.
        </p>
      </div>

      {/* 메인: 손 포인터 시각화 (전체 화면 기준) */}
      <div className="relative h-[320px] w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        {frame?.detected && pointer ? (
          <div
            className="absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors"
            style={{
              left: `${(1 - pointer.x) * 100}%`, // 거울모드
              top: `${pointer.y * 100}%`,
              borderColor: pinching ? "#34d399" : "#38bdf8",
              boxShadow: `0 0 24px ${pinching ? "#34d399" : "#38bdf8"}`,
              background: pinching
                ? "rgba(52,211,153,0.15)"
                : "rgba(56,189,248,0.10)",
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {active ? "손을 카메라에 비춰주세요" : "아래 버튼으로 카메라를 켜세요"}
          </div>
        )}
      </div>

      {/* 실시간 수치 */}
      <div className="flex gap-6 text-center text-xs text-slate-400">
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
        className={`rounded-2xl px-6 py-3 text-sm font-medium transition ${
          active
            ? "border border-red-400/40 bg-red-500/15 text-red-200"
            : "bg-gradient-to-br from-sky-400 to-indigo-600 text-white hover:brightness-110"
        }`}
      >
        {active ? "카메라 끄기" : "카메라 켜기"}
      </button>

      <a href="/" className="text-xs tracking-widest text-slate-500 hover:text-sky-300">
        ← OMNI 메인으로
      </a>

      <HandTracker active={active} onFrame={setFrame} showPreview={active} />
    </main>
  );
}
