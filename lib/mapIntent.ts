/**
 * MAP 음성 명령 파서 — 순수 함수. 한국어 발화 → 지도 의도(intent).
 * OmniMap이 이 결과를 받아 검색/경로/필터 등을 실행한다.
 *
 * 예)
 *   "강남역 길찾기"        → { type:"route", query:"강남역", mode:"driving" }
 *   "경복궁까지 걸어서"    → { type:"route", query:"경복궁", mode:"walking" }
 *   "부산역 찾아줘"        → { type:"search", query:"부산역" }
 *   "근처 카페"            → { type:"filter", category:"카페" }
 *   "경로 지워"            → { type:"clearRoute" }
 *   "필터 꺼"              → { type:"clearFilter" }
 *   "지구본"              → { type:"home" }
 */
import { POI_CATEGORIES } from "./mapStyle";

export type MapIntent =
  | { type: "route"; query: string; mode: "driving" | "walking" }
  | { type: "search"; query: string }
  | { type: "filter"; category: string }
  | { type: "clearRoute" }
  | { type: "clearFilter" }
  | { type: "home" }
  | { type: "tilt" }
  | { type: "none" };

// 웨이크워드(있으면 떼고 처리) — useOmni와 동일 변형.
const WAKE = /^(옴니|오므니|옴리|omni|없니|엄니|온니|옹니|음니)[,\s]*/i;

// 명령/조사 어미 — 검색어 추출 시 제거.
const NOISE = [
  "길찾기", "길 찾기", "가는길", "가는 길", "경로", "안내", "어떻게",
  "찾아줘", "찾아봐", "찾아", "검색해", "검색", "보여줘", "보여", "어디야", "어디",
  "가자", "이동해", "이동", "으로", "까지", "가줘", "해줘",
  "걸어서", "걸어", "도보", "자동차", "차로", "운전",
  "근처", "주변", "이 근처", "여기",
];

function extractQuery(text: string): string {
  let q = text;
  for (const w of NOISE) q = q.split(w).join(" ");
  q = q.replace(/\s+/g, " ").trim();
  // 끝에 남은 홑조사 잔여물 제거 (예: "…강남점 가", "…시청역 로")
  q = q.replace(/\s+(로|가|를|을|에|이|의)$/g, "").trim();
  return q;
}

/** 발화 하나를 지도 의도로 변환. 해당 없으면 {type:"none"}. */
export function parseMapCommand(raw: string): MapIntent {
  const text = raw.replace(WAKE, "").trim();
  const flat = text.replace(/\s/g, "");
  if (!flat) return { type: "none" };

  // 취소/초기화류 (검색어보다 먼저)
  if (/(경로|길안내|길찾기).*(지워|취소|삭제|꺼|off)/.test(flat) || /^(경로|길)?(취소|그만)$/.test(flat))
    return { type: "clearRoute" };
  if (/(필터|분류).*(꺼|해제|off|취소)|전체보기|다보여|모두보여/.test(flat))
    return { type: "clearFilter" };
  if (/지구본|처음화면|전체지도|초기화면|월드/.test(flat)) return { type: "home" };
  if (/기울여|기울이|세워|입체|평면|정면/.test(flat)) return { type: "tilt" };

  // 카테고리 필터 (장소명 검색보다 우선 — "근처 카페"는 검색이 아니라 필터)
  const cat = POI_CATEGORIES.find(
    (c) => flat.includes(c.key) || c.tokens.some((t) => flat.includes(t))
  );
  const looksFilter =
    cat && (/근처|주변|여기|보여|필터|만/.test(flat) || flat === cat.key || flat.startsWith(cat.key));
  if (looksFilter && cat) return { type: "filter", category: cat.key };

  // 경로: 길찾기/경로/까지 + 이동수단 (띄어쓰기 무시 위해 flat 사용)
  const wantsRoute = /길찾기|경로|가는길|안내|까지|가줘|어떻게가|어떻게가는/.test(flat);
  if (wantsRoute) {
    const mode: "driving" | "walking" = /걸어|도보/.test(flat) ? "walking" : "driving";
    const query = extractQuery(text);
    if (query) return { type: "route", query, mode };
  }

  // 검색: 찾아/검색/보여/이동 또는 그냥 장소명
  const wantsSearch = /찾아|검색|보여|어디|가자|이동/.test(text);
  const query = extractQuery(text);
  if ((wantsSearch || query.length >= 2) && query) return { type: "search", query };

  return { type: "none" };
}
