export type CustomerHistoryCurrency = 'NIO' | 'USD';

export type CustomerHistorySourceRow = {
  rowNumber: number;
  name: unknown;
  identifier: unknown;
  amount: unknown;
  measure?: unknown;
  document?: unknown;
  currency?: unknown;
  activityType?: unknown;
};

export type CustomerHistoryImportOptions = {
  activityType: string;
  measureLabel?: string;
  measureUnit?: string;
  activityTypeColumnSelected?: boolean;
  documentColumnSelected?: boolean;
  fallbackCurrency: CustomerHistoryCurrency | null;
};

export type CustomerHistoryImportSummary = {
  identifier: string;
  activityType: string;
  recordCount: number;
  measureLabel: string | null;
  measureValue: number | null;
  measureUnit: string | null;
  amount: number;
  currency: CustomerHistoryCurrency;
};

export type CustomerHistoryImportCustomer = {
  identifier: string;
  name: string;
  summaries: CustomerHistoryImportSummary[];
  errors: string[];
  warnings: string[];
};

export type CustomerHistoryImportResult = { customers: CustomerHistoryImportCustomer[] };

export function prepareCustomerHistoryForImport(customer: CustomerHistoryImportCustomer) {
  const identityErrors = customer.errors.filter((message) => /identificación obligatoria|nombre obligatorio/i.test(message));
  const historicalErrors = customer.errors.filter((message) => !identityErrors.includes(message));
  return {
    identityErrors,
    historicalErrors,
    summaries: identityErrors.length || historicalErrors.length ? [] : customer.summaries,
  };
}

export function normalizeCustomerHistoryIdentifier(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
}

function parseHistoricalNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let raw = String(value ?? '').trim();
  if (!raw || /[()]/.test(raw)) return null;
  raw = raw
    .replace(/^(?:US\$|U\$|C\$|\$|USD|NIO)\s*/i, '')
    .replace(/\s*(?:USD|NIO)$/i, '')
    .replace(/\s+(?:NOCHES?|UNIDADES?|D[IÍ]AS?|HABITACIONES?)$/i, '');
  const normalized = raw.replace(/\s/g, '');
  if (!normalized || !/^-?[0-9][0-9,.-]*$/.test(normalized)) return null;

  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  let decimalNormalized = normalized;
  if (lastComma >= 0 && lastDot >= 0) {
    decimalNormalized = lastComma > lastDot
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const decimalDigits = normalized.length - lastComma - 1;
    decimalNormalized = decimalDigits > 0 && decimalDigits <= 2
      ? normalized.replace(',', '.')
      : normalized.replace(/,/g, '');
  }
  const result = Number(decimalNormalized);
  return Number.isFinite(result) && result >= 0 ? result : null;
}

function parseHistoricalCurrency(value: unknown, fallback: CustomerHistoryCurrency | null): CustomerHistoryCurrency | null {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return fallback;
  if (['NIO', 'C$', 'CORDOBA', 'CORDOBAS', 'CÓRDOBA', 'CÓRDOBAS'].includes(raw)) return 'NIO';
  if (['USD', 'US$'].includes(raw)) return 'USD';
  // A bare "$" stays unresolved unless the user explicitly selects a fallback currency.
  if (raw === '$') return fallback;
  return null;
}

function normalizedName(value: unknown): string {
  return String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
}

export function aggregateCustomerHistory(
  sourceRows: CustomerHistorySourceRow[],
  options: CustomerHistoryImportOptions,
): CustomerHistoryImportResult {
  const activityType = String(options.activityType || '').trim();
  const customers = new Map<string, CustomerHistoryImportCustomer>();
  const firstNames = new Map<string, string>();
  const groups = new Map<string, {
    customer: CustomerHistoryImportCustomer;
    activityType: string;
    currency: CustomerHistoryCurrency;
    recordCount: number;
    measureValue: number;
    hasMeasure: boolean;
    amount: number;
    documents: Map<string, number>;
  }>();

  for (const source of sourceRows) {
    const identifier = String(source.identifier ?? '').trim();
    const key = normalizeCustomerHistoryIdentifier(identifier);
    const name = String(source.name ?? '').trim();
    // Missing identifiers stay as separate review rows; they can never be merged by name.
    const customerKey = key || `__MISSING_${source.rowNumber}`;
    let customer = customers.get(customerKey);
    if (!customer) {
      customer = { identifier, name, summaries: [], errors: [], warnings: [] };
      customers.set(customerKey, customer);
      firstNames.set(customerKey, normalizedName(name));
    } else if (normalizedName(name) && firstNames.get(customerKey) && normalizedName(name) !== firstNames.get(customerKey)) {
      if (!customer.warnings.includes('La misma identificación aparece con nombres distintos; revisa el nombre que se importará.')) {
        customer.warnings.push('La misma identificación aparece con nombres distintos; revisa el nombre que se importará.');
      }
    } else if (!customer.name && name) {
      customer.name = name;
      firstNames.set(customerKey, normalizedName(name));
    }

    const rowActivityType = options.activityTypeColumnSelected
      ? String(source.activityType ?? '').trim()
      : activityType;
    if (!rowActivityType) {
      addError(customer, `Fila ${source.rowNumber}: falta el tipo de historial.`);
      continue;
    }
    if (rowActivityType.length > 80) {
      addError(customer, `Fila ${source.rowNumber}: el tipo de historial no puede superar 80 caracteres.`);
      continue;
    }
    if (!key) addError(customer, `Fila ${source.rowNumber}: identificación obligatoria para vincular el historial.`);
    if (!name) addError(customer, `Fila ${source.rowNumber}: nombre obligatorio para identificar al cliente.`);

    const currency = parseHistoricalCurrency(source.currency, options.fallbackCurrency);
    if (!currency) {
      addError(customer, `Fila ${source.rowNumber}: moneda ausente o ambigua; usa NIO/USD o selecciona una moneda explícita.`);
      continue;
    }
    const amount = parseHistoricalNumber(source.amount);
    if (amount === null) {
      addError(customer, `Fila ${source.rowNumber}: importe inválido.`);
      continue;
    }
    const document = String(source.document ?? '').trim();
    if (options.documentColumnSelected && !document) {
      addError(customer, `Fila ${source.rowNumber}: falta el número de documento seleccionado.`);
      continue;
    }

    const groupKey = `${customerKey}\u0000${rowActivityType.toLocaleLowerCase()}\u0000${currency}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = { customer, activityType: rowActivityType, currency, recordCount: 0, measureValue: 0, hasMeasure: false, amount: 0, documents: new Map() };
      groups.set(groupKey, group);
    }

    let measure: number | null = null;
    if (source.measure !== undefined && source.measure !== null && String(source.measure).trim() !== '') {
      measure = parseHistoricalNumber(source.measure);
      if (measure === null) {
        addError(customer, `Fila ${source.rowNumber}: medida inválida.`);
        continue;
      }
    }

    if (options.documentColumnSelected) {
      const documentKey = document.toUpperCase().replace(/\s+/g, ' ');
      const priorAmount = group.documents.get(documentKey);
      if (priorAmount !== undefined) {
        if (priorAmount !== amount) addError(customer, `Fila ${source.rowNumber}: el documento ${document} aparece con importes distintos.`);
        continue;
      }
      group.documents.set(documentKey, amount);
      group.recordCount += 1;
      group.amount += amount;
    } else {
      group.recordCount += 1;
      group.amount += amount;
    }
    if (measure !== null) {
      group.measureValue += measure;
      group.hasMeasure = true;
    }
  }

  for (const group of groups.values()) {
    const measureLabel = group.hasMeasure ? String(options.measureLabel || '').trim() || null : null;
    const measureUnit = group.hasMeasure ? String(options.measureUnit || '').trim() || null : null;
    if (measureLabel && measureLabel.length > 80) addError(group.customer, 'La etiqueta de medida no puede superar 80 caracteres.');
    if (measureUnit && measureUnit.length > 32) addError(group.customer, 'La unidad de medida no puede superar 32 caracteres.');
    if (group.amount >= 10000000000000000) addError(group.customer, 'El total supera el importe máximo permitido.');
    if (group.measureValue >= 100000000000000) addError(group.customer, 'La medida supera el valor máximo permitido.');
    group.customer.summaries.push({
      identifier: group.customer.identifier,
      activityType: group.activityType,
      recordCount: group.recordCount,
      measureLabel,
      measureValue: group.hasMeasure ? Number(group.measureValue.toFixed(4)) : null,
      measureUnit,
      amount: Number(group.amount.toFixed(2)),
      currency: group.currency,
    });
  }

  for (const customer of customers.values()) {
    customer.summaries.sort((left, right) => left.currency.localeCompare(right.currency));
    if (customer.summaries.some((summary) => summary.measureValue !== null && !summary.measureLabel)) {
      addError(customer, 'Indica el nombre de la medida (por ejemplo, Noches).');
    }
  }

  return { customers: [...customers.values()] };
}

function addError(customer: CustomerHistoryImportCustomer, message: string) {
  if (!customer.errors.includes(message)) customer.errors.push(message);
}
