"use client";

interface Props {
  label: string;
  size?: number;
  /** 강조(활성) 색조. */
  active?: boolean;
}

/**
 * 큰 OMNI 코어와 같은 룩의 미니 구체. 위성 메뉴 버튼 본체로 사용.
 * 클릭 핸들러/링크는 부모(button/a)가 감싸고, 이건 비주얼만 담당.
 */
export function MiniOrb({ label, size = 60, active = false }: Props) {
  return (
    <span
      className="relative flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 38% 32%, #a5f3ff 0%, #38bdf8 38%, #3b5bdb 72%, #1e1b4b 100%)",
        border: "1px solid rgba(165,243,255,0.35)",
        boxShadow: active
          ? "0 0 22px rgba(56,189,248,0.7), inset 0 1px 6px rgba(255,255,255,0.25)"
          : "0 0 14px rgba(56,189,248,0.4), inset 0 1px 6px rgba(255,255,255,0.2)",
      }}
    >
      {/* 상단 광택 */}
      <span
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(ellipse 50% 30% at 40% 26%, rgba(255,255,255,0.35), transparent 60%)",
        }}
      />
      <span
        className="relative z-10 font-medium tracking-[0.12em] text-white"
        style={{ fontSize: Math.max(9, size * 0.17), textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}
      >
        {label}
      </span>
    </span>
  );
}
