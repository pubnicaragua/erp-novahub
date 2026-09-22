export type PdfDownloadFormat = 'configured' | 'letter' | 'oficio' | 'A4' | 'legal' | 'roll-80' | 'roll-58';
export type PdfExportScope = 'page' | 'all';

export const PDF_DOWNLOAD_OPTIONS: Array<{
  value: PdfDownloadFormat;
  label: string;
  description: string;
  group: 'configured' | 'standard' | 'roll';
}> = [
  { value: 'roll-80', label: 'Descargar en rollo 80 mm', description: 'Formato continuo', group: 'roll' },
  { value: 'roll-58', label: 'Descargar en rollo 58 mm', description: 'Formato continuo', group: 'roll' },
];
