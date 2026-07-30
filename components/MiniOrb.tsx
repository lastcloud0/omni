"use client";

import { Icon3D } from "@/components/Icon3D";

interface Props {
  label: string;
  size?: number;
  /** 강조(활성) — 크기 강화. */
  active?: boolean;
  /** (구버전 호환용, 현재 3D 아이콘에선 미사용) */
  hue?: number;
}

/** 라벨 → public 아이콘 파일. */
const ICON_SRC: Record<string, string> = {
  VISION: "/icon-vision.svg",
  MAP: "/icon-map.svg",
  CHAT: "/icon-chat.svg",
};

/** 라벨 → 3D 재질 색 (SVG 그라디언트 톤에 맞춤: 보라→파랑). */
const ICON_COLOR: Record<string, string> = {
  VISION: "#c394f7",
  MAP: "#8fb0ff",
  CHAT: "#a9b6ff",
};

/**
 * 위성 메뉴 버튼 본체 — SVG를 실제 3D로 압출한 아이콘(Icon3D).
 * 천천히 회전·부유한다. (glb 받으면 Icon3D 내부만 교체)
 */
export function MiniOrb({ label, size = 60, active = false }: Props) {
  const key = label.toUpperCase();
  const src = ICON_SRC[key];
  if (!src) return null;
  return (
    <span
      className="relative block"
      style={{
        width: size,
        height: size,
        lineHeight: 0,
        transform: active ? "scale(1.06)" : undefined,
        transition: "transform 160ms ease",
        filter: "drop-shadow(0 0 8px rgba(56,189,248,0.4))",
      }}
    >
      <Icon3D src={src} color={ICON_COLOR[key] ?? "#a9b6ff"} size={size} />
    </span>
  );
}
