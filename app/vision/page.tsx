"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HandTracker } from "@/components/HandTracker";
import { ParticleField } from "@/components/ParticleField";
import { useDraggable } from "@/hooks/useDraggable";
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

  // 드래그 가능한 컨트롤 박스. 실제 크기 측정해 중앙 하단 정렬.
  const ctrlBoxRef = useRef<HTMLDivElement>(null);
  const { box: ctrl, setBox: setCtrl, dragProps: ctrlDrag } = useDraggable({
    initial: { x: -9999, y: -9999, w: 430, h: 56 }, // 측정 전 화면 밖에 숨김
  });
  useEffect(() => {
    const place = () => {
      const el = ctrlBoxRef.current;
      if (!el) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setCtrl((b) => ({
        ...b,
        w,
        h,
        x: Math.max(8, Math.round(window.innerWidth / 2 - w / 2)),
        y: window.innerHeight - h - 28,
      }));
    };
    place();
    // 폰트 로딩 완료 후 폭이 바뀔 수 있어 한 번 더 정렬
    if (document.fonts?.ready) document.fonts.ready.then(place);
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      {/* 드래그 가능한 글래스 컨트롤 박스 */}
      <div
        ref={ctrlBoxRef}
        className="glass fixed z-40 flex select-none items-center gap-3 rounded-2xl py-3 pl-2 pr-4 text-xs"
        style={{ left: ctrl.x, top: ctrl.y, touchAction: "none" }}
      >
        {/* 그립 핸들 (이걸 잡고 이동) */}
        <div
          {...ctrlDrag}
          className="flex h-7 w-5 items-center justify-center text-slate-500 hover:text-sky-300"
          aria-label="이동"
        >
          <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
            <circle cx="2.5" cy="3" r="1.2" /><circle cx="7.5" cy="3" r="1.2" />
            <circle cx="2.5" cy="8" r="1.2" /><circle cx="7.5" cy="8" r="1.2" />
            <circle cx="2.5" cy="13" r="1.2" /><circle cx="7.5" cy="13" r="1.2" />
          </svg>
        </div>
        <div className="flex items-center gap-4">
          {/* 감지 */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] tracking-wider text-slate-400">감지</span>
            <span
              className={`flex items-center gap-1 ${
                frame?.detected ? "text-emerald-300" : "text-slate-500"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  frame?.detected ? "bg-emerald-400" : "bg-slate-600"
                }`}
              />
              {frame?.detected ? "YES" : "NO"}
            </span>
          </div>

          <span className="h-7 w-px bg-white/10" />

          {/* 핀치값 */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] tracking-wider text-slate-400">핀치</span>
            <span className="font-mono text-sky-200">
              {frame ? frame.pinch.toFixed(3) : "—"}
            </span>
          </div>

          <span className="h-7 w-px bg-white/10" />

          {/* 상태 */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] tracking-wider text-slate-400">상태</span>
            <span className={pinching ? "text-emerald-300" : "text-sky-200"}>
              {pinching ? "PINCH" : frame?.detected ? "OPEN" : "—"}
            </span>
          </div>

          <span className="h-7 w-px bg-white/10" />

          {/* 카메라 토글 */}
          <button
            onClick={() => setActive((v) => !v)}
            className="flex items-center gap-2"
            aria-label="카메라 토글"
          >
            <span className="text-[10px] tracking-wider text-slate-400">CAM</span>
            <span
              className={`relative h-5 w-9 rounded-full transition-colors ${
                active ? "bg-sky-500/70" : "bg-slate-600/60"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                  active ? "left-[18px]" : "left-0.5"
                }`}
              />
            </span>
          </button>

          <span className="h-7 w-px bg-white/10" />

          {/* 링크 관리 */}
          <button
            onClick={() => setManageOpen((v) => !v)}
            className={`rounded-lg px-2 py-1 tracking-wider transition ${
              manageOpen ? "text-sky-300" : "text-slate-300 hover:text-sky-300"
            }`}
          >
            링크
          </button>

          <span className="h-7 w-px bg-white/10" />

          {/* MAP 모드 */}
          <a
            href="/map"
            className="rounded-lg px-2 py-1 tracking-widest text-slate-300 transition hover:text-sky-300"
          >
            MAP
          </a>

          {/* OMNI 메인 */}
          <a
            href="/"
            className="rounded-lg px-2 py-1 tracking-widest text-slate-300 transition hover:text-sky-300"
          >
            OMNI
          </a>
        </div>
      </div>

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

      {/* 대화 입력창 — 상단 중앙(지도와 동일 위치). 링크 추가/삭제·모드전환·질문. */}
      <form
        onSubmit={submitCmd}
        className="glass absolute left-1/2 top-5 z-40 flex w-[min(92vw,440px)] -translate-x-1/2 items-center gap-2 rounded-2xl px-3 py-2"
      >
        <input
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
      </form>

      <HandTracker active={active} onFrame={onFrame} showPreview={active} />
    </main>
  );
}
