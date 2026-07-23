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
import type { StyleSpecification } from "maplibre-gl";

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
