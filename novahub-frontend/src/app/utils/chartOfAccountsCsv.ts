import type { ChartAccountCsvRow } from '../types/accounting';

export const CHART_ACCOUNT_CSV_HEADERS = [
  'codigo', 'nombre', 'tipo_cuenta', 'subtipo', 'tipo_detalle',
  'moneda', 'codigo_padre', 'permite_manual', 'activa', 'notas',
] as const;

export const CHART_ACCOUNT_CSV_TEMPLATE: ChartAccountCsvRow[] = [
  {
    codigo: '100', nombre: 'Activo', tipo_cuenta: 'Activos',
    subtipo: 'Grupo principal', tipo_detalle: 'Balance General',
    moneda: 'NIO', codigo_padre: '', permite_manual: '0', activa: '1', notas: '',
  },
  {
    codigo: '1100', nombre: 'Activo corrientes', tipo_cuenta: 'Activos',
    subtipo: 'Grupo', tipo_detalle: 'Balance General',
    moneda: 'NIO', codigo_padre: '100', permite_manual: '0', activa: '1', notas: '',
  },
  {
    codigo: '1101', nombre: 'Efectivo en banco', tipo_cuenta: 'Activos',
    subtipo: 'Cuenta de detalle', tipo_detalle: 'Balance General',
    moneda: 'NIO', codigo_padre: '1100', permite_manual: '1', activa: '1', notas: '',
  },
  {
    codigo: '1101-001', nombre: 'CTA. XXX', tipo_cuenta: 'Activos',
    subtipo: 'Subcuenta', tipo_detalle: 'Balance General',
    moneda: 'NIO', codigo_padre: '1101', permite_manual: '1', activa: '1', notas: '',
  },
  {
    codigo: '200', nombre: 'Pasivo', tipo_cuenta: 'Pasivos',
    subtipo: 'Grupo principal', tipo_detalle: 'Balance General',
    moneda: 'NIO', codigo_padre: '', permite_manual: '0', activa: '1', notas: '',
  },
];

export function parseCsvBoolean(value: unknown, fallback = true): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') return true;
  if (normalized === '0' || normalized === 'false') return false;
  return fallback;
}

export function toCsvBoolean(value: boolean): '1' | '0' {
  return value ? '1' : '0';
}

function escapeCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function csvRowsToText(rows: readonly (readonly unknown[])[]): string {
  return rows.map(row => row.map(escapeCell).join(',')).join('\r\n');
}

export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && (char === ',' || char === ';')) {
      row.push(cell.trim());
      cell = '';
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(value => value !== '')) rows.push(row);
  return rows;
}

export function downloadCsv(filename: string, rows: readonly (readonly unknown[])[]): void {
  const csv = csvRowsToText(rows);
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function templateRows(): string[][] {
  return [
    [...CHART_ACCOUNT_CSV_HEADERS],
    ...CHART_ACCOUNT_CSV_TEMPLATE.map(row => CHART_ACCOUNT_CSV_HEADERS.map(header => row[header])),
  ];
}
