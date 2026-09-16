import { AsYouType, getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

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
  return CUSTOMER_COUNTRY_CODES.find((countryCode) => normalizeCountryLabel(countryDisplayName(countryCode)) === normalizeCountryLabel(value)) || null;
}

export function countryName(code: string, options: CustomerCountryOption[] = DEFAULT_CUSTOMER_COUNTRIES) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  return configuredCountryName(options.find((item) => item.code === normalizedCode)?.name, normalizedCode);
}

export function countryOption(code: string, options: CustomerCountryOption[] = DEFAULT_CUSTOMER_COUNTRIES) {
  return options.find((item) => item.code === code) || DEFAULT_CUSTOMER_COUNTRIES.find((item) => item.code === code) || DEFAULT_CUSTOMER_COUNTRIES[0];
}

export function formatCustomerPhoneInput(value: string, countryCode: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (countryCode === 'NI') {
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('505') && digits.length > 8) digits = digits.slice(3);
    digits = digits.slice(0, 8);
    return digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
  }
  const region = countryCode as CountryCode;
  const formatter = new AsYouType(region);
  const formatted = formatter.input(raw);
  const parsed = parsePhoneNumberFromString(raw, region);
  if (parsed?.isValid()) return parsed.formatNational().slice(0, 30);

  // Algunos países, especialmente regiones que comparten código telefónico,
  // no agregan separadores cuando se pega un número nacional incompleto. Se
  // usa el prefijo de la región solo como referencia de formato y no se guarda
  // dentro del valor del cliente.
  if (!raw.startsWith('+') && formatted.replace(/\D/g, '') === raw.replace(/\D/g, '')) {
    const withDialCode = new AsYouType().input(`+${countryOption(countryCode).phoneCode}${raw.replace(/\D/g, '')}`);
    const dialCodePrefix = `+${countryOption(countryCode).phoneCode}`;
    if (withDialCode.startsWith(dialCodePrefix)) return withDialCode.slice(dialCodePrefix.length).trim().slice(0, 30);
  }
  return formatted.slice(0, 30);
}

export function formatCustomerPhoneForDisplay(value: string | null | undefined, countryCode: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (countryCode === 'NI') return formatCustomerPhoneInput(raw, countryCode);
  const parsed = parsePhoneNumberFromString(raw, countryCode as CountryCode);
  return parsed?.formatNational() || formatCustomerPhoneInput(raw, countryCode);
}

export function normalizeCustomerPhone(value: string | null | undefined, countryCode: string): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = parsePhoneNumberFromString(raw, countryCode as CountryCode);
  return parsed?.isValid() ? parsed.number : null;
}

export function isCustomerPhoneValid(value: string | null | undefined, countryCode: string): boolean {
  const raw = String(value || '').trim();
  return !raw || isValidPhoneNumber(raw, countryCode as CountryCode);
}

export function customerRucRequired(type: string | null | undefined, countryCode: string | null | undefined): boolean {
  return String(type || '').toUpperCase() === 'COMPANY' && String(countryCode || '').toUpperCase() === 'NI';
}

export function customerPhoneHint(value: string | null | undefined, countryCode: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (countryCode === 'NI') {
    const nationalDigits = digits.startsWith('505') && digits.length > 8 ? digits.slice(3) : digits;
    if (nationalDigits.length < 8) return `Faltan ${8 - nationalDigits.length} dígitos`;
  }
  return isCustomerPhoneValid(value, countryCode) ? 'Formato completo' : 'Completa un número válido para este país';
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
