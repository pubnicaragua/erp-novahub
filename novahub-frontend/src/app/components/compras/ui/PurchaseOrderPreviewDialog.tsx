"use client";

import { useEffect, useMemo, useState } from 'react';
import { Ban, CalendarDays, CheckCircle2, FileDown, History, Info, UserRound } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '../../ui/sheet';
import { cn } from '../../ui/utils';
import { api } from '../../../services/api';
import type { PurchaseOrder, Supplier } from '../../../types';
import { getPurchaseOrderStatusOption, normalizePurchaseOrderStatus, PURCHASE_ORDER_ACTIONABLE_STATUSES } from '../../../utils/purchaseOrderStatus';

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  STATUS_CHANGE: 'Cambio de estado',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING: 'En proceso',
  IN_PROCESS: 'En proceso',
  APPROVED: 'Aprobada',
  CANCELLED: 'Rechazada',
  REJECTED: 'Rechazada',
};

const HISTORY_KEY_LABELS: Record<string, string> = {
  number: 'Número',
  status: 'Estado',
  from: 'Estado anterior',
  to: 'Estado nuevo',
  reason: 'Motivo',
  invoiceNumber: 'Factura',
  invoiceStatus: 'Estado de la factura',
  purchaseOrderId: 'Orden de compra',
  origin: 'Origen',
};

const HISTORY_VALUE_LABELS: Record<string, string> = {
  ...STATUS_LABELS,
  PURCHASE_REQUEST: 'Desde solicitud de compra',
  PURCHASE_ORDER: 'Desde orden de compra',
};

const formatAmount = (value: unknown) => new Intl.NumberFormat('es-NI', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value || 0));

const formatDate = (value: unknown) => value
  ? new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium' }).format(new Date(String(value)))
  : '—';

interface PurchaseOrderPreviewDialogProps {
  open: boolean;
  order: Partial<PurchaseOrder> | null;
  suppliers: Supplier[];
  canApprove: boolean;
  canCancel: boolean;
  approving?: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onCancel: (id: string) => void;
  onDownloadPdf?: () => void;
}

export function PurchaseOrderPreviewDialog({
  open,
  order,
  suppliers,
  canApprove,
  canCancel,
  approving = false,
  onClose,
  onApprove,
  onCancel,
  onDownloadPdf,
}: PurchaseOrderPreviewDialogProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const status = normalizePurchaseOrderStatus(order?.status);
  const statusMeta = getPurchaseOrderStatusOption(status);
  const supplier = order?.supplier || suppliers?.find((item) => item.id === order?.supplierId);
  const items = order?.items || [];
  const canApproveState = PURCHASE_ORDER_ACTIONABLE_STATUSES.includes(status);
  const isRejected = status === 'REJECTED';
  const currency = String(order?.currency || 'NIO').toUpperCase();
  const currencyPrefix = currency === 'USD' ? '$' : currency === 'NIO' ? 'C$' : currency;

  const originLabel = useMemo(() => {
    if (order?.purchaseRequestId || order?.purchaseRequestNumber) {
      return `Desde solicitud de compra${order.purchaseRequestNumber ? ` · ${order.purchaseRequestNumber}` : ''}`;
    }
    return 'Creada directamente como orden de compra';
  }, [order?.purchaseRequestId, order?.purchaseRequestNumber]);

  useEffect(() => {
    if (!open || !order?.id) {
      setHistory([]);
      return;
    }

    let active = true;
    setHistoryLoading(true);
    api.get<any[]>(`/audit/entity/PURCHASE_ORDER/${order.id}`)
      .then((result) => {
        if (active) setHistory(Array.isArray(result) ? result : []);
      })
      .catch(() => {
        if (active) setHistory([]);
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => { active = false; };
  }, [open, order?.id]);

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent side="right" className="erp-detail-panel erp-detail-panel--medium flex w-full min-w-0 flex-col gap-0 overflow-hidden border-l border-border/50 bg-background p-0">
        {order && (
          <>
            <SheetHeader className="sticky top-0 z-10 min-w-0 space-y-3 border-b border-border/50 bg-background/95 px-5 py-5 pr-12 backdrop-blur-md sm:px-6" data-tour="purchase-order-detail-title">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <CheckCircle2 className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="flex flex-wrap items-center gap-2 text-lg font-black uppercase tracking-tight">
                    Orden {order.number || 'de compra'}
                    <Badge variant="outline" className={cn('border-none text-[10px] font-black uppercase', statusMeta.color)}>
                      {statusMeta.label}
                    </Badge>
                  </SheetTitle>
                  <SheetDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span>{supplier?.name || 'Sin proveedor'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDate(order.date)}</span>
                  </SheetDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">{originLabel}</Badge>
                {order.requestedBy && <span>Solicitada por {order.requestedBy}</span>}
              </div>
            </SheetHeader>

            <div className="min-h-0 min-w-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto p-5 sm:p-6" data-tour="purchase-order-detail-data">
              <div className="grid min-w-0 grid-cols-1 gap-3 text-sm min-[480px]:grid-cols-2 sm:grid-cols-3">
                <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Proveedor</span>
                  <p className="mt-1 break-words font-semibold">{supplier?.name || '—'}</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Fecha</span>
                  <p className="mt-1 font-medium">{formatDate(order.date)}</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Entrega</span>
                  <p className="mt-1 font-medium">{formatDate(order.expectedDelivery)}</p>
                </div>
              </div>

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Detalle de artículos</h4>
                  <Badge variant="outline" className="text-[10px]">{items.length} artículos</Badge>
                </div>
                <div className="min-w-0 overflow-hidden rounded-2xl border border-border/50">
                  <div className="space-y-2 p-2">
                    {items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/50 bg-muted/10 p-5 text-center text-sm text-muted-foreground">
                        No hay artículos registrados.
                      </div>
                    ) : items.map((item: any, index: number) => {
                      const lineTotal = Number(item.total ?? Number(item.quantity || 0) * Number(item.unitPrice || 0));
                      const tax = Number(item.taxAmount ?? 0);
                      const subtotal = Number(item.taxBase ?? lineTotal - tax);
                      return (
                        <article key={item.id || index} className="min-w-0 rounded-xl border border-border/50 bg-card/60 p-3">
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-words font-mono text-[10px] text-muted-foreground">{item.code || 'Sin código'}</p>
                              <p className="mt-1 break-words text-sm font-semibold">{item.name || item.description || 'Artículo sin descripción'}</p>
                            </div>
                            <p className="shrink-0 text-right text-sm font-black text-primary">{currencyPrefix} {formatAmount(lineTotal)}</p>
                          </div>
                          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border/30 pt-3 text-xs">
                            <div className="min-w-0"><dt className="text-[10px] uppercase text-muted-foreground">Cantidad</dt><dd className="mt-0.5 font-medium">{Number(item.quantity || 0)}</dd></div>
                            <div className="min-w-0 text-right"><dt className="text-[10px] uppercase text-muted-foreground">P. unitario</dt><dd className="mt-0.5 break-words font-medium">{currencyPrefix} {formatAmount(item.unitPrice)}</dd></div>
                            <div className="min-w-0"><dt className="text-[10px] uppercase text-muted-foreground">Subtotal</dt><dd className="mt-0.5 break-words font-medium">{currencyPrefix} {formatAmount(subtotal)}</dd></div>
                            <div className="min-w-0 text-right"><dt className="text-[10px] uppercase text-muted-foreground">IVA</dt><dd className="mt-0.5 break-words font-medium">{currencyPrefix} {formatAmount(tax)}</dd></div>
                          </dl>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </section>

              <div className="grid min-w-0 grid-cols-1 gap-3 rounded-2xl border border-border/50 bg-card p-4 text-sm min-[480px]:grid-cols-2 sm:grid-cols-5" data-tour="purchase-order-detail-summary">
                <div><span className="text-[10px] font-bold uppercase text-muted-foreground">Subtotal</span><p className="mt-1 font-mono font-bold">{currencyPrefix} {formatAmount(order.subtotal)}</p></div>
                <div><span className="text-[10px] font-bold uppercase text-muted-foreground">IVA</span><p className="mt-1 font-mono font-bold">{currencyPrefix} {formatAmount(order.taxAmount)}</p></div>
                <div><span className="text-[10px] font-bold uppercase text-muted-foreground">Total bruto</span><p className="mt-1 font-mono font-bold">{currencyPrefix} {formatAmount(Number(order.subtotal || 0) + Number(order.taxAmount || 0))}</p></div>
                <div><span className="text-[10px] font-bold uppercase text-muted-foreground">IR retenido</span><p className="mt-1 font-mono font-bold text-amber-600">-{currencyPrefix} {formatAmount(order.withholdingTotal)}</p></div>
                <div><span className="text-[10px] font-bold uppercase text-muted-foreground">Neto a pagar</span><p className="mt-1 font-mono text-lg font-black text-primary">{currencyPrefix} {formatAmount(order.total)}</p></div>
              </div>

              {order.notes && <p className="rounded-xl border border-border/50 bg-muted/20 p-3 text-sm text-muted-foreground">Notas: {order.notes}</p>}

              <section className="space-y-3 border-t border-border/50 pt-5">
                <div className="flex items-center gap-2">
                  <History className="size-4 text-primary" />
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary">Historial de cambios</h4>
                </div>
                {historyLoading ? (
                  <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 p-4 text-xs text-muted-foreground"><span className="size-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" /> Cargando historial…</div>
                ) : history.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/50 bg-muted/10 p-4 text-xs text-muted-foreground">No hay cambios registrados para esta orden.</div>
                ) : (
                  <div className="space-y-3">
                    {history.map((entry) => {
                      const details = typeof entry.details === 'string' ? (() => { try { return JSON.parse(entry.details); } catch { return null; } })() : entry.details;
                      return (
                        <div key={entry.id} className="relative border-l-2 border-primary/20 pl-4">
                          <span className="absolute -left-[5px] top-1 size-2 rounded-full bg-primary ring-4 ring-background" />
                          <div className="rounded-xl border border-border/50 bg-card p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Badge variant="outline" className="border-primary/20 bg-primary/5 text-[9px] font-black uppercase text-primary">{ACTION_LABELS[entry.action] || 'Actividad'}</Badge>
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><CalendarDays className="size-3" /> {formatDate(entry.createdAt)}</span>
                            </div>
                            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold"><UserRound className="size-3.5 text-muted-foreground" /> {entry.user?.name || 'Sistema'}</p>
                            {details && <p className="mt-2 flex items-start gap-1.5 break-words text-[11px] text-muted-foreground"><Info className="mt-0.5 size-3 shrink-0" /> {Object.entries(details).map(([key, value]) => `${HISTORY_KEY_LABELS[key] || key}: ${HISTORY_VALUE_LABELS[String(value)] || String(value)}`).join(' · ')}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <SheetFooter className="min-w-0 border-t border-border/50 bg-background px-5 py-4 sm:px-6" data-tour="purchase-order-detail-actions">
              <div className="flex w-full flex-wrap justify-end gap-2">
                {onDownloadPdf && (
                  <Button variant="outline" className="gap-2 rounded-xl text-xs font-black uppercase tracking-wider" onClick={onDownloadPdf}>
                    <FileDown className="size-4" /> Descargar PDF
                  </Button>
                )}
                {canCancel && !isRejected && (
                  <Button variant="outline" className="gap-2 rounded-xl border-destructive/40 text-xs font-black uppercase tracking-wider text-destructive hover:bg-destructive/10" onClick={() => order.id && onCancel(order.id)}>
                    <Ban className="size-4" /> Rechazar
                  </Button>
                )}
                {canApprove && canApproveState && (
                  <Button className="gap-2 rounded-xl bg-primary px-5 text-xs font-black uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90" disabled={approving} onClick={() => order.id && onApprove(order.id)}>
                    <CheckCircle2 className="size-4" /> {approving ? 'Aprobando…' : 'Aprobar'}
                  </Button>
                )}
                <Button variant="outline" className="rounded-xl text-xs font-black uppercase tracking-wider" onClick={onClose}>Cerrar</Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
