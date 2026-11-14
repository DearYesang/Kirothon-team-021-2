// One-click demo emails. All people and addresses are fictional.
// Lines are joined with '\n' so the text stays verbatim (no template-literal indentation).
export const SAMPLES = [
  {
    id: 1,
    channel: 'gmail',
    label: 'Gmail · 교수님 면담 요청',
    text: [
      '보낸사람: 김민수 교수 <mskim@univ.example.ac.kr>',
      '받는사람: 홍길동 <gildong.hong@gmail.com>',
      '제목: 기말 프로젝트 면담 일정',
      '홍길동 학생, 안녕하세요.',
      '기말 프로젝트 진행 상황을 함께 점검하고 싶습니다.',
      '다음 주 중 면담 가능한 시간 2~3개를 알려주세요.',
      '김민수 드림',
    ].join('\n'),
  },
  {
    id: 2,
    channel: 'naver',
    label: '네이버메일 · 동아리 MT',
    text: [
      '보낸사람: 이수진 <sujin.lee@naver.com>',
      '받는사람: 홍길동 <gildong@naver.com>',
      '제목: 동아리 MT 참석 여부',
      '길동아 안녕! 이번 동아리 MT 참석 여부 11월 20일까지 알려줘~',
      '회비는 3만 원이고 단톡방에 계좌 올려뒀어 ㅋㅋ',
    ].join('\n'),
  },
  {
    id: 3,
    channel: 'naverworks',
    label: '네이버웍스 · 팀장님 피드백',
    text: [
      '보낸사람: 박정우 팀장 <jw.park@company.example>',
      '받는사람: 홍길동 <gildong.hong@company.example>',
      '제목: 시장조사 보고서 피드백',
      '길동 씨, 지난주 공유해 준 시장조사 보고서 초안 검토했습니다.',
      '첨부한 피드백을 반영해서 수요일 오후 3시까지 수정본 공유 부탁드립니다.',
      '그리고 목요일 오전 10시 주간회의에서 5분 정도 발표해 주세요.',
    ].join('\n'),
  },
  {
    id: 4,
    channel: 'outlook',
    label: 'Outlook · 면접 일정',
    text: [
      '보낸사람: 박지은 <jieun.park@hr.example.com>',
      '받는사람: 홍길동 <gildong.hong@outlook.com>',
      '제목: [OO전자] 1차 면접 일정 안내',
      '안녕하세요, 홍길동 님. OO전자 인사팀 박지은입니다.',
      '서류 전형 합격을 축하드립니다.',
      '1차 면접은 11월 19일(목) 오후 2시 또는 11월 20일(금) 오전 10시 중 선택하실 수 있습니다.',
      '11월 16일(월)까지 회신 부탁드립니다.',
    ].join('\n'),
  },
];
