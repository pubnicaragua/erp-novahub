import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { DateField } from '../ui/DateField';
import { ErrorState, Field } from '../organizacion/OrgBits';
import { errorMessage } from '../organizacion/organizacion.utils';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { useEnabledTenantFeatures } from '../../hooks/useEnabledTenantFeatures';
import { flotaService, type FuelTraceRow } from '../../services/flota.service';
import { createReportWorkbook } from '../../utils/reportWorkbook';
import { buildDatedDownloadFileName } from '../../utils/exportFileNames';

const LINK_LABEL: Record<FuelTraceRow['linkStatus'], string> = {
  LINKED: 'Amarrada',
  NO_CODE: 'Sin pedido en la remisión',
  CODE_NOT_FOUND: 'Pedido sin orden de compra',
  PRODUCT_NOT_IN_PURCHASE: 'Producto no está en la compra',
};

const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const day = (value: string | null) => (value ? String(value).slice(0, 10).split('-').reverse().join('/') : '—');
const money = (value: number | null, currency: string | null, digits = 2) => (value === null
  ? '—'
  : `${currency || ''} ${value.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: digits })}`.trim());

/**
 * Ventas con su compra para contabilidad. Solo existe si el superadmin habilitó la función para la empresa y el rol puede ver
 * los reportes de flota o el libro diario. No depende del costo del flete.
 */
export function FuelTraceReport() {
  const { canPerform } = useAuth();
  const features = useEnabledTenantFeatures();
  const allowed = features.has('SALES_FUEL_TRACE_REPORT') && (canPerform('FLEET_REPORTS', 'view') || canPerform('ACCOUNTING_JOURNAL', 'view'));
  return allowed ? <FuelTraceTable /> : null;
}

function FuelTraceTable() {
  const today = new Date();
  const [from, setFrom] = useState(isoDay(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(isoDay(today));
  const [search, setSearch] = useState('');
  const report = useTenantQuery(['fleet', 'fuel-trace', from, to], (signal) => flotaService.fuelTrace({ dateFrom: from, dateTo: to }, signal));
  const term = search.trim().toLowerCase();
  const rows = (report.data?.rows || []).filter((row) => !term || [row.invoiceNumber, row.orderNumber, row.remisionNumber, row.customer, row.product,
    row.supplierOrderCode, row.supplierName, row.purchaseOrderNumber, row.supplierInvoiceNumber, row.origin]
    .some((value) => String(value ?? '').toLowerCase().includes(term)));
  const pending = rows.filter((row) => row.linkStatus !== 'LINKED').length;

  const columns: Array<[string, (row: FuelTraceRow) => string | number]> = [
    ['Fecha venta', (row) => day(row.invoiceDate)],
    ['Factura', (row) => row.invoiceNumber],
    ['Orden de venta', (row) => row.orderNumber || '—'],
    ['Remisión', (row) => row.remisionNumber || '—'],
    ['Cliente', (row) => row.customer || '—'],
    ['Producto', (row) => row.product],
    ['Cantidad', (row) => row.quantity],
    ['Precio venta', (row) => money(row.saleUnitPrice, row.saleCurrency, 4)],
    ['Total venta', (row) => money(row.saleTotal, row.saleCurrency)],
    ['Origen', (row) => row.origin || '—'],
    ['Pedido proveedor', (row) => row.supplierOrderCode || '—'],
    ['Proveedor', (row) => row.supplierName || '—'],
    ['Orden de compra', (row) => row.purchaseOrderNumber || '—'],
    ['Factura proveedor', (row) => row.supplierInvoiceNumber || '—'],
    ['Fecha compra', (row) => day(row.purchaseDate)],
    ['Precio compra', (row) => money(row.purchaseUnitPrice, row.purchaseCurrency, 4)],
    ['Compra de lo vendido', (row) => money(row.purchaseAmount, row.purchaseCurrency)],
    ['Estado', (row) => LINK_LABEL[row.linkStatus]],
  ];

  const exportExcel = () => {
    createReportWorkbook({
      fileName: buildDatedDownloadFileName(['ventas_y_compras'], 'xlsx'),
      sheets: [{ name: 'Ventas y compras', rows: rows.map((row) => Object.fromEntries(columns.map(([label, value]) => [label, value(row)]))) }],
      filters: { Desde: from, Hasta: to, ...(term ? { Búsqueda: search.trim() } : {}) },
    });
  };

  return (
    <section className="mb-6 min-w-0 max-w-full space-y-3 rounded-2xl border border-border/60 bg-card p-4" data-testid="fuel-trace-report">
      <div>
        <h2 className="text-base font-black">Ventas y su compra (contabilidad)</h2>
        <p className="text-xs text-muted-foreground">Cada venta facturada con el pedido al proveedor que la surtió. Aparece al facturar, sin esperar el costo del flete.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Desde" htmlFor="trace-from"><DateField value={from} onChange={setFrom} maxDate={to || undefined} className="h-10 w-[170px]" placeholder="Desde" title="Desde" /></Field>
        <Field label="Hasta" htmlFor="trace-to"><DateField value={to} onChange={setTo} minDate={from || undefined} className="h-10 w-[170px]" placeholder="Hasta" title="Hasta" /></Field>
        <Field label="Buscar" htmlFor="trace-search"><Input id="trace-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Factura, remisión, pedido, cliente…" className="h-10 w-64" /></Field>
        <Button type="button" variant="outline" onClick={exportExcel} disabled={!rows.length} className="ml-auto"><Download className="size-4" aria-hidden="true" /> Excel</Button>
      </div>
      {report.isLoading && <Skeleton className="h-32 w-full" />}
      {report.error && <ErrorState message={errorMessage(report.error)} onRetry={() => void report.refetch()} />}
      {report.data && (
        <>
          <p className="text-xs text-muted-foreground">{rows.length} renglones{pending > 0 ? ` · ${pending} sin amarrar a su compra` : ''}{report.data.truncated ? ' · se muestran las facturas más recientes; acota las fechas' : ''}</p>
          <div className="max-w-full overflow-x-auto rounded-xl border border-border/60">
            <table className="w-max min-w-full text-xs" data-table-content-sized="true">
              <thead className="bg-muted/50"><tr>{columns.map(([label]) => <th key={label} className="whitespace-nowrap px-3 py-2 text-left font-bold">{label}</th>)}</tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border/40">
                    {columns.map(([label, value]) => (
                      <td key={label} className="whitespace-nowrap px-3 py-2">
                        {label === 'Estado' ? <Badge variant={row.linkStatus === 'LINKED' ? 'secondary' : 'outline'}>{value(row)}</Badge> : value(row)}
                      </td>
                    ))}
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">No hay ventas facturadas con esos filtros.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
