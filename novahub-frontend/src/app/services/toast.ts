import { createElement, isValidElement, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';
import type { ExternalToast } from 'sonner';

export const TOAST_DURATION_MS = {
  success: 3_000,
  info: 3_000,
  warning: 5_000,
  error: 5_000,
  message: 3_000,
} as const;

type ToastCallable = (...args: any[]) => any;

function withDuration<T extends ToastCallable>(method: T, duration: number): T {
  return ((...args: Parameters<T>) => {
    const [message, options] = args;
    return method(message, { ...(options as ExternalToast | undefined), duration });
  }) as T;
}

type PromiseOptions<T> = NonNullable<Parameters<typeof sonnerToast.promise<T>>[1]>;
type PromiseResult<T> = ReturnType<typeof sonnerToast.promise<T>>;

async function resolvePromiseToastValue(
  value: unknown,
  input: unknown,
  description: unknown,
  duration: number,
): Promise<{ message: ReactNode; options: ExternalToast }> {
  const resolvedValue = typeof value === 'function'
    ? await (value as (result: unknown) => unknown)(input)
    : value;
  const resolvedDescription = typeof description === 'function'
    ? await (description as (result: unknown) => unknown)(input)
    : description;
  const extendedResult = resolvedValue !== null
    && typeof resolvedValue === 'object'
    && !isValidElement(resolvedValue);
  const result = extendedResult
    ? resolvedValue as { message?: ReactNode } & ExternalToast
    : { message: resolvedValue as ReactNode };

  return {
    message: result.message ?? '',
    options: {
      ...(extendedResult ? result : {}),
      description: resolvedDescription as string | undefined,
      duration,
    },
  };
}

/**
 * Loading notifications use a neutral message with a spinner so the shared
 * close button stays available. Infinity keeps them visible until replaced,
 * resolved, or dismissed by the user.
 */
function loading(message: ReactNode, options?: ExternalToast): string | number {
  return sonnerToast.message(message, {
    ...options,
    duration: Number.POSITIVE_INFINITY,
    icon: options?.icon ?? createElement(LoaderCircle, { className: 'size-4 animate-spin' }),
  });
}

const promise = <T,>(
  value: Parameters<typeof sonnerToast.promise<T>>[0],
  options?: PromiseOptions<T>,
): PromiseResult<T> => {
  if (!options) return sonnerToast.promise(value, options);

  let id: string | number | undefined;
  let shouldDismiss = true;
  if (options.loading !== undefined) {
    const loadingToastOptions = Object.fromEntries(
      Object.entries(options).filter(([key]) => !['loading', 'success', 'error', 'description', 'finally'].includes(key)),
    ) as ExternalToast;
    id = loading(options.loading, { ...loadingToastOptions, duration: Number.POSITIVE_INFINITY });
  }

  let outcome: ['resolve' | 'reject', unknown] | undefined;
  const work = Promise.resolve(typeof value === 'function' ? value() : value);
  const originalPromise = work.then(async (response) => {
    outcome = ['resolve', response];
    const failedResponse = response instanceof Error
      ? response
      : response && typeof response === 'object'
        && 'ok' in response && 'status' in response
        && (response as { ok?: unknown; status?: unknown }).ok === false
          ? new Error(`HTTP error! status: ${(response as { status?: unknown }).status}`)
          : null;

    if (failedResponse && options.error !== undefined) {
      shouldDismiss = false;
      const result = await resolvePromiseToastValue(
        options.error,
        failedResponse,
        options.description,
        TOAST_DURATION_MS.error,
      );
      sonnerToast.error(result.message, { ...result.options, ...(id !== undefined ? { id } : {}) });
    } else if (!failedResponse && options.success !== undefined) {
      shouldDismiss = false;
      const result = await resolvePromiseToastValue(
        options.success,
        response,
        options.description,
        TOAST_DURATION_MS.success,
      );
      sonnerToast.success(result.message, { ...result.options, ...(id !== undefined ? { id } : {}) });
    }
  }).catch(async (error: unknown) => {
    outcome = ['reject', error];
    if (options.error !== undefined) {
      shouldDismiss = false;
      const result = await resolvePromiseToastValue(
        options.error,
        error,
        options.description,
        TOAST_DURATION_MS.error,
      );
      sonnerToast.error(result.message, { ...result.options, ...(id !== undefined ? { id } : {}) });
    }
  }).finally(async () => {
    if (shouldDismiss && id !== undefined) sonnerToast.dismiss(id);
    await options.finally?.();
  });

  const unwrap = () => new Promise<T>((resolve, reject) => {
    originalPromise.then(() => {
      if (outcome?.[0] === 'reject') reject(outcome[1]);
      else resolve(outcome?.[1] as T);
    }).catch(reject);
  });

  return (id === undefined ? { unwrap } : Object.assign(id, { unwrap })) as PromiseResult<T>;
};

/** Shared Sonner facade: all completed toasts follow one duration policy. */
export const toast = Object.assign(withDuration(sonnerToast, TOAST_DURATION_MS.message), {
  success: withDuration(sonnerToast.success, TOAST_DURATION_MS.success),
  info: withDuration(sonnerToast.info, TOAST_DURATION_MS.info),
  warning: withDuration(sonnerToast.warning, TOAST_DURATION_MS.warning),
  error: withDuration(sonnerToast.error, TOAST_DURATION_MS.error),
  message: withDuration(sonnerToast.message, TOAST_DURATION_MS.message),
  custom: withDuration(sonnerToast.custom, TOAST_DURATION_MS.message),
  loading,
  promise,
  dismiss: sonnerToast.dismiss,
  getHistory: sonnerToast.getHistory,
  getToasts: sonnerToast.getToasts,
}) as typeof sonnerToast;
