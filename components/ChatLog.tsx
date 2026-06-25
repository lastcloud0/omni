"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";

interface Props {
  messages: ChatMessage[];
  onClear: () => void;
}

export function ChatLog({ messages, onClear }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-omni-blue/20 bg-omni-blue/5 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-omni-blue/20 px-4 py-2">
        <span className="text-xs tracking-[0.25em] text-glow">CONVERSATION LOG</span>
        <button
          onClick={onClear}
          className="text-[10px] tracking-widest text-omni-blue/60 transition hover:text-omni-cyan"
        >
          CLEAR
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-xs text-omni-blue/40">
            “옴니”라고 부른 뒤 명령을 말해보세요.
          </p>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, x: m.role === "user" ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg border px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "border-omni-cyan/30 bg-omni-cyan/10 text-omni-glow"
                    : "border-omni-blue/30 bg-omni-blue/10 text-sky-100"
                }`}
              >
                <div className="mb-0.5 text-[9px] tracking-widest opacity-50">
                  {m.role === "user" ? "YOU" : "O.M.N.I."}
                </div>
                {m.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={endRef} />
      </div>
    </div>
  );
}
