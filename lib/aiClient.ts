/**
 * AI 어댑터 — 껍데기(UI)와 두뇌(AI)를 분리하는 단 하나의 연결 지점.
 *
 * ★ 기존 AI 소스를 쓰려면 여기만 바꾸면 됩니다.
 *   UI 쪽 코드(useOmni 등)는 askAI()만 호출하므로, AI를 무엇으로
 *   바꾸든 화면 코드는 전혀 수정할 필요가 없습니다.
 *
 * 응답 규약(AIResponse):
 *   - reply : 사용자에게 말할/보여줄 텍스트
 *   - panel : (선택) 화면에 띄울 API 패널. AI가 패널을 지정하면 껍데기가 그대로 출력.
 */
import type { Panel } from "./types";

export interface AIResponse {
  reply: string;
  panel?: Panel;
}

/**
 * 기본값은 내장 /api/chat 라우트를 호출.
 * 외부의 기존 AI 서버를 쓰려면 NEXT_PUBLIC_AI_ENDPOINT 에 그 주소를 넣으면 됨.
 *   예) .env.local →  NEXT_PUBLIC_AI_ENDPOINT=https://my-existing-ai.example.com/ask
 */
const AI_ENDPOINT = process.env.NEXT_PUBLIC_AI_ENDPOINT || "/api/chat";

export async function askAI(message: string): Promise<AIResponse> {
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    // 기존 소스가 어떤 키로 답하든 흡수: reply / text / message / content 순으로 탐색.
    const reply =
      data.reply ?? data.text ?? data.message ?? data.content ?? "응답을 받지 못했습니다.";
    return { reply, panel: data.panel };
  } catch {
    return { reply: "AI 소스에 연결할 수 없습니다." };
  }
}
