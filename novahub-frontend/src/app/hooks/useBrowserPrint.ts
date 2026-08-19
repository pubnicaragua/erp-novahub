import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export type PaperSize = 'letter' | 'legal' | 'A4' | 'oficio' | 'roll-58' | 'roll-80';

export interface PrintOptions {
  title?: string;
  paperSize?: PaperSize;
  orientation?: 'portrait' | 'landscape';
  companyName?: string;
  companyInfo?: string;
  logoUrl?: string;
}

interface PageSizeConfig {
  css: string;
  width: string;
  isRoll: boolean;
}

const PAGE_CONFIGS: Record<PaperSize, PageSizeConfig> = {
  letter: { css: 'letter portrait', width: '216mm', isRoll: false },
  legal: { css: 'legal portrait', width: '216mm', isRoll: false },
  A4: { css: 'A4 portrait', width: '210mm', isRoll: false },
  oficio: { css: '13in 8.5in portrait', width: '216mm', isRoll: false },
  'roll-58': { css: '58mm auto', width: '58mm', isRoll: true },
  'roll-80': { css: '80mm auto', width: '80mm', isRoll: true },
};

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPageCss(config: PageSizeConfig): string {
  if (config.isRoll) {
    return `
      @page {
        size: ${config.css};
        margin: 2mm;
      }
      html, body {
        margin: 0;
        padding: 0;
        width: ${config.width};
        overflow: hidden;
      }
    `;
  }
  return `
    @page {
      size: ${config.css};
      margin: 12mm;
    }
    html, body {
      margin: 0;
      padding: 0;
    }
  `;
}

function buildCommonCss(isRoll: boolean): string {
  const baseFontSize = isRoll ? '9pt' : '10pt';
  const lineHeight = isRoll ? '1.2' : '1.35';

  return `
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: ${baseFontSize};
      line-height: ${lineHeight};
      color: #000;
      background: #fff;
    }
    .print-document {
      width: 100%;
      padding: 0;
      margin: 0;
    }

    /* Encabezado */
    .print-header {
      text-align: center;
      margin-bottom: ${isRoll ? '8px' : '12px'};
      padding-bottom: ${isRoll ? '5px' : '8px'};
      border-bottom: 1px solid #000;
    }
    .print-header .company-logo {
      max-height: ${isRoll ? '30px' : '45px'};
      margin-bottom: ${isRoll ? '3px' : '5px'};
    }
    .print-header h1 {
      font-size: ${isRoll ? '11pt' : '14pt'};
      font-weight: 800;
      margin: 0 0 2px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .print-header .company-info {
      font-size: ${isRoll ? '6pt' : '7pt'};
      color: #444;
      margin: 1px 0;
    }
    .print-header .subtitle {
      font-size: ${isRoll ? '8pt' : '9pt'};
      color: #333;
      margin: ${isRoll ? '3px' : '5px'} 0 0;
      font-weight: 600;
    }

    /* Info del documento */
    .print-doc-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: ${isRoll ? '6px' : '10px'};
      font-size: ${isRoll ? '7pt' : '8pt'};
    }
    .print-doc-info .doc-number {
      font-size: ${isRoll ? '9pt' : '11pt'};
      font-weight: 800;
    }
    .print-doc-info .doc-label {
      font-size: ${isRoll ? '6pt' : '7pt'};
      text-transform: uppercase;
      color: #666;
    }

    /* Secciones */
    .print-section {
      margin-bottom: ${isRoll ? '6px' : '10px'};
      page-break-inside: avoid;
    }
    .print-section-title {
      font-size: ${isRoll ? '6pt' : '7pt'};
      font-weight: 700;
      text-transform: uppercase;
      color: #666;
      margin: 0 0 3px;
      padding-bottom: 2px;
      border-bottom: 1px solid #ddd;
    }
    .print-field-row {
      display: flex;
      margin-bottom: 1px;
      font-size: ${isRoll ? '7pt' : '8pt'};
    }
    .print-field-label {
      font-weight: 600;
      min-width: ${isRoll ? '60px' : '90px'};
      flex-shrink: 0;
      color: #444;
    }
    .print-field-value {
      flex: 1;
      color: #000;
    }

    /* Tabla */
    .print-table {
      width: 100%;
      border-collapse: collapse;
      margin: ${isRoll ? '5px' : '8px'} 0;
      font-size: ${isRoll ? '7pt' : '8pt'};
    }
    .print-table thead { display: table-header-group; }
    .print-table tbody { display: table-row-group; }
    .print-table tr { page-break-inside: avoid; }
    .print-table th {
      background: #f0f0f0 !important;
      color: #000 !important;
      font-weight: 700;
      text-transform: uppercase;
      font-size: ${isRoll ? '6pt' : '7pt'};
      padding: ${isRoll ? '2px 3px' : '3px 5px'};
      border: 1px solid #ccc;
      border-bottom: 1px solid #000;
    }
    .print-table td {
      padding: ${isRoll ? '2px 3px' : '3px 5px'};
      border: 1px solid #ddd;
      vertical-align: top;
    }
    .print-table .text-right { text-align: right; }
    .print-table .text-center { text-align: center; }
    .print-table .font-bold { font-weight: 700; }
    .print-table .text-xs { font-size: ${isRoll ? '5pt' : '6pt'}; }
    .print-table .text-muted { color: #666; }

    /* Totales */
    .print-totals {
      margin-top: ${isRoll ? '5px' : '8px'};
      text-align: right;
    }
    .print-totals table {
      margin-left: auto;
      border-collapse: collapse;
      font-size: ${isRoll ? '7pt' : '8pt'};
    }
    .print-totals td {
      padding: ${isRoll ? '1px 5px' : '2px 8px'};
    }
    .print-totals .total-label {
      text-align: right;
      font-weight: 600;
      padding-right: 10px;
    }
    .print-totals .total-value {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .print-totals .grand-total {
      font-weight: 800;
      font-size: ${isRoll ? '9pt' : '10pt'};
      border-top: 1px solid #000;
      padding-top: 3px;
    }

    /* Notas */
    .print-notes {
      margin-top: ${isRoll ? '5px' : '8px'};
      padding: ${isRoll ? '3px' : '5px'};
      border: 1px dashed #ccc;
      font-size: ${isRoll ? '6pt' : '7pt'};
      font-style: italic;
    }

    /* Footer */
    .print-footer {
      margin-top: ${isRoll ? '8px' : '15px'};
      padding-top: ${isRoll ? '3px' : '5px'};
      border-top: 1px solid #ccc;
      font-size: ${isRoll ? '5pt' : '6pt'};
      color: #666;
      text-align: center;
    }
    .print-legal {
      margin-top: ${isRoll ? '5px' : '10px'};
      font-size: ${isRoll ? '5pt' : '6pt'};
      color: #666;
      text-align: center;
      line-height: 1.2;
    }

    /* Badge */
    .print-badge {
      display: inline-block;
      padding: 0 4px;
      border: 1px solid #999;
      border-radius: 2px;
      font-size: ${isRoll ? '5pt' : '6pt'};
      font-weight: 700;
      text-transform: uppercase;
    }

    /* Separador de items en churro */
    ${isRoll ? '.print-divider { border-top: 1px dashed #ccc; margin: 3px 0; }' : ''}
  `;
}

export function useBrowserPrint() {
  const { user } = useAuth();
  const defaultCompanyName = user?.tenantName || 'NovaHub ERP';

  const printContent = useCallback((html: string, options: PrintOptions = {}) => {
    const {
      title = 'Documento',
      paperSize = 'letter',
      orientation = 'portrait',
      companyName,
      companyInfo,
      logoUrl,
    } = options;

    const config = PAGE_CONFIGS[paperSize] || PAGE_CONFIGS.letter;
    const pageCss = buildPageCss(config);
    const commonCss = buildCommonCss(config.isRoll);
    const displayCompany = companyName || defaultCompanyName;

    const logoHtml = logoUrl
      ? `<img src="${esc(logoUrl)}" alt="Logo" class="company-logo" />`
      : '';

    const infoHtml = companyInfo
      ? `<div class="company-info">${esc(companyInfo)}</div>`
      : '';

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${esc(title)}</title>
  <style>
    ${pageCss}
    ${commonCss}
  </style>
</head>
<body>
  <div class="print-document">
    <div class="print-header">
      ${logoHtml}
      <h1>${esc(displayCompany)}</h1>
      ${infoHtml}
      <div class="subtitle">${esc(title)}</div>
    </div>
    ${html}
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`);

    printWindow.document.close();
  }, [defaultCompanyName]);

  const printElement = useCallback((elementId: string, options: PrintOptions = {}) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    const cloned = element.cloneNode(true) as HTMLElement;
    const printDocument = document.createElement('div');
    printDocument.className = 'print-document';
    printDocument.appendChild(cloned);

    printContent(printDocument.innerHTML, options);
  }, [printContent]);

  return { printContent, printElement };
}
