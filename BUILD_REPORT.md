# BUILD REPORT

집중비서는 Kiro로 **Steering(규칙) → Spec(요구사항·설계·작업) → 서브에이전트 병렬 구현 → Hooks·테스트로 검증** 순서로 만들었습니다. 1인 팀이 개발 2부(14:00~18:00) 안에 끝내기 위해, 사람은 결정과 검토를 맡고 반복 작업은 Kiro에 맡겼습니다.

## Kiro 활용 내역

| 단계 | 사용한 Kiro 기능 | 무엇을 했는지 | 결과물 위치 |
|---|---|---|---|
| 기획 | Kiro 채팅 (아이디어 구체화) | "이메일 답장 톤앤매너 + 일정 조언, 시간보다 집중력을 아낀다"는 아이디어를 '집중력을 빼앗는 4가지(끼어들기·작은 결정·마음 부담·머릿속에 남는 일) → 기능 ①~⑤'로 구체화하고 화면 시안을 먼저 그려 범위를 합의 | `.kiro/steering/product.md` |
| 기획 | Steering (product, `inclusion: always`) | 대상 사용자, 핵심 가치, MVP 범위, 하지 않는 것(대신 발송 안 함, 원문 외부 전송 안 함), 로드맵을 고정해 모든 작업의 기준으로 삼음 | `.kiro/steering/product.md` |
| 기획 | Spec (requirements) | 요구사항 6개를 사용자 스토리와 EARS 형식 인수 조건(WHEN … THEN … SHALL) 24개로 작성 | `.kiro/specs/jipjung-biseo/requirements.md` |
| 기획 | 웹 검색·웹 페이지 읽기 | 해커톤 규칙(Notion), 템플릿 레포, 근거 자료 조사: 하루 메일 117통, 평균 2분마다 끊김, 집중 시간 부족 68%, 끊긴 일로 돌아오기 23분 15초, 업무 시간의 28%가 메일. 확인 못 한 숫자 2개는 뺌 | `README.md` '근거' |
| 설계 | Spec (design) | 엔진 API 계약(`analyzeEmail`, `buildDrafts`, `polishNote`, `suggestSlots`, `googleCalendarUrl`, `buildIcs` 등)과 `Analysis`·`Draft` 타입, Mermaid 구조도·시퀀스 다이어그램, 오류 처리, 테스트 전략 | `.kiro/specs/jipjung-biseo/design.md` |
| 설계 | Steering (tech, structure, `inclusion: always`) | 바닐라 JS ES 모듈, 빌드·npm 의존성·네트워크 호출 없음, 엔진은 순수 함수('오늘'을 인자로 받음), textContent만 사용, 파일별 책임과 의존 방향 | `.kiro/steering/tech.md`, `.kiro/steering/structure.md` |
| 설계 | Steering (tone-guide, `inclusion: fileMatch`) | 관계별 말투 표(교수님·상사·채용 담당자·고객·선배·동료·친구), 첫 줄·맺음말 예시, 거절·일정 제안 공통 규칙. `tone.js`·`relation.js`·`drafts.js`·테스트를 다룰 때만 자동으로 포함되고, `#[[file:src/engine/tone.js]]`로 실제 코드를 함께 불러옴 | `.kiro/steering/tone-guide.md` |
| 구현 | Spec (tasks) | 설계를 6개 작업 묶음, 22개 하위 작업으로 나누고 요구사항 번호를 연결. 서로 의존하지 않는 작업을 Wave 1로 묶어 동시에 진행 | `.kiro/specs/jipjung-biseo/tasks.md` |
| 구현 | Kiro 서브에이전트 3개 병렬 구현 | 엔진 에이전트(관계·톤·날짜·집중력·일정·초안·캘린더 11개 모듈 + 테스트 16개), 화면 에이전트(카드 ①~⑤, 샘플 메일 4종, 복사·저장), 문서 에이전트(근거 조사, README·BUILD_REPORT 초안, 발표 자료)가 파일 담당을 나눠 약 15분 동안 동시에 작업. 합칠 때 파일 충돌 0건 | `src/engine/`, `tests/`, `index.html`, `src/app.js`, `presentation/slides.html` |
| 검증 | node:test 단위·시나리오 테스트 | 모듈 단위 10개 + 샘플 메일 4종 시나리오 6개, 16개 모두 통과. 기준일 2026-11-14로 고정해 결정론적으로 검증 | `tests/modules.test.js`, `tests/samples.test.js` |
| 검증 | Hooks: 엔진 저장 시 테스트 (`PostFileSave` → command) | `src/engine/` 또는 `tests/`의 JS 파일을 저장하면 `npm test`가 자동 실행되어, 말투 규칙을 고치다 다른 샘플이 깨지는지 바로 확인 | `.kiro/hooks/engine-test-on-save.json` |
| 검증 | headless Edge 스크린샷 | `?sample=N&intent=…&note=…` 쿼리로 화면 상태를 재현해 캡처하고, 결과 카드가 실제로 그려졌는지 이미지로 확인 | `docs/screenshot*.png` |
| 기타 | Hooks: 비밀정보 검사 (`Stop` → command) | 에이전트가 응답을 마칠 때마다 `scripts/check-secrets.js`가 API 키·토큰·개인 키·.env를 검사. 공개 레포 규칙을 지키기 위한 장치 | `.kiro/hooks/secret-guard.json`, `scripts/check-secrets.js` |
| 기타 | Hooks: README 기능표 동기화 (`PostFileSave` → agent) | `src/` 코드가 바뀌면 README '핵심 기능' 표의 코드 위치가 실제 파일·함수와 맞는지 확인하도록 에이전트에 요청 | `.kiro/hooks/readme-feature-sync.json` |
| 기타 | Hooks: 톤 가이드 ↔ 코드 동기화 (`PostFileSave` → agent) | 말투 기준 문서를 고치면 `tone.js`·`relation.js`·`drafts.js`와 테스트를 문서에 맞추도록 에이전트에 요청 | `.kiro/hooks/tone-guide-sync.json` |
| 기타 | GitHub CLI | 템플릿으로 공개 레포 생성, `dev` 브랜치 push → PR로 main 반영, GitHub Pages 배포 | [Demo](https://dearyesang.github.io/Kirothon-team-021-2/) |
| 기타 | headless Edge PDF 출력 | 발표 자료 HTML(1280×720, 7장)을 PDF로 출력 | `presentation/slides.html`, `PRESENTATION.pdf` |

## 개발 과정에서 바뀐 점

1. **Gemini API → 브라우저 안 규칙 엔진.** 처음에는 Gemini API로 메일을 분석하고 답장을 쓰려고 했습니다. 해커톤 규칙을 확인한 뒤 다음 세 가지 이유로 바꿨습니다.
   - 공개 레포에는 API 키를 둘 수 없습니다.
   - 심사위원이 키 없이 데모를 바로 열 수 있어야 합니다.
   - 교수님·회사 메일 원문(이름·학번·회사 정보)이 브라우저 밖으로 나가면 안 됩니다. 무료 AI API는 입력이 서비스 개선에 쓰일 수 있다는 약관도 확인했습니다.

   그래서 관계 단서(교수·팀장·인사팀·반말 등), 날짜 표현, 결정 단어(검토·수정·첨부 등)를 읽는 규칙 엔진으로 바꿨습니다. 그 결과 네트워크 호출이 0회가 됐고(CSP `connect-src 'none'`), 같은 메일에는 같은 결과가 나와 테스트로 검증할 수 있게 됐습니다. 왜 그 말투인지 이유도 문장으로 보여 줄 수 있습니다. 표현이 AI보다 단조로운 점은 초안 3종(정중·표준·간결)과 메모 다듬기(`polishNote`)로 보완했습니다.
2. **범위를 메일만으로 줄임.** 처음 구상은 메신저·AI 통화·AI 회의록까지 통합하는 비서였지만, 제한 시간 안에 실제로 작동하는 것을 우선해 메일 하나에 집중했습니다. 엔진을 채널과 분리해 두어, 나머지는 '입구'만 추가하는 로드맵(메일 → 메신저(슬랙·카카오톡) → AI 통화(에이닷) → AI 회의록(클로바노트·TIRO))으로 남겼습니다.
3. **작업 위치를 템플릿 레포로 옮김.** 처음에는 로컬 폴더에서 만들려 했으나, 해커톤 규칙에 맞춰 템플릿으로 만든 공개 레포에서 작업하고 `.kiro/` 기록을 함께 커밋했습니다.

## 어려웠던 점과 해결 방법

1. **짧은 개발 시간.** 엔진·화면·문서를 차례로 만들면 시간이 모자랐습니다. API 계약(함수 이름, 입력·출력 타입)과 샘플 메일 4통의 기대 결과를 먼저 고정하고, Kiro 서브에이전트 3개가 파일 담당을 나눠 동시에 개발했습니다. 화면 에이전트는 엔진이 완성되기 전부터 계약만 보고 만들었고, 합칠 때 수정 없이 맞물렸습니다.
2. **한국어 날짜 표현 파싱.** '다음 주 중', '이번 주 금요일', '16일(월)', '수요일 오후 3시까지', '3시 반'처럼 같은 날짜도 쓰는 방법이 다양합니다. 엔진이 '오늘'을 인자로 받도록 해서 테스트에서 2026-11-14(토)로 고정했고, 주변 단어로 종류를 나눴습니다('까지·마감·회신'은 기한, '면담·회의·면접'은 약속).
3. **바뀐 훅 형식.** 예전 자료의 `.kiro.hook` 형식 대신, 최신 Kiro 문서를 읽고 IDE 1.0 / CLI V3의 `.kiro/hooks/*.json` v1 형식(`trigger`·`matcher`·`action`)으로 작성했습니다.
4. **main 브랜치 직접 push 금지 정책.** 작업 환경의 안전 정책상 main에 바로 push할 수 없어서, `dev` 브랜치에 push한 뒤 PR을 만들고 사람이 직접 머지했습니다. 변경 이력도 PR 단위로 남았습니다.
5. **말투 규칙이 문서와 코드에서 따로 바뀌는 문제.** 톤 가이드를 고치고 `tone.js`를 안 고치면 화면과 문서가 어긋납니다. 가이드가 바뀌면 코드와 테스트를 맞추도록 요청하는 훅(`tone-guide-sync`)으로 해결했습니다.
