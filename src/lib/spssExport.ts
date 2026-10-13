/**
 * SPSS tizim fayli (.sav) yozuvchi — siqilmagan, UTF-8, little-endian.
 * O'zgaruvchi yorliqlari, qiymat yorliqlari (kodlangan javoblar),
 * uzun nomlar va o'lchov darajalari bilan.
 */
import type { Question } from '../types/api';
import { toNum, toStr, type Val } from './formulaEngine';
import type { ReportRow } from './reportBuilder';

type Measure = 'nominal' | 'ordinal' | 'scale';

interface SavVar {
  name: string; // ≤ 8 bayt, katta harf
  longName: string;
  label: string;
  type: 'num' | 'str';
  width: number; // satr uchun bayt kengligi
  decimals: number;
  measure: Measure;
  valueLabels?: [number, string][];
  values: (number | string | null)[];
}

const enc = new TextEncoder();
const SYSMIS = -Number.MAX_VALUE;

function utf8Trunc(s: string, maxBytes: number): Uint8Array {
  let b = enc.encode(s);
  if (b.length <= maxBytes) return b;
  let cut = maxBytes;
  // UTF-8 ko'p baytli belgini yarmidan kesmaslik
  while (cut > 0 && (b[cut] & 0xc0) === 0x80) cut--;
  b = b.slice(0, cut);
  return b;
}

class Writer {
  private chunks: Uint8Array[] = [];
  private len = 0;
  bytes(b: Uint8Array) {
    this.chunks.push(b);
    this.len += b.length;
  }
  i32(v: number) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setInt32(0, v, true);
    this.bytes(b);
  }
  f64(v: number) {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0, v, true);
    this.bytes(b);
  }
  /** Bo'shliq bilan to'ldirilgan qat'iy uzunlikdagi matn */
  fixed(s: string, n: number, pad = 0x20) {
    const b = new Uint8Array(n).fill(pad);
    b.set(utf8Trunc(s, n));
    this.bytes(b);
  }
  padded(b: Uint8Array, multiple: number) {
    const total = Math.ceil(b.length / multiple) * multiple;
    const out = new Uint8Array(total).fill(0x20);
    out.set(b);
    this.bytes(out);
  }
  result(): Uint8Array {
    const out = new Uint8Array(this.len);
    let o = 0;
    this.chunks.forEach((c) => {
      out.set(c, o);
      o += c.length;
    });
    return out;
  }
}

function segments(v: SavVar): number {
  return v.type === 'num' ? 1 : Math.ceil(v.width / 8);
}

function fmtCode(v: SavVar): number {
  if (v.type === 'str') return (1 << 16) | (v.width << 8);
  const w = Math.min(40, Math.max(8, v.decimals + 6));
  return (5 << 16) | (w << 8) | v.decimals;
}

export function writeSav(vars: SavVar[], nCases: number, fileLabel = ''): Uint8Array {
  const w = new Writer();
  const now = new Date();
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()];
  const p2 = (n: number) => String(n).padStart(2, '0');
  const caseSize = vars.reduce((s, v) => s + segments(v), 0);

  // Sarlavha (176 bayt)
  w.fixed('$FL2', 4);
  w.fixed('@(#) SPSS DATA FILE - DMKRMP portal', 60);
  w.i32(2);
  w.i32(caseSize);
  w.i32(0); // siqilmagan
  w.i32(0); // og'irlik yo'q
  w.i32(nCases);
  w.f64(100);
  w.fixed(`${p2(now.getDate())} ${mon} ${p2(now.getFullYear() % 100)}`, 9);
  w.fixed(`${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`, 8);
  w.fixed(fileLabel, 64);
  w.bytes(new Uint8Array(3));

  // O'zgaruvchilar (2-tur)
  const firstIndex: number[] = [];
  let idx = 1;
  vars.forEach((v) => {
    firstIndex.push(idx);
    const label = utf8Trunc(v.label, 255);
    w.i32(2);
    w.i32(v.type === 'num' ? 0 : v.width);
    w.i32(label.length ? 1 : 0);
    w.i32(0);
    const f = fmtCode(v);
    w.i32(f);
    w.i32(f);
    w.fixed(v.name, 8);
    if (label.length) {
      w.i32(label.length);
      w.padded(label, 4);
    }
    for (let k = 1; k < segments(v); k++) {
      w.i32(2);
      w.i32(-1);
      w.i32(0);
      w.i32(0);
      w.i32(0);
      w.i32(0);
      w.fixed('', 8);
    }
    idx += segments(v);
  });

  // Qiymat yorliqlari (3 + 4-tur)
  vars.forEach((v, vi) => {
    if (v.type !== 'num' || !v.valueLabels?.length) return;
    w.i32(3);
    w.i32(v.valueLabels.length);
    v.valueLabels.forEach(([val, lab]) => {
      w.f64(val);
      const lb = utf8Trunc(lab, 120);
      const block = new Uint8Array(Math.ceil((lb.length + 1) / 8) * 8).fill(0x20);
      block[0] = lb.length;
      block.set(lb, 1);
      w.bytes(block);
    });
    w.i32(4);
    w.i32(1);
    w.i32(firstIndex[vi]);
  });

  // 7.3 — mashina ma'lumoti (UTF-8 = 65001)
  w.i32(7);
  w.i32(3);
  w.i32(4);
  w.i32(8);
  [20, 0, 0, -1, 1, 1, 2, 65001].forEach((x) => w.i32(x));
  // 7.4 — maxsus qiymatlar
  w.i32(7);
  w.i32(4);
  w.i32(8);
  w.i32(3);
  w.f64(SYSMIS);
  w.f64(Number.MAX_VALUE);
  w.f64(-1.7976931348623155e308);
  // 7.11 — o'lchov darajasi, kenglik, tekislash
  w.i32(7);
  w.i32(11);
  w.i32(4);
  w.i32(vars.length * 3);
  vars.forEach((v) => {
    w.i32(v.measure === 'nominal' ? 1 : v.measure === 'ordinal' ? 2 : 3);
    w.i32(Math.min(40, Math.max(8, v.type === 'str' ? Math.min(v.width, 40) : 8)));
    w.i32(v.type === 'str' ? 0 : 1);
  });
  // 7.13 — uzun nomlar
  const ln = enc.encode(vars.map((v) => `${v.name}=${v.longName}`).join('\t'));
  w.i32(7);
  w.i32(13);
  w.i32(1);
  w.i32(ln.length);
  w.bytes(ln);
  // 7.20 — kodlash
  const ce = enc.encode('UTF-8');
  w.i32(7);
  w.i32(20);
  w.i32(1);
  w.i32(ce.length);
  w.bytes(ce);
  // Lug'at tugadi
  w.i32(999);
  w.i32(0);

  // Ma'lumotlar
  for (let c = 0; c < nCases; c++) {
    vars.forEach((v) => {
      const val = v.values[c];
      if (v.type === 'num') {
        w.f64(typeof val === 'number' && Number.isFinite(val) ? val : SYSMIS);
      } else {
        const b = new Uint8Array(segments(v) * 8).fill(0x20);
        b.set(utf8Trunc(val === null || val === undefined ? '' : String(val), v.width));
        w.bytes(b);
      }
    });
  }
  return w.result();
}

// ── Anketa javoblaridan SPSS o'zgaruvchilari ───────────

function normStr(s: string): string {
  return s.trim().toLowerCase().replace(/[’`‘ʻ]/g, "'");
}

function safeLong(name: string): string {
  const s = name.replace(/[^A-Za-z0-9_]/g, '_').replace(/^([^A-Za-z])/, 'V$1');
  return s.slice(0, 64);
}

export interface SpssGroup {
  name: string;
  label: string;
  /** survey.id → kod */
  codes: Map<string, number>;
  valueLabels: [number, string][];
}

export interface SpssOptions {
  includeNames?: boolean;
  group?: SpssGroup | null;
}

export function buildSpssVars(rows: ReportRow[], questions: Question[], opts: SpssOptions = {}): SavVar[] {
  const vars: SavVar[] = [];
  const used = new Set<string>();
  const short = (base: string) => {
    let s = base.toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/^([^A-Z])/, 'V$1').slice(0, 8);
    let i = 1;
    while (used.has(s)) {
      const suf = String(i++);
      s = `${s.slice(0, 8 - suf.length)}${suf}`;
    }
    used.add(s);
    return s;
  };
  const strVar = (name: string, label: string, vals: (string | null)[]): SavVar => ({
    name: short(name),
    longName: safeLong(name),
    label,
    type: 'str',
    width: Math.min(255, Math.max(1, ...vals.map((v) => enc.encode(v ?? '').length))),
    decimals: 0,
    measure: 'nominal',
    values: vals,
  });
  const numVar = (name: string, label: string, vals: (number | null)[], decimals = 0, measure: Measure = 'scale', valueLabels?: [number, string][]): SavVar => ({
    name: short(name),
    longName: safeLong(name),
    label,
    type: 'num',
    width: 8,
    decimals,
    measure,
    valueLabels,
    values: vals,
  });
  const ctx = (r: ReportRow, k: string): Val => r.ctx[k] ?? null;
  const num = (r: ReportRow, k: string) => toNum(ctx(r, k));

  vars.push(strVar('ID', 'Anketa ID', rows.map((r) => r.survey.id)));
  if (opts.includeNames) vars.push(strVar('FISH', 'F.I.SH.', rows.map((r) => toStr(ctx(r, 'ism')) || null)));
  vars.push(strVar('SANA', "To'ldirilgan sana", rows.map((r) => toStr(ctx(r, 'sana')) || null)));
  if (opts.group) {
    const g = opts.group;
    vars.push(numVar(g.name, g.label, rows.map((r) => g.codes.get(r.survey.id) ?? null), 0, 'nominal', g.valueLabels));
  }
  vars.push(numVar('YOSH', 'Yosh, yil', rows.map((r) => num(r, 'yosh'))));
  vars.push(
    numVar(
      'JINS',
      'Jins',
      rows.map((r) => {
        const j = normStr(toStr(ctx(r, 'jins')));
        return j === 'erkak' ? 1 : j === 'ayol' ? 2 : null;
      }),
      0,
      'nominal',
      [
        [1, 'Erkak'],
        [2, 'Ayol'],
      ]
    )
  );
  vars.push(numVar('VAZN', 'Tana vazni, kg', rows.map((r) => num(r, 'vazn')), 1));
  vars.push(numVar('BOY', "Bo'y, sm", rows.map((r) => num(r, 'boy')), 1));
  vars.push(numVar('TMI', 'Tana massasi indeksi, kg/m2', rows.map((r) => num(r, 'bmi')), 1));
  vars.push(numVar('SIS', 'Sistolik bosim, mm sim. ust.', rows.map((r) => num(r, 'sistolik'))));
  vars.push(numVar('DIA', 'Diastolik bosim, mm sim. ust.', rows.map((r) => num(r, 'diastolik'))));
  vars.push(numVar('GLYUK', 'Glyukoza, mmol/l', rows.map((r) => num(r, 'glyukoza')), 1));
  vars.push(numVar('XOLES', 'Xolesterin, mmol/l', rows.map((r) => num(r, 'xolesterin')), 1));
  vars.push(numVar('RISK', 'Kasbiy xavf, %', rows.map((r) => num(r, 'risk'))));
  const zones: [number, string][] = [
    [1, 'yashil'],
    [2, 'sariq'],
    [3, 'sargish'],
    [4, 'qizil'],
  ];
  vars.push(
    numVar(
      'ZONA',
      'Xavf zonasi',
      rows.map((r) => {
        const z = normStr(toStr(ctx(r, 'zona')));
        const f = zones.find(([, n]) => n === z);
        return f ? f[0] : null;
      }),
      0,
      'ordinal',
      zones
    )
  );

  questions.forEach((q) => {
    const key = `q${String(q.id).toLowerCase()}`;
    const qText = `${q.id}. ${q.text}`;
    const values = rows.map((r) => ctx(r, key));
    if (q.type === 'single_choice') {
      const opts2 = [...q.options];
      values.forEach((v) => {
        const s = toStr(v);
        if (s && !opts2.some((o) => normStr(o) === normStr(s))) opts2.push(s);
      });
      const labels: [number, string][] = opts2.map((o, i) => [i + 1, o]);
      vars.push(
        numVar(
          `Q${q.id}`,
          qText,
          values.map((v) => {
            const s = toStr(v);
            if (!s) return null;
            const i = opts2.findIndex((o) => normStr(o) === normStr(s));
            return i >= 0 ? i + 1 : null;
          }),
          0,
          'nominal',
          labels
        )
      );
    } else if (q.type === 'multi_choice') {
      q.options.forEach((o, i) => {
        vars.push(
          numVar(
            `Q${q.id}_${i + 1}`,
            `${q.id}. ${o}`,
            values.map((v) => {
              const arr = Array.isArray(v) ? v.map((x) => normStr(toStr(x))) : toStr(v) ? [normStr(toStr(v))] : null;
              if (!arr || !arr.length) return null;
              return arr.includes(normStr(o)) ? 1 : 0;
            }),
            0,
            'nominal',
            [
              [0, "Yo'q"],
              [1, 'Ha'],
            ]
          )
        );
      });
    } else if (q.type === 'number') {
      vars.push(numVar(`Q${q.id}`, qText, values.map((v) => toNum(v)), 1));
    } else {
      vars.push(strVar(`Q${q.id}`, qText, values.map((v) => toStr(v) || null)));
    }
  });
  return vars;
}

export function exportSpss(rows: ReportRow[], questions: Question[], filename: string, opts: SpssOptions = {}): void {
  const vars = buildSpssVars(rows, questions, opts);
  const bytes = writeSav(vars, rows.length, 'DMKRMP anketa natijalari');
  const blob = new Blob([bytes], { type: 'application/x-spss-sav' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
