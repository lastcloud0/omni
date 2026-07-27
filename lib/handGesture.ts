/**
 * 손 제스처 판정 — VISION과 MAP이 **같은 코드·같은 상수**를 쓰게 하는 공용 모듈.
 *
 * 원래 app/vision/page.tsx에 인라인으로 있던 로직을 그대로 옮긴 것이다.
 * 복붙이 아니라 이 파일 하나를 공유하므로, 감도를 바꾸면 두 화면에 동시에 적용된다.
 *
 * 판정 규칙
 *  - 회전 의도: 손목(0)→중지뿌리(9) 각도를 중립(손가락 위)에서 얼마나 비틀었나
 *  - 줌 의도  : 핀치 거리의 **변화 속도** (가만히 비틀면 0 → 회전이 이김)
 *  - 둘 중 더 강한 쪽만 채택, 히스테리시스로 깜빡임 방지
 */
import type { HandFrame } from "@/hooks/useHandTracking";

// ── 감도 상수 (VISION 원본 값 그대로) ───────────────────────────
export const ZOOM_GAIN = 14; // 핀치 변화량 → 줌 단위
export const ROT_NORM = 0.6; // 이 정도 비틀면 회전 강도 ~1 (약 50°)
export const ZOOM_VEL_DEAD = 0.004; // 핀치 지터 무시
export const ZOOM_VEL_NORM = 0.012; // 이 속도로 핀치 변하면 줌 강도 ~1
export const MODE_HYST = 1.15; // 회전/줌 전환 히스테리시스
export const SPIN_DEAD = 0.28; // 브레이크 중립 구간(라디안, ±약 16°)
export const SPIN_GAIN = 0.06; // 기울인 각도 → 회전 속도 비례
export const SPIN_MAX = 0.09; // 최대 회전 속도(라디안/프레임)
export const ROLL_NEUTRAL = -Math.PI / 2; // 손 똑바로(손가락 위) = 중립

export type GestureMode = "rot" | "zoom" | null;

export interface GestureOutput {
  detected: boolean;
  mode: GestureMode;
  /**
   * 회전 속도(라디안/프레임).
   * null = 손 없음(호출부가 "자동 회전" 등으로 해석), 0 = 정지.
   */
  spin: number | null;
  /**
   * 줌 변화량. VISION의 카메라 거리 단위 기준.
   * 음수 = 손을 오므림 = 가까이(줌인).
   */
  zoomDelta: number;
  /** 핀치 원본값 (0에 가까울수록 오므림). */
  pinch: number;
  /** 포인터 위치 (거울모드 보정된 0..1). 손 없으면 null. */
  pointer: { x: number; y: number } | null;
}

const IDLE: GestureOutput = {
  detected: false,
  mode: null,
  spin: null,
  zoomDelta: 0,
  pinch: 1,
  pointer: null,
};

export interface ReadOptions {
  /** true면 회전·줌을 억제한다 (예: 노드 위에 손이 올라가 선택 중). */
  suppress?: boolean;
}

/**
 * 프레임 간 상태(직전 핀치·현재 모드)를 들고 있는 판정기를 만든다.
 * 화면마다 하나씩 생성해 쓴다.
 */
export function createGestureReader() {
  let lastPinch: number | null = null;
  let mode: GestureMode = null;

  return {
    read(frame: HandFrame, opts: ReadOptions = {}): GestureOutput {
      if (!frame.detected) {
        lastPinch = null;
        mode = null;
        return IDLE;
      }

      // 포인터 (거울모드 보정)
      const pt = frame.pointer ?? frame.landmarks[9] ?? null;
      const pointer = pt ? { x: 1 - pt.x, y: pt.y } : null;

      // --- 회전 의도: 손 비틀기 각도 ---
      const w = frame.landmarks[0];
      const m = frame.landmarks[9];
      let spinTarget = 0;
      let rotStrength = 0;
      if (w && m) {
        const ang = Math.atan2(m.y - w.y, m.x - w.x);
        let off = ang - ROLL_NEUTRAL;
        off = Math.atan2(Math.sin(off), Math.cos(off));
        off = -off; // 거울모드 보정
        if (Math.abs(off) > SPIN_DEAD) {
          const eff = off - Math.sign(off) * SPIN_DEAD;
          spinTarget = Math.max(-SPIN_MAX, Math.min(SPIN_MAX, eff * SPIN_GAIN));
          rotStrength = (Math.abs(off) - SPIN_DEAD) / ROT_NORM;
        }
      }

      // --- 줌 의도: 핀치 "변화 속도" ---
      const delta = lastPinch != null ? frame.pinch - lastPinch : 0;
      const zoomStrength = Math.max(0, Math.abs(delta) - ZOOM_VEL_DEAD) / ZOOM_VEL_NORM;

      // --- 더 강한 동작만 채택 (히스테리시스) ---
      if (opts.suppress) {
        mode = null;
      } else if (rotStrength > zoomStrength * MODE_HYST) {
        mode = "rot";
      } else if (zoomStrength > rotStrength * MODE_HYST) {
        mode = "zoom";
      } // 둘 다 비슷하면 직전 모드 유지

      const out: GestureOutput = {
        detected: true,
        mode,
        spin: mode === "rot" ? spinTarget : 0,
        zoomDelta: mode === "zoom" ? delta * ZOOM_GAIN : 0,
        pinch: frame.pinch,
        pointer,
      };
      lastPinch = frame.pinch;
      return out;
    },
  };
}
