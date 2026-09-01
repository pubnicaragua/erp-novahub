export type VariantImportAttribute = {
  attributeName: string;
  value: string;
};

export type VariantImportProduct = {
  code: string;
  name: string;
  category: string;
  description?: string;
  commercialNote?: string;
  unit?: string;
  costPrice?: number;
  taxRate?: number;
  trackInventory?: boolean;
  trackBatch?: boolean;
  trackSeries?: boolean;
  barcode?: string;
  brand?: string;
  model?: string;
  color?: string;
  weight?: number;
  weightUnit?: string;
  dimensions?: string;
  width?: number;
  height?: number;
  depth?: number;
  dimensionUnit?: string;
  warranty?: string;
  lastPurchasePrice?: number;
  imageUrl?: string;
  isActive?: boolean;
};

export type VariantImportVariant = {
  productCode: string;
  sku: string;
  name?: string;
  barcode?: string;
  costPrice?: number;
  attributes: VariantImportAttribute[];
};

export type VariantImportPrice = {
  scope: 'PRODUCT' | 'VARIANT';
  productCode: string;
  variantSku?: string;
  priceListCode: string;
  price: number;
};

export type VariantImportStock = {
  productCode?: string;
  variantSku: string;
  warehouse: string;
  quantity: number;
  minStock?: number;
  maxStock?: number;
  unitCost?: number;
  currency?: string;
  exchangeRate?: number;
};

export type VariantImportAttributeRow = {
  name: string;
  value: string;
};

export type VariantImportCatalog = {
  format: 'NOVAHUB_VARIANTS_V1';
  products: VariantImportProduct[];
  variants: VariantImportVariant[];
  attributes: VariantImportAttributeRow[];
  prices: VariantImportPrice[];
  stock: VariantImportStock[];
};

const normalize = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase();

const sheetKey = (value: unknown) => normalize(value).replace(/ /g, '');

const aliases: Record<string, string[]> = {
  productCode: ['codigo producto', 'codigo padre', 'sku producto', 'codigo sku', 'codigo', 'sku'],
  name: ['nombre', 'nombre producto', 'producto'],
  category: ['categoria', 'category'],
  description: ['descripcion'],
  commercialNote: ['nota comercial', 'nota'],
  unit: ['unidad', 'unidad medida'],
  costPrice: ['costo base', 'costo producto', 'costo variante', 'costo', 'precio costo', 'cost price', 'variant cost'],
  taxRate: ['tasa iva', 'iva', 'tax rate'],
  trackInventory: ['control inventario', 'control de inventario', 'track inventory'],
  barcode: ['codigo barras', 'codigo de barras', 'barcode'],
  brand: ['marca', 'brand'],
  model: ['modelo', 'model'],
  color: ['color'],
  weight: ['peso', 'weight'],
  weightUnit: ['unidad peso', 'weight unit'],
  dimensions: ['dimensiones', 'dimensions'],
  width: ['ancho', 'width'],
  height: ['alto', 'height'],
  depth: ['profundidad', 'depth'],
  dimensionUnit: ['unidad dimension', 'unidad dimensiones', 'dimension unit'],
  warranty: ['garantia', 'warranty'],
  trackBatch: ['lotes', 'control lotes', 'control de lotes', 'track batch'],
  trackSeries: ['series', 'control series', 'control de series', 'track series'],
  lastPurchasePrice: ['ultimo costo', 'ultimo precio costo', 'last purchase price'],
  imageUrl: ['imagen url', 'imagen', 'image url'],
  isActive: ['activo', 'disponible', 'estado', 'active', 'is active'],
  variantSku: ['sku variante', 'codigo variante', 'variant sku'],
  variantName: ['nombre variante', 'variante', 'variant name'],
  scope: ['alcance', 'scope', 'tipo'],
  priceListCode: ['lista', 'lista precios', 'codigo lista', 'price list', 'price list code'],
  price: ['precio', 'price'],
  warehouse: ['bodega', 'almacen', 'almacén', 'warehouse'],
  quantity: ['stock inicial', 'cantidad', 'qty', 'quantity'],
  minStock: ['stock minimo', 'stock mínimo', 'min stock'],
  maxStock: ['stock maximo', 'stock máximo', 'max stock'],
  unitCost: ['costo entrada', 'costo ingreso', 'unit cost', 'entry cost'],
  costCurrency: ['moneda costo', 'currency'],
  costExchangeRate: ['tasa costo', 'exchange rate'],
  attributeName: ['atributo', 'nombre atributo', 'attribute'],
  attributeValue: ['valor', 'valor atributo', 'opcion', 'opción', 'value'],
};

const fixedVariantHeaders = new Set([
  ...aliases.productCode,
  ...aliases.variantSku,
  ...aliases.variantName,
  ...aliases.barcode,
  ...aliases.costPrice,
  ...aliases.imageUrl,
]);

const nonEmptyRows = (rows: any[][] = []) => rows
  .filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== ''));

const objectRows = (rows: any[][] = []) => {
  const clean = nonEmptyRows(rows);
  if (clean.length < 2) return [] as Array<Record<string, any>>;
  const headers = clean[0].map((header) => normalize(header));
  return clean.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
};

const findValue = (row: Record<string, any>, key: string) => {
  const candidates = (aliases[key] || [key]).map(normalize);
  const found = Object.entries(row).find(([header]) => candidates.includes(header));
  return found?.[1];
};

const textValue = (row: Record<string, any>, key: string) => String(findValue(row, key) ?? '').trim();

const numberValue = (row: Record<string, any>, key: string) => {
  const value = findValue(row, key);
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const yesValue = (value: unknown, defaultValue = true) => {
  if (value === undefined || value === null || String(value).trim() === '') return defaultValue;
  return !['NO', 'N', '0', 'FALSE', 'INACTIVO', 'NO DISPONIBLE'].includes(String(value).trim().toUpperCase());
};

const getSheet = (sheets: Record<string, any[][]> | undefined, names: string[]) => {
  if (!sheets) return undefined;
  const wanted = new Set(names.map(sheetKey));
  const found = Object.entries(sheets).find(([name]) => wanted.has(sheetKey(name)));
  return found?.[1];
};

const mapByKey = (rows: any[][], key: string) => {
  const result = new Map<string, Record<string, any>[]>();
  for (const row of objectRows(rows)) {
    const value = textValue(row, key).toLowerCase();
    if (!value) continue;
    const current = result.get(value) || [];
    current.push(row);
    result.set(value, current);
  }
  return result;
};

export function parseVariantImportWorkbook(sheets: Record<string, any[][]>): VariantImportCatalog {
  const productRows = objectRows(getSheet(sheets, ['Productos', 'Products']) || []);
  if (!productRows.length) throw new Error('La plantilla avanzada necesita una hoja Productos con al menos una fila.');

  const rawVariantRows = getSheet(sheets, ['Variantes', 'Variants']) || [];
  const rawAttributeRows = getSheet(sheets, ['Atributos', 'Attributes']) || [];
  const rawPriceRows = getSheet(sheets, ['Precios', 'Prices']) || [];
  const rawStockRows = getSheet(sheets, ['Inventario', 'Stock']) || [];
  const attributesBySku = mapByKey(rawAttributeRows, 'variantSku');

  const products: VariantImportProduct[] = productRows.map((row) => ({
    code: textValue(row, 'productCode'),
    name: textValue(row, 'name'),
    category: textValue(row, 'category'),
    description: textValue(row, 'description') || undefined,
    commercialNote: textValue(row, 'commercialNote') || undefined,
    unit: textValue(row, 'unit') || undefined,
    costPrice: numberValue(row, 'costPrice'),
    taxRate: numberValue(row, 'taxRate'),
    trackInventory: yesValue(findValue(row, 'trackInventory'), true),
    trackBatch: yesValue(findValue(row, 'trackBatch'), false),
    trackSeries: yesValue(findValue(row, 'trackSeries'), false),
    barcode: textValue(row, 'barcode') || undefined,
    brand: textValue(row, 'brand') || undefined,
    model: textValue(row, 'model') || undefined,
    color: textValue(row, 'color') || undefined,
    weight: numberValue(row, 'weight'),
    weightUnit: textValue(row, 'weightUnit') || undefined,
    dimensions: textValue(row, 'dimensions') || undefined,
    width: numberValue(row, 'width'),
    height: numberValue(row, 'height'),
    depth: numberValue(row, 'depth'),
    dimensionUnit: textValue(row, 'dimensionUnit') || undefined,
    warranty: textValue(row, 'warranty') || undefined,
    lastPurchasePrice: numberValue(row, 'lastPurchasePrice'),
    imageUrl: textValue(row, 'imageUrl') || undefined,
    isActive: yesValue(findValue(row, 'isActive'), true),
  }));

  const variants: VariantImportVariant[] = objectRows(rawVariantRows).map((row) => {
    const productCode = textValue(row, 'productCode');
    const sku = textValue(row, 'variantSku');
    const attributes: VariantImportAttribute[] = [];
    for (const attributeRow of attributesBySku.get(sku.toLowerCase()) || []) {
      const attributeName = textValue(attributeRow, 'attributeName');
      const value = textValue(attributeRow, 'attributeValue');
      if (attributeName && value) attributes.push({ attributeName, value });
    }

    // Cualquier columna adicional de la hoja Variantes se trata como un eje
    // dinámico. Así la plantilla no queda atada a COLOR/TALLA/MATERIAL.
    const rowHeaders = Object.keys(row);
    const fixed = new Set(Array.from(fixedVariantHeaders).map(normalize));
    for (const header of rowHeaders) {
      if (fixed.has(header)) continue;
      const value = String(row[header] ?? '').trim();
      if (header && value && !attributes.some((attribute) => normalize(attribute.attributeName) === header)) {
        attributes.push({ attributeName: header, value });
      }
    }

    return {
      productCode,
      sku,
      name: textValue(row, 'variantName') || undefined,
      barcode: textValue(row, 'barcode') || undefined,
      costPrice: numberValue(row, 'costPrice'),
      attributes,
    };
  }).filter((variant) => variant.productCode || variant.sku);

  const attributes: VariantImportAttributeRow[] = [];
  const seenAttributes = new Set<string>();
  for (const variant of variants) {
    for (const attribute of variant.attributes) {
      const key = `${normalize(attribute.attributeName)}|${normalize(attribute.value)}`;
      if (!seenAttributes.has(key)) {
        seenAttributes.add(key);
        attributes.push({ name: attribute.attributeName, value: attribute.value });
      }
    }
  }
  for (const row of objectRows(rawAttributeRows)) {
    const name = textValue(row, 'attributeName');
    const value = textValue(row, 'attributeValue');
    if (!name || !value) continue;
    const key = `${normalize(name)}|${normalize(value)}`;
    if (!seenAttributes.has(key)) {
      seenAttributes.add(key);
      attributes.push({ name, value });
    }
  }

  const prices: VariantImportPrice[] = objectRows(rawPriceRows).map((row) => {
    const variantSku = textValue(row, 'variantSku') || undefined;
    const rawScope = textValue(row, 'scope').toUpperCase();
    const scope: VariantImportPrice['scope'] = rawScope === 'VARIANTE' || rawScope === 'VARIANT' || Boolean(variantSku)
      ? 'VARIANT'
      : 'PRODUCT';
    return {
      scope,
      productCode: textValue(row, 'productCode'),
      variantSku,
      priceListCode: textValue(row, 'priceListCode').toUpperCase(),
      price: numberValue(row, 'price') as number,
    };
  }).filter((price) => price.productCode || price.variantSku || price.priceListCode);

  const stock: VariantImportStock[] = objectRows(rawStockRows).map((row) => ({
    productCode: textValue(row, 'productCode') || undefined,
    variantSku: textValue(row, 'variantSku') || textValue(row, 'productCode'),
    warehouse: textValue(row, 'warehouse'),
    quantity: numberValue(row, 'quantity') as number,
    minStock: numberValue(row, 'minStock'),
    maxStock: numberValue(row, 'maxStock'),
    unitCost: numberValue(row, 'unitCost'),
    currency: textValue(row, 'costCurrency').toUpperCase() || undefined,
    exchangeRate: numberValue(row, 'costExchangeRate'),
  })).filter((row) => row.variantSku || row.productCode || row.warehouse);

  return { format: 'NOVAHUB_VARIANTS_V1', products, variants, attributes, prices, stock };
}

export function buildVariantImportPreviewRows(catalog: VariantImportCatalog) {
  const pricesByProduct = new Map<string, Record<string, number>>();
  for (const price of catalog.prices) {
    if (price.scope !== 'PRODUCT') continue;
    const key = price.productCode.toLowerCase();
    const current = pricesByProduct.get(key) || {};
    current[price.priceListCode] = price.price;
    pricesByProduct.set(key, current);
  }

  const variantsByProduct = new Map<string, VariantImportVariant[]>();
  for (const variant of catalog.variants) {
    const key = variant.productCode.toLowerCase();
    variantsByProduct.set(key, [...(variantsByProduct.get(key) || []), variant]);
  }

  return catalog.products.map((product) => {
    const variants = variantsByProduct.get(product.code.toLowerCase()) || [];
    const stockRows = catalog.stock.filter((row) => {
      const variant = variants.find((candidate) => candidate.sku.toLowerCase() === row.variantSku.toLowerCase());
      return Boolean(variant) || row.variantSku.toLowerCase() === product.code.toLowerCase();
    });
    const prices = pricesByProduct.get(product.code.toLowerCase()) || {};
    return {
      ...product,
      itemType: 'PRODUCT',
      salePrice: Number(prices.RETAIL ?? prices.WHOLESALE ?? prices.DISTRIBUTOR ?? 0),
      prices,
      initialStock: 0,
      minStock: 0,
      warehouse: '',
      _advanced: true,
      _sourceCode: product.code,
      _variantCount: variants.length,
      _variantRows: variants,
      _stockRowCount: stockRows.length,
      _priceOverrideCount: catalog.prices.filter((price) => price.scope === 'VARIANT' && variants.some((variant) => variant.sku.toLowerCase() === String(price.variantSku || '').toLowerCase())).length,
    };
  });
}
