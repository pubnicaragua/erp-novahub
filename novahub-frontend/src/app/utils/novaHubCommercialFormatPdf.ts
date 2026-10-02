import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getReadableForeground } from './color-contrast';
import { getBase64Image } from './export-utils';
import { resolveActiveBrandColor, resolveActiveBrandLogo } from './novaHubFormatPdf';
import { getSalesAdditionalCharges } from './salesCharges';
import { buildSalesPdfFileName } from './exportFileNames';
import { isEstimateCustomFieldExpired, normalizeEstimateImages } from '../types';

export interface GenerateNovaHubCommercialPDFParams {
  estimate: any;
  tenantName: string;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
  tenantLogo?: string | null;
  documentType?: string;
  save?: boolean;
  withImages?: boolean;
}

type Rgb = [number, number, number];

function truncatePdfText(doc: jsPDF, text: string, maxWidth: number): string {
  if (!text || doc.getTextWidth(text) <= maxWidth) return text || '';
  let truncated = text;
  while (truncated.length > 3 && doc.getTextWidth(`${truncated}...`) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}...`;
}

function fitPdfImage(doc: jsPDF, image: string, maxWidth: number, maxHeight: number) {
  let ratio = 2;
  try {
    const properties = doc.getImageProperties(image);
    if (Number(properties.width) > 0 && Number(properties.height) > 0) {
      ratio = Number(properties.width) / Number(properties.height);
    }
  } catch {
    // Si la imagen no expone dimensiones, se usa un aspect ratio estándar 2:1
  }
  const width = Math.min(maxWidth, maxHeight * ratio);
  const height = width / ratio;
  return { width, height };
}

function savePdfBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatCommercialLineDescription(item: any, fallback = 'Producto'): string {
  const desc = String(item?.description || item?.name || item?.product?.name || fallback).trim();
  
  // Extraer atributos de la variante
  const variant = item?.variant || item?.productVariant || item?.product?.variant;
  const variantAttributes = (item?.variantAttributes ?? variant?.attributes);
  
  let attributesText = '';
  if (Array.isArray(variantAttributes)) {
    attributesText = variantAttributes.map((attr: any) => {
      if (!attr || typeof attr !== 'object') return String(attr || '');
      const label = String(attr.attributeName ?? attr.name ?? attr.label ?? attr.attribute ?? attr.key ?? '').trim();
      const val = String(attr.value ?? attr.valor ?? attr.optionName ?? attr.option ?? attr.selectedValue ?? '').trim();
      return label && val ? `${label}: ${val}` : (val || label);
    }).filter(Boolean).join(' · ');
  } else if (variantAttributes && typeof variantAttributes === 'object') {
    attributesText = Object.entries(variantAttributes)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
  } else if (typeof variantAttributes === 'string' && variantAttributes.trim()) {
    try {
      const parsed = JSON.parse(variantAttributes);
      if (Array.isArray(parsed)) {
        attributesText = parsed.map((attr: any) => {
          if (!attr || typeof attr !== 'object') return String(attr || '');
          const label = String(attr.attributeName ?? attr.name ?? attr.label ?? '').trim();
          const val = String(attr.value ?? attr.optionName ?? '').trim();
          return label && val ? `${label}: ${val}` : (val || label);
        }).filter(Boolean).join(' · ');
      }
    } catch {
      attributesText = variantAttributes.trim();
    }
  }

  // Si no hay atributos estructurados pero hay un nombre de variante que no sea "Estándar" ni "Default"
  const rawVariantName = String(item?.variantName || variant?.name || '').trim();
  const isGenericVariant = !rawVariantName || ['estándar', 'estandar', 'standard', 'default', 'predeterminado', 'único', 'unico'].includes(rawVariantName.toLowerCase());
  
  const variantInfo = attributesText 
    ? `Atributos: ${attributesText}` 
    : (!isGenericVariant ? `Variante: ${rawVariantName}` : '');

  const commercialNote = String(item?.commercialNoteSnapshot || item?.commercialNote || item?.product?.commercialNoteSnapshot || item?.product?.commercialNote || '').trim();

  return [
    desc,
    variantInfo,
    commercialNote ? `Nota: ${commercialNote}` : '',
  ].filter(Boolean).join('\n');
}

/**
 * Anexo corporativo para imágenes y renders adjuntos a la cotización
 */
async function appendNovaHubImagesAnnex({
  doc,
  images,
  primaryColor,
  textColor,
  tenantName,
  documentTitle,
  documentNumber,
}: {
  doc: jsPDF;
  images: unknown;
  primaryColor: Rgb;
  textColor: Rgb;
  tenantName: string;
  documentTitle: string;
  documentNumber: string;
}) {
  const normalized = normalizeEstimateImages(images);
  if (normalized.items.length === 0) return;

  const validImages = normalized.items.filter((img) => img && typeof img.url === 'string' && img.url.trim());
  if (validImages.length === 0) return;

  // Precargar las imágenes válidas en Base64
  const loadedImages: Array<{
    id: string;
    url: string;
    name: string;
    title?: string;
    description?: string;
    caption?: string;
    showFileName?: boolean;
    base64Data: string;
  }> = [];

  for (const item of validImages) {
    try {
      const base64Data = item.url.startsWith('data:') ? item.url : await getBase64Image(item.url);
      if (base64Data) {
        loadedImages.push({
          ...item,
          title: item.title || item.caption || '',
          description: item.description || (item.title && item.title !== item.caption ? item.caption : '') || '',
          base64Data,
        });
      }
    } catch {
      // Ignorar imágenes inaccesibles
    }
  }

  if (loadedImages.length === 0) return;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const startY = margin + 14;
  const footerSafeY = pageHeight - 15;
  const availableHeight = footerSafeY - startY;

  const columns = normalized.columns;
  const size = normalized.size;
  const showFileName = normalized.showFileName;

  let maxPerPage = 6;
  let cardWidth = contentWidth;
  let defaultCardHeight = 90;
  const colGap = 5;
  const rowGap = 5;

  if (columns === 1) {
    cardWidth = contentWidth;
    if (size === 'large') {
      maxPerPage = 1;
      defaultCardHeight = Math.min(185, availableHeight - 4);
    } else if (size === 'small') {
      maxPerPage = 3;
      defaultCardHeight = 72;
    } else {
      maxPerPage = 2;
      defaultCardHeight = 105;
    }
  } else if (columns === 3) {
    // 3 productos / imágenes por fila
    cardWidth = (contentWidth - colGap * 2) / 3;
    if (size === 'large') {
      maxPerPage = 6; // 2 filas de 3
      defaultCardHeight = 98;
    } else if (size === 'small') {
      maxPerPage = 12; // 4 filas de 3 (entran 9 o 12 fácilmente en una sola hoja)
      defaultCardHeight = 56;
    } else {
      // medium
      maxPerPage = 9; // 3 filas de 3 (entran 9 en una sola página de anexo)
      defaultCardHeight = 72;
    }
  } else {
    // 2 productos / imágenes por fila
    cardWidth = (contentWidth - colGap) / 2;
    if (size === 'large') {
      maxPerPage = 2;
      defaultCardHeight = 120;
    } else if (size === 'small') {
      maxPerPage = 6;
      defaultCardHeight = 68;
    } else {
      maxPerPage = 4;
      defaultCardHeight = 88;
    }
  }

  const totalPages = Math.ceil(loadedImages.length / maxPerPage);

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    const pageItems = loadedImages.slice(pageIndex * maxPerPage, (pageIndex + 1) * maxPerPage);
    if (pageItems.length === 0) continue;

    doc.addPage('letter', 'portrait');

    // Barra de acento
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(margin, margin, contentWidth, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('ANEXO: ESPECIFICACIONES VISUALES Y RENDERS', margin, margin + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const pageIndicator = totalPages > 1 ? ` · Pág. ${pageIndex + 1} de ${totalPages}` : '';
    const countIndicator = `${loadedImages.length} ${loadedImages.length === 1 ? 'imagen adjunta' : 'imágenes adjuntas'}`;
    const headerInfo = [
      documentTitle,
      documentNumber ? `Nº ${documentNumber}` : '',
      countIndicator,
    ].filter(Boolean).join(' · ') + pageIndicator;
    doc.text(headerInfo, pageWidth - margin, margin + 8, { align: 'right' });

    // Separador superior
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, margin + 11, pageWidth - margin, margin + 11);

    let currentCardHeight = defaultCardHeight;

    for (let i = 0; i < pageItems.length; i += 1) {
      const item = pageItems[i];
      const globalIndex = pageIndex * maxPerPage + i;
      let cardX = margin;
      let cardY = startY;

      if (columns === 1) {
        cardX = margin;
        cardY = startY + i * (currentCardHeight + rowGap);
      } else if (columns === 3) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        cardX = margin + col * (cardWidth + colGap);
        cardY = startY + row * (currentCardHeight + rowGap);
      } else {
        const col = i % 2;
        const row = Math.floor(i / 2);
        cardX = margin + col * (cardWidth + colGap);
        cardY = startY + row * (currentCardHeight + rowGap);
      }

      // Tarjeta contenedora
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(cardX, cardY, cardWidth, currentCardHeight, 2, 2, 'FD');

      const pad = columns === 3 ? 3.5 : 4.5;
      const innerW = cardWidth - pad * 2;

      // Badge superior con título
      const displayTitle = item.title?.trim() || item.caption?.trim() || `IMAGEN ${globalIndex + 1}`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(columns === 3 ? 6.2 : 6.8);
      const titleTextWidth = doc.getTextWidth(displayTitle);
      const maxBadgeW = showFileName ? innerW - 30 : innerW - 8;
      const badgeW = Math.min(maxBadgeW, Math.max(18, titleTextWidth + 5));
      const badgeH = columns === 3 ? 4.0 : 4.6;

      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.roundedRect(cardX + pad, cardY + pad, badgeW, badgeH, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      const clippedTitle = truncatePdfText(doc, displayTitle, badgeW - 3);
      doc.text(clippedTitle, cardX + pad + badgeW / 2, cardY + pad + (columns === 3 ? 2.8 : 3.2), { align: 'center' });

      // Nombre del archivo si está activo
      if (showFileName && item.name?.trim()) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(columns === 3 ? 5.8 : 6.5);
        doc.setTextColor(100, 116, 139);
        const maxNameW = innerW - badgeW - 3;
        const truncatedName = truncatePdfText(doc, item.name.trim(), maxNameW);
        doc.text(truncatedName, cardX + cardWidth - pad, cardY + pad + (columns === 3 ? 2.8 : 3.2), { align: 'right' });
      }

      // Preparar descripción
      const descText = item.description?.trim() || '';
      const maxDescLines = columns === 1 ? 4 : columns === 3 ? 2 : 3;
      const descLines = descText ? doc.splitTextToSize(descText, innerW).slice(0, maxDescLines) : [];
      const descLineHeight = columns === 1 ? 3.6 : columns === 3 ? 2.8 : 3.2;
      const descHeight = descLines.length > 0 ? descLines.length * descLineHeight + 1 : 4;
      const textBlockHeight = Math.max(6, descHeight);

      // Marco para la imagen
      const frameX = cardX + pad;
      const frameY = cardY + pad + badgeH + 2.0;
      const minFrameH = columns === 3 ? 26 : 35;
      const frameH = Math.max(minFrameH, currentCardHeight - (pad * 2 + badgeH + 3.5 + textBlockHeight));

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(frameX, frameY, innerW, frameH, 1.5, 1.5, 'FD');

      const imgPadding = 2;
      const maxImgW = innerW - imgPadding * 2;
      const maxImgH = frameH - imgPadding * 2;
      const fitted = fitPdfImage(doc, item.base64Data, maxImgW, maxImgH);

      const imgX = frameX + (innerW - fitted.width) / 2;
      const imgY = frameY + (frameH - fitted.height) / 2;

      try {
        doc.addImage(item.base64Data, 'PNG', imgX, imgY, fitted.width, fitted.height, undefined, 'FAST');
      } catch {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text('No fue posible renderizar la imagen', frameX + innerW / 2, frameY + frameH / 2, { align: 'center' });
      }

      // Separador sutil
      const sepY = frameY + frameH + 2;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(cardX + pad, sepY, cardX + cardWidth - pad, sepY);

      // Descripción
      const cursorY = sepY + 3.4;
      if (descLines.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(columns === 1 ? 7.6 : 6.8);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(descLines, cardX + pad, cursorY);
      } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text('Especificación visual adjunta', cardX + pad, cursorY);
      }
    }

    // Pie de página institucional del anexo
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    if (tenantName) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Documento generado por ${tenantName}  ·  NovaHubFormat`, margin, pageHeight - 7);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('NovaHub ERP · Especificaciones visuales', pageWidth - margin, pageHeight - 7, { align: 'right' });
  }
}

interface CommercialDocConfig {
  cardTitle: string;
  subtitle: string;
  annexTitle: string;
}

function getCommercialDocConfig(documentType: string): CommercialDocConfig {
  switch (documentType) {
    case 'order':
      return {
        cardTitle: 'ORDEN DE VENTA',
        subtitle: 'Sistema de Gestión Empresarial · Orden de Venta Oficial',
        annexTitle: 'Orden de Venta',
      };
    case 'invoice':
      return {
        cardTitle: 'FACTURA',
        subtitle: 'Sistema de Gestión Empresarial · Factura Comercial Oficial',
        annexTitle: 'Factura',
      };
    case 'recurring':
      return {
        cardTitle: 'FACTURA RECURRENTE',
        subtitle: 'Sistema de Gestión Empresarial · Factura Recurrente Oficial',
        annexTitle: 'Factura Recurrente',
      };
    case 'payment':
      return {
        cardTitle: 'COMPROBANTE DE PAGO',
        subtitle: 'Sistema de Gestión Empresarial · Comprobante de Pago Oficial',
        annexTitle: 'Comprobante de Pago',
      };
    case 'return':
      return {
        cardTitle: 'NOTA DE CRÉDITO',
        subtitle: 'Sistema de Gestión Empresarial · Nota de Crédito / Devolución',
        annexTitle: 'Nota de Crédito',
      };
    case 'credit-note':
      return {
        cardTitle: 'CRÉDITO',
        subtitle: 'Sistema de Gestión Empresarial · Documento de Crédito Oficial',
        annexTitle: 'Crédito',
      };
    case 'estimate':
    default:
      return {
        cardTitle: 'COTIZACIÓN',
        subtitle: 'Sistema de Gestión Empresarial · Cotización Comercial Oficial',
        annexTitle: 'Cotización',
      };
  }
}

function translateSalesStatus(status: unknown, documentType: string): string {
  const s = String(status || '').trim().toUpperCase();
  if (!s) return '';
  if (s === 'PAID' && documentType === 'credit-note') return 'Cancelado';
  const map: Record<string, string> = {
    DRAFT: 'Borrador',
    IN_PROCESS: 'En proceso',
    IN_PROGRESS: 'En proceso',
    SENT: 'Enviada',
    APPROVED: 'Aprobada',
    CONFIRMED: 'Confirmada',
    DELIVERED: 'Entregada',
    SHIPPED: 'Enviada',
    CONVERTED_TO_ORDER: 'Convertida a orden',
    PAID: 'Pagada',
    PARTIAL: 'Pago parcial',
    PENDING: 'Pendiente',
    CREDIT: 'A crédito',
    OVERDUE: 'Vencida',
    ACTIVE: 'Activa',
    PAUSED: 'Pausada',
    EXPIRED: 'Vencida',
    PROCESSED: 'Aplicada',
    APPLIED: 'Aplicada',
    ISSUED: 'Emitida',
    CANCELLED: 'Anulada',
    VOIDED: 'Anulada',
    REJECTED: 'Rechazada',
  };
  return map[s] || String(status);
}

function translatePaymentMethod(method: unknown): string {
  const m = String(method || '').trim().toUpperCase();
  const map: Record<string, string> = {
    CASH: 'Efectivo',
    EFECTIVO: 'Efectivo',
    CARD: 'Tarjeta',
    TARJETA: 'Tarjeta',
    TRANSFER: 'Transferencia',
    TRANSFERENCIA: 'Transferencia',
    CHECK: 'Cheque',
    CHEQUE: 'Cheque',
    CREDIT: 'Crédito',
    MIXED: 'Mixto',
    OTHER: 'Otro',
  };
  return map[m] || (m ? String(method) : 'Efectivo');
}

function translateFrequency(freq: unknown): string {
  const f = String(freq || '').trim().toUpperCase();
  const map: Record<string, string> = {
    DAILY: 'Diaria',
    WEEKLY: 'Semanal',
    BIWEEKLY: 'Quincenal',
    MONTHLY: 'Mensual',
    QUARTERLY: 'Trimestral',
    YEARLY: 'Anual',
  };
  return map[f] || (f ? String(freq) : 'Mensual');
}

function buildNovaHubPaymentContext(transaction: any) {
  const isCreditLink = Boolean(transaction?.creditNote || transaction?.creditNoteId);
  const linkedDocument = isCreditLink
    ? transaction?.creditNote || transaction?.invoice || null
    : transaction?.invoice || transaction?.creditNote || null;
  const linkedDocumentType = isCreditLink
    ? 'Crédito'
    : transaction?.invoice || transaction?.invoiceId
      ? 'Factura'
      : 'Anticipo';
  const linkedDocumentNumber = linkedDocument?.number
    || transaction?.invoiceNumber
    || transaction?.creditNoteNumber
    || (linkedDocumentType === 'Anticipo' ? 'Sin documento' : 'Sin número');

  const rawRows = Array.isArray(transaction?.payments) && transaction.payments.length
    ? transaction.payments
    : [transaction];
  const paymentRows = rawRows.filter((r: any) => r && typeof r === 'object');

  const documentTotal = Number(linkedDocument?.total || 0);
  const financialDocument = transaction?.invoice || linkedDocument?.invoice || linkedDocument || null;
  const financialTotal = Number(financialDocument?.total || documentTotal || 0);
  const financialCurrency = String(financialDocument?.currency || linkedDocument?.currency || transaction?.currency || 'NIO').toUpperCase();
  const financialRate = Number(financialDocument?.exchangeRate || linkedDocument?.exchangeRate || transaction?.exchangeRate || 1) || 1;
  const linkedCurrency = String(linkedDocument?.currency || transaction?.currency || 'NIO').toUpperCase();
  const linkedRate = Number(linkedDocument?.exchangeRate || transaction?.exchangeRate || 1) || 1;

  const paidInLinkedCurrency = paymentRows.reduce((sum: number, row: any) => {
    const amount = Number(row.amount || 0);
    const rowCurrency = String(row.currency || transaction?.currency || linkedCurrency).toUpperCase();
    if (rowCurrency === linkedCurrency) return sum + amount;
    const baseAmount = Number(row.baseAmount ?? (rowCurrency === 'USD' ? amount * Number(row.exchangeRate || 1) : amount));
    return sum + (linkedCurrency === 'USD' ? baseAmount / linkedRate : baseAmount);
  }, 0);

  const explicitBalance = transaction?.remaining ?? transaction?.pendingBalance;
  const hasExplicitBalance = explicitBalance !== undefined && explicitBalance !== null && Number.isFinite(Number(explicitBalance));
  const reportedBalance = hasExplicitBalance
    ? Math.max(0, Number(explicitBalance))
    : Number(linkedDocument?.balance || 0);
  const linkedAmountPaid = Number(linkedDocument?.amountPaid);
  const accumulatedLinkedPayment = Number.isFinite(linkedAmountPaid) ? Math.max(0, linkedAmountPaid) : 0;
  const derivedBalance = documentTotal > 0
    ? Math.max(0, documentTotal - Math.max(paidInLinkedCurrency, accumulatedLinkedPayment))
    : 0;
  const effectiveBalance = hasExplicitBalance || reportedBalance > 0.01 ? reportedBalance : derivedBalance;
  const isCreditSettled = isCreditLink && effectiveBalance <= 0.01;
  const explicitLabel = String(transaction?.paymentLabel || transaction?.operationLabel || '').trim();
  const linkedStatus = String(linkedDocument?.status || '').toUpperCase();
  const isPartial = !isCreditSettled && (
    effectiveBalance > 0.01
    || (!hasExplicitBalance && (/parcial|abono/i.test(explicitLabel)
      || linkedStatus === 'PARTIAL'
      || (documentTotal > 0 && paidInLinkedCurrency + 0.01 < documentTotal)))
  );
  const accumulatedPaid = financialTotal > 0
    ? Math.min(financialTotal, Math.max(0, financialTotal - effectiveBalance))
    : paidInLinkedCurrency;
  const operation = linkedDocument
    ? isPartial ? 'Abono parcial' : 'Pago completo'
    : 'Pago recibido';
  const statusLabel = isCreditSettled ? 'Cancelado' : isPartial ? 'Saldo pendiente' : linkedDocument ? 'Liquidado' : 'Registrado';

  const voucherCurrency = String(transaction?.currency || linkedCurrency || 'NIO').toUpperCase();
  const voucherRate = Number(transaction?.exchangeRate || linkedRate || 1);
  const voucherTotal = Number(transaction?.total ?? transaction?.amount ?? paymentRows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0));
  const changeAmount = Math.max(0, Number(transaction?.change ?? transaction?.changeAmount ?? 0));

  return {
    linkedDocument,
    linkedDocumentType,
    linkedDocumentNumber,
    operation,
    statusLabel,
    paymentRows,
    financialTotal,
    financialCurrency,
    financialRate,
    effectiveBalance,
    accumulatedPaid,
    voucherCurrency,
    voucherRate,
    voucherTotal,
    changeAmount,
  };
}

function buildDocumentMetaLines(estimate: any, documentType: string): string[] {
  const lines: string[] = [];
  const issueDate = estimate.date ? new Date(estimate.date).toLocaleDateString('es-NI') : new Date().toLocaleDateString('es-NI');
  const currencyStr = String(estimate.currency || 'NIO').toUpperCase();
  const statusStr = translateSalesStatus(estimate.status, documentType);
  const sellerName = estimate.salesRep || estimate.seller?.name || estimate.userName;

  if (documentType === 'payment') {
    const pCtx = buildNovaHubPaymentContext(estimate);
    lines.push(`Fecha: ${issueDate}`);
    lines.push(`Operación: ${pCtx.operation}`);
    lines.push(`${pCtx.linkedDocumentType}: ${pCtx.linkedDocumentNumber}`);
    lines.push(`Estado: ${pCtx.statusLabel}`);
    lines.push(`Moneda: ${currencyStr}`);
    return lines;
  }

  if (documentType === 'recurring') {
    const startStr = estimate.startDate ? new Date(estimate.startDate).toLocaleDateString('es-NI') : issueDate;
    const nextStr = estimate.nextInvoiceDate ? new Date(estimate.nextInvoiceDate).toLocaleDateString('es-NI') : 'Pendiente';
    lines.push(`Inicio: ${startStr}`);
    lines.push(`Próx. emisión: ${nextStr}`);
    lines.push(`Frecuencia: ${translateFrequency(estimate.frequency)}`);
    if (statusStr) lines.push(`Estado: ${statusStr}`);
    lines.push(`Moneda: ${currencyStr}`);
    return lines;
  }

  lines.push(`Emisión: ${issueDate}`);

  if (documentType === 'estimate') {
    const expiryDateVal = estimate.expiryDate || estimate.validUntil;
    const expiryDateStr = expiryDateVal ? new Date(expiryDateVal).toLocaleDateString('es-NI') : '30 días';
    lines.push(`Válida hasta: ${expiryDateStr}`);
    if (statusStr) lines.push(`Estado: ${statusStr}`);
  } else if (documentType === 'order') {
    const delivVal = estimate.deliveryDate || estimate.expectedDelivery;
    if (delivVal) {
      lines.push(`Entrega est.: ${new Date(delivVal).toLocaleDateString('es-NI')}`);
    }
    if (statusStr) lines.push(`Estado: ${statusStr}`);
    const relInv = estimate.invoice?.number || estimate.invoiceNumber;
    if (relInv) lines.push(`Factura: ${relInv}`);
  } else if (documentType === 'invoice') {
    const dueVal = estimate.dueDate;
    lines.push(`Vencimiento: ${dueVal ? new Date(dueVal).toLocaleDateString('es-NI') : 'Contado'}`);
    if (statusStr) lines.push(`Estado: ${statusStr}`);
    if (estimate.paymentMethod) {
      lines.push(`Cobro: ${translatePaymentMethod(estimate.paymentMethod)}`);
    }
  } else if (documentType === 'return') {
    const origInv = estimate.invoice?.number || estimate.invoiceNumber;
    if (origInv) lines.push(`Factura orig.: ${origInv}`);
    if (statusStr) lines.push(`Estado: ${statusStr}`);
  } else if (documentType === 'credit-note') {
    const dueVal = estimate.dueDate;
    if (dueVal) lines.push(`Vencimiento: ${new Date(dueVal).toLocaleDateString('es-NI')}`);
    const origInv = estimate.invoice?.number || estimate.invoiceNumber;
    if (origInv) lines.push(`Factura orig.: ${origInv}`);
    if (statusStr) lines.push(`Estado: ${statusStr}`);
  }

  lines.push(`Moneda: ${currencyStr}`);
  if (sellerName) {
    lines.push(`Vendedor: ${sellerName}`);
  }

  return lines;
}

/**
 * Generador exclusivo e independiente para Cotizaciones y documentos comerciales con "NovaHubFormat".
 * No depende de plantillas de lienzo, no se deforma, y asume la identidad de marca oficial (Marca y Tema).
 */
export async function generateNovaHubCommercialPDF({
  estimate,
  tenantName,
  formatAmount,
  tenantLogo,
  documentType = 'estimate',
  save = true,
  withImages = true,
}: GenerateNovaHubCommercialPDFParams): Promise<{ doc: jsPDF; blob: Blob }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter', // 215.9 x 279.4 mm
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const docConfig = getCommercialDocConfig(documentType);

  // 1. Resolver paleta corporativa desde la identidad de Marca y Tema
  const primaryRgb = resolveActiveBrandColor();
  const primaryHex = `#${primaryRgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  const isLightForeground = getReadableForeground(primaryHex) === '#ffffff';
  const primaryFgRgb: Rgb = isLightForeground ? [255, 255, 255] : [15, 23, 42];

  const textColor: Rgb = [30, 41, 59]; // slate-800
  const mutedTextColor: Rgb = [100, 116, 139]; // slate-500
  const lineColor: Rgb = [226, 232, 240]; // slate-200

  // 2. Resolver logotipo corporativo activo (con fallback a sesión/servidor antes de NovaHub)
  const resolvedLogoData = await resolveActiveBrandLogo(tenantLogo);

  // --- ENCABEZADO CORPORATIVO NOVAHUB ---
  let headerY = margin;

  // Barra de acento superior de la marca
  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.rect(margin, headerY, contentWidth, 3, 'F');
  headerY += 6;

  // Logo de la empresa
  const logoHeight = 15;
  const logoWidth = 15;
  let logoOffset = 0;

  if (resolvedLogoData) {
    try {
      doc.addImage(resolvedLogoData, 'PNG', margin, headerY, logoWidth, logoHeight, undefined, 'FAST');
      logoOffset = logoWidth + 4;
    } catch {
      logoOffset = 0;
    }
  }

  // Nombre de la Empresa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text(tenantName || 'NovaHub ERP', margin + logoOffset, headerY + 5.5);

  // Subtítulo del sistema adaptado al tipo de documento
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text(docConfig.subtitle, margin + logoOffset, headerY + 10.5);

  // Badge institucional NovaHubFormat (Top Right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  const badgeText = 'FORMATO EMPRESARIAL NOVAHUB';
  const badgeWidth = doc.getTextWidth(badgeText) + 6;
  doc.roundedRect(pageWidth - margin - badgeWidth, headerY + 1, badgeWidth, 5.5, 1.2, 1.2, 'F');
  doc.setTextColor(primaryFgRgb[0], primaryFgRgb[1], primaryFgRgb[2]);
  doc.text(badgeText, pageWidth - margin - badgeWidth + 3, headerY + 4.7);

  headerY += Math.max(logoHeight, 13) + 4;

  // --- IDENTIFICAR CAMPOS ADICIONALES (CUSTOM FIELDS Y METADATOS DE CONTEXTO) ---
  const normalizedImages = normalizeEstimateImages(estimate?.images);
  const baseCustomFields = (Array.isArray(estimate?.customFields) && estimate.customFields.length > 0)
    ? estimate.customFields.filter((cf: any) => !isEstimateCustomFieldExpired(cf) && cf?.title?.trim())
    : (normalizedImages.customFields || []).filter((cf: any) => !isEstimateCustomFieldExpired(cf) && cf?.title?.trim());

  const customFieldsList: Array<{ title: string; description?: string }> = [...baseCustomFields];

  if (documentType === 'return' && estimate?.reason && String(estimate.reason).trim()) {
    customFieldsList.unshift({
      title: 'Motivo de devolución',
      description: String(estimate.reason).trim(),
    });
  }

  const hasCustomFields = customFieldsList.length > 0;

  // --- CONTENEDORES SUPERIORES (LAYOUT ADAPTABLE: 2 O 3 COLUMNAS) ---
  const metaBoxY = headerY;
  const colGap = 3.5;

  // Configuración de anchos:
  // Si hay campos adicionales: [Información de Cliente: 38%] [Documento: 28%] [Datos Adicionales: 34%]
  // Si NO hay campos adicionales: [Información de Cliente: 60%] [Documento: 40%]
  const clientColW = hasCustomFields ? Math.floor(contentWidth * 0.38) : Math.floor(contentWidth * 0.60);
  const docMetaColW = hasCustomFields ? Math.floor(contentWidth * 0.28) : (contentWidth - clientColW - colGap);
  const customFieldsColW = hasCustomFields ? (contentWidth - clientColW - docMetaColW - colGap * 2) : 0;

  const clientColX = margin;
  const docMetaColX = clientColX + clientColW + colGap;
  const customFieldsColX = docMetaColX + docMetaColW + colGap;

  // Extraer datos del cliente (soporta modelo anidado y customCustomer)
  const customer = estimate.customer || estimate.client || {};
  const clientName = customer.name || customer.razonSocial || estimate.customCustomerName || estimate.customerName || 'Cliente General / Mostrador';
  const clientTaxId = customer.taxId || customer.ruc || customer.identification || customer.cedula || '';
  const clientContact = customer.contactName || customer.contact || customer.attention || '';
  const clientEmail = customer.email || customer.contactEmail || estimate.customCustomerEmail || '';
  const clientPhone = customer.phone || customer.telephone || customer.cellphone || customer.contactPhone || estimate.customCustomerPhone || '';
  
  const addressParts = [
    customer.address || customer.direction || estimate.customCustomerAddress || customer.addressLine,
    customer.city,
    customer.department || customer.state,
    customer.country,
  ].filter(Boolean);
  const clientAddress = addressParts.join(', ');

  // Calcular altura requerida para la tarjeta de cliente dinámicamente
  doc.setFontSize(7.5);
  const clientAddressLines = clientAddress ? doc.splitTextToSize(clientAddress, clientColW - 12) : [];
  let estimatedClientH = 22;
  if (clientTaxId || clientPhone) estimatedClientH += 4.5;
  if (clientEmail) estimatedClientH += 4.5;
  if (clientContact) estimatedClientH += 4.5;
  if (clientAddressLines.length > 0) estimatedClientH += Math.min(clientAddressLines.length * 3.8, 12) + 2;

  const docMetaLines = buildDocumentMetaLines(estimate, documentType);
  const estimatedDocMetaH = 16 + docMetaLines.length * 4.2;

  // Altura para campos adicionales calculada según el contenido real y multilínea
  let estimatedCustomFieldsH = 20;
  if (hasCustomFields) {
    doc.setFontSize(7.2);
    let totalLinesCount = 0;
    const maxFieldsInHeader = 6;
    const fieldsToInspect = customFieldsList.slice(0, maxFieldsInHeader);
    
    fieldsToInspect.forEach((cf: any) => {
      const fieldTitle = String(cf.title || '').trim();
      const fieldDesc = String(cf.description || '').trim();
      const textToWrap = fieldDesc ? `${fieldTitle}: ${fieldDesc}` : fieldTitle;
      const wrapped = doc.splitTextToSize(textToWrap, customFieldsColW - 11);
      totalLinesCount += Math.min(wrapped.length, 6);
    });

    estimatedCustomFieldsH = 14 + totalLinesCount * 3.6;
  }

  // Permitir que el contenedor crezca según sea necesario para albergar la información sin cortarla
  const metaBoxHeight = Math.max(34, Math.min(85, Math.max(estimatedClientH, Math.max(estimatedDocMetaH, estimatedCustomFieldsH))));

  // === 1. TARJETA: INFORMACIÓN DE CLIENTE ===
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(clientColX, metaBoxY, clientColW, metaBoxHeight, 2, 2, 'FD');

  // Acento vertical
  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.roundedRect(clientColX, metaBoxY, 2.5, metaBoxHeight, 1, 1, 'F');

  // Título de la tarjeta
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text('INFORMACIÓN DE CLIENTE', clientColX + 6, metaBoxY + 6);

  // Nombre del cliente
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  const truncatedClientName = truncatePdfText(doc, clientName, clientColW - 10);
  doc.text(truncatedClientName, clientColX + 6, metaBoxY + 11.5);

  // Detalles de contacto
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  let custLineY = metaBoxY + 16;

  if (clientContact) {
    const contactText = truncatePdfText(doc, `Atención: ${clientContact}`, clientColW - 10);
    doc.text(contactText, clientColX + 6, custLineY);
    custLineY += 4.2;
  }

  const idPhoneParts = [
    clientTaxId ? `RUC/Céd: ${clientTaxId}` : '',
    clientPhone ? `Tel: ${clientPhone}` : '',
  ].filter(Boolean);
  if (idPhoneParts.length > 0) {
    const idPhoneStr = truncatePdfText(doc, idPhoneParts.join('  ·  '), clientColW - 10);
    doc.text(idPhoneStr, clientColX + 6, custLineY);
    custLineY += 4.2;
  }

  if (clientEmail) {
    const truncatedEmail = truncatePdfText(doc, `Email: ${clientEmail}`, clientColW - 10);
    doc.text(truncatedEmail, clientColX + 6, custLineY);
    custLineY += 4.2;
  }

  if (clientAddressLines.length > 0) {
    const maxAddrLines = Math.min(clientAddressLines.length, 3);
    const shownAddr = clientAddressLines.slice(0, maxAddrLines);
    doc.text(shownAddr, clientColX + 6, custLineY);
  }

  // === 2. TARJETA: DATOS DEL DOCUMENTO ===
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(docMetaColX, metaBoxY, docMetaColW, metaBoxHeight, 2, 2, 'FD');

  // Header del documento (COTIZACIÓN, FACTURA, ORDEN DE VENTA, etc.)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(docConfig.cardTitle.length > 14 ? 8.8 : 10.5);
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text(truncatePdfText(doc, docConfig.cardTitle, docMetaColW - 8), docMetaColX + 5.5, metaBoxY + 6.5);

  // Número
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  const docNumberStr = estimate.number || (estimate.id ? String(estimate.id).slice(0, 8).toUpperCase() : 'Borrador');
  doc.text(truncatePdfText(doc, `Nº: ${docNumberStr}`, docMetaColW - 8), docMetaColX + 5.5, metaBoxY + 12);

  // Metadatos dinámicos por tipo de documento
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);

  let docMetaY = metaBoxY + 16.5;
  docMetaLines.forEach((metaLine) => {
    if (docMetaY + 2 <= metaBoxY + metaBoxHeight - 2) {
      doc.text(truncatePdfText(doc, metaLine, docMetaColW - 9), docMetaColX + 5.5, docMetaY);
      docMetaY += 4.2;
    }
  });

  // === 3. TARJETA: DATOS ADICIONALES (SI EXISTEN) ===
  let hasOverflowedCustomFields = false;
  if (hasCustomFields) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(customFieldsColX, metaBoxY, customFieldsColW, metaBoxHeight, 2, 2, 'FD');

    // Título de la tarjeta
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text('DATOS ADICIONALES', customFieldsColX + 5.5, metaBoxY + 6.5);

    // Listado multilínea con salto fluido de renglón
    let fieldY = metaBoxY + 11.5;
    const maxCardContentY = metaBoxY + metaBoxHeight - 4;

    for (let i = 0; i < customFieldsList.length; i++) {
      const cf = customFieldsList[i];
      const fieldTitle = String(cf.title || '').trim();
      const fieldDesc = String(cf.description || '').trim();

      if (fieldY + 4 > maxCardContentY) {
        hasOverflowedCustomFields = true;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.5);
        doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
        doc.text(`+ ${customFieldsList.length - i} más en notas`, customFieldsColX + 5.5, fieldY + 1);
        break;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);

      if (!fieldDesc) {
        doc.text(truncatePdfText(doc, `• ${fieldTitle}`, customFieldsColW - 10), customFieldsColX + 5.5, fieldY);
        fieldY += 3.8;
      } else {
        const fullText = `${fieldTitle}: ${fieldDesc}`;
        const wrappedLines: string[] = doc.splitTextToSize(fullText, customFieldsColW - 10);
        
        const availableHeight = maxCardContentY - fieldY;
        const maxLinesFit = Math.max(1, Math.floor(availableHeight / 3.4));
        const linesToRender = wrappedLines.slice(0, maxLinesFit);

        if (wrappedLines.length > maxLinesFit) {
          hasOverflowedCustomFields = true;
          const lastIdx = linesToRender.length - 1;
          linesToRender[lastIdx] = truncatePdfText(doc, linesToRender[lastIdx], customFieldsColW - 14) + '...';
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(linesToRender, customFieldsColX + 5.5, fieldY);
        fieldY += linesToRender.length * 3.4 + 1.2;
      }
    }
  }

  headerY = metaBoxY + metaBoxHeight + 6;

  // --- TABLA DE DETALLE (ITEMS COMERCIALES O DESGLOSE DE PAGO) ---
  const isPaymentDoc = documentType === 'payment';
  const paymentCtx = isPaymentDoc ? buildNovaHubPaymentContext(estimate) : null;

  let tableHead: string[][];
  let tableBody: string[][];
  let tableColumnStyles: Record<number, any>;

  if (isPaymentDoc && paymentCtx) {
    tableHead = [['Método de Pago', 'Moneda', 'Referencia / Banco', 'Monto']];
    tableBody = paymentCtx.paymentRows.map((row: any) => {
      const mLabel = translatePaymentMethod(row.method || estimate.method);
      const rCurr = String(row.currency || paymentCtx.voucherCurrency || 'NIO').toUpperCase();
      const rRate = Number(row.exchangeRate || paymentCtx.voucherRate || 1);
      const ref = row.reference || estimate.reference || 'Sin referencia';
      const bank = row.bankAccount?.bankName || estimate.bankAccount?.bankName || '';
      const refBank = bank ? `${ref} · ${bank}` : String(ref);
      const amtStr = formatAmount(Number(row.amount || 0), rCurr, rRate);
      return [mLabel, rCurr, refBank, amtStr];
    });
    if (tableBody.length === 0) {
      tableBody = [['Efectivo', paymentCtx.voucherCurrency, 'Sin referencia', formatAmount(paymentCtx.voucherTotal, paymentCtx.voucherCurrency, paymentCtx.voucherRate)]];
    }
    tableColumnStyles = {
      0: { cellWidth: 42, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 24, halign: 'center' },
      2: { cellWidth: 'auto', halign: 'left' },
      3: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
    };
  } else {
    tableHead = [['Descripción de Producto / Servicio', 'Cant.', 'Precio Unit.', 'Total']];
    const itemsList = Array.isArray(estimate.items) ? estimate.items : Array.isArray(estimate.lines) ? estimate.lines : [];
    tableBody = itemsList.map((item: any, index: number) => {
      const desc = formatCommercialLineDescription(item, `Ítem #${index + 1}`);
      const qty = Number(item.quantity || 0).toString();
      const unitPrice = formatAmount(Number(item.unitPrice || 0), estimate.currency, estimate.exchangeRate);
      const total = formatAmount(Number(item.total || 0), estimate.currency, estimate.exchangeRate);
      return [desc, qty, unitPrice, total];
    });
    if (tableBody.length === 0) {
      tableBody = [['Sin productos especificados', '0', '0.00', '0.00']];
    }
    tableColumnStyles = {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 32, halign: 'right' },
      3: { cellWidth: 34, halign: 'right', fontStyle: 'bold' },
    };
  }

  autoTable(doc, {
    startY: headerY,
    margin: { left: margin, right: margin },
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: primaryRgb,
      textColor: primaryFgRgb,
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 4,
      halign: 'left',
    },
    bodyStyles: {
      textColor: textColor,
      fontSize: 8,
      cellPadding: 3.5,
      lineColor: lineColor,
      lineWidth: 0.15,
      valign: 'middle',
    },
    columnStyles: tableColumnStyles,
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data) => {
      const currentPage = data.pageNumber;
      const totalPages = (doc.internal as any).getNumberOfPages ? (doc.internal as any).getNumberOfPages() : currentPage;
      
      const footerY = pageHeight - 10;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `${tenantName || 'NovaHub ERP'}  ·  ${docConfig.annexTitle} Oficial  ·  NovaHubFormat`,
        margin,
        footerY + 1.5,
      );

      doc.text(
        `Página ${currentPage} de ${totalPages}`,
        pageWidth - margin,
        footerY + 1.5,
        { align: 'right' },
      );
    },
  });

  let finalY = (doc as any).lastAutoTable?.finalY || (headerY + 40);

  // --- SECCIÓN INFERIOR: NOTAS + RESUMEN FINANCIERO (TOTALES) ---
  interface SummaryRowItem {
    label: string;
    value: string;
    isNegative?: boolean;
    isHighlight?: boolean;
    isSecondaryBold?: boolean;
  }

  const summaryRows: SummaryRowItem[] = [];

  if (isPaymentDoc && paymentCtx) {
    if (paymentCtx.financialTotal > 0) {
      summaryRows.push({
        label: 'Monto Documento:',
        value: formatAmount(paymentCtx.financialTotal, paymentCtx.financialCurrency, paymentCtx.financialRate),
      });
      summaryRows.push({
        label: 'Total Abonado:',
        value: formatAmount(paymentCtx.accumulatedPaid, paymentCtx.financialCurrency, paymentCtx.financialRate),
      });
      summaryRows.push({
        label: 'Saldo Pendiente:',
        value: formatAmount(paymentCtx.effectiveBalance, paymentCtx.financialCurrency, paymentCtx.financialRate),
        isSecondaryBold: paymentCtx.effectiveBalance > 0.01,
      });
    }
    if (paymentCtx.changeAmount > 0.01) {
      summaryRows.push({
        label: 'Cambio / Vuelto:',
        value: formatAmount(paymentCtx.changeAmount, paymentCtx.voucherCurrency, paymentCtx.voucherRate),
      });
    }
    summaryRows.push({
      label: 'ESTE PAGO:',
      value: formatAmount(paymentCtx.voucherTotal, paymentCtx.voucherCurrency, paymentCtx.voucherRate),
      isHighlight: true,
    });
  } else {
    const subtotalVal = Number(estimate.subtotal ?? estimate.subTotal ?? 0);
    const discountVal = Number(estimate.discountAmount ?? estimate.discount ?? estimate.discountTotal ?? 0);
    const taxVal = Number(estimate.taxAmount ?? estimate.tax ?? 0);
    const irVal = Number(estimate.irAmount ?? 0);
    const extraCharges = getSalesAdditionalCharges(estimate).filter((c) => Number(c.amount || 0) > 0);
    const grandTotalVal = Number(estimate.total ?? estimate.grandTotal ?? 0);

    summaryRows.push({
      label: 'Subtotal:',
      value: formatAmount(subtotalVal, estimate.currency, estimate.exchangeRate),
    });

    if (discountVal > 0) {
      summaryRows.push({
        label: 'Descuento:',
        value: `-${formatAmount(discountVal, estimate.currency, estimate.exchangeRate)}`,
        isNegative: true,
      });
    }

    if (taxVal > 0) {
      summaryRows.push({
        label: 'Impuesto (IVA):',
        value: formatAmount(taxVal, estimate.currency, estimate.exchangeRate),
      });
    }

    if (irVal > 0) {
      summaryRows.push({
        label: 'Retención IR:',
        value: `-${formatAmount(irVal, estimate.currency, estimate.exchangeRate)}`,
        isNegative: true,
      });
    }

    extraCharges.forEach((charge) => {
      summaryRows.push({
        label: `${charge.description}:`,
        value: formatAmount(charge.amount, estimate.currency, estimate.exchangeRate),
      });
    });

    summaryRows.push({
      label: documentType === 'recurring' ? 'TOTAL CICLO:' : 'TOTAL:',
      value: formatAmount(grandTotalVal, estimate.currency, estimate.exchangeRate),
      isHighlight: true,
    });

    if (documentType === 'invoice' || documentType === 'credit-note') {
      const paidVal = Number(estimate.amountPaid ?? 0);
      const balanceVal = estimate.balance !== undefined && estimate.balance !== null ? Number(estimate.balance) : null;
      if (paidVal > 0) {
        summaryRows.push({
          label: 'Abonado / Pagado:',
          value: formatAmount(paidVal, estimate.currency, estimate.exchangeRate),
        });
      }
      if (balanceVal !== null && balanceVal > 0.01) {
        summaryRows.push({
          label: 'Saldo Pendiente:',
          value: formatAmount(balanceVal, estimate.currency, estimate.exchangeRate),
          isSecondaryBold: true,
        });
      }
    }
  }

  const totalsBoxHeight = summaryRows.length * 5.5 + 8;
  const bottomSectionNeededHeight = Math.max(totalsBoxHeight, 25) + 15;

  if (finalY + bottomSectionNeededHeight > pageHeight - 20) {
    doc.addPage('letter', 'portrait');
    finalY = margin + 10;
  } else {
    finalY += 6;
  }

  // Cuadro de Totales (Alineado a la derecha)
  const totalsWidth = 78;
  const totalsX = pageWidth - margin - totalsWidth;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(totalsX, finalY, totalsWidth, totalsBoxHeight, 1.5, 1.5, 'FD');

  // Acento vertical en el cuadro de totales
  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.roundedRect(totalsX, finalY, 2, totalsBoxHeight, 0.8, 0.8, 'F');

  let totalCursorY = finalY + 5.5;

  summaryRows.forEach((row) => {
    if (row.isHighlight) {
      doc.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
      doc.setLineWidth(0.2);
      doc.line(totalsX + 4, totalCursorY - 2.5, totalsX + totalsWidth - 4, totalCursorY - 2.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.2);
      doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.text(row.label, totalsX + 5, totalCursorY + 1.5);
      doc.text(row.value, totalsX + totalsWidth - 4, totalCursorY + 1.5, { align: 'right' });
      totalCursorY += 6.5;
    } else {
      doc.setFont('helvetica', row.isSecondaryBold ? 'bold' : 'normal');
      doc.setFontSize(8);
      if (row.isNegative) {
        doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
        doc.text(truncatePdfText(doc, row.label, totalsWidth - 32), totalsX + 5, totalCursorY);
        doc.setTextColor(239, 68, 68);
        doc.text(row.value, totalsX + totalsWidth - 4, totalCursorY, { align: 'right' });
      } else if (row.isSecondaryBold) {
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(truncatePdfText(doc, row.label, totalsWidth - 32), totalsX + 5, totalCursorY);
        doc.text(row.value, totalsX + totalsWidth - 4, totalCursorY, { align: 'right' });
      } else {
        doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
        doc.text(truncatePdfText(doc, row.label, totalsWidth - 32), totalsX + 5, totalCursorY);
        doc.text(row.value, totalsX + totalsWidth - 4, totalCursorY, { align: 'right' });
      }
      totalCursorY += 5.5;
    }
  });

  // Notas y Condiciones (Alineadas a la izquierda al lado de los totales)
  const notesWidth = contentWidth - totalsWidth - 6;
  const notesX = margin;
  let notesCursorY = finalY + 4;

  if (estimate.notes && typeof estimate.notes === 'string' && estimate.notes.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text('Notas y Observaciones:', notesX, notesCursorY);
    notesCursorY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
    const splitNotes = doc.splitTextToSize(estimate.notes.trim(), notesWidth);
    doc.text(splitNotes, notesX, notesCursorY);
    notesCursorY += splitNotes.length * 3.6 + 4;
  }

  // Si hubo campos adicionales que se desbordaron o son muy extensos, listarlos completos aquí
  if (hasOverflowedCustomFields && customFieldsList.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text('Detalle de Campos Adicionales y Especificaciones:', notesX, notesCursorY);
    notesCursorY += 4.5;

    customFieldsList.forEach((cf: any) => {
      const fieldTitle = String(cf.title || '').trim();
      const fieldDesc = String(cf.description || '').trim();
      if (!fieldTitle && !fieldDesc) return;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.text(`• ${fieldTitle}:`, notesX + 2, notesCursorY);
      notesCursorY += 3.6;

      if (fieldDesc) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
        const splitDesc = doc.splitTextToSize(fieldDesc, notesWidth - 4);
        doc.text(splitDesc, notesX + 4, notesCursorY);
        notesCursorY += splitDesc.length * 3.4 + 2;
      }
    });
  }

  // --- ANEXO DE IMÁGENES / RENDERS (SI EXISTEN IMÁGENES) ---
  if (withImages !== false && normalizedImages.items.length > 0) {
    await appendNovaHubImagesAnnex({
      doc,
      images: estimate.images,
      primaryColor: primaryRgb,
      textColor,
      tenantName,
      documentTitle: docConfig.annexTitle,
      documentNumber: estimate.number || '',
    });
  }

  // --- RETORNAR / DESCARGAR BLOB ---
  const blob = doc.output('blob');
  const fileName = buildSalesPdfFileName(documentType as any, estimate.number, 'novahub-format');

  if (save) {
    savePdfBlob(blob, fileName);
  }

  return { doc, blob };
}
