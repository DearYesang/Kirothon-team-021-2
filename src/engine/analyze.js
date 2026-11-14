// analyzeEmail: the single entry point that turns pasted text into an Analysis.
import { isGreeting, isSignature, splitSentences, stripLead } from './text.js';
import { channelLabel, detectChannel, parseHeaders } from './headers.js';
import { detectRelation } from './relation.js';
import { recommendTone } from './tone.js';
import { pickDeadline, scanDates } from './dates.js';
import { assessFocus } from './focus.js';
import { suggestSlots } from './schedule.js';

const CHANNEL_IDS = ['gmail', 'naver', 'naverworks', 'outlook', 'unknown'];
const ASK_RE = /부탁|주세요|주십시오|주시기|바랍니다|알려\s?줘|해\s?줘|줄래|줄 수 있|할 수 있을까|가능할까|가능하신가|가능하실까|회신|답장|선택하실|선택해|골라|확인해|\?$/;
const INTENT_LABELS = { accept: '수락', reschedule: '다른 날짜', decline: '거절', ask: '질문', ack: '확인' };
const DATE_HINT = /\d+월|\d+일|\d+\/\d+|요일|오늘|내일|모레|다음\s?주|시까지|까지/;

function isSelfIntro(s) {
  return s.length <= 35 && /(입니다|이에요|예요)\.?$/.test(s) && /팀|과|부|담당|소속|학과|회사|전자/.test(s) && !ASK_RE.test(s);
}

/**
 * Sentences where the sender asks something of me (max 3).
 * @param {string[]} sentences
 * @returns {string[]}
 */
export function extractAsks(sentences) {
  return sentences
    .filter((s) => !isGreeting(s) && !isSignature(s) && ASK_RE.test(s))
    .map(stripLead)
    .slice(0, 3);
}

/**
 * Up to 3 short extractive summary sentences, in original order.
 * @param {string[]} sentences
 * @returns {string[]}
 */
export function summarize(sentences) {
  const scored = sentences
    .map((s, i) => ({ s: stripLead(s), i, raw: s }))
    .filter(({ raw }) => !isGreeting(raw) && !isSignature(raw))
    .map((x) => ({
      ...x,
      score: (isSelfIntro(x.s) ? 0 : 1) + (ASK_RE.test(x.s) ? 3 : 0) + (DATE_HINT.test(x.s) ? 2 : 0),
    }));
  return scored
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, 3)
    .sort((a, b) => a.i - b.i)
    .map((x) => (x.s.length > 70 ? `${x.s.slice(0, 68)}…` : x.s));
}

function rankIntents({ meetingAsked, allConflict, rsvp, task, hasAsks }) {
  let order;
  if (allConflict) order = ['reschedule', 'accept', 'ask', 'decline', 'ack'];
  else if (meetingAsked || rsvp) order = ['accept', 'reschedule', 'ask', 'decline', 'ack'];
  else if (task) order = ['ack', 'accept', 'ask', 'reschedule', 'decline'];
  else if (hasAsks) order = ['accept', 'ask', 'ack', 'reschedule', 'decline'];
  else order = ['ack', 'ask', 'accept', 'reschedule', 'decline'];
  return order.map((id) => ({ id, label: INTENT_LABELS[id] }));
}

/**
 * Analyze a pasted email.
 * @param {string} raw Pasted email (optional header lines first).
 * @param {{ today?: Date, availability?: string, channel?: string }} [opts]
 * @returns {object} Analysis (see BRIEF contract). Extras: deadline.time, deadline.action,
 *   schedule.alternatives, schedule.wantsNextWeek, slot.offered, relationCues.
 */
export function analyzeEmail(raw, opts = {}) {
  const today = opts.today instanceof Date ? opts.today : new Date();
  const parsed = parseHeaders(raw);
  const channel = CHANNEL_IDS.includes(opts.channel) ? opts.channel : detectFromTo(parsed);
  const body = parsed.body;
  const sentences = splitSentences(body);
  const rel = detectRelation({ from: parsed.from, subject: parsed.subject, body });
  const { items, wantsNextWeek } = scanDates(`${parsed.subject || ''}\n${body}`, today);
  const dates = items.map(({ text, date, time, kind }) => ({ text, date, time, kind }));
  const dl = pickDeadline(items, today);
  const asks = extractAsks(sentences);
  const meetings = dates.filter((d) => d.kind === 'meeting' && d.time);
  const topic = ['면접', '면담', '회의', '미팅', '통화', '발표'].find((w) => body.includes(w)) || '';
  const meetingAsked = wantsNextWeek || meetings.length >= 2
    || /(면담|미팅|약속|통화|만남|만나|회의|면접).{0,20}(가능한|편하신|언제|시간|일정)/.test(body);
  const rsvp = /참석|참여|여부/.test(body);
  const schedule = suggestSlots({
    dates,
    availability: opts.availability || '',
    today,
    wantsNextWeek,
    count: meetingAsked ? 3 : 0,
    topic,
  });
  const allConflict = meetings.length >= 2 && !schedule.slots.some((s) => s.offered);
  const tone = recommendTone({ relation: rel.relation, topic: meetingAsked ? 'schedule' : dl.date ? 'deadline' : 'general' });
  const focus = assessFocus({ body, asks, dates, deadline: dl, today, wantsNextWeek });
  return {
    channel,
    channelLabel: channelLabel(channel),
    from: parsed.from,
    subject: parsed.subject,
    body,
    relation: rel.relation,
    relationLabel: rel.relationLabel,
    relationCues: rel.cues,
    tone,
    summary: summarize(sentences),
    asks,
    dates,
    deadline: { date: dl.date, time: dl.time, label: dl.label, action: dl.action },
    focus,
    intents: rankIntents({ meetingAsked, allConflict, rsvp, task: !!dl.date && !rsvp, hasAsks: asks.length > 0 }),
    schedule: { slots: schedule.slots, tips: schedule.tips, alternatives: schedule.alternatives, wantsNextWeek },
  };
}

function detectFromTo(parsed) {
  return detectChannel(parsed.to?.address);
}
