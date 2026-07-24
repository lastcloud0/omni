/**
 * OMNI 홀로그램 맵 스타일 — MapLibre StyleSpecification.
 *
 * 타일 출처: OpenFreeMap (https://openfreemap.org)
 *   - 무가입 · 무API키 · 무제한 · OpenMapTiles 스키마 · OSM 데이터
 *   - 건물 높이는 building 소스레이어의 render_height / render_min_height
 *
 * ★ 나중에 "실사 3D 건물"로 갈아탈 경우: 이 파일만 교체하면 된다.
 *   (Cesium + Google Photorealistic 3D Tiles = 실사이지만 카드등록 필요)
 */
import type {
  StyleSpecification,
  FilterSpecification,
  ExpressionSpecification,
} from "maplibre-gl";

// ── POI 표시 필터 (rank 기반 밀도 조절) ─────────────────────────
// 상수로 빼둔다: 카테고리 필터를 켰다 껐다 할 때 이 기본값으로 되돌린다.
export const POI_RANK_FILTER_DOT: FilterSpecification = [
  "<=",
  ["coalesce", ["get", "rank"], 99],
  ["interpolate", ["linear"], ["zoom"], 15, 5, 17, 30, 19, 999],
];
export const POI_RANK_FILTER_LABEL: FilterSpecification = [
  "<=",
  ["coalesce", ["get", "rank"], 99],
  ["interpolate", ["linear"], ["zoom"], 16, 6, 18, 30, 19, 999],
];

/** 업종 토큰(class 또는 subclass) 목록에 해당하는 POI만 통과시키는 필터. */
export function poiCategoryFilter(tokens: string[]): FilterSpecification {
  return [
    "any",
    ["in", ["get", "class"], ["literal", tokens]],
    ["in", ["get", "subclass"], ["literal", tokens]],
  ] as unknown as FilterSpecification;
}

/** 화면/음성에서 쓰는 업종 카테고리. tokens = class 또는 subclass 매칭값. */
export interface PoiCategory {
  key: string; // 한글 표시
  emoji: string;
  tokens: string[];
}
export const POI_CATEGORIES: PoiCategory[] = [
  { key: "카페", emoji: "☕", tokens: ["cafe"] },
  { key: "음식점", emoji: "🍽", tokens: ["restaurant", "fast_food", "bakery"] },
  { key: "편의점", emoji: "🏪", tokens: ["convenience"] },
  { key: "병원", emoji: "🏥", tokens: ["hospital", "clinic", "dentist", "doctors"] },
  { key: "약국", emoji: "💊", tokens: ["pharmacy"] },
  { key: "은행", emoji: "🏦", tokens: ["bank", "atm"] },
  { key: "주유소", emoji: "⛽", tokens: ["fuel", "charging_station"] },
  { key: "주차장", emoji: "🅿️", tokens: ["parking"] },
  { key: "지하철", emoji: "🚇", tokens: ["railway", "subway", "subway_entrance"] },
  { key: "숙박", emoji: "🏨", tokens: ["lodging", "hotel", "motel", "hostel"] },
];

const OFM = "https://tiles.openfreemap.org";

/** 네온 팔레트 — OMNI 코어(sky-400 계열)와 톤을 맞춘다. */
export const MAP_COLORS = {
  void: "#02040a", // 우주/배경
  water: "#04101d",
  land: "#070b14",
  park: "#08160f",
  road: "#1d3a52",
  roadMajor: "#2b6f96",
  buildingLow: "#0d3550", // 낮은 건물
  buildingHigh: "#5cc8ff", // 높은 건물 (네온)
  label: "#a5cfe3",
  labelHalo: "#01050c",
};

/** POI class/subclass → 한글 분류명. 클릭 카드에 표시. 없으면 원문 노출. */
export const POI_KIND_KO: Record<string, string> = {
  restaurant: "음식점", cafe: "카페", fast_food: "패스트푸드", bakery: "베이커리",
  bar: "바", beer: "펍", pub: "펍",
  shop: "상점", grocery: "마트", supermarket: "마트", convenience: "편의점",
  clothing_store: "의류", clothes: "의류", cosmetics: "화장품", butcher: "정육점",
  alcohol_shop: "주류", electronics: "전자제품", toys: "완구", gift: "선물",
  hospital: "병원", clinic: "의원", dentist: "치과", pharmacy: "약국", doctors: "의원",
  bank: "은행", atm: "ATM",
  bus: "버스정류장", bus_stop: "버스정류장", railway: "지하철", subway: "지하철",
  station: "역", entrance: "출입구", subway_entrance: "지하철 출구", parking: "주차장",
  lodging: "숙박", hotel: "호텔", motel: "모텔", hostel: "게스트하우스",
  office: "사무실", lawyer: "법률", estate_agent: "부동산", government: "관공서",
  school: "학교", kindergarten: "유치원", college: "대학", library: "도서관",
  park: "공원", garden: "정원", pitch: "운동장", playground: "놀이터",
  fuel: "주유소", charging_station: "충전소", police: "경찰서", fire_station: "소방서",
  post: "우체국", post_office: "우체국", cinema: "영화관", theatre: "극장",
  museum: "박물관", art_gallery: "미술관", gallery: "미술관", hairdresser: "미용실",
  place_of_worship: "종교시설", pharmacy_shop: "약국", toilets: "화장실", atm_shop: "ATM",
};

/** class 또는 subclass로 한글 분류를 찾는다. */
export function poiKindKo(cls?: string, subclass?: string): string {
  return (
    (cls && POI_KIND_KO[cls]) ||
    (subclass && POI_KIND_KO[subclass]) ||
    subclass ||
    cls ||
    "장소"
  );
}

/**
 * POI 업종(class) → 색 계열. 지도 위 점/라벨 색으로 쓴다.
 * 클릭 카드의 한글 분류와 짝을 맞춰 둔다(POI_KIND_KO 참고).
 */
export const POI_COLOR: import("maplibre-gl").ExpressionSpecification = [
  "match",
  ["get", "class"],
  ["restaurant", "cafe", "fast_food", "bakery", "bar", "beer"], "#ffb454", // 음식·카페 — 앰버
  ["shop", "grocery", "clothing_store", "alcohol_shop", "butcher"], "#ff77c8", // 상점 — 핑크
  ["hospital", "dentist", "pharmacy", "doctors"], "#4ade80", // 의료 — 그린
  ["bank", "atm"], "#facc15", // 금융 — 옐로
  ["bus", "railway", "entrance", "parking"], "#7dd3fc", // 교통 — 스카이
  ["lodging"], "#c084fc", // 숙박 — 퍼플
  "#9fb8c8", // 기타 — 뉴트럴
];

/**
 * 지구본에서 도시 3D까지 하나로 이어지는 다크 네온 스타일.
 * 라벨 한글은 MapLibre의 localIdeographFontFamily가 로컬 폰트로 그린다.
 */
export function omniMapStyle(): StyleSpecification {
  return {
    version: 8,
    name: "OMNI Hologram",
    glyphs: `${OFM}/fonts/{fontstack}/{range}.pbf`,
    sources: {
      openmaptiles: {
        type: "vector",
        url: `${OFM}/planet`,
        // OpenFreeMap/OSM 라이선스상 출처 표기는 필수.
        attribution:
          '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · ' +
          '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>',
      },
    },
    layers: [
      // 이 타일셋에는 전지구 육지 폴리곤이 없다. 배경 = 육지, water 레이어 = 바다.
      { id: "bg", type: "background", paint: { "background-color": MAP_COLORS.land } },

      // ── 육지 / 물 ──────────────────────────────────────────────
      {
        id: "landcover",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        minzoom: 7,
        paint: { "fill-color": MAP_COLORS.park, "fill-opacity": 0.5 },
      },
      {
        id: "water",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "water",
        paint: { "fill-color": MAP_COLORS.water },
      },
      {
        id: "waterway",
        type: "line",
        source: "openmaptiles",
        "source-layer": "waterway",
        minzoom: 8,
        paint: { "line-color": MAP_COLORS.water, "line-width": 1.2 },
      },

      // ── 경계선 (지구본 줌아웃에서 국가 윤곽을 살려줌) ──────────
      {
        id: "boundary",
        type: "line",
        source: "openmaptiles",
        "source-layer": "boundary",
        filter: ["<=", ["get", "admin_level"], 4],
        paint: {
          "line-color": "#1e4e6b",
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.4, 8, 1.2],
          "line-opacity": 0.8,
        },
      },

      // ── 도로 ──────────────────────────────────────────────────
      {
        id: "road-minor",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        minzoom: 12,
        filter: ["in", ["get", "class"], ["literal", ["minor", "service", "track"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": MAP_COLORS.road,
          "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.4, 18, 4],
          "line-opacity": 0.7,
        },
      },
      {
        id: "road-major",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        minzoom: 5,
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary"]],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": MAP_COLORS.roadMajor,
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 12, 1.8, 18, 7],
          "line-opacity": 0.85,
          "line-blur": 0.6,
        },
      },

      // ── 건물: 2D(멀리) → 3D(가까이) 로 자연스럽게 인계 ────────
      {
        id: "building-flat",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 13,
        maxzoom: 15,
        paint: {
          "fill-color": MAP_COLORS.buildingLow,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.35, 15, 0],
        },
      },
      {
        // ★ 핵심: 줌인하면 솟아오르는 3D 건물 (OSM 높이 기반)
        id: "building-3d",
        type: "fill-extrusion",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 14,
        // hide_3d = 건물 부분(building:part) 등 3D로 세우면 안 되는 피처.
        filter: ["!=", ["get", "hide_3d"], true],
        paint: {
          // 높을수록 네온 시안 — 홀로그램 도시 느낌
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "render_height"], 0],
            0, MAP_COLORS.buildingLow,
            30, "#1c6a94",
            80, "#2f9fd0",
            200, MAP_COLORS.buildingHigh,
          ],
          // z14~15.5 사이에서 0 → 실제 높이로 "솟아오름"
          "fill-extrusion-height": [
            "interpolate", ["linear"], ["zoom"],
            14, 0,
            15.5, ["coalesce", ["get", "render_height"], 5],
          ],
          "fill-extrusion-base": [
            "interpolate", ["linear"], ["zoom"],
            14, 0,
            15.5, ["coalesce", ["get", "render_min_height"], 0],
          ],
          "fill-extrusion-opacity": 0.82,
          "fill-extrusion-vertical-gradient": true,
        },
      },

      // ── 라벨 ──────────────────────────────────────────────────
      {
        id: "place-label",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["continent", "country", "state", "city", "town", "village"]],
        ],
        layout: {
          "text-field": ["coalesce", ["get", "name:ko"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 2, 11, 6, 13, 12, 16],
          "text-max-width": 8,
        },
        paint: {
          "text-color": MAP_COLORS.label,
          "text-halo-color": MAP_COLORS.labelHalo,
          "text-halo-width": 1.4,
        },
      },

      // ── 도로명 (선을 따라 흐르는 라벨) ────────────────────────
      {
        id: "road-label",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "transportation_name",
        minzoom: 13,
        layout: {
          "symbol-placement": "line",
          "text-field": ["coalesce", ["get", "name:ko"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 18, 13],
          "text-max-angle": 30,
          "symbol-spacing": 260,
        },
        paint: {
          "text-color": "#8fb6cf",
          "text-halo-color": MAP_COLORS.labelHalo,
          "text-halo-width": 1.4,
        },
      },

      // ── POI 점 (업종색 원) ────────────────────────────────────
      {
        id: "poi-dot",
        type: "circle",
        source: "openmaptiles",
        "source-layer": "poi",
        minzoom: 15,
        // rank가 낮을수록(=중요) 먼저 보이게. 줌이 올라갈수록 덜 중요한 것까지.
        // (카테고리 필터 시 OmniMap이 이 필터를 갈아끼운다.)
        filter: POI_RANK_FILTER_DOT,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 15, 2.5, 18, 4.5],
          "circle-color": POI_COLOR,
          "circle-opacity": 0.9,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#02040a",
          "circle-stroke-opacity": 0.7,
        },
      },

      // ── POI 라벨 (점 옆 이름) ─────────────────────────────────
      {
        id: "poi-label",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "poi",
        minzoom: 16,
        filter: POI_RANK_FILTER_LABEL,
        layout: {
          "text-field": ["coalesce", ["get", "name:ko"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 16, 10, 19, 13],
          "text-anchor": "left",
          "text-offset": [0.7, 0],
          "text-max-width": 7,
          "text-optional": true,
        },
        paint: {
          "text-color": "#dbeafe",
          "text-halo-color": MAP_COLORS.labelHalo,
          "text-halo-width": 1.3,
        },
      },
    ],
    sky: {
      "sky-color": "#0a1830",
      "sky-horizon-blend": 0.6,
      "horizon-color": "#123a56",
      "horizon-fog-blend": 0.6,
      "fog-color": "#02040a",
      "fog-ground-blend": 0.7,
    },
  };
}
