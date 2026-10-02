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
    case 'novahub-format': return 'novahub_format';
    case 'oficio': return 'oficio';
    case 'A4': return 'a4';
    case 'legal': return 'legal';
    case 'roll-80': return 'rollo_80mm';
    case 'roll-58': return 'rollo_58mm';
    default: return '';
  }
}

export function buildPdfFileName(parts: readonly unknown[], format: PdfDownloadFormat | string = 'configured'): string {
  const humanDocumentLabels: Record<string, string> = {
    cotizacion: 'Cotización',
    orden_de_venta: 'Orden de venta',
    factura: 'Factura',
    factura_recurrente: 'Factura recurrente',
    pago_recibido: 'Pago recibido',
    devolucion: 'Devolución',
    nota_de_credito: 'Nota de crédito',
    comprobante_gasto: 'Comprobante de gasto',
    orden_de_compra: 'Orden de compra',
    solicitud_de_compra: 'Solicitud de compra',
    factura_de_proveedor: 'Factura de proveedor',
    arqueo_de_caja: 'Resumen de sesión de caja',
    cierre_gerencial_de_caja: 'Cierre gerencial de caja',
    etiquetas_productos: 'Etiquetas de productos',
  };
  const firstPart = String(parts[0] ?? '').trim();
  if (humanDocumentLabels[firstPart]) {
    const suffix = parts.slice(1).map(part => String(part ?? '').trim()).filter(Boolean).join(' ');
    return buildHumanPdfFileName([humanDocumentLabels[firstPart], suffix].filter(Boolean).join(' '), format);
  }
  const paperLabel = pdfFormatLabel(format);
  return buildDownloadFileName(paperLabel ? [...parts, paperLabel] : parts, 'pdf');
}

function sanitizeHumanFileName(value: unknown, fallback = 'Documento'): string {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  return raw
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|\.+$/g, '')
    .trim()
    .slice(0, 180) || fallback;
}

/** Nombre legible para documentos individuales; conserva espacios y acentos. */
export function buildHumanPdfFileName(label: unknown, format: PdfDownloadFormat | string = 'configured'): string {
  const paperLabel = pdfFormatLabel(format);
  const base = sanitizeHumanFileName([label, paperLabel].filter(Boolean).join(' '));
  return `${base}.pdf`;
}

/** Nombre legible para documentos individuales que tienen número comercial. */
export function buildLabeledPdfFileName(label: unknown, number?: unknown, format: PdfDownloadFormat | string = 'configured'): string {
  const documentLabel = String(label ?? '').trim() || 'Documento';
  const rawNumber = String(number ?? '').trim();
  const documentNumber = rawNumber && !isInternalIdentifier(rawNumber) ? rawNumber : 'Sin número';
  return buildHumanPdfFileName(`${documentLabel} ${documentNumber}`, format);
}

export function buildDateFilteredLabeledPdfFileName(label: unknown, format: PdfDownloadFormat | string = 'configured', dateFrom?: unknown, dateTo?: unknown): string {
  return buildHumanPdfFileName([label, ...dateRangeParts(dateFrom, dateTo)].join(' '), format);
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
  const labels: Record<string, string> = {
    estimate: 'Cotización',
    order: 'Orden de venta',
    invoice: 'Factura',
    recurring: 'Factura recurrente',
    payment: 'Pago recibido',
    return: 'Devolución',
    'credit-note': 'Nota de crédito',
  };
  return buildLabeledPdfFileName(labels[documentType] || SALES_DOCUMENT_LABELS[documentType] || documentType, number, format);
}
