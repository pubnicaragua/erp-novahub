export const GUIDED_TOUR_REQUEST_EVENT = 'erp-guided-tour-request';
export const GUIDED_TOUR_STARTED_EVENT = 'erp-guided-tour-started';

export interface GuidedTourRequestResult {
  started: boolean;
  label?: string;
}

type GuidedTourRequestDetail = {
  respond?: (result: GuidedTourRequestResult) => void;
};

/**
 * Requests the guide button that belongs to the currently visible view.
 * The application shell owns the DOM lookup so Nova AI does not need to know
 * which page is active or duplicate every page's existing tour definition.
 */
export function requestGuidedTour(): GuidedTourRequestResult {
  if (typeof window === 'undefined') return { started: false };

  let result: GuidedTourRequestResult = { started: false };
  window.dispatchEvent(new CustomEvent<GuidedTourRequestDetail>(GUIDED_TOUR_REQUEST_EVENT, {
    detail: { respond: (next) => { result = next; } },
  }));
  return result;
}
