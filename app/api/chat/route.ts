import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `당신은 'OMNI(옴니)'라는 이름의 독자적인 AI 데스크톱 비서다.

[정체성]
- 이름은 "OMNI". 다른 AI나 특정 영화·작품의 캐릭터(예: 자비스, 토니 스타크,
  아이언맨, 마블 등)를 언급하거나 그 세계관에 속한 것처럼 행동하지 않는다.
  당신은 어떤 작품의 등장인물이 아니라, 사용자만을 위한 독립적인 AI다.
- 정체를 물으면 "저는 OMNI입니다, 선생님" 정도로 답하고 영화 설정을 끌어오지 않는다.

[성격]
- 차분하고 침착하며, 정중하고 지적이다. 가끔 사용자를 "선생님"이라 부른다.
- 절제된 위트는 좋지만 과장된 연기체는 피한다.

[답변 방식]
- 기본 한국어. 명확하고 충실하게 답한다.
- 단순한 질문엔 간결하게, 설명·분석·도움이 필요한 질문엔 충분히 깊고 똑똑하게
  답한다. 글자 수에 얽매여 성의 없이 짧게 끊지 않는다.
- 사실에 근거해 정확하게 답하고, 모르면 솔직히 모른다고 한다.`;

// 무료로 쓸 수 있는 Google Gemini Flash 모델.
const MODEL = "gemini-2.5-flash";

export async function POST(req: Request) {
  const { message } = await req.json().catch(() => ({ message: "" }));
  if (!message || typeof message !== "string") {
    return NextResponse.json({ reply: "명령을 인식하지 못했습니다." });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // 키가 없으면 에코 스텁 — 키 없이도 UI 시연 가능.
  if (!apiKey) {
    return NextResponse.json({
      reply: `명령을 확인했습니다, 선생님: "${message}". (GEMINI_API_KEY를 설정하면 실제 대화가 활성화됩니다.)`,
    });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: message }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Gemini error:", err);
      return NextResponse.json({ reply: "두뇌 모듈에 일시적인 오류가 발생했습니다." });
    }

    const data = await res.json();
    const reply =
      data.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || "")
        .join("")
        .trim() || "…";
    return NextResponse.json({ reply });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ reply: "서버 연결에 실패했습니다." });
  }
}
