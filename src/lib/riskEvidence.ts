/**
 * Hisob-kitob isboti: har bir anketa uchun xavf zonasi va har bir foiz
 * qaysi javobdan, qaysi formula bilan, qanday qiymatlar qo'yilib chiqqanini
 * qadam-baqadam saqlaydi. Hech qanday yashirin "standart qiymat" ishlatilmaydi:
 * ma'lumot bo'lmasa, ko'rsatkich "ma'lumot yo'q" deb belgilanadi.
 *
 * Usullar mijoz hujjatlaridan olingan:
 *  - "ДАСТУРГА — ҚИЗИЛ, ЯШИЛ, САРИҚ": zona mezonlari (TVI, AQB, A guruhi omillari,
 *    Fine-Kinney R = P × E × C, R_itog, umumiy xavf < 5% / 5–20% / > 20%),
 *    ma'lumotlarni validatsiya qilish va 1/0 kodlash.
 *  - "АНКЕТА СТАТИСТИКА": ballar yordamida baholash (Ha = 2, Ba'zan = 1, Yo'q = 0),
 *    integral ball 0–10 (0–3 past, 4–7 o'rtacha, 8–10 yuqori).
 * Umumiy yurak-qon tomir xavfi foizi uchun nashr etilgan Framingham modeli
 * (D'Agostino va boshq., Circulation 2008; TVI asosidagi variant) ishlatiladi.
 */
import { ageFromDate, toNum, toStr, type Val } from './formulaEngine';

export type Zone = 'yashil' | 'sariq' | 'qizil';
export type Level = 0 | 1 | 2;

export interface EvidenceSource {
  answers?: Record<string, unknown> | null;
  clinical?: {
    sistolik?: number | null;
    diastolik?: number | null;
    vazn?: number | null;
    boy?: number | null;
    glyukoza?: number | null;
    xolesterin?: number | null;
  } | null;
  /** Profil ma'lumoti (anketada bo'lmasa) */
  profile?: { yosh?: number | null; jins?: string | null } | null;
  /** Anketa to'ldirilgan sana — yosh shu sanaga hisoblanadi */
  date?: string | Date | null;
  /** Eski shakl uchun: chekish haqida to'g'ridan-to'g'ri ma'lumot */
  chekish?: boolean | null;
}

export interface FactRow {
  key: string;
  label: string;
  value: string;
  source: string;
  status: 'ok' | 'yoq' | 'xato';
  note?: string;
}

export interface ScoreItem {
  savol: string;
  savolMatn: string;
  javob: string;
  ball: number;
  max: number;
}

export interface IntegralScore {
  key: 'ovqatlanish' | 'stress';
  label: string;
  items: ScoreItem[];
  sum: number;
  max: number;
  /** sum / max × 10, butun songa yaxlitlangan */
  ball10: number | null;
  daraja: 'past' | 'ortacha' | 'yuqori' | null;
  formula: string;
}

export interface BinaryFactor {
  key: 'chekish' | 'gipodinamiya' | 'ovqatlanish' | 'stress';
  label: string;
  value: 0 | 1 | null;
  rule: string;
  evidence: string;
}

export interface FkRow {
  omil: string;
  manba: string;
  javob: string;
  P: number;
  E: number;
  C: number;
  R: number;
  sinf: string;
}

export interface Criterion {
  zone: Zone;
  label: string;
  rule: string;
  actual: string;
  met: boolean | null;
}

export interface CalcStep {
  title: string;
  formula: string;
  substitution: string;
  result: string;
}

export interface FraminghamTerm {
  label: string;
  x: string;
  beta: number;
  product: number;
}

export interface FraminghamProof {
  ok: boolean;
  reason?: string;
  sex?: 'Erkak' | 'Ayol';
  terms: FraminghamTerm[];
  sum?: number;
  mean?: number;
  s0?: number;
  risk?: number;
  notes: string[];
}

export interface Evidence {
  facts: FactRow[];
  yosh: number | null;
  jins: 'Erkak' | 'Ayol' | null;
  vazn: number | null;
  boy: number | null;
  bmi: number | null;
  bmiKategoriya: string | null;
  sistolik: number | null;
  diastolik: number | null;
  bpKategoriya: string | null;
  glyukoza: number | null;
  xolesterin: number | null;
  steps: CalcStep[];
  scores: IntegralScore[];
  factors: BinaryFactor[];
  fk: { rows: FkRow[]; rItog: number; formula: string };
  framingham: FraminghamProof;
  criteria: Criterion[];
  zone: Zone | null;
  zoneReason: string;
  /** Yashil zona uchun ma'lumoti yetishmagan mezonlar */
  missing: string[];
  levels: Record<LevelKey, Level | null>;
  levelEvidence: Record<LevelKey, string>;
  surunkali: { bor: boolean | null; matn: string; mezonda: boolean };
}

export type LevelKey =
  | 'bosim'
  | 'tvi'
  | 'glyukoza'
  | 'xolesterin'
  | 'chekish'
  | 'gipodinamiya'
  | 'ovqatlanish'
  | 'stress'
  | 'tuz'
  | 'yosh'
  | 'meva'
  | 'uyqu'
  | 'yurak_simptom';

// ── Yordamchi funksiyalar ─────────────────────────────

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’ʻʼ`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

function rawAnswer(a: Record<string, unknown>, id: string): unknown {
  const v = a[id];
  if (v === undefined || v === null || v === '') return null;
  if (Array.isArray(v) && v.length === 0) return null;
  return v;
}

function answerText(a: Record<string, unknown>, id: string): string {
  const v = rawAnswer(a, id);
  if (v === null) return '';
  return Array.isArray(v) ? v.map((x) => String(x)).join('; ') : String(v);
}

function answerList(a: Record<string, unknown>, id: string): string[] {
  const v = rawAnswer(a, id);
  if (v === null) return [];
  return (Array.isArray(v) ? v : [v]).map((x) => norm(String(x)));
}

/** Javob berilgan variantlardan biri `opt` bilan boshlanadimi */
function has(a: Record<string, unknown>, id: string, opt: string): boolean {
  const o = norm(opt);
  return answerList(a, id).some((x) => x === o || x.startsWith(o));
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

function inRange(n: number | null, lo: number, hi: number): boolean {
  return n !== null && n >= lo && n <= hi;
}

function parseBp(text: string): { sys: number | null; dia: number | null } {
  const m = text.match(/(\d{2,3})\s*[/\\\-–]\s*(\d{2,3})/);
  if (m) return { sys: parseInt(m[1], 10), dia: parseInt(m[2], 10) };
  return { sys: null, dia: null };
}

function firstNum(...vals: unknown[]): { n: number | null; i: number } {
  for (let i = 0; i < vals.length; i++) {
    const n = toNum((vals[i] ?? null) as Val);
    if (n !== null && n > 0) return { n, i };
  }
  return { n: null, i: -1 };
}

// ── Integral ballar (АНКЕТА СТАТИСТИКА, 1-band) ───────

interface ScoreRule {
  savol: string;
  savolMatn: string;
  max: number;
  /** variant boshi → ball */
  map: [string, number][];
}

const NUTRITION_RULES: ScoreRule[] = [
  {
    savol: '62',
    savolMatn: 'Ish kunlari qanday ovqatlanasiz',
    max: 2,
    map: [["Tushlikni o'tkazib yuboraman", 2], ["Do'kondan ovqat sotib olaman", 1]],
  },
  { savol: '65', savolMatn: 'Kuniga necha marta ovqatlanasiz', max: 1, map: [['2 marta', 1]] },
  {
    savol: '66',
    savolMatn: 'Sut mahsulotlari',
    max: 2,
    map: [["Iste'mol qilmayman", 2], ['Haftada bir marta', 1], ['Har kuni', 0]],
  },
  {
    savol: '67',
    savolMatn: 'Meva va sabzavotlar',
    max: 2,
    map: [["Iste'mol qilmayman", 2], ['Vaqti-vaqti bilan', 1], ['Muntazam', 0]],
  },
  { savol: '68', savolMatn: 'Qanday non', max: 1, map: [['Oq non', 1]] },
  {
    savol: '69',
    savolMatn: 'Tayyor ovqatga tuz qo\'shish',
    max: 2,
    map: [["Ha, tatib ko'rmayman", 2], ["Ha, avval tatib ko'raman", 1], ["Yo'q", 0]],
  },
  {
    savol: '70',
    savolMatn: 'Suv iste\'moli',
    max: 2,
    map: [["O'ta kam", 2], ['Kam miqdorda', 1]],
  },
];

const STRESS_RULES: ScoreRule[] = [
  {
    savol: '21',
    savolMatn: "So'nggi 4 haftada asabiylashish",
    max: 2,
    map: [['Doim', 2], ["Ko'pincha", 2], ["Ba'zan", 1], ['Ozgina', 0], ["Umuman yo'q", 0]],
  },
  {
    savol: '29',
    savolMatn: 'Doimiy xavotir yoki qo\'rquv',
    max: 2,
    map: [['Ha', 2], ["Ba'zan", 1], ["Yo'q", 0]],
  },
  {
    savol: '59',
    savolMatn: 'Ish faoliyati stressli',
    max: 2,
    map: [['Ha', 2], ["Ba'zan", 1], ["Yo'q", 0]],
  },
  { savol: '27', savolMatn: "Uyqudagi o'zgarishlar", max: 2, map: [['Ha', 2], ["Yo'q", 0]] },
  {
    savol: '19',
    savolMatn: 'Ish energiyani salbiy darajada egallaydi',
    max: 2,
    map: [["Ha, ma'lum darajada", 2], ['Ha, lekin ozgina', 1], ["Yo'q", 0]],
  },
  { savol: '60', savolMatn: 'Dam olishga yetarli vaqt', max: 2, map: [["Yo'q", 2], ['Ha', 0]] },
];

function scoreBlock(
  a: Record<string, unknown>,
  key: IntegralScore['key'],
  label: string,
  rules: ScoreRule[]
): IntegralScore {
  const items: ScoreItem[] = [];
  rules.forEach((r) => {
    const javob = answerText(a, r.savol);
    if (!javob) return;
    const hit = r.map.find(([opt]) => has(a, r.savol, opt));
    items.push({ savol: r.savol, savolMatn: r.savolMatn, javob, ball: hit ? hit[1] : 0, max: r.max });
  });
  const sum = items.reduce((s, i) => s + i.ball, 0);
  const max = items.reduce((s, i) => s + i.max, 0);
  const ball10 = max > 0 && items.length >= Math.ceil(rules.length / 2) ? Math.round((sum / max) * 10) : null;
  const daraja = ball10 === null ? null : ball10 <= 3 ? 'past' : ball10 <= 7 ? 'ortacha' : 'yuqori';
  const formula =
    ball10 === null
      ? `Javoblar yetarli emas (${items.length} / ${rules.length} savol)`
      : `${sum} / ${max} × 10 = ${fmt((sum / max) * 10)} ≈ ${ball10} ball`;
  return { key, label, items, sum, max, ball10, daraja, formula };
}

const DARAJA_LABEL = { past: 'past (0–3)', ortacha: "o'rtacha (4–7)", yuqori: 'yuqori (8–10)' } as const;

// ── Fine-Kinney (R = P × E × C) ───────────────────────

/**
 * Anketa javobi → P (ehtimollik), E (ta'sir chastotasi), C (oqibat) qiymatlari.
 * Shkalalar Fine-Kinney standartidan: P ∈ {0,5; 1; 3; 6; 10}, E ∈ {0,5; 1; 2; 3; 6; 10},
 * C ∈ {1; 3; 7; 15; 40; 100}. Javobni qiymatga bog'lash ekspert bahosi bo'lib,
 * dissertatsiya muallifi tomonidan tasdiqlanishi kerak.
 */
export const FINE_KINNEY_TABLE: {
  omil: string;
  savol: string;
  variant: string;
  P: number;
  E: number;
  C: number;
}[] = [
  { omil: 'Shovqin', savol: '12', variant: 'Yuqori', P: 6, E: 6, C: 7 },
  { omil: 'Shovqin', savol: '12', variant: "O'rtacha", P: 3, E: 6, C: 3 },
  { omil: 'Shovqin', savol: '12', variant: 'Past', P: 1, E: 6, C: 1 },
  { omil: 'Yuqori harorat', savol: '13', variant: 'Ha', P: 3, E: 6, C: 7 },
  { omil: 'Noqulay tana holati (ergonomik)', savol: '24', variant: "8 soatdan ko'p", P: 6, E: 10, C: 3 },
  { omil: 'Noqulay tana holati (ergonomik)', savol: '24', variant: '6-8 soat', P: 6, E: 6, C: 3 },
  { omil: 'Noqulay tana holati (ergonomik)', savol: '24', variant: '4-5 soat', P: 3, E: 6, C: 3 },
  { omil: 'Noqulay tana holati (ergonomik)', savol: '24', variant: '2-3 soat', P: 1, E: 6, C: 3 },
  { omil: 'Noqulay tana holati (ergonomik)', savol: '24', variant: '2 soatdan kam', P: 0.5, E: 6, C: 1 },
  { omil: 'Tungi smena (psixosotsial)', savol: '11', variant: 'Tungi smena mavjud', P: 3, E: 3, C: 7 },
  { omil: 'Smenali ish (psixosotsial)', savol: '11', variant: 'Smenali', P: 3, E: 3, C: 3 },
  { omil: 'Chang', savol: '15', variant: 'Chang', P: 3, E: 6, C: 7 },
  { omil: 'Noxush hidlar (kimyoviy)', savol: '15', variant: 'Noxush hidlar', P: 3, E: 6, C: 3 },
  { omil: "Jismoniy zo'riqish", savol: '15', variant: "Jismoniy zo'riqish", P: 3, E: 6, C: 3 },
  { omil: 'Noqulay mikroiqlim', savol: '15', variant: 'Noqulay mikroiqlim', P: 3, E: 6, C: 3 },
  { omil: 'Doimiy stress (psixosotsial)', savol: '15', variant: 'Doimiy stress', P: 6, E: 6, C: 3 },
];

export function fineKinneyClass(r: number): string {
  if (r <= 20) return 'Kam (qabul qilinadigan)';
  if (r <= 70) return "Ehtimoliy (e'tibor talab etiladi)";
  if (r <= 200) return 'Sezilarli (tuzatish kerak)';
  if (r <= 400) return 'Yuqori (darhol choralar)';
  return "Juda yuqori (ishni to'xtatish)";
}

function fineKinney(a: Record<string, unknown>): Evidence['fk'] {
  const rows: FkRow[] = [];
  const seen = new Set<string>();
  FINE_KINNEY_TABLE.forEach((t) => {
    if (!has(a, t.savol, t.variant)) return;
    // q11 da tungi smena bo'lsa, oddiy "smenali" alohida qo'shilmaydi
    if (t.savol === '11' && t.variant === 'Smenali' && seen.has('11:tungi')) return;
    if (t.savol === '11' && t.variant === 'Tungi smena mavjud') seen.add('11:tungi');
    const R = round1(t.P * t.E * t.C);
    rows.push({
      omil: t.omil,
      manba: `${t.savol}-savol`,
      javob: t.variant,
      P: t.P,
      E: t.E,
      C: t.C,
      R,
      sinf: fineKinneyClass(R),
    });
  });
  const rItog = round1(rows.reduce((s, r) => s + r.R, 0));
  const formula = rows.length
    ? `R_itog = Σ (P × E × C) = ${rows.map((r) => fmt(r.R, r.R % 1 ? 1 : 0)).join(' + ')} = ${fmt(rItog, rItog % 1 ? 1 : 0)}`
    : "R_itog = 0 (ish sharoiti savollarida xavfli omil belgilanmagan)";
  return { rows, rItog, formula };
}

// ── Framingham 2008 (TVI asosidagi model) ─────────────

const FRAMINGHAM = {
  Ayol: { lnAge: 2.72107, lnBmi: 0.51125, lnSbpUntreated: 2.81291, smoker: 0.61868, diabetes: 0.77763, mean: 26.0145, s0: 0.94833 },
  Erkak: { lnAge: 3.11296, lnBmi: 0.79277, lnSbpUntreated: 1.85508, smoker: 0.70953, diabetes: 0.5316, mean: 23.9388, s0: 0.88431 },
} as const;

function framingham(
  jins: 'Erkak' | 'Ayol' | null,
  yosh: number | null,
  bmi: number | null,
  sbp: number | null,
  smoker: 0 | 1 | null,
  diabetes: { v: 0 | 1; note: string }
): FraminghamProof {
  const notes = [
    "Model: D'Agostino R.B. va boshq., Circulation 2008;117:743–753 — 10 yillik umumiy yurak-qon tomir kasalligi xavfi (TVI asosidagi, laboratoriyasiz variant).",
    "Qon bosimi dori bilan davolanmaydi deb olindi: anketada bu so'ralmagan.",
    diabetes.note,
  ];
  const missing: string[] = [];
  if (!jins) missing.push('jins');
  if (yosh === null) missing.push('yosh');
  if (bmi === null) missing.push("TVI (vazn va bo'y)");
  if (sbp === null) missing.push('sistolik bosim');
  if (smoker === null) missing.push('chekish (51-savol)');
  if (missing.length) return { ok: false, reason: `Hisoblanmadi: ${missing.join(', ')} yo'q.`, terms: [], notes };
  if (yosh! < 30 || yosh! > 74)
    return { ok: false, reason: `Hisoblanmadi: model 30–74 yosh uchun tasdiqlangan (yosh = ${yosh}).`, terms: [], notes };
  const c = FRAMINGHAM[jins!];
  const terms: FraminghamTerm[] = [
    { label: 'ln(yosh)', x: `ln(${yosh}) = ${Math.log(yosh!).toFixed(4)}`, beta: c.lnAge, product: Math.log(yosh!) * c.lnAge },
    { label: 'ln(TVI)', x: `ln(${fmt(bmi!)}) = ${Math.log(bmi!).toFixed(4)}`, beta: c.lnBmi, product: Math.log(bmi!) * c.lnBmi },
    {
      label: 'ln(sistolik bosim)',
      x: `ln(${sbp}) = ${Math.log(sbp!).toFixed(4)}`,
      beta: c.lnSbpUntreated,
      product: Math.log(sbp!) * c.lnSbpUntreated,
    },
    { label: 'Chekish (1/0)', x: String(smoker), beta: c.smoker, product: smoker! * c.smoker },
    { label: 'Diabet (1/0)', x: String(diabetes.v), beta: c.diabetes, product: diabetes.v * c.diabetes },
  ];
  const sum = terms.reduce((s, t) => s + t.product, 0);
  const risk = (1 - Math.pow(c.s0, Math.exp(sum - c.mean))) * 100;
  return { ok: true, sex: jins!, terms, sum, mean: c.mean, s0: c.s0, risk: round1(risk), notes };
}

// ── Asosiy funksiya ───────────────────────────────────

const CHRONIC_RED = /gipert|qon bosim|ishemi|stenokard|infarkt|diabet|qand|osteoxondroz|семиз|semiz|гиперт|қон босим|ишеми|стенокард|инфаркт|диабет|қанд|остеохондроз/i;

export function buildEvidence(src: EvidenceSource): Evidence {
  const a = (src.answers || {}) as Record<string, unknown>;
  const klinikInAnswers = (a.klinik && typeof a.klinik === 'object' ? a.klinik : {}) as Record<string, unknown>;
  const k = { ...klinikInAnswers, ...(src.clinical || {}) } as Record<string, unknown>;
  const facts: FactRow[] = [];
  const steps: CalcStep[] = [];
  const surveyDate = src.date ? new Date(src.date) : new Date();

  // Yosh
  const ageQ = ageFromDate((rawAnswer(a, '3') ?? null) as Val, Number.isNaN(surveyDate.getTime()) ? new Date() : surveyDate);
  let yosh: number | null = ageQ ?? (src.profile?.yosh ?? null);
  const yoshSrc = ageQ !== null ? `3-savol (tug'ilgan sana ${answerText(a, '3')}), anketa sanasiga` : src.profile?.yosh ? 'Profil' : '—';
  if (yosh !== null && !inRange(yosh, 16, 90)) {
    facts.push({ key: 'yosh', label: 'Yosh', value: String(yosh), source: yoshSrc, status: 'xato', note: 'Ruxsat etilgan oraliq 16–90; hisobga olinmadi' });
    yosh = null;
  } else {
    facts.push({ key: 'yosh', label: 'Yosh', value: yosh !== null ? `${yosh} yosh` : '', source: yoshSrc, status: yosh !== null ? 'ok' : 'yoq' });
  }

  // Jins
  const g = norm(answerText(a, '5') || src.profile?.jins || '');
  const jins: Evidence['jins'] = g.startsWith('erk') || g.startsWith('эрк') ? 'Erkak' : g.startsWith('ayol') || g.startsWith('аёл') ? 'Ayol' : null;
  facts.push({ key: 'jins', label: 'Jins', value: jins ?? '', source: answerText(a, '5') ? '5-savol' : 'Profil', status: jins ? 'ok' : 'yoq' });

  // Vazn, bo'y
  const w = firstNum(k.vazn, a['4']);
  let vazn = w.n;
  const vaznSrc = w.i === 0 ? 'Klinik bosqich' : w.i === 1 ? '4-savol' : '—';
  if (vazn !== null && !inRange(vazn, 30, 250)) {
    facts.push({ key: 'vazn', label: 'Tana vazni', value: `${vazn} kg`, source: vaznSrc, status: 'xato', note: 'Oraliq 30–250 kg; hisobga olinmadi' });
    vazn = null;
  } else facts.push({ key: 'vazn', label: 'Tana vazni', value: vazn !== null ? `${vazn} kg` : '', source: vaznSrc, status: vazn !== null ? 'ok' : 'yoq' });

  let boy = firstNum(k.boy, a['boy']).n;
  if (boy !== null && !inRange(boy, 120, 220)) {
    facts.push({ key: 'boy', label: "Bo'y", value: `${boy} sm`, source: 'Klinik bosqich', status: 'xato', note: 'Oraliq 120–220 sm; hisobga olinmadi' });
    boy = null;
  } else facts.push({ key: 'boy', label: "Bo'y", value: boy !== null ? `${boy} sm` : '', source: 'Klinik bosqich', status: boy !== null ? 'ok' : 'yoq' });

  // Qon bosimi
  const bpText = parseBp(answerText(a, '40'));
  const sysK = firstNum(k.sistolik).n;
  const diaK = firstNum(k.diastolik).n;
  let sistolik = sysK ?? bpText.sys;
  let diastolik = diaK ?? bpText.dia;
  const bpSrc = sysK !== null ? 'Klinik bosqich' : bpText.sys !== null ? `40-savol ("${answerText(a, '40')}")` : '—';
  if (sistolik !== null && diastolik !== null && (!inRange(sistolik, 70, 260) || !inRange(diastolik, 40, 160) || sistolik <= diastolik)) {
    facts.push({
      key: 'bosim',
      label: 'Arterial qon bosimi',
      value: `${sistolik}/${diastolik} mm sim. ust.`,
      source: bpSrc,
      status: 'xato',
      note: 'Sistolik 70–260, diastolik 40–160 va sistolik > diastolik bo\'lishi kerak; hisobga olinmadi',
    });
    sistolik = null;
    diastolik = null;
  } else
    facts.push({
      key: 'bosim',
      label: 'Arterial qon bosimi',
      value: sistolik !== null && diastolik !== null ? `${sistolik}/${diastolik} mm sim. ust.` : '',
      source: bpSrc,
      status: sistolik !== null && diastolik !== null ? 'ok' : 'yoq',
    });
  if (sistolik === null || diastolik === null) {
    sistolik = null;
    diastolik = null;
  }

  // Glyukoza, xolesterin
  let glyukoza = firstNum(k.glyukoza, a['glyukoza']).n;
  if (glyukoza !== null && !inRange(glyukoza, 2, 30)) {
    facts.push({ key: 'glyukoza', label: 'Glyukoza', value: `${glyukoza} mmol/l`, source: 'Klinik bosqich', status: 'xato', note: 'Oraliq 2–30 mmol/l; hisobga olinmadi' });
    glyukoza = null;
  } else facts.push({ key: 'glyukoza', label: 'Glyukoza', value: glyukoza !== null ? `${fmt(glyukoza)} mmol/l` : '', source: 'Klinik bosqich', status: glyukoza !== null ? 'ok' : 'yoq' });
  let xolesterin = firstNum(k.xolesterin, a['xolesterin']).n;
  if (xolesterin !== null && !inRange(xolesterin, 2, 15)) {
    facts.push({ key: 'xolesterin', label: 'Umumiy xolesterin', value: `${xolesterin} mmol/l`, source: 'Klinik bosqich', status: 'xato', note: 'Oraliq 2–15 mmol/l; hisobga olinmadi' });
    xolesterin = null;
  } else
    facts.push({ key: 'xolesterin', label: 'Umumiy xolesterin', value: xolesterin !== null ? `${fmt(xolesterin)} mmol/l` : '', source: 'Klinik bosqich', status: xolesterin !== null ? 'ok' : 'yoq' });

  // TVI
  let bmi: number | null = null;
  let bmiKategoriya: string | null = null;
  if (vazn !== null && boy !== null) {
    const h = boy / 100;
    bmi = round1(vazn / (h * h));
    bmiKategoriya =
      bmi < 18.5 ? 'Vazn yetishmasligi' : bmi < 25 ? "Me'yor" : bmi < 30 ? 'Ortiqcha vazn' : bmi < 35 ? 'Semizlik I daraja' : 'Semizlik II–III daraja';
    steps.push({
      title: 'Tana vazni indeksi (TVI)',
      formula: "TVI = vazn (kg) / bo'y (m)²",
      substitution: `${vazn} / (${fmt(h, 2)})² = ${vazn} / ${fmt(h * h, 4)}`,
      result: `${fmt(bmi)} kg/m² — ${bmiKategoriya} (me'yor 18,5–24,9)`,
    });
  } else {
    steps.push({
      title: 'Tana vazni indeksi (TVI)',
      formula: "TVI = vazn (kg) / bo'y (m)²",
      substitution: vazn === null ? 'Vazn kiritilmagan' : "Bo'y kiritilmagan",
      result: 'Hisoblanmadi',
    });
  }

  let bpKategoriya: string | null = null;
  if (sistolik !== null && diastolik !== null) {
    bpKategoriya =
      sistolik >= 140 || diastolik >= 90
        ? 'Arterial gipertenziya darajasi (≥ 140/90)'
        : sistolik >= 130 || diastolik >= 85
          ? 'Pregipertenziya (130/85 – 139/89)'
          : sistolik <= 120 && diastolik <= 80
            ? 'Optimal (≤ 120/80)'
            : "Normal (121–129 / 81–84) — optimal emas";
    steps.push({
      title: 'Arterial qon bosimi toifasi',
      formula: 'Chegaralar: ≤ 120/80 yashil · 130/85–139/89 sariq · ≥ 140/90 qizil',
      substitution: `${sistolik}/${diastolik} mm sim. ust.`,
      result: bpKategoriya,
    });
  }

  // Integral ballar
  const nutrition = scoreBlock(a, 'ovqatlanish', "Ovqatlanish xavfi (integral ball)", NUTRITION_RULES);
  const stress = scoreBlock(a, 'stress', 'Psixoemotsional stress (integral ball)', STRESS_RULES);
  const scores = [nutrition, stress];

  // A guruhi omillari (1/0)
  const factors: BinaryFactor[] = [];
  const smoke51 = answerText(a, '51');
  const smoker: 0 | 1 | null = smoke51
    ? has(a, '51', 'Hozirda chekaman') ? 1 : 0
    : typeof src.chekish === 'boolean' ? (src.chekish ? 1 : 0) : null;
  factors.push({
    key: 'chekish',
    label: 'Chekish',
    value: smoker,
    rule: '"Hozirda chekaman" → 1, boshqa javob → 0',
    evidence: smoke51 ? `51-savol: "${smoke51}"` : src.chekish != null ? 'Shakldagi chekish maydoni' : "Javob yo'q",
  });

  const q52 = answerText(a, '52');
  const q55 = answerText(a, '55');
  let hypo: 0 | 1 | null = null;
  if (q52) {
    if (has(a, '52', "Yo'q")) hypo = 1;
    else if (q55) hypo = has(a, '55', 'Har kuni') || has(a, '55', 'Haftada bir necha marta') ? 0 : 1;
    else hypo = 0;
  }
  factors.push({
    key: 'gipodinamiya',
    label: 'Gipodinamiya',
    value: hypo,
    rule:
      'Mashq qilmaydi → 1. Mashq qiladi: "Har kuni" yoki "Haftada bir necha marta" → 0, boshqa chastota (haftasiga 150 daqiqa me\'yoriga yetmaydi) → 1',
    evidence: q52 ? `52-savol: "${q52}"${q55 ? `; 55-savol: "${q55}"` : ''}` : "Javob yo'q",
  });
  factors.push({
    key: 'ovqatlanish',
    label: "Noto'g'ri ovqatlanish",
    value: nutrition.ball10 === null ? null : nutrition.ball10 >= 4 ? 1 : 0,
    rule: "Ovqatlanish integral balli ≥ 4 (o'rtacha yoki yuqori) → 1",
    evidence: nutrition.ball10 === null ? nutrition.formula : `Integral ball ${nutrition.ball10} — ${DARAJA_LABEL[nutrition.daraja!]}`,
  });
  factors.push({
    key: 'stress',
    label: 'Surunkali stress',
    value: stress.ball10 === null ? null : stress.ball10 >= 4 ? 1 : 0,
    rule: "Stress integral balli ≥ 4 (o'rtacha yoki yuqori) → 1",
    evidence: stress.ball10 === null ? stress.formula : `Integral ball ${stress.ball10} — ${DARAJA_LABEL[stress.daraja!]}`,
  });

  // Surunkali kasallik
  const q44 = answerText(a, '44');
  const q44a = answerText(a, '44a');
  const surunkali = {
    bor: q44 ? has(a, '44', 'Ha') : null,
    matn: q44a,
    mezonda: has(a, '44', 'Ha') && CHRONIC_RED.test(q44a),
  };

  // Diabet (Framingham uchun)
  const diab: { v: 0 | 1; note: string } =
    (glyukoza !== null && glyukoza >= 7) || (surunkali.mezonda && /diabet|qand|диабет|қанд/i.test(q44a))
      ? { v: 1, note: `Diabet = 1: ${glyukoza !== null && glyukoza >= 7 ? `glyukoza ${fmt(glyukoza)} ≥ 7,0 mmol/l` : `44a-savol: "${q44a}"`}.` }
      : {
          v: 0,
          note:
            glyukoza !== null
              ? `Diabet = 0: glyukoza ${fmt(glyukoza)} < 7,0 mmol/l va 44a-savolda diabet ko'rsatilmagan.`
              : "Diabet = 0: glyukoza kiritilmagan va 44a-savolda diabet ko'rsatilmagan.",
        };
  const fram = framingham(jins, yosh, bmi, sistolik, smoker, diab);

  // Fine-Kinney
  const fk = fineKinney(a);

  // ── Zona mezonlari (hujjatdagi jadval) ──
  const criteria: Criterion[] = [];
  const bpTxt = sistolik !== null ? `${sistolik}/${diastolik}` : "ma'lumot yo'q";
  const bmiTxt = bmi !== null ? `TVI ${fmt(bmi)}` : "ma'lumot yo'q";
  const framTxt = fram.ok ? `${fmt(fram.risk!)}%` : "hisoblanmadi";
  // QIZIL
  criteria.push({ zone: 'qizil', label: 'Arterial qon bosimi', rule: 'AQB ≥ 140/90', actual: bpTxt, met: sistolik === null ? null : sistolik >= 140 || diastolik! >= 90 });
  criteria.push({ zone: 'qizil', label: 'Fine-Kinney integral indeksi', rule: 'R_itog ≥ 1800', actual: `R_itog = ${fmt(fk.rItog, 0)}`, met: fk.rItog >= 1800 });
  criteria.push({ zone: 'qizil', label: 'Umumiy YQT xavfi (Framingham)', rule: '> 20%', actual: framTxt, met: fram.ok ? fram.risk! > 20 : null });
  criteria.push({ zone: 'qizil', label: 'Semizlik II–III daraja', rule: 'TVI ≥ 35', actual: bmiTxt, met: bmi === null ? null : bmi >= 35 });
  criteria.push({ zone: 'qizil', label: 'Glyukoza diabet darajasida', rule: '≥ 7,0 mmol/l', actual: glyukoza !== null ? `${fmt(glyukoza)} mmol/l` : "ma'lumot yo'q", met: glyukoza === null ? null : glyukoza >= 7 });
  criteria.push({
    zone: 'qizil',
    label: 'Shakllangan surunkali kasallik (AG, YIK, 2-tip diabet, osteoxondroz, semizlik)',
    rule: '44-savol "Ha" va 44a da shu kasalliklardan biri',
    actual: q44 ? `${q44}${q44a ? `: ${q44a}` : ''}` : "javob yo'q",
    met: q44 ? surunkali.mezonda : null,
  });
  criteria.push({
    zone: 'qizil',
    label: 'Koks modeli bo\'yicha tezlashish',
    rule: '≥ 2,5 baravar',
    actual: 'Hisoblanmaydi: Koks modeli koeffitsientlari bu tanlamada baholanmagan',
    met: null,
  });
  // SARIQ
  criteria.push({
    zone: 'sariq',
    label: 'Qon bosimi optimal emas',
    rule: '120/80 dan yuqori, lekin < 140/90',
    actual: bpTxt,
    met: sistolik === null ? null : (sistolik > 120 || diastolik! > 80) && sistolik < 140 && diastolik! < 90,
  });
  criteria.push({ zone: 'sariq', label: 'Ortiqcha vazn / semizlik I', rule: 'TVI 25,0–34,9', actual: bmiTxt, met: bmi === null ? null : bmi >= 25 && bmi < 35 });
  criteria.push({ zone: 'sariq', label: 'Vazn yetishmasligi', rule: 'TVI < 18,5', actual: bmiTxt, met: bmi === null ? null : bmi < 18.5 });
  criteria.push({ zone: 'sariq', label: 'Fine-Kinney integral indeksi', rule: '20 ≤ R_itog < 1800', actual: `R_itog = ${fmt(fk.rItog, 0)}`, met: fk.rItog >= 20 && fk.rItog < 1800 });
  criteria.push({ zone: 'sariq', label: 'Umumiy YQT xavfi (Framingham)', rule: '5–20%', actual: framTxt, met: fram.ok ? fram.risk! >= 5 && fram.risk! <= 20 : null });
  factors.forEach((f) =>
    criteria.push({ zone: 'sariq', label: `A guruhi omili: ${f.label}`, rule: '= 1', actual: f.value === null ? "ma'lumot yo'q" : String(f.value), met: f.value === null ? null : f.value === 1 })
  );
  criteria.push({ zone: 'sariq', label: 'Glyukoza me\'yordan yuqori', rule: '5,6–6,9 mmol/l', actual: glyukoza !== null ? `${fmt(glyukoza)} mmol/l` : "ma'lumot yo'q", met: glyukoza === null ? null : glyukoza >= 5.6 && glyukoza < 7 });
  criteria.push({ zone: 'sariq', label: 'Xolesterin me\'yordan yuqori', rule: '≥ 5,2 mmol/l', actual: xolesterin !== null ? `${fmt(xolesterin)} mmol/l` : "ma'lumot yo'q", met: xolesterin === null ? null : xolesterin >= 5.2 });
  criteria.push({
    zone: 'sariq',
    label: 'Boshqa surunkali kasallik',
    rule: '44-savol "Ha" (qizil ro\'yxatdagi kasallik emas)',
    actual: q44 ? `${q44}${q44a ? `: ${q44a}` : ''}` : "javob yo'q",
    met: q44 ? surunkali.bor === true && !surunkali.mezonda : null,
  });
  // YASHIL (hammasi bajarilishi kerak)
  criteria.push({ zone: 'yashil', label: 'Qon bosimi', rule: 'AQB ≤ 120/80', actual: bpTxt, met: sistolik === null ? null : sistolik <= 120 && diastolik! <= 80 });
  criteria.push({ zone: 'yashil', label: 'TVI me\'yorda', rule: '18,5–24,9', actual: bmiTxt, met: bmi === null ? null : bmi >= 18.5 && bmi < 25 });
  criteria.push({ zone: 'yashil', label: 'Fine-Kinney', rule: 'R_itog < 20', actual: `R_itog = ${fmt(fk.rItog, 0)}`, met: fk.rItog < 20 });
  criteria.push({ zone: 'yashil', label: 'Umumiy YQT xavfi (Framingham)', rule: '< 5%', actual: framTxt, met: fram.ok ? fram.risk! < 5 : null });
  criteria.push({
    zone: 'yashil',
    label: 'A guruhi omillari yo\'q',
    rule: 'chekish, gipodinamiya, ovqatlanish, stress = 0',
    actual: factors.map((f) => `${f.label}: ${f.value ?? '—'}`).join(', '),
    met: factors.some((f) => f.value === 1) ? false : factors.some((f) => f.value === null) ? null : true,
  });

  const redHit = criteria.filter((c) => c.zone === 'qizil' && c.met === true);
  const yellowHit = criteria.filter((c) => c.zone === 'sariq' && c.met === true);
  const greens = criteria.filter((c) => c.zone === 'yashil');
  const missing = greens.filter((c) => c.met === null).map((c) => c.label);
  const greenFail = greens.filter((c) => c.met === false);

  let zone: Zone | null;
  let zoneReason: string;
  if (redHit.length) {
    zone = 'qizil';
    zoneReason = `Qizil zona mezoni bajarildi: ${redHit.map((c) => `${c.label} (${c.actual})`).join('; ')}.`;
  } else if (yellowHit.length) {
    zone = 'sariq';
    zoneReason = `Qizil mezon yo'q. Sariq zona mezoni bajarildi: ${yellowHit.map((c) => `${c.label} (${c.actual})`).join('; ')}.`;
  } else if (greenFail.length) {
    zone = 'sariq';
    zoneReason = `Yashil zona sharti bajarilmadi: ${greenFail.map((c) => `${c.label} (${c.actual})`).join('; ')}.`;
  } else if (greens.some((c) => c.met === true)) {
    zone = 'yashil';
    zoneReason = missing.length
      ? `Qizil va sariq mezon yo'q, mavjud yashil shartlar bajarildi. To'liq tasdiqlanmagan: ${missing.join(', ')} uchun ma'lumot yo'q.`
      : "Qizil va sariq mezon yo'q, yashil zonaning barcha shartlari bajarildi.";
  } else {
    zone = null;
    zoneReason = "Zona aniqlanmadi: klinik ko'rsatkichlar va turmush tarzi javoblari yetarli emas.";
  }

  // ── Kasallik indekslari uchun omil darajalari (0 / 1 / 2) ──
  const levels: Record<LevelKey, Level | null> = {
    bosim: sistolik === null ? null : sistolik >= 140 || diastolik! >= 90 ? 2 : sistolik >= 130 || diastolik! >= 85 ? 1 : 0,
    tvi: bmi === null ? null : bmi >= 30 ? 2 : bmi >= 25 ? 1 : 0,
    glyukoza: glyukoza === null ? null : glyukoza >= 7 ? 2 : glyukoza >= 5.6 ? 1 : 0,
    xolesterin: xolesterin === null ? null : xolesterin >= 6.2 ? 2 : xolesterin >= 5.2 ? 1 : 0,
    chekish: smoker === null ? null : smoker === 1 ? 2 : has(a, '51', 'Ilgari chekardim') ? 1 : 0,
    gipodinamiya: hypo === null ? null : hypo === 1 ? 2 : 0,
    ovqatlanish: nutrition.daraja === null ? null : nutrition.daraja === 'yuqori' ? 2 : nutrition.daraja === 'ortacha' ? 1 : 0,
    stress: stress.daraja === null ? null : stress.daraja === 'yuqori' ? 2 : stress.daraja === 'ortacha' ? 1 : 0,
    tuz: !answerText(a, '69') ? null : has(a, '69', "Ha, tatib ko'rmayman") ? 2 : has(a, '69', "Ha, avval tatib") ? 1 : 0,
    yosh: yosh === null ? null : yosh >= 55 ? 2 : yosh >= 45 ? 1 : 0,
    meva: !answerText(a, '67') ? null : has(a, '67', "Iste'mol qilmayman") ? 2 : has(a, '67', 'Vaqti-vaqti') ? 1 : 0,
    uyqu: !answerText(a, '27') ? null : has(a, '27', 'Ha') ? 2 : 0,
    yurak_simptom: !answerText(a, '28') ? null : has(a, '28', 'Ha') ? 2 : has(a, '28', "Ba'zan") ? 1 : 0,
  };
  const levelEvidence: Record<LevelKey, string> = {
    bosim: sistolik === null ? "ma'lumot yo'q" : `${sistolik}/${diastolik} (≥140/90 → 2; 130/85–139/89 → 1; boshqa → 0)`,
    tvi: bmi === null ? "ma'lumot yo'q" : `TVI ${fmt(bmi)} (≥30 → 2; 25–29,9 → 1; < 25 → 0)`,
    glyukoza: glyukoza === null ? "ma'lumot yo'q" : `${fmt(glyukoza)} mmol/l (≥7,0 → 2; 5,6–6,9 → 1; < 5,6 → 0)`,
    xolesterin: xolesterin === null ? "ma'lumot yo'q" : `${fmt(xolesterin)} mmol/l (≥6,2 → 2; 5,2–6,1 → 1; < 5,2 → 0)`,
    chekish: smoke51 ? `51-savol: "${smoke51}" (hozir chekadi → 2; ilgari → 1; chekmagan → 0)` : smoker !== null ? `chekish = ${smoker}` : "ma'lumot yo'q",
    gipodinamiya: hypo === null ? "ma'lumot yo'q" : `gipodinamiya = ${hypo} (1 → 2 ball)`,
    ovqatlanish: nutrition.ball10 === null ? "ma'lumot yo'q" : `integral ball ${nutrition.ball10} (yuqori → 2; o'rtacha → 1; past → 0)`,
    stress: stress.ball10 === null ? "ma'lumot yo'q" : `integral ball ${stress.ball10} (yuqori → 2; o'rtacha → 1; past → 0)`,
    tuz: answerText(a, '69') ? `69-savol: "${answerText(a, '69')}"` : "ma'lumot yo'q",
    yosh: yosh === null ? "ma'lumot yo'q" : `${yosh} yosh (≥55 → 2; 45–54 → 1; < 45 → 0)`,
    meva: answerText(a, '67') ? `67-savol: "${answerText(a, '67')}"` : "ma'lumot yo'q",
    uyqu: answerText(a, '27') ? `27-savol: "${answerText(a, '27')}"` : "ma'lumot yo'q",
    yurak_simptom: answerText(a, '28') ? `28-savol: "${answerText(a, '28')}"` : "ma'lumot yo'q",
  };

  return {
    facts,
    yosh,
    jins,
    vazn,
    boy,
    bmi,
    bmiKategoriya,
    sistolik,
    diastolik,
    bpKategoriya,
    glyukoza,
    xolesterin,
    steps,
    scores,
    factors,
    fk,
    framingham: fram,
    criteria,
    zone,
    zoneReason,
    missing,
    levels,
    levelEvidence,
    surunkali,
  };
}

export const ZONE_STYLE: Record<Zone, { color: string; bg: string; label: string }> = {
  yashil: { color: '#15803d', bg: '#f0fdf4', label: 'Yashil — minimal xavf (profilaktik kuzatuv)' },
  sariq: { color: '#a16207', bg: '#fefce8', label: "Sariq — o'rtacha / yuqori xavf (Lifestyle Medicine)" },
  qizil: { color: '#b91c1c', bg: '#fef2f2', label: 'Qizil — kritik xavf (shifokorga shoshilinch xabar)' },
};

export function formatNum(n: number, d = 1): string {
  return fmt(n, d);
}

// ── Matn ko'rinishi (PDF va eksport uchun) ────────────

/** jsPDF standart shrifti chiqara olmaydigan belgilarni oddiy belgilarga almashtiradi */
export function pdfSafe(s: string): string {
  return s
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/×/g, 'x')
    .replace(/Σ/g, 'Sum ')
    .replace(/[–—]/g, '-')
    .replace(/→/g, '->')
    .replace(/₀/g, '0')
    .replace(/²/g, '^2')
    .replace(/β/g, 'b')
    .replace(/≈/g, '~')
    .replace(/·/g, '|')
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’ʻʼ]/g, "'")
    .replace(/[^\x20-\x7E\n]/g, '?');
}

export interface ProofSection {
  title: string;
  lines: string[];
}

export function evidenceToSections(
  ev: Evidence,
  prognoses: { kasallik: { nomi: string }; xavfFoizi: number | null; omillar: { label: string; ball: number | null; dalil: string }[]; formula: string }[]
): ProofSection[] {
  const out: ProofSection[] = [];
  out.push({
    title: `Hisob-kitob isboti — zona: ${ev.zone ? ev.zone.toUpperCase() : 'ANIQLANMADI'}`,
    lines: [ev.zoneReason],
  });
  out.push({
    title: "1. Kiritilgan ma'lumotlar va tekshiruv",
    lines: ev.facts.map(
      (f) => `${f.label}: ${f.value || '-'} | manba: ${f.source} | ${f.status === 'ok' ? 'qabul qilindi' : f.status === 'yoq' ? 'kiritilmagan' : `xato: ${f.note}`}`
    ),
  });
  out.push({
    title: '2. Klinik hisob-kitoblar',
    lines: ev.steps.flatMap((s) => [`${s.title}: ${s.formula}`, `   ${s.substitution} => ${s.result}`]),
  });
  out.push({
    title: "3. Integral ballar (Ha = 2, Ba'zan = 1, Yo'q = 0)",
    lines: ev.scores.flatMap((s) => [
      `${s.label}:`,
      ...s.items.map((i) => `   ${i.savol}. ${i.savolMatn}: "${i.javob}" -> ${i.ball} / ${i.max}`),
      `   Integral ball = ${s.formula}${s.daraja ? ` (${s.daraja})` : ''}`,
    ]),
  });
  out.push({
    title: '4. A guruhi xavf omillari (1 / 0)',
    lines: ev.factors.map((f) => `${f.label} = ${f.value ?? '-'} | qoida: ${f.rule} | dalil: ${f.evidence}`),
  });
  out.push({
    title: '5. Fine-Kinney: R = P x E x C',
    lines: [
      ...ev.fk.rows.map((r) => `${r.omil} (${r.manba}: "${r.javob}"): ${r.P} x ${r.E} x ${r.C} = ${r.R} — ${r.sinf}`),
      ev.fk.formula,
      "P, E, C qiymatlari ekspert baholash jadvalidan (muallif tasdiqlashi kerak).",
    ],
  });
  const fr = ev.framingham;
  out.push({
    title: '6. Umumiy yurak-qon tomir xavfi (Framingham, 10 yil)',
    lines: fr.ok
      ? [
          ...fr.terms.map((t) => `${t.label}: x = ${t.x}; b = ${t.beta}; b*x = ${t.product.toFixed(4)}`),
          `Sum b*x = ${fr.sum!.toFixed(4)}; xavf = 1 - ${fr.s0}^exp(${fr.sum!.toFixed(4)} - ${fr.mean}) = ${formatNum(fr.risk!)}%`,
          ...fr.notes,
        ]
      : [fr.reason ?? 'Hisoblanmadi', ...fr.notes],
  });
  out.push({
    title: '7. Zona mezonlari',
    lines: ev.criteria.map(
      (c) => `[${c.zone}] ${c.label} (${c.rule}): ${c.actual} -> ${c.met === true ? 'BAJARILDI' : c.met === false ? "yo'q" : "ma'lumot yo'q"}`
    ),
  });
  out.push({
    title: "8. Kasallik risk prognozlari (indeks = Sum ball / (2 x omillar soni) x 100%)",
    lines: prognoses.flatMap((p) => [
      `${p.kasallik.nomi}: ${p.xavfFoizi === null ? 'hisoblanmadi' : `${p.xavfFoizi}%`}`,
      ...p.omillar.map((o) => `   ${o.label}: ${o.ball ?? '-'} (${o.dalil})`),
      `   ${p.formula}`,
    ]),
  });
  return out;
}
