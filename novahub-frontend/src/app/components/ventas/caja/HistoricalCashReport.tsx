import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Download, Loader2, RefreshCw, WalletCards } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { useAuth } from '../../../contexts/AuthContext';
import { cajaService, type HistoricalCashReport as HistoricalCashReportData } from '../../../services/caja.service';
import { getApiErrorMessage } from '../../../services/api';
import { generateHistoricalCashReportPDF } from '../../../utils/pdfGenerator';

const today = new Date();
const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
const inputDate = (date: Date) => date.toISOString().slice(0, 10);
const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', CHECK: 'Cheque', OTHER: 'Otro',
};

const emptyReport: HistoricalCashReportData = {
  items: [], total: 0, page: 1, pageSize: 25, pages: 0, aggregationComplete: true,
  filters: {},
  summary: { sessions: 0, closedSessions: 0, saleCount: 0, byPaymentMethod: {} },
  options: { registers: [], cashiers: [], branches: [] },
};

const amount = (value: unknown) => Number(value || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signedAmount = (value: unknown) => `${Number(value || 0) >= 0 ? '+' : ''}${amount(value)}`;

export function HistoricalCashReport({ initialRegisterId }: { initialRegisterId?: string }) {
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    dateFrom: inputDate(thirtyDaysAgo),
    dateTo: inputDate(today),
    branchId: '',
    registerId: initialRegisterId && initialRegisterId !== 'ALL' ? initialRegisterId : '',
    cashierId: '',
    paymentMethod: '',
    status: '',
    page: 1,
    pageSize: 25,
  });
  const [report, setReport] = useState<HistoricalCashReportData>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const loadReport = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      setReport(await cajaService.getHistoricalCashReport(nextFilters));
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo cargar el reporte histórico de caja.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void loadReport(); }, []);

  const updateFilter = (key: string, value: string) => {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  };
  const summary = report.summary || {};
  const paymentRows = useMemo(() => Object.entries(summary.byPaymentMethod || {}), [summary.byPaymentMethod]);
  const setPage = (page: number) => {
    const next = { ...filters, page };
    setFilters(next);
    void loadReport(next);
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      await generateHistoricalCashReportPDF({ report, tenantName: user?.tenantName || 'Nuestra Empresa' });
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo generar el PDF del reporte.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5 min-w-0">
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="gap-3 pb-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
                <BarChart3 className="size-5 text-primary" /> Reporte histórico de caja
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Consolidado por fecha, sucursal, caja, cajero, forma de pago, diferencias y depósitos.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" onClick={() => void loadReport()} disabled={loading}>
                <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
              </Button>
              <Button className="gap-2" onClick={() => void exportPdf()} disabled={exporting || loading || report.items.length === 0}>
                {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Generar PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Desde<Input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} /></label>
          <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Hasta<Input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} /></label>
          <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Sucursal
            <Select value={filters.branchId || 'ALL'} onValueChange={(value) => updateFilter('branchId', value === 'ALL' ? '' : value)}><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="ALL">Todas</SelectItem>{report.options.branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name} ({branch.code})</SelectItem>)}</SelectContent></Select>
          </label>
          <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Caja
            <Select value={filters.registerId || 'ALL'} onValueChange={(value) => updateFilter('registerId', value === 'ALL' ? '' : value)}><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="ALL">Todas</SelectItem>{report.options.registers.map((register) => <SelectItem key={register.id} value={register.id}>{register.code} · {register.name}</SelectItem>)}</SelectContent></Select>
          </label>
          <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Cajero
            <Select value={filters.cashierId || 'ALL'} onValueChange={(value) => updateFilter('cashierId', value === 'ALL' ? '' : value)}><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="ALL">Todos</SelectItem>{report.options.cashiers.map((cashier) => <SelectItem key={cashier.id} value={cashier.id}>{cashier.name}</SelectItem>)}</SelectContent></Select>
          </label>
          <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Forma de pago
            <Select value={filters.paymentMethod || 'ALL'} onValueChange={(value) => updateFilter('paymentMethod', value === 'ALL' ? '' : value)}><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="ALL">Todas</SelectItem>{Object.entries(PAYMENT_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select>
          </label>
          <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Estado
            <Select value={filters.status || 'ALL'} onValueChange={(value) => updateFilter('status', value === 'ALL' ? '' : value)}><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="ALL">Todos</SelectItem><SelectItem value="CLOSED">Cerradas</SelectItem><SelectItem value="OPEN">Abiertas</SelectItem><SelectItem value="COUNTING">En arqueo</SelectItem></SelectContent></Select>
          </label>
          <div className="flex items-end xl:col-span-2"><Button className="w-full" onClick={() => void loadReport()} disabled={loading}>Aplicar filtros</Button></div>
        </CardContent>
      </Card>

      {error && <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}</div>}
      {!report.aggregationComplete && <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-0.5 size-4 shrink-0" />El rango contiene más de 10,000 sesiones; los totales visibles están limitados al bloque agregado.</div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Sesiones', summary.sessions || 0, 'text-foreground'],
          ['Ventas NIO', `C$ ${amount(summary.salesNIO)}`, 'text-emerald-600 dark:text-emerald-400'],
          ['Ventas USD', `$ ${amount(summary.salesUSD)}`, 'text-sky-600 dark:text-sky-400'],
          ['Diferencia NIO', `C$ ${signedAmount(summary.differenceNIO)}`, Number(summary.differenceNIO || 0) < 0 ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'],
        ].map(([label, value, color]) => <Card key={String(label)} className="border-border/50 shadow-sm"><CardContent className="p-4"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-black ${color}`}>{value}</p></CardContent></Card>)}
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base font-black"><WalletCards className="size-4 text-primary" /> Desglose por forma de pago</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {paymentRows.map(([method, value]: [string, any]) => <div key={method} className="rounded-xl border border-border/50 bg-muted/20 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold">{PAYMENT_LABELS[method] || method}</p><Badge variant="outline">{value.count || 0}</Badge></div><p className="mt-2 font-mono text-sm">C$ {amount(value.amountNIO)}</p><p className="font-mono text-xs text-muted-foreground">$ {amount(value.amountUSD)}</p></div>)}
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3"><CardTitle className="text-base font-black">Sesiones consolidadas</CardTitle><Badge variant="secondary">{report.total} registros</Badge></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 size-5 animate-spin" /> Cargando reporte…</div> : report.items.length === 0 ? <div className="py-16 text-center text-sm text-muted-foreground">No hay sesiones para los filtros seleccionados.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-y border-border/50 bg-muted/30 text-[10px] uppercase tracking-widest text-muted-foreground"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Sucursal / caja</th><th className="px-4 py-3">Cajero</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Ventas NIO</th><th className="px-4 py-3 text-right">Ventas USD</th><th className="px-4 py-3 text-right">Diferencia</th><th className="px-4 py-3 text-right">Depósito</th></tr></thead><tbody className="divide-y divide-border/40">{report.items.map((item: any) => <tr key={item.id} className="hover:bg-muted/20"><td className="whitespace-nowrap px-4 py-3 align-top"><p className="font-bold">{new Date(item.date).toLocaleDateString('es-NI')}</p><p className="text-xs text-muted-foreground">{item.closedAt ? `Cierre ${new Date(item.closedAt).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' })}` : 'Sin cierre'}</p></td><td className="px-4 py-3 align-top"><p className="font-bold">{item.branch?.name || 'Sin sucursal'}</p><p className="text-xs text-muted-foreground">{item.register ? `${item.register.code} · ${item.register.name}` : 'Sin caja'}</p></td><td className="px-4 py-3 align-top">{item.openedBy?.name || '—'}</td><td className="px-4 py-3 align-top"><Badge variant={item.status === 'CLOSED' ? 'outline' : item.status === 'COUNTING' ? 'secondary' : 'default'}>{item.status === 'CLOSED' ? 'CERRADA' : item.status === 'COUNTING' ? 'EN ARQUEO' : 'ABIERTA'}</Badge><p className="mt-1 text-xs text-muted-foreground">{item.saleCount || 0} ventas</p></td><td className="px-4 py-3 text-right font-mono">C$ {amount(item.salesNIO)}</td><td className="px-4 py-3 text-right font-mono">$ {amount(item.salesUSD)}</td><td className={`px-4 py-3 text-right font-mono font-bold ${Number(item.differenceNIO || 0) < 0 ? 'text-destructive' : ''}`}>C$ {signedAmount(item.differenceNIO)}<p className="text-xs font-normal text-muted-foreground">$ {signedAmount(item.differenceUSD)}</p></td><td className="px-4 py-3 text-right font-mono">C$ {amount(item.depositNIO)}<p className="text-xs text-muted-foreground">$ {amount(item.depositUSD)}</p></td></tr>)}</tbody></table></div>}
          {report.pages > 1 && <div className="flex items-center justify-between gap-3 border-t border-border/50 p-4"><p className="text-xs text-muted-foreground">Página {report.page} de {report.pages}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={report.page <= 1 || loading} onClick={() => setPage(report.page - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={report.page >= report.pages || loading} onClick={() => setPage(report.page + 1)}>Siguiente</Button></div></div>}
        </CardContent>
      </Card>
    </div>
  );
}
