import type { ErpGuide, GuideMatch } from './types';

/** Minúsculas, sin tildes ni signos: «¿Cómo FACTURO?» → «como facturo». */
export function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/ +/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  'como', 'hago', 'hacer', 'puedo', 'para', 'que', 'donde', 'esta', 'este', 'esto', 'una', 'uno', 'unos', 'unas',
  'los', 'las', 'del', 'con', 'por', 'mis', 'mi', 'tu', 'sus', 'su', 'en', 'el', 'la', 'lo', 'le', 'de', 'un', 'y', 'o',
  'a', 'al', 'se', 'me', 'es', 'son', 'quiero', 'necesito', 'ayuda', 'ayudame', 'explicame', 'dime', 'paso', 'pasos',
  'guia', 'guiame', 'sistema', 'erp', 'nova', 'favor', 'porfa', 'hay', 'tengo', 'debo', 'cual', 'cuales', 'veo', 'ver',
  'nuevo', 'nueva', 'manejo', 'manejar', 'uso', 'usar', 'hola', 'buenas', 'buenos', 'dias', 'tardes', 'cosa', 'algo',
]);

/** Formas en primera persona que la gente usa al preguntar → infinitivo del catálogo. */
const VERBS: Record<string, string> = {
  abro: 'abrir', cierro: 'cerrar', creo: 'crear', registro: 'registrar', pago: 'pagar', cobro: 'cobrar', agrego: 'agregar',
  cambio: 'cambiar', paso: 'pasar', importo: 'importar', facturo: 'facturar', asigno: 'asignar', recibo: 'recibir',
  doy: 'dar', manejo: 'manejar', anoto: 'anotar', subo: 'subir', cargo: 'cargar', presto: 'prestar', ajusto: 'ajustar',
  cuento: 'contar', programo: 'programar', calculo: 'calcular', cotizo: 'cotizar', vendo: 'vender', compro: 'comprar',
  configuro: 'configurar', imprimo: 'imprimir', devuelvo: 'devolver', agendo: 'agendar', evaluo: 'evaluar', concilio: 'conciliar',
};

/** Raíz corta para que «facturar» y «facturas» coincidan. */
function stem(word: string): string {
  const verb = VERBS[word] || word;
  return verb.length > 5 ? verb.slice(0, 5) : verb;
}

function tokens(value: string): string[] {
  return normalizeText(value).split(' ').filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

interface GuideIndex { stems: Map<string, Set<string>>; idf: Map<string, number> }
const indexCache = new WeakMap<ErpGuide[], GuideIndex>();

/** Palabras raras en el catálogo (vacaciones, préstamo) pesan más que las comunes (empleado, cliente). */
function buildIndex(guides: ErpGuide[]): GuideIndex {
  const cached = indexCache.get(guides);
  if (cached) return cached;
  const stems = new Map<string, Set<string>>();
  const df = new Map<string, number>();
  for (const guide of guides) {
    const set = new Set(tokens(`${guide.title} ${guide.keywords.join(' ')}`).map(stem));
    stems.set(guide.id, set);
    set.forEach((value) => df.set(value, (df.get(value) || 0) + 1));
  }
  const idf = new Map<string, number>();
  df.forEach((count, value) => idf.set(value, 1 + Math.log(guides.length / count)));
  const index = { stems, idf };
  indexCache.set(guides, index);
  return index;
}

/**
 * Ordena las guías por parecido con la pregunta. Una frase clave completa vale más que
 * palabras sueltas, y las palabras poco comunes en el catálogo valen más.
 */
export function matchGuides(question: string, guides: ErpGuide[], limit = 3): GuideMatch[] {
  const text = ` ${normalizeText(question)} `;
  const questionStems = new Set(tokens(question).map(stem));
  if (!questionStems.size) return [];
  const { stems, idf } = buildIndex(guides);
  const weight = (value: string) => idf.get(value) || 1;

  const scored = guides.map((guide) => {
    // La mejor frase clave cuenta una vez: muchas frases parecidas no deben inflar una guía.
    let score = 0;
    for (const keyword of guide.keywords) {
      const phrase = normalizeText(keyword);
      if (!phrase) continue;
      const keywordStems = tokens(phrase).map(stem);
      const stemWeight = keywordStems.reduce((sum, value) => sum + weight(value), 0);
      if (text.includes(` ${phrase} `)) score = Math.max(score, 6 + stemWeight * 1.5);
      else if (keywordStems.length && keywordStems.every((value) => questionStems.has(value))) score = Math.max(score, 2 + stemWeight);
    }
    const guideStems = stems.get(guide.id) || new Set<string>();
    questionStems.forEach((value) => { if (guideStems.has(value)) score += weight(value) * 1.5; });
    if (tokens(guide.area).map(stem).some((value) => questionStems.has(value))) score += 1;
    return { guide, score: Math.round(score * 10) / 10 };
  }).filter((entry) => entry.score >= 4);

  scored.sort((a, b) => b.score - a.score || a.guide.steps.length - b.guide.steps.length);
  return scored.slice(0, limit);
}

/** Una guía es «la respuesta» cuando gana con claridad; si no, se ofrecen opciones. */
export function confidentMatch(matches: GuideMatch[]): GuideMatch | null {
  const [first, second] = matches;
  if (!first || first.score < 9) return null;
  if (second && second.score > first.score * 0.75) return null;
  return first;
}

/** Preguntas sobre cómo usar el ERP (no sobre cifras del negocio). */
export function isHowToQuestion(question: string): boolean {
  const text = normalizeText(question);
  if (/\b(cuanto|cuantos|cuantas|quien|quienes|vendi|vendimos|me deben|debo pagar|utilidad|ganancia|como va|como estamos|como van)\b/.test(text)) return false;
  return /\b(como|donde|pasos|paso a paso|guia|guiame|tutorial|ensename|explicame|ayudame|no se|no encuentro|no entiendo|quiero|necesito|se puede|puedo)\b/.test(text);
}
