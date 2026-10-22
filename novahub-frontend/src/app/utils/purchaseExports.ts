import { jsPDF } from 'jspdf';
import jspdfAutoTable from 'jspdf-autotable';
import { generateFastGlobalReportPDF, getGlobalReportSettings, getPdfDesign, getPdfDesignSettings, getPdfTemplateLogo, pdfDesignColor, pdfDesignPaper, renderCuratedTemplateToPdf } from './pdfGenerator';
import { renderPdfTemplateToPdf } from './pdf-template-renderer';
import { getPdfTemplatePartyConfig, getPdfTemplateTarget } from '../services/pdf-document-catalog';
import { sanitizeTemplateDefinition, type PdfTemplateData } from '../services/pdf-template-definition';
import type { PdfDownloadFormat } from './pdfDownloadFormats';
import { buildHumanPdfFileName, buildLabeledPdfFileName } from './exportFileNames';
import { pdfStatusLabel } from './pdfStatus';
import { formatPdfItemDescription } from './pdf-line-details';
import { getBase64Image } from './reportExportUtils';

type PdfRgb = [number, number, number];

type PdfAutoTableOptions = NonNullable<Parameters<typeof jspdfAutoTable>[1]>;

/** Conserva el centrado vertical del estándar también en la salida nativa de respaldo. */
const autoTable = (doc: Parameters<typeof jspdfAutoTable>[0], options: PdfAutoTableOptions) => jspdfAutoTable(doc, {
  ...options,
  styles: { ...options.styles, valign: 'middle' },
  headStyles: { ...options.headStyles, valign: 'middle' },
  bodyStyles: { ...options.bodyStyles, valign: 'middle' },
});

export interface PurchasePdfField {
  label: string;
  value?: unknown;
}

export interface PurchasePdfLine {
  description: string;
  quantity?: number | string;
  unitPrice?: string;
  total?: string;
  secondary?: string;
  code?: string | null;
  productCode?: string | null;
  variantId?: string | null;
  variantSku?: string | null;
  variantName?: string | null;
  variantAttributes?: unknown;
  variant?: Record<string, unknown> | null;
}

export interface PurchasePdfDocument {
  title: string;
  number: string;
  date?: string;
  status?: string;
  supplier?: string;
  supplierData?: Record<string, unknown>;
  fields?: PurchasePdfField[];
  lines?: PurchasePdfLine[];
  totals?: PurchasePdfField[];
  total?: string;
  totalLabel?: string;
  notes?: string;
}

export interface PurchasePdfListColumn {
  label: string;
  value: (row: any) => unknown;
  align?: 'left' | 'center' | 'right';
  width?: number;
}

const standardPaper = (format: PdfDownloadFormat) => {
  if (format === 'roll-80') return 'ROLL-80';
  if (format === 'A4') return 'A4';
  if (format === 'legal') return 'LEGAL';
  if (format === 'oficio') return 'OFICIO';
  return 'LETTER';
};

const withPaperFormat = (settings: Record<string, any>, format: PdfDownloadFormat) => format === 'configured'
  ? settings
  : { ...settings, paperSize: standardPaper(format), orientation: 'portrait' };

const valueText = (value: unknown) => String(value ?? '—');
const purchaseLineDescription = (line: PurchasePdfLine) => {
  const description = formatPdfItemDescription(line, line.description || 'Producto', false);
  return line.secondary ? `${description}\n${line.secondary}` : description;
};
const isRoll = (format: PdfDownloadFormat) => format === 'roll-58' || format === 'roll-80';

const countLines = (doc: jsPDF, value: unknown, size: number, width: number) => {
  doc.setFontSize(size);
  return Math.max(1, doc.splitTextToSize(valueText(value), width).length);
};

function renderRollPdf({ document, tenantName, format, settings }: { document: PurchasePdfDocument; tenantName: string; format: PdfDownloadFormat; settings: Record<string, any> }) {
  const width = format === 'roll-58' ? 58 : 80;
  const margin = width === 58 ? 3 : 4;
  const contentWidth = width - margin * 2;
  const probe = new jsPDF({ unit: 'mm', format: [width, 1000], orientation: 'portrait' });
  const lines = document.lines || [];
  const printableFields = (document.fields || []).filter(field => !/notas?|observaciones?/i.test(field.label));
  const fieldLines = printableFields.reduce((sum, field) => sum + countLines(probe, `${field.label}: ${valueText(field.value)}`, 6.4, contentWidth), 0);
  const itemLines = lines.reduce((sum, line) => sum + countLines(probe, purchaseLineDescription(line), 7.2, contentWidth) + 3, 0);
  const totalRows = (document.totals || []).length + (document.total ? 2 : 0);
  const pageHeight = Math.max(145, 62 + fieldLines * 3.2 + itemLines * 3.5 + totalRows * 4);
  const doc = new jsPDF({ unit: 'mm', format: [width, pageHeight], orientation: 'portrait' });
  const black: PdfRgb = [0, 0, 0];
  const fontName = String(settings.fontFamily || '').toLowerCase().includes('mono') ? 'courier' : 'helvetica';
  const moneyLine = (label: string, value: string, bold = false) => {
    doc.setFont(fontName, bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 8.2 : 6.8);
    doc.text(label, margin, y);
    doc.text(value, width - margin, y, { align: 'right' });
    y += bold ? 5 : 4;
  };
  let y = margin;
  const rule = () => { doc.setDrawColor(...black); doc.setLineWidth(0.3); doc.line(margin, y, width - margin, y); y += 4; };

  doc.setTextColor(...black);
  doc.setFont(fontName, 'bold');
  doc.setFontSize(width === 58 ? 10 : 12);
  const companyName = String(settings.companyName || tenantName || '').trim();
  if (companyName) doc.text(doc.splitTextToSize(companyName, contentWidth), width / 2, y, { align: 'center' });
  y += 6;
  if (settings.slogan) { doc.setFont(fontName, 'normal'); doc.setFontSize(6.2); doc.text(doc.splitTextToSize(String(settings.slogan), contentWidth), width / 2, y, { align: 'center' }); y += 4; }
  rule();
  doc.setFont(fontName, 'bold');
  doc.setFontSize(width === 58 ? 8.5 : 10);
  doc.text(document.title.toUpperCase(), width / 2, y, { align: 'center' });
  y += 4;
  doc.setFont(fontName, 'normal');
  doc.setFontSize(6.8);
  doc.text(`Nº ${document.number || 'Sin número'}`, width / 2, y, { align: 'center' });
  y += 3.5;
  doc.text(`Fecha ${document.date || 'Sin fecha'}`, width / 2, y, { align: 'center' });
  y += 5;
  if (document.supplier) { doc.setFont(fontName, 'bold'); doc.setFontSize(6.5); doc.text('PROVEEDOR', margin, y); y += 3.3; doc.setFont(fontName, 'normal'); doc.setFontSize(7.2); doc.text(doc.splitTextToSize(document.supplier, contentWidth), margin, y); y += countLines(doc, document.supplier, 7.2, contentWidth) * 3.3 + 2; }
  for (const field of printableFields) moneyLine(field.label, valueText(field.value));
  if (document.status) moneyLine('Estado', pdfStatusLabel(document.status), true);
  if (lines.length) {
    rule();
    doc.setFont(fontName, 'bold'); doc.setFontSize(6.5); doc.text('DETALLE', margin, y); y += 4;
    for (const line of lines) {
      doc.setFont(fontName, 'normal'); doc.setFontSize(7.2);
      const descriptionLines = doc.splitTextToSize(purchaseLineDescription(line), contentWidth);
      doc.text(descriptionLines, margin, y); y += descriptionLines.length * 3.5;
      const quantity = line.quantity == null ? '' : `${line.quantity}${line.unitPrice ? ` × ${line.unitPrice}` : ''}`;
      if (quantity) { doc.setFontSize(6.4); doc.text(quantity, margin, y); }
      if (line.total) { doc.setFont(fontName, 'bold'); doc.text(line.total, width - margin, y, { align: 'right' }); }
      y += 4;
      doc.setDrawColor(...black); doc.line(margin, y, width - margin, y); y += 3;
    }
  }
  if ((document.totals || []).length || document.total) {
    rule();
    for (const total of document.totals || []) moneyLine(total.label, valueText(total.value));
    if (document.total) moneyLine(document.totalLabel || 'Total', document.total, true);
  }
  y += 4; rule(); doc.setFont(fontName, 'normal'); doc.setFontSize(5.8); doc.text(doc.splitTextToSize(String(settings.footerText || `Documento generado por ${tenantName}`), contentWidth), width / 2, y, { align: 'center' });
  return doc;
}

export async function generatePurchaseRecordPDF({ document, tenantName, tenantLogo, format = 'configured', targetKey = 'compras.purchase-record', designOverride, allowCuratedTemplate = true }: { document: PurchasePdfDocument; tenantName: string; tenantLogo?: string | null; format?: PdfDownloadFormat; targetKey?: string; designOverride?: any; allowCuratedTemplate?: boolean }) {
  const configuredDesign = designOverride || await getPdfDesign(targetKey);
  const overrideSettings = configuredDesign?.settings && typeof configuredDesign.settings === 'object' ? configuredDesign.settings : null;
  const settings = overrideSettings || await getPdfDesignSettings(targetKey);
  const configuredLogo = getPdfTemplateLogo(settings, tenantLogo, targetKey);
  const resolvedLogo = configuredLogo || (typeof document.supplierData?.logo === 'string' ? document.supplierData.logo : undefined);
  if (!isRoll(format)) {
    const paperSettings = withPaperFormat(settings, format);
    const renderSettings = { paperSize: 'LETTER', orientation: 'portrait' as const, ...paperSettings };
    const fieldData = Object.fromEntries((document.fields || []).map(field => [field.label.toLowerCase().replace(/\s+/g, '_'), valueText(field.value)]));
    const totalsData = Object.fromEntries((document.totals || []).map(field => [field.label.toLowerCase().replace(/\s+/g, '_'), valueText(field.value)]));
    if (document.total) totalsData.total = document.total;
    const fieldSummary = (document.fields || [])
      .filter(field => !/notas?|observaciones?/i.test(field.label) && valueText(field.value).trim())
      .map(field => `${field.label}: ${valueText(field.value)}`)
      .join(' · ');
    const supplier = { ...(document.supplierData || {}), name: document.supplier || document.supplierData?.name || '' };
    const requester = (document.fields || []).find(field => /solicitante|solicitado por|responsable/i.test(field.label));
    const party = targetKey === 'compras.purchase-request'
      ? { ...supplier, name: valueText(requester?.value || document.supplier || supplier.name) }
      : supplier;
    const requestHasPricing = targetKey !== 'compras.purchase-request'
      || (document.lines || []).some(line => Boolean(valueText(line.unitPrice).trim() || valueText(line.total).trim()));
    const tableColumns = targetKey === 'compras.payment-made'
      ? [
        { id: 'description', label: 'Método / referencia', token: 'description', width: 70, align: 'left' as const },
        { id: 'total', label: 'Monto', token: 'total', width: 30, align: 'right' as const },
      ]
      : (targetKey === 'compras.expense' || targetKey === 'compras.recurring-expense')
        ? [
          { id: 'description', label: 'Descripción', token: 'description', width: 50, align: 'left' as const },
          { id: 'unitPrice', label: 'Categoría', token: 'unitPrice', width: 24, align: 'left' as const },
          { id: 'total', label: 'Monto', token: 'total', width: 26, align: 'right' as const },
        ]
        : targetKey === 'compras.purchase-request' && !requestHasPricing
          ? [
            { id: 'description', label: 'Descripción', token: 'description', width: 76, align: 'left' as const },
            { id: 'quantity', label: 'Cant.', token: 'quantity', width: 24, align: 'right' as const },
          ]
          : [
            { id: 'description', label: 'Descripción', token: 'description', width: 52, align: 'left' as const },
            { id: 'quantity', label: 'Cant.', token: 'quantity', width: 12, align: 'right' as const },
            { id: 'unitPrice', label: 'Precio', token: 'unitPrice', width: 18, align: 'right' as const },
            { id: 'total', label: 'Total', token: 'total', width: 18, align: 'right' as const },
          ];
    const data: PdfTemplateData = {
      company: { name: tenantName, fiscalInfo: settings.fiscalInfo, address: settings.address, phone: settings.phone, email: settings.email, slogan: settings.slogan, website: settings.website, footerText: typeof settings.footerText === 'string' ? settings.footerText : '', logo: settings.curatedTemplateSelection ? configuredLogo || tenantLogo : resolvedLogo },
      document: { title: document.title, number: document.number, date: document.date, status: document.status, notes: document.notes || '', extra: fieldSummary },
      supplier,
      party,
      items: (document.lines || []).map(line => ({ description: purchaseLineDescription(line), quantity: line.quantity || '', unitPrice: line.unitPrice || '', total: line.total || '' })),
      rows: (document.lines || []).map(line => ({ description: purchaseLineDescription(line), quantity: line.quantity || '', unitPrice: line.unitPrice || '', total: line.total || '' })),
      totals: { subtotal: totalsData.subtotal || '', tax: totalsData.tax || totalsData.impuesto || totalsData.impuestos || '', discount: totalsData.discount || totalsData.descuento || '', total: totalsData.total || '' },
      tableColumns,
      ...fieldData,
    };
    if (allowCuratedTemplate && settings.curatedTemplateSelection) {
      const rendered = await renderCuratedTemplateToPdf({
        targetKey,
        data: data as Record<string, unknown>,
        fileName: buildLabeledPdfFileName(document.title, document.number, format),
        save: true,
      });
      return rendered.doc;
    }
    const rendered = await renderPdfTemplateToPdf({ definition: sanitizeTemplateDefinition(configuredDesign.layoutZones.definition, targetKey, renderSettings), settings: renderSettings, targetKey, data, fileName: buildLabeledPdfFileName(document.title, document.number, format), save: true });
    return rendered.doc;
  }
  const doc = isRoll(format)
    ? renderRollPdf({ document, tenantName, format, settings })
    : new jsPDF(pdfDesignPaper(withPaperFormat(settings, format)));
  if (!isRoll(format)) {
    const paperSettings = withPaperFormat(settings, format);
    const primary = pdfDesignColor(paperSettings.primaryColor, [16, 185, 129]);
    const text = pdfDesignColor(paperSettings.textColor, [51, 65, 85]);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = Math.max(12, Math.min(20, Number(paperSettings.margins) || 14));
    const nativeLogoSource = getPdfTemplateLogo(paperSettings, tenantLogo, targetKey);
    const nativeLogo = nativeLogoSource?.startsWith('data:') ? nativeLogoSource : nativeLogoSource ? await getBase64Image(nativeLogoSource) : null;
    if (nativeLogo) {
      try { doc.addImage(nativeLogo, 'PNG', margin, 11, 26, 16, undefined, 'FAST'); } catch { /* el reporte continúa sin logo */ }
    }
    const identityX = margin + (nativeLogo ? 32 : 0);
    if (tenantName) { doc.setTextColor(...primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text(tenantName, identityX, 22); }
    doc.setTextColor(...text); doc.setFontSize(12); doc.text(document.title, margin, 30);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(`Nº: ${document.number || 'N/A'}`, pageWidth - margin, 22, { align: 'right' }); doc.text(`Fecha: ${document.date || 'N/A'}`, pageWidth - margin, 28, { align: 'right' });
    if (document.status) doc.text(`Estado: ${pdfStatusLabel(document.status)}`, pageWidth - margin, 34, { align: 'right' });
    const partyConfig = getPdfTemplatePartyConfig(targetKey);
    const requester = (document.fields || []).find(field => /solicitante|solicitado por|responsable/i.test(field.label));
    const partyName = partyConfig.mode === 'requester'
      ? valueText(requester?.value || document.supplier || '')
      : valueText(document.supplier || '');
    const partyLabel = partyConfig.nameLabel || 'Proveedor';
    const fields = partyConfig.mode === 'none'
      ? [...(document.fields || [])]
      : [{ label: partyLabel, value: partyName }, ...(document.fields || [])];
    const uniqueFields = fields.filter(field => !/notas?|observaciones?/i.test(field.label))
      .filter((field, index, all) => field.value !== undefined && (index === 0 || `${field.label}:${field.value}` !== `${all[index - 1].label}:${all[index - 1].value}`));
    autoTable(doc, { startY: 45, head: [['Campo', 'Detalle']], body: uniqueFields.map((field) => [field.label, valueText(field.value)]), theme: 'grid', headStyles: { fillColor: primary, textColor: 255, fontStyle: 'bold' }, bodyStyles: { textColor: text }, columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } }, styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak', valign: 'middle' } });
    let currentY = ((doc as any).lastAutoTable?.finalY || 45) + 8;
    if (document.lines?.length) {
      autoTable(doc, { startY: currentY, head: [['Descripción', 'Cant.', 'Precio U.', 'Total']], body: document.lines.map((line) => [purchaseLineDescription(line), valueText(line.quantity), line.unitPrice || '—', line.total || '—']), theme: 'grid', headStyles: { fillColor: primary, textColor: 255, fontStyle: 'bold', halign: 'center' }, bodyStyles: { textColor: text, fontSize: 8 }, columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 20, halign: 'right' }, 2: { cellWidth: 34, halign: 'right' }, 3: { cellWidth: 34, halign: 'right' } }, styles: { cellPadding: 3, overflow: 'linebreak', valign: 'middle' } });
      currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 8;
    }
    if ((document.totals || []).length || document.total) {
      const totalRows = [...(document.totals || []), ...(document.total ? [{ label: document.totalLabel || 'Total', value: document.total }] : [])];
      autoTable(doc, { startY: currentY, body: totalRows.map((field) => [field.label, valueText(field.value)]), theme: 'plain', columnStyles: { 0: { cellWidth: 65, fontStyle: 'bold', textColor: primary }, 1: { cellWidth: 'auto', halign: 'right', textColor: text, fontStyle: 'bold' } }, styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' } });
      currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 5;
    }
    if (tenantName) { doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.text(`Generado por ${tenantName} - Módulo de Compras`, margin, pageHeight - 10); }
  }
  doc.save(buildLabeledPdfFileName(document.title, document.number, format));
  return doc;
}

export async function generatePurchaseListPDF({ title, rows, columns, tenantName, tenantLogo, format = 'configured', targetKey = 'compras.list', summary, summaryPlacement = 'box', subtitle }: { title: string; rows: any[]; columns: PurchasePdfListColumn[]; tenantName: string; tenantLogo?: string | null; format?: PdfDownloadFormat; targetKey?: string; summary?: { label: string; value: unknown; columnIndex?: number }; summaryPlacement?: 'box' | 'footer'; subtitle?: string }) {
  if (isRoll(format)) throw new Error('Los reportes generales solo están disponibles en tamaños de página PDF.');
  // Cada listado resuelve únicamente su propia plantilla. Si no existe una
  // plantilla personalizada, el generador conserva el diseño predeterminado.
  const requestedTargetKey = getPdfTemplateTarget(targetKey).key;
  const configuredDesign = await getPdfDesign(requestedTargetKey);
  const sourceSettings = configuredDesign?.settings && typeof configuredDesign.settings === 'object'
    ? configuredDesign.settings as Record<string, any>
    : await getPdfDesignSettings(requestedTargetKey);
  const settings = getGlobalReportSettings(sourceSettings, tenantName, tenantLogo, requestedTargetKey);
  const resolvedLogo = getPdfTemplateLogo(settings, tenantLogo, requestedTargetKey) || undefined;
  const paperSettings = withPaperFormat(settings, format === 'configured' ? 'configured' : format);
  const fastGlobal = await generateFastGlobalReportPDF({
    targetKey: requestedTargetKey,
    title,
    tenantName,
    tenantLogo: resolvedLogo,
    settings: paperSettings,
    designOverride: configuredDesign,
    columns,
    rows,
    totals: summary && summaryPlacement !== 'footer' ? { total: valueText(summary.value) } : undefined,
    tableSummary: summary && summaryPlacement === 'footer' ? summary : undefined,
    fileName: buildHumanPdfFileName(title, format === 'configured' ? 'configured' : format),
  });
  return fastGlobal.doc;
}
