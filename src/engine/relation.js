// Who sent this? Cue-based relation scoring.
import { splitSentences } from './text.js';

/** Korean labels per relation id. */
export const RELATION_LABELS = {
  professor: '교수님',
  boss: '직장 상사',
  recruiter: '채용 담당자',
  client: '고객·거래처',
  senior: '선배',
  colleague: '동료',
  friend: '친구',
  unknown: '상대',
};

const PRIORITY = ['professor', 'recruiter', 'client', 'boss', 'senior', 'colleague', 'friend'];
const CASUAL_END = /[해야지줘어아자니냐래게라봐와워걸거음함듯]$/;

function count(re, s) {
  const m = s.match(new RegExp(re.source, 'g'));
  return m ? m.length : 0;
}

/**
 * Count sentences that end in 반말 (casual speech).
 * @param {string} body
 * @returns {number}
 */
export function casualEndings(body) {
  return splitSentences(body).filter((s) => {
    const core = s.replace(/[\s.!?~…ㅋㅎㅠㅜ^]+$/g, '').replace(/[^가-힣]+$/, '');
    if (!core || /(요|다|까|죠|오|님|림)$/.test(core)) return false;
    return CASUAL_END.test(core);
  }).length;
}

/**
 * Detect the sender's relation to me from headers and body cues.
 * @param {{ from?: {name?:string|null,address?:string|null,title?:string|null}, subject?: string|null, body?: string }} input
 * @returns {{ relation: string, relationLabel: string, cues: string[] }}
 */
export function detectRelation({ from = {}, subject = '', body = '' } = {}) {
  const title = from?.title || '';
  const addr = from?.address || '';
  const text = `${from?.name || ''} ${title}\n${subject || ''}\n${body || ''}`;
  const score = Object.fromEntries(PRIORITY.map((r) => [r, 0]));
  const cues = [];
  const add = (rel, pts, cue) => {
    score[rel] += pts;
    cues.push(cue);
  };

  if (/교수/.test(title)) add('professor', 6, '보낸 사람 직함: 교수');
  if (/교수|연구실/.test(body)) add('professor', 3, '본문에 교수·연구실');
  if (/^[가-힣]{2,4}\s?학생[,\s]/m.test(body)) add('professor', 3, "'OO 학생' 호칭");
  const acad = count(/학번|수강|강의|과제|학점|성적|지도교수|조교/, text);
  if (acad) add('professor', acad, '수업·학사 관련 단어');
  if (/\.(ac\.kr|edu)$/.test(addr)) add('professor', 1, '대학 메일 주소');

  if (/팀장|부장|과장|차장|실장|본부장|대표|이사|사수|파트장/.test(title)) add('boss', 6, `보낸 사람 직함: ${title}`);
  if (/팀장님|부장님|과장님|차장님|실장님|본부장님|사수/.test(body)) add('boss', 2, '본문에 상사 직함');
  if (/[가-힣]{1,4}\s?씨[,\s]/.test(body) && /부탁드립니다|해\s?주세요|주시기|바랍니다|공유/.test(body)) add('boss', 3, "'OO 씨' + 업무 지시");

  const rec = count(/인사팀|인사\s?담당|채용|면접|서류\s?전형|HR|합격|지원자|지원하신|입사/, text);
  if (rec) add('recruiter', rec * 2, '채용·면접 관련 단어');
  if (/(^|[.@])(hr|recruit|careers?|jobs)[.@]/.test(addr)) add('recruiter', 2, '채용 담당 메일 주소');

  const cli = count(/고객|거래처|귀사|견적|발주|협력사|계약|납품/, text);
  if (cli) add('client', cli * 2, '거래·견적 관련 단어');

  if (/선배/.test(title)) add('senior', 6, '보낸 사람: 선배');
  else if (/선배/.test(body)) add('senior', 3, '본문에 선배');

  const col = count(/팀원|동료|동기/, text);
  if (col) add('colleague', col * 2, '동료 관련 단어');

  const casual = casualEndings(body);
  if (casual) add('friend', casual * 2, '반말 문장');
  if (/ㅋㅋ|ㅎㅎ|ㅠㅠ/.test(body)) add('friend', 2, 'ㅋㅋ·ㅎㅎ');
  if (/안녕[!~]/.test(body)) add('friend', 2, "'안녕!' 인사");
  if (/^[가-힣]{1,3}[아야][,!]?\s/m.test(body)) add('friend', 1, "'OO아' 호칭");

  let best = 'unknown';
  let bestScore = 1;
  for (const r of PRIORITY) {
    if (score[r] > bestScore) {
      best = r;
      bestScore = score[r];
    }
  }
  return { relation: best, relationLabel: RELATION_LABELS[best], cues };
}
