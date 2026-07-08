import React, { useEffect, useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { getSurveyQuestions } from '../lib/api';
import { exportSurveysToExcel } from '../lib/excelExport';
import {
  QUICK_FILTER_PRESETS,
  applyPresetWithExtras,
  filterSurveyResponses,
  getQuestionLabel,
  getRespondentName,
  type SurveyFilterRule,
} from '../lib/surveyFilter';
import { formatApiError, getRiskZoneStyle } from '../lib/surveyUtils';
import type { Question, SurveyResponseOut } from '../types/api';

interface SurveyAnalyticsPanelProps {
  surveys: SurveyResponseOut[];
  onSelectSurvey?: (survey: SurveyResponseOut) => void;
}

export default function SurveyAnalyticsPanel({
  surveys,
  onSelectSurvey,
}: SurveyAnalyticsPanelProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQ, setLoadingQ] = useState(true);
  const [activeFilters, setActiveFilters] = useState<SurveyFilterRule[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [draftQuestionId, setDraftQuestionId] = useState('');
  const [draftAnswer, setDraftAnswer] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    getSurveyQuestions()
      .then((q) => setQuestions(q.questions))
      .catch(() => {})
      .finally(() => setLoadingQ(false));
  }, []);

  const resultsForTable = useMemo(() => {
    if (activePreset) {
      const preset = QUICK_FILTER_PRESETS.find((p) => p.label === activePreset);
      if (preset) return applyPresetWithExtras(preset, surveys);
    }
    if (activeFilters.length === 0) return surveys;
    return filterSurveyResponses(surveys, activeFilters);
  }, [surveys, activeFilters, activePreset]);

  const selectedQuestion = questions.find((q) => String(q.id) === draftQuestionId);

  const addFilter = () => {
    if (!draftQuestionId || !draftAnswer.trim()) return;
    setActivePreset(null);
    setActiveFilters((prev) => [
      ...prev,
      { questionId: draftQuestionId, equals: draftAnswer.trim() },
    ]);
    setDraftAnswer('');
    setExportError(null);
  };

  const handleSearch = () => {
    setExportError(null);
  };

  const handleExport = () => {
    setExportError(null);
    const dataToExport = resultsForTable;
    if (dataToExport.length === 0) {
      setExportError("Eksport qilish uchun natijalar yo'q. Filtrlarni o'zgartiring.");
      return;
    }
    setExporting(true);
    try {
      exportSurveysToExcel(dataToExport);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Excel yuklab olishda xatolik.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {exportError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex justify-between items-center">
          <span>{exportError}</span>
          <button type="button" onClick={() => setExportError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {QUICK_FILTER_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              setActivePreset(preset.label);
              setActiveFilters(preset.rules);
              setExportError(null);
            }}
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
              activePreset === preset.label
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-blue-50 hover:border-blue-300'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">So'rovnoma</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Savol</label>
            <select
              value={draftQuestionId}
              onChange={(e) => {
                setDraftQuestionId(e.target.value);
                setDraftAnswer('');
              }}
              className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-sm"
              disabled={loadingQ}
            >
              <option value="">Tanlang...</option>
              {questions.map((q) => (
                <option key={String(q.id)} value={String(q.id)}>
                  #{q.id} — {q.text.slice(0, 50)}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Javob</label>
            {selectedQuestion && selectedQuestion.options.length > 0 ? (
              <select
                value={draftAnswer}
                onChange={(e) => setDraftAnswer(e.target.value)}
                className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-sm"
              >
                <option value="">Tanlang...</option>
                {selectedQuestion.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={draftAnswer}
                onChange={(e) => setDraftAnswer(e.target.value)}
                placeholder="Javobni kiriting..."
                className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-sm"
              />
            )}
          </div>
          <button
            type="button"
            onClick={addFilter}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-300 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            <Plus className="w-4 h-4" />
            Filter qo'shish
          </button>
        </div>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold"
              >
                {getQuestionLabel(questions, f.questionId)} = {f.equals}
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilters((prev) => prev.filter((_, idx) => idx !== i));
                    setActivePreset(null);
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSearch}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold"
          >
            <Search className="w-4 h-4" />
            Qidirish
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold text-slate-800">
          Natijalar: {resultsForTable.length}
        </h3>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || resultsForTable.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4" />
          )}
          Excel
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left p-3 font-bold text-slate-600">F.I.SH.</th>
              <th className="text-left p-3 font-bold text-slate-600">XAVF %</th>
              <th className="text-left p-3 font-bold text-slate-600">ZONA</th>
              <th className="text-left p-3 font-bold text-slate-600 min-w-[200px]">KLINIK XULOSA</th>
            </tr>
          </thead>
          <tbody>
            {resultsForTable.map((s) => {
              const style = getRiskZoneStyle(s.risk_zonasi);
              const tahlil = s.ai_response;
              return (
                <tr
                  key={s.id}
                  className="border-b hover:bg-slate-50 cursor-pointer"
                  onClick={() => onSelectSurvey?.(s)}
                >
                  <td className="p-3 font-semibold text-slate-800">
                    {getRespondentName(s)}
                  </td>
                  <td className="p-3 font-mono font-bold" style={{ color: style.color }}>
                    {tahlil?.riskFoizi ?? s.score_total}%
                  </td>
                  <td className="p-3">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded text-white"
                      style={{ backgroundColor: style.color }}
                    >
                      {s.risk_zonasi || '—'}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-slate-600 line-clamp-2">
                    {tahlil?.klinikXulosa || s.klinik_xulosa || '—'}
                  </td>
                </tr>
              );
            })}
            {resultsForTable.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">
                  Filtr bo'yicha natija topilmadi
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
