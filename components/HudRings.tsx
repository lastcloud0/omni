"use client";

import { motion } from "framer-motion";
import type { OmniStatus } from "@/lib/types";

const STATUS_COLOR: Record<OmniStatus, string> = {
  idle: "#38bdf8",
  listening: "#22d3ee",
  thinking: "#a78bfa",
  responding: "#34d399",
};

/**
 * Concentric rotating holographic rings drawn as SVG. Color shifts with status;
 * rotation speed picks up while thinking/responding.
 */
export function HudRings({ status }: { status: OmniStatus }) {
  const color = STATUS_COLOR[status];
  const fast = status === "thinking" || status === "responding";

  return (
    <svg viewBox="0 0 400 400" className="absolute inset-0 m-auto h-full w-full">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer dashed ring */}
      <motion.circle
        cx="200"
        cy="200"
        r="180"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray="2 14"
        opacity="0.6"
        filter="url(#glow)"
        animate={{ rotate: 360 }}
        transition={{ duration: fast ? 10 : 30, repeat: Infinity, ease: "linear" }}
        style={{ originX: "200px", originY: "200px" }}
      />

      {/* Mid ring with gaps (tick marks) */}
      <motion.circle
        cx="200"
        cy="200"
        r="150"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeDasharray="40 18"
        opacity="0.5"
        filter="url(#glow)"
        animate={{ rotate: -360 }}
        transition={{ duration: fast ? 14 : 40, repeat: Infinity, ease: "linear" }}
        style={{ originX: "200px", originY: "200px" }}
      />

      {/* Inner solid ring, pulsing */}
      <motion.circle
        cx="200"
        cy="200"
        r="120"
        fill="none"
        stroke={color}
        strokeWidth="1"
        opacity="0.35"
        filter="url(#glow)"
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        style={{ originX: "200px", originY: "200px" }}
      />

      {/* Crosshair ticks */}
      {[0, 90, 180, 270].map((deg) => (
        <line
          key={deg}
          x1="200"
          y1="20"
          x2="200"
          y2="34"
          stroke={color}
          strokeWidth="2"
          opacity="0.7"
          filter="url(#glow)"
          transform={`rotate(${deg} 200 200)`}
        />
      ))}
    </svg>
  );
}
