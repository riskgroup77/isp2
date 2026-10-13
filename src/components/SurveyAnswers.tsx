import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, ListChecks } from 'lucide-react';
import type { Question, Questionnaire } from '../types/api';
import {
  getLocalizedSection,
  getOptionDisplayLabel,
  getQuestionDisplayText,
  type SurveyLanguage,
} from '../lib/questionnaireI18n';
import { isQuestionVisible } from '../lib/surveyUtils';

interface Props {
  answers: Record<string, unknown>;
  questionnaire: Questionnaire | null;
  language?: SurveyLanguage;
  defaultOpen?: boolean;
  loadError?: string | null;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[’`‘ʻ]/g, "'");
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
}

const CLINICAL_LABELS: Record<string, string> = {
  sistolik: 'Sistolik bosim, mm sim. ust.',
  diastolik: 'Diastolik bosim, mm sim. ust.',
  vazn: 'Vazn, kg',
  boy: "Bo'y, sm",
  glyukoza: 'Glyukoza, mmol/l',
  xolesterin: 'Xolesterin, mmol/l',
};

/** Variantlarga mos kelmagan javob (eski versiya yoki boshqa vosita orqali yuborilgan) */
function mismatched(q: Question, v: unknown): string[] {
  if (!q.options?.length || isEmpty(v)) return [];
  if (q.type !== 'single_choice' && q.type !== 'multi_choice') return [];
  const opts = q.options.map(norm);
  const vals = Array.isArray(v) ? v.map(String) : [String(v)];
  // "Boshqa" tanlanganda erkin matn alohida (8a, 9a ...) maydonda keladi
  return vals.filter((x) => !opts.includes(norm(x)));
}

export default function SurveyAnswers({ answers, questionnaire, language = 'lotin', defaultOpen = true, loadError }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const model = useMemo(() => {
    const qs = questionnaire?.questions ?? [];
    const known = new Set(qs.map((q) => String(q.id)));
    const sections = (questionnaire?.sections ?? []).map((sec) => {
      const items = qs
        .filter((q) => q.section === sec && String(q.id) !== '1')
        .map((q) => {
          const v = answers[String(q.id)];
          return { q, v, visible: isQuestionVisible(q, answers), bad: mismatched(q, v) };
        })
        .filter((x) => x.visible || !isEmpty(x.v));
      return { sec, items };
    });
    const answered = sections.reduce((s, x) => s + x.items.filter((i) => !isEmpty(i.v)).length, 0);
    const asked = sections.reduce((s, x) => s + x.items.length, 0);
    const badCount = sections.reduce((s, x) => s + x.items.filter((i) => i.bad.length).length, 0);
    const clinical =
      answers.klinik && typeof answers.klinik === 'object' ? Object.entries(answers.klinik as Record<string, unknown>).filter(([, v]) => !isEmpty(v)) : [];
    const extra = Object.entries(answers).filter(([k, v]) => k !== 'klinik' && !known.has(k) && !isEmpty(v));
    return { sections: sections.filter((x) => x.items.length), answered, asked, badCount, clinical, extra };
  }, [answers, questionnaire]);

  const fmtValue = (q: Question | null, v: unknown): string => {
    if (isEmpty(v)) return '—';
    if (Array.isArray(v)) return v.map((x) => (q ? getOptionDisplayLabel(q, String(x), language) : String(x))).join('; ');
    if (typeof v === 'object') return JSON.stringify(v);
    return q ? getOptionDisplayLabel(q, String(v), language) : String(v);
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex flex-wrap items-center justify-between gap-2 p-5 text-left">
        <span className="flex items-center gap-2 font-bold text-slate-800 uppercase text-xs tracking-wider">
          <ListChecks className="w-4 h-4 text-emerald-600" />
          Anketa javoblari
          {questionnaire && (
            <span className="normal-case tracking-normal font-mono text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800">
              {model.answered} / {model.asked} savolga javob berilgan
            </span>
          )}
          {model.badCount > 0 && (
            <span className="normal-case tracking-normal text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
              {model.badCount} ta javob variantlarga mos emas
            </span>
          )}
        </span>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 p-5 space-y-5">
          {!questionnaire && (
            <p className="text-xs text-slate-500">
              {loadError ? `Savolnoma yuklanmadi: ${loadError}. Javoblar savol raqamlari bilan ko'rsatildi.` : 'Savolnoma yuklanmoqda...'}
            </p>
          )}

          {model.badCount > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Sariq belgilangan javoblar hozirgi savolnoma variantlarida yo'q. Bu anketa eski savolnoma versiyasida yoki ommaviy yuklash
                vositasi orqali yuborilgan bo'lishi mumkin — statistikada bunday javoblar to'g'ri guruhlanmasligi mumkin.
              </span>
            </div>
          )}

          {model.clinical.length > 0 && (
            <div>
              <h4 className="text-xs font-black text-slate-700 mb-2">Klinik ko'rsatkichlar</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {model.clinical.map(([k, v]) => (
                  <div key={k} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-[10px] text-slate-500">{CLINICAL_LABELS[k] ?? k}</p>
                    <p className="font-bold text-slate-800">{String(v)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {model.sections.map(({ sec, items }) => (
            <div key={sec}>
              <h4 className="text-xs font-black text-slate-700 mb-2">{questionnaire ? getLocalizedSection(questionnaire, sec, language) : sec}</h4>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {items.map(({ q, v, bad }) => (
                  <div key={String(q.id)} className={`grid grid-cols-1 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-1 md:gap-4 p-2.5 text-xs ${bad.length ? 'bg-amber-50/70' : ''}`}>
                    <p className="text-slate-500">
                      <span className="font-mono font-bold text-slate-400 mr-1">{q.id}.</span>
                      {getQuestionDisplayText(q, language)}
                    </p>
                    <p className={`font-semibold ${isEmpty(v) ? 'text-slate-300' : 'text-slate-800'}`}>
                      {fmtValue(q, v)}
                      {bad.length > 0 && <span className="ml-2 text-[10px] font-bold text-amber-700">(variantlarda yo'q)</span>}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {(model.extra.length > 0 || !questionnaire) && (
            <div>
              <h4 className="text-xs font-black text-slate-700 mb-2">{questionnaire ? "Savolnomada yo'q qo'shimcha maydonlar" : 'Javoblar'}</h4>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {(questionnaire ? model.extra : Object.entries(answers).filter(([k, v]) => k !== 'klinik' && !isEmpty(v))).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 p-2.5 text-xs">
                    <p className="font-mono text-slate-400">{k}</p>
                    <p className="font-semibold text-slate-800 break-words">{fmtValue(null, v)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
