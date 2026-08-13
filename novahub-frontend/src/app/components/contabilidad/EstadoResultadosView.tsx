import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Search, Filter, X, TrendingUp, TrendingDown, ChevronDown, ChevronUp, BarChart3, Settings2 } from 'lucide-react';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { toast } from 'sonner';
import { useAccountingQuery } from '../../hooks/useAccountingQuery';
import { AccountMovementsDetail } from './AccountMovementsDetail';
import { ReportSectionsDialog } from './ReportSectionsDialog';
import { DateField } from '../ui/DateField';

interface PnLAccount {
  accountId: string;
  codigo: string;
  cuenta: string;
  currentAmount: number;
}

interface PnLSection {
  id: string;
  label: string;
  sign: 'INCOME' | 'EXPENSE';
  accounts: PnLAccount[];
  total: number;
}

interface PnLData {
  ingresos: PnLAccount[];
  gastos: PnLAccount[];
  totalIngresos: number;
  totalGastos: number;
  sections?: PnLSection[];
}

export function EstadoResultadosView() {
  const toLocalDate = (value: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  };
  const initialFrom = () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toLocalDate(d);
  };
  const [dateFrom, setDateFrom] = useState(initialFrom);
  const [dateTo, setDateTo] = useState(() => toLocalDate(new Date()));
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const query = useAccountingQuery<PnLData | null>(
    ['profit-loss', dateFrom, dateTo],
    async (signal) => {
      if (!dateFrom || !dateTo) return null;
      const raw: any = await contabilidadService.getProfitLoss({
        dateFrom,
        dateTo,
      }, signal);
      const curr = raw?.current || raw || {};
      const mapAccounts = (list: any[]): PnLAccount[] => (list || []).map((a: any) => ({
        accountId: a.accountId || a.id || a.code || '',
        codigo: a.code || '',
        cuenta: a.name || '',
        currentAmount: a.balance || 0,
      }));
      const result: PnLData = {
        ingresos: mapAccounts(curr.ingresos),
        gastos: mapAccounts(curr.gastos),
        totalIngresos: curr.totalIngresos || 0,
        totalGastos: curr.totalGastos || 0,
      };
      if (Array.isArray(curr.sections) && curr.sections.length > 0) {
        result.sections = curr.sections.map((s: any) => ({
          id: s.id || s.label,
          label: s.label || 'Sección',
          sign: String(s.sign || '').toUpperCase() === 'EXPENSE' ? 'EXPENSE' : 'INCOME',
          total: s.total || 0,
          accounts: mapAccounts(s.accounts),
        }));
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
  const isProfit = netIncome >= 0;

  const fmt = (n: number) => n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const toggleAccount = (account: PnLAccount) => {
    setExpandedAccountId(current => current === account.accountId ? null : account.accountId);
  };

  const filterAccounts = (accounts: PnLAccount[]) => {
    if (!searchTerm.trim()) return accounts;
    const term = searchTerm.trim().toLowerCase();
    return accounts.filter(a =>
      a.cuenta.toLowerCase().includes(term) || a.codigo.toLowerCase().includes(term),
    );
  };

  const renderSection = (title: string, accounts: PnLAccount[], total: number, color: string, tipo: 'INCOME' | 'EXPENSE') => {
    const visibleAccounts = filterAccounts(accounts);
    return (    <div className="mb-6">
      <div className={cn("px-4 py-2 rounded-t-lg font-black text-sm uppercase tracking-widest text-white", color)}>
        {title}
      </div>
      <div className="hidden md:block">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground">Código</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground">Cuenta</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground text-right">Período Actual</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleAccounts.length === 0 ? (
            <TableRow><TableCell colSpan={3} className="py-6 text-center text-xs text-muted-foreground/60 italic">Sin resultados para la búsqueda</TableCell></TableRow>
          ) : (
          <>
          {visibleAccounts.flatMap((acc, i) => {
            const isExpanded = expandedAccountId === acc.accountId;
            return [
              <TableRow key={acc.accountId || i} className="border-border/30 hover:bg-muted/30">
                <TableCell className="font-mono text-xs">{acc.codigo}</TableCell>
                <TableCell className="font-medium text-xs">
                  <button
                    type="button"
                    onClick={() => toggleAccount(acc)}
                    aria-expanded={isExpanded}
                    className="flex min-w-0 items-center gap-2 text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {isExpanded ? <ChevronUp className="size-3.5 shrink-0 text-primary" /> : <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />}
                    <span className="break-words">{acc.cuenta}</span>
                  </button>
                </TableCell>
                <TableCell className={cn("text-right font-mono text-sm font-bold", acc.currentAmount >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {fmt(acc.currentAmount)}
                </TableCell>
              </TableRow>,
              ...(isExpanded ? [
                <TableRow key={`detail-${acc.accountId || i}`} className="hover:bg-transparent">
                  <TableCell colSpan={3} className="p-0">
                    <AccountMovementsDetail
                      accountId={acc.accountId}
                      codigo={acc.codigo}
                      cuenta={acc.cuenta}
                      tipo={tipo}
                      dateFrom={dateFrom}
                      dateTo={dateTo}
                    />
                  </TableCell>
                </TableRow>,
              ] : []),
            ];
          })}
          </>
          )}
          <TableRow className="bg-muted/50 font-bold border-t-2 border-border">
            <TableCell colSpan={2} className="text-sm uppercase tracking-wider">Total {title}</TableCell>
            <TableCell className={cn("text-right font-mono text-sm", total >= 0 ? "text-emerald-600" : "text-red-600")}>{fmt(total)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      </div>
      <div className="space-y-2 p-3 md:hidden">
        {visibleAccounts.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground/60 italic">Sin resultados para la búsqueda</p>
        ) : (
        visibleAccounts.map((acc, i) => {
          const isExpanded = expandedAccountId === acc.accountId;
          return (
            <div key={acc.accountId || i} className="rounded-xl border border-border/60 bg-card/60 shadow-sm">
              <button
                type="button"
                onClick={() => toggleAccount(acc)}
                aria-expanded={isExpanded}
                className="flex w-full min-w-0 items-start justify-between gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="flex min-w-0 items-start gap-2">
                  {isExpanded ? <ChevronUp className="mt-0.5 size-3.5 shrink-0 text-primary" /> : <ChevronDown className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0">
                  <p className="font-mono text-[10px] text-muted-foreground">{acc.codigo}</p>
                  <p className="mt-0.5 truncate text-sm font-bold" title={acc.cuenta}>{acc.cuenta}</p>
                  </div>
                </div>
                <span className={cn("shrink-0 text-right font-mono text-sm font-black", acc.currentAmount >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {fmt(acc.currentAmount)}
                </span>
              </button>
              {isExpanded && (
                <AccountMovementsDetail
                  accountId={acc.accountId}
                  codigo={acc.codigo}
                  cuenta={acc.cuenta}
                  tipo={tipo}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                />
              )}
            </div>
          );
        })
        )}
        <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-3 font-bold">
          <span className="text-xs uppercase tracking-wider">Total {title}</span>
          <div className="text-right">
            <p className={cn("font-mono text-sm", total >= 0 ? "text-emerald-600" : "text-red-600")}>{fmt(total)}</p>
          </div>
        </div>
      </div>
    </div>
  );
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-5 bg-muted/30 rounded-2xl border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-black text-foreground uppercase tracking-[0.2em] bg-background/50 px-3 py-1.5 rounded-lg border border-border/30 shrink-0">
          <Filter className="size-3.5" /> Filtros
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-foreground uppercase tracking-widest">Desde</label>
            <DateField value={dateFrom} onChange={setDateFrom} placeholder="Desde" className="sm:w-[180px]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-foreground uppercase tracking-widest">Hasta</label>
            <DateField value={dateTo} onChange={setDateTo} placeholder="Hasta" className="sm:w-[180px]" />
          </div>
          <div className="relative mt-5">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cuenta por nombre o código..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setExpandedAccountId(null); }}
              className="h-9 w-full pl-8 text-xs sm:w-[260px]"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="h-9 px-4 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-rose-500 hover:bg-rose-500/5 rounded-xl border border-dashed border-border/60 transition-all mt-5">
              <X className="size-3" /> Limpiar
            </button>
          )}
        </div>
        <div className="lg:ml-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-border/20 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="h-9 gap-1.5">
            <Settings2 className="size-4" /> Configuración
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/30 px-5 pb-4 pt-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <BarChart3 className="size-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-xl font-black uppercase italic tracking-tight">Estado de Resultados</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Haz clic en una cuenta para consultar sus movimientos.</p>
            </div>
          </div>
          {dateFrom && dateTo && (
            <p className="mt-3 text-xs text-muted-foreground">
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
              {data.sections && data.sections.length > 0 ? (
                data.sections.map((section, index) => (
                  <div key={section.id}>
                    {index > 0 && <Separator className="my-4" />}
                    {renderSection(
                      section.label,
                      section.accounts,
                      section.total,
                      section.sign === 'INCOME' ? 'bg-emerald-600' : 'bg-red-600',
                      section.sign,
                    )}
                  </div>
                ))
              ) : (
                <>
                  {renderSection('INGRESOS', data.ingresos, data.totalIngresos, 'bg-emerald-600', 'INCOME')}
                  <Separator className="my-4" />
                  {renderSection('GASTOS', data.gastos, data.totalGastos, 'bg-red-600', 'EXPENSE')}
                  <Separator className="my-4" />
                </>
              )}

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
      <ReportSectionsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        onSaved={() => query.refetch()}
      />
    </div>
  );
}

