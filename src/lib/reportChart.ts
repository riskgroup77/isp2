/**
 * Hisobot konstruktori natijasidan diagramma ma'lumotini quradi.
 * Guruhlangan hisobot: kategoriya = guruh, qiymat = tanlangan ko'rsatkich(lar).
 * Guruhlanmagan hisobot: tanlangan ustunning taqsimoti (soni bo'yicha).
 */
import { toNum, toStr, type Val } from './formulaEngine';
import type { ChartKind, ChartSeries, ChartSpec } from './chartSvg';
import { AGG_LABELS, type AggFn, type ComputedReport, type ReportDefinition } from './reportBuilder';

export interface ChartMetric {
  id: string;
  label: string;
  /** Bir xil birlikdagi ko'rsatkichlarni birga chizish uchun */
  unit: 'count' | 'percent' | 'value';
  hasError: boolean;
}

function aggUnit(agg: AggFn): ChartMetric['unit'] {
  if (agg === 'pct_true') return 'percent';
  if (agg === 'count' || agg === 'count_true') return 'count';
  return 'value';
}

function dataRows(report: ComputedReport) {
  return report.grouped && report.rows.length > 1 ? report.rows.slice(0, -1) : report.rows;
}

/** Diagrammaga chiqarish mumkin bo'lgan ko'rsatkichlar */
export function chartMetrics(report: ComputedReport, def: ReportDefinition): ChartMetric[] {
  if (!report.rows.length) return [];
  if (!report.grouped) {
    return def.columns.map((c) => ({ id: c.id, label: c.label || c.expr, unit: 'count' as const, hasError: false }));
  }
  const keyCount = def.groupBy.filter((g) => g.trim()).length;
  const rows = dataRows(report);
  const out: ChartMetric[] = [
    { id: '__n', label: 'N (xodimlar soni)', unit: 'count', hasError: false },
    { id: '__pct', label: '% (jamidan ulushi)', unit: 'percent', hasError: false },
  ];
  def.columns.forEach((c, i) => {
    const idx = keyCount + 2 + i;
    const numeric = rows.some((r) => typeof r[idx]?.raw === 'number');
    if (!numeric || c.agg === 'list' || c.agg === 'first') return;
    out.push({
      id: c.id,
      label: `${c.label || c.expr} — ${AGG_LABELS[c.agg]}`,
      unit: aggUnit(c.agg),
      hasError: c.agg === 'mean_se' || c.agg === 'ci95',
    });
  });
  return out;
}

function groupedSeries(report: ComputedReport, def: ReportDefinition, metricId: string, label: string): ChartSeries {
  const keyCount = def.groupBy.filter((g) => g.trim()).length;
  const rows = dataRows(report);
  let idx: number;
  if (metricId === '__n') idx = keyCount;
  else if (metricId === '__pct') idx = keyCount + 1;
  else idx = keyCount + 2 + def.columns.findIndex((c) => c.id === metricId);
  const num = (v: Val) => (typeof v === 'number' && Number.isFinite(v) ? v : toNum(v));
  return {
    label,
    values: rows.map((r) => num(r[idx]?.raw ?? null)),
    lo: rows.map((r) => (r[idx]?.lo ?? null)),
    hi: rows.map((r) => (r[idx]?.hi ?? null)),
  };
}

/** Guruhlanmagan hisobot: ustun qiymatlarining taqsimoti */
function distribution(report: ComputedReport, def: ReportDefinition, colId: string): { categories: string[]; values: number[] } {
  const ci = def.columns.findIndex((c) => c.id === colId);
  if (ci < 0) return { categories: [], values: [] };
  const vals = report.rows.map((r) => r[ci + 1]?.raw ?? null).filter((v) => v !== null && toStr(v) !== '');
  const nums = vals.map((v) => (typeof v === 'number' ? v : null));
  const allNumeric = vals.length > 0 && nums.every((n) => n !== null);
  const distinct = new Set(vals.map((v) => toStr(v)));

  if (allNumeric && distinct.size > 12) {
    const ns = nums as number[];
    const min = Math.min(...ns);
    const max = Math.max(...ns);
    const raw = (max - min) / 8 || 1;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
    const start = Math.floor(min / step) * step;
    const bins = Math.max(1, Math.ceil((max - start) / step + 1e-9));
    const counts = new Array(bins).fill(0);
    ns.forEach((v) => {
      counts[Math.min(bins - 1, Math.floor((v - start) / step))] += 1;
    });
    const f = (x: number) => String(Math.round(x * 100) / 100).replace('.', ',');
    return {
      categories: counts.map((_, i) => `${f(start + i * step)}–${f(start + (i + 1) * step)}`),
      values: counts,
    };
  }

  const counts = new Map<string, number>();
  vals.forEach((v) => {
    const parts = Array.isArray(v) ? v.map((x) => toStr(x)) : [toStr(v)];
    parts.forEach((p) => counts.set(p, (counts.get(p) ?? 0) + 1));
  });
  let entries = [...counts.entries()];
  if (allNumeric) entries.sort((a, b) => Number(a[0].replace(',', '.')) - Number(b[0].replace(',', '.')));
  else entries.sort((a, b) => b[1] - a[1]);
  if (entries.length > 12) {
    const rest = entries.slice(11).reduce((s, e) => s + e[1], 0);
    entries = [...entries.slice(0, 11), [`Boshqa (${counts.size - 11} xil qiymat)`, rest]];
  }
  return { categories: entries.map((e) => e[0]), values: entries.map((e) => e[1]) };
}

export interface ChartChoice {
  kind: ChartKind | 'auto';
  metricIds: string[];
  comma: boolean;
  /** Guruhlash ifodalarining tushunarli nomlari (sarlavha uchun) */
  groupLabels?: string[];
}

export function suggestKind(categories: string[], seriesCount: number): ChartKind {
  const longLabels = categories.some((c) => c.length > 14);
  if (categories.length > 7 || longLabels) return 'hbar';
  return seriesCount > 0 ? 'bar' : 'bar';
}

/** Pie faqat bitta qism-butun ko'rsatkich va ≤ 6 kategoriya uchun */
export function pieAllowed(report: ComputedReport, metricIds: string[]): boolean {
  if (metricIds.length !== 1) return false;
  const id = metricIds[0];
  const isWhole = !report.grouped || id === '__n' || id === '__pct';
  return isWhole;
}

export function buildChartSpec(report: ComputedReport, def: ReportDefinition, choice: ChartChoice): ChartSpec | null {
  if (!report.rows.length || report.errors.length) return null;
  const metrics = chartMetrics(report, def);
  const subtitleParts = [`N = ${report.n}`];
  if (def.filter.trim()) subtitleParts.push(`filtr: ${def.filter.trim()}`);

  if (!report.grouped) {
    const colId = choice.metricIds.find((id) => def.columns.some((c) => c.id === id)) ?? def.columns[0]?.id;
    const col = def.columns.find((c) => c.id === colId);
    if (!col) return null;
    const d = distribution(report, def, col.id);
    let kind: ChartKind = choice.kind === 'auto' ? suggestKind(d.categories, 1) : choice.kind;
    if (kind === 'pie' && d.categories.length > 6) kind = suggestKind(d.categories, 1);
    return {
      title: `${def.name || 'Hisobot'}: ${col.label || col.expr} taqsimoti`,
      subtitle: subtitleParts.join(' · '),
      categories: d.categories,
      series: [{ label: 'Xodimlar soni', values: d.values }],
      kind,
      comma: choice.comma,
    };
  }

  const keyCount = def.groupBy.filter((g) => g.trim()).length;
  const rows = dataRows(report);
  const categories = rows.map((r) =>
    r
      .slice(0, keyCount)
      .map((c) => c.text)
      .join(' · ')
  );
  const selected = choice.metricIds
    .map((id) => metrics.find((m) => m.id === id))
    .filter((m): m is ChartMetric => !!m)
    .slice(0, 4);
  const chosen = selected.length ? selected : metrics.slice(0, 1);
  // Bir o'qda faqat bir xil birlikdagi ko'rsatkichlar (ikki o'qli diagramma yo'q)
  const unit = chosen[0]?.unit;
  const same = chosen.filter((m) => m.unit === unit);
  const series = same.map((m) => groupedSeries(report, def, m.id, m.label));
  let kind: ChartKind = choice.kind === 'auto' ? suggestKind(categories, series.length) : choice.kind;
  if (kind === 'pie' && !(pieAllowed(report, same.map((m) => m.id)) && categories.length <= 6)) kind = suggestKind(categories, series.length);
  const hasErr = same.some((m) => m.hasError);
  const groupLabel = (choice.groupLabels?.length ? choice.groupLabels : def.groupBy.filter((g) => g.trim())).join(' × ');
  return {
    title: same.length === 1 ? `${same[0].label.split(' — ')[0]} — ${groupLabel} bo'yicha` : `${def.name || 'Hisobot'} — ${groupLabel} bo'yicha`,
    subtitle: subtitleParts.join(' · '),
    errorNote: hasErr && kind !== 'pie' ? "Chiziqchalar: M ± m (yoki 95% ishonch oralig'i)" : undefined,
    categories,
    series: kind === 'pie' ? series.slice(0, 1) : series,
    kind,
    percent: unit === 'percent' || (same[0]?.id === '__pct'),
    comma: choice.comma,
  };
}
