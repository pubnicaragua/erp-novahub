export type PurchasePriorityValue = 'NORMAL' | 'URGENT' | 'CRITICAL';

export const PURCHASE_PRIORITY_OPTIONS: Array<{ value: PurchasePriorityValue; label: string }> = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'URGENT', label: 'Urgente' },
  { value: 'CRITICAL', label: 'Crítica' },
];

const normalizePriorityText = (value: unknown) => String(value ?? '')
  .trim()
  .toUpperCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

export const normalizePurchasePriority = (value: unknown, fallback: PurchasePriorityValue = 'NORMAL'): PurchasePriorityValue => {
  const normalized = normalizePriorityText(value);
  if (normalized === 'URGENT' || normalized === 'URGENTE') return 'URGENT';
  if (normalized === 'CRITICAL' || normalized === 'CRITICO' || normalized === 'CRITICA') return 'CRITICAL';
  if (normalized === 'NORMAL') return 'NORMAL';
  return fallback;
};

export const getPurchasePriorityOption = (value: unknown) => {
  const normalized = normalizePurchasePriority(value);
  return PURCHASE_PRIORITY_OPTIONS.find((option) => option.value === normalized) || PURCHASE_PRIORITY_OPTIONS[0];
};
