/**
 * 위치 검색 (지오코딩) — Photon(Komoot) 공개 API.
 *   무API키 · 무가입 · OSM 데이터 기반 · GeoJSON 응답.
 *   과도한 호출은 스로틀될 수 있어 호출부에서 디바운스한다.
 */

export interface GeoResult {
  id: string;
  /** 표시용 이름 (예: "경복궁") */
  name: string;
  /** 보조 설명 (예: "서울특별시, 대한민국") */
  detail: string;
  lon: number;
  lat: number;
  /** OSM 타입 힌트 — 도시/국가면 덜 줌인한다. */
  kind?: string;
}

interface PhotonFeature {
  properties: {
    osm_id?: number;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
    type?: string;
  };
  geometry: { coordinates: [number, number] };
}

/** 결과 한 줄의 보조 설명을 조립한다 (빈 값은 자동 제외). */
function buildDetail(p: PhotonFeature["properties"]): string {
  const parts = [
    [p.street, p.housenumber].filter(Boolean).join(" "),
    p.district,
    p.city,
    p.state,
    p.country,
  ].filter((v): v is string => Boolean(v));
  // 중복 제거 (예: city와 state가 같은 광역시)
  return Array.from(new Set(parts)).join(", ");
}

/**
 * 장소를 검색한다. 실패하면 빈 배열 — 화면은 "결과 없음"만 보여주면 된다.
 * @param signal 이전 입력의 요청을 취소하기 위한 AbortSignal
 */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal
): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  // lang은 붙이지 않는다. Photon은 ko를 지원하지 않아 400이 나고(지원: en/de/fr/it),
  // 생략하면 오히려 현지 표기(=한국은 한글)로 돌려준다.
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const feats: PhotonFeature[] = Array.isArray(data.features) ? data.features : [];
    return feats
      .filter((f) => f.geometry?.coordinates?.length === 2)
      .map((f, i) => {
        const p = f.properties || {};
        return {
          id: `${p.osm_id ?? i}-${i}`,
          name: p.name || p.street || p.city || q,
          detail: buildDetail(p),
          lon: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
          kind: p.type || p.osm_value,
        };
      });
  } catch {
    return []; // Abort / 네트워크 오류 모두 조용히 무시
  }
}

/** 검색 결과 종류에 따라 적당한 줌 레벨을 고른다. */
export function zoomForKind(kind?: string): number {
  switch (kind) {
    case "country":
      return 4.5;
    case "state":
      return 7;
    case "county":
      return 9;
    case "city":
      return 11;
    case "district":
      return 13;
    default:
      return 16.5; // 건물/주소 → 3D 건물이 보이는 레벨
  }
}
