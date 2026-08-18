import { useState } from 'react';
import { CalendarDays, Download, Eye, FileText, History, UserRound } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { AuditHistoryModal } from '../ui/AuditHistoryModal';

export interface SalesDocumentPanelLine {
  id: string;
  description: string;
  quantity?: number;
  unitPriceLabel?: string;
  totalLabel?: string;
}

export interface SalesDocumentPanelMeta {
  label: string;
  value: string;
}

export interface SalesDocumentPanelData {
  id: string;
  number: string;
  title: string;
  customerName: string;
  status: string;
  sourceLabel?: string;
  totalLabel: string;
  summaryDetails?: SalesDocumentPanelMeta[];
  metadata?: SalesDocumentPanelMeta[];
  lines?: SalesDocumentPanelLine[];
  notes?: string;
  reason?: string;
}

interface SalesDocumentDetailSheetProps {
  document: SalesDocumentPanelData | null;
  entity: string;
  open: boolean;
  onClose: () => void;
  onOpenDocument: () => void;
  onDownloadPdf: () => void;
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviada',
  PENDING_REVIEW: 'Pendiente de revisión',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En proceso',
  SHIPPED: 'Enviada',
  DELIVERED: 'Entregada',
  ACTIVE: 'Activa',
  PAUSED: 'Pausada',
  EXPIRED: 'Vencida',
  APPROVED: 'Aprobada',
  PROCESSED: 'Aplicada',
  REJECTED: 'Rechazada',
  ISSUED: 'Emitida',
  PARTIAL: 'Pago parcial',
  APPLIED: 'Aplicada',
  PAID: 'Pagada',
  VOIDED: 'Anulada',
  CANCELLED: 'Cancelada',
};

const statusClasses: Record<string, string> = {
  DRAFT: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  SENT: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  PENDING_REVIEW: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  CONFIRMED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  IN_PROGRESS: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  SHIPPED: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  DELIVERED: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  ACTIVE: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  PAUSED: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  EXPIRED: 'bg-orange-500/10 text-orange-600 dark:text-orange-300',
  APPROVED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  PROCESSED: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  REJECTED: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
  ISSUED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  PARTIAL: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  APPLIED: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  PAID: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  VOIDED: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
  CANCELLED: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
};

export function SalesDocumentDetailSheet({
  document,
  entity,
  open,
  onClose,
  onOpenDocument,
  onDownloadPdf,
}: SalesDocumentDetailSheetProps) {
  const [activeTab, setActiveTab] = useState('general');

  if (!document) return null;

  const status = String(document.status || '').toUpperCase();
  const statusLabel = statusLabels[status] || document.status || 'Sin estado';

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <SheetContent side="right" className="flex w-full min-w-0 flex-col gap-0 border-l border-border/50 bg-background p-0 sm:max-w-xl">
        <SheetHeader className="sticky top-0 z-10 space-y-3 border-b border-border/50 bg-background/95 px-5 py-5 pr-12 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="size-5" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate text-lg font-black uppercase tracking-tight">Detalle de {document.title.toLowerCase()}</SheetTitle>
              <SheetDescription className="mt-1 truncate text-xs">{document.number} · {document.customerName}</SheetDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={`border-none px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusClasses[status] || 'bg-muted text-muted-foreground'}`}>
              {statusLabel}
            </Badge>
            {document.sourceLabel && <Badge className="border-none bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">{document.sourceLabel}</Badge>}
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
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total del documento</p>
                <p className="mt-1 text-3xl font-black tabular-nums text-primary">{document.totalLabel}</p>
                {!!document.summaryDetails?.length && (
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                    {document.summaryDetails.map((detail) => (
                      <span key={`${detail.label}-${detail.value}`}>{detail.label}: <strong className="text-foreground">{detail.value}</strong></span>
                    ))}
                  </div>
                )}
              </section>

              <section className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" className="justify-start gap-2 rounded-xl" onClick={onOpenDocument}>
                  <Eye className="size-4 text-primary" /> Ver {document.title.toLowerCase()} completa
                </Button>
                <Button type="button" variant="outline" className="justify-start gap-2 rounded-xl" onClick={onDownloadPdf}>
                  <Download className="size-4 text-primary" /> Descargar PDF
                </Button>
              </section>

              <section className="rounded-2xl border border-border/50 p-4">
                <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Información general</p>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex min-w-0 gap-2"><UserRound className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0"><p className="text-[10px] text-muted-foreground">Cliente</p><p className="mt-1 break-words font-semibold">{document.customerName}</p></div></div>
                  {!!document.metadata?.length && document.metadata.map((detail) => (
                    <div key={`${detail.label}-${detail.value}`} className="flex min-w-0 gap-2"><CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0"><p className="text-[10px] text-muted-foreground">{detail.label}</p><p className="mt-1 break-words font-semibold">{detail.value}</p></div></div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-border/50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Productos y servicios</p>
                  <span className="text-xs font-bold text-muted-foreground">{document.lines?.length || 0} línea{document.lines?.length === 1 ? '' : 's'}</span>
                </div>
                <div className="divide-y divide-border/50">
                  {document.lines?.length ? document.lines.map((line) => (
                    <div key={line.id} className="flex min-w-0 items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-foreground">{line.description || 'Artículo sin descripción'}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{line.quantity ?? 0}{line.unitPriceLabel ? ` × ${line.unitPriceLabel}` : ''}</p>
                      </div>
                      {line.totalLabel && <p className="shrink-0 text-sm font-black tabular-nums">{line.totalLabel}</p>}
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No hay líneas de detalle disponibles.</p>}
                </div>
              </section>

              {(document.notes || document.reason) && (
                <section className="rounded-2xl border border-border/50 bg-muted/10 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{document.reason ? 'Motivo' : 'Notas'}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">{document.reason || document.notes}</p>
                </section>
              )}
            </TabsContent>

            <TabsContent value="historial" className="mt-0 outline-none">
              <AuditHistoryModal
                isOpen={activeTab === 'historial'}
                onClose={() => setActiveTab('general')}
                entity={entity}
                entityId={document.id}
                title={`Historial de ${document.title.toLowerCase()}`}
                presentation="inline"
              />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
