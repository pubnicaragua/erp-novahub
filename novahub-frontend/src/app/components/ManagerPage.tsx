import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Building2, Boxes, Download, Landmark, LayoutDashboard, Package, Plus, ShieldCheck, Users, Warehouse, Cloud, RefreshCw, Tags, ArrowRight, BarChart3, ArrowRightLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useTenantQuery } from '../hooks/useTenantQuery';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { enterpriseGroupsService, type ManagerOverview } from '../services/enterprise-groups.service';

type ManagerSection = 'overview' | 'inventory' | 'accounting' | 'users' | 'warehouses' | 'managers' | 'catalog' | 'consolidated' | 'transfers';

const sections: Array<{ id: ManagerSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventario consolidado', icon: Boxes },
  { id: 'accounting', label: 'Contabilidad y finanzas', icon: Landmark },
  { id: 'consolidated', label: 'Estados Financieros', icon: BarChart3 },
  { id: 'transfers', label: 'Transferencias', icon: ArrowRightLeft },
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'warehouses', label: 'Almacenes', icon: Warehouse },
  { id: 'catalog', label: 'Catálogo compartido', icon: Tags },
  { id: 'managers', label: 'Accesos Manager', icon: ShieldCheck },
];

const numberFormat = new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 });
const formatNumber = (value: unknown) => numberFormat.format(Number(value || 0));
const formatBytes = (value: unknown) => {
  const bytes = Number(value || 0);
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
};

function downloadCsv(name: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return toast.info('No hay datos para exportar');
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(';'), ...rows.map((row) => keys.map((key) => JSON.stringify(row[key] ?? '')).join(';'))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function ManagerPage() {
  const [section, setSection] = useState<ManagerSection>('overview');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [warehouseName, setWarehouseName] = useState('');
  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [managerUserId, setManagerUserId] = useState('');
  const [managerBranchIds, setManagerBranchIds] = useState<string[]>([]);
  const [catalogSourceBranchId, setCatalogSourceBranchId] = useState('');
  const [catalogProductIds, setCatalogProductIds] = useState<string[]>([]);
  const [catalogTargetBranchIds, setCatalogTargetBranchIds] = useState<string[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const { enterBranch } = useImpersonation();

  const groupsQuery = useTenantQuery(['manager-groups'], (signal) => enterpriseGroupsService.getManagerGroups(signal));
  const groups = groupsQuery.data || [];
  const groupId = selectedGroupId || groups[0]?.id || '';
  const group = groups.find((item) => item.id === groupId);

  useEffect(() => {
    if (groupId && !selectedGroupId) setSelectedGroupId(groupId);
    if (selectedBranchId && !group?.branches.some((branch) => branch.id === selectedBranchId)) setSelectedBranchId('');
  }, [groupId, selectedGroupId, selectedBranchId, group]);

  const overviewQuery = useTenantQuery(
    ['manager-overview', groupId, selectedBranchId || 'all'],
    (signal) => enterpriseGroupsService.getOverview(groupId, selectedBranchId || undefined, signal),
    { enabled: Boolean(groupId) },
  );
  const inventoryQuery = useTenantQuery(
    ['manager-inventory', groupId, selectedBranchId || 'all'],
    (signal) => enterpriseGroupsService.getInventory(groupId, selectedBranchId || undefined, signal),
    { enabled: Boolean(groupId) && section === 'inventory' },
  );
  const accountingQuery = useTenantQuery(
    ['manager-accounting', groupId, selectedBranchId || 'all'],
    (signal) => enterpriseGroupsService.getAccounting(groupId, selectedBranchId || undefined, signal),
    { enabled: Boolean(groupId) && section === 'accounting' },
  );
  const usersQuery = useTenantQuery(
    ['manager-users', groupId, selectedBranchId || 'all'],
    (signal) => enterpriseGroupsService.getUsers(groupId, selectedBranchId || undefined, signal),
    { enabled: Boolean(groupId) && (section === 'users' || section === 'managers') },
  );
  const managersQuery = useTenantQuery(
    ['manager-assignments', groupId],
    (signal) => enterpriseGroupsService.getManagers(groupId, signal),
    { enabled: Boolean(groupId) && section === 'managers' },
  );
  const sharedCatalogQuery = useTenantQuery(
    ['manager-catalog', groupId],
    (signal) => enterpriseGroupsService.listSharedCatalog(groupId, undefined, signal),
    { enabled: Boolean(groupId) && section === 'catalog' },
  );
  const branchProductsQuery = useTenantQuery(
    ['manager-branch-products', groupId, catalogSourceBranchId, catalogSearch],
    (signal) => enterpriseGroupsService.getBranchProducts(groupId, catalogSourceBranchId, catalogSearch || undefined, signal),
    { enabled: Boolean(groupId) && section === 'catalog' && Boolean(catalogSourceBranchId) },
  );

  const warehouseMutation = useMutation({
    mutationFn: () => enterpriseGroupsService.createWarehouse(groupId, { name: warehouseName, location: warehouseLocation, scopeType: 'GROUP' }),
    onSuccess: () => { setWarehouseName(''); setWarehouseLocation(''); overviewQuery.refetch(); toast.success('Almacén corporativo creado'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const managerMutation = useMutation({
    mutationFn: () => enterpriseGroupsService.assignManager(groupId, { userId: managerUserId, branchIds: managerBranchIds, canEdit: false, canManageManagers: false }),
    onSuccess: () => { setManagerUserId(''); setManagerBranchIds([]); managersQuery.refetch(); toast.success('Acceso Manager asignado'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const shareCatalogMutation = useMutation({
    mutationFn: () => enterpriseGroupsService.shareCatalog(groupId, { productIds: catalogProductIds, branchIds: catalogTargetBranchIds }),
    onSuccess: () => { setCatalogProductIds([]); setCatalogTargetBranchIds([]); sharedCatalogQuery.refetch(); toast.success('Catálogo compartido con las sucursales seleccionadas'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const unshareMutation = useMutation({
    mutationFn: (mirrorIds: string[]) => enterpriseGroupsService.unshareCatalog(groupId, { mirrorIds }),
    onSuccess: () => { sharedCatalogQuery.refetch(); toast.success('Producto retirado del catálogo compartido'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const syncMutation = useMutation({
    mutationFn: (productId: string) => enterpriseGroupsService.syncFromMaster(groupId, { productId }),
    onSuccess: (result) => { sharedCatalogQuery.refetch(); toast.success(`Espejos sincronizados: ${result.synced}`); },
    onError: (error: Error) => toast.error(error.message),
  });

  const [consDateFrom, setConsDateFrom] = useState('');
  const [consDateTo, setConsDateTo] = useState('');
  const consolidatedTrialBalance = useTenantQuery(
    ['consolidated-trial-balance', groupId, consDateFrom, consDateTo],
    (signal) => enterpriseGroupsService.getConsolidatedTrialBalance(groupId, consDateFrom || undefined, consDateTo || undefined, signal),
    { enabled: Boolean(groupId) && section === 'consolidated' },
  );
  const consolidatedProfitLoss = useTenantQuery(
    ['consolidated-profit-loss', groupId, consDateFrom, consDateTo],
    (signal) => enterpriseGroupsService.getConsolidatedProfitLoss(groupId, consDateFrom || undefined, consDateTo || undefined, signal),
    { enabled: Boolean(groupId) && section === 'consolidated' },
  );
  const consolidatedBalanceSheet = useTenantQuery(
    ['consolidated-balance-sheet', groupId],
    (signal) => enterpriseGroupsService.getConsolidatedBalanceSheet(groupId, signal),
    { enabled: Boolean(groupId) && section === 'consolidated' },
  );
  const consolidatedBranchComparison = useTenantQuery(
    ['consolidated-branch-comparison', groupId, consDateFrom, consDateTo],
    (signal) => enterpriseGroupsService.getConsolidatedBranchComparison(groupId, consDateFrom || undefined, consDateTo || undefined, signal),
    { enabled: Boolean(groupId) && section === 'consolidated' },
  );
  const transfersQuery = useTenantQuery(
    ['manager-transfers', groupId],
    (signal) => enterpriseGroupsService.getTransfers(groupId, undefined, signal),
    { enabled: Boolean(groupId) && section === 'transfers' },
  );

  const overview = overviewQuery.data as ManagerOverview | undefined;
  const metrics = overview?.metrics;
  const branchOptions = group?.branches || [];
  const managerCandidates = usersQuery.data?.filter((user) => ['MANAGER', 'ADMIN'].includes(String(user.role).toUpperCase())) || [];
  const catalogSourceOptions = branchOptions.filter((branch) => branch.id === selectedBranchId || !selectedBranchId);
  const catalogProducts = branchProductsQuery.data || [];
  const activeTitle = sections.find((item) => item.id === section)?.label;
  const loading = groupsQuery.isLoading || (section === 'overview' && overviewQuery.isLoading);

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="border-b border-border/60 bg-card/40 px-4 py-4 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1700px] flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Building2 className="size-6" /></div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">NovaHub Manager</p>
              <h1 className="truncate text-2xl font-black uppercase tracking-tight italic">Control empresarial</h1>
              <p className="truncate text-sm text-muted-foreground">Consolidado por grupo, unidad, sucursal y almacén.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select aria-label="Grupo empresarial" value={groupId} onChange={(event) => { setSelectedGroupId(event.target.value); setSelectedBranchId(''); }} className="h-10 min-w-[220px] max-w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold">
              {groups.length === 0 && <option value="">Sin grupos asignados</option>}
              {groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select aria-label="Filtrar sucursal" value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)} className="h-10 min-w-[220px] max-w-full rounded-xl border border-border bg-background px-3 text-sm">
              <option value="">Todas las sucursales</option>
              {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <Button variant="outline" className="h-10 rounded-xl" onClick={() => overviewQuery.refetch()} aria-label="Actualizar panel"><RefreshCw className="mr-2 size-4" /> Actualizar</Button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1700px] flex-col gap-6 p-4 sm:p-6 md:p-10 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-64">
          <div className="flex gap-2 overflow-x-auto rounded-2xl border border-border/60 bg-card/30 p-2 lg:block lg:space-y-1 lg:overflow-visible">
            {sections.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return <button key={item.id} onClick={() => setSection(item.id)} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition-colors lg:w-full ${active ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/15' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`} aria-current={active ? 'page' : undefined}><Icon className="size-4" /><span>{item.label}</span></button>;
            })}
          </div>
          <Card className="mt-4 hidden rounded-2xl border-border/60 bg-card/40 lg:flex">
            <CardContent className="p-4 text-xs text-muted-foreground"><p className="font-black uppercase tracking-widest text-primary">Alcance activo</p><p className="mt-2 leading-relaxed">Las métricas respetan las sucursales y almacenes autorizados para tu acceso.</p><p className="mt-3 rounded-lg bg-muted/40 p-2 font-semibold text-foreground">{overview?.inventoryScopeLabel || 'Solo inventario propio'}</p></CardContent>
          </Card>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Panel Manager / {group?.name || '...'}</p><h2 className="mt-1 text-2xl font-black tracking-tight">{activeTitle}</h2></div>
            <Button variant="outline" className="w-fit rounded-xl" onClick={() => downloadCsv(`manager-${section}.csv`, section === 'inventory' ? (inventoryQuery.data || []).map((row: any) => ({ producto: row.product?.name, codigo: row.product?.code, sucursal: row.clientTenant?.name, almacen: row.warehouse?.name, cantidad: row.quantity, reservado: row.reserved })) : (overview?.branches || []).map((branch) => ({ sucursal: branch.name, usuarios: branch._count.users, productos: branch._count.products, almacenes: branch._count.warehouses })))}><Download className="mr-2 size-4" /> Exportar Excel/CSV</Button>
          </div>

          {loading && <div className="flex min-h-[240px] items-center justify-center text-muted-foreground"><RefreshCw className="mr-2 size-5 animate-spin" /> Cargando consolidado...</div>}
          {!loading && !groupId && <Card className="rounded-3xl border-dashed"><CardContent className="p-10 text-center text-muted-foreground">SuperAdmin todavía no ha asignado este usuario a un grupo empresarial.</CardContent></Card>}

          {!loading && groupId && section === 'overview' && <OverviewContent overview={overview} groupId={groupId} onEnterBranch={enterBranch} />}
          {section === 'inventory' && <InventoryContent data={inventoryQuery.data || []} loading={inventoryQuery.isLoading} />}
          {section === 'accounting' && <AccountingContent data={accountingQuery.data} loading={accountingQuery.isLoading} />}
          {section === 'users' && <UsersContent data={usersQuery.data || []} loading={usersQuery.isLoading} />}
          {section === 'warehouses' && <WarehouseContent overview={overview} name={warehouseName} location={warehouseLocation} setName={setWarehouseName} setLocation={setWarehouseLocation} onCreate={() => warehouseMutation.mutate()} creating={warehouseMutation.isPending} />}
          {section === 'catalog' && <CatalogContent data={sharedCatalogQuery.data || []} loading={sharedCatalogQuery.isLoading} branchOptions={branchOptions} sourceBranchId={catalogSourceBranchId} setSourceBranchId={setCatalogSourceBranchId} search={catalogSearch} setSearch={setCatalogSearch} products={catalogProducts} productsLoading={branchProductsQuery.isLoading} selectedProductIds={catalogProductIds} setSelectedProductIds={setCatalogProductIds} targetBranchIds={catalogTargetBranchIds} setTargetBranchIds={setCatalogTargetBranchIds} onShare={() => shareCatalogMutation.mutate()} sharing={shareCatalogMutation.isPending} onUnshare={unshareMutation.mutate} unsharing={unshareMutation.isPending} onSync={syncMutation.mutate} syncing={syncMutation.isPending} />}
          {section === 'consolidated' && <ConsolidatedContent trialBalance={consolidatedTrialBalance.data} profitLoss={consolidatedProfitLoss.data} balanceSheet={consolidatedBalanceSheet.data} branchComparison={consolidatedBranchComparison.data} loading={consolidatedTrialBalance.isLoading || consolidatedProfitLoss.isLoading} dateFrom={consDateFrom} setDateFrom={setConsDateFrom} dateTo={consDateTo} setDateTo={setConsDateTo} />}
          {section === 'transfers' && <TransfersContent data={transfersQuery.data || []} loading={transfersQuery.isLoading} />}
          {section === 'managers' && <ManagersContent data={managersQuery.data || []} users={managerCandidates} selectedUserId={managerUserId} setSelectedUserId={setManagerUserId} branches={branchOptions} branchIds={managerBranchIds} setBranchIds={setManagerBranchIds} onAssign={() => managerMutation.mutate()} assigning={managerMutation.isPending} />}
        </main>
      </div>
    </div>
  );
}

function OverviewContent({ overview, groupId, onEnterBranch }: { overview?: ManagerOverview; groupId?: string; onEnterBranch?: (groupId: string, branchId: string) => Promise<void> }) {
  const metrics = overview?.metrics;
  const cards = [
    { label: 'Sucursales visibles', value: metrics?.branches, icon: Building2, tone: 'text-blue-500 bg-blue-500/10' },
    { label: 'Usuarios generales', value: metrics?.users, icon: Users, tone: 'text-violet-500 bg-violet-500/10' },
    { label: 'Unidades en inventario', value: metrics?.inventoryUnits, icon: Package, tone: 'text-emerald-500 bg-emerald-500/10' },
    { label: 'Almacenamiento registrado', value: formatBytes(metrics?.storageBytes), icon: Cloud, tone: 'text-amber-500 bg-amber-500/10' },
  ];
  return <>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card, index) => { const Icon = card.icon; return <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}><Card className="rounded-3xl border-border/60 bg-card/50"><CardContent className="p-5"><div className={`mb-4 flex size-11 items-center justify-center rounded-2xl ${card.tone}`}><Icon className="size-5" /></div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{card.label}</p><p className="mt-1 text-3xl font-black tracking-tight">{typeof card.value === 'string' ? card.value : formatNumber(card.value)}</p></CardContent></Card></motion.div>; })}</div>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Card className="rounded-3xl border-border/60 xl:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><Building2 className="size-5 text-primary" /> Distribución por sucursal</CardTitle></CardHeader><CardContent><Table containerClassName="overflow-x-auto"><TableHeader><TableRow><TableHead>Sucursal</TableHead><TableHead>Rubro</TableHead><TableHead>Usuarios</TableHead><TableHead>Productos</TableHead><TableHead>Almacenes</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{(overview?.branches || []).map((branch) => <TableRow key={branch.id}><TableCell className="font-semibold">{branch.name}</TableCell><TableCell><Badge variant="outline">{String(branch.industry || 'OTRO')}</Badge></TableCell><TableCell>{formatNumber(branch._count.users)}</TableCell><TableCell>{formatNumber(branch._count.products)}</TableCell><TableCell>{formatNumber(branch._count.warehouses)}</TableCell><TableCell className="text-right">{onEnterBranch && groupId && <Button variant="ghost" size="sm" className="gap-1.5 text-xs font-bold text-primary hover:text-primary/80" onClick={() => onEnterBranch(groupId, branch.id)}><ArrowRight className="size-3.5" /> Trabajar</Button>}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      <Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><Landmark className="size-5 text-primary" /> Cuentas emparejadas</CardTitle></CardHeader><CardContent className="space-y-3">{(overview?.accounts || []).slice(0, 8).map((account) => <div key={account.code} className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-3"><div><p className="font-mono text-xs text-primary">{account.code}</p><p className="text-sm font-semibold">{account.name}</p></div><p className="font-black tabular-nums">{formatNumber(account.totalBalance)}</p></div>)}{!overview?.accounts?.length && <p className="text-sm text-muted-foreground">Aún no hay cuentas contables para consolidar.</p>}</CardContent></Card>
    </div>
  </>;
}

function InventoryContent({ data, loading }: { data: any[]; loading: boolean }) { return <Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><Boxes className="size-5 text-primary" /> Existencias por producto, sucursal y ubicación</CardTitle></CardHeader><CardContent>{loading ? <div className="p-8 text-center text-muted-foreground">Cargando inventario...</div> : <Table containerClassName="overflow-x-auto"><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Sucursal</TableHead><TableHead>Ubicación</TableHead><TableHead className="text-right">Cantidad</TableHead><TableHead className="text-right">Reservado</TableHead></TableRow></TableHeader><TableBody>{data.map((row) => <TableRow key={row.id}><TableCell><p className="font-semibold">{row.product?.name}</p><p className="font-mono text-xs text-muted-foreground">{row.product?.code}</p></TableCell><TableCell>{row.clientTenant?.name}</TableCell><TableCell><Badge variant="outline">{row.warehouse?.name}</Badge><span className="ml-2 text-xs text-muted-foreground">{row.warehouse?.scopeType}</span></TableCell><TableCell className="text-right font-bold">{formatNumber(row.quantity)}</TableCell><TableCell className="text-right">{formatNumber(row.reserved)}</TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>; }

function AccountingContent({ data, loading }: { data?: { accounts: any[]; transactions: any[] }; loading: boolean }) { return <div className="grid grid-cols-1 gap-6 xl:grid-cols-2"><Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><Landmark className="size-5 text-primary" /> Catálogo contable consolidado</CardTitle></CardHeader><CardContent>{loading ? <div className="p-8 text-center text-muted-foreground">Cargando contabilidad...</div> : <Table containerClassName="overflow-x-auto"><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Cuenta</TableHead><TableHead>Sucursal</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader><TableBody>{(data?.accounts || []).map((account, index) => <TableRow key={`${account.clientTenantId}-${account.code}-${index}`}><TableCell className="font-mono text-primary">{account.code}</TableCell><TableCell>{account.name}</TableCell><TableCell>{account.clientTenantId}</TableCell><TableCell className="text-right font-bold">{formatNumber(account.balance)}</TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card><Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="text-lg font-black uppercase">Últimos movimientos</CardTitle></CardHeader><CardContent><div className="space-y-2">{(data?.transactions || []).slice(0, 12).map((transaction) => <div key={transaction.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{transaction.description}</p><p className="text-xs text-muted-foreground">{transaction.clientTenant?.name} · {transaction.account?.code}</p></div><div className="shrink-0 text-right text-xs tabular-nums"><p className="text-emerald-500">D {formatNumber(transaction.debit)}</p><p className="text-rose-500">C {formatNumber(transaction.credit)}</p></div></div>)}</div></CardContent></Card></div>; }

function UsersContent({ data, loading }: { data: any[]; loading: boolean }) { return <Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><Users className="size-5 text-primary" /> Recuento general de usuarios</CardTitle></CardHeader><CardContent>{loading ? <div className="p-8 text-center text-muted-foreground">Cargando usuarios...</div> : <Table containerClassName="overflow-x-auto"><TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Rol</TableHead><TableHead>Sucursal</TableHead><TableHead>RR. HH.</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>{data.map((user) => <TableRow key={user.id}><TableCell><p className="font-semibold">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></TableCell><TableCell><Badge variant="outline">{user.role}</Badge></TableCell><TableCell>{user.clientTenant?.name}</TableCell><TableCell>{user.employee ? 'Vinculado' : 'Usuario independiente'}</TableCell><TableCell><Badge variant={user.isActive ? 'default' : 'secondary'}>{user.isActive ? 'Activo' : 'Inactivo'}</Badge></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>; }

function WarehouseContent({ overview, name, location, setName, setLocation, onCreate, creating }: { overview?: ManagerOverview; name: string; location: string; setName: (value: string) => void; setLocation: (value: string) => void; onCreate: () => void; creating: boolean }) { return <div className="space-y-6"><Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><Warehouse className="size-5 text-primary" /> Almacenes y bodegas</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{(overview?.warehouses || []).map((warehouse) => <div key={warehouse.id} className="rounded-2xl border border-border/60 bg-muted/20 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{warehouse.name}</p><p className="text-xs text-muted-foreground">{warehouse.location || 'Sin ubicación registrada'}</p></div><Badge variant={warehouse.scopeType === 'GROUP' ? 'default' : 'outline'}>{warehouse.scopeType === 'GROUP' ? 'Corporativo' : 'Sucursal'}</Badge></div><p className="mt-4 text-xs text-muted-foreground">Propietario compatible: {warehouse.clientTenant?.name || warehouse.clientTenantId}</p></div>)}</div>{!overview?.warehouses?.length && <p className="py-6 text-center text-sm text-muted-foreground">No hay almacenes visibles.</p>}</CardContent></Card><Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><Plus className="size-5 text-primary" /> Nuevo almacén corporativo</CardTitle></CardHeader><CardContent className="flex flex-col gap-3 sm:flex-row"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del almacén" className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm" /><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Ubicación (opcional)" className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm" /><Button className="h-10 rounded-xl" disabled={!name.trim() || creating} onClick={onCreate}>{creating ? 'Creando...' : 'Crear almacén'}</Button></CardContent></Card></div>; }

function TransfersContent({ data, loading }: { data: any[]; loading: boolean }) {
  const statusBadge = (status: string) => {
    const styles: Record<string, string> = { PENDING: 'bg-amber-500/10 text-amber-600', COMPLETED: 'bg-emerald-500/10 text-emerald-600', CANCELLED: 'bg-rose-500/10 text-rose-600' };
    return <Badge variant="outline" className={styles[status] || ''}>{status}</Badge>;
  };
  return <Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><ArrowRightLeft className="size-5 text-primary" /> Transferencias entre sucursales del grupo</CardTitle></CardHeader><CardContent>
    {loading ? <div className="p-8 text-center text-muted-foreground">Cargando transferencias...</div> : <>
      {!data.length && <p className="py-6 text-center text-sm text-muted-foreground">No hay transferencias registradas en el grupo.</p>}
      <Table containerClassName="overflow-x-auto"><TableHeader><TableRow><TableHead>Número</TableHead><TableHead>Fecha</TableHead><TableHead>Origen</TableHead><TableHead>Destino</TableHead><TableHead>Estado</TableHead><TableHead>Items</TableHead></TableRow></TableHeader><TableBody>{data.map((t) => <TableRow key={t.id}><TableCell className="font-mono font-bold">{t.number}</TableCell><TableCell>{new Date(t.date).toLocaleDateString('es-NI')}</TableCell><TableCell>{t.from?.name || '-'}</TableCell><TableCell>{t.to?.name || '-'}</TableCell><TableCell>{statusBadge(t.status)}</TableCell><TableCell>{(t.items || []).length} producto(s)</TableCell></TableRow>)}</TableBody></Table>
    </>}
  </CardContent></Card>;
}

function ConsolidatedContent({ trialBalance, profitLoss, balanceSheet, branchComparison, loading, dateFrom, setDateFrom, dateTo, setDateTo }: {
  trialBalance?: any; profitLoss?: any; balanceSheet?: any; branchComparison?: any; loading: boolean;
  dateFrom: string; setDateFrom: (v: string) => void; dateTo: string; setDateTo: (v: string) => void;
}) {
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Filtros:</p>
      <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 rounded-xl border border-border/60 bg-card px-3 text-xs font-bold" />
      <span className="text-[10px] font-bold text-foreground/70">a</span>
      <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 rounded-xl border border-border/60 bg-card px-3 text-xs font-bold" />
    </div>
    {loading ? <div className="flex min-h-[200px] items-center justify-center text-muted-foreground"><RefreshCw className="mr-2 size-4 animate-spin" /> Cargando estados financieros...</div> : <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="text-lg font-black uppercase">Estado de Resultados</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="rounded-xl bg-emerald-500/5 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Ingresos</p><p className="mt-1 text-2xl font-black text-emerald-600">{formatNumber(profitLoss?.totalIngresos || 0)}</p></div>
          {(profitLoss?.ingresos || []).slice(0, 5).map((item: any) => <div key={item.code} className="flex justify-between text-sm"><span className="text-muted-foreground">{item.code} {item.name}</span><span className="font-bold">{formatNumber(item.balance)}</span></div>)}
          <div className="rounded-xl bg-rose-500/5 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-rose-600">Gastos</p><p className="mt-1 text-2xl font-black text-rose-600">{formatNumber(profitLoss?.totalGastos || 0)}</p></div>
          {(profitLoss?.gastos || []).slice(0, 5).map((item: any) => <div key={item.code} className="flex justify-between text-sm"><span className="text-muted-foreground">{item.code} {item.name}</span><span className="font-bold">{formatNumber(item.balance)}</span></div>)}
          <div className="border-t pt-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Utilidad Neta</p><p className="text-2xl font-black text-primary">{formatNumber(profitLoss?.utilidadNeta || 0)}</p></div>
        </CardContent></Card>
        <Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="text-lg font-black uppercase">Balance General</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="rounded-xl bg-blue-500/5 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Activos</p><p className="mt-1 text-2xl font-black text-blue-600">{formatNumber(balanceSheet?.totalActivos || 0)}</p></div>
          {(balanceSheet?.activos || []).slice(0, 4).map((item: any) => <div key={item.code} className="flex justify-between text-sm"><span className="text-muted-foreground">{item.code} {item.name}</span><span className="font-bold">{formatNumber(item.balance)}</span></div>)}
          <div className="rounded-xl bg-amber-500/5 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Pasivos</p><p className="mt-1 text-2xl font-black text-amber-600">{formatNumber(balanceSheet?.totalPasivos || 0)}</p></div>
          <div className="rounded-xl bg-violet-500/5 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-violet-600">Patrimonio</p><p className="mt-1 text-2xl font-black text-violet-600">{formatNumber(balanceSheet?.totalPatrimonio || 0)}</p></div>
        </CardContent></Card>
      </div>
      <Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><BarChart3 className="size-5 text-primary" /> Comparación por Sucursal</CardTitle></CardHeader><CardContent><Table containerClassName="overflow-x-auto"><TableHeader><TableRow><TableHead>Sucursal</TableHead><TableHead className="text-right">Ingresos</TableHead><TableHead className="text-right">Gastos</TableHead><TableHead className="text-right">Utilidad</TableHead><TableHead className="text-right">Movimientos</TableHead></TableRow></TableHeader><TableBody>{(branchComparison?.branches || []).map((b: any) => <TableRow key={b.branchId}><TableCell className="font-semibold">{b.branchName}</TableCell><TableCell className="text-right text-emerald-600 font-bold">{formatNumber(b.ingresos)}</TableCell><TableCell className="text-right text-rose-600 font-bold">{formatNumber(b.gastos)}</TableCell><TableCell className={`text-right font-black ${b.utilidad >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatNumber(b.utilidad)}</TableCell><TableCell className="text-right">{formatNumber(b.movimientos)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      {trialBalance && <Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="text-lg font-black uppercase">Balance de Comprobación</CardTitle></CardHeader><CardContent><Table containerClassName="overflow-x-auto"><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Cuenta</TableHead><TableHead className="text-right">Débito</TableHead><TableHead className="text-right">Crédito</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead className="text-right">Sucursales</TableHead></TableRow></TableHeader><TableBody>{(trialBalance?.rows || []).slice(0, 30).map((row: any, i: number) => <TableRow key={i}><TableCell className="font-mono text-primary">{row.code}</TableCell><TableCell>{row.name}</TableCell><TableCell className="text-right">{formatNumber(row.debit)}</TableCell><TableCell className="text-right">{formatNumber(row.credit)}</TableCell><TableCell className={`text-right font-bold ${row.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatNumber(row.balance)}</TableCell><TableCell className="text-right">{row.branchCount}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}
    </>}
  </div>;
}

function CatalogContent({ data, loading, branchOptions, sourceBranchId, setSourceBranchId, search, setSearch, products, productsLoading, selectedProductIds, setSelectedProductIds, targetBranchIds, setTargetBranchIds, onShare, sharing, onUnshare, unsharing, onSync, syncing }: {
  data: any[]; loading: boolean; branchOptions: Array<{ id: string; name: string }>;
  sourceBranchId: string; setSourceBranchId: (value: string) => void; search: string; setSearch: (value: string) => void;
  products: any[]; productsLoading: boolean; selectedProductIds: string[]; setSelectedProductIds: (value: string[]) => void;
  targetBranchIds: string[]; setTargetBranchIds: (value: string[]) => void; onShare: () => void; sharing: boolean;
  onUnshare: (mirrorIds: string[]) => void; unsharing: boolean; onSync: (productId: string) => void; syncing: boolean;
}) {
  const toggleProduct = (id: string) => setSelectedProductIds(selectedProductIds.includes(id) ? selectedProductIds.filter((value) => value !== id) : [...selectedProductIds, id]);
  const toggleTarget = (id: string) => setTargetBranchIds(targetBranchIds.includes(id) ? targetBranchIds.filter((value) => value !== id) : [...targetBranchIds, id]);
  return <div className="space-y-6">
    <Card className="rounded-3xl border-border/60">
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><Tags className="size-5 text-primary" /> Compartir productos entre sucursales</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sucursal de origen (catálogo maestro)</p>
            <select aria-label="Sucursal de origen" value={sourceBranchId} onChange={(event) => { setSourceBranchId(event.target.value); setSelectedProductIds([]); }} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">
              <option value="">Seleccionar sucursal</option>
              {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto por código o nombre..." className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" />
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-2">
              {productsLoading && <p className="p-3 text-center text-xs text-muted-foreground">Cargando productos...</p>}
              {!productsLoading && !products.length && <p className="p-3 text-center text-xs text-muted-foreground">Selecciona una sucursal para ver su catálogo.</p>}
              {products.map((product) => { const checked = selectedProductIds.includes(product.id); return <label key={product.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60"><input type="checkbox" checked={checked} onChange={() => toggleProduct(product.id)} /><span className="min-w-0 flex-1 truncate"><span className="font-semibold">{product.name}</span><span className="ml-2 font-mono text-xs text-muted-foreground">{product.code}</span></span><span className="shrink-0 text-xs font-bold tabular-nums">{formatNumber(product.salePrice)}</span></label>; })}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sucursales destino</p>
            <div className="space-y-1 rounded-xl border border-border/60 p-2">
              {branchOptions.map((branch) => { const checked = targetBranchIds.includes(branch.id); const isSource = branch.id === sourceBranchId; return <label key={branch.id} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60 ${isSource ? 'opacity-40' : ''}`}><input type="checkbox" disabled={isSource} checked={checked} onChange={() => toggleTarget(branch.id)} /><span className="min-w-0 flex-1 truncate font-semibold">{branch.name}</span>{isSource && <span className="shrink-0 text-[10px] font-black uppercase text-muted-foreground">Origen</span>}</label>; })}
            </div>
            <Button className="h-10 w-full rounded-xl" disabled={!selectedProductIds.length || !targetBranchIds.length || sharing} onClick={onShare}>{sharing ? 'Compartiendo...' : 'Compartir seleccionados'}</Button>
            <p className="text-xs text-muted-foreground">Los productos seleccionados se replican en cada sucursal destino con su propio precio (editable). Los cambios de nombre, descripción o impuesto del maestro se propagan con "Sincronizar".</p>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card className="rounded-3xl border-border/60">
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><Tags className="size-5 text-primary" /> Productos compartidos ({data.length})</CardTitle></CardHeader>
      <CardContent>
        {loading ? <div className="p-8 text-center text-muted-foreground">Cargando catálogo compartido...</div> : <div className="space-y-4">
          {!data.length && <p className="py-6 text-center text-sm text-muted-foreground">Aún no hay productos compartidos en el grupo.</p>}
          {data.map((master) => <div key={master.id} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0"><p className="font-bold">{master.name}</p><p className="font-mono text-xs text-muted-foreground">{master.code} · {master.clientTenant?.name} · {formatNumber(master.salePrice)}</p></div>
              <div className="flex items-center gap-2"><Badge variant="outline">{master.sharedCount} espejo(s)</Badge><Button variant="outline" size="sm" disabled={syncing} onClick={() => onSync(master.id)}><RefreshCw className="mr-1.5 size-3.5" /> Sincronizar</Button></div>
            </div>
            {master.mirrors?.length > 0 && <Table containerClassName="mt-3 overflow-x-auto"><TableHeader><TableRow><TableHead>Sucursal espejo</TableHead><TableHead>Precio</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{master.mirrors.map((mirror) => <TableRow key={mirror.id}><TableCell className="font-semibold">{mirror.clientTenant?.name}</TableCell><TableCell>{formatNumber(mirror.salePrice)}</TableCell><TableCell><Badge variant={mirror.isActive ? 'default' : 'secondary'}>{mirror.isActive ? 'Activo' : 'Inactivo'}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" className="text-destructive" disabled={unsharing} onClick={() => onUnshare([mirror.id])}>Quitar</Button></TableCell></TableRow>)}</TableBody></Table>}
          </div>)}
        </div>}
      </CardContent>
    </Card>
  </div>;
}

function ManagersContent({ data, users, selectedUserId, setSelectedUserId, branches, branchIds, setBranchIds, onAssign, assigning }: { data: any[]; users: any[]; selectedUserId: string; setSelectedUserId: (value: string) => void; branches: Array<{ id: string; name: string }>; branchIds: string[]; setBranchIds: (value: string[]) => void; onAssign: () => void; assigning: boolean }) { return <div className="space-y-6"><Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><ShieldCheck className="size-5 text-primary" /> Asignar acceso Manager</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><select aria-label="Usuario Manager" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm"><option value="">Seleccionar usuario</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}</select><Button className="h-10 rounded-xl" disabled={!selectedUserId || assigning} onClick={onAssign}>{assigning ? 'Guardando...' : 'Asignar acceso'}</Button></div><div><p className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">Sucursales visibles</p><div className="flex flex-wrap gap-2">{branches.map((branch) => { const checked = branchIds.includes(branch.id); return <label key={branch.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm"><input type="checkbox" checked={checked} onChange={() => setBranchIds(checked ? branchIds.filter((id) => id !== branch.id) : [...branchIds, branch.id])} />{branch.name}</label>; })}</div></div></CardContent></Card><Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="text-lg font-black uppercase">Managers configurados</CardTitle></CardHeader><CardContent><div className="space-y-3">{data.map((assignment) => <div key={assignment.id} className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">{assignment.user?.name}</p><p className="text-xs text-muted-foreground">{assignment.user?.email}</p></div><div className="flex flex-wrap gap-2"><Badge variant={assignment.isOwner ? 'default' : 'outline'}>{assignment.isOwner ? 'Propietario' : 'Delegado'}</Badge><Badge variant="outline">{assignment.branchIds?.length || 0} sucursal(es)</Badge></div></div>)}{!data.length && <p className="py-6 text-center text-sm text-muted-foreground">No hay accesos Manager explícitos todavía.</p>}</div></CardContent></Card></div>; }
