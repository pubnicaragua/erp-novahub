export type PdfDownloadFormat = 'configured' | 'letter' | 'oficio' | 'A4' | 'legal' | 'roll-80' | 'roll-58';
export type PdfExportScope = 'page' | 'all';

export const PDF_DOWNLOAD_OPTIONS: Array<{
  value: PdfDownloadFormat;
  label: string;
  description: string;
  group: 'configured' | 'standard' | 'roll';
}> = [
  { value: 'letter', label: 'Carta · 216 × 279 mm', description: 'Página vertical', group: 'standard' },
  { value: 'oficio', label: 'Oficio · 216 × 330 mm', description: 'Página vertical', group: 'standard' },
  { value: 'A4', label: 'A4 · 210 × 297 mm', description: 'Página vertical', group: 'standard' },
  { value: 'legal', label: 'Legal · 216 × 356 mm', description: 'Página vertical', group: 'standard' },
  { value: 'roll-80', label: 'Descargar en rollo 80 mm', description: 'Formato continuo', group: 'roll' },
  { value: 'roll-58', label: 'Descargar en rollo 58 mm', description: 'Formato continuo', group: 'roll' },
];
