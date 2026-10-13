import React from 'react';
import {
  Activity,
  AlertTriangle,
  FileDown,
  Loader2,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { getSurveyQuestionsCached, reanalyzeSurvey } from '../lib/api';
import { formatApiError, getRiskZoneStyle } from '../lib/surveyUtils';
import type { AIReport, ClinicalData, Questionnaire, SurveyResponseOut, SurveySubmitResponse } from '../types/api';
import { buildRows } from '../lib/reportBuilder';
import { toNum, toStr } from '../lib/formulaEngine';
import type { UserProfile } from '../types';
import DiseaseRiskPrognosis from './DiseaseRiskPrognosis';
import SurveyAnswers from './SurveyAnswers';
import { getOptionDisplayLabel, getQuestionDisplayText } from '../lib/questionnaireI18n';
import { t } from '../lib/lang';
import { APP_BRAND, APP_EXPORT_PREFIX } from '../lib/branding';

interface SurveyReportProps {
  /** Loyiha @types/react'siz — key'ni prop sifatida e'lon qilish kerak */
  key?: string;
  survey: SurveyResponseOut;
  tahlil?: AIReport | null;
  user?: UserProfile | null;
  language?: 'lotin' | 'kirill';
  onUpdated?: (result: SurveySubmitResponse) => void;
  onClose?: () => void;
  /** Anketa yuborilganda kiritilgan klinik ma'lumotlar (serverda saqlanmagan bo'lishi mumkin) */
  clinical?: ClinicalData | null;
  /** Ota komponentda yuklangan savolnoma (bo'lmasa o'zi yuklaydi) */
  questionnaire?: Questionnaire | null;
}

export default function SurveyReport({
  survey,
  tahlil: initialTahlil,
  user,
  language = 'lotin',
  onUpdated,
  onClose,
  clinical,
  questionnaire: questionnaireProp,
}: SurveyReportProps) {
  const [reanalyzing, setReanalyzing] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [localSurvey, setLocalSurvey] = React.useState(survey);
  const [localTahlil, setLocalTahlil] = React.useState<AIReport | null>(
    initialTahlil || survey.ai_response || null
  );

  const report = localTahlil;
  const [loadedQuestionnaire, setQuestionnaire] = React.useState<Questionnaire | null>(null);
  const [qError, setQError] = React.useState<string | null>(null);
  const questionnaire = questionnaireProp ?? loadedQuestionnaire;
  React.useEffect(() => {
    if (questionnaireProp) return;
    let alive = true;
    getSurveyQuestionsCached()
      .then((q) => alive && setQuestionnaire(q))
      .catch((e) => alive && setQError(formatApiError(e)));
    return () => {
      alive = false;
    };
  }, [questionnaireProp]);

  // Shu anketaning o'z ma'lumotlari: javoblardan + klinik bosqichdan
  const person = React.useMemo(() => {
    const ctx = buildRows([localSurvey], [])[0]?.ctx ?? {};
    const num = (...vals: unknown[]) => {
      for (const v of vals) {
        const n = toNum((v ?? null) as never);
        if (n !== null && n > 0) return n;
      }
      return undefined;
    };
    const a = localSurvey.answers as Record<string, unknown>;
    const pick = (id: string) => (toStr((a[id] ?? null) as never) === 'Boshqa' && a[`${id}a`] ? String(a[`${id}a`]) : toStr((a[id] ?? null) as never));
    const jins = toStr((ctx.jins ?? null) as never) || (user?.jins === 'ayol' ? 'Ayol' : user?.jins === 'erkak' ? 'Erkak' : '');
    return {
      ism: user?.ism || '',
      yosh: num(ctx.yosh, user?.yosh),
      jins,
      sex: pick('9'),
      kasb: pick('8'),
      tashkilot: toStr((a['2'] ?? null) as never),
      sistolik: num(clinical?.sistolik, ctx.sistolik),
      diastolik: num(clinical?.diastolik, ctx.diastolik),
      vazn: num(clinical?.vazn, ctx.vazn),
      boy: num(clinical?.boy, ctx.boy),
      glyukoza: num(clinical?.glyukoza, ctx.glyukoza),
      chekish: (() => {
        const sm = toStr((a['51'] ?? null) as never).trim().toLowerCase();
        return sm.includes('hozirda') || sm === 'ha';
      })(),
      bmi: (() => {
        const w = num(clinical?.vazn, ctx.vazn);
        const h = num(clinical?.boy, ctx.boy);
        if (w && h) return Math.round((w / ((h / 100) * (h / 100))) * 10) / 10;
        const b = num(ctx.bmi);
        return b;
      })(),
    };
  }, [localSurvey, clinical, user]);
  const zoneStyle = getRiskZoneStyle(localSurvey.risk_zonasi || report?.zona);
  const hasAiError = !report && (localSurvey.ai_xato || !initialTahlil);
  const tmiValue = report?.tmi ?? person.bmi ?? null;
  const riskValue = report?.riskFoizi ?? localSurvey.score_total;

  const handleReanalyze = async () => {
    setReanalyzing(true);
    setErrorMsg(null);
    try {
      const result = await reanalyzeSurvey(localSurvey.id);
      setLocalSurvey(result.response);
      setLocalTahlil(result.tahlil || result.response.ai_response || null);
      onUpdated?.(result);
    } catch (err) {
      setErrorMsg(formatApiError(err));
    } finally {
      setReanalyzing(false);
    }
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    const r = report;
    let y = 15;

    doc.setFontSize(11);
    const brandLines = doc.splitTextToSize(APP_BRAND, 180);
    doc.text(brandLines, 14, y);
    y += brandLines.length * 5;
    y += 8;
    doc.setFontSize(10);
    const who = [
      person.ism && `Xodim: ${person.ism}`,
      person.yosh && `Yosh: ${person.yosh}`,
      person.jins && `Jins: ${person.jins}`,
      person.sex && `Sex: ${person.sex}`,
    ].filter(Boolean);
    if (who.length) {
      doc.text(doc.splitTextToSize(who.join(' | '), 180), 14, y);
      y += 6;
    }
    const clin = [
      person.sistolik && person.diastolik && `Qon bosimi: ${person.sistolik}/${person.diastolik}`,
      person.vazn && `Vazn: ${person.vazn} kg`,
      person.boy && `Bo'y: ${person.boy} sm`,
      person.glyukoza && `Glyukoza: ${person.glyukoza}`,
    ].filter(Boolean);
    if (clin.length) {
      doc.text(clin.join(' | '), 14, y);
      y += 6;
    }
    doc.text(`Sana: ${new Date(localSurvey.created_at).toLocaleDateString('uz-UZ')}`, 14, y);
    y += 8;

    doc.setFontSize(12);
    doc.text(
      `Risk: ${r?.riskFoizi ?? localSurvey.score_total}% | Zona: ${localSurvey.risk_zonasi || r?.zona || '-'}`,
      14,
      y
    );
    y += 10;

    const addSection = (title: string, text?: string | null) => {
      if (!text) return;
      if (y > 260) {
        doc.addPage();
        y = 15;
      }
      doc.setFontSize(11);
      doc.text(title, 14, y);
      y += 6;
      doc.setFontSize(9);
      const lines: string[] = doc.splitTextToSize(text, 180);
      lines.forEach((ln) => {
        if (y > 285) {
          doc.addPage();
          y = 15;
        }
        doc.text(ln, 14, y);
        y += 4;
      });
      y += 6;
    };

    addSection('Statistika', r?.statistika?.matn);
    addSection('Korrelyatsiya', r?.korrelyatsiya?.matn);
    addSection('Natijalar', r?.natijalar);
    addSection('Munozara', r?.munozara);
    addSection('Xulosa', r?.xulosaVaTavsiyalar?.xulosa);
    if (r?.xulosaVaTavsiyalar?.tavsiyalar?.length) {
      addSection('Tavsiyalar', r.xulosaVaTavsiyalar.tavsiyalar.join('\n• '));
    }
    if (r?.klinikXulosa) addSection('Klinik xulosa', r.klinikXulosa);

    if (!r) addSection('Izoh', "Bu anketa AI tahlilisiz saqlangan; xavf balli server hisoblagan ball bo'yicha.");
    if (questionnaire) {
      const ans = localSurvey.answers as Record<string, unknown>;
      const lines = questionnaire.questions
        .filter((q) => String(q.id) !== '1')
        .map((q) => {
          const v = ans[String(q.id)];
          if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return null;
          const val = Array.isArray(v)
            ? v.map((x) => getOptionDisplayLabel(q, String(x), 'lotin')).join('; ')
            : getOptionDisplayLabel(q, String(v), 'lotin');
          return `${q.id}. ${getQuestionDisplayText(q, 'lotin')}: ${val}`;
        })
        .filter((x): x is string => !!x);
      if (lines.length) addSection('Anketa javoblari', lines.join('\n'));
    }

    doc.save(`${APP_EXPORT_PREFIX.toLowerCase()}-hisobot-${localSurvey.id.slice(0, 8)}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            {t('So\'rovnoma natijasi', language)}
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-1">
            {new Date(localSurvey.created_at).toLocaleString('uz-UZ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasAiError && (
            <button
              type="button"
              onClick={handleReanalyze}
              disabled={reanalyzing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold"
            >
              {reanalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {t('Qayta tahlil qilish', language)}
            </button>
          )}
          <button
            type="button"
            onClick={exportPdf}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
          >
            <FileDown className="w-4 h-4" />
            PDF
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
            >
              {t('Yopish', language)}
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{errorMsg}</div>
      )}

      {!report && !localSurvey.ai_xato && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0" />
          <div>
            <p className="font-bold text-blue-900 text-sm">Bu anketa AI tahlilisiz saqlangan</p>
            <p className="text-xs text-blue-800 mt-1">
              Xavf balli va zona server hisoblagan ball bo'yicha. Xavf omillari, klinik xulosa va tavsiyalar uchun "Qayta tahlil qilish" tugmasini
              bosing. Xodimning barcha javoblari pastdagi "Anketa javoblari" bo'limida.
            </p>
          </div>
        </div>
      )}

      {localSurvey.ai_xato && !report && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-bold text-amber-900 text-sm">AI tahlil bajarilmadi</p>
            <p className="text-xs text-amber-800 mt-1">{localSurvey.ai_xato}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {[
          ['Xodim', person.ism],
          ['Jinsi', person.jins],
          ['Yoshi', person.yosh ? `${person.yosh} yosh` : ''],
          ['Sex', person.sex],
          ['Kasbi', person.kasb],
          ['Qon bosimi', person.sistolik && person.diastolik ? `${person.sistolik}/${person.diastolik} mmHg` : ''],
          ["Vazn / bo'y", person.vazn ? `${person.vazn} kg${person.boy ? ` / ${person.boy} sm` : ''}` : ''],
          ['Chekish', toStr((localSurvey.answers['51'] ?? null) as never)],
        ]
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k as string}>
              <p className="text-[10px] uppercase font-bold text-slate-400">{t(k as string, language)}</p>
              <p className="font-bold text-slate-800 mt-0.5">{v}</p>
            </div>
          ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          className="p-5 rounded-2xl border-2 text-center"
          style={{ borderColor: zoneStyle.color }}
        >
          <Activity className="w-6 h-6 mx-auto mb-2" style={{ color: zoneStyle.color }} />
          <p className="text-[10px] uppercase font-bold text-slate-500">Risk zonasi</p>
          <p className="text-2xl font-black" style={{ color: zoneStyle.color }}>
            {localSurvey.risk_zonasi || report?.zona || '—'}
          </p>
          <p className="text-xs text-slate-600 mt-1">{zoneStyle.label}</p>
        </div>
        <div className="p-5 rounded-2xl border border-slate-200 bg-white text-center">
          <TrendingUp className="w-6 h-6 mx-auto mb-2 text-indigo-600" />
          <p className="text-[10px] uppercase font-bold text-slate-500">Risk balli</p>
          <p className="text-2xl font-black text-indigo-700">
            {report?.riskFoizi ?? localSurvey.score_total}%
          </p>
        </div>
      </div>

      {report?.faktorlar && report.faktorlar.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-800 mb-4 uppercase text-xs tracking-wider">
            Xavf omillari
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {report.faktorlar.map((f, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-sm text-slate-800">{f.nomi}</span>
                  <span className="text-xs font-mono font-bold text-indigo-600">{f.tasirKuchi}%</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">{f.tafsilot}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {report?.statistika && (
        <ReportBlock title="Statistika" content={report.statistika.matn} />
      )}
      {report?.korrelyatsiya && (
        <ReportBlock
          title="Korrelyatsiya va solishtirish"
          content={report.korrelyatsiya.matn}
          extra={
            report.korrelyatsiya.solishtirish?.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="p-2 text-left border">Omil A</th>
                      <th className="p-2 text-left border">Omil B</th>
                      <th className="p-2 text-left border">Tavsif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.korrelyatsiya.solishtirish.map((row, i) => (
                      <tr key={i}>
                        <td className="p-2 border">{row.omilA}</td>
                        <td className="p-2 border">{row.omilB}</td>
                        <td className="p-2 border">{row.tavsif}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null
          }
        />
      )}
      {report?.natijalar && <ReportBlock title="Natijalar" content={report.natijalar} />}
      {report?.munozara && <ReportBlock title="Munozara" content={report.munozara} />}
      {report?.xulosaVaTavsiyalar && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-800 mb-3 uppercase text-xs tracking-wider">
            Xulosa va tavsiyalar
          </h3>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {report.xulosaVaTavsiyalar.xulosa}
          </p>
          {report.xulosaVaTavsiyalar.tavsiyalar?.length > 0 && (
            <ul className="mt-4 space-y-2">
              {report.xulosaVaTavsiyalar.tavsiyalar.map((tv, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <span className="text-emerald-600 font-bold">•</span>
                  {tv}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {report?.klinikXulosa && (
        <ReportBlock title="Klinik xulosa" content={report.klinikXulosa} />
      )}

      {(report || typeof riskValue === 'number') && (
        <DiseaseRiskPrognosis
          input={{
            riskFoizi: riskValue,
            tmi: tmiValue ?? undefined,
            answers: localSurvey.answers,
            sistolik: person.sistolik,
            diastolik: person.diastolik,
            glyukoza: person.glyukoza,
            yosh: person.yosh,
            chekish: person.chekish,
            jins: person.jins,
          }}
        />
      )}

      <SurveyAnswers
        answers={localSurvey.answers as Record<string, unknown>}
        questionnaire={questionnaire}
        language={language}
        defaultOpen={!report}
        loadError={qError}
      />
    </div>
  );
}

function ReportBlock({
  title,
  content,
  extra,
}: {
  title: string;
  content: string;
  extra?: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5">
      <h3 className="font-bold text-slate-800 mb-3 uppercase text-xs tracking-wider">{title}</h3>
      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{content}</p>
      {extra}
    </section>
  );
}
