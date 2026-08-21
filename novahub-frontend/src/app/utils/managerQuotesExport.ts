import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getBase64Image } from './reportExportUtils';
import { getPdfDesignSettings, pdfDesignColor, pdfDesignPaper } from './pdfGenerator';
import { formatCurrencyAmount, formatCurrencyDescriptor } from './currency';

export interface ManagerQuoteExportRow {
  number?: string | null;
  branchName?: string | null;
  customerName?: string | null;
  date?: string | null;
  expiryDate?: string | null;
  total?: number | null;
  currency?: string | null;
  baseTotal?: number | null;
  baseCurrency?: string | null;
  reportTotal?: number | null;
  reportCurrency?: string | null;
  reportRateLabel?: string | null;
  reportRateSource?: string | null;
  reportRateEffectiveAt?: string | null;
  reportValuationLabel?: string | null;
  status?: string | null;
}

interface ManagerQuotesExportOptions {
  rows: ManagerQuoteExportRow[];
  tenantName: string;
  tenantLogo?: string | null;
  primaryColor?: string | null;
  filterSummary?: string;
  metrics?: { total?: number; amount?: number; amountCurrency?: string | null; amountCurrencySymbol?: string | null; valuationLabel?: string | null; historicalRateFallbackCount?: number; aggregationComplete?: boolean; topBranchName?: string | null; topBranchCount?: number };
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviada',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
};

const formatDate = (value: unknown) => {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-NI');
};

const formatMoney = (value: unknown, currency?: string | null, includeCode = false) => formatCurrencyAmount(value, currency || 'NIO', includeCode);
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

function filteredContext(filterSummary?: string) {
  return filterSummary?.trim() ? `Filtros aplicados: ${filterSummary.trim()}` : 'Filtros aplicados: todos los registros del alcance seleccionado';
}

function rateContext(row: ManagerQuoteExportRow) {
  if (row.reportRateLabel) return row.reportRateLabel;
  return row.reportRateSource || '—';
}

function reportContext(options: ManagerQuotesExportOptions) {
  const amountCurrency = options.metrics?.amountCurrency || 'NIO';
  const valuation = options.metrics?.valuationLabel || 'Valor histórico';
  const fallback = options.metrics?.historicalRateFallbackCount ? ` · ${options.metrics.historicalRateFallbackCount} con tasa vigente` : '';
  return `Moneda de referencia: ${formatCurrencyDescriptor(amountCurrency)} · Valoración: ${valuation}${fallback}`;
}

export async function exportManagerQuotesExcel(options: ManagerQuotesExportOptions) {
  const primary = safeHex(options.primaryColor);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NovaHub';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('Cotizaciones', { views: [{ state: 'frozen', ySplit: 4 }] });
  worksheet.mergeCells('A1:K1');
  const title = worksheet.getCell('A1');
  title.value = 'COTIZACIONES MANAGER';
  title.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(primary) } };
  worksheet.getRow(1).height = 28;
  worksheet.mergeCells('A2:K2');
  worksheet.getCell('A2').value = `${options.tenantName} · ${filteredContext(options.filterSummary)}`;
  worksheet.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };
  worksheet.mergeCells('A3:K3');
  worksheet.getCell('A3').value = `Total de cotizaciones: ${options.metrics?.total || options.rows.length} · Monto total: ${formatMoney(options.metrics?.amount, options.metrics?.amountCurrency, true)} · ${reportContext(options)} · Sucursal con más cotizaciones: ${options.metrics?.topBranchName || 'Sin datos'}`;
  worksheet.getCell('A3').font = { bold: true, color: { argb: hexToArgb(primary) } };

  worksheet.addRow(['Número', 'Sucursal', 'Cliente', 'Fecha de emisión', 'Total original', 'Total funcional', 'Equivalencia', 'Tasa utilizada', 'Fuente / fecha', 'Estado', 'Validez']);
  const header = worksheet.getRow(4);
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(primary) } };
    cell.border = { bottom: { style: 'thin', color: { argb: hexToArgb(primary) } } };
  });

  options.rows.forEach((row, index) => {
    const excelRow = worksheet.addRow([
      row.number || '—',
      row.branchName || 'Sucursal',
      row.customerName || 'Cliente ocasional',
      formatDate(row.date),
      formatMoney(row.total, row.currency, true),
      row.baseTotal == null ? '—' : formatMoney(row.baseTotal, row.baseCurrency, true),
      row.reportTotal == null ? 'No disponible' : formatMoney(row.reportTotal, row.reportCurrency, true),
      rateContext(row),
      `${row.reportRateSource || '—'} · ${formatDate(row.reportRateEffectiveAt)}`,
      statusLabel(row.status),
      formatDate(row.expiryDate),
    ]);
    excelRow.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
      if (index % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });
    excelRow.getCell(1).font = { bold: true, color: { argb: hexToArgb(primary) } };
    excelRow.getCell(5).font = { bold: true };
    excelRow.getCell(7).font = { bold: true, color: { argb: hexToArgb(primary) } };
    excelRow.getCell(10).font = { bold: true, color: { argb: hexToArgb(primary) } };
  });

  worksheet.columns = [
    { width: 18 }, { width: 24 }, { width: 30 }, { width: 18 }, { width: 20 }, { width: 20 }, { width: 21 }, { width: 24 }, { width: 28 }, { width: 16 }, { width: 16 },
  ];
  worksheet.autoFilter = { from: 'A4', to: 'K4' };
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `cotizaciones-manager-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportManagerQuotesPdf(options: ManagerQuotesExportOptions) {
  const settings = await getPdfDesignSettings('reportes.sales');
  const primary = pdfDesignColor(settings.primaryColor || options.primaryColor, [16, 185, 129]);
  const doc = new jsPDF({ ...pdfDesignPaper(settings), orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = 16;
  const logo = options.tenantLogo ? await getBase64Image(options.tenantLogo) : null;
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', margin, currentY, 24, 24, undefined, 'FAST');
      currentY += 28;
    } catch {
      // El PDF continúa aunque el logo remoto no sea compatible.
    }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text(options.tenantName || 'NovaHub', margin, currentY);
  currentY += 8;
  doc.setFontSize(14);
  doc.setTextColor(51, 65, 85);
  doc.text('Cotizaciones Manager', margin, currentY);
  currentY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(filteredContext(options.filterSummary), margin, currentY);
  currentY += 5;
  doc.text(reportContext(options), margin, currentY);
  currentY += 5;
  doc.text(`Generado: ${new Date().toLocaleString('es-NI')} · Total de cotizaciones: ${options.metrics?.total || options.rows.length} · Monto total: ${formatMoney(options.metrics?.amount, options.metrics?.amountCurrency, true)}`, margin, currentY);
  currentY += 7;
  doc.setDrawColor(primary[0], primary[1], primary[2]);
  doc.setLineWidth(0.8);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 7;

  autoTable(doc, {
    head: [['Número', 'Sucursal', 'Cliente', 'Fecha emisión', 'Total original', 'Equivalencia', 'Tasa utilizada', 'Estado', 'Validez']],
    body: options.rows.map((row) => [row.number || '—', row.branchName || 'Sucursal', row.customerName || 'Cliente ocasional', formatDate(row.date), `${formatMoney(row.total, row.currency, true)}\n${formatCurrencyDescriptor(row.currency)}`, row.reportTotal == null ? 'No disponible' : `${formatMoney(row.reportTotal, row.reportCurrency, true)}\n${formatCurrencyDescriptor(row.reportCurrency)}`, rateContext(row), statusLabel(row.status), formatDate(row.expiryDate)]),
    startY: currentY,
    margin: { left: margin, right: margin, bottom: 16 },
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2.5, textColor: [51, 65, 85], overflow: 'linebreak' },
    headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { fontStyle: 'bold' }, 4: { halign: 'right', fontStyle: 'bold' }, 5: { halign: 'right', fontStyle: 'bold' }, 7: { halign: 'center' } },
    didParseCell: (hook) => {
      if (hook.section === 'body' && hook.column.index === 5) hook.cell.styles.textColor = primary;
    },
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`${options.tenantName || 'NovaHub'} · Página ${page} de ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
  }
  doc.save(`cotizaciones-manager-${new Date().toISOString().slice(0, 10)}.pdf`);
}
