# O.M.N.I. — 아이언맨 스타일 AI 데스크톱 비서

> Omnipresent Networked Machine Intelligence

파란 네온 홀로그램 HUD를 갖춘 음성 AI 비서. 웨이크워드 “옴니”로 호출하고,
음성·텍스트로 명령하면 중앙 코어 주변에 우선순위 기반 API 화면(패널)이 떠오릅니다.

## 역할 분리 (중요)

- **껍데기(Shell) = 이 프로젝트**: HUD UI · 음성/텍스트 입력 · API 패널 출력
- **AI 두뇌 = 기존 소스 사용**: `lib/aiClient.ts` 의 `askAI()` 한 곳에서만 연결.
  UI는 AI가 무엇이든 신경 쓰지 않습니다. 기존 AI 주소만 꽂으면 끝.

## 기술 스택
- Next.js 14 (App Router) · React 18 · TypeScript
- Tailwind CSS · Framer Motion
- (선택) OpenAI 대화, ElevenLabs TTS — 미설정 시 브라우저 내장 API로 폴백
- Web Speech API (웨이크워드 + 음성 인식)

## 기능
- ✅ 웨이크워드 “옴니” 인식 (옴니/오므니/omni 변형 포함)
- ✅ 음성 대화 (메인) + 텍스트 입력 (보조 폴백)
- ✅ 실시간 원형 음성 파형
- ✅ 중앙 원형 HUD + 회전 링 + 아크 리액터 코어
- ✅ 우선순위 기반 API 패널 출력 — 패널이 뜨면 코어 축소, 닫으면 확대
- ✅ 코어 배경 이미지 교체 슬롯 (`lib/coreConfig.ts`)
- ✅ AI 어댑터로 두뇌 분리 — 응답에 `panel`을 담으면 화면 자동 출력
- ✅ 상태 표시: STANDBY / LISTENING / THINKING / RESPONDING
- ✅ 채팅 로그 저장 (localStorage) · 다크모드 · 반응형

## 실행 방법

```bash
cd jarvis
npm install
cp .env.local.example .env.local   # 키/AI 주소 입력 (선택). 없어도 동작.
npm run dev
```

http://localhost:3000 → 코어 클릭(ON) → 마이크 허용 → “옴니, 오늘 날씨 알려줘”.
음성이 안 되면 우측 보조 입력창으로 명령.

> 음성 인식은 **Chrome / Edge**, localhost 또는 HTTPS 환경에서 동작합니다.

## 환경 변수
| 변수 | 용도 | 없을 때 |
|------|------|---------|
| `NEXT_PUBLIC_AI_ENDPOINT` | 기존 AI 소스 주소 | 내장 `/api/chat` 사용 |
| `OPENAI_API_KEY` | 내장 두뇌(OpenAI) | 에코 스텁 응답 |
| `ELEVENLABS_API_KEY` | 고품질 음성 | 브라우저 SpeechSynthesis |
| `ELEVENLABS_VOICE_ID` | 음성 선택 | 기본 voice |

## 코어 배경 바꾸기
`lib/coreConfig.ts` 에서:
```ts
export const CORE_BACKGROUND = "/my-image.png"; // public/ 경로 또는 외부 URL
export const CORE_TINT = 0.45;                   // 네온 틴트 강도
```

## 폴더 구조
```
jarvis/
├─ preview.html             # Node 없이 더블클릭으로 보는 껍데기 미리보기
├─ app/
│  ├─ api/chat/route.ts     # 내장 AI(OpenAI) — 외부 소스 쓰면 불필요
│  ├─ api/tts/route.ts      # ElevenLabs TTS 프록시
│  ├─ globals.css · layout.tsx · page.tsx
├─ components/
│  ├─ OmniHUD.tsx           # 중앙 코어 (링+파형+토글, compact 크기)
│  ├─ HudRings.tsx          # 회전 홀로그램 링 (SVG)
│  ├─ Waveform.tsx          # 원형 음성 파형 (canvas)
│  ├─ HudPanel.tsx          # API 패널 (홀로그램 카드)
│  ├─ StatusIndicator.tsx · ChatLog.tsx
├─ hooks/
│  ├─ useOmni.ts            # 상태머신 (웨이크워드→STT→askAI→TTS)
│  ├─ usePanels.ts          # 우선순위 패널 관리
│  ├─ useSpeechRecognition.ts · useAudioLevel.ts
└─ lib/
   ├─ aiClient.ts           # ★ AI 어댑터 (기존 소스 연결 지점)
   ├─ coreConfig.ts         # ★ 코어 배경/크기 설정
   ├─ speak.ts · types.ts
```

## 다음 단계
- 패널 위젯 타입 확장(차트·게이지·지도)
- 음성 명령으로 패널 자동 호출 (“옴니, 날씨 띄워줘”)
- OpenAI Realtime API(WebRTC) 저지연 음성 / Electron 데스크톱 패키징
