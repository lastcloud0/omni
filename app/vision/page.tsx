"use client";

import { useEffect, useRef, useState } from "react";
import { HandTracker } from "@/components/HandTracker";
import { ParticleField } from "@/components/ParticleField";
import { useDraggable } from "@/hooks/useDraggable";
import type { HandFrame } from "@/hooks/useHandTracking";
import type { LinkNode } from "@/lib/linkNodes";
// 제스처 판정은 MAP과 공용 모듈을 쓴다 (감도 단일 출처).
import { createGestureReader } from "@/lib/handGesture";

export default function VisionPage() {
  const [active, setActive] = useState(false);
  const [frame, setFrame] = useState<HandFrame | null>(null);

  // 카메라 거리(=줌). 작아질수록 줌인. ParticleField가 ref로 읽음.
  const camRef = useRef(3.0);
  const gesture = useRef(createGestureReader());
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
    // 노드 위에 손이 있으면 선택 우선 — 회전·줌 억제.
    const g = gesture.current.read(f, { suppress: hoverRef.current != null });

    pinchRef.current = g.pinch;
    pointerRef.current = g.pointer;
    spinRef.current = g.spin; // 손 없으면 null → 자동회전

    if (g.zoomDelta !== 0) {
      camRef.current += g.zoomDelta; // 음수=오므림 → 줌인
      camRef.current = Math.max(0.5, Math.min(3.4, camRef.current));
    }
  };

  const pinching = frame ? frame.pinch < 0.06 : false;

  // 드래그 가능한 컨트롤 박스. 실제 크기 측정해 중앙 하단 정렬.
  const ctrlBoxRef = useRef<HTMLDivElement>(null);
  const { box: ctrl, setBox: setCtrl, dragProps: ctrlDrag } = useDraggable({
    initial: { x: -9999, y: -9999, w: 430, h: 56 }, // 측정 전 화면 밖에 숨김
  });
  useEffect(() => {
    const place = () => {
      const el = ctrlBoxRef.current;
      if (!el) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setCtrl((b) => ({
        ...b,
        w,
        h,
        x: Math.max(8, Math.round(window.innerWidth / 2 - w / 2)),
        y: window.innerHeight - h - 28,
      }));
    };
    place();
    // 폰트 로딩 완료 후 폭이 바뀔 수 있어 한 번 더 정렬
    if (document.fonts?.ready) document.fonts.ready.then(place);
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        ref={ctrlBoxRef}
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

          {/* MAP 모드 */}
          <a
            href="/map"
            className="rounded-lg px-2 py-1 tracking-widest text-slate-300 transition hover:text-sky-300"
          >
            MAP
          </a>

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
