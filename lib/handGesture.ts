/**
 * 손 제스처 판정 — VISION과 MAP이 **같은 코드·같은 상수**를 쓰게 하는 공용 모듈.
 *
 * 판정 규칙
 *  - 회전 의도: 손목(0)→중지뿌리(9) 각도를 중립(손가락 위)에서 얼마나 비틀었나
 *  - 줌 의도  : **손 벌린 정도(절대값, 스케일 불변)**. 오므림=줌인 / 활짝=줌아웃 /
 *               가운데(중립 데드존)=정지. 속도기반이 아니라 절대자세라 버벅임이 적다.
 *  - 둘 중 더 강한 쪽만 채택, 히스테리시스로 깜빡임 방지
 *
 * 출력 zoomRate는 **정규화된 rate(-1..+1)**: 음수=줌인(가까이), 양수=줌아웃(멀리).
 * 화면(surface)마다 자기 단위로 스케일해서 쓴다(지도=줌레벨, VISION=카메라거리).
 */
import type { HandFrame } from "@/hooks/useHandTracking";

// ── 회전 감도 (VISION 원본 값) ──────────────────────────────────
export const ROT_NORM = 0.6; // 이 정도 비틀면 회전 강도 ~1 (약 50°)
export const MODE_HYST = 1.15; // 회전/줌 전환 히스테리시스
export const SPIN_DEAD = 0.28; // 브레이크 중립 구간(라디안, ±약 16°)
export const SPIN_GAIN = 0.06; // 기울인 각도 → 회전 속도 비례
export const SPIN_MAX = 0.09; // 최대 회전 속도(라디안/프레임)
export const ROLL_NEUTRAL = -Math.PI / 2; // 손 똑바로(손가락 위) = 중립

// ── 줌 감도 (openness 기반) ─────────────────────────────────────
// openness = 엄지끝~검지끝 거리 ÷ 손 크기(손목~중지뿌리). 스케일 불변 비율.
export const OPEN_ZOOMIN = 0.45; // 이 아래로 오므리면 줌인 시작
export const OPEN_ZOOMOUT = 0.8; // 이 위로 펼치면 줌아웃 시작 (사이=중립 데드존)
export const OPEN_IN_NORM = 0.4; // 줌인 강도 정규화 폭
export const OPEN_OUT_NORM = 0.5; // 줌아웃 강도 정규화 폭
export const ZOOM_SMOOTH = 0.18; // 저역통과 계수(작을수록 부드럽고 느림)

export type GestureMode = "rot" | "zoom" | null;

export interface GestureOutput {
  detected: boolean;
  mode: GestureMode;
  /** 회전 속도(라디안/프레임). null=손 없음, 0=정지. */
  spin: number | null;
  /** 줌 rate(-1..+1): 음수=줌인, 양수=줌아웃. surface가 자기 gain으로 스케일. */
  zoomRate: number;
  /** 손 벌린 정도(0=완전 오므림 ~ 1+=활짝). 디버그/표시용. */
  openness: number;
  /** 원시 핀치값(엄지끝~검지끝, 정규화). 노드 클릭 판정 등에 그대로 쓴다. */
  pinch: number;
  /** 포인터 위치 (거울모드 보정된 0..1). 손 없으면 null. */
  pointer: { x: number; y: number } | null;
}

const IDLE: GestureOutput = {
  detected: false,
  mode: null,
  spin: null,
  zoomRate: 0,
  openness: 0.65,
  pinch: 1,
  pointer: null,
};

export interface ReadOptions {
  /** true면 회전·줌을 억제한다 (예: 노드 위에 손이 올라가 선택 중). */
  suppress?: boolean;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 프레임 간 상태(모드·smoothing)를 들고 있는 판정기를 만든다.
 * 화면마다 하나씩 생성해 쓴다.
 */
export function createGestureReader() {
  let mode: GestureMode = null;
  let zoomSmoothed = 0;

  return {
    read(frame: HandFrame, opts: ReadOptions = {}): GestureOutput {
      if (!frame.detected) {
        mode = null;
        zoomSmoothed = 0;
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

      // --- 줌 의도: 손 벌린 정도(절대, 스케일 불변) ---
      // openness = 핀치거리 ÷ 손크기(손목~중지뿌리). 손이 카메라와 가깝든 멀든 일정.
      const handSize = w && m ? dist(w, m) : 0;
      const openness = handSize > 1e-4 ? frame.pinch / handSize : 0.65;
      let zoomTarget = 0; // 음수=줌인, 양수=줌아웃
      let zoomStrength = 0;
      if (openness < OPEN_ZOOMIN) {
        zoomTarget = -Math.min(1, (OPEN_ZOOMIN - openness) / OPEN_IN_NORM);
        zoomStrength = Math.abs(zoomTarget);
      } else if (openness > OPEN_ZOOMOUT) {
        zoomTarget = Math.min(1, (openness - OPEN_ZOOMOUT) / OPEN_OUT_NORM);
        zoomStrength = Math.abs(zoomTarget);
      } // 사이(데드존) → 0

      // --- 더 강한 동작만 채택 (히스테리시스) ---
      if (opts.suppress) {
        mode = null;
      } else if (rotStrength > zoomStrength * MODE_HYST) {
        mode = "rot";
      } else if (zoomStrength > rotStrength * MODE_HYST) {
        mode = "zoom";
      } // 둘 다 비슷하면 직전 모드 유지

      // 줌은 저역통과로 부드럽게 (버벅임 방지). 줌 모드 아닐 땐 0으로 감쇠.
      const zTarget = mode === "zoom" ? zoomTarget : 0;
      zoomSmoothed += (zTarget - zoomSmoothed) * ZOOM_SMOOTH;
      if (Math.abs(zoomSmoothed) < 0.002) zoomSmoothed = 0;

      return {
        detected: true,
        mode,
        spin: mode === "rot" ? spinTarget : 0,
        zoomRate: zoomSmoothed,
        openness,
        pinch: frame.pinch,
        pointer,
      };
    },
  };
}
