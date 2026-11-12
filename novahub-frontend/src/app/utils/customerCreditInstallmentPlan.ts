import { getCurrencyDecimalPlaces, roundCurrencyNumber } from './currency';

export type CustomerCreditFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
export type CustomerCreditPlanCalculationMode = 'AMOUNT' | 'DEADLINE' | 'MANUAL';

export type CustomerCreditManualInstallmentDraft = {
  dueDate: string;
  totalAmount: string;
  interestAmount: string;
};

export type CustomerCreditManualInstallmentInput = {
  dueDate: string;
  totalAmount: number;
  interestAmount: number;
};

export type CustomerCreditPlanInstallment = {
  installmentNumber: number;
  dueDate: string;
  totalAmount: number | string;
  principalAmount: number | string;
  interestAmount: number | string;
  principalPaid?: number | string;
  interestPaid?: number | string;
};

export type CustomerCreditPlanEstimate = {
  firstInstallmentDate: string;
  finalDueDate: string;
  installmentAmount: number | null;
  installmentCount: number;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  schedule: CustomerCreditPlanInstallment[];
  isValid: boolean;
  validationErrors: string[];
  totalDifference: number;
  interestDifference: number;
};

const MAX_INSTALLMENTS = 10_000;

function dateAt(firstDate: string, frequency: CustomerCreditFrequency, offset: number) {
  const [year, month, day] = firstDate.split('-').map(Number);
  if (frequency === 'MONTHLY') {
    const targetMonth = month - 1 + offset;
    const targetYear = year + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
    return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay))).toISOString().slice(0, 10);
  }
  const days = frequency === 'DAILY' ? 1 : frequency === 'WEEKLY' ? 7 : 15;
  return new Date(Date.UTC(year, month - 1, day + days * offset)).toISOString().slice(0, 10);
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
}

function buildAmountSchedule(input: {
  interest: number;
  total: number;
  installmentAmount: number;
  installmentCount: number;
  frequency: CustomerCreditFrequency;
  firstInstallmentDate: string;
}): CustomerCreditPlanInstallment[] {
  const schedule: CustomerCreditPlanInstallment[] = [];
  let allocatedTotal = 0;
  let allocatedInterest = 0;

  for (let index = 0; index < input.installmentCount; index += 1) {
    const totalAmount = index === input.installmentCount - 1
      ? roundCurrencyNumber(input.total - allocatedTotal)
      : roundCurrencyNumber(Math.min(input.installmentAmount, input.total - allocatedTotal));
    const interestAmount = index === input.installmentCount - 1
      ? roundCurrencyNumber(input.interest - allocatedInterest)
      : roundCurrencyNumber(input.interest * totalAmount / input.total);
    const principalAmount = roundCurrencyNumber(totalAmount - interestAmount);

    schedule.push({
      installmentNumber: index + 1,
      dueDate: dateAt(input.firstInstallmentDate, input.frequency, index),
      totalAmount,
      principalAmount,
      interestAmount,
    });
    allocatedTotal = roundCurrencyNumber(allocatedTotal + totalAmount);
    allocatedInterest = roundCurrencyNumber(allocatedInterest + interestAmount);
  }

  return schedule;
}

function buildDeadlineSchedule(input: {
  interest: number;
  total: number;
  installmentCount: number;
  frequency: CustomerCreditFrequency;
  firstInstallmentDate: string;
  finalDueDate: string;
}): CustomerCreditPlanInstallment[] | null {
  const precision = getCurrencyDecimalPlaces();
  const scale = 10 ** precision;
  const totalUnits = Math.round(input.total * scale);
  if (input.installmentCount > totalUnits) return null;

  const baseUnits = Math.floor(totalUnits / input.installmentCount);
  const extraUnits = totalUnits % input.installmentCount;
  const schedule: CustomerCreditPlanInstallment[] = [];
  let cumulativeUnits = 0;
  let allocatedInterest = 0;

  for (let index = 0; index < input.installmentCount; index += 1) {
    const installmentUnits = baseUnits + (index >= input.installmentCount - extraUnits ? 1 : 0);
    const totalAmount = roundCurrencyNumber(installmentUnits / scale);
    cumulativeUnits += installmentUnits;
    const interestAmount = index === input.installmentCount - 1
      ? roundCurrencyNumber(input.interest - allocatedInterest)
      : roundCurrencyNumber(input.interest * cumulativeUnits / totalUnits - allocatedInterest);
    const principalAmount = roundCurrencyNumber(totalAmount - interestAmount);

    schedule.push({
      installmentNumber: index + 1,
      dueDate: index === input.installmentCount - 1
        ? input.finalDueDate
        : dateAt(input.firstInstallmentDate, input.frequency, index),
      totalAmount,
      principalAmount,
      interestAmount,
    });
    allocatedInterest = roundCurrencyNumber(allocatedInterest + interestAmount);
  }

  return schedule;
}

function buildManualPlanEstimate(input: {
  principal: number;
  interest: number;
  installments: CustomerCreditManualInstallmentDraft[];
  total: number;
}): CustomerCreditPlanEstimate {
  const errors: string[] = [];
  const schedule: CustomerCreditPlanInstallment[] = [];
  let scheduledTotal = 0;
  let scheduledInterest = 0;
  let previousDate = '';

  if (input.installments.length < 1) errors.push('Agrega al menos un abono al plan manual.');
  if (input.installments.length > MAX_INSTALLMENTS) errors.push(`El plan no puede superar ${MAX_INSTALLMENTS.toLocaleString('es-NI')} abonos.`);

  input.installments.forEach((item, index) => {
    const rowNumber = index + 1;
    const dueDate = String(item.dueDate || '').trim();
    const validDate = isDateOnly(dueDate);
    if (!validDate) errors.push(`Indica una fecha válida para el abono ${rowNumber}.`);
    if (validDate && previousDate && dueDate <= previousDate) {
      errors.push('Las fechas de los abonos deben estar en orden cronológico ascendente.');
    }
    if (validDate) previousDate = dueDate;

    const rawAmount = item.totalAmount === '' ? Number.NaN : Number(item.totalAmount);
    const rawInterest = item.interestAmount === '' ? Number.NaN : Number(item.interestAmount);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) errors.push(`El monto del abono ${rowNumber} debe ser mayor que cero.`);
    if (!Number.isFinite(rawInterest) || rawInterest < 0) errors.push(`El interés del abono ${rowNumber} no puede ser negativo.`);
    const totalAmount = Number.isFinite(rawAmount) && rawAmount > 0 ? roundCurrencyNumber(rawAmount) : 0;
    const interestAmount = Number.isFinite(rawInterest) && rawInterest >= 0 ? roundCurrencyNumber(rawInterest) : 0;
    if (Number.isFinite(rawAmount) && rawAmount > 0 && totalAmount <= 0) {
      errors.push(`El monto del abono ${rowNumber} debe ser mayor que cero con la precisión monetaria configurada.`);
    }
    if (interestAmount > totalAmount) errors.push(`El interés del abono ${rowNumber} no puede superar su monto total.`);
    const principalAmount = roundCurrencyNumber(Math.max(0, totalAmount - interestAmount));
    scheduledTotal = roundCurrencyNumber(scheduledTotal + totalAmount);
    scheduledInterest = roundCurrencyNumber(scheduledInterest + interestAmount);
    schedule.push({
      installmentNumber: rowNumber,
      dueDate,
      totalAmount,
      principalAmount,
      interestAmount,
    });
  });

  const totalDifference = roundCurrencyNumber(input.total - scheduledTotal);
  const interestDifference = roundCurrencyNumber(input.interest - scheduledInterest);
  if (totalDifference !== 0) errors.push(`La suma de los abonos debe coincidir con el total a cancelar. Diferencia: ${totalDifference.toLocaleString('es-NI')}.`);
  if (interestDifference !== 0) errors.push(`El interés distribuido debe coincidir con el interés total calculado. Diferencia: ${interestDifference.toLocaleString('es-NI')}.`);

  return {
    firstInstallmentDate: schedule[0]?.dueDate || '',
    finalDueDate: schedule[schedule.length - 1]?.dueDate || '',
    installmentAmount: null,
    installmentCount: schedule.length,
    principalAmount: roundCurrencyNumber(input.principal),
    interestAmount: roundCurrencyNumber(input.interest),
    totalAmount: input.total,
    schedule,
    isValid: errors.length === 0,
    validationErrors: [...new Set(errors)],
    totalDifference,
    interestDifference,
  };
}

/** Mirrors the Backend customer-credit-plan.policy schedule so preview, loan, and credit totals agree. */
export function calculateCustomerCreditPlanEstimate(input: {
  principal: number;
  interest?: number;
  frequency?: CustomerCreditFrequency;
  firstInstallmentDate?: string;
  calculationMode: CustomerCreditPlanCalculationMode;
  installmentAmount?: number | string;
  finalDueDate?: string;
  manualInstallments?: CustomerCreditManualInstallmentDraft[];
}): CustomerCreditPlanEstimate | null {
  const principal = Number(input.principal || 0);
  const interest = Number(input.interest || 0);
  const total = roundCurrencyNumber(principal + interest);
  if (!Number.isFinite(principal) || principal <= 0 || !Number.isFinite(interest) || interest < 0
    || !Number.isFinite(total) || total <= 0) return null;
  if (input.calculationMode === 'MANUAL') {
    return buildManualPlanEstimate({
      principal,
      interest,
      total,
      installments: input.manualInstallments || [],
    });
  }
  const firstInstallmentDate = input.firstInstallmentDate;
  const frequency = input.frequency;
  if (!firstInstallmentDate || !isDateOnly(firstInstallmentDate)) return null;
  if (!frequency || !['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'].includes(frequency)) return null;

  let installmentCount: number;
  let finalDueDate: string;
  let installmentAmount: number;
  let schedule: CustomerCreditPlanInstallment[] | null;

  if (input.calculationMode === 'AMOUNT') {
    installmentAmount = Number(input.installmentAmount || 0);
    if (!Number.isFinite(installmentAmount) || installmentAmount <= 0) return null;
    installmentAmount = roundCurrencyNumber(installmentAmount);
    if (installmentAmount <= 0) return null;
    installmentCount = Math.ceil((total - Number.EPSILON) / installmentAmount);
    if (!Number.isFinite(installmentCount) || installmentCount < 1 || installmentCount > MAX_INSTALLMENTS) return null;
    schedule = buildAmountSchedule({
      interest,
      total,
      installmentAmount,
      installmentCount,
      frequency,
      firstInstallmentDate,
    });
    finalDueDate = schedule[schedule.length - 1]?.dueDate || '';
  } else {
    if (!isDateOnly(input.finalDueDate) || input.finalDueDate! < firstInstallmentDate) return null;
    finalDueDate = input.finalDueDate!;
    installmentCount = 1;
    while (installmentCount <= MAX_INSTALLMENTS
      && dateAt(firstInstallmentDate, frequency, installmentCount) <= finalDueDate) {
      installmentCount += 1;
    }
    if (installmentCount > MAX_INSTALLMENTS) return null;
    installmentAmount = roundCurrencyNumber(total / installmentCount);
    if (installmentAmount <= 0) return null;
    schedule = buildDeadlineSchedule({
      interest,
      total,
      installmentCount,
      frequency,
      firstInstallmentDate,
      finalDueDate,
    });
    if (!schedule) return null;
  }

  return {
    firstInstallmentDate,
    finalDueDate,
    installmentAmount,
    installmentCount,
    principalAmount: roundCurrencyNumber(principal),
    interestAmount: roundCurrencyNumber(interest),
    totalAmount: total,
    schedule,
    isValid: true,
    validationErrors: [],
    totalDifference: 0,
    interestDifference: 0,
  };
}
