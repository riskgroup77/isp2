import type { QuestionnaireData, RiskAnalysisResult, UserProfile } from '../types';
import type { AIReport, ClinicalData } from '../types/api';
import { ageFromDate } from './formulaEngine';
import { APP_NAME } from './branding';

export function questionnaireToPredictRiskPayload(
  data: QuestionnaireData,
  user?: UserProfile | null
): Record<string, unknown> {
  return {
    tashkilot_nomi: user?.shifoxona || APP_NAME,
    sex: data.jins === 'erkak' ? 'Erkak' : 'Ayol',
    kasbi: data.tibbiyotXodimi ? 'Tibbiyot xodimi' : 'Korxona xodimi',
    sistolik: Number(data.sistolik),
    diastolik: Number(data.diastolik),
    vazn: Number(data.vazn),
    boy: Number(data.boy),
    glyukoza: data.glyukoza !== '' ? Number(data.glyukoza) : null,
    xolesterin: data.xolesterin !== '' ? Number(data.xolesterin) : null,
    yosh: Number(data.yosh),
    jins: data.jins,
    ism: user?.ism ?? null,
    answers: {
      tuzIstemi: data.tuzIstemi,
      shakarVaXamir: data.shakarVaXamir,
      sabzavotMeva: data.sabzavotMeva,
      jismoniyFaollik: data.jismoniyFaollik,
      chekish: data.chekish,
      nosvoy: data.nosvoy,
      oiladaKasallik: data.oiladaKasallik,
      tibbiyotXodimi: data.tibbiyotXodimi,
      nazariyBilimDarajasi: data.nazariyBilimDarajasi,
      realKomplayens: data.realKomplayens,
      shaharTuman: data.shaharTuman,
      erkinShikoyat: data.erkinShikoyat ?? '',
    },
  };
}

export function apiReportToRiskAnalysisResult(
  report: AIReport,
  fallbackBmi?: number | null
): RiskAnalysisResult {
  const shaxsiy = report.shaxsiyTavsiyalar || {};
  const tavsiyalar = report.xulosaVaTavsiyalar?.tavsiyalar || [];

  return {
    tmi: report.tmi ?? fallbackBmi ?? 0,
    tmiKategoriya: report.tmiKategoriya || '',
    riskFoizi: report.riskFoizi,
    zona: (report.zona as RiskAnalysisResult['zona']) || 'sariq',
    hududiyStatistika: {
      hududXavfi: report.riskFoizi,
      populyatsiyaEtalonBosim: report.statistika?.matn || '',
      tavsiyaEtilganSkriningKuni: '',
    },
    faktorlar: (report.faktorlar || []).map((f) => ({
      nomi: f.nomi,
      tafsilot: f.tafsilot,
      tasirKuchi: f.tasirKuchi,
      boshqariladimi: f.boshqariladimi,
    })),
    shaxsiyTavsiyalar: {
      kritikOmillar: [],
      ovqatlanish: shaxsiy.ovqatlanish ? [String(shaxsiy.ovqatlanish)] : [],
      jismoniyMashq: shaxsiy.jismoniyFaollik ? [String(shaxsiy.jismoniyFaollik)] : [],
      tibbiyReja: tavsiyalar,
      kutilayotganEffekt: [],
      komplayensTahlili: {
        daraja: '',
        nomutanosiblikKuzatildimi: false,
        maslahat: report.munozara || '',
      },
    },
    klinikXulosa: report.klinikXulosa || report.natijalar || '',
  };
}

function ans(answers: Record<string, unknown>, id: string): string {
  const v = answers[id];
  if (Array.isArray(v)) return v.map(String).join(', ');
  return v === null || v === undefined ? '' : String(v);
}

function low(s: string): string {
  return s.toLowerCase().replace(/[’`‘ʻ]/g, "'");
}

/**
 * Korporativ anketa javoblari + klinik bosqichdan natija sahifasi uchun
 * QuestionnaireData quradi — sahifada aynan shu xodimning ma'lumotlari ko'rinadi.
 */
export function surveyToQuestionnaireData(
  answers: Record<string, unknown>,
  clinical: ClinicalData | null | undefined,
  user?: UserProfile | null
): QuestionnaireData {
  const gender = low(ans(answers, '5'));
  const jins: QuestionnaireData['jins'] =
    gender === 'ayol' ? 'ayol' : gender === 'erkak' ? 'erkak' : user?.jins === 'ayol' ? 'ayol' : 'erkak';
  const yosh = ageFromDate(ans(answers, '3') || null) ?? user?.yosh ?? 0;

  const smoke = low(ans(answers, '51'));
  const chekish: QuestionnaireData['chekish'] = smoke.includes('hozirda')
    ? 'ha'
    : smoke.includes('ilgari')
      ? 'chekar_edi'
      : 'yoq';

  const salt = low(ans(answers, '69'));
  const tuzIstemi: QuestionnaireData['tuzIstemi'] = salt.includes("tatib ko'rmayman")
    ? 'yuqori'
    : salt.startsWith('ha')
      ? 'ortacha'
      : salt
        ? 'past'
        : 'ortacha';

  const sport = low(ans(answers, '52'));
  const jismoniyFaollik: QuestionnaireData['jismoniyFaollik'] = sport.startsWith('ha')
    ? 'ortacha'
    : sport
      ? 'kam'
      : 'ortacha';

  const fruit = low(ans(answers, '67'));
  const sabzavotMeva: QuestionnaireData['sabzavotMeva'] = fruit.includes('muntazam') || !fruit ? 'har_kuni' : 'kam_yoki_yoq';

  const bread = low(ans(answers, '68'));
  const shakarVaXamir: QuestionnaireData['shakarVaXamir'] = bread.includes('oq non') ? 'kop' : bread.includes('kepak') ? 'kam' : 'ortacha';

  const num = (v: unknown): number | null => {
    const n = Number(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const bp = ans(answers, '40').match(/(\d{2,3})\s*[/-]\s*(\d{2,3})/);

  const sex = ans(answers, '9') === 'Boshqa' && ans(answers, '9a') ? ans(answers, '9a') : ans(answers, '9');
  const kasb = ans(answers, '8') === 'Boshqa' && ans(answers, '8a') ? ans(answers, '8a') : ans(answers, '8');

  return {
    yosh,
    jins,
    boy: num(clinical?.boy) ?? user?.boy ?? 0,
    vazn: num(clinical?.vazn) ?? num(answers['4']) ?? user?.vazn ?? 0,
    sistolik: num(clinical?.sistolik) ?? (bp ? parseInt(bp[1], 10) : 0),
    diastolik: num(clinical?.diastolik) ?? (bp ? parseInt(bp[2], 10) : 0),
    glyukoza: num(clinical?.glyukoza) ?? '',
    xolesterin: num(clinical?.xolesterin) ?? '',
    tuzIstemi,
    shakarVaXamir,
    sabzavotMeva,
    jismoniyFaollik,
    chekish,
    nosvoy: 'yoq',
    oiladaKasallik: [],
    tibbiyotXodimi: false,
    nazariyBilimDarajasi: 'yaxshi',
    realKomplayens: 'ortacha',
    shaharTuman: '',
    erkinShikoyat: '',
    ism: user?.ism,
    tashkilot: ans(answers, '2') || undefined,
    sex: sex || undefined,
    kasb: kasb || undefined,
  };
}
