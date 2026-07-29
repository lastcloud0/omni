"use client";

interface Props {
  label: string;
  size?: number;
  /** 강조(활성) — 글로우/크기 강화. */
  active?: boolean;
  /** 메인 오브(GradientOrb)와 색 맞추는 hue 회전값(도). */
  hue?: number;
}

/** 라벨 → public 아이콘 파일. */
const ICON_SRC: Record<string, string> = {
  VISION: "/icon-vision.svg",
  MAP: "/icon-map.svg",
  CHAT: "/icon-chat.svg",
};

/** 3개 아이콘이 각기 다른 위상으로 부유하도록 음수 딜레이. */
const FLOAT_DELAY: Record<string, string> = {
  VISION: "0s",
  MAP: "-1.7s",
  CHAT: "-3.4s",
};

/**
 * 위성 메뉴 버튼 본체 — 사용자 제공 SVG 아이콘. 원형 판 없이 아이콘만 떠 있는 룩.
 * 네온 글로우 + hue 회전으로 메인 오브 상태색을 따라간다.
 */
export function MiniOrb({ label, size = 60, active = false, hue = 0 }: Props) {
  const src = ICON_SRC[label.toUpperCase()];
  if (!src) return null;
  return (
    <span
      className="relative inline-grid place-items-center"
      style={{
        width: size,
        height: size,
        filter: hue ? `hue-rotate(${hue}deg)` : undefined,
        transform: active ? "scale(1.06)" : undefined,
        transition: "transform 160ms ease",
        perspective: 420, // 3D 부유 원근
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        draggable={false}
        className="omni-float3d"
        style={{
          width: size,
          height: size,
          transformStyle: "preserve-3d",
          animation: "omni-float3d 5.2s ease-in-out infinite",
          animationDelay: FLOAT_DELAY[label.toUpperCase()] ?? "0s",
          // 부양감 글로우
          filter:
            "drop-shadow(0 0 6px rgba(56,189,248,0.75)) drop-shadow(0 3px 5px rgba(0,10,25,0.5))",
        }}
      />
    </span>
  );
}
