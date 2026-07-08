export interface DiseaseType {
  id: string;
  nomi: string;
  tavsif: string;
  omillar: string[];
}

export interface DiseasePrognosis {
  kasallik: DiseaseType;
  xavfFoizi: number;
  zona: 'past' | 'ortacha' | 'yuqori' | 'juda_yuqori';
  prognoz: string;
  tavsiyalar: string[];
}

export const DISEASE_TYPES: DiseaseType[] = [
  {
    id: 'gipertoniya',
    nomi: 'Arterial gipertoniya',
    tavsif: 'Yuqori qon bosimi bilan bog\'liq kardiovaskulyar xavf',
    omillar: ['qon bosimi', 'tuz', 'stress', 'vazn'],
  },
  {
    id: 'diabet',
    nomi: 'Qandli diabet (2-tip)',
    tavsif: 'Insulin qarshiligi va glyukoza metabolizmi buzilishi',
    omillar: ['glyukoza', 'vazn', 'TMI', 'harakat'],
  },
  {
    id: 'yurak_ishemik',
    nomi: 'Yurak ishemik kasalligi',
    tavsif: 'Yurak qon tomirlarining torayishi va ishemiya',
    omillar: ['chekish', 'xolesterin', 'bosim', 'stress'],
  },
  {
    id: 'insult',
    nomi: 'Insult (miya infarkti)',
    tavsif: 'Miya qon aylanishining o\'tkir buzilishi xavfi',
    omillar: ['bosim', 'chekish', 'diabet', 'yosh'],
  },
  {
    id: 'ateroskleroz',
    nomi: 'Ateroskleroz',
    tavsif: 'Qon tomir devorida yog\'li plakalar shakllanishi',
    omillar: ['xolesterin', 'chekish', 'tuz', 'harakat'],
  },
  {
    id: 'yurak_yetishmovchiligi',
    nomi: 'Yurak yetishmovchiligi',
    tavsif: 'Yurakning qonni yetarli pompalay olmasligi',
    omillar: ['bosim', 'semizlik', 'faollik', 'uyqu'],
  },
];

export interface PrognosisInput {
  riskFoizi?: number;
  tmi?: number;
  sistolik?: number;
  diastolik?: number;
  glyukoza?: number;
  chekish?: boolean;
  yosh?: number;
  jins?: string;
  answers?: Record<string, unknown>;
}

function zonaFromPercent(p: number): DiseasePrognosis['zona'] {
  if (p < 20) return 'past';
  if (p < 45) return 'ortacha';
  if (p < 70) return 'yuqori';
  return 'juda_yuqori';
}

function zonaColor(z: DiseasePrognosis['zona']): string {
  const map = { past: '#22c55e', ortacha: '#eab308', yuqori: '#f97316', juda_yuqori: '#ef4444' };
  return map[z];
}

export { zonaColor };

export function computeDiseasePrognoses(input: PrognosisInput): DiseasePrognosis[] {
  const base = input.riskFoizi ?? 25;
  const tmi = input.tmi ?? 24;
  const sys = input.sistolik ?? 120;
  const dia = input.diastolik ?? 80;
  const gly = input.glyukoza ?? 5.0;
  const smokes =
    input.chekish ??
    String(input.answers?.['44'] ?? '').includes('Hozirda chekaman');
  const age = input.yosh ?? 40;

  return DISEASE_TYPES.map((kasallik) => {
    let score = base * 0.35;

    if (kasallik.id === 'gipertoniya') {
      if (sys >= 140 || dia >= 90) score += 35;
      else if (sys >= 130) score += 18;
      if (tmi >= 30) score += 12;
    }
    if (kasallik.id === 'diabet') {
      if (gly >= 7) score += 40;
      else if (gly >= 6.1) score += 22;
      if (tmi >= 28) score += 15;
    }
    if (kasallik.id === 'yurak_ishemik') {
      if (smokes) score += 20;
      if (sys >= 140) score += 15;
      if (age > 50) score += 10;
    }
    if (kasallik.id === 'insult') {
      if (sys >= 160) score += 30;
      if (smokes) score += 15;
      if (gly >= 6.1) score += 12;
      if (age > 55) score += 10;
    }
    if (kasallik.id === 'ateroskleroz') {
      if (smokes) score += 18;
      if (tmi >= 27) score += 12;
      if (age > 45) score += 8;
    }
    if (kasallik.id === 'yurak_yetishmovchiligi') {
      if (sys >= 140) score += 15;
      if (tmi >= 30) score += 18;
      score += base * 0.2;
    }

    const xavfFoizi = Math.min(99, Math.round(score));
    const zona = zonaFromPercent(xavfFoizi);

    const prognozMap: Record<string, string> = {
      past: `5 yil ichida ${kasallik.nomi.toLowerCase()} rivojlanish ehtimoli past.`,
      ortacha: `Profilaktika choralarisiz ${kasallik.nomi.toLowerCase()} xavfi o'rtacha darajada.`,
      yuqori: `${kasallik.nomi} rivojlanish xavfi yuqori — tibbiy nazorat tavsiya etiladi.`,
      juda_yuqori: `${kasallik.nomi} uchun juda yuqori xavf — shoshilinch shifokor ko'rigi kerak.`,
    };

    const tavsiyalar: string[] = [];
    if (zona === 'yuqori' || zona === 'juda_yuqori') {
      tavsiyalar.push('Mutaxassis shifokorga murojaat qiling');
      tavsiyalar.push('Har 3-6 oyda qayta skrining');
    }
    if (kasallik.id === 'gipertoniya') tavsiyalar.push('Kunlik qon bosimini kuzating');
    if (kasallik.id === 'diabet') tavsiyalar.push('Glyukoza va parhez nazorati');
    if (smokes) tavsiyalar.push('Tamaki iste\'molini to\'xtatish');

    return {
      kasallik,
      xavfFoizi,
      zona,
      prognoz: prognozMap[zona],
      tavsiyalar: [...new Set(tavsiyalar)],
    };
  });
}
