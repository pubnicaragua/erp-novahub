/** Normalize user-entered search text so accents and letter case do not affect matches. */
export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
