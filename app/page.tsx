"use client";

import { useState } from "react";
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
  const [menu, setMenu] = useState(false); // 구체 호버/터치 시 액션 메뉴

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendText(draft);
    setDraft("");
  };

  const recent = messages.slice(-6);

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-between px-4 py-8 sm:px-5 sm:py-10">
      {/* 타이틀 — 좌상단 고정 */}
      <span className="absolute left-5 top-5 text-[13px] font-light tracking-[0.45em] text-sky-300/90">
        O M N I
      </span>

      {/* 중앙: 구체 (밑에 텍스트 없음) + 호버 시 VISION/CHAT 메뉴 */}
      <section className="flex flex-1 items-center justify-center">
        <div
          className="relative"
          onMouseEnter={() => setMenu(true)}
          onMouseLeave={() => setMenu(false)}
        >
          <OmniOrb status={status} level={level} onClick={() => setMenu((m) => !m)} />

          {/* 호버/터치 시 옆(데스크톱)·아래(모바일)에 뜨는 액션 버튼 */}
          <div
            className={`absolute z-20 flex gap-2 transition-all duration-300
              left-1/2 top-full mt-3 -translate-x-1/2 flex-row
              sm:left-full sm:top-1/2 sm:ml-4 sm:mt-0 sm:-translate-x-0 sm:-translate-y-1/2 sm:flex-col
              ${menu ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            <button
              onClick={toggleAwake}
              className={`rounded-xl border px-4 py-2 text-xs tracking-[0.2em] backdrop-blur transition ${
                awake
                  ? "border-sky-400/60 bg-sky-500/20 text-sky-100"
                  : "border-white/15 bg-white/[0.06] text-slate-200 hover:border-sky-400/50 hover:text-sky-100"
              }`}
            >
              {awake ? "● CHAT" : "CHAT"}
            </button>
            <a
              href="/vision"
              className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-xs tracking-[0.2em] text-slate-200 backdrop-blur transition hover:border-sky-400/50 hover:text-sky-100"
            >
              VISION
            </a>
          </div>
        </div>
      </section>

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
    </main>
  );
}
