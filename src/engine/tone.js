// Recommended tone & manner per relation.

const LEVEL_BY_RELATION = {
  professor: 'formal',
  boss: 'formal',
  recruiter: 'formal',
  client: 'formal',
  senior: 'polite',
  colleague: 'polite',
  unknown: 'polite',
  friend: 'casual',
};

/** Korean labels per tone level. */
export const TONE_LABELS = {
  formal: '격식체 (~습니다)',
  polite: '해요체 (~요)',
  casual: '반말 (편하게)',
};

const TIPS = {
  professor: ['첫 줄에 학과·학번·이름 밝히기', '가능한 시간은 2~3개를 날짜·요일·시간까지', '마무리는 "OOO 올림"'],
  boss: ['결론 먼저, 기한 명시', '쿠션어: 번거로우시겠지만 / 확인 부탁드립니다', '마무리는 "OOO 드림"'],
  recruiter: ['첫 줄에 지원자 이름 밝히기', '선택한 일정을 날짜·요일·시간까지 정확히', '마무리는 "OOO 드림"'],
  client: ['인사 후 용건을 한 문장으로', '쿠션어: 번거로우시겠지만, 괜찮으시다면', '마무리는 "OOO 드림"'],
  senior: ['"선배님" 호칭으로 시작', '부탁할 땐 "혹시 ~해 주실 수 있을까요?"', '감사 인사로 마무리'],
  colleague: ['용건 먼저, 짧게', '부탁은 "~해 주실 수 있을까요?"로 부드럽게'],
  friend: ['편하게 반말 OK', '답할 것(참석 여부·날짜)만 확실히'],
  unknown: ['인사 + 자기소개 한 줄', '용건과 기한을 분명하게', '마무리는 "감사합니다. OOO 드림"'],
};

/**
 * Recommend a tone level with a one-sentence reason and 2-3 concrete tips.
 * @param {{ relation: string, topic?: 'schedule'|'deadline'|'general' }} input
 * @returns {{ level: 'formal'|'polite'|'casual', label: string, tips: string[], reason: string }}
 */
export function recommendTone({ relation = 'unknown', topic = 'general' } = {}) {
  const rel = LEVEL_BY_RELATION[relation] ? relation : 'unknown';
  const level = LEVEL_BY_RELATION[rel];
  const what = topic === 'schedule' ? '일정 회신' : topic === 'deadline' ? '업무 회신' : '답장';
  const reasons = {
    professor: `교수님께 드리는 ${what}이라 격식체가 안전해요.`,
    boss: `직장 상사에게 드리는 ${what}이라 격식체가 안전해요.`,
    recruiter: '채용 담당자에게 보내는 답장은 첫인상이 되니 격식체가 안전해요.',
    client: '고객·거래처에는 회사를 대표하는 말이라 격식체가 안전해요.',
    senior: '선배에게는 예의 있으면서 부드러운 해요체가 자연스러워요.',
    colleague: '동료에게는 부드러운 해요체가 무난해요.',
    friend: '친구가 반말로 보냈으니 편한 반말로 답해도 괜찮아요.',
    unknown: '관계를 확실히 알 수 없어 무난한 해요체를 추천해요.',
  };
  return { level, label: TONE_LABELS[level], tips: TIPS[rel].slice(0, 3), reason: reasons[rel] };
}
