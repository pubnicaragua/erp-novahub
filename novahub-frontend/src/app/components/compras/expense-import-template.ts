import ExcelJS from 'exceljs';

const BASE_HEADERS = [
  'Fecha',
  'Descripción',
  'Categoría',
  'Categoría personalizada',
  'Monto',
  'Moneda',
  'Estado',
  'Método de pago',
  'Pagado a',
  'Referencia',
];

const workbookMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
// ExcelJS expande cada rango de validación en una entrada por celda. 5.000
// filas mantienen ligero el libro; la importación del sistema no tiene este límite.
const maxValidationRow = 5_000;
const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF17365D' } };

function addListValidation(sheet: ExcelJS.Worksheet, column: string, values: string, prompt: string) {
  const validation: ExcelJS.DataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: [`"${values}"`],
    showErrorMessage: true,
    errorTitle: 'Valor no válido',
    error: 'Selecciona una opción de la lista.',
    showInputMessage: true,
    promptTitle: 'Lista de valores',
    prompt,
  };
  for (let row = 2; row <= maxValidationRow; row++) {
    sheet.getCell(`${column}${row}`).dataValidation = { ...validation };
  }
}

export async function downloadExpenseImportTemplate(accountingConnectionEnabled: boolean) {
  const headers = [
    ...BASE_HEADERS,
    ...(accountingConnectionEnabled ? ['Número de cuenta bancaria'] : []),
  ];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NovaHub ERP';
  workbook.title = 'Plantilla de importación masiva de gastos';
  workbook.subject = 'Importación de gastos de Compras';
  workbook.created = new Date();

  const guide = workbook.addWorksheet('Guía');
  guide.columns = [{ width: 31 }, { width: 104 }];
  guide.addRows([
    ['PLANTILLA DE IMPORTACIÓN', 'Gastos de Compras'],
    ['Alcance', 'Cada fila de la hoja Gastos representa un gasto de esta sucursal. La sucursal se toma de la sesión activa al importar.'],
    ['Fecha', 'Obligatoria. Usa una fecha real de Excel o el formato AAAA-MM-DD.'],
    ['Descripción', 'Obligatoria. Describe el gasto con un concepto claro.'],
    ['Categoría', 'Obligatoria. Usa OPERATIVO, ADMINISTRATIVO, VENTAS, FINANCIERO u OTRO.'],
    ['Categoría personalizada', 'Obligatoria cuando Categoría sea OTRO.'],
    ['Monto', 'Obligatorio y mayor que cero. Ingresa un valor numérico, sin símbolo de moneda.'],
    ['Moneda', 'NIO o USD. Si queda vacía, se usa la moneda base configurada en esta sucursal.'],
    ['Conversión de moneda', 'No se carga una tasa en Excel. Para moneda base el sistema usa 1; para otra moneda aplica automáticamente la tasa vigente configurada en esta sucursal.'],
    ['Estado', 'Usa Borrador, Pendiente o Pagado. El sistema reconoce esos valores y los convierte internamente. Si queda vacío, se importa como Pendiente.'],
    ['Pagado a', 'Escribe únicamente el código exacto del proveedor registrado en esta sucursal. Si queda vacío, el gasto se vincula al Proveedor General de esta sucursal; se creará al confirmar si aún no existe. En la vista previa verás el nombre que corresponde al código.'],
    ['Método de pago', 'EFECTIVO, TARJETA, TRANSFERENCIA o CHEQUE. Es obligatorio para Pagado. Los pagos bancarios requieren referencia.'],
    ['Cuenta bancaria', accountingConnectionEnabled
      ? 'La conexión de Contabilidad está activa. Para pagos bancarios, escribe como texto el número exacto de una cuenta activa de esta sucursal; se exige cuando se generará el asiento contable.'
      : 'La conexión de Contabilidad está inactiva. Esta plantilla no incluye una cuenta bancaria; se conserva el método de pago y su referencia sin pedir una cuenta.'],
    ['OTRO y referencia', 'Una categoría OTRO necesita su nombre personalizado. TARJETA, TRANSFERENCIA y CHEQUE requieren una referencia al marcar Pagado.'],
    ['Efectos', 'Todos los estados crean el gasto operativo en Compras. Solo Pagado crea espejo en Finanzas cuando la conexión está habilitada y asiento cuando Contabilidad y la generación automática están activas.'],
    ['Bloques', 'Carga cualquier cantidad de filas. El sistema valida y confirma en bloques de hasta 50; los errores de una fila no detienen las demás.'],
    ['Listas de Excel', 'Las listas desplegables y límites de entrada vienen preparados para las primeras 5.000 filas. La importación del sistema puede procesar archivos con más registros.'],
    ['Reintentos', 'La misma importación puede reintentarse sin duplicar filas ya confirmadas. Una nueva importación del mismo archivo puede crear gastos nuevos.'],
    ['Ejemplos', 'Las filas de ejemplo de Gastos deben reemplazarse o eliminarse antes de cargar el archivo.'],
  ]);
  guide.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
  guide.getRow(1).fill = headerFill;
  guide.getRow(1).height = 28;
  guide.getColumn(1).font = { bold: true, color: { argb: 'FF17365D' } };
  guide.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
  guide.eachRow((row, rowNumber) => { if (rowNumber > 1) row.height = 34; });
  guide.views = [{ state: 'frozen', ySplit: 1 }];

  const expenses = workbook.addWorksheet('Gastos');
  expenses.columns = [
    { width: 15 }, { width: 40 }, { width: 20 }, { width: 27 }, { width: 16 }, { width: 12 },
    { width: 14 }, { width: 20 }, { width: 30 }, { width: 25 },
    ...(accountingConnectionEnabled ? [{ width: 29 }] : []),
  ];
  expenses.addRow(headers);
  const today = new Date();
  const exampleDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  expenses.addRows([
    [exampleDate, 'Servicio de internet', 'OPERATIVO', '', 1500, 'NIO', 'Pagado', 'EFECTIVO', '', '', ...(accountingConnectionEnabled ? [''] : [])],
    [exampleDate, 'Mantenimiento de equipo', 'OTRO', 'Mantenimiento', 250, 'USD', 'Pendiente', '', '', '', ...(accountingConnectionEnabled ? [''] : [])],
    [exampleDate, 'Publicidad en redes', 'VENTAS', '', 800, 'NIO', 'Pagado', 'TRANSFERENCIA', '', 'TR-0088', ...(accountingConnectionEnabled ? ['001234560078'] : [])],
  ]);
  const header = expenses.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = headerFill;
  header.alignment = { wrapText: true, vertical: 'middle' };
  header.height = 36;
  expenses.getColumn(1).numFmt = 'dd/mm/yyyy';
  expenses.getColumn(5).numFmt = '#,##0.00';
  if (accountingConnectionEnabled) expenses.getColumn(headers.length).numFmt = '@';
  expenses.getColumn(1).eachCell((cell, rowNumber) => { if (rowNumber > 1) cell.alignment = { vertical: 'top' }; });
  expenses.getColumn(2).alignment = { wrapText: true, vertical: 'top' };

  addListValidation(expenses, 'C', 'OPERATIVO,ADMINISTRATIVO,VENTAS,FINANCIERO,OTRO', 'Elige la categoría del gasto.');
  addListValidation(expenses, 'F', 'NIO,USD', 'Elige la moneda.');
  addListValidation(expenses, 'G', 'Borrador,Pendiente,Pagado', 'Elige el estado inicial.');
  addListValidation(expenses, 'H', 'EFECTIVO,TARJETA,TRANSFERENCIA,CHEQUE', 'Elige el método cuando el gasto esté pagado.');
  const amountValidation: ExcelJS.DataValidation = {
    type: 'decimal', operator: 'greaterThan', formulae: ['0'], allowBlank: false,
    showErrorMessage: true, errorTitle: 'Monto no válido', error: 'El monto debe ser mayor que cero.',
  };
  for (let row = 2; row <= maxValidationRow; row++) {
    expenses.getCell(`E${row}`).dataValidation = { ...amountValidation };
  }
  expenses.views = [{ state: 'frozen', ySplit: 1 }];
  expenses.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + headers.length)}1` };

  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: workbookMime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Plantilla_Gastos_Masiva.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
