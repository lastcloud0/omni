"use client";

import { motion } from "framer-motion";
import { STATUS_LABEL, type OmniStatus } from "@/lib/types";

const DOT: Record<OmniStatus, string> = {
  idle: "bg-omni-blue",
  listening: "bg-omni-cyan",
  thinking: "bg-violet-400",
  responding: "bg-emerald-400",
};

export function StatusIndicator({ status }: { status: OmniStatus }) {
  return (
    <motion.div
      key={status}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 rounded-full border border-omni-blue/30 bg-omni-blue/5 px-4 py-1.5 text-xs tracking-[0.3em] text-glow"
    >
      <motion.span
        className={`h-2 w-2 rounded-full ${DOT[status]}`}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.4, repeat: Infinity }}
      />
      {STATUS_LABEL[status]}
    </motion.div>
  );
}
