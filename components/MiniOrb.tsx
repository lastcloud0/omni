"use client";

interface Props {
  label: string;
  size?: number;
  /** 강조(활성) — 글로우 강화. */
  active?: boolean;
  /** 메인 오브(GradientOrb)와 색 맞추는 hue 회전값(도). 시안 베이스에서 회전. */
  hue?: number;
}

/**
 * 각 라벨의 3D 유리 글리프. 원형 판/구체 없이 **아이콘 자체가 유리로 빚어져
 * 떠 있는** 느낌.
 *  - 세로 그라디언트 = 볼륨(위 밝고 아래 깊게)
 *  - 상단 흰 림/스페큘러 = 유리 광택
 *  - (부모의) CSS 글로우 = 홀로그램 부양감
 */
function GlassGlyph({ label, s }: { label: string; s: number }) {
  const id = label.toLowerCase();
  const defs = (
    <defs>
      {/* 유리 볼륨 */}
      <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e2f6ff" />
        <stop offset="0.42" stopColor="#6cc8f6" />
        <stop offset="1" stopColor="#134f7d" />
      </linearGradient>
      {/* 상단 광택 오버레이 */}
      <linearGradient id={`h-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.08" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
  const rim = {
    stroke: "rgba(255,255,255,0.6)",
    strokeWidth: 0.7,
    strokeLinejoin: "round" as const,
  };
  const fill = `url(#g-${id})`;
  const hi = `url(#h-${id})`;
  const svg = {
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    style: {
      // 유리 부양감: 시안 글로우 + 아래로 옅은 그림자
      filter:
        "drop-shadow(0 0 6px rgba(56,189,248,0.85)) drop-shadow(0 3px 5px rgba(0,10,25,0.55))",
    },
  };

  switch (label.toUpperCase()) {
    case "VISION": // 눈
      return (
        <svg {...svg}>
          {defs}
          {/* 눈매(아몬드) 유리 */}
          <path
            d="M2 12C5 6.5 19 6.5 22 12C19 17.5 5 17.5 2 12Z"
            fill={fill}
            {...rim}
          />
          {/* 홍채 */}
          <circle cx="12" cy="12" r="3.4" fill="#0a3350" stroke="rgba(255,255,255,0.5)" strokeWidth="0.7" />
          <circle cx="12" cy="12" r="1.5" fill="#bfeaff" />
          {/* 상단 광택 */}
          <path d="M2 12C5 6.5 19 6.5 22 12C16 9 8 9 2 12Z" fill={hi} />
        </svg>
      );
    case "MAP": // 지도 핀 (구멍 뚫린 물방울)
      return (
        <svg {...svg}>
          {defs}
          <path
            d="M12 2.2C7.9 2.2 4.6 5.5 4.6 9.6C4.6 15 12 21.8 12 21.8C12 21.8 19.4 15 19.4 9.6C19.4 5.5 16.1 2.2 12 2.2ZM12 12.4A2.8 2.8 0 1 1 12 6.8A2.8 2.8 0 0 1 12 12.4Z"
            fill={fill}
            fillRule="evenodd"
            {...rim}
          />
          {/* 상단 광택 */}
          <path d="M12 2.2C7.9 2.2 4.6 5.5 4.6 9.6C7 7.2 17 7.2 19.4 9.6C19.4 5.5 16.1 2.2 12 2.2Z" fill={hi} />
        </svg>
      );
    case "CHAT": // 말풍선
      return (
        <svg {...svg}>
          {defs}
          <path
            d="M4 6.5A2.5 2.5 0 0 1 6.5 4H17.5A2.5 2.5 0 0 1 20 6.5V13A2.5 2.5 0 0 1 17.5 15.5H9.5L5 19.5V15.5A2.5 2.5 0 0 1 4 13Z"
            fill={fill}
            {...rim}
          />
          {/* 상단 광택 */}
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H17.5A2.5 2.5 0 0 1 20 6.5V8C14 6 10 6 4 8Z" fill={hi} />
        </svg>
      );
    default:
      return null;
  }
}

/**
 * 위성 메뉴 버튼 본체. 클릭/링크는 부모(button/a)가 감싸고, 이건 비주얼만.
 * hue로 메인 오브 상태색을 따라간다(흰 광택은 색조 무관 유지).
 */
export function MiniOrb({ label, size = 60, active = false, hue = 0 }: Props) {
  return (
    <span
      className="relative inline-grid place-items-center"
      style={{
        width: size,
        height: size,
        filter: hue ? `hue-rotate(${hue}deg)` : undefined,
        transform: active ? "scale(1.06)" : undefined,
        transition: "transform 160ms ease",
      }}
    >
      {/* 아이콘이 버튼 대부분을 채우게 (컨테이너 없이 떠 있는 느낌) */}
      <GlassGlyph label={label} s={Math.round(size * 0.86)} />
    </span>
  );
}
