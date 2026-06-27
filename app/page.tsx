"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useOmni } from "@/hooks/useOmni";
import { useAudioLevel } from "@/hooks/useAudioLevel";
import { OmniOrb } from "@/components/OmniOrb";
import { MiniOrb } from "@/components/MiniOrb";

export default function Home() {
  const {
    status,
    awake,
    interacted,
    interim,
    messages,
    toggleAwake,
    sendText,
  } = useOmni();
  const micActive = awake && (status === "listening" || status === "responding");
  const { level } = useAudioLevel(micActive);
  const [draft, setDraft] = useState("");
  const [menu, setMenu] = useState(false); // 구체 호버/터치 시 위성 메뉴
  const [chatOpen, setChatOpen] = useState(false); // CHAT 모드(하단 대화 UI)
  const closeT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openMenu = () => {
    if (closeT.current) clearTimeout(closeT.current);
    setMenu(true);
  };
  const closeMenu = () => {
    closeT.current = setTimeout(() => setMenu(false), 260); // 버튼으로 이동할 틈
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendText(draft);
    setDraft("");
  };

  const recent = messages.slice(-6);
  const lastMsg = messages[messages.length - 1];

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-between px-4 py-8 sm:px-5 sm:py-10">
      {/* 네임 — 상단 중앙 */}
      <span className="absolute left-1/2 top-6 -translate-x-1/2 text-[13px] font-light tracking-[0.5em] text-sky-300/80">
        O M N I
      </span>

      {/* 중앙: 구체 + 세포분열 미니코어 위성 메뉴 */}
      <section className="flex flex-1 items-center justify-center">
        {/* 호버 기준 = 이 원 하나 (메인코어 + 약 200px). 경계가 단일이라 깜빡임 없음 */}
        <div
          className="relative flex items-center justify-center rounded-full"
          style={{ width: 620, height: 620, maxWidth: "92vmin", maxHeight: "92vmin" }}
          onMouseEnter={openMenu}
          onMouseLeave={closeMenu}
        >
          <OmniOrb status={status} level={level} onClick={() => setMenu((m) => !m)} />

          {/* 미니 코어 버튼 — 메인코어 중심에서 솟아나와 오른쪽에 나란히.
              (추후 개수 늘면 dx/dy를 원호로 배치해 균형 유지) */}
          {[
            { label: "VISION", dx: 188, dy: -150, href: "/vision" },
            { label: "CHAT", dx: 230, dy: 88, onClick: () => { setChatOpen(true); if (!awake) toggleAwake(); } },
          ].map((b, i) => {
            const common = {
              initial: false as const,
              animate: menu
                ? { x: b.dx, y: b.dy, scale: 1, opacity: 1 }
                : { x: 0, y: 0, scale: 0.2, opacity: 0 },
              transition: { type: "spring" as const, stiffness: 280, damping: 22, delay: i * 0.05 },
              style: {
                marginLeft: -32, // 버튼(64) 절반 보정 → 중심이 코어 중심에 일치
                marginTop: -32,
                pointerEvents: (menu ? "auto" : "none") as "auto" | "none",
              },
              className: "absolute left-1/2 top-1/2 z-20 hidden sm:block",
            };
            return b.href ? (
              <motion.a key={b.label} href={b.href} {...common}>
                <MiniOrb label={b.label} size={64} />
              </motion.a>
            ) : (
              <motion.button key={b.label} onClick={b.onClick} {...common}>
                <MiniOrb label={b.label} size={64} />
              </motion.button>
            );
          })}

          {/* 모바일: 구체 아래 미니코어 2개 (코어 중심 기준 아래로) */}
          <div
            className={`absolute left-1/2 top-1/2 z-20 flex gap-4 transition-opacity duration-300 sm:hidden ${
              menu ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            style={{ transform: "translate(-50%, 160px)" }}
          >
            <button onClick={() => { setChatOpen(true); if (!awake) toggleAwake(); }}>
              <MiniOrb label="CHAT" size={60} />
            </button>
            <a href="/vision">
              <MiniOrb label="VISION" size={60} />
            </a>
          </div>

          {/* 받아쓰기 / 응답 자막 — "옴니" 활성화 후에만 표시 */}
          {interacted && (
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 w-[min(90vw,520px)] text-center"
              style={{ transform: "translate(-50%, 180px)" }}
            >
              {interim ? (
                <p className="text-base text-sky-200/90">“{interim}”</p>
              ) : lastMsg ? (
                <p
                  className={`text-sm leading-relaxed ${
                    lastMsg.role === "assistant" ? "text-slate-200" : "text-sky-300/70"
                  }`}
                >
                  {lastMsg.content}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </section>

      {/* CHAT 모드 — 딤 배경 + 하단 오버레이(코어 위치 영향 X) */}
      {chatOpen && (
        <>
        {/* 딤 처리 — 코어와 계층 구분, 클릭 시 닫힘 */}
        <div
          className="fixed inset-0 z-20 bg-black/55 backdrop-blur-[1px]"
          onClick={() => setChatOpen(false)}
        />
        <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col gap-2 px-4 pb-7 sm:px-5">
          {/* 대화 로그 (최근 몇 개) */}
          <div className="flex flex-col gap-2.5">
            <AnimatePresence initial={false}>
              {recent.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-sky-500/15 text-sky-50"
                        : "bg-white/[0.05] text-slate-100"
                    }`}
                  >
                    {m.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* 실시간 음성 자막 */}
          <div className="h-5 text-center text-sm text-sky-300/70">
            {interim && <span>“{interim}”</span>}
          </div>

          {/* 입력창 + SEND (마이크 없음) */}
          <form onSubmit={submit} className="flex w-full items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="무엇이든 물어보세요…"
              className="h-12 min-w-0 flex-1 rounded-2xl border border-sky-400/30 bg-white/[0.06] px-4 text-[15px] text-sky-50 placeholder:text-slate-400/80 outline-none transition focus:border-sky-400/80 focus:bg-white/[0.09] focus:ring-2 focus:ring-sky-500/20"
            />
            <button
              type="submit"
              className="h-12 shrink-0 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 px-5 text-[13px] font-medium text-white transition hover:brightness-110 active:scale-95 sm:px-6 sm:text-[14px]"
            >
              SEND
            </button>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              aria-label="닫기"
              className="h-12 w-12 shrink-0 rounded-2xl border border-white/15 bg-white/[0.06] text-[15px] text-slate-300 transition hover:border-sky-400/50 hover:text-sky-100"
            >
              ✕
            </button>
          </form>
        </div>
        </>
      )}
    </main>
  );
}
