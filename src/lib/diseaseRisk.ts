/**
 * Kasallik risk prognozlari — har bir kasallik bo'yicha xavf indeksi.
 *
 * Usul ("АНКЕТА СТАТИСТИКА", 1-band — ballar yordamida baholash):
 * har bir xavf omili 0 / 1 / 2 ball bilan kodlanadi (yo'q / o'rtacha / kuchli),
 *   Indeks = Σ ball / (2 × ma'lumoti bor omillar soni) × 100%.
 * Ma'lumoti yo'q omil hisobga olinmaydi (suratdan ham, maxrajdan ham chiqariladi)
 * va "ma'lumot yo'q" deb ko'rsatiladi. Indeks — omillar yig'indisining ulushi,
 * kasallik yuzaga kelish ehtimoli emas.
 */
import type { Evidence, Level, LevelKey } from './riskEvidence';

export interface DiseaseType {
  id: string;
  nomi: string;
  tavsif: string;
  omillar: { key: LevelKey; label: string }[];
}

export interface FactorScore {
  key: LevelKey;
  label: string;
  ball: Level | null;
  dalil: string;
}

export interface DiseasePrognosis {
  kasallik: DiseaseType;
  /** null — ma'lumot yetarli emas */
  xavfFoizi: number | null;
  zona: 'past' | 'ortacha' | 'yuqori' | 'juda_yuqori' | null;
  prognoz: string;
  tavsiyalar: string[];
  omillar: FactorScore[];
  yigindi: number;
  maksimal: number;
  formula: string;
}

const L = {
  bosim: 'Arterial qon bosimi',
  tvi: 'Tana vazni indeksi',
  glyukoza: 'Glyukoza',
  xolesterin: 'Umumiy xolesterin',
  chekish: 'Chekish',
  gipodinamiya: 'Gipodinamiya',
  ovqatlanish: "Noto'g'ri ovqatlanish",
  stress: 'Psixoemotsional stress',
  tuz: "Ovqatga tuz qo'shish",
  yosh: 'Yosh',
  meva: 'Meva-sabzavot kamligi',
  uyqu: 'Uyqu buzilishi',
  yurak_simptom: 'Yurak urishi / nafas yetishmasligi',
} satisfies Record<LevelKey, string>;

const f = (...keys: LevelKey[]) => keys.map((key) => ({ key, label: L[key] }));

export const DISEASE_TYPES: DiseaseType[] = [
  {
    id: 'gipertoniya',
    nomi: 'Arterial gipertoniya',
    tavsif: "Yuqori qon bosimi bilan bog'liq kardiovaskulyar xavf",
    omillar: f('bosim', 'tvi', 'tuz', 'stress', 'gipodinamiya', 'yosh', 'chekish'),
  },
  {
    id: 'diabet',
    nomi: 'Qandli diabet (2-tip)',
    tavsif: 'Insulin qarshiligi va glyukoza metabolizmi buzilishi',
    omillar: f('glyukoza', 'tvi', 'gipodinamiya', 'meva', 'ovqatlanish', 'yosh'),
  },
  {
    id: 'yurak_ishemik',
    nomi: 'Yurak ishemik kasalligi',
    tavsif: "Yurak qon tomirlarining torayishi va ishemiya",
    omillar: f('chekish', 'xolesterin', 'bosim', 'stress', 'yosh', 'tvi', 'glyukoza'),
  },
  {
    id: 'insult',
    nomi: 'Insult (miya qon aylanishi buzilishi)',
    tavsif: "Miya qon aylanishining o'tkir buzilishi xavfi",
    omillar: f('bosim', 'chekish', 'glyukoza', 'yosh', 'xolesterin'),
  },
  {
    id: 'ateroskleroz',
    nomi: 'Ateroskleroz',
    tavsif: "Qon tomir devorida yog'li plakalar shakllanishi",
    omillar: f('xolesterin', 'chekish', 'tuz', 'gipodinamiya', 'yosh', 'tvi'),
  },
  {
    id: 'yurak_yetishmovchiligi',
    nomi: 'Yurak yetishmovchiligi',
    tavsif: 'Yurakning qonni yetarli haydab bera olmasligi',
    omillar: f('bosim', 'tvi', 'gipodinamiya', 'uyqu', 'yurak_simptom'),
  },
];

/** Indeks hisoblanishi uchun kamida shuncha omil bo'yicha ma'lumot kerak */
export const MIN_KNOWN_FACTORS = 3;

export function zonaFromPercent(p: number): NonNullable<DiseasePrognosis['zona']> {
  if (p < 20) return 'past';
  if (p < 45) return 'ortacha';
  if (p < 70) return 'yuqori';
  return 'juda_yuqori';
}

export function zonaColor(z: DiseasePrognosis['zona']): string {
  if (!z) return '#64748b';
  const map = { past: '#16a34a', ortacha: '#ca8a04', yuqori: '#ea580c', juda_yuqori: '#dc2626' };
  return map[z];
}

export function computeDiseasePrognoses(ev: Evidence): DiseasePrognosis[] {
  return DISEASE_TYPES.map((kasallik) => {
    const omillar: FactorScore[] = kasallik.omillar.map((o) => ({
      key: o.key,
      label: o.label,
      ball: ev.levels[o.key],
      dalil: ev.levelEvidence[o.key],
    }));
    const known = omillar.filter((o) => o.ball !== null);
    const yigindi = known.reduce((s, o) => s + (o.ball as number), 0);
    const maksimal = known.length * 2;
    const nomi = kasallik.nomi.toLowerCase();

    if (known.length < MIN_KNOWN_FACTORS) {
      return {
        kasallik,
        xavfFoizi: null,
        zona: null,
        prognoz: `Hisoblanmadi: ${kasallik.omillar.length} ta omildan ${known.length} tasi bo'yicha ma'lumot bor (kamida ${MIN_KNOWN_FACTORS} ta kerak).`,
        tavsiyalar: ['Klinik bosqichda qon bosimi, vazn, bo\'y va glyukozani kiriting'],
        omillar,
        yigindi,
        maksimal,
        formula: '—',
      };
    }

    const exact = (yigindi / maksimal) * 100;
    const xavfFoizi = Math.round(exact);
    const zona = zonaFromPercent(xavfFoizi);
    const formula = `${known.map((o) => o.ball).join(' + ')} = ${yigindi};  ${yigindi} / (2 × ${known.length}) × 100% = ${yigindi} / ${maksimal} × 100% = ${exact.toFixed(1).replace('.', ',')}% ≈ ${xavfFoizi}%`;

    const prognozMap: Record<NonNullable<DiseasePrognosis['zona']>, string> = {
      past: `${kasallik.nomi} bo'yicha xavf omillari kam ifodalangan.`,
      ortacha: `Profilaktika choralarisiz ${nomi} xavfi o'rtacha darajada.`,
      yuqori: `${kasallik.nomi} xavf omillari ko'p — tibbiy nazorat tavsiya etiladi.`,
      juda_yuqori: `${kasallik.nomi} xavf omillari juda ko'p — shifokor ko'rigi kerak.`,
    };

    const tavsiyalar: string[] = [];
    if (zona === 'yuqori' || zona === 'juda_yuqori') {
      tavsiyalar.push('Mutaxassis shifokorga murojaat qiling');
      tavsiyalar.push('Har 3–6 oyda qayta skrining');
    }
    if (kasallik.id === 'gipertoniya') tavsiyalar.push('Qon bosimini muntazam o\'lchang');
    if (kasallik.id === 'diabet') tavsiyalar.push('Glyukoza va parhez nazorati');
    if ((ev.levels.chekish ?? 0) === 2) tavsiyalar.push("Tamaki iste'molini to'xtatish");
    if ((ev.levels.gipodinamiya ?? 0) === 2) tavsiyalar.push("Haftasiga kamida 150 daqiqa o'rtacha jismoniy faollik");

    return {
      kasallik,
      xavfFoizi,
      zona,
      prognoz: prognozMap[zona],
      tavsiyalar: [...new Set(tavsiyalar)],
      omillar,
      yigindi,
      maksimal,
      formula,
    };
  });
}
