export type PdfPaperFormat = 'letter' | 'oficio' | 'A4' | 'legal' | 'roll-80' | 'roll-58';
/** Valores heredados que se conservan para leer preferencias antiguas del sistema. */
export type PdfDownloadFormat = PdfPaperFormat | 'configured' | 'novahub-format';
export type PdfExportScope = 'page' | 'all';

export const PDF_DOWNLOAD_OPTIONS: Array<{
  value: PdfPaperFormat;
  label: string;
  description: string;
  group: 'standard' | 'roll';
}> = [
  { value: 'letter', label: 'Carta · 216 × 279 mm', description: 'Diseño asignado · Principal', group: 'standard' },
  { value: 'oficio', label: 'Oficio · 216 × 330 mm', description: 'Diseño asignado · Vertical', group: 'standard' },
  { value: 'A4', label: 'A4 · 210 × 297 mm', description: 'Diseño asignado · Vertical', group: 'standard' },
  { value: 'legal', label: 'Legal · 216 × 356 mm', description: 'Diseño asignado · Vertical', group: 'standard' },
  { value: 'roll-80', label: 'Rollo · 80 mm', description: 'Diseño asignado · Continuo', group: 'roll' },
  { value: 'roll-58', label: 'Rollo · 58 mm', description: 'Diseño asignado · Continuo', group: 'roll' },
];
