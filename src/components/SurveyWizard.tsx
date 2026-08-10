import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Loader2,
  AlertCircle,
  Activity,
  ClipboardList,
} from 'lucide-react';
import { getSurveyQuestions, submitSurvey } from '../lib/api';
import {
  getConsentValue,
  getLocalizedSection,
  getQuestionDescription,
  getQuestionDisplayText,
  getQuestionnaireTitle,
  getQuestionOptionPairs,
} from '../lib/questionnaireI18n';
import { formatApiError, isQuestionVisible } from '../lib/surveyUtils';
import type { ClinicalData, Question, Questionnaire, SurveySubmitResponse } from '../types/api';
import type { UserProfile } from '../types';
import { t } from '../lib/lang';

interface SurveyWizardProps {
  currentUser: UserProfile;
  language?: 'lotin' | 'kirill';
  onComplete: (result: SurveySubmitResponse) => void;
}

const CLINICAL_STEP = '__klinik__';

const defaultClinical: ClinicalData = {
  sistolik: 120,
  diastolik: 80,
  vazn: 75,
  boy: 170,
  glyukoza: undefined,
  xolesterin: undefined,
};

export default function SurveyWizard({
  currentUser,
  language = 'lotin',
  onComplete,
}: SurveyWizardProps) {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [clinical, setClinical] = useState<ClinicalData>({
    ...defaultClinical,
    vazn: currentUser.vazn || defaultClinical.vazn,
    boy: currentUser.boy || defaultClinical.boy,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitProgress, setSubmitProgress] = useState('');

  useEffect(() => {
    getSurveyQuestions()
      .then(setQuestionnaire)
      .catch((err) => setErrorMsg(formatApiError(err)))
      .finally(() => setLoadingQuestions(false));
  }, []);

  const steps = useMemo(() => {
    if (!questionnaire) return [];
    return [...questionnaire.sections, CLINICAL_STEP];
  }, [questionnaire]);

  const currentStep = steps[stepIndex];
  const isClinicalStep = currentStep === CLINICAL_STEP;

  const visibleQuestions = useMemo(() => {
    if (!questionnaire || isClinicalStep) return [];
    return questionnaire.questions.filter(
      (q) => q.section === currentStep && isQuestionVisible(q, answers)
    );
  }, [questionnaire, currentStep, answers, isClinicalStep]);

  const setAnswer = (id: string | number, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [String(id)]: value }));
  };

  const toggleMulti = (id: string | number, optionValue: string) => {
    const key = String(id);
    const current = Array.isArray(answers[key]) ? (answers[key] as string[]) : [];
    const next = current.includes(optionValue)
      ? current.filter((o) => o !== optionValue)
      : [...current, optionValue];
    setAnswer(id, next);
  };

  const consentQuestion = useMemo(
    () => questionnaire?.questions.find((q) => String(q.id) === '1'),
    [questionnaire]
  );
  const consentValue = consentQuestion ? getConsentValue(consentQuestion) : 'Roziman';

  const validateStep = (): string | null => {
    if (isClinicalStep) {
      if (clinical.sistolik < 70 || clinical.sistolik > 250) return 'Sistolik bosim noto\'g\'ri';
      if (clinical.diastolik < 40 || clinical.diastolik > 150) return 'Diastolik bosim noto\'g\'ri';
      if (clinical.vazn <= 0 || clinical.boy <= 0) return 'Vazn va bo\'y kiritilishi shart';
      return null;
    }
    for (const q of visibleQuestions) {
      if (!q.required) continue;
      const val = answers[String(q.id)];
      if (q.type === 'multi_choice') {
        if (!Array.isArray(val) || val.length === 0) {
          return `"${getQuestionDisplayText(q, language).slice(0, 60)}..." — ${t('javob tanlang', language)}`;
        }
      } else if (val === undefined || val === null || val === '') {
        return `"${getQuestionDisplayText(q, language).slice(0, 60)}..." — ${t('majburiy savol', language)}`;
      }
    }
    if (currentStep === 'Kirish' || stepIndex === 0) {
      if (answers['1'] !== consentValue) {
        return language === 'kirill'
          ? 'Давом etish uchun rozilik bering (Розиман)'
          : "Davom etish uchun rozilik bering (Roziman)";
      }
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) {
      setErrorMsg(err);
      return;
    }
    setErrorMsg(null);
    if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
  };

  const handleBack = () => {
    setErrorMsg(null);
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  const handleSubmit = async () => {
    const err = validateStep();
    if (err) {
      setErrorMsg(err);
      return;
    }
    if (answers['1'] !== consentValue) {
      setErrorMsg(language === 'kirill' ? 'Розilik berilmagan' : 'Rozilik berilmagan');
      return;
    }

    const finalAnswers = { ...answers };
    if (finalAnswers['4'] == null) finalAnswers['4'] = clinical.vazn;

    setSubmitting(true);
    setErrorMsg(null);
    setSubmitProgress('So\'rovnoma yuborilmoqda...');

    const progressTimer = setTimeout(
      () => setSubmitProgress('AI tahlil bajarilmoqda, 30–60 soniya kuting...'),
      3000
    );

    try {
      const result = await submitSurvey(finalAnswers, clinical, false);
      onComplete(result);
    } catch (err) {
      setErrorMsg(formatApiError(err));
    } finally {
      clearTimeout(progressTimer);
      setSubmitting(false);
      setSubmitProgress('');
    }
  };

  const renderQuestion = (q: Question) => {
    const key = String(q.id);
    const val = answers[key];
    const optionPairs = getQuestionOptionPairs(q, language);

    if (q.type === 'single_choice') {
      return (
        <div className="space-y-2">
          {optionPairs.map(({ value, label }) => (
            <label
              key={value}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                val === value
                  ? 'border-emerald-500 bg-emerald-50/60'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name={`q-${key}`}
                checked={val === value}
                onChange={() => setAnswer(q.id, value)}
                className="accent-emerald-600"
              />
              <span className="text-sm text-slate-700">{label}</span>
            </label>
          ))}
        </div>
      );
    }

    if (q.type === 'multi_choice') {
      const selected = Array.isArray(val) ? (val as string[]) : [];
      return (
        <div className="space-y-2">
          {optionPairs.map(({ value, label }) => (
            <label
              key={value}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                selected.includes(value)
                  ? 'border-emerald-500 bg-emerald-50/60'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.includes(value)}
                onChange={() => toggleMulti(q.id, value)}
                className="accent-emerald-600"
              />
              <span className="text-sm text-slate-700">{label}</span>
            </label>
          ))}
        </div>
      );
    }

    if (q.type === 'number') {
      return (
        <input
          type="number"
          value={val != null ? String(val) : ''}
          onChange={(e) => setAnswer(q.id, e.target.value === '' ? '' : Number(e.target.value))}
          className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
        />
      );
    }

    if (q.type === 'date') {
      return (
        <input
          type="date"
          value={val != null ? String(val) : ''}
          onChange={(e) => setAnswer(q.id, e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
        />
      );
    }

    return (
      <textarea
        value={val != null ? String(val) : ''}
        onChange={(e) => setAnswer(q.id, e.target.value)}
        rows={3}
        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-y"
      />
    );
  };

  if (loadingQuestions) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-sm text-slate-500">{t("So'rovnoma savollari yuklanmoqda...", language)}</p>
      </div>
    );
  }

  if (!questionnaire) {
    return (
      <div className="p-6 text-center text-red-600">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        {errorMsg || "So'rovnoma yuklanmadi"}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800">
              {getQuestionnaireTitle(questionnaire, language)}
            </h3>
            <p className="text-xs text-slate-500">
              {questionnaire.totalQuestions} {t('savol', language)} · {steps.length} {t('qadam', language)}
            </p>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`shrink-0 h-1.5 rounded-full transition-all ${
                i <= stepIndex ? 'bg-emerald-500 w-8' : 'bg-slate-200 w-4'
              }`}
              title={isClinicalStep ? t("Klinik o'lchovlar", language) : getLocalizedSection(questionnaire, currentStep, language)}
            />
          ))}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mt-2">
          {isClinicalStep
            ? t("Klinik o'lchovlar", language)
            : getLocalizedSection(questionnaire, currentStep, language)}
        </p>
      </div>

      <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {errorMsg}
          </div>
        )}

        {isClinicalStep ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Sistolik (mmHg)</label>
              <input
                type="number"
                value={clinical.sistolik}
                onChange={(e) => setClinical({ ...clinical, sistolik: Number(e.target.value) })}
                className="w-full mt-1 p-3 rounded-xl border border-slate-200"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Diastolik (mmHg)</label>
              <input
                type="number"
                value={clinical.diastolik}
                onChange={(e) => setClinical({ ...clinical, diastolik: Number(e.target.value) })}
                className="w-full mt-1 p-3 rounded-xl border border-slate-200"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Vazn (kg)</label>
              <input
                type="number"
                value={clinical.vazn}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setClinical({ ...clinical, vazn: v });
                  setAnswer('4', v);
                }}
                className="w-full mt-1 p-3 rounded-xl border border-slate-200"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Bo'y (sm)</label>
              <input
                type="number"
                value={clinical.boy}
                onChange={(e) => setClinical({ ...clinical, boy: Number(e.target.value) })}
                className="w-full mt-1 p-3 rounded-xl border border-slate-200"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Glyukoza (ixtiyoriy)</label>
              <input
                type="number"
                step="0.1"
                value={clinical.glyukoza ?? ''}
                onChange={(e) =>
                  setClinical({
                    ...clinical,
                    glyukoza: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-full mt-1 p-3 rounded-xl border border-slate-200"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Xolesterin (ixtiyoriy)</label>
              <input
                type="number"
                step="0.1"
                value={clinical.xolesterin ?? ''}
                onChange={(e) =>
                  setClinical({
                    ...clinical,
                    xolesterin: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-full mt-1 p-3 rounded-xl border border-slate-200"
              />
            </div>
          </div>
        ) : (
          visibleQuestions.map((q) => {
            const description = getQuestionDescription(q, language);
            return (
            <div key={String(q.id)} className="space-y-2">
              <label className="block text-sm font-semibold text-slate-800">
                {getQuestionDisplayText(q, language)}
                {q.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {description && <p className="text-xs text-slate-500">{description}</p>}
              {renderQuestion(q)}
            </div>
            );
          })
        )}

        {submitting && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
            <p className="text-sm font-semibold text-slate-700">{submitProgress}</p>
            <p className="text-xs text-slate-500 text-center max-w-sm">
              AI tahlil bir necha daqiqa davom etishi mumkin. Iltimos, sahifani yopmang.
            </p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 flex justify-between gap-3 bg-slate-50/30">
        <button
          type="button"
          onClick={handleBack}
          disabled={stepIndex === 0 || submitting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 disabled:opacity-40 hover:bg-white"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('Orqaga', language)}
        </button>

        {stepIndex < steps.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
          >
            {t('Keyingi', language)}
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {t("Yuborish va AI tahlil", language)}
          </button>
        )}
      </div>
    </div>
  );
}
