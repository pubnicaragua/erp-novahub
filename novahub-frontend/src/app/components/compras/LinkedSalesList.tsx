import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { ErrorState } from '../organizacion/OrgBits';
import { errorMessage } from '../organizacion/organizacion.utils';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { flotaService } from '../../services/flota.service';

const SALE_STATUS: Record<string, string> = {
  DRAFT: 'Borrador', APPROVED: 'Aprobada', PENDING: 'Pendiente', PARTIAL: 'Pago parcial', PAID: 'Pagada', CREDIT: 'Crédito', OVERDUE: 'Vencida',
};
const label = (status: string) => SALE_STATUS[status] || status;
const day = (value: string) => String(value).slice(0, 10).split('-').reverse().join('/');

/**
 * Ventas amarradas a esta compra por el código de pedido del proveedor, aunque todavía no estén facturadas.
 * Sin precios: los montos de la venta salen solo en el reporte de contabilidad.
 */
/** `version` cambia cuando se guarda otro código, para volver a consultar sin hacerlo en cada tecla. */
export function LinkedSalesList({ purchaseOrderId, version }: { purchaseOrderId: string; version: string }) {
  const query = useTenantQuery(['fleet', 'linked-sales', purchaseOrderId, version], (signal) => flotaService.linkedSales(purchaseOrderId, signal), { retry: false });
  const sales = query.data?.sales || [];

  return (
    <section className="space-y-2 rounded-2xl border border-border/60 bg-card p-4" data-testid="purchase-linked-sales">
      <div>
        <h3 className="text-xs font-black uppercase tracking-widest">Ventas amarradas a esta compra</h3>
        <p className="text-[11px] text-muted-foreground">
          {query.data?.code ? `Pedido del proveedor Nº ${query.data.code}. Aparecen desde que la orden de venta lo indica en sus datos de remisión.` : 'Pon el código del pedido del proveedor para poder amarrar las ventas.'}
        </p>
      </div>
      {query.isLoading && <Skeleton className="h-16 w-full" />}
      {query.error && <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />}
      {query.data?.code && !sales.length && <p className="rounded-xl border border-dashed border-border/60 p-3 text-xs text-muted-foreground">Ninguna venta usa este pedido todavía.</p>}
      {sales.map((sale) => (
        <article key={sale.id} className="space-y-1 rounded-xl border border-border/50 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-black">{sale.salesOrderNumber || sale.invoices[0]?.number}</span>
            {sale.salesOrderStatus && <Badge variant="outline">{label(sale.salesOrderStatus)}</Badge>}
            <span className="text-muted-foreground">{day(sale.date)} · {sale.customer || 'Sin cliente'}</span>
          </div>
          <ul className="text-muted-foreground">
            {sale.lines.map((line, index) => <li key={index} className="break-words">{line.quantity.toLocaleString('es-NI')} × {line.description}</li>)}
          </ul>
          <p>{sale.invoices.length ? `Facturada: ${sale.invoices.map((invoice) => `${invoice.number} (${label(invoice.status)})`).join(', ')}` : 'Pendiente de facturar'}</p>
        </article>
      ))}
    </section>
  );
}
