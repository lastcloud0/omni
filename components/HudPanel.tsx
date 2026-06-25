"use client";

import { motion } from "framer-motion";
import type { Panel } from "@/lib/types";

interface Props {
  panel: Panel;
  index: number;
  onClose: (id: string) => void;
}

/**
 * 홀로그램 API 패널. 코너 마커 + 스캔라인 느낌의 미래적 카드.
 * priority 순서대로 index가 부여되어 등장 딜레이를 살짝 준다.
 */
export function HudPanel({ panel, index, onClose }: Props) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 12 }}
      transition={{ delay: index * 0.06, type: "spring", stiffness: 220, damping: 22 }}
      className="relative w-48 rounded-md border border-omni-cyan/30 bg-omni-bg/70 p-3 backdrop-blur-md"
      style={{ boxShadow: "0 0 18px rgba(56,189,248,0.18)" }}
    >
      {/* corner ticks */}
      <span className="pointer-events-none absolute left-0 top-0 h-3 w-3 border-l border-t border-omni-cyan/70" />
      <span className="pointer-events-none absolute right-0 top-0 h-3 w-3 border-r border-t border-omni-cyan/70" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-3 w-3 border-b border-l border-omni-cyan/70" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b border-r border-omni-cyan/70" />

      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] tracking-[0.25em] text-glow">{panel.title}</span>
        <button
          onClick={() => onClose(panel.id)}
          aria-label="close panel"
          className="text-[10px] text-omni-blue/50 transition hover:text-omni-cyan"
        >
          ✕
        </button>
      </div>

      <div className="space-y-1">
        {panel.lines.map((l) => (
          <div key={l.label} className="flex justify-between text-[11px]">
            <span className="text-omni-blue/50">{l.label}</span>
            <span className="text-omni-glow">{l.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 text-[8px] tracking-widest text-omni-blue/30">
        PRIORITY {panel.priority}
      </div>
    </motion.div>
  );
}
