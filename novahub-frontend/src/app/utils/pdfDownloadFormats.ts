export type PdfDownloadFormat = 'configured' | 'letter' | 'oficio' | 'A4' | 'legal' | 'roll-80' | 'roll-58';

export const PDF_DOWNLOAD_OPTIONS: Array<{
  value: PdfDownloadFormat;
  label: string;
  description: string;
  group: 'configured' | 'standard' | 'roll';
}> = [
  { value: 'configured', label: 'PDF normal', description: 'Diseño y papel configurados', group: 'configured' },
  { value: 'letter', label: 'PDF Carta', description: '8.5 × 11 pulgadas', group: 'standard' },
  { value: 'oficio', label: 'PDF Oficio', description: '8.5 × 13 pulgadas', group: 'standard' },
  { value: 'A4', label: 'PDF A4', description: '210 × 297 mm', group: 'standard' },
  { value: 'legal', label: 'PDF Legal', description: '8.5 × 14 pulgadas', group: 'standard' },
  { value: 'roll-80', label: 'Descargar en rollo 80 mm', description: 'Formato continuo', group: 'roll' },
  { value: 'roll-58', label: 'Descargar en rollo 58 mm', description: 'Formato continuo', group: 'roll' },
];
