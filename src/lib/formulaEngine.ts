/**
 * Xavfsiz formula dvigateli — admin hisobot konstruktori uchun.
 * `eval` ishlatilmaydi: matn tokenlarga bo'linadi, AST quriladi va
 * faqat ruxsat etilgan operatorlar/funksiyalar bajariladi.
 *
 * Qo'llab-quvvatlanadi:
 *   sonlar, "matn", o'zgaruvchilar (q5, risk, tmi ...), + - * / % ^,
 *   = == != <> < <= > >=, and or not (& | !), IF(...), funksiyalar.
 */

export type Val = number | string | boolean | null | Val[];
export type Ctx = Record<string, Val>;

// ── Tokenizer ─────────────────────────────────────────

type TokType = 'num' | 'str' | 'id' | 'op' | 'lp' | 'rp' | 'comma' | 'end';
interface Tok {
  t: TokType;
  v: string;
  pos: number;
}

const OPS = ['<=', '>=', '!=', '<>', '==', '&&', '||', '+', '-', '*', '/', '%', '^', '<', '>', '=', '&', '|', '!'];

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ t: 'num', v: src.slice(i, j), pos: i });
      i = j;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      let s = '';
      while (j < src.length && src[j] !== ch) {
        if (src[j] === '\\' && j + 1 < src.length) {
          s += src[j + 1];
          j += 2;
        } else {
          s += src[j];
          j++;
        }
      }
      if (j >= src.length) throw new FormulaError(`Yopilmagan matn (${i + 1}-belgi)`);
      out.push({ t: 'str', v: s, pos: i });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_Ѐ-ӿ]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_Ѐ-ӿ']/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j), pos: i });
      i = j;
      continue;
    }
    if (ch === '(') {
      out.push({ t: 'lp', v: ch, pos: i });
      i++;
      continue;
    }
    if (ch === ')') {
      out.push({ t: 'rp', v: ch, pos: i });
      i++;
      continue;
    }
    if (ch === ',' || ch === ';') {
      out.push({ t: 'comma', v: ',', pos: i });
      i++;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) {
      out.push({ t: 'op', v: op, pos: i });
      i += op.length;
      continue;
    }
    throw new FormulaError(`Noma'lum belgi "${ch}" (${i + 1}-o'rin)`);
  }
  out.push({ t: 'end', v: '', pos: src.length });
  return out;
}

// ── AST ───────────────────────────────────────────────

type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'null' }
  | { k: 'var'; name: string }
  | { k: 'un'; op: string; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'call'; fn: string; args: Node[] };

export class FormulaError extends Error {}

const PREC: Record<string, number> = {
  or: 1, '||': 1, '|': 1,
  and: 2, '&&': 2, '&': 2,
  '=': 4, '==': 4, '!=': 4, '<>': 4, '<': 4, '<=': 4, '>': 4, '>=': 4,
  '+': 5, '-': 5,
  '*': 6, '/': 6, '%': 6,
  '^': 8,
};

class Parser {
  private i = 0;
  constructor(private toks: Tok[]) {}

  private peek() {
    return this.toks[this.i];
  }
  private next() {
    return this.toks[this.i++];
  }

  parse(): Node {
    const n = this.expr(0);
    if (this.peek().t !== 'end') {
      throw new FormulaError(`Kutilmagan "${this.peek().v}" (${this.peek().pos + 1}-o'rin)`);
    }
    return n;
  }

  private expr(minPrec: number): Node {
    let left = this.unary();
    for (;;) {
      const tok = this.peek();
      let op: string | null = null;
      if (tok.t === 'op') op = tok.v;
      else if (tok.t === 'id' && ['and', 'or'].includes(tok.v.toLowerCase())) op = tok.v.toLowerCase();
      if (!op || PREC[op] === undefined || PREC[op] < minPrec) break;
      this.next();
      const prec = PREC[op];
      const right = op === '^' ? this.expr(prec) : this.expr(prec + 1);
      left = { k: 'bin', op, a: left, b: right };
    }
    return left;
  }

  private unary(): Node {
    const tok = this.peek();
    if (tok.t === 'op' && (tok.v === '-' || tok.v === '!')) {
      this.next();
      return { k: 'un', op: tok.v, a: this.unary() };
    }
    if (tok.t === 'op' && tok.v === '+') {
      this.next();
      return this.unary();
    }
    if (tok.t === 'id' && tok.v.toLowerCase() === 'not') {
      this.next();
      return { k: 'un', op: '!', a: this.expr(3) };
    }
    return this.primary();
  }

  private primary(): Node {
    const tok = this.next();
    if (tok.t === 'num') return { k: 'num', v: parseFloat(tok.v) };
    if (tok.t === 'str') return { k: 'str', v: tok.v };
    if (tok.t === 'lp') {
      const n = this.expr(0);
      if (this.next().t !== 'rp') throw new FormulaError('")" kutilgan edi');
      return n;
    }
    if (tok.t === 'id') {
      const low = tok.v.toLowerCase();
      if (low === 'true' || low === 'ha') return { k: 'bool', v: true };
      if (low === 'false') return { k: 'bool', v: false };
      if (low === 'null' || low === 'bosh') return { k: 'null' };
      if (this.peek().t === 'lp') {
        this.next();
        const args: Node[] = [];
        if (this.peek().t !== 'rp') {
          for (;;) {
            args.push(this.expr(0));
            if (this.peek().t === 'comma') {
              this.next();
              continue;
            }
            break;
          }
        }
        if (this.next().t !== 'rp') throw new FormulaError(`${tok.v}(...) yopilmagan`);
        return { k: 'call', fn: tok.v.toUpperCase(), args };
      }
      return { k: 'var', name: tok.v.toLowerCase() };
    }
    throw new FormulaError(tok.t === 'end' ? 'Formula tugallanmagan' : `Kutilmagan "${tok.v}"`);
  }
}

// ── Qiymat yordamchilari ──────────────────────────────

export function toNum(v: Val): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (Array.isArray(v)) return v.length;
  const s = String(v).trim().replace(',', '.');
  if (s === '') return null;
  const m = s.match(/^[-+]?\d*\.?\d+/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

export function toStr(v: Val): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(toStr).join(', ');
  if (typeof v === 'boolean') return v ? 'Ha' : "Yo'q";
  return String(v);
}

export function truthy(v: Val): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0 && !Number.isNaN(v);
  if (Array.isArray(v)) return v.length > 0;
  const s = String(v).trim().toLowerCase();
  return s !== '' && s !== '0' && s !== 'false' && s !== "yo'q" && s !== 'йўқ';
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[’`‘ʻ]/g, "'");
}

function eq(a: Val, b: Val): boolean {
  if (Array.isArray(a)) return a.some((x) => eq(x, b));
  if (Array.isArray(b)) return b.some((x) => eq(a, x));
  if (a === null || b === null) return a === b;
  if (typeof a === 'boolean' || typeof b === 'boolean') return truthy(a) === truthy(b);
  const na = toNum(a);
  const nb = toNum(b);
  if (typeof a === 'number' || typeof b === 'number') {
    if (na !== null && nb !== null) return na === nb;
  }
  return norm(toStr(a)) === norm(toStr(b));
}

function cmp(a: Val, b: Val): number | null {
  const na = toNum(a);
  const nb = toNum(b);
  if (na !== null && nb !== null && (typeof a !== 'string' || typeof b !== 'string' || (/^[-+]?\d/.test(String(a).trim()) && /^[-+]?\d/.test(String(b).trim())))) {
    return na === nb ? 0 : na < nb ? -1 : 1;
  }
  if (a === null || b === null) return null;
  const sa = norm(toStr(a));
  const sb = norm(toStr(b));
  return sa === sb ? 0 : sa < sb ? -1 : 1;
}

function parseDate(v: Val): Date | null {
  if (v === null || Array.isArray(v) || typeof v === 'boolean') return null;
  if (typeof v === 'number') return new Date(v);
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{4})$/);
  if (m) return new Date(+m[1], 0, 1);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function ageFromDate(v: Val, now = new Date()): number | null {
  const d = parseDate(v);
  if (!d) return null;
  let age = now.getFullYear() - d.getFullYear();
  const mDiff = now.getMonth() - d.getMonth();
  if (mDiff < 0 || (mDiff === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

// ── Funksiyalar ───────────────────────────────────────

type Fn = (args: Val[]) => Val;

function numFn(f: (...n: number[]) => number, minArgs = 1): Fn {
  return (args) => {
    const ns = args.map(toNum);
    if (ns.length < minArgs || ns.some((n) => n === null)) return null;
    const r = f(...(ns as number[]));
    return Number.isFinite(r) ? r : null;
  };
}

export const FUNCTIONS: Record<string, { fn: Fn; sig: string; desc: string }> = {
  IF: {
    fn: (a) => (truthy(a[0]) ? a[1] ?? null : a[2] ?? null),
    sig: 'IF(shart, agar_ha, agar_yoq)',
    desc: "Shart bajarilsa ikkinchi, aks holda uchinchi qiymat",
  },
  AND: { fn: (a) => a.every(truthy), sig: 'AND(a, b, ...)', desc: 'Hammasi rost bo\'lsa' },
  OR: { fn: (a) => a.some(truthy), sig: 'OR(a, b, ...)', desc: 'Birortasi rost bo\'lsa' },
  NOT: { fn: (a) => !truthy(a[0]), sig: 'NOT(a)', desc: 'Inkor' },
  ISEMPTY: {
    fn: (a) => a[0] === null || a[0] === undefined || toStr(a[0]).trim() === '',
    sig: 'ISEMPTY(x)',
    desc: "Javob bo'sh bo'lsa rost",
  },
  COALESCE: {
    fn: (a) => a.find((v) => v !== null && v !== undefined && toStr(v).trim() !== '') ?? null,
    sig: 'COALESCE(a, b, ...)',
    desc: "Birinchi bo'sh bo'lmagan qiymat",
  },
  NUM: { fn: (a) => toNum(a[0]), sig: 'NUM(x)', desc: 'Matndan son ajratadi ("140/90" → 140)' },
  STR: { fn: (a) => toStr(a[0]), sig: 'STR(x)', desc: 'Matnga aylantiradi' },
  ABS: { fn: numFn(Math.abs), sig: 'ABS(x)', desc: 'Modul' },
  ROUND: {
    fn: (a) => {
      const n = toNum(a[0]);
      const d = toNum(a[1] ?? 0) ?? 0;
      if (n === null) return null;
      const f = 10 ** d;
      return Math.round(n * f) / f;
    },
    sig: 'ROUND(x, raqamlar)',
    desc: 'Yaxlitlash',
  },
  FLOOR: { fn: numFn(Math.floor), sig: 'FLOOR(x)', desc: 'Pastga yaxlitlash' },
  CEIL: { fn: numFn(Math.ceil), sig: 'CEIL(x)', desc: 'Yuqoriga yaxlitlash' },
  SQRT: { fn: numFn(Math.sqrt), sig: 'SQRT(x)', desc: 'Kvadrat ildiz' },
  POW: { fn: numFn(Math.pow, 2), sig: 'POW(x, y)', desc: 'Daraja' },
  LN: { fn: numFn(Math.log), sig: 'LN(x)', desc: 'Natural logarifm' },
  LOG10: { fn: numFn(Math.log10), sig: 'LOG10(x)', desc: "O'nlik logarifm" },
  EXP: { fn: numFn(Math.exp), sig: 'EXP(x)', desc: 'e^x' },
  MIN: {
    fn: (a) => {
      const ns = a.flat().map(toNum).filter((n): n is number => n !== null);
      return ns.length ? Math.min(...ns) : null;
    },
    sig: 'MIN(a, b, ...)',
    desc: 'Eng kichigi',
  },
  MAX: {
    fn: (a) => {
      const ns = a.flat().map(toNum).filter((n): n is number => n !== null);
      return ns.length ? Math.max(...ns) : null;
    },
    sig: 'MAX(a, b, ...)',
    desc: 'Eng kattasi',
  },
  LEN: {
    fn: (a) => (Array.isArray(a[0]) ? a[0].length : toStr(a[0]).length),
    sig: 'LEN(x)',
    desc: "Matn uzunligi yoki tanlangan variantlar soni",
  },
  UPPER: { fn: (a) => toStr(a[0]).toUpperCase(), sig: 'UPPER(x)', desc: 'Katta harf' },
  LOWER: { fn: (a) => toStr(a[0]).toLowerCase(), sig: 'LOWER(x)', desc: 'Kichik harf' },
  CONTAINS: {
    fn: (a) => norm(toStr(a[0])).includes(norm(toStr(a[1]))),
    sig: 'CONTAINS(matn, qism)',
    desc: "Matn ichida qism bor-yo'qligi (katta-kichik harf farqlanmaydi)",
  },
  INCLUDES: {
    fn: (a) => eq(a[0], a[1]),
    sig: 'INCLUDES(javob, variant)',
    desc: "Ko'p tanlovli javobda variant borligi",
  },
  IN: {
    fn: (a) => a.slice(1).some((v) => eq(a[0], v)),
    sig: 'IN(x, "a", "b", ...)',
    desc: "x ro'yxatdagilardan biriga tengmi",
  },
  COUNTOF: {
    fn: (a) => (Array.isArray(a[0]) ? a[0].length : a[0] === null || toStr(a[0]) === '' ? 0 : 1),
    sig: 'COUNTOF(javob)',
    desc: "Tanlangan variantlar soni",
  },
  YEAR: {
    fn: (a) => {
      const d = parseDate(a[0]);
      return d ? d.getFullYear() : null;
    },
    sig: 'YEAR(sana)',
    desc: 'Sanadan yil',
  },
  MONTH: {
    fn: (a) => {
      const d = parseDate(a[0]);
      return d ? d.getMonth() + 1 : null;
    },
    sig: 'MONTH(sana)',
    desc: 'Sanadan oy',
  },
  AGE: { fn: (a) => ageFromDate(a[0]), sig: 'AGE(tugilgan_sana)', desc: "Tug'ilgan sanadan yosh (to'liq yil)" },
  BMI: {
    fn: (a) => {
      const w = toNum(a[0]);
      const h = toNum(a[1]);
      if (w === null || h === null || h <= 0) return null;
      const m = h > 3 ? h / 100 : h;
      return Math.round((w / (m * m)) * 10) / 10;
    },
    sig: 'BMI(vazn_kg, boy_sm)',
    desc: 'Tana massasi indeksi',
  },
  SYS: {
    fn: (a) => toNum(a[0]),
    sig: 'SYS("140/90")',
    desc: 'Qon bosimi matnidan sistolik',
  },
  DIA: {
    fn: (a) => {
      const m = toStr(a[0]).match(/(\d{2,3})\s*[/\\-]\s*(\d{2,3})/);
      return m ? parseInt(m[2], 10) : null;
    },
    sig: 'DIA("140/90")',
    desc: 'Qon bosimi matnidan diastolik',
  },
  BUCKET: {
    fn: (a) => {
      const n = toNum(a[0]);
      if (n === null) return null;
      const bounds = a.slice(1).map(toNum).filter((x): x is number => x !== null);
      let idx = 0;
      for (const b of bounds) {
        if (n >= b) idx++;
        else break;
      }
      const lo = idx === 0 ? null : bounds[idx - 1];
      const hi = idx < bounds.length ? bounds[idx] : null;
      if (lo === null) return `< ${hi}`;
      if (hi === null) return `≥ ${lo}`;
      return `${lo}–${hi - 1 >= lo ? hi - 1 : hi}`;
    },
    sig: 'BUCKET(x, 30, 45, 60)',
    desc: 'Sonni oraliqlarga ajratadi ("< 30", "30–44", "45–59", "≥ 60")',
  },
  ZONE: {
    fn: (a) => {
      const n = toNum(a[0]);
      if (n === null) return null;
      if (n >= 70) return 'qizil';
      if (n >= 50) return 'sargish';
      if (n >= 30) return 'sariq';
      return 'yashil';
    },
    sig: 'ZONE(risk_foiz)',
    desc: 'Xavf foizidan zona nomi',
  },
};

// ── Baholash ──────────────────────────────────────────

function evalNode(n: Node, ctx: Ctx): Val {
  switch (n.k) {
    case 'num':
      return n.v;
    case 'str':
      return n.v;
    case 'bool':
      return n.v;
    case 'null':
      return null;
    case 'var': {
      const v = ctx[n.name];
      return v === undefined ? null : v;
    }
    case 'un': {
      const a = evalNode(n.a, ctx);
      if (n.op === '-') {
        const x = toNum(a);
        return x === null ? null : -x;
      }
      return !truthy(a);
    }
    case 'call': {
      const f = FUNCTIONS[n.fn];
      if (!f) throw new FormulaError(`Noma'lum funksiya: ${n.fn}`);
      return f.fn(n.args.map((x) => evalNode(x, ctx)));
    }
    case 'bin': {
      const op = n.op;
      if (op === 'and' || op === '&&' || op === '&') {
        return truthy(evalNode(n.a, ctx)) && truthy(evalNode(n.b, ctx));
      }
      if (op === 'or' || op === '||' || op === '|') {
        return truthy(evalNode(n.a, ctx)) || truthy(evalNode(n.b, ctx));
      }
      const a = evalNode(n.a, ctx);
      const b = evalNode(n.b, ctx);
      switch (op) {
        case '=':
        case '==':
          return eq(a, b);
        case '!=':
        case '<>':
          return !eq(a, b);
        case '<':
        case '<=':
        case '>':
        case '>=': {
          const c = cmp(a, b);
          if (c === null) return false;
          if (op === '<') return c < 0;
          if (op === '<=') return c <= 0;
          if (op === '>') return c > 0;
          return c >= 0;
        }
        case '+': {
          if (typeof a === 'string' && toNum(a) === null) return toStr(a) + toStr(b);
          if (typeof b === 'string' && toNum(b) === null) return toStr(a) + toStr(b);
          const x = toNum(a);
          const y = toNum(b);
          return x === null || y === null ? null : x + y;
        }
        case '-':
        case '*':
        case '/':
        case '%':
        case '^': {
          const x = toNum(a);
          const y = toNum(b);
          if (x === null || y === null) return null;
          if (op === '-') return x - y;
          if (op === '*') return x * y;
          if (op === '/') return y === 0 ? null : x / y;
          if (op === '%') return y === 0 ? null : x % y;
          const r = Math.pow(x, y);
          return Number.isFinite(r) ? r : null;
        }
      }
      throw new FormulaError(`Noma'lum operator: ${op}`);
    }
  }
}

function collectVars(n: Node, out: Set<string>) {
  switch (n.k) {
    case 'var':
      out.add(n.name);
      break;
    case 'un':
      collectVars(n.a, out);
      break;
    case 'bin':
      collectVars(n.a, out);
      collectVars(n.b, out);
      break;
    case 'call':
      if (!FUNCTIONS[n.fn]) throw new FormulaError(`Noma'lum funksiya: ${n.fn}`);
      n.args.forEach((a) => collectVars(a, out));
      break;
    default:
      break;
  }
}

export interface CompiledFormula {
  source: string;
  vars: string[];
  eval: (ctx: Ctx) => Val;
}

/**
 * Formulani kompilyatsiya qiladi. `knownVars` berilsa, noma'lum o'zgaruvchi
 * uchun xato qaytaradi (xato yozilgan savol ID'larini erta ushlash uchun).
 */
export function compileFormula(src: string, knownVars?: Set<string>): CompiledFormula {
  const trimmed = src.trim();
  if (!trimmed) throw new FormulaError("Formula bo'sh");
  const ast = new Parser(tokenize(trimmed)).parse();
  const vars = new Set<string>();
  collectVars(ast, vars);
  if (knownVars) {
    const unknown = [...vars].filter((v) => !knownVars.has(v));
    if (unknown.length) {
      throw new FormulaError(`Noma'lum o'zgaruvchi: ${unknown.join(', ')}`);
    }
  }
  return {
    source: trimmed,
    vars: [...vars],
    eval: (ctx) => evalNode(ast, ctx),
  };
}

export function validateFormula(src: string, knownVars?: Set<string>): string | null {
  try {
    compileFormula(src, knownVars);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
