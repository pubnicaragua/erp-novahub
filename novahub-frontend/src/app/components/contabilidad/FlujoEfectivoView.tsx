import { useState, useEffect, Fragment, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '../ui/dialog';
import { Checkbox } from '../ui/checkbox';
import { Search, Filter, X, ArrowUpCircle, ArrowDownCircle, DollarSign, ChevronDown, Settings2, Landmark, Loader2 } from 'lucide-react';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { useAccountingQuery, accountingList } from '../../hooks/useAccountingQuery';
import { useQueryClient } from '@tanstack/react-query';
import { DateField } from '../ui/DateField';

interface CashFlowTx {
  id: string;
  date: string;
  description?: string;
  reference?: string;
  debit?: number;
  credit?: number;
}

interface CashFlowItem {
  concept: string;
  amount: number;
  debit?: number;
  credit?: number;
  transactions?: CashFlowTx[];
}

interface CashFlowSection {
  items: CashFlowItem[];
  subtotal: number;
}

interface CashFlowData {
  operativas: CashFlowSection;
  inversion: CashFlowSection;
  financiamiento: CashFlowSection;
  netCashFlow: number;
  beginningCash: number;
  endingCash: number;
}

const SECTION_CONFIG = [
  {
    key: 'operativas' as const,
    title: 'Actividades Operativas',
    subtitle: 'Flujos de efectivo de actividades de operación',
    headerClass: 'bg-emerald-600',
    icon: ArrowUpCircle,
  },
  {
    key: 'inversion' as const,
    title: 'Actividades de Inversión',
    subtitle: 'Flujos de efectivo de actividades de inversión',
    headerClass: 'bg-amber-600',
    icon: ArrowDownCircle,
  },
  {
    key: 'financiamiento' as const,
    title: 'Actividades de Financiamiento',
    subtitle: 'Flujos de efectivo de actividades de financiamiento',
    headerClass: 'bg-purple-600',
    icon: DollarSign,
  },
];

const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function FlujoEfectivoView() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return localISO(d);
  });
  const [dateTo, setDateTo] = useState(() => localISO(new Date()));
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<string[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSearch, setSettingsSearch] = useState('');
  const queryClient = useQueryClient();
  const query = useAccountingQuery<CashFlowData | null>(
    ['cash-flow', dateFrom, dateTo],
    async (signal) => {
      if (!dateFrom || !dateTo) return null;
      const raw: any = await contabilidadService.getCashFlow({ dateFrom, dateTo }, signal);
      const result: CashFlowData = {
        operativas: {
          items: raw?.operatingActivities?.items || [{ concept: 'Actividades Operativas', amount: raw?.operatingActivities?.subtotal || 0 }],
          subtotal: raw?.operatingActivities?.subtotal ?? raw?.operatingActivities?.netCash ?? 0,
        },
        inversion: {
          items: raw?.investingActivities?.items || [{ concept: 'Actividades de Inversión', amount: raw?.investingActivities?.subtotal || 0 }],
          subtotal: raw?.investingActivities?.subtotal ?? raw?.investingActivities?.netCash ?? 0,
        },
        financiamiento: {
          items: raw?.financingActivities?.items || [{ concept: 'Actividades de Financiamiento', amount: raw?.financingActivities?.subtotal || 0 }],
          subtotal: raw?.financingActivities?.subtotal ?? raw?.financingActivities?.netCash ?? 0,
        },
        netCashFlow: raw?.netCashChange || 0,
        beginningCash: raw?.beginningCashBalance || 0,
        endingCash: raw?.endingCashBalance || 0,
      };
      return result;
    },
    { enabled: Boolean(dateFrom && dateTo) },
  );
  const data = query.data;
  const loading = query.isLoading || query.isFetching;
  useEffect(() => {
    if (query.error) toast.error(query.error.message || 'Error al cargar flujo de efectivo');
  }, [query.error]);

  const accountsQuery = useAccountingQuery<any[]>(['accounts'], async (signal) => accountingList(await contabilidadService.getChartOfAccounts(false, signal)));
  const bankAccountsQuery = useAccountingQuery<any[]>(['bank-accounts'], async (signal) => accountingList(await api.get('/bank-accounts', { signal })));
  const settingsConfigQuery = useAccountingQuery<any>(['config'], async (signal) => contabilidadService.getConfig(signal), { enabled: showSettings });

  const flatAccounts = useMemo(() => {
    const result: any[] = [];
    const flatten = (items: any[]) => items.forEach(item => {
      const { children, ...rest } = item;
      result.push(rest);
      if (Array.isArray(children)) flatten(children);
    });
    flatten(accountsQuery.data || []);
    return result;
  }, [accountsQuery.data]);

  // Cuentas candidatas de efectivo: vinculadas a bancos, código 10xx, o nombre con caja/banco/efectivo.
  const cashCandidates = useMemo(() => {
    const bankIds = new Set((bankAccountsQuery.data || []).map((b: any) => b.accountId));
    return flatAccounts.filter((a: any) =>
      bankIds.has(a.id) ||
      String(a.code || '').startsWith('1000') ||
      /caja|banco|bancos|efectivo/i.test(a.name || ''),
    );
  }, [flatAccounts, bankAccountsQuery.data]);

  // Todo el catálogo de detalle: la configuración ofrece todas las cuentas,
  // no solo las que el sistema detecta automáticamente.
  const leafAccounts = useMemo(() => {
    const parentIds = new Set(flatAccounts.filter((a: any) => a.parentId).map((a: any) => a.parentId));
    return flatAccounts
      .filter((a: any) => !parentIds.has(a.id))
      .filter((a: any) => a.isActive !== false && a.acceptsPostings !== false);
  }, [flatAccounts]);

  const settingsVisibleAccounts = useMemo(() => {
    const term = settingsSearch.trim().toLowerCase();
    if (!term) return leafAccounts;
    return leafAccounts.filter((a: any) =>
      a.code.toLowerCase().includes(term) || a.name.toLowerCase().includes(term));
  }, [leafAccounts, settingsSearch]);

  useEffect(() => {
    if (showSettings && !settingsLoaded && settingsConfigQuery.data) {
      const configured = ((settingsConfigQuery.data as any)?.config?.cashFlow?.accountIds || []) as string[];
      if (Array.isArray(configured) && configured.length > 0) {
        setSettingsDraft(configured);
      } else {
        // Sin configuración: se pre-marcan las cuentas que el sistema detecta
        // automáticamente, para que el usuario vea el estado real.
        setSettingsDraft((cashCandidates.map((a: any) => a.id)));
      }
      setSettingsLoaded(true);
    }
  }, [showSettings, settingsLoaded, settingsConfigQuery.data, cashCandidates]);

  const handleSettingsOpenChange = (next: boolean) => {
    if (!next) { setSettingsLoaded(false); setSettingsDraft([]); setSettingsSearch(''); }
    setShowSettings(next);
  };

  const handleSettingsSave = async () => {
    setSettingsSaving(true);
    try {
      await contabilidadService.updateConfig({ config: { cashFlow: { accountIds: settingsDraft } } });
      toast.success('Cuentas de efectivo del Flujo de Efectivo guardadas');
      await queryClient.invalidateQueries({ queryKey: ['accounting'] });
      handleSettingsOpenChange(false);
      query.refetch();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al guardar la configuración');
    } finally {
      setSettingsSaving(false);
    }
  };

  const fmt = (n: number) => {
    const abs = Math.abs(n).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n < 0 ? `(${abs})` : abs;
  };

  const filteredData = useMemo(() => {
    if (!data) return data;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return data;
    const filterSection = (section: CashFlowSection): CashFlowSection => {
      const items = section.items.filter((item) => item.concept.toLowerCase().includes(term));
      return { items, subtotal: items.reduce((s, item) => s + item.amount, 0) };
    };
    return {
      ...data,
      operativas: filterSection(data.operativas),
      inversion: filterSection(data.inversion),
      financiamiento: filterSection(data.financiamiento),
    };
  }, [data, searchTerm]);

  const renderSection = (section: typeof SECTION_CONFIG[number], secData: CashFlowSection) => {
    const Icon = section.icon;
    const itemKey = (item: CashFlowItem, i: number) => `${section.key}:${i}:${item.concept}`;
    const renderTxDetail = (item: CashFlowItem) => {
      if (!item.transactions || item.transactions.length === 0) return null;
      return (
        <div className="mt-1 divide-y divide-border/30 rounded-lg border border-border/40 bg-background/60">
          {item.transactions.map(tx => (
            <div key={tx.id} className="flex items-center gap-3 px-3 py-1.5">
              <span className="w-20 shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
                {new Date(tx.date).toLocaleDateString('es')}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px]">
                {tx.description}
                {tx.reference ? <span className="ml-1.5 text-[9px] font-mono text-muted-foreground">{tx.reference}</span> : null}
              </span>
              <span className="w-20 shrink-0 text-right font-mono text-[11px] text-emerald-600">{tx.debit ? fmt(tx.debit) : ''}</span>
              <span className="w-20 shrink-0 text-right font-mono text-[11px] text-red-600">{tx.credit ? fmt(tx.credit) : ''}</span>
            </div>
          ))}
        </div>
      );
    };
    return (
      <div className="mb-6">
        <div className={cn("px-4 py-2 rounded-t-lg font-black text-sm uppercase tracking-widest text-white", section.headerClass)}>
          <div className="flex items-center gap-2">
            <Icon className="size-4" />
            {section.title}
          </div>
          <p className="text-[9px] font-normal opacity-70 tracking-normal normal-case">{section.subtitle}</p>
        </div>
        <div className="hidden md:block">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Concepto</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right w-[110px]">Debe</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right w-[110px]">Haber</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right w-[130px]">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {secData.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-12 text-center text-muted-foreground text-xs">Sin movimientos</TableCell>
              </TableRow>
            ) : secData.items.map((item, i) => {
              const key = itemKey(item, i);
              const expanded = expandedItem === key;
              const hasDetail = (item.transactions?.length || 0) > 0;
              return (
                <Fragment key={key}>
                  <TableRow
                    className={cn("border-border/30", hasDetail && "cursor-pointer hover:bg-muted/20")}
                    onClick={() => hasDetail && setExpandedItem(expanded ? null : key)}
                  >
                    <TableCell className="font-medium text-sm">
                      <span className="flex items-center gap-2">
                        {hasDetail ? (
                          <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform shrink-0", expanded && "rotate-180")} />
                        ) : <span className="w-3.5 shrink-0" />}
                        {item.concept}
                        {hasDetail ? <span className="text-[9px] font-normal text-muted-foreground">({item.transactions!.length})</span> : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{item.debit ? fmt(item.debit) : ''}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{item.credit ? fmt(item.credit) : ''}</TableCell>
                    <TableCell className={cn("text-right font-mono text-sm font-bold", item.amount >= 0 ? "text-emerald-600" : "text-red-600")}>
                      {fmt(item.amount)}
                    </TableCell>
                  </TableRow>
                  {expanded && (
                    <TableRow className="hover:bg-transparent border-border/20 bg-muted/10">
                      <TableCell colSpan={4} className="p-1">
                        {renderTxDetail(item)}
                        {item.transactions?.length === 0 && <p className="px-3 py-2 text-[10px] text-muted-foreground">Sin transacciones individuales en el período</p>}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
            <TableRow className="bg-muted/50 font-bold border-t-2 border-border">
              <TableCell className="text-sm uppercase tracking-wider">Subtotal</TableCell>
              <TableCell colSpan={2} />
              <TableCell className={cn("text-right font-mono text-sm", secData.subtotal >= 0 ? "text-emerald-600" : "text-red-600")}>
                {fmt(secData.subtotal)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        </div>
        <div className="space-y-2 p-3 md:hidden">
          {secData.items.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">Sin movimientos</div>
          ) : secData.items.map((item, i) => {
            const key = itemKey(item, i);
            const expanded = expandedItem === key;
            const hasDetail = (item.transactions?.length || 0) > 0;
            return (
              <div key={key} className="rounded-xl border border-border/60 bg-card/60 p-3 shadow-sm">
                <div
                  className={cn("flex min-w-0 items-center justify-between gap-3", hasDetail && "cursor-pointer")}
                  onClick={() => hasDetail && setExpandedItem(expanded ? null : key)}
                >
                  <p className="flex min-w-0 items-center gap-2 truncate text-sm font-medium" title={item.concept}>
                    {hasDetail ? (
                      <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
                    ) : null}
                    <span className="truncate">{item.concept}</span>
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.debit || item.credit ? (
                      <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
                        D: {item.debit ? fmt(item.debit) : '—'} · H: {item.credit ? fmt(item.credit) : '—'}
                      </span>
                    ) : null}
                    <span className={cn("font-mono text-sm font-black", item.amount >= 0 ? "text-emerald-600" : "text-red-600")}>{fmt(item.amount)}</span>
                  </div>
                </div>
                {expanded && renderTxDetail(item)}
              </div>
            );
          })}
          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-3 font-bold">
            <span className="text-xs uppercase tracking-wider">Subtotal</span>
            <span className={cn("font-mono text-sm", secData.subtotal >= 0 ? "text-emerald-600" : "text-red-600")}>{fmt(secData.subtotal)}</span>
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
            <DateField value={dateFrom} onChange={setDateFrom} placeholder="Desde" className="sm:w-[180px]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Hasta</label>
            <DateField value={dateTo} onChange={setDateTo} placeholder="Hasta" className="sm:w-[180px]" />
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
        <div className="lg:ml-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-border/20 flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cuenta o concepto..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-9 w-full pl-9 sm:w-[200px]"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="h-9 gap-1.5">
            <Settings2 className="size-4" /> Cuentas de efectivo
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold">Flujo de Efectivo</CardTitle>
          <p className="text-xs text-muted-foreground">
            {dateFrom && dateTo
              ? <>Período: {new Date(dateFrom).toLocaleDateString('es')} - {new Date(dateTo).toLocaleDateString('es')} <span className="text-primary">(últimos 30 días)</span></>
              : 'Seleccione un rango de fechas para ver el reporte'}
          </p>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Cargando...</div>
          ) : !data ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Seleccione un rango de fechas para ver el reporte</div>
          ) : (            <div>
              {(filteredData ? [filteredData.operativas, filteredData.inversion, filteredData.financiamiento] : []).reduce((s, sec) => s + sec.items.length, 0) === 0 && searchTerm.trim() ? (
                <p className="py-8 text-center text-xs italic text-muted-foreground/60">Sin movimientos que coincidan con la búsqueda</p>
              ) : (
                SECTION_CONFIG.map(section => renderSection(section, filteredData ? filteredData[section.key] : data[section.key]))
              )}

              <Separator className="my-4" />

              {/* Cash summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-muted/30 rounded-xl border border-border/50 p-4 text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Efectivo Inicial</p>
                  <p className="text-xl font-black text-foreground">{fmt(data.beginningCash)}</p>
                </div>
                <div className={cn("rounded-xl border-2 p-4 text-center", data.netCashFlow >= 0 ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800" : "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800")}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Flujo Neto del Período</p>
                  <p className={cn("text-xl font-black", data.netCashFlow >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {data.netCashFlow >= 0 ? '+' : ''}{fmt(data.netCashFlow)}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-4 text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Efectivo Final</p>
                  <p className="text-xl font-black text-foreground">{fmt(data.endingCash)}</p>
                </div>
              </div>

              {/* Detail breakdown */}
              <div className="rounded-xl border border-border/50 bg-muted/20 p-5">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Resumen por Actividad</p>
                <div className="space-y-2">
                  {SECTION_CONFIG.map(section => {
                    const secData = data[section.key];
                    return (
                      <div key={section.key} className="flex min-w-0 items-center justify-between gap-3 border-b border-border/20 py-1.5 last:border-0">
                        <div className="flex items-center gap-2">
                          <div className={cn("size-2 rounded-full", section.headerClass.replace('bg-', 'bg-').replace('600', '500'))} />
                          <span className="text-sm font-medium">{section.title}</span>
                        </div>
                        <span className={cn("shrink-0 text-right text-sm font-bold font-mono", secData.subtotal >= 0 ? "text-emerald-600" : "text-red-600")}>
                          {fmt(secData.subtotal)}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between py-2 border-t-2 border-border">
                    <span className="text-sm font-black uppercase tracking-wider">Flujo Neto de Efectivo</span>
                    <span className={cn("text-lg font-black font-mono", data.netCashFlow >= 0 ? "text-emerald-600" : "text-red-600")}>
                      {data.netCashFlow >= 0 ? '+' : ''}{fmt(data.netCashFlow)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showSettings} onOpenChange={handleSettingsOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
              <Landmark className="size-5 text-primary" /> Cuentas de Efectivo
            </DialogTitle>
            <DialogDescription className="text-xs">
              El Flujo de Efectivo se calcula sobre las cuentas que marques de todo el plan de cuentas (efectivo y bancos).
              Si ninguna está marcada, el sistema usa la detección automática (cuentas vinculadas a bancos, código 1000 y nombres con caja/banco/efectivo).
              Se sugiere marcar solo cuentas de efectivo y bancos para que el flujo cuadre con la lógica contable.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            {!settingsLoaded && settingsConfigQuery.isLoading && (
              <div className="flex items-center gap-2 py-8 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Cargando configuración...
              </div>
            )}
            {settingsLoaded && (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={`Buscar en ${leafAccounts.length} cuentas del plan por código o nombre...`}
                    value={settingsSearch}
                    onChange={(e) => setSettingsSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/40 bg-muted/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <Checkbox
                      checked={settingsDraft.length === 0}
                      onCheckedChange={(c) => setSettingsDraft(c ? [] : settingsDraft)}
                    />
                    Detección automática (ninguna seleccionada)
                  </label>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-black text-primary">
                    {settingsDraft.length} seleccionada(s)
                  </span>
                </div>
                {settingsVisibleAccounts.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No se encontraron cuentas que coincidan con la búsqueda.
                  </p>
                ) : (
                  <div className="grid max-h-[46vh] grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-border/50 p-2 pr-1 sm:grid-cols-2">
                    {settingsVisibleAccounts.map((account: any) => {
                      const checked = settingsDraft.includes(account.id);
                      return (
                        <label
                          key={account.id}
                          className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/40 bg-card/60 px-3 py-2.5"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => setSettingsDraft(prev => c ? [...prev, account.id] : prev.filter(id => id !== account.id))}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold">{account.name}</p>
                              <p className="text-[10px] text-muted-foreground">{account.code}</p>
                            </div>
                          </div>
                          <BadgeStatus checked={checked} />
                        </label>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => handleSettingsOpenChange(false)} className="rounded-xl text-[10px] font-black uppercase tracking-widest">
              Cancelar
            </Button>
            <Button onClick={handleSettingsSave} disabled={settingsSaving || !settingsLoaded} className="rounded-xl font-black uppercase text-[10px] tracking-widest">
              {settingsSaving ? <><Loader2 className="size-3 mr-1 animate-spin" /> Guardando...</> : 'Guardar configuración'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BadgeStatus({ checked }: { checked: boolean }) {
  return (
    <span className={cn(
      'shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest',
      checked ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted/40 text-muted-foreground',
    )}>
      {checked ? 'Incluida' : 'Excluida'}
    </span>
  );
}
