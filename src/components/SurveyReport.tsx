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
import { reanalyzeSurvey } from '../lib/api';
import { formatApiError, getRiskZoneStyle } from '../lib/surveyUtils';
import type { AIReport, SurveyResponseOut, SurveySubmitResponse } from '../types/api';
import type { UserProfile } from '../types';
import DiseaseRiskPrognosis from './DiseaseRiskPrognosis';
import { t } from '../lib/lang';

interface SurveyReportProps {
  survey: SurveyResponseOut;
  tahlil?: AIReport | null;
  user?: UserProfile | null;
  language?: 'lotin' | 'kirill';
  onUpdated?: (result: SurveySubmitResponse) => void;
  onClose?: () => void;
}

export default function SurveyReport({
  survey,
  tahlil: initialTahlil,
  user,
  language = 'lotin',
  onUpdated,
  onClose,
}: SurveyReportProps) {
  const [reanalyzing, setReanalyzing] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [localSurvey, setLocalSurvey] = React.useState(survey);
  const [localTahlil, setLocalTahlil] = React.useState<AIReport | null>(
    initialTahlil || survey.ai_response || null
  );

  const report = localTahlil;
  const zoneStyle = getRiskZoneStyle(localSurvey.risk_zonasi || report?.zona);
  const hasAiError = !report && (localSurvey.ai_xato || !initialTahlil);

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

    doc.setFontSize(16);
    doc.text('EnergoHealth-Predict', 14, y);
    y += 8;
    doc.setFontSize(10);
    if (user) {
      doc.text(`Xodim: ${user.ism} | Yosh: ${user.yosh} | Jins: ${user.jins}`, 14, y);
      y += 6;
    }
    doc.text(`Sana: ${new Date(localSurvey.created_at).toLocaleDateString('uz-UZ')}`, 14, y);
    y += 8;

    doc.setFontSize(12);
    doc.text(
      `Risk: ${r?.riskFoizi ?? localSurvey.score_total}% | Zona: ${localSurvey.risk_zonasi || r?.zona || '-'} | TMI: ${r?.tmi ?? '-'}`,
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
      const lines = doc.splitTextToSize(text, 180);
      doc.text(lines, 14, y);
      y += lines.length * 4 + 6;
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

    doc.save(`energohealth-hisobot-${localSurvey.id.slice(0, 8)}.pdf`);
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

      {localSurvey.ai_xato && !report && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-bold text-amber-900 text-sm">AI tahlil bajarilmadi</p>
            <p className="text-xs text-amber-800 mt-1">{localSurvey.ai_xato}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <div className="p-5 rounded-2xl border border-slate-200 bg-white text-center">
          <p className="text-[10px] uppercase font-bold text-slate-500">TMI</p>
          <p className="text-2xl font-black text-slate-800">{report?.tmi ?? '—'}</p>
          <p className="text-xs text-slate-500">{report?.tmiKategoriya || ''}</p>
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

      {report && (
        <DiseaseRiskPrognosis
          input={{
            riskFoizi: report.riskFoizi,
            tmi: report.tmi ?? undefined,
            answers: localSurvey.answers,
            chekish: String(localSurvey.answers['44'] ?? '').includes('Hozirda chekaman'),
            jins: String(localSurvey.answers['5'] ?? ''),
          }}
        />
      )}
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
