export type FinancingApplicationStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'DISBURSED';
export type FinancingWorkflowAction = 'startReview' | 'approve' | 'reject' | 'disburse' | 'reopen';

export interface FinancingStatusTransition {
  status: FinancingApplicationStatus;
  permission: FinancingWorkflowAction;
  label: string;
}

const STATUS_TRANSITIONS: Record<FinancingApplicationStatus, FinancingStatusTransition[]> = {
  PENDING: [
    { status: 'IN_REVIEW', permission: 'startReview', label: 'Iniciar revisión' },
    { status: 'REJECTED', permission: 'reject', label: 'Rechazar solicitud' },
  ],
  IN_REVIEW: [
    { status: 'APPROVED', permission: 'approve', label: 'Aprobar solicitud' },
    { status: 'REJECTED', permission: 'reject', label: 'Rechazar solicitud' },
  ],
  APPROVED: [{ status: 'DISBURSED', permission: 'disburse', label: 'Marcar desembolso' }],
  REJECTED: [{ status: 'PENDING', permission: 'reopen', label: 'Regresar a pendientes' }],
  DISBURSED: [],
};

export function getFinancingStatusTransitions(status: FinancingApplicationStatus): FinancingStatusTransition[] {
  return STATUS_TRANSITIONS[status] || [];
}
