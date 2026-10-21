export const LEGAL_CASE_STATUS_PERMISSION_ACTION = {
  PENDING: 'returnCaseToPending',
  IN_PROGRESS: 'startCase',
  WAITING_DOCS: 'requestCaseDocuments',
  COMPLETED: 'completeCase',
  CANCELLED: 'cancelCase',
} as const;

export type LegalCaseStatus = keyof typeof LEGAL_CASE_STATUS_PERMISSION_ACTION;
export type LegalCaseWorkflowAction = typeof LEGAL_CASE_STATUS_PERMISSION_ACTION[LegalCaseStatus];

export const LEGAL_CASE_STATUS_OPTIONS = Object.keys(LEGAL_CASE_STATUS_PERMISSION_ACTION) as LegalCaseStatus[];

export function getLegalCaseStatusPermissionAction(status: string): LegalCaseWorkflowAction | undefined {
  return LEGAL_CASE_STATUS_PERMISSION_ACTION[status as LegalCaseStatus];
}
