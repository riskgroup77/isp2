/**
 * Vaqtincha mehnatga layoqatsizlik bilan kasallanish (VMLK) — 5 yillik tahlil.
 * Manba: Excel shablon (uzun format) yoki 16-VN shaklidagi keng jadval.
 * Hisoblar: dinamika, ekstensiv (tuzilma), intensiv (100/1000 ishchiga),
 * 1 holat davomiyligi, o'sish sur'ati, M ± m (yillar bo'yicha), guruhlar
 * o'rtasida Styudent t / ANOVA, tuzilma bo'yicha χ², darajalar bir xilligi χ².
 */
import * as XLSX from 'xlsx';
import type { ChartSpec } from './chartSvg';
import type { LiveTable } from './liveReport';
import {
  anovaOneWay,
  chiSquareRxC,
  fmt,
  fmtMeanSe,
  fmtP,
  fmtStat,
  isSignificant,
  rateHomogeneity,
  tTest,
  type TTestKind,
} from './stats';

export interface MorbRecord {
  year: number;
  cls: string;
  code: string;
  /** 1 — asosiy sinf, 2 — "ulardan" tafsilot */
  level: 1 | 2;
  cases: number;
  days: number | null;
  group: string;
}

export interface WorkerCount {
  year: number;
  group: string;
  workers: number;
}

export interface MorbDataset {
  name: string;
  importedAt: string;
  source: 'shablon' | '16-VN';
  records: MorbRecord[];
  workers: WorkerCount[];
  notes: string[];
}

export interface MorbOptions {
  base: 100 | 1000;
  includeSub: boolean;
  tKind: TTestKind;
  comma: boolean;
}

export interface MorbResult {
  years: number[];
  groups: string[];
  hasWorkers: boolean;
  hasDays: boolean;
  tables: LiveTable[];
  charts: ChartSpec[];
  warnings: string[];
}

// ── Import ────────────────────────────────────────────

const YEAR_RE = /^\s*((?:19|20)\d{2})\s*(?:-?\s*y(?:il)?\.?)?\s*$/i;

function cellStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

function cellNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = cellStr(v).replace(/\s/g, '').replace(',', '.');
  if (!s || s === '-' || s === '—') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[’`‘ʻ]/g, "'").replace(/\s+/g, ' ').trim();
}

/** Satr kodi: "9.2", "3,0", 3.1 → { major, isMain } */
function parseCode(raw: string): { code: string; major: number | null; main: boolean } {
  const c = raw.replace(',', '.').trim();
  const m = c.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!m) return { code: c, major: null, main: false };
  const major = parseInt(m[1], 10);
  const main = !m[2] || /^0+$/.test(m[2]);
  return { code: main ? `${major}.0` : c, major, main: main && !m[3] };
}

function readSheets(buf: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(buf, { type: 'array', cellDates: false });
}

function aoa(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as unknown[][];
}

function findHeader(rows: unknown[][], must: RegExp[]): number {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cells = rows[i].map((c) => norm(cellStr(c)));
    if (must.every((re) => cells.some((c) => re.test(c)))) return i;
  }
  return -1;
}

function colIndex(header: unknown[], re: RegExp): number {
  return header.findIndex((c) => re.test(norm(cellStr(c))));
}

/** 16-VN shakli: qatorlarda kasallik sinflari, ustunlarda yillar */
function parseWide(rows: unknown[][], notes: string[]): MorbRecord[] | null {
  let h = -1;
  let yearCols: { col: number; year: number }[] = [];
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const ys = rows[i]
      .map((c, col) => {
        const m = cellStr(c).match(YEAR_RE);
        return m ? { col, year: parseInt(m[1], 10) } : null;
      })
      .filter((x): x is { col: number; year: number } => x !== null);
    if (ys.length >= 2) {
      h = i;
      yearCols = ys;
      break;
    }
  }
  if (h < 0) return null;
  const records: MorbRecord[] = [];
  const declaredTotal = new Map<number, number>();
  let skippedOther = 0;
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i];
    const name = cellStr(r[0]);
    if (!name || /^ulardan/i.test(name)) continue;
    const pc = parseCode(cellStr(r[1]));
    if (pc.major !== null && pc.major >= 19) {
      // 19 — "Barcha sabablar" (jami), 20+ — kasallik bo'lmagan sabablar (parvarish, karantin...)
      if (pc.major > 19) skippedOther++;
      else
        yearCols.forEach(({ col, year }) => {
          const v = cellNum(r[col]);
          if (v !== null) declaredTotal.set(year, v);
        });
      continue;
    }
    if (/^(barcha|jami)/i.test(name)) continue;
    const level: 1 | 2 = pc.major === null ? 1 : pc.main ? 1 : 2;
    yearCols.forEach(({ col, year }) => {
      const v = cellNum(r[col]);
      records.push({ year, cls: name, code: pc.code, level, cases: v ?? 0, days: null, group: '' });
    });
  }
  // Manbadagi "Barcha sabablar" qatori sinflar yig'indisiga tengmi
  declaredTotal.forEach((tot, year) => {
    const sum = records.filter((r) => r.year === year && r.level === 1).reduce((a, r) => a + r.cases, 0);
    if (Math.abs(sum - tot) > 0.5) {
      notes.push(
        `Manba faylda ${year}-yil "Barcha sabablar" qatorida ${tot} yozilgan, lekin asosiy sinflar yig'indisi ${sum}. ` +
          "Tahlil sinflar yig'indisi bo'yicha qilindi — manba jadvalni tekshiring."
      );
    }
  });
  if (skippedOther) notes.push(`${skippedOther} ta kasallik bo'lmagan sabab qatori (parvarish, karantin va h.k., kod ≥ 20) tahlildan chiqarildi.`);
  notes.push("16-VN shaklida kunlar soni va ishchilar soni yo'q — ishchilar sonini quyidagi jadvalga kiriting.");
  return records;
}

/** Bizning shablon: "Kasallanish" (uzun format) + "Ishchilar" varag'i */
function parseLong(wb: XLSX.WorkBook, notes: string[], errors: string[]): { records: MorbRecord[]; workers: WorkerCount[] } | null {
  let records: MorbRecord[] = [];
  const workers: WorkerCount[] = [];
  for (const name of wb.SheetNames) {
    const rows = aoa(wb.Sheets[name]);
    const h = findHeader(rows, [/^yil/, /holat/]);
    if (h >= 0 && records.length === 0) {
      const hdr = rows[h];
      const cY = colIndex(hdr, /^yil/);
      const cCls = colIndex(hdr, /sinf|kasallik/);
      const cCode = colIndex(hdr, /kod|satr/);
      const cCases = colIndex(hdr, /holat/);
      const cDays = colIndex(hdr, /kun/);
      const cGroup = colIndex(hdr, /guruh|sex|bo'lim|kasb/);
      for (let i = h + 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.every((c) => cellStr(c) === '')) continue;
        const year = cellNum(r[cY]);
        const cls = cellStr(r[cCls]);
        const cases = cellNum(r[cCases]);
        if (year === null || !cls) {
          errors.push(`"${name}" varag'i, ${i + 1}-qator: yil yoki kasallik sinfi bo'sh — o'tkazib yuborildi.`);
          continue;
        }
        if (cases === null || cases < 0) {
          errors.push(`"${name}" varag'i, ${i + 1}-qator: holatlar soni noto'g'ri — o'tkazib yuborildi.`);
          continue;
        }
        const pc = parseCode(cCode >= 0 ? cellStr(r[cCode]) : '');
        records.push({
          year: Math.round(year),
          cls,
          code: pc.code,
          level: pc.major === null || pc.main ? 1 : 2,
          cases,
          days: cDays >= 0 ? cellNum(r[cDays]) : null,
          group: cGroup >= 0 ? cellStr(r[cGroup]) : '',
        });
      }
      continue;
    }
    const hw = findHeader(rows, [/^yil/, /ishchi|xodim/]);
    if (hw >= 0) {
      const hdr = rows[hw];
      const cY = colIndex(hdr, /^yil/);
      const cW = colIndex(hdr, /ishchi|xodim/);
      const cG = colIndex(hdr, /guruh|sex|bo'lim|kasb/);
      for (let i = hw + 1; i < rows.length; i++) {
        const r = rows[i];
        const y = cellNum(r[cY]);
        const w = cellNum(r[cW]);
        if (y === null || w === null) continue;
        workers.push({ year: Math.round(y), group: cG >= 0 ? cellStr(r[cG]) : '', workers: w });
      }
    }
  }
  if (!records.length) return null;
  records = records.filter((r) => r.cases >= 0);
  return { records, workers };
}

export interface ImportResult {
  dataset: MorbDataset | null;
  errors: string[];
}

export async function importMorbidityFile(file: File): Promise<ImportResult> {
  const errors: string[] = [];
  const notes: string[] = [];
  const buf = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = readSheets(buf);
  } catch {
    return { dataset: null, errors: ["Faylni o'qib bo'lmadi. .xlsx, .xls yoki .csv fayl tanlang."] };
  }
  const long = parseLong(wb, notes, errors);
  if (long) {
    return {
      dataset: { name: file.name, importedAt: new Date().toISOString(), source: 'shablon', records: long.records, workers: long.workers, notes },
      errors,
    };
  }
  for (const name of wb.SheetNames) {
    const recs = parseWide(aoa(wb.Sheets[name]), notes);
    if (recs && recs.some((r) => r.cases > 0)) {
      notes.unshift(`"${name}" varag'idan 16-VN shakli sifatida o'qildi.`);
      return { dataset: { name: file.name, importedAt: new Date().toISOString(), source: '16-VN', records: recs, workers: [], notes }, errors };
    }
  }
  return {
    dataset: null,
    errors: [
      "Faylda kasallanish jadvali topilmadi. Shablonni yuklab olib to'ldiring yoki 16-VN shaklidagi varaqni (ustunlarda \"2020-yil\", \"2021-yil\"...) yuklang.",
    ],
  };
}

export function downloadMorbidityTemplate(): void {
  const wb = XLSX.utils.book_new();
  const info = [
    ["Vaqtincha mehnatga layoqatsizlik bilan kasallanish — import shabloni"],
    [],
    ['Varaq', "Nima kiritiladi"],
    ['Kasallanish', "Har bir qator: yil + kasallik sinfi (+ guruh) bo'yicha holatlar va kunlar soni"],
    ['Ishchilar', "Har bir yil (va guruh) uchun o'rtacha ro'yxatdagi ishchilar soni — intensiv ko'rsatkich uchun shart"],
    [],
    ['Ustun', 'Izoh'],
    ['Yil', '2020, 2021 ... 2025'],
    ['Kasallik sinfi', 'XKT-10 bobi nomi (masalan: Nafas olish a\'zolari kasalliklari)'],
    ['Satr kodi', "Ixtiyoriy. 16-VN satr raqami: 10.0 — asosiy sinf, 10.1 — tafsilot"],
    ['Holatlar soni', 'Butun son'],
    ['Kunlar soni', "Ixtiyoriy. Mehnatga layoqatsizlik kunlari"],
    ['Guruh', "Ixtiyoriy. Masalan: Hodisa / Nazorat, sex nomi yoki jins. Bo'sh bo'lsa — butun korxona"],
    [],
    ["Eslatma: 16-VN shaklidagi tayyor jadvalni (ustunlarda \"2020-yil\", \"2021-yil\" ...) ham to'g'ridan-to'g'ri yuklash mumkin."],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(info);
  wsInfo['!cols'] = [{ wch: 22 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, "Ko'rsatma");

  const example: (string | number)[][] = [['Yil', 'Kasallik sinfi', 'Satr kodi', 'Holatlar soni', 'Kunlar soni', 'Guruh']];
  const classes: [string, string, number[]][] = [
    ["Nafas olish a'zolari kasalliklari", '10.0', [233, 207, 225, 340, 376, 413]],
    ['Suyak-mushak tizimi kasalliklari', '13.0', [76, 120, 118, 128, 157, 193]],
    ['Qon aylanish tizimi kasalliklari', '9.0', [14, 27, 22, 42, 53, 59]],
  ];
  [2020, 2021, 2022, 2023, 2024, 2025].forEach((y, yi) =>
    classes.forEach(([c, code, ns]) => example.push([y, c, code, ns[yi], Math.round(ns[yi] * 9.7), '']))
  );
  const ws = XLSX.utils.aoa_to_sheet(example);
  ws['!cols'] = [{ wch: 8 }, { wch: 40 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Kasallanish');

  const wk: (string | number)[][] = [['Yil', 'Guruh', 'Ishchilar soni']];
  [2020, 2021, 2022, 2023, 2024, 2025].forEach((y) => wk.push([y, '', 690]));
  const ws2 = XLSX.utils.aoa_to_sheet(wk);
  ws2['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Ishchilar');
  XLSX.writeFile(wb, 'Kasallanish_shablon.xlsx');
}

// ── Hisob ─────────────────────────────────────────────

function growth(first: number | null, last: number | null, comma: boolean): string {
  if (first === null || last === null || first === 0) return '—';
  const g = ((last - first) / first) * 100;
  return `${g > 0 ? '+' : ''}${fmt(g, 1, comma)}%`;
}

export function computeMorbidity(ds: MorbDataset, opt: MorbOptions): MorbResult {
  const { comma, base } = opt;
  const warnings: string[] = [];
  const recs = ds.records.filter((r) => opt.includeSub || r.level === 1);
  const years = [...new Set(recs.map((r) => r.year))].sort((a, b) => a - b);
  const groups = [...new Set(recs.map((r) => r.group))].sort((a, b) => a.localeCompare(b, 'uz'));
  const multiGroup = groups.length > 1 || (groups.length === 1 && groups[0] !== '');
  const hasDays = recs.some((r) => r.days !== null && r.days > 0);
  const workersFor = (year: number, group: string | null): number | null => {
    if (group === null) {
      const exact = ds.workers.filter((w) => w.year === year && w.group === '');
      if (exact.length) return exact.reduce((s, w) => s + w.workers, 0);
      const parts = ds.workers.filter((w) => w.year === year);
      return parts.length ? parts.reduce((s, w) => s + w.workers, 0) : null;
    }
    const w = ds.workers.find((x) => x.year === year && x.group === group);
    return w ? w.workers : null;
  };
  const hasWorkers = years.some((y) => (workersFor(y, null) ?? 0) > 0);
  if (!hasWorkers) warnings.push("Ishchilar soni kiritilmagan — intensiv ko'rsatkichlar (100/1000 ishchiga) hisoblanmaydi, faqat ekstensiv tuzilma ko'rsatiladi.");
  if (recs.some((r) => r.level === 2) && opt.includeSub) warnings.push("Tafsilot qatorlari (\"ulardan\") ham kiritilgan — ular asosiy sinf ichida qayta sanaladi, jami bilan aralashtirmang.");

  const sumBy = (pred: (r: MorbRecord) => boolean, key: 'cases' | 'days') =>
    recs.filter(pred).reduce((s, r) => s + (r[key] ?? 0), 0);
  const tables: LiveTable[] = [];
  const charts: ChartSpec[] = [];
  const mainRecs = recs.filter((r) => r.level === 1);
  const totalCases = (y: number, g: string | null = null) =>
    mainRecs.filter((r) => r.year === y && (g === null || r.group === g)).reduce((s, r) => s + r.cases, 0);
  const totalDays = (y: number, g: string | null = null) =>
    mainRecs.filter((r) => r.year === y && (g === null || r.group === g)).reduce((s, r) => s + (r.days ?? 0), 0);

  // M1. Dinamika
  {
    const rateCases: number[] = [];
    const rateDays: number[] = [];
    const durations: number[] = [];
    const rows: (string | number)[][] = years.map((y) => {
      const c = totalCases(y);
      const d = totalDays(y);
      const w = workersFor(y, null);
      const rc = w ? (c / w) * base : null;
      const rd = w && hasDays ? (d / w) * base : null;
      const dur = hasDays && c ? d / c : null;
      if (rc !== null) rateCases.push(rc);
      if (rd !== null) rateDays.push(rd);
      if (dur !== null) durations.push(dur);
      return [
        y,
        c,
        ...(hasDays ? [d] : []),
        w ?? '—',
        rc === null ? '—' : fmt(rc, 1, comma),
        ...(hasDays ? [rd === null ? '—' : fmt(rd, 1, comma), dur === null ? '—' : fmt(dur, 1, comma)] : []),
      ];
    });
    const cs = years.map((y) => totalCases(y));
    rows.push([
      'M ± m',
      fmtMeanSe(cs, 1, comma),
      ...(hasDays ? [fmtMeanSe(years.map((y) => totalDays(y)), 1, comma)] : []),
      '',
      rateCases.length ? fmtMeanSe(rateCases, 1, comma) : '—',
      ...(hasDays ? [rateDays.length ? fmtMeanSe(rateDays, 1, comma) : '—', durations.length ? fmtMeanSe(durations, 1, comma) : '—'] : []),
    ]);
    rows.push([
      "O'sish sur'ati",
      growth(cs[0] ?? null, cs[cs.length - 1] ?? null, comma),
      ...(hasDays ? [growth(totalDays(years[0]), totalDays(years[years.length - 1]), comma)] : []),
      '',
      growth(rateCases[0] ?? null, rateCases[rateCases.length - 1] ?? null, comma),
      ...(hasDays ? [growth(rateDays[0] ?? null, rateDays[rateDays.length - 1] ?? null, comma), growth(durations[0] ?? null, durations[durations.length - 1] ?? null, comma)] : []),
    ]);
    let note = `Intensiv ko'rsatkich = holatlar (kunlar) / ishchilar × ${base}. M ± m — ${years.length} yil bo'yicha o'rtacha va standart xato. O'sish sur'ati — birinchi yildan oxirgi yilgacha.`;
    if (hasWorkers) {
      const rh = rateHomogeneity(years.map((y) => totalCases(y)), years.map((y) => workersFor(y, null) ?? 0));
      note += ` Yillar bo'yicha darajalar farqi: ${fmtStat(rh, comma)}; p = ${fmtP(rh.p, comma, true)} (Puasson χ²).`;
    }
    tables.push({
      id: 'm-din',
      title: 'Vaqtincha mehnatga layoqatsizlik bilan kasallanish dinamikasi',
      note,
      headers: [
        'Yil',
        'Holatlar, n',
        ...(hasDays ? ['Kunlar, n'] : []),
        'Ishchilar, n',
        `Holatlar / ${base} ishchi`,
        ...(hasDays ? [`Kunlar / ${base} ishchi`, '1 holat davomiyligi, kun'] : []),
      ],
      rows,
      boldRows: [rows.length - 2],
    });
    charts.push({
      title: hasWorkers ? `Kasallanish dinamikasi — holatlar / ${base} ishchi` : 'Kasallanish dinamikasi — holatlar soni',
      subtitle: `${years[0] ?? ''}–${years[years.length - 1] ?? ''}`,
      categories: years.map(String),
      series: [{ label: hasWorkers ? `Holatlar / ${base}` : 'Holatlar', values: hasWorkers ? years.map((y) => { const w = workersFor(y, null); return w ? (totalCases(y) / w) * base : null; }) : cs }],
      kind: 'line',
      comma,
    });
  }

  // M2. Tuzilma (ekstensiv)
  const classes = [...new Set(recs.map((r) => r.cls))];
  const clsTotal = (c: string) => sumBy((r) => r.cls === c, 'cases');
  const sortedClasses = [...classes].sort((a, b) => clsTotal(b) - clsTotal(a));
  {
    const grand = mainRecs.reduce((s, r) => s + r.cases, 0);
    const rows = sortedClasses.map((c, i) => {
      const lvl = recs.find((r) => r.cls === c)?.level ?? 1;
      const cells = years.map((y) => {
        const n = sumBy((r) => r.cls === c && r.year === y, 'cases');
        const tot = totalCases(y);
        return tot ? `${n} (${fmt((n / tot) * 100, 1, comma)})` : String(n);
      });
      const tot = clsTotal(c);
      return [lvl === 1 ? i + 1 : '', lvl === 2 ? `  ${c}` : c, ...cells, grand ? `${tot} (${fmt((tot / grand) * 100, 1, comma)})` : String(tot)];
    });
    rows.push(['', 'Jami (asosiy sinflar)', ...years.map((y) => `${totalCases(y)} (100)`), `${grand} (100)`]);
    // Tuzilma yillar bo'yicha o'zgarganmi: sinf × yil χ²
    const main = sortedClasses.filter((c) => recs.find((r) => r.cls === c)?.level === 1);
    const chi = chiSquareRxC(main.map((c) => years.map((y) => sumBy((r) => r.cls === c && r.year === y, 'cases'))));
    tables.push({
      id: 'm-str',
      title: "Kasallanish tuzilmasi (ekstensiv ko'rsatkich), n (%)",
      note:
        `Ekstensiv ko'rsatkich — sinfning shu yildagi barcha holatlar ichidagi ulushi (yig'indisi 100%). Tartib — ${years.length} yillik jami bo'yicha. ` +
        `Tuzilmaning yillar bo'yicha o'zgarishi: ${fmtStat(chi, comma)}; p = ${fmtP(chi.p, comma, true)} (Pearson χ²).` +
        (chi.warn ? ` ${chi.warn}.` : ''),
      headers: ["O'rin", 'Kasallik sinfi', ...years.map((y) => `${y}, n (%)`), 'Jami, n (%)'],
      rows,
      totalRow: true,
    });
    charts.push({
      title: `Kasallanish tuzilmasi, ${years[0] ?? ''}–${years[years.length - 1] ?? ''} (ekstensiv, %)`,
      subtitle: `Jami ${grand} holat`,
      categories: main.slice(0, 12),
      series: [{ label: 'Ulush, %', values: main.slice(0, 12).map((c) => (grand ? (clsTotal(c) / grand) * 100 : 0)) }],
      kind: 'hbar',
      percent: true,
      comma,
    });
  }

  // M3. Intensiv ko'rsatkichlar (sinf × yil)
  if (hasWorkers) {
    const sigRows: number[] = [];
    const rows = sortedClasses.map((c, i) => {
      const rates = years.map((y) => {
        const w = workersFor(y, null);
        return w ? (sumBy((r) => r.cls === c && r.year === y, 'cases') / w) * base : null;
      });
      const valid = rates.filter((x): x is number => x !== null);
      const rh = rateHomogeneity(years.map((y) => sumBy((r) => r.cls === c && r.year === y, 'cases')), years.map((y) => workersFor(y, null) ?? 0));
      if (isSignificant(rh.p)) sigRows.push(i);
      return [c, ...rates.map((x) => (x === null ? '—' : fmt(x, 1, comma))), fmtMeanSe(valid, 1, comma), growth(valid[0] ?? null, valid[valid.length - 1] ?? null, comma), fmtP(rh.p, comma, true)];
    });
    tables.push({
      id: 'm-int',
      title: `Kasallik sinflari bo'yicha intensiv ko'rsatkichlar (holatlar / ${base} ishchi)`,
      note: `M ± m — yillar bo'yicha. p — yillar bo'yicha darajalar bir xilligi (Puasson χ²); qalin qatorlarda yillar o'rtasidagi farq ishonchli. * p<0,05; ** p<0,01; *** p<0,001.`,
      headers: ['Kasallik sinfi', ...years.map(String), 'M ± m', "O'sish sur'ati", 'p (yillar)'],
      rows,
      boldRows: sigRows,
    });
  }

  // M4. Guruhlar taqqoslash
  if (multiGroup) {
    const gs = groups.filter((g) => g !== '');
    const groupWorkers = gs.every((g) => years.some((y) => (workersFor(y, g) ?? 0) > 0));
    const sigRows: number[] = [];
    const rows = sortedClasses
      .filter((c) => recs.find((r) => r.cls === c)?.level === 1)
      .map((c, i) => {
        if (groupWorkers) {
          const perGroup = gs.map((g) =>
            years
              .map((y) => {
                const w = workersFor(y, g);
                return w ? (sumBy((r) => r.cls === c && r.year === y && r.group === g, 'cases') / w) * base : null;
              })
              .filter((x): x is number => x !== null)
          );
          const res = perGroup.length === 2 ? tTest(perGroup[0], perGroup[1], opt.tKind) : anovaOneWay(perGroup);
          if (isSignificant(res.p)) sigRows.push(i);
          return [c, ...perGroup.map((xs) => fmtMeanSe(xs, 1, comma)), fmtStat(res, comma), fmtP(res.p, comma, true)];
        }
        const counts = gs.map((g) => sumBy((r) => r.cls === c && r.group === g, 'cases'));
        const totals = gs.map((g) => mainRecs.filter((r) => r.group === g).reduce((s, r) => s + r.cases, 0));
        const res = chiSquareRxC(gs.map((_, gi) => [counts[gi], totals[gi] - counts[gi]]));
        if (isSignificant(res.p)) sigRows.push(i);
        return [c, ...counts.map((k, gi) => (totals[gi] ? `${k} (${fmt((k / totals[gi]) * 100, 1, comma)}%)` : '—')), fmtStat(res, comma), fmtP(res.p, comma, true)];
      });
    const structChi = chiSquareRxC(
      sortedClasses.filter((c) => recs.find((r) => r.cls === c)?.level === 1).map((c) => gs.map((g) => sumBy((r) => r.cls === c && r.group === g, 'cases')))
    );
    tables.push({
      id: 'm-grp',
      title: groupWorkers
        ? `Guruhlar bo'yicha intensiv ko'rsatkichlar (holatlar / ${base} ishchi, M ± m)`
        : "Guruhlar bo'yicha kasallanish tuzilmasi, n (%)",
      note:
        (groupWorkers
          ? `M ± m — ${years.length} yil bo'yicha. ${gs.length === 2 ? (opt.tKind === 'welch' ? 'Welch' : 'Styudent (klassik)') + ' t-mezoni' : 'ANOVA (F)'}.`
          : "Guruhlar uchun ishchilar soni kiritilmagan — tuzilma (ekstensiv %) solishtirildi, Pearson χ² (sinf / boshqa sinflar × guruh).") +
        ` Umumiy tuzilma farqi (sinf × guruh): ${fmtStat(structChi, comma)}; p = ${fmtP(structChi.p, comma, true)}. * p<0,05; ** p<0,01; *** p<0,001.`,
      headers: ['Kasallik sinfi', ...gs, groupWorkers && gs.length === 2 ? 't; df' : groupWorkers ? 'F; df' : 'χ²; df', 'p'],
      rows,
      boldRows: sigRows,
    });
  }

  return { years, groups, hasWorkers, hasDays, tables, charts, warnings: [...ds.notes, ...warnings] };
}

// ── Saqlash ───────────────────────────────────────────

const KEY = 'morbidity_dataset_v1';

export function loadMorbidity(): MorbDataset | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MorbDataset) : null;
  } catch {
    return null;
  }
}

export function saveMorbidity(ds: MorbDataset | null): void {
  try {
    if (ds) localStorage.setItem(KEY, JSON.stringify(ds));
    else localStorage.removeItem(KEY);
  } catch {
    /* hajm yetmasa — sessiya davomida xotirada qoladi */
  }
}
