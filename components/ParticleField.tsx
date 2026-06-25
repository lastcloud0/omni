"use client";

import { useEffect, useRef } from "react";
import { LINK_NODES, loadIcon, type LinkNode } from "@/lib/linkNodes";

interface Props {
  /** 카메라 거리(=줌). 값이 작아질수록 구체 안으로 줌인. 부모가 ref로 제어. */
  camRef: React.MutableRefObject<number>;
  /** 목표 회전 각(라디안). yaw=좌우(Y축), pitch=상하(X축). null이면 자동회전. */
  rotRef?: React.MutableRefObject<{ yaw: number; pitch: number } | null>;
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
const HIT_RADIUS = 46; // 호버 판정 반경(px)
const PINCH_CLICK = 0.05; // 이 값 아래로 오므리면 클릭

/**
 * 캔버스 2D 의사 3D 파티클 구체 + 링크 노드(빌보드 아이콘).
 * 손 포인터로 노드를 가리키고 핀치하면 링크가 열린다.
 */
export function ParticleField({
  camRef,
  rotRef,
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

    // 링크 노드도 구면에 고르게 배치 (반지름 살짝 키워 표면 위로)
    const nodes = LINK_NODES.map((n, i) => {
      const k = LINK_NODES.length;
      const y = 1 - ((i + 0.5) / k) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = gold * (i + 1);
      return { node: n, x: Math.cos(th) * r * 1.08, y: y * 1.08, z: Math.sin(th) * r * 1.08 };
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

    const draw = () => {
      const target = Math.max(CAM_MIN, Math.min(CAM_MAX, camRef.current));
      cam += (target - cam) * 0.18;

      const rot = rotRef?.current ?? null;
      if (rot) {
        yaw += (rot.yaw - yaw) * 0.15;
        pitch += (rot.pitch - pitch) * 0.15;
      } else {
        yaw += 0.0022;
        pitch += (0 - pitch) * 0.05;
      }

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

      // 포인터 화면 좌표
      const ptr = pointerRef?.current ?? null;
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
    };
  }, [camRef, rotRef, pointerRef, pinchRef, hoverRef, count]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />;
}
