export type MissingRucCreditDecision = 'allow' | 'confirm' | 'block';

export interface MissingRucCreditDecisionInput {
  rucRequired: boolean;
  previousRucRequired?: boolean;
  ruc?: string | null;
  previousRuc?: string | null;
  previousCreditLimit?: number | string | null;
  nextCreditLimit?: number | string | null;
  previousCreditLimitCurrency?: string | null;
  nextCreditLimitCurrency?: string | null;
}

export function resolveMissingRucCreditDecision({
  rucRequired,
  previousRucRequired = rucRequired,
  ruc,
  previousRuc = ruc,
  previousCreditLimit,
  nextCreditLimit,
  previousCreditLimitCurrency,
  nextCreditLimitCurrency,
}: MissingRucCreditDecisionInput): MissingRucCreditDecision {
  if (!rucRequired || String(ruc || '').trim()) return 'allow';

  const previousLimit = Number(previousCreditLimit || 0);
  const nextLimit = Number(nextCreditLimit || 0);
  const previousCurrency = String(previousCreditLimitCurrency || '').trim().toUpperCase();
  const nextCurrency = String(nextCreditLimitCurrency || '').trim().toUpperCase();
  const termsChanged = previousLimit !== nextLimit || previousCurrency !== nextCurrency;

  if (nextLimit > 0 && termsChanged) return 'confirm';
  if (previousRucRequired && !String(previousRuc || '').trim() && previousLimit > 0) return 'allow';
  return 'block';
}
