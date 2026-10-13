/**
 * Ilmiy statistika funksiyalari (tashqi kutubxonasiz).
 * Taqsimot funksiyalari Numerical Recipes algoritmlari asosida.
 */

// ── Tavsifiy ──────────────────────────────────────────

export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function sd(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs) as number;
  return Math.sqrt(xs.reduce((acc, v) => acc + (v - m) ** 2, 0) / (xs.length - 1));
}

export function se(xs: number[]): number | null {
  const s = sd(xs);
  return s === null ? null : s / Math.sqrt(xs.length);
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Ulush uchun Wilson 95% ishonch oralig'i (foizda) */
export function wilsonCI(k: number, n: number, z = 1.96): [number, number] | null {
  if (n <= 0) return null;
  const p = k / n;
  const den = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return [Math.max(0, centre - half) * 100, Math.min(1, centre + half) * 100];
}

// ── Maxsus funksiyalar ────────────────────────────────

function lgamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp0 = x + 5.5;
  const tmp = tmp0 - (x + 0.5) * Math.log(tmp0);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300;
  const EPS = 3e-14;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularizatsiyalangan to'liqmas beta funksiya I_x(a, b) */
export function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Ikki tomonlama p, Student t taqsimoti */
export function tTwoSidedP(t: number, df: number): number {
  if (!Number.isFinite(t) || df <= 0) return NaN;
  return betai(df / 2, 0.5, df / (df + t * t));
}

/** erfc — Chebyshev yaqinlashuvi (nisbiy xato < 1.2e-7) */
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
    );
  return x >= 0 ? r : 2 - r;
}

/** χ² (df=1) uchun p */
export function chi2df1P(chi2: number): number {
  return erfc(Math.sqrt(Math.max(0, chi2) / 2));
}

// ── Testlar ───────────────────────────────────────────

export interface TestResult {
  test: string;
  stat: number | null;
  p: number | null;
}

/** Welch t-testi (dispersiyalar teng bo'lmasa ham to'g'ri) */
export function welchTTest(a: number[], b: number[]): TestResult {
  if (a.length < 2 || b.length < 2) return { test: 'Welch t', stat: null, p: null };
  const ma = mean(a) as number;
  const mb = mean(b) as number;
  const va = (sd(a) as number) ** 2 / a.length;
  const vb = (sd(b) as number) ** 2 / b.length;
  if (va + vb === 0) return { test: 'Welch t', stat: null, p: ma === mb ? 1 : 0 };
  const t = (ma - mb) / Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / ((va * va) / (a.length - 1) + (vb * vb) / (b.length - 1));
  return { test: 'Welch t', stat: t, p: tTwoSidedP(t, df) };
}

function logFact(n: number): number {
  return lgamma(n + 1);
}

/** Fisher aniq testi (2×2, ikki tomonlama) */
export function fisherExact(a: number, b: number, c: number, d: number): number {
  const r1 = a + b;
  const r2 = c + d;
  const c1 = a + c;
  const n = r1 + r2;
  const logDen = logFact(n) - logFact(r1) - logFact(r2) - logFact(c1) - logFact(n - c1);
  const prob = (x: number) => Math.exp(-(logDen + logFact(x) + logFact(r1 - x) + logFact(c1 - x) + logFact(r2 - c1 + x)));
  const pObs = prob(a);
  let p = 0;
  for (let x = Math.max(0, c1 - r2); x <= Math.min(r1, c1); x++) {
    const px = prob(x);
    if (px <= pObs * (1 + 1e-7)) p += px;
  }
  return Math.min(1, p);
}

/**
 * 2×2 jadval:  a = guruh1 & belgi bor, b = guruh1 & yo'q, c = guruh2 & bor, d = guruh2 & yo'q.
 * Kutilgan chastota < 5 bo'lsa Fisher, aks holda Pearson χ².
 */
export function test2x2(a: number, b: number, c: number, d: number): TestResult {
  const n = a + b + c + d;
  if (n === 0 || a + b === 0 || c + d === 0) return { test: '—', stat: null, p: null };
  const r1 = a + b;
  const r2 = c + d;
  const c1 = a + c;
  const c2 = b + d;
  if (c1 === 0 || c2 === 0) return { test: '—', stat: null, p: null };
  const minExp = Math.min(r1 * c1, r1 * c2, r2 * c1, r2 * c2) / n;
  if (minExp < 5) return { test: 'Fisher', stat: null, p: fisherExact(a, b, c, d) };
  const chi2 = (n * (a * d - b * c) ** 2) / (r1 * r2 * c1 * c2);
  return { test: 'χ²', stat: chi2, p: chi2df1P(chi2) };
}

/** Nisbatlar nisbati (OR) va 95% IO; nol katak bo'lsa Haldane–Anscombe (+0,5) */
export function oddsRatio(a: number, b: number, c: number, d: number): { or: number; lo: number; hi: number } | null {
  if (a + b === 0 || c + d === 0) return null;
  let [A, B, C, D] = [a, b, c, d];
  if (A === 0 || B === 0 || C === 0 || D === 0) {
    A += 0.5;
    B += 0.5;
    C += 0.5;
    D += 0.5;
  }
  const or = (A * D) / (B * C);
  const seLog = Math.sqrt(1 / A + 1 / B + 1 / C + 1 / D);
  return { or, lo: Math.exp(Math.log(or) - 1.96 * seLog), hi: Math.exp(Math.log(or) + 1.96 * seLog) };
}

// ── Formatlash ────────────────────────────────────────

export function fmt(n: number | null | undefined, digits = 1, comma = true): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const s = n.toFixed(digits);
  return comma ? s.replace('.', ',') : s;
}

export function fmtP(p: number | null | undefined, comma = true): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return '—';
  if (p < 0.001) return comma ? '<0,001' : '<0.001';
  return fmt(p, 3, comma);
}

export function fmtMeanSe(xs: number[], digits = 1, comma = true): string {
  const m = mean(xs);
  if (m === null) return '—';
  const s = se(xs);
  return s === null ? fmt(m, digits, comma) : `${fmt(m, digits, comma)} ± ${fmt(s, digits, comma)}`;
}

// ── Deterministik tasodifiy tanlash ───────────────────

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Qatlamlangan proporsional tanlama: har qatlamdan ulushiga mos son
 * (eng katta qoldiq usuli), qatlam ichida deterministik aralashtirish.
 */
export function stratifiedSample<T>(items: T[], n: number, stratum: (x: T) => string, seed = 400): T[] {
  if (n >= items.length) return [...items];
  const rnd = mulberry32(seed);
  const groups = new Map<string, T[]>();
  items.forEach((it) => {
    const k = stratum(it) || "Noma'lum";
    const g = groups.get(k);
    if (g) g.push(it);
    else groups.set(k, [it]);
  });
  const keys = [...groups.keys()].sort();
  const quotas = keys.map((k) => {
    const exact = ((groups.get(k) as T[]).length * n) / items.length;
    return { k, base: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let left = n - quotas.reduce((s, q) => s + q.base, 0);
  [...quotas]
    .sort((x, y) => y.frac - x.frac || x.k.localeCompare(y.k))
    .forEach((q) => {
      if (left > 0) {
        q.base += 1;
        left -= 1;
      }
    });
  const out: T[] = [];
  quotas.forEach((q) => {
    const arr = [...(groups.get(q.k) as T[])];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    out.push(...arr.slice(0, q.base));
  });
  return out;
}
