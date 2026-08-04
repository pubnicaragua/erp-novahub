import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Search, Filter, RefreshCw, X } from 'lucide-react';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { toast } from 'sonner';
import { Combobox } from '../ui/Combobox';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';
// import { motion } from 'motion/react';

interface LedgerEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function LibroMayorView() {
  const [filterAccountId, setFilterAccountId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const ledgerParams = useMemo(() => ({
    ...(filterAccountId ? { accountId: filterAccountId } : {}),
    ...(filterDateFrom ? { dateFrom: filterDateFrom } : {}),
    ...(filterDateTo ? { dateTo: filterDateTo } : {}),
  }), [filterAccountId, filterDateFrom, filterDateTo]);
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
  const loadAccounts = () => accountsQuery.refetch();

  const accountOptions = accounts.map((a) => ({
    label: `${a.code} - ${a.name}`,
    value: a.id,
  }));

  const totalDebits = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredits = entries.reduce((s, e) => s + e.credit, 0);

  function clearFilters() {
    setFilterAccountId('');
    setFilterDateFrom('');
    setFilterDateTo('');
  }

  const hasFilters = filterAccountId || filterDateFrom || filterDateTo;

  return (
    <div className="space-y-6">
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
        <div className="flex flex-wrap items-center gap-4 flex-1">
          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Cuenta Contable</label>
            <Combobox
              options={accountOptions}
              value={filterAccountId}
              onChange={setFilterAccountId}
              placeholder="Todas las cuentas"
              emptyMessage="Sin resultados"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Desde</label>
            <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="h-9 w-[150px]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Hasta</label>
            <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="h-9 w-[150px]" />
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="h-9 px-4 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-rose-500 hover:bg-rose-500/5 rounded-xl border border-dashed border-border/60 transition-all mt-5">
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
          <CardTitle className="text-lg font-bold flex items-center justify-between">
            <span>Movimientos del Libro Mayor</span>
            {entries.length > 0 && (
              <Badge variant="outline" className="text-[10px] font-bold">{entries.length} registros</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Search className="size-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">No hay movimientos</p>
              <p className="text-xs mt-1">Ajusta los filtros para ver resultados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Fecha</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Código</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cuenta</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Descripción</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Referencia</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Débito</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Crédito</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, i) => (
                    <TableRow key={`${entry.accountId}-${i}`} className="hover:bg-muted/30 border-border/30">
                      <TableCell className="text-xs font-mono">{new Date(entry.date).toLocaleDateString('es-NI')}</TableCell>
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
          )}
        </CardContent>
        {entries.length > 0 && (
          <div className="px-6 py-4 flex items-center justify-between bg-muted/20 border-t border-border/50 rounded-b-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Totales</span>
            <div className="flex items-center gap-8 text-sm font-mono font-bold">
              <span className="text-emerald-600">{formatCurrency(totalDebits)}</span>
              <span className="text-red-600">{formatCurrency(totalCredits)}</span>
              <span className="text-primary">{formatCurrency(totalDebits - totalCredits)}</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
