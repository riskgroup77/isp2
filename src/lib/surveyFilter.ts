import type { Question, SurveyResponseOut } from '../types/api';

export interface SurveyFilterRule {
  questionId: string | number;
  equals?: string;
  in?: string[];
}

function getAnswerValue(answers: Record<string, unknown>, questionId: string | number): unknown {
  return answers[String(questionId)] ?? answers[questionId as keyof typeof answers];
}

function matchesRule(answers: Record<string, unknown>, rule: SurveyFilterRule): boolean {
  const value = getAnswerValue(answers, rule.questionId);
  if (rule.equals !== undefined) {
    if (Array.isArray(value)) return value.includes(rule.equals);
    return String(value ?? '') === rule.equals;
  }
  if (rule.in) {
    const current = Array.isArray(value) ? value.map(String) : [String(value ?? '')];
    return rule.in.some((v) => current.includes(v));
  }
  return true;
}

export function filterSurveyResponses(
  responses: SurveyResponseOut[],
  rules: SurveyFilterRule[]
): SurveyResponseOut[] {
  if (rules.length === 0) return responses;
  return responses.filter((r) => rules.every((rule) => matchesRule(r.answers, rule)));
}

export function getRespondentName(survey: SurveyResponseOut): string {
  const a = survey.answers;
  const extended = survey as SurveyResponseOut & { user_name?: string; ism?: string };
  if (extended.user_name) return extended.user_name;
  if (extended.ism) return extended.ism;
  const candidates = ['ism', 'fio', 'FIO', '2', '7', '8'];
  for (const key of candidates) {
    const val = a[key];
    if (typeof val === 'string' && val.trim().length > 1) return val.trim();
  }
  return `Xodim ${survey.user_id.slice(0, 8)}`;
}

export function parseBloodPressure(text: unknown): number | null {
  if (text == null) return null;
  const s = String(text);
  const match = s.match(/(\d{2,3})/);
  return match ? parseInt(match[1], 10) : null;
}

export const QUICK_FILTER_PRESETS: { label: string; rules: SurveyFilterRule[] }[] = [
  {
    label: 'Chekadigan erkaklar',
    rules: [
      { questionId: 5, equals: 'Erkak' },
      { questionId: 44, equals: 'Hozirda chekaman' },
    ],
  },
  {
    label: 'Chekadigan ayollar',
    rules: [
      { questionId: 5, equals: 'Ayol' },
      { questionId: 44, equals: 'Hozirda chekaman' },
    ],
  },
  {
    label: 'Yuqori arterial bosimli erkaklar',
    rules: [{ questionId: 5, equals: 'Erkak' }],
  },
  {
    label: 'Yuqori glyukozali ayollar',
    rules: [{ questionId: 5, equals: 'Ayol' }],
  },
];

export function applyPresetWithExtras(
  preset: (typeof QUICK_FILTER_PRESETS)[0],
  responses: SurveyResponseOut[]
): SurveyResponseOut[] {
  let filtered = filterSurveyResponses(responses, preset.rules);
  if (preset.label.includes('arterial bosimli')) {
    filtered = filtered.filter((r) => {
      const bp = parseBloodPressure(r.answers['34']);
      return bp != null && bp >= 140;
    });
  }
  if (preset.label.includes('glyukozali')) {
    filtered = filtered.filter((r) => {
      const g = r.answers['glyukoza'] ?? r.answers['4'];
      const num = typeof g === 'number' ? g : parseFloat(String(g));
      return !isNaN(num) && num >= 6.1;
    });
  }
  return filtered;
}

export function getQuestionLabel(questions: Question[], questionId: string | number): string {
  const q = questions.find((x) => String(x.id) === String(questionId));
  return q ? `#${q.id} — ${q.text.slice(0, 40)}` : `#${questionId}`;
}
