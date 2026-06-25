"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { OmniStatus } from "@/lib/types";

interface Props {
  status: OmniStatus;
  /** 마이크/출력 음량 0..1 — 오로라 밝기/진폭에 반영. */
  level?: number;
  onClick?: () => void;
}

// 상태별 오로라 색 [메인(파랑계), 보조(보라/마젠타), 강조] — 레퍼런스 톤.
const PALETTE: Record<OmniStatus, [string, string, string]> = {
  idle: ["56,140,255", "180,70,255", "120,90,255"],
  listening: ["40,200,255", "150,90,255", "90,160,255"],
  thinking: ["120,80,255", "230,70,230", "170,70,255"],
  responding: ["40,220,200", "90,150,255", "120,220,180"],
};

const DISPLAY = 280; // 화면 표시 크기(px)
const SIZE = 320; // 내부 렌더 해상도

/**
 * 검은 글로시 구체 안에서 파랑→보라 오로라가 물결치는 구.
 * (Apple Intelligence / Siri 스타일)
 *  - CSS: 어두운 구 베이스 + 림 라이트 + 상단 광택
 *  - canvas: 사인파 리본을 따라 부드러운 글로우 블롭을 'lighter'로 합성 → 오로라
 */
export function OmniOrb({ status, level = 0, onClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef(status);
  const levelRef = useRef(level);
  statusRef.current = status;
  levelRef.current = level;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const R = SIZE / 2 - 6;
    let t = 0;
    let raf = 0;

    // 한 점에 부드러운 글로우(반경 rad) 찍기.
    const glow = (x: number, y: number, rad: number, rgb: string, a: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(${rgb},${a})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    };

    // 사인파 리본: 가로로 흐르는 곡선을 따라 글로우 블롭을 배치.
    const ribbon = (
      baseY: number,
      amp: number,
      freq: number,
      phase: number,
      speed: number,
      rgb: string,
      alpha: number,
      blob: number
    ) => {
      const pts = 16;
      for (let i = 0; i <= pts; i++) {
        const x = cx - R + (i / pts) * (R * 2);
        const env = Math.sin((i / pts) * Math.PI); // 가장자리 0
        const y =
          cy + baseY + Math.sin((i / pts) * freq + t * speed + phase) * amp;
        glow(x, y, blob * (0.6 + env * 0.6), rgb, alpha * env);
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      const s = statusRef.current;
      const lv = levelRef.current;
      const [c1, c2, c3] = PALETTE[s];
      const energy = s === "thinking" || s === "responding" ? 1.25 : 1;
      const spd = (s === "thinking" || s === "responding" ? 0.05 : 0.03) * energy;
      const amp = (18 + lv * 34) * energy;
      const a = 0.5 + lv * 0.4;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalCompositeOperation = "lighter";

      // 아래쪽으로 치우친 메인 오로라 띠 (레퍼런스의 대각선 빛줄기)
      ribbon(R * 0.28, amp, 3.0, 0, spd, c1, a * 0.6, 64); // 파랑 베이스
      ribbon(R * 0.22, amp * 0.8, 3.6, 1.4, spd * 1.1, c2, a * 0.7, 56); // 보라/마젠타
      ribbon(R * 0.34, amp * 0.6, 4.4, 3.0, spd * 0.9, c3, a * 0.45, 48); // 강조
      // 미세한 상부 잔광
      ribbon(-R * 0.18, amp * 0.5, 2.4, 2.0, spd * 0.8, c1, a * 0.18, 60);

      ctx.restore();
      ctx.globalCompositeOperation = "source-over";
      t += 1;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const glowColor = PALETTE[status][0];

  return (
    <motion.button
      onClick={onClick}
      aria-label="OMNI"
      className="relative cursor-pointer rounded-full"
      style={{
        width: DISPLAY,
        height: DISPLAY,
        maxWidth: "78vw",
        // 어두운 글로시 구 베이스 + 림/광택
        background:
          "radial-gradient(circle at 50% 38%, #14151f 0%, #0a0a12 45%, #050507 72%, #020203 100%)",
        boxShadow: `0 0 60px rgba(${glowColor},0.30), inset 0 0 50px rgba(0,0,0,0.7), inset 0 2px 14px rgba(255,255,255,0.06)`,
      }}
      whileTap={{ scale: 0.97 }}
      animate={{ scale: [1, 1.012, 1] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* 내부 오로라 */}
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%" }}
        className="pointer-events-none absolute inset-0 rounded-full"
        aria-hidden
      />
      {/* 유리 광택(상단 하이라이트) */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(ellipse 50% 30% at 42% 26%, rgba(255,255,255,0.22), transparent 60%)",
        }}
      />
      {/* 얇은 림 라이트 */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.10)" }}
      />
    </motion.button>
  );
}
