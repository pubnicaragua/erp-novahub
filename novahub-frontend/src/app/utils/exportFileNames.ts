import type { PdfDownloadFormat } from './pdfDownloadFormats';

/**
 * Nombres de archivos que se muestran al usuario. Los identificadores internos
 * no deben terminar en el nombre descargado: el documento puede no tener aún
 * un número comercial, pero siempre debe conservar un nombre reconocible.
 */
export function sanitizeDownloadPart(value: unknown, fallback = ''): string {
  const raw = String(value ?? '').trim();
  if (!raw || isInternalIdentifier(raw)) return fallback;
  const normalized = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/_+/g, '_')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');
  return normalized || fallback;
}

function isInternalIdentifier(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    || /^[0-9a-f]{24}$/i.test(value);
}

export function downloadDate(value = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function extensionValue(extension: string): string {
  return String(extension || 'file').replace(/^\./, '').toLowerCase();
}

export function buildDownloadFileName(parts: readonly unknown[], extension: string, includeDate = false): string {
  const nameParts = parts
    .map((part) => sanitizeDownloadPart(part))
    .filter(Boolean);
  if (includeDate) nameParts.push(downloadDate());
  return `${nameParts.join('_') || 'documento'}.${extensionValue(extension)}`;
}

export function pdfFormatLabel(format?: PdfDownloadFormat | string): string {
  switch (format) {
    case 'letter': return 'carta';
    case 'oficio': return 'oficio';
    case 'A4': return 'a4';
    case 'legal': return 'legal';
    case 'roll-80': return 'rollo_80mm';
    case 'roll-58': return 'rollo_58mm';
    default: return '';
  }
}

export function buildPdfFileName(parts: readonly unknown[], format: PdfDownloadFormat | string = 'configured'): string {
  const paperLabel = pdfFormatLabel(format);
  return buildDownloadFileName(paperLabel ? [...parts, paperLabel] : parts, 'pdf');
}

export function buildDatedDownloadFileName(parts: readonly unknown[], extension: string): string {
  return buildDownloadFileName(parts, extension, true);
}

export function buildDatedPdfFileName(parts: readonly unknown[], format: PdfDownloadFormat | string = 'configured'): string {
  return buildPdfFileName([...parts, downloadDate()], format);
}

function dateRangeParts(dateFrom?: unknown, dateTo?: unknown): string[] {
  const from = String(dateFrom ?? '').trim();
  const to = String(dateTo ?? '').trim();
  if (!from && !to) return ['generado', downloadDate()];
  if (from && to && from === to) return ['fecha', from];
  return ['del', from || 'inicio', 'al', to || 'actual'];
}

export function buildDateFilteredDownloadFileName(parts: readonly unknown[], extension: string, dateFrom?: unknown, dateTo?: unknown): string {
  return buildDownloadFileName([...parts, ...dateRangeParts(dateFrom, dateTo)], extension);
}

export function buildDateFilteredPdfFileName(parts: readonly unknown[], format: PdfDownloadFormat | string = 'configured', dateFrom?: unknown, dateTo?: unknown): string {
  return buildPdfFileName([...parts, ...dateRangeParts(dateFrom, dateTo)], format);
}

export function buildReportDownloadFileName(parts: readonly unknown[], extension: string, range?: string): string {
  const normalizedRange = String(range || '').trim().toLowerCase();
  if (normalizedRange === 'todo' || normalizedRange === 'historico') {
    return buildDownloadFileName([...parts, 'historico_completo'], extension);
  }
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  switch (normalizedRange) {
    case 'hoy':
      start.setHours(0, 0, 0, 0);
      break;
    case 'ultima-semana':
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case 'ultimo-mes':
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      break;
    case 'ultimo-trimestre':
      start.setDate(start.getDate() - 89);
      start.setHours(0, 0, 0, 0);
      break;
    case 'ultimo-año':
      start.setDate(start.getDate() - 364);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      return buildDownloadFileName([...parts, 'generado', downloadDate()], extension);
  }
  return buildDateFilteredDownloadFileName(parts, extension, downloadDate(start), downloadDate(end));
}

const SALES_DOCUMENT_LABELS: Record<string, string> = {
  estimate: 'cotizacion',
  order: 'orden_de_venta',
  invoice: 'factura',
  recurring: 'factura_recurrente',
  payment: 'pago_recibido',
  return: 'devolucion',
  'credit-note': 'nota_de_credito',
};

export function buildSalesPdfFileName(documentType: string, number?: unknown, format: PdfDownloadFormat | string = 'configured'): string {
  return buildPdfFileName([SALES_DOCUMENT_LABELS[documentType] || documentType, number || 'sin_numero'], format);
}
