import ExcelJS from 'exceljs';
import { generateConfiguredHistoryPDF } from './pdfGenerator';
import type { PdfDownloadFormat } from './pdfDownloadFormats';
import { formatCurrencyAmount } from './currency';
import { buildDownloadFileName, sanitizeDownloadPart } from './exportFileNames';
import type { CurrencyDisplayMode } from '../contexts/CurrencyContext';

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
  customerData?: Record<string, unknown>;
  tenantName: string;
  tenantLogo?: string | null;
  primaryColor?: string | null;
  branchName?: string | null;
  pdfDesign?: { settings?: Record<string, any> } | Record<string, any> | null;
  pdfFormat?: PdfDownloadFormat;
  outputCurrency?: string | null;
  displayMode?: CurrencyDisplayMode;
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
  return `historial_transacciones_cliente_${sanitizeDownloadPart(customerName, 'cliente').toLowerCase()}`;
}

export async function exportCustomerTransactionsExcel(options: CustomerTransactionsExportOptions) {
  const primary = safeHex(options.primaryColor);
  const originalOnly = options.displayMode === 'ORIGINAL';
  const amountHeader = originalOnly ? 'Monto original' : options.outputCurrency ? `Monto (${String(options.outputCurrency).toUpperCase()})` : 'Monto';
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NovaHub';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('Historial', { views: [{ state: 'frozen', ySplit: 4 }] });
  worksheet.mergeCells('A1:F1');
  const title = worksheet.getCell('A1');
  title.value = 'HISTORIAL DE TRANSACCIONES DEL CLIENTE';
  title.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(primary) } };
  worksheet.getRow(1).height = 28;
  worksheet.mergeCells('A2:F2');
  worksheet.getCell('A2').value = `${options.customerName} · ${options.branchName || 'Sucursal no identificada'} · ${options.tenantName}`;
  worksheet.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };
  worksheet.mergeCells('A3:F3');
  worksheet.getCell('A3').value = `Registros: ${options.rows.length} · Generado: ${new Date().toLocaleString('es-NI')}`;
  worksheet.getCell('A3').font = { bold: true, color: { argb: hexToArgb(primary) } };
  worksheet.addRow(['Tipo', 'Número', 'Fecha', 'Estado', amountHeader, 'Descripción / sucursal']);
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
      originalOnly || row.reportAmount == null ? formatMoney(row.amount, row.currency) : formatMoney(row.reportAmount, row.reportCurrency),
      `${row.description || '—'} · ${row.branchName || options.branchName || 'Sucursal'}`,
    ]);
    excelRow.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
      if (index % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });
    excelRow.getCell(1).font = { bold: true, color: { argb: hexToArgb(primary) } };
    excelRow.getCell(5).font = { bold: true };
  });
  worksheet.columns = [{ width: 22 }, { width: 18 }, { width: 15 }, { width: 16 }, { width: 28 }, { width: 48 }];
  worksheet.autoFilter = { from: 'A4', to: 'F4' };
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), buildDownloadFileName([fileStem(options.customerName)], 'xlsx'));
}

export async function exportCustomerTransactionsPdf(options: CustomerTransactionsExportOptions) {
  const rows = Array.isArray(options.rows) ? options.rows : [];
  const outputCurrency = options.outputCurrency ? String(options.outputCurrency).toUpperCase() : null;
  const originalOnly = options.displayMode === 'ORIGINAL';
  const amountHeader = originalOnly ? 'Monto original' : outputCurrency ? `Monto (${outputCurrency})` : 'Monto';
  await generateConfiguredHistoryPDF({
    targetKey: 'ventas.customer-history',
    title: 'Historial de transacciones',
    subtitle: [options.branchName || 'Sucursal no identificada', outputCurrency ? `Moneda: ${outputCurrency}` : ''].filter(Boolean).join(' · '),
    subjectLabel: 'Cliente',
    subjectName: options.customerName || 'Cliente',
    subjectData: options.customerData,
    tenantName: options.tenantName || 'NovaHub',
    tenantLogo: options.tenantLogo,
    format: options.pdfFormat || 'configured',
    designOverride: options.pdfDesign || undefined,
    rows,
    fileName: fileStem(options.customerName),
    columns: [
      { header: 'Tipo', value: (row) => row.kind || 'Transacción' },
      { header: 'Número', value: (row) => row.number || '—' },
      { header: 'Fecha', align: 'center', value: (row) => formatDate(row.date) },
      { header: 'Estado', value: (row) => statusLabel(row.status) },
      { header: amountHeader, align: 'right', value: (row) => originalOnly || row.reportAmount == null ? formatMoney(row.amount, row.currency) : formatMoney(row.reportAmount, row.reportCurrency) },
      { header: 'Tasa aplicada', value: (row) => row.reportRateLabel || '—' },
      { header: 'Descripción / sucursal', value: (row) => `${row.description || '—'} · ${row.branchName || options.branchName || 'Sucursal'}` },
    ],
  });
}
