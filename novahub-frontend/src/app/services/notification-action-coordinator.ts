/**
 * Keeps notifications caused by the current actor behind the API operation
 * that produced them. Toast lifetime never delays notification delivery.
 */

type ActionState = {
  completion: Promise<void>;
  resolve: () => void;
  timer: ReturnType<typeof setTimeout>;
  completed: boolean;
};

const activeActions = new Map<string, ActionState>();
let actionSequence = 0;

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

  resolveAction(token, state);
}

/** Treat a failed operation exactly like a successful one for sequencing. */
export const failNotificationAction = completeNotificationAction;

/** Waits only for current API mutations; displayed toast lifetimes do not gate it. */
export async function waitForNotificationActionBarrier(): Promise<void> {
  while (activeActions.size > 0) {
    const active = [...activeActions.values()];
    await Promise.all(active.map((state) => state.completion));
  }
}
