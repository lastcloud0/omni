"use client";

import { useEffect, useRef } from "react";

interface Props {
  /** 카메라 거리(=줌). 값이 작아질수록 구체 안으로 줌인. 부모가 ref로 제어. */
  camRef: React.MutableRefObject<number>;
  /** 목표 회전 각(라디안). yaw=좌우(Y축), pitch=상하(X축). null이면 자동회전. */
  rotRef?: React.MutableRefObject<{ yaw: number; pitch: number } | null>;
  count?: number;
}

const CAM_MIN = 0.5; // 최대 줌인
const CAM_MAX = 3.4; // 최대 줌아웃

/**
 * 캔버스 2D 의사(pseudo) 3D 파티클 구체.
 * - 피보나치 분포로 구면에 파티클 배치
 * - 자동 회전 + 원근 투영
 * - camRef(카메라 거리)로 줌 인/아웃
 * 가벼움: Three.js 없이 순수 canvas. count 기본 900.
 */
export function ParticleField({ camRef, rotRef, count = 900 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 피보나치 구면 분포
    const pts: { x: number; y: number; z: number }[] = [];
    const gold = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = gold * i;
      pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
    }

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

    let cam = camRef.current; // 부드럽게 따라갈 내부 카메라
    let yaw = 0; // 좌우 회전(Y축)
    let pitch = 0; // 상하 회전(X축)
    let raf = 0;

    const draw = () => {
      const target = Math.max(CAM_MIN, Math.min(CAM_MAX, camRef.current));
      cam += (target - cam) * 0.18; // 스무딩

      // 손이 조종 중이면 목표 각으로 추종, 아니면 자동회전(yaw 증가, pitch→0)
      const rot = rotRef?.current ?? null;
      if (rot) {
        yaw += (rot.yaw - yaw) * 0.15;
        pitch += (rot.pitch - pitch) * 0.15;
      } else {
        yaw += 0.0022; // 자동 회전
        pitch += (0 - pitch) * 0.05; // 천천히 수평 복귀
      }

      ctx.clearRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H / 2;
      const scale = Math.min(W, H) * 0.42;
      const focal = 1.9;
      const sinY = Math.sin(yaw), cosY = Math.cos(yaw);
      const sinP = Math.sin(pitch), cosP = Math.cos(pitch);

      // 줌인 정도(0..1) — 색/밝기 강조용
      const zoomT = 1 - (cam - CAM_MIN) / (CAM_MAX - CAM_MIN);

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        // Y축 회전(yaw) → X축 회전(pitch)
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;
        const y1 = p.y;
        const xr = x1;
        const yr = y1 * cosP - z1 * sinP;
        const zr = y1 * sinP + z1 * cosP;

        const z = zr + cam; // 카메라까지 거리
        if (z <= 0.06) continue; // 카메라 뒤 → 스킵
        const pp = focal / z;
        const sx = cx + xr * pp * scale;
        const sy = cy + yr * pp * scale;
        if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;

        const size = Math.max(0.6, pp * 1.5);
        const depth = Math.min(1, pp * 0.9); // 가까울수록 밝게
        const g = 180 + zoomT * 60;
        const a = 0.25 + depth * 0.7;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${Math.round(56 + zoomT * 60)}, ${Math.round(g)}, 248, ${a})`;
        ctx.fill();
      }

      // 중심 코어 글로우
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * (0.5 + zoomT));
      cg.addColorStop(0, `rgba(160,240,255,${0.10 + zoomT * 0.25})`);
      cg.addColorStop(1, "rgba(56,189,248,0)");
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, W, H);

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [camRef, rotRef, count]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
