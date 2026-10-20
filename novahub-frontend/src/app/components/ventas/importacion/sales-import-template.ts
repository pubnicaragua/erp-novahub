import ExcelJS from 'exceljs';
import type { SalesImportKind } from '../../../services/sales-import.service';

const detailHeaders = [
  'Referencia de factura',
  'Código/SKU del producto o variante',
  'Nombre de lista de precios',
  'Cantidad',
  'Nombre exacto de bodega',
  'Descuento (%)',
  'IVA',
];

const workbookMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function downloadSalesImportTemplate(kind: SalesImportKind, accountingConnectionEnabled = false) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NovaHub ERP';
  workbook.subject = kind === 'POS' ? 'Plantilla de importación de Caja' : 'Plantilla de importación de facturas';
  workbook.title = kind === 'POS' ? 'Plantilla Caja' : 'Plantilla Facturas';
  workbook.created = new Date();

  const guide = workbook.addWorksheet('Guía');
  guide.columns = [{ width: 28 }, { width: 96 }];
  guide.addRows([
    ['PLANTILLA DE IMPORTACIÓN', kind === 'POS' ? 'Ventas de Caja' : 'Facturas'],
    ['Importante', 'Carga ventas nuevas que quedarán pagadas por el total calculado. Esta plantilla no importa pagos parciales, créditos ni ventas históricas.'],
    ['Referencia de factura', 'Agrupa una fila de Documentos con todas sus filas de Detalle. No es el número oficial: NovaHub lo genera al confirmar.'],
    ['Cliente', 'Deja el código vacío para usar el Cliente General. Si todavía no existe, se crea al preparar la primera importación y se reutiliza después.'],
    ['Código/SKU', 'Usa el código del producto sin variantes o el SKU exacto de la variante. Si el producto tiene variantes, no uses el código padre.'],
    ['Lista de precios', 'Escribe el nombre visible y exacto de la lista en cada producto. Puedes combinar listas en una factura. Este campo es obligatorio para productos; los servicios usan el precio de su catálogo. No escribas el código.'],
    ['Precio', 'No se captura en Excel. NovaHub consulta el precio vigente del producto en la lista indicada y lo muestra en la vista previa.'],
    ['IVA', 'Deja vacío o escribe EXENTO para no aplicar IVA. Escribe GRAVADO para aplicar la tasa configurada en el producto. Los servicios no llevan IVA.'],
    ['Descuento', 'Porcentaje entre 0 y 100. Si queda vacío, se interpreta como 0 %.'],
    ['Bodega', 'Escribe el nombre exacto de la bodega por línea. Los servicios pueden dejarla vacía.'],
    ['Pago', kind === 'POS' ? 'En Caja solo se admite EFECTIVO en esta plantilla. El sistema registra el total calculado.' : 'Admite EFECTIVO, TARJETA, TRANSFERENCIA y CHEQUE. El total calculado se registra como un pago completo. TARJETA, TRANSFERENCIA y CHEQUE requieren referencia de pago.'],
    ...(kind === 'INVOICE' ? [
      ['Referencia de pago', 'Obligatoria para tarjeta, transferencia o cheque. Escribe el número de autorización, comprobante o cheque.'],
      ['Cuenta bancaria', accountingConnectionEnabled
        ? 'La conexión de Contabilidad está activa. Se puede indicar el número en el Excel o seleccionar una cuenta activa de esta sucursal en la vista previa.'
        : 'La conexión de Contabilidad está inactiva. No se pide cuenta bancaria; se conserva el método de pago y la referencia.'],
    ] : []),
    ['Bloques', 'La vista previa separa el trabajo en bloques de hasta 50 documentos o 1.000 líneas. Las líneas de una misma factura no se separan.'],
    ['Caja', kind === 'POS' ? 'La importación se inicia desde una caja y una sesión que ya estén abiertas. La caja y sesión elegidas aplican a toda la carga.' : 'En Facturas puedes elegir opcionalmente una caja abierta para asociar el pago a su sesión.'],
    ['Hojas', 'Documentos contiene un encabezado por referencia. Detalle contiene las líneas; agrupa juntas y en orden las líneas de cada referencia.'],
  ]);
  guide.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  guide.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
  guide.getColumn(1).font = { bold: true };
  guide.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
  guide.eachRow((row) => { row.height = 34; });
  guide.getRow(1).height = 26;

  const documents = workbook.addWorksheet('Documentos');
  const documentHeaders = [
    'Referencia de factura',
    'Fecha',
    'Código de cliente',
    'Moneda',
    'Método de pago',
    ...(kind === 'INVOICE' ? [
      'Referencia de pago',
      ...(accountingConnectionEnabled ? ['Número de cuenta bancaria'] : []),
    ] : []),
    'Observación',
  ];
  const today = new Date();
  const exampleDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  documents.columns = [
    { width: 24 }, { width: 15 }, { width: 22 }, { width: 12 }, { width: 18 },
    ...(kind === 'INVOICE' ? [
      { width: 24 },
      ...(accountingConnectionEnabled ? [{ width: 28 }] : []),
    ] : []),
    { width: 38 },
  ];
  documents.addRow(documentHeaders);
  documents.addRow([
    'FAC-001',
    exampleDate,
    '',
    'NIO',
    'EFECTIVO',
    ...(kind === 'INVOICE' ? ['', ...(accountingConnectionEnabled ? [''] : [])] : []),
    'Venta de ejemplo; eliminar o reemplazar antes de cargar.',
  ]);
  documents.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  documents.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
  documents.getRow(1).alignment = { wrapText: true, vertical: 'middle' };
  documents.getRow(1).height = 34;
  documents.getColumn(2).numFmt = 'dd/mm/yyyy';
  if (kind === 'INVOICE' && accountingConnectionEnabled) documents.getColumn(7).numFmt = '@';
  documents.getColumn(4).eachCell((cell, rowNumber) => { if (rowNumber > 1) cell.dataValidation = { type: 'list', allowBlank: true, formulae: ['"NIO,USD"'] }; });
  documents.getColumn(5).eachCell((cell, rowNumber) => { if (rowNumber > 1) cell.dataValidation = { type: 'list', allowBlank: true, formulae: [kind === 'INVOICE' ? '"EFECTIVO,TARJETA,TRANSFERENCIA,CHEQUE"' : '"EFECTIVO"'] }; });

  const detail = workbook.addWorksheet('Detalle');
  detail.columns = [{ width: 24 }, { width: 36 }, { width: 30 }, { width: 14 }, { width: 30 }, { width: 17 }, { width: 17 }];
  detail.addRow(detailHeaders);
  detail.addRow(['FAC-001', 'SKU-EJEMPLO', '', 1, 'Bodega Principal', 0, '']);
  detail.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  detail.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
  detail.getRow(1).alignment = { wrapText: true, vertical: 'middle' };
  detail.getRow(1).height = 34;
  detail.getColumn(6).numFmt = '0.##';
  detail.getColumn(7).eachCell((cell, rowNumber) => {
    if (rowNumber > 1) cell.dataValidation = { type: 'list', allowBlank: true, formulae: ['"GRAVADO,EXENTO"'] };
  });

  for (const sheet of [documents, detail]) {
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: `${sheet === documents ? String.fromCharCode(64 + documentHeaders.length) : 'G'}1` };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: workbookMime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = kind === 'POS' ? 'Plantilla_Caja_Masiva.xlsx' : 'Plantilla_Facturas_Masivas.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
