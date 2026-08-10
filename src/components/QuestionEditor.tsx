import React, { useEffect, useState } from 'react';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import { getSurveyQuestions } from '../lib/api';
import {
  getQuestionDisplayText,
  getQuestionDescription,
  type SurveyLanguage,
} from '../lib/questionnaireI18n';
import {
  getQuestionOverrides,
  removeQuestionOverride,
  saveQuestionOverride,
} from '../lib/questionOverrides';
import { formatApiError } from '../lib/surveyUtils';
import type { Question } from '../types/api';

export default function QuestionEditor() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    getSurveyQuestions()
      .then((q) => {
        setQuestions(q.questions);
        const overrides = getQuestionOverrides();
        const initial: Record<string, string> = {};
        q.questions.forEach((question) => {
          const key = String(question.id);
          initial[key] = overrides[key] || question.text;
        });
        setEdits(initial);
      })
      .catch((err) => setErrorMsg(formatApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = (questionId: string | number) => {
    const key = String(questionId);
    const original = questions.find((q) => String(q.id) === key)?.text || '';
    const text = edits[key]?.trim();
    if (!text || text === original) {
      removeQuestionOverride(key);
    } else {
      saveQuestionOverride(key, text);
    }
    setSavedMsg(`Savol #${key} saqlandi`);
    setTimeout(() => setSavedMsg(null), 2000);
  };

  const handleReset = (questionId: string | number) => {
    const key = String(questionId);
    const original = questions.find((q) => String(q.id) === key)?.text || '';
    removeQuestionOverride(key);
    setEdits((prev) => ({ ...prev, [key]: original }));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
        Anketa savollarining lotin matnini tahrirlang. Kirill versiyasi backenddan{' '}
        <code className="text-xs bg-amber-100 px-1 rounded">textCyrl</code> maydoni orqali keladi.
        O&apos;zgarishlar brauzerda saqlanadi (serverdagi asl matn o&apos;zgarmaydi).
      </div>

      {savedMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm font-semibold">
          {savedMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{errorMsg}</div>
      )}

      <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
        {questions.map((q) => {
          const key = String(q.id);
          const isModified = edits[key] !== q.text;
          const previewQ = { ...q, text: edits[key] || q.text };
          return (
            <div
              key={key}
              className="bg-white rounded-xl border border-slate-200 p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  #{q.id} · {q.section} · {q.type}
                </span>
                {isModified && (
                  <span className="text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                    Tahrirlangan
                  </span>
                )}
              </div>
              <textarea
                value={edits[key] || ''}
                onChange={(e) => setEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                rows={2}
                className="w-full p-3 rounded-xl border border-slate-200 text-sm"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                <p className="text-slate-500 bg-slate-50 p-2 rounded-lg">
                  <span className="font-bold text-slate-600">Lotin:</span>{' '}
                  {getQuestionDisplayText(previewQ, 'lotin').slice(0, 100)}...
                </p>
                <p className="text-slate-500 bg-slate-50 p-2 rounded-lg">
                  <span className="font-bold text-slate-600">Kirill:</span>{' '}
                  {getQuestionDisplayText(previewQ, 'kirill').slice(0, 100)}...
                </p>
              </div>
              {getQuestionDescription(q, 'kirill') && (
                <p className="text-[10px] text-indigo-600">
                  Backend kirill izoh: {getQuestionDescription(q, 'kirill')?.slice(0, 80)}...
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSave(q.id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                >
                  <Save className="w-3 h-3" />
                  Saqlash
                </button>
                <button
                  type="button"
                  onClick={() => handleReset(q.id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600"
                >
                  <RotateCcw className="w-3 h-3" />
                  Asl holat
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
