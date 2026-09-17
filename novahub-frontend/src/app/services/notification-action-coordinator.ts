/**
 * Coordinates operation toasts with the global notification channel.
 *
 * The coordinator is intentionally module-scoped: the operation toast and the
 * SSE listener live in different components, and both must observe the same
 * short-lived action barrier.
 */
export const NOTIFICATION_ACTION_DELAY_MS = 1_000;
export const NOTIFICATION_SEQUENCE_GAP_MS = 250;

type ActionState = {
  resolve: () => void;
  timer: ReturnType<typeof setTimeout>;
};

const activeActions = new Map<string, ActionState>();
let actionSequence = 0;

export function beginNotificationAction(): string {
  const token = `notification-action:${Date.now()}:${actionSequence += 1}`;
  let resolve!: () => void;
  const completion = new Promise<void>((done) => { resolve = done; });
  // The promise is kept in the map through the one-second presentation window.
  const timer = setTimeout(() => {
    activeActions.delete(token);
    resolve();
  }, 15_000);
  // A completed action replaces this placeholder timer with the real delay.
  activeActions.set(token, { resolve, timer });
  void completion;
  return token;
}

export function completeNotificationAction(token: string | null | undefined): void {
  if (!token) return;
  const state = activeActions.get(token);
  if (!state) return;
  clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    activeActions.delete(token);
    state.resolve();
  }, NOTIFICATION_ACTION_DELAY_MS);
}

/** Treat a failed operation exactly like a successful one for sequencing. */
export const failNotificationAction = completeNotificationAction;

function hasLoadingSonnerToast(): boolean {
  if (typeof document === 'undefined') return false;
  return Array.from(document.querySelectorAll<HTMLElement>('[data-sonner-toast]'))
    .some((element) => element.dataset.type === 'loading');
}

function hasCompletedActionSonnerToast(): boolean {
  if (typeof document === 'undefined') return false;
  return Array.from(document.querySelectorAll<HTMLElement>('[data-sonner-toast]'))
    .some((element) => element.dataset.type === 'success' || element.dataset.type === 'error');
}

/**
 * Compatibility bridge for existing views that still call Sonner directly.
 * Explicitly coordinated actions use the map above; older views are detected
 * through Sonner's stable data attribute without coupling this service to UI.
 */
function waitForLegacyLoadingToast(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  if (!hasLoadingSonnerToast()) {
    return hasCompletedActionSonnerToast()
      ? new Promise<void>((resolve) => setTimeout(resolve, NOTIFICATION_ACTION_DELAY_MS))
      : Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let settled = false;
    const resources: { observer?: MutationObserver; fallbackTimer?: ReturnType<typeof setTimeout> } = {};
    const finish = () => {
      if (settled) return;
      settled = true;
      resources.observer?.disconnect();
      if (resources.fallbackTimer) clearTimeout(resources.fallbackTimer);
      setTimeout(resolve, NOTIFICATION_ACTION_DELAY_MS);
    };

    const observer = new MutationObserver(() => {
      if (!hasLoadingSonnerToast()) finish();
    });
    resources.observer = observer;
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-type'] });
    // A broken/unmounted toast must never block global notifications forever.
    resources.fallbackTimer = setTimeout(finish, 15_000);
  });
}

/** Waits for all explicitly active operations, then for legacy loading toasts. */
export async function waitForNotificationActionBarrier(): Promise<void> {
  const active = [...activeActions.values()];
  if (active.length > 0) {
    await Promise.all(active.map((state) => new Promise<void>((resolve) => {
      const originalResolve = state.resolve;
      state.resolve = () => {
        originalResolve();
        resolve();
      };
    })));
    return;
  }
  await waitForLegacyLoadingToast();
}

export function getNotificationSequenceGapMs(): number {
  return NOTIFICATION_SEQUENCE_GAP_MS;
}
