import { BookOpenCheck, Info, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { contabilidadService } from '../../services/contabilidad.service';
import { useAccountingQuery } from '../../hooks/useAccountingQuery';

export type SalesAccountingFlow = 'order' | 'invoice' | 'recentInvoice' | 'return' | 'creditNote' | 'pos';

type AccountReference = {
  code?: string;
  name?: string;
};

type SalesAccountingLegendProps = {
  flow: SalesAccountingFlow;
  paymentMethod?: string | null;
  cashAccount?: AccountReference | null;
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
    card: { code: '1010', name: 'Bancos - Tarjetas' },
    transfer: { code: '1020', name: 'Bancos - Transferencias' },
    check: { code: '1030', name: 'Cheques por Depositar' },
    other: { code: '1090', name: 'Otros Medios de Cobro' },
    receivable: { code: '1100', name: 'Cuentas por Cobrar' },
  },
  saleReturn: {
    returns: { code: '4100', name: 'Devoluciones y Descuentos' },
    receivable: { code: '1100', name: 'Cuentas por Cobrar' },
  },
  creditNote: {
    returns: { code: '4100', name: 'Devoluciones y Descuentos' },
    receivable: { code: '1100', name: 'Cuentas por Cobrar' },
  },
};

const PAYMENT_METHODS: Record<string, { label: string; accountKey: string }> = {
  CASH: { label: 'Efectivo', accountKey: 'cash' },
  CARD: { label: 'Tarjeta', accountKey: 'card' },
  TRANSFER: { label: 'Transferencia', accountKey: 'transfer' },
  CHECK: { label: 'Cheque', accountKey: 'check' },
  OTHER: { label: 'Otro medio', accountKey: 'other' },
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

export function SalesAccountingLegend({ flow, paymentMethod, cashAccount, compact = true }: SalesAccountingLegendProps) {
  const { data, isLoading } = useAccountingQuery<any>(
    ['sales-accounting-mappings'],
    (signal) => contabilidadService.getSuggestedAccounts(signal),
  );
  const mappings = data?.mappings || {};
  const invoiceAccounts = DEFAULT_ACCOUNTS.invoice;
  const configuredInvoice = {
    receivable: normalizeAccount(mappings?.invoice?.receivable, invoiceAccounts.receivable),
    income: normalizeAccount(mappings?.invoice?.income, invoiceAccounts.income),
    ivaPayable: normalizeAccount(mappings?.invoice?.ivaPayable, invoiceAccounts.ivaPayable),
  };
  const configuredReturn = {
    returns: normalizeAccount(mappings?.[flow === 'creditNote' ? 'creditNote' : 'saleReturn']?.returns, DEFAULT_ACCOUNTS[flow === 'creditNote' ? 'creditNote' : 'saleReturn'].returns),
    receivable: normalizeAccount(mappings?.[flow === 'creditNote' ? 'creditNote' : 'saleReturn']?.receivable, DEFAULT_ACCOUNTS[flow === 'creditNote' ? 'creditNote' : 'saleReturn'].receivable),
  };
  const method = PAYMENT_METHODS[String(paymentMethod || 'CASH').toUpperCase()] || PAYMENT_METHODS.CASH;
  const configuredPayment = normalizeAccount(mappings?.payment?.[method.accountKey], DEFAULT_ACCOUNTS.payment[method.accountKey]);
  const effectivePayment = method.accountKey === 'cash' && cashAccount?.code
    ? normalizeAccount(cashAccount, configuredPayment)
    : configuredPayment;

  const summary = flow === 'order'
    ? 'Orden de venta: no genera asiento contable.'
    : flow === 'pos'
      ? `POS: factura pagada · ${method.label} → ${effectivePayment.code}.`
      : flow === 'return'
        ? 'Devolución: aplica el ajuste configurado al procesarse.'
        : flow === 'creditNote'
          ? 'Nota de crédito: aplica el ajuste al emitirse.'
          : `Factura: sin asiento hasta pagar · ${method.label} → ${effectivePayment.code}.`;

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
                La orden de venta es un documento comercial previo. No genera asiento. Al convertirla en factura, la factura permanece sin asiento hasta quedar completamente pagada.
              </p>
            ) : (
              <>
                {flow !== 'pos' && flow !== 'return' && flow !== 'creditNote' && (
                  <div>
                    <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Factura cuando queda pagada</p>
                    <AccountLine label="Cuenta por cobrar" side="debit" account={configuredInvoice.receivable} />
                    <AccountLine label="Ingresos" side="credit" account={configuredInvoice.income} />
                    <AccountLine label="IVA por pagar" side="credit" account={configuredInvoice.ivaPayable} />
                  </div>
                )}
                {flow === 'pos' && (
                  <div>
                    <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Factura de caja, nace pagada</p>
                    <AccountLine label="Cuenta por cobrar" side="debit" account={configuredInvoice.receivable} />
                    <AccountLine label="Ingresos" side="credit" account={configuredInvoice.income} />
                    <AccountLine label="IVA por pagar" side="credit" account={configuredInvoice.ivaPayable} />
                  </div>
                )}
                {flow === 'return' || flow === 'creditNote' ? (
                  <div>
                    <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ajuste configurado</p>
                    <AccountLine label="Devoluciones" side="debit" account={configuredReturn.returns} />
                    <AccountLine label="Cuenta por cobrar" side="credit" account={configuredReturn.receivable} />
                  </div>
                ) : null}
                {(flow === 'invoice' || flow === 'pos') && (
                  <div>
                    <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cobro · {method.label}</p>
                    <AccountLine label="Caja / bancos" side="debit" account={effectivePayment} />
                    <AccountLine label="Cuenta por cobrar" side="credit" account={normalizeAccount(mappings?.payment?.receivable, DEFAULT_ACCOUNTS.payment.receivable)} />
                  </div>
                )}
                <p className="rounded-lg bg-muted/30 p-2.5 text-[10px] leading-relaxed text-muted-foreground">
                  {flow === 'pos'
                    ? 'En facturación por caja, la factura y el cobro se registran porque la operación nace pagada.'
                    : flow === 'return' || flow === 'creditNote'
                      ? 'El asiento se genera conforme al estado y acción contable de la devolución o nota.'
                      : 'Una factura pendiente no genera asiento. Al registrarse el pago total, se generan la factura y su cobro usando la cuenta de la forma de pago.'}
                </p>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
