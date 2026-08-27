import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, BellRing, Clock, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { cajaService, type CashQueueDocument, type InvoiceCashQueue } from '../../../services/caja.service';

const MAX_VISIBLE_QUEUE_ITEMS = 50;

const getQueueAge = (queue: InvoiceCashQueue) => {
  const source = queue.status === 'CLAIMED'
    ? queue.lastActivityAt || queue.claimedAt || queue.createdAt
    : queue.createdAt;
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(source).getTime()) / 60000));
  if (elapsedMinutes < 1) return 'Ahora';
  if (elapsedMinutes < 60) return `Hace ${elapsedMinutes} min`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Hace ${elapsedHours} h`;
  return `Hace ${Math.floor(elapsedHours / 24)} d`;
};

const formatQueueAmount = (queue: InvoiceCashQueue) => {
  const document = queue.invoice || queue.creditNote;
  if (!document) return '—';
  const symbol = document.currency === 'USD' ? '$' : 'C$';
  return `${symbol} ${Number(document.balance || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface InvoiceCashQueueBellProps {
  onItemSelect?: (queueId: string) => void;
}

/**
 * Campanita operativa de caja. No trata la cola como notificaciones leídas:
 * el contador representa trabajo vigente y desaparece solo al pagar, cancelar
 * o liberar/reconciliar la reserva.
 */
export function InvoiceCashQueueBell({ onItemSelect }: InvoiceCashQueueBellProps) {
  const [items, setItems] = useState<InvoiceCashQueue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await cajaService.getInvoiceCashQueue({ status: 'PENDING,CLAIMED', page: 1, pageSize: MAX_VISIBLE_QUEUE_ITEMS }, signal);
      const payload = (response as any)?.data || response;
      setItems(Array.isArray(payload?.items) ? payload.items.slice(0, MAX_VISIBLE_QUEUE_ITEMS) : []);
      setError(null);
    } catch (requestError: unknown) {
      if ((requestError as any)?.name !== 'AbortError') setError('No se pudo consultar la cola de caja.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = window.setInterval(() => void load(), 30000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [load]);

  const openQueueItem = (queueId: string) => {
    onItemSelect?.(queueId);
    if (!onItemSelect) {
      window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: 'ventas', subModule: 'facturacion-caja', queueId } }));
    }
  };

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) void load(); }}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          data-toolbar-role="cash-queue-alerts"
          className="relative size-10 shrink-0 rounded-xl border-border/60 text-muted-foreground hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-600"
          aria-label={items.length > 0 ? `Cola de caja, ${items.length} activa(s)` : 'Cola de caja'}
          title="Facturas pendientes en cola de caja"
        >
          {loading && items.length === 0 ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
          {items.length > 0 && <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full bg-emerald-600 px-1 text-[10px] text-white">{items.length > 99 ? '99+' : items.length}</Badge>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] rounded-xl border-border/60 p-2">
        <DropdownMenuLabel className="flex items-center justify-between gap-3 px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          <span>Cola activa de caja</span>
          <Button type="button" variant="ghost" size="icon" className="size-7 rounded-lg" onClick={(event) => { event.preventDefault(); void load(); }} aria-label="Actualizar cola de caja">
            <RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} />
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {error && <p className="px-2 py-3 text-xs text-destructive">{error}</p>}
        {!error && items.length === 0 && <p className="px-2 py-4 text-xs text-muted-foreground">No hay documentos pendientes o tomados recientemente.</p>}
        {items.length > 0 && (
          <div className="max-h-80 space-y-1 overflow-y-auto px-1 pb-1">
            {items.map((queue) => {
              const document: CashQueueDocument | null = queue.invoice || queue.creditNote || null;
              if (!document) return null;
              const claimed = queue.status === 'CLAIMED';
              return (
                <DropdownMenuItem key={queue.id} className="items-start gap-2 rounded-lg px-3 py-2.5" onSelect={() => openQueueItem(queue.id)}>
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${claimed ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-black text-foreground">{document.number}</span>
                      <span className="shrink-0 font-mono text-[10px] font-bold text-primary">{formatQueueAmount(queue)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{document.customer?.name || document.customCustomerName || 'Cliente general'} · {queue.creditNoteId ? 'Crédito' : 'Factura'}</span>
                    <span className="mt-1 flex items-center gap-2 text-[10px] font-semibold text-muted-foreground">
                      <span>{claimed ? `Tomada por ${queue.claimedBy?.name || 'otro cajero'}` : 'Pendiente de tomar'}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="size-3" />{getQueueAge(queue)}</span>
                    </span>
                  </span>
                  <ArrowRight className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="justify-center gap-2 rounded-lg text-xs font-black text-primary" onSelect={() => window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: 'ventas', subModule: 'facturacion-caja' } }))}>
          Abrir Facturación por Caja <ArrowRight className="size-3.5" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
