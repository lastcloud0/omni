"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HandTracker } from "@/components/HandTracker";
import { ParticleField } from "@/components/ParticleField";
import { GradientOrb } from "@/components/GradientOrb";
import type { HandFrame } from "@/hooks/useHandTracking";
import {
  type LinkNode,
  loadLinks,
  saveLinks,
  deriveLink,
} from "@/lib/linkNodes";
import { askAI } from "@/lib/aiClient";
// 제스처 판정은 MAP과 공용 모듈을 쓴다 (감도 단일 출처).
import { createGestureReader } from "@/lib/handGesture";

export default function VisionPage() {
  const [active, setActive] = useState(false);
  const [frame, setFrame] = useState<HandFrame | null>(null);

  // 사용자 편집 링크 (localStorage). 구체 노드가 이 목록을 따른다.
  const [links, setLinks] = useState<LinkNode[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [addErr, setAddErr] = useState("");

  useEffect(() => {
    setLinks(loadLinks());
  }, []);

  const persist = (next: LinkNode[]) => {
    setLinks(next);
    saveLinks(next);
  };
  const addLink = () => {
    const node = deriveLink(newUrl, newName);
    if (!node) {
      setAddErr("올바른 URL을 입력하세요");
      return;
    }
    if (links.some((l) => l.url === node.url)) {
      setAddErr("이미 추가된 링크입니다");
      return;
    }
    persist([...links, node]);
    setNewUrl("");
    setNewName("");
    setAddErr("");
  };
  const removeLink = (id: string) => persist(links.filter((l) => l.id !== id));

  // ── 대화 입력창 (텍스트 명령) ────────────────────────────────
  const router = useRouter();
  const [cmd, setCmd] = useState("");
  const [reply, setReply] = useState(""); // 처리 결과/AI 답변 자막
  const [busy, setBusy] = useState(false);

  const runVisionCommand = async (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    const flat = t.replace(/\s/g, "");
    // 모드 전환
    if (/(맵|지도)/.test(flat)) return router.push("/map");
    if (/(메인|홈|처음|나가)/.test(flat)) return router.push("/");
    // 링크 삭제: "○○ 빼/삭제/제거/지워"
    if (/(빼|삭제|제거|지워|없애)/.test(flat)) {
      const name = t.replace(/(빼줘|빼|삭제해|삭제|제거해|제거|지워줘|지워|없애줘|없애|링크)/g, "").trim();
      const hit = links.find(
        (l) => name && (l.label.toLowerCase().includes(name.toLowerCase()) || l.url.includes(name))
      );
      if (hit) {
        removeLink(hit.id);
        setReply(`${hit.label} 링크를 뺐습니다`);
      } else setReply(`"${name}" 링크를 찾지 못했습니다`);
      return;
    }
    // 링크 추가: URL스러운 토큰이 있거나 "추가/넣어/등록"
    const urlTok = t.match(/https?:\/\/\S+|[\w-]+\.[\w.]{2,}\S*/)?.[0];
    if (urlTok || /(추가|넣어|등록)/.test(flat)) {
      const node = deriveLink(urlTok || t.replace(/(추가해|추가|넣어줘|넣어|등록해|등록|링크)/g, "").trim());
      if (!node) return setReply("추가할 URL을 인식하지 못했습니다");
      if (links.some((l) => l.url === node.url)) return setReply("이미 추가된 링크입니다");
      persist([...links, node]);
      setReply(`${node.label} 링크를 추가했습니다`);
      return;
    }
    // 그 외 → AI에게 질문 (답변 자막)
    setBusy(true);
    setReply("…");
    try {
      const { reply: ans } = await askAI(t);
      setReply(ans);
    } catch {
      setReply("응답을 받지 못했습니다");
    } finally {
      setBusy(false);
    }
  };

  const submitCmd = (e: React.FormEvent) => {
    e.preventDefault();
    runVisionCommand(cmd);
    setCmd("");
  };

  // 자막 auto-clear
  useEffect(() => {
    if (!reply || reply === "…") return;
    const t = window.setTimeout(() => setReply(""), 7000);
    return () => window.clearTimeout(t);
  }, [reply]);

  // 드래그 앤 드롭 재정렬
  const dragId = useRef<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const onDragEnterRow = (targetId: string) => {
    const from = dragId.current;
    if (!from || from === targetId) return;
    setLinks((prev) => {
      const fi = prev.findIndex((l) => l.id === from);
      const ti = prev.findIndex((l) => l.id === targetId);
      if (fi < 0 || ti < 0) return prev;
      const next = [...prev];
      const [m] = next.splice(fi, 1);
      next.splice(ti, 0, m);
      return next; // 저장은 드롭 완료 시 한 번만
    });
  };
  const onDragEndRow = () => {
    dragId.current = null;
    setDragging(null);
    setLinks((prev) => {
      saveLinks(prev);
      return prev;
    });
  };

  // 카메라 거리(=줌). 작아질수록 줌인. ParticleField가 ref로 읽음.
  const camRef = useRef(3.0);
  const gesture = useRef(createGestureReader());
  // 손 비틀기 → yaw 회전 "속도". null이면 자동회전.
  const spinRef = useRef<number | null>(null);
  // 노드 상호작용용
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef(1);
  const hoverRef = useRef<LinkNode | null>(null);

  const openLink = (node: LinkNode) => {
    window.open(node.url, "_blank", "noopener,noreferrer");
  };

  const onFrame = (f: HandFrame) => {
    setFrame(f);
    // 노드 위에 손이 있으면 선택 우선 — 회전·줌 억제.
    const g = gesture.current.read(f, { suppress: hoverRef.current != null });

    pinchRef.current = g.pinch; // 노드 클릭(핀치) 판정용 원시값
    pointerRef.current = g.pointer;
    spinRef.current = g.spin; // 손 없으면 null → 자동회전

    // 절대 openness 줌 rate(-1..1)를 카메라 거리로 스케일. 음수=줌인.
    if (g.zoomRate !== 0) {
      camRef.current += g.zoomRate * 0.05;
      camRef.current = Math.max(0.5, Math.min(3.4, camRef.current));
    }
  };

  const pinching = frame ? frame.pinch < 0.06 : false;

  // 코어 아크(설정) / 채팅 입력 토글
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      {/* 전체 화면 파티클 (프레임 없음) */}
      <div className="absolute inset-0">
        <ParticleField
          camRef={camRef}
          spinRef={spinRef}
          pointerRef={pointerRef}
          pinchRef={pinchRef}
          hoverRef={hoverRef}
          onActivate={openLink}
          nodes={links}
          count={400}
        />
      </div>

      {/* 손 포인터 (전체 화면 기준) */}
      {frame?.detected && frame.pointer && (
        <div
          className="pointer-events-none absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors"
          style={{
            left: `${(1 - frame.pointer.x) * 100}%`,
            top: `${frame.pointer.y * 100}%`,
            borderColor: pinching ? "#34d399" : "rgba(56,189,248,0.7)",
            boxShadow: `0 0 24px ${pinching ? "#34d399" : "rgba(56,189,248,0.5)"}`,
          }}
        />
      )}

      {/* 상단 중앙: 로고 → 메인으로 */}
      <a
        href="/"
        aria-label="OMNI 메인"
        className="absolute left-1/2 top-6 z-40 -translate-x-1/2 opacity-90 transition hover:opacity-100"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="OMNI" className="h-5" draggable={false} />
      </a>

      {/* 하단 중앙: OMNI 코어 + 탭 시 반원 설정 아크 (맵과 동일 패턴) */}
      {(() => {
        const items = [
          {
            key: "chat", emoji: "💬", label: "입력", active: chatOpen,
            onClick: () => { setChatOpen((v) => !v); setMenuOpen(false); },
          },
          { key: "cam", emoji: "✋", label: active ? "카메라 ON" : "카메라", active, onClick: () => setActive((v) => !v) },
          {
            key: "link", emoji: "🔗", label: "링크", active: manageOpen,
            onClick: () => { setManageOpen((v) => !v); setMenuOpen(false); },
          },
          { key: "map", emoji: "🗺", label: "MAP", active: false, href: "/map" },
        ];
        const R = 122;
        const start = -158,
          end = -22;
        return (
          <div className="pointer-events-none absolute inset-x-0 bottom-16 z-40 flex justify-center">
            <div className="relative h-[76px] w-[76px]">
              {items.map((it, i) => {
                const deg = start + (i * (end - start)) / (items.length - 1);
                const dx = Math.round(R * Math.cos((deg * Math.PI) / 180));
                const dy = Math.round(R * Math.sin((deg * Math.PI) / 180));
                const common = {
                  title: it.label,
                  className: `absolute left-1/2 top-1/2 grid h-12 w-12 place-items-center rounded-full border text-[18px] transition-all duration-300 ${
                    it.active
                      ? "border-sky-400/70 bg-sky-400/25 text-sky-100"
                      : "border-white/15 bg-black/40 text-slate-200 hover:border-sky-400/50"
                  }`,
                  style: {
                    transform: menuOpen
                      ? `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`
                      : "translate(-50%, -50%) scale(0.3)",
                    opacity: menuOpen ? 1 : 0,
                    pointerEvents: (menuOpen ? "auto" : "none") as "auto" | "none",
                    transitionDelay: `${(menuOpen ? i : items.length - i) * 30}ms`,
                    backdropFilter: "blur(8px)",
                  } as React.CSSProperties,
                };
                return it.href ? (
                  <a key={it.key} href={it.href} {...common}>{it.emoji}</a>
                ) : (
                  <button key={it.key} onClick={it.onClick} {...common}>{it.emoji}</button>
                );
              })}

              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="OMNI 코어"
                className="pointer-events-auto relative h-[76px] w-[76px] rounded-full"
                style={{ filter: "drop-shadow(0 0 18px rgba(56,189,248,0.4))" }}
              >
                <GradientOrb className="pointer-events-none" config={{ hue: 0, rotationSpeed: 0.3 }} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* 링크 관리 패널 — 좌측 슬라이드인 */}
      <div
        className={`glass fixed left-0 top-0 z-50 flex h-full w-[min(88vw,320px)] flex-col rounded-r-2xl transition-transform duration-300 ${
          manageOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
          <div className="text-[15px] font-medium tracking-wide text-sky-50">Link</div>
          <button
            onClick={() => setManageOpen(false)}
            aria-label="닫기"
            className="text-slate-400 transition hover:text-sky-300"
          >
            ✕
          </button>
        </div>

        {/* 추가 폼 */}
        <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-3">
          {/* URL = 필수·주 입력 (강조) + 추가 버튼 */}
          <div className="flex gap-2">
            <input
              value={newUrl}
              onChange={(e) => {
                setNewUrl(e.target.value);
                setAddErr("");
              }}
              onKeyDown={(e) => e.key === "Enter" && addLink()}
              placeholder="URL 붙여넣기 — 예: github.com"
              autoFocus
              className="h-10 min-w-0 flex-1 rounded-lg border border-sky-400/50 bg-sky-400/[0.06] px-3 text-[14px] text-sky-50 placeholder:text-slate-400/70 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
            />
            <button
              onClick={addLink}
              className="glass-btn h-10 shrink-0 rounded-lg px-4 text-[13px] font-medium"
            >
              추가
            </button>
          </div>
          {/* 이름 = 선택·보조 (약하게) */}
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLink()}
            placeholder="이름 (선택 — 비우면 자동)"
            className="h-8 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[12px] text-slate-300 placeholder:text-slate-500/70 outline-none focus:border-sky-400/40"
          />
          {addErr && <div className="text-[11px] text-rose-300/90">{addErr}</div>}
        </div>

        {/* 링크 목록 */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {links.length === 0 && (
            <div className="px-3 py-6 text-center text-[12px] text-slate-500">
              링크가 없습니다. 위에서 추가하세요.
            </div>
          )}
          {links.map((l) => (
            <div
              key={l.id}
              draggable
              onDragStart={() => {
                dragId.current = l.id;
                setDragging(l.id);
              }}
              onDragEnter={() => onDragEnterRow(l.id)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={onDragEndRow}
              className={`group flex items-center gap-2 rounded-lg px-1.5 py-2 transition hover:bg-white/[0.04] ${
                dragging === l.id ? "opacity-40" : ""
              }`}
            >
              {/* 드래그 핸들 (잡고 끌기) */}
              <span
                className="shrink-0 cursor-grab px-0.5 text-slate-500 transition hover:text-sky-300 active:cursor-grabbing"
                aria-label="드래그로 순서 변경"
              >
                <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                  <circle cx="2.5" cy="3" r="1.2" /><circle cx="7.5" cy="3" r="1.2" />
                  <circle cx="2.5" cy="8" r="1.2" /><circle cx="7.5" cy="8" r="1.2" />
                  <circle cx="2.5" cy="13" r="1.2" /><circle cx="7.5" cy="13" r="1.2" />
                </svg>
              </span>
              {/* 파비콘 미리보기 */}
              <img
                src={l.favicon}
                alt=""
                width={18}
                height={18}
                className="pointer-events-none shrink-0 rounded"
                style={{ boxShadow: `0 0 8px ${l.color}66` }}
              />
              <div className="pointer-events-none min-w-0 flex-1">
                <div className="truncate text-[13px] text-sky-50">{l.label}</div>
                <div className="truncate text-[10px] text-slate-500">{l.url}</div>
              </div>
              <button
                onClick={() => removeLink(l.id)}
                aria-label="삭제"
                className="shrink-0 px-1 text-slate-400 opacity-60 transition hover:text-rose-300 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 px-4 py-2.5 text-[10px] text-slate-500">
          이 브라우저에 저장됩니다 · {links.length}개
        </div>
      </div>

      {/* 처리 결과 / AI 답변 자막 */}
      {reply && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-40 max-w-[86vw] -translate-x-1/2 rounded-2xl bg-black/60 px-4 py-2 text-center text-[14px] text-sky-100 backdrop-blur-sm">
          {reply === "…" ? <span className="text-sky-300/80">생각 중…</span> : reply}
        </div>
      )}

      {/* 대화 입력창 — 코어의 채팅 아이콘으로 토글. 로고 아래(top-16). */}
      {chatOpen && (
        <form
          onSubmit={submitCmd}
          className="glass absolute left-1/2 top-16 z-40 flex w-[min(92vw,440px)] -translate-x-1/2 items-center gap-2 rounded-2xl px-3 py-2"
        >
          <input
            autoFocus
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            placeholder="말하듯 입력 — 예: 유튜브 추가, 노션 빼줘, 맵 열어"
            className="h-9 min-w-0 flex-1 bg-transparent text-[14px] text-sky-50 placeholder:text-slate-400/70 outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="glass-btn h-9 shrink-0 rounded-xl px-4 text-[13px] font-medium disabled:opacity-50"
          >
            전송
          </button>
          <button
            type="button"
            onClick={() => setChatOpen(false)}
            aria-label="닫기"
            className="shrink-0 px-1 text-slate-400 transition hover:text-sky-300"
          >
            ✕
          </button>
        </form>
      )}

      <HandTracker active={active} onFrame={onFrame} showPreview={active} />
    </main>
  );
}
