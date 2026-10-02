import type { SlaStatus } from '../../types';

/** Dos horas: umbral entre "en tiempo" y "por vencer" (§5 del contrato). */
const TWO_HOURS_MS = 2 * 3_600_000;

export interface SlaEvaluation {
  status: SlaStatus;
  dueAt: string | null;
  remainingMs: number | null;
  remainingHours: number | null;
  label: string;
}

export interface EvaluateActivitySlaInput {
  slaDueAt?: string | null;
  status?: string | null;
}

const LABELS: Record<SlaStatus, string> = {
  NONE: '',
  ON_TIME: 'En tiempo',
  AT_RISK: 'Por vencer',
  BREACHED: 'Vencida',
};

/**
 * Semáforo SLA. Réplica exacta de `evaluateActivitySla` en
 * `BackendERPNH/src/activities/activities.service.ts` (§5).
 *
 *   COMPLETED | CANCELLED  -> NONE
 *   sin slaDueAt            -> NONE
 *   restante <= 0           -> BREACHED  (ROJO)
 *   restante <= 2h          -> AT_RISK   (AMARILLO)
 *   resto                   -> ON_TIME   (VERDE)
 *
 * `now` es inyectable para poder testear los límites sin esperar al reloj real.
 */
export function evaluateActivitySla(
  input: EvaluateActivitySlaInput,
  now: number | Date = Date.now(),
): SlaEvaluation {
  const status = String(input?.status ?? '').toUpperCase();

  const empty: SlaEvaluation = {
    status: 'NONE',
    dueAt: input?.slaDueAt ?? null,
    remainingMs: null,
    remainingHours: null,
    label: LABELS.NONE,
  };

  if (status === 'COMPLETED' || status === 'CANCELLED') return empty;
  if (!input?.slaDueAt) return empty;

  const dueMs = Date.parse(input.slaDueAt);
  if (Number.isNaN(dueMs)) return empty;

  const nowMs = now instanceof Date ? now.getTime() : now;
  const remainingMs = dueMs - nowMs;

  const resolved: SlaStatus = remainingMs <= 0
    ? 'BREACHED'
    : remainingMs <= TWO_HOURS_MS
      ? 'AT_RISK'
      : 'ON_TIME';

  return {
    status: resolved,
    dueAt: new Date(dueMs).toISOString(),
    remainingMs,
    remainingHours: remainingMs / 3_600_000,
    label: LABELS[resolved],
  };
}

/**
 * Porcentaje de consumo del SLA, solo informativo: NO decide el color.
 *
 * `null` significa "no hay ventana medible": la UI no debe pintar porcentaje ni
 * barra. Se distingue de `0` a propósito, porque `0` se lee como "0% consumido"
 * y eso contradice a un semáforo en rojo. Ocurren cuando falta `createdAt` o
 * `slaDueAt`, cuando las fechas no parsean, y cuando el plazo es anterior o
 * igual a la creación. Este último caso no es exótico: el modal de creación
 * deja el vencimiento "ahora" si el usuario no lo fija.
 */
export function computeActivitySlaConsumedRatio(
  input: { createdAt?: string | null; slaDueAt?: string | null },
  now: number | Date = Date.now(),
): number | null {
  if (!input?.createdAt || !input?.slaDueAt) return null;

  const startMs = Date.parse(input.createdAt);
  const dueMs = Date.parse(input.slaDueAt);
  if (Number.isNaN(startMs) || Number.isNaN(dueMs)) return null;

  const nowMs = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(nowMs)) return null;

  // Plazo agotado: la ventana está consumida por completo. Se evalúa antes que
  // el guard de ventana para que una tarea vencida nunca reporte 0%.
  if (dueMs <= nowMs) return 1;

  // Sin ventana medible y sin breach: no hay porcentaje que mostrar.
  if (dueMs <= startMs) return null;

  const ratio = (nowMs - startMs) / (dueMs - startMs);
  if (!Number.isFinite(ratio)) return null;

  return Math.min(1, Math.max(0, ratio));
}