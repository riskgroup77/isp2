import type { Question, SurveyResponseOut } from '../types/api';
import { getRespondentName } from './surveyFilter';

export type StudyGroup = 'hodisa' | 'nazorat';

export interface WorkerMeta {
  ism?: string;
  login?: string;
  kasb?: string;
  sex?: string;
  yosh?: number;
  jins?: 'erkak' | 'ayol' | string;
  ishStajiYil?: number;
}

export interface EnrichedSurvey {
  survey: SurveyResponseOut;
  meta: WorkerMeta;
  guruh: StudyGroup;
  diseases: string[];
}

export interface DiseaseClassRow {
  code: string;
  nomi: string;
}

/** ICD-10 asosidagi kasallik sinflari (5 yillik kasallanishlar jadvali) */
export const ICD_DISEASE_CLASSES: DiseaseClassRow[] = [
  { code: 'I', nomi: "Ba'zi infeksion va parazitar kasalliklar" },
  { code: 'II', nomi: "O'smalar" },
  { code: 'III', nomi: 'Qon va qon yaratuvchi a\'zolar kasalliklari' },
  { code: 'IV', nomi: 'Endokrin tizim, ovqatlanish va modda almashinuvi kasalliklari' },
  { code: 'V', nomi: 'Ruhiy va xulq-atvor buzilishlari' },
  { code: 'VI', nomi: 'Asab tizimi kasalliklari' },
  { code: 'VII', nomi: "Ko'z va qo'shimcha apparati kasalliklari" },
  { code: 'VIII', nomi: "Quloq va so'rg'ichsimon o'simta kasalliklari" },
  { code: 'IX', nomi: 'Qon aylanish tizimi kasalliklari' },
  { code: 'X', nomi: 'Nafas a\'zolari kasalliklari' },
  { code: 'XI', nomi: 'Hazm a\'zolari kasalliklari' },
  { code: 'XII', nomi: 'Teri va teri osti to\'qima kasalliklari' },
  { code: 'XIII', nomi: 'Suyak-mushak tizimi va biriktiruvchi to\'qima kasalliklari' },
  { code: 'XIV', nomi: 'Siydik-tanosil tizimi kasalliklari' },
  { code: 'XV', nomi: 'Tug\'ish, homiladorlik va tug\'ruq kasalliklari' },
  { code: 'XVI', nomi: 'Perinatal davr kasalliklari' },
  { code: 'XVII', nomi: 'Anomaliyalar va xromosoma buzilishlari' },
  { code: 'XVIII', nomi: 'Belgilanmagan holatlar' },
  { code: 'XIX', nomi: 'Tashqi sabablarning jarohatlari, zaharlanishlar va oqibatlari' },
];

/** Anketa tahlili 3-jadval — kasallanishlar strukturasi */
export const ANKETA_STRUCTURE_CLASSES = [
  {
    rank: 1,
    nomi: 'Nafas olish tizimi kasalliklari (surunkali bronxit, faringit, chang ta\'siri)',
    keywords: ['nafas', 'bronxit', 'faringit', 'chang', "o'pk", 'respirator', 'yotal', 'pnevmo'],
    icdCodes: ['X'],
  },
  {
    rank: 2,
    nomi: 'Suyak-mushak tizimi kasalliklari (osteoxondroz, radikulit, mialgiya)',
    keywords: ['suyak', 'mushak', 'osteoxondroz', 'radikulit', 'mialgiya', 'orqa', 'bel'],
    icdCodes: ['XIII'],
  },
  {
    rank: 3,
    nomi: 'Yurak-qon tomir tizimi kasalliklari (arterial gipertenziya, IJB)',
    keywords: ['yurak', 'qon tomir', 'gipertenziya', 'ijb', 'arterial', 'kardio', 'bosim'],
    icdCodes: ['IX'],
  },
  {
    rank: 4,
    nomi: 'Asab tizimi kasalliklari (nevroz, astenonevroz, vegetativ buzilish)',
    keywords: ['asab', 'nevroz', 'asteno', 'vegetativ', 'stress', 'depress'],
    icdCodes: ['VI', 'V'],
  },
  {
    rank: 5,
    nomi: "Siydik-tanosil tizimi kasalliklari (sistit, pielonefrit, prostatit)",
    keywords: ['siydik', 'tanosil', 'sistit', 'pielonefrit', 'prostatit', 'buyrak'],
    icdCodes: ['XIV'],
  },
  {
    rank: 6,
    nomi: "Ovqat hazm qilish a'zolari kasalliklari (gastrit, yara kasalligi)",
    keywords: ['gastrit', 'hazm', 'oshqozon', 'jigar', 'ovqat'],
    icdCodes: ['XI'],
  },
];

const ICD_KEYWORDS: Record<string, string[]> = {
  I: ['infeksiya', 'parazit', 'virus', 'gripp', 'sil', 'gepatit'],
  II: ["o'sma", 'tumor', 'neoplaz'],
  III: ['anemiya', 'kamqon', 'qon'],
  IV: ['qand', 'diabet', 'tireoid', 'endokrin', 'glyukoza'],
  V: ['ruh', 'psixo', 'depress', 'shizofren'],
  VI: ['asab', 'nevroz', 'epilep', 'migrain'],
  VII: ["ko'z", 'katarakta', 'glaukoma'],
  VIII: ['quloq', 'shangillash', 'otit'],
  IX: ['yurak', 'gipertenziya', 'aritmiya', 'infarkt', 'bosim'],
  X: ['nafas', 'bronxit', 'pnevmo', 'o\'pk', 'yotal'],
  XI: ['gastrit', 'jigar', 'hazm', 'oshqozon'],
  XII: ['teri', 'dermatit', 'ekzema'],
  XIII: ['suyak', 'mushak', 'osteoxondroz', 'artrit'],
  XIV: ['siydik', 'buyrak', 'prostat', 'sistit'],
  XV: ['homilador', 'tug\'ruq'],
  XVI: ['perinatal'],
  XVII: ['xromosoma', 'anomaliya'],
  XVIII: ['noma\'lum', 'boshqa'],
  XIX: ['jarohat', 'zaharlanish', 'travma'],
};

function collectAnswerText(answers: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const val of Object.values(answers)) {
    if (Array.isArray(val)) parts.push(...val.map(String));
    else if (val != null && val !== '') parts.push(String(val));
  }
  return parts.join(' ').toLowerCase();
}

function textMatchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k.toLowerCase()));
}

export function extractDiseasesFromAnswers(answers: Record<string, unknown>): string[] {
  const found: string[] = [];
  const text = collectAnswerText(answers);

  for (const cls of ANKETA_STRUCTURE_CLASSES) {
    if (textMatchesAny(text, cls.keywords)) found.push(cls.nomi);
  }

  for (const [code, keywords] of Object.entries(ICD_KEYWORDS)) {
    if (textMatchesAny(text, keywords)) {
      const row = ICD_DISEASE_CLASSES.find((c) => c.code === code);
      if (row && !found.includes(row.nomi)) found.push(row.nomi);
    }
  }

  return found;
}

export function classifyStudyGroup(survey: SurveyResponseOut): StudyGroup {
  const zone = survey.risk_zonasi || survey.ai_response?.zona || '';
  const score = survey.score_total || survey.ai_response?.riskFoizi || 0;
  const text = collectAnswerText(survey.answers);

  const highRisk =
    zone === 'sargish' ||
    zone === 'qizil' ||
    score >= 55 ||
    /surunkali|xronik|kasbga bog/.test(text) ||
    /yuqori|juda/.test(text);

  return highRisk ? 'hodisa' : 'nazorat';
}

export function extractMetaFromSurvey(survey: SurveyResponseOut): WorkerMeta {
  const a = survey.answers;
  const jinsRaw = String(a['5'] ?? a['jins'] ?? '');
  const jins = jinsRaw.toLowerCase().includes('ayol') ? 'ayol' : 'erkak';

  let yosh: number | undefined;
  const yoshVal = a['3'] ?? a['yosh'] ?? a['2'];
  if (typeof yoshVal === 'number') yosh = yoshVal;
  else if (yoshVal) {
    const n = parseInt(String(yoshVal), 10);
    if (!isNaN(n)) yosh = n;
  }

  return {
    ism: getRespondentName(survey),
    kasb: String(a['kasb'] ?? a['10'] ?? a['11'] ?? a['9'] ?? '').trim() || undefined,
    sex: String(a['sex'] ?? a['12'] ?? a['8'] ?? '').trim() || undefined,
    yosh,
    jins,
    ishStajiYil: parseInt(String(a['ish_staji'] ?? a['13'] ?? ''), 10) || undefined,
  };
}

export function enrichSurveys(
  surveys: SurveyResponseOut[],
  metaByUserId?: Record<string, WorkerMeta>
): EnrichedSurvey[] {
  return surveys.map((survey) => {
    const baseMeta = extractMetaFromSurvey(survey);
    const meta = { ...baseMeta, ...(metaByUserId?.[survey.user_id] || {}) };
    return {
      survey,
      meta,
      guruh: classifyStudyGroup(survey),
      diseases: extractDiseasesFromAnswers(survey.answers),
    };
  });
}

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function standardError(values: number[]): number {
  if (values.length < 2) return 0;
  return stdDev(values) / Math.sqrt(values.length);
}

export function formatMeanSe(values: number[], decimals = 1): string {
  if (!values.length) return '0';
  const m = mean(values);
  const se = standardError(values);
  return `${m.toFixed(decimals)}±${se.toFixed(decimals)}`;
}

export function per100(value: number, totalWorkers: number): number {
  if (totalWorkers <= 0) return 0;
  return (value / totalWorkers) * 100;
}

export interface GroupMetric {
  hodisalar: number;
  kunlar: number;
  erkak: number;
  ayol: number;
}

export function estimateDisabilityMetrics(
  enriched: EnrichedSurvey[],
  matchFn: (e: EnrichedSurvey) => boolean
): GroupMetric {
  let hodisalar = 0;
  let kunlar = 0;
  let erkak = 0;
  let ayol = 0;

  for (const e of enriched.filter(matchFn)) {
    const hasDisease = e.diseases.length > 0;
    const riskScore = e.survey.score_total || e.survey.ai_response?.riskFoizi || 30;
    const caseCount = hasDisease ? Math.max(1, Math.round(e.diseases.length * 0.6)) : riskScore > 50 ? 1 : 0;
    const dayCount = caseCount * (8 + Math.round(riskScore / 10));

    hodisalar += caseCount;
    kunlar += dayCount;
    if (e.meta.jins === 'ayol') ayol += caseCount;
    else erkak += caseCount;
  }

  return { hodisalar, kunlar, erkak, ayol };
}

export function buildIcdComparisonTable(enriched: EnrichedSurvey[]) {
  const hodisa = enriched.filter((e) => e.guruh === 'hodisa');
  const nazorat = enriched.filter((e) => e.guruh === 'nazorat');
  const nH = hodisa.length || 1;
  const nN = nazorat.length || 1;

  return ICD_DISEASE_CLASSES.map((cls) => {
    const keywords = ICD_KEYWORDS[cls.code] || [];
    const match = (e: EnrichedSurvey) =>
      e.diseases.some((d) => d.toLowerCase().includes(cls.nomi.slice(0, 12).toLowerCase())) ||
      textMatchesAny(collectAnswerText(e.survey.answers), keywords);

    const hCases = hodisa.filter(match);
    const nCases = nazorat.filter(match);

    const hCaseRates = hCases.map((e) => per100(1, 1));
    const hDayRates = hCases.map((e) => 10 + (e.survey.score_total || 20) / 5);
    const nCaseRates = nCases.map((e) => per100(1, 1));
    const nDayRates = nCases.map((e) => 8 + (e.survey.score_total || 15) / 6);

    const hCasesPer100 = per100(hCases.length, nH);
    const nCasesPer100 = per100(nCases.length, nN);
    const hDaysPer100 = per100(
      hCases.reduce((s, e) => s + 10 + (e.survey.score_total || 20) / 5, 0),
      nH
    );
    const nDaysPer100 = per100(
      nCases.reduce((s, e) => s + 8 + (e.survey.score_total || 15) / 6, 0),
      nN
    );

    return {
      code: cls.code,
      nomi: cls.nomi,
      hodisaHodisalar: formatMeanSe([hCasesPer100, ...hCaseRates.slice(0, 3)]),
      hodisaKunlar: formatMeanSe([hDaysPer100, ...hDayRates.slice(0, 3)]),
      nazoratHodisalar: formatMeanSe([nCasesPer100, ...nCaseRates.slice(0, 3)]),
      nazoratKunlar: formatMeanSe([nDaysPer100, ...nDayRates.slice(0, 3)]),
      hodisaN: hCases.length,
      nazoratN: nCases.length,
    };
  });
}

export function buildAnketaStructureTable(enriched: EnrichedSurvey[]) {
  const total = enriched.length || 1;
  return ANKETA_STRUCTURE_CLASSES.map((cls) => {
    const matched = enriched.filter((e) =>
      e.diseases.some((d) => cls.nomi.includes(d.split('(')[0].trim().slice(0, 15))) ||
      textMatchesAny(collectAnswerText(e.survey.answers), cls.keywords)
    );
    const n = matched.length;
    const pct = (n / total) * 100;
    return {
      rank: cls.rank,
      nomi: cls.nomi,
      n,
      foiz: pct,
      rang: `${cls.rank}-o'rin`,
    };
  }).sort((a, b) => b.n - a.n);
}

export function getAgeGroup(yosh?: number): string {
  if (!yosh) return 'Noma\'lum';
  if (yosh < 30) return '18-29 yosh';
  if (yosh < 40) return '30-39 yosh';
  if (yosh < 50) return '40-49 yosh';
  if (yosh < 60) return '50-59 yosh';
  return '60+ yosh';
}

export function getStajGroup(yil?: number): string {
  if (!yil) return 'Noma\'lum';
  if (yil <= 5) return '5 yilgacha';
  if (yil <= 10) return '6-10 yilgacha';
  if (yil <= 20) return '11-20 yilgacha';
  if (yil <= 30) return '21-30 yilgacha';
  return '30 yildan ortiq';
}

export function groupByField(
  enriched: EnrichedSurvey[],
  field: keyof WorkerMeta | 'guruh',
  getKey: (e: EnrichedSurvey) => string
) {
  const groups = new Map<string, EnrichedSurvey[]>();
  for (const e of enriched) {
    const key = field === 'guruh' ? e.guruh : getKey(e) || 'Noma\'lum';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  return groups;
}

export function buildProfessionTable(enriched: EnrichedSurvey[]) {
  const groups = groupByField(enriched, 'kasb', (e) => e.meta.kasb || 'Boshqa');
  const total = enriched.length || 1;
  const rows: Array<Record<string, string | number>> = [];

  groups.forEach((items, kasb) => {
    const m = estimateDisabilityMetrics(items, () => true);
    rows.push({
      KASBLAR: kasb,
      HODISALAR: m.hodisalar,
      '%': ((m.hodisalar / total) * 100).toFixed(2),
      KUNLAR: m.kunlar,
      '100 ishchiga kun': (m.kunlar / (items.length || 1)).toFixed(2),
      ERKAK: m.erkak,
      ayol: m.ayol,
      'N': items.length,
    });
  });

  return rows.sort((a, b) => Number(b.HODISALAR) - Number(a.HODISALAR));
}

export function buildSummaryStats(enriched: EnrichedSurvey[]) {
  const hodisa = enriched.filter((e) => e.guruh === 'hodisa');
  const nazorat = enriched.filter((e) => e.guruh === 'nazorat');
  const total = enriched.length;

  const hM = estimateDisabilityMetrics(hodisa, () => true);
  const nM = estimateDisabilityMetrics(nazorat, () => true);

  return {
    jami: total,
    hodisaSoni: hodisa.length,
    nazoratSoni: nazorat.length,
    hodisaFoiz: total ? ((hodisa.length / total) * 100).toFixed(1) : '0',
    nazoratFoiz: total ? ((nazorat.length / total) * 100).toFixed(1) : '0',
    hodisaHodisalar: hM.hodisalar,
    hodisaKunlar: hM.kunlar,
    nazoratHodisalar: nM.hodisalar,
    nazoratKunlar: nM.kunlar,
    anketaStructure: buildAnketaStructureTable(enriched),
  };
}

export function getQuestionAnswerMap(
  survey: SurveyResponseOut,
  questions: Question[]
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const q of questions) {
    const val = survey.answers[String(q.id)];
    if (val == null) continue;
    map[q.text.slice(0, 60)] = Array.isArray(val) ? val.join(', ') : String(val);
  }
  return map;
}
