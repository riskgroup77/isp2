import React, { useMemo, useState } from 'react';
import { AlertTriangle, FileSpreadsheet, Printer, RefreshCw, Settings2, Users } from 'lucide-react';
import { validateFormula } from '../lib/formulaEngine';
import { buildVariableCatalog } from '../lib/reportBuilder';
import {
  HODISA_PRESETS,
  buildLiveReport,
  exportLiveReportExcel,
  printLiveReport,
  type LiveReportOptions,
  type LiveTable,
} from '../lib/liveReport';
import type { Questionnaire, SurveyResponseOut } from '../types/api';

interface Props {
  surveys: SurveyResponseOut[];
  questionnaire: Questionnaire | null;
  loading?: boolean;
  onReload?: () => void;
}

const CUSTOM = '__custom__';

export default function LiveN400Report({ surveys, questionnaire, loading, onReload }: Props) {
  const questions = questionnaire?.questions ?? [];
  const [sampleMode, setSampleMode] = useState<'all' | '400' | 'custom'>('400');
  const [customN, setCustomN] = useState(400);
  const [seed, setSeed] = useState(400);
  const [preset, setPreset] = useState(HODISA_PRESETS[0].expr);
  const [customExpr, setCustomExpr] = useState('');
  const [comma, setComma] = useState(true);
  const [latestPerUser, setLatestPerUser] = useState(true);
  const [activeSection, setActiveSection] = useState('A');
  const [showSettings, setShowSettings] = useState(false);

  const known = useMemo(() => new Set(buildVariableCatalog(questions, surveys).map((v) => v.name)), [questions, surveys]);
  const hodisaExpr = preset === CUSTOM ? customExpr : preset;
  const hodisaLabel = preset === CUSTOM ? `Maxsus formula` : HODISA_PRESETS.find((p) => p.expr === preset)?.label ?? preset;
  const customError = preset === CUSTOM && customExpr.trim() ? validateFormula(customExpr, known) : null;

  const options: LiveReportOptions = {
    sampleSize: sampleMode === 'all' ? 0 : sampleMode === '400' ? 400 : Math.max(1, customN || 0),
    seed,
    hodisaExpr: hodisaExpr.trim() || 'false',
    hodisaLabel,
    comma,
    latestPerUser,
  };

  const report = useMemo(
    () => (questions.length ? buildLiveReport(surveys, questions, options) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [surveys, questions, options.sampleSize, options.seed, options.hodisaExpr, options.hodisaLabel, comma, latestPerUser]
  );

  const section = report?.sections.find((s) => s.id === activeSection) ?? report?.sections[0];

  if (!questionnaire) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
        Anketa savollari yuklanmoqda...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-emerald-900 text-white rounded-2xl p-5 md:p-6 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-300">Jonli hisob · serverdagi haqiqiy anketalar</p>
            <h2 className="text-xl md:text-2xl font-black mt-1 leading-tight">Anketa tahlili — dissertatsiya jadvallari</h2>
            <p className="text-sm text-slate-300 mt-1">
              Tanlama, kasallanish strukturasi, xavf zonalari, hodisa/nazorat taqqoslashi (p, OR), 4.2-jadval va 7 bo'lim —
              har safar serverdagi so'nggi ma'lumotdan qayta hisoblanadi.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onReload && (
              <button
                type="button"
                onClick={onReload}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-sm font-bold disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Yangilash
              </button>
            )}
            <button
              type="button"
              onClick={() => report && exportLiveReportExcel(report)}
              disabled={!report || report.n === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold disabled:opacity-40"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel (barcha jadvallar)
            </button>
            <button
              type="button"
              onClick={() => report && printLiveReport(report)}
              disabled={!report || report.n === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-900 text-sm font-bold hover:bg-slate-100 disabled:opacity-40"
            >
              <Printer className="w-4 h-4" />
              Chop etish / PDF
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2">
          <Tile label="Serverdagi anketalar" value={report?.totalSurveys ?? 0} />
          <Tile label="Noyob xodimlar" value={report?.uniqueUsers ?? 0} />
          <Tile label="Tanlama (N)" value={report?.n ?? 0} accent />
          <Tile label="Hodisa guruhi" value={report?.nHodisa ?? 0} />
          <Tile label="Nazorat guruhi" value={report?.nNazorat ?? 0} />
        </div>
      </div>

      {/* Sozlamalar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <button
          type="button"
          onClick={() => setShowSettings((s) => !s)}
          className="w-full flex flex-wrap items-center justify-between gap-2 p-4 text-left"
        >
          <span className="flex items-center gap-2 font-bold text-slate-800">
            <Settings2 className="w-4 h-4 text-indigo-600" />
            Tanlama va guruh sozlamalari
          </span>
          <span className="text-xs text-slate-500">
            {options.sampleSize ? `N = ${options.sampleSize} (sex bo'yicha qatlamlangan)` : 'Barcha anketalar'} · Hodisa: {hodisaLabel}
          </span>
        </button>
        {showSettings && (
          <div className="border-t border-slate-100 p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Tanlama hajmi</p>
              {([
                ['all', 'Barcha anketalar'],
                ['400', 'N = 400 (dissertatsiya)'],
                ['custom', 'Boshqa son'],
              ] as const).map(([v, l]) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={sampleMode === v} onChange={() => setSampleMode(v)} />
                  {l}
                </label>
              ))}
              {sampleMode === 'custom' && (
                <input
                  type="number"
                  min={1}
                  value={customN}
                  onChange={(e) => setCustomN(parseInt(e.target.value, 10) || 0)}
                  className="w-32 px-3 py-1.5 rounded-lg border border-slate-200"
                />
              )}
              {sampleMode !== 'all' && (
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  Seed (takrorlanuvchanlik):
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
                    className="w-24 px-2 py-1 rounded-lg border border-slate-200"
                  />
                </label>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Hodisa guruhi mezoni</p>
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
              >
                {HODISA_PRESETS.map((p) => (
                  <option key={p.expr} value={p.expr}>
                    {p.label}
                  </option>
                ))}
                <option value={CUSTOM}>O'z formulam...</option>
              </select>
              {preset === CUSTOM && (
                <>
                  <input
                    type="text"
                    value={customExpr}
                    onChange={(e) => setCustomExpr(e.target.value)}
                    placeholder='masalan: q44 = "Ha" or risk >= 50'
                    spellCheck={false}
                    className={`w-full px-3 py-2 rounded-xl border font-mono text-xs ${customError ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  />
                  {customError && <p className="text-[11px] text-red-600">{customError}</p>}
                </>
              )}
              <p className="text-[11px] text-slate-500">Nazorat guruhi — mezonga mos kelmagan qolgan xodimlar.</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Boshqa</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={latestPerUser} onChange={(e) => setLatestPerUser(e.target.checked)} />
                Har bir xodimdan faqat oxirgi anketa
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={comma} onChange={(e) => setComma(e.target.checked)} />
                O'nlik ajratgich — vergul (34,5)
              </label>
            </div>
          </div>
        )}
      </div>

      {report && report.warnings.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
          {report.warnings.map((w, i) => (
            <p key={i} className="flex gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {w}
            </p>
          ))}
        </div>
      )}

      {report && report.n === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          <Users className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          Serverda hali tahlil uchun anketa yo'q. Xodimlar anketa to'ldirgach, jadvallar shu yerda avtomatik paydo bo'ladi.
        </div>
      ) : (
        report && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {report.sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSection(s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                    section?.id === s.id
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {s.id.startsWith('G') ? s.title.replace(/\.\s.*$/, '') : s.title}
                </button>
              ))}
            </div>
            {section && (
              <div className="space-y-4">
                <h3 className="text-lg font-black text-slate-900">{section.title}</h3>
                {section.tables.map((t) => (
                  <TableCard key={t.id} table={t} />
                ))}
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2 border ${accent ? 'bg-emerald-500/20 border-emerald-400/40' : 'bg-white/10 border-white/15'}`}>
      <div className="text-xl font-black leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-300 mt-1">{label}</div>
    </div>
  );
}

function TableCard({ table }: { key?: string; table: LiveTable }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <header className="p-4 border-b border-slate-100">
        <h4 className="font-bold text-slate-800 text-sm">{table.title}</h4>
        {table.note && <p className="text-[11px] text-slate-500 mt-1">{table.note}</p>}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              {table.headers.map((h, i) => (
                <th key={i} className="text-left p-2.5 font-bold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, ri) => {
              const isTotal = table.totalRow && ri === table.rows.length - 1;
              const isHeading = r.slice(1).every((c) => c === '') && r.length > 1;
              return (
                <tr
                  key={ri}
                  className={`border-b border-slate-100 ${isTotal ? 'bg-emerald-50 font-bold' : isHeading ? 'bg-slate-50 font-bold text-slate-700' : 'hover:bg-slate-50'}`}
                >
                  {r.map((c, ci) => (
                    <td key={ci} className="p-2.5 text-slate-700 align-top">
                      {c}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
