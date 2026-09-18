type InventoryWarehouseIds = ReadonlySet<string>;

const numericValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const productHasVariants = (product: any) => {
  if (product?.isVariable === true) return true;
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (variants.length > 1) return true;
  return variants.some((variant: any) => (
    (Array.isArray(variant?.attributes) && variant.attributes.length > 0)
    || String(variant?.sku || '').trim().toLowerCase() !== String(product?.code || '').trim().toLowerCase()
    || String(variant?.name || '').trim().toLowerCase() !== 'estándar'
  ));
};

/**
 * Valora el inventario respetando el costo propio de cada variante. Cuando
 * hay variantes, el costo mostrado para el padre es el promedio ponderado.
 */
export const resolveInventoryValuation = (
  product: any,
  warehouseIds?: InventoryWarehouseIds,
) => {
  const baseCost = Math.max(0, numericValue(product?.costPrice ?? product?.cost ?? product?.details?.costPrice));
  const allLevels = Array.isArray(product?.stockLevels) ? product.stockLevels : [];
  const hasLevelSnapshot = allLevels.length > 0;
  const hasWarehouseFilter = Boolean(warehouseIds && warehouseIds.size > 0);
  const levels = hasWarehouseFilter
    ? allLevels.filter((level: any) => warehouseIds?.has(String(level?.warehouseId || level?.warehouse?.id || '')))
    : allLevels;
  const variants = productHasVariants(product)
    ? (Array.isArray(product?.variants) ? product.variants : [])
    : [];

  if (variants.length === 0) {
    const stock = hasLevelSnapshot
      ? levels.reduce((total: number, level: any) => total + numericValue(level?.quantity), 0)
      : numericValue(product?.stock);
    return { stock, costPrice: baseCost, stockValue: stock * baseCost };
  }

  let stock = 0;
  let stockValue = 0;
  let fallbackCostTotal = 0;

  variants.forEach((variant: any) => {
    const ownCost = variant?.costPrice !== null && variant?.costPrice !== undefined;
    const cost = Math.max(0, ownCost
      ? numericValue(variant.costPrice, baseCost)
      : baseCost + numericValue(variant?.costModifier));
    fallbackCostTotal += cost;

    const variantLevels = levels.filter((level: any) => String(level?.variantId || '') === String(variant?.id || ''));
    const quantity = hasLevelSnapshot
      ? variantLevels.reduce((total: number, level: any) => total + numericValue(level?.quantity), 0)
      : numericValue(variant?.currentStock ?? variant?.stock);
    stock += quantity;
    stockValue += quantity * cost;
  });

  const averageVariantCost = variants.length > 0 ? fallbackCostTotal / variants.length : baseCost;
  return {
    stock,
    costPrice: stock > 0 ? stockValue / stock : (averageVariantCost || baseCost),
    stockValue,
  };
};
