export interface VoiceSaleCatalogProduct {
  id: string;
  name: string;
  isActive?: boolean;
  variants?: Array<{ id: string; name: string; isActive?: boolean }>;
}

export interface VoiceSaleLine<TProduct extends VoiceSaleCatalogProduct = VoiceSaleCatalogProduct> {
  product: TProduct;
  quantity: number;
  phrase: string;
  variantName?: string;
}

export interface VoiceSaleParseResult<TProduct extends VoiceSaleCatalogProduct = VoiceSaleCatalogProduct> {
  lines: VoiceSaleLine<TProduct>[];
  unmatchedText: string;
  metadata: VoiceSaleMetadata;
}

export interface VoiceSaleMetadata {
  customerText: string;
  total: number | null;
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT' | null;
  notes: string;
  unmatchedText: string;
}

const NUMBER_WORDS: Record<string, number> = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  cien: 100,
};

const STOP_WORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'uno', 'por', 'favor', 'también', 'tambien']);

function normalize(value: string) {
  return value
    .toLocaleLowerCase('es-NI')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseQuantity(prefix: string) {
  const tokens = normalize(prefix).split(' ').filter(Boolean);
  const candidateTokens = tokens.slice(-6);

  // Busca hacia atrás el último número real, permitiendo frases como
  // "30 platos de asado" o "dos órdenes de tira de res".
  for (let index = candidateTokens.length - 1; index >= 0; index -= 1) {
    const candidate = candidateTokens[index];
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 0) return Math.min(999, Math.floor(numeric));

    const written = NUMBER_WORDS[candidate];
    if (written && written > 0) return written;
  }

  return 1;
}

function buildNameVariants(value: string) {
  const normalized = normalize(value);
  const variants = new Set([normalized]);
  const tokens = normalized.split(' ');
  const firstLexicalIndex = tokens.findIndex((token) => !STOP_WORDS.has(token));

  // Tolera la forma plural más común del primer término: "tira de res" /
  // "tiras de res", "asado" / "asados", "gaseosa" / "gaseosas".
  if (firstLexicalIndex >= 0 && tokens[firstLexicalIndex].length >= 4) {
    const pluralTokens = [...tokens];
    const token = pluralTokens[firstLexicalIndex];
    pluralTokens[firstLexicalIndex] = token.endsWith('s') ? token.slice(0, -1) : `${token}s`;
    variants.add(pluralTokens.join(' '));
  }

  return [...variants].filter(Boolean);
}

function isWordBoundary(value: string, start: number, end: number) {
  const before = value[start - 1];
  const after = value[end];
  return (!before || before === ' ') && (!after || after === ' ');
}

function parseMoney(value: string) {
  const compact = value.replace(/\s/g, '');
  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');
  const normalized = lastComma >= 0 && lastDot >= 0
    ? lastComma > lastDot ? compact.replace(/\./g, '').replace(',', '.') : compact.replace(/,/g, '')
    : lastComma >= 0
      ? (compact.length - lastComma - 1 === 3 ? compact.replace(/,/g, '') : compact.replace(',', '.'))
      : compact;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseVoiceSaleMetadata(transcript: string): VoiceSaleMetadata {
  const metadataText = transcript
    .toLocaleLowerCase('es-NI')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9$.,;:\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const customerMatch = metadataText.match(/(?:cliente|para|a nombre de)\s+([^,.;]+?)(?=\s+(?:total|monto|paga|pago|forma de pago|nota|observacion)\b|[,.;]|$)/);
  const totalMatch = metadataText.match(/(?:total|por un total de|monto)\s*(?:de\s*)?(?:c\$|\$|cordobas?|dolares?)?\s*([0-9][0-9.,]*)/);
  const paymentMatch = metadataText.match(/(?:paga(?:r)?|pago|forma de pago|con)\s+(efectivo|tarjeta|transferencia|credito)/);
  const paymentValue = paymentMatch?.[1] || '';
  const paymentMethod = paymentValue === 'efectivo'
    ? 'CASH'
    : paymentValue === 'tarjeta'
      ? 'CARD'
      : paymentValue === 'transferencia'
        ? 'TRANSFER'
        : paymentValue === 'credito' || paymentValue === 'crédito' ? 'CREDIT' : null;
  const notesMatch = metadataText.match(/(?:nota|observacion)\s+(.+)$/);
  return {
    customerText: customerMatch?.[1]?.trim() || '',
    total: totalMatch ? parseMoney(totalMatch[1]) : null,
    paymentMethod,
    notes: notesMatch?.[1]?.trim() || '',
    unmatchedText: '',
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeMetadataFromUnmatchedText(value: string, metadata: VoiceSaleMetadata) {
  let result = value;
  if (metadata.customerText) {
    const customer = escapeRegExp(normalize(metadata.customerText));
    result = result.replace(new RegExp(`(?:cliente|para|a nombre de)\\s+${customer}`, 'g'), ' ');
  }
  if (metadata.total !== null) {
    result = result.replace(/(?:por un total de|total|monto)\s*(?:de\s*)?(?:c\$|c|\$|cordobas?|dolares?)?\s*[0-9][0-9.,]*/g, ' ');
  }
  if (metadata.paymentMethod) {
    result = result.replace(/(?:paga(?:r)?|pago|forma de pago|con)\s+(?:efectivo|tarjeta|transferencia|credito)/g, ' ');
    result = result.replace(/\bpago\b/g, ' ');
  }
  if (metadata.notes) {
    result = result.replace(/(?:nota|observacion)\s+.+$/g, ' ');
  }
  return result;
}

export function parseSpanishSalesDictation<TProduct extends VoiceSaleCatalogProduct>(transcript: string, products: TProduct[]): VoiceSaleParseResult<TProduct> {
  const normalizedTranscript = normalize(transcript);
  if (!normalizedTranscript) return { lines: [], unmatchedText: '', metadata: { customerText: '', total: null, paymentMethod: null, notes: '', unmatchedText: '' } };
  const metadata = parseVoiceSaleMetadata(transcript);

  const candidates = products
    .filter((product) => product.isActive !== false)
    .flatMap((product) => [
      { product, name: product.name, variantName: undefined },
      ...(product.variants || []).map((variant) => ({ product, name: variant.name, variantName: variant.name })),
    ])
    .flatMap((candidate) => buildNameVariants(candidate.name || '').map((normalizedName) => ({ ...candidate, normalizedName })))
    .filter((candidate) => candidate.normalizedName.length >= 2)
    .sort((left, right) => right.normalizedName.length - left.normalizedName.length);

  const matches: Array<{ start: number; end: number; candidate: (typeof candidates)[number] }> = [];
  candidates.forEach((candidate) => {
    let cursor = 0;
    while (cursor < normalizedTranscript.length) {
      const start = normalizedTranscript.indexOf(candidate.normalizedName, cursor);
      if (start < 0) break;
      const end = start + candidate.normalizedName.length;
      if (isWordBoundary(normalizedTranscript, start, end)) {
        matches.push({ start, end, candidate });
      }
      cursor = end;
    }
  });

  const selectedMatches = matches
    .sort((left, right) => left.start - right.start || (right.end - right.start) - (left.end - left.start))
    .filter((match, index, all) => !all.slice(0, index).some((previous) => match.start < previous.end));

  const merged = new Map<string, VoiceSaleLine>();
  selectedMatches.forEach((match, index) => {
    const previousEnd = index === 0 ? 0 : selectedMatches[index - 1].end;
    const prefix = normalizedTranscript.slice(previousEnd, match.start);
    const quantity = parseQuantity(prefix);
    const key = `${match.candidate.product.id}:${match.candidate.variantName || ''}`;
    const current = merged.get(key);
    merged.set(key, {
      product: match.candidate.product,
      quantity: Math.min(999, (current?.quantity || 0) + quantity),
      phrase: match.candidate.name,
      variantName: match.candidate.variantName,
    });
  });

  const covered = selectedMatches.map((match) => normalizedTranscript.slice(match.start, match.end));
  let unmatchedText = removeMetadataFromUnmatchedText(normalizedTranscript, metadata);
  covered.forEach((fragment) => { unmatchedText = unmatchedText.replace(fragment, ' '); });
  unmatchedText = unmatchedText
    .replace(/\b(?:quiero|factura|facturar|vende|vendi|venta|ventas|agrega|agregar|por favor|tambien|también|y|de|del|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta|cuarenta|cincuenta|cien|\d+|plato|platos|orden|ordenes|unidad|unidades|pieza|piezas|tira|tiras)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { lines: [...merged.values()], unmatchedText, metadata: { ...metadata, unmatchedText } };
}
