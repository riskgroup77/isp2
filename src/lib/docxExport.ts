/**
 * Word (.docx) eksport. `docx` kutubxonasi faqat kerak bo'lganda yuklanadi
 * (asosiy JS faylni og'irlashtirmaslik uchun).
 */
import { downloadBlob } from './chartSvg';

export type DocBlock =
  | { type: 'title'; text: string }
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'p'; text: string; italic?: boolean; small?: boolean }
  | { type: 'kv'; rows: [string, string | number][] }
  | { type: 'table'; headers: string[]; rows: (string | number)[][]; boldLastRow?: boolean; boldRows?: number[]; caption?: string }
  | { type: 'image'; png: Uint8Array; width: number; height: number; caption?: string }
  | { type: 'pagebreak' };

export interface DocOptions {
  landscape?: boolean;
  filename: string;
}

export async function exportDocx(blocks: DocBlock[], opts: DocOptions): Promise<void> {
  const d = await import('docx');
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    ImageRun,
    Packer,
    PageBreak,
    PageOrientation,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = d;

  const FONT = 'Times New Roman';
  // Sahifa ish kengligi (px, 96 dpi): A4 portret ≈ 16,5 sm, landshaft ≈ 24,7 sm
  const maxImgW = opts.landscape ? 900 : 620;
  const border = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
  const borders = { top: border, bottom: border, left: border, right: border };

  const cellPara = (text: string, bold = false) =>
    new Paragraph({
      spacing: { before: 20, after: 20 },
      children: [new TextRun({ text, bold, font: FONT, size: 20 })],
    });

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];
  blocks.forEach((b) => {
    switch (b.type) {
      case 'title':
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: b.text, bold: true, font: FONT, size: 32 })],
          })
        );
        break;
      case 'h1':
      case 'h2':
      case 'h3': {
        const size = b.type === 'h1' ? 28 : b.type === 'h2' ? 26 : 24;
        children.push(
          new Paragraph({
            heading: b.type === 'h1' ? HeadingLevel.HEADING_1 : b.type === 'h2' ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
            spacing: { before: 240, after: 100 },
            keepNext: true,
            children: [new TextRun({ text: b.text, bold: true, font: FONT, size, color: '000000' })],
          })
        );
        break;
      }
      case 'p':
        children.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({ text: b.text, italics: b.italic, font: FONT, size: b.small ? 20 : 24 })],
          })
        );
        break;
      case 'kv':
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: b.rows.map(
              ([k, v]) =>
                new TableRow({
                  children: [
                    new TableCell({ borders, width: { size: 30, type: WidthType.PERCENTAGE }, children: [cellPara(k, true)] }),
                    new TableCell({ borders, width: { size: 70, type: WidthType.PERCENTAGE }, children: [cellPara(String(v))] }),
                  ],
                })
            ),
          })
        );
        children.push(new Paragraph({ text: '' }));
        break;
      case 'table': {
        if (b.caption) {
          children.push(
            new Paragraph({
              keepNext: true,
              spacing: { before: 160, after: 80 },
              children: [new TextRun({ text: b.caption, bold: true, font: FONT, size: 22 })],
            })
          );
        }
        const header = new TableRow({
          tableHeader: true,
          children: b.headers.map(
            (h) =>
              new TableCell({
                borders,
                shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'E7E6E6' },
                children: [cellPara(h, true)],
              })
          ),
        });
        const body = b.rows.map(
          (r, ri) =>
            new TableRow({
              cantSplit: true,
              children: b.headers.map(
                (_, ci) =>
                  new TableCell({
                    borders,
                    children: [
                      cellPara(String(r[ci] ?? ''), (!!b.boldLastRow && ri === b.rows.length - 1) || !!b.boldRows?.includes(ri)),
                    ],
                  })
              ),
            })
        );
        children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] }));
        children.push(new Paragraph({ text: '' }));
        break;
      }
      case 'image': {
        const w = Math.min(maxImgW, b.width);
        const h = Math.round((b.height * w) / b.width);
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            keepNext: !!b.caption,
            children: [new ImageRun({ type: 'png', data: b.png, transformation: { width: w, height: h } })],
          })
        );
        if (b.caption) {
          children.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [new TextRun({ text: b.caption, italics: true, font: FONT, size: 22 })],
            })
          );
        }
        break;
      }
      case 'pagebreak':
        children.push(new Paragraph({ children: [new PageBreak()] }));
        break;
    }
  });

  const doc = new Document({
    creator: 'Donozologik Monitoring portali',
    title: opts.filename,
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [
      {
        properties: {
          page: {
            size: opts.landscape ? { orientation: PageOrientation.LANDSCAPE, width: 11906, height: 16838 } : undefined,
            margin: { top: 1134, bottom: 1134, left: 1134, right: 851 },
          },
        },
        children,
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, opts.filename);
}
