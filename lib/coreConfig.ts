/**
 * 코어(아크 리액터) 비주얼 설정.
 *
 * ★ 배경 이미지를 바꾸고 싶을 때 여기만 수정하세요.
 *   - public/ 폴더에 이미지를 넣고 "/your-image.png" 처럼 경로를 적거나
 *   - 외부 URL("https://...")을 그대로 넣어도 됩니다.
 *   - null 이면 기본 네온 그라디언트 코어가 사용됩니다.
 */
export const CORE_BACKGROUND: string | null = null;

/** 배경 이미지 위에 덮는 네온 틴트 강도 (0 = 원본 그대로, 1 = 완전 틴트) */
export const CORE_TINT = 0.45;

/** 코어 크기(px) — 패널이 없을 때(확대) / 있을 때(축소) */
export const CORE_SIZE = {
  expanded: 168,
  compact: 104,
};
