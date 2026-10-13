import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpenText,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Plus,
  Printer,
  Save,
  Search,
  Sigma,
  Trash2,
  Wand2,
  X,
  BarChart3,
  ImageDown,
  Loader2,
  Table2,
} from 'lucide-react';
import { getSurveyQuestions } from '../lib/api';
import { downloadBlob, renderChart, svgToPng, type ChartKind } from '../lib/chartSvg';
import { buildChartSpec, chartMetrics, pieAllowed } from '../lib/reportChart';
import { exportDocx, type DocBlock } from '../lib/docxExport';
import { APP_EXPORT_PREFIX } from '../lib/branding';
import { FUNCTIONS, validateFormula } from '../lib/formulaEngine';
import {
  AGG_LABELS,
  SAMPLE_REPORTS,
  buildRows,
  buildVariableCatalog,
  computeReport,
  exportReportToCsv,
  exportReportToExcel,
  loadTemplates,
  makeColumnId,
  saveTemplates,
  type AggFn,
  type ReportColumn,
  type ReportDefinition,
  type VariableDef,
} from '../lib/reportBuilder';
import type { PersonInfo, Question, Questionnaire, SurveyResponseOut } from '../types/api';

interface Props {
  surveys: SurveyResponseOut[];
  questionnaire: Questionnaire | null;
  /** user_id → ism/login (admin foydalanuvchilar ro'yxatidan) */
  people?: Map<string, PersonInfo>;
  peopleError?: string | null;
  language?: 'lotin' | 'kirill';
}

type FocusTarget = { kind: 'filter' } | { kind: 'group'; index: number } | { kind: 'col'; id: string };

const EMPTY_DEF: ReportDefinition = {
  name: 'Yangi hisobot',
  columns: [
    { id: makeColumnId(), label: 'F.I.SH.', expr: 'ism', agg: 'first' },
    { id: makeColumnId(), label: 'Xavf %', expr: 'risk', agg: 'mean_se' },
  ],
  filter: '',
  groupBy: [],
  sortBy: null,
  limit: null,
};

const FILTER_SNIPPETS = [
  { label: 'Erkaklar', expr: 'jins = "Erkak"' },
  { label: 'Qizil zona', expr: 'zona = "qizil"' },
  { label: 'Xavf ≥ 50%', expr: 'risk >= 50' },
  { label: 'Yosh 40–59', expr: 'yosh >= 40 and yosh < 60' },
  { label: 'Gipertoniya', expr: 'sistolik >= 140 or diastolik >= 90' },
  { label: 'Chekuvchilar', expr: 'q51 = "Hozirda chekaman"' },
  { label: 'Surunkali kasallik', expr: 'q44 = "Ha"' },
  { label: 'TMI ≥ 30', expr: 'bmi >= 30' },
];

const GROUP_SNIPPETS = [
  { label: 'Sex', expr: 'q9' },
  { label: 'Kasb', expr: 'q8' },
  { label: 'Jins', expr: 'jins' },
  { label: 'Zona', expr: 'zona' },
  { label: 'Yosh guruhi', expr: 'BUCKET(yosh, 30, 40, 50, 60)' },
  { label: 'Staj', expr: 'q10' },
  { label: 'TMI toifasi', expr: 'IF(bmi >= 30, "Semizlik", IF(bmi >= 25, "Ortiqcha vazn", "Me\'yor"))' },
  { label: 'Oy', expr: 'oy' },
];

export default function AdminReportBuilder({ surveys, questionnaire, people, peopleError, language = 'lotin' }: Props) {
  const [questions, setQuestions] = useState<Question[]>(questionnaire?.questions ?? []);
  const patients = useMemo(() => people ?? new Map<string, PersonInfo>(), [people]);
  const patientsNote = peopleError
    ? `Xodimlar ro'yxati (ism, login) olinmadi: ${peopleError}. Ism ustunlari bo'sh bo'ladi.`
    : null;
  const [def, setDef] = useState<ReportDefinition>(() => ({ ...EMPTY_DEF, columns: EMPTY_DEF.columns.map((c) => ({ ...c })) }));
  const [templates, setTemplates] = useState<ReportDefinition[]>(() => loadTemplates());
  const [varSearch, setVarSearch] = useState('');
  const [varGroupOpen, setVarGroupOpen] = useState<Record<string, boolean>>({ Profil: true, Natija: true, Klinik: true, Savol: true });
  const [showFunctions, setShowFunctions] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [focusTarget, setFocusTarget] = useState<FocusTarget>({ kind: 'filter' });
  const [notice, setNotice] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});

  useEffect(() => {
    if (questionnaire?.questions?.length) {
      setQuestions(questionnaire.questions);
      return;
    }
    getSurveyQuestions()
      .then((q) => setQuestions(q.questions))
      .catch(() => {});
  }, [questionnaire]);

  const catalog = useMemo(() => buildVariableCatalog(questions, surveys), [questions, surveys]);
  const knownVars = useMemo(() => new Set(catalog.map((v) => v.name)), [catalog]);
  const rows = useMemo(() => buildRows(surveys, questions, patients), [surveys, questions, patients]);
  const report = useMemo(() => computeReport(rows, def, knownVars), [rows, def, knownVars]);

  const isGrouped = def.groupBy.some((g) => g.trim());

  const filteredCatalog = useMemo(() => {
    const s = varSearch.trim().toLowerCase();
    if (!s) return catalog;
    return catalog.filter(
      (v) => v.name.includes(s) || v.label.toLowerCase().includes(s) || (v.options || []).some((o) => o.toLowerCase().includes(s))
    );
  }, [catalog, varSearch]);

  const grouped = useMemo(() => {
    const out: Record<string, VariableDef[]> = {};
    filteredCatalog.forEach((v) => {
      (out[v.group] ||= []).push(v);
    });
    return out;
  }, [filteredCatalog]);

  // ── Yordamchilar ──────────────────────────────────

  const refKey = (t: FocusTarget) => (t.kind === 'filter' ? 'filter' : t.kind === 'group' ? `group-${t.index}` : `col-${t.id}`);

  const insertSnippet = (snippet: string) => {
    const key = refKey(focusTarget);
    const el = inputRefs.current[key];
    const current =
      focusTarget.kind === 'filter'
        ? def.filter
        : focusTarget.kind === 'group'
          ? def.groupBy[focusTarget.index] ?? ''
          : def.columns.find((c) => c.id === focusTarget.id)?.expr ?? '';
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const before = current.slice(0, start);
    const after = current.slice(end);
    const needsSpace = before.length > 0 && !/[\s(,]$/.test(before);
    const next = `${before}${needsSpace ? ' ' : ''}${snippet}${after}`;
    applyToTarget(focusTarget, next);
    requestAnimationFrame(() => {
      const el2 = inputRefs.current[key];
      if (el2) {
        el2.focus();
        const pos = before.length + (needsSpace ? 1 : 0) + snippet.length;
        try {
          el2.setSelectionRange(pos, pos);
        } catch {
          /* ignore */
        }
      }
    });
  };

  const applyToTarget = (t: FocusTarget, value: string) => {
    if (t.kind === 'filter') setDef((d) => ({ ...d, filter: value }));
    else if (t.kind === 'group') setDef((d) => ({ ...d, groupBy: d.groupBy.map((g, i) => (i === t.index ? value : g)) }));
    else setDef((d) => ({ ...d, columns: d.columns.map((c) => (c.id === t.id ? { ...c, expr: value } : c)) }));
  };

  const updateColumn = (id: string, patch: Partial<ReportColumn>) =>
    setDef((d) => ({ ...d, columns: d.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));

  const addColumn = (v?: VariableDef) => {
    const col: ReportColumn = {
      id: makeColumnId(),
      label: v ? v.label.replace(/^\d+[a-z]?\.\s*/, '').slice(0, 60) : '',
      expr: v ? v.name : '',
      agg: v ? (v.type === 'number' ? 'mean_se' : v.type === 'bool' ? 'pct_true' : 'first') : 'first',
    };
    setDef((d) => ({ ...d, columns: [...d.columns, col] }));
    setFocusTarget({ kind: 'col', id: col.id });
  };

  const moveColumn = (id: string, dir: -1 | 1) =>
    setDef((d) => {
      const i = d.columns.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.columns.length) return d;
      const cols = [...d.columns];
      [cols[i], cols[j]] = [cols[j], cols[i]];
      return { ...d, columns: cols };
    });

  const removeColumn = (id: string) => setDef((d) => ({ ...d, columns: d.columns.filter((c) => c.id !== id) }));

  const loadDefinition = (tpl: ReportDefinition) => {
    setDef({
      ...tpl,
      columns: tpl.columns.map((c) => ({ ...c, id: makeColumnId() })),
      groupBy: [...tpl.groupBy],
      sortBy: tpl.sortBy ? { ...tpl.sortBy } : null,
    });
    setNotice(`"${tpl.name}" yuklandi`);
  };

  const saveCurrentTemplate = () => {
    const name = def.name.trim() || 'Hisobot';
    const next = [...templates.filter((t) => t.name !== name), { ...def, name }];
    setTemplates(next);
    saveTemplates(next);
    setNotice(`"${name}" shablon sifatida saqlandi (shu brauzerda)`);
  };

  const deleteTemplate = (name: string) => {
    const next = templates.filter((t) => t.name !== name);
    setTemplates(next);
    saveTemplates(next);
  };

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(id);
  }, [notice]);

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) return;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>${esc(def.name)}</title>
<style>body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#0f172a}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 12px;font-size:12px;color:#475569}
table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left;vertical-align:top}th{background:#f1f5f9}tr:last-child td{font-weight:${report.grouped ? 700 : 400}}
@media print{body{padding:0}}</style></head><body>
<h1>${esc(def.name)}</h1><p>N = ${report.n} / ${report.total} · ${esc(new Date().toLocaleString('uz-UZ'))}${def.filter ? ` · Filtr: <code>${esc(def.filter)}</code>` : ''}${isGrouped ? ` · Guruh: <code>${esc(def.groupBy.filter(Boolean).join(', '))}</code>` : ''}</p>
${view === 'chart' && rendered ? `<div style="margin:12px 0 18px">${rendered.svg.replace('<svg ', '<svg style="width:100%;height:auto" ')}</div>` : ''}<table><thead><tr>${report.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${report.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c.text)}</td>`).join('')}</tr>`).join('')}</tbody></table>
<script>window.onload=function(){window.print()}</script></body></html>`;
    w.document.write(html);
    w.document.close();
  };

  const colError = (c: ReportColumn) => validateFormula(c.expr, knownVars);
  const filterError = def.filter.trim() ? validateFormula(def.filter, knownVars) : null;

  const previewRows = report.rows.slice(0, 300);

  // ── Diagramma ──
  const [view, setView] = useState<'table' | 'chart'>('table');
  const [chartKind, setChartKind] = useState<ChartKind | 'auto'>('auto');
  const [chartMetricIds, setChartMetricIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const metrics = useMemo(() => chartMetrics(report, def), [report, def]);
  const effectiveMetricIds = useMemo(() => {
    const valid = chartMetricIds.filter((id) => metrics.some((m) => m.id === id));
    if (valid.length) return valid;
    // Standart: guruhlanganda birinchi ustun ko'rsatkichi (bo'lmasa N), aks holda birinchi ustun
    if (isGrouped) return [metrics.find((m) => !m.id.startsWith('__'))?.id ?? metrics[0]?.id].filter(Boolean) as string[];
    return metrics[0] ? [metrics[0].id] : [];
  }, [chartMetricIds, metrics, isGrouped]);
  const groupLabels = useMemo(
    () =>
      def.groupBy
        .filter((g) => g.trim())
        .map((g) => {
          const snip = GROUP_SNIPPETS.find((x) => x.expr === g.trim());
          if (snip) return snip.label;
          const v = catalog.find((c) => c.name === g.trim().toLowerCase());
          if (!v) return g.trim();
          const text = v.label.replace(/^\d+[a-z]?\.\s*/, '').replace(/^Iltimos,\s*/i, '').split('(')[0].trim();
          return text.length > 40 ? `${text.slice(0, 39)}…` : text;
        }),
    [def.groupBy, catalog]
  );
  const chartSpec = useMemo(
    () => buildChartSpec(report, def, { kind: chartKind, metricIds: effectiveMetricIds, comma: true, groupLabels }),
    [report, def, chartKind, effectiveMetricIds, groupLabels]
  );
  const rendered = useMemo(() => (chartSpec ? renderChart(chartSpec) : null), [chartSpec]);
  const canPie = pieAllowed(report, effectiveMetricIds) && (chartSpec?.categories.length ?? 99) <= 6;

  const toggleMetric = (id: string) => {
    if (!isGrouped) {
      setChartMetricIds([id]);
      return;
    }
    const m = metrics.find((x) => x.id === id);
    const cur = effectiveMetricIds;
    const curUnit = metrics.find((x) => x.id === cur[0])?.unit;
    if (!m) return;
    if (cur.includes(id)) {
      const next = cur.filter((x) => x !== id);
      setChartMetricIds(next.length ? next : [id]);
    } else if (m.unit !== curUnit) {
      // Har xil birliklar bitta o'qda chizilmaydi — tanlov almashtiriladi
      setChartMetricIds([id]);
    } else {
      setChartMetricIds([...cur, id].slice(-4));
    }
  };

  const fileBase = `${APP_EXPORT_PREFIX}_${(def.name || 'Hisobot').replace(/[^\w\u0400-\u04FF'-]+/g, '_').slice(0, 60)}_${new Date().toISOString().slice(0, 10)}`;

  const downloadPng = async () => {
    if (!rendered) return;
    setBusy('png');
    setExportError(null);
    try {
      downloadBlob(await svgToPng(rendered), `${fileBase}.png`);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'PNG yaratilmadi');
    } finally {
      setBusy(null);
    }
  };

  const downloadWord = async () => {
    setBusy('word');
    setExportError(null);
    try {
      const blocks: DocBlock[] = [
        { type: 'title', text: def.name || 'Hisobot' },
        {
          type: 'kv',
          rows: [
            ['Sana', new Date().toLocaleString('uz-UZ')],
            ["Jami so'rovnomalar", report.total],
            ["Filtrdan o'tgan (N)", report.n],
            ['Filtr', def.filter.trim() || "yo'q"],
            ['Guruhlash', def.groupBy.filter((g) => g.trim()).join(', ') || "yo'q"],
          ],
        },
      ];
      if (rendered && chartSpec) {
        const png = new Uint8Array(await (await svgToPng(rendered)).arrayBuffer());
        blocks.push({ type: 'h2', text: 'Diagramma' });
        blocks.push({ type: 'image', png, width: rendered.width, height: rendered.height, caption: chartSpec.title });
      }
      blocks.push({ type: 'h2', text: 'Jadval' });
      blocks.push({
        type: 'table',
        headers: report.headers,
        rows: report.rows.map((r) => r.map((c) => c.text)),
        boldLastRow: isGrouped && report.rows.length > 1,
      });
      blocks.push({ type: 'h2', text: 'Metodika' });
      blocks.push({
        type: 'table',
        headers: ['Ustun', 'Formula', isGrouped ? 'Agregat' : ''].filter(Boolean),
        rows: def.columns.map((c) => [c.label || c.expr, c.expr, ...(isGrouped ? [AGG_LABELS[c.agg]] : [])]),
      });
      blocks.push({
        type: 'p',
        small: true,
        italic: true,
        text: "M — o'rtacha; m — standart xato (SD/√n); 95% IO — M ± 1,96·m; % — guruh ichidagi ulush.",
      });
      await exportDocx(blocks, { filename: `${fileBase}.docx`, landscape: report.headers.length > 6 });
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Word fayl yaratilmadi');
    } finally {
      setBusy(null);
    }
  };

  // ── Render ────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Sarlavha */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-900 text-white rounded-2xl p-5 md:p-6 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-emerald-300 text-[11px] font-bold uppercase tracking-widest">
              <Wand2 className="w-4 h-4" />
              Hisobot konstruktori
            </div>
            <h2 className="text-xl md:text-2xl font-black mt-1 leading-tight">
              Anketa ma'lumotlaridan istalgan hisobotni tuzing
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Ustunlarni tanlang yoki o'z formulangizni yozing, filtr va guruhlash qo'shing — natija darhol hisoblanadi
              va Excel / CSV / chop etish shaklida yuklab olinadi.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center shrink-0">
            <Stat label="Jami anketa" value={report.total} />
            <Stat label="Filtrdan o'tdi" value={report.n} accent />
            <Stat label={isGrouped ? 'Guruhlar' : 'Ustunlar'} value={isGrouped ? Math.max(0, report.rows.length - (report.rows.length > 1 ? 1 : 0)) : def.columns.length} />
          </div>
        </div>

        {/* Namunalar va shablonlar */}
        <div className="mt-4 flex flex-wrap gap-2">
          {SAMPLE_REPORTS.map((tpl) => (
            <button
              key={tpl.name}
              type="button"
              onClick={() => loadDefinition(tpl)}
              className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold transition"
            >
              {tpl.name}
            </button>
          ))}
          {templates.map((tpl) => (
            <span
              key={`tpl-${tpl.name}`}
              className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-xs font-semibold"
            >
              <button type="button" onClick={() => loadDefinition(tpl)} className="hover:underline">
                ★ {tpl.name}
              </button>
              <button
                type="button"
                onClick={() => deleteTemplate(tpl.name)}
                className="p-1 rounded-full hover:bg-white/20"
                title="Shablonni o'chirish"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {patientsNote && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">{patientsNote}</div>
      )}
      {notice && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold">{notice}</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start">
        {/* ── Chap: o'zgaruvchilar ── */}
        <aside className="space-y-3 xl:sticky xl:top-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <BookOpenText className="w-4 h-4 text-emerald-600" />
                  O'zgaruvchilar
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">{catalog.length} ta</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Ustiga bosing — tanlangan maydonga qo'shiladi. <b>+</b> tugmasi ustun sifatida qo'shadi.
              </p>
              <div className="relative mt-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={varSearch}
                  onChange={(e) => setVarSearch(e.target.value)}
                  placeholder="Qidirish: q9, sex, chekish..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="max-h-[55vh] overflow-y-auto divide-y divide-slate-100">
              {(['Profil', 'Natija', 'Klinik', 'Savol'] as const).map((g) => {
                const list = grouped[g] || [];
                if (!list.length) return null;
                const open = varGroupOpen[g] ?? true;
                return (
                  <div key={g}>
                    <button
                      type="button"
                      onClick={() => setVarGroupOpen((s) => ({ ...s, [g]: !open }))}
                      className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-600"
                    >
                      <span>
                        {g} <span className="text-slate-400 font-mono">({list.length})</span>
                      </span>
                      {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                    {open &&
                      list.map((v) => (
                        <div key={v.name} className="flex items-start gap-1 px-3 py-1.5 hover:bg-emerald-50/60 group">
                          <button
                            type="button"
                            onClick={() => insertSnippet(v.name)}
                            className="flex-1 min-w-0 text-left"
                            title={v.options ? `Variantlar: ${v.options.join(' | ')}` : v.label}
                          >
                            <span className="inline-block font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">
                              {v.name}
                            </span>
                            <span className="block text-[11px] text-slate-600 leading-snug mt-0.5 line-clamp-2">{v.label}</span>
                            {v.options && (
                              <span className="block text-[10px] text-slate-400 truncate">{v.options.join(' · ')}</span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => addColumn(v)}
                            className="shrink-0 p-1 rounded-lg text-slate-400 hover:bg-emerald-600 hover:text-white transition"
                            title="Ustun sifatida qo'shish"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                  </div>
                );
              })}
              {!filteredCatalog.length && <p className="p-4 text-xs text-slate-500">Topilmadi</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setShowFunctions((s) => !s)}
              className="w-full flex items-center justify-between p-4 text-sm font-bold text-slate-800"
            >
              <span className="flex items-center gap-2">
                <Sigma className="w-4 h-4 text-indigo-600" />
                Funksiyalar
              </span>
              {showFunctions ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {showFunctions && (
              <div className="max-h-[40vh] overflow-y-auto border-t border-slate-100 divide-y divide-slate-100">
                {Object.entries(FUNCTIONS).map(([name, f]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => insertSnippet(f.sig)}
                    className="w-full text-left px-4 py-2 hover:bg-indigo-50/60"
                  >
                    <span className="font-mono text-[11px] font-bold text-indigo-700">{f.sig}</span>
                    <span className="block text-[11px] text-slate-500 leading-snug">{f.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setShowHelp((s) => !s)}
              className="w-full flex items-center justify-between p-4 text-sm font-bold text-slate-800"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                Formula qoidalari
              </span>
              {showHelp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {showHelp && (
              <div className="border-t border-slate-100 p-4 text-[11px] text-slate-600 space-y-2 leading-relaxed">
                <p>
                  <b>Operatorlar:</b> <code>+ - * / ^</code>, taqqoslash <code>= != &lt; &lt;= &gt; &gt;=</code>, mantiq{' '}
                  <code>and or not</code>.
                </p>
                <p>
                  <b>Matn</b> qo'shtirnoq ichida: <code>q5 = "Erkak"</code>. Katta-kichik harf farqlanmaydi.
                </p>
                <p>
                  <b>Ko'p tanlovli</b> savollar (q42, q43 ...) uchun <code>INCLUDES(q42, "Nafas qisishi")</code> yoki{' '}
                  <code>q42 = "Nafas qisishi"</code>.
                </p>
                <p>
                  <b>Shart ustuni</b> (masalan <code>risk &gt;= 50</code>) guruhlashda <i>% (shart rost)</i> agregati bilan
                  ulushni beradi.
                </p>
                <p>
                  <b>Guruhlashda</b> har bir ustun uchun agregat tanlanadi: M ± m, mediana, 95% IO va h.k.
                </p>
                <p>
                  Misol: <code>IF(bmi &gt;= 30, "Semizlik", "Me'yor")</code>, <code>BUCKET(yosh, 30, 45, 60)</code>,{' '}
                  <code>AGE(q3)</code>, <code>SYS(q40) &gt;= 140</code>.
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* ── O'ng: konstruktor ── */}
        <div className="space-y-4 min-w-0">
          {/* Nomi */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Hisobot nomi</label>
            <input
              type="text"
              value={def.name}
              onChange={(e) => setDef((d) => ({ ...d, name: e.target.value }))}
              className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={saveCurrentTemplate}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <Save className="w-4 h-4" />
              Shablon saqlash
            </button>
            <button
              type="button"
              onClick={() => loadDefinition(EMPTY_DEF)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50"
            >
              <X className="w-4 h-4" />
              Tozalash
            </button>
          </div>

          {/* 1. Ustunlar */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <header className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white text-xs font-black flex items-center justify-center">1</span>
                <h3 className="font-bold text-slate-800">Ustunlar</h3>
                <span className="text-xs text-slate-400">({def.columns.length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value=""
                  onChange={(e) => {
                    const v = catalog.find((c) => c.name === e.target.value);
                    if (v) addColumn(v);
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white max-w-[260px]"
                >
                  <option value="">+ Tayyor o'zgaruvchi...</option>
                  {catalog.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} — {v.label.slice(0, 50)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => addColumn()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                >
                  <Plus className="w-4 h-4" />
                  Formula ustuni
                </button>
              </div>
            </header>
            <div className="divide-y divide-slate-100">
              {def.columns.map((c, i) => {
                const err = colError(c);
                return (
                  <div
                    key={c.id}
                    className={`p-3 grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_auto] gap-2 items-start ${
                      focusTarget.kind === 'col' && focusTarget.id === c.id ? 'bg-emerald-50/40' : ''
                    }`}
                  >
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Sarlavha</label>
                      <input
                        type="text"
                        value={c.label}
                        onChange={(e) => updateColumn(c.id, { label: e.target.value })}
                        placeholder="Ustun nomi"
                        className="w-full mt-0.5 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      {isGrouped && (
                        <select
                          value={c.agg}
                          onChange={(e) => updateColumn(c.id, { agg: e.target.value as AggFn })}
                          className="w-full mt-1.5 px-2 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-xs font-semibold text-indigo-800"
                        >
                          {(Object.keys(AGG_LABELS) as AggFn[]).map((k) => (
                            <option key={k} value={k}>
                              {AGG_LABELS[k]}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="min-w-0">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Formula / o'zgaruvchi</label>
                      <input
                        ref={(el) => {
                          inputRefs.current[`col-${c.id}`] = el;
                        }}
                        type="text"
                        value={c.expr}
                        onFocus={() => setFocusTarget({ kind: 'col', id: c.id })}
                        onChange={(e) => updateColumn(c.id, { expr: e.target.value })}
                        placeholder={'masalan: risk  yoki  IF(bmi >= 30, "Semizlik", "Me\'yor")'}
                        spellCheck={false}
                        className={`w-full mt-0.5 px-3 py-2 rounded-xl border font-mono text-sm focus:ring-2 focus:outline-none ${
                          err ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-slate-200 focus:ring-emerald-500'
                        }`}
                      />
                      {err && <p className="text-[11px] text-red-600 mt-1">{err}</p>}
                    </div>
                    <div className="flex md:flex-col gap-1 md:pt-5">
                      <IconBtn onClick={() => moveColumn(c.id, -1)} disabled={i === 0} title="Yuqoriga">
                        <ArrowUp className="w-3.5 h-3.5" />
                      </IconBtn>
                      <IconBtn onClick={() => moveColumn(c.id, 1)} disabled={i === def.columns.length - 1} title="Pastga">
                        <ArrowDown className="w-3.5 h-3.5" />
                      </IconBtn>
                      <IconBtn onClick={() => removeColumn(c.id)} title="O'chirish" danger>
                        <Trash2 className="w-3.5 h-3.5" />
                      </IconBtn>
                    </div>
                  </div>
                );
              })}
              {def.columns.length === 0 && (
                <p className="p-6 text-center text-sm text-slate-500">
                  Ustun qo'shing — chapdagi ro'yxatdan <b>+</b> ni bosing yoki "Formula ustuni" tugmasidan foydalaning.
                </p>
              )}
            </div>
          </section>

          {/* 2. Filtr */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <header className="p-4 border-b border-slate-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white text-xs font-black flex items-center justify-center">2</span>
              <Filter className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-slate-800">Filtr (shart)</h3>
              <span className="text-xs text-slate-400">— bo'sh qoldirilsa barcha anketalar kiradi</span>
            </header>
            <div className="p-4 space-y-3">
              <textarea
                ref={(el) => {
                  inputRefs.current.filter = el;
                }}
                rows={2}
                value={def.filter}
                onFocus={() => setFocusTarget({ kind: 'filter' })}
                onChange={(e) => setDef((d) => ({ ...d, filter: e.target.value }))}
                placeholder='masalan: jins = "Erkak" and risk >= 50 and q9 = "Elektr sexi"'
                spellCheck={false}
                className={`w-full px-3 py-2 rounded-xl border font-mono text-sm focus:ring-2 focus:outline-none ${
                  filterError ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-500'
                }`}
              />
              {filterError && <p className="text-[11px] text-red-600">{filterError}</p>}
              <div className="flex flex-wrap gap-1.5">
                {FILTER_SNIPPETS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => {
                      setFocusTarget({ kind: 'filter' });
                      setDef((d) => ({ ...d, filter: d.filter.trim() ? `${d.filter.trim()} and ${s.expr}` : s.expr }));
                    }}
                    className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-800 text-[11px] font-semibold hover:bg-blue-100"
                    title={s.expr}
                  >
                    + {s.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 3. Guruhlash */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <header className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-black flex items-center justify-center">3</span>
              <Layers className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-800">Guruhlash va tartib</h3>
              <span className="text-xs text-slate-400">— guruhlansa har bir ustun agregat (M±m, %, ...) bo'ladi</span>
            </header>
            <div className="p-4 space-y-3">
              {def.groupBy.map((g, i) => {
                const err = g.trim() ? validateFormula(g, knownVars) : null;
                return (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 min-w-0">
                      <input
                        ref={(el) => {
                          inputRefs.current[`group-${i}`] = el;
                        }}
                        type="text"
                        value={g}
                        onFocus={() => setFocusTarget({ kind: 'group', index: i })}
                        onChange={(e) =>
                          setDef((d) => ({ ...d, groupBy: d.groupBy.map((x, j) => (j === i ? e.target.value : x)) }))
                        }
                        placeholder="masalan: q9  yoki  BUCKET(yosh, 30, 45, 60)"
                        spellCheck={false}
                        className={`w-full px-3 py-2 rounded-xl border font-mono text-sm focus:ring-2 focus:outline-none ${
                          err ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-slate-200 focus:ring-indigo-500'
                        }`}
                      />
                      {err && <p className="text-[11px] text-red-600 mt-1">{err}</p>}
                    </div>
                    <IconBtn
                      onClick={() => setDef((d) => ({ ...d, groupBy: d.groupBy.filter((_, j) => j !== i) }))}
                      title="O'chirish"
                      danger
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </IconBtn>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-1.5 items-center">
                <button
                  type="button"
                  onClick={() => {
                    setDef((d) => ({ ...d, groupBy: [...d.groupBy, ''] }));
                    setFocusTarget({ kind: 'group', index: def.groupBy.length });
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-600 text-white text-[11px] font-bold hover:bg-indigo-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Guruh qo'shish
                </button>
                {GROUP_SNIPPETS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setDef((d) => ({ ...d, groupBy: [...d.groupBy.filter((x) => x.trim()), s.expr] }))}
                    className="px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-800 text-[11px] font-semibold hover:bg-indigo-100"
                    title={s.expr}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {!isGrouped && (
                <div className="flex flex-wrap gap-3 items-end pt-2 border-t border-slate-100">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Tartiblash</label>
                    <select
                      value={def.sortBy?.columnId ?? ''}
                      onChange={(e) =>
                        setDef((d) => ({
                          ...d,
                          sortBy: e.target.value ? { columnId: e.target.value, dir: d.sortBy?.dir ?? 'asc' } : null,
                        }))
                      }
                      className="block mt-0.5 px-3 py-2 rounded-xl border border-slate-200 text-sm"
                    >
                      <option value="">— yo'q —</option>
                      {def.columns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label || c.expr}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Yo'nalish</label>
                    <select
                      value={def.sortBy?.dir ?? 'asc'}
                      disabled={!def.sortBy}
                      onChange={(e) =>
                        setDef((d) => (d.sortBy ? { ...d, sortBy: { ...d.sortBy, dir: e.target.value as 'asc' | 'desc' } } : d))
                      }
                      className="block mt-0.5 px-3 py-2 rounded-xl border border-slate-200 text-sm disabled:opacity-50"
                    >
                      <option value="asc">O'sish</option>
                      <option value="desc">Kamayish</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Qatorlar limiti</label>
                    <input
                      type="number"
                      min={0}
                      value={def.limit ?? ''}
                      onChange={(e) => setDef((d) => ({ ...d, limit: e.target.value ? parseInt(e.target.value, 10) : null }))}
                      placeholder="hammasi"
                      className="block mt-0.5 w-28 px-3 py-2 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Natija */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <header className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  Natija
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    N = {report.n}
                  </span>
                  {isGrouped && (
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                      {Math.max(0, report.rows.length - (report.rows.length > 1 ? 1 : 0))} guruh
                    </span>
                  )}
                </h3>
                {report.rows.length > previewRows.length && (
                  <p className="text-[11px] text-slate-500">Ko'rinishda birinchi {previewRows.length} qator; eksportda hammasi.</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex rounded-xl border border-slate-200 p-0.5 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setView('table')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition ${
                      view === 'table' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Table2 className="w-4 h-4" />
                    Jadval
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('chart')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition ${
                      view === 'chart' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    Diagramma
                  </button>
                </div>
                <button
                  type="button"
                  disabled={!report.rows.length || !!report.errors.length || busy !== null}
                  onClick={downloadWord}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-700 text-white text-sm font-bold hover:bg-blue-800 disabled:opacity-40"
                >
                  {busy === 'word' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Word
                </button>
                {view === 'chart' && (
                  <button
                    type="button"
                    disabled={!rendered || busy !== null}
                    onClick={downloadPng}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-40"
                  >
                    {busy === 'png' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageDown className="w-4 h-4" />}
                    Diagramma PNG
                  </button>
                )}
                <button
                  type="button"
                  disabled={!report.rows.length || !!report.errors.length}
                  onClick={() => exportReportToExcel(report, def)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-40"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel
                </button>
                <button
                  type="button"
                  disabled={!report.rows.length || !!report.errors.length}
                  onClick={() => exportReportToCsv(report, def)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-900 disabled:opacity-40"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>
                <button
                  type="button"
                  disabled={!report.rows.length || !!report.errors.length}
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 disabled:opacity-40"
                >
                  <Printer className="w-4 h-4" />
                  Chop etish / PDF
                </button>
              </div>
            </header>

            {report.errors.length > 0 && (
              <div className="m-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs space-y-1">
                <p className="font-bold">Formulalarda xato bor:</p>
                {report.errors.map((e, i) => (
                  <p key={i}>• {e}</p>
                ))}
              </div>
            )}

            {exportError && (
              <div className="m-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">{exportError}</div>
            )}

            {view === 'chart' && (
              <div className="p-4 space-y-3">
                {metrics.length > 0 && (
                  <div className="flex flex-wrap items-start gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Turi</p>
                      <div className="flex flex-wrap gap-1">
                        {([
                          ['auto', 'Avto'],
                          ['bar', 'Ustun'],
                          ['hbar', 'Gorizontal'],
                          ['line', 'Chiziq'],
                          ['pie', 'Doira'],
                        ] as const).map(([k, l]) => (
                          <button
                            key={k}
                            type="button"
                            disabled={k === 'pie' && !canPie}
                            title={k === 'pie' && !canPie ? 'Doira faqat bitta "N" yoki "%" ko\'rsatkichi va 6 tagacha guruh uchun' : undefined}
                            onClick={() => setChartKind(k)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition disabled:opacity-30 ${
                              chartKind === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                        {isGrouped ? "Ko'rsatkich (bir xil birlikdagi 4 tagacha)" : 'Qaysi ustun taqsimoti'}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {metrics.map((m) => {
                          const on = effectiveMetricIds.includes(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => toggleMetric(m.id)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
                                on ? 'bg-indigo-50 text-indigo-800 border-indigo-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {on ? '✓ ' : ''}
                              {m.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
                {rendered ? (
                  <div
                    className="w-full overflow-x-auto rounded-xl border border-slate-100 [&_svg]:w-full [&_svg]:h-auto [&_svg]:min-w-[640px]"
                    dangerouslySetInnerHTML={{ __html: rendered.svg }}
                  />
                ) : (
                  <p className="p-8 text-center text-sm text-slate-500">
                    Diagramma uchun natija yo'q — ustun qo'shing yoki filtrni o'zgartiring.
                  </p>
                )}
                <p className="text-[11px] text-slate-500">
                  Ustun ustiga sichqonchani olib borsangiz, aniq qiymat ko'rinadi. Word faylga shu diagramma va jadval birga tushadi.
                </p>
              </div>
            )}

            <div className={`overflow-x-auto ${view === 'chart' ? 'hidden' : ''}`}>
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {report.headers.map((h, i) => (
                      <th key={i} className="text-left p-2.5 font-bold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, ri) => {
                    const isTotal = isGrouped && ri === report.rows.length - 1 && report.rows.length > 1;
                    return (
                      <tr key={ri} className={`border-b border-slate-100 ${isTotal ? 'bg-emerald-50 font-bold' : 'hover:bg-slate-50'}`}>
                        {r.map((c, ci) => (
                          <td key={ci} className="p-2.5 text-slate-700 align-top max-w-[320px]">
                            <span className="line-clamp-3">{c.text}</span>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {!previewRows.length && (
                    <tr>
                      <td colSpan={Math.max(1, report.headers.length)} className="p-10 text-center text-slate-500">
                        {surveys.length === 0
                          ? "Hali so'rovnoma yo'q."
                          : def.columns.length === 0
                            ? 'Ustun qo\'shing.'
                            : 'Filtr bo\'yicha natija topilmadi.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2 border ${accent ? 'bg-emerald-500/20 border-emerald-400/40' : 'bg-white/10 border-white/15'}`}>
      <div className="text-xl font-black leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-300 mt-1">{label}</div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-lg border text-slate-500 disabled:opacity-30 ${
        danger ? 'border-red-100 hover:bg-red-50 hover:text-red-600' : 'border-slate-200 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}
