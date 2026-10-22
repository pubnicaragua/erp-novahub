/** label es un tamaño interno para el renderer de etiquetas; no aparece en el menú general. */
export type PdfPaperFormat = 'letter' | 'oficio' | 'A4' | 'legal' | 'roll-80' | 'roll-58' | 'label';
/** Valores heredados que se conservan para leer preferencias antiguas del sistema. */
export type PdfDownloadFormat = PdfPaperFormat | 'configured' | 'novahub-format';
export type PdfExportScope = 'page' | 'all';

export const PDF_DOWNLOAD_OPTIONS: Array<{
  value: PdfPaperFormat;
  label: string;
  name: string;
  dimensions: string;
  group: 'standard' | 'roll';
}> = [
  { value: 'letter', label: 'Carta · 216 × 279 mm', name: 'Carta', dimensions: '216 × 279 mm', group: 'standard' },
  { value: 'oficio', label: 'Oficio · 216 × 330 mm', name: 'Oficio', dimensions: '216 × 330 mm', group: 'standard' },
  { value: 'A4', label: 'A4 · 210 × 297 mm', name: 'A4', dimensions: '210 × 297 mm', group: 'standard' },
  { value: 'legal', label: 'Legal · 216 × 356 mm', name: 'Legal', dimensions: '216 × 356 mm', group: 'standard' },
  { value: 'roll-80', label: 'Rollo · 80 mm', name: 'Rollo', dimensions: '80 mm', group: 'roll' },
  { value: 'roll-58', label: 'Rollo · 58 mm', name: 'Rollo', dimensions: '58 mm', group: 'roll' },
];
