import { NextResponse } from "next/server";
import { buildKnowledgeBase } from "@/lib/knowledgeBase";
import { getWeather, parseWeatherIntent } from "@/lib/weather";

export const runtime = "nodejs";

const PERSONA = `당신은 'OMNI(옴니)'라는 이름의 독자적인 AI 데스크톱 비서다.

[정체성]
- 이름은 "OMNI". 다른 AI나 특정 영화·작품의 캐릭터(예: 자비스, 토니 스타크,
  아이언맨, 마블 등)를 언급하거나 그 세계관에 속한 것처럼 행동하지 않는다.
  당신은 어떤 작품의 등장인물이 아니라, 사용자만을 위한 독립적인 AI다.
- 정체를 물으면 "저는 OMNI입니다, 선생님" 정도로 답하고 영화 설정을 끌어오지 않는다.

[성격]
- 차분하고 침착하며, 정중하고 지적이다. 가끔 사용자를 "선생님"이라 부른다.
- 절제된 위트는 좋지만 과장된 연기체는 피한다.

[답변 방식]
- 기본 한국어. 핵심만 간결하게.
- 기본적으로 4줄 이하로 답한다. 사용자가 "자세히/길게/설명해줘"라고 명시할 때만 길게.
- 불필요한 서론·맺음말 없이 바로 답한다.
- 사실에 근거해 정확하게 답하고, 모르면 솔직히 모른다고 한다.`;

// 페르소나 + 지식베이스(사전·금지·예시)를 합쳐 최종 시스템 프롬프트를 만든다.
const SYSTEM_PROMPT = `${PERSONA}\n\n${buildKnowledgeBase()}`;

// 무료 Gemini 모델 — 앞에서부터 시도하고, 과부하(503)/한도(429) 시 다음으로 넘어간다.
const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];

interface Turn {
  role: "user" | "assistant";
  content: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 한 모델로 1회 호출. 일시적 오류(429/503/5xx)면 retryable=true 로 알림. */
async function callGemini(model: string, apiKey: string, body: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body }
  );
  if (res.ok) {
    const data = await res.json();
    const reply =
      data.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || "")
        .join("")
        .trim() || "";
    return { ok: true as const, reply };
  }
  const errText = await res.text();
  const retryable = res.status === 429 || res.status === 503 || res.status >= 500;
  return { ok: false as const, status: res.status, retryable, errText };
}

export async function POST(req: Request) {
  const { message, history } = await req
    .json()
    .catch(() => ({ message: "", history: [] }));
  if (!message || typeof message !== "string") {
    return NextResponse.json({ reply: "명령을 인식하지 못했습니다." });
  }
  const turns: Turn[] = Array.isArray(history) ? history : [];

  // 날씨 의도 감지 → 실제 데이터를 프롬프트에 주입(있으면 정확한 수치로 답함).
  let weatherCtx = "";
  const prevAssistant = [...turns].reverse().find((t) => t.role === "assistant")?.content;
  const intent = parseWeatherIntent(message, prevAssistant);
  if (intent.isWeather && intent.city) {
    const wx = await getWeather(intent.city);
    if (wx) {
      weatherCtx =
        `\n\n[실시간 날씨 데이터 — 이 수치를 근거로 답하라]\n` +
        `${wx.city}${wx.country ? "(" + wx.country + ")" : ""}: ${wx.condition}, ` +
        `현재 ${wx.temperature}°C(체감 ${wx.feelsLike}°C), 습도 ${wx.humidity}%, ` +
        `풍속 ${wx.windSpeed}m/s`;
    } else {
      weatherCtx = `\n\n[참고] '${intent.city}' 날씨 데이터를 가져오지 못했다. 도시명을 다시 확인하도록 정중히 요청하라.`;
    }
  } else if (intent.isWeather && !intent.city) {
    weatherCtx = `\n\n[참고] 사용자가 날씨를 물었으나 지역이 불명확하다. 어느 지역인지 정중히 되물어라.`;
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // 키가 없으면 에코 스텁 — 키 없이도 UI 시연 가능.
  if (!apiKey) {
    return NextResponse.json({
      reply: `명령을 확인했습니다, 선생님: "${message}". (GEMINI_API_KEY를 설정하면 실제 대화가 활성화됩니다.)`,
    });
  }

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM_PROMPT + weatherCtx }] },
    // 직전 대화(최근 12턴)를 함께 보내 맥락을 유지한다.
    // Gemini는 assistant 역할을 "model"로 표기한다.
    contents: [
      ...turns.slice(-12).map((t) => ({
        role: t.role === "assistant" ? "model" : "user",
        parts: [{ text: t.content }],
      })),
      { role: "user", parts: [{ text: message }] },
    ],
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
  });

  // 모델 목록을 순서대로 시도. 같은 모델은 짧게 1회 더 재시도(과부하 대비).
  let lastErr = "";
  try {
    for (const model of MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await callGemini(model, apiKey, body);
        if (r.ok) {
          return NextResponse.json({ reply: r.reply || "…" });
        }
        lastErr = `${model} ${r.status}: ${r.errText.slice(0, 120)}`;
        console.error("Gemini error:", lastErr);
        if (!r.retryable) break; // 재시도 불가 오류면 다음 모델로
        await sleep(700); // 잠깐 쉬고 재시도
      }
    }
    return NextResponse.json({
      reply: "지금 AI 서버가 잠시 붐비네요, 선생님. 잠시 후 다시 말씀해 주시겠습니까?",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ reply: "서버 연결에 실패했습니다." });
  }
}
