"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useOmni } from "@/hooks/useOmni";
import { useAudioLevel } from "@/hooks/useAudioLevel";
import { OmniOrb } from "@/components/OmniOrb";

export default function Home() {
  const {
    status,
    awake,
    interim,
    supported,
    messages,
    toggleAwake,
    sendText,
    clearLog,
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
    closeT.current = setTimeout(() => setMenu(false), 180); // 버튼으로 이동할 틈
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendText(draft);
    setDraft("");
  };

  const recent = messages.slice(-6);

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-between px-4 py-8 sm:px-5 sm:py-10">
      {/* 네임 — 상단 중앙 */}
      <span className="absolute left-1/2 top-6 -translate-x-1/2 text-[13px] font-light tracking-[0.5em] text-sky-300/80">
        O M N I
      </span>

      {/* goo(메타볼) 필터 정의 — 화면엔 안 보임 */}
      <svg className="pointer-events-none absolute h-0 w-0" aria-hidden>
        <defs>
          <filter id="goo-filter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
            />
          </filter>
        </defs>
      </svg>

      {/* 중앙: 구체 + 세포분열 위성 메뉴 */}
      <section className="flex flex-1 items-center justify-center">
        <div
          className="relative"
          onMouseEnter={openMenu}
          onMouseLeave={closeMenu}
        >
          {/* 메타볼 블롭 레이어(데스크톱) — 구체에서 세포가 분열되어 나옴 */}
          <div className="goo pointer-events-none absolute left-1/2 top-1/2 hidden h-0 w-0 sm:block">
            {/* 본체(구체 우측에 붙는 큰 세포) */}
            <span
              className="absolute rounded-full bg-sky-400/55"
              style={{ width: 96, height: 96, left: 40, top: -48 }}
            />
            {/* 분열 세포 1, 2 — 열리면 바깥으로 */}
            {[{ y: -46 }, { y: 46 }].map((c, i) => (
              <motion.span
                key={i}
                className="absolute rounded-full bg-sky-400/55"
                initial={false}
                animate={
                  menu
                    ? { x: 168, y: c.y, width: 56, height: 56, opacity: 1 }
                    : { x: 48, y: 0, width: 70, height: 70, opacity: 1 }
                }
                transition={{ type: "spring", stiffness: 260, damping: 24, delay: i * 0.05 }}
                style={{ left: -28, top: -28 }}
              />
            ))}
          </div>

          <OmniOrb status={status} level={level} onClick={() => setMenu((m) => !m)} />

          {/* 실제 버튼(텍스트) — 블롭 위. 데스크톱은 우측 세포 위치에 정렬 */}
          <div
            className="absolute left-1/2 top-1/2 hidden sm:block"
            onMouseEnter={openMenu}
            onMouseLeave={closeMenu}
          >
            <motion.button
              onClick={() => { setChatOpen(true); if (!awake) toggleAwake(); }}
              initial={false}
              animate={menu ? { x: 168, y: -46, opacity: 1 } : { x: 40, y: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              style={{ left: -44, top: -16, pointerEvents: menu ? "auto" : "none" }}
              className="absolute w-[88px] text-center text-xs font-medium tracking-[0.2em] text-sky-50"
            >
              CHAT
            </motion.button>
            <motion.a
              href="/vision"
              initial={false}
              animate={menu ? { x: 168, y: 46, opacity: 1 } : { x: 40, y: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.05 }}
              style={{ left: -44, top: -16, pointerEvents: menu ? "auto" : "none" }}
              className="absolute w-[88px] text-center text-xs font-medium tracking-[0.2em] text-sky-50"
            >
              VISION
            </motion.a>
          </div>

          {/* 모바일 메뉴 (아래, 단순 페이드) */}
          <div
            className={`absolute left-1/2 top-full z-20 mt-3 flex -translate-x-1/2 gap-2 transition-opacity duration-300 sm:hidden ${
              menu ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <button
              onClick={() => { setChatOpen(true); if (!awake) toggleAwake(); }}
              className="rounded-2xl border border-sky-400/40 bg-sky-500/15 px-5 py-2.5 text-xs tracking-[0.2em] text-sky-100 backdrop-blur-md"
            >
              CHAT
            </button>
            <a
              href="/vision"
              className="rounded-2xl border border-white/15 bg-white/[0.07] px-5 py-2.5 text-xs tracking-[0.2em] text-slate-100 backdrop-blur-md"
            >
              VISION
            </a>
          </div>
        </div>
      </section>

      {/* CHAT 모드일 때만 하단 대화 UI 표시 */}
      {chatOpen && (
      <>
      {/* 닫기 */}
      <button
        onClick={() => setChatOpen(false)}
        className="absolute right-5 top-5 text-[11px] tracking-widest text-slate-500 transition hover:text-sky-300"
      >
        CLOSE ✕
      </button>

      {/* 대화 로그 (최근 몇 개만, 미니멀) */}
      <section className="flex w-full flex-col gap-2.5 pb-4">
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
      </section>

      {/* 하단: 입력창 (가시성 강화) + SEND + 음성 토글 */}
      <section className="w-full">
        {/* 실시간 음성 인식 자막 */}
        <div className="mb-1.5 h-5 text-center text-sm text-sky-300/70">
          {interim && <span>“{interim}”</span>}
        </div>
        {!supported && (
          <p className="mb-2 text-center text-xs text-amber-400/70">
            이 브라우저는 음성 인식을 지원하지 않습니다. 입력창으로 명령하세요.
          </p>
        )}
        <form onSubmit={submit} className="flex w-full items-center gap-2">
          {/* 입력창 — 넓게 차지 */}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="무엇이든 물어보세요…"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-sky-400/30 bg-white/[0.06] px-4 text-[15px] text-sky-50 placeholder:text-slate-400/80 outline-none transition focus:border-sky-400/80 focus:bg-white/[0.09] focus:ring-2 focus:ring-sky-500/20"
          />

          {/* 동작 버튼 그룹: 마이크 + SEND 를 오른쪽에 묶음 */}
          <button
            type="button"
            onClick={toggleAwake}
            aria-label={awake ? "음성 끄기" : "음성 켜기"}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition ${
              awake
                ? "border-sky-400/60 bg-sky-500/20 text-sky-200"
                : "border-white/10 bg-white/[0.04] text-slate-400 hover:text-sky-200"
            }`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
            </svg>
          </button>

          <button
            type="submit"
            className="h-12 shrink-0 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 px-4 text-[13px] font-medium text-white transition hover:brightness-110 active:scale-95 sm:px-6 sm:text-[14px]"
          >
            SEND
          </button>
        </form>

        {messages.length > 0 && (
          <div className="mt-2 text-center">
            <button
              onClick={clearLog}
              className="text-[11px] tracking-widest text-slate-500 transition hover:text-sky-300"
            >
              CLEAR
            </button>
          </div>
        )}
      </section>
      </>
      )}
    </main>
  );
}
