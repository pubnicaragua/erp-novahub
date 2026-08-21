import { useState } from 'react';
import { TrendingDown, PackageX, BookOpenCheck, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { toast } from 'sonner';
import { inventoryService } from '../../services/inventario.service';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { InventoryViewTutorial } from './InventoryViewTutorial';

const REASON_LABELS: Record<string, string> = {
  DISCREPANCY: 'Discrepancia',
  DAMAGE: 'Daño',
  EXPIRATION: 'Vencimiento',
  THEFT: 'Robo',
  OTHER: 'Otro',
};

interface InventoryLossesViewProps {
  warehouses: any[];
  warehouseId?: string;
}

export function InventoryLossesView({ warehouses, warehouseId }: InventoryLossesViewProps) {
  const { user, canPerform } = useAuth();
  const canReadInventory = canPerform('INVENTORY', 'view');
  const { formatCurrentAmount } = useCurrency();
  const tenantKey = user?.tenantId || user?.clientTenantId || 'current';
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const lossesQuery = useQuery({
    queryKey: ['inventory', 'losses', tenantKey, dateFrom, dateTo, page, warehouseId],
    queryFn: ({ signal }) => inventoryService.getLosses({
      page,
      pageSize: 50,
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(warehouseId ? { warehouseId } : {}),
    }, signal),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: Boolean(user) && canReadInventory,
  });

  const data = lossesQuery.data;
  const rows = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, totalPages: 1 };
  const totalLoss = rows.reduce((sum, row) => sum + Number(row.totalLoss || 0), 0);
  const loading = lossesQuery.isLoading || lossesQuery.isFetching;

  const fmtQty = (n: number) => Number(n || 0).toLocaleString('es-NI', { maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-tour="inventory-losses-title">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
            <TrendingDown className="size-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest">Pérdidas de Inventario</h3>
          </div>
        </div>
        <div className="erp-list-toolbar flex flex-wrap items-center gap-2" data-tour="inventory-losses-actions">
          <InventoryViewTutorial label="Cómo consultar pérdidas" targetPrefix="inventory-losses" copy={{ data: { description: 'Filtra las pérdidas por período y revisa el valor, cantidad, razón, almacén y cuenta contable.' }, actions: { description: 'Usa los filtros para revisar el historial de mermas y su vínculo contable.' } }} />
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="h-8 w-36 text-[10px]" aria-label="Desde" />
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="h-8 w-36 text-[10px]" aria-label="Hasta" />
          <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}>
            Limpiar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-tour="inventory-losses-data">
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
            <p className="mt-1 text-2xl font-black tabular-nums">{formatCurrentAmount(totalLoss)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              <BookOpenCheck className="size-3.5 text-red-500" /> Cuenta contable vinculada
            </div>
            <p className="mt-1 text-sm font-bold font-mono">
              {rows[0]?.account ? `${rows[0].account.code} · ${rows[0].account.name}` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Ajuste</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Fecha</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Razón</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Almacén</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Productos con merma</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Cantidad perdida</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Valor de pérdida</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Cuenta contable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-xs text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-xs text-muted-foreground">
                  No hay pérdidas registradas en el período. Las pérdidas se calculan de los ajustes aprobados con merma.
                </TableCell></TableRow>
              ) : rows.map((row: any) => {
                const warehouse = warehouses.find((w: any) => w.id === row.warehouseId);
                const totalQty = (row.items || []).reduce((sum: number, item: any) => sum + Number(item.lossQuantity || 0), 0);
                return (
                <TableRow key={row.id}>
                  <TableCell><span className="font-mono text-xs font-bold">{row.number}</span></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.date ? new Date(row.date).toLocaleDateString('es-NI') : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider bg-red-500/5 text-red-500 border-red-500/20">
                      {REASON_LABELS[row.reason] || row.reason}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{warehouse?.name || row.warehouse?.name || '—'}</TableCell>
                  <TableCell className="text-xs">
                    {(row.items || []).map((item: any) => (
                      <div key={item.productId} className="flex items-center gap-1.5 py-0.5">
                        <span className="font-mono text-[10px] text-muted-foreground">{item.code}</span>
                        <span className="truncate">{item.name}</span>
                        <span className="ml-auto shrink-0 font-mono text-[10px] text-red-500">-{fmtQty(item.lossQuantity)}</span>
                      </div>
                    ))}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold text-red-600">-{fmtQty(totalQty)}</TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold text-red-600">{formatCurrentAmount(Number(row.totalLoss || 0))}</TableCell>
                  <TableCell>
                    {row.account ? (
                      <button
                        type="button"
                        onClick={() => toast.info(`${row.account.code} · ${row.account.name}`, { description: 'Cuenta que recibe la contrapartida de la pérdida (vinculada por código).' })}
                        className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/30 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/10"
                        title="Cuenta vinculada por código"
                      >
                        <BookOpenCheck className="size-3.5" />
                        {row.account.code}
                        <ExternalLink className="size-3 opacity-60" />
                      </button>
                    ) : <span className="text-[10px] text-muted-foreground/50">Sin vínculo</span>}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <span>Página {meta.page} de {meta.totalPages}</span>
          <span>·</span>
          <span>{meta.total} pérdida(s)</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          <Button variant="outline" size="sm" className="h-8" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
        </div>
      </div>
    </div>
  );
}
