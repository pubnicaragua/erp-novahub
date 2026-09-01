function textValue(value: unknown): string {
  return String(value ?? '').trim();
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const source = value.trim();
  if (!source || !['[', '{'].includes(source[0])) return value;
  try {
    return JSON.parse(source);
  } catch {
    return value;
  }
}

function formatAttributeValue(value: unknown): string {
  const parsed = parseJsonValue(value);
  if (Array.isArray(parsed)) return parsed.map(formatAttributeValue).filter(Boolean).join(' · ');
  if (parsed && typeof parsed === 'object') {
    return Object.entries(parsed as Record<string, unknown>)
      .map(([label, entry]) => {
        const formatted = formatAttributeValue(entry);
        return formatted ? `${label}: ${formatted}` : '';
      })
      .filter(Boolean)
      .join(' · ');
  }
  return textValue(parsed);
}

/** Convierte los atributos de una variante en un texto estable para PDF. */
export function formatPdfVariantAttributes(value: unknown): string {
  const parsed = parseJsonValue(value);
  if (Array.isArray(parsed)) {
    return parsed.map((entry) => {
      if (!entry || typeof entry !== 'object') return formatAttributeValue(entry);
      const attribute = entry as Record<string, unknown>;
      const label = textValue(attribute.attributeName ?? attribute.name ?? attribute.label ?? attribute.attribute ?? attribute.key);
      const selectedValue = formatAttributeValue(attribute.value ?? attribute.valor ?? attribute.optionName ?? attribute.option ?? attribute.selectedValue);
      if (!selectedValue) return '';
      return label ? `${label}: ${selectedValue}` : selectedValue;
    }).filter(Boolean).join(' · ');
  }
  return formatAttributeValue(parsed);
}

function getVariantData(item: any): Record<string, unknown> {
  const variant = item?.variant || item?.productVariant || item?.product?.variant;
  return variant && typeof variant === 'object' ? variant as Record<string, unknown> : {};
}

/** Indica si una línea tiene información suficiente para identificar una variante. */
export function hasPdfVariantDetails(item: any): boolean {
  const variant = getVariantData(item);
  return Boolean(
    textValue(item?.variantId || item?.variantIdSnapshot || variant.id)
      || textValue(item?.variantSku || item?.skuVariant || item?.skuVariante || variant.sku)
      || textValue(item?.variantName || variant.name)
      || formatPdfVariantAttributes(item?.variantAttributes ?? variant.attributes),
  );
}

/**
 * Descripción común de líneas para todos los PDFs con productos.
 * Mantiene la descripción histórica y agrega los identificadores de variante
 * cuando la línea realmente está vinculada a una.
 */
export function formatPdfItemDescription(item: any, fallback = 'Producto', includeCommercialNote = true): string {
  const description = textValue(item?.description || item?.name || item?.product?.name || fallback);
  const variant = getVariantData(item);
  const variantId = textValue(item?.variantId || item?.variantIdSnapshot || variant.id);
  const productCode = textValue(item?.productCode || item?.productCodeSnapshot || item?.product?.code);
  const explicitVariantSku = textValue(item?.variantSku || item?.skuVariant || item?.skuVariante);
  const variantSku = explicitVariantSku || textValue(variant.sku);
  const variantName = textValue(item?.variantName || variant.name);
  const variantAttributes = formatPdfVariantAttributes(item?.variantAttributes ?? variant.attributes);
  const hasVariant = hasPdfVariantDetails(item);

  // En compras antiguas `code` puede contener el SKU de la variante y no
  // existe todavía un `productCode`; conservarlo como SKU en ese caso.
  const legacyCode = textValue(item?.code || item?.sku);
  const resolvedProductCode = productCode || (!hasVariant ? legacyCode : '');
  const resolvedVariantSku = variantSku || (hasVariant && !productCode ? legacyCode : '');
  const note = textValue(item?.commercialNoteSnapshot || item?.commercialNote || item?.product?.commercialNoteSnapshot || item?.product?.commercialNote);

  return [
    description,
    resolvedProductCode ? `Código: ${resolvedProductCode}` : '',
    hasVariant ? `SKU variante: ${resolvedVariantSku || variantId}` : '',
    hasVariant && variantName ? `Nombre variante: ${variantName}` : '',
    hasVariant && variantAttributes ? `Atributos: ${variantAttributes}` : '',
    includeCommercialNote && note ? `Nota: ${note}` : '',
  ].filter(Boolean).join('\n');
}

/** Resume las variantes de un documento para historiales y comprobantes. */
export function formatPdfVariantDetails(items: unknown, title = 'Detalle de variantes'): string {
  const rows = Array.isArray(items) ? items : [];
  const lines = rows
    .filter(hasPdfVariantDetails)
    .map((item) => formatPdfItemDescription(item, 'Producto', false))
    .filter(Boolean);
  return lines.length ? `${title}:\n${lines.join('\n')}` : '';
}
