import { useState } from 'react';
import { Clock3, Download, Eye, FileText, History, Printer, UserRound } from 'lucide-react';
import type { Invoice } from '../../types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { AuditHistoryModal } from '../ui/AuditHistoryModal';

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
  onDownloadPdf: (invoice: Invoice) => void;
  onPrintInvoice?: (invoice: Invoice) => void;
  getBalance: (invoice: Invoice) => number;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
  formatDate: (date: string) => string;
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING: 'Pendiente',
  CREDIT: 'A crédito',
  PAID: 'Pagada',
  CANCELLED: 'Anulada',
  OVERDUE: 'Vencida',
  PARTIAL: 'Pago parcial',
};

const statusClasses: Record<string, string> = {
  DRAFT: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  CREDIT: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  PAID: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  CANCELLED: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
  OVERDUE: 'bg-orange-500/10 text-orange-600 dark:text-orange-300',
  PARTIAL: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
};

const paymentMethodLabels: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  CHECK: 'Cheque',
};

export function InvoiceDetailSheet({
  invoice,
  sourceBadge,
  open,
  onClose,
  onOpenInvoice,
  onDownloadPdf,
  onPrintInvoice,
  getBalance,
  formatAmount,
  formatDate,
}: InvoiceDetailSheetProps) {
  const [activeTab, setActiveTab] = useState('general');

  if (!invoice) return null;

  const status = String(invoice.status || '').toUpperCase();
  const balance = getBalance(invoice);

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
            <Badge className={`border-none px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusClasses[status] || 'bg-muted text-muted-foreground'}`}>
              {statusLabels[status] || invoice.status || 'Sin estado'}
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
              <span>Moneda: <strong className="text-foreground">{invoice.currency || 'NIO'}</strong></span>
            </div>
          </section>

          <section className="grid gap-2 sm:grid-cols-3">
            <Button type="button" variant="outline" className="justify-start gap-2 rounded-xl" onClick={() => onOpenInvoice(invoice)}>
              <Eye className="size-4 text-primary" /> Ver factura completa
            </Button>
            <Button type="button" variant="outline" className="justify-start gap-2 rounded-xl" onClick={() => onDownloadPdf(invoice)}>
              <Download className="size-4 text-primary" /> Descargar PDF
            </Button>
            <Button type="button" variant="outline" className="justify-start gap-2 rounded-xl" onClick={() => onPrintInvoice?.(invoice)}>
              <Printer className="size-4 text-primary" /> Imprimir
            </Button>
          </section>

          <section className="rounded-2xl border border-border/50 p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Información general</p>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex min-w-0 gap-2"><UserRound className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0"><p className="text-[10px] text-muted-foreground">Cliente</p><p className="mt-1 break-words font-semibold">{invoice.customer?.name || 'Varios'}</p></div></div>
              <div className="flex min-w-0 gap-2"><Clock3 className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0"><p className="text-[10px] text-muted-foreground">Fecha de emisión</p><p className="mt-1 font-semibold">{formatDate(invoice.date)}</p></div></div>
              <div><p className="text-[10px] text-muted-foreground">Vencimiento</p><p className="mt-1 font-semibold">{formatDate(invoice.dueDate)}</p></div>
              <div><p className="text-[10px] text-muted-foreground">Forma de pago</p><p className="mt-1 font-semibold">{paymentMethodLabels[String(invoice.paymentMethod || '').toUpperCase()] || invoice.paymentMethod || 'Sin especificar'}</p></div>
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
                    <p className="mt-1 text-xs text-muted-foreground">{Number(item.quantity || 0)} × {formatAmount(Number(item.unitPrice || 0), invoice.currency, invoice.exchangeRate)}</p>
                  </div>
                  <p className="shrink-0 text-sm font-black tabular-nums">{formatAmount(Number(item.total || 0), invoice.currency, invoice.exchangeRate)}</p>
                </div>
              )) : <p className="text-sm text-muted-foreground">No hay líneas de detalle disponibles.</p>}
            </div>
          </section>

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
                    <span className="text-right text-xs text-muted-foreground">{statusLabels[String(credit.status).toUpperCase()] || credit.status} · {formatAmount(Number(credit.total || 0), invoice.currency, invoice.exchangeRate)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
            </TabsContent>

            <TabsContent value="historial" className="mt-0 outline-none">
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
