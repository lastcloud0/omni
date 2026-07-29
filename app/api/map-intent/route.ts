import { NextResponse } from "next/server";

export const runtime = "nodejs";

// 지도 문맥 자연어 → 구조화 의도. 규칙 파서가 못 잡은 문장만 여기로 온다.
const MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash"];

// 필터 카테고리(한글 키) — mapStyle의 POI_CATEGORIES와 일치시켜 둔다.
const CATEGORIES = [
  "카페", "음식점", "편의점", "병원", "약국", "은행", "주유소", "주차장", "지하철", "숙박",
];

const SYSTEM = `너는 지도 앱 'OMNI MAP'의 명령 해석기다. 사용자의 한국어 발화를 읽고 **오직 JSON 하나**로만 답한다. 설명·코드펜스 금지.

가능한 action:
- "search"     : 한 장소를 찾아 이동. { "action":"search", "query":"<장소명>" }
- "route"      : 내 위치에서 한 목적지까지 경로. { "action":"route", "query":"<목적지>", "mode":"driving|walking" }
- "routeAB"    : A에서 B까지 경로. { "action":"routeAB", "from":"<출발>", "to":"<도착>", "mode":"driving|walking" }
- "filter"     : 업종만 표시. category는 [${CATEGORIES.join(", ")}] 중 가장 가까운 하나. { "action":"filter", "category":"<카테고리>" }
- "clearRoute" : 경로 지우기. { "action":"clearRoute" }
- "clearFilter": 필터 해제. { "action":"clearFilter" }
- "home"       : 지구본/처음 화면. { "action":"home" }
- "tilt"       : 지도 기울이기 토글. { "action":"tilt" }
- "answer"     : 지도 조작이 아닌 일반 질문/잡담. 짧게 답한다. { "action":"answer", "reply":"<한두 문장 한국어>" }
- "none"       : 도저히 해석 불가. { "action":"none" }

규칙:
- 걸어서/도보면 mode="walking", 아니면 "driving".
- 장소명은 지오코딩에 쓸 수 있게 핵심 명칭만 남긴다(조사·군더더기 제거). 예: "강남에 있는 스타벅스" → "강남 스타벅스".
- "제일 가까운/근처" 같은 표현은 장소명에서 빼되 의도는 유지.
- 확실치 않으면 억지로 만들지 말고 "none" 또는 "answer".`;

async function callGemini(model: string, apiKey: string, body: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body }
  );
  if (res.ok) {
    const data = await res.json();
    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || "")
        .join("")
        .trim() || "";
    return { ok: true as const, text };
  }
  const retryable = res.status === 429 || res.status === 503 || res.status >= 500;
  return { ok: false as const, retryable };
}

export async function POST(req: Request) {
  const { text } = await req.json().catch(() => ({ text: "" }));
  if (!text || typeof text !== "string") {
    return NextResponse.json({ action: "none" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ action: "none" });

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 256,
      responseMimeType: "application/json", // JSON 강제
    },
  });

  try {
    for (const model of MODELS) {
      const r = await callGemini(model, apiKey, body);
      if (r.ok) {
        try {
          const intent = JSON.parse(r.text);
          return NextResponse.json(intent);
        } catch {
          return NextResponse.json({ action: "none" });
        }
      }
      if (!r.retryable) break;
    }
  } catch (e) {
    console.error("map-intent error:", e);
  }
  return NextResponse.json({ action: "none" });
}
