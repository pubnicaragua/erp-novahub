import { CheckCircle2, Printer } from 'lucide-react';
import type { PaymentReceived } from '../../types';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { paymentMethodLabel } from '../../utils/paymentMethods';

interface SalesPaymentReceiptDialogProps {
  payment: PaymentReceived | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
  onPrint: () => void | Promise<void>;
  title?: string;
}

export function SalesPaymentReceiptDialog({
  payment,
  open,
  onOpenChange,
  formatAmount,
  onPrint,
  title = 'Pago registrado',
}: SalesPaymentReceiptDialogProps) {
  if (!payment) return null;

  const rows = payment.payments?.length ? payment.payments : [payment];
  const documentNumber = payment.invoice?.number || payment.creditNote?.number;
  const documentLabel = payment.invoice?.number
    ? 'Factura'
    : payment.creditNote?.number
      ? 'Crédito'
      : payment.balanceApplicationType === 'GENERAL_BALANCE'
        ? 'Saldo general del cliente'
        : 'Anticipo';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
            <CheckCircle2 className="size-5 text-emerald-600" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {payment.number || 'Comprobante de pago'} · El ticket está listo para imprimirse.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monto recibido</p>
            <p className="mt-1 text-3xl font-black tabular-nums text-primary">
              {formatAmount(Number((payment as any).total ?? payment.amount ?? 0), payment.currency, payment.exchangeRate)}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">{payment.customer?.name || 'Cliente'}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/50 bg-background/60 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Fecha</p>
              <p className="mt-1 text-sm font-bold">{payment.date ? new Date(payment.date).toLocaleDateString('es-NI') : '—'}</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/60 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Documento aplicado</p>
              <p className="mt-1 break-words text-sm font-bold">{documentNumber || documentLabel}</p>
            </div>
          </div>

          <div className="space-y-2 rounded-2xl border border-border/50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Detalle del pago</p>
            {rows.map((row, index) => (
              <div key={row.id || `${row.method}-${index}`} className="flex min-w-0 items-start justify-between gap-3 border-t border-border/40 pt-2 first:border-t-0 first:pt-0">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{paymentMethodLabel(String(row.method || payment.method || '').toUpperCase())}</p>
                  {row.reference && <p className="break-words text-xs text-muted-foreground">Referencia: {row.reference}</p>}
                </div>
                <p className="shrink-0 text-sm font-black tabular-nums">
                  {formatAmount(Number(row.amount || 0), row.currency || payment.currency, row.exchangeRate || payment.exchangeRate)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button type="button" onClick={() => void onPrint()} className="gap-2 font-black">
            <Printer className="size-4" /> Imprimir ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
