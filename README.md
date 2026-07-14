# English Review (영어 회화 복습 앱)

매일 15분 영어 회화 챗봇(Claude/Gemini)과 대화한 뒤, 피드백을 JSON으로 받아 체계적으로 복습할 수 있게 도와주는 오프라인 우선(Offline-First) 개인용 웹 애플리케이션입니다. C1-C2 레벨 학습자를 타겟으로, 원어민스러운 뉘앙스와 어휘, 약점 태깅을 정교하게 관리합니다.

## ✨ 주요 기능

- **📊 고급 분석 대시보드 (Analytics)**: 약점 태그 비율, 새 추천 표현(Phrase) 사용률, 숙련도(SRS Box) 분포 등을 SVG 차트와 함께 직관적으로 파악할 수 있습니다.
- **🔥 연속 스트릭 & 히트맵 (Streak)**: 매일 학습 여부를 체크하고 GitHub 스타일의 70일 잔디 히트맵으로 학습 의욕을 고취시킵니다.
- **💬 맥락 기반 연습 모드 (Practice)**: 틀렸던 영어를 맹목적으로 외우는 대신, **"내가 원래 하려고 했던 한국어 의도"**를 메인 프롬프트로 띄워 영작/교정 훈련을 수행합니다.
- **🌙 다크모드 지원**: CSS 변수를 기반으로 완벽한 라이트/다크모드를 지원합니다.
- **📦 100% 로컬 데이터베이스 (Dexie.js)**: 서버나 외부 API 없이 기기의 IndexedDB에 데이터를 안전하게 저장합니다. 백업/가져오기 기능을 통해 기기 간 데이터 이동이 가능합니다.

## 🚀 빠른 시작

```bash
# 의존성 설치
npm install

# 로컬 개발 서버 실행
npm run dev
```

## 📝 챗봇에게 리포트 받기 (Prompt v3)

과거 마크다운 기반의 잦은 파싱 에러를 해결하기 위해 완전한 JSON 포맷을 사용합니다. 
`data/영어학습리뷰_피드백규격서_v3.md` 파일의 내용 전체를 복사해서 Claude나 Gemini에게 프롬프트로 주면, 에러 없이 앱에 1초 만에 붙여넣을 수 있는 ````json ```` 코드 블록을 제공합니다.

앱의 **입력(Import)** 탭에서 해당 JSON 블록을 그대로 붙여넣고 저장하세요.

## 🔄 구버전 데이터 마이그레이션 (한국어 문맥 채우기)

기존 v1/v2 포맷으로 저장해 둔 백업 파일에 한국어 의도(`intended_meaning`)를 일괄 생성하여 v3 규격으로 업그레이드할 수 있습니다.

**1단계: 프롬프트 생성**
```bash
node scripts/extract_for_llm.mjs
```
실행 후 생성되는 `data/prompt_for_llm.txt`의 내용을 Claude나 Gemini에 붙여넣습니다.

**2단계: JSON 저장**
LLM이 반환한 JSON 텍스트를 `data/llm_result.json` 이름으로 저장합니다.

**3단계: 백업 파일 병합**
```bash
node scripts/apply_llm_json.mjs
```
실행 후 `data/english-review-backup-enriched.json`이 생성되면, 앱의 **[백업 가져오기] (전체 교체)** 메뉴를 통해 로드하시면 과거 데이터로도 맥락 기반 연습(Practice)이 가능합니다.

## 🛠 기술 스택

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Vanilla CSS (CSS Variables for Theming & Dark Mode)
- **Database**: Dexie.js (IndexedDB wrapper)
- **Charts**: Custom SVG React Components (No external heavy charting libraries)
