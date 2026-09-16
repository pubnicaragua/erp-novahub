import { formatIncompletePhoneNumber, getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumberFromString, validatePhoneNumberLength, type CountryCode } from 'libphonenumber-js';
import phoneMetadata from 'libphonenumber-js/metadata.min.json';

export type CustomerCountryOption = {
  code: string;
  name: string;
  phoneCode: string;
  taxIdLabel: string;
  rucLabel: string;
  strictIdentifiers: boolean;
  phoneNationalDigits?: number;
};

const COUNTRY_NAMES: Record<string, string> = {
  NI: 'Nicaragua', US: 'Estados Unidos', CA: 'Canadá', MX: 'México', CL: 'Chile', PE: 'Perú',
  CR: 'Costa Rica', PA: 'Panamá', HN: 'Honduras', SV: 'El Salvador', GT: 'Guatemala', CO: 'Colombia',
  AR: 'Argentina', BR: 'Brasil', ES: 'España', FR: 'Francia', DE: 'Alemania', GB: 'Reino Unido',
};

const REGION_DISPLAY_NAMES = new Intl.DisplayNames(['es'], { type: 'region' });
const PHONE_METADATA_COUNTRIES = phoneMetadata.countries as Record<string, unknown[]>;

function countryDisplayName(code: string): string {
  const normalizedCode = String(code || '').trim().toUpperCase();
  return COUNTRY_NAMES[normalizedCode] || REGION_DISPLAY_NAMES.of(normalizedCode) || normalizedCode;
}

function normalizeCountryLabel(value: string): string {
  return String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function configuredCountryName(name: unknown, code: string): string {
  const candidate = String(name || '').trim();
  return candidate && candidate.toUpperCase() !== code.toUpperCase() ? candidate : countryDisplayName(code);
}

const CUSTOMER_COUNTRY_CODES = [...getCountries()].sort((left, right) => countryDisplayName(left).localeCompare(countryDisplayName(right), 'es'));

export const DEFAULT_CUSTOMER_COUNTRIES: CustomerCountryOption[] = CUSTOMER_COUNTRY_CODES.map((code) => ({
  code,
  name: countryDisplayName(code),
  phoneCode: getCountryCallingCode(code as CountryCode),
  taxIdLabel: code === 'NI' ? 'Cédula' : code === 'CL' ? 'RUT' : code === 'PE' ? 'RUC' : 'Identificación fiscal',
  rucLabel: code === 'NI' ? 'RUC' : code === 'CL' ? 'RUT / identificación' : 'RUC / identificación',
  strictIdentifiers: code === 'NI',
  ...(code === 'NI' ? { phoneNationalDigits: 8 } : {}),
}));

export function countryCodeFromLegacy(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  const aliases: Record<string, string> = {
    nicaragua: 'NI', ni: 'NI', 'república de nicaragua': 'NI',
    chile: 'CL', cl: 'CL', perú: 'PE', peru: 'PE', pe: 'PE',
    'estados unidos': 'US', usa: 'US', us: 'US', canadá: 'CA', canada: 'CA', ca: 'CA',
    méxico: 'MX', mexico: 'MX', mx: 'MX',
  };
  const alias = aliases[normalized];
  if (alias) return alias;
  const code = normalized.toUpperCase();
  if (/^[A-Z]{2}$/.test(code) && getCountries().includes(code as CountryCode)) return code;
  return CUSTOMER_COUNTRY_CODES.find((countryCode) => normalizeCountryLabel(countryDisplayName(countryCode)) === normalizeCountryLabel(String(value))) || null;
}

export function countryName(code: string, options: CustomerCountryOption[] = DEFAULT_CUSTOMER_COUNTRIES) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  return configuredCountryName(options.find((item) => item.code === normalizedCode)?.name, normalizedCode);
}

export function countryOption(code: string, options: CustomerCountryOption[] = DEFAULT_CUSTOMER_COUNTRIES) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  return options.find((item) => item.code.toUpperCase() === normalizedCode) || DEFAULT_CUSTOMER_COUNTRIES.find((item) => item.code === normalizedCode) || DEFAULT_CUSTOMER_COUNTRIES[0];
}

function possiblePhoneLengths(countryCode: string): number[] {
  const metadataCountry = PHONE_METADATA_COUNTRIES[String(countryCode || '').trim().toUpperCase()];
  const lengths = metadataCountry?.[3];
  return Array.isArray(lengths) ? lengths.filter((length): length is number => typeof length === 'number') : [];
}

function trimPhoneInputToMaximum(value: string, countryCode: string): string {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  const lengths = possiblePhoneLengths(countryCode);
  const maximumDigits = lengths.length ? Math.max(...lengths) : 15;
  if (!digits || digits.length <= maximumDigits) return raw;

  const callingCode = countryOption(countryCode).phoneCode;
  const hasCallingCode = raw.startsWith('+') && digits.startsWith(callingCode);
  const nationalDigits = hasCallingCode ? digits.slice(callingCode.length) : digits;
  const limitedNationalDigits = nationalDigits.slice(0, maximumDigits);
  const limitedDigits = hasCallingCode ? `${callingCode}${limitedNationalDigits}` : limitedNationalDigits;
  return raw.startsWith('+') ? `+${limitedDigits}` : limitedDigits;
}

function nationalPhoneDigits(value: string | null | undefined, countryCode: string): string {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (raw.startsWith('+')) {
    const callingCode = countryOption(countryCode).phoneCode;
    if (digits.startsWith(callingCode)) return digits.slice(callingCode.length);
  }
  if (String(countryCode || '').trim().toUpperCase() === 'NI' && digits.startsWith('505') && digits.length > 8) return digits.slice(3);
  return digits;
}

function phoneCountryMismatch(value: string | null | undefined, countryCode: string): CountryCode | null {
  const raw = String(value || '').trim();
  if (!raw.startsWith('+')) return null;
  const region = String(countryCode || '').trim().toUpperCase() as CountryCode;
  const parsed = parsePhoneNumberFromString(raw, region);
  if (parsed?.country && parsed.country !== region) return parsed.country;

  // Antes de que haya suficientes dígitos para que libphonenumber identifique
  // la región, todavía podemos detectar prefijos internacionales únicos como
  // +49 (Alemania) o +505 (Nicaragua).
  const digits = raw.replace(/\D/g, '');
  const matches = CUSTOMER_COUNTRY_CODES.filter((code) => digits.startsWith(getCountryCallingCode(code as CountryCode)));
  return matches.length === 1 && matches[0] !== region ? matches[0] : null;
}

function phoneLengthDescription(countryCode: string): string {
  const lengths = possiblePhoneLengths(countryCode);
  if (!lengths.length) return '';
  if (lengths.length === 1) return `${lengths[0]}`;
  const sorted = [...new Set(lengths)].sort((left, right) => left - right);
  const isContiguous = sorted.every((length, index) => index === 0 || length === sorted[index - 1] + 1);
  return isContiguous ? `${sorted[0]}–${sorted[sorted.length - 1]}` : sorted.join(', ');
}

export function formatCustomerPhoneInput(value: string, countryCode: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const region = String(countryCode || '').trim().toUpperCase() as CountryCode;
  const parsed = parsePhoneNumberFromString(raw, region);
  if (raw.startsWith('+') && (!parsed?.country || parsed.country !== region)) {
    return formatIncompletePhoneNumber(raw).slice(0, 30);
  }
  if (region === 'NI') {
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('505') && digits.length > 8) digits = digits.slice(3);
    digits = digits.slice(0, 8);
    return digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
  }
  const limitedRaw = trimPhoneInputToMaximum(raw, countryCode);
  const formatted = formatIncompletePhoneNumber(limitedRaw, region);
  const limitedParsed = parsePhoneNumberFromString(limitedRaw, region);
  if (limitedParsed?.isValid()) return limitedParsed.formatNational().slice(0, 30);
  return formatted.slice(0, 30);
}

export function formatCustomerPhoneForDisplay(value: string | null | undefined, countryCode: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const region = String(countryCode || '').trim().toUpperCase() as CountryCode;
  const parsed = parsePhoneNumberFromString(raw, region);
  if (raw.startsWith('+') && (!parsed?.country || parsed.country !== region)) {
    return formatIncompletePhoneNumber(raw).slice(0, 30);
  }
  const formatted = region === 'NI'
    ? formatCustomerPhoneInput(raw, countryCode)
    : parsed?.formatNational() || formatCustomerPhoneInput(raw, countryCode);
  if (!formatted || formatted.startsWith('+')) return formatted;
  return `+${countryOption(countryCode).phoneCode} ${formatted}`;
}

export function normalizeCustomerPhone(value: string | null | undefined, countryCode: string): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const region = String(countryCode || '').trim().toUpperCase() as CountryCode;
  const parsed = parsePhoneNumberFromString(raw, region);
  return parsed?.isValid() && !phoneCountryMismatch(raw, countryCode) ? parsed.number : null;
}

export function isCustomerPhoneValid(value: string | null | undefined, countryCode: string): boolean {
  const raw = String(value || '').trim();
  const region = String(countryCode || '').trim().toUpperCase() as CountryCode;
  return !raw || (isValidPhoneNumber(raw, region) && !phoneCountryMismatch(raw, region));
}

export function customerRucRequired(type: string | null | undefined, countryCode: string | null | undefined): boolean {
  return String(type || '').toUpperCase() === 'COMPANY' && String(countryCode || '').toUpperCase() === 'NI';
}

export function customerPhoneHint(value: string | null | undefined, countryCode: string): string {
  const mismatch = phoneCountryMismatch(value, countryCode);
  if (mismatch) {
    return `El número corresponde a ${countryOption(mismatch).name}; selecciona ese país.`;
  }
  const nationalDigits = nationalPhoneDigits(value, countryCode);
  if (!nationalDigits) return '';
  const raw = String(value || '').trim();
  const lengthStatus = validatePhoneNumberLength(raw, countryCode as CountryCode);
  if (isCustomerPhoneValid(value, countryCode)) {
    const description = phoneLengthDescription(countryCode);
    return description && description.includes('–')
      ? `Número válido · ${countryOption(countryCode).name} admite ${description} dígitos nacionales`
      : 'Formato completo';
  }
  if (lengthStatus === 'TOO_LONG') {
    const description = phoneLengthDescription(countryCode);
    return description ? `Demasiados dígitos · máximo ${description} dígitos nacionales` : 'El número tiene demasiados dígitos';
  }
  if (lengthStatus !== 'TOO_LONG') {
    const nextLength = possiblePhoneLengths(countryCode).find((length) => length > nationalDigits.length);
    if (nextLength) {
      const missing = nextLength - nationalDigits.length;
      return missing === 1 ? 'Falta 1 dígito' : `Faltan ${missing} dígitos`;
    }
  }
  return 'Completa un número válido para este país';
}

export function formatCustomerIdentifierInput(value: string, kind: 'taxId' | 'ruc', countryCode: string): string {
  const raw = String(value || '');
  if (countryCode !== 'NI') return raw;
  const compact = raw.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 14);
  if (kind === 'ruc') return compact;
  if (compact.length <= 3) return compact;
  if (compact.length <= 9) return `${compact.slice(0, 3)}-${compact.slice(3)}`;
  return `${compact.slice(0, 3)}-${compact.slice(3, 9)}-${compact.slice(9)}`;
}

export function isCustomerIdentifierValid(value: string | null | undefined, kind: 'taxId' | 'ruc', countryCode: string): boolean {
  const raw = String(value || '').trim();
  if (!raw || countryCode !== 'NI') return true;
  const compact = raw.replace(/[^0-9a-z]/gi, '').toUpperCase();
  return kind === 'taxId' ? /^\d{13}[A-Z]$/.test(compact) : /^[A-Z]\d{13}$/.test(compact);
}

export function customerIdentifierHint(value: string | null | undefined, kind: 'taxId' | 'ruc', countryCode: string): string {
  const compact = String(value || '').replace(/[^0-9a-z]/gi, '');
  if (!compact) return '';
  if (countryCode !== 'NI') return 'Formato libre para este país';
  const remaining = Math.max(0, 14 - compact.length);
  return remaining ? `Faltan ${remaining} caracteres` : (isCustomerIdentifierValid(value, kind, countryCode) ? 'Formato completo' : 'Formato inválido');
}

export function identifierComparisonKey(value: string | null | undefined): string {
  return String(value || '').trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
}
