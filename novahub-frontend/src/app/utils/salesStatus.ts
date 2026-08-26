/**
 * Paleta compartida para estados de Ventas.
 *
 * Los cuatro estados de flujo comunes toman como fuente de verdad la vista
 * de Cotizaciones. Los estados exclusivos de Facturas, devoluciones y
 * créditos mantienen tonos propios para no confundir su significado.
 */
export const SALES_WORKFLOW_STATUS_COLORS = {
  DRAFT: 'bg-amber-500/10 text-amber-500',
  IN_PROCESS: 'bg-blue-500/10 text-blue-500',
  APPROVED: 'bg-emerald-500/10 text-emerald-500',
  CANCELLED: 'bg-rose-500/10 text-rose-500',
} as const;

export const SALES_STATUS_COLORS = {
  ...SALES_WORKFLOW_STATUS_COLORS,
  SENT: SALES_WORKFLOW_STATUS_COLORS.IN_PROCESS,
  IN_PROGRESS: SALES_WORKFLOW_STATUS_COLORS.IN_PROCESS,
  CONFIRMED: SALES_WORKFLOW_STATUS_COLORS.APPROVED,
  PENDING: 'bg-amber-500/10 text-amber-500',
  PROCESSED: 'bg-blue-500/10 text-blue-500',
  REJECTED: 'bg-rose-500/10 text-rose-500',
  CREDIT: 'bg-violet-500/10 text-violet-500',
  PAID: 'bg-cyan-500/10 text-cyan-500',
  OVERDUE: 'bg-orange-500/10 text-orange-500',
  PARTIAL: 'bg-indigo-500/10 text-indigo-500',
  ISSUED: 'bg-emerald-500/10 text-emerald-500',
  APPLIED: 'bg-blue-500/10 text-blue-500',
  VOIDED: 'bg-rose-500/10 text-rose-500',
  ACTIVE: 'bg-emerald-500/10 text-emerald-500',
  PAUSED: 'bg-amber-500/10 text-amber-500',
  EXPIRED: 'bg-muted/20 text-muted-foreground',
} as const;

export const getSalesStatusColor = (status: unknown, fallback = 'bg-muted/20 text-muted-foreground') => (
  SALES_STATUS_COLORS[String(status || '').toUpperCase() as keyof typeof SALES_STATUS_COLORS] || fallback
);

/** Facturas usa PENDING como el estado visible "En proceso". */
export const getSalesInvoiceStatusColor = (status: unknown, fallback?: string) => {
  const normalized = String(status || '').toUpperCase();
  return normalized === 'PENDING'
    ? SALES_WORKFLOW_STATUS_COLORS.IN_PROCESS
    : getSalesStatusColor(normalized, fallback);
};
