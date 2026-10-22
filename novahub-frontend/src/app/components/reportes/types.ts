import type { PdfPaperFormat } from '../../utils/pdfDownloadFormats';

export interface ReportExportRef {
  exportPDF: (format: PdfPaperFormat) => void;
  exportExcel: () => void;
}

export interface ReportProps {
  dateRange: string; 
  /* "hoy" | "ultima-semana" | "ultimo-mes" | "ultimo-trimestre" | "ultimo-año" */
}

export type ThemeConfig = {
  colors: {
    primary: string;
  };
  logo?: string;
  tenantName?: string;
};
