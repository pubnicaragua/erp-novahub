import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Anchor,
  Boxes,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Filter,
  Loader2,
  PackageSearch,
  Ship,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '../ui/sheet';
import { getApiErrorMessage } from '../../services/api';
import { authService } from '../../services/auth.service';
import { usersService } from '../../services/users.service';
import {
  logisticsService,
  type ImportDefaults,
  type ReceivedPackage,
  type ReceivedPackageListResult,
  type ShipmentMode,
  type LogisticsWarehouse,
} from '../../services/logistics.service';
import { QuickReception } from './QuickReception';
import { BulkImport } from './BulkImport';

type View = 'list' | 'quick' | 'import';

const PAGE_SIZES = [25, 50, 100, 200];

function formatWeight(value?: number, unit?: string) {
  if (value === undefined || value === null) return 'No disponible';
  return `${value} ${unit || ''}`.trim();
}

export function ReceivedPackages() {
  const [result, setResult] = useState<ReceivedPackageListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    userId: '', shipmentModeCode: '', status: '', branchId: '', warehouseId: '', agencyName: '', subagencyName: '', dateFrom: '', dateTo: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('receivedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<ReceivedPackage | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [view, setView] = useState<View>('list');

  const [modes, setModes] = useState<ShipmentMode[]>([]);
  const [warehouses, setWarehouses] = useState<LogisticsWarehouse[]>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [defaults, setDefaults] = useState<ImportDefaults>({ shipmentModeCode: 'AEREO', ownerType: 'CUSTOMER', weightUnit: 'lb' });

  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const loadMeta = useCallback(async () => {
    try {
      const [ctx, branchList, userList] = await Promise.all([
        logisticsService.getContext(),
        authService.getMyBranches(),
        usersService.getAll({ page: 1, pageSize: 200 } as any).catch(() => [] as any),
      ]);
      setModes(ctx.shipmentModes);
      setWarehouses(ctx.warehouses);
      setBranches(branchList.map((b) => ({ id: b.id, name: b.name })));
      const ul = Array.isArray(userList) ? userList : userList?.items || [];
      setUsers(ul.map((u: any) => ({ id: u.id, name: u.name })));
      setDefaults((d) => ({
        ...d,
        weightUnit: ctx.settings.defaultUnitOfMeasure,
        shipmentModeCode: d.shipmentModeCode || ctx.shipmentModes[0]?.code || 'CUSTOM',
        warehouseId: d.warehouseId || ctx.warehouses[0]?.id,
      }));
    } catch {
      /* contexto no crÃ­tico para el listado */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await logisticsService.listReceivedPackages({
        page, pageSize, search: search || undefined, sortBy, sortOrder, ...filters,
      });
      setResult(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar los paquetes'));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, sortBy, sortOrder, filters]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(load, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [load]);

  const openDetail = useCallback(async (pkg: ReceivedPackage) => {
    setSelected(pkg);
    setDetailOpen(true);
  }, []);

  const hasFilters = Object.values(filters).some((v) => Boolean(v));

  const kpis = result?.kpis;

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      {/* KPIs (respetan filtros activos) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard label="Total paquetes" value={kpis?.total} icon={<PackageSearch className="size-4 text-primary" />} />
        <KpiCard label="Libras aÃ©reo" value={kpis?.librasAereo} icon={<Ship className="size-4 text-sky-500" />} suffix="lb" />
        <KpiCard label="Libras marÃ­timo" value={kpis?.librasMaritimo} icon={<Anchor className="size-4 text-cyan-500" />} suffix="lb" />
        <KpiCard label="Unidades Custom" value={kpis?.unidadesCustom} icon={<Boxes className="size-4 text-amber-500" />} />
        <KpiCard label="Pendientes de compra" value={kpis?.pendingPurchase} icon={<FileText className="size-4 text-rose-500" />} />
        <KpiCard label="Disponibles para facturar" value={kpis?.availableToInvoice} icon={<CheckCircle2 className="size-4 text-emerald-500" />} />
      </div>

      {/* Acciones + buscador */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <PackageSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar: tracking, dÃ­gitos, warehouse, SKU, cliente, agenciaâ€¦"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="rounded-xl pl-9"
          />
        </div>
        <Button variant="outline" className="rounded-xl text-xs" onClick={() => setView('quick')}><Zap className="size-4" /> RecepciÃ³n rÃ¡pida</Button>
        <Button variant="outline" className="rounded-xl text-xs" onClick={() => setView('import')}><Download className="size-4" /> Importar Excel</Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><Filter className="size-3.5" /> Filtros</span>
        <select value={filters.shipmentModeCode} onChange={(e) => { setFilters((f) => ({ ...f, shipmentModeCode: e.target.value })); setPage(1); }} className="rounded-xl border border-input bg-background px-2 py-1.5 text-xs">
          <option value="">Todos los tipos</option>
          {modes.map((m) => <option key={m.id} value={m.code}>{m.name}</option>)}
        </select>
        <select value={filters.warehouseId} onChange={(e) => { setFilters((f) => ({ ...f, warehouseId: e.target.value })); setPage(1); }} className="rounded-xl border border-input bg-background px-2 py-1.5 text-xs">
          <option value="">Todas las bodegas</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select value={filters.branchId} onChange={(e) => { setFilters((f) => ({ ...f, branchId: e.target.value })); setPage(1); }} className="rounded-xl border border-input bg-background px-2 py-1.5 text-xs">
          <option value="">Todas las sucursales</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={filters.userId} onChange={(e) => { setFilters((f) => ({ ...f, userId: e.target.value })); setPage(1); }} className="rounded-xl border border-input bg-background px-2 py-1.5 text-xs">
          <option value="">Todos los usuarios</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <Input placeholder="Agencia" value={filters.agencyName} onChange={(e) => { setFilters((f) => ({ ...f, agencyName: e.target.value })); setPage(1); }} className="w-32 rounded-xl text-xs" />
        <Input placeholder="Subagencia" value={filters.subagencyName} onChange={(e) => { setFilters((f) => ({ ...f, subagencyName: e.target.value })); setPage(1); }} className="w-32 rounded-xl text-xs" />
        <Input type="date" value={filters.dateFrom} onChange={(e) => { setFilters((f) => ({ ...f, dateFrom: e.target.value })); setPage(1); }} className="w-36 rounded-xl text-xs" />
        <Input type="date" value={filters.dateTo} onChange={(e) => { setFilters((f) => ({ ...f, dateTo: e.target.value })); setPage(1); }} className="w-36 rounded-xl text-xs" />
        {hasFilters && <button className="text-[11px] font-bold text-destructive" onClick={() => { setFilters({ userId: '', shipmentModeCode: '', status: '', branchId: '', warehouseId: '', agencyName: '', subagencyName: '', dateFrom: '', dateTo: '' }); setPage(1); }}>Limpiar</button>}
      </div>

      {view !== 'list' && (
        <Card className="rounded-2xl border-border/60 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-black">{view === 'quick' ? 'RecepciÃ³n rÃ¡pida' : 'ImportaciÃ³n masiva'}</h3>
            <button className="text-xs font-bold text-muted-foreground" onClick={() => setView('list')}>Cerrar âœ•</button>
          </div>
          {view === 'quick' ? (
            <QuickReception defaults={defaults} fixed={{ sku: defaults.sku, warehouseId: defaults.warehouseId, shipmentModeCode: defaults.shipmentModeCode }} onImported={load} />
          ) : (
            <BulkImport defaults={defaults} onImported={load} />
          )}
        </Card>
      )}

      {/* Tabla */}
      <Card className="hidden overflow-hidden rounded-2xl border-border/60 shadow-sm lg:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Fecha</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Sucursal</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Usuario</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Tipo</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">SKU</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Peso fÃ­sico</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Peso facturable</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Tracking</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Warehouse</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Subagencia</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={12} className="py-10 text-center text-xs text-muted-foreground">Cargando paquetesâ€¦</TableCell></TableRow>
            ) : !result || result.items.length === 0 ? (
              <TableRow><TableCell colSpan={12} className="py-10 text-center">
                <PackageSearch className="mx-auto size-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm font-bold">Sin paquetes recibidos</p>
                <p className="text-xs text-muted-foreground">Registra una recepciÃ³n o importa un archivo.</p>
              </TableCell></TableRow>
            ) : result.items.map((pkg) => (
              <TableRow key={pkg.id} className="cursor-pointer" onClick={() => openDetail(pkg)}>
                <TableCell className="text-xs">{format(new Date(pkg.receivedAt), "d MMM yy, HH:mm", { locale: es })}</TableCell>
                <TableCell className="text-xs">{pkg.branchName || 'â€”'}</TableCell>
                <TableCell className="text-xs">{pkg.receivedByName || 'â€”'}</TableCell>
                <TableCell className="text-xs font-semibold">{pkg.shipmentModeName}</TableCell>
                <TableCell className="text-xs font-mono">{pkg.sku}</TableCell>
                <TableCell className="text-right text-xs">{formatWeight(pkg.physicalWeight, pkg.weightUnit)}</TableCell>
                <TableCell className="text-right text-xs font-black">{formatWeight(pkg.billableWeight, pkg.weightUnit)}</TableCell>
                <TableCell className="font-mono text-xs font-bold text-primary">{pkg.trackingCode}</TableCell>
                <TableCell className="text-xs">{pkg.warehouseValue || pkg.warehouseName || 'â€”'}</TableCell>
                <TableCell className="text-xs">{pkg.subagencyName || 'â€”'}</TableCell>
                <TableCell><Badge variant="outline" className="rounded-lg text-[10px] text-emerald-600">{pkg.status}</Badge></TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={(e) => { e.stopPropagation(); openDetail(pkg); }}><Eye className="size-4" /> Ver</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Cards mÃ³viles */}
      <div className="space-y-3 lg:hidden">
        {loading ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Cargandoâ€¦</p>
        ) : !result || result.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">Sin paquetes recibidos</div>
        ) : result.items.map((pkg) => (
          <div key={pkg.id} className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm" onClick={() => openDetail(pkg)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-bold text-primary">{pkg.trackingCode}</p>
                <p className="text-xs text-muted-foreground">{pkg.sku} Â· {pkg.shipmentModeName} Â· {formatWeight(pkg.billableWeight, pkg.weightUnit)}</p>
              </div>
              <Badge variant="outline" className="rounded-lg text-[10px] text-emerald-600">{pkg.status}</Badge>
            </div>
          </div>
        ))}
      </div>

      {/* PaginaciÃ³n server-side */}
      {result && result.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <p className="text-muted-foreground">
            Mostrando {(result.page - 1) * result.pageSize + 1}â€“{Math.min(result.page * result.pageSize, result.total)} de {result.total}
          </p>
          <div className="flex items-center gap-2">
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-xl border border-input bg-background px-2 py-1.5 text-xs">
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} por pÃ¡gina</option>)}
            </select>
            <Button variant="outline" size="sm" className="rounded-lg text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <span className="font-bold">{result.page}</span>
            <Button variant="outline" size="sm" className="rounded-lg text-xs" disabled={page * pageSize >= result.total} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
          </div>
        </div>
      )}

      {/* Detalle */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {selected && <PackageDetail pkg={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function KpiCard({ label, value, icon, suffix }: { label: string; value?: number; icon: React.ReactNode; suffix?: string }) {
  return (
    <Card className="rounded-2xl border-border/60 bg-card p-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{icon}{label}</div>
      <p className="mt-1 text-xl font-black">{value ?? 'â€”'}{suffix ? <span className="text-xs font-semibold text-muted-foreground"> {suffix}</span> : null}</p>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | number }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value !== undefined && value !== null && value !== '' ? value : 'No disponible'}</p>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
      <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">{title}</h3>
      <div className="mt-3 grid grid-cols-2 gap-3">{children}</div>
    </Card>
  );
}

function PackageDetail({ pkg }: { pkg: ReceivedPackage }) {
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2 font-mono text-sm">{pkg.ticketNumber}</SheetTitle>
        <SheetDescription className="font-mono text-xs text-primary">{pkg.trackingCode}</SheetDescription>
      </SheetHeader>
      <div className="mt-4 space-y-4 px-4 py-4">
        <DetailSection title="IdentificaciÃ³n">
          <DetailRow label="Tracking" value={pkg.trackingCode} />
          <DetailRow label="Warehouse" value={pkg.warehouseValue || pkg.warehouseName} />
          <DetailRow label="SKU" value={pkg.sku} />
          <DetailRow label="Tipo" value={pkg.shipmentModeName} />
          <DetailRow label="Prefijo" value={pkg.prefixCode} />
        </DetailSection>
        <DetailSection title="RecepciÃ³n">
          <DetailRow label="Fecha / hora" value={format(new Date(pkg.receivedAt), "d MMM yyyy, HH:mm 'h'", { locale: es })} />
          <DetailRow label="Sucursal" value={pkg.branchName} />
          <DetailRow label="Usuario" value={pkg.receivedByName} />
          <DetailRow label="Bodega / PaÃ­s" value={pkg.warehouseName} />
          <DetailRow label="Proveedor" value={pkg.provider} />
        </DetailSection>
        <DetailSection title="Peso">
          <DetailRow label="Peso fÃ­sico" value={formatWeight(pkg.physicalWeight, pkg.weightUnit)} />
          <DetailRow label="Peso proveedor" value={formatWeight(pkg.supplierWeight, pkg.weightUnit)} />
          <DetailRow label="Peso facturable" value={formatWeight(pkg.billableWeight, pkg.weightUnit)} />
          <DetailRow label="Unidad" value={pkg.weightUnit} />
        </DetailSection>
        <DetailSection title="Propietario">
          <DetailRow label="Cliente" value={pkg.customerName} />
          <DetailRow label="Agencia" value={pkg.agencyName} />
          <DetailRow label="Subagencia" value={pkg.subagencyName} />
        </DetailSection>
        <DetailSection title="Compra">
          <DetailRow label="Estado" value={pkg.purchaseStatus === 'NONE' ? 'Pendiente' : 'Comprado'} />
          <DetailRow label="OC relacionada" value="No disponible" />
          <DetailRow label="Factura relacionada" value={pkg.purchasePrice ? `$${pkg.purchasePrice}` : undefined} />
        </DetailSection>
        <DetailSection title="Venta">
          <DetailRow label="Estado" value={pkg.saleStatus === 'NONE' ? 'Sin venta' : 'Facturado'} />
          <DetailRow label="Factura relacionada" value={pkg.salePrice ? `$${pkg.salePrice}` : undefined} />
        </DetailSection>
        <DetailSection title="AuditorÃ­a">
          <DetailRow label="CreaciÃ³n" value={format(new Date(pkg.createdAt), "d MMM yyyy, HH:mm 'h'", { locale: es })} />
          <DetailRow label="ModificaciÃ³n" value={format(new Date(pkg.updatedAt), "d MMM yyyy, HH:mm 'h'", { locale: es })} />
        </DetailSection>
      </div>
    </>
  );
}