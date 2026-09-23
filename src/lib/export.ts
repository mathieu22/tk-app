// Exports Excel (exceljs) et PDF simples (pdf-lib) : listes, reçus, bilans.
import "server-only";
import ExcelJS from "exceljs";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

export type Sheet = { name: string; columns: { header: string; key: string; width?: number }[]; rows: Record<string, unknown>[] };

export async function xlsxResponse(filename: string, sheets: Sheet[]) {
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31));
    ws.columns = s.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? Math.max(12, c.header.length + 2) }));
    ws.getRow(1).font = { bold: true };
    ws.addRows(s.rows);
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

/** Les polices standard PDF (WinAnsi) n'ont pas les espaces fines ni certains signes. */
export const pdfSafe = (s: string) =>
  s.replace(/[   ]/g, " ").replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x00-\xff€]/g, "");

/** Mise en page A4 minimale : titre, lignes clé / valeur, tableaux, pagination automatique. */
export class PdfWriter {
  private constructor(private doc: PDFDocument, private font: PDFFont, private bold: PDFFont) {
    this.page = this.doc.addPage([595, 842]);
  }
  page: PDFPage;
  y = 800;
  static async create() {
    const doc = await PDFDocument.create();
    return new PdfWriter(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold));
  }
  private ensure(h: number) {
    if (this.y - h < 50) {
      this.page = this.doc.addPage([595, 842]);
      this.y = 800;
    }
  }
  text(s: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; x?: number } = {}) {
    const size = opts.size ?? 11;
    this.ensure(size + 6);
    this.page.drawText(pdfSafe(s), { x: opts.x ?? 50, y: this.y, size, font: opts.bold ? this.bold : this.font, color: rgb(...(opts.color ?? [0.1, 0.1, 0.18])) });
    this.y -= size + 6;
  }
  gap(h = 10) { this.y -= h; }
  rule() {
    this.ensure(10);
    this.page.drawLine({ start: { x: 50, y: this.y }, end: { x: 545, y: this.y }, thickness: 0.5, color: rgb(0.85, 0.86, 0.9) });
    this.y -= 12;
  }
  keyValue(k: string, v: string) {
    this.ensure(18);
    this.page.drawText(pdfSafe(k), { x: 50, y: this.y, size: 10, font: this.font, color: rgb(0.45, 0.47, 0.55) });
    this.page.drawText(pdfSafe(v), { x: 200, y: this.y, size: 11, font: this.bold, color: rgb(0.1, 0.1, 0.18) });
    this.y -= 18;
  }
  table(headers: string[], rows: string[][], widths?: number[]) {
    const w = widths ?? headers.map(() => 495 / headers.length);
    const row = (cells: string[], font: PDFFont) => {
      this.ensure(16);
      let x = 50;
      cells.forEach((c, i) => {
        let t = pdfSafe(c);
        while (t.length > 1 && font.widthOfTextAtSize(t, 9) > w[i] - 4) t = t.slice(0, -4) + "...";
        this.page.drawText(pdfSafe(t), { x, y: this.y, size: 9, font });
        x += w[i];
      });
      this.y -= 15;
    };
    row(headers, this.bold);
    this.rule();
    rows.forEach((r) => row(r, this.font));
  }
  async response(filename: string, inline = false) {
    const bytes = await this.doc.save();
    return new Response(Buffer.from(bytes), {
      headers: { "content-type": "application/pdf", "content-disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"` },
    });
  }
}
