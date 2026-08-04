import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { RefreshCw, Filter, X, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { toast } from 'sonner';
import { useAccountingQuery } from '../../hooks/useAccountingQuery';

interface PnLAccount {
  accountId: string;
  codigo: string;
  cuenta: string;
  currentAmount: number;
  previousAmount?: number;
}

interface PnLData {
  ingresos: PnLAccount[];
  gastos: PnLAccount[];
  totalIngresos: number;
  totalGastos: number;
  totalIngresosPrev: number;
  totalGastosPrev: number;
}

export function EstadoResultadosView() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showPreviousYear, setShowPreviousYear] = useState(false);
  const query = useAccountingQuery<PnLData | null>(
    ['profit-loss', dateFrom, dateTo, showPreviousYear],
    async (signal) => {
      if (!dateFrom || !dateTo) return null;
      const raw: any = await contabilidadService.getProfitLoss({
        dateFrom,
        dateTo,
        previousYear: showPreviousYear,
      }, signal);
      const curr = raw?.current || raw || {};
      const prev = raw?.previous || null;
      const mapAccounts = (list: any[]): PnLAccount[] => (list || []).map((a: any) => ({
        accountId: a.code || '',
        codigo: a.code || '',
        cuenta: a.name || '',
        currentAmount: a.balance || 0,
        previousAmount: undefined,
      }));
      const result: PnLData = {
        ingresos: mapAccounts(curr.ingresos),
        gastos: mapAccounts(curr.gastos),
        totalIngresos: curr.totalIngresos || 0,
        totalGastos: curr.totalGastos || 0,
        totalIngresosPrev: prev?.totalIngresos || 0,
        totalGastosPrev: prev?.totalGastos || 0,
      };
      if (prev) {
        const prevIngMap = new Map((prev.ingresos || []).map((a: any) => [a.code, a.balance || 0]));
        const prevGasMap = new Map((prev.gastos || []).map((a: any) => [a.code, a.balance || 0]));
        result.ingresos = result.ingresos.map(a => ({ ...a, previousAmount: prevIngMap.get(a.codigo) as number | undefined }));
        result.gastos = result.gastos.map(a => ({ ...a, previousAmount: prevGasMap.get(a.codigo) as number | undefined }));
      }
      return result;
    },
    { enabled: Boolean(dateFrom && dateTo) },
  );
  const data = query.data;
  const loading = query.isLoading || query.isFetching;
  useEffect(() => {
    if (query.error) toast.error(query.error.message || 'Error al cargar estado de resultados');
  }, [query.error]);

  const netIncome = (data?.totalIngresos || 0) - (data?.totalGastos || 0);
  const netIncomePrev = (data?.totalIngresosPrev || 0) - (data?.totalGastosPrev || 0);
  const isProfit = netIncome >= 0;
  const variancePct = data?.totalIngresosPrev && data?.totalIngresosPrev !== 0
    ? ((netIncome - netIncomePrev) / Math.abs(netIncomePrev)) * 100
    : 0;

  const fmt = (n: number) => n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

  const calcVariance = (current: number, previous?: number) => {
    if (!showPreviousYear || previous == null || previous === 0) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const renderSection = (title: string, accounts: PnLAccount[], total: number, totalPrev: number, color: string) => (
    <div className="mb-6">
      <div className={cn("px-4 py-2 rounded-t-lg font-black text-sm uppercase tracking-widest text-white", color)}>
        {title}
      </div>
      <div className="hidden md:block">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Código</TableHead>
            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cuenta</TableHead>
            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Período Actual</TableHead>
            {showPreviousYear && (
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Período Anterior</TableHead>
            )}
            {showPreviousYear && (
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Variación %</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((acc, i) => {
            const varPct = calcVariance(acc.currentAmount, acc.previousAmount);
            return (
              <TableRow key={acc.accountId || i} className="hover:bg-muted/30 border-border/30">
                <TableCell className="font-mono text-xs">{acc.codigo}</TableCell>
                <TableCell className="font-medium">{acc.cuenta}</TableCell>
                <TableCell className={cn("text-right font-mono text-sm font-bold", acc.currentAmount >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {fmt(acc.currentAmount)}
                </TableCell>
                {showPreviousYear && (
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {acc.previousAmount != null ? fmt(acc.previousAmount) : '-'}
                  </TableCell>
                )}
                {showPreviousYear && (
                  <TableCell className={cn("text-right font-mono text-sm font-bold", varPct !== null && varPct >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {varPct !== null ? fmtPct(varPct) : '-'}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
          <TableRow className="bg-muted/50 font-bold border-t-2 border-border">
            <TableCell colSpan={2} className="text-sm uppercase tracking-wider">Total {title}</TableCell>
            <TableCell className={cn("text-right font-mono text-sm", total >= 0 ? "text-emerald-600" : "text-red-600")}>{fmt(total)}</TableCell>
            {showPreviousYear && (
              <TableCell className="text-right font-mono text-sm text-muted-foreground">{fmt(totalPrev)}</TableCell>
            )}
            {showPreviousYear && (
              <TableCell className="text-right font-mono text-sm text-muted-foreground">{fmtPct(calcVariance(total, totalPrev) || 0)}</TableCell>
            )}
          </TableRow>
        </TableBody>
      </Table>
      </div>
      <div className="space-y-2 p-3 md:hidden">
        {accounts.map((acc, i) => {
          const varPct = calcVariance(acc.currentAmount, acc.previousAmount);
          return (
            <div key={acc.accountId || i} className="rounded-xl border border-border/60 bg-card/60 p-3 shadow-sm">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] text-muted-foreground">{acc.codigo}</p>
                  <p className="mt-0.5 truncate text-sm font-bold" title={acc.cuenta}>{acc.cuenta}</p>
                </div>
                <span className={cn("shrink-0 text-right font-mono text-sm font-black", acc.currentAmount >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {fmt(acc.currentAmount)}
                </span>
              </div>
              {showPreviousYear && (
                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
                  <div><span className="block uppercase tracking-wider">Anterior</span><span className="font-mono">{acc.previousAmount != null ? fmt(acc.previousAmount) : '-'}</span></div>
                  <div className="text-right"><span className="block uppercase tracking-wider">Variación</span><span className={cn("font-mono font-bold", varPct !== null && varPct >= 0 ? "text-emerald-600" : "text-red-600")}>{varPct !== null ? fmtPct(varPct) : '-'}</span></div>
                </div>
              )}
            </div>
          );
        })}
        <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-3 font-bold">
          <span className="text-xs uppercase tracking-wider">Total {title}</span>
          <div className="text-right">
            <p className={cn("font-mono text-sm", total >= 0 ? "text-emerald-600" : "text-red-600")}>{fmt(total)}</p>
            {showPreviousYear && <p className="text-[10px] font-mono text-muted-foreground">Anterior: {fmt(totalPrev)}</p>}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-5 bg-muted/30 rounded-2xl border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-[0.2em] bg-background/50 px-3 py-1.5 rounded-lg border border-border/30 shrink-0">
          <Filter className="size-3.5" /> Filtros
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Desde</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-full sm:w-[150px]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Hasta</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-full sm:w-[150px]" />
          </div>
          <div className="flex items-center gap-3 mt-5">
            <Switch id="prev-year" checked={showPreviousYear} onCheckedChange={setShowPreviousYear} />
            <label htmlFor="prev-year" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground cursor-pointer select-none">
              Comparar año anterior
            </label>
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="h-9 px-4 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-rose-500 hover:bg-rose-500/5 rounded-xl border border-dashed border-border/60 transition-all mt-5">
              <X className="size-3" /> Limpiar
            </button>
          )}
        </div>
        <div className="lg:ml-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-border/20">
          <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={loading || !dateFrom || !dateTo} className="h-9">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Actualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold">Estado de Resultados</CardTitle>
          {dateFrom && dateTo && (
            <p className="text-xs text-muted-foreground">
              Período: {new Date(dateFrom).toLocaleDateString('es')} - {new Date(dateTo).toLocaleDateString('es')}
            </p>
          )}
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Cargando...</div>
          ) : !data ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Seleccione un rango de fechas para ver el reporte</div>
          ) : (
            <div>
              {renderSection('INGRESOS', data.ingresos, data.totalIngresos, data.totalIngresosPrev, 'bg-emerald-600')}
              <Separator className="my-4" />
              {renderSection('GASTOS', data.gastos, data.totalGastos, data.totalGastosPrev, 'bg-red-600')}
              <Separator className="my-4" />

              <div className={cn("rounded-xl border-2 p-5", isProfit ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800" : "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800")}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {isProfit ? <TrendingUp className="size-8 text-emerald-500" /> : <TrendingDown className="size-8 text-red-500" />}
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resultado Neto</p>
                      <p className={cn("text-2xl font-black", isProfit ? "text-emerald-600" : "text-red-600")}>
                        {isProfit ? '+' : ''}{fmt(netIncome)}
                      </p>
                    </div>
                  </div>
                  {showPreviousYear && (
                    <div className="text-right">
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">vs Año Anterior</p>
                      <p className={cn("text-lg font-black", variancePct >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {fmtPct(variancePct)}
                      </p>
                      <p className={cn("text-sm font-bold", netIncomePrev >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {fmt(netIncomePrev)}
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <div className="bg-emerald-500/10 rounded-lg p-3 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Total Ingresos</p>
                    <p className="text-lg font-black text-emerald-600">{fmt(data.totalIngresos)}</p>
                  </div>
                  <div className="bg-red-500/10 rounded-lg p-3 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-red-600">Total Gastos</p>
                    <p className="text-lg font-black text-red-600">{fmt(data.totalGastos)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
