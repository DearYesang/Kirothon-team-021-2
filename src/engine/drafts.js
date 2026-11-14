// Reply drafts (정중/표준/간결) and shorthand note polishing.
import { hasBatchim, withTopic } from './text.js';
import { addDays, mdLabel, parseYmd, toYmd } from './dates.js';

const DAY_FULL = { 월: '월요일', 화: '화요일', 수: '수요일', 목: '목요일', 금: '금요일', 토: '토요일', 일: '일요일' };
const NEG = /^(안됨|안돼|안되|안돼요|안되요|불가|불가능|어려움|힘듦|ㄴㄴ)$/;
const POS = /^(가능|ㄱㄴ|됨|돼|돼요|괜찮음)$/;
const OKS = /^(ㅇㅋ|오케이|오키|ok|okay)$/i;
const THANKS = /^(ㄱㅅ|ㄳ|감사|감사요|땡큐|thx|thanks)$/i;
const SORRY = /^(ㅈㅅ|죄송|미안|쏘리|sorry)$/i;

const PHRASES = {
  ack: { formal: '알겠습니다.', polite: '알겠어요.', casual: '알겠어!' },
  thanks: { formal: '감사합니다.', polite: '감사해요.', casual: '고마워!' },
  sorry: { formal: '죄송합니다.', polite: '죄송해요.', casual: '미안해!' },
};

function predForm(pred, last, q, level) {
  if (!last) {
    if (pred === 'neg') return level === 'casual' ? '안 되고' : '어렵고';
    return level === 'casual' ? '되고' : '가능하고';
  }
  const table = pred === 'neg'
    ? { formal: q ? '어려우실까요?' : '어렵습니다.', polite: q ? '어려우세요?' : '어려워요.', casual: q ? '안 돼?' : '안 돼.' }
    : { formal: q ? '가능하실까요?' : '가능합니다.', polite: q ? '가능할까요?' : '가능해요.', casual: q ? '돼?' : '돼.' };
  return table[level] || table.formal;
}

/**
 * Turn shorthand into proper sentence(s) in the given level.
 * '목 안됨 금 3시 가능' (formal) → '목요일은 어렵고, 금요일 3시는 가능합니다.'
 * @param {string} note
 * @param {'formal'|'polite'|'casual'} [level]
 * @returns {string}
 */
export function polishNote(note, level = 'formal') {
  const lv = ['formal', 'polite', 'casual'].includes(level) ? level : 'formal';
  const s = String(note ?? '').trim().replace(/안\s+(됨|돼|되)/g, '안$1').replace(/(\d+)시반/g, '$1시 반');
  if (!s) return '';
  const tokens = [];
  for (const raw of s.split(/[\s,]+/).filter(Boolean)) {
    let tok = raw;
    const day = tok.match(/^([월화수목금토일])(\d.*|안.*|불가.*|가능.*)$/);
    if (day) {
      tokens.push(day[1]);
      tok = day[2];
    }
    const pred = tok.match(/^(.*?)(불가능|안됨|안돼|불가|가능)([?？!.~]*)$/);
    if (pred && pred[1]) {
      tokens.push(pred[1], pred[2] + pred[3]);
    } else {
      tokens.push(tok);
    }
  }
  const clauses = [];
  let buf = [];
  const flushText = () => {
    if (buf.length) clauses.push({ text: buf.join(' ') });
    buf = [];
  };
  for (const tok of tokens) {
    const q = /[?？]$/.test(tok);
    const core = tok.replace(/[?？!.~]+$/, '');
    if (DAY_FULL[core]) buf.push(DAY_FULL[core]);
    else if (NEG.test(core)) {
      clauses.push({ subject: buf.join(' '), pred: 'neg', q });
      buf = [];
    } else if (POS.test(core) || (OKS.test(core) && buf.length)) {
      clauses.push({ subject: buf.join(' '), pred: 'pos', q });
      buf = [];
    } else if (OKS.test(core)) {
      flushText();
      clauses.push({ phrase: 'ack' });
    } else if (THANKS.test(core)) {
      flushText();
      clauses.push({ phrase: 'thanks' });
    } else if (SORRY.test(core)) {
      flushText();
      clauses.push({ phrase: 'sorry' });
    } else buf.push(tok);
  }
  flushText();
  const out = [];
  let group = [];
  const flushGroup = () => {
    if (!group.length) return;
    out.push(group.map((c, i) => {
      const subj = c.subject ? `${withTopic(c.subject)} ` : '';
      return subj + predForm(c.pred, i === group.length - 1, c.q, lv);
    }).join(', '));
    group = [];
  };
  for (const c of clauses) {
    if (c.pred) {
      group.push(c);
      continue;
    }
    flushGroup();
    if (c.phrase) out.push(PHRASES[c.phrase][lv]);
    else out.push(/[.!?~]$/.test(c.text) ? c.text : `${c.text}.`);
  }
  flushGroup();
  return out.join(' ');
}

const STYLES = [
  { style: 'polite', label: '정중' },
  { style: 'standard', label: '표준' },
  { style: 'brief', label: '간결' },
];
const DEFAULT_TITLE = { professor: '교수님', recruiter: '담당자님', client: '담당자님', senior: '선배님' };
const INTENT_IDS = ['accept', 'reschedule', 'decline', 'ask', 'ack'];

function addressee(from, relation, level) {
  const name = from?.name || '';
  if (level === 'casual') {
    if (!name) return '';
    const given = /^[가-힣]{3}$/.test(name) ? name.slice(1) : name;
    return given + (hasBatchim(given) ? '아' : '야');
  }
  const title = from?.title || DEFAULT_TITLE[relation] || '님';
  if (name) return `${name} ${title}`;
  return title === '님' ? '' : title;
}

function nextBusinessDay(ymd, n = 2) {
  let d = parseYmd(ymd);
  let left = n;
  while (left > 0) {
    d = addDays(d, 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left -= 1;
  }
  return mdLabel(toYmd(d));
}

function context(analysis, profile, note) {
  const level = analysis.tone?.level || 'polite';
  const L = (f, p, c) => (level === 'formal' ? f : level === 'polite' ? p : c);
  const body = analysis.body || '';
  const slots = analysis.schedule?.slots || [];
  const offered = slots.filter((s) => s.offered);
  const alternatives = (analysis.schedule?.alternatives || []).length
    ? analysis.schedule.alternatives
    : slots.filter((s) => !s.offered);
  const dl = analysis.deadline || { date: null };
  const dlText = dl.date ? `${mdLabel(dl.date)}${dl.time ? ` ${dl.time}` : ''}` : '';
  const meeting = (analysis.dates || []).find((d) => d.kind === 'meeting');
  const meetingWord = ['발표', '면접', '면담', '회의', '미팅', '통화'].find((w) => body.includes(w)) || '일정';
  const wantsTimes = slots.length > 0 && !offered.length;
  return {
    level,
    L,
    relation: analysis.relation,
    addr: addressee(analysis.from, analysis.relation, level),
    name: profile.name,
    aff: profile.affiliation,
    closing: level === 'casual' ? '' : analysis.relation === 'professor' ? '올림' : '드림',
    offered,
    alternatives,
    wantsTimes,
    slots,
    dl,
    dlText,
    meeting,
    meetingWord,
    rsvp: /참석|참여|여부/.test(body),
    share: /공유/.test(body),
    good: /합격|축하/.test(body),
    reviewed: /검토|피드백/.test(body),
    note: note ? polishNote(note, level) : '',
  };
}

function deadlineDone(c) {
  const a = c.dl.action;
  if (a === '회신') return c.L('회신드리겠습니다.', '알려 드릴게요.', '알려줄게!');
  if (a === '제출') return c.share ? c.L('공유드리겠습니다.', '공유할게요.', '보낼게!') : c.L('제출하겠습니다.', '보내 드릴게요.', '보낼게!');
  return c.L('처리하겠습니다.', '처리할게요.', '해 둘게!');
}

function meetingLine(c) {
  if (!c.meeting || c.offered.length || c.wantsTimes) return null;
  const when = `${mdLabel(c.meeting.date)}${c.meeting.time ? ` ${c.meeting.time}` : ''}`;
  return c.L(`${when} ${c.meetingWord}도 준비하겠습니다.`, `${when} ${c.meetingWord}도 준비할게요.`, `${when} ${c.meetingWord}도 챙길게!`);
}

/** Main lines per intent. Returns { lines, short } where short is the one-line version. */
function mainFor(intent, c) {
  const { L } = c;
  const list = (slots) => slots.map((s) => `- ${s.label}`);
  const inline = (slots) => slots.map((s) => s.label.replace(/ \(제안된 시간\)$/, '')).join(', ');
  if (intent === 'accept') {
    if (c.offered.length) {
      const s = c.offered[0].label.replace(/ \(제안된 시간\)$/, '');
      const line = L(`제안해 주신 일정 중 ${s}에 참석하겠습니다.`, `제안해 주신 일정 중 ${s}에 참석할게요.`, `${s} 좋아, 그때 갈게!`);
      return { lines: [line], short: line };
    }
    if (c.wantsTimes) {
      return {
        lines: [L('가능한 시간을 말씀드리겠습니다.', '가능한 시간 알려 드릴게요.', '나 이때 돼!'), ...list(c.slots),
          L('이 중 편하신 시간으로 정해 주시면 맞추겠습니다.', '이 중 편하신 시간으로 골라 주세요.', '편한 때로 골라줘~')],
        short: L(`${inline(c.slots)} 중 편하신 시간에 가능합니다.`, `${inline(c.slots)} 중 편하신 때 가능해요.`, `${inline(c.slots)} 중에 돼!`),
      };
    }
    if (c.rsvp) {
      const line = L('참석하겠습니다.', '참석할게요.', '나 참석할게!');
      return { lines: [line], short: line };
    }
    if (c.dl.date) {
      const first = L(`말씀하신 내용 반영하여 ${c.dlText}까지 ${deadlineDone(c)}`, `${c.dlText}까지 ${deadlineDone(c)}`, `${c.dlText}까지 ${deadlineDone(c)}`);
      const m = meetingLine(c);
      return { lines: m ? [first, m] : [first], short: m ? `${first} ${m}` : first };
    }
    const line = L('말씀하신 대로 진행하겠습니다.', '말씀하신 대로 진행할게요.', '좋아, 그렇게 하자!');
    return { lines: [line], short: line };
  }
  if (intent === 'reschedule') {
    const alts = c.alternatives;
    if (c.offered.length || c.wantsTimes || (c.meeting && !c.dl.date)) {
      const first = L('죄송하지만 말씀하신 일정에는 참석이 어려울 것 같습니다.', '죄송하지만 말씀하신 일정은 어려울 것 같아요.', '미안, 그때는 어려울 것 같아.');
      if (!alts.length) {
        const ask = L('혹시 다른 날짜로 조정이 가능할지 여쭙고 싶습니다.', '혹시 다른 날짜로 바꿀 수 있을까요?', '혹시 다른 날 돼?');
        return { lines: [first, ask], short: `${first} ${ask}` };
      }
      return {
        lines: [first, L('혹시 아래 시간 중 가능하신 때가 있으실지 여쭙고 싶습니다.', '혹시 아래 시간 중 가능하실까요?', '이때는 어때?'), ...list(alts)],
        short: L(`혹시 ${inline(alts)} 중 가능하실지 여쭙습니다.`, `혹시 ${inline(alts)} 중 가능하실까요?`, `${inline(alts)} 중에 어때?`),
      };
    }
    if (c.dl.date) {
      const next = nextBusinessDay(c.dl.date);
      const line = L(`죄송하지만 ${c.dlText}까지는 일정이 빠듯합니다. 혹시 ${next}까지로 조정해 주실 수 있을지 여쭙고 싶습니다.`,
        `죄송하지만 ${c.dlText}까지는 조금 빠듯해요. 혹시 ${next}까지 가능할까요?`,
        `${c.dlText}까지는 좀 빠듯한데, ${next}까지 해도 될까?`);
      return { lines: [line], short: line };
    }
    const line = L('죄송하지만 일정을 조금 조정할 수 있을지 여쭙고 싶습니다.', '혹시 일정을 조금 조정할 수 있을까요?', '혹시 날짜 좀 바꿀 수 있어?');
    return { lines: [line], short: line };
  }
  if (intent === 'decline') {
    const join = c.offered.length || c.wantsTimes || c.rsvp || c.meeting;
    const line = L(
      `말씀해 주셔서 감사하지만, 아쉽게도 이번에는 ${join ? '참석이 어렵습니다' : '요청하신 일정에 맞추기 어렵습니다'}. 너그러운 양해 부탁드립니다.`,
      `아쉽지만 이번에는 ${join ? '참석이 ' : ''}어려울 것 같아요. 양해 부탁드려요.`,
      `미안, 이번엔 ${join ? '못 갈' : '어려울'} 것 같아 ㅠㅠ`,
    );
    return { lines: [line], short: line };
  }
  if (intent === 'ask') {
    if (c.note) {
      const first = L('한 가지 여쭙고 싶은 점이 있습니다.', '궁금한 점이 있어 여쭤봐요.', '궁금한 거 있어!');
      return { lines: [first, c.note], short: `${first} ${c.note}`, usedNote: true };
    }
    const line = L('혹시 조금 더 자세히 알려 주실 수 있을지 여쭙고 싶습니다.', '혹시 조금 더 자세히 알려 주실 수 있을까요?', '좀 더 자세히 알려줄 수 있어?');
    return { lines: [line], short: line };
  }
  // ack
  const first = c.dl.date
    ? L(`확인했습니다. ${c.dlText}까지 ${deadlineDone(c)}`, `확인했어요. ${c.dlText}까지 ${deadlineDone(c)}`, `확인했어! ${c.dlText}까지 ${deadlineDone(c)}`)
    : L('확인했습니다. 기한 내에 처리하겠습니다.', '확인했어요. 기한 내에 처리할게요.', '확인했어! 금방 할게.');
  const m = meetingLine(c);
  return { lines: m ? [first, m] : [first], short: m ? `${first} ${m}` : first };
}

function compose(c, intent, style) {
  const { L } = c;
  const main = mainFor(intent, c);
  const noteLine = c.note && !main.usedNote ? c.note : '';
  const intro = c.aff ? `${c.aff} ${c.name}입니다.` : `${c.name}입니다.`;
  const lines = [];
  if (style === 'brief') {
    lines.push(c.addr ? L(`${c.addr}, ${intro}`, `${c.addr}, ${c.name}이에요.`.replace(/([가-힣])이에요/, (m, ch) => (hasBatchim(ch) ? `${ch}이에요` : `${ch}예요`)), `${c.addr}!`) : L(intro, `${c.name}이에요.`, '안녕!'));
    lines.push([main.short, noteLine].filter(Boolean).join(' '));
    if (c.closing) lines.push(`${c.name} ${c.closing}`);
    return lines.join('\n');
  }
  const hello = L('안녕하십니까.', '안녕하세요.', '안녕!');
  if (style === 'polite') {
    lines.push(c.addr ? `${c.addr}, ${hello}` : hello);
    if (c.level !== 'casual') lines.push(intro);
    lines.push('');
    if (c.good) lines.push(L('좋은 소식 전해 주셔서 진심으로 감사드립니다.', '좋은 소식 전해 주셔서 감사해요.', '소식 고마워!'));
    else if (c.reviewed) lines.push(L('바쁘신 와중에 꼼꼼히 검토해 주셔서 감사합니다.', '꼼꼼히 봐 주셔서 감사해요.', '봐 줘서 고마워!'));
    else lines.push(L('바쁘신 와중에 연락 주셔서 감사합니다.', '연락 주셔서 감사해요.', '연락 고마워!'));
    lines.push(...main.lines);
    if (noteLine) lines.push(noteLine);
    lines.push('');
    lines.push(L('번거로우시겠지만 확인 부탁드립니다. 감사합니다.', '확인 부탁드려요. 감사합니다.', '그럼 연락 줘~'));
  } else {
    lines.push(c.addr ? L(`${c.addr}, 안녕하세요. ${intro}`, `${c.addr}, 안녕하세요.`, `${c.addr}!`) : L(`안녕하세요. ${intro}`, '안녕하세요.', '안녕!'));
    lines.push('');
    lines.push(...main.lines);
    if (noteLine) lines.push(noteLine);
    lines.push('');
    lines.push(L('감사합니다.', '감사합니다.', '고마워!'));
  }
  if (c.closing) lines.push(`${c.name} ${c.closing}`);
  return lines.join('\n');
}

/**
 * Build the three reply drafts (정중 / 표준 / 간결) for an intent.
 * @param {object} analysis Result of analyzeEmail().
 * @param {{ intent: 'accept'|'reschedule'|'decline'|'ask'|'ack', note?: string, profile?: { name?: string, affiliation?: string } }} opts
 * @returns {Array<{ style: 'polite'|'standard'|'brief', label: '정중'|'표준'|'간결', subject: string, body: string }>}
 */
export function buildDrafts(analysis, opts = {}) {
  const intent = INTENT_IDS.includes(opts.intent) ? opts.intent : (analysis.intents?.[0]?.id || 'ack');
  const profile = {
    name: String(opts.profile?.name || '').trim() || '홍길동',
    affiliation: String(opts.profile?.affiliation || '').trim(),
  };
  const c = context(analysis, profile, opts.note);
  const subject = analysis.subject ? `Re: ${analysis.subject.replace(/^(re|회신)\s*:\s*/i, '')}` : '회신드립니다';
  return STYLES.map(({ style, label }) => ({ style, label, subject, body: compose(c, intent, style) }));
}
