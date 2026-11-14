// Google Calendar template links and RFC 5545 .ics files.
import { addDays, pad2, parseYmd } from './dates.js';

function range(date, time, durationMin) {
  const d = parseYmd(date);
  if (!time) {
    const end = addDays(d, 1);
    return { allDay: true, start: d, end };
  }
  const [h, m] = time.split(':').map(Number);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
  const end = new Date(start.getTime() + (durationMin || 60) * 60000);
  return { allDay: false, start, end };
}

const ymdCompact = (d) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
const stamp = (d) => `${ymdCompact(d)}T${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;

/**
 * Build a Google Calendar "add event" template URL (Asia/Seoul).
 * All-day when no time: dates=YYYYMMDD/YYYYMMDD(+1).
 * @param {{ title: string, date: string, time?: string|null, durationMin?: number, details?: string }} ev
 * @returns {string}
 */
export function googleCalendarUrl({ title, date, time = null, durationMin = 60, details = '' }) {
  const r = range(date, time, durationMin);
  const dates = r.allDay
    ? `${ymdCompact(r.start)}/${ymdCompact(r.end)}`
    : `${stamp(r.start)}/${stamp(r.end)}`;
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + `&text=${encodeURIComponent(title || '일정')}`
    + `&dates=${dates}`
    + `&details=${encodeURIComponent(details || '')}`
    + '&ctz=Asia/Seoul';
}

function escapeText(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function utf8Len(ch) {
  const c = ch.codePointAt(0);
  return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
}

/** Fold a content line at 75 octets (RFC 5545 3.1). */
function fold(line) {
  const parts = [];
  let cur = '';
  let len = 0;
  for (const ch of line) {
    const n = utf8Len(ch);
    if (len + n > 75) {
      parts.push(cur);
      cur = ' ';
      len = 1;
    }
    cur += ch;
    len += n;
  }
  parts.push(cur);
  return parts.join('\r\n');
}

function hash(s) {
  let h = 5381;
  for (const ch of s) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return h.toString(16);
}

/**
 * Build an RFC 5545 VCALENDAR with one VEVENT (CRLF line endings, folded lines).
 * Deterministic: UID and DTSTAMP derive from the event itself.
 * @param {{ title: string, date: string, time?: string|null, durationMin?: number, details?: string }} ev
 * @returns {string}
 */
export function buildIcs({ title, date, time = null, durationMin = 60, details = '' }) {
  const r = range(date, time, durationMin);
  const utc = r.start.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//jipjung-biseo//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Seoul',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0900',
    'TZOFFSETTO:+0900',
    'TZNAME:KST',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${ymdCompact(r.start)}-${hash(`${title}|${date}|${time}`)}@jipjung-biseo`,
    `DTSTAMP:${utc}`,
    r.allDay ? `DTSTART;VALUE=DATE:${ymdCompact(r.start)}` : `DTSTART;TZID=Asia/Seoul:${stamp(r.start)}`,
    r.allDay ? `DTEND;VALUE=DATE:${ymdCompact(r.end)}` : `DTEND;TZID=Asia/Seoul:${stamp(r.end)}`,
    `SUMMARY:${escapeText(title || '일정')}`,
  ];
  if (details) lines.push(`DESCRIPTION:${escapeText(details)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
