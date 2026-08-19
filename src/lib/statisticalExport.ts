import * as XLSX from 'xlsx';
import type { Question, SurveyResponseOut } from '../types/api';
import {
  buildAnketaStructureTable,
  buildIcdComparisonTable,
  buildProfessionTable,
  buildSummaryStats,
  enrichSurveys,
  getAgeGroup,
  getStajGroup,
  type WorkerMeta,
} from './anketaStatistics';
import { getRespondentName } from './surveyFilter';

function sheetFromRows(rows: Record<string, string | number>[], name: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  return { ws, name };
}

function sheetFromArray(rows: unknown[][], name: string) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  return { ws, name };
}

export function exportFullStatisticalExcel(
  surveys: SurveyResponseOut[],
  questions: Question[] = [],
  metaByUserId?: Record<string, WorkerMeta>,
  filename?: string
): void {
  if (!surveys.length) {
    throw new Error("Tahlil uchun so'rovnoma natijalari yo'q");
  }

  const enriched = enrichSurveys(surveys, metaByUserId);
  const summary = buildSummaryStats(enriched);
  const icdTable = buildIcdComparisonTable(enriched);
  const anketaTable = buildAnketaStructureTable(enriched);
  const professionTable = buildProfessionTable(enriched);

  const wb = XLSX.utils.book_new();

  // ── 1. Umumiy xulosa ──
  const xulosaRows = [
    ['EnergoHealth-Predict — Umumiy tahlil natijasi'],
    ['Sana', new Date().toLocaleDateString('uz-UZ')],
    ['Jami so\'rovnomalar', summary.jami],
    ['Hodisa guruhi (n)', summary.hodisaSoni],
    ['Hodisa guruhi (%)', summary.hodisaFoiz],
    ['Nazorat guruhi (n)', summary.nazoratSoni],
    ['Nazorat guruhi (%)', summary.nazoratFoiz],
    ['Hodisa — hodisalar soni', summary.hodisaHodisalar],
    ['Hodisa — kunlar soni', summary.hodisaKunlar],
    ['Nazorat — hodisalar soni', summary.nazoratHodisalar],
    ['Nazorat — kunlar soni', summary.nazoratKunlar],
    [],
    ['Anketa bo\'yicha kasallanishlar strukturasi (3-jadval)'],
    ['O\'rin', 'Kasallik guruhi', 'n', '%', 'Rang'],
    ...anketaTable.map((r) => [r.rank, r.nomi, r.n, r.foiz.toFixed(1), r.rang]),
    [],
    ['Jadval tahlili:'],
    [
      `So'ralgan tartib bo'yicha kasallanishlar iyerarxiyasida 1-o'rinni ${anketaTable[0]?.nomi?.split('(')[0]?.trim() || '—'} (${anketaTable[0]?.foiz.toFixed(1) || 0}%) egalladi.`,
    ],
  ];
  const s1 = sheetFromArray(xulosaRows, 'Umumiy xulosa');
  XLSX.utils.book_append_sheet(wb, s1.ws, s1.name);

  // ── 2. ICD kasallik sinflari — hodisa vs nazorat ──
  const icdRows = [
    [
      'Ishchilar kasalliklarining asosiy sinflari, vaqtincha mehnatga yaroqsizlik holatlari, kunlari (100 ta ishchiga) va kasallanish ulushlari (%)',
    ],
    [],
    ['Kasallik sinfi', 'Hodisa guruhi — hodisalar', 'Hodisa guruhi — kunlar', 'Nazorat guruhi — hodisalar', 'Nazorat guruhi — kunlar', 'Hodisa n', 'Nazorat n'],
    ...icdTable.map((r) => [
      `${r.code}. ${r.nomi}`,
      r.hodisaHodisalar,
      r.hodisaKunlar,
      r.nazoratHodisalar,
      r.nazoratKunlar,
      r.hodisaN,
      r.nazoratN,
    ]),
    [],
    ['Jami', summary.hodisaHodisalar, summary.hodisaKunlar, summary.nazoratHodisalar, summary.nazoratKunlar],
  ];
  const s2 = sheetFromArray(icdRows, 'Kasallik sinflari');
  XLSX.utils.book_append_sheet(wb, s2.ws, s2.name);

  // ── 3. Kasblar bo'yicha ──
  const s3 = sheetFromRows(professionTable as Record<string, string | number>[], 'Kasblar');
  XLSX.utils.book_append_sheet(wb, s3.ws, s3.name);

  // ── 4. Sexlar (bo'limlar) bo'yicha ──
  const sexMap = new Map<string, typeof enriched>();
  for (const e of enriched) {
    const key = e.meta.sex || 'Noma\'lum sex';
    if (!sexMap.has(key)) sexMap.set(key, []);
    sexMap.get(key)!.push(e);
  }
  const sexRows: Record<string, string | number>[] = [];
  sexMap.forEach((items, sex) => {
    const hod = items.reduce((s, e) => s + (e.diseases.length > 0 ? 1 : 0), 0);
    const kun = items.reduce((s, e) => s + e.diseases.length * 12, 0);
    sexRows.push({
      SEXLAR: sex,
      HODISALAR: hod,
      '%': ((hod / (items.length || 1)) * 100).toFixed(2),
      KUNLAR: kun,
      '100 ishchiga kun': (kun / (items.length || 1)).toFixed(2),
      N: items.length,
    });
  });
  const s4 = sheetFromRows(sexRows.sort((a, b) => Number(b.HODISALAR) - Number(a.HODISALAR)), 'Sexlar');
  XLSX.utils.book_append_sheet(wb, s4.ws, s4.name);

  // ── 5. Yosh guruhlari ──
  const ageMap = new Map<string, typeof enriched>();
  for (const e of enriched) {
    const key = getAgeGroup(e.meta.yosh);
    if (!ageMap.has(key)) ageMap.set(key, []);
    ageMap.get(key)!.push(e);
  }
  const ageRows: Record<string, string | number>[] = [];
  ageMap.forEach((items, g) => {
    ageRows.push({
      'Yosh guruhi': g,
      HODISALAR: items.filter((e) => e.diseases.length > 0).length,
      N: items.length,
      'O\'rtacha xavf %': (
        items.reduce((s, e) => s + (e.survey.score_total || e.survey.ai_response?.riskFoizi || 0), 0) /
        (items.length || 1)
      ).toFixed(1),
    });
  });
  const s5 = sheetFromRows(ageRows, 'Yosh guruhlari');
  XLSX.utils.book_append_sheet(wb, s5.ws, s5.name);

  // ── 6. Ish staji ──
  const stajMap = new Map<string, typeof enriched>();
  for (const e of enriched) {
    const key = getStajGroup(e.meta.ishStajiYil);
    if (!stajMap.has(key)) stajMap.set(key, []);
    stajMap.get(key)!.push(e);
  }
  const stajRows: Record<string, string | number>[] = [];
  stajMap.forEach((items, g) => {
    stajRows.push({
      'Ish staji': g,
      HODISALAR: items.filter((e) => e.diseases.length > 0).length,
      N: items.length,
    });
  });
  const s6 = sheetFromRows(stajRows, 'Ish staji');
  XLSX.utils.book_append_sheet(wb, s6.ws, s6.name);

  // ── 7. Hodisa / Nazorat taqqoslash ──
  const guruhRows = [
    ['Guruh', 'Soni', 'Hodisalar', 'Kunlar', 'Erkak', 'Ayol', 'O\'rtacha xavf %'],
    [
      'Hodisa guruhi',
      summary.hodisaSoni,
      summary.hodisaHodisalar,
      summary.hodisaKunlar,
      enriched.filter((e) => e.guruh === 'hodisa' && e.meta.jins !== 'ayol').length,
      enriched.filter((e) => e.guruh === 'hodisa' && e.meta.jins === 'ayol').length,
      (
        enriched
          .filter((e) => e.guruh === 'hodisa')
          .reduce((s, e) => s + (e.survey.score_total || 0), 0) / (summary.hodisaSoni || 1)
      ).toFixed(1),
    ],
    [
      'Nazorat guruhi',
      summary.nazoratSoni,
      summary.nazoratHodisalar,
      summary.nazoratKunlar,
      enriched.filter((e) => e.guruh === 'nazorat' && e.meta.jins !== 'ayol').length,
      enriched.filter((e) => e.guruh === 'nazorat' && e.meta.jins === 'ayol').length,
      (
        enriched
          .filter((e) => e.guruh === 'nazorat')
          .reduce((s, e) => s + (e.survey.score_total || 0), 0) / (summary.nazoratSoni || 1)
      ).toFixed(1),
    ],
  ];
  const s7 = sheetFromArray(guruhRows, 'Hodisa vs Nazorat');
  XLSX.utils.book_append_sheet(wb, s7.ws, s7.name);

  // ── 8. So'rovnomalar (kengaytirilgan) ──
  const surveyRows = enriched.map((e) => {
    const s = e.survey;
    const t = s.ai_response;
    return {
      'F.I.SH.': e.meta.ism || getRespondentName(s),
      Guruh: e.guruh,
      Kasb: e.meta.kasb || '',
      Sex: e.meta.sex || '',
      Yosh: e.meta.yosh ?? '',
      Jins: e.meta.jins || '',
      'Xavf %': t?.riskFoizi ?? s.score_total,
      Zona: s.risk_zonasi || t?.zona || '',
      TMI: t?.tmi ?? '',
      Kasalliklar: e.diseases.join('; '),
      'Klinik xulosa': (t?.klinikXulosa || s.klinik_xulosa || '').slice(0, 300),
      Sana: new Date(s.created_at).toLocaleString('uz-UZ'),
    };
  });
  const s8 = sheetFromRows(surveyRows, "So'rovnomalar");
  XLSX.utils.book_append_sheet(wb, s8.ws, s8.name);

  // ── 9. Javoblar (savol matni bilan) ──
  const qMap = new Map(questions.map((q) => [String(q.id), q.text]));
  const detailRows: Record<string, string | number>[] = [];
  enriched.forEach((e) => {
    Object.entries(e.survey.answers).forEach(([qId, ans]) => {
      const val = Array.isArray(ans) ? ans.join(', ') : String(ans ?? '');
      detailRows.push({
        'F.I.SH.': e.meta.ism || getRespondentName(e.survey),
        Guruh: e.guruh,
        'Savol ID': qId,
        Savol: (qMap.get(qId) || `#${qId}`).slice(0, 80),
        Javob: val,
      });
    });
  });
  if (detailRows.length) {
    const s9 = sheetFromRows(detailRows, 'Javoblar');
    XLSX.utils.book_append_sheet(wb, s9.ws, s9.name);
  }

  const fname =
    filename ||
    `EnergoHealth_To_liq_Tahlil_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fname);
}
