/**
 * Coordinates operation toasts with the global notification channel.
 *
 * The coordinator is intentionally module-scoped: the operation toast and the
 * SSE listener live in different components, and both must observe the same
 * short-lived action barrier.
 */
export const NOTIFICATION_ACTION_DELAY_MS = 1_000;
export const NOTIFICATION_SEQUENCE_GAP_MS = 250;
export const NOTIFICATION_ACTION_TOAST_WAIT_MS = 8_000;
const NOTIFICATION_TOAST_RENDER_GRACE_MS = 250;

type ActionState = {
  completion: Promise<void>;
  resolve: () => void;
  timer: ReturnType<typeof setTimeout>;
  completed: boolean;
};

const activeActions = new Map<string, ActionState>();
let actionSequence = 0;

const hasSonnerToast = (types: string[]): boolean => {
  if (typeof document === 'undefined') return false;
  return Array.from(document.querySelectorAll<HTMLElement>('[data-sonner-toast]'))
    .some((element) => types.includes(String(element.dataset.type || '').toLowerCase()));
};

const hasLoadingSonnerToast = () => hasSonnerToast(['loading']);
const hasCompletedActionSonnerToast = () => hasSonnerToast(['success', 'error', 'warning', 'info']);

/**
 * Sonner updates its DOM asynchronously and keeps a completed toast mounted
 * for its configured duration. This barrier observes both phases so the
 * actor's notification cannot cover the operation confirmation.
 */
function waitForSonnerToastsToSettle(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();

  return new Promise<void>((resolve) => {
    let settled = false;
    let sawActionToast = hasLoadingSonnerToast() || hasCompletedActionSonnerToast();
    const timers: {
      renderGraceTimer?: ReturnType<typeof setTimeout>;
      fallbackTimer?: ReturnType<typeof setTimeout>;
    } = {};
    const observer = new MutationObserver(() => {
      sawActionToast = sawActionToast || hasLoadingSonnerToast() || hasCompletedActionSonnerToast();
      if (!hasLoadingSonnerToast() && !hasCompletedActionSonnerToast() && sawActionToast) finish();
    });

    const finish = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      if (timers.renderGraceTimer) clearTimeout(timers.renderGraceTimer);
      if (timers.fallbackTimer) clearTimeout(timers.fallbackTimer);
      resolve();
    };

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-type', 'data-mounted'],
    });

    // Give Sonner one render cycle to mount the success/error replacement of
    // a loading toast. Actions without a toast are released after this grace.
    timers.renderGraceTimer = setTimeout(() => {
      sawActionToast = sawActionToast || hasLoadingSonnerToast() || hasCompletedActionSonnerToast();
      if (!hasLoadingSonnerToast() && !hasCompletedActionSonnerToast()) finish();
    }, NOTIFICATION_TOAST_RENDER_GRACE_MS);

    // A broken or manually persistent toast must never block notifications.
    timers.fallbackTimer = setTimeout(finish, NOTIFICATION_ACTION_TOAST_WAIT_MS);
  });
}

const resolveAction = (token: string, state: ActionState) => {
  if (state.completed) {
    activeActions.delete(token);
    state.resolve();
  }
};

export function beginNotificationAction(): string {
  const token = `notification-action:${Date.now()}:${actionSequence += 1}`;
  let resolve!: () => void;
  const completion = new Promise<void>((done) => { resolve = done; });
  const state: ActionState = {
    completion,
    resolve,
    completed: false,
    // A broken operation path must not block global notifications forever.
    timer: setTimeout(() => {
      state.completed = true;
      resolveAction(token, state);
    }, 15_000),
  };
  activeActions.set(token, state);
  return token;
}

export function completeNotificationAction(token: string | null | undefined): void {
  if (!token) return;
  const state = activeActions.get(token);
  if (!state) return;
  if (state.completed) return;
  state.completed = true;
  clearTimeout(state.timer);

  // Wait for the operation's success/error toast to leave the DOM, then keep
  // the existing short gap between consecutive notifications.
  void waitForSonnerToastsToSettle().then(() => {
    if (!activeActions.has(token)) return;
    state.timer = setTimeout(() => resolveAction(token, state), NOTIFICATION_ACTION_DELAY_MS);
  });
}

/** Treat a failed operation exactly like a successful one for sequencing. */
export const failNotificationAction = completeNotificationAction;

/** Waits for all explicitly active operations, then for legacy loading toasts. */
export async function waitForNotificationActionBarrier(): Promise<void> {
  while (activeActions.size > 0) {
    const active = [...activeActions.values()];
    await Promise.all(active.map((state) => state.completion));
  }
  await waitForSonnerToastsToSettle();
  await new Promise<void>((resolve) => setTimeout(resolve, NOTIFICATION_ACTION_DELAY_MS));
}

export function getNotificationSequenceGapMs(): number {
  return NOTIFICATION_SEQUENCE_GAP_MS;
}
