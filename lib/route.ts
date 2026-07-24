/**
 * 경로 탐색 — OSRM 공개 데모 서버 (무API키·무가입).
 *   주의: "데모용"이라 트래픽 몰리면 불안정. 커지면 자체 호스팅 또는
 *   OpenRouteService(무료 키, 2000건/일)로 교체. 그 경우 이 파일만 바꾸면 됨.
 */

export type RouteMode = "driving" | "walking";

/** 경로 한 구간(회전 단위). */
export interface RouteStep {
  road: string; // 도로명 (없으면 "")
  distance: number; // m
  /** 회전 지시 한국어 (예: "우회전", "좌회전", "직진") */
  maneuver: string;
}

export interface RouteResult {
  /** [lng, lat] 좌표열 — MapLibre LineString에 그대로 넣는다. */
  coordinates: [number, number][];
  distance: number; // m
  duration: number; // s
  steps: RouteStep[];
  /** 경유하는 주요 도로명 (중복 제거, 등장 순). */
  mainRoads: string[];
}

const OSRM = "https://router.project-osrm.org/route/v1";

/** OSRM maneuver → 한국어 지시. */
function maneuverKo(type?: string, modifier?: string): string {
  const mod: Record<string, string> = {
    left: "좌회전", right: "우회전", "slight left": "왼쪽", "slight right": "오른쪽",
    "sharp left": "급좌회전", "sharp right": "급우회전", straight: "직진",
    uturn: "유턴",
  };
  switch (type) {
    case "depart": return "출발";
    case "arrive": return "도착";
    case "turn": return mod[modifier || ""] || "회전";
    case "roundabout": case "rotary": return "로터리";
    case "merge": return "합류";
    case "fork": return mod[modifier || ""] || "분기";
    case "on ramp": return "진입";
    case "off ramp": return "진출";
    case "continue": return "직진";
    default: return mod[modifier || ""] || "직진";
  }
}

/**
 * from → to 경로를 구한다. 실패하면 null (호출부에서 "경로 없음" 처리).
 * @param signal 이전 요청 취소용
 */
export async function fetchRoute(
  from: [number, number],
  to: [number, number],
  mode: RouteMode = "driving",
  signal?: AbortSignal
): Promise<RouteResult | null> {
  const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`;
  const url = `${OSRM}/${mode}/${coords}?overview=full&geometries=geojson&steps=true`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route || data.code !== "Ok") return null;

    // 회전 단위 step 추출 (모든 leg 합침).
    const steps: RouteStep[] = [];
    for (const leg of route.legs ?? []) {
      for (const s of leg.steps ?? []) {
        steps.push({
          road: s.name || "",
          distance: s.distance || 0,
          maneuver: maneuverKo(s.maneuver?.type, s.maneuver?.modifier),
        });
      }
    }
    // 주요 도로 = 이름 있는 도로를 등장 순으로 중복 제거.
    const mainRoads: string[] = [];
    for (const s of steps) {
      if (s.road && !mainRoads.includes(s.road)) mainRoads.push(s.road);
    }

    return {
      coordinates: route.geometry.coordinates as [number, number][],
      distance: route.distance,
      duration: route.duration,
      steps,
      mainRoads,
    };
  } catch {
    return null; // abort/네트워크 오류
  }
}

/**
 * OMNI가 음성으로 읽어줄 경로 요약문을 만든다. (로컬 생성 — 무비용·즉시)
 * 예: "목적지까지 자동차로 11.5km, 약 14분 걸립니다.
 *      테헤란로, 강남대로를 거쳐 이동합니다."
 */
export function speakableSummary(r: RouteResult, mode: RouteMode, destName?: string): string {
  const km = r.distance / 1000;
  const dist = km >= 1 ? `${km.toFixed(1)}킬로미터` : `${Math.round(r.distance)}미터`;
  const min = Math.round(r.duration / 60);
  const time = min >= 60 ? `${Math.floor(min / 60)}시간 ${min % 60}분` : `${min}분`;
  const how = mode === "walking" ? "도보로" : "자동차로";
  const dest = destName ? `${destName}까지` : "목적지까지";

  let out = `${dest} ${how} ${dist}, 약 ${time} 걸립니다.`;
  const roads = r.mainRoads.slice(0, 3);
  if (roads.length) out += ` ${roads.join(", ")}을 거쳐 이동합니다.`;
  return out;
}

/** 거리·시간을 한국어 라벨로. (예: "11.5km · 14분") */
export function formatRoute(r: RouteResult): string {
  const km = r.distance / 1000;
  const dist = km >= 1 ? `${km.toFixed(1)}km` : `${Math.round(r.distance)}m`;
  const min = Math.round(r.duration / 60);
  const time = min >= 60 ? `${Math.floor(min / 60)}시간 ${min % 60}분` : `${min}분`;
  return `${dist} · ${time}`;
}
