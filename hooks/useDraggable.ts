"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface Box {
  x: number; // left (px)
  y: number; // top (px)
  w: number; // width (px) — 리사이즈 가능한 박스만 사용
  h: number; // height (px)
}

interface Options {
  initial: Box;
  resizable?: boolean;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  /** 가로:세로 비율 고정 (예: 4/3). 지정 시 리사이즈가 비율 유지. */
  aspect?: number;
}

/**
 * 박스를 드래그로 이동 + (옵션) 모서리로 리사이즈한다.
 * 반환된 dragProps를 헤더(잡는 곳)에, resizeProps를 모서리 핸들에 연결.
 * 위치/크기는 화면 밖으로 나가지 않게 clamp.
 */
export function useDraggable({
  initial,
  resizable = false,
  minW = 120,
  minH = 90,
  maxW = 640,
  maxH = 480,
  aspect,
}: Options) {
  const [box, setBox] = useState<Box>(initial);
  const boxRef = useRef(box);
  boxRef.current = box;
  const mode = useRef<"none" | "drag" | "resize">("none");
  const start = useRef({ mx: 0, my: 0, bx: 0, by: 0, bw: 0, bh: 0 });

  const clampPos = (x: number, y: number, w: number, h: number) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      x: Math.max(0, Math.min(vw - w, x)),
      y: Math.max(0, Math.min(vh - h, y)),
    };
  };

  const onMove = useCallback(
    (e: PointerEvent) => {
      if (mode.current === "none") return;
      const s = start.current;
      if (mode.current === "drag") {
        const nx = s.bx + (e.clientX - s.mx);
        const ny = s.by + (e.clientY - s.my);
        const { x, y } = clampPos(nx, ny, boxRef.current.w, boxRef.current.h);
        setBox((b) => ({ ...b, x, y }));
      } else if (mode.current === "resize") {
        let nw = Math.max(minW, Math.min(maxW, s.bw + (e.clientX - s.mx)));
        let nh = Math.max(minH, Math.min(maxH, s.bh + (e.clientY - s.my)));
        if (aspect) {
          // 가로 기준으로 비율 맞춤
          nh = nw / aspect;
          if (nh < minH) {
            nh = minH;
            nw = nh * aspect;
          }
        }
        setBox((b) => ({ ...b, w: nw, h: nh }));
      }
    },
    [aspect, maxH, maxW, minH, minW]
  );

  const onUp = useCallback(() => {
    mode.current = "none";
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [onMove, onUp]);

  // 창 크기 변하면 화면 안으로 다시 끌어넣기
  useEffect(() => {
    const onResize = () => {
      setBox((b) => {
        const { x, y } = clampPos(b.x, b.y, b.w, b.h);
        return { ...b, x, y };
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const beginDrag = (e: React.PointerEvent) => {
    mode.current = "drag";
    start.current = {
      mx: e.clientX,
      my: e.clientY,
      bx: boxRef.current.x,
      by: boxRef.current.y,
      bw: boxRef.current.w,
      bh: boxRef.current.h,
    };
  };

  const beginResize = (e: React.PointerEvent) => {
    if (!resizable) return;
    e.stopPropagation();
    mode.current = "resize";
    start.current = {
      mx: e.clientX,
      my: e.clientY,
      bx: boxRef.current.x,
      by: boxRef.current.y,
      bw: boxRef.current.w,
      bh: boxRef.current.h,
    };
  };

  return {
    box,
    setBox,
    /** 잡아서 이동할 영역(헤더)에 spread. */
    dragProps: { onPointerDown: beginDrag, style: { cursor: "grab" } },
    /** 우하단 리사이즈 핸들에 spread. */
    resizeProps: { onPointerDown: beginResize },
  };
}
