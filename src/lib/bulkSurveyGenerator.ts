import type { ClinicalData, Question, Questionnaire } from '../types/api';

export interface WorkerRow {
  row: number;
  ism: string;
  login: string;
  password: string;
  gender: 'Erkak' | 'Ayol';
  age: number;
  birth: string;
  staj: number;
  job: string;
  kasb: string;
  sex: string;
}

const DISEASE_DIST = [
  { key: 'has_resp', prob: 0.34, q43: 'Yuqori va quyi nafas organlari kasalliklari' },
  { key: 'has_msk', prob: 0.27, q43: 'Bel yoki bo\'g\'im og\'riqlari' },
  { key: 'has_cv', prob: 0.17, q43: 'Yurak-qon tomir tizimi kasalliklari' },
  { key: 'has_nerv', prob: 0.11, q43: 'Nerv sistemasi kasalliklari' },
];

function pick(options: string[], preferred: string[], rng: () => number): string {
  for (const p of preferred) {
    const found = options.find((o) => o.toLowerCase().includes(p.toLowerCase()));
    if (found) return found;
  }
  return options[Math.floor(rng() * options.length)] || '';
}

function multi(options: string[], values: string[]): string[] {
  const out = values.filter((v) => options.includes(v));
  return out.length ? out : options.slice(0, 1);
}

function isVisible(q: Question, answers: Record<string, unknown>): boolean {
  if (!q.showIf) return true;
  const ref = String(q.showIf.questionId);
  const value = answers[ref];
  if (q.showIf.equals !== undefined) {
    if (Array.isArray(value)) return value.includes(q.showIf.equals);
    return value === q.showIf.equals;
  }
  if (q.showIf.in) {
    const current = Array.isArray(value) ? value : value != null ? [value] : [];
    return q.showIf.in.some((v) => current.includes(v));
  }
  return true;
}

function mapSex(job: string, options: string[]): string {
  const l = job.toLowerCase();
  if (l.includes('qozon')) return options.find((o) => o.includes('Qozon')) || options[0];
  if (l.includes('turbina')) return options.find((o) => o.includes('Turbina')) || options[0];
  if (l.includes('elektr')) return options.find((o) => o.includes('Elektr')) || options[0];
  if (l.includes('osdt') || l.includes('skt')) return options.find((o) => o.includes('SKT')) || options[0];
  if (l.includes('kimyoviy')) return options.find((o) => o.includes('Kimyoviy')) || options[0];
  if (l.includes('gaz turbina')) return options.find((o) => o.includes('Gaz turbina')) || options[0];
  return options[0] || 'Boshqa';
}

function mapKasb(job: string, options: string[]): string {
  const l = job.toLowerCase();
  if (l.includes('chilangar')) return pick(options, ['Chilangar'], () => 0.5);
  if (l.includes('payvand')) return pick(options, ['Payvandchi'], () => 0.5);
  if (l.includes('elektrmont')) return pick(options, ['Elektromontyor'], () => 0.5);
  if (l.includes('laborant')) return pick(options, ['Laborant'], () => 0.5);
  if (l.includes('muhandis')) return pick(options, ['Texnik mutaxassis'], () => 0.5);
  return pick(options, ['Ishlab chiqarish ishchisi'], () => 0.5);
}

function mapStaj(years: number, options: string[]): string {
  if (years <= 1) return pick(options, ['Bir yildan kam'], () => 0.5);
  if (years <= 4) return pick(options, ['2 yildan 4'], () => 0.5);
  if (years <= 9) return pick(options, ['5 yildan 9'], () => 0.5);
  if (years <= 14) return pick(options, ['10 yildan 14'], () => 0.5);
  if (years <= 19) return pick(options, ['15 yildan 19'], () => 0.5);
  return pick(options, ['20 yil'], () => 0.5);
}

export function generateClinical(
  worker: WorkerRow,
  flags: Record<string, boolean>,
  rng: () => number
): ClinicalData {
  const erkak = worker.gender === 'Erkak';
  let sistolik = 118 + Math.floor(rng() * 20);
  if (flags.has_cv) sistolik = 135 + Math.floor(rng() * 25);
  const diastolik = Math.max(65, Math.round(sistolik * 0.65));
  return {
    sistolik,
    diastolik,
    vazn: erkak ? 70 + Math.floor(rng() * 20) : 58 + Math.floor(rng() * 18),
    boy: erkak ? 168 + Math.floor(rng() * 14) : 158 + Math.floor(rng() * 12),
    glyukoza: Math.round((4.8 + rng() * 1.5) * 10) / 10,
    xolesterin: Math.round((4.2 + rng() * 1.5) * 10) / 10,
  };
}

export function generateSurveyAnswers(
  questionnaire: Questionnaire,
  worker: WorkerRow,
  seed: number
): { answers: Record<string, unknown>; clinical: ClinicalData; flags: Record<string, boolean> } {
  let s = seed;
  const rng = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  const qmap = Object.fromEntries(questionnaire.questions.map((q) => [String(q.id), q]));
  const opt = (id: string, pref: string[]) => pick(qmap[id]?.options || [], pref, rng);
  const jobL = worker.job.toLowerCase();
  const noisy = /turbina|qozon|elektr|chang/.test(jobL);

  const flags: Record<string, boolean> = {
    has_resp: noisy || rng() < 0.34,
    has_msk: /chilangar|tokar|mashinist/.test(jobL) || rng() < 0.27,
    has_cv: worker.age > 40 || rng() < 0.17,
    has_nerv: rng() < 0.11,
  };
  const chronic = flags.has_cv || flags.has_resp || (worker.age > 45 && rng() < 0.5);
  const q43vals = DISEASE_DIST.filter((d) => flags[d.key as keyof typeof flags]).map((d) => d.q43);
  if (!q43vals.length) q43vals.push('Yuqori va quyi nafas organlari kasalliklari');

  const clinical = generateClinical(worker, flags, rng);
  const answers: Record<string, unknown> = {
    '1': 'Roziman',
    '2': "Farg'ona Issiqlik Elektr Stansiyasi",
    '3': worker.birth,
    '4': clinical.vazn,
    '5': worker.gender,
    '6': opt('6', ['Turmush qurgan']),
    '7': opt('7', ['Kasb-hunar', 'Oliy']),
    '8': mapKasb(worker.job, qmap['8']?.options || []),
    '9': mapSex(worker.job, qmap['9']?.options || []),
    '10': mapStaj(worker.staj, qmap['10']?.options || []),
    '11': multi(qmap['11']?.options || [], ['Smenali']),
    '12': opt('12', noisy ? ['Yuqori', "O'rtacha"] : ["O'rtacha"]),
    '13': opt('13', jobL.includes('qozon') ? ['Ha'] : ["Yo'q"]),
    '14': opt('14', ['Doim', "Ba'zan"]),
    '15': multi(qmap['15']?.options || [], noisy ? ['Shovqin', 'Chang'] : ['Jismoniy zo\'riqish']),
    '16': opt('16', ['Ma\'lum darajada']),
    '17': opt('17', ['Katta darajada']),
    '18': opt('18', ['Qoniqaman']),
    '19': opt('19', ['Ha, lekin ozgina', "Yo'q"]),
    '20': opt('20', flags.has_msk ? ['Ba\'zan', "Ko'pincha"] : ['Ba\'zan']),
    '21': opt('21', flags.has_nerv ? ['Ba\'zan'] : ["Umuman yo'q"]),
    '22': opt('22', ['Tik turish', "O'tirish"]),
    '23': opt('23', ['Ha']),
    '24': opt('24', noisy ? ['4-5 soat'] : ['2-3 soat']),
    '25': opt('25', ['Ha', "Yo'q"]),
    '26': opt('26', ['Ha', "Yo'q"]),
    '27': opt('27', flags.has_nerv ? ['Ha'] : ["Yo'q"]),
    '28': opt('28', flags.has_cv ? ['Ba\'zan', 'Ha'] : ["Yo'q"]),
    '29': opt('29', flags.has_nerv ? ['Ba\'zan'] : ["Yo'q"]),
    '30': opt('30', flags.has_resp ? ['Ba\'zan'] : ["Yo'q"]),
    '31': opt('31', flags.has_msk ? ['Ba\'zan'] : ["Yo'q"]),
    '32': opt('32', ["Yo'q"]),
    '33': opt('33', ["Yo'q"]),
    '34': multi(qmap['34']?.options || [], ['Oddiy suv']),
    '35': opt('35', ['2-2,5 litr']),
    '36': opt('36', chronic ? ["O'rtacha"] : ['Yaxshi']),
    '37': opt('37', ['Ha']),
    '38': opt('38', ['Ha']),
    '39': opt('39', ['Ha']),
    '40': `${clinical.sistolik}/${clinical.diastolik}`,
    '41': opt('41', ["Yo'q"]),
    '42': multi(
      qmap['42']?.options || [],
      chronic ? ['Nafas qisishi', 'Bel yoki bo\'g\'im og\'riqlari'] : ['Kuzatilmagan']
    ),
    '43': multi(qmap['43']?.options || [], q43vals.slice(0, 2)),
    '44': chronic ? 'Ha' : "Yo'q",
    '45': chronic ? pick(['1', '2', '3'], ['2'], rng) : '1',
    '46': opt('46', ['Qisman']),
    '47': opt('47', ["Yo'q"]),
    '48': opt('48', ["Yo'q"]),
    '50': opt('50', ['Ha']),
    '51': opt('51', worker.gender === 'Erkak' && rng() < 0.3 ? ['Hozirda chekaman'] : ['Hech qachon']),
    '52': opt('52', ["Yo'q, lekin xohlardim"]),
    '56': opt('56', ['Qisman']),
    '57': opt('57', noisy && chronic ? ['Ha'] : ["Yo'q"]),
    '58': opt('58', ['Qisman']),
    '59': opt('59', ['Ba\'zan']),
    '60': opt('60', ['Ha']),
    '61': multi(qmap['61']?.options || [], ['Tibbiyot xodimlarining hisoblari']),
    '62': opt('62', ['Kompaniya hududidagi']),
    '63': opt('63', ['vaqti-vaqti bilan']),
    '65': opt('65', ['3 marta']),
    '66': opt('66', ['Har kuni']),
    '67': opt('67', ['Muntazam ravishda']),
    '68': opt('68', ['Oq non']),
    '69': opt('69', ['tatib ko\'raman']),
    '70': opt('70', ['Yetarli miqdorda']),
    '71': multi(qmap['71']?.options || [], ['Muntazam tibbiy ko\'riklarni']),
  };

  if (answers['8'] === 'Boshqa') answers['8a'] = worker.kasb;
  if (answers['9'] === 'Boshqa') answers['9a'] = worker.sex;
  if (answers['44'] === 'Ha') answers['44a'] = q43vals.join(', ');

  const visible = Object.fromEntries(
    Object.entries(answers).filter(([k]) => {
      const q = qmap[k];
      return q && isVisible(q, answers);
    })
  );

  return { answers: visible, clinical, flags };
}

export function parseWorkersCsv(text: string): WorkerRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^\ufeff/, ''));
  const idx = (name: string) => headers.indexOf(name);

  return lines.slice(1).map((line, i) => {
    const cols = line.split(',');
    const ism = cols[idx('ism')] || '';
    const login = cols[idx('login')] || '';
    const password = cols[idx('password')] || '';
    return {
      row: i + 1,
      ism,
      login,
      password,
      gender: 'Erkak' as const,
      age: 40,
      birth: '1985-01-01',
      staj: 10,
      job: 'Xodim',
      kasb: ism.split(' ')[0] || 'Xodim',
      sex: 'Elektr sexi',
    };
  }).filter((w) => w.login && w.password);
}
