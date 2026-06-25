/**
 * 검증규칙 (Validation Rules) — 클라이언트 측.
 * ─────────────────────────────────────────────────────────────
 * AI가 만든 답변을 사용자에게 보여주기 전에 검사한다.
 * 금지 답안이 새어나오거나 형식이 어긋나면 여기서 걸러낸다.
 *
 * ★ 규칙은 ValidationRule 배열에 추가하면 된다.
 *   - test(reply): 문제가 있으면 true 반환
 *   - fix(reply) (선택): 자동 교정값 반환 (없으면 fallback 사용)
 */

export interface ValidationRule {
  name: string;
  test: (reply: string) => boolean; // true = 위반
  fix?: (reply: string) => string; // 위반 시 교정
}

/** 위반 시 교정값도 없을 때 쓰는 안전 답변. */
export const FALLBACK_REPLY = "죄송합니다, 선생님. 다시 한 번 말씀해 주시겠습니까?";

export const VALIDATION_RULES: ValidationRule[] = [
  // ── 금지 단어가 답변에 들어가면 제거 ──
  {
    name: "금지 캐릭터/세계관 언급",
    test: (r) => /자비스|토니\s?스타크|아이언맨|jarvis|tony\s?stark/i.test(r),
    fix: (r) =>
      r.replace(/자비스|토니\s?스타크|아이언맨|jarvis|tony\s?stark/gi, "OMNI"),
  },
  // ── 빈 답변 / 너무 짧은 답변 차단 ──
  {
    name: "빈 답변",
    test: (r) => r.trim().length === 0,
  },
  // ── 예시: 특정 금지 답안 패턴 (실제 정책으로 교체) ──
  // {
  //   name: "민감정보 노출",
  //   test: (r) => /비밀번호|주민번호/.test(r),
  //   fix: (r) => "해당 정보는 알려드릴 수 없습니다, 선생님.",
  // },
];

export interface ValidationResult {
  ok: boolean;
  reply: string; // 교정 후 최종 답변
  issues: string[]; // 걸린 규칙 이름들
}

/** 답변을 모든 규칙에 통과시키고, 위반 시 교정/대체한다. */
export function validateReply(reply: string): ValidationResult {
  let out = reply;
  const issues: string[] = [];
  for (const rule of VALIDATION_RULES) {
    if (rule.test(out)) {
      issues.push(rule.name);
      out = rule.fix ? rule.fix(out) : FALLBACK_REPLY;
    }
  }
  return { ok: issues.length === 0, reply: out, issues };
}
