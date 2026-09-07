export type ProductPriceListOption = {
  code: string;
  name: string;
};

export const STANDARD_PRODUCT_PRICE_LISTS: ProductPriceListOption[] = [
  { code: 'RETAIL', name: 'Minorista' },
  { code: 'WHOLESALE', name: 'Mayorista' },
  { code: 'DISTRIBUTOR', name: 'Distribuidor' },
];

const STANDARD_PRICE_LIST_CODES = new Set(STANDARD_PRODUCT_PRICE_LISTS.map((list) => list.code));

export const isStandardProductPriceListCode = (value: unknown) =>
  STANDARD_PRICE_LIST_CODES.has(String(value || '').trim().toUpperCase());

export const resolveStandardProductPriceLists = (
  source: ReadonlyArray<{ code?: unknown; name?: unknown }> = [],
): ProductPriceListOption[] => {
  const configuredNames = new Map(
    source
      .map((list) => [String(list.code || '').trim().toUpperCase(), String(list.name || '').trim()] as const)
      .filter(([code, name]) => isStandardProductPriceListCode(code) && Boolean(name)),
  );

  return STANDARD_PRODUCT_PRICE_LISTS.map((list) => ({
    ...list,
    name: configuredNames.get(list.code) || list.name,
  }));
};
