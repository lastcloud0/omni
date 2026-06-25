"use client";

import { motion } from "framer-motion";
import type { OmniStatus } from "@/lib/types";
import { useAudioLevel } from "@/hooks/useAudioLevel";
import { CORE_BACKGROUND, CORE_SIZE, CORE_TINT } from "@/lib/coreConfig";
import { HudRings } from "./HudRings";
import { Waveform } from "./Waveform";
import { StatusIndicator } from "./StatusIndicator";

interface Props {
  status: OmniStatus;
  awake: boolean;
  onToggle: () => void;
  /** 패널이 떠 있으면 true → 코어를 축소한다. */
  compact?: boolean;
}

/**
 * The central holographic core: rotating rings + audio-reactive waveform + a
 * pulsing arc-reactor core that doubles as the wake/sleep toggle button.
 *
 * 코어 크기는 `compact`에 따라 확대/축소되며, 배경은 lib/coreConfig 에서
 * 설정한다(사용자 이미지 슬롯).
 */
export function OmniHUD({ status, awake, onToggle, compact = false }: Props) {
  const micActive = awake && (status === "listening" || status === "responding");
  const { level, data } = useAudioLevel(micActive);

  const size = compact ? CORE_SIZE.compact : CORE_SIZE.expanded;

  // 사용자 배경 이미지가 있으면 이미지 + 네온 틴트, 없으면 기본 그라디언트.
  const coreBackground = CORE_BACKGROUND
    ? `linear-gradient(rgba(2,6,23,${CORE_TINT}), rgba(2,6,23,${CORE_TINT})), url(${CORE_BACKGROUND}) center/cover`
    : "radial-gradient(circle, rgba(56,189,248,0.35) 0%, rgba(2,6,23,0.9) 70%)";

  return (
    <div className="relative flex flex-col items-center gap-6">
      <div className="relative h-[400px] w-[400px] max-w-[88vw]">
        <HudRings status={status} />
        <Waveform data={data} active={micActive} />

        {/* Arc reactor core / toggle — 크기가 compact에 따라 애니메이션 */}
        <motion.button
          onClick={onToggle}
          aria-label={awake ? "Deactivate OMNI" : "Activate OMNI"}
          className="absolute inset-0 m-auto flex items-center justify-center rounded-full"
          animate={{ width: size, height: size }}
          transition={{ type: "spring", stiffness: 200, damping: 24 }}
          style={{ width: size, height: size }}
        >
          <motion.div
            className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-omni-cyan/40"
            style={{ background: coreBackground }}
            animate={{
              boxShadow: awake
                ? [
                    "0 0 24px rgba(56,189,248,0.6)",
                    `0 0 ${40 + level * 60}px rgba(56,189,248,0.9)`,
                    "0 0 24px rgba(56,189,248,0.6)",
                  ]
                : "0 0 14px rgba(56,189,248,0.3)",
              scale: awake ? 1 + level * 0.12 : 1,
            }}
            transition={{ duration: 1.2, repeat: awake ? Infinity : 0 }}
          >
            <span className="select-none text-lg font-bold tracking-[0.2em] text-glow">
              {awake ? "ON" : "OFF"}
            </span>
          </motion.div>
        </motion.button>
      </div>

      <StatusIndicator status={status} />
    </div>
  );
}
