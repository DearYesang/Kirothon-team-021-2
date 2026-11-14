// Text helpers: normalization, sentence splitting, Korean particles.

/** Korean weekday short names indexed by Date#getDay(). */
export const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

const TERMINATORS = '.!?~…。';

/**
 * Normalize pasted text: unify newlines and odd spaces, trim lines, squeeze blank lines.
 * @param {string} s
 * @returns {string}
 */
export function normalizeText(s) {
  return String(s ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\u2000-\u200b\u3000\t]/g, ' ')
    .split('\n')
    .map((l) => l.replace(/ {2,}/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Split text into sentences on line breaks and on . ! ? ~ followed by a space.
 * '2~3개' or '2026.11.16' are not split.
 * @param {string} text
 * @returns {string[]}
 */
export function splitSentences(text) {
  const out = [];
  const push = (s) => {
    const t = s.trim();
    if (t) out.push(t);
  };
  for (const line of normalizeText(text).split('\n')) {
    let buf = '';
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      buf += ch;
      const next = line[i + 1];
      if (TERMINATORS.includes(ch) && (next === undefined || next === ' ')) {
        push(buf);
        buf = '';
      }
    }
    push(buf);
  }
  return out;
}

/**
 * Remove a leading vocative ('길동 씨, ', '홍길동 학생, ') and filler conjunctions ('그리고 ').
 * @param {string} sentence
 * @returns {string}
 */
export function stripLead(sentence) {
  return String(sentence)
    .replace(/^[가-힣A-Za-z]{1,10}\s?(씨|님|학생|교수님|팀장님|선배님|선배)\s*,\s*/, '')
    .replace(/^[가-힣]{1,4}[아야][,!]?\s+(?=안녕)/, '')
    .replace(/^(그리고|또한|아울러|그럼|그래서|참고로|덧붙여)\s*,?\s*/, '')
    .trim();
}

/**
 * True when the sentence is only a greeting ('안녕하세요.', '길동아 안녕!').
 * @param {string} sentence
 * @returns {boolean}
 */
export function isGreeting(sentence) {
  const s = stripLead(sentence);
  return /^(안녕하세요|안녕하십니까|안녕[!~.]*$|반갑습니다|수고\s?많으십니다|수고하십니다|좋은\s?(아침|오후)입니다)/.test(s)
    && s.length <= 25;
}

/**
 * True when the sentence looks like a sign-off ('김민수 드림', '감사합니다.').
 * @param {string} sentence
 * @returns {boolean}
 */
export function isSignature(sentence) {
  const s = sentence.trim();
  if (s.length <= 20 && /(드림|올림|배상)[.!]?$/.test(s)) return true;
  if (/^(감사합니다|고맙습니다|고마워|감사해요)[.!~]*$/.test(s)) return true;
  return /^-{2,}/.test(s);
}

/**
 * True when the last Hangul syllable of `word` has a final consonant (받침).
 * Digits are read in Sino-Korean ('3' = 삼 → true).
 * @param {string} word
 * @returns {boolean}
 */
export function hasBatchim(word) {
  const s = String(word).replace(/[^가-힣0-9A-Za-z]+$/, '');
  const ch = s[s.length - 1];
  if (!ch) return false;
  if (/[0-9]/.test(ch)) return '013678'.includes(ch);
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

/**
 * Append the topic particle 은/는 unless the word already ends with a particle.
 * @param {string} word
 * @returns {string}
 */
export function withTopic(word) {
  const w = String(word).trim();
  if (!w) return w;
  if (/(은|는|도|만|이|가)$/.test(w) && w.length > 1 && !/요일$/.test(w)) return w;
  return w + (hasBatchim(w) ? '은' : '는');
}
