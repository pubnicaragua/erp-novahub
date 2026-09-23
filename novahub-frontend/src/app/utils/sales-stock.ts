export type SalesStockLevel = {
  warehouseId?: string | null;
  warehouseName?: string | null;
  variantId?: string | null;
  available?: number | string | null;
  currentStock?: number | string | null;
  quantity?: number | string | null;
  stock?: number | string | null;
  reserved?: number | string | null;
  warehouse?: { id?: string | null; name?: string | null } | null;
};

export type SalesWarehouseCatalogEntry = {
  id: string;
  name: string;
  isActive?: boolean;
};

export type SalesStockProduct = {
  id?: string;
  itemType?: string | null;
  type?: string | null;
  trackInventory?: boolean | null;
  currentStock?: number | string | null;
  warehouseStock?: SalesStockLevel[];
  stockLevels?: SalesStockLevel[];
  warehouseCatalog?: SalesWarehouseCatalogEntry[];
  variants?: Array<{
    id: string;
    sku?: string | null;
    name?: string | null;
    attributes?: unknown;
    isActive?: boolean;
    currentStock?: number | string | null;
  }>;
};

const numberOrNull = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isService = (product: SalesStockProduct) =>
  String(product.itemType || product.type || '').trim().toUpperCase() === 'SERVICE';

export function tracksSalesInventory(product?: SalesStockProduct | null) {
  return Boolean(product && !isService(product) && product.trackInventory !== false);
}

/** A single active variant can be selected implicitly when adding a line. */
export function getSingleSalesVariant<T extends NonNullable<SalesStockProduct['variants']>[number]>(product?: SalesStockProduct | null): T | null {
  const activeVariants = (product?.variants || []).filter((variant) => variant.isActive !== false);
  return activeVariants.length === 1 ? activeVariants[0] as T : null;
}

export function getSalesStockLevels(product?: SalesStockProduct | null): SalesStockLevel[] | null {
  if (!product) return null;
  if (Array.isArray(product.warehouseStock) && product.warehouseStock.length > 0) return product.warehouseStock;
  if (Array.isArray(product.stockLevels)) return product.stockLevels;
  if (Array.isArray(product.warehouseStock)) return product.warehouseStock;
  return null;
}

function availableFromLevel(level: SalesStockLevel): number | null {
  const explicitAvailable = numberOrNull(level.available);
  if (explicitAvailable !== null) return Math.max(0, explicitAvailable);

  const currentStock = numberOrNull(level.currentStock);
  if (currentStock !== null) return Math.max(0, currentStock - (numberOrNull(level.reserved) ?? 0));

  const quantity = numberOrNull(level.quantity ?? level.stock);
  if (quantity === null) return null;
  return Math.max(0, quantity - (numberOrNull(level.reserved) ?? 0));
}

/** Returns null when the warehouse or a trustworthy stock value is unavailable. */
export function getAvailableSalesStock(
  product?: SalesStockProduct | null,
  warehouseId?: string | null,
  variantId?: string | null,
): number | null {
  if (!product || !tracksSalesInventory(product)) return null;
  const selectedWarehouseId = String(warehouseId || '').trim();
  if (!selectedWarehouseId) return null;
  if (Array.isArray(product.warehouseCatalog)
    && !product.warehouseCatalog.some((warehouse) => String(warehouse.id) === selectedWarehouseId)) {
    return null;
  }

  const levels = getSalesStockLevels(product);
  if (levels !== null) {
    const selectedVariantId = String(variantId || '').trim();
    const matchingLevels = levels.filter((level) => {
      const levelWarehouseId = String(level.warehouseId || level.warehouse?.id || '').trim();
      if (levelWarehouseId !== selectedWarehouseId) return false;
      return !selectedVariantId || String(level.variantId || '').trim() === selectedVariantId;
    });
    if (matchingLevels.length === 0) return 0;

    const available = matchingLevels.map(availableFromLevel);
    if (available.some((quantity) => quantity === null)) return null;
    return available.reduce<number>((total, quantity) => total + (quantity ?? 0), 0);
  }

  // POS returns currentStock for its selected warehouse; unlike Product.stock,
  // this value is already warehouse-scoped and net of reservations.
  const selectedVariantId = String(variantId || '').trim();
  if (selectedVariantId) {
    const variant = product.variants?.find((candidate) => candidate.id === selectedVariantId);
    if (variant && Object.prototype.hasOwnProperty.call(variant, 'currentStock')) {
      // POS incluye cada variante aunque no tenga una fila de inventario. En
      // ese catálogo, currentStock: null significa cero en la bodega elegida;
      // no se debe heredar el total del producto ni stock de otra variante.
      const variantStock = numberOrNull(variant.currentStock);
      return Math.max(0, variantStock ?? 0);
    }
    const variantStock = numberOrNull(variant?.currentStock);
    if (variantStock !== null) return Math.max(0, variantStock);
  }
  const currentStock = numberOrNull(product.currentStock);
  return currentStock === null ? null : Math.max(0, currentStock);
}

/** Disponibilidad en bodegas activas, incluyendo 0 si no existe fila de stock. */
export function getSalesWarehouseStockBreakdown(
  product?: SalesStockProduct | null,
  variantId?: string | null,
): Array<SalesWarehouseCatalogEntry & { available: number | null }> {
  if (!product || !tracksSalesInventory(product)) return [];
  const warehouses = new Map<string, SalesWarehouseCatalogEntry>();
  (product.warehouseCatalog || []).forEach((warehouse) => {
    if (warehouse?.id) warehouses.set(String(warehouse.id), { ...warehouse, id: String(warehouse.id) });
  });
  (getSalesStockLevels(product) || []).forEach((level) => {
    const id = String(level.warehouseId || level.warehouse?.id || '').trim();
    if (!id) return;
    const current = warehouses.get(id);
    warehouses.set(id, {
      id,
      name: String(level.warehouseName || level.warehouse?.name || current?.name || 'Bodega'),
      isActive: current?.isActive,
    });
  });
  return [...warehouses.values()]
    .filter((warehouse) => warehouse.isActive !== false)
    .map((warehouse) => ({
      ...warehouse,
      available: getAvailableSalesStock(product, warehouse.id, variantId),
    }))
    .sort((left, right) => {
      const availabilityOrder = (right.available ?? -1) - (left.available ?? -1);
      return availabilityOrder || left.name.localeCompare(right.name, 'es');
    });
}

export function formatSalesStock(value: number) {
  return new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 }).format(value);
}

export function getSalesStockOptionLabel(
  product?: SalesStockProduct | null,
  warehouseId?: string | null,
  variantId?: string | null,
): string | null {
  if (!product || isService(product)) return null;
  if (product.trackInventory === false) return 'No controla inventario';
  if (!String(warehouseId || '').trim()) return 'Selecciona bodega para consultar existencias';

  const available = getAvailableSalesStock(product, warehouseId, variantId);
  if (available === null) return 'Existencia no disponible';
  return `${available <= 0 ? 'Sin existencias · ' : ''}Disponible: ${formatSalesStock(available)}`;
}

export function getSalesProductOptionDescription(
  product: SalesStockProduct,
  warehouseId?: string | null,
  baseDescription?: string | null,
  variantId?: string | null,
) {
  return [
    getSalesStockOptionLabel(product, warehouseId, variantId),
    String(baseDescription || '').trim() || null,
  ].filter(Boolean).join(' · ') || undefined;
}
