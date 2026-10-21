export const PDF_HEADER_CONTENT_SPACING_MIN_MM = 0;
export const PDF_HEADER_CONTENT_SPACING_MAX_MM = 50;
export const PDF_HEADER_CONTENT_SPACING_DEFAULT_MM = 2;
export type PdfHeaderContentSpacing = number;

const LEGACY_SPACING_MM: Record<string, number> = {
  small: 2,
  medium: 5,
  large: 8,
};

/** Reads the old named values and the current numeric millimeter value. */
export function parsePdfHeaderContentSpacing(value: unknown): number | null {
  if (typeof value === 'string') {
    const legacyValue = LEGACY_SPACING_MM[value.trim().toLowerCase()];
    if (legacyValue !== undefined) return legacyValue;
    if (!value.trim()) return null;
    value = Number(value);
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(PDF_HEADER_CONTENT_SPACING_MAX_MM, Math.max(PDF_HEADER_CONTENT_SPACING_MIN_MM, value));
}

export function normalizePdfHeaderContentSpacing(value: unknown, fallback = PDF_HEADER_CONTENT_SPACING_DEFAULT_MM) {
  return parsePdfHeaderContentSpacing(value) ?? fallback;
}
