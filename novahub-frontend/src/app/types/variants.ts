export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  attributes?: VariantAttribute[];
  priceModifier: number;
  costModifier: number;
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

export function extractVariantAttributes(variants: ProductVariant[]): VariantSelectorOption[] {
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

export function findVariantByAttributes(
  variants: ProductVariant[],
  selected: Record<string, string>
): ProductVariant | undefined {
  return variants.find((v) => {
    if (!v.attributes?.length) return false;
    return Object.entries(selected).every(([attrName, attrValue]) =>
      v.attributes!.some(
        (a) => a.attributeName.toLowerCase() === attrName.toLowerCase() && a.value === attrValue
      )
    );
  });
}
