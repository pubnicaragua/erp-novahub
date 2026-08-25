import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getBase64Image } from './reportExportUtils';
import { getPdfDesignSettings, pdfDesignColor, pdfDesignPaper } from './pdfGenerator';
import { formatCurrencyAmount } from './currency';

export interface CustomerTransactionExportRow {
  id?: string;
  kind?: string | null;
  number?: string | null;
  date?: string | null;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  reportAmount?: number | null;
  reportCurrency?: string | null;
  reportRateLabel?: string | null;
  reportRateEffectiveAt?: string | null;
  description?: string | null;
  branchName?: string | null;
}

interface CustomerTransactionsExportOptions {
  rows: CustomerTransactionExportRow[];
  customerName: string;
  tenantName: string;
  tenantLogo?: string | null;
  primaryColor?: string | null;
  branchName?: string | null;
  pdfDesign?: { settings?: Record<string, any> } | Record<string, any> | null;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', IN_PROCESS: 'En proceso', SENT: 'Enviada', APPROVED: 'Aprobada', REJECTED: 'Rechazada', CANCELLED: 'Cancelada',
  CONFIRMED: 'Confirmada', IN_PROGRESS: 'En proceso', DELIVERED: 'Entregada', PENDING: 'Pendiente',
  PARTIAL: 'Pago parcial', PAID: 'Pagada', CREDIT: 'A crédito', OVERDUE: 'Vencida', ACTIVE: 'Activa',
  PAUSED: 'Pausada', EXPIRED: 'Vencida', ISSUED: 'Emitida', APPLIED: 'Aplicada', VOIDED: 'Anulada',
};

const formatDate = (value: unknown) => {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-NI');
};

const formatMoney = (value: unknown, currency?: string | null) => formatCurrencyAmount(value, currency || 'NIO', true);
const statusLabel = (value: unknown) => STATUS_LABELS[String(value || '').toUpperCase()] || String(value || '—').replaceAll('_', ' ');

function safeHex(value: string | null | undefined, fallback = '#10b981') {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback;
}

function hexToArgb(value: string) {
  return `FF${value.replace('#', '').toUpperCase()}`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileStem(customerName: string) {
  return `historial-transacciones-${String(customerName || 'cliente').trim().replace(/[^a-z0-9áéíóúüñ]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'cliente'}`;
}

export async function exportCustomerTransactionsExcel(options: CustomerTransactionsExportOptions) {
  const primary = safeHex(options.primaryColor);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NovaHub';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('Historial', { views: [{ state: 'frozen', ySplit: 4 }] });
  worksheet.mergeCells('A1:G1');
  const title = worksheet.getCell('A1');
  title.value = 'HISTORIAL DE TRANSACCIONES DEL CLIENTE';
  title.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(primary) } };
  worksheet.getRow(1).height = 28;
  worksheet.mergeCells('A2:G2');
  worksheet.getCell('A2').value = `${options.customerName} · ${options.branchName || 'Sucursal no identificada'} · ${options.tenantName}`;
  worksheet.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };
  worksheet.mergeCells('A3:G3');
  worksheet.getCell('A3').value = `Registros: ${options.rows.length} · Generado: ${new Date().toLocaleString('es-NI')}`;
  worksheet.getCell('A3').font = { bold: true, color: { argb: hexToArgb(primary) } };
  worksheet.addRow(['Tipo', 'Número', 'Fecha', 'Estado', 'Monto', 'Equivalencia', 'Descripción / sucursal']);
  const header = worksheet.getRow(4);
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(primary) } };
  });
  options.rows.forEach((row, index) => {
    const excelRow = worksheet.addRow([
      row.kind || 'Transacción', row.number || '—', formatDate(row.date), statusLabel(row.status),
      formatMoney(row.amount, row.currency),
      row.reportAmount == null ? '—' : `${formatMoney(row.reportAmount, row.reportCurrency)}${row.reportRateLabel ? `\n${row.reportRateLabel}` : ''}`,
      `${row.description || '—'} · ${row.branchName || options.branchName || 'Sucursal'}`,
    ]);
    excelRow.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
      if (index % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });
    excelRow.getCell(1).font = { bold: true, color: { argb: hexToArgb(primary) } };
    excelRow.getCell(5).font = { bold: true };
  });
  worksheet.columns = [{ width: 22 }, { width: 18 }, { width: 15 }, { width: 16 }, { width: 22 }, { width: 28 }, { width: 48 }];
  worksheet.autoFilter = { from: 'A4', to: 'G4' };
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${fileStem(options.customerName)}.xlsx`);
}

export async function exportCustomerTransactionsPdf(options: CustomerTransactionsExportOptions) {
  const configuredSettings = options.pdfDesign && typeof options.pdfDesign === 'object' && 'settings' in options.pdfDesign ? options.pdfDesign.settings : options.pdfDesign;
  const settings = (configuredSettings && typeof configuredSettings === 'object' ? configuredSettings : await getPdfDesignSettings('reportes.customers')) as Record<string, any>;
  const primary = pdfDesignColor(settings.primaryColor || options.primaryColor, [16, 185, 129]);
  const doc = new jsPDF(pdfDesignPaper(settings));
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = 16;
  const logo = options.tenantLogo ? await getBase64Image(options.tenantLogo) : null;
  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, currentY, 22, 22, undefined, 'FAST'); currentY += 26; } catch { /* El PDF continúa sin logo. */ }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text(options.tenantName || 'NovaHub', margin, currentY);
  currentY += 8;
  doc.setFontSize(13);
  doc.setTextColor(51, 65, 85);
  doc.text('Historial de transacciones del cliente', margin, currentY);
  currentY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${options.customerName} · ${options.branchName || 'Sucursal no identificada'} · Registros: ${options.rows.length}`, margin, currentY);
  currentY += 5;
  doc.text(`Generado: ${new Date().toLocaleString('es-NI')}`, margin, currentY);
  currentY += 7;
  doc.setDrawColor(primary[0], primary[1], primary[2]);
  doc.setLineWidth(0.8);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 7;
  autoTable(doc, {
    head: [['Tipo', 'Número', 'Fecha', 'Estado', 'Monto', 'Tasa aplicada', 'Descripción']],
    body: options.rows.map((row) => [row.kind || 'Transacción', row.number || '—', formatDate(row.date), statusLabel(row.status), `${formatMoney(row.amount, row.currency)}${row.reportAmount == null ? '' : `\n≈ ${formatMoney(row.reportAmount, row.reportCurrency)}`}`, row.reportRateLabel || '—', row.description || '—']),
    startY: currentY,
    margin: { left: margin, right: margin, bottom: 16 },
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2.5, textColor: [51, 65, 85], overflow: 'linebreak' },
    headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { fontStyle: 'bold' }, 4: { halign: 'right', fontStyle: 'bold' }, 5: { fontSize: 6.5 } },
  });
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`${options.tenantName || 'NovaHub'} · Página ${page} de ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
  }
  doc.save(`${fileStem(options.customerName)}.pdf`);
}
