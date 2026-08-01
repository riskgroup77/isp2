import type { QuestionnaireData, RiskAnalysisResult, UserProfile } from '../types';
import type { AIReport } from '../types/api';

export function questionnaireToPredictRiskPayload(
  data: QuestionnaireData,
  user?: UserProfile | null
): Record<string, unknown> {
  return {
    tashkilot_nomi: user?.shifoxona || 'EnergoHealth Predict',
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
