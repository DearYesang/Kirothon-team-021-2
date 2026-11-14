import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSentences, normalizeText, hasBatchim, withTopic, isGreeting } from '../src/engine/text.js';
import { parseHeaders, parseAddress, detectChannel } from '../src/engine/headers.js';
import { detectRelation } from '../src/engine/relation.js';
import { recommendTone } from '../src/engine/tone.js';
import { extractDates, parseTimeAt, mdLabel, pickDeadline, scanDates } from '../src/engine/dates.js';
import { assessFocus } from '../src/engine/focus.js';
import { parseAvailability, suggestSlots } from '../src/engine/schedule.js';
import { polishNote, buildDrafts } from '../src/engine/drafts.js';
import { googleCalendarUrl, buildIcs } from '../src/engine/calendar.js';
import { analyzeEmail } from '../src/engine/analyze.js';

const today = new Date(2026, 10, 14);

test('text: sentences, normalization, particles', () => {
  assert.deepEqual(splitSentences('길동아 안녕! 시간 2~3개 알려줘.\n고마워'), ['길동아 안녕!', '시간 2~3개 알려줘.', '고마워']);
  assert.equal(normalizeText('  a\r\n\r\n\r\n b  '), 'a\n\nb');
  assert.equal(hasBatchim('목요일'), true);
  assert.equal(hasBatchim('3시'), false);
  assert.equal(withTopic('금요일 3시'), '금요일 3시는');
  assert.ok(isGreeting('홍길동 학생, 안녕하세요.'));
  assert.ok(!isGreeting('다음 주 중 면담 가능한 시간을 알려주세요.'));
});

test('headers: address, title, channel, body split', () => {
  assert.deepEqual(parseAddress('김민수 교수 <MSKIM@univ.example.ac.kr>'), { name: '김민수', address: 'mskim@univ.example.ac.kr', title: '교수님' });
  assert.deepEqual(parseAddress('a@b.com'), { name: null, address: 'a@b.com', title: null });
  assert.equal(detectChannel('x@gmail.com'), 'gmail');
  assert.equal(detectChannel('x@naver.com'), 'naver');
  assert.equal(detectChannel('x@hotmail.com'), 'outlook');
  assert.equal(detectChannel('x@company.example'), 'unknown');
  const p = parseHeaders('From: 이영희 <yh@naver.com>\nSubject: 회의 일정\n\n안녕하세요.\n내일 뵙겠습니다.');
  assert.equal(p.from.name, '이영희');
  assert.equal(p.subject, '회의 일정');
  assert.equal(p.body, '안녕하세요.\n내일 뵙겠습니다.');
  const none = parseHeaders('그냥 본문만 있어요.');
  assert.equal(none.subject, null);
  assert.equal(none.body, '그냥 본문만 있어요.');
});

test('relation: cues per relation', () => {
  assert.equal(detectRelation({ body: '귀사의 견적 요청에 감사드립니다. 발주 일정을 알려 주세요.' }).relation, 'client');
  assert.equal(detectRelation({ body: '선배가 자료 보내 줄게요.', from: { title: '선배님' } }).relation, 'senior');
  assert.equal(detectRelation({ body: '팀원 여러분, 동료 평가 양식을 공유드립니다.' }).relation, 'colleague');
  assert.equal(detectRelation({ body: '내일 뭐 해? 같이 밥 먹자 ㅋㅋ' }).relation, 'friend');
  assert.equal(detectRelation({ body: '면접 일정 안내드립니다. 인사팀입니다.' }).relation, 'recruiter');
  assert.equal(detectRelation({ body: '안내 메일입니다.' }).relation, 'unknown');
});

test('tone: level, reason, tips', () => {
  const t = recommendTone({ relation: 'professor', topic: 'schedule' });
  assert.equal(t.level, 'formal');
  assert.equal(t.reason, '교수님께 드리는 일정 회신이라 격식체가 안전해요.');
  assert.ok(t.tips[0].includes('학과·학번·이름'));
  assert.equal(recommendTone({ relation: 'colleague' }).level, 'polite');
  assert.equal(recommendTone({ relation: 'friend' }).level, 'casual');
  assert.equal(recommendTone({ relation: 'nope' }).level, 'polite');
});

test('dates: Korean date and time expressions', () => {
  const pick = (s) => extractDates(s, today).dates[0];
  assert.equal(pick('11/16까지 제출').date, '2026-11-16');
  assert.equal(pick('11/16까지 제출').kind, 'deadline');
  assert.equal(pick('2026-11-25 회의').date, '2026-11-25');
  assert.equal(pick('2026-11-25 회의').kind, 'meeting');
  assert.equal(pick('16일(월) 오전 10시 면담').date, '2026-11-16');
  assert.equal(pick('16일(월) 오전 10시 면담').time, '10:00');
  assert.equal(pick('오늘 저녁 7시 통화').date, '2026-11-14');
  assert.equal(pick('오늘 저녁 7시 통화').time, '19:00');
  assert.equal(pick('내일 3시 반에 봐요').date, '2026-11-15');
  assert.equal(pick('내일 3시 반에 봐요').time, '15:30');
  assert.equal(pick('모레 15:00 미팅').date, '2026-11-16');
  assert.equal(pick('이번 주 금요일까지').date, '2026-11-20');
  assert.equal(pick('다음 주 월요일 발표').date, '2026-11-16');
  assert.equal(pick('금요일까지 알려 주세요').date, '2026-11-20');
  assert.equal(pick('1월 5일 여행').date, '2027-01-05');
  assert.equal(pick('1월 5일 여행').kind, 'date');
  assert.equal(extractDates('다음 주 중 면담 가능한 시간', today).wantsNextWeek, true);
  assert.equal(extractDates('다음 주 월요일 회의', today).wantsNextWeek, false);
  assert.equal(extractDates('시간 2~3개 알려주세요', today).dates.length, 0);
  assert.deepEqual(parseTimeAt('오후 3시까지'), { time: '15:00', length: 5 });
  assert.equal(mdLabel('2026-11-16'), '11/16(월)');
  assert.equal(pickDeadline(scanDates('내일까지 보고서 제출', today).items, today).label, '11/15(일)까지 제출');
  assert.equal(pickDeadline([], today).label, '기한 없음 → 24시간 안에 답장 권장');
});

test('focus: levels and forced now', () => {
  const light = assessFocus({ body: '확인 부탁드려요.', asks: ['확인 부탁드려요.'], today });
  assert.equal(light.level, 'light');
  assert.equal(light.when, 'now');
  const heavy = assessFocus({ body: '보고서 검토 후 피드백과 수정 의견 첨부해서 결정해 주세요.'.repeat(3), asks: ['a', 'b'], dates: [{}, {}], today });
  assert.equal(heavy.level, 'heavy');
  assert.equal(heavy.when, 'deep');
  const urgent = assessFocus({ body: '보고서 검토 후 피드백과 수정 의견 첨부'.repeat(3), asks: ['a'], dates: [{}], deadline: { date: '2026-11-15' }, today });
  assert.equal(urgent.when, 'now');
  assert.ok(urgent.reasons.some((r) => r.includes('내일')));
});

test('schedule: availability memo and slot suggestions', () => {
  assert.deepEqual(parseAvailability('화·목 오후 수업, 금 오전 알바').map(({ dow, part, text }) => ({ dow, part, text })), [
    { dow: 2, part: 'pm', text: '수업' },
    { dow: 4, part: 'pm', text: '수업' },
    { dow: 5, part: 'am', text: '알바' },
  ]);
  assert.deepEqual(parseAvailability('월수 오전 수업').map((b) => [b.dow, b.part]), [[1, 'am'], [3, 'am']]);
  assert.deepEqual(parseAvailability('주말 안 됨').map((b) => [b.dow, b.part]), [[6, 'all'], [0, 'all']]);
  assert.deepEqual(parseAvailability('월~금 저녁 학원').map((b) => b.dow), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseAvailability(''), []);
  const r = suggestSlots({ dates: [], availability: '월 오후 수업', today, wantsNextWeek: false, count: 2 });
  assert.equal(r.slots.length, 2);
  assert.deepEqual(r.slots.map((s) => s.label), ['11/16(월) 10:00 이후', '11/17(화) 14:00 이후']);
  assert.ok(r.tips.includes('확정되면 캘린더에 추가하세요'));
  assert.throws(() => suggestSlots({ dates: [] }));
});

test('polishNote: shorthand to sentences per level', () => {
  assert.equal(polishNote('목 안됨 금 3시 가능', 'formal'), '목요일은 어렵고, 금요일 3시는 가능합니다.');
  assert.equal(polishNote('목 안됨 금 3시 가능', 'polite'), '목요일은 어렵고, 금요일 3시는 가능해요.');
  assert.equal(polishNote('목 안됨 금 3시 가능', 'casual'), '목요일은 안 되고, 금요일 3시는 돼.');
  assert.equal(polishNote('ㅇㅋ', 'formal'), '알겠습니다.');
  assert.equal(polishNote('오케이 ㄱㅅ', 'formal'), '알겠습니다. 감사합니다.');
  assert.equal(polishNote('감사', 'casual'), '고마워!');
  assert.equal(polishNote('수 불가', 'formal'), '수요일은 어렵습니다.');
  assert.equal(polishNote('화 안돼', 'formal'), '화요일은 어렵습니다.');
  assert.equal(polishNote('금3시가능?', 'formal'), '금요일 3시는 가능하실까요?');
  assert.equal(polishNote('발표 자료는 PPT로 준비하겠습니다', 'formal'), '발표 자료는 PPT로 준비하겠습니다.');
  assert.equal(polishNote('   ', 'formal'), '');
});

test('drafts: no subject, defaults, ask uses note as question', () => {
  const a = analyzeEmail('안녕하세요. 자료 확인 부탁드립니다.', { today });
  const d = buildDrafts(a, { intent: 'ask', note: '마감이 언제인가요?' });
  assert.equal(d.length, 3);
  assert.equal(d[0].subject, '회신드립니다');
  for (const x of d) assert.ok(x.body.includes('마감이 언제인가요?'));
  assert.ok(d[1].body.includes('홍길동'));
});

test('calendar: all-day URL and ICS escaping/folding', () => {
  const url = googleCalendarUrl({ title: '보고서 마감', date: '2026-11-18' });
  assert.ok(url.includes('&dates=20261118/20261119&'));
  assert.ok(url.includes(`text=${encodeURIComponent('보고서 마감')}`));
  const late = googleCalendarUrl({ title: 'x', date: '2026-11-18', time: '23:30', durationMin: 60 });
  assert.ok(late.includes('dates=20261118T233000/20261119T003000'));
  const ics = buildIcs({ title: '면담, 준비; 확인', date: '2026-11-16', time: '14:00', details: '첫 줄\n둘째 줄'.repeat(10) });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.includes('DTSTART;TZID=Asia/Seoul:20261116T140000'));
  assert.ok(ics.includes('DTEND;TZID=Asia/Seoul:20261116T150000'));
  assert.ok(ics.includes('SUMMARY:면담\\, 준비\\; 확인'));
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75);
  const allDay = buildIcs({ title: '마감', date: '2026-11-18' });
  assert.ok(allDay.includes('DTSTART;VALUE=DATE:20261118'));
  assert.ok(allDay.includes('DTEND;VALUE=DATE:20261119'));
  assert.equal(buildIcs({ title: 'a', date: '2026-11-18' }), buildIcs({ title: 'a', date: '2026-11-18' }));
});
