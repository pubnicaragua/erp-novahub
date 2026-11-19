export const NICARAGUAN_RUC_PATTERN = /^([0-9]{13}[A-Z]|[A-Z][0-9]{13})$/;

export const NICARAGUAN_RUC_ERROR = 'El RUC debe tener 14 caracteres válidos sin guiones (ej. J0310000007669 o 0013007660022M).';
export const NICARAGUAN_RUC_REQUIRED_ERROR = 'El RUC es obligatorio para una empresa.';

export function normalizeNicaraguanRuc(value: unknown): string {
  return String(value ?? '').trim().replace(/[\s-]/g, '').toUpperCase();
}

export function isNicaraguanRucValid(value: unknown): boolean {
  return NICARAGUAN_RUC_PATTERN.test(normalizeNicaraguanRuc(value));
}
