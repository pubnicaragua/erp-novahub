type QueueTask<T> = {
  run: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
};

// Mantiene margen para el pool de Postgres (10 conexiones por instancia) pero
// evita que los reportes de Finanzas/Compras, que consultan varios listados,
// queden esperando en demasiadas tandas consecutivas.
const MAX_CONCURRENT_REPORT_REQUESTS = 6;
let activeRequests = 0;
const pendingRequests: Array<QueueTask<unknown>> = [];

function drainReportRequestQueue() {
  while (activeRequests < MAX_CONCURRENT_REPORT_REQUESTS && pendingRequests.length > 0) {
    const task = pendingRequests.shift();
    if (!task) return;
    if (task.signal?.aborted) {
      task.reject(task.signal.reason || createAbortError());
      continue;
    }
    if (task.onAbort && task.signal) task.signal.removeEventListener('abort', task.onAbort);
    activeRequests += 1;
    void task.run()
      .then(task.resolve)
      .catch(task.reject)
      .finally(() => {
        activeRequests -= 1;
        drainReportRequestQueue();
      });
  }
}

/** Limita la presión simultánea que los reportes ejercen sobre la API y Prisma. */
export function runWithReportRequestLimit<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) return Promise.reject(signal.reason || createAbortError());
  return new Promise<T>((resolve, reject) => {
    const task: QueueTask<unknown> = {
      run,
      resolve: resolve as (value: unknown | PromiseLike<unknown>) => void,
      reject,
      signal,
    };
    if (signal) {
      task.onAbort = () => {
        const index = pendingRequests.indexOf(task);
        if (index < 0) return;
        pendingRequests.splice(index, 1);
        reject(signal.reason || createAbortError());
      };
      signal.addEventListener('abort', task.onAbort, { once: true });
    }
    pendingRequests.push(task);
    drainReportRequestQueue();
  });
}

function createAbortError(): Error {
  const error = new Error('La solicitud del reporte fue cancelada');
  error.name = 'AbortError';
  return error;
}
