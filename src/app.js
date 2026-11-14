// 집중비서 UI wiring. All analysis runs inside this browser tab: no network calls.
// Security rule: email and user text is only ever written through textContent /
// createElement (see h() below), never through innerHTML.
import {
  analyzeEmail,
  buildDrafts,
  polishNote,
  googleCalendarUrl,
  buildIcs,
} from './engine/index.js';
import { SAMPLES } from './samples.js';

const INTENT_IDS = ['accept', 'reschedule', 'decline', 'ask', 'ack'];
const FALLBACK_INTENT_LABELS = {
  accept: '수락',
  reschedule: '다른 날짜',
  decline: '거절',
  ask: '질문',
  ack: '확인',
};
const FOCUS_LEVELS = ['light', 'medium', 'heavy'];
const DATE_KINDS = new Set(['deadline', 'meeting', 'date']);
const KIND_LABEL = { deadline: '마감', meeting: '약속', date: '날짜' };
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const CIRCLED = ['①', '②', '③', '④', '⑤'];
const DEFAULT_AVAILABILITY = '화·목 오후 수업, 금 오전 알바';
const PROFILE_KEY = 'jipjung.profile';
const COUNTER_PREFIX = 'jipjung.saved.';
const DECISIONS_PER_EMAIL = 5;
// Recommended draft tab per tone level: formal -> 정중, polite -> 표준, casual -> 간결.
const STYLE_FOR_TONE = { formal: 'polite', polite: 'standard', casual: 'brief' };
const NOTE_HINTS = {
  accept: '덧붙일 말이 있으면 대충 적어 주세요. 문장은 비서가 다듬어요.',
  reschedule: '가능한 때를 대충 적어 주세요. 예: 목 안됨 금 3시 가능',
  decline: '거절 이유를 짧게 적어도 돼요. 예: 그날 수업 있음',
  ask: '궁금한 점을 대충 적어 주세요. 질문 문장으로 바꿔 드려요.',
  ack: '진행 계획을 한 줄 적어도 돼요. 예: 수 오전까지 수정',
};

const $ = (selector) => document.querySelector(selector);

const els = {
  counter: $('#counter'),
  counterNum: $('#counter-num'),
  channel: $('#channel'),
  samples: $('#sample-buttons'),
  input: $('#email-input'),
  inputMsg: $('#input-msg'),
  analyze: $('#analyze-btn'),
  profileSummary: $('#profile-summary'),
  name: $('#profile-name'),
  affiliation: $('#profile-affiliation'),
  availability: $('#profile-availability'),
  results: $('#results'),
  status: $('#status'),
};

const state = {
  today: todayFromQuery(),
  analysis: null,
  analyzedText: '',
  availabilityUsed: '',
  intent: null,
  note: '',
  draftStyle: null,
  view: {}, // live nodes inside the current result cards
};

// ---------- DOM helper (never uses innerHTML) ----------
function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === '') continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

function asStrings(value) {
  return Array.isArray(value) ? value.filter((s) => typeof s === 'string' && s.trim()) : [];
}

// ---------- storage (localStorage may be unavailable) ----------
function storageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode or storage disabled: keep working without persistence */
  }
}

// ---------- dates ----------
function pad2(n) {
  return String(n).padStart(2, '0');
}

function toYmd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDay(dateStr, time) {
  const d = parseYmd(dateStr);
  const base = d ? `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})` : String(dateStr || '');
  return time ? `${base} ${time}` : base;
}

// ?today=YYYY-MM-DD pins the reference date for demos; otherwise local midnight today.
function todayFromQuery() {
  const pinned = parseYmd(new URLSearchParams(window.location.search).get('today'));
  if (pinned) return pinned;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// ---------- counter: "오늘 아낀 작은 결정" ----------
function counterKey() {
  return COUNTER_PREFIX + toYmd(new Date());
}

function readCounter() {
  const n = Number.parseInt(storageGet(counterKey()) || '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function renderCounter(n = readCounter()) {
  els.counterNum.textContent = String(n);
}

function addSavedDecisions() {
  const n = readCounter() + DECISIONS_PER_EMAIL;
  storageSet(counterKey(), String(n));
  renderCounter(n);
  els.counter.classList.remove('is-bumped');
  void els.counter.offsetWidth; // restart the CSS animation
  els.counter.classList.add('is-bumped');
}

// ---------- profile: 내 정보·일정 ----------
function loadProfile() {
  let saved = {};
  try {
    saved = JSON.parse(storageGet(PROFILE_KEY) || '{}') || {};
  } catch {
    saved = {};
  }
  els.name.value = typeof saved.name === 'string' ? saved.name : '';
  els.affiliation.value = typeof saved.affiliation === 'string' ? saved.affiliation : '';
  els.availability.value =
    typeof saved.availability === 'string' ? saved.availability : DEFAULT_AVAILABILITY;
  renderProfileSummary();
}

function saveProfile() {
  storageSet(
    PROFILE_KEY,
    JSON.stringify({
      name: els.name.value,
      affiliation: els.affiliation.value,
      availability: els.availability.value,
    }),
  );
  renderProfileSummary();
}

function renderProfileSummary() {
  const parts = [els.name.value.trim(), els.availability.value.trim()].filter(Boolean);
  els.profileSummary.textContent = parts.length ? parts.join(' · ') : '입력하면 답장과 일정에 반영돼요';
}

function currentProfile() {
  const name = els.name.value.trim();
  const affiliation = els.affiliation.value.trim();
  return { name: name || undefined, affiliation: affiliation || undefined };
}

// ---------- messages ----------
function showInputMessage(text) {
  els.inputMsg.textContent = text;
}

function clearInputMessage() {
  els.inputMsg.textContent = '';
}

let statusTimer = 0;
function announce(text) {
  window.clearTimeout(statusTimer);
  els.status.textContent = '';
  statusTimer = window.setTimeout(() => {
    els.status.textContent = text;
  }, 40);
}

// ---------- analysis ----------
function intentList(analysis) {
  const list = Array.isArray(analysis?.intents)
    ? analysis.intents.filter((i) => i && INTENT_IDS.includes(i.id))
    : [];
  return list.length ? list : INTENT_IDS.map((id) => ({ id, label: FALLBACK_INTENT_LABELS[id] }));
}

function runAnalysis({ countIt = true, preset = null } = {}) {
  const raw = els.input.value;
  if (!raw.trim()) {
    showInputMessage('메일 내용을 먼저 붙여 넣어 주세요. 위의 예시 메일 버튼을 누르면 바로 체험할 수 있어요.');
    els.input.focus();
    return false;
  }

  let analysis = null;
  try {
    analysis = analyzeEmail(raw, {
      today: new Date(state.today.getTime()),
      availability: els.availability.value,
      channel: els.channel.value || undefined,
    });
  } catch (err) {
    console.error('[집중비서] analyzeEmail failed', err);
  }
  if (!analysis || typeof analysis !== 'object') {
    showInputMessage('분석 중 문제가 생겼어요. 메일 내용을 확인한 뒤 다시 시도해 주세요.');
    return false;
  }
  clearInputMessage();

  const text = raw.trim();
  const isNewEmail = text !== state.analyzedText;
  const intentIds = intentList(analysis).map((i) => i.id);
  state.analysis = analysis;
  state.analyzedText = text;
  state.availabilityUsed = els.availability.value;
  if (isNewEmail || !intentIds.includes(state.intent)) {
    state.intent = intentIds[0];
    state.note = '';
    state.draftStyle = STYLE_FOR_TONE[analysis.tone?.level] || 'standard';
  }
  if (preset?.intent && INTENT_IDS.includes(preset.intent)) state.intent = preset.intent;
  if (typeof preset?.note === 'string' && preset.note.trim()) state.note = preset.note.trim();
  if (countIt && isNewEmail) addSavedDecisions();

  renderResults();
  return true;
}

function reanalyzeIfSameEmail() {
  if (state.analysis && els.input.value.trim() === state.analyzedText) {
    runAnalysis({ countIt: false });
  }
}

// ---------- rendering ----------
function renderResults() {
  const a = state.analysis;
  state.view = {};
  els.results.replaceChildren(
    renderOverview(a),
    renderSummaryCard(a),
    renderToneCard(a),
    renderDecisionCard(a),
    renderDraftsCard(),
    renderScheduleCard(a),
  );
}

function card(num, title, ...children) {
  const id = `card-title-${num}`;
  return h(
    'section',
    { class: 'card', 'aria-labelledby': id },
    h(
      'h3',
      { class: 'card-title', id },
      h('span', { class: 'card-num', 'aria-hidden': 'true' }, CIRCLED[num - 1]),
      h('span', null, title),
    ),
    ...children,
  );
}

function badge(name, value, extraClass) {
  return h(
    'span',
    { class: extraClass ? `badge ${extraClass}` : 'badge' },
    h('span', { class: 'badge-name' }, name),
    h('span', { class: 'badge-value' }, value),
  );
}

function renderOverview(a) {
  const focus = a.focus || {};
  const level = FOCUS_LEVELS.includes(focus.level) ? focus.level : 'medium';
  const score = Math.max(0, Math.min(100, Math.round(Number(focus.score) || 0)));
  const deadline = a.deadline || {};
  const reasons = asStrings(focus.reasons);
  const fill = h('span', { class: 'meter-fill' });
  fill.style.width = `${score}%`;

  return h(
    'section',
    { class: 'card overview', 'aria-label': '한눈에 보기' },
    h(
      'div',
      { class: 'badges' },
      badge('집중력 비용', focus.label || '보통', `badge-${level}`),
      badge('처리 시점', focus.whenLabel || '오늘 안에 처리'),
      badge('메일함', a.channelLabel || '메일'),
      badge('기한', deadline.label || '기한 없음', deadline.date ? 'badge-deadline' : ''),
    ),
    h(
      'div',
      { class: `meter-row meter-${level}` },
      h('span', { class: 'meter', role: 'img', 'aria-label': `집중력 비용 ${score}점 (100점 만점)` }, fill),
      h('span', { class: 'meter-score', 'aria-hidden': 'true' }, `${score}점`),
    ),
    reasons.length
      ? h(
          'p',
          { class: 'overview-reasons' },
          h('span', { class: 'reasons-label' }, '이렇게 본 이유'),
          reasons.join(' · '),
        )
      : null,
  );
}

function senderName(from) {
  const name = String(from?.name || '').trim();
  const title = String(from?.title || '').trim();
  if (!name) return title;
  if (!title) return name;
  const stem = title.replace(/님$/, '');
  return stem && name.includes(stem) ? name : `${name} ${title}`;
}

function metaRow(label, value) {
  return h('div', { class: 'meta-row' }, h('dt', null, label), h('dd', null, value));
}

function renderSummaryCard(a) {
  const from = a.from || {};
  const sender = senderName(from) || '알 수 없음';
  const summary = asStrings(a.summary);
  const asks = asStrings(a.asks);
  return card(
    1,
    '요약·내가 할 일',
    h(
      'dl',
      { class: 'meta' },
      metaRow('보낸 사람', from.address ? `${sender} <${from.address}>` : sender),
      metaRow('관계', a.relationLabel || '상대'),
      a.subject ? metaRow('제목', a.subject) : null,
    ),
    h('h4', { class: 'sub-title' }, '요약'),
    summary.length
      ? h('ul', { class: 'list' }, summary.map((s) => h('li', null, s)))
      : h('p', { class: 'muted' }, '짧은 메일이라 따로 요약할 내용이 없어요.'),
    h('h4', { class: 'sub-title' }, '내가 할 일'),
    asks.length
      ? h('ul', { class: 'list list-todo' }, asks.map((s) => h('li', null, s)))
      : h('p', { class: 'muted' }, '따로 부탁한 일은 없어요. 확인만 해 두면 돼요.'),
  );
}

function renderToneCard(a) {
  const tone = a.tone || {};
  const tips = asStrings(tone.tips);
  return card(
    2,
    '추천 톤앤매너',
    h('p', { class: 'tone-head' }, h('span', { class: 'tone-label' }, tone.label || '정중한 존댓말')),
    tone.reason ? h('p', { class: 'tone-reason' }, tone.reason) : null,
    tips.length ? h('ul', { class: 'list list-check' }, tips.map((t) => h('li', null, t))) : null,
  );
}

function renderDecisionCard(a) {
  const intents = intentList(a);
  const recommended = intents[0].id;
  const buttons = intents.map((intent) =>
    h(
      'button',
      {
        type: 'button',
        class: intent.id === recommended ? 'btn intent-btn is-recommended' : 'btn intent-btn',
        'aria-pressed': String(intent.id === state.intent),
        'data-intent': intent.id,
        onclick: () => selectIntent(intent.id),
      },
      intent.label || FALLBACK_INTENT_LABELS[intent.id],
      intent.id === recommended ? h('span', { class: 'rec-tag' }, '추천') : null,
    ),
  );

  const noteInput = h('input', {
    type: 'text',
    id: 'note-input',
    placeholder: '예: 목 안됨 금 3시 가능',
    autocomplete: 'off',
    'aria-describedby': 'note-hint',
  });
  noteInput.value = state.note;
  noteInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      applyNote();
    }
  });
  const hint = h('p', { class: 'hint', id: 'note-hint' }, NOTE_HINTS[state.intent] || '');
  const polished = h('p', { class: 'polished' });

  state.view.intentButtons = buttons;
  state.view.noteInput = noteInput;
  state.view.noteHint = hint;
  state.view.polished = polished;
  renderPolished();

  return card(
    3,
    '내가 할 결정은 이것 하나',
    h('p', { class: 'card-lead' }, '답장 방향만 골라 주세요. 말투·문장·일정은 비서가 맞출게요.'),
    h('div', { class: 'intents', role: 'group', 'aria-label': '답장 방향' }, buttons),
    h(
      'div',
      { class: 'field note-field' },
      h('label', { for: 'note-input' }, '핵심만 대충 쓰기'),
      h(
        'div',
        { class: 'note-row' },
        noteInput,
        h('button', { type: 'button', class: 'btn btn-primary', onclick: applyNote }, '반영'),
      ),
      hint,
    ),
    polished,
  );
}

function renderPolished() {
  const box = state.view.polished;
  if (!box) return;
  box.replaceChildren();
  const note = state.note.trim();
  if (!note) return;
  let text = '';
  try {
    text = polishNote(note, state.analysis?.tone?.level || 'polite');
  } catch (err) {
    console.error('[집중비서] polishNote failed', err);
  }
  if (typeof text !== 'string' || !text.trim()) return;
  box.append(
    h('span', { class: 'polished-label' }, '비서가 다듬은 문장'),
    h('span', { class: 'polished-text' }, text),
  );
}

function selectIntent(id) {
  if (!INTENT_IDS.includes(id) || !state.analysis) return;
  state.intent = id;
  for (const btn of state.view.intentButtons || []) {
    btn.setAttribute('aria-pressed', String(btn.dataset.intent === id));
  }
  if (state.view.noteHint) state.view.noteHint.textContent = NOTE_HINTS[id] || '';
  renderDrafts();
}

function applyNote() {
  state.note = (state.view.noteInput?.value || '').trim();
  renderPolished();
  renderDrafts();
  announce(state.note ? '메모를 답장 초안에 반영했어요.' : '메모 없이 답장 초안을 다시 만들었어요.');
}

function renderDraftsCard() {
  const box = h('div', { class: 'drafts' });
  state.view.drafts = box;
  renderDrafts();
  return card(
    4,
    '답장 초안',
    h('p', { class: 'card-lead' }, '길이를 골라 복사한 뒤, 메일함의 답장 칸에 붙여 넣으세요.'),
    box,
  );
}

function renderDrafts({ focusTab = false } = {}) {
  const box = state.view.drafts;
  if (!box || !state.analysis) return;

  let drafts = [];
  try {
    drafts = buildDrafts(state.analysis, {
      intent: state.intent,
      note: state.note || undefined,
      profile: currentProfile(),
    });
  } catch (err) {
    console.error('[집중비서] buildDrafts failed', err);
  }
  drafts = Array.isArray(drafts) ? drafts.filter((d) => d && typeof d.body === 'string') : [];
  if (!drafts.length) {
    box.replaceChildren(h('p', { class: 'muted' }, '답장 초안을 만들지 못했어요. 다른 답장 방향을 골라 보세요.'));
    return;
  }
  if (!drafts.some((d) => d.style === state.draftStyle)) state.draftStyle = drafts[0].style;
  const current = drafts.find((d) => d.style === state.draftStyle);
  const recommendedStyle = STYLE_FOR_TONE[state.analysis.tone?.level];

  const tabs = drafts.map((d) => {
    const selected = d === current;
    return h(
      'button',
      {
        type: 'button',
        role: 'tab',
        class: 'tab',
        id: `draft-tab-${d.style}`,
        'aria-selected': String(selected),
        'aria-controls': 'draft-panel',
        tabindex: selected ? '0' : '-1',
        onclick: () => selectDraft(d.style, { focusTab: true }),
      },
      d.label || d.style,
      d.style === recommendedStyle
        ? [h('span', { class: 'tab-dot', 'aria-hidden': 'true' }), h('span', { class: 'visually-hidden' }, ' (추천)')]
        : null,
    );
  });
  const tablist = h('div', { class: 'tabs', role: 'tablist', 'aria-label': '답장 초안 길이' }, tabs);
  tablist.addEventListener('keydown', (event) => {
    const idx = drafts.indexOf(current);
    let next = -1;
    if (event.key === 'ArrowRight') next = (idx + 1) % drafts.length;
    else if (event.key === 'ArrowLeft') next = (idx - 1 + drafts.length) % drafts.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = drafts.length - 1;
    if (next < 0) return;
    event.preventDefault();
    selectDraft(drafts[next].style, { focusTab: true });
  });

  const copyBtn = h(
    'button',
    { type: 'button', class: 'btn btn-primary btn-small', title: '답장 본문을 복사해요' },
    '복사',
  );
  copyBtn.addEventListener('click', () => copyDraft(current, copyBtn));

  box.replaceChildren(
    h('div', { class: 'draft-head' }, tablist, copyBtn),
    h(
      'div',
      {
        class: 'draft',
        role: 'tabpanel',
        id: 'draft-panel',
        'aria-labelledby': `draft-tab-${current.style}`,
        tabindex: '0',
      },
      h(
        'div',
        { class: 'draft-subject' },
        h('span', { class: 'draft-subject-label' }, '제목'),
        h('span', { class: 'draft-subject-text' }, current.subject || ''),
      ),
      h('div', { class: 'draft-body' }, current.body),
    ),
  );
  if (focusTab) document.getElementById(`draft-tab-${current.style}`)?.focus();
}

function selectDraft(style, { focusTab = false } = {}) {
  state.draftStyle = style;
  renderDrafts({ focusTab });
}

// ---------- clipboard ----------
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall back below */
  }
  const area = h('textarea', { class: 'visually-hidden', readonly: true, 'aria-hidden': 'true' });
  area.value = text;
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

async function copyDraft(draft, btn) {
  const ok = await copyText(draft.body);
  btn.textContent = ok ? '복사됨' : '복사 실패';
  btn.classList.toggle('is-done', ok);
  announce(
    ok
      ? '답장 본문을 복사했어요. 메일함 답장 칸에 붙여 넣으세요.'
      : '복사하지 못했어요. 본문을 직접 선택해서 복사해 주세요.',
  );
  window.setTimeout(() => {
    btn.textContent = '복사';
    btn.classList.remove('is-done');
  }, 1800);
}

// ---------- schedule ----------
function calendarUrl(event) {
  try {
    const url = googleCalendarUrl(event);
    return typeof url === 'string' && url.startsWith('https://calendar.google.com/') ? url : null;
  } catch (err) {
    console.error('[집중비서] googleCalendarUrl failed', err);
    return null;
  }
}

function downloadIcs(event, stem) {
  let text = '';
  try {
    text = buildIcs(event);
  } catch (err) {
    console.error('[집중비서] buildIcs failed', err);
  }
  if (typeof text !== 'string' || !text) {
    announce('.ics 파일을 만들지 못했어요.');
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  const link = h('a', { href: url, download: `${stem}.ics`, class: 'visually-hidden' });
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  announce('.ics 파일을 저장했어요. 캘린더 앱에서 열면 일정이 추가돼요.');
}

function eventRow({ chip, chipClass, when, note, event }) {
  const url = calendarUrl(event);
  const stem = `jipjung-${event.date}${event.time ? `-${event.time}` : ''}`.replace(/[^0-9A-Za-z-]/g, '');
  return h(
    'li',
    { class: 'event' },
    h(
      'div',
      { class: 'event-info' },
      h('span', { class: `chip ${chipClass}` }, chip),
      h('strong', { class: 'event-when' }, when),
      note ? h('span', { class: 'event-note' }, `“${note}”`) : null,
    ),
    h(
      'div',
      { class: 'event-actions' },
      url
        ? h(
            'a',
            {
              class: 'btn btn-small btn-soft',
              href: url,
              target: '_blank',
              rel: 'noopener noreferrer',
              'aria-label': `${when} 구글 캘린더에 추가 (새 창)`,
            },
            '구글 캘린더에 추가',
          )
        : null,
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-small',
          'aria-label': `${when} .ics 저장`,
          onclick: () => downloadIcs(event, stem),
        },
        '.ics 저장',
      ),
    ),
  );
}

function renderScheduleCard(a) {
  const dates = (Array.isArray(a.dates) ? a.dates : []).filter((d) => d && parseYmd(d.date));
  // Slots that repeat a date already listed from the email (e.g. offered interview times) are skipped.
  const listed = new Set(dates.map((d) => `${d.date} ${d.time || ''}`));
  const slots = (Array.isArray(a.schedule?.slots) ? a.schedule.slots : []).filter(
    (s) => s && parseYmd(s.date) && !listed.has(`${s.date} ${s.time || ''}`),
  );
  const tips = asStrings(a.schedule?.tips);
  const subject = String(a.subject || '').trim() || '메일 일정';
  const sender = senderName(a.from) || a.relationLabel || '';
  const details = [
    '집중비서에서 정리한 일정',
    a.channelLabel ? `메일함: ${a.channelLabel}` : '',
    sender ? `보낸 사람: ${sender}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const children = [];
  if (dates.length) {
    children.push(
      h('h4', { class: 'sub-title' }, '메일에 나온 날짜'),
      h(
        'ul',
        { class: 'events' },
        dates.map((d) => {
          const kind = DATE_KINDS.has(d.kind) ? d.kind : 'date';
          return eventRow({
            chip: KIND_LABEL[kind],
            chipClass: `chip-${kind}`,
            when: formatDay(d.date, d.time),
            note: typeof d.text === 'string' ? d.text : '',
            event: {
              title: kind === 'deadline' ? `[마감] ${subject}` : subject,
              date: d.date,
              time: d.time || undefined,
              durationMin: d.time ? (kind === 'meeting' ? 60 : 30) : undefined,
              details,
            },
          });
        }),
      ),
    );
  }
  if (slots.length) {
    children.push(
      h('h4', { class: 'sub-title' }, '내 일정 메모를 피한 후보 시간'),
      h(
        'ul',
        { class: 'events' },
        slots.map((s) =>
          eventRow({
            chip: '후보',
            chipClass: 'chip-slot',
            when: s.label || formatDay(s.date, s.time),
            note: '',
            event: {
              title: subject,
              date: s.date,
              time: s.time || undefined,
              durationMin: s.time ? 30 : undefined,
              details,
            },
          }),
        ),
      ),
    );
  }
  if (!dates.length && !slots.length) {
    children.push(h('p', { class: 'muted' }, '이 메일에는 캘린더에 넣을 날짜가 없어요.'));
  }
  if (tips.length) {
    children.push(
      h('h4', { class: 'sub-title' }, '일정 팁'),
      h('ul', { class: 'list' }, tips.map((t) => h('li', null, t))),
    );
  }
  children.push(
    h(
      'p',
      { class: 'privacy-note' },
      '구글 캘린더 버튼은 일정 제목·날짜만 구글로 보내요. .ics 파일은 이 기기에만 저장돼요.',
    ),
  );
  return card(5, '일정 조언', ...children);
}

// ---------- input panel ----------
function scrollToResultsIfStacked() {
  if (!window.matchMedia('(max-width: 959px)').matches) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  els.results.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

function loadSample(sample, preset = null) {
  els.input.value = sample.text;
  els.channel.value = sample.channel;
  const ok = runAnalysis({ preset });
  if (ok && !preset) scrollToResultsIfStacked();
}

function renderSampleButtons() {
  els.samples.replaceChildren(
    ...SAMPLES.map((sample) => {
      const [channel, ...rest] = sample.label.split(' · ');
      return h(
        'button',
        { type: 'button', class: 'btn sample-btn', onclick: () => loadSample(sample) },
        h('span', { class: 'sample-channel' }, channel),
        h('span', { class: 'visually-hidden' }, ' · '),
        h('span', { class: 'sample-topic' }, rest.join(' · ')),
      );
    }),
  );
}

let profileTimer = 0;
function onProfileInput() {
  window.clearTimeout(profileTimer);
  profileTimer = window.setTimeout(() => {
    saveProfile();
    if (!state.analysis) return;
    if (els.availability.value !== state.availabilityUsed) reanalyzeIfSameEmail();
    else renderDrafts();
  }, 350);
}

function wireEvents() {
  els.analyze.addEventListener('click', () => {
    if (runAnalysis()) scrollToResultsIfStacked();
  });
  els.input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) {
      event.preventDefault();
      els.analyze.click();
    }
  });
  els.input.addEventListener('input', () => {
    if (els.input.value.trim()) clearInputMessage();
  });
  els.channel.addEventListener('change', reanalyzeIfSameEmail);
  for (const field of [els.name, els.affiliation, els.availability]) {
    field.addEventListener('input', onProfileInput);
  }
}

// ?sample=N (1-based) auto-loads and analyzes; &intent=...&note=... preset the decision.
function applyQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const n = Number.parseInt(params.get('sample') || '', 10);
  const sample = SAMPLES.find((s) => s.id === n);
  if (!sample) return;
  const intent = params.get('intent');
  loadSample(sample, {
    intent: INTENT_IDS.includes(intent) ? intent : null,
    note: params.get('note') || '',
  });
}

function init() {
  renderCounter();
  loadProfile();
  renderSampleButtons();
  wireEvents();
  applyQueryParams();
}

init();
