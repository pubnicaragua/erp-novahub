import { useQueryClient } from '@tanstack/react-query';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { marketingApi, type MktReport } from '../../services/marketing.service';
import { createReportWorkbook } from '../../utils/reportWorkbook';
import { buildDatedDownloadFileName } from '../../utils/exportFileNames';
import { CAMPAIGN_STATUS_LABEL, fmtDate, toInputDate, toInputDateTime } from './marketing.constants';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'select' | 'tags';
export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  hint?: string;
  span?: 1 | 2;
  placeholder?: string;
};
export type FormValues = Record<string, string>;

const CONVERTERS: Record<FieldType, (v: string) => unknown> = {
  text: (v) => v.trim(), textarea: (v) => v.trim(), select: (v) => v,
  number: (v) => (v === '' ? null : Number(v)),
  date: (v) => (v ? new Date(`${v}T12:00:00`).toISOString() : null),
  datetime: (v) => (v ? new Date(v).toISOString() : null),
  tags: (v) => v.split(',').map((t) => t.trim()).filter(Boolean),
};

/** Valores del formulario → payload de la API. */
export function toPayload(fields: FieldDef[], values: FormValues) {
  const out: Record<string, unknown> = {};
  for (const f of fields) out[f.key] = CONVERTERS[f.type](values[f.key] ?? '');
  return out;
}

/** Registro de la API → valores iniciales del formulario. */
export function toInitial(fields: FieldDef[], row?: object | null): FormValues {
  const source = (row ?? {}) as Record<string, unknown>;
  return Object.fromEntries(fields.map((f) => {
    const v = source[f.key];
    if (v === null || v === undefined) return [f.key, ''];
    if (f.type === 'date') return [f.key, toInputDate(String(v))];
    if (f.type === 'datetime') return [f.key, toInputDateTime(String(v))];
    if (f.type === 'tags') return [f.key, Array.isArray(v) ? v.join(', ') : String(v)];
    return [f.key, String(v)];
  }));
}

export const options = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));
export const userOptions = (users?: Array<{ id: string; name: string }>) => (users ?? []).map((u) => ({ value: u.id, label: u.name }));
export const userName = (users: Array<{ id: string; name: string }> | undefined, id?: string | null) => (id && users?.find((u) => u.id === id)?.name) || '—';

/** Invalida las consultas de módulo del tenant (los datos de Marketing viven bajo `tenant-module`). */
export function useMktRefresh() {
  const client = useQueryClient();
  return () => { void client.invalidateQueries({ queryKey: ['tenant-module'] }); };
}

export function useMktUsers() {
  return useTenantQuery(['marketing', 'users'], (signal) => marketingApi.users(signal), { staleTime: 5 * 60_000 });
}

export function useMktConfig() {
  return useTenantQuery(['marketing', 'settings'], (signal) => marketingApi.settings(signal), { staleTime: 60_000 });
}

/** Exporta el reporte de Marketing a Excel; lo comparten Analítica y la pestaña Marketing de Reportes. */
export function exportMarketingReportExcel(d: MktReport, filters: {
  from: string;
  to: string;
  currency: string;
  reportCurrency?: string;
  convertAmount?: (amount: number, sourceCurrency: string) => number;
}) {
  const amount = (value: unknown) => filters.convertAmount
    ? filters.convertAmount(Number(value || 0), filters.currency)
    : Number(value || 0);
  return createReportWorkbook({
    fileName: buildDatedDownloadFileName(['reporte_marketing'], 'xlsx'),
    filters: { Desde: filters.from, Hasta: filters.to, Moneda: filters.reportCurrency || filters.currency },
    sheets: [
      { name: 'Campañas', rows: d.campaigns.map((c) => ({ Código: c.code, Campaña: c.name, Estado: CAMPAIGN_STATUS_LABEL[c.status], [`Presupuesto (${filters.reportCurrency || filters.currency})`]: amount(c.budget), [`Ejecutado (${filters.reportCurrency || filters.currency})`]: amount(c.spent), Alcance: c.metrics.REACH ?? 0, Leads: c.metrics.LEADS ?? 0, [`Inversión (${filters.reportCurrency || filters.currency})`]: amount(c.metrics.SPEND), [`Ingresos (${filters.reportCurrency || filters.currency})`]: amount(c.metrics.REVENUE), ROAS: c.roas === null ? '' : Number(c.roas.toFixed(2)) })) },
      { name: 'Canales', rows: d.channels.map((c) => ({ Canal: c.channel, Alcance: c.metrics.REACH ?? 0, Clics: c.metrics.CLICKS ?? 0, Leads: c.metrics.LEADS ?? 0, [`Inversión (${filters.reportCurrency || filters.currency})`]: amount(c.metrics.SPEND), [`Ingresos (${filters.reportCurrency || filters.currency})`]: amount(c.metrics.REVENUE), ROAS: c.roas === null ? '' : Number(c.roas.toFixed(2)) })) },
      { name: 'Historial', rows: d.history.map((h) => ({ Fecha: fmtDate(h.createdAt, true), Tipo: h.entityType, Acción: h.action, Detalle: h.summary })) },
    ],
  });
}
