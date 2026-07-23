"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MLMap, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { omniMapStyle } from "@/lib/mapStyle";
import { searchPlaces, zoomForKind, type GeoResult } from "@/lib/geocode";

/** 처음 보이는 지구본 시점 (한반도가 정면). */
const HOME = { center: [127.5, 36.5] as [number, number], zoom: 1.6, pitch: 0, bearing: 0 };
/** 3D 건물이 보이기 시작하는 줌 — 이 위로 올라가면 자동으로 기울인다. */
const BUILDING_ZOOM = 15;
const TILT = 60;

interface Pin extends GeoResult {}

export function OmniMap() {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const autoTilted = useRef(false); // 자동 기울임을 한 번만 하기 위한 플래그

  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(HOME.zoom);
  const [pitch, setPitch] = useState(0);
  const [pins, setPins] = useState<Pin[]>([]);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [openList, setOpenList] = useState(false);

  // ── 지도 생성 ────────────────────────────────────────────────
  useEffect(() => {
    if (!holder.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: holder.current,
      style: omniMapStyle(),
      ...HOME,
      maxPitch: 75,
      attributionControl: { compact: true },
      // 한글 라벨은 서버 글리프 대신 로컬 폰트로 그린다 (Pretendard).
      localIdeographFontFamily: "'Pretendard Variable', Pretendard, sans-serif",
    });
    mapRef.current = map;
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __omniMap?: MLMap }).__omniMap = map;
    }

    // 스타일/타일 오류는 조용히 삼키지 말고 콘솔에 남긴다.
    map.on("error", (e) => console.error("[OmniMap]", e?.error?.message || e));

    map.on("style.load", () => {
      // 지구본 투영은 스타일 로드 뒤에 켜야 한다 (먼저 부르면 에러).
      map.setProjection({ type: "globe" });
      setReady(true);
    });

    map.on("move", () => {
      setZoom(map.getZoom());
      setPitch(map.getPitch());
    });

    // 건물 레벨까지 줌인하면 한 번만 자동으로 기울여 3D를 보여준다.
    map.on("zoomend", () => {
      if (autoTilted.current) return;
      if (map.getZoom() >= BUILDING_ZOOM && map.getPitch() < 10) {
        autoTilted.current = true;
        map.easeTo({ pitch: TILT, duration: 900 });
      }
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── 검색 (디바운스 + 이전 요청 취소) ─────────────────────────
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const ac = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await searchPlaces(q, ac.signal);
      if (ac.signal.aborted) return;
      setResults(r);
      setOpenList(true);
      setSearching(false);
    }, 280);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [query]);

  /** 네온 핀 DOM — 마커 본체. */
  const makePinEl = (label: string) => {
    const el = document.createElement("div");
    el.className = "omni-pin";
    el.innerHTML =
      `<span class="omni-pin-dot"></span><span class="omni-pin-stem"></span>` +
      `<span class="omni-pin-label"></span>`;
    // 라벨은 textContent로 넣어 사용자 입력이 HTML로 해석되지 않게 한다.
    const labelEl = el.querySelector(".omni-pin-label");
    if (labelEl) labelEl.textContent = label;
    return el;
  };

  const addPin = useCallback((r: GeoResult) => {
    const map = mapRef.current;
    if (!map) return;
    const marker = new maplibregl.Marker({ element: makePinEl(r.name), anchor: "bottom" })
      .setLngLat([r.lon, r.lat])
      .addTo(map);
    markersRef.current.push(marker);
    setPins((p) => [...p, r]);
  }, []);

  const goTo = useCallback(
    (r: GeoResult) => {
      const map = mapRef.current;
      if (!map) return;
      const z = zoomForKind(r.kind);
      // 건물 레벨로 가는 경우엔 기울여서 3D가 보이게 착지한다.
      const targetPitch = z >= BUILDING_ZOOM ? TILT : 0;
      if (targetPitch > 0) autoTilted.current = true;
      map.flyTo({ center: [r.lon, r.lat], zoom: z, pitch: targetPitch, duration: 2600, essential: true });
      addPin(r);
      setOpenList(false);
      setResults([]);
      setQuery(r.name);
    },
    [addPin]
  );

  const clearPins = () => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    setPins([]);
  };

  const goHome = () => {
    autoTilted.current = false;
    mapRef.current?.flyTo({ ...HOME, duration: 2600, essential: true });
  };

  const toggleTilt = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = map.getPitch() > 10 ? 0 : TILT;
    autoTilted.current = next > 0;
    map.easeTo({ pitch: next, duration: 700 });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results[0]) goTo(results[0]);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#02040a]">
      {/* 인라인 스타일 필수: maplibre-gl.css의 .maplibregl-map{position:relative}가
          Tailwind .absolute를 덮어써서(같은 특이도, 나중 로드) 높이가 0이 된다. */}
      <div ref={holder} style={{ position: "absolute", inset: 0 }} />

      {/* 로딩 중 오버레이 — 타일 받아오는 사이 검은 화면만 보이지 않게 */}
      {!ready && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <span className="text-[11px] tracking-[0.4em] text-sky-300/70">
            LOADING MAP…
          </span>
        </div>
      )}

      {/* 상단: 검색 */}
      <div className="absolute left-1/2 top-5 z-40 w-[min(92vw,520px)] -translate-x-1/2">
        <form onSubmit={onSubmit} className="glass flex items-center gap-2 rounded-2xl px-3 py-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-sky-300/80">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length && setOpenList(true)}
            placeholder="장소 검색 — 예: 경복궁, 부산역, Eiffel Tower"
            className="h-8 min-w-0 flex-1 bg-transparent text-[14px] text-sky-50 placeholder:text-slate-400/70 outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                setOpenList(false);
              }}
              aria-label="검색어 지우기"
              className="shrink-0 text-slate-400 transition hover:text-sky-300"
            >
              ✕
            </button>
          )}
        </form>

        {/* 검색 결과 */}
        {openList && (searching || results.length > 0) && (
          <ul className="glass mt-2 max-h-[46vh] overflow-y-auto rounded-2xl py-1">
            {searching && results.length === 0 && (
              <li className="px-4 py-3 text-[13px] text-slate-400">검색 중…</li>
            )}
            {results.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => goTo(r)}
                  className="flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left transition hover:bg-sky-400/10"
                >
                  <span className="text-[14px] text-sky-50">{r.name}</span>
                  {r.detail && (
                    <span className="text-[11px] text-slate-400">{r.detail}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {openList && !searching && query.trim().length >= 2 && results.length === 0 && (
          <div className="glass mt-2 rounded-2xl px-4 py-3 text-[13px] text-slate-400">
            결과가 없습니다.
          </div>
        )}
      </div>

      {/* 하단 중앙: 글래스 컨트롤 박스 (VISION과 동일 톤) */}
      <div className="glass absolute bottom-7 left-1/2 z-40 flex -translate-x-1/2 select-none items-center gap-4 rounded-2xl px-4 py-3 text-xs">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] tracking-wider text-slate-400">줌</span>
          <span className="font-mono text-sky-200">{zoom.toFixed(1)}</span>
        </div>

        <span className="h-7 w-px bg-white/10" />

        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] tracking-wider text-slate-400">건물</span>
          <span className={zoom >= BUILDING_ZOOM ? "text-emerald-300" : "text-slate-500"}>
            {zoom >= BUILDING_ZOOM ? "3D" : "—"}
          </span>
        </div>

        <span className="h-7 w-px bg-white/10" />

        <button
          onClick={toggleTilt}
          className={`rounded-lg px-2 py-1 tracking-wider transition ${
            pitch > 10 ? "text-sky-300" : "text-slate-300 hover:text-sky-300"
          }`}
        >
          기울이기
        </button>

        <button onClick={goHome} className="rounded-lg px-2 py-1 tracking-wider text-slate-300 transition hover:text-sky-300">
          지구본
        </button>

        <button
          onClick={clearPins}
          disabled={pins.length === 0}
          className="rounded-lg px-2 py-1 tracking-wider text-slate-300 transition hover:text-sky-300 disabled:text-slate-600 disabled:hover:text-slate-600"
        >
          핀 지우기{pins.length ? ` (${pins.length})` : ""}
        </button>

        <span className="h-7 w-px bg-white/10" />

        <a href="/" className="rounded-lg px-2 py-1 tracking-widest text-slate-300 transition hover:text-sky-300">
          OMNI
        </a>
      </div>
    </div>
  );
}
