"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useOmni } from "@/hooks/useOmni";
import { usePanels, DEMO_PANELS } from "@/hooks/usePanels";
import { OmniHUD } from "@/components/OmniHUD";
import { HudPanel } from "@/components/HudPanel";
import { ChatLog } from "@/components/ChatLog";

export default function Home() {
  const { panels, open, close, clear, hasPanels } = usePanels();
  const {
    status,
    awake,
    interim,
    supported,
    messages,
    toggleAwake,
    sendText,
    clearLog,
  } = useOmni({ onPanel: open }); // AI가 패널을 주면 껍데기가 출력
  const [draft, setDraft] = useState("");

  // 시계 패널이 떠 있으면 매초 LOCAL 시간 갱신.
  useEffect(() => {
    if (!panels.some((p) => p.id === "clock")) return;
    const id = setInterval(() => {
      open({
        ...DEMO_PANELS.find((p) => p.id === "clock")!,
        lines: [
          { label: "LOCAL", value: new Date().toLocaleTimeString("ko-KR") },
          { label: "ZONE", value: "KST +09:00" },
        ],
      });
    }, 1000);
    return () => clearInterval(id);
  }, [panels, open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendText(draft);
    setDraft("");
  };

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-8 px-4 py-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
      {/* Left: HUD core */}
      <section className="flex flex-col items-center justify-center gap-6">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-2xl font-bold tracking-[0.5em] text-glow"
        >
          O.M.N.I.
        </motion.h1>

        {/* HUD core + 우선순위 패널 레이어 */}
        <div className="relative flex w-full items-center justify-center">
          {/* 패널: priority 순으로 코어 좌우에 배치 */}
          <AnimatePresence>
            {hasPanels && (
              <motion.div
                key="panel-layer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-0 z-10 flex flex-wrap items-start justify-between gap-2"
              >
                {panels.map((p, i) => (
                  <div key={p.id} className="pointer-events-auto">
                    <HudPanel panel={p} index={i} onClose={close} />
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <OmniHUD
            status={status}
            awake={awake}
            onToggle={toggleAwake}
            compact={hasPanels}
          />
        </div>

        {/* 데모: 패널 띄우기/닫기 (실제 API 연동 전 자리표시자) */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {DEMO_PANELS.map((p) => (
            <button
              key={p.id}
              onClick={() => open(p)}
              className="rounded-full border border-omni-blue/30 bg-omni-blue/5 px-3 py-1 text-[10px] tracking-widest text-omni-blue/70 transition hover:bg-omni-cyan/10 hover:text-glow"
            >
              + {p.title}
            </button>
          ))}
          {hasPanels && (
            <button
              onClick={clear}
              className="rounded-full border border-amber-400/30 px-3 py-1 text-[10px] tracking-widest text-amber-400/70 transition hover:bg-amber-400/10"
            >
              CLOSE ALL
            </button>
          )}
        </div>

        {/* Voice = primary mode. Big call-to-action under the core. */}
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm tracking-[0.2em] text-omni-cyan text-glow">
            {awake ? "“옴니”라고 부르세요" : "코어를 눌러 음성 활성화"}
          </p>
          <p className="text-[11px] tracking-widest text-omni-blue/50">
            VOICE MODE · 메인 입력
          </p>
        </div>

        {/* Live transcript */}
        <div className="h-6 text-center text-sm text-omni-cyan/70">
          {interim && <span className="text-glow">“{interim}”</span>}
        </div>

        {!supported && (
          <p className="max-w-sm text-center text-xs text-amber-400/80">
            이 브라우저는 음성 인식을 지원하지 않습니다. Chrome을 사용하거나
            아래 보조 입력창으로 명령하세요.
          </p>
        )}
      </section>

      {/* Right: log + console input */}
      <section className="flex h-[60vh] flex-col gap-4 lg:h-[70vh]">
        <ChatLog messages={messages} onClear={clearLog} />

        {/* Text = secondary / fallback input. Visually de-emphasized. */}
        <div className="flex flex-col gap-1">
          <span className="pl-1 text-[10px] tracking-[0.25em] text-omni-blue/40">
            보조 입력 (TEXT FALLBACK)
          </span>
          <form onSubmit={submit} className="flex gap-2 opacity-80 focus-within:opacity-100">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="음성이 어려울 때 여기로 명령…"
              className="flex-1 rounded-lg border border-omni-blue/20 bg-omni-blue/5 px-4 py-2 text-sm text-omni-glow placeholder:text-omni-blue/30 outline-none focus:border-omni-cyan/50"
            />
            <button
              type="submit"
              className="rounded-lg border border-omni-blue/30 bg-omni-blue/5 px-4 py-2 text-xs tracking-widest text-omni-blue/70 transition hover:bg-omni-cyan/10 hover:text-glow"
            >
              SEND
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
