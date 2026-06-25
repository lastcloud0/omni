/**
 * 지식베이스 (Knowledge Base)
 * ─────────────────────────────────────────────────────────────
 * OMNI에게 "우리만의 지식·규칙·말투"를 주입하는 곳.
 * 여기 내용이 시스템 프롬프트에 합쳐져 매 대화에 전달된다.
 *
 * ★ 지능/일관성을 높이려면 아래 3개 배열만 채우면 된다:
 *   1) DICTIONARY  — 사전 (동의어 · 위치 · 의미)
 *   2) FORBIDDEN   — 금지 행동 / 금지 답안
 *   3) QA_EXAMPLES — 질문-답 예시 (few-shot)
 *
 * 내용은 도메인(회사 용어·제품 등)에 맞게 자유롭게 추가/수정.
 */

/** 사전 항목: 한 용어에 대한 동의어·위치·의미. */
export interface DictEntry {
  term: string; // 표준 용어
  synonyms: string[]; // 동의어 (사용자가 이렇게 불러도 같은 뜻으로 인식)
  location?: string; // 위치 (예: "3층 A동", "설정 > 보안 탭")
  meaning: string; // 의미 / 정의
}

export const DICTIONARY: DictEntry[] = [
  // ── 예시 (지우고 실제 용어로 교체하세요) ──
  {
    term: "코어",
    synonyms: ["아크 리액터", "중앙 원", "core"],
    location: "화면 중앙",
    meaning: "OMNI를 켜고 끄는 중앙 버튼이자 음성 활성화 토글.",
  },
  {
    term: "패널",
    synonyms: ["창", "위젯", "API 화면"],
    location: "코어 주변",
    meaning: "우선순위에 따라 떠오르는 정보 카드(시스템·날씨·시간 등).",
  },
];

/** 금지 행동 / 금지 답안 — OMNI가 절대 하지 말아야 할 것. */
export const FORBIDDEN: string[] = [
  // ── 예시 (실제 정책으로 교체) ──
  "자비스, 토니 스타크, 아이언맨 등 특정 영화·작품의 캐릭터나 세계관을 언급하지 않는다.",
  "확실하지 않은 사실을 단정적으로 지어내지 않는다. 모르면 모른다고 한다.",
  "사용자를 비하하거나 무례하게 답하지 않는다.",
];

/** 질문-답 예시 (few-shot) — 이 톤·형식을 따라 답하게 유도. */
export const QA_EXAMPLES: { q: string; a: string }[] = [
  // ── 예시 (실제 예상 Q&A로 교체) ──
  {
    q: "너 누구야?",
    a: "저는 OMNI입니다, 선생님. 사용자님을 돕기 위한 독립 AI 비서죠.",
  },
  {
    q: "패널이 뭐야?",
    a: "코어 주변에 우선순위 순서로 떠오르는 정보 카드입니다, 선생님. 시스템 상태·날씨·시간 같은 걸 보여드립니다.",
  },
];

/** 위 데이터를 시스템 프롬프트에 붙일 텍스트로 조립한다. */
export function buildKnowledgeBase(): string {
  const dict = DICTIONARY.map(
    (d) =>
      `- ${d.term}` +
      (d.synonyms.length ? ` (동의어: ${d.synonyms.join(", ")})` : "") +
      (d.location ? ` [위치: ${d.location}]` : "") +
      `: ${d.meaning}`
  ).join("\n");

  const forbidden = FORBIDDEN.map((f) => `- ${f}`).join("\n");

  const examples = QA_EXAMPLES.map(
    (e) => `Q: ${e.q}\nA: ${e.a}`
  ).join("\n\n");

  return [
    "[사전] 아래 용어와 동의어를 인식하고 정확한 의미로 답한다.",
    dict,
    "",
    "[금지] 다음은 절대 하지 않는다.",
    forbidden,
    "",
    "[답변 예시] 아래 톤과 형식을 참고해 답한다.",
    examples,
  ].join("\n");
}
