/**
 * Mustaqil SVG diagramma chizuvchi: ekranda, PNG'da va Word'da bir xil rasm.
 * Uslub: ingichka belgilar, 4px yumaloq uch, soch tolasidek panjara,
 * matn hech qachon seriya rangida emas (dataviz qoidalari).
 */

export type ChartKind = 'bar' | 'hbar' | 'line' | 'pie';

export interface ChartSeries {
  label: string;
  values: (number | null)[];
  /** Xato chizig'i chegaralari (ixtiyoriy) */
  lo?: (number | null)[];
  hi?: (number | null)[];
}

export interface ChartSpec {
  title: string;
  subtitle?: string;
  categories: string[];
  series: ChartSeries[];
  kind: ChartKind;
  /** Qiymatlar foizmi (o'qda va yorliqlarda % qo'yiladi) */
  percent?: boolean;
  /** O'nlik ajratgich vergul */
  comma?: boolean;
  /** Xato chizig'i nimani bildiradi (izoh uchun) */
  errorNote?: string;
}

export interface RenderedChart {
  svg: string;
  width: number;
  height: number;
}

// Tasdiqlangan kategorik palitra (birinchi 4 slot) va siyoh ranglari
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];
const PIE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];
const SURFACE = '#ffffff';
// Xavf zonalari — ma'noli (status) ranglar; kategoriya nomi yonida yoziladi
const ZONE_COLORS: Record<string, string> = {
  yashil: '#0ca30c',
  sariq: '#fab219',
  sargish: '#ec835a',
  "sarg'ish": '#ec835a',
  qizil: '#d03b3b',
};
function zoneColor(cat: string): string | null {
  const k = cat.trim().toLowerCase().replace(/[’`‘ʻ]/g, "'").split(' ')[0];
  return ZONE_COLORS[k] ?? null;
}
/** Kategoriyalarning hammasi xavf zonasi bo'lsa — zona ranglari */
function categoryColors(spec: ChartSpec): (string | null)[] | null {
  const cols = spec.categories.map(zoneColor);
  return cols.every((c) => c) ? cols : null;
}
const INK = '#0b0b0b';
const INK2 = '#52514e';
const MUTED = '#898781';
const GRID = '#e1e0d9';
const BASE = '#c3c2b7';
const FONT = "'Segoe UI', Arial, Helvetica, sans-serif";
const W = 900;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function formatValue(v: number, comma = true, percent = false): string {
  const a = Math.abs(v);
  const d = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 1 : 2;
  let s = v.toFixed(d);
  if (s.includes('.')) s = s.replace(/\.?0+$/, '');
  if (comma) s = s.replace('.', ',');
  return percent ? `${s}%` : s;
}

function niceStep(range: number, target = 5): number {
  if (range <= 0) return 1;
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const r = raw / mag;
  const step = r >= 5 ? 10 : r >= 2 ? 5 : r >= 1 ? 2 : 1;
  return step * mag;
}

function scaleDomain(values: number[], target = 5): { min: number; max: number; ticks: number[] } {
  let lo = Math.min(0, ...values);
  let hi = Math.max(0, ...values);
  if (lo === hi) hi = lo + 1;
  const step = niceStep(hi - lo, target);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Math.round(t * 1e9) / 1e9);
  return { min: lo, max: hi, ticks };
}

/** So'zlar bo'yicha qatorlarga bo'lish (eng ko'pi `maxLines`, oxirida …) */
function wrap(label: string, maxChars: number, maxLines = 2): string[] {
  const words = label.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, Math.max(1, maxChars - 1))}…`;
    return kept;
  }
  return lines.map((l) => (l.length > maxChars ? `${l.slice(0, maxChars - 1)}…` : l));
}

function header(spec: ChartSpec): { svg: string; height: number } {
  let y = 28;
  let out = `<text x="24" y="${y}" font-size="16" font-weight="600" fill="${INK}">${esc(spec.title)}</text>`;
  if (spec.subtitle) {
    y += 20;
    out += `<text x="24" y="${y}" font-size="12" fill="${INK2}">${esc(spec.subtitle)}</text>`;
  }
  if (spec.errorNote) {
    y += 17;
    out += `<text x="24" y="${y}" font-size="11" fill="${MUTED}">${esc(spec.errorNote)}</text>`;
  }
  if (spec.series.length >= 2 && spec.kind !== 'pie') {
    y += 24;
    let x = 24;
    spec.series.forEach((s, i) => {
      const label = s.label.length > 40 ? `${s.label.slice(0, 39)}…` : s.label;
      out += `<rect x="${x}" y="${y - 10}" width="12" height="12" rx="3" fill="${SERIES_COLORS[i]}"/>`;
      out += `<text x="${x + 18}" y="${y}" font-size="12" fill="${INK2}">${esc(label)}</text>`;
      x += 18 + label.length * 6.6 + 24;
    });
  }
  return { svg: out, height: y + 18 };
}

/** Bir uchi 4px yumaloq to'rtburchak (asos tomoni to'g'ri) */
function roundedBar(x: number, y: number, w: number, h: number, dir: 'right' | 'up' | 'left' | 'down'): string {
  const r = Math.min(4, Math.abs(dir === 'right' || dir === 'left' ? w : h) / 2, Math.abs(dir === 'right' || dir === 'left' ? h : w) / 2);
  if (w <= 0 || h <= 0) return '';
  if (dir === 'right')
    return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  if (dir === 'left')
    return `M${x + w},${y}H${x + r}Q${x},${y} ${x},${y + r}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w}Z`;
  if (dir === 'up')
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  return `M${x},${y}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w - r}Q${x + w},${y + h} ${x + w},${y + h - r}V${y}Z`;
}

function allValues(spec: ChartSpec): number[] {
  const out: number[] = [];
  spec.series.forEach((s) =>
    s.values.forEach((v, i) => {
      if (v !== null && Number.isFinite(v)) out.push(v);
      const lo = s.lo?.[i];
      const hi = s.hi?.[i];
      if (lo !== null && lo !== undefined && Number.isFinite(lo)) out.push(lo);
      if (hi !== null && hi !== undefined && Number.isFinite(hi)) out.push(hi);
    })
  );
  return out.length ? out : [0];
}

function wrapSvg(body: string, height: number, title: string): RenderedChart {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" width="${W}" height="${height}" font-family="${FONT}" role="img" aria-label="${esc(title)}">` +
    `<rect width="${W}" height="${height}" fill="${SURFACE}"/>${body}</svg>`;
  return { svg, width: W, height };
}

function hbar(spec: ChartSpec): RenderedChart {
  const head = header(spec);
  const n = spec.categories.length;
  const ns = spec.series.length;
  const labelChars = Math.min(40, Math.max(...spec.categories.map((c) => c.length), 4));
  const labelW = Math.min(300, Math.max(90, Math.min(labelChars, 34) * 6.6 + 16));
  const x0 = 24 + labelW + 12;
  const x1 = W - 72;
  const rowH = Math.max(34, ns * 22 + 12);
  const top = head.height + 8;
  const dom = scaleDomain(allValues(spec));
  const X = (v: number) => x0 + ((v - dom.min) / (dom.max - dom.min)) * (x1 - x0);
  const barT = Math.min(24, (rowH - 10 - (ns - 1) * 2) / ns);
  const plotBottom = top + n * rowH;
  let body = head.svg;

  dom.ticks.forEach((t) => {
    body += `<line x1="${X(t)}" x2="${X(t)}" y1="${top}" y2="${plotBottom}" stroke="${GRID}" stroke-width="1"/>`;
    body += `<text x="${X(t)}" y="${plotBottom + 18}" font-size="11" text-anchor="middle" fill="${MUTED}">${esc(formatValue(t, spec.comma, spec.percent))}</text>`;
  });
  body += `<line x1="${X(0)}" x2="${X(0)}" y1="${top}" y2="${plotBottom}" stroke="${BASE}" stroke-width="1"/>`;

  const showLabels = n * ns <= 30;
  const catCols = categoryColors(spec);
  spec.categories.forEach((cat, ci) => {
    const yRow = top + ci * rowH;
    const lines = wrap(cat, 36);
    const ly = yRow + rowH / 2 - ((lines.length - 1) * 14) / 2 + 4;
    lines.forEach((l, li) => {
      body += `<text x="${x0 - 10}" y="${ly + li * 14}" font-size="12" text-anchor="end" fill="${INK2}">${esc(l)}</text>`;
    });
    const groupH = ns * barT + (ns - 1) * 2;
    spec.series.forEach((s, si) => {
      const v = s.values[ci];
      if (v === null || !Number.isFinite(v)) return;
      const y = yRow + (rowH - groupH) / 2 + si * (barT + 2);
      const a = X(Math.min(0, v));
      const b = X(Math.max(0, v));
      const tip = `${cat} — ${s.label}: ${formatValue(v, spec.comma, spec.percent)}`;
      const fill = ns === 1 ? catCols?.[ci] ?? SERIES_COLORS[0] : SERIES_COLORS[si];
      body += `<path d="${roundedBar(a, y, Math.max(b - a, 0.5), barT, v >= 0 ? 'right' : 'left')}" fill="${fill}"><title>${esc(tip)}</title></path>`;
      const lo = s.lo?.[ci];
      const hi = s.hi?.[ci];
      let labelX = b + 6;
      if (lo !== null && lo !== undefined && hi !== null && hi !== undefined) {
        const cy = y + barT / 2;
        body += `<g stroke="${INK2}" stroke-width="1.5"><line x1="${X(lo)}" x2="${X(hi)}" y1="${cy}" y2="${cy}"/><line x1="${X(lo)}" x2="${X(lo)}" y1="${cy - 5}" y2="${cy + 5}"/><line x1="${X(hi)}" x2="${X(hi)}" y1="${cy - 5}" y2="${cy + 5}"/></g>`;
        labelX = Math.max(labelX, X(hi) + 6);
      }
      if (showLabels && v >= 0) {
        body += `<text x="${labelX}" y="${y + barT / 2 + 4}" font-size="11" fill="${INK2}">${esc(formatValue(v, spec.comma, spec.percent))}</text>`;
      }
    });
  });
  return wrapSvg(body, plotBottom + 36, spec.title);
}

function vbar(spec: ChartSpec, asLine: boolean): RenderedChart {
  const head = header(spec);
  const n = spec.categories.length;
  const ns = spec.series.length;
  const x0 = 72;
  const x1 = W - 24;
  const band = (x1 - x0) / Math.max(n, 1);
  const maxChars = Math.max(6, Math.floor(band / 6.6));
  const catLines = spec.categories.map((c) => wrap(c, maxChars, 3));
  const labelRows = Math.max(1, ...catLines.map((l) => l.length));
  const top = head.height + 16;
  const plotH = 300;
  const y1 = top + plotH;
  const dom = scaleDomain(allValues(spec));
  const Y = (v: number) => y1 - ((v - dom.min) / (dom.max - dom.min)) * plotH;
  let body = head.svg;

  dom.ticks.forEach((t) => {
    body += `<line x1="${x0}" x2="${x1}" y1="${Y(t)}" y2="${Y(t)}" stroke="${GRID}" stroke-width="1"/>`;
    body += `<text x="${x0 - 8}" y="${Y(t) + 4}" font-size="11" text-anchor="end" fill="${MUTED}">${esc(formatValue(t, spec.comma, spec.percent))}</text>`;
  });
  body += `<line x1="${x0}" x2="${x1}" y1="${Y(0)}" y2="${Y(0)}" stroke="${BASE}" stroke-width="1"/>`;

  catLines.forEach((lines, ci) => {
    const cx = x0 + band * ci + band / 2;
    lines.forEach((l, li) => {
      body += `<text x="${cx}" y="${y1 + 18 + li * 14}" font-size="11.5" text-anchor="middle" fill="${INK2}">${esc(l)}</text>`;
    });
  });

  // Ko'p seriyada yorliqlar qo'shni ustunga tushadi — faqat bitta seriyada
  const showLabels = n * ns <= 24 && ns === 1;
  const catCols = categoryColors(spec);
  if (asLine) {
    spec.series.forEach((s, si) => {
      const pts = s.values
        .map((v, ci) => (v === null || !Number.isFinite(v) ? null : [x0 + band * ci + band / 2, Y(v)]))
        .filter((p): p is number[] => p !== null);
      if (pts.length > 1) {
        body += `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${SERIES_COLORS[si]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      }
      s.values.forEach((v, ci) => {
        if (v === null || !Number.isFinite(v)) return;
        const cx = x0 + band * ci + band / 2;
        const lo = s.lo?.[ci];
        const hi = s.hi?.[ci];
        if (lo !== null && lo !== undefined && hi !== null && hi !== undefined) {
          body += `<g stroke="${INK2}" stroke-width="1.5"><line x1="${cx}" x2="${cx}" y1="${Y(lo)}" y2="${Y(hi)}"/><line x1="${cx - 5}" x2="${cx + 5}" y1="${Y(lo)}" y2="${Y(lo)}"/><line x1="${cx - 5}" x2="${cx + 5}" y1="${Y(hi)}" y2="${Y(hi)}"/></g>`;
        }
        const tip = `${spec.categories[ci]} — ${s.label}: ${formatValue(v, spec.comma, spec.percent)}`;
        body += `<circle cx="${cx}" cy="${Y(v)}" r="4.5" fill="${SERIES_COLORS[si]}" stroke="${SURFACE}" stroke-width="2"><title>${esc(tip)}</title></circle>`;
        if (showLabels && ns === 1) {
          body += `<text x="${cx}" y="${Y(v) - 10}" font-size="11" text-anchor="middle" fill="${INK2}">${esc(formatValue(v, spec.comma, spec.percent))}</text>`;
        }
      });
    });
  } else {
    const barW = Math.min(24, (band - 12 - (ns - 1) * 2) / ns);
    const groupW = ns * barW + (ns - 1) * 2;
    spec.categories.forEach((cat, ci) => {
      spec.series.forEach((s, si) => {
        const v = s.values[ci];
        if (v === null || !Number.isFinite(v)) return;
        const x = x0 + band * ci + (band - groupW) / 2 + si * (barW + 2);
        const a = Y(Math.max(0, v));
        const b = Y(Math.min(0, v));
        const tip = `${cat} — ${s.label}: ${formatValue(v, spec.comma, spec.percent)}`;
        const fill = ns === 1 ? catCols?.[ci] ?? SERIES_COLORS[0] : SERIES_COLORS[si];
        body += `<path d="${roundedBar(x, a, barW, Math.max(b - a, 0.5), v >= 0 ? 'up' : 'down')}" fill="${fill}"><title>${esc(tip)}</title></path>`;
        const lo = s.lo?.[ci];
        const hi = s.hi?.[ci];
        let labelY = a - 6;
        const cx = x + barW / 2;
        if (lo !== null && lo !== undefined && hi !== null && hi !== undefined) {
          body += `<g stroke="${INK2}" stroke-width="1.5"><line x1="${cx}" x2="${cx}" y1="${Y(lo)}" y2="${Y(hi)}"/><line x1="${cx - 5}" x2="${cx + 5}" y1="${Y(lo)}" y2="${Y(lo)}"/><line x1="${cx - 5}" x2="${cx + 5}" y1="${Y(hi)}" y2="${Y(hi)}"/></g>`;
          labelY = Math.min(labelY, Y(hi) - 6);
        }
        if (showLabels && v >= 0) {
          body += `<text x="${cx}" y="${labelY}" font-size="11" text-anchor="middle" fill="${INK2}">${esc(formatValue(v, spec.comma, spec.percent))}</text>`;
        }
      });
    });
  }
  return wrapSvg(body, y1 + 18 + labelRows * 14 + 16, spec.title);
}

function pie(spec: ChartSpec): RenderedChart {
  const head = header(spec);
  const s = spec.series[0];
  let items = spec.categories
    .map((c, i) => ({ label: c, v: s.values[i] ?? 0 }))
    .filter((d) => d.v > 0);
  if (items.length > 6) {
    const sorted = [...items].sort((a, b) => b.v - a.v);
    const rest = sorted.slice(5).reduce((acc, d) => acc + d.v, 0);
    items = [...sorted.slice(0, 5), { label: 'Boshqa', v: rest }];
  }
  const total = items.reduce((a, d) => a + d.v, 0) || 1;
  const sliceColor = (label: string, i: number) => zoneColor(label) ?? PIE_COLORS[i];
  const R = 130;
  const cx = 24 + R + 20;
  const cy = head.height + 16 + R;
  let body = head.svg;
  let ang = -Math.PI / 2;
  items.forEach((d, i) => {
    const a2 = ang + (d.v / total) * Math.PI * 2;
    const large = a2 - ang > Math.PI ? 1 : 0;
    const p1 = [cx + R * Math.cos(ang), cy + R * Math.sin(ang)];
    const p2 = [cx + R * Math.cos(a2), cy + R * Math.sin(a2)];
    const share = `${formatValue((d.v / total) * 100, spec.comma)}%`;
    const tip = `${d.label}: ${formatValue(d.v, spec.comma, spec.percent)} (${share})`;
    const path =
      items.length === 1
        ? `M${cx - R},${cy}A${R},${R} 0 1 1 ${cx + R},${cy}A${R},${R} 0 1 1 ${cx - R},${cy}Z`
        : `M${cx},${cy}L${p1[0]},${p1[1]}A${R},${R} 0 ${large} 1 ${p2[0]},${p2[1]}Z`;
    body += `<path d="${path}" fill="${sliceColor(d.label, i)}" stroke="${SURFACE}" stroke-width="2"><title>${esc(tip)}</title></path>`;
    ang = a2;
  });
  const lx = cx + R + 48;
  items.forEach((d, i) => {
    const y = head.height + 40 + i * 34;
    const share = `${formatValue((d.v / total) * 100, spec.comma)}%`;
    body += `<rect x="${lx}" y="${y - 11}" width="14" height="14" rx="3" fill="${sliceColor(d.label, i)}"/>`;
    const lines = wrap(d.label, 48, 1);
    body += `<text x="${lx + 22}" y="${y}" font-size="12.5" fill="${INK}">${esc(lines[0])}</text>`;
    body += `<text x="${lx + 22}" y="${y + 15}" font-size="11" fill="${INK2}">${esc(`${formatValue(d.v, spec.comma, spec.percent)} · ${share}`)}</text>`;
  });
  const h = Math.max(cy + R + 24, head.height + 40 + items.length * 34 + 8);
  return wrapSvg(body, h, spec.title);
}

export function renderChart(spec: ChartSpec): RenderedChart {
  if (!spec.categories.length || !spec.series.length) {
    return wrapSvg(`<text x="24" y="40" font-size="13" fill="${INK2}">Diagramma uchun ma'lumot yo'q</text>`, 64, spec.title);
  }
  if (spec.kind === 'pie') return pie(spec);
  if (spec.kind === 'hbar') return hbar(spec);
  return vbar(spec, spec.kind === 'line');
}

/** SVG → PNG (oq fonda, retina uchun 2x) */
export function svgToPng(rendered: RenderedChart, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = rendered.width * scale;
      canvas.height = rendered.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas mavjud emas'));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG yaratilmadi'))), 'image/png');
    };
    img.onerror = () => reject(new Error('Diagrammani rasmga aylantirib bo\'lmadi'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rendered.svg)}`;
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
