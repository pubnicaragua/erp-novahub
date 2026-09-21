import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateFastGlobalReportPDF, getGlobalReportSettings, getPdfDesign, getPdfDesignSettings, getPdfTemplateLogo, pdfDesignColor, pdfDesignPaper } from './pdfGenerator';
import { renderPdfTemplateToPdf } from './pdf-template-renderer';
import { getPdfTemplatePartyConfig, getPdfTemplateTarget } from '../services/pdf-document-catalog';
import { sanitizeTemplateDefinition, type PdfTemplateData } from '../services/pdf-template-definition';
import type { PdfDownloadFormat } from './pdfDownloadFormats';
import { buildPdfFileName } from './exportFileNames';
import { pdfStatusLabel } from './pdfStatus';
import { formatPdfItemDescription } from './pdf-line-details';
import { getBase64Image } from './reportExportUtils';

type PdfRgb = [number, number, number];

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

const isVirtualPdfDesign = (design: any) => Boolean(
  !design
  || design.isSystemDefault
  || design.isSystemDefaultRuntime
  || String(design.id || '').startsWith('system-default:')
  || design.templateKey === 'system-default'
  || design.layoutZones?.status === 'system-default',
);

async function resolveGlobalPurchaseDesign(targetKey: string) {
  const requestedKey = getPdfTemplateTarget(targetKey).key;
  const requestedDesign = await getPdfDesign(requestedKey);
  if (!isVirtualPdfDesign(requestedDesign)) {
    return { targetKey: requestedKey, design: requestedDesign };
  }
  if (requestedKey === 'compras.list') return { targetKey: requestedKey, design: requestedDesign };
  return { targetKey: 'compras.list', design: await getPdfDesign('compras.list') };
}

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
  const fieldLines = (document.fields || []).reduce((sum, field) => sum + countLines(probe, `${field.label}: ${valueText(field.value)}`, 6.4, contentWidth), 0);
  const itemLines = lines.reduce((sum, line) => sum + countLines(probe, purchaseLineDescription(line), 7.2, contentWidth) + 3, 0);
  const notesLines = document.notes ? countLines(probe, `Notas: ${document.notes}`, 6.4, contentWidth) : 0;
  const totalRows = (document.totals || []).length + (document.total ? 2 : 0);
  const pageHeight = Math.max(145, 62 + fieldLines * 3.2 + itemLines * 3.5 + totalRows * 4 + notesLines * 3.2);
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
  doc.text(doc.splitTextToSize(String(settings.companyName || tenantName || 'Nuestra Empresa'), contentWidth), width / 2, y, { align: 'center' });
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
  for (const field of document.fields || []) moneyLine(field.label, valueText(field.value));
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
  if (document.notes) { y += 2; doc.setFont(fontName, 'normal'); doc.setFontSize(6.4); doc.text(doc.splitTextToSize(`Notas: ${document.notes}`, contentWidth), margin, y); y += notesLines * 3.2; }
  y += 4; rule(); doc.setFont(fontName, 'normal'); doc.setFontSize(5.8); doc.text(doc.splitTextToSize(String(settings.footerText || `Documento generado por ${tenantName}`), contentWidth), width / 2, y, { align: 'center' });
  return doc;
}

export async function generatePurchaseRecordPDF({ document, tenantName, tenantLogo, format = 'configured', targetKey = 'compras.purchase-record', designOverride }: { document: PurchasePdfDocument; tenantName: string; tenantLogo?: string | null; format?: PdfDownloadFormat; targetKey?: string; designOverride?: any }) {
  const configuredDesign = designOverride || await getPdfDesign(targetKey);
  const overrideSettings = configuredDesign?.settings && typeof configuredDesign.settings === 'object' ? configuredDesign.settings : null;
  const settings = overrideSettings || await getPdfDesignSettings(targetKey);
  const configuredLogo = getPdfTemplateLogo(settings, tenantLogo, targetKey);
  const resolvedLogo = configuredLogo || (typeof document.supplierData?.logo === 'string' ? document.supplierData.logo : undefined);
  if (format !== 'roll-58') {
    const paperSettings = withPaperFormat(settings, format);
    const renderSettings = { paperSize: 'LETTER', orientation: 'portrait' as const, ...paperSettings };
    const fieldData = Object.fromEntries((document.fields || []).map(field => [field.label.toLowerCase().replace(/\s+/g, '_'), valueText(field.value)]));
    const totalsData = Object.fromEntries((document.totals || []).map(field => [field.label.toLowerCase().replace(/\s+/g, '_'), valueText(field.value)]));
    if (document.total) totalsData.total = document.total;
    const fieldSummary = (document.fields || []).map(field => `${field.label}: ${valueText(field.value)}`).join(' · ');
    const notes = [document.notes, fieldSummary].filter(Boolean).join(' · ');
    const supplier = { ...(document.supplierData || {}), name: document.supplier || document.supplierData?.name || '' };
    const requester = (document.fields || []).find(field => /solicitante|solicitado por|responsable/i.test(field.label));
    const party = targetKey === 'compras.purchase-request'
      ? { ...supplier, name: valueText(requester?.value || document.supplier || supplier.name) }
      : supplier;
    const data: PdfTemplateData = {
      company: { name: tenantName, fiscalInfo: settings.fiscalInfo, address: settings.address, phone: settings.phone, email: settings.email, slogan: settings.slogan, website: settings.website, logo: resolvedLogo },
      document: { title: document.title, number: document.number, date: document.date, status: document.status, notes },
      supplier,
      party,
      items: (document.lines || []).map(line => ({ description: purchaseLineDescription(line), quantity: line.quantity || '', unitPrice: line.unitPrice || '', total: line.total || '' })),
      rows: (document.lines || []).map(line => ({ description: purchaseLineDescription(line), quantity: line.quantity || '', unitPrice: line.unitPrice || '', total: line.total || '' })),
      totals: { subtotal: totalsData.subtotal || '', tax: totalsData.tax || totalsData.impuesto || totalsData.impuestos || '', discount: totalsData.discount || totalsData.descuento || '', total: totalsData.total || '' },
      tableColumns: [
        { id: 'description', label: 'Descripción', token: 'description', width: 48, align: 'left' },
        { id: 'quantity', label: 'Cant.', token: 'quantity', width: 14, align: 'right' },
        { id: 'unitPrice', label: 'Precio', token: 'unitPrice', width: 19, align: 'right' },
        { id: 'total', label: 'Total', token: 'total', width: 19, align: 'right' },
      ],
      ...fieldData,
    };
    const rendered = await renderPdfTemplateToPdf({ definition: sanitizeTemplateDefinition(configuredDesign?.layoutZones?.definition, targetKey, renderSettings), settings: renderSettings, targetKey, data, fileName: buildPdfFileName([document.title, document.number || 'sin_numero'], format), save: true });
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
    doc.setTextColor(...primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text(tenantName || 'Nova Hub', identityX, 22);
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
    const uniqueFields = fields.filter((field, index, all) => field.value !== undefined && (index === 0 || `${field.label}:${field.value}` !== `${all[index - 1].label}:${all[index - 1].value}`));
    autoTable(doc, { startY: 45, head: [['Campo', 'Detalle']], body: uniqueFields.map((field) => [field.label, valueText(field.value)]), theme: 'grid', headStyles: { fillColor: primary, textColor: 255, fontStyle: 'bold' }, bodyStyles: { textColor: text }, columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } }, styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' } });
    let currentY = ((doc as any).lastAutoTable?.finalY || 45) + 8;
    if (document.lines?.length) {
      autoTable(doc, { startY: currentY, head: [['Descripción', 'Cant.', 'Precio U.', 'Total']], body: document.lines.map((line) => [purchaseLineDescription(line), valueText(line.quantity), line.unitPrice || '—', line.total || '—']), theme: 'grid', headStyles: { fillColor: primary, textColor: 255, fontStyle: 'bold', halign: 'center' }, bodyStyles: { textColor: text, fontSize: 8 }, columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 20, halign: 'right' }, 2: { cellWidth: 34, halign: 'right' }, 3: { cellWidth: 34, halign: 'right' } }, styles: { cellPadding: 3, overflow: 'linebreak' } });
      currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 8;
    }
    if ((document.totals || []).length || document.total) {
      const totalRows = [...(document.totals || []), ...(document.total ? [{ label: document.totalLabel || 'Total', value: document.total }] : [])];
      autoTable(doc, { startY: currentY, body: totalRows.map((field) => [field.label, valueText(field.value)]), theme: 'plain', columnStyles: { 0: { cellWidth: 65, fontStyle: 'bold', textColor: primary }, 1: { cellWidth: 'auto', halign: 'right', textColor: text, fontStyle: 'bold' } }, styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' } });
      currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 5;
    }
    if (document.notes) { doc.setTextColor(...text); doc.setFontSize(8); doc.text(doc.splitTextToSize(`Notas: ${document.notes}`, pageWidth - margin * 2), margin, currentY); }
    doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.text(`Generado por ${tenantName || 'Nova Hub'} - Módulo de Compras`, margin, pageHeight - 10);
  }
  doc.save(buildPdfFileName([document.title, document.number || 'sin_numero'], format));
  return doc;
}

export async function generatePurchaseListPDF({ title, rows, columns, tenantName, tenantLogo, format = 'configured', targetKey = 'compras.list', summary, summaryPlacement = 'box' }: { title: string; rows: any[]; columns: PurchasePdfListColumn[]; tenantName: string; tenantLogo?: string | null; format?: PdfDownloadFormat; targetKey?: string; summary?: { label: string; value: unknown; columnIndex?: number }; summaryPlacement?: 'box' | 'footer' }) {
  if (isRoll(format)) throw new Error('Los reportes generales solo están disponibles en tamaños de página PDF.');
  // La plantilla se resuelve por la salida real. Si esa salida aún no tiene
  // diseño propio, se usa la plantilla global de listados como respaldo para
  // conservar la estructura de reporte y no reservar datos individuales.
  const resolvedDesign = await resolveGlobalPurchaseDesign(targetKey);
  const sourceTargetKey = resolvedDesign.targetKey;
  const configuredDesign = resolvedDesign.design;
  const sourceSettings = configuredDesign?.settings && typeof configuredDesign.settings === 'object'
    ? configuredDesign.settings as Record<string, any>
    : await getPdfDesignSettings(sourceTargetKey);
  const requestedTargetKey = getPdfTemplateTarget(targetKey).key;
  const settings = getGlobalReportSettings(
    // Si se usa compras.list como respaldo, su logo personalizado pertenece
    // solo a esa plantilla y no debe propagarse a los demás listados.
    sourceTargetKey === requestedTargetKey ? sourceSettings : { ...sourceSettings, templateLogoUrl: undefined, templateLogoUri: undefined, templateLogoTarget: undefined },
    tenantName,
    tenantLogo,
    sourceTargetKey,
  );
  const resolvedLogo = getPdfTemplateLogo(settings, tenantLogo, sourceTargetKey) || undefined;
  const paperSettings = withPaperFormat(settings, format === 'configured' ? 'configured' : format);
  const fastGlobal = await generateFastGlobalReportPDF({
    targetKey: requestedTargetKey,
    title,
    tenantName,
    tenantLogo: resolvedLogo,
    settings: paperSettings,
    columns,
    rows,
    totals: summary && summaryPlacement !== 'footer' ? { total: valueText(summary.value) } : undefined,
    tableSummary: summary && summaryPlacement === 'footer' ? summary : undefined,
    fileName: buildPdfFileName([title], format === 'configured' ? 'configured' : format),
  });
  return fastGlobal.doc;
}
