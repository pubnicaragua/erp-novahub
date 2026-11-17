// Consecutivo de cuentas hijas: respeta el formato que ya usa la empresa (por ejemplo 1-01-04-001-003) en lugar de
// inventar uno. Funciones puras, sin acceso a pantalla ni a red.

interface DigitTail { head: string; digits: string }

/** Separa el número del final de un código: «1-01-04-001-003» → { head: «1-01-04-001-», digits: «003» }. */
function splitDigitTail(code: string): DigitTail | null {
  let start = code.length;
  while (start > 0 && code[start - 1] >= '0' && code[start - 1] <= '9') start -= 1;
  if (start === code.length) return null;
  return { head: code.slice(0, start), digits: code.slice(start) };
}

function increment(tail: DigitTail, by = 1): string {
  const next = String(Number(tail.digits) + by);
  return tail.head + next.padStart(tail.digits.length, '0');
}

function allZeros(text: string): boolean {
  return text.length > 0 && text.split('').every((char) => char === '0');
}

/**
 * Código sugerido para una cuenta nueva dentro de `parentCode`.
 * - Con hijas: el siguiente número después de la mayor, con el mismo formato y ancho.
 * - Sin hijas y padre terminado en ceros («…-001-000»): el primero es «…-001-001».
 * - Sin hijas y padre con otro final («1-01-04»): se agrega un tramo nuevo «1-01-04-001».
 * - Código sin guiones («1100»): se agrega «001» al final, como se hacía antes.
 * Si el resultado ya existe en la empresa, se salta al siguiente libre.
 */
export function nextChildAccountCode(parentCode: string, siblingCodes: string[], allCodes: Iterable<string>): string {
  const taken = new Set(Array.from(allCodes, (code) => String(code).trim()));
  const siblings = siblingCodes.map((code) => String(code).trim()).filter(Boolean);

  let candidate: string;
  let latest: DigitTail | null = null;
  for (const code of siblings) {
    const tail = splitDigitTail(code);
    if (!tail) continue;
    if (!latest || Number(tail.digits) > Number(latest.digits)) latest = tail;
  }

  if (latest) {
    candidate = increment(latest);
  } else {
    const parent = String(parentCode).trim();
    const lastDash = parent.lastIndexOf('-');
    const lastSegment = lastDash >= 0 ? parent.slice(lastDash + 1) : parent;
    if (lastDash >= 0 && allZeros(lastSegment)) {
      candidate = `${parent.slice(0, lastDash + 1)}${lastSegment.slice(0, -1)}1`;
    } else if (lastDash >= 0) {
      candidate = `${parent}-001`;
    } else {
      candidate = `${parent}001`;
    }
  }

  for (let attempts = 0; attempts < 5000 && taken.has(candidate); attempts += 1) {
    const tail = splitDigitTail(candidate);
    if (!tail) break;
    candidate = increment(tail);
  }
  return candidate;
}
