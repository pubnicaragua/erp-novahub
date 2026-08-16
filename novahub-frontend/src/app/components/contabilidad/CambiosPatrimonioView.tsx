import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Search, Filter, X, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { toast } from 'sonner';
import { useAccountingQuery } from '../../hooks/useAccountingQuery';
import { DateField } from '../ui/DateField';

interface EquityRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  component?: string;
  openingBalance: number;
  periodChange: number;
  closingBalance: number;
}

interface EquityComponent {
  key: string;
  label: string;
  rows: EquityRow[];
  totalOpening: number;
  totalPeriodChange: number;
  totalClosing: number;
}

interface EquityData {
  rows: EquityRow[];
  components?: EquityComponent[];
  totalOpening: number;
  totalClosing: number;
  netIncome: number;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function CambiosPatrimonioView() {
  // Por defecto se muestran los últimos 30 días: sin seleccionar fechas la
  // vista ya trae información.
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return localISO(d);
  });
  const [dateTo, setDateTo] = useState(() => localISO(new Date()));
  const [searchTerm, setSearchTerm] = useState('');
  const query = useAccountingQuery<EquityData | null>(
    ['equity-changes', dateFrom, dateTo],
    async (signal) => {
      if (!dateFrom || !dateTo) return null;
      const raw: any = await contabilidadService.getEquityChanges({ dateFrom, dateTo }, signal);
      const rows: EquityRow[] = (raw?.rows || raw || []).map((r: any) => ({
        accountId: r.accountId || r.accountCode || '',
        accountCode: r.accountCode || r.codigo || '',
        accountName: r.accountName || r.cuenta || '',
        component: r.component || '',
        openingBalance: r.openingBalance || r.saldoInicial || 0,
        periodChange: r.periodChange || r.cambioPeriodo || 0,
        closingBalance: r.closingBalance || r.saldoFinal || 0,
      }));
      const components: EquityComponent[] = Array.isArray(raw?.components) ? raw.components.map((c: any) => ({
        key: c.key || '',
        label: c.label || 'Componente',
        rows: (c.rows || []).map((r: any) => ({
          accountId: r.accountId || r.accountCode || '',
          accountCode: r.accountCode || r.codigo || '',
          accountName: r.accountName || r.cuenta || '',
          component: r.component || c.key || '',
          openingBalance: r.openingBalance || r.saldoInicial || 0,
          periodChange: r.periodChange || r.cambioPeriodo || 0,
          closingBalance: r.closingBalance || r.saldoFinal || 0,
        })),
        totalOpening: c.totalOpening || 0,
        totalPeriodChange: c.totalPeriodChange || 0,
        totalClosing: c.totalClosing || 0,
      })) : [];
      return {
        rows,
        components,
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

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return data.rows;
    return data.rows.filter(r =>
      r.accountName.toLowerCase().includes(term) || r.accountCode.toLowerCase().includes(term),
    );
  }, [data, searchTerm]);

  const filteredTotalOpening = filteredRows.reduce((s, r) => s + r.openingBalance, 0);
  const filteredTotalClosing = filteredRows.reduce((s, r) => s + r.closingBalance, 0);

  return (
    <div className="min-w-0 space-y-6">
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
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Desde</label>
            <DateField value={dateFrom} onChange={setDateFrom} placeholder="Desde" className="sm:w-[180px]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Hasta</label>
            <DateField value={dateTo} onChange={setDateTo} placeholder="Hasta" className="sm:w-[180px]" />
          </div>
          <div className="relative mt-5">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cuenta por nombre o código..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-9 w-full pl-8 text-xs sm:w-[260px]"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - 30);
              setDateFrom(localISO(d));
              setDateTo(localISO(new Date()));
            }} className="h-9 px-4 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-rose-500 hover:bg-rose-500/5 rounded-xl border border-dashed border-border/60 transition-all mt-5">
              <X className="size-3" /> Restablecer 30 días
            </button>
          )}
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <DollarSign className="size-3.5" /> Saldo Inicial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-black text-emerald-600">{formatCurrency(filteredTotalOpening)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <DollarSign className="size-3.5" /> Saldo Final
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-black text-primary">{formatCurrency(filteredTotalClosing)}</p>
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
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Search className="size-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">{searchTerm.trim() ? 'Sin resultados para la búsqueda' : 'No hay cuentas de patrimonio'}</p>
              <p className="text-xs mt-1">{searchTerm.trim() ? 'Ajusta el término o los filtros' : 'No se encontraron movimientos en el período seleccionado'}</p>
            </div>
          ) : (
            <>
            <div className="hidden overflow-x-auto md:block">
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
                  {data.components && data.components.length > 0 && (
                    data.components.map((component) => (
                      <TableRow key={component.key || component.label} className="bg-primary/5 border-t border-primary/20">
                        <TableCell className="font-mono text-xs text-primary" colSpan={2}>
                          {component.label}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-primary">
                          {formatCurrency(component.totalOpening)}
                        </TableCell>
                        <TableCell className={cn("text-right font-mono text-xs font-bold", component.totalPeriodChange >= 0 ? "text-emerald-600" : "text-red-600")}>
                          {component.totalPeriodChange >= 0 ? '+' : ''}{formatCurrency(component.totalPeriodChange)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-primary">
                          {formatCurrency(component.totalClosing)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {filteredRows.map((row, i) => (
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
                  {data.netIncome !== 0 && (
                    <TableRow className="bg-primary/5 font-bold border-t-2 border-border">
                      <TableCell className="font-mono text-xs text-muted-foreground">—</TableCell>
                      <TableCell className="text-xs font-bold uppercase tracking-wider">Resultado del Ejercicio</TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatCurrency(0)}</TableCell>
                      <TableCell className={cn("text-right font-mono text-xs font-bold", data.netIncome >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {data.netIncome >= 0 ? '+' : ''}{formatCurrency(data.netIncome)}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono text-xs font-bold", data.netIncome >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {formatCurrency(data.netIncome)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-2 p-3 md:hidden">
              {filteredRows.map((row, i) => (
                <div key={row.accountId || i} className="rounded-xl border border-border/60 bg-card/60 p-3 shadow-sm">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] text-muted-foreground">{row.accountCode}</p>
                      <p className="mt-0.5 truncate text-sm font-bold" title={row.accountName}>{row.accountName}</p>
                    </div>
                    <span className={cn("shrink-0 text-right font-mono text-sm font-black", row.closingBalance >= 0 ? "text-emerald-600" : "text-red-600")}>
                      {formatCurrency(row.closingBalance)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-3 text-[10px]">
                    <div><span className="block uppercase tracking-wider text-muted-foreground">Saldo inicial</span><span className={cn("font-mono", row.openingBalance >= 0 ? "text-emerald-600" : "text-red-600")}>{formatCurrency(row.openingBalance)}</span></div>
                    <div className="text-right"><span className="block uppercase tracking-wider text-muted-foreground">Cambio período</span><span className={cn("font-mono font-bold", row.periodChange >= 0 ? "text-emerald-600" : "text-red-600")}>{row.periodChange >= 0 ? '+' : ''}{formatCurrency(row.periodChange)}</span></div>
                  </div>
                  <p className="mt-2 text-right text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Saldo final</p>
                </div>
              ))}
              {data.netIncome !== 0 && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider">Resultado del Ejercicio</span>
                    <span className={cn("font-mono text-sm font-black", data.netIncome >= 0 ? "text-emerald-600" : "text-red-600")}>
                      {data.netIncome >= 0 ? '+' : ''}{formatCurrency(data.netIncome)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            </>
          )}
        </CardContent>
        {data && filteredRows.length > 0 && (
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
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Patrimonio (filtrado)</span>
                <div className="flex items-center gap-6">
                  <span className="text-muted-foreground text-xs">
                    Inicial: <span className="text-foreground font-mono">{formatCurrency(filteredTotalOpening)}</span>
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Final: <span className="text-primary font-mono">{formatCurrency(filteredTotalClosing)}</span>
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
