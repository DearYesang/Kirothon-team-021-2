// Availability memo parsing and slot suggestions.
import { DOW_KO } from './text.js';
import { addDays, mdLabel, mondayOf, parseYmd, toYmd } from './dates.js';

const DOW_INDEX = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
const PART_LABEL = { am: '오전', pm: '오후', all: '종일' };

function dayToken(rest) {
  const m = rest.match(/^(평일|주말|매일|[월화수목금토일]요일|[월화수목금토일])/);
  if (!m) return null;
  const tok = m[1];
  if (tok.length === 1) {
    const next = rest[1];
    if (next && /[가-힣]/.test(next) && !(next in DOW_INDEX)) return null;
  }
  let days;
  if (tok === '평일') days = [1, 2, 3, 4, 5];
  else if (tok === '주말') days = [6, 0];
  else if (tok === '매일') days = [0, 1, 2, 3, 4, 5, 6];
  else days = [DOW_INDEX[tok[0]]];
  return { days, length: tok.length };
}

/**
 * Parse a free-form availability memo into busy (or free) day parts.
 * '화·목 오후 수업, 금 오전 알바' → [{dow:2,part:'pm',text:'수업'}, {dow:4,...}, {dow:5,part:'am',text:'알바'}]
 * @param {string} memo
 * @returns {Array<{ dow: number, part: 'am'|'pm'|'all', text: string, busy: boolean }>}
 */
export function parseAvailability(memo) {
  const out = [];
  if (!memo || typeof memo !== 'string') return out;
  const chunks = memo.split(/[,，;\n/]|그리고/).map((s) => s.trim()).filter(Boolean);
  let carry = [];
  for (const chunk of chunks) {
    let rest = chunk;
    let days = [];
    let range = false;
    for (;;) {
      rest = rest.replace(/^[\s·ㆍ.&+]+/, '');
      if (/^[~\-]/.test(rest)) {
        range = true;
        rest = rest.slice(1);
        continue;
      }
      const t = dayToken(rest);
      if (!t) break;
      if (range && days.length && t.days.length === 1) {
        const from = days[days.length - 1];
        for (let d = from + 1; d !== t.days[0] + 1 && d <= 6; d += 1) days.push(d);
        if (!days.includes(t.days[0])) days.push(t.days[0]);
      } else {
        days.push(...t.days);
      }
      range = false;
      rest = rest.slice(t.length);
    }
    rest = rest.trim();
    if (!rest && days.length) {
      carry.push(...days);
      continue;
    }
    days = [...carry, ...days];
    carry = [];
    if (!days.length) continue;
    const am = /오전|아침/.test(rest);
    const pm = /오후|저녁|밤/.test(rest);
    const part = am && !pm ? 'am' : pm && !am ? 'pm' : 'all';
    const text = rest.replace(/오전|오후|아침|저녁|밤|종일|하루\s?종일|에는|에|은|는/g, ' ').replace(/\s+/g, ' ').trim() || '일정';
    const busy = !/가능|괜찮|비어|한가|ok|OK/.test(rest);
    for (const dow of [...new Set(days)]) out.push({ dow, part, text, busy });
  }
  return out;
}

const partOf = (time) => (Number(String(time).slice(0, 2)) < 12 ? 'am' : 'pm');

/**
 * Suggest meeting/work slots that avoid the busy parts of the availability memo.
 * When the email offers 2+ meeting options, those are checked first (slot.offered = true).
 * @param {{ dates?: Array<{date:string,time:string|null,kind:string}>, availability?: string|Array<{dow:number,part:string,text:string,busy?:boolean}>, today: Date, wantsNextWeek?: boolean, count?: number, topic?: string }} input
 * @returns {{ slots: Array<{date:string,time:string,label:string,offered:boolean}>, tips: string[], alternatives: Array<{date:string,time:string,label:string,offered:boolean}> }}
 */
export function suggestSlots({ dates = [], availability = [], today, wantsNextWeek = false, count = 3, topic = '' } = {}) {
  if (!(today instanceof Date)) throw new TypeError('suggestSlots: today (Date) is required');
  const busy = (Array.isArray(availability) ? availability : parseAvailability(availability)).filter((b) => b.busy !== false);
  const conflictOf = (d, part) => busy.find((b) => b.dow === d.getDay() && (b.part === 'all' || b.part === part));
  const todayYmd = toYmd(today);
  const tips = [];

  const days = [];
  if (wantsNextWeek) {
    const mon = addDays(mondayOf(today), 7);
    for (let i = 0; i < 5; i += 1) days.push(addDays(mon, i));
  } else {
    for (let i = 1; days.length < 10 && i <= 21; i += 1) {
      const d = addDays(today, i);
      if (d.getDay() !== 0 && d.getDay() !== 6) days.push(d);
    }
  }
  const alternatives = [];
  for (const d of days) {
    if (alternatives.length >= count) break;
    const time = !conflictOf(d, 'pm') ? '14:00' : !conflictOf(d, 'am') ? '10:00' : null;
    if (time) alternatives.push({ date: toYmd(d), time, label: `${mdLabel(toYmd(d))} ${time} 이후`, offered: false });
  }

  let slots = [];
  const meetings = dates.filter((d) => d.kind === 'meeting' && d.time && d.date >= todayYmd);
  if (meetings.length >= 2) {
    for (const m of meetings) {
      const c = conflictOf(parseYmd(m.date), partOf(m.time));
      if (c) tips.push(`${mdLabel(m.date)} ${m.time}은 메모한 일정(${DOW_KO[c.dow]} ${PART_LABEL[c.part]} ${c.text})과 겹쳐요`);
      else slots.push({ date: m.date, time: m.time, label: `${mdLabel(m.date)} ${m.time} (제안된 시간)`, offered: true });
    }
    if (!slots.length) {
      tips.push('제안된 시간이 모두 겹쳐요 → "다른 날짜" 답장을 추천해요');
      slots = alternatives.slice();
    }
  } else {
    slots = alternatives.slice();
  }

  if (slots.length) tips.push('확정되면 캘린더에 추가하세요');
  if (busy.length && slots.some((s) => !s.offered)) tips.push('메모한 수업·알바 시간은 피해서 골랐어요');
  const meeting = dates.find((d) => d.kind === 'meeting' && d.date >= todayYmd);
  if (meeting || wantsNextWeek) tips.push(`${topic || '일정'} 전날 30분 준비 시간을 잡아 두세요`);
  const deadline = dates.find((d) => d.kind === 'deadline' && d.date >= todayYmd);
  if (deadline) tips.push(`마감 하루 전(${mdLabel(toYmd(addDays(parseYmd(deadline.date), -1)))})에 알림을 맞춰 두세요`);
  return { slots, tips: tips.slice(0, 5), alternatives };
}
