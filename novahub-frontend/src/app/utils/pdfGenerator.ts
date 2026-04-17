import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PDFGeneratorParams {
  estimate: any; // El objeto localDoc/estimate a imprimir
  tenantName: string;
  formatAmount: (amount: number, currency: string, rate: number) => string;
  tenantLogo?: string;
  documentType?: 'estimate' | 'order' | 'invoice' | 'recurring' | 'payment' | 'return' | 'credit-note';
  primaryColor?: string;
}

export const hexToRgb = (color?: string): [number, number, number] => {
  if (!color) return [16, 185, 129];
  
  // Handle oklch(...) from theme context
  if (color.startsWith('oklch')) {
    const match = color.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
    if (match) {
      const L = parseFloat(match[1]);
      const C = parseFloat(match[2]);
      const h = parseFloat(match[3]);
      
      const hRad = h * Math.PI / 180;
      const a = C * Math.cos(hRad);
      const b = C * Math.sin(hRad);
      
      const l = L + 0.3963377774 * a + 0.2158037573 * b;
      const m = L - 0.1055613458 * a - 0.0638541728 * b;
      const s = L - 0.0894841775 * a - 1.2914855480 * b;
      
      const l3 = l * l * l, m3 = m * m * m, s3 = s * s * s;
      
      let rr = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
      let gg = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
      let bb = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;
      
      const delinearize = (c: number) => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
      
      return [
        Math.round(Math.min(255, Math.max(0, delinearize(rr) * 255))),
        Math.round(Math.min(255, Math.max(0, delinearize(gg) * 255))),
        Math.round(Math.min(255, Math.max(0, delinearize(bb) * 255)))
      ];
    }
  }

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [16, 185, 129];
};

const statusTranslations: Record<string, string> = {
  'PAID': 'PAGADA',
  'PENDING': 'PENDIENTE',
  'CANCELLED': 'CANCELADO',
  'DRAFT': 'BORRADOR',
  'PARTIAL': 'PARCIAL',
  'APPROVED': 'APROBADO',
  'REJECTED': 'RECHAZADO',
  'SENT': 'ENVIADO',
  'OVERDUE': 'VENCIDO',
  'RECEIVED': 'RECIBIDO',
  'IN_PROGRESS': 'EN PROGRESO',
  'SHIPPED': 'ENVIADO',
  'DELIVERED': 'ENTREGADO',
  'COMPLETED': 'COMPLETADO',
  'OPEN': 'ABIERTO',
  'CLOSED': 'CERRADO',
  'VOID': 'ANULADO',
  'ACTIVE': 'ACTIVO',
  'INACTIVE': 'INACTIVO',
  'APPLIED': 'PAGADA'
};

export const translateStatus = (status: string | undefined): string => {
  if (!status) return 'COMPLETADO';
  const up = status.toUpperCase();
  return statusTranslations[up] || up;
};

export const generateEstimatePDF = async ({ estimate, tenantName, formatAmount, tenantLogo, documentType = 'estimate', primaryColor: themePrimary }: PDFGeneratorParams) => {
  const doc = new jsPDF();
  
  // 1. Configuraciones iniciales y estilos base
  const primaryColor = hexToRgb(themePrimary); 
  const textColor = [51, 65, 85] as [number, number, number]; // Slate 700
  
  // 2. Head - Top Left (Logo y Nombre de la Institución/Tenant)
  let titleY = 25;
  if (tenantLogo) {
    try {
      // Ajustar logo en 14x15 de anchura máxima proporcional, aquí asumimos un rectangle genérico
      doc.addImage(tenantLogo, 'PNG', 14, 15, 30, 15);
      titleY = 38; // Empujar the title un poco hacia abajo
      doc.setFontSize(14); // Texto más pequeño si existe un logo
    } catch (error) {
      console.warn('No se pudo incrustar el logo en el PDF', error);
      doc.setFontSize(22);
    }
  } else {
    doc.setFontSize(22);
  }
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  // Representación del Nombre de la Empresa en el encabezado izquierdo
  doc.text(tenantName || 'Nuestra Empresa', 14, titleY);
  
  // Subtítulo / Identificadores de Empresa
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.setFont('helvetica', 'normal');
  let docTypeStr = 'Cotización de Venta';
  if (documentType === 'order') docTypeStr = 'Orden de Venta';
  else if (documentType === 'invoice') docTypeStr = 'Factura';
  else if (documentType === 'recurring') docTypeStr = 'Factura Recurrente';
  else if (documentType === 'payment') docTypeStr = 'Comprobante de Pago';
  else if (documentType === 'return') docTypeStr = 'Devolución de Venta';
  else if (documentType === 'credit-note') docTypeStr = 'Nota de Crédito';
  doc.text(docTypeStr.toUpperCase(), 14, titleY + 7);
  
  // 3. Head - Top Right (Info de la Cotización)
  doc.setFontSize(18);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont('helvetica', 'bold');
  let titleStr = 'COTIZACIÓN';
  if (documentType === 'order') titleStr = 'ORDEN DE VENTA';
  else if (documentType === 'invoice') titleStr = 'FACTURA';
  else if (documentType === 'recurring') titleStr = 'FACTURA RECURRENTE';
  else if (documentType === 'payment') titleStr = 'PAGO RECIBIDO';
  else if (documentType === 'return') titleStr = 'DEVOLUCIÓN';
  else if (documentType === 'credit-note') titleStr = 'NOTA DE CRÉDITO';
  doc.text(titleStr, 196, 25, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº: ${estimate.number || 'N/A'}`, 196, 32, { align: 'right' });
  doc.text(`Fecha: ${estimate.date ? new Date(estimate.date).toLocaleDateString() : 'N/A'}`, 196, 38, { align: 'right' });
  
  if (documentType === 'order') {
    doc.text(`Entrega: ${estimate.expectedDelivery ? new Date(estimate.expectedDelivery).toLocaleDateString() : 'N/A'}`, 196, 44, { align: 'right' });
  } else {
    doc.text(`Validez: ${estimate.expiryDate ? new Date(estimate.expiryDate).toLocaleDateString() : 'N/A'}`, 196, 44, { align: 'right' });
  }

  // 4. Separador
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.5);
  doc.line(14, 52, 196, 52);

  // 5. Cliente Info
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Preparado para:', 14, 62);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const clienteNombre = estimate.customer?.name || 'Cliente sin registrar';
  const clienteContacto = estimate.customer?.contactName || '';
  const clienteEmail = estimate.customer?.email || '';
  const clienteTelf = estimate.customer?.phone || '';
  
  let currentInfoY = 68;
  doc.text(clienteNombre, 14, currentInfoY);
  if (clienteContacto) { currentInfoY += 5; doc.text(`Contacto: ${clienteContacto}`, 14, currentInfoY); }
  if (clienteEmail) { currentInfoY += 5; doc.text(`Email: ${clienteEmail}`, 14, currentInfoY); }
  if (clienteTelf) { currentInfoY += 5; doc.text(`Tel: ${clienteTelf}`, 14, currentInfoY); }

  // 6. Configuración de ítems (Tabla)
  const tableData = (estimate.items || []).map((item: any) => [
    item.description || 'Producto Customizado',
    Number(item.quantity).toString(),
    formatAmount(Number(item.unitPrice), estimate.currency, estimate.exchangeRate),
    formatAmount(Number(item.total), estimate.currency, estimate.exchangeRate)
  ]);

  autoTable(doc, {
    startY: 90,
    head: [['Descripción', 'Cantidad', 'Precio U.', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: 255,
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      textColor: textColor,
      fontSize: 9
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' }
    },
    styles: { overflow: 'linebreak', cellPadding: 5 }
  });

  // 7. Resumen Financiero
  const finalY = (doc as any).lastAutoTable.finalY || 90;
  
  const rightX = 196;
  const labelX = 140;
  let currentY = finalY + 10;
  
  doc.setFontSize(10);
  
  // Subtotal
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', labelX, currentY);
  doc.text(formatAmount(Number(estimate.subtotal), estimate.currency, estimate.exchangeRate), rightX, currentY, { align: 'right' });
  currentY += 7;
  
  // Descuento
  if (Number(estimate.discountAmount) > 0) {
    doc.text('Descuento:', labelX, currentY);
    doc.setTextColor(239, 68, 68); // Red 500
    doc.text(`-${formatAmount(Number(estimate.discountAmount), estimate.currency, estimate.exchangeRate)}`, rightX, currentY, { align: 'right' });
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    currentY += 7;
  }
  
  // Impuesto
  if (Number(estimate.taxAmount) > 0) {
    doc.text('Impuesto (IVA):', labelX, currentY);
    doc.text(formatAmount(Number(estimate.taxAmount), estimate.currency, estimate.exchangeRate), rightX, currentY, { align: 'right' });
    currentY += 7;
  }
  
  // Total Line
  doc.setDrawColor(226, 232, 240);
  doc.line(labelX, currentY - 3, rightX, currentY - 3);
  
  // Total
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('TOTAL:', labelX, currentY + 3);
  doc.text(formatAmount(Number(estimate.total), estimate.currency, estimate.exchangeRate), rightX, currentY + 3, { align: 'right' });

  // 8. Notas
  if (estimate.notes) {
     const notesY = Math.max(currentY + 20, finalY + 15);
     doc.setFontSize(10);
     doc.setFont('helvetica', 'bold');
     doc.setTextColor(textColor[0], textColor[1], textColor[2]);
     doc.text('Notas:', 14, notesY);
     
     doc.setFontSize(9);
     doc.setFont('helvetica', 'normal');
     doc.setTextColor(100, 116, 139);
     const splitNotes = doc.splitTextToSize(estimate.notes, 100);
     doc.text(splitNotes, 14, notesY + 6);
  }

  // Footer (Generado por)
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.setFont('helvetica', 'italic');
  doc.text(`Documento de cotización originado por el módulo Ventas de ERP Nova Hub. Generado por ${tenantName}`, 14, pageHeight - 10);

  // Descargar PDF
  doc.save(`${estimate.number || 'Cotizacion'}.pdf`);
};

export const generateSupplierHistoryPDF = async ({ supplier, items, tenantName, formatAmount, tenantLogo, primaryColor: themePrimary }: any) => {
  const doc = new jsPDF();
  
  const primaryColor = hexToRgb(themePrimary);
  const textColor = [51, 65, 85] as [number, number, number];
  
  let titleY = 25;
  if (tenantLogo) {
    try {
      doc.addImage(tenantLogo, 'PNG', 14, 15, 30, 15);
      titleY = 38;
      doc.setFontSize(14);
    } catch (error) {
      doc.setFontSize(22);
    }
  } else {
    doc.setFontSize(22);
  }
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(tenantName || 'Nuestra Empresa', 14, titleY);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('HISTORIAL DE COMPRAS (PRODUCTOS Y SERVICIOS)', 14, titleY + 7);
  
  doc.setFontSize(18);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('HISTORIAL', 196, 25, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Proveedor: ${supplier.name || 'N/A'}`, 196, 32, { align: 'right' });
  doc.text(`Fecha Emisión: ${new Date().toLocaleDateString()}`, 196, 38, { align: 'right' });
  
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 46, 196, 46);

  const tableData = items.map((item: any) => [
    item.date,
    item.type,
    item.docNumber,
    item.description || 'N/A',
    Number(item.quantity).toString(),
    formatAmount(Number(item.unitPrice), item.currency, item.exchangeRate),
    formatAmount(Number(item.total), item.currency, item.exchangeRate)
  ]);

  autoTable(doc, {
    startY: 55,
    head: [['Fecha', 'Tipo', 'Documento', 'Descripción', 'Cant.', 'Precio U.', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 9, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { textColor: textColor, fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 'auto', halign: 'left' },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 25, halign: 'right' }
    },
    styles: { overflow: 'linebreak', cellPadding: 3 }
  });

  const pageHeight = doc.internal.pageSize.height;
  
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text(`Generado por ${tenantName} - Módulo de Compras`, 14, pageHeight - 10);

  doc.save(`Historial_${supplier.name.replace(/\s+/g, '_')}.pdf`);
};

export const generateExpensePDF = async ({
  expense,
  tenantName,
  formatAmount,
  tenantLogo,
  primaryColor: themePrimary
}: {
  expense: any;
  tenantName: string;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
  tenantLogo?: string;
  primaryColor?: string;
}) => {
  const doc = new jsPDF();
  const primaryColor = hexToRgb(themePrimary);
  const textColor = [51, 65, 85] as [number, number, number];
  
  let titleY = 25;
  if (tenantLogo) {
     try {
       doc.addImage(tenantLogo, 'PNG', 14, 15, 30, 15);
       titleY = 38;
       doc.setFontSize(14);
     } catch (e) { doc.setFontSize(22); }
  } else { doc.setFontSize(22); }

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(tenantName || 'Nuestra Empresa', 14, titleY);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('COMPROBANTE DE GASTO', 14, titleY + 7);

  doc.setFontSize(18);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('GASTO', 196, 25, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº: ${expense.number || expense.id || 'N/A'}`, 196, 32, { align: 'right' });
  doc.text(`Fecha: ${expense.date ? new Date(expense.date).toLocaleDateString() : 'N/A'}`, 196, 38, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 46, 196, 46);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Detalle del Gasto:', 14, 56);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  let currentInfoY = 62;
  doc.text(`Pagado a: ${expense.paidTo || (expense.supplier?.name) || 'No especificado'}`, 14, currentInfoY);
  if (expense.supplier?.contactName) { currentInfoY += 5; doc.text(`Contacto: ${expense.supplier.contactName}`, 14, currentInfoY); }
  if (expense.supplier?.email) { currentInfoY += 5; doc.text(`Email: ${expense.supplier.email}`, 14, currentInfoY); }
  if (expense.supplier?.phone) { currentInfoY += 5; doc.text(`Tel: ${expense.supplier.phone}`, 14, currentInfoY); }
  currentInfoY += 5;
  doc.text(`Categoría: ${expense.category === 'OTRO' ? (expense.categoryCustom || 'OTRO') : (expense.category || '-')}`, 14, currentInfoY);
  currentInfoY += 5;
  doc.text(`Referencia: ${expense.reference || '-'}`, 14, currentInfoY);

  const tableData = [
    [
      expense.description || '-',
      formatAmount(Number(expense.amount || 0), expense.currency, expense.exchangeRate)
    ]
  ];

  autoTable(doc, {
    startY: currentInfoY + 10,
    head: [['Descripción', 'Monto']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 10, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { textColor, fontSize: 9 },
    columnStyles: { 0: { cellWidth: 'auto', halign: 'left' }, 1: { cellWidth: 40, halign: 'right' } },
    styles: { overflow: 'linebreak', cellPadding: 5 }
  });

  const finalY = (doc as any).lastAutoTable.finalY || 82;
  const rightX = 196;
  const labelX = 140;
  let currentY = finalY + 10;
  
  doc.setDrawColor(226, 232, 240);
  doc.line(labelX, currentY - 3, rightX, currentY - 3);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('TOTAL:', labelX, currentY + 3);
  doc.text(formatAmount(Number(expense.amount || 0), expense.currency, expense.exchangeRate), rightX, currentY + 3, { align: 'right' });

  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text(`Documento generado por el módulo de Compras. Generado por ${tenantName}`, 14, pageHeight - 10);

  doc.save(`${expense.number || expense.id || 'gasto'}.pdf`);
};

export const generatePurchaseOrderPDF = async ({
  order,
  tenantName,
  formatAmount,
  tenantLogo,
  primaryColor: themePrimary
}: {
  order: any;
  tenantName: string;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
  tenantLogo?: string;
  primaryColor?: string;
}) => {
  const doc = new jsPDF();
  const primaryColor = hexToRgb(themePrimary);
  const textColor = [51, 65, 85] as [number, number, number];
  
  let titleY = 25;
  if (tenantLogo) {
     try {
       doc.addImage(tenantLogo, 'PNG', 14, 15, 30, 15);
       titleY = 38;
       doc.setFontSize(14);
     } catch (e) { doc.setFontSize(22); }
  } else { doc.setFontSize(22); }

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(tenantName || 'Nuestra Empresa', 14, titleY);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('ORDEN DE COMPRA', 14, titleY + 7);

  doc.setFontSize(18);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEN DE COMPRA', 196, 25, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº: ${order.number || order.id || 'N/A'}`, 196, 32, { align: 'right' });
  doc.text(`Fecha: ${order.date ? new Date(order.date).toLocaleDateString() : 'N/A'}`, 196, 38, { align: 'right' });
  doc.text(`Entrega: ${order.expectedDelivery ? new Date(order.expectedDelivery).toLocaleDateString() : 'N/A'}`, 196, 44, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 52, 196, 52);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Proveedor:', 14, 62);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const supp = order.supplier || {};
  let currentInfoY = 68;
  doc.text(supp.name || 'Proveedor no especificado', 14, currentInfoY);
  if (supp.contactName) { currentInfoY += 5; doc.text(`Contacto: ${supp.contactName}`, 14, currentInfoY); }
  if (supp.email) { currentInfoY += 5; doc.text(`Email: ${supp.email}`, 14, currentInfoY); }
  if (supp.phone) { currentInfoY += 5; doc.text(`Tel: ${supp.phone}`, 14, currentInfoY); }
  if (order.address) { currentInfoY += 5; doc.text(`Dirección: ${order.address}`, 14, currentInfoY); }

  const tableData = (order.items || []).map((item: any) => [
    item.name || item.description || item.code || 'Producto',
    Number(item.quantity || 0).toString(),
    formatAmount(Number(item.unitPrice || 0), order.currency, order.exchangeRate),
    formatAmount(Number(item.total || 0), order.currency, order.exchangeRate)
  ]);

  autoTable(doc, {
    startY: 85,
    head: [['Descripción', 'Cantidad', 'Precio U.', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 10, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { textColor, fontSize: 9 },
    columnStyles: { 0: { cellWidth: 'auto', halign: 'left' }, 1: { cellWidth: 25, halign: 'center' }, 2: { cellWidth: 35, halign: 'right' }, 3: { cellWidth: 35, halign: 'right' } },
    styles: { overflow: 'linebreak', cellPadding: 5 }
  });

  const finalY = (doc as any).lastAutoTable.finalY || 85;
  const rightX = 196;
  const labelX = 140;
  let currentY = finalY + 10;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Subtotal:', labelX, currentY);
  doc.text(formatAmount(Number(order.subtotal || 0), order.currency, order.exchangeRate), rightX, currentY, { align: 'right' });
  currentY += 7;

  if (Number(order.taxAmount) > 0) {
    doc.text(`IVA (${Number(order.taxRate || 0)}%):`, labelX, currentY);
    doc.text(formatAmount(Number(order.taxAmount || 0), order.currency, order.exchangeRate), rightX, currentY, { align: 'right' });
    currentY += 7;
  }

  if (Number(order.withholdingAmount) > 0) {
    doc.text(`Retención IR:`, labelX, currentY);
    doc.setTextColor(239, 68, 68);
    doc.text(`-${formatAmount(Number(order.withholdingAmount || 0), order.currency, order.exchangeRate)}`, rightX, currentY, { align: 'right' });
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    currentY += 7;
  }
  
  doc.setDrawColor(226, 232, 240);
  doc.line(labelX, currentY - 3, rightX, currentY - 3);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('TOTAL:', labelX, currentY + 3);
  doc.text(formatAmount(Number(order.total || 0), order.currency, order.exchangeRate), rightX, currentY + 3, { align: 'right' });

  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text(`Documento generado por el módulo de Compras. Generado por ${tenantName}`, 14, pageHeight - 10);

  doc.save(`${order.number || order.id || 'orden_compra'}.pdf`);
};

export const generateRecurringInvoicePDF = async ({
  recurringInvoice,
  tenantName,
  formatAmount,
  tenantLogo,
  primaryColor: themePrimary
}: {
  recurringInvoice: any;
  tenantName: string;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
  tenantLogo?: string;
  primaryColor?: string;
}) => {
  const doc = new jsPDF();
  const primaryColor = hexToRgb(themePrimary);
  const textColor = [51, 65, 85] as [number, number, number];

  let titleY = 25;
  if (tenantLogo) {
     try {
       doc.addImage(tenantLogo, 'JPEG', 14, 15, 30, 15);
       titleY = 38;
     } catch (e) { doc.setFontSize(22); }
  } else { doc.setFontSize(22); }

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(tenantName || 'Nova Hub', 14, titleY);

  doc.setFontSize(12);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('FACTURA RECURRENTE', 14, titleY + 8);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N°: ${recurringInvoice.number || recurringInvoice.id || 'N/A'}`, 196, 22, { align: 'right' });
  doc.text(`Inicio: ${recurringInvoice.startDate ? new Date(recurringInvoice.startDate).toLocaleDateString() : 'N/A'}`, 196, 28, { align: 'right' });
  doc.text(`Próxima: ${recurringInvoice.nextInvoiceDate ? new Date(recurringInvoice.nextInvoiceDate).toLocaleDateString() : 'N/A'}`, 196, 34, { align: 'right' });

  const frequencyMap: Record<string, string> = {
    WEEKLY: 'Semanal',
    MONTHLY: 'Mensual',
    QUARTERLY: 'Trimestral',
    YEARLY: 'Anual',
  };
  const freqLabel = frequencyMap[String(recurringInvoice.frequency || '').toUpperCase()] || recurringInvoice.frequency || '-';

  autoTable(doc, {
    startY: titleY + 18,
    head: [['Campo', 'Detalle']],
    body: [
      ['Cliente', recurringInvoice.customer?.name || '-'],
      ['Contacto', recurringInvoice.customer?.contactName || '-'],
      ['Email', recurringInvoice.customer?.email || '-'],
      ['Teléfono', recurringInvoice.customer?.phone || '-'],
      ['Frecuencia', freqLabel],
      ['Estado', translateStatus(recurringInvoice.status || '-')],
      ['Moneda', recurringInvoice.currency || '-'],
      ['Fin', recurringInvoice.endDate ? new Date(recurringInvoice.endDate).toLocaleDateString() : 'Sin fin'],
    ],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
    bodyStyles: { textColor },
    columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
    styles: { fontSize: 10, cellPadding: 4, overflow: 'linebreak' },
  });

  const itemsRows = (recurringInvoice.items || []).map((item: any) => [
    String(item.itemType || (item.productId ? 'PRODUCT' : 'SERVICE')).toUpperCase() === 'SERVICE' ? 'Servicio' : 'Producto',
    item.description || item.serviceName || '-',
    Number(item.quantity || 0).toString(),
    formatAmount(Number(item.unitPrice || 0), recurringInvoice.currency, recurringInvoice.exchangeRate),
    formatAmount(Number(item.total || 0), recurringInvoice.currency, recurringInvoice.exchangeRate),
  ]);

  autoTable(doc, {
    startY: ((doc as any).lastAutoTable?.finalY || 45) + 8,
    head: [['Tipo', 'Concepto', 'Cant.', 'Precio U.', 'Total']],
    body: itemsRows.length > 0 ? itemsRows : [['-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { textColor, fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 24, halign: 'left' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 16, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
    },
    styles: { cellPadding: 3, overflow: 'linebreak' },
  });

  const baseY = ((doc as any).lastAutoTable?.finalY || 140) + 10;
  const labelX = 140;
  const valueX = 196;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Subtotal:', labelX, baseY);
  doc.text(formatAmount(Number(recurringInvoice.subtotal || 0), recurringInvoice.currency, recurringInvoice.exchangeRate), valueX, baseY, { align: 'right' });
  doc.text('Impuestos:', labelX, baseY + 7);
  doc.text(formatAmount(Number(recurringInvoice.taxAmount || 0), recurringInvoice.currency, recurringInvoice.exchangeRate), valueX, baseY + 7, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.line(labelX, baseY + 12, valueX, baseY + 12);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('TOTAL CICLO:', labelX, baseY + 18);
  doc.text(formatAmount(Number(recurringInvoice.total || 0), recurringInvoice.currency, recurringInvoice.exchangeRate), valueX, baseY + 18, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text(`Generado por ${tenantName} - Módulo de Ventas`, 14, doc.internal.pageSize.height - 10);

  doc.save(`${recurringInvoice.number || recurringInvoice.id || 'factura_recurrente'}.pdf`);
};

export const generateSupplierInvoicePDF = async ({
  invoice,
  tenantName,
  formatAmount,
  tenantLogo,
  primaryColor: themePrimary
}: {
  invoice: any;
  tenantName: string;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
  tenantLogo?: string;
  primaryColor?: string;
}) => {
  const doc = new jsPDF();
  const primaryColor = hexToRgb(themePrimary);
  const textColor = [51, 65, 85] as [number, number, number];
  
  let titleY = 25;
  if (tenantLogo) {
     try {
       doc.addImage(tenantLogo, 'PNG', 14, 15, 30, 15);
       titleY = 38;
       doc.setFontSize(14);
     } catch (e) { doc.setFontSize(22); }
  } else { doc.setFontSize(22); }

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(tenantName || 'Nuestra Empresa', 14, titleY);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('FACTURA DE PROVEEDOR', 14, titleY + 7);

  doc.setFontSize(18);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURA DE PROVEEDOR', 196, 25, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº: ${invoice.number || invoice.id || 'N/A'}`, 196, 32, { align: 'right' });
  doc.text(`Emisión: ${invoice.date ? new Date(invoice.date).toLocaleDateString() : 'N/A'}`, 196, 38, { align: 'right' });
  doc.text(`Vence: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}`, 196, 44, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 52, 196, 52);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Proveedor:', 14, 62);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const supp = invoice.supplier || {};
  let currentInfoY = 68;
  doc.text(supp.name || 'Proveedor no especificado', 14, currentInfoY);
  if (supp.contactName) { currentInfoY += 5; doc.text(`Contacto: ${supp.contactName}`, 14, currentInfoY); }
  if (supp.email) { currentInfoY += 5; doc.text(`Email: ${supp.email}`, 14, currentInfoY); }
  if (supp.phone) { currentInfoY += 5; doc.text(`Tel: ${supp.phone}`, 14, currentInfoY); }

  const tableData = (invoice.items || []).map((item: any) => [
    item.description || '-',
    Number(item.quantity || 0).toString(),
    formatAmount(Number(item.unitPrice || 0), invoice.currency, invoice.exchangeRate),
    `${Number(item.taxRate || 0).toFixed(1)}%`,
    formatAmount(Number(item.total || 0), invoice.currency, invoice.exchangeRate)
  ]);

  autoTable(doc, {
    startY: 85,
    head: [['Descripción', 'Cantidad', 'Precio U.', 'Imp. %', 'Total']],
    body: tableData.length > 0 ? tableData : [['-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 10, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { textColor, fontSize: 9 },
    columnStyles: { 0: { cellWidth: 'auto', halign: 'left' }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 35, halign: 'right' }, 3: { cellWidth: 20, halign: 'center' }, 4: { cellWidth: 35, halign: 'right' } },
    styles: { overflow: 'linebreak', cellPadding: 5 }
  });

  const finalY = (doc as any).lastAutoTable.finalY || 85;
  const rightX = 196;
  const labelX = 140;
  let currentY = finalY + 10;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Subtotal:', labelX, currentY);
  doc.text(formatAmount(Number(invoice.subtotal || 0), invoice.currency, invoice.exchangeRate), rightX, currentY, { align: 'right' });
  currentY += 7;

  if (Number(invoice.taxAmount) > 0) {
    doc.text(`IVA:`, labelX, currentY);
    doc.text(formatAmount(Number(invoice.taxAmount || 0), invoice.currency, invoice.exchangeRate), rightX, currentY, { align: 'right' });
    currentY += 7;
  }
  
  doc.setDrawColor(226, 232, 240);
  doc.line(labelX, currentY - 3, rightX, currentY - 3);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('TOTAL:', labelX, currentY + 3);
  doc.text(formatAmount(Number(invoice.total || 0), invoice.currency, invoice.exchangeRate), rightX, currentY + 3, { align: 'right' });

  if (invoice.notes) {
     const notesY = Math.max(currentY + 20, finalY + 15);
     doc.setFontSize(10);
     doc.setFont('helvetica', 'bold');
     doc.setTextColor(textColor[0], textColor[1], textColor[2]);
     doc.text('Notas:', 14, notesY);
     
     doc.setFontSize(9);
     doc.setFont('helvetica', 'normal');
     doc.setTextColor(100, 116, 139);
     const splitNotes = doc.splitTextToSize(invoice.notes, 100);
     doc.text(splitNotes, 14, notesY + 6);
  }

  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text(`Documento generado por el módulo de Compras. Generado por ${tenantName}`, 14, pageHeight - 10);

  doc.save(`${invoice.number || invoice.id || 'factura_proveedor'}.pdf`);
};

export const generateCustomerStatementPDF = async ({ 
  customer, 
  transactions, 
  tenantName, 
  tenantLogo, 
  formatAmount,
  primaryColor: themePrimary
}: {
  customer: any;
  transactions: any[];
  tenantName: string;
  tenantLogo?: string;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
  primaryColor?: string;
}) => {
  const doc = new jsPDF();
  const primaryColor = hexToRgb(themePrimary);
  const textColor = [51, 65, 85] as [number, number, number];

  // 1. Identidad Corporativa
  let titleY = 25;
  if (tenantLogo) {
     try {
       // Intento de cargar el logo (asumiendo formato compatible o detectado)
       doc.addImage(tenantLogo, 'JPEG', 14, 15, 30, 15);
       titleY = 38;
     } catch (e) { 
       console.error("PDF Logo load error:", e);
       doc.setFontSize(22); 
     }
  } else { doc.setFontSize(22); }

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text((tenantName || 'Nova Hub').toUpperCase(), 14, titleY);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('REGISTRO HISTÓRICO DE TRANSACCIONES', 14, titleY + 7);

  // 2. Título General
  doc.setFontSize(18);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('HISTORIAL DE CLIENTE', 196, 25, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Emisión: ${new Date().toLocaleDateString()}`, 196, 32, { align: 'right' });

  // 3. Separador
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 52, 196, 52);

  // 4. Información del Cliente
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Detalle del Cliente:', 14, 62);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${customer.name} (Cód: ${customer.code})`, 14, 68);
  let infoY = 73;
  if (customer.contactName) { doc.text(`Contacto: ${customer.contactName}`, 14, infoY); infoY += 5; }
  if (customer.taxId) { doc.text(`RUC/Tax ID: ${customer.taxId}`, 14, infoY); infoY += 5; }
  if (customer.email) { doc.text(`Email: ${customer.email}`, 14, infoY); infoY += 5; }
  if (customer.phone) { doc.text(`Tel: ${customer.phone}`, 14, infoY); infoY += 5; }

  // 5. Resumen de Saldo
  doc.setFont('helvetica', 'bold');
  doc.text('SALDO PENDIENTE:', 130, 68);
  doc.setFontSize(14);
  doc.setTextColor(239, 68, 68); // Rose 500
  doc.text(formatAmount(customer.balance || 0), 196, 68, { align: 'right' });
  
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Límite de Crédito:', 130, 80);
  doc.text(formatAmount(customer.creditLimit || 0), 196, 80, { align: 'right' });

  // 6. Tabla de Transacciones
  const tableData = transactions.map((t: any) => {
    let sign = '';
    const isNeutral = ['ESTIMATE', 'ORDER', 'RECURRING'].includes(t.type);
    
    if (!isNeutral) {
      const isPositive = (t.type === 'INVOICE' || (t.type === 'RETURN' && t.status === 'PAID') || (t.type === 'PAYMENT' && t.reference?.startsWith('NC-')));
      sign = isPositive ? '+' : '-';
    }

    return [
      new Date(t.date).toLocaleDateString(),
      t.label,
      t.number,
      translateStatus(t.status),
      `${sign}${formatAmount(t.total, t.currency, t.exchangeRate)}`
    ];
  });

  autoTable(doc, {
    startY: 95,
    head: [['Fecha', 'Tipo', 'Documento', 'Estado', 'Monto']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: 255,
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      textColor: textColor,
      fontSize: 9
    },
    columnStyles: {
      0: { cellWidth: 25, halign: 'center' },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 'auto', halign: 'left' },
      3: { cellWidth: 30, halign: 'center' },
      4: { cellWidth: 35, halign: 'right' }
    },
    styles: { overflow: 'linebreak', cellPadding: 4 }
  });

  // 7. Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text(`Documento administrativo de uso interno. Generado por la plataforma ERP Nova Hub para ${tenantName}.`, 14, pageHeight - 10);

  // 8. Descarga
  doc.save(`Historial_Cliente_${customer.name.replace(/\s+/g, '_')}.pdf`);
};

export const generatePlatformDocumentPDF = async ({
  tenantName,
  documentType,
  items,
  totalPrice,
  currency,
  hidePrices,
}: {
  tenantName: string;
  documentType: 'invoice' | 'quote';
  items: any[];
  totalPrice: number;
  currency: string;
  hidePrices?: boolean;
}) => {
  const doc = new jsPDF();
  const primaryColor = [34, 197, 94] as [number, number, number]; // Emerald 500
  const secondaryColor = [10, 10, 10] as [number, number, number]; // Blackish
  const textColor = [51, 65, 85] as [number, number, number]; // Slate 700

  const isQuote = documentType === 'quote';
  const docTitle = isQuote ? 'COTIZACIÓN DE SERVICIOS' : 'FACTURA POR SERVICIOS';
  const prefix = isQuote ? 'COT' : 'FACT';

  // 1. Cabecera con Logo NovaHub
  doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.roundedRect(14, 15, 20, 20, 4, 4, 'F');
  
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(1.5);
  doc.line(18, 20, 18, 30);
  doc.line(30, 20, 30, 30);
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.line(18, 20, 30, 30);

  // 2. Branding
  doc.setFontSize(22);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('NOVAHUB ', 38, 25);
  const novaHubWidth = doc.getTextWidth('NOVAHUB ');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('ERP', 38 + novaHubWidth, 25);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Soluciones Inteligentes de Gestión Empresarial', 38, 31);

  // 3. Título Dinámico
  doc.setFontSize(18);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(docTitle, 196, 25, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N°-${prefix}: ${Math.floor(Math.random() * 9000) + 1000}`, 196, 31, { align: 'right' });
  doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 196, 37, { align: 'right' });
  doc.text(`Hora: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 196, 42, { align: 'right' });

  // 4. Separador
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 50, 196, 50);

  // 5. Cliente
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('DIRIGIDO A:', 14, 65);
  
  doc.setFontSize(12);
  doc.text(tenantName, 14, 72);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Cliente Corporativo / Suscriptor', 14, 77);

  // 6. Tabla Granular
  const tableData = items.map(item => {
    const row = [
      item.label,
      item.description,
      item.quantity.toString()
    ];
    if (!hidePrices) {
      row.push(item.price === 0 ? '-' : new Intl.NumberFormat('en-US', { style: 'currency', currency: currency === 'USD' ? 'USD' : 'NIO', currencyDisplay: 'narrowSymbol' }).format(item.price));
      row.push(item.price === 0 ? '-' : new Intl.NumberFormat('en-US', { style: 'currency', currency: currency === 'USD' ? 'USD' : 'NIO', currencyDisplay: 'narrowSymbol' }).format(item.price * item.quantity));
    }
    return row;
  });

  const formattedTotal = new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: currency === 'USD' ? 'USD' : 'NIO', 
    currencyDisplay: 'narrowSymbol' 
  }).format(totalPrice);

  autoTable(doc, {
    startY: 90,
    head: [hidePrices ? ['Item', 'Descripción', 'Cant.'] : ['Item', 'Descripción', 'Cant.', 'Unitario', 'Subtotal']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 10, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { textColor: textColor, fontSize: 9, cellPadding: 4 },
    columnStyles: hidePrices ? {
      0: { cellWidth: 50 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center' }
    } : {
      0: { cellWidth: 40 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' }
    },
    styles: { overflow: 'linebreak' },
    margin: { bottom: 40 }
  });

  // 7. TOTAL SECCION SEPARADA (ESTILIZADO)
  const finalTableY = (doc as any).lastAutoTable.finalY || 100;
  
  // Dibujar fondo para bloque de total
  doc.setFillColor(248, 250, 252); // slate-50
  doc.rect(130, finalTableY + 5, 66, 20, 'F');
  
  // Línea de acento arriba del total
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(1);
  doc.line(130, finalTableY + 5, 196, finalTableY + 5); 

  doc.setFontSize(isQuote ? 8.5 : 10);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setFont('helvetica', 'bold');
  const labelX = 132; 
  doc.text(isQuote ? 'Costo total de activación:' : 'TOTAL:', labelX, finalTableY + 17);
  
  doc.setFontSize(16);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(formattedTotal, 195, finalTableY + 18, { align: 'right' });

  // 8. Términos y Notas
  // Verificar si hay espacio para los términos (ajustado a 200 para evitar que queden huérfanos)
  const availableSpace = 250 - finalTableY;
  const needsNewPage = availableSpace < 40;

  if (needsNewPage) {
    doc.addPage();
    doc.setPage(doc.getNumberOfPages());
  }

  const termsY = needsNewPage ? 30 : finalTableY + 35;

  doc.setFontSize(10);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(isQuote ? 'Validez de la Cotización:' : 'Términos de Pago:', 14, termsY);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(isQuote ? 'Esta cotización tiene una validez de 15 días calendario.' : 'Pago inmediato al recibir esta factura para mantener la continuidad de los servicios.', 14, termsY + 6);

  // 9. Footer (En todas las páginas)
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'italic');
    doc.text(`Documento generado por NovaHub Tool - Página ${i} de ${pageCount}`, 14, pageHeight - 15);
    doc.text('www.novahub.io | soporte@novahub.io', 14, pageHeight - 10);
  }

  // 10. Descarga
  const fileName = `${prefix}_NovaHub_${tenantName.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
};

export const generateSupplierStatementPDF = async ({ 
  supplier, 
  transactions, 
  tenantName, 
  tenantLogo, 
  formatAmount,
  primaryColor: themePrimary
}: {
  supplier: any;
  transactions: any[];
  tenantName: string;
  tenantLogo?: string;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
  primaryColor?: string;
}) => {
  const doc = new jsPDF();
  const primaryColor = hexToRgb(themePrimary);
  const textColor = [51, 65, 85] as [number, number, number];

  let titleY = 25;
  if (tenantLogo) {
     try {
       doc.addImage(tenantLogo, 'JPEG', 14, 15, 30, 15);
       titleY = 38;
     } catch (e) { doc.setFontSize(22); }
  } else { doc.setFontSize(22); }

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text((tenantName || 'Nova Hub').toUpperCase(), 14, titleY);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('HISTORIAL DE PROVEEDOR', 14, titleY + 7);

  doc.setFontSize(18);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('HISTORIAL DE PROVEEDOR', 196, 25, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Emisión: ${new Date().toLocaleDateString()}`, 196, 32, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 52, 196, 52);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Información del Proveedor:', 14, 62);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${supplier.name} (Cód: ${supplier.code})`, 14, 68);
  let infoY = 73;
  if (supplier.contactName) { doc.text(`Contacto: ${supplier.contactName}`, 14, infoY); infoY += 5; }
  if (supplier.email) { doc.text(`Email: ${supplier.email}`, 14, infoY); infoY += 5; }
  if (supplier.phone) { doc.text(`Tel: ${supplier.phone}`, 14, infoY); infoY += 5; }

  // 5. Resumen de Saldo y Compras
  doc.setFont('helvetica', 'bold');
  doc.text('SALDO PENDIENTE:', 130, 68);
  doc.setFontSize(14);
  doc.setTextColor(239, 68, 68); // Rose 500
  doc.text(formatAmount(supplier.balance || 0), 196, 68, { align: 'right' });
  
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Total Compras:', 130, 80);
  // Unificar lógica de cálculo con el modal (Solo Órdenes y Facturas)
  const totalPurchasesValue = transactions.reduce((acc, t) => {
    const isPurchase = ['ORDER', 'INVOICE'].includes(t.type);
    return acc + (isPurchase ? Number(t.total || 0) : 0);
  }, 0);
  doc.text(formatAmount(totalPurchasesValue), 196, 80, { align: 'right' });

  const tableData = transactions.map((t: any) => {
    let sign = '';
    const isNeutral = ['ORDER', 'RECEPTION', 'RECURRING'].includes(t.type);
    
    if (!isNeutral) {
      const isPositive = (t.type === 'INVOICE' || (t.type === 'PAYMENT' && t.reference?.startsWith('SC-')));
      sign = isPositive ? '+' : '-';
    }

    return [
      new Date(t.date).toLocaleDateString(),
      t.label,
      t.number,
      translateStatus(t.status),
      `${sign}${formatAmount(t.total, t.currency, t.exchangeRate)}`
    ];
  });

  autoTable(doc, {
    startY: 95,
    head: [['Fecha', 'Tipo', 'Documento', 'Estado', 'Monto']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 10, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { textColor: textColor, fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 25, halign: 'center' },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 'auto', halign: 'left' },
      3: { cellWidth: 30, halign: 'center' },
      4: { cellWidth: 35, halign: 'right' }
    },
    styles: { overflow: 'linebreak', cellPadding: 4 }
  });

  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text(`Documento administrativo de uso interno - Módulo de Compras. Generado por ${tenantName}.`, 14, pageHeight - 10);

  doc.save(`Historial_Proveedor_${supplier.name.replace(/\s+/g, '_')}.pdf`);
};

export const generatePurchaseReceptionPDF = async ({
  reception,
  tenantName,
  formatAmount,
  tenantLogo,
  primaryColor: themePrimary
}: any) => {
  const doc = new jsPDF();
  const primaryColor = hexToRgb(themePrimary);
  const textColor = [51, 65, 85] as [number, number, number];

  let titleY = 25;
  if (tenantLogo) {
     try {
       doc.addImage(tenantLogo, 'PNG', 14, 15, 30, 15);
       titleY = 38;
       doc.setFontSize(14);
     } catch (e) { doc.setFontSize(22); }
  } else { doc.setFontSize(22); }

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(tenantName || 'Nuestra Empresa', 14, titleY);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('RECEPCIÓN DE COMPRA', 14, titleY + 7);

  doc.setFontSize(18);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('RECEPCIÓN DE COMPRA', 196, 25, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N°: ${reception.number || reception.id || 'N/A'}`, 196, 32, { align: 'right' });
  doc.text(`Fecha: ${reception.date ? new Date(reception.date).toLocaleDateString() : 'N/A'}`, 196, 38, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 52, 196, 52);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Proveedor:', 14, 62);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const supp = reception.supplier || {};
  let currentInfoY = 68;
  doc.text(supp.name || 'Proveedor no especificado', 14, currentInfoY);
  if (supp.contactName) { currentInfoY += 5; doc.text(`Contacto: ${supp.contactName}`, 14, currentInfoY); }
  if (supp.email) { currentInfoY += 5; doc.text(`Email: ${supp.email}`, 14, currentInfoY); }
  if (supp.phone) { currentInfoY += 5; doc.text(`Tel: ${supp.phone}`, 14, currentInfoY); }
  if (reception.purchaseOrderNumber) { currentInfoY += 5; doc.text(`Orden: ${reception.purchaseOrderNumber}`, 14, currentInfoY); }
  if (reception.warehouse) { currentInfoY += 5; doc.text(`Almacén: ${reception.warehouse}`, 14, currentInfoY); }

  const itemsRows = (reception.items || []).map((item: any) => [
    item.code || '-',
    item.name || item.description || '-',
    Number(item.quantityOrdered || 0).toString(),
    Number(item.quantityReceived || 0).toString(),
  ]);

  autoTable(doc, {
    startY: 85,
    head: [['Código', 'Producto', 'Cant. Pedida', 'Cant. Recibida']],
    body: itemsRows.length > 0 ? itemsRows : [['-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 10, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { textColor, fontSize: 9 },
    columnStyles: { 0: { cellWidth: 30, halign: 'left' }, 1: { cellWidth: 'auto', halign: 'left' }, 2: { cellWidth: 35, halign: 'center' }, 3: { cellWidth: 35, halign: 'center' } },
    styles: { overflow: 'linebreak', cellPadding: 5 }
  });

  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text(`Documento generado por el módulo de Compras. Generado por ${tenantName}`, 14, pageHeight - 10);

  doc.save(`${reception.number || 'recepcion'}.pdf`);
};

export const generateSupplierCreditPDF = async ({
  credit,
  tenantName,
  formatAmount,
  tenantLogo,
  primaryColor: themePrimary
}: any) => {
  const doc = new jsPDF();
  const primaryColor = hexToRgb(themePrimary);
  const textColor = [51, 65, 85] as [number, number, number];

  let titleY = 25;
  if (tenantLogo) {
     try {
       doc.addImage(tenantLogo, 'JPEG', 14, 15, 30, 15);
       titleY = 38;
       doc.setFontSize(14);
     } catch (e) { doc.setFontSize(22); }
  } else { doc.setFontSize(22); }

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(tenantName || 'Nuestra Empresa', 14, titleY);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('NOTA DE CRÉDITO DE PROVEEDOR', 14, titleY + 7);

  doc.setFontSize(18);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('NOTA DE CRÉDITO', 196, 25, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N°: ${credit.number || credit.id || 'N/A'}`, 196, 32, { align: 'right' });
  doc.text(`Fecha: ${credit.date ? new Date(credit.date).toLocaleDateString() : 'N/A'}`, 196, 38, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 52, 196, 52);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Proveedor:', 14, 62);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const supp = credit.supplier || {};
  let currentInfoY = 68;
  doc.text(supp.name || 'Proveedor no especificado', 14, currentInfoY);
  if (supp.contactName) { currentInfoY += 5; doc.text(`Contacto: ${supp.contactName}`, 14, currentInfoY); }
  if (supp.email) { currentInfoY += 5; doc.text(`Email: ${supp.email}`, 14, currentInfoY); }
  if (supp.phone) { currentInfoY += 5; doc.text(`Tel: ${supp.phone}`, 14, currentInfoY); }

  const tableData = [
    [
      'Monto Original',
      formatAmount(credit.total, credit.currency, credit.exchangeRate)
    ],
    [
      'Saldo Disponible',
      formatAmount(credit.balance, credit.currency, credit.exchangeRate)
    ]
  ];

  autoTable(doc, {
    startY: 85,
    head: [['Concepto', 'Monto']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 10, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { textColor, fontSize: 9 },
    columnStyles: { 0: { cellWidth: 'auto', halign: 'left' }, 1: { cellWidth: 50, halign: 'right' } },
    styles: { overflow: 'linebreak', cellPadding: 5 }
  });

  if (credit.notes) {
     const finalY = (doc as any).lastAutoTable.finalY || 85;
     const notesY = finalY + 15;
     doc.setFontSize(10);
     doc.setFont('helvetica', 'bold');
     doc.setTextColor(textColor[0], textColor[1], textColor[2]);
     doc.text('Notas:', 14, notesY);
     
     doc.setFontSize(9);
     doc.setFont('helvetica', 'normal');
     doc.setTextColor(100, 116, 139);
     const splitNotes = doc.splitTextToSize(credit.notes, 100);
     doc.text(splitNotes, 14, notesY + 6);
  }

  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text(`Documento generado por el módulo de Compras. Generado por ${tenantName}`, 14, pageHeight - 10);

  doc.save(`${credit.number || 'nota_credito'}.pdf`);
};

export const generateRecurringExpensePDF = async ({
  recurring,
  tenantName,
  formatAmount,
  tenantLogo,
  primaryColor: themePrimary
}: any) => {
  const doc = new jsPDF();
  const primaryColor = hexToRgb(themePrimary);
  const textColor = [51, 65, 85] as [number, number, number];

  let titleY = 25;
  if (tenantLogo) {
     try {
       doc.addImage(tenantLogo, 'JPEG', 14, 15, 30, 15);
       titleY = 38;
       doc.setFontSize(14);
     } catch (e) { doc.setFontSize(22); }
  } else { doc.setFontSize(22); }

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(tenantName || 'Nuestra Empresa', 14, titleY);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('FACTURA RECURRENTE DE PROVEEDOR', 14, titleY + 7);

  doc.setFontSize(18);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURA RECURRENTE', 196, 25, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Próxima: ${recurring.nextInvoiceDate ? new Date(recurring.nextInvoiceDate).toLocaleDateString() : 'N/A'}`, 196, 32, { align: 'right' });
  doc.text(`Frecuencia: ${recurring.frequency || 'N/A'}`, 196, 38, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 52, 196, 52);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Proveedor:', 14, 62);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const supp = recurring.supplier || {};
  let currentInfoY = 68;
  doc.text(supp.name || 'Proveedor no especificado', 14, currentInfoY);
  if (supp.contactName) { currentInfoY += 5; doc.text(`Contacto: ${supp.contactName}`, 14, currentInfoY); }
  if (supp.email) { currentInfoY += 5; doc.text(`Email: ${supp.email}`, 14, currentInfoY); }
  if (supp.phone) { currentInfoY += 5; doc.text(`Tel: ${supp.phone}`, 14, currentInfoY); }
  if (recurring.description) { currentInfoY += 5; doc.text(`Descripción: ${recurring.description}`, 14, currentInfoY); }

  const itemsRows = (recurring.items || []).map((item: any) => [
    item.description || '-',
    Number(item.quantity || 0).toString(),
    formatAmount(item.unitPrice || 0, recurring.currency, recurring.exchangeRate),
    formatAmount((item.quantity || 0) * (item.unitPrice || 0), recurring.currency, recurring.exchangeRate),
  ]);

  autoTable(doc, {
    startY: 85,
    head: [['Descripción', 'Cant.', 'Precio Unit.', 'Subtotal']],
    body: itemsRows.length > 0 ? itemsRows : [['-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 10, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { textColor, fontSize: 9 },
    columnStyles: { 0: { cellWidth: 'auto', halign: 'left' }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 35, halign: 'right' }, 3: { cellWidth: 35, halign: 'right' } },
    styles: { overflow: 'linebreak', cellPadding: 5 }
  });

  const finalY = (doc as any).lastAutoTable.finalY || 85;
  const rightX = 196;
  const labelX = 140;
  let currentY = finalY + 10;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('TOTAL ESTIMADO:', labelX, currentY + 3);
  doc.text(formatAmount(Number(recurring.total || recurring.amount || 0), recurring.currency, recurring.exchangeRate), rightX, currentY + 3, { align: 'right' });

  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text(`Documento generado por el módulo de Compras. Generado por ${tenantName}`, 14, pageHeight - 10);

  doc.save(`Recurrente_${recurring.description?.replace(/\s+/g, '_') || 'doc'}.pdf`);
};

