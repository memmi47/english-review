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

### 왜 필요한가
초기 버전은 코치 리포트의 correction/rewrite를 그대로 카드로 만들어 복습시켰는데, 두 가지 문제가 있었습니다:
1. **기억력 테스트가 됨**: 문장에 고유명사·특정 세션 맥락이 섞여 있어 "그날 무슨 얘기했는지" 기억해야 풀 수 있었음 (실력 테스트가 아님)
2. **STT 오염**: 음성 인식 오류가 원문에 그대로 남아("study hunter" 등) 사용자가 실제 하지 않은 말을 교정하는 꼴이 됨
3. **화석화 패턴 낭비**: 같은 문법 오류(예: 사역동사 have + to부정사)가 여러 번 나와도 각각 다른 통문장으로 취급되어, 패턴 자체를 학습할 기회가 없었음

문제은행은 이 문제를 해결하기 위해 **Claude가 백업 데이터를 정제해서 만드는** 별도 문제 세트입니다. 앱은 문제은행이 있으면 원본 재작성(LegacyPractice) 대신 문제은행만 보여줍니다(`PracticeScreen.tsx`) — 정제된 문제와 미정제 원본이 섞여 보이면 정제 작업의 의미가 없기 때문입니다.

### 문제은행 JSON 스키마 (`src/db/drills.ts` 참고)

```json
{
  "drill_bank_version": 1,
  "exported_at": "2026-07-14",
  "source": "생성 근거 요약(선택)",
  "drills": [
    {
      "id": "choice:고유id",
      "type": "choice | pattern | produce",
      "tag": "verbal-noun | articles | preposition | ... (오류 태그)",
      "severity": "화석화 | 반복 | 일회성 | null",
      "group_id": "set:패턴세트이름 (패턴 드릴을 묶어 연속 출제할 때만, 아니면 null)",
      "question": "빈칸 문장 또는 한국어 프롬프트",
      "hint": "제출 전 볼 수 있는 힌트 (선택, 빈 문자열 가능)",
      "choices": ["보기1", "보기2", "보기3"],
      "answer": "정답",
      "accept": ["추가로 인정할 답안(선택)"],
      "explain": "채점 후 보여줄 한국어 해설"
    }
  ]
}
```

**검증 규칙** (`importDrillBank`가 강제):
- `id`는 파일 전체에서 고유해야 함
- `type`은 choice/pattern/produce 중 하나
- `choice` 타입: `choices` 2개 이상, `answer`가 반드시 `choices` 안에 포함
- `choice`/`pattern` 타입: `question`에 `_____` (밑줄 5개)가 반드시 포함
- `produce` 타입: 빈칸 없이 한국어 의도를 자연스러운 문장으로 제시 (예: "이 말을 영어로 해보세요: ...")

같은 `id`로 다시 가져오면 문제 내용만 갱신되고 SRS 진행 상태(box/날짜/횟수)는 보존됩니다.

### 정제(curation) 절차 — 새 대화방에서도 이 순서를 따르면 됩니다

사용자가 백업 JSON(`영어복습백업...json`, 앱의 [입력] 탭 → 백업 내보내기로 생성)을 주면:

1. **중복 제거**: `corrections[].original`, `rewrites[].user_expr`를 대소문자/구두점 무시하고 정규화해 비교, 첫 등장만 유지
2. **STT 오염 복원**: `transcription_suspects` 배열을 참고해 `original`/`corrected` 안에 남은 오인식 단어를 실제 의도한 단어로 교체 (예: "hunter" → "hanja")
3. **고유명사 일반화**: 특정 세션에만 등장하는 고유명사(선수 이름, 특정 회사 프로젝트명, 특정 날짜 등)는 일반화하거나 제거. 단, 사용자가 실제로 반복해서 쓰는 맥락(예: 본인이 다니는 회사명)은 남겨도 됨 — 실사용 어휘이기 때문
4. **3가지 문제 유형으로 변환**:
   - **choice**: 교정 하나에서 핵심 문법 포인트 하나만 빈칸으로 만들고, 원래 사용자가 썼던 틀린 형태를 오답 보기로 포함 (문법 지식을 직접 테스트)
   - **pattern**: 같은 화석화 패턴(예: `succeed to` vs `succeed in -ing`)을 **완전히 새로운 문장/맥락**으로 3~5개 만들어 `group_id`로 묶음 — 그날 대화를 기억 못 해도 풀 수 있어야 진짜 실력 테스트임. 절대 사용자가 실제로 말했던 문장을 그대로 빈칸화하지 말 것 (기억력 테스트가 됨). **단, 빈칸이 문법 형태가 아니라 내용어(동사/명사 등)를 요구할 때는 `question` 끝에 반드시 `(원형)` 힌트를 붙일 것** — 예: `"She succeeded _____ the final interview. (pass)"`. 새 맥락 문장이라 사용자가 어떤 단어를 활용해야 할지 전혀 알 수 없기 때문(문법 형태만 맞히는 게 아니라 무슨 단어인지도 맞혀야 하는 이중 테스트가 되면 안 됨). 전치사/관사/시제어미처럼 문장 안에서 이미 뜻이 다 드러나는 기능어 빈칸(예: preposition, articles)은 이 힌트가 필요 없음. `PracticeScreen.tsx`가 이 괄호를 자동으로 감지해 별도 힌트 배지로 분리해서 보여주고, 정답 후 발음 듣기 문장에서는 제외함(`splitWordHint`)
   - **produce**: rewrite의 `native_version`을 답으로, `intended_meaning`(한국어)을 질문으로 재구성. 코치가 두 가지 표현을 줬으면 `accept`에 둘 다 포함
5. **우선순위 부여**: `severity` 필드를 그대로 반영 — 화석화가 가장 먼저, 그다음 반복, 일회성 순으로 앱이 자동 정렬함 (`dueDrills()` 로직, 직접 정렬할 필요 없음)
6. **검증 후 전달**: 위 스키마 규칙에 맞는지 확인(Python 스크립트로 조립 후 검증하는 방식 추천 — `id` 중복, `choices`에 `answer` 포함 여부, `_____` 포함 여부)

완성된 JSON은 채팅으로 사용자에게 파일로 전달하고, 사용자가 앱의 [입력] 탭 → **문제은행 가져오기**에서 업로드합니다.

**개인정보 주의**: 백업 원본과 생성된 문제은행 파일에는 사용자의 실제 발화·회사명·가족 관련 내용이 담겨 있을 수 있습니다. 이 저장소는 **공개(public) 저장소**이므로, 백업 데이터나 생성된 문제은행 파일을 절대 커밋하지 마세요 — 항상 사용자에게 직접 파일로 전달만 합니다.

## TTS (발음 듣기)

- `src/shared/tts.ts` — OpenRouter `/api/v1/audio/speech` (`openai/gpt-4o-mini-tts`) 연동, 문장별 오디오는 IndexedDB에 캐싱되어 재과금 없음
- API 키 우선순위: 설정 화면에서 직접 입력한 키(`localStorage`) > 빌드 시 주입된 키(`VITE_OPENROUTER_API_KEY` 환경변수)
- 저장소가 공개이므로 **키를 소스 코드에 절대 하드코딩하지 않음**. 내장하려면 Vercel 대시보드 → Settings → Environment Variables에 `VITE_OPENROUTER_API_KEY`를 등록하고 재배포
- 키가 없거나 요청 실패 시 브라우저 기본 `SpeechSynthesis`로 자동 폴백
- 현재 UI(`ImportScreen.tsx`의 `TtsSettingsCard`)는 목소리 선택만 노출 — 내장 키가 항상 있다는 전제이므로 API 키 입력/테스트/캐시 관리 UI는 의도적으로 뺐음. 다시 필요해지면 `tts.ts`에 `testNeuralTts`/`ttsCacheStats`/`clearTtsCache`/`getManualTtsApiKey` 함수가 이미 있으니 재사용

## 작업 방식

- 이 저장소는 개인 프로젝트로, **별도 feature 브랜치·PR 없이 `main`에 직접 커밋·푸시**합니다 (2026-07-14부터 사용자 요청).
- 커밋 전 `npx tsc --noEmit && npm run build && npm run lint`로 검증. `parser.ts`(any 10건)와 `streak.ts`(prefer-const 1건)의 기존 lint 오류는 검증된 규격 파일이라 남겨둠 — 신규 오류만 없으면 됨.
