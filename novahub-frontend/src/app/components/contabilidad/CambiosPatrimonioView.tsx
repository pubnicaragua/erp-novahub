import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { RefreshCw, Filter, X, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { toast } from 'sonner';
import { useAccountingQuery } from '../../hooks/useAccountingQuery';

interface EquityRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  openingBalance: number;
  periodChange: number;
  closingBalance: number;
}

interface EquityData {
  rows: EquityRow[];
  totalOpening: number;
  totalClosing: number;
  netIncome: number;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function CambiosPatrimonioView() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const query = useAccountingQuery<EquityData | null>(
    ['equity-changes', dateFrom, dateTo],
    async (signal) => {
      if (!dateFrom || !dateTo) return null;
      const raw: any = await contabilidadService.getEquityChanges({ dateFrom, dateTo }, signal);
      const rows: EquityRow[] = (raw?.rows || raw || []).map((r: any) => ({
        accountId: r.accountId || r.accountCode || '',
        accountCode: r.accountCode || r.codigo || '',
        accountName: r.accountName || r.cuenta || '',
        openingBalance: r.openingBalance || r.saldoInicial || 0,
        periodChange: r.periodChange || r.cambioPeriodo || 0,
        closingBalance: r.closingBalance || r.saldoFinal || 0,
      }));
      return {
        rows,
        totalOpening: raw?.totalOpening || raw?.totalSaldoInicial || rows.reduce((s: number, r: EquityRow) => s + r.openingBalance, 0),
        totalClosing: raw?.totalClosing || raw?.totalSaldoFinal || rows.reduce((s: number, r: EquityRow) => s + r.closingBalance, 0),
        netIncome: raw?.netIncome || raw?.resultadoEjercicio || 0,
      };
    },
    { enabled: Boolean(dateFrom && dateTo) },
  );
  const data = query.data;
  const loading = query.isLoading || query.isFetching;
  useEffect(() => {
    if (query.error) toast.error(query.error.message || 'Error al cargar cambios en el patrimonio');
  }, [query.error]);

  const netIncomePositive = (data?.netIncome ?? 0) >= 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase italic">
            Cambios en el <span className="text-primary">Patrimonio</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Estado de cambios en el patrimonio neto de la empresa
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-5 bg-muted/30 rounded-2xl border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-[0.2em] bg-background/50 px-3 py-1.5 rounded-lg border border-border/30 shrink-0">
          <Filter className="size-3.5" /> Filtros
        </div>
        <div className="flex flex-wrap items-center gap-4 flex-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Desde</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-[150px]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Hasta</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-[150px]" />
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

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <DollarSign className="size-3.5" /> Saldo Inicial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-black text-emerald-600">{formatCurrency(data.totalOpening)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <DollarSign className="size-3.5" /> Saldo Final
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-black text-primary">{formatCurrency(data.totalClosing)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                {netIncomePositive ? <TrendingUp className="size-3.5 text-emerald-500" /> : <TrendingDown className="size-3.5 text-red-500" />}
                Resultado del Ejercicio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn("text-2xl font-black", netIncomePositive ? "text-emerald-600" : "text-red-600")}>
                {netIncomePositive ? '+' : ''}{formatCurrency(data.netIncome)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold">Estado de Cambios en el Patrimonio</CardTitle>
          {dateFrom && dateTo && (
            <p className="text-xs text-muted-foreground">
              Período: {new Date(dateFrom).toLocaleDateString('es')} - {new Date(dateTo).toLocaleDateString('es')}
            </p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : !data ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Filter className="size-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Seleccione un rango de fechas</p>
              <p className="text-xs mt-1">Para ver el estado de cambios en el patrimonio</p>
            </div>
          ) : data.rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <DollarSign className="size-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">No hay cuentas de patrimonio</p>
              <p className="text-xs mt-1">No se encontraron movimientos en el período seleccionado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Código</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cuenta</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Saldo Inicial</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Cambio del Período</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Saldo Final</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row, i) => (
                    <TableRow key={row.accountId || i} className="hover:bg-muted/30 border-border/30">
                      <TableCell className="font-mono text-xs">{row.accountCode}</TableCell>
                      <TableCell className="font-medium text-xs">{row.accountName}</TableCell>
                      <TableCell className={cn("text-right font-mono text-xs", row.openingBalance >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {formatCurrency(row.openingBalance)}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono text-xs font-bold", row.periodChange >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {row.periodChange >= 0 ? '+' : ''}{formatCurrency(row.periodChange)}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono text-xs font-bold", row.closingBalance >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {formatCurrency(row.closingBalance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {data && data.rows.length > 0 && (
          <>
            <Separator />
            <div className="px-6 py-4 bg-muted/20 border-t border-border/50 rounded-b-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest">Resultado del Ejercicio</span>
                <span className={cn("text-lg font-black", netIncomePositive ? "text-emerald-600" : "text-red-600")}>
                  {netIncomePositive ? '+' : ''}{formatCurrency(data.netIncome)}
                </span>
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between text-sm font-bold">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Patrimonio</span>
                <div className="flex items-center gap-6">
                  <span className="text-muted-foreground text-xs">
                    Inicial: <span className="text-foreground font-mono">{formatCurrency(data.totalOpening)}</span>
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Final: <span className="text-primary font-mono">{formatCurrency(data.totalClosing)}</span>
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
