// Korean date/time extraction. Dates are local 'YYYY-MM-DD', times 'HH:MM'.
import { DOW_KO } from './text.js';

const DOW_INDEX = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
const MEETING_WORDS = /면담|회의|미팅|면접|통화|발표|상담|만남|약속/;
const DEADLINE_WORDS = /까지|마감|기한|제출|회신/;

/** @param {number} n */
export const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Format a Date as local 'YYYY-MM-DD'.
 * @param {Date} d
 * @returns {string}
 */
export function toYmd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Parse local 'YYYY-MM-DD' into a Date at local midnight.
 * @param {string} s
 * @returns {Date}
 */
export function parseYmd(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Add whole days (local calendar arithmetic).
 * @param {Date} d
 * @param {number} n
 * @returns {Date}
 */
export function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/**
 * Local midnight of the given date.
 * @param {Date} d
 * @returns {Date}
 */
export function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Monday of the (Mon-Sun) week containing d.
 * @param {Date} d
 * @returns {Date}
 */
export function mondayOf(d) {
  const s = startOfDay(d);
  return addDays(s, -((s.getDay() + 6) % 7));
}

/**
 * Whole days from a to b (b - a), DST-safe.
 * @param {Date} a
 * @param {Date} b
 * @returns {number}
 */
export function daysBetween(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

/**
 * Short Korean label: '2026-11-16' → '11/16(월)'.
 * @param {string} ymd
 * @returns {string}
 */
export function mdLabel(ymd) {
  const d = parseYmd(ymd);
  return `${d.getMonth() + 1}/${d.getDate()}(${DOW_KO[d.getDay()]})`;
}

function validDate(y, m, d) {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
}

/** Month/day without a year: this year, or next year when it is long past. */
function inferYear(m, d, today) {
  const y = today.getFullYear();
  const dt = validDate(y, m, d);
  if (!dt) return null;
  return daysBetween(today, dt) < -30 ? validDate(y + 1, m, d) : dt;
}

/** Day-of-month with weekday ('16일(월)'): nearest upcoming match. */
function dayWithDow(day, dow, today) {
  let fallback = null;
  for (let k = 0; k <= 3; k += 1) {
    const base = new Date(today.getFullYear(), today.getMonth() + k, 1);
    const cand = validDate(base.getFullYear(), base.getMonth() + 1, day);
    if (!cand || daysBetween(today, cand) < -7) continue;
    if (dow === undefined || cand.getDay() === dow) return cand;
    if (!fallback && daysBetween(today, cand) >= 0) fallback = cand;
  }
  return fallback;
}

function weekdayDate(prefix, dow, today) {
  const t = startOfDay(today);
  const p = (prefix || '').replace(/\s/g, '');
  const mon = mondayOf(t);
  if (p === '다음주' || p === '차주' || p === '담주') return addDays(mon, 7 + ((dow + 6) % 7));
  if (p === '다다음주') return addDays(mon, 14 + ((dow + 6) % 7));
  if (p === '이번주' || p === '금주') {
    const d = addDays(mon, (dow + 6) % 7);
    return daysBetween(t, d) < 0 ? addDays(d, 7) : d;
  }
  return addDays(t, (dow - t.getDay() + 7) % 7);
}

const DATE_PATTERNS = [
  {
    re: /(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?(?:\s*\(([월화수목금토일])(?:요일)?\))?/g,
    toDate: (m) => validDate(Number(m[1]), Number(m[2]), Number(m[3])),
  },
  {
    re: /(\d{1,2})월\s*(\d{1,2})일(?:\s*\(([월화수목금토일])(?:요일)?\))?/g,
    toDate: (m, today) => inferYear(Number(m[1]), Number(m[2]), today),
  },
  {
    re: /(^|[^\d/.])(\d{1,2})\/(\d{1,2})(?![\d/])(?:\s*\(([월화수목금토일])(?:요일)?\))?/g,
    lead: 1,
    toDate: (m, today) => inferYear(Number(m[2]), Number(m[3]), today),
  },
  {
    re: /(^|[^\d월])(\d{1,2})일\s*\(([월화수목금토일])(?:요일)?\)/g,
    lead: 1,
    toDate: (m, today) => dayWithDow(Number(m[2]), DOW_INDEX[m[3]], today),
  },
  {
    re: /(내일\s?모레|오늘|금일|내일|명일|모레)/g,
    toDate: (m, today) => {
      const w = m[1].replace(/\s/g, '');
      const off = { 오늘: 0, 금일: 0, 내일: 1, 명일: 1, 모레: 2, 내일모레: 2 }[w];
      return addDays(startOfDay(today), off);
    },
  },
  {
    re: /(?:(이번\s?주|금주|다다음\s?주|다음\s?주|차주|담주)\s*)?([월화수목금토일])요일/g,
    toDate: (m, today) => weekdayDate(m[1], DOW_INDEX[m[2]], today),
  },
];

const TIME_RE = /^\s*(?:에\s*)?(?:(오전|오후|아침|저녁|밤|낮|새벽)\s*)?(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분|\s*(반))?|^\s*(?:에\s*)?(\d{1,2}):(\d{2})/;

/**
 * Parse a Korean time expression at the start of `s` ('오후 3시', '3시 반', '15:00').
 * Bare 1-7시 are read as afternoon.
 * @param {string} s
 * @returns {{ time: string, length: number } | null}
 */
export function parseTimeAt(s) {
  const m = TIME_RE.exec(s);
  if (!m) return null;
  let h;
  let min;
  if (m[5] !== undefined) {
    h = Number(m[5]);
    min = Number(m[6]);
  } else {
    h = Number(m[2]);
    min = m[3] ? Number(m[3]) : m[4] ? 30 : 0;
    const ap = m[1];
    if ((ap === '오후' || ap === '저녁' || ap === '밤') && h < 12) h += 12;
    else if (ap === '낮' && h < 7) h += 12;
    else if ((ap === '오전' || ap === '아침' || ap === '새벽') && h === 12) h = 0;
    else if (!ap && h >= 1 && h <= 7) h += 12;
  }
  if (h > 23 || min > 59) return null;
  return { time: `${pad2(h)}:${pad2(min)}`, length: m[0].length };
}

function sentenceAround(text, start, end) {
  let a = start;
  while (a > 0 && !/[.!?\n]/.test(text[a - 1])) a -= 1;
  let b = end;
  while (b < text.length && !/[.!?\n]/.test(text[b])) b += 1;
  return text.slice(a, b + 1).trim();
}

/**
 * Scan text for dates (internal shape, includes the surrounding sentence).
 * @param {string} text
 * @param {Date} today
 * @returns {{ items: Array<{text:string,date:string,time:string|null,kind:string,sentence:string,index:number}>, wantsNextWeek: boolean }}
 */
export function scanDates(text, today) {
  const src = String(text ?? '');
  const raw = [];
  for (const p of DATE_PATTERNS) {
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(src)) !== null) {
      const leadLen = p.lead ? m[p.lead].length : 0;
      const dt = p.toDate(m, today);
      if (dt) raw.push({ start: m.index + leadLen, end: m.index + m[0].length, dt });
    }
  }
  raw.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = [];
  let lastEnd = -1;
  for (const r of raw) {
    if (r.start >= lastEnd) {
      kept.push(r);
      lastEnd = r.end;
    }
  }
  const seen = new Set();
  const items = [];
  for (const r of kept) {
    const t = parseTimeAt(src.slice(r.end));
    const end = t ? r.end + t.length : r.end;
    const tail = src.slice(end, end + 8);
    const sentence = sentenceAround(src, r.start, end);
    let kind = 'date';
    if (/^\s*(까지|전까지|이전까지|마감)/.test(tail)) kind = 'deadline';
    else if (MEETING_WORDS.test(sentence)) kind = 'meeting';
    else if (DEADLINE_WORDS.test(sentence)) kind = 'deadline';
    const item = {
      text: src.slice(r.start, end).trim(),
      date: toYmd(r.dt),
      time: t ? t.time : null,
      kind,
      sentence,
      index: r.start,
    };
    const key = `${item.date}|${item.time}|${item.kind}`;
    if (!seen.has(key)) {
      seen.add(key);
      items.push(item);
    }
  }
  const wantsNextWeek = /(다음\s?주|차주|담주)(?!\s*[월화수목금토일]요일)/.test(src);
  return { items, wantsNextWeek };
}

/**
 * Extract dates in the contract shape.
 * @param {string} text
 * @param {Date} today
 * @returns {{ dates: Array<{text:string,date:string,time:string|null,kind:'deadline'|'meeting'|'date'}>, wantsNextWeek: boolean }}
 */
export function extractDates(text, today) {
  const { items, wantsNextWeek } = scanDates(text, today);
  return {
    dates: items.map(({ text: t, date, time, kind }) => ({ text: t, date, time, kind })),
    wantsNextWeek,
  };
}

/**
 * Pick the earliest upcoming deadline and build its Korean label.
 * @param {Array<{date:string,time:string|null,kind:string,sentence?:string}>} items
 * @param {Date} today
 * @returns {{ date: string|null, time: string|null, label: string, action: '회신'|'제출'|'처리'|null }}
 */
export function pickDeadline(items, today) {
  const t = toYmd(today);
  const dl = items
    .filter((d) => d.kind === 'deadline' && d.date >= t)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];
  if (!dl) return { date: null, time: null, label: '기한 없음 → 24시간 안에 답장 권장', action: null };
  const s = dl.sentence || '';
  let action = '처리';
  if (/회신|답장|답변|알려|연락|여부|참석/.test(s)) action = '회신';
  else if (/제출|공유|보내|송부|전달|업로드|수정본/.test(s)) action = '제출';
  const when = `${mdLabel(dl.date)}${dl.time ? ` ${dl.time}` : ''}`;
  return { date: dl.date, time: dl.time, label: `${when}까지 ${action}`, action };
}
