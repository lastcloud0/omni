/**
 * MAP 음성 명령 파서 — 순수 함수. 한국어 발화 → 지도 의도(intent).
 * OmniMap(맵 안) 과 useOmni(메인) 이 이 결과를 받아 검색/경로/필터를 실행한다.
 *
 * 예)
 *   "강남역 길찾기"                → { type:"route", query:"강남역", mode:"driving" }
 *   "송파구청에서 코엑스몰 경로"    → { type:"routeAB", from:"송파구청", to:"코엑스몰", mode:"driving" }
 *   "강남역부터 홍대까지 걸어서"    → { type:"routeAB", from:"강남역", to:"홍대", mode:"walking" }
 *   "부산역 찾아줘"                → { type:"search", query:"부산역" }
 *   "근처 카페"                    → { type:"filter", category:"카페" }
 *   "경로 지워" / "필터 꺼" / "지구본"
 */
import { POI_CATEGORIES } from "./mapStyle";

export type RouteMode = "driving" | "walking";

export type MapIntent =
  | { type: "routeAB"; from: string; to: string; mode: RouteMode }
  | { type: "route"; query: string; mode: RouteMode }
  | { type: "search"; query: string }
  | { type: "filter"; category: string }
  | { type: "clearRoute" }
  | { type: "clearFilter" }
  | { type: "home" }
  | { type: "tilt" }
  | { type: "none" };

// 웨이크워드(있으면 떼고 처리) — useOmni와 동일 변형.
const WAKE = /^(옴니|오므니|옴리|omni|없니|엄니|온니|옹니|음니)[,\s]*/i;
// "맵/지도" 트리거 — 메인 화면에서 지도 명령인지 구분할 때 쓴다.
const MAP_TRIGGER = /(맵|지도)(에서|에|으로|로|을|를|\s|모드)?/;

// 명령/조사 어미 — 검색어 추출 시 제거.
const NOISE = [
  "길찾기", "길 찾기", "가는길", "가는 길", "경로", "안내", "어떻게",
  "찾아줘", "찾아봐", "찾아", "검색해", "검색", "보여줘", "보여", "어디야", "어디",
  "가자", "이동해", "이동", "으로", "까지", "가줘", "해줘",
  "걸어서", "걸어", "도보", "자동차", "차로", "운전",
  "근처", "주변", "이 근처", "여기", "맵에서", "지도에서", "맵", "지도",
];

function stripJosaTail(q: string): string {
  return q.replace(/\s+(로|가|를|을|에|이|의)$/g, "").trim();
}

function extractQuery(text: string): string {
  let q = text;
  for (const w of NOISE) q = q.split(w).join(" ");
  q = q.replace(/\s+/g, " ").trim();
  return stripJosaTail(q);
}

// 경로 지시어(뒤에 붙는 것) 제거 — A→B 추출 시.
const ROUTE_TAIL =
  /경로|길찾기|길\s*찾기|가는\s*길|길\s*안내|안내|가자|가\s*줘|알려\s*줘|찾아\s*줘|해\s*줘|걸어서|걸어|도보|자동차|차로|운전|어떻게/g;

/** "A에서 B", "A부터 B까지" 형태를 두 지점으로 분리. 아니면 null. */
function splitAB(text: string): { from: string; to: string; mode: RouteMode } | null {
  const walking = /걸어|도보/.test(text.replace(/\s/g, ""));
  // 커넥터(에서/부터)가 없으면 A→B 아님.
  if (!/(에서|부터)/.test(text)) return null;
  const cleaned = text.replace(ROUTE_TAIL, " ").replace(/\s+/g, " ").trim();
  // A (에서|부터) B (까지|으로)? — 로/으로는 도로명과 혼동되어 tail 커넥터에서 제외.
  const m = cleaned.match(/^(.*?)(?:에서|부터)\s*(.*?)(?:\s*(?:까지|으로))?\s*$/);
  if (!m) return null;
  const from = stripJosaTail(m[1].trim());
  const to = stripJosaTail(m[2].trim());
  // 근처/주변/여기 류는 A→B가 아니라 검색/필터 맥락.
  if (!from || !to || from.length < 2 || to.length < 2) return null;
  if (/^(근처|주변|여기|이)$/.test(from)) return null;
  return { from, to, mode: walking ? "walking" : "driving" };
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

  // A→B 경로 (검색/필터보다 먼저 — "에서/부터" 커넥터가 강한 신호)
  const ab = splitAB(text);
  if (ab) return { type: "routeAB", ...ab };

  // 카테고리 필터 ("근처 카페"는 검색이 아니라 필터)
  const cat = POI_CATEGORIES.find(
    (c) => flat.includes(c.key) || c.tokens.some((t) => flat.includes(t))
  );
  const looksFilter =
    cat && (/근처|주변|여기|보여|필터|만/.test(flat) || flat === cat.key || flat.startsWith(cat.key));
  if (looksFilter && cat) return { type: "filter", category: cat.key };

  // 단일 목적지 경로: 길찾기/경로/까지 + 이동수단
  const wantsRoute = /길찾기|경로|가는길|안내|까지|가줘|어떻게가|어떻게가는/.test(flat);
  if (wantsRoute) {
    const mode: RouteMode = /걸어|도보/.test(flat) ? "walking" : "driving";
    const query = extractQuery(text);
    if (query) return { type: "route", query, mode };
  }

  // 검색: 찾아/검색/보여/이동 또는 그냥 장소명
  const wantsSearch = /찾아|검색|보여|어디|가자|이동/.test(text);
  const query = extractQuery(text);
  if ((wantsSearch || query.length >= 2) && query) return { type: "search", query };

  return { type: "none" };
}

/**
 * 메인 화면(비-지도)에서 쓰는 엄격 버전.
 *  - "맵/지도" 트리거가 있거나 명백한 경로(routeAB/route)일 때만 지도 의도 반환.
 *  - 일반 대화("날씨 알려줘" 등)를 지도로 오분류하지 않도록 방어.
 * 지도 의도가 아니면 null → 호출부(useOmni)가 AI로 넘긴다.
 */
export function parseMapNav(raw: string): MapIntent | null {
  const text = raw.replace(WAKE, "").trim();
  const hasTrigger = MAP_TRIGGER.test(text);
  const intent = parseMapCommand(hasTrigger ? text.replace(MAP_TRIGGER, " ").trim() : text);

  // A→B 경로, 단일 경로는 트리거 없이도 명백 → 통과.
  if (intent.type === "routeAB" || intent.type === "route") return intent;
  // 나머지(검색/필터 등)는 "맵/지도"를 명시했을 때만.
  if (hasTrigger && intent.type !== "none") return intent;
  return null;
}
