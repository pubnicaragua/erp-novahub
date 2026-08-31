/**
 * Events shared by the UI action guard and the HTTP client.
 * Keeping the event name outside either layer avoids a dependency from the
 * API service into React components.
 */
export const ERP_API_MUTATION_EVENT = 'erp-api-mutation';

export type ErpApiMutationPhase = 'start' | 'end';

export interface ErpApiMutationEventDetail {
  phase: ErpApiMutationPhase;
  method: string;
  path: string;
}

/** Notify the shell about non-API-client mutations, such as a signed upload. */
export function notifyErpMutation(
  phase: ErpApiMutationPhase,
  method: string,
  path: string,
) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ErpApiMutationEventDetail>(ERP_API_MUTATION_EVENT, {
    detail: { phase, method, path },
  }));
}
