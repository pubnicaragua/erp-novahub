const EXEMPT_TAX_CODES = new Set([
  'EXENTO',
  'IVA_EXENTO',
  'EXONERADO',
  'IVA_EXONERADO',
  'NO_GRAVADO',
  'NO_SUJETO',
  'IVA_NO_SUJETO',
]);

export function isTaxExempt(taxType?: string | null): boolean {
  if (!taxType) return true;
  return EXEMPT_TAX_CODES.has(String(taxType).toUpperCase());
}

export function isTaxable(taxType?: string | null): boolean {
  return !isTaxExempt(taxType);
}