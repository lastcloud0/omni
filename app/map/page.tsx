"use client";

import dynamic from "next/dynamic";

// MapLibre는 window에 의존 → SSR 비활성화하고 클라이언트에서만 로드.
const OmniMap = dynamic(() => import("@/components/OmniMap").then((m) => m.OmniMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-[#02040a]">
      <span className="text-[11px] tracking-[0.4em] text-sky-300/70">LOADING MAP…</span>
    </div>
  ),
});

export default function MapPage() {
  return <OmniMap />;
}
