import { BookOpenCheck, Info, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { contabilidadService } from '../../services/contabilidad.service';
import { useAccountingQuery } from '../../hooks/useAccountingQuery';

export type SalesAccountingFlow = 'order' | 'invoice' | 'recentInvoice' | 'return' | 'creditNote' | 'pos';

type SalesAccountingLegendProps = {
  flow: SalesAccountingFlow;
  paymentMethod?: string | null;
  compact?: boolean;
};

type AccountMapping = {
  code: string;
  name: string;
};

const DEFAULT_ACCOUNTS: Record<string, Record<string, AccountMapping>> = {
  invoice: {
    receivable: { code: '1100', name: 'Cuentas por Cobrar' },
    income: { code: '4000', name: 'Ingresos Operativos' },
    ivaPayable: { code: '2100', name: 'IVA por Pagar' },
  },
  payment: {
    cash: { code: '1000', name: 'Caja y Bancos' },
    receivable: { code: '1100', name: 'Cuentas por Cobrar' },
  },
  saleReturn: {
    returns: { code: '4100', name: 'Devoluciones y Descuentos' },
    receivable: { code: '1100', name: 'Cuentas por Cobrar' },
    ivaPayable: { code: '2100', name: 'IVA por Pagar' },
    loss: { code: '5300', name: 'Pérdida por devolución' },
  },
  creditNote: {
    income: { code: '4000', name: 'Ingresos por Ventas' },
    ivaPayable: { code: '2100', name: 'IVA por Pagar' },
    receivable: { code: '1100', name: 'Cuentas por Cobrar' },
  },
  cashSale: {
    cash: { code: '1000', name: 'Caja y Bancos' },
    income: { code: '4000', name: 'Ingresos por Ventas' },
    ivaPayable: { code: '2100', name: 'IVA por Pagar' },
  },
};

const PAYMENT_METHODS: Record<string, { label: string; accountKey: string | null }> = {
  CASH: { label: 'Efectivo', accountKey: 'cash' },
  CARD: { label: 'Tarjeta · banco global', accountKey: null },
  TRANSFER: { label: 'Transferencia · banco global', accountKey: null },
  CHECK: { label: 'Cheque · banco global', accountKey: null },
};

function normalizeAccount(value: any, fallback: AccountMapping): AccountMapping {
  return value?.code ? { code: value.code, name: value.name || fallback.name } : fallback;
}

function AccountLine({ label, side, account }: { label: string; side: 'debit' | 'credit'; account: AccountMapping }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border/30 py-1.5 text-[10px]">
      <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
        <span className={`rounded px-1 py-0.5 text-[8px] font-black uppercase ${side === 'debit' ? 'bg-orange-500/10 text-orange-600' : 'bg-blue-500/10 text-blue-600'}`}>
          {side === 'debit' ? 'Debe' : 'Haber'}
        </span>
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-right font-semibold">
        <span className="font-mono">{account.code}</span>
        <span className="ml-1 text-muted-foreground">· {account.name}</span>
      </span>
    </div>
  );
}

export function SalesAccountingLegend({ flow, paymentMethod, compact = true }: SalesAccountingLegendProps) {
  const { data, isLoading } = useAccountingQuery<any>(
    ['sales-accounting-mappings'],
    (signal) => contabilidadService.getSuggestedAccounts(signal),
  );
  const mappings = data?.mappings || {};
  const invoiceAccounts = DEFAULT_ACCOUNTS.invoice;
  const cashSaleAccounts = DEFAULT_ACCOUNTS.cashSale;
  const configuredInvoice = {
    receivable: normalizeAccount(mappings?.invoice?.receivable, invoiceAccounts.receivable),
    income: normalizeAccount(mappings?.invoice?.income, invoiceAccounts.income),
    ivaPayable: normalizeAccount(mappings?.invoice?.ivaPayable, invoiceAccounts.ivaPayable),
  };
  const configuredCashSale = {
    cash: normalizeAccount(mappings?.cashSale?.cash, cashSaleAccounts.cash),
    income: normalizeAccount(mappings?.cashSale?.income, cashSaleAccounts.income),
    ivaPayable: normalizeAccount(mappings?.cashSale?.ivaPayable, cashSaleAccounts.ivaPayable),
  };
  const configuredReturn = {
    returns: normalizeAccount(mappings?.saleReturn?.returns, DEFAULT_ACCOUNTS.saleReturn.returns),
    receivable: normalizeAccount(mappings?.saleReturn?.receivable, DEFAULT_ACCOUNTS.saleReturn.receivable),
    ivaPayable: normalizeAccount(mappings?.saleReturn?.ivaPayable, DEFAULT_ACCOUNTS.saleReturn.ivaPayable),
    loss: normalizeAccount(mappings?.saleReturn?.loss, DEFAULT_ACCOUNTS.saleReturn.loss),
  };
  const configuredCredit = {
    income: normalizeAccount(mappings?.creditNote?.income, DEFAULT_ACCOUNTS.creditNote.income),
    receivable: normalizeAccount(mappings?.creditNote?.receivable, DEFAULT_ACCOUNTS.creditNote.receivable),
    ivaPayable: normalizeAccount(mappings?.creditNote?.ivaPayable, DEFAULT_ACCOUNTS.creditNote.ivaPayable),
  };
  const method = paymentMethod ? (PAYMENT_METHODS[String(paymentMethod).toUpperCase()] || PAYMENT_METHODS.CASH) : null;
  const effectiveMethod = method || PAYMENT_METHODS.CASH;
  const bankPayment: AccountMapping = { code: 'BANCO', name: 'Cuenta hija del banco global seleccionado' };
  const configuredPayment = effectiveMethod.accountKey
    ? normalizeAccount(mappings?.payment?.[effectiveMethod.accountKey], DEFAULT_ACCOUNTS.payment[effectiveMethod.accountKey])
    : bankPayment;
  const configuredPosPayment = effectiveMethod.accountKey
    ? configuredCashSale[effectiveMethod.accountKey as keyof typeof configuredCashSale] || configuredCashSale.cash
    : bankPayment;
  const isPos = flow === 'pos';
  const effectivePayment = isPos ? configuredPosPayment : configuredPayment;
  const effectiveIncome = isPos ? configuredCashSale.income : configuredInvoice.income;
  const effectiveVat = isPos ? configuredCashSale.ivaPayable : configuredInvoice.ivaPayable;

  const summary = flow === 'order'
    ? 'Orden de venta: no genera asiento contable.'
    : flow === 'pos'
      ? `POS: un asiento por el total · ${effectiveMethod.label} → ${effectivePayment.code}; Ingresos netos + IVA + salida de inventario.`
      : flow === 'return'
        ? 'Devolución: aplica el ajuste configurado al procesarse.'
        : flow === 'creditNote'
          ? `Crédito directo: un asiento → CxC, reversión de ingresos netos, IVA y entrada de inventario (${configuredCredit.income.code}).`
          : method
            ? `Factura: un asiento por el total · ${method.label} → ${effectivePayment.code}; Ingresos netos + IVA + salida de inventario.`
            : `Factura: un asiento por el total con CxC, IVA y salida de inventario; cada cobro posterior cancela CxC.`;

  return (
    <div className={`flex min-w-0 items-center gap-2 rounded-xl border border-border/40 bg-muted/10 px-3 py-2 ${compact ? '' : 'text-xs'}`}>
      <BookOpenCheck className="size-3.5 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
        <span className="font-black uppercase tracking-wider text-foreground">Contabilidad:</span>{' '}
        {isLoading ? 'Consultando cuentas configuradas…' : summary}
      </p>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0 rounded-lg" aria-label="Ver explicación contable">
            {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Info className="size-3.5" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(390px,calc(100vw-2rem))] p-4">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest">Explicación contable</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                Las cuentas se toman de Contabilidad · Configuración. No se seleccionan manualmente en Ventas.
              </p>
            </div>

            {flow === 'order' ? (
              <p className="rounded-lg bg-muted/30 p-2.5 text-[10px] leading-relaxed text-muted-foreground">
                La orden de venta es un documento comercial previo. No genera asiento. Al convertirla en factura, se reconoce la venta en CxC, IVA, Ingresos por Ventas netos del costo y salida de inventario; los cobros posteriores cancelan CxC.
              </p>
            ) : (
              <>
                {flow !== 'pos' && flow !== 'return' && flow !== 'creditNote' && (
                  <div>
                    <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Factura · un solo asiento al reconocer la venta</p>
                    <AccountLine label={method ? `Cobro · ${method.label}` : 'Cuentas por Cobrar'} side="debit" account={method ? effectivePayment : configuredInvoice.receivable} />
                    <AccountLine label="Ingresos por Ventas · netos del costo" side="credit" account={configuredInvoice.income} />
                    <AccountLine label="IVA por pagar" side="credit" account={configuredInvoice.ivaPayable} />
                    <AccountLine label="Inventario · cuenta del almacén" side="credit" account={{ code: 'ALMACÉN', name: 'Cuenta configurada en el almacén' }} />
                    {!method && <p className="mt-2 text-[10px] text-muted-foreground">El cobro posterior genera únicamente la cancelación de CxC.</p>}
                  </div>
                )}
                {flow === 'pos' && (
                  <div>
                    <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Facturación por Caja · asiento comercial</p>
                    <AccountLine label={`Cobro · ${method?.label || 'método registrado al pagar'}`} side="debit" account={effectivePayment} />
                    <AccountLine label="Ingresos por Ventas · netos del costo" side="credit" account={effectiveIncome} />
                    <AccountLine label="IVA por pagar" side="credit" account={effectiveVat} />
                    <AccountLine label="Inventario · cuenta del almacén" side="credit" account={{ code: 'ALMACÉN', name: 'Cuenta configurada en el almacén' }} />
                  </div>
                )}
                {flow === 'return' ? (
                  <div>
                    <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Devolución procesada · asiento comercial</p>
                    <AccountLine label="Devoluciones · netas del costo" side="debit" account={configuredReturn.returns} />
                    <AccountLine label="Cuenta por cobrar" side="credit" account={configuredReturn.receivable} />
                    <AccountLine label="IVA por pagar" side="debit" account={configuredReturn.ivaPayable} />
                    <AccountLine label="Entrada a Inventario" side="debit" account={{ code: 'ALMACÉN', name: 'Cuenta configurada en el almacén' }} />
                    <AccountLine label="Pérdida si se descarta" side="debit" account={configuredReturn.loss} />
                  </div>
                ) : flow === 'creditNote' ? (
                  <div>
                    <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Crédito directo · asiento comercial</p>
                    <AccountLine label="Disminución de Cuentas por Cobrar" side="credit" account={configuredCredit.receivable} />
                    <AccountLine label="Reversión de Ingresos · neta del costo" side="debit" account={configuredCredit.income} />
                    <AccountLine label="IVA por pagar" side="credit" account={configuredCredit.ivaPayable} />
                    <AccountLine label="Entrada de Inventario · almacén" side="debit" account={{ code: 'ALMACÉN', name: 'Cuenta configurada en el almacén' }} />
                  </div>
                ) : null}
                <p className="rounded-lg bg-muted/30 p-2.5 text-[10px] leading-relaxed text-muted-foreground">
                  {flow === 'pos'
                    ? 'En facturación por caja, la factura nace pagada y usa las cuentas globales configuradas. El costo de los productos reduce Ingresos por Ventas y la salida de inventario queda en el mismo asiento.'
                    : flow === 'return'
                      ? 'La devolución usa un solo asiento: reduce CxC, separa IVA, resta el costo de la cuenta de devoluciones y carga lo reintegrado al almacén o lo descartado a Pérdida.'
                      : flow === 'creditNote'
                        ? 'El crédito directo usa un solo asiento: disminuye CxC, revierte IVA e ingresos por el importe neto del costo y carga la entrada de inventario.'
                      : 'El asiento conserva el total comercial. En productos, el costo real se resta de Ingresos por Ventas y la salida de inventario se incluye en el mismo asiento; el cobro posterior solo cancela CxC.'}
                </p>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
