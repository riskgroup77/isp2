/**
 * Hisobot konstruktori yadrosi: so'rovnoma javoblarini tekis "qator"larga
 * aylantiradi, ustunlar/filtr/guruhlash/agregatlarni hisoblaydi va
 * Excel/CSV ga eksport qiladi.
 */
import * as XLSX from 'xlsx';
import type { PatientListItem, Question, SurveyResponseOut } from '../types/api';
import { APP_EXPORT_PREFIX } from './branding';
import {
  ageFromDate,
  compileFormula,
  toNum,
  toStr,
  truthy,
  type CompiledFormula,
  type Ctx,
  type Val,
} from './formulaEngine';

// ── O'zgaruvchilar katalogi ───────────────────────────

export interface VariableDef {
  /** Formulada ishlatiladigan nom (kichik harf): q5, risk, tmi ... */
  name: string;
  label: string;
  group: 'Profil' | 'Natija' | 'Klinik' | 'Savol';
  type: 'number' | 'text' | 'list' | 'bool' | 'date';
  options?: string[];
  questionId?: string;
}

const FIXED_VARS: VariableDef[] = [
  { name: 'ism', label: 'F.I.SH. (profil)', group: 'Profil', type: 'text' },
  { name: 'login', label: 'Login', group: 'Profil', type: 'text' },
  { name: 'user_id', label: 'Foydalanuvchi ID', group: 'Profil', type: 'text' },
  { name: 'yosh', label: "Yosh (q3 yoki profil bo'yicha)", group: 'Profil', type: 'number' },
  { name: 'jins', label: 'Jins (q5 yoki profil)', group: 'Profil', type: 'text', options: ['Erkak', 'Ayol'] },
  { name: 'sana', label: "To'ldirilgan sana (YYYY-MM-DD)", group: 'Profil', type: 'date' },
  { name: 'yil', label: "To'ldirilgan yil", group: 'Profil', type: 'number' },
  { name: 'oy', label: "To'ldirilgan oy", group: 'Profil', type: 'number' },
  { name: 'risk', label: 'Xavf foizi (AI yoki ball)', group: 'Natija', type: 'number' },
  { name: 'ball', label: "Ball (score_total)", group: 'Natija', type: 'number' },
  { name: 'zona', label: 'Xavf zonasi', group: 'Natija', type: 'text', options: ['yashil', 'sariq', 'sargish', 'qizil'] },
  { name: 'tmi', label: 'TMI (AI hisoblagan)', group: 'Natija', type: 'number' },
  { name: 'tmi_kat', label: 'TMI kategoriyasi', group: 'Natija', type: 'text' },
  { name: 'javoblar', label: 'Javoblar soni', group: 'Natija', type: 'number' },
  { name: 'ai_xato', label: 'AI xatosi (bor/yo\'q)', group: 'Natija', type: 'bool' },
  { name: 'vazn', label: 'Vazn, kg (q4 / klinik)', group: 'Klinik', type: 'number' },
  { name: 'boy', label: "Bo'y, sm (klinik)", group: 'Klinik', type: 'number' },
  { name: 'bmi', label: 'TMI hisoblangan (vazn/boy²)', group: 'Klinik', type: 'number' },
  { name: 'sistolik', label: 'Sistolik bosim (klinik yoki q40)', group: 'Klinik', type: 'number' },
  { name: 'diastolik', label: 'Diastolik bosim (klinik yoki q40)', group: 'Klinik', type: 'number' },
  { name: 'glyukoza', label: 'Glyukoza, mmol/l (klinik)', group: 'Klinik', type: 'number' },
  { name: 'xolesterin', label: 'Xolesterin, mmol/l (klinik)', group: 'Klinik', type: 'number' },
];

export function questionVarName(id: string | number): string {
  return `q${String(id).toLowerCase()}`;
}

export function buildVariableCatalog(
  questions: Question[],
  surveys: SurveyResponseOut[]
): VariableDef[] {
  const qVars: VariableDef[] = questions.map((q) => ({
    name: questionVarName(q.id),
    label: `${q.id}. ${q.text}`,
    group: 'Savol',
    type:
      q.type === 'multi_choice'
        ? 'list'
        : q.type === 'number'
          ? 'number'
          : q.type === 'date'
            ? 'date'
            : 'text',
    options: q.options?.length ? q.options : undefined,
    questionId: String(q.id),
  }));
  const known = new Set([...FIXED_VARS, ...qVars].map((v) => v.name));
  // Backend javoblarda savolnomada yo'q kalitlar bo'lsa, ularni ham ko'rsatamiz
  const extra: VariableDef[] = [];
  surveys.forEach((s) => {
    Object.keys(s.answers || {}).forEach((k) => {
      const name = /^\d/.test(k) ? questionVarName(k) : k.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (!known.has(name) && !extra.some((e) => e.name === name)) {
        extra.push({ name, label: `${k} (javoblardan)`, group: 'Savol', type: 'text', questionId: k });
      }
    });
  });
  return [...FIXED_VARS, ...qVars, ...extra];
}

// ── Qator konteksti ───────────────────────────────────

export interface ReportRow {
  survey: SurveyResponseOut;
  ctx: Ctx;
}

function pickNum(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = toNum(v as Val);
    if (n !== null) return n;
  }
  return null;
}

function parseBP(text: unknown): { sys: number | null; dia: number | null } {
  const s = toStr(text as Val);
  const m = s.match(/(\d{2,3})\s*[/\\-]\s*(\d{2,3})/);
  if (m) return { sys: parseInt(m[1], 10), dia: parseInt(m[2], 10) };
  return { sys: toNum(s), dia: null };
}

export function buildRows(
  surveys: SurveyResponseOut[],
  questions: Question[],
  patientsById?: Map<string, PatientListItem>
): ReportRow[] {
  const qById = new Map(questions.map((q) => [String(q.id), q]));
  return surveys.map((s) => {
    const a = (s.answers || {}) as Record<string, unknown>;
    const ai = (s.ai_response || {}) as Record<string, unknown>;
    const klinik = (a.klinik && typeof a.klinik === 'object' ? a.klinik : {}) as Record<string, unknown>;
    const patient = patientsById?.get(s.user_id);
    const ctx: Ctx = {};

    // Savol javoblari
    Object.entries(a).forEach(([k, v]) => {
      if (k === 'klinik') return;
      const name = /^\d/.test(k) ? questionVarName(k) : k.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (Array.isArray(v)) ctx[name] = v.map((x) => toStr(x as Val));
      else if (v === null || v === undefined) ctx[name] = null;
      else if (typeof v === 'object') ctx[name] = JSON.stringify(v);
      else ctx[name] = v as Val;
    });
    // Savolnomada bor, lekin javob berilmagan savollar — null
    qById.forEach((_q, id) => {
      const name = questionVarName(id);
      if (!(name in ctx)) ctx[name] = null;
    });

    const created = new Date(s.created_at);
    const validDate = !Number.isNaN(created.getTime());
    const genderAns = toStr((a['5'] as Val) ?? null);
    const jins =
      genderAns ||
      (patient?.jins === 'erkak' ? 'Erkak' : patient?.jins === 'ayol' ? 'Ayol' : '');
    const yosh = ageFromDate((a['3'] as Val) ?? null) ?? pickNum(a['yosh'], patient?.yosh);

    const vazn = pickNum(klinik.vazn, a['vazn'], a['4']);
    const boy = pickNum(klinik.boy, a['boy']);
    const bp = parseBP(a['40']);
    const sistolik = pickNum(klinik.sistolik, a['sistolik']) ?? bp.sys;
    const diastolik = pickNum(klinik.diastolik, a['diastolik']) ?? bp.dia;
    const bmiCalc =
      vazn !== null && boy !== null && boy > 0
        ? Math.round((vazn / ((boy / 100) * (boy / 100))) * 10) / 10
        : null;

    const riskAi = toNum((ai.riskFoizi as Val) ?? null);
    Object.assign(ctx, {
      ism: patient?.ism ?? '',
      login: patient?.login ?? '',
      user_id: s.user_id,
      yosh,
      jins,
      sana: validDate ? created.toISOString().slice(0, 10) : '',
      yil: validDate ? created.getFullYear() : null,
      oy: validDate ? created.getMonth() + 1 : null,
      risk: riskAi ?? s.score_total ?? null,
      ball: s.score_total ?? null,
      zona: s.risk_zonasi || toStr((ai.zona as Val) ?? null) || '',
      tmi: toNum((ai.tmi as Val) ?? null),
      tmi_kat: toStr((ai.tmiKategoriya as Val) ?? null),
      javoblar: s.answered_count ?? null,
      ai_xato: !!s.ai_xato,
      vazn,
      boy,
      bmi: toNum((ai.tmi as Val) ?? null) ?? bmiCalc,
      sistolik,
      diastolik,
      glyukoza: pickNum(klinik.glyukoza, a['glyukoza']),
      xolesterin: pickNum(klinik.xolesterin, a['xolesterin']),
    } satisfies Ctx);
    return { survey: s, ctx };
  });
}

// ── Hisobot ta'rifi ───────────────────────────────────

export type AggFn =
  | 'count'
  | 'count_true'
  | 'pct_true'
  | 'sum'
  | 'mean'
  | 'sd'
  | 'se'
  | 'mean_se'
  | 'median'
  | 'min'
  | 'max'
  | 'ci95'
  | 'first'
  | 'list';

export const AGG_LABELS: Record<AggFn, string> = {
  count: "Soni (bo'sh bo'lmagan)",
  count_true: "Soni (shart rost)",
  pct_true: '% (shart rost / guruh)',
  sum: "Yig'indi",
  mean: "O'rtacha (M)",
  sd: 'Standart og\'ish (SD)',
  se: "Standart xato (m)",
  mean_se: 'M ± m',
  median: 'Mediana',
  min: 'Min',
  max: 'Max',
  ci95: '95% ishonch oralig\'i',
  first: 'Birinchi qiymat',
  list: 'Noyob qiymatlar',
};

export interface ReportColumn {
  id: string;
  label: string;
  /** Formula (o'zgaruvchi nomi ham formula hisoblanadi: "q5") */
  expr: string;
  /** Guruhlanganda qo'llaniladigan agregat */
  agg: AggFn;
}

export interface ReportDefinition {
  name: string;
  columns: ReportColumn[];
  /** Mantiqiy formula; bo'sh bo'lsa hammasi kiradi */
  filter: string;
  /** Guruhlash uchun formulalar (odatda o'zgaruvchi nomi) */
  groupBy: string[];
  sortBy?: { columnId: string; dir: 'asc' | 'desc' } | null;
  limit?: number | null;
}

export interface ComputedCell {
  raw: Val;
  text: string;
}

export interface ComputedReport {
  headers: string[];
  rows: ComputedCell[][];
  /** Filtrdan o'tgan qatorlar soni */
  n: number;
  /** Umumiy qatorlar soni */
  total: number;
  grouped: boolean;
  errors: string[];
}

export function makeColumnId(): string {
  return `c${Math.random().toString(36).slice(2, 8)}`;
}

// ── Statistika ────────────────────────────────────────

function nums(vals: Val[]): number[] {
  return vals.map(toNum).filter((n): n is number => n !== null);
}

export function meanOf(ns: number[]): number | null {
  return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
}

export function sdOf(ns: number[]): number | null {
  if (ns.length < 2) return null;
  const m = meanOf(ns) as number;
  return Math.sqrt(ns.reduce((acc, v) => acc + (v - m) ** 2, 0) / (ns.length - 1));
}

export function seOf(ns: number[]): number | null {
  const sd = sdOf(ns);
  return sd === null ? null : sd / Math.sqrt(ns.length);
}

export function medianOf(ns: number[]): number | null {
  if (!ns.length) return null;
  const s = [...ns].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function fmtNum(n: number | null, digits = 2): string {
  if (n === null || !Number.isFinite(n)) return '';
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  return String(Number.isInteger(r) ? r : r.toFixed(digits));
}

export function aggregate(vals: Val[], fn: AggFn, groupSize: number): ComputedCell {
  const ns = nums(vals);
  switch (fn) {
    case 'count': {
      const c = vals.filter((v) => v !== null && v !== undefined && toStr(v).trim() !== '').length;
      return { raw: c, text: String(c) };
    }
    case 'count_true': {
      const c = vals.filter(truthy).length;
      return { raw: c, text: String(c) };
    }
    case 'pct_true': {
      const c = vals.filter(truthy).length;
      const p = groupSize ? (c / groupSize) * 100 : null;
      return { raw: p, text: p === null ? '' : `${fmtNum(p, 1)}%` };
    }
    case 'sum': {
      const s = ns.length ? ns.reduce((a, b) => a + b, 0) : null;
      return { raw: s, text: fmtNum(s) };
    }
    case 'mean': {
      const m = meanOf(ns);
      return { raw: m, text: fmtNum(m) };
    }
    case 'sd': {
      const sd = sdOf(ns);
      return { raw: sd, text: fmtNum(sd) };
    }
    case 'se': {
      const se = seOf(ns);
      return { raw: se, text: fmtNum(se, 3) };
    }
    case 'mean_se': {
      const m = meanOf(ns);
      const se = seOf(ns);
      if (m === null) return { raw: null, text: '' };
      return { raw: m, text: se === null ? fmtNum(m) : `${fmtNum(m)} ± ${fmtNum(se)}` };
    }
    case 'median': {
      const md = medianOf(ns);
      return { raw: md, text: fmtNum(md) };
    }
    case 'min': {
      const v = ns.length ? Math.min(...ns) : null;
      return { raw: v, text: fmtNum(v) };
    }
    case 'max': {
      const v = ns.length ? Math.max(...ns) : null;
      return { raw: v, text: fmtNum(v) };
    }
    case 'ci95': {
      const m = meanOf(ns);
      const se = seOf(ns);
      if (m === null || se === null) return { raw: m, text: fmtNum(m) };
      return { raw: m, text: `${fmtNum(m - 1.96 * se)} – ${fmtNum(m + 1.96 * se)}` };
    }
    case 'first': {
      const v = vals.find((x) => x !== null && toStr(x) !== '') ?? null;
      return { raw: v, text: toStr(v) };
    }
    case 'list': {
      const uniq = [...new Set(vals.flatMap((v) => (Array.isArray(v) ? v.map(toStr) : [toStr(v)])).filter(Boolean))];
      return { raw: uniq.join(', '), text: uniq.join(', ') };
    }
  }
}

export function formatCell(v: Val): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return fmtNum(v, 2);
  if (typeof v === 'boolean') return v ? 'Ha' : "Yo'q";
  return toStr(v);
}

// ── Hisoblash ─────────────────────────────────────────

export function computeReport(rows: ReportRow[], def: ReportDefinition, knownVars?: Set<string>): ComputedReport {
  const errors: string[] = [];
  const compiledCols: Array<{ col: ReportColumn; f: CompiledFormula | null }> = def.columns.map((col) => {
    try {
      return { col, f: compileFormula(col.expr, knownVars) };
    } catch (e) {
      errors.push(`"${col.label || col.expr}": ${e instanceof Error ? e.message : String(e)}`);
      return { col, f: null };
    }
  });

  let filterF: CompiledFormula | null = null;
  if (def.filter.trim()) {
    try {
      filterF = compileFormula(def.filter, knownVars);
    } catch (e) {
      errors.push(`Filtr: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const groupFs: CompiledFormula[] = [];
  def.groupBy
    .filter((g) => g.trim())
    .forEach((g) => {
      try {
        groupFs.push(compileFormula(g, knownVars));
      } catch (e) {
        errors.push(`Guruhlash "${g}": ${e instanceof Error ? e.message : String(e)}`);
      }
    });

  const filtered = filterF
    ? rows.filter((r) => {
        try {
          return truthy(filterF!.eval(r.ctx));
        } catch {
          return false;
        }
      })
    : rows;

  const safeEval = (f: CompiledFormula | null, ctx: Ctx): Val => {
    if (!f) return null;
    try {
      return f.eval(ctx);
    } catch {
      return null;
    }
  };

  const grouped = groupFs.length > 0;
  let headers: string[];
  let outRows: ComputedCell[][];

  if (!grouped) {
    headers = ['№', ...compiledCols.map(({ col }) => col.label || col.expr)];
    outRows = filtered.map((r, i) => [
      { raw: i + 1, text: String(i + 1) },
      ...compiledCols.map(({ f }) => {
        const v = safeEval(f, r.ctx);
        return { raw: v, text: formatCell(v) };
      }),
    ]);
  } else {
    const groups = new Map<string, { keys: Val[]; rows: ReportRow[] }>();
    filtered.forEach((r) => {
      const keys = groupFs.map((f) => safeEval(f, r.ctx));
      const k = JSON.stringify(keys.map((x) => (Array.isArray(x) ? x.join('|') : x)));
      const g = groups.get(k);
      if (g) g.rows.push(r);
      else groups.set(k, { keys, rows: [r] });
    });
    headers = [
      ...def.groupBy.filter((g) => g.trim()).map((g) => g),
      'N',
      '% (jami)',
      ...compiledCols.map(({ col }) => `${col.label || col.expr} — ${AGG_LABELS[col.agg]}`),
    ];
    outRows = [...groups.values()]
      .sort((a, b) => {
        for (let i = 0; i < a.keys.length; i++) {
          const x = formatCell(a.keys[i]);
          const y = formatCell(b.keys[i]);
          const nx = toNum(a.keys[i]);
          const ny = toNum(b.keys[i]);
          const c = nx !== null && ny !== null ? nx - ny : x.localeCompare(y, 'uz');
          if (c !== 0) return c;
        }
        return 0;
      })
      .map((g) => {
        const pct = filtered.length ? (g.rows.length / filtered.length) * 100 : 0;
        return [
          ...g.keys.map((k) => ({ raw: k, text: formatCell(k) || '(bo\'sh)' })),
          { raw: g.rows.length, text: String(g.rows.length) },
          { raw: pct, text: `${fmtNum(pct, 1)}%` },
          ...compiledCols.map(({ f, col }) =>
            aggregate(
              g.rows.map((r) => safeEval(f, r.ctx)),
              col.agg,
              g.rows.length
            )
          ),
        ];
      });
    // Jami qatori
    if (outRows.length > 1) {
      const keyCount = groupFs.length;
      const totalRow: ComputedCell[] = [
        { raw: 'JAMI', text: 'JAMI' },
        ...Array.from({ length: keyCount - 1 }, () => ({ raw: '', text: '' })),
        { raw: filtered.length, text: String(filtered.length) },
        { raw: 100, text: '100%' },
        ...compiledCols.map(({ f, col }) =>
          aggregate(
            filtered.map((r) => safeEval(f, r.ctx)),
            col.agg,
            filtered.length
          )
        ),
      ];
      outRows.push(totalRow);
    }
  }

  if (def.sortBy && !grouped) {
    const idx = def.columns.findIndex((c) => c.id === def.sortBy!.columnId);
    if (idx >= 0) {
      const ci = idx + 1;
      const dir = def.sortBy.dir === 'desc' ? -1 : 1;
      outRows.sort((a, b) => {
        const x = a[ci].raw;
        const y = b[ci].raw;
        const nx = toNum(x);
        const ny = toNum(y);
        if (nx !== null && ny !== null) return (nx - ny) * dir;
        return formatCell(x).localeCompare(formatCell(y), 'uz') * dir;
      });
      outRows.forEach((r, i) => {
        r[0] = { raw: i + 1, text: String(i + 1) };
      });
    }
  }

  if (def.limit && def.limit > 0 && !grouped) outRows = outRows.slice(0, def.limit);

  return { headers, rows: outRows, n: filtered.length, total: rows.length, grouped, errors };
}

// ── Eksport ───────────────────────────────────────────

function safeFileName(s: string): string {
  return (s || 'Hisobot').replace(/[^\wЀ-ӿ'-]+/g, '_').slice(0, 60);
}

export function exportReportToExcel(report: ComputedReport, def: ReportDefinition): void {
  const wb = XLSX.utils.book_new();
  const aoa: (string | number | null)[][] = [
    report.headers,
    ...report.rows.map((r) => r.map((c) => (typeof c.raw === 'number' && !report.grouped ? c.raw : c.text))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = report.headers.map((h, i) => ({
    wch: Math.min(60, Math.max(h.length + 2, ...report.rows.slice(0, 200).map((r) => (r[i]?.text || '').length + 2))),
  }));
  XLSX.utils.book_append_sheet(wb, ws, 'Hisobot');

  const meta: (string | number)[][] = [
    ['Hisobot nomi', def.name || 'Hisobot'],
    ['Sana', new Date().toLocaleString('uz-UZ')],
    ['Jami so\'rovnomalar', report.total],
    ['Filtrdan o\'tgan (N)', report.n],
    ['Filtr formulasi', def.filter || '(yo\'q)'],
    ['Guruhlash', def.groupBy.filter(Boolean).join(', ') || '(yo\'q)'],
    [],
    ['Ustun', 'Formula', 'Agregat'],
    ...def.columns.map((c) => [c.label || c.expr, c.expr, report.grouped ? AGG_LABELS[c.agg] : '—']),
    [],
    ['Izoh', 'M — o\'rtacha; m — standart xato (SD/√n); 95% IO — M ± 1,96·m; % — guruh ichidagi ulush.'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(meta);
  ws2['!cols'] = [{ wch: 28 }, { wch: 60 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Metodika');

  XLSX.writeFile(
    wb,
    `${APP_EXPORT_PREFIX}_${safeFileName(def.name)}_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

export function exportReportToCsv(report: ComputedReport, def: ReportDefinition): void {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [report.headers.map(esc).join(';'), ...report.rows.map((r) => r.map((c) => esc(c.text)).join(';'))];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${APP_EXPORT_PREFIX}_${safeFileName(def.name)}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ── Shablonlar (localStorage) ─────────────────────────

const TEMPLATES_KEY = 'admin_report_templates_v1';

export function loadTemplates(): ReportDefinition[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTemplates(list: ReportDefinition[]): void {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
}

// ── Tayyor namunalar ──────────────────────────────────

export const SAMPLE_REPORTS: ReportDefinition[] = [
  {
    name: "Xodimlar ro'yxati (asosiy ko'rsatkichlar)",
    columns: [
      { id: 's1', label: 'F.I.SH.', expr: 'ism', agg: 'first' },
      { id: 's2', label: 'Jins', expr: 'jins', agg: 'first' },
      { id: 's3', label: 'Yosh', expr: 'yosh', agg: 'mean' },
      { id: 's4', label: 'Sex', expr: 'q9', agg: 'first' },
      { id: 's5', label: 'Kasb', expr: 'q8', agg: 'first' },
      { id: 's6', label: 'Xavf %', expr: 'risk', agg: 'mean_se' },
      { id: 's7', label: 'Zona', expr: 'zona', agg: 'first' },
      { id: 's8', label: 'TMI', expr: 'bmi', agg: 'mean_se' },
    ],
    filter: '',
    groupBy: [],
  },
  {
    name: "Sexlar bo'yicha o'rtacha xavf va TMI (M ± m)",
    columns: [
      { id: 'g1', label: 'Xavf %', expr: 'risk', agg: 'mean_se' },
      { id: 'g2', label: 'TMI', expr: 'bmi', agg: 'mean_se' },
      { id: 'g3', label: 'Yosh', expr: 'yosh', agg: 'mean_se' },
      { id: 'g4', label: 'Qizil zona', expr: 'zona = "qizil"', agg: 'pct_true' },
      { id: 'g5', label: 'Chekuvchilar', expr: 'q51 = "Hozirda chekaman"', agg: 'pct_true' },
    ],
    filter: '',
    groupBy: ['q9'],
  },
  {
    name: "Yosh guruhlari × surunkali kasallik",
    columns: [
      { id: 'y1', label: 'Surunkali kasallik (Ha)', expr: 'q44 = "Ha"', agg: 'pct_true' },
      { id: 'y2', label: 'Sog\'lig\'i yomon deb baholaganlar', expr: 'q36 = "Yomon"', agg: 'pct_true' },
      { id: 'y3', label: 'Xavf %', expr: 'risk', agg: 'mean_se' },
      { id: 'y4', label: 'Xavf 95% IO', expr: 'risk', agg: 'ci95' },
    ],
    filter: 'yosh > 0',
    groupBy: ['BUCKET(yosh, 30, 40, 50, 60)'],
  },
  {
    name: 'Gipertoniya xavfi bo\'lgan erkaklar',
    columns: [
      { id: 'h1', label: 'F.I.SH.', expr: 'ism', agg: 'first' },
      { id: 'h2', label: 'Yosh', expr: 'yosh', agg: 'mean' },
      { id: 'h3', label: 'Sistolik', expr: 'sistolik', agg: 'mean_se' },
      { id: 'h4', label: 'Diastolik', expr: 'diastolik', agg: 'mean_se' },
      { id: 'h5', label: 'TMI', expr: 'bmi', agg: 'mean_se' },
      { id: 'h6', label: 'Xavf %', expr: 'risk', agg: 'mean_se' },
    ],
    filter: 'jins = "Erkak" and (sistolik >= 140 or diastolik >= 90)',
    groupBy: [],
    sortBy: { columnId: 'h6', dir: 'desc' },
  },
  {
    name: "Jins × chekish holati",
    columns: [
      { id: 'c1', label: 'Xavf %', expr: 'risk', agg: 'mean_se' },
      { id: 'c2', label: 'Yo\'tal shikoyati (Ha / Ba\'zan)', expr: 'IN(q30, "Ha", "Ba\'zan")', agg: 'pct_true' },
      { id: 'c3', label: "Nafas qisishi (6 oy)", expr: 'INCLUDES(q42, "Nafas qisishi")', agg: 'pct_true' },
    ],
    filter: '',
    groupBy: ['jins', 'q51'],
  },
];
