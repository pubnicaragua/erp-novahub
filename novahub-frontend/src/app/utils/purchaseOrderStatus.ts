import { SALES_WORKFLOW_STATUS_COLORS } from './salesStatus';

export type PurchaseOrderWorkflowStatus = 'DRAFT' | 'IN_PROCESS' | 'APPROVED' | 'REJECTED';

export const PURCHASE_ORDER_STATUS_OPTIONS = [
  { label: 'Borrador', value: 'DRAFT', color: SALES_WORKFLOW_STATUS_COLORS.DRAFT },
  { label: 'En proceso', value: 'IN_PROCESS', color: SALES_WORKFLOW_STATUS_COLORS.IN_PROCESS },
  { label: 'Aprobada', value: 'APPROVED', color: SALES_WORKFLOW_STATUS_COLORS.APPROVED },
  { label: 'Rechazada', value: 'REJECTED', color: SALES_WORKFLOW_STATUS_COLORS.CANCELLED },
] as const;

export const PURCHASE_ORDER_ACTIONABLE_STATUSES: PurchaseOrderWorkflowStatus[] = ['DRAFT', 'IN_PROCESS'];

/**
 * Normaliza registros creados con la nomenclatura anterior del flujo de OC.
 * PENDING y CANCELLED se mantienen como alias de lectura durante la transición
 * para que los datos antiguos no aparezcan sin etiqueta.
 */
export const normalizePurchaseOrderStatus = (
  status: unknown,
  fallback: PurchaseOrderWorkflowStatus = 'DRAFT',
): PurchaseOrderWorkflowStatus => {
  const normalized = String(status || '').trim().toUpperCase();
  if (normalized === 'PENDING') return 'IN_PROCESS';
  if (normalized === 'CANCELLED') return 'REJECTED';
  if (PURCHASE_ORDER_STATUS_OPTIONS.some((option) => option.value === normalized)) {
    return normalized as PurchaseOrderWorkflowStatus;
  }
  return fallback;
};

export const getPurchaseOrderStatusOption = (status: unknown) => {
  const normalized = normalizePurchaseOrderStatus(status);
  return PURCHASE_ORDER_STATUS_OPTIONS.find((option) => option.value === normalized) || PURCHASE_ORDER_STATUS_OPTIONS[0];
};
