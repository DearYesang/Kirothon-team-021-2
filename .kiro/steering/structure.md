---
inclusion: always
---
# 프로젝트 구조

```
index.html                화면 진입점 (GitHub Pages 루트)
src/app.js                화면 로직: 입력 → analyzeEmail → 카드 ①~⑤ 렌더링
src/styles.css            화면 스타일 (2단 반응형)
src/samples.js            샘플 메일 4통 (Gmail·네이버메일·네이버웍스·Outlook)
src/engine/index.js       엔진 공개 API. 화면은 여기만 import 한다
src/engine/headers.js     보낸사람·받는사람·제목 줄 파싱, 메일함 감지
src/engine/text.js        문장 분리·정규화, 요약·요청 문장 추출 보조
src/engine/relation.js    상대와의 관계 판별
src/engine/tone.js        관계·상황별 톤앤매너 추천 (tone-guide.md 기준)
src/engine/dates.js       한국어 날짜·시간·마감 표현 추출
src/engine/focus.js       집중력 비용·처리 시점 계산
src/engine/schedule.js    내 일정 메모 해석, 가능한 시간 제안
src/engine/drafts.js      답장 초안 3종, 핵심 메모 다듬기(polishNote)
src/engine/calendar.js    구글 캘린더 링크, .ics 생성
src/engine/analyze.js     위 모듈을 묶는 analyzeEmail()
tests/                    node:test 단위·시나리오 테스트
scripts/serve.js          의존성 없는 로컬 정적 서버
scripts/check-secrets.js  커밋 전 비밀정보 검사
presentation/slides.html  발표 자료 원본 → PRESENTATION.pdf
docs/                     화면 스크린샷
.kiro/                    steering · specs · hooks
```

## 규칙
- 의존 방향: `app.js` → `engine/index.js` → `engine/*.js`. 엔진은 화면을 모른다.
- 파일 하나에 책임 하나. 공개 함수에는 JSDoc을 단다.
- 엔진 기능을 바꾸면 `tests/`에 테스트를 함께 추가한다 (훅이 저장할 때 자동 실행).
- 화면 문구는 한국어, 코드 식별자와 주석은 영어.
