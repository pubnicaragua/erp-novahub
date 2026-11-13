export const API_ERROR_CATEGORIES = [
  'VALIDATION',
  'BUSINESS_RULE',
  'AUTHORIZATION',
  'NOT_FOUND',
  'TECHNICAL',
] as const;

export type ApiErrorCategory = typeof API_ERROR_CATEGORIES[number];
export type ApiErrorClassification = ApiErrorCategory | 'UNCLASSIFIED';
export type ApiErrorToastVariant = 'error' | 'warning' | 'info';

const API_ERROR_CATEGORY_SET = new Set<string>(API_ERROR_CATEGORIES);
const API_ERROR_MESSAGE_TTL_MS = 30_000;
const API_ERROR_MESSAGE_LIMIT = 256;
const API_ERROR_MESSAGE_KEY_MAX_LENGTH = 2_048;
const apiErrorMessageCategories = new Map<string, {
  category: ApiErrorClassification | null;
  requestId?: string | null;
  expiresAt: number;
}>();

function normalizeApiErrorMessageKey(message: string): string {
  return message.trim().replace(/\s+/g, ' ');
}

function pruneApiErrorMessageCategories(now = Date.now()) {
  for (const [message, entry] of apiErrorMessageCategories) {
    if (entry.expiresAt <= now) apiErrorMessageCategories.delete(message);
  }
  while (apiErrorMessageCategories.size > API_ERROR_MESSAGE_LIMIT) {
    const oldest = apiErrorMessageCategories.keys().next().value;
    if (oldest === undefined) break;
    apiErrorMessageCategories.delete(oldest);
  }
}

/**
 * Retains a short-lived category for legacy `toast.error(error.message)` calls.
 * Conflicting categories for the same message are marked ambiguous until expiry.
 */
export function registerApiErrorCategory(message: string, category: ApiErrorClassification, requestId?: string) {
  const key = normalizeApiErrorMessageKey(message);
  if (!key || key.length > API_ERROR_MESSAGE_KEY_MAX_LENGTH) return;

  const now = Date.now();
  pruneApiErrorMessageCategories(now);
  const previous = apiErrorMessageCategories.get(key);
  apiErrorMessageCategories.set(key, {
    category: previous && previous.category !== category ? null : category,
    requestId: previous ? (previous.requestId === requestId ? requestId : null) : requestId,
    expiresAt: now + API_ERROR_MESSAGE_TTL_MS,
  });
  pruneApiErrorMessageCategories(now);
}

export function getRegisteredApiErrorCategory(message: string): ApiErrorClassification | undefined {
  const key = normalizeApiErrorMessageKey(message);
  if (!key || key.length > API_ERROR_MESSAGE_KEY_MAX_LENGTH) return undefined;
  const entry = apiErrorMessageCategories.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    apiErrorMessageCategories.delete(key);
    return undefined;
  }
  return entry.category ?? undefined;
}

export function getRegisteredApiErrorRequestId(message: string): string | undefined {
  const key = normalizeApiErrorMessageKey(message);
  if (!key || key.length > API_ERROR_MESSAGE_KEY_MAX_LENGTH) return undefined;
  const entry = apiErrorMessageCategories.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) apiErrorMessageCategories.delete(key);
    return undefined;
  }
  return entry.requestId ?? undefined;
}

export function apiErrorToastVariant(
  category: ApiErrorClassification,
  unclassified: ApiErrorToastVariant = 'info',
): ApiErrorToastVariant {
  if (category === 'TECHNICAL') return 'error';
  if (category === 'VALIDATION' || category === 'BUSINESS_RULE' || category === 'AUTHORIZATION') return 'warning';
  if (category === 'NOT_FOUND') return 'info';
  return unclassified;
}

function extractLocalNoticeCause(message: string): string | undefined {
  const match = message.trim().replace(/\s+/g, ' ')
    .match(/^(?:(?:No se pud(?:o|ieron)|No fue posible) [^.;?!:]+[.;?!:]|Error al [^.;?!:]+:)\s*(.+)$/i);
  const cause = match?.[1]?.trim();
  if (!cause || /^(?:intenta|int[eé]ntalo|intent[aá]|actualiza(?:r)?\b|recarga\b|vuelve a (?:intentar|cargar)|reintenta\b|revisa tu conexi[oó]n|comprueba si se guard[oó]|contacta (?:a )?soporte|comparte (?:el )?c[oó]digo)\b/i.test(cause)) {
    return undefined;
  }
  return cause;
}

/**
 * Some forms enforce their rules locally and pass a plain string to toast.error.
 * Recognize common user-action and business-condition wording so those notices
 * are not presented with the same severity as a server or network failure.
 */
export function classifyLocalNotice(message: string): ApiErrorClassification | undefined {
  const normalized = message.trim().replace(/\s+/g, ' ');
  const cause = extractLocalNoticeCause(normalized);
  const text = (cause || normalized).toLocaleLowerCase('es');
  if (/^no se pudo validar (?:el )?archivo\b/i.test(normalized)) return 'VALIDATION';
  if (/^no se pudo leer (?:el )?archivo excel\b/i.test(normalized)) return 'VALIDATION';
  if (/^no se pudo leer (?:la )?imagen\b/i.test(normalized)) return 'VALIDATION';
  if (/^no se pudo entregar la prueba\b/i.test(normalized)) return 'BUSINESS_RULE';
  if (/^importaci[oó]n terminada:/i.test(normalized)) return 'BUSINESS_RULE';
  if (/\b(?:id|identificador) de empresa inv[aá]lid[oa]\b/i.test(normalized)) return 'BUSINESS_RULE';
  if (/^no se pudieron (?:cargar|resolver) todos los productos seleccionados\b/i.test(normalized)) return 'NOT_FOUND';
  if (/^error (?:de validaci[oó]n|al validar)\b/i.test(normalized)) return 'VALIDATION';
  if (!text) return undefined;
  if (!cause && /^(?:no se pud(?:o|ieron)|no pudimos|no fue posible|error\b|ocurri[oó] un error\b|fall[oó](?: el| la)?|servidor|conexi[oó]n|failed to|network error)/i.test(text)) return 'TECHNICAL';

  if (/^(?:no autorizad[oa]|sin autorizaci[oó]n|acceso denegado)\b/.test(text)
    || (/\b(?:creador|responsable|administrador|due[nñ]o|titular)\b/.test(text)
      && /\b(?:solo|solamente|únicamente|unicamente)\b/.test(text))
    || (/\bno puedes?\b/.test(text) && /\b(?:roles? de otra empresa|otra sucursal|este ticket|este registro|esta acci[oó]n)\b/.test(text))) {
    return 'AUTHORIZATION';
  }

  if (/\b(?:permiso|permisos|autorizaci[oó]n|autorizado)\b/.test(text)
    && /^(?:no tienes?|necesitas?|tu usuario|este usuario|solicita|pide|contacta|el rol|tu rol)\b/.test(text)) {
    return 'AUTHORIZATION';
  }

  if (/^no se puede filtrar a una fecha anterior\b/.test(text)
    || /^(?:selecciona|seleccione|seleccioná|completa|complete|agrega|agregue|ingresa|ingrese|digita|digite|describe|describa|marca|marque|indica|indique|captura|capture|elige|elija|escribe|escriba|proporciona|proporcione|confirma|confirme|activa|active|corrige|corrija|revisa|revise|verifica|verifique|aseg[uú]rate|aseg[uú]rese|comprueba|compruebe|explica|explique|adjunta|adjunte|registra|registre|carga|cargue|valida|valide|define|defina|usa|use)\b/.test(text)
    || /^(?:seleccion[aá]|ingres[aá]|adjunt[aá]|registr[aá]|carg[aá]|valid[aá]|revis[aá]|eleg[ií]|escrib[ií])(?=\s|[.,;!?]|$)/.test(text)
    || /\b(?:es|son|sea|sean)?\s*(?:obligatori[oa]s?|requerid[oa]s?|necesari[oa]s?)\b/.test(text)
    || /\b(?:debe|deben|debes|tienes que|tiene que|hace falta|faltan|falta)\s+(?:configurar|seleccionar|ingresar|indicar|agregar|capturar|escribir|completar|proporcionar|registrar|elegir|tener|incluir|corregir|revisar|definir|contener|quedar|explicar)\b/.test(text)
    || /\b(?:formato|correo|tel[eé]fono|identificaci[oó]n|ruc|dato|archivo|campo|valor)\b.*\b(?:inv[aá]lid[oa]s?|no v[aá]lid[oa]s?|incorrect[oa]s?|no coincide|no es correcto)\b/.test(text)
    || /\b(?:datos?|campos?|moneda|divisa|cantidad(?:es)?|imei|n[uú]mero(?:s)? de serie)\b.*\b(?:inv[aá]lid[oa]s?|no v[aá]lid[oa]s?|repetid[oa]s?|debe ser|deben ser|debe ser n[uú]mero|no coincide)\b/.test(text)
    || /\b(?:no (?:es|tiene|parece) (?:un )?(?:formato )?(?:v[aá]lid[oa]s?|correct[oa]s?)|(?:es|son) inv[aá]lid[oa]s?)\b/.test(text)
    || /\bno puede(?:n)? (?:quedar|estar) vac[ií][oa]s?\b/.test(text)
    || /\b(?:m[aá]xim[oa]s?|m[ií]nim[oa]s?|admite hasta|al menos|debe estar entre|deben estar entre|debe ser (?:mayor|menor|igual|posterior|anterior|a partir)|deben ser (?:mayores|menores|iguales|posteriores|anteriores)|debe ser un (?:n[uú]mero|entero|correo|archivo|excel)|debe tener (?:al menos|como m[ií]nimo)|mayor que cero|mayor a 0|no puede ser negativo|no pueden ser negativos|no puede superar|no pueden superar)\b/.test(text)
    || /\b(?:debe ser|deben ser)\s+(?:excel|csv|zip|rar|pdf|png|jpg|webp|gif|avif|xlsx?)\b/.test(text)
    || /\bdebe ser (?:un[oa]? )?(?:imagen|documento|archivo|foto|enlace|url)\b/.test(text)
    || /\b(?:debe sumar|deben sumar|debe coincidir|deben coincidir|debe ser igual o mayor|deben ser n[uú]meros iguales o mayores|debe ser a partir de)\b/.test(text)
    || /\b(?:no est[aá] normalizad[oa]|no cumple el formato|no pudo leerse|pesa m[aá]s de|excede el l[ií]mite de almacenamiento|solo se permiten archivos|usa un logo)\b/.test(text)
    || /\b(?:tipo de archivo no permitido|n[uú]meros de serie repetidos|hay n[uú]meros de serie repetidos)\b/.test(text)
    || /\b(?:no repitas|no se pueden agregar m[aá]s de|solo puedes adjuntar hasta|debe permitir m[aá]ximo)\b/.test(text)
    || /\b(?:debes especificar|exige un motivo|concepto y monto antes de|debe ser mayor o igual a cero|permite m[aá]ximo)\b/.test(text)
    || /\b(?:cantidades? deben ser enteros mayores que cero|moneda del l[ií]mite de cr[eé]dito debe ser)\b/.test(text)
    || /\b(?:el enlace debe empezar por|debe empezar por https|debe comenzar con)\b/.test(text)
    || /\b(?:corrige|revisa) los errores\b|\bno contiene filas\b|\bno hay filas v[aá]lidas\b|\bnecesitan una clave\b|\bno contiene datos\b|\bno contiene una hoja con encabezados\b/.test(text)
    || /\b(?:debe ser|deben ser|tiene que ser|tienen que ser)\b.*\b(?:v[aá]lid[oa]s?|correct[oa]s?|entero|positivo|mayor|menor|posterior|anterior|permitid[oa]s?)\b/.test(text)
    || /\b(?:debe|deben|tiene que|tienen que)\b.*\b(?:estar|quedar|contener)\b.*\b(?:v[aá]lid[oa]s?|correct[oa]s?|seleccionad[oa]s?|cargad[oa]s?)\b/.test(text)) {
    return 'VALIDATION';
  }

  if (/\b(?:no se puede|no puedes?|no pueden|no puede|no existe|no hay|no tiene|no cuenta con|solo se puede|solo se pueden|solo puede|ya existe|debe generarse desde|tiene que generarse desde|espera a que|primero (?:debes|tienes que|registra|carga|crea|selecciona)|antes de (?:registrar|continuar|crear|pagar|cerrar|cancelar))\b/.test(text)
    || /\b(?:ya est(?:a|á)|(?:el|tu) navegador bloque(?:o|ó))(?=\s|[.,;!?]|$)/.test(text)
    || /\b(?:permiso fue bloqueado|el navegador no permiti[oó]|este navegador no admite|no se pudo entregar la prueba.*notificaciones|configura primero el enlace p[uú]blico|guarda o resuelve tus cambios antes)(?=\s|[.,;!?]|$)/.test(text)
    || /\b(?:supera|excede|rebasa|insuficiente|l[ií]mite disponible|saldo disponible|saldo a favor disponible|no est[aá] disponible|no permite|requiere|no coincide|no se encuentra activo|inactivo[sas]?|sin un correo|sin un n[uú]mero|no tiene un correo|no tiene un n[uú]mero|debe pertenecer al menos|debe conservar al menos|no admite vuelto|debe cubrirse con efectivo|no se puede dar vuelto|debe estar recibida|debe estar recibido|solo puede generarse desde)\b/.test(text)
    || /\b(?:ya (?:est[aá]|existe|fue registrado|est[aá] agregado)|duplicad[oa]s?|repetid[oa]s? con la misma lista|no puede (?:editarse|modificarse|cerrarse|cancelarse) mientras)\b/.test(text)
    || /\b(?:el empleado solo tiene|solo tiene)\b.*\b(?:d[ií]as|horas|saldo|disponible)s?\b/.test(text)
    || /\b(?:no se pudieron guardar|no se pudieron cancelar)\b.*\b(?:asignaci[oó]n|beneficio|documento|recepci[oó]n|factura|cr[eé]dito)/.test(text)
    || /\b(?:asignaci[oó]n(?:es)?|beneficio|documento|recepci[oó]n|factura|cr[eé]dito)s?\b.*\bno se pudieron (?:guardar|cancelar)\b/.test(text)
    || /\b(?:primero elimina o reasigna|debe estar vinculado a un producto|no puede (?:ser|est[aá]) aplicado mientras|est[aá] en uso|los cobros parciales est[aá]n desactivados|reabre el ticket antes|abre una sesi[oó]n de caja|apertura una sesi[oó]n de caja|el cliente de la orden no est[aá] activo|debe cubrir el saldo pendiente|deben registrarse con un medio de pago|no tienen precio en la lista|solo las facturas pagadas pueden)\b/.test(text)
    || /\bfallaron\. revisa (?:el motivo|cada resultado)\b/.test(text)
    || /\bdebe estar en proceso o aprob(?:ado|ada) antes de\b/.test(text)
    || /\blos roles del sistema no se pueden eliminar\b/.test(text)
    || /\bdebe estar (?:en proceso|aprobada|aprobado|recibida|recibido) antes de\b/.test(text)
    || /^el pago qued[oó] registrado, pero\b/.test(text)) {
    return 'BUSINESS_RULE';
  }

  if (/(?:^|\s)(?:no se encontr[oó]|no encontramos|no encontr[eé]|no existe la revisi[oó]n|no existe el registro|sesi[oó]n no encontrada)(?=\s|[.,;!?]|$)/.test(text)) {
    return 'NOT_FOUND';
  }

  return undefined;
}

/** Drop generic failure framing when the sentence itself names a user condition. */
export function normalizeLocalNoticeMessage(message: string): string {
  if (/^no se pudo leer (?:la )?imagen\b/i.test(message.trim())) {
    return 'El archivo de imagen no pudo leerse. Comprueba que sea válido y vuelve a seleccionarlo.';
  }
  const cause = extractLocalNoticeCause(message);
  return cause && classifyLocalNotice(message) !== undefined ? cause : message;
}

export function addApiErrorContext(
  message: string,
  status: number | undefined,
  context: string | undefined,
  category?: ApiErrorClassification,
): string {
  const raw = message.trim();
  if (!raw) return raw;
  const shouldPrefix = Boolean(context)
    && !/^no se pudo\b/i.test(raw)
    && (category === 'TECHNICAL' || (!category && !(status !== undefined && status >= 400 && status < 500)));
  const normalized = shouldPrefix ? `No se pudo ${context}. ${raw}` : raw;
  if ((status === 400 || status === 409) && category !== 'TECHNICAL') {
    registerApiErrorCategory(normalized, category ?? classifyLocalNotice(normalized) ?? 'UNCLASSIFIED');
  }
  return normalized;
}

export interface ApiErrorBody {
  message?: string | string[] | Record<string, unknown>;
  error?: string;
  details?: string | string[];
  code?: string;
  category?: ApiErrorCategory | string;
  statusCode?: number;
  requestId?: string;
  matches?: unknown[];
  [key: string]: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asApiErrorCategory(value: unknown): ApiErrorCategory | undefined {
  return typeof value === 'string' && API_ERROR_CATEGORY_SET.has(value)
    ? value as ApiErrorCategory
    : undefined;
}

export function normalizeApiErrorBody(body: unknown): ApiErrorBody | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const outer = body as ApiErrorBody;
  const nestedMessage = outer.message;
  if (!nestedMessage || typeof nestedMessage !== 'object' || Array.isArray(nestedMessage)) return outer;

  const nested = nestedMessage as ApiErrorBody;
  return {
    ...outer,
    ...nested,
    category: outer.category ?? nested.category,
    code: outer.code ?? nested.code,
    details: outer.details ?? nested.details,
    requestId: outer.requestId ?? nested.requestId,
    message: nested.message ?? '',
  };
}

/** Classifies shared API failures without treating every client error as technical. */
export function classifyApiError(error: unknown): ApiErrorClassification {
  if (typeof error === 'string') {
    return getRegisteredApiErrorCategory(error) ?? 'UNCLASSIFIED';
  }

  const outer = asRecord(error);
  const data = asRecord(outer?.data);
  const body = normalizeApiErrorBody(data) ?? normalizeApiErrorBody(error);
  const nestedMessage = asRecord(body?.message);

  // An explicit server/client category is the most reliable discriminator.
  const declaredCategory = asApiErrorCategory(outer?.category) ?? asApiErrorCategory(body?.category);
  if (declaredCategory) return declaredCategory;

  const status = Number(outer?.status ?? body?.statusCode ?? body?.status);
  const message = nestedMessage?.message ?? body?.message;
  const code = typeof outer?.code === 'string' ? outer.code : body?.code;
  const errorName = typeof outer?.name === 'string' ? outer.name : '';
  const text = typeof outer?.message === 'string' ? outer.message : '';

  if (code === 'TRIAL_EXPIRED') return 'BUSINESS_RULE';
  if (code === 'SESSION_CLOSED' || code === 'SESSION_EXPIRED' || code === 'SESSION_INVALID') return 'AUTHORIZATION';
  if (status === 400 && Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return 'VALIDATION';
  }
  if (status === 401 || status === 403) return 'AUTHORIZATION';
  if (status === 404) return 'NOT_FOUND';
  if (Number.isFinite(status) && status >= 500) return 'TECHNICAL';
  if (/failed to fetch|networkerror|network error|network request failed/i.test(text)) return 'TECHNICAL';
  if (errorName === 'AbortError') return 'UNCLASSIFIED';
  if (status === 409 || status === 422) return 'BUSINESS_RULE';
  if (typeof message === 'string') {
    const localCategory = classifyLocalNotice(message);
    if (localCategory) {
      if (localCategory === 'TECHNICAL' && Number.isFinite(status) && status >= 400 && status < 500) {
        return 'UNCLASSIFIED';
      }
      return localCategory;
    }
  }
  if (Number.isFinite(status)) return 'UNCLASSIFIED';
  if (error instanceof Error || /^(?:Error|AxiosError)$/.test(errorName)) return 'TECHNICAL';
  return 'UNCLASSIFIED';
}

export class ApiRequestError extends Error {
  readonly status?: number;
  readonly path?: string;
  readonly code?: string;
  readonly details?: string[];
  readonly data?: unknown;
  readonly category: ApiErrorClassification;
  readonly requestId?: string;

  constructor(
    message: string,
    status?: number,
    path?: string,
    code?: string,
    details?: string[],
    data?: unknown,
    category?: ApiErrorClassification,
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.path = path;
    this.code = code;
    this.details = details;
    this.data = data;
    this.category = category ?? classifyApiError({ message, status, data });
    this.requestId = requestId;
    registerApiErrorCategory(message, this.category, requestId);
  }
}
