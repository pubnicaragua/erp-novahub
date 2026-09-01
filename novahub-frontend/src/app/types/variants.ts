export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  attributes?: VariantAttribute[];
  priceModifier: number;
  costModifier: number;
  costPrice?: number | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  product?: {
    id: string;
    code: string;
    name: string;
    salePrice: number;
    costPrice: number;
    taxRate: number;
  };
}

export interface VariantAttribute {
  attributeId: string;
  attributeName: string;
  value: string;
}

export interface VariantWithPrices extends ProductVariant {
  prices?: Array<{
    priceListId: string;
    priceListCode: string;
    priceListName: string;
    price: number;
    currency: string;
    exchangeRate: number;
    basePrice: number;
  }>;
  stock?: Array<{
    warehouseId: string;
    warehouseName: string;
    quantity: number;
    minStock?: number;
    maxStock?: number;
  }>;
}

export interface VariantSelectorOption {
  attribute: string;
  values: string[];
}

export interface VariantCombination {
  sku: string;
  attributes: Record<string, string>;
  variantId: string;
}

type VariantWithAttributes = {
  attributes?: VariantAttribute[];
};

export function buildVariantDescription(variant: ProductVariant): string {
  if (!variant.attributes?.length) return variant.name || variant.sku;
  return variant.attributes.map((a) => a.value).join(' / ');
}

export function buildVariantDisplayName(productName: string, variant: ProductVariant): string {
  const attrs = buildVariantDescription(variant);
  return attrs ? `${productName} - ${attrs}` : productName;
}

export function getVariantAttributeValue(variant: ProductVariant, attributeName: string): string | undefined {
  return variant.attributes?.find(
    (a) => a.attributeName.toLowerCase() === attributeName.toLowerCase()
  )?.value;
}

export function extractVariantAttributes<T extends VariantWithAttributes>(variants: T[]): VariantSelectorOption[] {
  const map = new Map<string, Set<string>>();
  variants.forEach((v) => {
    v.attributes?.forEach((a) => {
      if (!map.has(a.attributeName)) map.set(a.attributeName, new Set());
      map.get(a.attributeName)!.add(a.value);
    });
  });
  return Array.from(map.entries()).map(([attribute, values]) => ({
    attribute,
    values: Array.from(values),
  }));
}

export function findVariantByAttributes<T extends VariantWithAttributes>(
  variants: T[],
  selected: Record<string, string>
): T | undefined {
  const selectedEntries = Object.entries(selected).filter(([, value]) => Boolean(value));
  if (selectedEntries.length === 0) return undefined;

  return variants.find((v) => {
    if (!v.attributes?.length || v.attributes.length !== selectedEntries.length) return false;
    return v.attributes.every((attribute) => selectedEntries.some(
      ([attributeName, attributeValue]) =>
        attribute.attributeName.toLowerCase() === attributeName.toLowerCase()
        && attribute.value === attributeValue,
    ));
  });
}
