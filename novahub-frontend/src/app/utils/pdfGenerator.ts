import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PDFGeneratorParams {
  estimate: any; // El objeto localDoc/estimate a imprimir
  tenantName: string;
  formatAmount: (amount: number, currency: string, rate: number) => string;
  tenantLogo?: string;
  documentType?: 'estimate' | 'order' | 'invoice' | 'recurring' | 'payment' | 'return' | 'credit-note';
}

export const generateEstimatePDF = async ({ estimate, tenantName, formatAmount, tenantLogo, documentType = 'estimate' }: PDFGeneratorParams) => {
  const doc = new jsPDF();
  
  // 1. Configuraciones iniciales y estilos base
  const primaryColor = [16, 185, 129] as [number, number, number]; // Emerald 500 para la identidad corporativa básica
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
  doc.text(docTypeStr, 14, titleY + 7);
  
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
  const clienteEmail = estimate.customer?.email || '';
  const clienteTelf = estimate.customer?.phone || '';
  
  doc.text(clienteNombre, 14, 68);
  if (clienteEmail) doc.text(clienteEmail, 14, 73);
  if (clienteTelf) doc.text(clienteTelf, 14, 78);

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

export const generateSupplierHistoryPDF = async ({ supplier, items, tenantName, formatAmount, tenantLogo }: any) => {
  const doc = new jsPDF();
  
  const primaryColor = [16, 185, 129] as [number, number, number];
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
  doc.text('Historial de Compras (Productos y Servicios)', 14, titleY + 7);
  
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
}: {
  expense: any;
  tenantName: string;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
}) => {
  const doc = new jsPDF();
  const primaryColor = [16, 185, 129] as [number, number, number];
  const textColor = [51, 65, 85] as [number, number, number];

  doc.setFontSize(20);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(tenantName || 'Nova Hub', 14, 22);

  doc.setFontSize(12);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Comprobante de Gasto', 14, 30);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N°: ${expense.number || expense.id || 'N/A'}`, 196, 22, { align: 'right' });
  doc.text(`Fecha: ${expense.date ? new Date(expense.date).toLocaleDateString() : 'N/A'}`, 196, 28, { align: 'right' });
  doc.text(`Hora: ${expense.time || (expense.date ? new Date(expense.date).toLocaleTimeString() : 'N/A')}`, 196, 34, { align: 'right' });

  autoTable(doc, {
    startY: 45,
    head: [['Campo', 'Detalle']],
    body: [
      ['Descripción', expense.description || '-'],
      ['Categoría', expense.category === 'OTRO' ? (expense.categoryCustom || 'OTRO') : (expense.category || '-')],
      ['Monto', formatAmount(Number(expense.amount || 0), expense.currency, expense.exchangeRate)],
      ['Pagado a', expense.paidTo || '-'],
      ['Cuenta de origen', expense.paymentSource || '-'],
      ['Referencia', expense.reference || '-'],
      ['Estado', expense.status || '-'],
      ['Evidencia', expense.evidenceFileName || 'No adjunta'],
    ],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
    bodyStyles: { textColor },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
    },
    styles: { fontSize: 10, cellPadding: 4, overflow: 'linebreak' },
  });

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text(`Generado por ${tenantName} - Módulo de Compras`, 14, doc.internal.pageSize.height - 10);

  doc.save(`${expense.number || expense.id || 'gasto'}.pdf`);
};
