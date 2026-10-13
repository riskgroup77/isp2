/**
 * Gigiyenik (instrumental) o'lchovlar tahlili: shovqin, harorat, chang,
 * tebranish, yoritilganlik va boshqalar. Har bir omil bo'yicha M ± m, σ,
 * me'yordan oshish ulushi va karraligi; ish joylari o'rtasida t / ANOVA va χ².
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
  mean,
  sd,
  tTest,
  type TTestKind,
} from './stats';

export interface HygRecord {
  date: string;
  place: string;
  factor: string;
  unit: string;
  value: number;
  norm: number | null;
  /** max — me'yor yuqori chegara (qiymat oshmasligi kerak), min — quyi chegara (yoritilganlik kabi) */
  normType: 'max' | 'min';
}

export interface HygDataset {
  name: string;
  importedAt: string;
  records: HygRecord[];
  notes: string[];
}

export interface HygOptions {
  tKind: TTestKind;
  comma: boolean;
}

export interface HygResult {
  factors: string[];
  places: string[];
  tables: LiveTable[];
  charts: ChartSpec[];
  warnings: string[];
}

function cellStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

function cellNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = cellStr(v).replace(/\s/g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[’`‘ʻ]/g, "'").replace(/\s+/g, ' ').trim();
}

function exceeds(r: HygRecord): boolean | null {
  if (r.norm === null) return null;
  return r.normType === 'min' ? r.value < r.norm : r.value > r.norm;
}

export async function importHygieneFile(file: File): Promise<{ dataset: HygDataset | null; errors: string[] }> {
  const errors: string[] = [];
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  } catch {
    return { dataset: null, errors: ["Faylni o'qib bo'lmadi. .xlsx, .xls yoki .csv fayl tanlang."] };
  }
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null }) as unknown[][];
    let h = -1;
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const cells = rows[i].map((c) => norm(cellStr(c)));
      if (cells.some((c) => /^omil/.test(c)) && cells.some((c) => /qiymat|natija|o'lchangan/.test(c))) {
        h = i;
        break;
      }
    }
    if (h < 0) continue;
    const hdr = rows[h].map((c) => norm(cellStr(c)));
    const col = (re: RegExp) => hdr.findIndex((c) => re.test(c));
    const cDate = col(/sana/);
    const cPlace = col(/ish joyi|sex|bo'lim|joy/);
    const cFactor = col(/^omil/);
    const cUnit = col(/birlik/);
    const cVal = col(/qiymat|natija|o'lchangan/);
    const cNorm = col(/me'yor|pdu|rem|norma|ruxsat/);
    const cType = col(/turi|chegara/);
    const records: HygRecord[] = [];
    for (let i = h + 1; i < rows.length; i++) {
      const r = rows[i];
      if (r.every((c) => cellStr(c) === '')) continue;
      const factor = cellStr(r[cFactor]);
      const value = cellNum(r[cVal]);
      if (!factor || value === null) {
        errors.push(`"${name}" varag'i, ${i + 1}-qator: omil yoki qiymat bo'sh/noto'g'ri — o'tkazib yuborildi.`);
        continue;
      }
      const t = cType >= 0 ? norm(cellStr(r[cType])) : '';
      const d = cDate >= 0 ? r[cDate] : null;
      records.push({
        date: d instanceof Date ? d.toISOString().slice(0, 10) : cellStr(d),
        place: cPlace >= 0 ? cellStr(r[cPlace]) || "Ko'rsatilmagan" : 'Korxona',
        factor,
        unit: cUnit >= 0 ? cellStr(r[cUnit]) : '',
        value,
        norm: cNorm >= 0 ? cellNum(r[cNorm]) : null,
        normType: /quyi|min|kam emas|past/.test(t) ? 'min' : 'max',
      });
    }
    if (records.length) {
      return { dataset: { name: file.name, importedAt: new Date().toISOString(), records, notes: [`"${name}" varag'idan ${records.length} ta o'lchov o'qildi.`] }, errors };
    }
  }
  return { dataset: null, errors: ["Faylda \"Omil\" va \"Qiymat\" ustunlari topilmadi. Shablonni yuklab olib to'ldiring.", ...errors] };
}

export function downloadHygieneTemplate(): void {
  const wb = XLSX.utils.book_new();
  const info = [
    ["Gigiyenik o'lchovlar — import shabloni"],
    [],
    ['Ustun', 'Izoh'],
    ['Sana', "Ixtiyoriy. O'lchov sanasi"],
    ['Ish joyi / Sex', "O'lchov olingan ish joyi yoki sex (guruhlar shu bo'yicha solishtiriladi)"],
    ['Omil', "Shovqin, Harorat, Chang, Tebranish, Yoritilganlik, Namlik ..."],
    ['Birlik', 'dBA, °C, mg/m³, lk, % ...'],
    ['Qiymat', "O'lchangan qiymat (son)"],
    ["Me'yor", "Ixtiyoriy. REM / PDU / ruxsat etilgan daraja"],
    ["Me'yor turi", "\"yuqori\" — qiymat me'yordan oshmasligi kerak (shovqin, chang); \"quyi\" — kam bo'lmasligi kerak (yoritilganlik)"],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(info);
  wsInfo['!cols'] = [{ wch: 18 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, "Ko'rsatma");
  const ex: (string | number)[][] = [['Sana', 'Ish joyi / Sex', 'Omil', 'Birlik', 'Qiymat', "Me'yor", "Me'yor turi"]];
  const add = (place: string, factor: string, unit: string, vals: number[], nrm: number, type: string) =>
    vals.forEach((v, i) => ex.push([`2025-0${(i % 9) + 1}-15`, place, factor, unit, v, nrm, type]));
  add('Turbinalar sexi', 'Shovqin', 'dBA', [86, 88, 84, 91, 87], 80, 'yuqori');
  add('Qozonxona sexi', 'Shovqin', 'dBA', [82, 79, 85, 83, 81], 80, 'yuqori');
  add('Turbinalar sexi', 'Harorat', '°C', [31, 33, 29, 34, 32], 28, 'yuqori');
  add('Qozonxona sexi', 'Harorat', '°C', [35, 36, 33, 37, 34], 28, 'yuqori');
  add('Elektr sexi', 'Yoritilganlik', 'lk', [180, 210, 160, 240, 190], 200, 'quyi');
  const ws = XLSX.utils.aoa_to_sheet(ex);
  ws['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, "O'lchovlar");
  XLSX.writeFile(wb, "Gigiyena_olchovlar_shablon.xlsx");
}

export function computeHygiene(ds: HygDataset, opt: HygOptions): HygResult {
  const { comma } = opt;
  const recs = ds.records;
  const factors = [...new Set(recs.map((r) => r.factor))].sort((a, b) => a.localeCompare(b, 'uz'));
  const places = [...new Set(recs.map((r) => r.place))].sort((a, b) => a.localeCompare(b, 'uz'));
  const warnings: string[] = [...ds.notes];
  const tables: LiveTable[] = [];
  const charts: ChartSpec[] = [];
  const unitOf = (f: string) => recs.find((r) => r.factor === f)?.unit ?? '';
  const normOf = (rs: HygRecord[]) => {
    const ns = [...new Set(rs.map((r) => r.norm).filter((x): x is number => x !== null))];
    return ns.length === 1 ? ns[0] : ns.length ? null : null;
  };

  // H1. Omillar bo'yicha umumiy
  const h1 = factors.map((f) => {
    const rs = recs.filter((r) => r.factor === f);
    const xs = rs.map((r) => r.value);
    const nrm = normOf(rs);
    const ex = rs.map(exceeds).filter((x): x is boolean => x !== null);
    const k = ex.filter(Boolean).length;
    const m = mean(xs);
    const ratio = m !== null && nrm ? m / nrm : null;
    return {
      f,
      row: [
        `${f}${unitOf(f) ? `, ${unitOf(f)}` : ''}`,
        xs.length,
        fmtMeanSe(xs, 1, comma),
        fmt(sd(xs), 1, comma),
        xs.length ? `${fmt(Math.min(...xs), 1, comma)} – ${fmt(Math.max(...xs), 1, comma)}` : '—',
        nrm === null ? (rs.some((r) => r.norm !== null) ? 'turlicha' : '—') : fmt(nrm, 1, comma),
        ex.length ? `${k} (${fmt((k / ex.length) * 100, 1, comma)}%)` : '—',
        ratio === null ? '—' : fmt(ratio, 2, comma),
      ],
      exPct: ex.length ? (k / ex.length) * 100 : null,
    };
  });
  tables.push({
    id: 'h-omil',
    title: "Ishlab chiqarish omillarining gigiyenik ko'rsatkichlari",
    note:
      "M ± m — o'rtacha va standart xato; σ — o'rtacha kvadratik chetlanish. Me'yordan oshgan — me'yorga mos kelmagan o'lchovlar soni va ulushi " +
      "(quyi chegarali omillarda — me'yordan past). Karralik = M / me'yor.",
    headers: ["Omil", "O'lchovlar, n", 'M ± m', 'σ', 'Min – Max', "Me'yor", "Me'yorga mos emas, n (%)", 'Karralik (M / me\'yor)'],
    rows: h1.map((x) => x.row),
  });
  if (h1.some((x) => x.exPct !== null)) {
    charts.push({
      title: "Me'yorga mos kelmagan o'lchovlar ulushi, %",
      subtitle: `${recs.length} ta o'lchov`,
      categories: h1.filter((x) => x.exPct !== null).map((x) => x.f),
      series: [{ label: "Me'yorga mos emas, %", values: h1.filter((x) => x.exPct !== null).map((x) => x.exPct) }],
      kind: 'hbar',
      percent: true,
      comma,
    });
  }

  // H2. Omil × ish joyi
  if (places.length > 1) {
    const rows: (string | number)[][] = [];
    const bold: number[] = [];
    factors.forEach((f) => {
      const groups = places
        .map((p) => ({ p, rs: recs.filter((r) => r.factor === f && r.place === p) }))
        .filter((g) => g.rs.length > 0);
      groups.forEach((g) => {
        const xs = g.rs.map((r) => r.value);
        const ex = g.rs.map(exceeds).filter((x): x is boolean => x !== null);
        const k = ex.filter(Boolean).length;
        rows.push([f, g.p, xs.length, fmtMeanSe(xs, 1, comma), fmt(sd(xs), 1, comma), ex.length ? `${k} (${fmt((k / ex.length) * 100, 1, comma)}%)` : '—']);
      });
      if (groups.length >= 2) {
        const values = groups.map((g) => g.rs.map((r) => r.value));
        const res = groups.length === 2 ? tTest(values[0], values[1], opt.tKind) : anovaOneWay(values);
        const exTab = groups.map((g) => {
          const ex = g.rs.map(exceeds).filter((x): x is boolean => x !== null);
          const k = ex.filter(Boolean).length;
          return [k, ex.length - k];
        });
        const chi = exTab.every(([a, b]) => a + b > 0) ? chiSquareRxC(exTab) : null;
        if (isSignificant(res.p) || isSignificant(chi?.p)) bold.push(rows.length);
        rows.push([
          `${f}: ish joylari farqi`,
          '',
          '',
          `${fmtStat(res, comma)}; p = ${fmtP(res.p, comma, true)}`,
          '',
          chi && (chi.stat !== null || chi.test === 'Fisher') && chi.p !== null
            ? `${fmtStat(chi, comma)}; p = ${fmtP(chi.p, comma, true)}`
            : "— (hamma joyda bir xil)",
        ]);
      }
    });
    tables.push({
      id: 'h-joy',
      title: "Gigiyenik ko'rsatkichlar ish joylari (sexlar) bo'yicha",
      note:
        `Har bir omil ostida ish joylari o'rtasidagi farq: o'rtacha qiymatlar — ${places.length === 2 ? (opt.tKind === 'welch' ? 'Welch' : 'Styudent') + ' t-mezoni' : '2 joyda t-mezoni, 3+ joyda ANOVA (F)'}; ` +
        "me'yorga mos kelmaslik ulushi — Pearson χ². Qalin qatorlarda farq ishonchli. * p<0,05; ** p<0,01; *** p<0,001.",
      headers: ['Omil', 'Ish joyi / Sex', "O'lchovlar, n", 'M ± m', 'σ', "Me'yorga mos emas, n (%)"],
      rows,
      boldRows: bold,
    });
  }
  if (recs.some((r) => r.norm === null)) warnings.push("Ba'zi o'lchovlarda me'yor ko'rsatilmagan — ular me'yordan oshish hisobiga kirmadi.");
  return { factors, places, tables, charts, warnings };
}

const KEY = 'hygiene_dataset_v1';

export function loadHygiene(): HygDataset | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HygDataset) : null;
  } catch {
    return null;
  }
}

export function saveHygiene(ds: HygDataset | null): void {
  try {
    if (ds) localStorage.setItem(KEY, JSON.stringify(ds));
    else localStorage.removeItem(KEY);
  } catch {
    /* hajm yetmasa — sessiya davomida xotirada qoladi */
  }
}
