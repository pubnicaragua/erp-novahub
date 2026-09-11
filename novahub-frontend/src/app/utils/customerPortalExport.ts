import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  CustomerPortalInventoryRow,
  CustomerPortalInventoryVariant,
  CustomerPortalSummary,
} from '../services/customer-portal.service';
import { getBase64Image } from './reportExportUtils';
import { getPdfDesignSettings, getPdfTemplateLogo, pdfDesignColor } from './pdfGenerator';
import { buildDatedDownloadFileName, buildDatedPdfFileName } from './exportFileNames';

type PortalSalesRow = Record<string, any>;

export interface CustomerPortalExportOptions {
  customerName: string;
  tenantName: string;
  tenantLogo?: string | null;
  summary: CustomerPortalSummary;
  inventory: CustomerPortalInventoryRow[];
  sales: PortalSalesRow[];
  currency: string;
  money: (value: number, sourceCurrency?: string, sourceExchangeRate?: number) => string;
}

interface PortalInventoryTotals {
  quantity: number;
  reserved: number;
  available: number;
  inventoryValue: number;
  availableInventoryValue: number;
}

interface PortalWarehouseRow {
  warehouseId?: string | null;
  warehouseName: string;
  quantity: number;
  reserved: number;
  available: number;
}

const numberValue = (value: unknown) => {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const quantityLabel = (value: unknown) => numberValue(value).toLocaleString('es-NI', { maximumFractionDigits: 2 });

const dateLabel = (value: unknown) => {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusLabel = (value: unknown) => {
  const normalized = String(value || '').toUpperCase();
  const labels: Record<string, string> = {
    PAID: 'Pagada',
    PARTIALLY_PAID: 'Pagada parcialmente',
    ISSUED: 'Emitida',
    POSTED: 'Registrada',
    OPEN: 'Pendiente',
    OVERDUE: 'Vencida',
    CANCELLED: 'Cancelada',
    DRAFT: 'Borrador',
  };
  return labels[normalized] || normalized.replace(/_/g, ' ').toLowerCase() || 'Sin estado';
};

const attributesLabel = (attributes: CustomerPortalInventoryVariant['attributes']) => attributes.length
  ? attributes.map((attribute) => `${attribute.attributeName || attribute.name || 'Atributo'}: ${attribute.value || '—'}`).join(' · ')
  : 'Sin atributos';

export function portalVariantWarehouseRows(variant: CustomerPortalInventoryVariant): PortalWarehouseRow[] {
  const grouped = new Map<string, PortalWarehouseRow>();
  for (const level of variant.inventory || []) {
    const key = String(level.warehouseId || level.warehouseName || 'warehouse');
    const current = grouped.get(key);
    if (current) {
      current.quantity += numberValue(level.quantity);
      current.reserved += numberValue(level.reserved);
      current.available += numberValue(level.available);
      continue;
    }
    grouped.set(key, {
      warehouseId: level.warehouseId,
      warehouseName: level.warehouseName || 'Bodega',
      quantity: numberValue(level.quantity),
      reserved: numberValue(level.reserved),
      available: numberValue(level.available),
    });
  }
  return [...grouped.values()];
}

const productTotals = (product: CustomerPortalInventoryRow): PortalInventoryTotals => {
  const levels = product.inventory || [];
  const fallback = levels.reduce((totals, level) => ({
    quantity: totals.quantity + numberValue(level.quantity),
    reserved: totals.reserved + numberValue(level.reserved),
    available: totals.available + numberValue(level.available),
  }), { quantity: 0, reserved: 0, available: 0 });
  return {
    quantity: Number.isFinite(Number(product.quantity)) ? numberValue(product.quantity) : fallback.quantity,
    reserved: Number.isFinite(Number(product.reserved)) ? numberValue(product.reserved) : fallback.reserved,
    available: Number.isFinite(Number(product.available)) ? numberValue(product.available) : fallback.available,
    inventoryValue: numberValue(product.inventoryValue),
    availableInventoryValue: numberValue(product.availableInventoryValue),
  };
};

const inventoryTotals = (inventory: CustomerPortalInventoryRow[]) => inventory.reduce((totals, product) => {
  const current = productTotals(product);
  return {
    quantity: totals.quantity + current.quantity,
    reserved: totals.reserved + current.reserved,
    available: totals.available + current.available,
    inventoryValue: totals.inventoryValue + current.inventoryValue,
    availableInventoryValue: totals.availableInventoryValue + current.availableInventoryValue,
  };
}, { quantity: 0, reserved: 0, available: 0, inventoryValue: 0, availableInventoryValue: 0 });

const variantFallback = (product: CustomerPortalInventoryRow): CustomerPortalInventoryVariant => ({
  id: `${product.id}:standard`,
  sku: product.code,
  name: 'Estándar',
  attributes: [],
  baseCost: numberValue(product.costPrice),
  configuredCost: numberValue(product.configuredCost ?? product.costPrice),
  costSource: 'PRODUCT',
  quantity: productTotals(product).quantity,
  reserved: productTotals(product).reserved,
  available: productTotals(product).available,
  inventoryValue: productTotals(product).inventoryValue,
  availableInventoryValue: productTotals(product).availableInventoryValue,
  inventory: product.inventory || [],
});

const inventoryExportRows = (inventory: CustomerPortalInventoryRow[]) => inventory.flatMap((product) => {
  const variants = product.variants?.length ? product.variants : [variantFallback(product)];
  return variants.map((variant) => {
    const warehouses = portalVariantWarehouseRows(variant);
    return [
      product.name,
      product.code,
      product.brandName || 'Sin marca',
      variant.name,
      variant.sku,
      attributesLabel(variant.attributes),
      warehouses.length
        ? warehouses.map((warehouse) => `${warehouse.warehouseName}: ${quantityLabel(warehouse.quantity)} u. · ${quantityLabel(warehouse.available)} disp.`).join('\n')
        : 'Sin existencias registradas',
      numberValue(product.costPrice),
      numberValue(variant.configuredCost),
      numberValue(variant.quantity),
      numberValue(variant.reserved),
      numberValue(variant.available),
      numberValue(variant.inventoryValue),
      numberValue(variant.availableInventoryValue),
    ];
  });
});

const salesExportRows = (sales: PortalSalesRow[]) => sales.map((invoice) => [
  dateLabel(invoice.date),
  invoice.number || '—',
  statusLabel(invoice.status),
  (invoice.items || []).map((item: any) => item.description).join(', ') || '—',
  (invoice.items || []).length,
  numberValue(invoice.total),
  invoice.currency || 'NIO',
  numberValue(invoice.amountPaid),
  numberValue(invoice.balance),
  numberValue(invoice.totalBase),
  numberValue(invoice.amountPaidBase),
  numberValue(invoice.balanceBase),
]);

const excelColumnName = (index: number) => {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function styleExcelWorksheet({ worksheet, title, subtitle, headers, rows, numericColumns, moneyColumns, moneyRows }: {
  worksheet: ExcelJS.Worksheet;
  title: string;
  subtitle: string;
  headers: string[];
  rows: Array<Array<unknown>>;
  numericColumns?: number[];
  moneyColumns?: number[];
  moneyRows?: number[];
}) {
  const endColumn = excelColumnName(headers.length - 1);
  worksheet.mergeCells(`A1:${endColumn}1`);
  worksheet.getCell('A1').value = title.toUpperCase();
  worksheet.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
  worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
  worksheet.getRow(1).height = 28;
  worksheet.mergeCells(`A2:${endColumn}2`);
  worksheet.getCell('A2').value = subtitle;
  worksheet.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };
  worksheet.addRow(headers);
  const header = worksheet.getRow(3);
  header.height = 25;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
  });
  rows.forEach((row, index) => {
    const excelRow = worksheet.addRow(row);
    excelRow.eachCell((cell, columnIndex) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
      if (index % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      if (numericColumns?.includes(columnIndex - 1) && typeof cell.value === 'number') {
        const isMoney = moneyColumns?.includes(columnIndex - 1) && (!moneyRows || moneyRows.includes(index));
        cell.numFmt = isMoney ? '#,##0.00' : '#,##0.##';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });
  });
  worksheet.columns = headers.map((headerLabel, index) => ({
    header: headerLabel,
    width: index === 6 ? 34 : Math.min(34, Math.max(14, headerLabel.length + 5)),
  }));
  worksheet.autoFilter = { from: 'A3', to: `${endColumn}3` };
  worksheet.views = [{ state: 'frozen', ySplit: 3 }];
}

export async function exportCustomerPortalExcel(options: CustomerPortalExportOptions) {
  const totals = inventoryTotals(options.inventory);
  const variantCount = options.inventory.reduce((total, product) => total + (product.variants?.length || 0), 0);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NovaHub';
  workbook.created = new Date();

  const summaryRows: Array<Array<unknown>> = [
    ['Cliente', options.customerName],
    ['Empresa', options.tenantName || 'NovaHub'],
    ['Moneda de referencia', options.currency],
    ['Generado', new Date().toLocaleString('es-NI')],
    ['Ventas de hoy', numberValue(options.summary.today.sales)],
    ['Facturas de hoy', numberValue(options.summary.today.invoices)],
    ['Ventas del mes', numberValue(options.summary.month.sales)],
    ['Facturas del mes', numberValue(options.summary.month.invoices)],
    ['Total facturado', numberValue(options.summary.totalInvoiced)],
    ['Total pagado', numberValue(options.summary.totalPaid)],
    ['Saldo pendiente', numberValue(options.summary.pendingBalance)],
    ['Devoluciones', numberValue(options.summary.returnsTotal)],
    ['Notas de crédito', numberValue(options.summary.creditNotesTotal)],
    ['Productos agrupados', options.inventory.length],
    ['Variantes', variantCount],
    ['Unidades físicas', totals.quantity],
    ['Unidades disponibles', totals.available],
    ['Valor del inventario', totals.inventoryValue],
    ['Valor disponible', totals.availableInventoryValue],
    ['Documentos de venta', options.sales.length],
  ];
  styleExcelWorksheet({
    worksheet: workbook.addWorksheet('Resumen'),
    title: 'Resumen del portal',
    subtitle: `${options.customerName} · ${options.tenantName || 'NovaHub'} · ${options.currency}`,
    headers: ['Indicador', 'Valor'],
    rows: summaryRows,
    numericColumns: [1],
    moneyColumns: [1],
    moneyRows: [4, 6, 8, 9, 10, 11, 12, 17, 18],
  });

  styleExcelWorksheet({
    worksheet: workbook.addWorksheet('Inventario'),
    title: 'Inventario detallado',
    subtitle: `${options.customerName} · Una fila por variante; las bodegas se muestran agrupadas en la misma fila · ${options.currency}`,
    headers: ['Producto', 'Código', 'Marca', 'Variante', 'SKU', 'Atributos', 'Bodegas', 'Costo base', 'Costo configurado', 'Unidades', 'Reservado', 'Disponible', 'Valor inventario', 'Valor disponible'],
    rows: inventoryExportRows(options.inventory),
    numericColumns: [7, 8, 9, 10, 11, 12, 13],
    moneyColumns: [7, 8, 12, 13],
  });

  styleExcelWorksheet({
    worksheet: workbook.addWorksheet('Ventas y facturas'),
    title: 'Ventas y facturas',
    subtitle: `${options.customerName} · Líneas atribuidas a tus productos · Valores base en ${options.currency}`,
    headers: ['Fecha', 'Factura', 'Estado', 'Productos', 'Líneas', 'Total atribuido', 'Moneda', 'Pagado atribuido', 'Saldo atribuido', `Total base (${options.currency})`, `Pagado base (${options.currency})`, `Saldo base (${options.currency})`],
    rows: salesExportRows(options.sales),
    numericColumns: [4, 5, 7, 8, 9, 10, 11],
    moneyColumns: [5, 7, 8, 9, 10, 11],
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), buildDatedDownloadFileName(['portal_cliente', options.customerName, 'completo'], 'xlsx'));
}

function addPdfHeader(doc: jsPDF, options: CustomerPortalExportOptions, primary: [number, number, number], text: [number, number, number], logo?: string | null) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  let x = margin;
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', margin, 10, 18, 18, undefined, 'FAST');
      x += 23;
    } catch {
      // El reporte continúa aunque el logo no sea compatible con jsPDF.
    }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...primary);
  doc.text(options.tenantName || 'NovaHub', x, 17);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...text);
  doc.text(`${options.customerName} · Portal de cliente · Generado: ${new Date().toLocaleString('es-NI')}`, x, 23);
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.5);
  doc.line(margin, 30, pageWidth - margin, 30);
}

export async function exportCustomerPortalPdf(options: CustomerPortalExportOptions) {
  const settings = await getPdfDesignSettings('reportes.sales');
  const primary = pdfDesignColor(settings.primaryColor, [16, 185, 129]);
  const text = pdfDesignColor(settings.textColor, [51, 65, 85]);
  const line = pdfDesignColor(settings.lineColor, [226, 232, 240]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const totals = inventoryTotals(options.inventory);
  const variantCount = options.inventory.reduce((total, product) => total + (product.variants?.length || 0), 0);
  let logo: string | null = null;
  const logoSource = getPdfTemplateLogo(settings, options.tenantLogo, 'reportes.sales');
  if (logoSource) logo = logoSource.startsWith('data:') ? logoSource : await getBase64Image(logoSource);

  const tableStyles = {
    font: 'helvetica',
    fontSize: 7,
    cellPadding: 1.8,
    textColor: text,
    lineColor: line,
    lineWidth: 0.15,
    overflow: 'linebreak' as const,
  };
  const headStyles = { fillColor: primary, textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const, halign: 'center' as const };

  addPdfHeader(doc, options, primary, text, logo);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...text);
  doc.text('Resumen', margin, 42);
  autoTable(doc, {
    startY: 47,
    margin: { left: margin, right: margin },
    head: [['Indicador', 'Valor']],
    body: [
      ['Ventas de hoy', options.money(numberValue(options.summary.today.sales), options.summary.currency)],
      ['Ventas del mes', options.money(numberValue(options.summary.month.sales), options.summary.currency)],
      ['Total facturado', options.money(numberValue(options.summary.totalInvoiced), options.summary.currency)],
      ['Total pagado', options.money(numberValue(options.summary.totalPaid), options.summary.currency)],
      ['Saldo pendiente', options.money(numberValue(options.summary.pendingBalance), options.summary.currency)],
      ['Devoluciones', options.money(numberValue(options.summary.returnsTotal), options.summary.currency)],
      ['Notas de crédito', options.money(numberValue(options.summary.creditNotesTotal), options.summary.currency)],
      ['Productos / variantes', `${options.inventory.length} / ${variantCount}`],
      ['Unidades físicas / disponibles', `${quantityLabel(totals.quantity)} / ${quantityLabel(totals.available)}`],
      ['Valor del inventario', options.money(totals.inventoryValue, options.currency)],
      ['Valor disponible', options.money(totals.availableInventoryValue, options.currency)],
    ],
    theme: 'grid',
    styles: tableStyles,
    headStyles,
    columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold' }, 1: { halign: 'right' } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.addPage('a4', 'landscape');
  addPdfHeader(doc, options, primary, text, logo);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...text);
  doc.text('Inventario detallado', margin, 42);
  const inventoryRows = inventoryExportRows(options.inventory).map((row) => [
    `${row[0]}\n${row[1]}`,
    `${row[3]}\n${row[4]}`,
    row[5],
    row[6],
    options.money(numberValue(row[7]), options.currency),
    options.money(numberValue(row[8]), options.currency),
    quantityLabel(row[9]),
    quantityLabel(row[10]),
    quantityLabel(row[11]),
    options.money(numberValue(row[12]), options.currency),
    options.money(numberValue(row[13]), options.currency),
  ]);
  autoTable(doc, {
    startY: 47,
    margin: { left: margin, right: margin, bottom: 14 },
    head: [['Producto / código', 'Variante / SKU', 'Atributos', 'Bodegas', 'Costo base', 'Costo configurado', 'Unid.', 'Res.', 'Disp.', 'Valor inventario', 'Valor disponible']],
    body: inventoryRows.length ? inventoryRows : [['Sin inventario', '—', '—', '—', options.money(0, options.currency), options.money(0, options.currency), '0', '0', '0', options.money(0, options.currency), options.money(0, options.currency)]],
    theme: 'grid',
    styles: { ...tableStyles, fontSize: 6.2 },
    headStyles: { ...headStyles, fontSize: 6.2 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 31 }, 1: { cellWidth: 28 }, 2: { cellWidth: 31 }, 3: { cellWidth: 47 }, 4: { halign: 'right', cellWidth: 20 }, 5: { halign: 'right', cellWidth: 24 }, 6: { halign: 'right', cellWidth: 12 }, 7: { halign: 'right', cellWidth: 12 }, 8: { halign: 'right', cellWidth: 12 }, 9: { halign: 'right', cellWidth: 22 }, 10: { halign: 'right', cellWidth: 22 } },
  });
  const inventoryEndY = Number((doc as any).lastAutoTable?.finalY || 47) + 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...primary);
  doc.text(`Totales: ${quantityLabel(totals.quantity)} unidades físicas · ${quantityLabel(totals.available)} disponibles · ${options.money(totals.inventoryValue, options.currency)}`, margin, Math.min(inventoryEndY, pageHeight - 10));

  doc.addPage('a4', 'landscape');
  addPdfHeader(doc, options, primary, text, logo);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...text);
  doc.text('Ventas y facturas', margin, 42);
  const salesRows = salesExportRows(options.sales).map((row) => [
    row[0],
    row[1],
    row[2],
    row[3],
    options.money(numberValue(row[5]), String(row[6])),
    String(row[6]),
    options.money(numberValue(row[7]), String(row[6])),
    options.money(numberValue(row[8]), String(row[6])),
    options.money(numberValue(row[9]), options.currency),
  ]);
  autoTable(doc, {
    startY: 47,
    margin: { left: margin, right: margin, bottom: 14 },
    head: [['Fecha', 'Factura', 'Estado', 'Productos', 'Total atribuido', 'Moneda', 'Pagado', 'Saldo', `Total base (${options.currency})`]],
    body: salesRows.length ? salesRows : [['—', '—', '—', 'No hay ventas atribuidas', options.money(0, options.currency), options.currency, options.money(0, options.currency), options.money(0, options.currency), options.money(0, options.currency)]],
    theme: 'grid',
    styles: { ...tableStyles, fontSize: 6.8 },
    headStyles: { ...headStyles, fontSize: 6.8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 25 }, 2: { cellWidth: 23 }, 3: { cellWidth: 82 }, 4: { halign: 'right', cellWidth: 27 }, 5: { cellWidth: 16 }, 6: { halign: 'right', cellWidth: 25 }, 7: { halign: 'right', cellWidth: 25 }, 8: { halign: 'right', cellWidth: 30 } },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`${options.tenantName || 'NovaHub'} · ${options.customerName} · Página ${page} de ${pageCount}`, pageWidth / 2, pageHeight - 7, { align: 'center' });
  }
  doc.save(buildDatedPdfFileName(['portal_cliente', options.customerName, 'completo']));
}
