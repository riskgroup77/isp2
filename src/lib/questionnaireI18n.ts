import { latinToCyrillic } from './lang';
import { getQuestionOverrides } from './questionOverrides';
import type { Question, Questionnaire } from '../types/api';

export type SurveyLanguage = 'lotin' | 'kirill';

export function isCyrillicLang(lang: SurveyLanguage): boolean {
  return lang === 'kirill';
}

export function getQuestionnaireTitle(q: Questionnaire, lang: SurveyLanguage): string {
  if (isCyrillicLang(lang) && q.titleCyrl) return q.titleCyrl;
  return q.title;
}

export function getLocalizedSection(
  q: Questionnaire,
  latinSection: string,
  lang: SurveyLanguage
): string {
  const idx = q.sections.indexOf(latinSection);
  if (isCyrillicLang(lang) && idx >= 0 && q.sectionsCyrl?.[idx]) {
    return q.sectionsCyrl[idx];
  }
  if (isCyrillicLang(lang)) {
    const qInSection = q.questions.find((item) => item.section === latinSection);
    if (qInSection?.sectionCyrl) return qInSection.sectionCyrl;
    return latinToCyrillic(latinSection);
  }
  return latinSection;
}

export function getQuestionDisplayText(q: Question, lang: SurveyLanguage): string {
  const override = getQuestionOverrides()[String(q.id)];
  if (isCyrillicLang(lang)) {
    if (override) return latinToCyrillic(override);
    return q.textCyrl || latinToCyrillic(q.text);
  }
  return override || q.text;
}

export function getQuestionDescription(
  q: Question,
  lang: SurveyLanguage
): string | null | undefined {
  if (!q.description && !q.descriptionCyrl) return null;
  if (isCyrillicLang(lang)) {
    return q.descriptionCyrl || (q.description ? latinToCyrillic(q.description) : null);
  }
  return q.description;
}

export interface QuestionOptionPair {
  value: string;
  label: string;
}

export function getQuestionOptionPairs(q: Question, lang: SurveyLanguage): QuestionOptionPair[] {
  return q.options.map((opt, i) => ({
    value: opt,
    label:
      isCyrillicLang(lang) && q.optionsCyrl?.[i]
        ? q.optionsCyrl[i]
        : opt,
  }));
}

export function getOptionDisplayLabel(
  q: Question | undefined,
  value: string,
  lang: SurveyLanguage
): string {
  if (!q) return value;
  const pairs = getQuestionOptionPairs(q, lang);
  const match = pairs.find((p) => p.value === value);
  return match?.label ?? value;
}

export function getConsentValue(q: Question): string {
  const roziman = q.options.find((o) => o.toLowerCase().includes('roziman'));
  return roziman || 'Roziman';
}
