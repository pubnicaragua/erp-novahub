export interface VoiceSaleCatalogProduct {
  id: string;
  name: string;
  code?: string;
  aliases?: string[];
  isActive?: boolean;
  variants?: Array<{ id: string; name: string; isActive?: boolean; aliases?: string[] }>;
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
  suggestions: VoiceSaleSuggestion<TProduct>[];
  metadata: VoiceSaleMetadata;
}

export interface VoiceSaleSuggestion<TProduct extends VoiceSaleCatalogProduct = VoiceSaleCatalogProduct> {
  product: TProduct;
  matchedText: string;
  score: number;
}

export interface VoiceSaleMetadata {
  customerText: string;
  total: number | null;
  unitPrice: number | null;
  unitPriceCurrency: 'NIO' | 'USD' | null;
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
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  cien: 100,
};
const DIGIT_WORDS: Record<string, string> = Object.fromEntries(
  Object.entries(NUMBER_WORDS).map(([word, value]) => [String(value), word]),
);

const STOP_WORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'uno', 'por', 'favor', 'también', 'tambien', 'y', 'con', 'para', 'a']);
const PRODUCT_NUMBER_PREFIXES = new Set(['iphone', 'galaxy', 'pixel', 'modelo', 'serie', 'version', 'versión', 'talla', 'sku']);

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
    if (PRODUCT_NUMBER_PREFIXES.has(candidateTokens[index - 1] || '')) continue;
    const numeric = Number(candidate);
    // Los precios dictados suelen quedar en el prefijo de una coincidencia
    // posterior ("dos iPhone 15 a 8000 córdobas ..."). Nunca deben
    // convertirse en una cantidad. La venta rápida limita cada línea a 999
    // unidades, por lo que un número mayor es mucho más probablemente un
    // precio que una cantidad válida.
    if (Number.isFinite(numeric) && numeric > 0) {
      if (numeric > 999) continue;
      return Math.floor(numeric);
    }

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

  // Permite dictar el nombre comercial sin la marca o prefijo del catálogo:
  // “iPhone 15” también encuentra “Apple iPhone 15”.
  if (tokens.length >= 3) variants.add(tokens.slice(1).join(' '));

  // El reconocimiento suele devolver “quince” aunque el catálogo tenga “15”
  // (o al revés). Conservamos ambas formas para no depender de IA.
  const spokenNumberTokens = tokens.map((token) => DIGIT_WORDS[token] || token);
  if (spokenNumberTokens.join(' ') !== normalized) variants.add(spokenNumberTokens.join(' '));
  if (spokenNumberTokens.length >= 3) variants.add(spokenNumberTokens.slice(1).join(' '));

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
  const unitPriceMatch = metadataText.match(/\b(?:a|cada|precio(?:\s+unitario)?|valor)\s+(?:(c\$|\$|cordobas?|dolares?)\s*)?([0-9][0-9.,]*)\s*(cordobas?|dolares?)?\b/);
  const unitPriceCurrencyToken = String(unitPriceMatch?.[1] || unitPriceMatch?.[3] || '').toLowerCase();
  const unitPriceCurrency = unitPriceCurrencyToken.includes('dolar') || unitPriceCurrencyToken === '$'
    ? 'USD'
    : unitPriceCurrencyToken
      ? 'NIO'
      : null;
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
    unitPrice: unitPriceMatch ? parseMoney(unitPriceMatch[2]) : null,
    unitPriceCurrency,
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
  if (metadata.unitPrice !== null) {
    result = result.replace(/\b(?:a|cada|precio(?:\s+unitario)?|valor)\s+(?:(?:c\$|\$|cordobas?|dolares?)\s*)?[0-9][0-9.,]*\s*(?:cordobas?|dolares?)?\b/g, ' ');
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

function buildUnmatchedSuggestions<TProduct extends VoiceSaleCatalogProduct>(unmatchedText: string, products: TProduct[]): VoiceSaleSuggestion<TProduct>[] {
  const queryTokens = new Set(
    normalize(unmatchedText)
      .split(' ')
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token) && !/^\d+$/.test(token)),
  );
  if (!queryTokens.size) return [];

  return products
    .filter((product) => product.isActive !== false)
    .map((product) => {
      const names = [product.name, ...(product.aliases || [])]
        .flatMap((name) => buildNameVariants(name || ''))
        .map((name) => new Set(normalize(name).split(' ').filter((token) => token.length >= 3 && !STOP_WORDS.has(token) && !/^\d+$/.test(token))))
        .filter((tokens) => tokens.size > 0);
      const best = names.reduce<{ overlap: number; score: number }>((current, tokens) => {
        const overlap = [...queryTokens].filter((token) => tokens.has(token)).length;
        const score = overlap / Math.max(tokens.size, queryTokens.size);
        return score > current.score ? { overlap, score } : current;
      }, { overlap: 0, score: 0 });
      return { product, matchedText: product.name, score: best.score, overlap: best.overlap };
    })
    .filter((candidate) => candidate.overlap > 0 && (candidate.score >= 0.45 || candidate.overlap >= 2))
    .sort((left, right) => right.score - left.score || right.overlap - left.overlap || left.product.name.localeCompare(right.product.name, 'es'))
    .slice(0, 6)
    .map(({ product, matchedText, score }) => ({ product, matchedText, score }));
}

export function parseSpanishSalesDictation<TProduct extends VoiceSaleCatalogProduct>(transcript: string, products: TProduct[]): VoiceSaleParseResult<TProduct> {
  const normalizedTranscript = normalize(transcript);
  if (!normalizedTranscript) return { lines: [], unmatchedText: '', suggestions: [], metadata: { customerText: '', total: null, unitPrice: null, unitPriceCurrency: null, paymentMethod: null, notes: '', unmatchedText: '' } };
  const metadata = parseVoiceSaleMetadata(transcript);

  const candidates = products
    .filter((product) => product.isActive !== false)
    .flatMap((product) => [
      { product, name: product.name, variantName: undefined },
      ...(product.aliases || []).map((alias) => ({ product, name: alias, variantName: undefined })),
      ...(product.variants || []).flatMap((variant) => [
        { product, name: variant.name, variantName: variant.name },
        ...(variant.aliases || []).map((alias) => ({ product, name: alias, variantName: variant.name })),
      ]),
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
      // SpeechRecognition puede repetir una misma frase cuando concatena
      // resultados finales. Para no facturar duplicado por ruido, conserva
      // la mayor cantidad detectada para el mismo producto/variante.
      quantity: Math.min(999, Math.max(current?.quantity || 0, quantity)),
      phrase: match.candidate.name,
      variantName: match.candidate.variantName,
    });
  });

  const covered = selectedMatches.map((match) => normalizedTranscript.slice(match.start, match.end));
  let unmatchedText = removeMetadataFromUnmatchedText(normalizedTranscript, metadata);
  covered.forEach((fragment) => { unmatchedText = unmatchedText.replace(fragment, ' '); });
  unmatchedText = unmatchedText
    .replace(/\b(?:quiero|vender|factura|facturar|vende|vendi|venta|ventas|agrega|agregar|por favor|tambien|también|y|de|del|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veintiuno|veintidos|veintitres|veinticuatro|veinticinco|veintiseis|veintisiete|veintiocho|veintinueve|treinta|cuarenta|cincuenta|cien|\d+|plato|platos|orden|ordenes|unidad|unidades|pieza|piezas|tira|tiras)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { lines: [...merged.values()], unmatchedText, suggestions: buildUnmatchedSuggestions(unmatchedText, products), metadata: { ...metadata, unmatchedText } };
}
