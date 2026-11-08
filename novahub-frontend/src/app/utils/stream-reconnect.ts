/**
 * Espera antes de reconectar el SSE: 1 s, 2 s, 4 s… hasta 30 s, con una variación de -50 % a +50 %. Sin ella, tras cada
 * despliegue o reinicio del servidor todos los clientes reconectaban en el mismo instante (cada uno con su consulta de
 * sesión y su recarga de recuperación).
 */
export function streamReconnectDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(30_000, 1_000 * (2 ** Math.max(0, attempt)));
  return Math.round(base * (0.5 + random()));
}
