export interface VoiceExpenseDraft {
  description: string;
  amount: number | null;
  paymentSource: 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK' | null;
  paidTo: string;
  category: 'OPERATIVO' | 'ADMINISTRATIVO' | 'VENTAS' | 'FINANCIERO' | 'OTRO';
  categoryCustom: string;
  unmatchedText: string;
}

const NUMBER_WORDS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, treinta: 30, cuarenta: 40,
  cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300,
  cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700,
  ochocientos: 800, novecientos: 900, mil: 1000,
};

function normalize(value: string) {
  return value.toLocaleLowerCase('es-NI').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9$.,\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseNumberWords(value: string) {
  const tokens = normalize(value).split(' ').filter(Boolean);
  if (!tokens.length) return null;
  let total = 0;
  let current = 0;
  let found = false;
  for (const token of tokens) {
    const number = NUMBER_WORDS[token];
    if (number === undefined) continue;
    found = true;
    if (number === 1000) {
      total += (current || 1) * 1000;
      current = 0;
    } else {
      current += number;
    }
  }
  return found ? total + current : null;
}

function parseMoney(value: string) {
  const compact = value.replace(/\s/g, '');
  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');
  const normalized = lastComma >= 0 && lastDot >= 0
    ? lastComma > lastDot ? compact.replace(/\./g, '').replace(',', '.') : compact.replace(/,/g, '')
    : lastComma >= 0 ? (compact.length - lastComma - 1 === 3 ? compact.replace(/,/g, '') : compact.replace(',', '.')) : compact;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseAmount(text: string) {
  const normalized = normalize(text);
  const numeric = normalized.match(/(?:total|monto|por|de|pague|c\$|\$)?\s*([0-9][0-9.,]*)\s*(?:cordobas?|dolares?)?/);
  if (numeric) {
    const parsed = parseMoney(numeric[1]);
    if (parsed !== null) return parsed;
  }
  const words = normalized.match(/(?:total|monto|por|pague)\s+([a-z\s]+?)(?=\s+(?:cordobas?|dolares?|de|a|para|en|con)\b|$)/);
  return words ? parseNumberWords(words[1]) : null;
}

function clean(value: string) {
  return value.replace(/\s+/g, ' ').replace(/^[,.;:\s]+|[,.;:\s]+$/g, '').trim();
}

export function parseSpanishExpenseDictation(transcript: string): VoiceExpenseDraft {
  const normalized = normalize(transcript);
  const amount = parseAmount(transcript);
  const paymentMatch = normalized.match(/(?:en|con|pago|forma de pago)\s+(efectivo|tarjeta|transferencia|cheque)/);
  const paymentValue = paymentMatch?.[1] || '';
  const paymentSource = paymentValue === 'efectivo' ? 'CASH' : paymentValue === 'tarjeta' ? 'CARD' : paymentValue === 'transferencia' ? 'TRANSFER' : paymentValue === 'cheque' ? 'CHECK' : null;
  const paidToMatch = normalized.match(/(?:a|para)\s+([a-z0-9 ]+?)(?=\s+(?:en|con|por|monto|total|de)\b|$)/);
  const paidTo = clean(paidToMatch?.[1] || '');

  let category: VoiceExpenseDraft['category'] = 'OPERATIVO';
  let categoryCustom = '';
  if (/salario|nomina|personal|empleado/.test(normalized)) category = 'ADMINISTRATIVO';
  else if (/publicidad|facebook|marketing|anuncio|venta/.test(normalized)) category = 'VENTAS';
  else if (/interes|comision bancaria|banco|prestamo/.test(normalized)) category = 'FINANCIERO';
  else if (/otro|varios/.test(normalized)) { category = 'OTRO'; categoryCustom = 'Otro gasto'; }

  let description = normalized
    .replace(/(?:registre|registrar|anote|apunte|pague|un gasto|gasto|de gasto)/g, ' ')
    .replace(/(?:total|monto|por)\s*(?:de)?\s*(?:c\$|\$)?\s*[0-9][0-9.,]*/g, ' ')
    .replace(/(?:total|monto|por)\s*(?:de)?\s+(?:[a-z]+\s*){1,4}(?:cordobas?|dolares?)/g, ' ')
    .replace(/(?:en|con|pago|forma de pago)\s+(?:efectivo|tarjeta|transferencia|cheque)/g, ' ')
    .replace(/(?:a|para)\s+[a-z0-9 ]+?(?=\s+(?:en|con|por|monto|total|de)\b|$)/g, ' ')
    .replace(/\b(?:cordobas?|dolares?|c\$|\$|y|de|del|la|el|los|las|un|una|por|favor)\b/g, ' ');
  description = clean(description);
  const unmatchedText = amount === null || !description ? clean(normalized) : '';
  return { description, amount, paymentSource, paidTo, category, categoryCustom, unmatchedText };
}
