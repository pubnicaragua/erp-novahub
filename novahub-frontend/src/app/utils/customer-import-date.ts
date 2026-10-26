export type NormalizedCustomerImportDate = {
  value: string;
  invalid: boolean;
};

const toIsoDate = (year: number, month: number, day: number): string | null => {
  if (![year, month, day].every(Number.isInteger)) return null;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) return null;

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const invalidDate = (): NormalizedCustomerImportDate => ({ value: '', invalid: true });

/** Normalizes an Excel or text date to a date-only ISO value for customer import. */
export function normalizeCustomerImportDate(raw: unknown): NormalizedCustomerImportDate {
  if (raw === null || raw === undefined) return { value: '', invalid: false };

  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return invalidDate();
    const value = toIsoDate(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
    return value ? { value, invalid: false } : invalidDate();
  }

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return invalidDate();
    const serialDate = new Date(Date.UTC(1899, 11, 30) + Math.floor(raw) * 86400000);
    const value = toIsoDate(serialDate.getUTCFullYear(), serialDate.getUTCMonth() + 1, serialDate.getUTCDate());
    return value ? { value, invalid: false } : invalidDate();
  }

  const value = String(raw).trim();
  if (!value) return { value: '', invalid: false };

  const yearFirst = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (yearFirst) {
    const isoDate = toIsoDate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]));
    return isoDate ? { value: isoDate, invalid: false } : invalidDate();
  }

  const dayFirst = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dayFirst) {
    const isoDate = toIsoDate(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]));
    return isoDate ? { value: isoDate, invalid: false } : invalidDate();
  }

  if (/^\d+(?:\.\d+)?$/.test(value)) {
    const serial = Number(value);
    if (Number.isFinite(serial) && serial > 0) {
      const serialDate = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
      const isoDate = toIsoDate(serialDate.getUTCFullYear(), serialDate.getUTCMonth() + 1, serialDate.getUTCDate());
      return isoDate ? { value: isoDate, invalid: false } : invalidDate();
    }
  }

  return invalidDate();
}
