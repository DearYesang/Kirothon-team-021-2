// Email header and address parsing.
import { normalizeText } from './text.js';

const HEADER_RE = /^(보낸\s?사람|보낸이|발신자|From|받는\s?사람|받는이|수신자|To|제목|Subject|날짜|보낸\s?날짜|Date)\s*[:：]\s*(.*)$/i;
const TITLE_RE = /\s*(교수님|교수|팀장님|팀장|부장님|부장|과장님|과장|차장님|차장|실장님|실장|본부장님|본부장|대표님|대표|이사님|이사|선배님|선배|대리님|대리|매니저님|매니저|님)$/;

const CHANNELS = {
  gmail: 'Gmail',
  naver: '네이버메일',
  naverworks: '네이버웍스',
  outlook: 'Outlook',
  unknown: '메일',
};

/**
 * Parse '이름 <a@b.c>', '"이름" <a@b.c>' or a bare address.
 * A trailing title ('김민수 교수') is split off as `title` ('교수님').
 * @param {string} str
 * @returns {{ name: string|null, address: string|null, title: string|null }}
 */
export function parseAddress(str) {
  const s = String(str ?? '').trim();
  if (!s) return { name: null, address: null, title: null };
  const angle = s.match(/^(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>/);
  let name = null;
  let address = null;
  if (angle) {
    name = angle[1].replace(/^["']|["']$/g, '').trim() || null;
    address = angle[2].toLowerCase();
  } else {
    const bare = s.match(/[^\s<>]+@[^\s<>]+\.[^\s<>]+/);
    if (bare) {
      address = bare[0].toLowerCase();
      name = s.replace(bare[0], '').replace(/[<>()"']/g, '').trim() || null;
    } else {
      name = s;
    }
  }
  let title = null;
  if (name) {
    const t = name.match(TITLE_RE);
    if (t && name.length > t[0].length) {
      title = t[1].endsWith('님') ? t[1] : `${t[1]}님`;
      if (title === '님') title = null;
      name = name.slice(0, name.length - t[0].length).trim() || null;
    }
  }
  return { name, address, title };
}

/**
 * Detect the mail service from an address domain.
 * @param {string|null} address
 * @returns {'gmail'|'naver'|'naverworks'|'outlook'|'unknown'}
 */
export function detectChannel(address) {
  const domain = String(address ?? '').toLowerCase().split('@')[1] || '';
  if (/^(gmail|googlemail)\.com$/.test(domain)) return 'gmail';
  if (/^naver\.com$/.test(domain)) return 'naver';
  if (/(worksmobile\.com|navercorp\.com|naverworks)/.test(domain)) return 'naverworks';
  if (/^(outlook|hotmail|live|msn)\.(com|co\.kr|kr)$/.test(domain)) return 'outlook';
  return 'unknown';
}

/**
 * Korean label for a channel id.
 * @param {string} channel
 * @returns {string}
 */
export function channelLabel(channel) {
  return CHANNELS[channel] || CHANNELS.unknown;
}

/**
 * Split leading header lines (보낸사람/From, 받는사람/To, 제목/Subject, 날짜/Date) from the body.
 * @param {string} raw
 * @returns {{ from: {name:string|null,address:string|null,title:string|null}, to: {name:string|null,address:string|null,title:string|null}, subject: string|null, date: string|null, body: string }}
 */
export function parseHeaders(raw) {
  const lines = normalizeText(raw).split('\n');
  const h = { from: null, to: null, subject: null, date: null };
  let i = 0;
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const m = line.match(HEADER_RE);
    if (!m) break;
    const key = m[1].replace(/\s/g, '').toLowerCase();
    const val = m[2].trim();
    if (/^(보낸사람|보낸이|발신자|from)$/.test(key)) h.from = val;
    else if (/^(받는사람|받는이|수신자|to)$/.test(key)) h.to = val;
    else if (/^(제목|subject)$/.test(key)) h.subject = val;
    else h.date = val;
  }
  return {
    from: parseAddress(h.from),
    to: parseAddress(h.to),
    subject: h.subject || null,
    date: h.date || null,
    body: lines.slice(i).join('\n').trim(),
  };
}
