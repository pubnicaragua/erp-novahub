import { useState } from 'react';
import { Clock3, Eye, FileText, History, UserRound, Wallet } from 'lucide-react';
import type { Invoice, PaymentReceived } from '../../types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { AuditHistoryModal } from '../ui/AuditHistoryModal';
import { PdfDownloadButton } from '../ui/PdfDownloadButton';
import type { PdfDownloadFormat } from '../../utils/pdfDownloadFormats';
import { getSalesInvoiceStatusColor } from '../../utils/salesStatus';
import { getSalesAdditionalCharges } from '../../utils/salesCharges';
import { getInvoicePaymentPresentation } from '../../utils/paymentMethods';

type InvoiceSourceBadge = {
  label: string;
  className: string;
} | null;

interface InvoiceDetailSheetProps {
  invoice: Invoice | null;
  sourceBadge: InvoiceSourceBadge;
  open: boolean;
  onClose: () => void;
  onOpenInvoice: (invoice: Invoice) => void;
  onDownloadPdf: (invoice: Invoice, format: PdfDownloadFormat) => void;
  onDownloadPayment: (payment: PaymentReceived, invoice: Invoice, format: PdfDownloadFormat, remainingOverride?: number) => void;
  getPaymentRemaining: (payment: PaymentReceived, invoice: Invoice) => number;
  getBalance: (invoice: Invoice) => number;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
  formatDate: (date: string) => string;
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING: 'En proceso',
  CREDIT: 'A crédito',
  PAID: 'Pagada',
  CANCELLED: 'Anulada',
  OVERDUE: 'Vencida',
  PARTIAL: 'Pago parcial',
  ISSUED: 'Emitida',
  APPLIED: 'Aplicada',
  VOIDED: 'Anulada',
};

const creditStatusLabel = (status?: string) => String(status || '').toUpperCase() === 'PAID'
  ? 'Cancelado'
  : statusLabels[String(status || '').toUpperCase()] || 'Registrada';

const paymentMethodLabels: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  CHECK: 'Cheque',
  CREDIT: 'Crédito',
  MIXED: 'Pago mixto',
  OTHER: 'Otro',
};

const currencyLabels: Record<string, string> = {
  NIO: 'Córdobas (NIO)',
  USD: 'Dólares (USD)',
};

export function InvoiceDetailSheet({
  invoice,
  sourceBadge,
  open,
  onClose,
  onOpenInvoice,
  onDownloadPdf,
  onDownloadPayment,
  getPaymentRemaining,
  getBalance,
  formatAmount,
  formatDate,
}: InvoiceDetailSheetProps) {
  const [activeTab, setActiveTab] = useState('general');

  if (!invoice) return null;

  const status = String(invoice.status || '').toUpperCase();
  const balance = getBalance(invoice);
  const paymentPresentation = getInvoicePaymentPresentation(invoice);
  const additionalCharges = getSalesAdditionalCharges(invoice);

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <SheetContent side="right" className="flex w-full min-w-0 flex-col gap-0 border-l border-border/50 bg-background p-0 sm:max-w-xl">
        <SheetHeader className="sticky top-0 z-10 space-y-3 border-b border-border/50 bg-background/95 px-5 py-5 pr-12 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="size-5" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate text-lg font-black uppercase tracking-tight">Detalle de factura</SheetTitle>
              <SheetDescription className="mt-1 truncate text-xs">{invoice.number} · {invoice.customer?.name || 'Varios'}</SheetDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <Badge className={`border-none px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${getSalesInvoiceStatusColor(status)}`}>
              {statusLabels[status] || 'Sin estado'}
            </Badge>
            {sourceBadge && <Badge className={`border-none px-2 py-0.5 text-[10px] font-black ${sourceBadge.className}`}>{sourceBadge.label}</Badge>}
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="h-10 w-full justify-start overflow-x-auto rounded-xl border border-border/40 bg-muted/40 p-1 font-bold text-xs">
              <TabsTrigger value="general" className="shrink-0 gap-1.5 rounded-lg px-3 py-1 text-xs font-bold"><FileText className="size-3.5" /> General</TabsTrigger>
              <TabsTrigger value="historial" className="shrink-0 gap-1.5 rounded-lg px-3 py-1 text-xs font-bold"><History className="size-3.5" /> Historial</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-0 space-y-4 outline-none">
          <section className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total de la factura</p>
                <p className="mt-1 text-3xl font-black tabular-nums text-primary">{formatAmount(Number(invoice.total || 0), invoice.currency, invoice.exchangeRate)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Saldo pendiente</p>
                <p className={`mt-1 text-xl font-black tabular-nums ${balance > 0.01 ? 'text-orange-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {formatAmount(balance, invoice.currency, invoice.exchangeRate)}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span>Pagado: <strong className="text-foreground">{formatAmount(Number(invoice.amountPaid || 0), invoice.currency, invoice.exchangeRate)}</strong></span>
              <span>Moneda: <strong className="text-foreground">{currencyLabels[String(invoice.currency || 'NIO').toUpperCase()] || 'No especificada'}</strong></span>
            </div>
          </section>

          <section className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="gap-2 rounded-xl text-xs" onClick={() => onOpenInvoice(invoice)}>
              <Eye className="size-4 shrink-0 text-primary" /> Ver factura completa
            </Button>
            <PdfDownloadButton onDownload={(format) => onDownloadPdf(invoice, format)} />
          </section>

          <section className="rounded-2xl border border-border/50 p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Información general</p>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex min-w-0 gap-2"><UserRound className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0"><p className="text-[10px] text-muted-foreground">Cliente</p><p className="mt-1 break-words font-semibold">{invoice.customer?.name || 'Varios'}</p></div></div>
              <div className="flex min-w-0 gap-2"><Clock3 className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0"><p className="text-[10px] text-muted-foreground">Fecha de emisión</p><p className="mt-1 font-semibold">{formatDate(invoice.date)}</p></div></div>
              <div><p className="text-[10px] text-muted-foreground">Vencimiento</p><p className="mt-1 font-semibold">{formatDate(invoice.dueDate)}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Modalidad / forma de pago</p><p className="mt-1 font-semibold">{paymentPresentation.modalityLabel}{paymentPresentation.methodLabel ? ` · ${paymentPresentation.methodLabel}` : ''}</p></div>
              {invoice.sourceLabel && <div><p className="text-[10px] text-muted-foreground">Origen</p><p className="mt-1 break-words font-semibold">{invoice.sourceLabel}</p></div>}
            </div>
          </section>

          <section className="rounded-2xl border border-border/50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Productos y servicios</p>
              <span className="text-xs font-bold text-muted-foreground">{invoice.items?.length || 0} línea{invoice.items?.length === 1 ? '' : 's'}</span>
            </div>
            <div className="divide-y divide-border/50">
              {invoice.items?.length ? invoice.items.map((item) => (
                <div key={item.id} className="flex min-w-0 items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-foreground">{item.description || 'Artículo sin descripción'}</p>
                    {item.commercialNoteSnapshot && <p className="mt-1 break-words text-[11px] text-primary/80">Nota: {item.commercialNoteSnapshot}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{Number(item.quantity || 0)} × {formatAmount(Number(item.unitPrice || 0), invoice.currency, invoice.exchangeRate)}</p>
                  </div>
                  <p className="shrink-0 text-sm font-black tabular-nums">{formatAmount(Number(item.total || 0), invoice.currency, invoice.exchangeRate)}</p>
                </div>
              )) : <p className="text-sm text-muted-foreground">No hay líneas de detalle disponibles.</p>}
            </div>
          </section>

          {additionalCharges.length > 0 && (
            <section className="rounded-2xl border border-border/50 bg-muted/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cargos adicionales</p>
              <div className="mt-3 space-y-2 text-sm">
                {additionalCharges.map((charge) => (
                  <div key={charge.id} className="flex justify-between gap-3"><span className="text-muted-foreground">{charge.description}</span><span className="font-bold tabular-nums">{formatAmount(charge.amount, invoice.currency, invoice.exchangeRate)}</span></div>
                ))}
              </div>
            </section>
          )}

          {invoice.notes && (
            <section className="rounded-2xl border border-border/50 bg-muted/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notas</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{invoice.notes}</p>
            </section>
          )}

          {!!invoice.creditNotes?.length && (
            <section className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-300">Notas de crédito relacionadas</p>
              <div className="mt-3 space-y-2">
                {invoice.creditNotes.map((credit) => (
                  <div key={credit.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold">{credit.number}</span>
                    <span className="text-right text-xs text-muted-foreground">{creditStatusLabel(credit.status)} · {formatAmount(Number(credit.total || 0), invoice.currency, invoice.exchangeRate)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
            </TabsContent>

            <TabsContent value="historial" className="mt-0 outline-none">
              <section className="mb-4 rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pagos recibidos</p>
                  <span className="text-[10px] font-black text-primary">{invoice.payments?.length || 0} registro{invoice.payments?.length === 1 ? '' : 's'}</span>
                </div>
                {invoice.payments?.length ? (
                  <div className="mt-3 space-y-2">
                    {invoice.payments.map((payment) => {
                      const remainingAfterPayment = getPaymentRemaining(payment, invoice);
                      const paidAfterPayment = Math.max(0, Number((Number(invoice.total || 0) - remainingAfterPayment).toFixed(2)));
                      const isCreditPayment = Boolean(payment.creditNoteId || payment.creditNote || (payment as any).creditNoteNumber);
                      const paymentStatus = isCreditPayment && remainingAfterPayment <= 0.01
                        ? { label: 'Cancelado', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-300' }
                        : remainingAfterPayment > 0.01
                          ? { label: 'Saldo pendiente', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-300' }
                          : { label: 'Liquidado', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' };
                      return (
                        <div key={payment.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-border/50 bg-background/70 p-3">
                          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Wallet className="size-4" /></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="font-black">{payment.number}</span>
                              <span className="font-black tabular-nums text-emerald-600 dark:text-emerald-400">{formatAmount(Number(payment.amount || 0), payment.currency, payment.exchangeRate)}</span>
                            </div>
                            <p className="mt-1 break-words text-[10px] text-muted-foreground">{formatDate(payment.date)} · {paymentMethodLabels[String(payment.method || '').toUpperCase()] || 'Sin especificar'}{payment.reference ? ` · Ref. ${payment.reference}` : ''}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                              <span>Abonado acumulado: <strong className="text-foreground">{formatAmount(paidAfterPayment, invoice.currency, invoice.exchangeRate)}</strong></span>
                              <span>Saldo después: <strong className={remainingAfterPayment > 0.01 ? 'text-orange-500' : 'text-emerald-600 dark:text-emerald-400'}>{formatAmount(remainingAfterPayment, invoice.currency, invoice.exchangeRate)}</strong></span>
                            </div>
                            <Badge className={`mt-2 border-none px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${paymentStatus.className}`}>{paymentStatus.label}</Badge>
                          </div>
                          <PdfDownloadButton onDownload={(format) => onDownloadPayment(payment, invoice, format, remainingAfterPayment)} />
                        </div>
                      );
                    })}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                      <span className="text-xs font-bold text-muted-foreground">Descargar historial completo de pagos</span>
                      <PdfDownloadButton onDownload={(format) => onDownloadPayment({ ...invoice.payments![0], payments: invoice.payments } as PaymentReceived, invoice, format)} />
                    </div>
                  </div>
                ) : <p className="mt-3 text-sm text-muted-foreground">Todavía no hay pagos recibidos para esta factura.</p>}
              </section>
              <AuditHistoryModal
                isOpen={activeTab === 'historial'}
                onClose={() => setActiveTab('general')}
                entity="INVOICE"
                entityId={invoice.id}
                title="Historial de la factura"
                presentation="inline"
              />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
