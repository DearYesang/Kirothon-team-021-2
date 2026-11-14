// Public engine API (pure, browser-compatible ES modules).
export { analyzeEmail, extractAsks, summarize } from './analyze.js';
export { buildDrafts, polishNote } from './drafts.js';
export { googleCalendarUrl, buildIcs } from './calendar.js';
export { parseAvailability, suggestSlots } from './schedule.js';
export { parseHeaders, parseAddress, detectChannel, channelLabel } from './headers.js';
export { detectRelation, RELATION_LABELS } from './relation.js';
export { recommendTone, TONE_LABELS } from './tone.js';
export { assessFocus } from './focus.js';
export { extractDates, pickDeadline, parseTimeAt, toYmd, parseYmd, addDays, mdLabel } from './dates.js';
export { splitSentences, normalizeText, DOW_KO } from './text.js';
