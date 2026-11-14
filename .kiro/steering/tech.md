---
inclusion: always
---
# 기술 스택과 제약

- 언어: 순수 JavaScript(ES Modules), HTML, CSS. 빌드 도구·프레임워크·npm 의존성 없음.
- 실행: GitHub Pages(정적 호스팅) 또는 `npm start` (scripts/serve.js, 127.0.0.1:5173).
- 테스트: Node 18+ 내장 러너 `node --test` (`npm test`), 단언은 `node:assert/strict`.
- 화면 검증: headless Edge 스크린샷. `?sample=N&intent=accept&note=...` 쿼리로 화면 상태를 재현한다.

## 반드시 지킬 것
- `src/engine/`은 순수 함수만 둔다. DOM·Node API·네트워크 금지. 브라우저와 Node 양쪽에서 import 되어야 한다.
- 결정론: "오늘"이 필요한 함수는 `today`(Date)를 인자로 받는다. 테스트 기준일은 2026-11-14(토).
- 날짜 문자열은 로컬 `YYYY-MM-DD`, 시간은 `HH:MM`, 시간대는 Asia/Seoul 기준.
- 개인정보: 메일 원문은 브라우저 밖으로 나가지 않는다. fetch·XHR·외부 스크립트·웹폰트·CDN 금지.
- 보안: 사용자·메일 텍스트는 `textContent`/`createElement`로만 화면에 넣는다(`innerHTML` 금지).
  외부 링크는 `target="_blank" rel="noopener noreferrer"`.
- 비밀정보: API 키·비밀번호·`.env`를 커밋하지 않는다. `npm run check:secrets`로 확인한다.

## 명령
| 목적 | 명령 |
|---|---|
| 테스트 | `npm test` |
| 로컬 실행 | `npm start` → http://127.0.0.1:5173 |
| 비밀정보 검사 | `npm run check:secrets` |
