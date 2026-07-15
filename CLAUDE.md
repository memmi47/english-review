# English Review — 프로젝트 가이드

개인용 영어 회화 복습 PWA. 비개발자(45세 이상, 한국어 화자)가 사용하므로 설명은 항상 쉬운 한국어로.

## ⚠️ 검증된 규격 파일 (임의 수정 금지)

`src/db/` 아래 다음 7개 파일은 사용자가 이미 검증한 데이터 규격입니다. **타입과 로직을 임의로 바꾸지 마세요.**
사용자가 명시적으로 승인한 경우에만(예: `note` 필드 추가 건) 수정하고, 그 외에는 새 파일을 추가하는 방식으로 기능을 확장합니다.

- `schema.ts`, `parser.ts`, `ingest.ts`, `analytics.ts`, `srs.ts`, `backup.ts`, `index.ts`

그 외 `src/db/study.ts`, `src/db/drills.ts`, `src/db/streak.ts`는 이후 추가된 보조 모듈이며 자유롭게 수정 가능합니다. 이 모듈들은 각각 별도의 Dexie(IndexedDB) 데이터베이스를 쓰기 때문에, 검증된 규격 DB(`EnglishReviewDB`)를 절대 건드리지 않습니다.

| DB | 용도 | 담당 파일 |
|---|---|---|
| `EnglishReviewDB` | 세션/phrase/vocab/correction/rewrite 등 원본 데이터 | schema.ts (검증됨) |
| `EnglishReviewStudyMarksDB` | 원본 correction/rewrite의 SRS 진행 상태 | study.ts |
| `EnglishReviewDrillsDB` | 정제된 문제은행 + SRS 진행 상태 | drills.ts |
| `EnglishReviewTtsCacheDB` | 신경망 TTS 오디오 캐시 | tts.ts |

## 문제은행(Drill Bank) 시스템

초기 버전은 코치 리포트의 correction/rewrite를 그대로 카드로 만들어 복습시켰는데, 고유명사·STT 오염·화석화 패턴 낭비 문제가 있었다. 문제은행은 이를 해결하기 위해 **Claude가 백업 데이터를 정제해서 만드는** 별도 문제 세트다. 앱은 문제은행이 있으면 원본 재작성(LegacyPractice) 대신 문제은행만 보여준다(`PracticeScreen.tsx`) — 정제된 문제와 미정제 원본이 섞여 보이면 정제 작업의 의미가 없기 때문.

사용자가 백업 JSON을 주며 문제은행을 만들거나 갱신해달라고 하면 **`drill-bank-curation` 스킬**을 사용할 것 (`.claude/skills/drill-bank-curation/SKILL.md`) — JSON 스키마, 검증 규칙, 정제 절차 6단계가 모두 그 안에 있음. 이 문서(CLAUDE.md)엔 자세한 절차를 반복해서 적지 않는다 — 매 대화마다 항상 로드되는 파일이라 문제은행 정제처럼 가끔 하는 작업의 세부 절차까지 넣으면 무관한 작업에서도 불필요하게 커진다.

## TTS (발음 듣기)

- `src/shared/tts.ts` — OpenRouter `/api/v1/audio/speech` (`openai/gpt-4o-mini-tts` 계열) 연동. OpenRouter가 날짜 붙은 모델 슬러그를 종종 만료시켜 "model does not exist"로 실패하는 일이 있어서, `TTS_MODEL_CANDIDATES` 후보를 순서대로 시도해 성공하는 슬러그를 그 세션 동안 기억해 쓴다. 문장별 오디오는 IndexedDB에 캐싱되어 재과금 없음
- API 키 우선순위: 설정 화면에서 직접 입력한 키(`localStorage`) > 빌드 시 주입된 키(`VITE_OPENROUTER_API_KEY` 환경변수)
- 저장소가 공개이므로 **키를 소스 코드에 절대 하드코딩하지 않음**. 내장하려면 Vercel 대시보드 → Settings → Environment Variables에 `VITE_OPENROUTER_API_KEY`를 등록하고 재배포
- 키가 없거나 요청 실패 시 브라우저 기본 `SpeechSynthesis`로 자동 폴백
- 현재 UI(`ImportScreen.tsx`의 `TtsSettingsCard`)는 목소리 선택만 노출 — 내장 키가 항상 있다는 전제이므로 API 키 입력/테스트/캐시 관리 UI는 의도적으로 뺐음. 다시 필요해지면 `tts.ts`에 `testNeuralTts`/`ttsCacheStats`/`clearTtsCache`/`getManualTtsApiKey` 함수가 이미 있으니 재사용

## 작업 방식

- 이 저장소는 개인 프로젝트로, **별도 feature 브랜치·PR 없이 `main`에 직접 커밋·푸시**합니다 (2026-07-14부터 사용자 요청).
- 커밋 전 `npx tsc --noEmit && npm run build && npm run lint`로 검증. `parser.ts`(any 10건)와 `streak.ts`(prefer-const 1건)의 기존 lint 오류는 검증된 규격 파일이라 남겨둠 — 신규 오류만 없으면 됨.
