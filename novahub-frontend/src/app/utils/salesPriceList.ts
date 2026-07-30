export interface SalesPriceListMatrix {
  lists: any[];
  products: any[];
  items: any[];
}

/** Normaliza respuestas directas y respuestas envueltas por la API. */
export function unwrapSalesPriceListMatrix(response: any): SalesPriceListMatrix {
  let value = response?.data && !Array.isArray(response.data) ? response.data : response;
  if (value?.data && !Array.isArray(value.data) && !value.lists) value = value.data;
  return {
    lists: Array.isArray(value?.lists) ? value.lists : [],
    products: Array.isArray(value?.products) ? value.products : [],
    items: Array.isArray(value?.items) ? value.items : [],
  };
}

export function sameSalesId(left: unknown, right: unknown): boolean {
  return Boolean(left) && Boolean(right) && String(left) === String(right);
}

/** Formato visual único para importes de Ventas: 44,999.00. */
export function formatSalesAmount(value: unknown): string {
  const amount = Number(value || 0);
  return (Number.isFinite(amount) ? amount : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Devuelve el precio expresado en la moneda del documento. */
export function getSalesUnitPrice(item: any, currency = 'NIO', exchangeRate = 1): number | undefined {
  let basePrice = Number(item?.basePrice);
  if (!(basePrice > 0) && Number(item?.price) > 0) {
    const listCurrency = String(item?.currency || 'NIO').toUpperCase();
    const listExchangeRate = Math.max(Number(item?.exchangeRate) || 1, 0.000001);
    basePrice = listCurrency === 'USD' ? Number(item.price) * listExchangeRate : Number(item.price);
  }
  if (!Number.isFinite(basePrice) || basePrice < 0) return undefined;
  return String(currency).toUpperCase() === 'USD'
    ? basePrice / Math.max(Number(exchangeRate) || 1, 0.000001)
    : basePrice;
}

/** Líneas de venta con producto que todavía no tienen un precio válido para la lista elegida. */
export function getMissingSalesPriceItems(items: any[] = []): any[] {
  return items.filter((item) => {
    if (!item?.productId) return false;
    if (String(item?.itemType || '').toUpperCase() === 'SERVICE') return false;
    // La línea puede conservar priceMissing de un ID histórico aunque la matriz
    // ya haya resuelto un importe válido por código/nombre. En ese caso el
    // backend vuelve a validar la lista y no debemos bloquear falsamente desde
    // el formulario.
    const hasVisiblePrice = Number(item?.unitPrice) > 0;
    return (item?.priceMissing === true && !hasVisiblePrice) || (!item?.priceListId && !hasVisiblePrice);
  });
}

export function getMissingSalesPriceMessage(items: any[] = []): string {
  const missing = getMissingSalesPriceItems(items);
  if (!missing.length) return '';
  const names = missing
    .map((item) => String(item.description || item.productCode || item.productId || 'Producto'))
    .slice(0, 3)
    .join(', ');
  const suffix = missing.length > 3 ? ` y ${missing.length - 3} más` : '';
  return `No hay precio configurado para: ${names}${suffix}. Selecciona una lista con precio antes de continuar.`;
}
