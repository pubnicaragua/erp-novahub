import type { ProductVariant } from '../types/variants';

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

/**
 * Resuelve el precio para un producto/variante en una lista de precios.
 * Prioridad: precio de variante → precio del producto padre → undefined.
 */
export function resolveVariantPrice(
  items: any[],
  priceListId: string,
  productId: string,
  variantId?: string | null,
): { price: number; basePrice: number; currency: string; exchangeRate: number; isVariantPrice: boolean } | undefined {
  if (variantId) {
    const variantItem = items.find(
      (item) =>
        item.priceListId === priceListId &&
        item.productId === productId &&
        item.variantId === variantId
    );
    if (variantItem && Number(variantItem.basePrice) > 0) {
      return {
        price: Number(variantItem.price),
        basePrice: Number(variantItem.basePrice),
        currency: variantItem.currency || 'NIO',
        exchangeRate: Number(variantItem.exchangeRate) || 1,
        isVariantPrice: true,
      };
    }
  }

  const parentItem = items.find(
    (item) =>
      item.priceListId === priceListId &&
      item.productId === productId &&
      (!item.variantId || item.variantId === null)
  );
  if (parentItem && Number(parentItem.basePrice) > 0) {
    return {
      price: Number(parentItem.price),
      basePrice: Number(parentItem.basePrice),
      currency: parentItem.currency || 'NIO',
      exchangeRate: Number(parentItem.exchangeRate) || 1,
      isVariantPrice: false,
    };
  }

  return undefined;
}

/**
 * Resuelve el precio para POS: busca precio de variante, luego del padre.
 * Retorna el precio en la moneda de visualización.
 */
export function getConfiguredPriceForVariant(
  items: any[],
  priceListId: string,
  productId: string,
  variantId?: string | null,
  currency = 'NIO',
  exchangeRate = 1,
): { unitPrice: number; priceMissing: boolean; isVariantPrice: boolean } {
  const resolved = resolveVariantPrice(items, priceListId, productId, variantId);
  if (!resolved) {
    return { unitPrice: 0, priceMissing: true, isVariantPrice: false };
  }
  const unitPrice = getSalesUnitPrice(resolved, currency, exchangeRate) ?? 0;
  return {
    unitPrice,
    priceMissing: unitPrice <= 0,
    isVariantPrice: resolved.isVariantPrice,
  };
}

/** Líneas de venta con producto que todavía no tienen un precio válido para la lista elegida. */
export function getMissingSalesPriceItems(items: any[] = []): any[] {
  return items.filter((item) => {
    if (!item?.productId) return false;
    if (String(item?.itemType || '').toUpperCase() === 'SERVICE') return false;
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

/**
 * Construye la descripción enriquecida de una línea de venta
 * incluyendo atributos de variante si existen.
 */
export function buildLineDescription(
  productName: string,
  variant?: ProductVariant | null,
): string {
  if (!variant?.attributes?.length) return productName;
  const attrs = variant.attributes.map((a) => a.value).join(' / ');
  return `${productName} - ${attrs}`;
}

/**
 * Obtiene el SKU para una línea de venta.
 * Prioridad: SKU de variante → SKU de producto.
 */
export function getLineSku(
  product: { code?: string; sku?: string },
  variant?: ProductVariant | null,
): string {
  return variant?.sku || product?.code || product?.sku || '';
}
