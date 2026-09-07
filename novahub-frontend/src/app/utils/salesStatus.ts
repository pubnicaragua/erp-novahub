/** Color único de marca para estados y badges de registros de Ventas. */
const SALES_THEME_STATUS_COLOR = 'bg-primary/10 text-primary' as const;

export const SALES_WORKFLOW_STATUS_COLORS = {
  DRAFT: SALES_THEME_STATUS_COLOR,
  IN_PROCESS: SALES_THEME_STATUS_COLOR,
  APPROVED: SALES_THEME_STATUS_COLOR,
  CANCELLED: SALES_THEME_STATUS_COLOR,
} as const;

export const SALES_STATUS_COLORS = {
  ...SALES_WORKFLOW_STATUS_COLORS,
  SENT: SALES_WORKFLOW_STATUS_COLORS.IN_PROCESS,
  IN_PROGRESS: SALES_WORKFLOW_STATUS_COLORS.IN_PROCESS,
  CONFIRMED: SALES_WORKFLOW_STATUS_COLORS.APPROVED,
  PENDING: SALES_THEME_STATUS_COLOR,
  PROCESSED: SALES_THEME_STATUS_COLOR,
  REJECTED: SALES_THEME_STATUS_COLOR,
  CREDIT: SALES_THEME_STATUS_COLOR,
  PAID: SALES_THEME_STATUS_COLOR,
  OVERDUE: SALES_THEME_STATUS_COLOR,
  PARTIAL: SALES_THEME_STATUS_COLOR,
  ISSUED: SALES_THEME_STATUS_COLOR,
  APPLIED: SALES_THEME_STATUS_COLOR,
  VOIDED: SALES_THEME_STATUS_COLOR,
  ACTIVE: SALES_THEME_STATUS_COLOR,
  PAUSED: SALES_THEME_STATUS_COLOR,
  EXPIRED: SALES_THEME_STATUS_COLOR,
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
