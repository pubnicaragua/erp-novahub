const BALANCE_TOLERANCE = 0.005;

type SupplierBalanceRecord = {
  balance?: unknown;
};

export const normalizeSupplierBalance = (value: unknown): number => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || Math.abs(amount) <= BALANCE_TOLERANCE) return 0;
  return amount;
};

/**
 * El saldo del proveedor se calcula como deuda menos pagos y créditos.
 * Por eso, a diferencia del saldo neto del cliente, un valor positivo
 * representa una deuda pendiente con el proveedor.
 */
export const getSupplierDebtAmount = (supplier?: SupplierBalanceRecord | null): number => (
  Math.max(0, normalizeSupplierBalance(supplier?.balance))
);

export const getSupplierFavorAmount = (supplier?: SupplierBalanceRecord | null): number => (
  Math.max(0, -normalizeSupplierBalance(supplier?.balance))
);
