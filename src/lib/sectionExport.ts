/** Jadvallar + diagrammalar to'plamini Excel va Word'ga chiqarish (umumiy) */
import * as XLSX from 'xlsx';
import type { LiveTable } from './liveReport';
import { renderChart, svgToPng, type ChartSpec } from './chartSvg';
import { exportDocx, type DocBlock } from './docxExport';

export interface ExportSection {
  title: string;
  sheet: string;
  tables: LiveTable[];
  charts?: ChartSpec[];
}

export type MetaRow = [string, string | number];

function uniqueSheet(wb: XLSX.WorkBook, name: string): string {
  let n = name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
  let i = 2;
  while (wb.SheetNames.includes(n)) n = `${name.slice(0, 28)} ${i++}`;
  return n;
}

export function exportSectionsExcel(
  meta: MetaRow[],
  sections: ExportSection[],
  filename: string,
  raw?: { name: string; aoa: (string | number | null)[][] }[]
): void {
  const wb = XLSX.utils.book_new();
  const ws0 = XLSX.utils.aoa_to_sheet([['Metodika va izohlar'], [], ...meta]);
  ws0['!cols'] = [{ wch: 30 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(wb, ws0, 'IZOH');
  sections.forEach((sec) => {
    const aoa: (string | number)[][] = [[sec.title], []];
    sec.tables.forEach((t) => {
      aoa.push([t.title]);
      if (t.note) aoa.push([t.note]);
      aoa.push(t.headers);
      t.rows.forEach((r) => aoa.push(r));
      aoa.push([]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const w = Math.max(1, ...sec.tables.map((t) => t.headers.length));
    ws['!cols'] = Array.from({ length: w }, (_, i) => ({ wch: i === 0 ? 40 : 16 }));
    XLSX.utils.book_append_sheet(wb, ws, uniqueSheet(wb, sec.sheet));
  });
  raw?.forEach((r) => {
    const ws = XLSX.utils.aoa_to_sheet(r.aoa);
    XLSX.utils.book_append_sheet(wb, ws, uniqueSheet(wb, r.name));
  });
  XLSX.writeFile(wb, filename);
}

export async function exportSectionsWord(
  title: string,
  meta: MetaRow[],
  sections: ExportSection[],
  filename: string,
  landscape = true
): Promise<void> {
  const blocks: DocBlock[] = [
    { type: 'title', text: title },
    { type: 'h1', text: 'Metodika' },
    { type: 'kv', rows: meta.map(([k, v]) => [k, String(v)] as [string, string]) },
  ];
  for (const sec of sections) {
    blocks.push({ type: 'h1', text: sec.title });
    for (const spec of sec.charts ?? []) {
      const r = renderChart(spec);
      const png = new Uint8Array(await (await svgToPng(r)).arrayBuffer());
      blocks.push({ type: 'image', png, width: r.width, height: r.height, caption: spec.title });
    }
    sec.tables.forEach((t) => {
      blocks.push({ type: 'table', caption: t.title, headers: t.headers, rows: t.rows, boldLastRow: t.totalRow, boldRows: t.boldRows });
      if (t.note) blocks.push({ type: 'p', text: `Izoh: ${t.note}`, italic: true, small: true });
    });
  }
  await exportDocx(blocks, { filename, landscape });
}
