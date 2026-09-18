import * as XLSX from 'xlsx';
import { resolveStandardProductPriceLists } from './product-price-lists';

export type CanonicalImportPriceList = {
  code: string;
  name: string;
};

export const getCanonicalProductImportHeaders = (
  priceLists: CanonicalImportPriceList[],
  canViewInventoryCost: boolean,
) => [
  'Código/Sku',
  'Nombre',
  'Descripción',
  'Nota comercial',
  'Categoría',
  'Unidad',
  'Marca',
  'Variable',
  'Moneda',
  ...priceLists.map((list) => `Precio ${list.name}`),
  ...(canViewInventoryCost ? ['Costo'] : []),
  'Serie/IMEI',
];

export type CanonicalImportLocation = {
  label: string;
  type?: 'BODEGA' | 'ALMACEN' | string;
  branchName?: string | null;
  address?: string | null;
};

export type CanonicalVariantImportTemplateOptions = {
  categoryName?: string;
  warehouseName?: string;
  priceLists?: CanonicalImportPriceList[];
  currency?: string;
  exchangeRate?: number;
  canViewInventoryCost?: boolean;
  fileName?: string;
  locations?: CanonicalImportLocation[];
  context?: {
    mode?: 'INVENTORY' | 'PURCHASE_ORDER' | 'MANAGER';
    orderNumber?: string;
    supplierName?: string;
    purchaseWarehouseName?: string;
    purchaseType?: string;
    managerBusinessUnitName?: string;
  };
};

const FALLBACK_PRICE_LISTS: CanonicalImportPriceList[] = [
  { code: 'RETAIL', name: 'Minorista' },
  { code: 'WHOLESALE', name: 'Mayorista' },
  { code: 'DISTRIBUTOR', name: 'Distribuidor' },
];

const PURCHASE_ORDER_FORMULA_ROWS = 1000;

const appendSheet = (
  workbook: XLSX.WorkBook,
  name: string,
  rows: any[][],
  configure?: (sheet: XLSX.WorkSheet) => void,
) => {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  configure?.(sheet);
  sheet['!cols'] = (rows[0] || []).map((header) => ({
    wch: Math.max(12, Math.min(34, String(header).length + 2)),
  }));
  XLSX.utils.book_append_sheet(workbook, sheet, name);
};

const configurePurchaseOrderInventorySheet = (
  sheet: XLSX.WorkSheet,
  headers: string[],
) => {
  const quantityColumn = headers.indexOf('Cantidad');
  const unitCostColumn = headers.findIndex((header) => header.startsWith('Costo unitario de compra'));
  const taxBaseColumn = headers.findIndex((header) => header.startsWith('Base IVA'));
  const taxRateColumn = headers.indexOf('IVA %');
  const taxAmountColumn = headers.findIndex((header) => header.startsWith('Monto IVA'));

  if ([quantityColumn, unitCostColumn, taxBaseColumn, taxRateColumn, taxAmountColumn].some((column) => column < 0)) return;

  for (let rowIndex = 1; rowIndex <= PURCHASE_ORDER_FORMULA_ROWS; rowIndex += 1) {
    const rowNumber = rowIndex + 1;
    const quantity = XLSX.utils.encode_col(quantityColumn) + rowNumber;
    const unitCost = XLSX.utils.encode_col(unitCostColumn) + rowNumber;
    const taxBase = XLSX.utils.encode_col(taxBaseColumn) + rowNumber;
    const taxRate = XLSX.utils.encode_col(taxRateColumn) + rowNumber;
    const taxAmount = XLSX.utils.encode_col(taxAmountColumn) + rowNumber;

    // La base imponible se calcula automáticamente como cantidad por costo
    // unitario, igual que en la previsualización de la orden.
    sheet[taxBase] = {
      t: 'n',
      f: `IF(OR(${quantity}="",${unitCost}=""),"",ROUND(${quantity}*${unitCost},2))`,
    };
    sheet[taxAmount] = {
      t: 'n',
      f: `IF(OR(${taxRate}="",${taxBase}=""),"",ROUND(${taxBase}*${taxRate}/100,2))`,
    };
  }

  sheet['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: PURCHASE_ORDER_FORMULA_ROWS, c: headers.length - 1 },
  });
};

export const createCanonicalVariantImportWorkbook = (
  options: CanonicalVariantImportTemplateOptions = {},
) => {
  const currency = String(options.currency || 'NIO').toUpperCase();
  const exchangeRate = Number(options.exchangeRate || 1) > 0 ? Number(options.exchangeRate) : 1;
  const canViewInventoryCost = options.canViewInventoryCost !== false;
  const mode = options.context?.mode || 'INVENTORY';
  const configuredPriceLists = (options.priceLists || []).filter((list) => list.code && list.name);
  // La importación solo maneja las tres listas comerciales principales. Las
  // listas adicionales se administran manualmente desde Listas de precios.
  const priceLists = resolveStandardProductPriceLists(
    configuredPriceLists.length > 0 ? configuredPriceLists : FALLBACK_PRICE_LISTS,
  );

  const productHeaders = mode === 'PURCHASE_ORDER'
    ? [
      'Código/Sku', 'Nombre', 'Descripción', 'Nota comercial', 'Categoría', 'Unidad', 'Marca',
      ...priceLists.map((list) => `Precio ${list.name}`),
      'Serie/IMEI',
    ]
    : getCanonicalProductImportHeaders(priceLists, canViewInventoryCost);
  const variantHeaders = mode === 'PURCHASE_ORDER'
    ? ['Código producto', 'SKU variante', 'Nombre variante']
    : [
      'Código producto', 'SKU variante', 'Nombre variante',
      ...(canViewInventoryCost ? ['Costo variante'] : []),
    ];
  const managerLocations = (options.locations || []).filter((location) => String(location.label || '').trim());
  const purchaseOrderLineHeaders = mode === 'PURCHASE_ORDER'
    ? [
      'Cantidad', `Costo unitario de compra (${currency === 'USD' ? '$' : 'C$'})`,
      'Tipo IVA', `Base IVA (${currency === 'USD' ? '$' : 'C$'})`, 'IVA %',
      `Monto IVA (${currency === 'USD' ? '$' : 'C$'})`, 'Retención',
      `Base ret. (${currency === 'USD' ? '$' : 'C$'})`, 'Ret. %',
      `Monto ret. (${currency === 'USD' ? '$' : 'C$'})`,
    ]
    : [];
  const inventoryHeaders = mode === 'PURCHASE_ORDER'
    ? ['Código producto', 'SKU / variante', ...purchaseOrderLineHeaders]
    : ['Código producto', 'SKU variante', 'Bodega', 'Stock inicial', 'Stock mínimo', 'Stock máximo', 'Costo entrada', 'Moneda costo', 'Tasa costo'];
  const priceHeaders = mode === 'PURCHASE_ORDER'
    ? ['Alcance', 'Código producto', 'SKU variante', ...priceLists.map((list) => `Precio ${list.name}`)]
    : ['Alcance', 'Código producto', 'SKU variante', 'Lista', 'Precio'];

  const simpleProductCategory = 'Computación';
  const variableProductCategory = options.categoryName || 'Telefonía';
  const exampleWarehouse = options.warehouseName || 'Bodega Central';
  const examplePrices = currency === 'USD'
    ? { simple: [100, 95, 90], variable: [1100, 1040, 1000] }
    : { simple: [19999, 19099, 18499], variable: [21999, 20799, 19999] };
  const exampleSimpleCode = 'LOG-MXKEYS';
  const exampleVariableCode = 'APL-IP15';
  const secondVariableCode = 'SAM-S24';
  const exampleVariants = [
    ['APL-IP15-128-BLU', '128 GB / Azul', '128 GB', 'Azul'],
    ['APL-IP15-256-NEG', '256 GB / Negro', '256 GB', 'Negro'],
    ['APL-IP15-512-VER', '512 GB / Verde', '512 GB', 'Verde'],
  ];
  const secondVariableVariants = [
    ['SAM-S24-128-GRY', '128 GB / Gris', '128 GB', 'Gris'],
    ['SAM-S24-256-BLK', '256 GB / Negro', '256 GB', 'Negro'],
  ];
  const secondVariablePrices = currency === 'USD'
    ? [500, 475, 450]
    : [9999, 9499, 8999];
  const exampleProductRows = mode === 'PURCHASE_ORDER'
    ? [
      [exampleSimpleCode, 'Logitech MX Keys', 'Teclado inalámbrico Logitech MX Keys.', 'Garantía 12 meses', simpleProductCategory, 'unidad', 'Logitech', ...examplePrices.simple, 'NO'],
      [exampleVariableCode, 'Apple iPhone 15', 'Teléfono inteligente Apple iPhone 15 desbloqueado.', 'Equipo desbloqueado · Garantía 12 meses', variableProductCategory, 'unidad', 'Apple', ...examplePrices.variable, 'NO'],
      [secondVariableCode, 'Samsung Galaxy S24', 'Teléfono inteligente Samsung Galaxy S24.', 'Equipo desbloqueado · Garantía 12 meses', variableProductCategory, 'unidad', 'Samsung', ...secondVariablePrices, 'NO'],
    ]
    : [
      [exampleSimpleCode, 'Logitech MX Keys', 'Teclado inalámbrico Logitech MX Keys.', 'Garantía 12 meses', simpleProductCategory, 'unidad', 'Logitech', 'NO', currency, ...examplePrices.simple, ...(canViewInventoryCost ? [currency === 'USD' ? 75 : 15000] : []), 'NO'],
      [exampleVariableCode, 'Apple iPhone 15', 'Teléfono inteligente Apple iPhone 15 desbloqueado.', 'Equipo desbloqueado · Garantía 12 meses', variableProductCategory, 'unidad', 'Apple', 'SI', currency, ...examplePrices.variable, ...(canViewInventoryCost ? [currency === 'USD' ? 880 : 17600] : []), 'NO'],
      [secondVariableCode, 'Samsung Galaxy S24', 'Teléfono inteligente Samsung Galaxy S24.', 'Equipo desbloqueado · Garantía 12 meses', variableProductCategory, 'unidad', 'Samsung', 'SI', currency, ...secondVariablePrices, ...(canViewInventoryCost ? [currency === 'USD' ? 390 : 7800] : []), 'NO'],
    ];
  const allVariableExamples = [...exampleVariants, ...secondVariableVariants];
  const exampleVariantRows = mode === 'PURCHASE_ORDER'
    ? [
      ...exampleVariants.map(([sku, name]) => [exampleVariableCode, sku, name]),
      ...secondVariableVariants.map(([sku, name]) => [secondVariableCode, sku, name]),
    ]
    : [
      ...exampleVariants.map(([sku, name]) => [exampleVariableCode, sku, name, ...(canViewInventoryCost ? [''] : [])]),
      ...secondVariableVariants.map(([sku, name]) => [secondVariableCode, sku, name, ...(canViewInventoryCost ? [''] : [])]),
    ];
  const exampleAttributeRows = allVariableExamples.flatMap(([sku, , storage, color]) => [
    [sku, 'Almacenamiento', storage],
    [sku, 'Color', color],
  ]);
  const exampleInventoryRows = mode === 'PURCHASE_ORDER'
    ? [
      [exampleSimpleCode, exampleSimpleCode, 10, currency === 'USD' ? 75 : 15000, 'GRAVADO', '', 15, '', '0', '', '', ''],
      ...exampleVariants.map(([sku], index) => [exampleVariableCode, sku, 2 + index, currency === 'USD' ? 880 : 17600, 'GRAVADO', '', 15, '', '0', '', '', '']),
      ...secondVariableVariants.map(([sku], index) => [secondVariableCode, sku, 2 + index, currency === 'USD' ? 390 : 7800, 'GRAVADO', '', 15, '', '0', '', '', '']),
    ]
    : [
      [exampleSimpleCode, exampleSimpleCode, exampleWarehouse, 10, 2, '', currency === 'USD' ? 75 : 15000, currency, currency === 'USD' ? exchangeRate : 1],
      ...exampleVariants.map(([sku], index) => [exampleVariableCode, sku, exampleWarehouse, 2 + index, 1, '', currency === 'USD' ? 880 : 17600, currency, currency === 'USD' ? exchangeRate : 1]),
      ...secondVariableVariants.map(([sku], index) => [secondVariableCode, sku, exampleWarehouse, 2 + index, 1, '', currency === 'USD' ? 390 : 7800, currency, currency === 'USD' ? exchangeRate : 1]),
    ];
  const exampleVariantOverridePrices = currency === 'USD'
    ? [1250, 1187.5, 1150]
    : [31999, 30499, 29499];
  const examplePriceRows = mode === 'PURCHASE_ORDER'
    ? [['VARIANTE', exampleVariableCode, exampleVariants[1][0], ...exampleVariantOverridePrices]]
    : priceLists.map((list, index) => [
      'VARIANTE',
      exampleVariableCode,
      exampleVariants[1][0],
      list.name,
      exampleVariantOverridePrices[index],
    ]);

  const workbook = XLSX.utils.book_new();
  appendSheet(workbook, 'Productos', [productHeaders, ...exampleProductRows]);
  appendSheet(workbook, 'Variantes', [variantHeaders, ...exampleVariantRows]);
  appendSheet(workbook, 'Atributos', [['SKU variante', 'Atributo', 'Valor'], ...exampleAttributeRows]);
  // La orden de compra también debe llevar la configuración de venta. Se
  // materializa al recepcionar, no al importar la orden.
  appendSheet(workbook, 'Precios', [priceHeaders, ...examplePriceRows]);
  appendSheet(
    workbook,
    'Inventario',
    [inventoryHeaders, ...exampleInventoryRows],
    mode === 'PURCHASE_ORDER'
      ? (sheet) => configurePurchaseOrderInventorySheet(sheet, inventoryHeaders)
      : undefined,
  );

  if (mode === 'PURCHASE_ORDER') {
    workbook.Workbook = workbook.Workbook || {};
    (workbook.Workbook as any).CalcPr = {
      calcMode: 'auto',
      fullCalcOnLoad: true,
      forceFullCalc: true,
    };
  }

  if (mode === 'MANAGER') {
    appendSheet(workbook, 'Ubicaciones activas', [
      ['Tipo', 'Sucursal', 'Ubicación destino', 'Dirección', 'Regla'],
      ...managerLocations.map((location) => [
        location.type === 'ALMACEN' ? 'Almacén corporativo' : 'Bodega de sucursal',
        location.type === 'ALMACEN' ? '—' : location.branchName || '—',
        location.label,
        location.address || '',
        'Copia exactamente este texto en la columna Bodega de la hoja Inventario',
      ]),
    ]);
  }

  const guideRows = [
    [mode === 'PURCHASE_ORDER' ? 'GUÍA · PLANTILLA CANÓNICA PARA ORDEN DE COMPRA' : 'GUÍA · PLANTILLA CANÓNICA DE PRODUCTOS CON VARIANTES'],
    ['Datos incluidos', 'Las cinco hojas incluyen datos relacionados: Logitech MX Keys como producto simple, Apple iPhone 15 con tres variantes y Samsung Galaxy S24 con dos variantes. También incluyen sus atributos, precios, costos, cantidades e inventario. Retira o reemplaza estos registros antes de importar tus datos reales.'],
    ['Cómo funciona cada producto', 'Logitech MX Keys no tiene filas en Variantes ni Atributos: usa su propio SKU en Inventario y los tres precios de Productos directamente en Caja. Apple iPhone 15 tiene tres variantes: APL-IP15-256-NEG sobrescribe sus precios en Precios y las otras dos heredan los del padre. Samsung Galaxy S24 tiene dos variantes y no tiene filas en Precios, por lo que ambas heredan automáticamente Minorista, Mayorista y Distribuidor desde Productos.'],
    ['Qué hacer en cada hoja', 'Productos: registra una fila por producto padre y, para un producto simple, también sus tres precios de venta. Variantes: registra una fila por cada presentación vendible de Apple iPhone 15 y Samsung Galaxy S24; Logitech MX Keys no necesita filas aquí. Atributos: registra los atributos de cada SKU variante, como almacenamiento y color. Precios: registra únicamente los precios propios de una variante; si no hay fila para una variante, heredará los precios del padre registrados en Productos. Inventario: registra la cantidad y el costo de cada producto o variante; en una orden de compra también contiene los impuestos y retenciones. Al recepcionar, el sistema crea o actualiza el catálogo, suma existencias y deja los precios disponibles en Caja.'],
    [mode === 'PURCHASE_ORDER' ? 'Contrato de orden' : 'Contrato NOVAHUB_VARIANTS_V1', mode === 'PURCHASE_ORDER'
      ? 'Las hojas Productos, Variantes, Atributos, Precios e Inventario se relacionan por código de producto y SKU de variante. Los precios quedan pendientes hasta recepcionar.'
      : 'Las hojas Productos, Variantes, Atributos, Precios e Inventario se leen como una sola carga relacionada por código de producto y SKU de variante.'],
    ['Productos', mode === 'PURCHASE_ORDER'
      ? `Una fila por producto padre. Código/Sku, nombre, descripción, nota comercial, categoría, unidad y marca identifican el producto que se creará al recepcionar. Las columnas ${priceLists.map((list) => `Precio ${list.name}`).join(', ')} son el precio de venta del producto padre registrado en esta hoja Productos. Si el producto no tiene variantes, Caja utilizará directamente estos precios y no es necesario repetirlos en la hoja Precios. Si tiene variantes, cada variante que no tenga un precio propio en Precios heredará automáticamente el precio del padre. Serie/IMEI activa el control de series cuando corresponda.`
      : 'Una fila por producto padre. Usa los mismos datos de la creación: código/Sku, nombre, descripción, nota comercial, categoría, unidad, marca, indicador de variable, moneda, tres precios de venta, costo y serie/IMEI.'],
    ['Variantes', mode === 'PURCHASE_ORDER'
      ? 'Una fila por presentación vendible. El SKU variante debe ser único y sus atributos se relacionan desde la hoja Atributos. El precio de compra se informa en Inventario, no aquí.'
      : 'Una fila por presentación vendible. El SKU variante debe ser único; el costo variante vacío hereda el costo del padre y un costo informado es propio de esa variante.'],
    ['Atributos', mode === 'PURCHASE_ORDER'
      ? 'Una fila por SKU variante + atributo + valor. Los atributos faltantes quedan pendientes y se crean al recepcionar la compra.'
      : 'Una fila por SKU variante + atributo + valor. Los atributos y valores faltantes pueden crearse o reutilizarse al confirmar la importación.'],
    ['Precios', mode === 'PURCHASE_ORDER'
      ? `Una fila por variante. Usa Alcance VARIANTE, Código producto y SKU variante. Escribe cada lista en su propia columna: ${priceLists.map((list) => `Precio ${list.name}`).join(', ')}. El ejemplo sobrescribe los precios de la variante APL-IP15-256-NEG; las otras variantes no tienen fila propia y heredarán los precios del padre. El precio del producto padre se registra únicamente en las columnas de precios de la hoja Productos; si una lista queda vacía aquí, la variante heredará el precio del padre. Estos precios se crearán al recepcionar para que Caja pueda vender por cada tipo.`
      : 'PRODUCTO define el precio base heredable. VARIANTE sobrescribe una lista únicamente para el SKU indicado.'],
    ['Inventario', mode === 'PURCHASE_ORDER'
      ? 'Una fila por producto/variante de la orden. Código producto y SKU / variante relacionan la línea; Cantidad y Costo unitario de compra son los valores de la línea. Tipo IVA, Base IVA, IVA %, Monto IVA, Retención, Base ret., Ret. % y Monto ret. alimentan la previsualización. No se distribuye por bodegas: la única bodega destino es la seleccionada en la orden.'
      : mode === 'MANAGER'
        ? 'Una fila por SKU variante y ubicación destino. La ubicación debe existir, estar activa y pertenecer al alcance permitido. El producto padre no recibe stock propio cuando tiene variantes.'
        : 'Una fila por SKU variante + bodega. La bodega debe existir, estar activa y pertenecer al alcance permitido. El producto padre no recibe stock propio cuando tiene variantes.'],
    ...(mode === 'PURCHASE_ORDER'
      ? [['Bodega en la orden', 'No agregues una columna Bodega ni valores de bodega en este archivo. Si el archivo intenta distribuir por bodega, se rechazará; se respetará únicamente la bodega destino del formulario de la orden.']]
      : [['Bodegas inválidas', 'La fila se rechaza hasta seleccionar una bodega activa existente en la previsualización. La importación no crea bodegas automáticamente.']]),
    ...(mode === 'PURCHASE_ORDER' ? [] : [['Reimportación', 'MERGE conserva IDs, movimientos y existencias existentes; actualiza datos maestros y agrega variantes nuevas sin duplicar productos o SKUs.']]),
    ['Valores numéricos', `Usa números sin símbolo de moneda. La moneda del archivo es ${currency}; la tasa aplicada es ${exchangeRate}.`],
    [mode === 'PURCHASE_ORDER' ? 'Moneda de la orden' : 'Variable y moneda', mode === 'PURCHASE_ORDER'
      ? 'La moneda y la tasa de cambio se toman del formulario de la orden y del selector de moneda del archivo. No se repiten por producto, variante ni línea.'
      : 'Variable indica si el producto tendrá filas en Variantes. La moneda se aplica a toda la importación y debe coincidir con la moneda seleccionada en la pantalla de carga.'],
    ['Categorías', mode === 'PURCHASE_ORDER'
      ? 'Escribe el nombre de la categoría. Si no existe, queda pendiente y se crea como categoría de productos al recepcionar; no se duplica si ya existe.'
      : 'Escribe el nombre de la categoría. Si no existe, se crea automáticamente como categoría de productos al confirmar; no se duplica si ya existe.'],
  ];
  if (managerLocations.length) {
    guideRows.push([
      'Ubicaciones activas',
      managerLocations.map((location) => `${location.type === 'ALMACEN' ? 'Almacén corporativo' : 'Bodega'}: ${location.label}${location.branchName ? ` (${location.branchName})` : ''}`).join(' · '),
    ]);
  }
  if (mode === 'MANAGER') {
    guideRows.push(
      ['Manager · alcance', `Rubro: ${options.context?.managerBusinessUnitName || 'el rubro seleccionado'}. La importación usa únicamente las ubicaciones activas que aparecen en Ubicaciones activas.`],
      ['Manager · distribución', 'Repite cada SKU variante en Inventario para cada bodega de sucursal y/o almacén corporativo donde deba existir. La bodega incluye el nombre de su sucursal; el almacén corporativo mantiene stock independiente y no se duplica por sucursal.'],
      ['Manager · espejo', 'El primer registro crea o actualiza el producto padre del rubro y cada sucursal adicional recibe un espejo vinculado, conservando variantes, costos, precios, atributos y nota comercial.'],
      ['Manager · ubicaciones inválidas', 'Una ubicación inexistente, inactiva o fuera del alcance se rechaza en la previsualización. Puedes sustituirla por otra opción activa; el sistema nunca crea bodegas desde el Excel.'],
    );
  }
  if (mode === 'PURCHASE_ORDER') {
    guideRows.push(
      ['Orden actual', `Proveedor: ${options.context?.supplierName || 'el proveedor seleccionado'} · Bodega destino: ${options.context?.purchaseWarehouseName || 'la bodega de la orden'} · Tipo: ${options.context?.purchaseType || 'INVENTARIO'}.`],
      ['Cantidad, costo e impuestos', 'En una Orden de compra, Cantidad y Costo unitario de compra son los valores de la línea. En la hoja Inventario, Base IVA se calcula automáticamente como Cantidad × Costo unitario de compra y Monto IVA se calcula como Base IVA × IVA %. La previsualización vuelve a calcularlos y valida el resultado. Retención, Base ret., Ret. % y Monto ret. siguen siendo compatibles. Usa 0 en Retención cuando no aplique. Los archivos antiguos con Stock inicial, Costo entrada o Precio unitario siguen siendo compatibles.'],
      ['Tipos de precio para Caja', `Para el producto padre, completa únicamente las columnas Precio ${priceLists.map((list) => list.name).join(', Precio ')} de la hoja Productos. Un producto sin variantes usará esos precios directamente. En productos con variantes, una variante sin precio propio en Precios heredará el del padre; para sobrescribirlo, usa la hoja Precios con Alcance VARIANTE + Código producto + SKU variante. Se conservarán en ${currency} con su tasa ${exchangeRate}.`],
      ['Catálogo nuevo', 'Los productos padre, variantes y atributos faltantes quedan pendientes en la orden. No se crean en Inventario al importar ni al guardar la orden; se materializan únicamente cuando la recepción ingresa la cantidad.'],
    );
  }
  const guide = XLSX.utils.aoa_to_sheet(guideRows);
  guide['!cols'] = [{ wch: 30 }, { wch: 125 }];
  XLSX.utils.book_append_sheet(workbook, guide, 'Guía de llenado');

  if (mode === 'PURCHASE_ORDER') {
    appendSheet(workbook, 'Contexto de la orden', [
      ['Campo', 'Valor'],
      ['Orden', options.context?.orderNumber || 'La orden abierta'],
      ['Proveedor', options.context?.supplierName || 'El proveedor seleccionado'],
      ['Bodega destino', options.context?.purchaseWarehouseName || 'La bodega de la orden'],
      ['Tipo de compra', options.context?.purchaseType || 'INVENTARIO'],
      ['Regla', 'La bodega destino se toma del formulario de la orden y no se cambia desde el archivo.'],
    ]);
  }

  return workbook;
};

export const downloadCanonicalVariantImportTemplate = (options: CanonicalVariantImportTemplateOptions = {}) => {
  const workbook = createCanonicalVariantImportWorkbook(options);
  XLSX.writeFile(workbook, options.fileName || 'plantilla_importacion_productos_variantes.xlsx');
};
