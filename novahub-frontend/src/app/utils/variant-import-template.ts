import * as XLSX from 'xlsx';

export type CanonicalImportPriceList = {
  code: string;
  name: string;
};

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

const appendSheet = (workbook: XLSX.WorkBook, name: string, rows: any[][]) => {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = (rows[0] || []).map((header) => ({
    wch: Math.max(12, Math.min(34, String(header).length + 2)),
  }));
  XLSX.utils.book_append_sheet(workbook, sheet, name);
};

export const createCanonicalVariantImportWorkbook = (
  options: CanonicalVariantImportTemplateOptions = {},
) => {
  const priceLists = (options.priceLists || []).filter((list) => list.code && list.name).length > 0
    ? (options.priceLists || []).filter((list) => list.code && list.name)
    : FALLBACK_PRICE_LISTS;
  const currency = String(options.currency || 'NIO').toUpperCase();
  const exchangeRate = Number(options.exchangeRate || 1) > 0 ? Number(options.exchangeRate) : 1;
  const canViewInventoryCost = options.canViewInventoryCost !== false;
  const mode = options.context?.mode || 'INVENTORY';

  const productHeaders = [
    'Código / SKU', 'Nombre', 'Descripción', 'Nota comercial', 'Categoría', 'Unidad',
    'Código de barras', 'Marca', 'Modelo', 'Imagen URL',
    ...priceLists.map((list) => `Precio ${list.name}`),
    ...(canViewInventoryCost ? ['Costo'] : []),
  ];
  const variantHeaders = [
    'Código producto', 'SKU variante', 'Nombre variante', 'Código de barras',
    ...(canViewInventoryCost ? ['Costo variante'] : []),
  ];
  const managerLocations = (options.locations || []).filter((location) => String(location.label || '').trim());

  const workbook = XLSX.utils.book_new();
  appendSheet(workbook, 'Productos', [productHeaders]);
  appendSheet(workbook, 'Variantes', [variantHeaders]);
  appendSheet(workbook, 'Atributos', [['SKU variante', 'Atributo', 'Valor']]);
  appendSheet(workbook, 'Precios', [['Alcance', 'Código producto', 'SKU variante', 'Lista', 'Precio']]);
  appendSheet(workbook, 'Inventario', [['Código producto', 'SKU variante', 'Bodega', 'Stock inicial', 'Stock mínimo', 'Stock máximo', 'Costo entrada', 'Moneda costo', 'Tasa costo']]);

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
    ['Plantilla vacía', 'Las hojas de carga contienen únicamente encabezados. Registra tus propios productos, variantes, atributos, precios y destinos antes de importar.'],
    ['Contrato NOVAHUB_VARIANTS_V1. Las hojas Productos, Variantes, Atributos, Precios e Inventario se leen como una sola carga relacionada por código de producto y SKU de variante.'],
    ['Productos', 'Una fila por producto padre. Contiene identidad comercial, categoría, unidad, nota, campos descriptivos, precios base por lista y costo base.'],
    ['Variantes', 'Una fila por presentación vendible. El SKU variante debe ser único; el costo variante vacío hereda el costo del padre y un costo informado es propio de esa variante.'],
    ['Atributos', 'Una fila por SKU variante + atributo + valor. Los atributos y valores faltantes pueden crearse o reutilizarse al confirmar la importación.'],
    ['Precios', 'PRODUCTO define el precio base heredable. VARIANTE sobrescribe una lista únicamente para el SKU indicado.'],
    ['Inventario', 'Una fila por SKU variante + bodega. La bodega debe existir, estar activa y pertenecer al alcance permitido. El producto padre no recibe stock propio cuando tiene variantes.'],
    ['Bodegas inválidas', 'La fila se rechaza hasta seleccionar una bodega activa existente en la previsualización. La importación no crea bodegas automáticamente.'],
    ['Reimportación', 'MERGE conserva IDs, movimientos y existencias existentes; actualiza datos maestros y agrega variantes nuevas sin duplicar productos o SKUs.'],
    ['Valores numéricos', `Usa números sin símbolo de moneda. La moneda del archivo es ${currency}; la tasa aplicada es ${exchangeRate}.`],
    ['Categorías', 'Escribe el nombre de la categoría. Si no existe, se crea automáticamente como categoría de productos al confirmar; no se duplica si ya existe.'],
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
      ['Cantidad solicitada', 'En una Orden de compra, Stock inicial se interpreta como cantidad solicitada y no se registra como existencia disponible. La bodega destino efectiva es la seleccionada en la orden; el Excel no cambia esa bodega.'],
      ['Catálogo nuevo', 'Los productos padre y variantes faltantes se registran en el catálogo antes de agregar las líneas a la orden. La existencia se crea posteriormente al recibir la compra.'],
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
