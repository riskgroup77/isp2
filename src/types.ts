export interface QuestionnaireData {
  yosh: number;
  jins: 'erkak' | 'ayol';
  boy: number; // cm
  vazn: number; // kg
  sistolik: number; // mmHg
  diastolik: number; // mmHg
  glyukoza: number | ''; // mmol/l
  xolesterin: number | ''; // mmol/l
  tuzIstemi: 'past' | 'ortacha' | 'yuqori';
  shakarVaXamir: 'kam' | 'ortacha' | 'kop';
  sabzavotMeva: 'har_kuni' | 'kam_yoki_yoq';
  jismoniyFaollik: 'kam' | 'ortacha' | 'yuqori';
  chekish: 'yoq' | 'chekar_edi' | 'ha';
  nosvoy: 'yoq' | 'ha';
  oiladaKasallik: string[]; // ['gipertoniya', 'diabet', 'yurak_xastaligi', 'insult']
  tibbiyotXodimi: boolean;
  nazariyBilimDarajasi: 'past' | 'yaxshi' | 'mukammal';
  realKomplayens: 'yaxshi' | 'ortacha' | 'past';
  shaharTuman: string; // Fergana Valley regions: Farg'ona shahri, Marg'ilon, Qo'qon, Quva, Rishton, Oltiariq, etc.
  erkinShikoyat?: string; // AI erkin shikoyat qismi
}

export interface FactorImportance {
  nomi: string;
  tafsilot: string;
  tasirKuchi: number; // 0 to 10
  boshqariladimi: boolean;
}

export interface RiskBenefit {
  ozgarish: string;
  kamayadiganXavf: number; // e.g. 12%
}

export interface RiskAnalysisResult {
  tmi: number;
  tmiKategoriya: string;
  riskFoizi: number; // 0 to 100
  zona: 'yashil' | 'sariq' | 'qizil';
  hududiyStatistika: {
    hududXavfi: number;
    populyatsiyaEtalonBosim: string;
    tavsiyaEtilganSkriningKuni: string;
  };
  faktorlar: FactorImportance[];
  shaxsiyTavsiyalar: {
    kritikOmillar: string[];
    ovqatlanish: string[];
    jismoniyMashq: string[];
    tibbiyReja: string[];
    kutilayotganEffekt: RiskBenefit[];
    komplayensTahlili: {
      daraja: string;
      nomutanosiblikKuzatildimi: boolean;
      maslahat: string;
    };
  };
  klinikXulosa: string;
}

export interface TextAnalysisResponse {
  muvaffaqiyatli: boolean;
  aniqlanganParametrlar: Partial<QuestionnaireData>;
  tahlilMatni: string;
  tavsiyalar: string[];
  yanaMalumotKerakmi: boolean;
  aniqlashtiruvchiSavollar: string[];
}

export interface HealthJournalEntry {
  id: string;
  sana: string; // FORMAT: "YYYY-MM-DD" or formatted
  vaqt: string; // FORMAT: "HH:MM"
  sistolik: number;
  diastolik: number;
  puls: number;
  glyukoza: number | '';
  vazn: number | '';
  uyqu: 'yaxshi' | 'ortacha' | 'yomon';
  stress: 'past' | 'ortacha' | 'yuqori';
  alomatlar: string[]; // ['ogriq', 'nafas_qisilishi', 'bosh_aylanishi', 'yurak_oynashi', 'shishlar', 'holsizlik']
  dorilar: { nomi: string; doza: string; ichildi: boolean }[];
  qaydlar: string;
  /** Kunlik yurilgan masofa (metr) */
  yurilganMetr?: number | '';
  /** Ichilgan suyuqlik (ml) */
  ichilganSuvMl?: number | '';
  /** Uxlash vaqti (soat) */
  uxquSoati?: number | '';
}

export type UserRole = 'admin' | 'shifokor' | 'xodim';
/** @deprecated Eski API — `xodim` ishlating */
export type LegacyUserRole = 'foydalanuvchi';

export interface CorporateSurvey {
  id: string;
  sana: string;
  // Section 1: Umumiy
  tashkilotNomi: string;
  yoshi: string;
  vazni: string;
  jins: 'erkak' | 'ayol';
  oilaviyHolat: 'turmush_qurmagan' | 'turmush_qurgan' | 'beva' | 'fuqarolik_nikohi' | 'ajrashgan';
  malumotDarajasi: 'boshlangich' | 'toliq_orta' | 'kasb_hunar' | 'oliy';
  kasbi: string;
  kasbiBoshqa?: string;
  sex: string;
  sexBoshqa?: string;
  ishStaji: '1_yildan_kam' | '2_to_4' | '5_to_9' | '10_to_14' | '15_to_19' | '20_va_katta';
  ishTartibi: 'kunduzgi' | 'smenali' | 'tungi';

  // Section 2: Mehnat sharoitlari
  shovqinDarajasi: 'past' | 'ortacha' | 'yuqori';
  yuqoriHarorat: 'ha' | 'yoq';
  himoyaVositalari: 'doim' | 'bazan' | 'umuman';
  tashvishlar: string[];
  yangiOrganish: 'juda_katta' | 'katta' | 'malum' | 'kichik' | 'juda_kichik';
  ishMuhimligi: 'juda_katta' | 'katta' | 'malum' | 'kichik' | 'juda_kichik';
  ishdanQoniqish: 'juda_qoniqaman' | 'qoniqardim' | 'qoniqarsiz' | 'juda_noroziman';
  ishSalbiyEnergiya: 'ha_malum' | 'ha_ozgina' | 'yoq';
  jismoniyCharchoq: 'doim' | 'kopincha' | 'bazan' | 'ozgina' | 'umuman_yoq';
  asabiylashish: 'doim' | 'kopincha' | 'bazan' | 'ozgina' | 'umuman_yoq';
  tikOyoqdaSoat: string;
  uyquOzgarishlar: string;
  yurakUrishiBoshAylanish: string;
  stressXavotirQorgu: string;
  quruqYotalNafasQisishi: string;
  mushaklarOgriq: string;
  quloqShangillashKoziXiralashish: string;
  ishtahaBogliqlik: string;

  // Section 3: Jismoniy salomatlik
  soglikBahosi: 'yaxshi' | 'ortacha' | 'yomon' | 'bilmayman';
  tibbiyKorikMuntazam: 'ha' | 'yoq' | 'bilmayman';
  profilaktikKorikIkkiYil: 'ha' | 'yoq' | 'bilmayman';
  qonBosiminiBiladimi: 'ha' | 'yoq';
  qonBosimiQiymati: string;
  grippEmlash: 'har_yili' | 'kamdan_kam' | 'yoq' | 'boshqa';
  songgiOltiOyHolatlar: string[];
  birYilKasalliklar: string[];
  birYilKasalliklarBoshqa?: string;
  surunkaliKasallik: 'ha' | 'yoq';
  surunkaliKasallikNomi?: string;
  ishSalbiySoglik: 'ha' | 'qisman' | 'yoq';
  sportZalFoydalanish: string;
  vaucherBerilishi: 'ha' | 'yoq';
  vaucherMoliyalashtirish?: 'to`liq_o`z_hisobidan' | 'to`liq_tashkilot_hisobidan' | 'qisman_o`z_hisobidan' | '';
  jamoaviyShartnomaQoniqish: 'ha' | 'yoq';

  // Section 4: Hayot tarzi
  tamakiFoydalanish: 'hech_qachon' | 'ilgari_chekkan' | 'hozir_chekadi';
  sportShugullanish: 'muntazam_yoki_vaqti_vaqti' | 'yoq_lekin_xohlardi' | 'yoq_va_xohlamasdi';
  sportShugullanmaslikSabablar: string[];
  sportTurlari: string[];
  sportTurlariBoshqa?: string;
  mashqTezligi: 'har_kuni' | 'haftada_bir_necha' | 'haftada_1_2' | 'dam_olish' | 'vaqti_vaqti' | 'mavsumiy' | 'boshqa' | '';

  // Section 5: Tibbiy xizmat, psixologik holat va profilaktika
  tibbiyYordamYetarliligi: 'ha' | 'qisman' | 'yoq';
  kasbgaBoglikKasallikAniqlanganmi: 'ha' | 'yoq';
  soglomTurmushImkoniyat: 'ha' | 'qisman' | 'yoq';
  ishStresslimi: 'ha' | 'bazan' | 'yoq';
  damOlishgaVaqt: 'ha' | 'yoq';

  // Section 6: Ovqatlanish
  ishKuniOziqlanish: 'uydan_olib_keladi' | 'oshxona_kafe' | 'uyda_nonushta_tushlik' | 'dokondan_sotib_oladi' | 'tushliksiz' | 'boshqa';
  oshxonagaTashrif: 'har_kuni' | 'vaqti_vaqti' | 'deyarli_bormaydi';
  oshxonagaBormaslikSabablar: string[];
  oshxonagaBormaslikSabablarBoshqa?: string;
  kunlikOziqlanishSoni: '2' | '3' | '4' | 'boshqa';
  nonTuri: 'qora' | 'oq' | 'kepakli';
  tuzQoshish: 'yoq' | 'tatib_korib_kam_bolsa' | 'tatib_kormay_qoshadi';
  kunlikSuvMiqdori: 'yetarli' | 'kam' | 'ota_kam' | 'kop';

  // Section 7: Takliflar
  sogliqniSaqlashTakliflar: string;
  sharoitYaxshilashTakliflar: string;
  sexBoshligiImzo: string;
}

export interface UserProfile {
  id: string;
  login: string;
  parol?: string;
  ism: string;
  rol: UserRole;
  jins?: 'erkak' | 'ayol';
  yosh?: number;
  created_at?: string;
  yaratilganSana: string;
  // Patient fields (xodim)
  shaharTuman?: string;
  boy?: number;
  vazn?: number;
  soglik_skrining_tarixi?: { riskResult: RiskAnalysisResult; data: QuestionnaireData; sana: string }[];
  corporate_surveys?: CorporateSurvey[];
  soglik_kundaligi?: HealthJournalEntry[];
  // Doctor fields (shifokor)
  mutaxassislik?: string;
  shifoxona?: string;
  tasdiqlangan?: boolean; // verified state
}

export interface PatientAdvice {
  id: string;
  bemorId: string;
  shifokorId: string;
  shifokorIsm: string;
  shifokorMutaxassislik: string;
  matn: string;
  sana: string;
  vaqt: string;
}

export interface MedicationAlarm {
  id: string;
  nomi: string;
  doza: string;
  vaqt: string; // "HH:MM" format
  faol: boolean;
  ichildiBugun: boolean;
  oxirgiIchilganSana?: string; // "YYYY-MM-DD" comparison
}


