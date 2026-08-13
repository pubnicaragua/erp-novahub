import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Search, Filter, Scale, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Settings2, X } from 'lucide-react';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { toast } from 'sonner';
import { useAccountingQuery } from '../../hooks/useAccountingQuery';
import { AccountMovementsDetail } from './AccountMovementsDetail';
import { ReportSectionsDialog, type ReportSection, type ReportSign } from './ReportSectionsDialog';
import { DateField } from '../ui/DateField';

const BALANCE_SHEET_SECTIONS: ReportSection[] = [
  { id: 'activos-corrientes', label: 'Activos corrientes', sign: 'ASSET', accountIds: [] },
  { id: 'activos-no-corrientes', label: 'Activos no corrientes', sign: 'ASSET', accountIds: [] },
  { id: 'pasivos-corrientes', label: 'Pasivos corrientes', sign: 'LIABILITY', accountIds: [] },
  { id: 'pasivos-no-corrientes', label: 'Pasivos no corrientes', sign: 'LIABILITY', accountIds: [] },
  { id: 'patrimonio', label: 'Patrimonio', sign: 'EQUITY', accountIds: [] },
];

const BALANCE_SHEET_SIGNS: ReportSign[] = [
  { value: 'ASSET', label: 'Activos', accountTypes: ['ASSET'] },
  { value: 'LIABILITY', label: 'Pasivos', accountTypes: ['LIABILITY'] },
  { value: 'EQUITY', label: 'Patrimonio', accountTypes: ['EQUITY'] },
];

const SIGN_HEADER_CLASSES: Record<string, string> = {
  ASSET: 'bg-blue-600',
  LIABILITY: 'bg-amber-600',
  EQUITY: 'bg-purple-600',
};

interface BSAccount {
  accountId: string;
  codigo: string;
  cuenta: string;
  tipo: string;
  currentAmount: number;
  openingAmount?: number;
}

interface BSSection {
  id: string;
  label: string;
  sign: string;
  accounts: BSAccount[];
  total: number;
  openingTotal?: number;
}

interface BSData {
  assets: BSAccount[];
  liabilities: BSAccount[];
  equity: BSAccount[];
  sections?: BSSection[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  openingTotalAssets?: number;
  openingTotalLiabilities?: number;
  openingTotalEquity?: number;
}

export function BalanceGeneralView() {
  const [dateFrom, setDateFrom] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const showOpening = Boolean(dateFrom);
  const query = useAccountingQuery<BSData | null>(
    ['balance-sheet', date, dateFrom || ''],
    async (signal) => {
      if (!date) return null;
      const raw: any = await contabilidadService.getBalanceSheet({ date, dateFrom: dateFrom || undefined }, signal);
      const curr = raw?.current || raw || {};
      const mapAccounts = (accounts: any[]): BSAccount[] => (accounts || []).map((a: any) => ({
        accountId: a.id || '',
        codigo: a.code || '',
        cuenta: a.name || a.cuenta || '',
        tipo: a.type || '',
        currentAmount: (a.balance || 0) + (a.calculatedBalance || 0),
        openingAmount: a.openingBalance != null ? Number(a.openingBalance) : undefined,
      }));
      const mapSection = (s: any): BSSection => ({
        id: s.id || s.label,
        label: s.label || 'Sección',
        sign: String(s.sign || '').toUpperCase(),
        accounts: (s.accounts || []).map((a: any) => ({
          accountId: a.accountId || '',
          codigo: a.code || '',
          cuenta: a.name || '',
          tipo: a.type || '',
          currentAmount: a.balance || 0,
          openingAmount: a.openingBalance != null ? Number(a.openingBalance) : undefined,
        })),
        total: s.total || 0,
        openingTotal: s.openingTotal != null ? Number(s.openingTotal) : undefined,
      });
      const result: BSData = {
        assets: mapAccounts(curr.activos?.accounts),
        liabilities: mapAccounts(curr.pasivos?.accounts),
        equity: mapAccounts(curr.patrimonio?.accounts),
        sections: Array.isArray(curr.sections) ? curr.sections.map(mapSection) : undefined,
        totalAssets: (curr.totalActivos ?? curr.activos?.total) || 0,
        totalLiabilities: (curr.totalPasivos ?? curr.pasivos?.total) || 0,
        totalEquity: (curr.totalPatrimonio ?? curr.patrimonio?.total) || 0,
        openingTotalAssets: curr.openingTotalActivos != null ? Number(curr.openingTotalActivos) : undefined,
        openingTotalLiabilities: curr.openingTotalPasivos != null ? Number(curr.openingTotalPasivos) : undefined,
        openingTotalEquity: curr.openingTotalPatrimonio != null ? Number(curr.openingTotalPatrimonio) : undefined,
      };
      return result;
    },
    { enabled: Boolean(date) },
  );
  const data = query.data;
  const loading = query.isLoading || query.isFetching;
  useEffect(() => {
    if (query.error) toast.error(query.error.message || 'Error al cargar balance general');
  }, [query.error]);

  const totalActivos = data?.totalAssets || 0;
  const totalPasivos = data?.totalLiabilities || 0;
  const totalPatrimonio = data?.totalEquity || 0;
  const totalPasivoPatrimonio = totalPasivos + totalPatrimonio;
  const isBalanced = Math.abs(totalActivos - totalPasivoPatrimonio) < 0.01;
  const difference = totalActivos - totalPasivoPatrimonio;

  const openingActivos = data?.openingTotalAssets ?? (showOpening ? 0 : undefined);
  const openingPasivos = data?.openingTotalLiabilities ?? (showOpening ? 0 : undefined);
  const openingPatrimonio = data?.openingTotalEquity ?? (showOpening ? 0 : undefined);

  const fmt = (n: number) => n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const filterAccounts = (accounts: BSAccount[]) => {
    if (!searchTerm.trim()) return accounts;
    const term = searchTerm.trim().toLowerCase();
    return accounts.filter(a =>
      a.cuenta.toLowerCase().includes(term) || a.codigo.toLowerCase().includes(term),
    );
  };

  const renderSection = (title: string, accounts: BSAccount[], total: number, openingTotal: number | undefined, headerClass: string) => {
    const visibleAccounts = filterAccounts(accounts);
    return (
    <div className="mb-6">
      <div className={cn("px-4 py-2 rounded-t-lg font-black text-sm uppercase tracking-widest text-white", headerClass)}>
        {title}
        <span className="ml-2 text-[10px] opacity-70">({visibleAccounts.length} cuentas)</span>
      </div>
      <div className="hidden md:block">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-border/50">
            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Código</TableHead>
            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cuenta</TableHead>
            {showOpening && (
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Saldo Inicial</TableHead>
            )}
            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Saldo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleAccounts.length === 0 ? (
            <TableRow><TableCell colSpan={showOpening ? 4 : 3} className="py-6 text-center text-xs text-muted-foreground/60 italic">Sin resultados para la búsqueda</TableCell></TableRow>
          ) : (
          visibleAccounts.flatMap((acc, i) => {
            const canExpand = Boolean(acc.accountId);
            const isExpanded = expandedAccountId === acc.accountId;
            return [
            <TableRow key={acc.accountId || i} className="hover:bg-muted/30 border-border/30">
              <TableCell className="font-mono text-xs">{acc.codigo}</TableCell>
              <TableCell className="font-medium">
                {canExpand ? (
                  <button
                    type="button"
                    onClick={() => setExpandedAccountId(current => current === acc.accountId ? null : acc.accountId)}
                    aria-expanded={isExpanded}
                    className="flex min-w-0 items-center gap-2 text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {isExpanded ? <ChevronUp className="size-3.5 shrink-0 text-primary" /> : <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />}
                    <span className="break-words">{acc.cuenta}</span>
                  </button>
                ) : (
                  <span className="break-words">{acc.cuenta}</span>
                )}
              </TableCell>
              {showOpening && (
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {acc.openingAmount != null ? fmt(acc.openingAmount) : '-'}
                </TableCell>
              )}
              <TableCell className={cn("text-right font-mono text-sm font-bold", acc.currentAmount >= 0 ? "text-emerald-600" : "text-red-600")}>
                {fmt(acc.currentAmount)}
              </TableCell>
            </TableRow>,
            ...(isExpanded && canExpand ? [
              <TableRow key={`${acc.accountId}-detail`} className="hover:bg-transparent">
                <TableCell colSpan={showOpening ? 4 : 3} className="p-0">
                  <AccountMovementsDetail
                    accountId={acc.accountId}
                    codigo={acc.codigo}
                    cuenta={acc.cuenta}
                    tipo={acc.tipo}
                    dateFrom={showOpening ? dateFrom : ''}
                    dateTo={date}
                  />
                </TableCell>
              </TableRow>,
            ] : []),
            ];
          })
          )}
          <TableRow className="bg-muted/50 font-bold border-t-2 border-border">
            <TableCell colSpan={2} className="text-sm uppercase tracking-wider">Total {title}</TableCell>
            {showOpening && (
              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                {openingTotal != null ? fmt(openingTotal) : '-'}
              </TableCell>
            )}
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
          const canExpand = Boolean(acc.accountId);
          const isExpanded = expandedAccountId === acc.accountId;
          return (
          <div key={acc.accountId || i} className="rounded-xl border border-border/60 bg-card/60 p-3 shadow-sm">
            <div className="flex min-w-0 items-start justify-between gap-3">
              {canExpand ? (
                <button
                  type="button"
                  onClick={() => setExpandedAccountId(current => current === acc.accountId ? null : acc.accountId)}
                  aria-expanded={isExpanded}
                  className="flex min-w-0 items-start gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {isExpanded ? <ChevronUp className="mt-0.5 size-3.5 shrink-0 text-primary" /> : <ChevronDown className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] text-muted-foreground">{acc.codigo}</p>
                    <p className="mt-0.5 truncate text-sm font-bold" title={acc.cuenta}>{acc.cuenta}</p>
                  </div>
                </button>
              ) : (
                <div className="min-w-0">
                  <p className="font-mono text-[10px] text-muted-foreground">{acc.codigo}</p>
                  <p className="mt-0.5 truncate text-sm font-bold" title={acc.cuenta}>{acc.cuenta}</p>
                </div>
              )}
              <div className="shrink-0 text-right">
                {showOpening && acc.openingAmount != null && (
                  <p className="text-[10px] text-muted-foreground">Inicial: {fmt(acc.openingAmount)}</p>
                )}
                <span className={cn("font-mono text-sm font-black", acc.currentAmount >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {fmt(acc.currentAmount)}
                </span>
              </div>
            </div>
            {isExpanded && canExpand && (
              <div className="mt-2">
                <AccountMovementsDetail
                  accountId={acc.accountId}
                  codigo={acc.codigo}
                  cuenta={acc.cuenta}
                  tipo={acc.tipo}
                  dateFrom={showOpening ? dateFrom : ''}
                  dateTo={date}
                />
              </div>
            )}
          </div>
          );
        })
        )}
        <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-3 font-bold">
          <span className="text-xs uppercase tracking-wider">Total {title}</span>
          <div className="text-right">
            {showOpening && openingTotal != null && (
              <p className="text-[10px] font-mono text-muted-foreground">Inicial: {fmt(openingTotal)}</p>
            )}
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
        <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-[0.2em] bg-background/50 px-3 py-1.5 rounded-lg border border-border/30 shrink-0">
          <Filter className="size-3.5" /> Filtros
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Desde</label>
            <DateField value={dateFrom} onChange={setDateFrom} placeholder="Desde (inicio del período)" className="sm:w-[200px]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Al corte</label>
            <DateField value={date} onChange={setDate} placeholder="Fecha del balance" className="sm:w-[180px]" />
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
          {(dateFrom || date) && (
            <button onClick={() => { setDateFrom(''); setSearchTerm(''); }} className="h-9 px-4 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-rose-500 hover:bg-rose-500/5 rounded-xl border border-dashed border-border/60 transition-all mt-5">
              <X className="size-3" /> Limpiar período
            </button>
          )}
        </div>
        <div className="lg:ml-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-border/20 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="h-9 gap-1.5">
            <Settings2 className="size-4" /> Configuración
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-lg font-bold">Balance General</CardTitle>
              {date && (
                <p className="text-xs text-muted-foreground mt-1">
                  {showOpening && dateFrom
                    ? <>Período: {new Date(dateFrom).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })} - {new Date(date).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}</>
                    : <>Al {new Date(date).toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' })}</>}
                  · Haz clic en una cuenta para consultar sus movimientos.
                </p>
              )}
            </div>
            <Badge
              variant={isBalanced ? "default" : "destructive"}
              className={cn("text-[10px] font-black uppercase tracking-widest gap-1", isBalanced && "bg-emerald-600")}
            >
              {isBalanced ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
              {isBalanced ? 'Balanceado' : 'Diferencia: ' + fmt(difference)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Cargando...</div>
          ) : !data ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Seleccione una fecha para ver el reporte</div>
          ) : (
            <div>
              {data.sections && data.sections.length > 0 ? (
                <>
                  {data.sections.map((section) => (
                    <div key={section.id} className="mb-6">
                      {renderSection(section.label, section.accounts, section.total, section.openingTotal, SIGN_HEADER_CLASSES[section.sign] || 'bg-slate-600')}
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {renderSection('ACTIVOS', data.assets, data.totalAssets, openingActivos, 'bg-blue-600')}
                  <Separator className="my-4" />
                  {renderSection('PASIVOS', data.liabilities, data.totalLiabilities, openingPasivos, 'bg-amber-600')}
                  <Separator className="my-4" />
                  {renderSection('PATRIMONIO', data.equity, data.totalEquity, openingPatrimonio, 'bg-purple-600')}
                  <Separator className="my-4" />
                </>
              )}

              <div className={cn("rounded-xl border-2 p-5", isBalanced ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800" : "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800")}>
                <div className="flex items-center gap-4">
                  <Scale className={cn("size-10", isBalanced ? "text-emerald-500" : "text-red-500")} />
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Verificación Contable</p>
                    <p className={cn("text-lg font-black", isBalanced ? "text-emerald-600" : "text-red-600")}>
                      {isBalanced ? 'Total Activos = Total Pasivos + Total Patrimonio' : `Diferencia: ${fmt(difference)}`}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                  <div className="bg-blue-500/10 rounded-lg p-3 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">Total Activos</p>
                    {showOpening && openingActivos != null && <p className="text-[10px] font-semibold text-muted-foreground">Inicial: {fmt(openingActivos)}</p>}
                    <p className="text-lg font-black text-blue-600">{fmt(totalActivos)}</p>
                  </div>
                  <div className="bg-amber-500/10 rounded-lg p-3 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Total Pasivos</p>
                    {showOpening && openingPasivos != null && <p className="text-[10px] font-semibold text-muted-foreground">Inicial: {fmt(openingPasivos)}</p>}
                    <p className="text-lg font-black text-amber-600">{fmt(totalPasivos)}</p>
                  </div>
                  <div className="bg-purple-500/10 rounded-lg p-3 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-purple-600">Total Patrimonio</p>
                    {showOpening && openingPatrimonio != null && <p className="text-[10px] font-semibold text-muted-foreground">Inicial: {fmt(openingPatrimonio)}</p>}
                    <p className="text-lg font-black text-purple-600">{fmt(totalPatrimonio)}</p>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    Pasivos + Patrimonio = <span className="font-bold">{fmt(totalPasivoPatrimonio)}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <ReportSectionsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        configKey="balanceSheetSections"
        title="Balance General"
        signs={BALANCE_SHEET_SIGNS}
        defaultSections={BALANCE_SHEET_SECTIONS}
        description="Define cómo se compone el Balance General: cada sección agrupa las cuentas del catálogo completo que elijas (activos, pasivos y patrimonio). Las cuentas sin marcar no aparecen en el balance."
        onSaved={() => query.refetch()}
      />
      {data?.sections && data.sections.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Balance General configurado con {data.sections.reduce((s, sec) => s + sec.accounts.length, 0)} cuentas en {data.sections.length} secciones. Usa el botón Configuración para cambiar qué cuentas se muestran.
        </p>
      )}
    </div>
  );
}
