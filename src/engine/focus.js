// Focus cost (집중력 비용) and when to handle the email.
import { daysBetween, mdLabel, parseYmd } from './dates.js';

const DECISION_WORDS = ['검토', '결정', '승인', '피드백', '수정', '보고서', '첨부', '의견', '선택', '발표', '확정'];

const LEVELS = {
  light: { label: '가벼움', when: 'now', whenLabel: '1분이면 끝 → 지금 처리' },
  medium: { label: '보통', when: 'batch', whenLabel: '오늘 오후 몰아서 처리' },
  heavy: { label: '무거움', when: 'deep', whenLabel: '집중 시간에 처리 (예: 내일 오전)' },
};

/**
 * Score how much focus the email costs (0-100) and when to handle it.
 * light < 30 <= medium < 60 <= heavy. A deadline today/tomorrow forces 'now'.
 * @param {{ body: string, asks?: string[], dates?: Array<{date:string}>, deadline?: {date:string|null}, today: Date, wantsNextWeek?: boolean }} input
 * @returns {{ level:'light'|'medium'|'heavy', label:string, score:number, when:'now'|'batch'|'deep', whenLabel:string, reasons:string[] }}
 */
export function assessFocus({ body = '', asks = [], dates = [], deadline = { date: null }, today, wantsNextWeek = false }) {
  const len = String(body).replace(/\s+/g, '').length;
  const found = DECISION_WORDS.filter((w) => body.includes(w));
  const score = Math.min(
    100,
    Math.min(20, Math.round(len / 15))
      + Math.min(3, asks.length) * 8
      + Math.min(40, found.length * 10)
      + Math.min(20, dates.length * 5)
      + (wantsNextWeek ? 4 : 0),
  );
  const level = score < 30 ? 'light' : score < 60 ? 'medium' : 'heavy';
  const reasons = [`${len < 150 ? '짧은' : len < 400 ? '보통 길이' : '긴'} 메일 (${len}자)`];
  reasons.push(asks.length ? `요청 ${asks.length}건` : '직접 요청 없음');
  if (found.length) reasons.push(`판단·작업 필요: ${found.slice(0, 4).join('·')}`);
  if (dates.length) reasons.push(`챙길 날짜 ${dates.length}개`);
  let { when, whenLabel } = LEVELS[level];
  if (deadline?.date && today) {
    const diff = daysBetween(today, parseYmd(deadline.date));
    if (diff >= 0 && diff <= 1) {
      when = 'now';
      whenLabel = '마감 임박 → 지금 처리';
      reasons.push(`마감이 ${diff === 0 ? '오늘' : '내일'}(${mdLabel(deadline.date)})이라 바로 처리`);
    }
  }
  return { level, label: LEVELS[level].label, score, when, whenLabel, reasons };
}
