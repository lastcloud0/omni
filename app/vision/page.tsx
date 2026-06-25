"use client";

import { useRef, useState } from "react";
import { HandTracker } from "@/components/HandTracker";
import { ParticleField } from "@/components/ParticleField";
import { useDraggable } from "@/hooks/useDraggable";
import type { HandFrame } from "@/hooks/useHandTracking";
import type { LinkNode } from "@/lib/linkNodes";

// 핀치 변화량 → 카메라 거리 변화에 곱하는 이득. 클수록 줌이 민감.
const ZOOM_GAIN = 12;
// 손 비틀기 회전 제어
const SPIN_DEAD = 0.28; // 브레이크 중립 구간(라디안, ±약 16°)
const SPIN_GAIN = 0.06; // 기울인 각도 → 회전 속도 비례
const SPIN_MAX = 0.09; // 최대 회전 속도(라디안/프레임)
const ROLL_NEUTRAL = -Math.PI / 2; // 손 똑바로(손가락 위) = 중립

export default function VisionPage() {
  const [active, setActive] = useState(false);
  const [frame, setFrame] = useState<HandFrame | null>(null);

  // 카메라 거리(=줌). 작아질수록 줌인. ParticleField가 ref로 읽음.
  const camRef = useRef(3.0);
  const lastPinch = useRef<number | null>(null);
  // 손 비틀기 → yaw 회전 "속도". null이면 자동회전.
  const spinRef = useRef<number | null>(null);
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

      // 줌: 핀치 변화량 (노드 호버 중이면 억제 → 선택 의도)
      const overNode = hoverRef.current != null;
      if (lastPinch.current != null && !overNode) {
        const delta = f.pinch - lastPinch.current;
        camRef.current += delta * ZOOM_GAIN;
        camRef.current = Math.max(0.5, Math.min(3.4, camRef.current));
      }
      lastPinch.current = f.pinch;

      // 포인터(셀렉용): 손 위치, 거울모드
      const pt = f.pointer ?? f.landmarks[9] ?? null;
      if (pt) pointerRef.current = { x: 1 - pt.x, y: pt.y };

      // 회전(구 조작): 손 비틀기 각도 = 손목(0)→중지뿌리(9) 벡터 각도
      const w = f.landmarks[0];
      const m = f.landmarks[9];
      if (w && m) {
        const ang = Math.atan2(m.y - w.y, m.x - w.x);
        // 중립(손 똑바로)에서의 편차를 -PI..PI로 정규화
        let off = ang - ROLL_NEUTRAL;
        off = Math.atan2(Math.sin(off), Math.cos(off));
        // 거울모드 보정: 화면이 좌우반전이라 회전 방향 맞춤
        off = -off;
        if (Math.abs(off) <= SPIN_DEAD) {
          spinRef.current = 0; // 브레이크(중립) → 정지
        } else {
          const eff = off - Math.sign(off) * SPIN_DEAD;
          spinRef.current = Math.max(-SPIN_MAX, Math.min(SPIN_MAX, eff * SPIN_GAIN));
        }
      }
    } else {
      lastPinch.current = null;
      spinRef.current = null; // 손 없으면 자동회전
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
          spinRef={spinRef}
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
