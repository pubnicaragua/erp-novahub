"use client";

import { Ban, BadgeCheck, FilePlus2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { cn } from '../../ui/utils';
import type { PurchaseOrder, Supplier } from '../../../types';

const statusOpts = [
  { label: 'Borrador',   value: 'DRAFT',     color: 'bg-muted/20 text-muted-foreground' },
  { label: 'Pendiente',  value: 'PENDING',   color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Aprobada',   value: 'APPROVED',  color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Cancelada',  value: 'CANCELLED', color: 'bg-rose-500/10 text-rose-500' },
];

const fm = (n: number | string | undefined | null) =>
  new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));

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
  onGenerateInvoice?: () => void;
}

export function PurchaseOrderPreviewDialog({
  open, order, suppliers, canApprove, canCancel, approving = false, onClose, onApprove, onCancel, onGenerateInvoice,
}: PurchaseOrderPreviewDialogProps) {
  const supplier = suppliers?.find((s) => s.id === order?.supplierId);
  const status = (order?.status || '').toUpperCase();
  const statusMeta = statusOpts.find((o) => o.value === status);
  const isCancelled = status === 'CANCELLED';
  const canApproveState = ['DRAFT', 'PENDING'].includes(status);
  const items = order?.items || [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight">Vista Previa de Orden</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {order?.number ? `Orden ${order.number}` : 'Orden de Compra'} · {supplier?.name || 'Sin proveedor'}
              {order?.purchaseRequestNumber ? ` · Solicitud ${order.purchaseRequestNumber}` : ''}
            </span>
            {statusMeta && (
              <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', statusMeta.color)}>
                {statusMeta.label}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-9">Código</TableHead>
                <TableHead className="h-9">Nombre</TableHead>
                <TableHead className="h-9 text-right">Cant.</TableHead>
                <TableHead className="h-9 text-right">P. Unit.</TableHead>
                <TableHead className="h-9 text-right">Subtotal</TableHead>
                <TableHead className="h-9 text-right">IVA</TableHead>
                <TableHead className="h-9 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Sin ítems
                  </TableCell>
                </TableRow>
              ) : items.map((it: any, i: number) => {
                const total = Number(it.total ?? (Number(it.quantity || 0) * Number(it.unitPrice || 0)));
                const tax = Number(it.taxAmount ?? 0);
                const subtotal = Number(it.taxBase ?? total - tax);
                return (
                  <TableRow key={it.id ?? i}>
                    <TableCell className="font-mono text-[11px]">{it.code || '—'}</TableCell>
                    <TableCell className="text-xs">{it.name || it.description || '—'}</TableCell>
                    <TableCell className="text-right text-xs">{Number(it.quantity || 0)}</TableCell>
                    <TableCell className="text-right text-xs">{fm(it.unitPrice)}</TableCell>
                    <TableCell className="text-right text-xs">{fm(subtotal)}</TableCell>
                    <TableCell className="text-right text-xs">{fm(tax)}</TableCell>
                    <TableCell className="text-right text-xs font-black">{fm(total)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
          <div className="text-xs text-muted-foreground">
            {isCancelled
              ? 'Esta orden está anulada y no puede procesarse.'
              : status === 'APPROVED'
                ? 'Esta orden está aprobada y puede generar una factura de proveedor.'
              : 'Confirme la acción a realizar sobre la orden.'}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm font-black uppercase tracking-widest">
            <span className="text-muted-foreground">Subtotal <span className="text-foreground">{fm(order?.subtotal)}</span></span>
            <span className="text-muted-foreground">IVA <span className="text-foreground">{fm(order?.taxAmount)}</span></span>
            <span className="text-muted-foreground">Retención <span className="text-foreground">{fm(order?.withholdingTotal)}</span></span>
            <span className="text-muted-foreground">Total <span className="text-primary text-lg">{fm(order?.total)}</span></span>
          </div>
        </div>

        <DialogFooter className="mt-4 flex-wrap gap-2">
          {onGenerateInvoice && status === 'APPROVED' && (
            <Button variant="outline" className="rounded-xl border-primary/50 text-primary hover:bg-primary/10 font-black uppercase text-[10px] tracking-widest px-4"
              onClick={onGenerateInvoice}>
              <FilePlus2 className="mr-2 size-3.5" /> Generar factura
            </Button>
          )}
          {canCancel && !isCancelled && (
            <Button variant="outline" className="border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
              onClick={() => order?.id && onCancel(order.id)}>
              <Ban className="mr-2 size-3.5" />
              Anular orden
            </Button>
          )}
          {canApprove && canApproveState && (
            <Button className="rounded-xl bg-emerald-500 shadow-xl shadow-emerald-500/20 text-white font-black uppercase text-[10px] tracking-widest px-6 disabled:opacity-50"
              disabled={approving}
              onClick={() => order?.id && onApprove(order.id)}>
              <BadgeCheck className="mr-2 size-3.5" />
              {approving ? 'Aprobando…' : 'Aprobar'}
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
