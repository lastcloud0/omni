"use client";

import { useEffect, useRef } from "react";

interface Props {
  data: React.MutableRefObject<Uint8Array>;
  active: boolean;
}

/**
 * Circular audio-reactive waveform rendered on a canvas. Bars radiate from the
 * center ring; when inactive it idles with a gentle synthetic shimmer.
 */
export function Waveform({ data, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const dpr = window.devicePixelRatio || 1;
    const size = 320;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = 92;
    let t = 0;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      const bins = data.current;
      const count = 72;

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const srcIdx = Math.floor((i / count) * bins.length);
        const raw = active ? bins[srcIdx] / 255 : 0;
        const idle = 0.12 + Math.sin(t * 0.05 + i * 0.4) * 0.06;
        const amp = Math.max(raw, idle);
        const len = 8 + amp * 64;

        const x1 = cx + Math.cos(angle) * radius;
        const y1 = cy + Math.sin(angle) * radius;
        const x2 = cx + Math.cos(angle) * (radius + len);
        const y2 = cy + Math.sin(angle) * (radius + len);

        const alpha = 0.35 + amp * 0.65;
        ctx.strokeStyle = `rgba(${56 + amp * 80}, ${189 + amp * 40}, 248, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      t += 1;
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => cancelAnimationFrame(raf);
  }, [data, active]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: 320, height: 320 }}
      className="pointer-events-none absolute inset-0 m-auto"
      aria-hidden
    />
  );
}
