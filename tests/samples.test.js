import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeEmail, buildDrafts, polishNote, googleCalendarUrl, buildIcs } from '../src/engine/index.js';

const today = new Date(2026, 10, 14);
const MEMO = '화·목 오후 수업, 금 오전 알바';

const S1 = `보낸사람: 김민수 교수 <mskim@univ.example.ac.kr>
받는사람: 홍길동 <gildong.hong@gmail.com>
제목: 기말 프로젝트 면담 일정
홍길동 학생, 안녕하세요.
기말 프로젝트 진행 상황을 함께 점검하고 싶습니다.
다음 주 중 면담 가능한 시간 2~3개를 알려주세요.
김민수 드림`;

const S2 = `보낸사람: 이수진 <sujin.lee@naver.com>
받는사람: 홍길동 <gildong@naver.com>
제목: 동아리 MT 참석 여부
길동아 안녕! 이번 동아리 MT 참석 여부 11월 20일까지 알려줘~
회비는 3만 원이고 단톡방에 계좌 올려뒀어 ㅋㅋ`;

const S3 = `보낸사람: 박정우 팀장 <jw.park@company.example>
받는사람: 홍길동 <gildong.hong@company.example>
제목: 시장조사 보고서 피드백
길동 씨, 지난주 공유해 준 시장조사 보고서 초안 검토했습니다.
첨부한 피드백을 반영해서 수요일 오후 3시까지 수정본 공유 부탁드립니다.
그리고 목요일 오전 10시 주간회의에서 5분 정도 발표해 주세요.`;

const S4 = `보낸사람: 박지은 <jieun.park@hr.example.com>
받는사람: 홍길동 <gildong.hong@outlook.com>
제목: [OO전자] 1차 면접 일정 안내
안녕하세요, 홍길동 님. OO전자 인사팀 박지은입니다.
서류 전형 합격을 축하드립니다.
1차 면접은 11월 19일(목) 오후 2시 또는 11월 20일(금) 오전 10시 중 선택하실 수 있습니다.
11월 16일(월)까지 회신 부탁드립니다.`;

const INTENTS = ['accept', 'reschedule', 'decline', 'ask', 'ack'];

function checkDrafts(a) {
  const note = '목 안됨 금 3시 가능';
  for (const intent of INTENTS) {
    const drafts = buildDrafts(a, { intent, note, profile: { name: '홍길동', affiliation: '경영학과 20231234' } });
    assert.equal(drafts.length, 3);
    assert.deepEqual(drafts.map((d) => d.style), ['polite', 'standard', 'brief']);
    assert.deepEqual(drafts.map((d) => d.label), ['정중', '표준', '간결']);
    const polished = polishNote(note, a.tone.level);
    for (const d of drafts) {
      assert.equal(d.subject, `Re: ${a.subject}`);
      assert.ok(d.body.includes(polished), `${intent}/${d.style} must contain the note`);
    }
    const briefLines = drafts[2].body.split('\n').length;
    assert.ok(briefLines >= 2 && briefLines <= 4, `brief has ${briefLines} lines`);
  }
}

test('S1 Gmail professor meeting request', () => {
  const a = analyzeEmail(S1, { today, availability: MEMO });
  assert.equal(a.channel, 'gmail');
  assert.equal(a.channelLabel, 'Gmail');
  assert.deepEqual(a.from, { name: '김민수', address: 'mskim@univ.example.ac.kr', title: '교수님' });
  assert.equal(a.subject, '기말 프로젝트 면담 일정');
  assert.equal(a.relation, 'professor');
  assert.equal(a.relationLabel, '교수님');
  assert.equal(a.tone.level, 'formal');
  assert.ok(a.tone.tips.length >= 2 && a.tone.tips.length <= 3);
  assert.ok(a.schedule.wantsNextWeek);
  assert.equal(a.schedule.slots.length, 3);
  for (const s of a.schedule.slots) assert.ok(s.date >= '2026-11-16' && s.date <= '2026-11-20');
  assert.equal(new Set(a.schedule.slots.map((s) => s.date)).size, 3);
  assert.deepEqual(a.schedule.slots.map((s) => s.label), ['11/16(월) 14:00 이후', '11/17(화) 10:00 이후', '11/18(수) 14:00 이후']);
  assert.equal(a.focus.level, 'light');
  assert.equal(a.focus.label, '가벼움');
  assert.equal(a.focus.when, 'now');
  assert.equal(a.intents[0].id, 'accept');
  assert.deepEqual([...a.intents.map((i) => i.id)].sort(), [...INTENTS].sort());
  assert.equal(a.deadline.date, null);
  assert.ok(a.summary.length <= 3 && a.summary.length > 0);
  assert.ok(a.asks.some((s) => s.includes('면담 가능한 시간')));
  assert.ok(!a.body.includes('보낸사람'));
  checkDrafts(a);
  const d = buildDrafts(a, { intent: 'accept' });
  assert.ok(d[0].body.includes('김민수 교수님'));
  assert.ok(d[0].body.includes('11/16(월) 14:00 이후'));
  assert.ok(d[0].body.trim().endsWith('홍길동 올림'));
});

test('S2 Naver friend RSVP', () => {
  const a = analyzeEmail(S2, { today, availability: MEMO });
  assert.equal(a.channel, 'naver');
  assert.equal(a.channelLabel, '네이버메일');
  assert.equal(a.relation, 'friend');
  assert.equal(a.tone.level, 'casual');
  assert.equal(a.deadline.date, '2026-11-20');
  assert.equal(a.deadline.label, '11/20(금)까지 회신');
  assert.deepEqual(a.dates, [{ text: '11월 20일', date: '2026-11-20', time: null, kind: 'deadline' }]);
  assert.equal(a.focus.level, 'light');
  assert.equal(a.intents[0].id, 'accept');
  checkDrafts(a);
  const d = buildDrafts(a, { intent: 'accept' });
  assert.ok(d[1].body.includes('수진아'));
  assert.ok(!d[1].body.includes('습니다'));
});

test('S3 Naver Works boss task with deadline and meeting', () => {
  const a = analyzeEmail(S3, { today, availability: MEMO, channel: 'naverworks' });
  assert.equal(a.channel, 'naverworks');
  assert.equal(a.channelLabel, '네이버웍스');
  assert.equal(a.from.title, '팀장님');
  assert.equal(a.relation, 'boss');
  assert.equal(a.tone.level, 'formal');
  assert.equal(a.deadline.date, '2026-11-18');
  assert.equal(a.deadline.time, '15:00');
  assert.ok(a.dates.some((d) => d.kind === 'deadline' && d.date === '2026-11-18' && d.time === '15:00'));
  assert.ok(a.dates.some((d) => d.kind === 'meeting' && d.date === '2026-11-19' && d.time === '10:00'));
  assert.equal(a.focus.level, 'heavy');
  assert.equal(a.focus.when, 'deep');
  assert.ok(a.focus.score >= 60);
  assert.equal(a.intents[0].id, 'ack');
  checkDrafts(a);
  const d = buildDrafts(a, { intent: 'ack' });
  assert.ok(d[1].body.includes('확인했습니다'));
  assert.ok(d[1].body.includes('11/18(수) 15:00까지'));
  assert.ok(d[1].body.includes('박정우 팀장님'));
  assert.ok(d[1].body.trim().endsWith('홍길동 드림'));
});

test('S4 Outlook recruiter interview options', () => {
  const a = analyzeEmail(S4, { today });
  assert.equal(a.channel, 'outlook');
  assert.equal(a.channelLabel, 'Outlook');
  assert.equal(a.relation, 'recruiter');
  assert.equal(a.tone.level, 'formal');
  const meetings = a.dates.filter((d) => d.kind === 'meeting').map((d) => `${d.date} ${d.time}`);
  assert.deepEqual(meetings, ['2026-11-19 14:00', '2026-11-20 10:00']);
  assert.equal(a.deadline.date, '2026-11-16');
  assert.equal(a.deadline.label, '11/16(월)까지 회신');
  assert.equal(a.focus.level, 'medium');
  assert.equal(a.schedule.slots.length, 2);
  assert.ok(a.schedule.slots.every((s) => s.offered));
  assert.equal(a.intents[0].id, 'accept');
  const d = buildDrafts(a, { intent: 'accept' });
  assert.ok(d[0].body.includes('11/19(목) 14:00에 참석하겠습니다'));
  assert.ok(d[0].body.includes('박지은 담당자님'));
  checkDrafts(a);
});

test('S4 with availability memo: both offered times conflict → reschedule first', () => {
  const a = analyzeEmail(S4, { today, availability: MEMO });
  assert.equal(a.schedule.slots.length, 3);
  assert.ok(a.schedule.slots.every((s) => !s.offered));
  assert.ok(a.schedule.tips.some((t) => t.includes('겹쳐요')));
  assert.equal(a.intents[0].id, 'reschedule');
});

test('calendar output for a sample slot', () => {
  const a = analyzeEmail(S1, { today, availability: MEMO });
  const s = a.schedule.slots[0];
  const url = googleCalendarUrl({ title: a.subject, date: s.date, time: s.time, durationMin: 30, details: '김민수 교수님 면담' });
  assert.match(url, /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE&text=[^&]+&dates=20261116T140000\/20261116T143000&details=[^&]*&ctz=Asia\/Seoul$/);
  const ics = buildIcs({ title: a.subject, date: s.date, time: s.time, durationMin: 30 });
  assert.ok(ics.includes('BEGIN:VEVENT'));
  assert.ok(ics.includes('\r\n'));
  assert.ok(!/[^\r]\n/.test(ics));
});
