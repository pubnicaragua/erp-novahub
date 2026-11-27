import { useState } from 'react';
import { TrendingDown, PackageX, BookOpenCheck, LayoutGrid, List, Settings2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { DateField } from '../ui/DateField';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { toast } from '@/app/services/toast';
import { inventoryService } from '../../services/inventario.service';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { normalizeCurrency, summarizeAmountsByCurrency, type SupportedCurrency } from '../../utils/currency';
import { getCurrencyDecimalPlaces } from '../../utils/currency';
import { useCardsOnlyBelowTableBreakpoint } from '../ui/ViewLayoutSelect';
import { useUserViewLayoutMode } from '../../hooks/useUserViewLayoutMode';
import { useUserViewPreferences } from '../../hooks/useUserViewPreferences';

const LOSS_COLUMNS = [
  { key: 'number', label: 'Ajuste' },
  { key: 'date', label: 'Fecha' },
  { key: 'reason', label: 'Razón' },
  { key: 'warehouse', label: 'Almacén' },
  { key: 'quantity', label: 'Unidades perdidas' },
  { key: 'amount', label: 'Valor de pérdida' },
  { key: 'account', label: 'Cuenta contable' },
] as const;

const REASON_LABELS: Record<string, string> = {
  DISCREPANCY: 'Discrepancia',
  DAMAGE: 'Daño',
  DAMAGED: 'Daño',
  EXPIRATION: 'Vencimiento',
  EXPIRED: 'Vencimiento',
  THEFT: 'Robo',
  OTHER: 'Otro',
  SURPLUS: 'Sobrante',
  LOSS: 'Pérdida',
  SHRINKAGE: 'Merma',
  SHORTAGE: 'Faltante',
  DETERIORATION: 'Deterioro',
  MIXED: 'Ajuste mixto',
  WASTE: 'Merma',
};

const reasonLabel = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return 'Sin motivo';
  const normalized = raw.toUpperCase().replace(/[\s-]+/g, '_');
  return REASON_LABELS[normalized] || raw;
};

const accountsForRow = (row: any) => {
  if (Array.isArray(row?.accounts) && row.accounts.length > 0) return row.accounts;
  return row?.account ? [row.account] : [];
};

interface FinanceLossesViewProps {
  globalDateRange?: { start: string; end: string };
  onClearGlobalDateRange?: () => void;
}

export function FinanceLossesView({ globalDateRange, onClearGlobalDateRange }: FinanceLossesViewProps) {
  const { user, canPerform } = useAuth();
  const canViewInventory = canPerform('INVENTORY', 'view');
  const { baseCurrency, displayMode, formatExplicitAmount, formatConvertedAmount } = useCurrency();
  const tenantKey = user?.tenantId || user?.clientTenantId || 'current';
  const [dateFrom, setDateFrom] = useState(globalDateRange?.start || '');
  const [dateTo, setDateTo] = useState(globalDateRange?.end || '');
  const [page, setPage] = useState(1);
  const viewLayout = useUserViewLayoutMode('finance.inventory-losses');
  const savedView = useUserViewPreferences('finance.inventory-losses');
  const compactViewport = useCardsOnlyBelowTableBreakpoint();
  const effectiveLayout = compactViewport ? 'cards' : viewLayout.mode;
  const visibleColumnKeys = savedView.preferences.visibleColumnKeys || LOSS_COLUMNS.map((column) => column.key);
  const visibleColumns = LOSS_COLUMNS.filter((column) => column.key === 'number' || visibleColumnKeys.includes(column.key));

  const toggleColumn = (key: string, checked: boolean | 'indeterminate') => {
    const next = new Set(visibleColumnKeys);
    if (checked) next.add(key);
    else if (key !== 'number' && next.size > 1) next.delete(key);
    void savedView.save({ visibleColumnKeys: [...next] });
  };

  const lossesQuery = useQuery({
    queryKey: ['inventory', 'losses', 'finanzas', tenantKey, dateFrom, dateTo, page],
    queryFn: ({ signal }) => inventoryService.getLosses({
      page,
      pageSize: 50,
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    }, signal),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: Boolean(user) && canViewInventory,
  });

  const data = lossesQuery.data;
  const rows = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, totalPages: 1 };
  const totalLoss = rows.reduce((sum, row) => sum + Number(row.totalLoss || 0), 0);
  const sourceLossRows = rows.flatMap((row: any) => Array.isArray(row.originalCurrencyBreakdown) && row.originalCurrencyBreakdown.length
    ? row.originalCurrencyBreakdown
    : [{ amount: Number(row.totalLoss || 0), currency: row.currency || baseCurrency }]);
  const lossBreakdown = summarizeAmountsByCurrency(
    sourceLossRows,
    (row: any) => Number(row.amount || 0),
    (row: any) => row.currency,
    baseCurrency,
  ) as Array<{ currency: SupportedCurrency; amount: number; count: number }>;
  const renderLossAmount = (amount: number, currency?: string) => displayMode === 'ORIGINAL'
    ? formatExplicitAmount(amount, normalizeCurrency(currency || baseCurrency))
    : formatConvertedAmount(amount, normalizeCurrency(currency || baseCurrency));
  const totalQty = rows.reduce((sum, row) => sum + (row.items || []).reduce((s: number, item: any) => s + Number(item.lossQuantity || 0), 0), 0);
  const loading = lossesQuery.isLoading || lossesQuery.isFetching;

  const linkedAccounts = [...new Map(
    rows.flatMap((row: any) => accountsForRow(row)).map((account: any) => [account.code || account.id, account]),
  ).values()];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
            <TrendingDown className="size-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest">Pérdidas de Inventario</h3>
            <p className="text-[10px] text-muted-foreground">
              Mermas de inventario con el detalle de la cuenta contable vinculada por su código.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DateField
            value={dateFrom}
            onChange={(value) => { setDateFrom(value); setPage(1); }}
            maxDate={dateTo || undefined}
            className="h-9 w-36 text-[10px]"
            placeholder="Desde"
            title="Desde"
          />
          <DateField
            value={dateTo}
            onChange={(value) => { setDateTo(value); setPage(1); }}
            minDate={dateFrom || undefined}
            className="h-9 w-36 text-[10px]"
            placeholder="Hasta"
            title="Hasta"
          />
          <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); if (globalDateRange?.start || globalDateRange?.end) onClearGlobalDateRange?.(); }}>
            Limpiar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[10px] font-bold" disabled={savedView.isLoading || savedView.loadError}>
                <Settings2 className="size-3.5" /> Columnas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Columnas visibles</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {LOSS_COLUMNS.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={visibleColumns.some((visible) => visible.key === column.key)}
                  disabled={column.key === 'number' || (visibleColumns.length <= 1 && visibleColumns.some((visible) => visible.key === column.key))}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(checked) => toggleColumn(column.key, checked)}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={visibleColumns.length === LOSS_COLUMNS.length}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) => { if (checked) void savedView.save({ visibleColumnKeys: LOSS_COLUMNS.map((column) => column.key) }); }}
              >
                Restablecer columnas
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div data-responsive-layout-toggle className="flex shrink-0 items-center gap-1 rounded-xl border border-border/60 bg-muted/20 p-1">
            <Button type="button" variant={viewLayout.mode === 'table' ? 'secondary' : 'ghost'} size="icon" className="size-8 rounded-lg" onClick={() => viewLayout.setMode('table')} disabled={viewLayout.preferences.isLoading || viewLayout.preferences.loadError} aria-label="Vista tabla"><List className="size-4" /></Button>
            <Button type="button" variant={viewLayout.mode === 'cards' ? 'secondary' : 'ghost'} size="icon" className="size-8 rounded-lg" onClick={() => viewLayout.setMode('cards')} disabled={viewLayout.preferences.isLoading || viewLayout.preferences.loadError} aria-label="Vista tarjetas"><LayoutGrid className="size-4" /></Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              <PackageX className="size-3.5 text-red-500" /> Pérdidas registradas
            </div>
            <p className="mt-1 text-2xl font-black tabular-nums">{meta.total}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              <TrendingDown className="size-3.5 text-red-500" /> Valor total (página)
            </div>
            <div className="mt-1 space-y-0.5">
              {displayMode === 'ORIGINAL'
                ? lossBreakdown.map((item) => <p key={item.currency} className="text-2xl font-black tabular-nums">{formatExplicitAmount(item.amount, item.currency)}</p>)
                : <p className="text-2xl font-black tabular-nums">{formatConvertedAmount(totalLoss, baseCurrency)}</p>}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              <BookOpenCheck className="size-3.5 text-red-500" /> Cuentas vinculadas por código
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {linkedAccounts.length > 0 ? linkedAccounts.map((account: any) => (
                <Badge key={account.id || account.code} variant="outline" className="font-mono text-[9px]">{account.code}</Badge>
              )) : <p className="text-sm font-bold text-muted-foreground">—</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-0 overflow-x-auto">
          {effectiveLayout === 'cards' ? (
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {loading ? <p className="col-span-full py-8 text-center text-xs text-muted-foreground">Cargando...</p>
                : rows.length === 0 ? <p className="col-span-full py-8 text-center text-xs text-muted-foreground">No hay pérdidas en el período seleccionado.</p>
                  : rows.map((row: any) => {
                    const qty = (row.items || []).reduce((sum: number, item: any) => sum + Number(item.lossQuantity || 0), 0);
                    const values: Record<string, React.ReactNode> = {
                      number: <span className="font-mono font-bold">{row.number}</span>,
                      date: row.date ? new Date(row.date).toLocaleDateString('es-NI') : 'N/A',
                      reason: reasonLabel(row.reason),
                      warehouse: row.warehouse?.name || '—',
                      quantity: <span className="font-mono font-bold text-red-600">-{Number(qty).toLocaleString('es-NI', { maximumFractionDigits: 2 })}</span>,
                      amount: <span className="font-mono font-bold text-red-600">{renderLossAmount(Number(row.totalLoss || 0), row.currency)}</span>,
                      account: accountsForRow(row).map((account: any) => `${account.code} · ${account.name}`).join(', ') || 'Sin vínculo',
                    };
                    return <Card key={row.id} className="rounded-xl border-border/60 bg-background/40"><CardContent className="space-y-3 p-4">
                      {visibleColumns.map((column) => <div key={column.key} className="flex items-start justify-between gap-4 border-b border-border/40 pb-2 last:border-0 last:pb-0"><span className="text-[10px] font-bold text-muted-foreground">{column.label}</span><span className="min-w-0 text-right text-xs">{values[column.key]}</span></div>)}
                    </CardContent></Card>;
                  })}
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.map((column) => <TableHead key={column.key} className={`text-[10px] font-black uppercase tracking-widest ${column.key === 'amount' || column.key === 'quantity' ? 'text-right' : ''}`}>{column.label}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={visibleColumns.length} className="py-10 text-center text-xs text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={visibleColumns.length} className="py-10 text-center text-xs text-muted-foreground">
                  No hay pérdidas en el período seleccionado.
                </TableCell></TableRow>
              ) : rows.map((row: any) => {
                const qty = (row.items || []).reduce((sum: number, item: any) => sum + Number(item.lossQuantity || 0), 0);
                const cells: Record<string, React.ReactNode> = {
                  number: <span className="font-mono text-xs font-bold">{row.number}</span>,
                  date: <span className="text-xs text-muted-foreground">{row.date ? new Date(row.date).toLocaleDateString('es-NI') : 'N/A'}</span>,
                  reason: <Badge variant="outline" className="border-red-500/20 bg-red-500/5 text-[9px] font-bold uppercase tracking-wider text-red-500">{reasonLabel(row.reason)}</Badge>,
                  warehouse: <span className="text-xs">{row.warehouse?.name || '—'}</span>,
                  quantity: <span className="font-mono text-xs font-bold text-red-600">-{Number(qty).toLocaleString('es-NI', { maximumFractionDigits: 2 })}</span>,
                  amount: <span className="font-mono text-xs font-bold text-red-600">{displayMode === 'ORIGINAL' && Array.isArray(row.originalCurrencyBreakdown) && row.originalCurrencyBreakdown.length
                    ? row.originalCurrencyBreakdown.map((item: any) => <span key={item.currency} className="ml-2 inline-block">{formatExplicitAmount(Number(item.amount || 0), normalizeCurrency(item.currency || baseCurrency))}</span>)
                    : renderLossAmount(Number(row.totalLoss || 0), row.currency)}</span>,
                  account: accountsForRow(row).length > 0 ? <div className="flex flex-wrap gap-1.5">{accountsForRow(row).map((account: any) => <button key={account.id || account.code} type="button" onClick={() => toast.info(`${account.code} · ${account.name}`, { description: 'Cuenta que recibe la contrapartida de la pérdida (vinculada por código).' })} className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/30 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/10" title="Cuenta vinculada por código"><BookOpenCheck className="size-3.5" />{account.code} · {account.name}</button>)}</div> : <span className="text-[10px] text-muted-foreground/50">Sin vínculo</span>,
                };
                return (
                <TableRow key={row.id}>
                  {visibleColumns.map((column) => <TableCell key={column.key} className={column.key === 'amount' || column.key === 'quantity' ? 'text-right' : ''}>{cells[column.key]}</TableCell>)}
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <span>Página {meta.page} de {meta.totalPages}</span>
          <span>·</span>
          <span>{meta.total} pérdida(s) · {Number(totalQty).toLocaleString('es-NI', { maximumFractionDigits: getCurrencyDecimalPlaces() })} unidades</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          <Button variant="outline" size="sm" className="h-8" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
        </div>
      </div>
    </div>
  );
}
