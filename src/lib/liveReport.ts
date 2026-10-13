/**
 * "N=400" jonli hisobot: serverdagi haqiqiy anketalardan dissertatsiya
 * paketidagi jadvallarni (tanlama, kasallanish, xavf zonalari, hodisa/nazorat,
 * 4.2-jadval, sexlar, 7 bo'lim) hisoblaydi va Excel/chop etishga beradi.
 */
import * as XLSX from 'xlsx';
import type { Question, SurveyResponseOut } from '../types/api';
import { APP_EXPORT_PREFIX } from './branding';
import { compileFormula, toNum, toStr, truthy, type Val } from './formulaEngine';
import { buildRows, buildVariableCatalog, type ReportRow } from './reportBuilder';
import {
  fmt,
  fmtMeanSe,
  fmtP,
  mean,
  median,
  oddsRatio,
  sd,
  se,
  stratifiedSample,
  test2x2,
  welchTTest,
  wilsonCI,
} from './stats';

export interface LiveTable {
  id: string;
  title: string;
  note?: string;
  headers: string[];
  rows: (string | number)[][];
  /** Oxirgi qator "Jami" — qalin ko'rsatiladi */
  totalRow?: boolean;
}

export interface LiveSection {
  id: string;
  title: string;
  sheet: string;
  tables: LiveTable[];
}

export interface LiveReportOptions {
  /** 0 = hammasi */
  sampleSize: number;
  seed: number;
  hodisaExpr: string;
  hodisaLabel: string;
  comma: boolean;
  /** Har bir xodimdan faqat oxirgi anketa */
  latestPerUser: boolean;
}

export interface LiveReport {
  generatedAt: Date;
  totalSurveys: number;
  uniqueUsers: number;
  pool: number;
  n: number;
  nHodisa: number;
  nNazorat: number;
  sections: LiveSection[];
  warnings: string[];
  sample: Array<ReportRow & { guruh: 'hodisa' | 'nazorat' }>;
  options: LiveReportOptions;
}

export const HODISA_PRESETS: { label: string; expr: string }[] = [
  { label: 'Surunkali kasalligi bor (q44 = Ha)', expr: 'q44 = "Ha"' },
  { label: "Yuqori xavf zonasi (sarg'ish yoki qizil)", expr: 'zona = "sargish" or zona = "qizil"' },
  { label: 'Yilda 2+ marta mehnatga layoqatsizlik (q45)', expr: 'NUM(q45) >= 2' },
  { label: "Ish sog'liqqa salbiy ta'sir qiladi (q46 = Ha)", expr: 'q46 = "Ha"' },
];

// ── Yordamchilar ──────────────────────────────────────

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[’`‘ʻ]/g, "'");
}

function answered(v: Val): boolean {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0;
  return toStr(v).trim() !== '';
}

function hasOption(v: Val, opt: string): boolean {
  if (!answered(v)) return false;
  const o = norm(opt);
  if (Array.isArray(v)) return v.some((x) => norm(toStr(x)) === o);
  return norm(toStr(v)) === o;
}

function values(v: Val): string[] {
  if (!answered(v)) return [];
  if (Array.isArray(v)) return v.map((x) => toStr(x)).filter((x) => x.trim());
  return [toStr(v)];
}

function nums(rows: ReportRow[], name: string): number[] {
  return rows.map((r) => toNum(r.ctx[name] ?? null)).filter((x): x is number => x !== null);
}

function episodes(r: ReportRow): number {
  const v = r.ctx.q45 ?? null;
  const n = toNum(v);
  return n === null ? 0 : n;
}

function pctCell(k: number, n: number, comma: boolean): string {
  return n ? fmt((k / n) * 100, 1, comma) : '—';
}

function ciCell(k: number, n: number, comma: boolean): string {
  const ci = wilsonCI(k, n);
  return ci ? `${fmt(ci[0], 1, comma)} – ${fmt(ci[1], 1, comma)}` : '—';
}

function nPct(k: number, n: number, comma: boolean): string {
  return n ? `${k} (${fmt((k / n) * 100, 1, comma)}%)` : '—';
}

const AGE_BINS: [string, number, number][] = [
  ['18–29 yosh', 0, 30],
  ['30–39 yosh', 30, 40],
  ['40–49 yosh', 40, 50],
  ['50–59 yosh', 50, 60],
  ['60 va undan katta', 60, 200],
];

const ZONES: [string, string][] = [
  ['yashil', 'Yashil (past xavf)'],
  ['sariq', "Sariq (o'rtacha xavf)"],
  ['sargish', "Sarg'ish (yuqori xavf)"],
  ['qizil', 'Qizil (juda yuqori xavf)'],
];

const CONTINUOUS: [string, string, number][] = [
  ['yosh', 'Yosh, yil', 1],
  ['vazn', 'Tana vazni, kg', 1],
  ['boy', "Bo'y, sm", 1],
  ['bmi', 'TMI, kg/m²', 1],
  ['sistolik', 'Sistolik bosim, mm sim. ust.', 1],
  ['diastolik', 'Diastolik bosim, mm sim. ust.', 1],
  ['glyukoza', 'Glyukoza, mmol/l', 2],
  ['xolesterin', 'Xolesterin, mmol/l', 2],
  ['risk', 'Xavf, %', 1],
];

/** Savol bo'yicha kategorik jadval (bir yoki ko'p tanlovli) */
function categoricalTable(
  rows: ReportRow[],
  q: Question,
  comma: boolean,
  opts: { id?: string; title?: string; sortByN?: boolean; rank?: boolean } = {}
): LiveTable {
  const name = `q${String(q.id).toLowerCase()}`;
  const respondents = rows.filter((r) => answered(r.ctx[name] ?? null));
  const nResp = respondents.length;
  const options = [...q.options];
  // Variantlarda yo'q qiymatlar (erkin javoblar) ham ko'rsatiladi
  respondents.forEach((r) =>
    values(r.ctx[name] ?? null).forEach((v) => {
      if (!options.some((o) => norm(o) === norm(v))) options.push(v);
    })
  );
  let data = options.map((opt) => {
    const k = respondents.filter((r) => hasOption(r.ctx[name] ?? null, opt)).length;
    return { opt, k };
  });
  if (opts.sortByN) data = [...data].sort((a, b) => b.k - a.k);
  const multi = q.type === 'multi_choice';
  const headers = [...(opts.rank ? ["O'rin"] : []), 'Javob', 'n', '%', '95% IO, %'];
  const body = data.map((d, i) => [
    ...(opts.rank ? [d.k ? i + 1 : '—'] : []),
    d.opt,
    d.k,
    pctCell(d.k, nResp, comma),
    ciCell(d.k, nResp, comma),
  ]);
  if (!multi) {
    body.push([...(opts.rank ? [''] : []), 'Jami', nResp, nResp ? fmt(100, 1, comma) : '—', '']);
  }
  return {
    id: opts.id ?? `q${q.id}`,
    title: opts.title ?? `${q.id}. ${q.text}`,
    note:
      `Javob berganlar: ${nResp} / ${rows.length}.` +
      (multi ? " Bir nechta javob belgilash mumkin — foizlar yig'indisi 100% dan oshishi mumkin." : ''),
    headers,
    rows: body,
    totalRow: !multi,
  };
}

function continuousTable(rows: ReportRow[], vars: [string, string, number][], comma: boolean, id: string, title: string): LiveTable {
  return {
    id,
    title,
    note: "M — o'rtacha, m — standart xato (SD/√n), 95% IO — o'rtacha uchun ishonch oralig'i (M ± 1,96·m).",
    headers: ["Ko'rsatkich", 'n', 'M ± m', 'SD', 'Mediana', 'Min – Max', '95% IO'],
    rows: vars
      .filter(([name]) => vars.length === 1 || nums(rows, name).length > 0)
      .map(([name, label, d]) => {
      const xs = nums(rows, name);
      const m = mean(xs);
      const s = se(xs);
      return [
        label,
        xs.length,
        fmtMeanSe(xs, d, comma),
        fmt(sd(xs), d, comma),
        fmt(median(xs), d, comma),
        xs.length ? `${fmt(Math.min(...xs), d, comma)} – ${fmt(Math.max(...xs), d, comma)}` : '—',
        m !== null && s !== null ? `${fmt(m - 1.96 * s, d, comma)} – ${fmt(m + 1.96 * s, d, comma)}` : '—',
      ];
    }),
  };
}

// ── Asosiy hisob ──────────────────────────────────────

export function buildLiveReport(
  surveys: SurveyResponseOut[],
  questions: Question[],
  options: LiveReportOptions
): LiveReport {
  const { comma } = options;
  const warnings: string[] = [];
  const qById = new Map(questions.map((q) => [String(q.id), q]));
  const Q = (id: string) => qById.get(id);

  // 1. Har bir xodimdan oxirgi anketa
  const sorted = [...surveys].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const seen = new Set<string>();
  const pool = options.latestPerUser
    ? sorted.filter((s) => {
        if (seen.has(s.user_id)) return false;
        seen.add(s.user_id);
        return true;
      })
    : sorted;
  const uniqueUsers = new Set(surveys.map((s) => s.user_id)).size;

  const allRows = buildRows(pool, questions);

  // 2. Tanlama (sex bo'yicha qatlamlangan)
  let sampleRows = allRows;
  if (options.sampleSize > 0) {
    if (options.sampleSize > allRows.length) {
      warnings.push(
        `Tanlama hajmi ${options.sampleSize} so'ralgan, lekin serverda ${allRows.length} ta mos anketa bor — hammasi olindi.`
      );
    } else {
      sampleRows = stratifiedSample(allRows, options.sampleSize, (r) => toStr(r.ctx.q9 ?? null), options.seed);
    }
  }

  // 3. Hodisa / nazorat
  const known = new Set(buildVariableCatalog(questions, surveys).map((v) => v.name));
  let hodisaVars: string[] = [];
  let classify: (r: ReportRow) => boolean = () => false;
  try {
    const f = compileFormula(options.hodisaExpr, known);
    hodisaVars = f.vars;
    classify = (r) => {
      try {
        return truthy(f.eval(r.ctx));
      } catch {
        return false;
      }
    };
  } catch (e) {
    warnings.push(`Hodisa guruhi formulasi xato: ${e instanceof Error ? e.message : String(e)}. Hamma "nazorat" deb olindi.`);
  }
  const sample = sampleRows.map((r) => ({ ...r, guruh: classify(r) ? ('hodisa' as const) : ('nazorat' as const) }));
  const H = sample.filter((r) => r.guruh === 'hodisa');
  const N = sample.filter((r) => r.guruh === 'nazorat');
  const n = sample.length;

  if (n > 0 && (H.length < 5 || N.length < 5)) {
    warnings.push("Hodisa yoki nazorat guruhida 5 tadan kam xodim — p-qiymatlar ishonchsiz bo'ladi.");
  }

  const sections: LiveSection[] = [];

  // ── A. Tanlama tavsifi ──
  {
    const tables: LiveTable[] = [];
    const jinsRows = ['Erkak', 'Ayol'].map((j) => {
      const k = sample.filter((r) => norm(toStr(r.ctx.jins ?? null)) === norm(j)).length;
      return [j, k, pctCell(k, n, comma), ciCell(k, n, comma)];
    });
    const ageKnown = sample.filter((r) => toNum(r.ctx.yosh ?? null) !== null);
    const ageRows = AGE_BINS.map(([label, lo, hi]) => {
      const k = ageKnown.filter((r) => {
        const a = toNum(r.ctx.yosh ?? null) as number;
        return a >= lo && a < hi;
      }).length;
      return [label, k, pctCell(k, ageKnown.length, comma), ciCell(k, ageKnown.length, comma)];
    });
    tables.push({
      id: 'a-jins',
      title: '1-jadval. Tanlama tarkibi: jins va yosh guruhlari',
      note: `N = ${n}. Yosh guruhlari ${ageKnown.length} ta xodim bo'yicha (tug'ilgan sana kiritilganlar).`,
      headers: ["Ko'rsatkich", 'n', '%', '95% IO, %'],
      rows: [['Jins', '', '', ''], ...jinsRows, ['Yosh guruhi', '', '', ''], ...ageRows],
    });
    tables.push(continuousTable(sample, CONTINUOUS, comma, 'a-cont', "2-jadval. Antropometrik va klinik ko'rsatkichlar"));
    (['9', '8', '10'] as const).forEach((id, i) => {
      const q = Q(id);
      if (q) tables.push(categoricalTable(sample, q, comma, { id: `a-q${id}`, title: `${3 + i}-jadval. ${q.text.replace(/^Iltimos,\s*/i, '')}` }));
    });
    sections.push({ id: 'A', title: 'Tanlama tavsifi', sheet: 'A Tanlama', tables });
  }

  // ── B. Kasallanish strukturasi ──
  {
    const tables: LiveTable[] = [];
    const q43 = Q('43');
    if (q43) {
      tables.push(
        categoricalTable(sample, q43, comma, {
          id: 'b-q43',
          title: "3-jadval. Kasallanishlar strukturasi (so'nggi bir yilda)",
          sortByN: true,
          rank: true,
        })
      );
    }
    const q42 = Q('42');
    if (q42) tables.push(categoricalTable(sample, q42, comma, { id: 'b-q42', title: "So'nggi 6 oyda kuzatilgan holatlar", sortByN: true, rank: true }));
    (['44', '46', '36', '45'] as const).forEach((id) => {
      const q = Q(id);
      if (q) tables.push(categoricalTable(sample, q, comma, { id: `b-q${id}` }));
    });
    sections.push({ id: 'B', title: 'Kasallanish va salomatlik', sheet: 'B Kasallanish', tables });
  }

  // ── C. Xavf zonalari ──
  {
    const withZone = sample.filter((r) => toStr(r.ctx.zona ?? null));
    const rows = ZONES.map(([z, label]) => {
      const inZone = withZone.filter((r) => norm(toStr(r.ctx.zona ?? null)) === z);
      return [label, inZone.length, pctCell(inZone.length, withZone.length, comma), ciCell(inZone.length, withZone.length, comma), fmtMeanSe(nums(inZone, 'risk'), 1, comma)];
    });
    rows.push(['Jami', withZone.length, withZone.length ? fmt(100, 1, comma) : '—', '', fmtMeanSe(nums(withZone, 'risk'), 1, comma)]);
    const byJins = ['Erkak', 'Ayol'].map((j) => {
      const g = withZone.filter((r) => norm(toStr(r.ctx.jins ?? null)) === norm(j));
      return [
        j,
        g.length,
        ...ZONES.map(([z]) => nPct(g.filter((r) => norm(toStr(r.ctx.zona ?? null)) === z).length, g.length, comma)),
        fmtMeanSe(nums(g, 'risk'), 1, comma),
      ];
    });
    sections.push({
      id: 'C',
      title: 'Xavf zonalari',
      sheet: 'C Xavf zonalari',
      tables: [
        {
          id: 'c-zona',
          title: 'Xodimlarning kasbiy xavf zonalari bo\'yicha taqsimoti',
          note: `Zona aniqlangan anketalar: ${withZone.length} / ${n}. "Xavf, %" — M ± m.`,
          headers: ['Zona', 'n', '%', '95% IO, %', 'Xavf, % (M ± m)'],
          rows,
          totalRow: true,
        },
        {
          id: 'c-jins',
          title: 'Xavf zonalari jins bo\'yicha',
          headers: ['Jins', 'N', ...ZONES.map(([, l]) => l.split(' ')[0]), 'Xavf, % (M ± m)'],
          rows: byJins,
        },
      ],
    });
  }

  // ── D. Hodisa va nazorat ──
  {
    const contVars: [string, string, number][] = [...CONTINUOUS, ['__q45', 'Yillik mehnatga layoqatsizlik holatlari', 2]];
    const getNums = (rows: ReportRow[], name: string) =>
      name === '__q45' ? rows.filter((r) => toNum(r.ctx.q45 ?? null) !== null).map(episodes) : nums(rows, name);
    const cont = contVars
      .filter(([name]) => !hodisaVars.includes(name) && !(name === '__q45' && hodisaVars.includes('q45')))
      .filter(([name]) => getNums(H, name).length + getNums(N, name).length > 0)
      .map(([name, label, d]) => {
        const a = getNums(H, name);
        const b = getNums(N, name);
        const t = welchTTest(a, b);
        return [label, `${fmtMeanSe(a, d, comma)} (n=${a.length})`, `${fmtMeanSe(b, d, comma)} (n=${b.length})`, fmtP(t.p, comma)];
      });

    type Feat = { label: string; vars: string[]; test: (r: ReportRow) => boolean | null };
    const opt = (qn: string, o: string, label: string): Feat => ({
      label,
      vars: [qn],
      test: (r) => (answered(r.ctx[qn] ?? null) ? hasOption(r.ctx[qn] ?? null, o) : null),
    });
    const feats: Feat[] = [
      { label: 'Erkak jinsi', vars: ['jins'], test: (r) => (toStr(r.ctx.jins ?? null) ? norm(toStr(r.ctx.jins ?? null)) === 'erkak' : null) },
      { label: 'Yosh ≥ 40', vars: ['yosh'], test: (r) => { const a = toNum(r.ctx.yosh ?? null); return a === null ? null : a >= 40; } },
      opt('q51', 'Hozirda chekaman', 'Hozirda chekadi'),
      opt('q12', 'Yuqori', 'Yuqori shovqin'),
      opt('q13', 'Ha', 'Yuqori harorat ta\'siri'),
      opt('q59', 'Ha', 'Ish stressli'),
      opt('q46', 'Ha', "Ish sog'liqqa salbiy ta'sir qiladi"),
      opt('q44', 'Ha', 'Surunkali kasallik'),
      opt('q36', 'Yomon', "Sog'lig'ini yomon deb baholaydi"),
      { label: 'TMI ≥ 30 (semizlik)', vars: ['bmi'], test: (r) => { const v = toNum(r.ctx.bmi ?? null); return v === null ? null : v >= 30; } },
      { label: 'Sistolik ≥ 140', vars: ['sistolik'], test: (r) => { const v = toNum(r.ctx.sistolik ?? null); return v === null ? null : v >= 140; } },
      { label: "Sarg'ish yoki qizil zona", vars: ['zona'], test: (r) => { const z = norm(toStr(r.ctx.zona ?? null)); return z ? z === 'sargish' || z === 'qizil' : null; } },
      ...(Q('43')?.options ?? []).filter((o) => norm(o) !== 'boshqa').map((o) => opt('q43', o, o)),
    ];
    const cat = feats
      .filter((f) => !f.vars.some((v) => hodisaVars.includes(v)))
      .map((f) => {
        const hv = H.map(f.test).filter((x): x is boolean => x !== null);
        const nv = N.map(f.test).filter((x): x is boolean => x !== null);
        const a = hv.filter(Boolean).length;
        const b = hv.length - a;
        const c = nv.filter(Boolean).length;
        const d = nv.length - c;
        const tr = test2x2(a, b, c, d);
        const or = oddsRatio(a, b, c, d);
        return [
          f.label,
          nPct(a, hv.length, comma),
          nPct(c, nv.length, comma),
          or ? `${fmt(or.or, 2, comma)} (${fmt(or.lo, 2, comma)} – ${fmt(or.hi, 2, comma)})` : '—',
          fmtP(tr.p, comma),
          tr.test,
        ];
      });

    sections.push({
      id: 'D',
      title: 'Hodisa va nazorat guruhlari',
      sheet: 'D Hodisa-Nazorat',
      tables: [
        {
          id: 'd-cont',
          title: "Hodisa va nazorat guruhlarini miqdoriy ko'rsatkichlar bo'yicha taqqoslash",
          note: `Hodisa: ${options.hodisaLabel} (n=${H.length}); nazorat — qolganlar (n=${N.length}). M ± m; p — Welch t-testi.`,
          headers: ["Ko'rsatkich", 'Hodisa guruhi', 'Nazorat guruhi', 'p'],
          rows: cont,
        },
        {
          id: 'd-cat',
          title: 'Xavf omillarining guruhlarda uchrashi',
          note: 'n (%) — guruh ichidagi ulush. OR — nisbatlar nisbati (95% IO). p — Pearson χ² (kutilgan chastota < 5 bo\'lsa Fisher aniq testi).',
          headers: ['Belgi', 'Hodisa, n (%)', 'Nazorat, n (%)', 'OR (95% IO)', 'p', 'Test'],
          rows: cat,
        },
      ],
    });
  }

  // ── E. 4.2-jadval ──
  {
    const q43 = Q('43');
    const classes = q43?.options ?? [];
    const rateCell = (rows: ReportRow[], pick: (r: ReportRow) => boolean) => {
      const xs = rows.map((r) => (pick(r) ? episodes(r) * 100 : 0));
      return fmtMeanSe(xs, 1, comma);
    };
    const tRows: (string | number)[][] = classes.map((c) => {
      const pick = (r: ReportRow) => hasOption(r.ctx.q43 ?? null, c);
      const t = welchTTest(H.map((r) => (pick(r) ? episodes(r) : 0)), N.map((r) => (pick(r) ? episodes(r) : 0)));
      return [c, H.filter(pick).length, rateCell(H, pick), N.filter(pick).length, rateCell(N, pick), fmtP(t.p, comma)];
    });
    const all = () => true;
    const tAll = welchTTest(H.map(episodes), N.map(episodes));
    tRows.push(['Jami', H.length, rateCell(H, all), N.length, rateCell(N, all), fmtP(tAll.p, comma)]);
    const missing45 = sample.filter((r) => toNum(r.ctx.q45 ?? null) === null).length;
    if (missing45) warnings.push(`4.2-jadval: ${missing45} ta anketada 45-savol (mehnatga layoqatsizlik soni) bo'sh — 0 deb olindi.`);
    sections.push({
      id: 'E',
      title: '4.2-jadval',
      sheet: 'E Jadval 4.2',
      tables: [
        {
          id: 'e-42',
          title: '4.2-jadval. Kasallik sinflari bo\'yicha vaqtincha mehnatga layoqatsizlik holatlari (100 ishchiga, M ± m)',
          note:
            "Kasallik sinfi — 43-savol, holatlar soni — 45-savol (\"5 va undan ortiq\" = 5). " +
            "Kunlar soni anketada so'ralmagan, shuning uchun jadvalda faqat holatlar soni. p — Welch t-testi.",
          headers: ['Kasallik sinfi', 'Hodisa: ishchilar, n', 'Hodisa: holatlar / 100 ishchi', 'Nazorat: ishchilar, n', 'Nazorat: holatlar / 100 ishchi', 'p'],
          rows: tRows,
          totalRow: true,
        },
      ],
    });
  }

  // ── F. Sexlar kesimida ──
  {
    const q9 = Q('9');
    const sexes = [...(q9?.options ?? [])];
    sample.forEach((r) => {
      const v = toStr(r.ctx.q9 ?? null);
      if (v && !sexes.some((s) => norm(s) === norm(v))) sexes.push(v);
    });
    const line = (label: string, g: ReportRow[]) => {
      const k = (f: (r: ReportRow) => boolean) => pctCell(g.filter(f).length, g.length, comma);
      return [
        label,
        g.length,
        pctCell(g.length, n, comma),
        fmtMeanSe(nums(g, 'risk'), 1, comma),
        k((r) => ['sargish', 'qizil'].includes(norm(toStr(r.ctx.zona ?? null)))),
        k((r) => hasOption(r.ctx.q44 ?? null, 'Ha')),
        k((r) => hasOption(r.ctx.q51 ?? null, 'Hozirda chekaman')),
        k((r) => hasOption(r.ctx.q43 ?? null, 'Yuqori va quyi nafas organlari kasalliklari')),
        fmtMeanSe(g.map((r) => episodes(r) * 100), 1, comma),
      ];
    };
    const rows = sexes
      .map((s) => line(s, sample.filter((r) => norm(toStr(r.ctx.q9 ?? null)) === norm(s))))
      .filter((r) => (r[1] as number) > 0);
    rows.push(line('Jami', sample));
    sections.push({
      id: 'F',
      title: 'Sexlar kesimida',
      sheet: 'F Sexlar',
      tables: [
        {
          id: 'f-sex',
          title: "Asosiy ko'rsatkichlar sexlar kesimida",
          note: "% — sex ichidagi ulush (\"% jami\" bundan mustasno). Mehnatga layoqatsizlik — 100 ishchiga holatlar, M ± m.",
          headers: ['Sex', 'N', '% jami', 'Xavf, % (M ± m)', "Sarg'ish+qizil, %", 'Surunkali kasallik, %', 'Chekuvchilar, %', 'Nafas kasalliklari, %', 'Mehnatga layoqatsizlik / 100'],
          rows,
          totalRow: true,
        },
      ],
    });
  }

  // ── G. Anketa bo'limlari ──
  {
    const sectionsList = [...new Set(questions.map((q) => q.section))].filter((s) => s !== 'Kirish');
    sectionsList.forEach((secName, i) => {
      const qs = questions.filter((q) => q.section === secName && String(q.id) !== '1');
      const tables: LiveTable[] = [];
      qs.forEach((q) => {
        if (q.type === 'single_choice' || q.type === 'multi_choice') {
          tables.push(categoricalTable(sample, q, comma));
        } else if (q.type === 'number') {
          tables.push(continuousTable(sample, [[`q${String(q.id).toLowerCase()}`, q.text, 1]], comma, `q${q.id}`, `${q.id}. ${q.text}`));
        }
      });
      if (tables.length) {
        const short = secName.replace(/^(\d+)-bo'lim\.\s*/, '$1 ');
        sections.push({ id: `G${i + 1}`, title: secName, sheet: `G${i + 1} ${short}`.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '), tables });
      }
    });
  }

  if (n === 0) warnings.push("Serverda hali anketa yo'q yoki filtrdan hech kim o'tmadi.");

  return {
    generatedAt: new Date(),
    totalSurveys: surveys.length,
    uniqueUsers,
    pool: allRows.length,
    n,
    nHodisa: H.length,
    nNazorat: N.length,
    sections,
    warnings,
    sample,
    options,
  };
}

// ── Eksport ───────────────────────────────────────────

function methodologyRows(rep: LiveReport): (string | number)[][] {
  const o = rep.options;
  return [
    ['Hisobot', 'Donozologik monitoring — anketa natijalari (jonli hisob)'],
    ['Tuzilgan sana', rep.generatedAt.toLocaleString('uz-UZ')],
    ['Serverdagi anketalar', rep.totalSurveys],
    ['Noyob xodimlar', rep.uniqueUsers],
    ['Tahlilga yaroqli (pool)', rep.pool],
    ['Tanlama (N)', rep.n],
    [
      'Tanlash usuli',
      o.sampleSize > 0 && o.sampleSize < rep.pool
        ? `Sex bo'yicha qatlamlangan proporsional tasodifiy tanlama, seed = ${o.seed} (qayta hisoblaganda bir xil natija)`
        : 'Barcha mos anketalar',
    ],
    ['Takroriy anketalar', o.latestPerUser ? 'Har bir xodimdan faqat oxirgi anketa olindi' : 'Barcha anketalar olindi'],
    ['Hodisa guruhi', `${o.hodisaLabel} — formula: ${o.hodisaExpr} (n=${rep.nHodisa})`],
    ['Nazorat guruhi', `Qolgan xodimlar (n=${rep.nNazorat})`],
    ['Ulush uchun 95% IO', 'Wilson usuli'],
    ["O'rtacha", 'M ± m, m = SD/√n; o\'rtacha uchun 95% IO = M ± 1,96·m'],
    ['Miqdoriy taqqoslash', 'Welch t-testi (ikki tomonlama)'],
    ['Sifat belgilar', 'Pearson χ² (Yates tuzatishisiz); kutilgan chastota < 5 bo\'lsa Fisher aniq testi'],
    ['OR', "Nisbatlar nisbati, 95% IO log-usulda; nol katakda Haldane–Anscombe (+0,5)"],
    ['Yosh', "3-savoldagi tug'ilgan sanadan hisoblangan to'liq yil"],
    ['Klinik ko\'rsatkichlar', "Anketa klinik bosqichi; bo'lmasa 40-savoldagi bosim va 4-savoldagi vazn"],
    ['Ahamiyatlilik darajasi', 'p < 0,05'],
    ...rep.warnings.map((w, i) => [i === 0 ? 'Ogohlantirishlar' : '', w]),
  ];
}

export function exportLiveReportExcel(rep: LiveReport): void {
  const wb = XLSX.utils.book_new();
  const meta = XLSX.utils.aoa_to_sheet([['Metodika va izohlar'], [], ...methodologyRows(rep)]);
  meta['!cols'] = [{ wch: 28 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(wb, meta, 'IZOH');

  rep.sections.forEach((sec) => {
    const aoa: (string | number)[][] = [[sec.title], []];
    sec.tables.forEach((t) => {
      aoa.push([t.title]);
      if (t.note) aoa.push([t.note]);
      aoa.push(t.headers);
      t.rows.forEach((r) => aoa.push(r));
      aoa.push([]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const widths = new Array(Math.max(...sec.tables.map((t) => t.headers.length), 1)).fill(14);
    widths[0] = 46;
    ws['!cols'] = widths.map((w) => ({ wch: w }));
    let name = sec.sheet;
    let i = 2;
    while (wb.SheetNames.includes(name)) name = `${sec.sheet.slice(0, 28)} ${i++}`;
    XLSX.utils.book_append_sheet(wb, ws, name);
  });

  const list = [
    ['№', 'Anketa ID', 'Sana', 'Jins', 'Yosh', 'Sex', 'Kasb', 'Guruh', 'Xavf, %', 'Zona'],
    ...rep.sample.map((r, i) => [
      i + 1,
      r.survey.id.slice(0, 8),
      toStr(r.ctx.sana ?? null),
      toStr(r.ctx.jins ?? null),
      toNum(r.ctx.yosh ?? null) ?? '',
      toStr(r.ctx.q9 ?? null),
      toStr(r.ctx.q8 ?? null),
      r.guruh,
      toNum(r.ctx.risk ?? null) ?? '',
      toStr(r.ctx.zona ?? null),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(list);
  ws['!cols'] = [6, 12, 12, 8, 6, 26, 24, 10, 8, 10].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, "Tanlama ro'yxati");

  XLSX.writeFile(wb, `${APP_EXPORT_PREFIX}_Anketa_Tahlili_N${rep.n}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function printLiveReport(rep: LiveReport): void {
  const w = window.open('', '_blank', 'width=1100,height=850');
  if (!w) return;
  const esc = (s: string | number) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const tableHtml = (t: LiveTable) =>
    `<h3>${esc(t.title)}</h3>${t.note ? `<p class="note">${esc(t.note)}</p>` : ''}<table><thead><tr>${t.headers
      .map((h) => `<th>${esc(h)}</th>`)
      .join('')}</tr></thead><tbody>${t.rows
      .map((r, i) => `<tr class="${t.totalRow && i === t.rows.length - 1 ? 'total' : ''}">${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`;
  const html = `<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>Anketa tahlili N=${rep.n}</title>
<style>body{font-family:"Times New Roman",serif;padding:24px;color:#000;font-size:12px}h1{font-size:18px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 6px;border-bottom:1px solid #000;padding-bottom:2px}h3{font-size:13px;margin:14px 0 4px}
.note{margin:0 0 6px;color:#333;font-style:italic}table{border-collapse:collapse;width:100%;margin-bottom:8px}th,td{border:1px solid #444;padding:3px 6px;text-align:left;vertical-align:top}th{background:#eee}tr.total td{font-weight:bold}
.meta td:first-child{width:200px;font-weight:bold}@media print{body{padding:0}h2{page-break-after:avoid}table{page-break-inside:auto}tr{page-break-inside:avoid}}</style></head><body>
<h1>Anketa natijalari tahlili (N = ${rep.n})</h1><p class="note">${esc(rep.generatedAt.toLocaleString('uz-UZ'))}</p>
<h2>Metodika</h2><table class="meta"><tbody>${methodologyRows(rep)
    .map((r) => `<tr><td>${esc(r[0] ?? '')}</td><td>${esc(r[1] ?? '')}</td></tr>`)
    .join('')}</tbody></table>
${rep.sections.map((s) => `<h2>${esc(s.title)}</h2>${s.tables.map(tableHtml).join('')}`).join('')}
<script>window.onload=function(){window.print()}</script></body></html>`;
  w.document.write(html);
  w.document.close();
}
