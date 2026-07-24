"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MLMap, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  omniMapStyle,
  poiKindKo,
  POI_CATEGORIES,
  POI_RANK_FILTER_DOT,
  POI_RANK_FILTER_LABEL,
  poiCategoryFilter,
} from "@/lib/mapStyle";
import { searchPlaces, zoomForKind, type GeoResult } from "@/lib/geocode";
import { parseMapCommand } from "@/lib/mapIntent";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import {
  fetchRoute,
  formatRoute,
  speakableSummary,
  type RouteMode,
  type RouteResult,
} from "@/lib/route";
import { speak, stopSpeaking } from "@/lib/speak";

/** 처음 보이는 지구본 시점 (한반도가 정면). */
const HOME = { center: [127.5, 36.5] as [number, number], zoom: 1.6, pitch: 0, bearing: 0 };
/** 3D 건물이 보이기 시작하는 줌 — 이 위로 올라가면 자동으로 기울인다. */
const BUILDING_ZOOM = 15;
const TILT = 60;

interface Pin extends GeoResult {}

/** 경로 표시 상태. */
interface RouteState {
  mode: RouteMode;
  label: string; // "11.5km · 14분"
  loading: boolean;
  error?: string;
  result?: RouteResult; // 도로·회전 상세 (정보 박스용)
  destName?: string;
}

/** 클릭한 POI 정보 카드. */
interface PoiCard {
  name: string;
  kind: string;
  lon: number;
  lat: number;
  /** 화면상 클릭 지점(px) — 카드를 그 근처에 띄운다. */
  x: number;
  y: number;
}

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
  const [card, setCard] = useState<PoiCard | null>(null);
  const [route, setRoute] = useState<RouteState | null>(null);
  const [category, setCategory] = useState<string | null>(null); // 활성 업종 필터
  const [micOn, setMicOn] = useState(false); // 음성 명령 수신
  const [voiceHint, setVoiceHint] = useState(""); // 최근 인식/처리 안내
  const [sound, setSound] = useState(false); // OMNI 음성 요약 on/off
  const soundRef = useRef(false);
  soundRef.current = sound;
  const routeAbort = useRef<AbortController | null>(null);
  const dashAnim = useRef<number | null>(null); // 흐르는 대시 애니메이션 프레임

  // 사운드 토글 복원/저장.
  useEffect(() => {
    setSound(localStorage.getItem("omni.map.sound") === "1");
  }, []);
  const toggleSound = () => {
    setSound((s) => {
      const next = !s;
      localStorage.setItem("omni.map.sound", next ? "1" : "0");
      if (!next) stopSpeaking();
      return next;
    });
  };

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

      // ── 경로 레이어 (건물 위 오버레이) — 팔란티어풍 네온 글로우 ──
      map.addSource("omni-route", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      // 1) 바깥 글로우 (굵고 흐릿)
      map.addLayer({
        id: "route-glow",
        type: "line",
        source: "omni-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#38bdf8",
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 6, 18, 22],
          "line-opacity": 0.25,
          "line-blur": 8,
        },
      });
      // 2) 코어 라인
      map.addLayer({
        id: "route-core",
        type: "line",
        source: "omni-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#bae6fd",
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 18, 5],
          "line-opacity": 0.9,
        },
      });
      // 3) 흐르는 대시 (방향성) — dasharray를 프레임마다 밀어 흐르게 한다
      map.addLayer({
        id: "route-flow",
        type: "line",
        source: "omni-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#e0f2fe",
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 18, 5],
          "line-opacity": 0.9,
          "line-dasharray": [0, 4, 3],
        },
      });
      // 출발/도착 끝점 — 별도 소스, circle로 펄스
      map.addSource("omni-route-ends", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "route-ends",
        type: "circle",
        source: "omni-route-ends",
        paint: {
          "circle-radius": 6,
          "circle-color": ["match", ["get", "role"], "from", "#34d399", "#f472b6"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#02040a",
          "circle-opacity": 0.95,
        },
      });

      // 대시 오프셋 애니메이션 (흐르는 느낌). 성능 부담 적은 단순 루프.
      const dashSeq = [
        [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1],
        [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5],
        [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
      ];
      let step = 0;
      let last = 0;
      const animate = (t: number) => {
        if (t - last > 55) {
          step = (step + 1) % dashSeq.length;
          if (map.getLayer("route-flow")) {
            map.setPaintProperty("route-flow", "line-dasharray", dashSeq[step]);
          }
          last = t;
        }
        dashAnim.current = requestAnimationFrame(animate);
      };
      dashAnim.current = requestAnimationFrame(animate);

      setReady(true);
    });

    map.on("move", () => {
      setZoom(map.getZoom());
      setPitch(map.getPitch());
      // 카드가 열려 있으면 POI 좌표를 다시 화면좌표로 투영해 붙어다니게 한다.
      setCard((c) => {
        if (!c) return c;
        const pt = map.project([c.lon, c.lat]);
        return { ...c, x: pt.x, y: pt.y };
      });
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

    // ── POI 상호작용: 점 위에서 커서 변경 + 클릭 시 정보카드 ──────
    const POI_LAYERS = ["poi-dot", "poi-label"];
    const onEnter = () => (map.getCanvas().style.cursor = "pointer");
    const onLeave = () => (map.getCanvas().style.cursor = "");
    const onPoiClick = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties || {};
      const name = (p["name:ko"] as string) || (p.name as string) || "이름 없음";
      // 점(Point)의 좌표를 카드 위치의 근거로 쓴다.
      const geo = f.geometry;
      const [lon, lat] =
        geo.type === "Point" ? (geo.coordinates as [number, number]) : [e.lngLat.lng, e.lngLat.lat];
      // 새 POI를 열면 이전 경로는 초기화 (혼동 방지).
      routeAbort.current?.abort();
      setRoute(null);
      const empty = { type: "FeatureCollection" as const, features: [] };
      (map.getSource("omni-route") as maplibregl.GeoJSONSource | undefined)?.setData(empty);
      (map.getSource("omni-route-ends") as maplibregl.GeoJSONSource | undefined)?.setData(empty);
      setCard({
        name,
        kind: poiKindKo(p.class as string, p.subclass as string),
        lon,
        lat,
        x: e.point.x,
        y: e.point.y,
      });
    };
    for (const id of POI_LAYERS) {
      map.on("mouseenter", id, onEnter);
      map.on("mouseleave", id, onLeave);
      map.on("click", id, onPoiClick);
    }
    // 빈 곳(POI 아님) 클릭 시 카드 닫기.
    map.on("click", (e) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: POI_LAYERS });
      if (!hits.length) setCard(null);
    });

    return () => {
      if (dashAnim.current) cancelAnimationFrame(dashAnim.current);
      routeAbort.current?.abort();
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

  // ── 경로: 소스에 그리고 카메라로 훑기 ────────────────────────
  const setRouteData = (coords: [number, number][], from: [number, number], to: [number, number]) => {
    const map = mapRef.current;
    if (!map) return;
    (map.getSource("omni-route") as maplibregl.GeoJSONSource | undefined)?.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: coords },
    });
    (map.getSource("omni-route-ends") as maplibregl.GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { role: "from" }, geometry: { type: "Point", coordinates: from } },
        { type: "Feature", properties: { role: "to" }, geometry: { type: "Point", coordinates: to } },
      ],
    });
  };

  const clearRoute = () => {
    const map = mapRef.current;
    routeAbort.current?.abort();
    setRoute(null);
    const empty = { type: "FeatureCollection" as const, features: [] };
    (map?.getSource("omni-route") as maplibregl.GeoJSONSource | undefined)?.setData(empty);
    (map?.getSource("omni-route-ends") as maplibregl.GeoJSONSource | undefined)?.setData(empty);
  };

  /** 현재 위치(GPS)를 구한다. 실패하면 null → 호출부에서 안내. */
  const getMyLocation = (): Promise<[number, number] | null> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });

  /** POI 카드의 목적지까지 경로를 그린다. 출발지=GPS(없으면 안내). */
  const drawRouteTo = async (to: [number, number], mode: RouteMode, destName?: string) => {
    const map = mapRef.current;
    if (!map) return;
    routeAbort.current?.abort();
    stopSpeaking();
    const ac = new AbortController();
    routeAbort.current = ac;
    setRoute({ mode, label: "", loading: true, destName });

    const from = await getMyLocation();
    if (ac.signal.aborted) return;
    if (!from) {
      setRoute({ mode, label: "", loading: false, error: "위치 권한이 필요합니다", destName });
      return;
    }
    const r = await fetchRoute(from, to, mode, ac.signal);
    if (ac.signal.aborted) return;
    if (!r) {
      setRoute({ mode, label: "", loading: false, error: "경로를 찾지 못했습니다", destName });
      return;
    }
    setRouteData(r.coordinates, from, to);
    setRoute({ mode, label: formatRoute(r), loading: false, result: r, destName });

    // 카메라로 경로 전체를 3D로 담아 보여준다.
    const b = new maplibregl.LngLatBounds(from, from);
    r.coordinates.forEach((c) => b.extend(c));
    autoTilted.current = true;
    map.fitBounds(b, { padding: 90, pitch: TILT, duration: 2400, maxZoom: 16 });

    // 사운드가 켜져 있으면 OMNI가 요약해서 읽어준다.
    if (soundRef.current) {
      speak(speakableSummary(r, mode, destName));
    }
  };

  // ── 업종 필터 ────────────────────────────────────────────────
  const applyCategory = useCallback((key: string | null) => {
    const map = mapRef.current;
    setCategory(key);
    if (!map || !map.getLayer("poi-dot")) return;
    if (!key) {
      map.setFilter("poi-dot", POI_RANK_FILTER_DOT);
      map.setFilter("poi-label", POI_RANK_FILTER_LABEL);
      return;
    }
    const cat = POI_CATEGORIES.find((c) => c.key === key);
    if (!cat) return;
    const f = poiCategoryFilter(cat.tokens);
    map.setFilter("poi-dot", f);
    map.setFilter("poi-label", f);
    // 필터를 걸면 POI가 보이도록 최소 줌 보장.
    if (map.getZoom() < 15) map.easeTo({ zoom: 15.5, duration: 800 });
  }, []);

  // ── 음성 명령: 검색어를 지오코딩해 검색/경로 실행 ────────────
  const voiceSearch = useCallback(
    async (q: string) => {
      const r = await searchPlaces(q);
      if (r[0]) {
        goTo(r[0]);
        setVoiceHint(`“${r[0].name}” 이동`);
      } else setVoiceHint(`“${q}” 검색 결과 없음`);
    },
    [goTo]
  );

  const voiceRoute = useCallback(
    async (q: string, mode: RouteMode) => {
      const r = await searchPlaces(q);
      if (!r[0]) return setVoiceHint(`“${q}” 검색 결과 없음`);
      setVoiceHint(`“${r[0].name}” ${mode === "walking" ? "도보" : "자동차"} 경로`);
      drawRouteTo([r[0].lon, r[0].lat], mode, r[0].name);
    },
    // drawRouteTo는 매 렌더 재생성되지만 최신 클로저를 쓰므로 의존성 불필요
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /** 음성 발화 → 의도 파싱 → 실행. */
  const handleVoice = useCallback(
    (text: string) => {
      const intent = parseMapCommand(text);
      switch (intent.type) {
        case "route":
          voiceRoute(intent.query, intent.mode);
          break;
        case "search":
          voiceSearch(intent.query);
          break;
        case "filter":
          applyCategory(intent.category);
          setVoiceHint(`${intent.category}만 표시`);
          break;
        case "clearRoute":
          clearRoute();
          setVoiceHint("경로 해제");
          break;
        case "clearFilter":
          applyCategory(null);
          setVoiceHint("필터 해제");
          break;
        case "home":
          goHome();
          setVoiceHint("지구본");
          break;
        case "tilt":
          toggleTilt();
          break;
        default:
          setVoiceHint(`“${text}” 이해 못 함`);
      }
    },
    // 핸들러들은 최신 클로저 사용
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [voiceRoute, voiceSearch, applyCategory]
  );

  const { supported: micSupported, interim: micInterim, start: micStart, stop: micStop } =
    useSpeechRecognition({ lang: "ko-KR", onFinal: handleVoice });

  // 마이크 토글에 따라 인식 시작/정지.
  useEffect(() => {
    if (micOn) micStart();
    else micStop();
  }, [micOn, micStart, micStop]);

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

      {/* POI 클릭 정보카드 — 홀로그램 글래스. 클릭 지점 위에 뜬다. */}
      {card && (
        <div
          className="glass pointer-events-auto absolute z-40 w-[200px] -translate-x-1/2 rounded-xl px-3.5 py-3"
          style={{
            left: Math.max(104, Math.min(card.x, (typeof window !== "undefined" ? window.innerWidth : 1280) - 104)),
            top: Math.max(12, card.y - 16),
            transform: "translate(-50%, -100%)",
          }}
        >
          <button
            onClick={() => setCard(null)}
            aria-label="닫기"
            className="absolute right-2 top-1.5 text-slate-400 transition hover:text-sky-300"
          >
            ✕
          </button>
          <div className="mb-1 text-[10px] tracking-wider text-sky-300/80">{card.kind}</div>
          <div className="mb-2 pr-4 text-[15px] font-medium leading-snug text-sky-50">
            {card.name}
          </div>
          <div className="font-mono text-[10px] text-slate-400">
            {card.lat.toFixed(5)}, {card.lon.toFixed(5)}
          </div>

          {/* 인앱 길찾기 — 자동차/도보 */}
          <div className="mt-2.5 flex items-center gap-1.5">
            <span className="text-[10px] tracking-wider text-slate-400">길찾기</span>
            <button
              onClick={() => drawRouteTo([card.lon, card.lat], "driving", card.name)}
              className={`rounded-md border px-2 py-1 text-[11px] transition ${
                route?.mode === "driving" && !route?.error
                  ? "border-sky-400/70 bg-sky-400/15 text-sky-100"
                  : "border-sky-400/30 text-sky-200 hover:border-sky-400/70 hover:bg-sky-400/10"
              }`}
            >
              🚗 자동차
            </button>
            <button
              onClick={() => drawRouteTo([card.lon, card.lat], "walking", card.name)}
              className={`rounded-md border px-2 py-1 text-[11px] transition ${
                route?.mode === "walking" && !route?.error
                  ? "border-sky-400/70 bg-sky-400/15 text-sky-100"
                  : "border-white/15 text-slate-300 hover:border-sky-400/50 hover:text-sky-100"
              }`}
            >
              🚶 도보
            </button>
          </div>

          {/* 경로 상태 */}
          {route && (
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
              {route.loading ? (
                <span className="text-sky-300/80">경로 탐색 중…</span>
              ) : route.error ? (
                <span className="text-rose-300/90">{route.error}</span>
              ) : (
                <span className="font-mono text-emerald-300">{route.label}</span>
              )}
              {!route.loading && (
                <button
                  onClick={clearRoute}
                  className="text-slate-400 transition hover:text-sky-300"
                >
                  경로 지우기
                </button>
              )}
            </div>
          )}

          {/* 외부 상세(리뷰 등)는 카카오맵으로 */}
          <a
            href={`https://map.kakao.com/link/map/${encodeURIComponent(card.name)},${card.lat},${card.lon}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-[10px] text-slate-500 underline-offset-2 transition hover:text-sky-300 hover:underline"
          >
            카카오맵에서 상세·리뷰 보기 ↗
          </a>
        </div>
      )}

      {/* 경로 정보 박스 — 도로·회전 상세 (팝업) */}
      {route?.result && !route.loading && !route.error && (
        <div className="glass absolute left-3 top-20 z-40 w-[min(86vw,300px)] rounded-2xl p-3.5">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <div className="text-[10px] tracking-wider text-sky-300/80">
                {route.mode === "walking" ? "🚶 도보 경로" : "🚗 자동차 경로"}
              </div>
              <div className="text-[14px] font-medium text-sky-50">
                {route.destName || "목적지"}까지
              </div>
            </div>
            <button
              onClick={clearRoute}
              aria-label="경로 닫기"
              className="text-slate-400 transition hover:text-sky-300"
            >
              ✕
            </button>
          </div>

          <div className="mb-2.5 flex items-center gap-2">
            <span className="font-mono text-[15px] text-emerald-300">{route.label}</span>
            <span className="text-[10px] text-slate-500">· {route.result.steps.length}개 구간</span>
          </div>

          {/* OMNI 음성 요약 */}
          <div className="mb-2.5 flex items-center gap-2">
            <button
              onClick={toggleSound}
              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition ${
                sound
                  ? "border-sky-400/70 bg-sky-400/15 text-sky-100"
                  : "border-white/15 text-slate-300 hover:border-sky-400/50"
              }`}
            >
              {sound ? "🔊" : "🔇"} 음성요약 {sound ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => route.result && speak(speakableSummary(route.result, route.mode, route.destName))}
              className="rounded-md border border-sky-400/30 px-2 py-1 text-[11px] text-sky-200 transition hover:border-sky-400/70 hover:bg-sky-400/10"
            >
              ▶ 다시 듣기
            </button>
          </div>

          {/* 주요 도로 */}
          {route.result.mainRoads.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {route.result.mainRoads.slice(0, 6).map((rd, i) => (
                <span
                  key={i}
                  className="rounded-full border border-sky-400/20 bg-sky-400/5 px-2 py-0.5 text-[10px] text-sky-200"
                >
                  {rd}
                </span>
              ))}
            </div>
          )}

          {/* 회전 안내 (스크롤) */}
          <div className="max-h-[28vh] space-y-1 overflow-y-auto pr-1">
            {route.result.steps
              .filter((s) => s.road || s.maneuver === "도착" || s.maneuver === "출발")
              .map((s, i) => (
                <div key={i} className="flex items-baseline gap-2 text-[11px]">
                  <span className="w-9 shrink-0 text-sky-300/70">{s.maneuver}</span>
                  <span className="flex-1 truncate text-slate-200">{s.road || "—"}</span>
                  {s.distance >= 1 && (
                    <span className="shrink-0 font-mono text-[10px] text-slate-500">
                      {s.distance >= 1000
                        ? `${(s.distance / 1000).toFixed(1)}km`
                        : `${Math.round(s.distance)}m`}
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

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

        {/* 업종 필터 칩 (가로 스크롤) */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {category && (
            <button
              onClick={() => applyCategory(null)}
              className="shrink-0 rounded-full border border-rose-400/40 bg-rose-400/10 px-2.5 py-1 text-[11px] text-rose-200 transition hover:bg-rose-400/20"
            >
              ✕ 전체
            </button>
          )}
          {POI_CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => applyCategory(category === c.key ? null : c.key)}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition ${
                category === c.key
                  ? "border-sky-400/70 bg-sky-400/20 text-sky-100"
                  : "border-white/12 bg-white/[0.04] text-slate-300 hover:border-sky-400/50 hover:text-sky-100"
              }`}
            >
              {c.emoji} {c.key}
            </button>
          ))}
        </div>
      </div>

      {/* 음성 명령 안내 자막 — 마이크 켜졌을 때 */}
      {micOn && (micInterim || voiceHint) && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-center text-[13px] backdrop-blur-sm">
          {micInterim ? (
            <span className="text-sky-200/90">“{micInterim}”</span>
          ) : (
            <span className="text-emerald-300/90">{voiceHint}</span>
          )}
        </div>
      )}

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

        <button
          onClick={toggleSound}
          title="경로를 OMNI 음성으로 요약"
          className={`rounded-lg px-2 py-1 tracking-wider transition ${
            sound ? "text-sky-300" : "text-slate-300 hover:text-sky-300"
          }`}
        >
          {sound ? "🔊 음성" : "🔇 음성"}
        </button>

        {micSupported && (
          <button
            onClick={() => setMicOn((v) => !v)}
            title='음성 명령: "옴니, 강남역 길찾기" / "근처 카페"'
            className={`rounded-lg px-2 py-1 tracking-wider transition ${
              micOn ? "text-emerald-300" : "text-slate-300 hover:text-sky-300"
            }`}
          >
            {micOn ? "🎙 듣는중" : "🎙 명령"}
          </button>
        )}

        <span className="h-7 w-px bg-white/10" />

        <a href="/" className="rounded-lg px-2 py-1 tracking-widest text-slate-300 transition hover:text-sky-300">
          OMNI
        </a>
      </div>
    </div>
  );
}
