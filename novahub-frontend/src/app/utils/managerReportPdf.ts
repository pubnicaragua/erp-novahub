import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfDesignSettings, pdfDesignPaper } from './pdfGenerator';
import { ensurePdfBrowserPreview, showPdfInBrowserPreview } from './pdfBrowserPreview';

/**
 * Renderizador fijo para consolidados de Manager. Estos reportes no son
 * plantillas editables de sucursal: conservan la lectura multi-sucursal y
 * solo reutilizan papel y tipografía corporativa disponibles en la cuenta.
 */
export async function generateManagerTablePDF({ title, rows, fileName }: { title: string; rows: Array<Record<string, unknown>>; fileName: string }) {
  ensurePdfBrowserPreview(title);
  let settings: Record<string, any> = {};
  try {
    settings = await getPdfDesignSettings('reportes.finance');
  } catch {
    settings = {};
  }
  const doc = new jsPDF(pdfDesignPaper(settings)) as any;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = pageWidth * 0.05;
  const contentWidth = pageWidth - margin * 2;
  const columns = Object.keys(rows[0] || { Mensaje: 'Sin registros para el alcance seleccionado' });
  const body = rows.length ? rows.map((row) => columns.map((column) => String(row[column] ?? '—'))) : [['Sin registros para el alcance seleccionado']];
  doc.setFontSize(15);
  doc.text(title, margin, 16);
  doc.setFontSize(9);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-NI')}`, margin, 23);
  doc.autoTable({ startY: 29, tableWidth: contentWidth, margin: { left: margin, right: margin }, head: [columns], body, styles: { fontSize: 7, cellPadding: 2, valign: 'middle', overflow: 'linebreak' }, headStyles: { fillColor: [16, 185, 129], valign: 'middle' }, theme: 'grid' });
  showPdfInBrowserPreview(doc.output('blob'), fileName);
}
