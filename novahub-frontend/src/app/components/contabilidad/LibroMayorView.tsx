import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  Search, Filter, RefreshCw, X, ArrowDownUp,
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, BookOpen, Loader2,
} from 'lucide-react';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { useBranchScope } from '../../hooks/useBranchScope';
import { toast } from 'sonner';
import { Combobox } from '../ui/Combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { referenceTypeLabel } from '../../utils/accountingLabels';
import { BranchScopeFilter } from '../ui/BranchScopeFilter';
// import { motion } from 'motion/react';

interface LedgerEntry {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType?: string;
  date: string;
  createdAt?: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  journalId?: string | null;
  journalNumber?: string | null;
  branches?: Array<{ id: string; code?: string; name: string }>;
}

const ACCOUNT_TYPES = [
  { value: 'ASSET', label: 'Activos' },
  { value: 'LIABILITY', label: 'Pasivos' },
  { value: 'EQUITY', label: 'Patrimonio' },
  { value: 'INCOME', label: 'Ingresos' },
  { value: 'EXPENSE', label: 'Gastos' },
];

const MOVEMENT_TYPES = [
  { value: 'DEBIT', label: 'Solo débitos' },
  { value: 'CREDIT', label: 'Solo créditos' },
];

const PAGE_SIZES = [50, 100, 200];

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function formatAccountingDate(value?: string | Date | null): string {
  if (!value) return '—';
  const raw = String(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString('es-NI');
  }
  return new Date(raw).toLocaleDateString('es-NI');
}

function journalStatusLabel(value?: string): string {
  const labels: Record<string, string> = { DRAFT: 'Borrador', POSTED: 'Contabilizado', VOIDED: 'Anulado' };
  return labels[String(value || '').toUpperCase()] || 'Sin estado';
}

export function LibroMayorView() {
  const { selectedBranchId } = useBranchScope();
  const [filterAccountId, setFilterAccountId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterAccountType, setFilterAccountType] = useState('');
  const [filterMovement, setFilterMovement] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null);
  const [selectedJournal, setSelectedJournal] = useState<any | null>(null);
  const [journalLoading, setJournalLoading] = useState(false);

  const ledgerParams = useMemo(() => ({
    ...(filterAccountId ? { accountId: filterAccountId } : {}),
    ...(filterDateFrom ? { dateFrom: filterDateFrom } : {}),
    ...(filterDateTo ? { dateTo: filterDateTo } : {}),
    ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
  }), [filterAccountId, filterDateFrom, filterDateTo, selectedBranchId]);
  const entriesQuery = useAccountingQuery<LedgerEntry[]>(['ledger', ledgerParams], async (signal) => accountingList(await contabilidadService.getLedger(ledgerParams, signal)) as LedgerEntry[]);
  const accountsQuery = useAccountingQuery<any[]>(['accounts'], async (signal) => accountingList(await contabilidadService.getChartOfAccounts(false, signal)));
  const entries = entriesQuery.data || [];
  const loading = entriesQuery.isLoading || entriesQuery.isFetching;
  const accounts = useMemo(() => {
    const result: { id: string; code: string; name: string }[] = [];
    const flatten = (items: any[]) => items.forEach(a => { result.push({ id: a.id, code: a.code, name: a.name }); if (a.children) flatten(a.children); });
    flatten(accountsQuery.data || []);
    return result;
  }, [accountsQuery.data]);
  const loadEntries = () => entriesQuery.refetch();

  async function handleEntryClick(entry: LedgerEntry) {
    setSelectedEntry(entry);
    setSelectedJournal(null);
    if (!entry.journalId) {
      setJournalLoading(false);
      return;
    }
    setJournalLoading(true);
    try {
      setSelectedJournal(await contabilidadService.getJournal(entry.journalId));
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo cargar el detalle del asiento');
    } finally {
      setJournalLoading(false);
    }
  }

  function closeEntryDetail() {
    setSelectedEntry(null);
    setSelectedJournal(null);
    setJournalLoading(false);
  }

  const accountOptions = accounts.map((a) => ({
    label: `${a.code} - ${a.name}`,
    value: a.id,
  }));

  const filteredEntries = useMemo(() => {
    const normalizedSearch = filterSearch.trim().toLowerCase();
    return entries.filter(entry => {
      if (filterAccountType && entry.accountType !== filterAccountType) return false;
      if (filterMovement === 'DEBIT' && !(entry.debit > 0)) return false;
      if (filterMovement === 'CREDIT' && !(entry.credit > 0)) return false;
      if (!normalizedSearch) return true;
      return [entry.accountCode, entry.accountName, entry.description, entry.reference]
        .some(value => String(value || '').toLowerCase().includes(normalizedSearch));
    });
  }, [entries, filterAccountType, filterMovement, filterSearch]);

  const orderedEntries = useMemo(() => {
    return [...filteredEntries].sort((left, right) => {
      const leftCreatedAt = new Date(left.createdAt || left.date).getTime();
      const rightCreatedAt = new Date(right.createdAt || right.date).getTime();
      const createdDifference = leftCreatedAt - rightCreatedAt;
      if (createdDifference !== 0) return sortOrder === 'asc' ? createdDifference : -createdDifference;

      const leftDate = new Date(left.date).getTime();
      const rightDate = new Date(right.date).getTime();
      const dateDifference = leftDate - rightDate;
      if (dateDifference !== 0) return sortOrder === 'asc' ? dateDifference : -dateDifference;

      return sortOrder === 'asc'
        ? left.id.localeCompare(right.id)
        : right.id.localeCompare(left.id);
    });
  }, [filteredEntries, sortOrder]);

  const totalEntries = orderedEntries.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return orderedEntries.slice(start, start + pageSize);
  }, [orderedEntries, currentPage, pageSize]);
  const rangeStart = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalEntries);
  const totalDebits = filteredEntries.reduce((s, e) => s + e.debit, 0);
  const totalCredits = filteredEntries.reduce((s, e) => s + e.credit, 0);

  function clearFilters() {
    setFilterAccountId('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterSearch('');
    setFilterAccountType('');
    setFilterMovement('');
    setSortOrder('desc');
    setPage(1);
  }

  const hasFilters = filterAccountId || filterDateFrom || filterDateTo || filterSearch || filterAccountType || filterMovement;

  useEffect(() => {
    setPage(1);
  }, [filterAccountId, filterDateFrom, filterDateTo, filterSearch, filterAccountType, filterMovement, sortOrder, pageSize, selectedBranchId]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase italic">
            Libro <span className="text-primary">Mayor</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Movimientos detallados por cuenta contable con saldo corriente
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-5 bg-muted/30 rounded-2xl border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-[0.2em] bg-background/50 px-3 py-1.5 rounded-lg border border-border/30 shrink-0">
          <Filter className="size-3.5" /> Filtros
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end lg:gap-4">
          <BranchScopeFilter className="min-w-0" />
          <div className="flex min-w-0 flex-col gap-1.5 sm:min-w-[220px] lg:flex-1">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Cuenta Contable</label>
            <Combobox
              options={accountOptions}
              value={filterAccountId}
              onChange={setFilterAccountId}
              placeholder="Todas las cuentas"
              emptyMessage="Sin resultados"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2 lg:min-w-[220px] lg:flex-1">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Buscar movimiento</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filterSearch}
                onChange={event => setFilterSearch(event.target.value)}
                placeholder="Cuenta, descripción o referencia"
                className="h-9 pl-9"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Desde</label>
            <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="h-9 w-full sm:w-[150px]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Hasta</label>
            <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="h-9 w-full sm:w-[150px]" />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Tipo de cuenta</label>
            <Select value={filterAccountType || 'ALL'} onValueChange={value => setFilterAccountType(value === 'ALL' ? '' : value)}>
              <SelectTrigger className="h-9 w-full sm:w-[155px]"><SelectValue placeholder="Todos los tipos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los tipos</SelectItem>
                {ACCOUNT_TYPES.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Movimiento</label>
            <Select value={filterMovement || 'ALL'} onValueChange={value => setFilterMovement(value === 'ALL' ? '' : value)}>
              <SelectTrigger className="h-9 w-full sm:w-[155px]"><SelectValue placeholder="Débitos y créditos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Débitos y créditos</SelectItem>
                {MOVEMENT_TYPES.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label className="flex items-center gap-1 text-[9px] font-black text-muted-foreground uppercase tracking-widest"><ArrowDownUp className="size-3" /> Orden</label>
            <Select value={sortOrder} onValueChange={value => setSortOrder(value as 'asc' | 'desc')}>
              <SelectTrigger className="h-9 w-full sm:w-[175px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Más antiguos primero</SelectItem>
                <SelectItem value="desc">Más recientes primero</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="h-9 px-4 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-rose-500 hover:bg-rose-500/5 rounded-xl border border-dashed border-border/60 transition-all">
              <X className="size-3" /> Limpiar
            </button>
          )}
        </div>
        <div className="lg:ml-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-border/20">
          <Button variant="outline" size="sm" onClick={loadEntries} disabled={loading} className="h-9">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Actualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg font-bold">
            <span>Movimientos del Libro Mayor</span>
            {entries.length > 0 && (
              <Badge variant="outline" className="text-[10px] font-bold">{totalEntries} de {entries.length} movimientos</Badge>
            )}
          </CardTitle>
          {entries.length > 0 && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              La paginación solo organiza la vista. Los totales se calculan sobre los {totalEntries} movimientos que cumplen los filtros.
            </p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Search className="size-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">No hay movimientos</p>
              <p className="text-xs mt-1">Ajusta los filtros para ver resultados</p>
            </div>
          ) : (
            <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Fecha</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Código</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Cuenta</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Descripción</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Referencia</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 text-right">Débito</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 text-right">Crédito</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleEntries.map((entry) => (
                    <TableRow key={entry.id} className="cursor-pointer border-border/30 hover:bg-primary/5" onClick={() => { void handleEntryClick(entry); }} title="Ver detalle del asiento contable">
                      <TableCell className="text-xs font-mono">{formatAccountingDate(entry.date)}</TableCell>
                      <TableCell className="font-mono text-xs">{entry.accountCode}</TableCell>
                      <TableCell className="font-medium text-xs">{entry.accountName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{entry.description}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entry.reference || '-'}</TableCell>
                      <TableCell className={cn("text-right font-mono text-xs", entry.debit > 0 && "text-emerald-600")}>
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono text-xs", entry.credit > 0 && "text-red-600")}>
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono text-xs font-bold", entry.balance >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {formatCurrency(entry.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-3 p-3 md:hidden">
              {visibleEntries.map((entry) => (
                <div key={entry.id} className="cursor-pointer rounded-xl border border-border/60 bg-card/60 p-3 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5" onClick={() => { void handleEntryClick(entry); }} title="Ver detalle del asiento contable">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] text-muted-foreground">{formatAccountingDate(entry.date)} · {entry.accountCode}</p>
                      <p className="mt-0.5 truncate text-sm font-bold" title={entry.accountName}>{entry.accountName}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground" title={entry.description}>{entry.description}</p>
                    </div>
                    <span className={cn("shrink-0 font-mono text-sm font-black", entry.balance >= 0 ? "text-emerald-600" : "text-red-600")}>
                      {formatCurrency(entry.balance)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-3">
                    <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Débito</p><p className={cn("truncate font-mono text-xs", entry.debit > 0 && "text-emerald-600")}>{entry.debit > 0 ? formatCurrency(entry.debit) : '-'}</p></div>
                    <div className="min-w-0 text-right"><p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Crédito</p><p className={cn("truncate font-mono text-xs", entry.credit > 0 && "text-red-600")}>{entry.credit > 0 ? formatCurrency(entry.credit) : '-'}</p></div>
                  </div>
                  <div className="mt-2 truncate border-t border-border/50 pt-2 text-[10px] text-muted-foreground"><span className="font-bold text-foreground/80">Referencia:</span> {entry.reference || 'Sin referencia'}</div>
                </div>
              ))}
            </div>
            </>
          )}
        </CardContent>
        {filteredEntries.length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 bg-muted/20 px-4 py-4 sm:px-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Totales del resultado completo</span>
                <p className="mt-1 text-[10px] text-muted-foreground">Incluye todos los movimientos filtrados, no solo la página visible.</p>
              </div>
              <div className="flex items-center gap-6 text-sm font-mono font-bold sm:gap-8">
                <span className="text-emerald-600">Debe {formatCurrency(totalDebits)}</span>
                <span className="text-red-600">Haber {formatCurrency(totalCredits)}</span>
                <span className="text-primary">Saldo {formatCurrency(totalDebits - totalCredits)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-b-2xl border-t border-border/40 bg-background/60 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <span>Mostrando {rangeStart}-{rangeEnd} de {totalEntries}</span>
                <span className="text-muted-foreground/60">·</span>
                <label htmlFor="ledger-page-size">Por página</label>
                <select
                  id="ledger-page-size"
                  value={pageSize}
                  onChange={event => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                  className="h-8 rounded-lg border border-border/50 bg-background px-2 font-bold text-foreground outline-none"
                >
                  {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between gap-1 sm:justify-end">
                <button type="button" className="rounded-lg border border-border/50 p-2 disabled:opacity-30" onClick={() => setPage(1)} disabled={currentPage <= 1} aria-label="Primera página">
                  <ChevronsLeft className="size-4" />
                </button>
                <button type="button" className="rounded-lg border border-border/50 p-2 disabled:opacity-30" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={currentPage <= 1} aria-label="Página anterior">
                  <ChevronLeft className="size-4" />
                </button>
                <span className="min-w-24 text-center font-bold text-foreground">Pág. {currentPage} / {totalPages}</span>
                <button type="button" className="rounded-lg border border-border/50 p-2 disabled:opacity-30" onClick={() => setPage(value => Math.min(totalPages, value + 1))} disabled={currentPage >= totalPages} aria-label="Página siguiente">
                  <ChevronRight className="size-4" />
                </button>
                <button type="button" className="rounded-lg border border-border/50 p-2 disabled:opacity-30" onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages} aria-label="Última página">
                  <ChevronsRight className="size-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Sheet open={Boolean(selectedEntry)} onOpenChange={(open) => { if (!open) closeEntryDetail(); }}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="sticky top-0 z-10 border-b border-border/50 bg-background/95 px-5 py-5 backdrop-blur-md sm:px-6">
            <div className="flex items-start gap-3 pr-8">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BookOpen className="size-5" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="truncate text-lg font-black uppercase tracking-tight">
                  {selectedJournal ? `Asiento #${selectedJournal.number}` : 'Detalle del asiento'}
                </SheetTitle>
                <SheetDescription className="mt-1 text-xs">
                  {selectedEntry ? `${selectedEntry.accountCode} · ${selectedEntry.accountName}` : 'Movimiento contable'}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-5 px-5 py-5 sm:px-6">
            {selectedEntry && (
              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Movimiento seleccionado</p>
                  <p className="mt-1 truncate text-sm font-bold" title={selectedEntry.description}>{selectedEntry.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Fecha</p>
                  <p className="mt-1 text-sm font-bold">{formatAccountingDate(selectedEntry.date)}</p>
                </div>
                <div className="min-w-0 border-t border-border/40 pt-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Debe</p>
                  <p className="mt-1 font-mono text-sm font-black tabular-nums">{selectedEntry.debit > 0 ? formatCurrency(selectedEntry.debit) : '—'}</p>
                </div>
                <div className="border-t border-border/40 pt-3 text-right">
                  <p className="text-[9px] font-black uppercase tracking-widest text-rose-500">Haber</p>
                  <p className="mt-1 font-mono text-sm font-black tabular-nums">{selectedEntry.credit > 0 ? formatCurrency(selectedEntry.credit) : '—'}</p>
                </div>
              </div>
            )}

            {journalLoading ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-16 text-muted-foreground">
                <Loader2 className="size-7 animate-spin text-primary" />
                <p className="mt-3 text-xs font-semibold">Cargando detalle del asiento…</p>
              </div>
            ) : selectedJournal ? (
              <>
                <div className="space-y-4 rounded-2xl border border-border/60 bg-card/60 p-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Descripción del asiento</p>
                    <p className="mt-1 text-sm font-bold">{selectedJournal.description || 'Sin descripción'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Fecha</p>
                      <p className="mt-1 font-semibold">{formatAccountingDate(selectedJournal.date)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Estado</p>
                      <Badge className="mt-1 text-[9px] font-black uppercase">{journalStatusLabel(selectedJournal.status)}</Badge>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Operación de origen</p>
                  <p className="mt-1 text-sm font-bold">{referenceTypeLabel(selectedJournal.referenceType)}</p>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">ID: {selectedJournal.referenceId || 'Sin referencia'}</p>
                  <p className="mt-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Sucursal de origen</p>
                  <p className="mt-1 text-sm font-semibold">
                    {selectedJournal.branchLinks?.length
                      ? selectedJournal.branchLinks.map((link: any) => link.branch?.name).filter(Boolean).join(' · ')
                      : 'General / sin sucursal vinculada'}
                  </p>
                  <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Este asiento se generó a partir de la operación indicada y sus líneas son las que alimentan el Libro Mayor.</p>
                </div>

                <section className="overflow-hidden rounded-2xl border border-border/60">
                  <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
                    <h3 className="text-sm font-black uppercase tracking-tight">Líneas del asiento</h3>
                    <p className="mt-1 text-[10px] text-muted-foreground">Cada cuenta se presenta en su columna contable correspondiente.</p>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(88px,auto)_minmax(88px,auto)] gap-3 border-b border-border/60 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                    <span>Cuenta / concepto</span>
                    <span className="text-right text-emerald-600">Debe</span>
                    <span className="text-right text-rose-500">Haber</span>
                  </div>
                  <div className="divide-y divide-border/60">
                    {(selectedJournal.lines || []).map((line: any) => (
                      <div key={line.id} className="grid grid-cols-[minmax(0,1fr)_minmax(88px,auto)_minmax(88px,auto)] items-center gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold" title={line.account ? `${line.account.code} - ${line.account.name}` : line.accountId}>{line.account ? `${line.account.code} - ${line.account.name}` : line.accountId}</p>
                          {line.description && <p className="mt-1 truncate text-[10px] text-muted-foreground" title={line.description}>{line.description}</p>}
                        </div>
                        <p className="text-right font-mono text-[11px] font-black tabular-nums text-emerald-600">{Number(line.debit) > 0 ? formatCurrency(Number(line.debit)) : '—'}</p>
                        <p className="text-right font-mono text-[11px] font-black tabular-nums text-rose-500">{Number(line.credit) > 0 ? formatCurrency(Number(line.credit)) : '—'}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/30 px-4 py-3 text-xs font-black tabular-nums">
                    <span className="uppercase tracking-widest text-muted-foreground">Totales</span>
                    <span className="text-right"><span className="text-emerald-600">{formatCurrency((selectedJournal.lines || []).reduce((sum: number, line: any) => sum + Number(line.debit || 0), 0))}</span><span className="mx-1 text-muted-foreground">·</span><span className="text-rose-500">{formatCurrency((selectedJournal.lines || []).reduce((sum: number, line: any) => sum + Number(line.credit || 0), 0))}</span></span>
                  </div>
                </section>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 px-4 py-10 text-center">
                <p className="text-sm font-bold">Asiento no disponible</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Este movimiento no tiene un asiento contable relacionado. Referencia: {selectedEntry?.reference || 'sin referencia'}.</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
