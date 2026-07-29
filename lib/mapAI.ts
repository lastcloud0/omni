/**
 * 지도 명령 하이브리드 해석기.
 *   1) 규칙 파서(parseMapCommand) 먼저 — 즉시·무료.
 *   2) 규칙이 못 잡으면(none) Gemini(/api/map-intent)로 자연어 해석.
 *
 * 음성·텍스트(상단 입력창) 어느 쪽이든 이 한 곳을 거친다.
 */
import { parseMapCommand, type MapIntent, type RouteMode } from "./mapIntent";

/** "answer"(일반 질문 응답)까지 포함한 확장 결과. */
export type MapResult = MapIntent | { type: "answer"; reply: string };

// Gemini가 돌려준 JSON(action 스키마)을 내부 MapIntent로 변환.
interface AiIntent {
  action?: string;
  query?: string;
  from?: string;
  to?: string;
  category?: string;
  mode?: string;
  reply?: string;
}

function fromAi(a: AiIntent): MapResult {
  const mode: RouteMode = a.mode === "walking" ? "walking" : "driving";
  switch (a.action) {
    case "search":
      return a.query ? { type: "search", query: a.query } : { type: "none" };
    case "route":
      return a.query ? { type: "route", query: a.query, mode } : { type: "none" };
    case "routeAB":
      return a.from && a.to
        ? { type: "routeAB", from: a.from, to: a.to, mode }
        : { type: "none" };
    case "filter":
      return a.category ? { type: "filter", category: a.category } : { type: "none" };
    case "clearRoute":
      return { type: "clearRoute" };
    case "clearFilter":
      return { type: "clearFilter" };
    case "home":
      return { type: "home" };
    case "tilt":
      return { type: "tilt" };
    case "answer":
      return { type: "answer", reply: a.reply || "" };
    default:
      return { type: "none" };
  }
}

/**
 * 텍스트/음성 발화를 해석한다. 규칙 우선, 실패 시 AI.
 * @param signal 이전 요청 취소용
 */
export async function interpret(text: string, signal?: AbortSignal): Promise<MapResult> {
  const rule = parseMapCommand(text);
  if (rule.type !== "none") return rule; // 규칙이 잡으면 바로 (Gemini 안 부름)

  try {
    const res = await fetch("/api/map-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });
    if (!res.ok) return { type: "none" };
    const data = (await res.json()) as AiIntent;
    return fromAi(data);
  } catch {
    return { type: "none" }; // abort/네트워크 오류
  }
}
