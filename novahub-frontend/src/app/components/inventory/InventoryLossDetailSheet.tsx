import type { ReactNode } from 'react';
import { ChevronRight, Check, Package, Scale, TrendingDown } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

const REASON_LABELS: Record<string, string> = {
  DISCREPANCY: 'Discrepancia',
  DAMAGE: 'Daño',
  EXPIRATION: 'Vencimiento',
  THEFT: 'Robo',
  OTHER: 'Otro',
  SURPLUS: 'Sobrante',
  SHRINKAGE: 'Merma',
  SHORTAGE: 'Faltante',
  LOSS: 'Pérdida',
  DETERIORATION: 'Deterioro',
  MIXED: 'Ajuste mixto',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviado',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  CANCELLED: 'Cancelado',
};

function formatNumber(value: unknown) {
  return new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('es-NI', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function formatReason(value: unknown) {
  const key = String(value || '').toUpperCase();
  return REASON_LABELS[key] || String(value || 'Sin motivo');
}

function formatApprover(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const approver = value as { name?: string | null; email?: string | null };
    return approver.name || approver.email || 'No registrado';
  }
  return 'No registrado';
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}

function ReasonBadge({ value }: { value: unknown }) {
  return (
    <Badge variant="outline" className="max-w-full whitespace-normal break-words border-red-500/20 bg-red-500/5 text-center text-[10px] font-bold text-red-600">
      {formatReason(value)}
    </Badge>
  );
}

function LossItemCard({ item, canViewInventoryCost, formatCurrentAmount, fallbackReason }: { item: any; canViewInventoryCost: boolean; formatCurrentAmount: (amount: number, sourceCurrency?: any) => string; fallbackReason: string }) {
  const difference = -Number(item.lossQuantity || 0);
  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
      <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border/50 pb-3">
        <div className="min-w-0">
          <p className="break-words text-xs font-semibold leading-4">{item.name || 'Producto'}</p>
          <p className="mt-1 break-words font-mono text-[10px] leading-3 text-muted-foreground">{item.code || '—'}{item.variantName ? ` · ${item.variantName}` : ''}</p>
        </div>
        <ReasonBadge value={item.reason || fallbackReason} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
        <DetailField label="Existencia actual" value={formatNumber(item.systemStock)} />
        <DetailField label="Existencia real" value={formatNumber(item.countedStock)} />
        <DetailField label="Diferencia" value={<span className="font-mono text-red-600">{formatNumber(difference)}</span>} />
        {canViewInventoryCost && <DetailField label="Impacto" value={<span className="font-mono text-red-600">-{formatCurrentAmount(Number(item.lossAmount || 0))}</span>} />}
      </div>
    </div>
  );
}

interface InventoryLossDetailSheetProps {
  row: any | null;
  canViewInventoryCost: boolean;
  formatCurrentAmount: (amount: number, sourceCurrency?: any) => string;
  onClose: () => void;
}

export function InventoryLossDetailSheet({ row, canViewInventoryCost, formatCurrentAmount, onClose }: InventoryLossDetailSheetProps) {
  const items = Array.isArray(row?.items) ? row.items : [];
  const totalUnits = items.reduce((sum: number, item: any) => sum + Number(item.lossQuantity || 0), 0);
  const lineReasons = [...new Set(items.map((item: any) => String(item.reason || '').toUpperCase()).filter(Boolean))];
  const reason = row?.reason || (lineReasons.length > 1 ? 'MIXED' : lineReasons[0]);
  const status = String(row?.status || 'APPROVED').toUpperCase();
  const accountEntries = row?.account ? [row.account] : (Array.isArray(row?.accounts) ? row.accounts : []);
  const accountLabel = accountEntries.map((account: any) => `${account.code || '—'} · ${account.name || 'Cuenta contable'}`).join(' / ') || 'Sin vínculo';

  return (
    <Sheet open={Boolean(row)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full min-w-0 max-w-[72rem] flex-col gap-0 overflow-hidden border-l border-border/50 bg-background p-0 sm:w-[calc(100vw-2rem)] sm:max-w-[72rem]">
        <SheetHeader className="sticky top-0 z-10 space-y-3 border-b border-border/50 bg-background/95 px-5 py-5 pr-12 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-600 shadow-inner">
              <TrendingDown className="size-6" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="truncate text-lg font-black uppercase tracking-tight text-foreground">{row?.number || 'Detalle de pérdida'}</SheetTitle>
                {row && <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider">Ajuste</Badge>}
              </div>
              <SheetDescription className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono font-bold">{formatDate(row?.date)}</span>
                <span>·</span>
                <span>{STATUS_LABELS[status] || status}</span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {row && <div className="space-y-5 p-4 sm:p-6">
            <Card className="rounded-2xl border-red-500/20 bg-red-500/5 p-4 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-red-600">Pérdida registrada</p>
                  <p className="mt-1 text-2xl font-black tabular-nums tracking-tight text-red-600">-{formatNumber(totalUnits)}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Unidades afectadas</p>
                </div>
                <Badge className="shrink-0 bg-emerald-500/10 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                  {status === 'APPROVED' && <Check className="mr-1 size-3" />}
                  {STATUS_LABELS[status] || status}
                </Badge>
              </div>
            </Card>

            <div className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Fecha" value={formatDate(row.date)} />
              <DetailField label="Almacén / bodega" value={row.warehouse?.name || '—'} />
              <DetailField label="Motivo" value={formatReason(reason)} />
              <DetailField label="Estado" value={STATUS_LABELS[status] || status} />
              <DetailField label="Aprobado por" value={formatApprover(row.approvedBy || row.approvedByName)} />
              <DetailField label="Fecha de aprobación" value={formatDate(row.approvedAt)} />
              <DetailField label="Variación" value={<span className="font-mono text-red-600">-{formatNumber(totalUnits)}</span>} />
              {canViewInventoryCost && <DetailField label="Impacto" value={<span className="font-mono text-red-600">-{formatCurrentAmount(Number(row.totalLoss || 0))}</span>} />}
            </div>

            {row.notes && <Card className="rounded-2xl border-border/60 p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notas</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{row.notes}</p>
            </Card>}

            <section className="min-w-0">
              <div className="mb-3 flex items-center gap-2">
                <Package className="size-4 text-red-600" />
                <h3 className="truncate text-sm font-black uppercase tracking-tight">Productos afectados</h3>
              </div>

              <div className="space-y-3 sm:hidden">
                {items.length === 0 && <p className="rounded-xl border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">Sin artículos registrados.</p>}
                {items.map((item: any, index: number) => <LossItemCard key={item.id || item.productId || `${item.code}-${index}`} item={item} canViewInventoryCost={canViewInventoryCost} formatCurrentAmount={formatCurrentAmount} fallbackReason={reason} />)}
              </div>

              <div className="hidden min-w-0 overflow-hidden rounded-2xl border border-border/60 sm:block">
                <Table className="w-full table-fixed text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className={canViewInventoryCost ? 'w-[25%] whitespace-normal px-2 text-[10px]' : 'w-[34%] whitespace-normal px-2 text-[10px]'}>Producto</TableHead>
                      <TableHead className="w-[14%] whitespace-normal px-2 text-[10px]">Existencia actual</TableHead>
                      <TableHead className="w-[14%] whitespace-normal px-2 text-[10px]">Existencia real</TableHead>
                      <TableHead className="w-[12%] whitespace-normal px-2 text-[10px]">Diferencia</TableHead>
                      <TableHead className={canViewInventoryCost ? 'w-[15%] whitespace-normal px-2 text-[10px]' : 'w-[26%] whitespace-normal px-2 text-[10px]'}>Motivo</TableHead>
                      {canViewInventoryCost && <><TableHead className="w-[10%] whitespace-normal px-2 text-[10px]">Costo unitario</TableHead><TableHead className="w-[10%] whitespace-normal px-2 text-[10px]">Impacto</TableHead></>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 && <TableRow><TableCell colSpan={canViewInventoryCost ? 7 : 5} className="py-8 text-center text-xs text-muted-foreground">Sin artículos registrados.</TableCell></TableRow>}
                    {items.map((item: any, index: number) => <TableRow key={item.id || item.productId || `${item.code}-${index}`}>
                      <TableCell className="min-w-0 whitespace-normal break-words px-2 align-top"><p className="font-semibold leading-4">{item.name || 'Producto'}</p><p className="break-words text-[10px] leading-3 text-muted-foreground">{item.code || '—'}{item.variantName ? ` · ${item.variantName}` : ''}</p></TableCell>
                      <TableCell className="whitespace-nowrap px-2 text-right align-top tabular-nums">{formatNumber(item.systemStock)}</TableCell>
                      <TableCell className="whitespace-nowrap px-2 text-right align-top tabular-nums">{formatNumber(item.countedStock)}</TableCell>
                      <TableCell className="whitespace-nowrap px-2 text-right align-top font-mono font-bold text-red-600">-{formatNumber(item.lossQuantity)}</TableCell>
                      <TableCell className="min-w-0 whitespace-normal break-words px-2 align-top"><ReasonBadge value={item.reason || reason} /></TableCell>
                      {canViewInventoryCost && <><TableCell className="whitespace-normal break-words px-2 text-right align-top tabular-nums">{formatCurrentAmount(Number(item.unitCost || 0))}</TableCell><TableCell className="whitespace-normal break-words px-2 text-right align-top font-mono font-bold text-red-600">-{formatCurrentAmount(Number(item.lossAmount || 0))}</TableCell></>}
                    </TableRow>)}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{items.length} {items.length === 1 ? 'producto afectado' : 'productos afectados'}</p>
            </section>

            <Card className="rounded-2xl border-border/60 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Scale className="size-4" /></div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cuentas contables afectadas</p>
                  <p className="mt-2 break-words text-sm font-semibold">{accountLabel}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">La pérdida se registra contra la cuenta de inventario de la bodega y la cuenta asociada al motivo.</p>
                </div>
              </div>
            </Card>
          </div>}
        </div>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 bg-background/95 px-5 py-3 backdrop-blur-md sm:px-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Consulta de solo lectura</p>
          <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5 rounded-xl text-xs font-bold">Cerrar <ChevronRight className="size-3" /></Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
