export const MAX_ACCESS_TOKEN_BYTES = 8 * 1024;

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const encodedPayload = token.split('.')[1];
    if (!encodedPayload) return null;
    const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded));
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  }
}

export function isLegacyAuthToken(token: string): boolean {
  const payload = decodePayload(token);
  if (!payload) return true;

  // Legacy JWTs embedded the complete permission matrix and subscription
  // modules. They must never be sent as Authorization headers again.
  return Object.prototype.hasOwnProperty.call(payload, 'permissions')
    || Object.prototype.hasOwnProperty.call(payload, 'enabledModules');
}

export function isSafeAuthToken(token: string): boolean {
  return Boolean(token)
    && token.length <= MAX_ACCESS_TOKEN_BYTES
    && !isLegacyAuthToken(token);
}

export function storeAuthToken(token: string): void {
  if (!isSafeAuthToken(token)) {
    throw new Error('La sesión recibida no es válida o excede el tamaño permitido.');
  }
  localStorage.setItem('nh-auth-token', token);
}
