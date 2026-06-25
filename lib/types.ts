export type OmniStatus = "idle" | "listening" | "thinking" | "responding";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
}

/** 화면에 뜨는 API 패널(홀로그램 창) 한 개. priority가 클수록 먼저/크게 배치. */
export interface Panel {
  id: string;
  title: string;
  priority: number;
  /** 패널 본문 라인들 (간단한 텍스트 위젯). 추후 컴포넌트로 확장 가능. */
  lines: { label: string; value: string }[];
}

export const STATUS_LABEL: Record<OmniStatus, string> = {
  idle: "STANDBY",
  listening: "LISTENING",
  thinking: "THINKING",
  responding: "RESPONDING",
};
