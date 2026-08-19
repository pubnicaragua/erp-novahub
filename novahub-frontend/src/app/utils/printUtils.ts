/**
 * printUtils.ts
 * Utilidades para generar HTML de impresión reutilizable.
 * Soporta: listas/reportes, documentos de venta, documentos de compra.
 */

// ── Helpers ──────────────────────────────────────────────────

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function alignClass(align?: string): string {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return '';
}

// ── Generador de reporte/tabla ──────────────────────────────

export interface PrintColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  format?: (value: any, row: any) => string;
  className?: string;
  hidden?: boolean;
}

export interface PrintTableOptions {
  title: string;
  columns: PrintColumn[];
  rows: Record<string, any>[];
  filters?: Record<string, string>;
  subtitle?: string;
  footer?: string;
}

export function generateTableHtml(options: PrintTableOptions): string {
  const { columns, rows, filters, subtitle } = options;
  const visibleColumns = columns.filter((c) => !c.hidden);

  const filtersHtml = filters
    ? Object.entries(filters)
        .filter(([, v]) => v && v !== 'Todas' && v !== 'Sin filtro')
        .map(([k, v]) => `<span>${esc(k)}: <b>${esc(v)}</b></span>`)
        .join(' &nbsp;·&nbsp; ')
    : '';

  const subtitleHtml = subtitle ? `<p style="font-size:9pt;color:#555;margin:0 0 8px;">${esc(subtitle)}</p>` : '';
  const filtersBlock = filtersHtml ? `<div style="margin-bottom:8px;font-size:7pt;color:#666;">${filtersHtml}</div>` : '';

  const thHtml = visibleColumns
    .map((col) => `<th style="text-align:${col.align || 'left'}">${esc(col.label)}</th>`)
    .join('');

  const trsHtml = rows
    .map((row) => {
      const tds = visibleColumns
        .map((col) => {
          const raw = row[col.key];
          const value = col.format ? col.format(raw, row) : raw;
          const cls = [alignClass(col.align), col.className].filter(Boolean).join(' ');
          return `<td class="${cls}">${esc(value)}</td>`;
        })
        .join('');
      return `<tr>${tds}</tr>`;
    })
    .join('');

  const countLine = `<div style="font-size:6pt;color:#999;text-align:right;margin-top:3px;">${rows.length} registro(s) · ${new Date().toLocaleDateString('es-NI')} ${new Date().toLocaleTimeString('es-NI')}</div>`;

  return `
    ${subtitleHtml}
    ${filtersBlock}
    <table class="print-table">
      <thead><tr>${thHtml}</tr></thead>
      <tbody>${trsHtml || `<tr><td colspan="${visibleColumns.length}" style="text-align:center;padding:15px;">Sin datos</td></tr>`}</tbody>
    </table>
    ${countLine}
  `;
}

// ── Generador de documento (factura, orden, etc.) ───────────

export interface DocField {
  label: string;
  value: string;
}

export interface DocLine {
  description: string;
  quantity?: number | string;
  unitPrice?: string;
  discount?: string;
  tax?: string;
  total: string;
  notes?: string;
}

export interface DocTotals {
  subtotal?: string;
  discount?: string;
  tax?: string;
  ir?: string;
  other?: { label: string; value: string }[];
  total: string;
  totalLabel?: string;
}

export interface DocPrintData {
  number: string;
  date: string;
  dueDate?: string;
  status?: string;
  customer?: DocField[];
  supplier?: DocField[];
  company?: DocField[];
  lines: DocLine[];
  totals: DocTotals;
  notes?: string;
  legal?: string;
  paymentMethod?: string;
  currency?: string;
  footer?: string;
}

function renderFieldRow(label: string, value: string): string {
  return `<div class="print-field-row"><span class="print-field-label">${esc(label)}:</span><span class="print-field-value">${esc(value)}</span></div>`;
}

function renderSection(title: string, content: string): string {
  return `<div class="print-section"><div class="print-section-title">${esc(title)}</div>${content}</div>`;
}

function renderSideBySide(leftFields: DocField[], rightFields: DocField[]): string {
  const left = leftFields.map((f) => renderFieldRow(f.label, f.value)).join('');
  const right = rightFields.map((f) => renderFieldRow(f.label, f.value)).join('');
  return `
    <div class="print-doc-info">
      <div class="doc-left">${left}</div>
      <div class="doc-right">${right}</div>
    </div>
  `;
}

export function generateDocumentHtml(data: DocPrintData): string {
  const { number, date, dueDate, status, customer, supplier, company, lines, totals, notes, legal, paymentMethod, currency, footer } = data;

  // Info del documento
  const docInfo = renderSideBySide(
    [
      { label: 'Fecha', value: date },
      ...(dueDate ? [{ label: 'Vencimiento', value: dueDate }] : []),
      ...(paymentMethod ? [{ label: 'Forma de pago', value: paymentMethod }] : []),
      ...(currency ? [{ label: 'Moneda', value: currency }] : []),
    ],
    [
      { label: 'Nº Documento', value: number },
      ...(status ? [{ label: 'Estado', value: status }] : []),
    ]
  );

  // Info del cliente/proveedor
  const partyFields = customer || supplier || [];
  const partyTitle = customer ? 'Cliente' : 'Proveedor';
  const partySection = partyFields.length > 0
    ? renderSection(partyTitle, partyFields.map((f) => renderFieldRow(f.label, f.value)).join(''))
    : '';

  // Info de empresa (si se provee)
  const companySection = company && company.length > 0
    ? renderSection('Empresa', company.map((f) => renderFieldRow(f.label, f.value)).join(''))
    : '';

  // Tabla de productos
  const tableHtml = lines.length > 0 ? `
    <table class="print-table">
      <thead>
        <tr>
          <th style="text-align:left">Descripción</th>
          <th style="text-align:center">Cant.</th>
          <th style="text-align:right">P. Unit.</th>
          <th style="text-align:right">Desc.</th>
          <th style="text-align:right">Imp.</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lines.map((line) => `
          <tr>
            <td>
              ${esc(line.description)}
              ${line.notes ? `<div class="text-xs text-muted">${esc(line.notes)}</div>` : ''}
            </td>
            <td class="text-center">${line.quantity ?? ''}</td>
            <td class="text-right">${esc(line.unitPrice || '')}</td>
            <td class="text-right">${esc(line.discount || '')}</td>
            <td class="text-right">${esc(line.tax || '')}</td>
            <td class="text-right font-bold">${esc(line.total)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '';

  // Totales
  const totalsRows: string[] = [];
  if (totals.subtotal) {
    totalsRows.push(`<tr><td class="total-label">Subtotal</td><td class="total-value">${esc(totals.subtotal)}</td></tr>`);
  }
  if (totals.discount) {
    totalsRows.push(`<tr><td class="total-label">Descuento</td><td class="total-value">-${esc(totals.discount)}</td></tr>`);
  }
  if (totals.tax) {
    totalsRows.push(`<tr><td class="total-label">Impuestos</td><td class="total-value">${esc(totals.tax)}</td></tr>`);
  }
  if (totals.ir) {
    totalsRows.push(`<tr><td class="total-label">IR</td><td class="total-value">${esc(totals.ir)}</td></tr>`);
  }
  if (totals.other) {
    for (const item of totals.other) {
      totalsRows.push(`<tr><td class="total-label">${esc(item.label)}</td><td class="total-value">${esc(item.value)}</td></tr>`);
    }
  }
  totalsRows.push(`<tr class="grand-total"><td class="total-label">${esc(totals.totalLabel || 'TOTAL')}</td><td class="total-value">${esc(totals.total)}</td></tr>`);

  const totalsHtml = `
    <div class="print-totals">
      <table>
        <tbody>${totalsRows.join('')}</tbody>
      </table>
    </div>
  `;

  // Notas
  const notesHtml = notes
    ? `<div class="print-notes"><strong>Notas:</strong> ${esc(notes)}</div>`
    : '';

  // Pie
  const legalHtml = legal
    ? `<div class="print-legal">${esc(legal)}</div>`
    : '';

  const footerHtml = footer
    ? `<div class="print-footer">${esc(footer)}</div>`
    : `<div class="print-footer">Documento generado por NovaHub ERP</div>`;

  return `
    ${docInfo}
    ${companySection}
    ${partySection}
    ${tableHtml}
    ${totalsHtml}
    ${notesHtml}
    ${legalHtml}
    ${footerHtml}
  `;
}

// ── Convenience: generar HTML completo para impresión ───────

export function generatePrintableDocument(data: DocPrintData): string {
  return `<div class="print-document">${generateDocumentHtml(data)}</div>`;
}
