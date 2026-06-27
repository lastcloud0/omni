"use client";

import { useEffect, useRef } from "react";
import { LINK_NODES, loadIcon, type LinkNode } from "@/lib/linkNodes";

interface Props {
  /** 카메라 거리(=줌). 값이 작아질수록 구체 안으로 줌인. 부모가 ref로 제어. */
  camRef: React.MutableRefObject<number>;
  /** yaw 회전 "속도"(라디안/프레임). null이면 자동회전, 0이면 정지(브레이크). */
  spinRef?: React.MutableRefObject<number | null>;
  /** 손 포인터(화면 정규화 0..1, 거울모드 반영됨). null이면 호버 없음. */
  pointerRef?: React.MutableRefObject<{ x: number; y: number } | null>;
  /** 현재 핀치값(작을수록 오므림). 노드 위 핀치 → 링크 열림. */
  pinchRef?: React.MutableRefObject<number>;
  /** 현재 호버 중인 노드를 부모에 알림(줌 억제용). */
  hoverRef?: React.MutableRefObject<LinkNode | null>;
  /** 노드 활성화(링크 열기) 콜백. */
  onActivate?: (node: LinkNode) => void;
  count?: number;
}

const CAM_MIN = 0.5;
const CAM_MAX = 3.4;
const HIT_RADIUS = 64; // 호버 판정 반경(px) — 널널하게
const PINCH_CLICK = 0.05; // 이 값 아래로 오므리면 클릭

/**
 * 캔버스 2D 의사 3D 파티클 구체 + 링크 노드(빌보드 아이콘).
 * 손 포인터로 노드를 가리키고 핀치하면 링크가 열린다.
 */
export function ParticleField({
  camRef,
  spinRef,
  pointerRef,
  pinchRef,
  hoverRef,
  onActivate,
  count = 400,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 배경 파티클(피보나치 구면)
    const gold = Math.PI * (3 - Math.sqrt(5));
    const pts: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = gold * i;
      pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
    }

    // 링크 노드는 적도 부근 링에 배치 → yaw 회전만으로 다 앞으로 가져올 수 있음
    const nodes = LINK_NODES.map((n, i) => {
      const th = (i / LINK_NODES.length) * Math.PI * 2;
      const yy = (i % 2 ? 0.18 : -0.18); // 위아래 살짝 엇갈리게
      const rr = Math.sqrt(1 - yy * yy) * 1.06;
      return { node: n, x: Math.cos(th) * rr, y: yy * 1.06, z: Math.sin(th) * rr };
    });

    // 아이콘 비동기 로드
    const icons: Record<string, HTMLImageElement | null> = {};
    nodes.forEach(({ node }) => {
      loadIcon(node.slug, node.color).then((img) => (icons[node.id] = img));
    });

    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    let cam = camRef.current;
    let yaw = 0, pitch = 0, raf = 0;
    let lastPinch = 1;
    // 마우스 조작 상태
    let mousePtr: { x: number; y: number } | null = null;
    let hoveredNode: LinkNode | null = null;
    let dragging = false;
    let moved = false; // 드래그로 움직였는지(클릭 오작동 방지)
    let lastMX = 0, lastMY = 0;
    let lastInteract = 0; // 마지막 마우스/손 조작 시각 → 일정시간 후 자동회전

    // --- 마우스 핸들러 ---
    const onDown = (e: PointerEvent) => {
      dragging = true;
      moved = false;
      lastMX = e.clientX;
      lastMY = e.clientY;
      lastInteract = performance.now();
    };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mousePtr = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
      if (dragging) {
        const dx = e.clientX - lastMX, dy = e.clientY - lastMY;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        yaw += dx * 0.006;
        pitch = Math.max(-1.2, Math.min(1.2, pitch + dy * 0.006));
        lastMX = e.clientX;
        lastMY = e.clientY;
        lastInteract = performance.now();
      }
    };
    const onUp = () => { dragging = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camRef.current = Math.max(CAM_MIN, Math.min(CAM_MAX, camRef.current + e.deltaY * 0.0015));
      lastInteract = performance.now();
    };
    const onClick = () => {
      if (moved) { moved = false; return; } // 드래그였으면 클릭 무시
      if (hoveredNode) onActivateRef.current?.(hoveredNode);
    };
    const onLeave = () => { mousePtr = null; dragging = false; };
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("pointerleave", onLeave);

    const draw = () => {
      const target = Math.max(CAM_MIN, Math.min(CAM_MAX, camRef.current));
      cam += (target - cam) * 0.18;

      // 회전: 손(속도) > 마우스 드래그(직접) > 자동회전(둘 다 일정시간 없을 때)
      const spin = spinRef?.current ?? null;
      const idle = performance.now() - lastInteract > 2500;
      if (spin != null) {
        yaw += spin; // 손 비틀기
      } else if (idle) {
        yaw += 0.0022; // 자동회전
        pitch += (0 - pitch) * 0.03; // 천천히 수평 복귀
      }
      // (마우스 드래그는 onMove에서 yaw/pitch 직접 가산)

      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      const scale = Math.min(W, H) * 0.42;
      const focal = 1.9;
      const sinY = Math.sin(yaw), cosY = Math.cos(yaw);
      const sinP = Math.sin(pitch), cosP = Math.cos(pitch);
      const zoomT = 1 - (cam - CAM_MIN) / (CAM_MAX - CAM_MIN);

      const project = (p: { x: number; y: number; z: number }) => {
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;
        const xr = x1;
        const yr = p.y * cosP - z1 * sinP;
        const zr = p.y * sinP + z1 * cosP;
        const z = zr + cam;
        return { z, xr, yr };
      };

      // 배경 파티클
      for (const p of pts) {
        const { z, xr, yr } = project(p);
        if (z <= 0.06) continue;
        const pp = focal / z;
        const sx = cx + xr * pp * scale;
        const sy = cy + yr * pp * scale;
        if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
        const size = Math.max(0.5, pp * 1.2);
        const depth = Math.min(1, pp * 0.9);
        const g = 180 + zoomT * 60;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${Math.round(56 + zoomT * 60)}, ${Math.round(g)}, 248, ${0.2 + depth * 0.55})`;
        ctx.fill();
      }

      // 중심 글로우
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * (0.5 + zoomT));
      cg.addColorStop(0, `rgba(160,240,255,${0.08 + zoomT * 0.2})`);
      cg.addColorStop(1, "rgba(56,189,248,0)");
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, W, H);

      // 포인터 화면 좌표 (손 포인터 우선, 없으면 마우스)
      const ptr = pointerRef?.current ?? mousePtr;
      const ptrX = ptr ? ptr.x * W : -999;
      const ptrY = ptr ? ptr.y * H : -999;

      // 링크 노드 (앞쪽일수록 나중에 그려 위로)
      const drawList = nodes
        .map((nd) => ({ nd, proj: project(nd) }))
        .filter((o) => o.proj.z > 0.06)
        .sort((a, b) => b.proj.z - a.proj.z); // 먼 것부터

      let hovered: LinkNode | null = null;
      for (const { nd, proj } of drawList) {
        const pp = focal / proj.z;
        const sx = cx + proj.xr * pp * scale;
        const sy = cy + proj.yr * pp * scale;
        const front = proj.z < cam + 0.2; // 구체 앞면만 상호작용
        const d = Math.hypot(sx - ptrX, sy - ptrY);
        const isHover = front && ptr != null && d < HIT_RADIUS;
        if (isHover) hovered = nd.node;

        const base = 26 * pp;
        const ring = base * (isHover ? 1.45 : 1) + 6;
        // 글로우 디스크
        const gg = ctx.createRadialGradient(sx, sy, 0, sx, sy, ring);
        gg.addColorStop(0, `${nd.node.color}${isHover ? "cc" : "66"}`);
        gg.addColorStop(1, `${nd.node.color}00`);
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(sx, sy, ring, 0, Math.PI * 2);
        ctx.fill();

        // 아이콘
        const img = icons[nd.node.id];
        const s = base * (isHover ? 1.3 : 1);
        if (img) {
          ctx.globalAlpha = Math.min(1, pp);
          ctx.drawImage(img, sx - s / 2, sy - s / 2, s, s);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = nd.node.color;
          ctx.beginPath();
          ctx.arc(sx, sy, s * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }

        // 호버 시 라벨 + 링
        if (isHover) {
          ctx.strokeStyle = nd.node.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sx, sy, ring, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "#fff";
          ctx.font = "12px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(nd.node.label, sx, sy + ring + 14);
        }
      }

      if (hoverRef) hoverRef.current = hovered;
      hoveredNode = hovered; // 마우스 클릭 선택용
      canvas.style.cursor = hovered ? "pointer" : dragging ? "grabbing" : "grab";

      // 핀치 클릭(하강 에지) + 호버 → 링크 활성화
      const pinch = pinchRef?.current ?? 1;
      if (hovered && pinch < PINCH_CLICK && lastPinch >= PINCH_CLICK) {
        onActivateRef.current?.(hovered);
      }
      lastPinch = pinch;

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [camRef, spinRef, pointerRef, pinchRef, hoverRef, count]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />;
}
