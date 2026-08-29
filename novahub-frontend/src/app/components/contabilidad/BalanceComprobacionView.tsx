import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Search, Printer, Filter, X, ChevronDown, ChevronUp, Scale, CheckCircle2, AlertTriangle, Settings2 } from 'lucide-react';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { toast } from 'sonner';
import { useAccountingQuery } from '../../hooks/useAccountingQuery';
import { AccountMovementsDetail } from './AccountMovementsDetail';
import { AccountChecklistDialog } from './AccountChecklistDialog';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { DateField } from '../ui/DateField';
import { buildDateFilteredDownloadFileName } from '../../utils/exportFileNames';

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ASSET: 'ACTIVOS',
  LIABILITY: 'PASIVOS',
  EQUITY: 'PATRIMONIO',
  INCOME: 'INGRESOS',
  EXPENSE: 'GASTOS',
};

const ACCOUNT_TYPE_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

const accountTypeLabel = (tipo: string) => ACCOUNT_TYPE_LABELS[tipo] || tipo;

interface TrialBalanceRow {
  accountId: string;
  codigo: string;
  cuenta: string;
  tipo: string;
  debitos: number;
  creditos: number;
  saldo: number;
}

export function BalanceComprobacionView() {
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(`${today.getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(today.toISOString().slice(0, 10));
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  // undefined = la config aún no se carga; null = sin config (modo automático).
  const [configuredAccountIds, setConfiguredAccountIds] = useState<string[] | null | undefined>(undefined);
  const [configLoaded, setConfigLoaded] = useState(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cfg: any = await contabilidadService.getConfig();
        if (mounted) {
          const saved = cfg?.config?.trialBalanceAccountIds;
          setConfiguredAccountIds(Array.isArray(saved) ? saved : null);
        }
      } catch {
        if (mounted) setConfiguredAccountIds(null);
      } finally {
        if (mounted) setConfigLoaded(true);
      }
    })();
    return () => { mounted = false; };
  }, []);
  // La query espera a que la configuración cargue para no mostrar primero
  // todas las cuentas y luego solo las configuradas (las cuentas "desaparecen").
  const accountIdsForQuery = configLoaded && configuredAccountIds && configuredAccountIds.length > 0 ? configuredAccountIds : undefined;
  const query = useAccountingQuery<TrialBalanceRow[]>(
    ['trial-balance', dateFrom, dateTo, configLoaded ? (configuredAccountIds ? configuredAccountIds.join(',') : 'all') : 'loading'],
    async (signal) => {
      const params: { dateFrom?: string; dateTo?: string; accountIds?: string[] } = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (accountIdsForQuery) params.accountIds = accountIdsForQuery;
      const raw: any = await contabilidadService.getTrialBalance(params, signal);
      return (raw?.rows || raw || []).map((r: any) => ({
        accountId: r.accountId || r.accountCode || '',
        codigo: r.accountCode || r.codigo || '',
        cuenta: r.accountName || r.cuenta || '',
        tipo: r.accountType || r.tipo || '',
        debitos: r.totalDebit || r.debitos || 0,
        creditos: r.totalCredit || r.creditos || 0,
        saldo: r.balance || r.saldo || 0,
      }));
    },
    { enabled: Boolean(dateFrom || dateTo) },
  );
  const data = query.data || [];
  const loading = query.isLoading || query.isFetching;
  useEffect(() => {
    if (query.error) toast.error(query.error.message || 'Error al cargar balance de comprobación');
  }, [query.error]);

  const colFilters = useColumnFilters();
  const filterGetters = {
    cuenta: (r: TrialBalanceRow) => r.cuenta,
    debitos: (r: TrialBalanceRow) => r.debitos,
    creditos: (r: TrialBalanceRow) => r.creditos,
    saldo: (r: TrialBalanceRow) => r.saldo,
  };
  const colFilteredData = colFilters.applyTo(data, filterGetters);
  const accountOptionsForFilter = [...new Map(data.map((r) => [r.cuenta, r.cuenta])).entries()]
    .map(([, label]) => ({ value: label, label, count: data.filter((r) => r.cuenta === label).length }));

  const grouped = useMemo(() => ACCOUNT_TYPE_ORDER.map(type => ({
    type,
    label: ACCOUNT_TYPE_LABELS[type],
    rows: colFilteredData
      .filter(r => r.tipo === type)
      .filter(r => !searchTerm || r.cuenta.toLowerCase().includes(searchTerm.toLowerCase()) || r.codigo.toLowerCase().includes(searchTerm.toLowerCase())),
  })).filter(g => g.rows.length > 0), [colFilteredData, searchTerm]);

  const totalDebitos = data.reduce((s, r) => s + r.debitos, 0);
  const totalCreditos = data.reduce((s, r) => s + r.creditos, 0);
  const totalSaldos = data.reduce((s, r) => s + Math.abs(r.saldo), 0);
  const isBalanced = Math.abs(totalDebitos - totalCreditos) < 0.01;
  const difference = totalDebitos - totalCreditos;
  const differenceAbs = Math.abs(difference);
  const higherSide = difference > 0 ? 'los débitos superan a los créditos' : 'los créditos superan a los débitos';

  const fmt = (n: number) => n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const balanceStatusLabel = isBalanced
    ? '✓ BALANCEADO — Débitos = Créditos'
    : `✗ NO BALANCEADO — Diferencia de C$ ${fmt(differenceAbs)} (${higherSide})`;

  const toggleAccount = (row: TrialBalanceRow) => {
    setExpandedAccountId(current => current === row.accountId ? null : row.accountId);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast.error('Permita ventanas emergentes para imprimir'); return; }
    const style = `
      <style>
        @page { margin: 15mm; size: landscape; }
        body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
        h1 { font-size: 16px; margin-bottom: 2px; text-align: center; }
        h2 { font-size: 12px; color: #666; text-align: center; margin-top: 0; font-weight: normal; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { background: #1e3a5f; color: white; padding: 6px 8px; text-align: left; font-size: 9px; text-transform: uppercase; }
        td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
        .group-header { background: #f0f4f8; font-weight: bold; font-size: 10px; text-transform: uppercase; color: #1e3a5f; }
        .total-row { background: #e8f0fe; font-weight: bold; border-top: 2px solid #1e3a5f; }
        .balanced { color: #059669; }
        .not-balanced { color: #dc2626; }
        .positive { color: #059669; }
        .negative { color: #dc2626; }
        .text-right { text-align: right; }
      </style>`;
    const title = 'Balance de Comprobación';
    const period = dateFrom || dateTo ? `Período: ${dateFrom || 'Inicio'} - ${dateTo || 'Actual'}` : '';
    const buildRows = () => {
      let html = '';
      grouped.forEach(g => {
        html += `<tr class="group-header"><td colspan="6">${g.label}</td></tr>`;
        g.rows.forEach(r => {
          const saldoClass = r.saldo >= 0 ? 'positive' : 'negative';
          html += `<tr>
            <td>${r.codigo}</td>
            <td>${r.cuenta}</td>
            <td>${accountTypeLabel(r.tipo)}</td>
            <td class="text-right">${fmt(r.debitos)}</td>
            <td class="text-right">${fmt(r.creditos)}</td>
            <td class="text-right ${saldoClass}">${fmt(r.saldo)}</td>
          </tr>`;
        });
      });
      return html;
    };
    const printFileName = buildDateFilteredDownloadFileName(['balance_comprobacion'], 'pdf', dateFrom, dateTo);
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${printFileName}</title>${style}</head><body>
      <h1>${title}</h1>
      ${period ? `<h2>${period}</h2>` : ''}
      <table>
        <thead><tr>
          <th>Código</th><th>Cuenta</th><th>Tipo</th>
          <th class="text-right">Débitos</th><th class="text-right">Créditos</th><th class="text-right">Saldo</th>
        </tr></thead>
        <tbody>${buildRows()}</tbody>
        <tfoot>
          <tr class="total-row"><td colspan="3">TOTALES</td>
            <td class="text-right">${fmt(totalDebitos)}</td>
            <td class="text-right">${fmt(totalCreditos)}</td>
            <td class="text-right">${fmt(totalSaldos)}</td>
          </tr>
          <tr class="total-row"><td colspan="6" class="${isBalanced ? 'balanced' : 'not-balanced'}">
            ${isBalanced ? '✓ BALANCEADO — Débitos = Créditos' : `✗ NO BALANCEADO — Diferencia de C$ ${fmt(differenceAbs)} (${higherSide})`}
          </td></tr>
        </tfoot>
      </table>
      <p style="text-align:center;color:#999;font-size:8px;margin-top:16px;">
        Generado el ${new Date().toLocaleDateString('es-NI')} a las ${new Date().toLocaleTimeString('es-NI')}
      </p>
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
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
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="h-9 px-4 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-rose-500 hover:bg-rose-500/5 rounded-xl border border-dashed border-border/60 transition-all mt-5">
              <X className="size-3" /> Limpiar
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 items-center gap-2 border-t border-border/20 pt-4 lg:ml-auto lg:flex lg:border-t-0 lg:pt-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar cuenta..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-9 w-full pl-9 sm:w-[220px]" />
          </div>
          <Button variant="outline" size="sm" onClick={handlePrint} className="h-9">
            <Printer className="size-4" /> Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="h-9 gap-1.5">
            <Settings2 className="size-4" /> Configuración
          </Button>
          {configuredAccountIds && configuredAccountIds.length > 0 && (
            <button
              onClick={() => { setConfiguredAccountIds(null); void contabilidadService.updateConfig({ trialBalanceAccountIds: [] }).then(() => toast.success('Mostrando todas las cuentas')).catch(() => undefined); }}
              title="Se está mostrando solo un subconjunto de cuentas. Haz clic para volver a mostrar todas."
              className="h-9 gap-1.5 inline-flex items-center rounded-lg border border-primary/30 bg-primary/5 px-3 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10"
            >
              <X className="size-3.5" /> Filtro activo ({configuredAccountIds.length})
            </button>
          )}
        </div>
      </div>

      <AccountChecklistDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        viewLabel="Balance de Comprobación"
        description="Cuentas contables que alimentan el balance. Solo se muestran cuentas de detalle: las agrupadoras se omiten para no repetir movimientos. Marca con checks las cuentas que quieres ver y operar; las que dejes sin marcar se ocultan del reporte."
        configKey="trialBalanceAccountIds"
        onSaved={() => {
          void (async () => {
            try {
              const cfg: any = await contabilidadService.getConfig();
              const saved = cfg?.config?.trialBalanceAccountIds;
              setConfiguredAccountIds(Array.isArray(saved) ? saved : null);
            } catch { /* noop */ }
          })();
        }}
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/30 px-5 pb-4 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Scale className="size-5 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-xl font-black uppercase italic tracking-tight">Balance de Comprobación</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Haz clic en una cuenta para consultar sus movimientos.</p>
              </div>
            </div>
            <Badge variant={isBalanced ? "default" : "destructive"} className={cn("gap-1 text-[10px] font-black uppercase tracking-widest", isBalanced && "bg-emerald-600")} title={balanceStatusLabel}>
              {isBalanced ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
              {isBalanced ? 'Balanceado' : `No balanceado · C$ ${fmt(differenceAbs)}`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground">Código</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground"><span className="inline-flex items-center gap-1">Cuenta<ColumnFilterMenu label="Cuenta" options={accountOptionsForFilter} selected={colFilters.state.cuenta?.values || []} onSelect={(values) => colFilters.setValues('cuenta', values)} sort={colFilters.state.cuenta?.sort || null} onSort={(sort) => colFilters.setSort('cuenta', sort)} /></span></TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground">Tipo</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground text-right"><span className="inline-flex items-center gap-1">Débitos<ColumnFilterMenu label="Débitos" sort={colFilters.state.debitos?.sort || null} onSort={(sort) => colFilters.setSort('debitos', sort)} /></span></TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground text-right"><span className="inline-flex items-center gap-1">Créditos<ColumnFilterMenu label="Créditos" sort={colFilters.state.creditos?.sort || null} onSort={(sort) => colFilters.setSort('creditos', sort)} /></span></TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground text-right"><span className="inline-flex items-center gap-1">Saldo<ColumnFilterMenu label="Saldo" sort={colFilters.state.saldo?.sort || null} onSort={(sort) => colFilters.setSort('saldo', sort)} /></span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : grouped.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No hay datos</TableCell></TableRow>
                ) : grouped.flatMap((group, gi) => [
                  <TableRow key={`group-${gi}`} className="bg-primary/5 hover:bg-primary/10 border-b-2 border-primary/20">
                    <TableCell colSpan={6} className="py-2">
                      <span className="text-xs font-black uppercase tracking-widest text-primary">{group.label}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground">({group.rows.length} cuentas)</span>
                    </TableCell>
                  </TableRow>,
                  ...group.rows.flatMap((row, ri) => {
                    const isExpanded = expandedAccountId === row.accountId;
                    return [
                    <TableRow key={`row-${gi}-${ri}`} className="border-border/30 hover:bg-muted/30">
                      <TableCell className="font-mono text-xs">{row.codigo}</TableCell>
                      <TableCell className="font-medium text-xs">
                        <button
                          type="button"
                          onClick={() => toggleAccount(row)}
                          aria-expanded={isExpanded}
                          className="flex min-w-0 items-center gap-2 text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          {isExpanded ? <ChevronUp className="size-3.5 shrink-0 text-primary" /> : <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />}
                          <span className="break-words">{row.cuenta}</span>
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider">{accountTypeLabel(row.tipo)}</Badge>
                      </TableCell>
                      <TableCell className={cn("text-right font-mono text-xs", row.debitos > 0 && "text-emerald-600")}>{fmt(row.debitos)}</TableCell>
                      <TableCell className={cn("text-right font-mono text-xs", row.creditos > 0 && "text-emerald-600")}>{fmt(row.creditos)}</TableCell>
                      <TableCell className={cn("text-right font-mono text-xs font-bold", row.saldo >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {fmt(row.saldo)}
                      </TableCell>
                    </TableRow>,
                    ...(isExpanded ? [
                      <TableRow key={`detail-${gi}-${ri}`} className="hover:bg-transparent">
                        <TableCell colSpan={6} className="p-0">
                          <AccountMovementsDetail
                            accountId={row.accountId}
                            codigo={row.codigo}
                            cuenta={row.cuenta}
                            tipo={row.tipo}
                            dateFrom={dateFrom}
                            dateTo={dateTo}
                          />
                        </TableCell>
                      </TableRow>,
                    ] : []),
                    ];
                  }),
                ])}
              </TableBody>
            </Table>
          </div>
          <div className="p-3 md:hidden">
              {loading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Cargando...</div>
              ) : grouped.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No hay datos</div>
              ) : grouped.map((group) => (
                <div key={group.type} className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">{group.label}</span>
                    <span className="text-[10px] text-muted-foreground">{group.rows.length} cuentas</span>
                  </div>
                  {group.rows.map((row) => {
                    const isExpanded = expandedAccountId === row.accountId;
                    return (
                    <div key={`${group.type}-${row.accountId}-${row.codigo}`} className="rounded-xl border border-border/60 bg-card/60 shadow-sm">
                      <button
                        type="button"
                        onClick={() => toggleAccount(row)}
                        aria-expanded={isExpanded}
                        className="flex w-full min-w-0 items-start justify-between gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <div className="flex min-w-0 items-start gap-2">
                          {isExpanded ? <ChevronUp className="mt-0.5 size-3.5 shrink-0 text-primary" /> : <ChevronDown className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
                          <div className="min-w-0">
                          <p className="font-mono text-[10px] text-muted-foreground">{row.codigo}</p>
                          <p className="mt-0.5 truncate text-sm font-bold" title={row.cuenta}>{row.cuenta}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[9px] font-bold uppercase tracking-wider">{accountTypeLabel(row.tipo)}</Badge>
                      </button>
                      <div className="grid grid-cols-3 gap-2 border-t border-border/50 px-3 py-3">
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Débitos</p>
                          <p className={cn("mt-0.5 truncate font-mono text-xs", row.debitos > 0 && "text-emerald-600")}>{fmt(row.debitos)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Créditos</p>
                          <p className={cn("mt-0.5 truncate font-mono text-xs", row.creditos > 0 && "text-emerald-600")}>{fmt(row.creditos)}</p>
                        </div>
                        <div className="min-w-0 text-right">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Saldo</p>
                          <p className={cn("mt-0.5 truncate font-mono text-xs font-bold", row.saldo >= 0 ? "text-emerald-600" : "text-red-600")}>{fmt(row.saldo)}</p>
                        </div>
                      </div>
                      {isExpanded && (
                        <AccountMovementsDetail
                          accountId={row.accountId}
                          codigo={row.codigo}
                          cuenta={row.cuenta}
                          tipo={row.tipo}
                          dateFrom={dateFrom}
                          dateTo={dateTo}
                        />
                      )}
                    </div>
                    );
                  })}
                </div>
              ))}
          </div>
          <Separator />
          <div className={cn("flex flex-col gap-3 px-3 py-4 font-bold sm:flex-row sm:items-center sm:justify-between sm:px-6", isBalanced ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-red-50 dark:bg-red-950/20")}>
            <span className="text-sm uppercase tracking-wider">Totales</span>
            <div className="grid min-w-0 grid-cols-2 gap-2 text-sm sm:flex sm:items-center sm:gap-8">
              <span className={cn("min-w-0 rounded-lg bg-background/40 px-2 py-1.5 sm:bg-transparent sm:p-0", totalDebitos > 0 && "text-emerald-600")}>
                <span className="mr-1 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground sm:hidden">Débitos</span>
                {fmt(totalDebitos)}
              </span>
              <span className={cn("min-w-0 rounded-lg bg-background/40 px-2 py-1.5 sm:bg-transparent sm:p-0", totalCreditos > 0 && "text-emerald-600")}>
                <span className="mr-1 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground sm:hidden">Créditos</span>
                {fmt(totalCreditos)}
              </span>
              <span className={cn("col-span-2 min-w-0 text-left text-[11px] font-black uppercase tracking-wider sm:col-span-1 sm:text-sm", isBalanced ? "text-emerald-600" : "text-red-600")}>
                {isBalanced ? '✓ BALANCEADO' : '✗ NO BALANCEADO'}
              </span>
            </div>
            {!isBalanced && (
              <div className="min-w-0 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-[10px] leading-relaxed text-red-600">
                <span className="block font-black uppercase tracking-wider">
                  Diferencia: C$ {fmt(differenceAbs)}
                </span>
                <span className="block font-medium normal-case">
                  {difference > 0
                    ? 'Los débitos superan a los créditos: falta registrar créditos o hay débitos de más.'
                    : 'Los créditos superan a los débitos: falta registrar débitos o hay créditos de más.'}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
