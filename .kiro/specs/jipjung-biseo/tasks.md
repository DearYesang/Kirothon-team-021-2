# Implementation Plan

작업은 서로 의존하지 않는 묶음으로 나눠 Kiro 서브에이전트 3개(엔진·화면·문서)가 동시에 진행했다.
계약(API 형태)은 design.md의 Data Models를 먼저 고정하고 그 계약에 맞춰 각자 구현했다.

- [x] 1. 프로젝트 기반 만들기
  - [x] 1.1 steering 4개 작성: product.md, tech.md, structure.md, tone-guide.md
  - [x] 1.2 spec 작성: requirements.md → design.md → tasks.md
  - [x] 1.3 package.json(`npm test`, `npm start`, `npm run check:secrets`)과 scripts/serve.js(127.0.0.1 정적 서버)
  - _Requirements: 6.1, 6.2_

- [x] 2. 메일 해석 엔진 (Wave 1, 엔진 에이전트)
  - [x] 2.1 headers.js: 보낸사람·받는사람·제목 줄 파싱, 받는 주소로 메일함 감지
    - _Requirements: 1.3_
  - [x] 2.2 text.js + analyze.js: 문장 분리, 요약 3문장, 요청 문장 추출, 빈 입력 처리
    - _Requirements: 1.1, 1.2, 1.4_
  - [x] 2.3 relation.js + tone.js: 관계 8종 판별, tone-guide.md 기준 말투·규칙·이유
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 2.4 dates.js: 절대·상대 날짜, 요일, 오전/오후 시간, 마감·약속 구분
    - _Requirements: 5.1_
  - [x] 2.5 focus.js: 집중력 점수·등급·처리 시점·이유, 오늘/내일 마감 시 '지금'
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 2.6 schedule.js: 일정 메모 해석, 바쁜 시간을 피한 후보 3개
    - _Requirements: 5.2, 5.3_

- [x] 3. 답장 자동완성 엔진 (Wave 1, 엔진 에이전트)
  - [x] 3.1 drafts.js: 의도 5종 × 초안 3종(정중·표준·간결), 교수님께는 소속·이름 + '올림'
    - _Requirements: 4.1, 4.2, 4.4_
  - [x] 3.2 polishNote: "목 안됨 금 3시 가능" 같은 메모를 말투에 맞는 문장으로
    - _Requirements: 4.3_
  - [x] 3.3 calendar.js: 구글 캘린더 일정 만들기 URL, RFC 5545 .ics
    - _Requirements: 5.4_

- [x] 4. 화면 (Wave 1, 화면 에이전트 — 계약에 맞춰 엔진과 동시에 구현)
  - [x] 4.1 index.html + styles.css: 2단 반응형, 카드 ①~⑤, 접근성(label, focus ring, aria-live)
  - [x] 4.2 app.js: 분석 → 렌더링, 의도·메모 변경 시 초안 갱신, 복사(대체 경로 포함)
    - _Requirements: 4.5, 6.3_
  - [x] 4.3 내 정보·일정 메모·오늘 아낀 결정 수를 localStorage에 저장
    - _Requirements: 5.3_
  - [x] 4.4 샘플 메일 4통(Gmail·네이버메일·네이버웍스·Outlook)과 `?sample=N&intent=&note=` 데모 쿼리
    - _Requirements: 6.2_

- [x] 5. 검증 (Wave 2)
  - [x] 5.1 node:test 단위 테스트 + 샘플 4통 시나리오 테스트 통과
  - [x] 5.2 headless Edge 스크린샷으로 화면 렌더링 확인 (docs/*.png)
  - [x] 5.3 비밀정보 검사 스크립트(scripts/check-secrets.js) + Stop 훅
    - _Requirements: 6.4_

- [x] 6. 제출 (Wave 3)
  - [x] 6.1 README 전 섹션, BUILD_REPORT, PRESENTATION.pdf
  - [x] 6.2 GitHub Pages 배포 후 Demo 줄에 주소 기록
  - [x] 6.3 작업 브랜치(dev) → PR → main 머지
