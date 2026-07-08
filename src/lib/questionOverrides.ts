const STORAGE_KEY = 'survey_question_overrides';

export function getQuestionOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveQuestionOverride(questionId: string | number, text: string) {
  const overrides = getQuestionOverrides();
  overrides[String(questionId)] = text;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function removeQuestionOverride(questionId: string | number) {
  const overrides = getQuestionOverrides();
  delete overrides[String(questionId)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function applyQuestionText(
  questionId: string | number,
  originalText: string
): string {
  const overrides = getQuestionOverrides();
  return overrides[String(questionId)] || originalText;
}
