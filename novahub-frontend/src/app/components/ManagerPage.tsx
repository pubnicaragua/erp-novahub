import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Building2, Boxes, Download, Landmark, LayoutDashboard, Package, Plus, ShieldCheck, Users, Warehouse, Cloud, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useTenantQuery } from '../hooks/useTenantQuery';
import { enterpriseGroupsService, type ManagerOverview } from '../services/enterprise-groups.service';

type ManagerSection = 'overview' | 'inventory' | 'accounting' | 'users' | 'warehouses' | 'managers';

const sections: Array<{ id: ManagerSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventario consolidado', icon: Boxes },
  { id: 'accounting', label: 'Contabilidad y finanzas', icon: Landmark },
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'warehouses', label: 'Almacenes', icon: Warehouse },
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

  const overview = overviewQuery.data as ManagerOverview | undefined;
  const metrics = overview?.metrics;
  const branchOptions = group?.branches || [];
  const managerCandidates = usersQuery.data?.filter((user) => ['MANAGER', 'ADMIN'].includes(String(user.role).toUpperCase())) || [];
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
            <CardContent className="p-4 text-xs text-muted-foreground"><p className="font-black uppercase tracking-widest text-primary">Alcance activo</p><p className="mt-2 leading-relaxed">Las métricas respetan las sucursales y almacenes autorizados para tu acceso.</p></CardContent>
          </Card>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Panel Manager / {group?.name || '...'}</p><h2 className="mt-1 text-2xl font-black tracking-tight">{activeTitle}</h2></div>
            <Button variant="outline" className="w-fit rounded-xl" onClick={() => downloadCsv(`manager-${section}.csv`, section === 'inventory' ? (inventoryQuery.data || []).map((row: any) => ({ producto: row.product?.name, codigo: row.product?.code, sucursal: row.clientTenant?.name, almacen: row.warehouse?.name, cantidad: row.quantity, reservado: row.reserved })) : (overview?.branches || []).map((branch) => ({ sucursal: branch.name, usuarios: branch._count.users, productos: branch._count.products, almacenes: branch._count.warehouses })))}><Download className="mr-2 size-4" /> Exportar Excel/CSV</Button>
          </div>

          {loading && <div className="flex min-h-[240px] items-center justify-center text-muted-foreground"><RefreshCw className="mr-2 size-5 animate-spin" /> Cargando consolidado...</div>}
          {!loading && !groupId && <Card className="rounded-3xl border-dashed"><CardContent className="p-10 text-center text-muted-foreground">SuperAdmin todavía no ha asignado este usuario a un grupo empresarial.</CardContent></Card>}

          {!loading && groupId && section === 'overview' && <OverviewContent overview={overview} />}
          {section === 'inventory' && <InventoryContent data={inventoryQuery.data || []} loading={inventoryQuery.isLoading} />}
          {section === 'accounting' && <AccountingContent data={accountingQuery.data} loading={accountingQuery.isLoading} />}
          {section === 'users' && <UsersContent data={usersQuery.data || []} loading={usersQuery.isLoading} />}
          {section === 'warehouses' && <WarehouseContent overview={overview} name={warehouseName} location={warehouseLocation} setName={setWarehouseName} setLocation={setWarehouseLocation} onCreate={() => warehouseMutation.mutate()} creating={warehouseMutation.isPending} />}
          {section === 'managers' && <ManagersContent data={managersQuery.data || []} users={managerCandidates} selectedUserId={managerUserId} setSelectedUserId={setManagerUserId} branches={branchOptions} branchIds={managerBranchIds} setBranchIds={setManagerBranchIds} onAssign={() => managerMutation.mutate()} assigning={managerMutation.isPending} />}
        </main>
      </div>
    </div>
  );
}

function OverviewContent({ overview }: { overview?: ManagerOverview }) {
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
      <Card className="rounded-3xl border-border/60 xl:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><Building2 className="size-5 text-primary" /> Distribución por sucursal</CardTitle></CardHeader><CardContent><Table containerClassName="overflow-x-auto"><TableHeader><TableRow><TableHead>Sucursal</TableHead><TableHead>Rubro</TableHead><TableHead>Usuarios</TableHead><TableHead>Productos</TableHead><TableHead>Almacenes</TableHead></TableRow></TableHeader><TableBody>{(overview?.branches || []).map((branch) => <TableRow key={branch.id}><TableCell className="font-semibold">{branch.name}</TableCell><TableCell><Badge variant="outline">{String(branch.industry || 'OTRO')}</Badge></TableCell><TableCell>{formatNumber(branch._count.users)}</TableCell><TableCell>{formatNumber(branch._count.products)}</TableCell><TableCell>{formatNumber(branch._count.warehouses)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      <Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><Landmark className="size-5 text-primary" /> Cuentas emparejadas</CardTitle></CardHeader><CardContent className="space-y-3">{(overview?.accounts || []).slice(0, 8).map((account) => <div key={account.code} className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-3"><div><p className="font-mono text-xs text-primary">{account.code}</p><p className="text-sm font-semibold">{account.name}</p></div><p className="font-black tabular-nums">{formatNumber(account.totalBalance)}</p></div>)}{!overview?.accounts?.length && <p className="text-sm text-muted-foreground">Aún no hay cuentas contables para consolidar.</p>}</CardContent></Card>
    </div>
  </>;
}

function InventoryContent({ data, loading }: { data: any[]; loading: boolean }) { return <Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><Boxes className="size-5 text-primary" /> Existencias por producto, sucursal y ubicación</CardTitle></CardHeader><CardContent>{loading ? <div className="p-8 text-center text-muted-foreground">Cargando inventario...</div> : <Table containerClassName="overflow-x-auto"><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Sucursal</TableHead><TableHead>Ubicación</TableHead><TableHead className="text-right">Cantidad</TableHead><TableHead className="text-right">Reservado</TableHead></TableRow></TableHeader><TableBody>{data.map((row) => <TableRow key={row.id}><TableCell><p className="font-semibold">{row.product?.name}</p><p className="font-mono text-xs text-muted-foreground">{row.product?.code}</p></TableCell><TableCell>{row.clientTenant?.name}</TableCell><TableCell><Badge variant="outline">{row.warehouse?.name}</Badge><span className="ml-2 text-xs text-muted-foreground">{row.warehouse?.scopeType}</span></TableCell><TableCell className="text-right font-bold">{formatNumber(row.quantity)}</TableCell><TableCell className="text-right">{formatNumber(row.reserved)}</TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>; }

function AccountingContent({ data, loading }: { data?: { accounts: any[]; transactions: any[] }; loading: boolean }) { return <div className="grid grid-cols-1 gap-6 xl:grid-cols-2"><Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><Landmark className="size-5 text-primary" /> Catálogo contable consolidado</CardTitle></CardHeader><CardContent>{loading ? <div className="p-8 text-center text-muted-foreground">Cargando contabilidad...</div> : <Table containerClassName="overflow-x-auto"><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Cuenta</TableHead><TableHead>Sucursal</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader><TableBody>{(data?.accounts || []).map((account, index) => <TableRow key={`${account.clientTenantId}-${account.code}-${index}`}><TableCell className="font-mono text-primary">{account.code}</TableCell><TableCell>{account.name}</TableCell><TableCell>{account.clientTenantId}</TableCell><TableCell className="text-right font-bold">{formatNumber(account.balance)}</TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card><Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="text-lg font-black uppercase">Últimos movimientos</CardTitle></CardHeader><CardContent><div className="space-y-2">{(data?.transactions || []).slice(0, 12).map((transaction) => <div key={transaction.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{transaction.description}</p><p className="text-xs text-muted-foreground">{transaction.clientTenant?.name} · {transaction.account?.code}</p></div><div className="shrink-0 text-right text-xs tabular-nums"><p className="text-emerald-500">D {formatNumber(transaction.debit)}</p><p className="text-rose-500">C {formatNumber(transaction.credit)}</p></div></div>)}</div></CardContent></Card></div>; }

function UsersContent({ data, loading }: { data: any[]; loading: boolean }) { return <Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><Users className="size-5 text-primary" /> Recuento general de usuarios</CardTitle></CardHeader><CardContent>{loading ? <div className="p-8 text-center text-muted-foreground">Cargando usuarios...</div> : <Table containerClassName="overflow-x-auto"><TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Rol</TableHead><TableHead>Sucursal</TableHead><TableHead>RR. HH.</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>{data.map((user) => <TableRow key={user.id}><TableCell><p className="font-semibold">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></TableCell><TableCell><Badge variant="outline">{user.role}</Badge></TableCell><TableCell>{user.clientTenant?.name}</TableCell><TableCell>{user.employee ? 'Vinculado' : 'Usuario independiente'}</TableCell><TableCell><Badge variant={user.isActive ? 'default' : 'secondary'}>{user.isActive ? 'Activo' : 'Inactivo'}</Badge></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>; }

function WarehouseContent({ overview, name, location, setName, setLocation, onCreate, creating }: { overview?: ManagerOverview; name: string; location: string; setName: (value: string) => void; setLocation: (value: string) => void; onCreate: () => void; creating: boolean }) { return <div className="space-y-6"><Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><Warehouse className="size-5 text-primary" /> Almacenes y bodegas</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{(overview?.warehouses || []).map((warehouse) => <div key={warehouse.id} className="rounded-2xl border border-border/60 bg-muted/20 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{warehouse.name}</p><p className="text-xs text-muted-foreground">{warehouse.location || 'Sin ubicación registrada'}</p></div><Badge variant={warehouse.scopeType === 'GROUP' ? 'default' : 'outline'}>{warehouse.scopeType === 'GROUP' ? 'Corporativo' : 'Sucursal'}</Badge></div><p className="mt-4 text-xs text-muted-foreground">Propietario compatible: {warehouse.clientTenant?.name || warehouse.clientTenantId}</p></div>)}</div>{!overview?.warehouses?.length && <p className="py-6 text-center text-sm text-muted-foreground">No hay almacenes visibles.</p>}</CardContent></Card><Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><Plus className="size-5 text-primary" /> Nuevo almacén corporativo</CardTitle></CardHeader><CardContent className="flex flex-col gap-3 sm:flex-row"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del almacén" className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm" /><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Ubicación (opcional)" className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm" /><Button className="h-10 rounded-xl" disabled={!name.trim() || creating} onClick={onCreate}>{creating ? 'Creando...' : 'Crear almacén'}</Button></CardContent></Card></div>; }

function ManagersContent({ data, users, selectedUserId, setSelectedUserId, branches, branchIds, setBranchIds, onAssign, assigning }: { data: any[]; users: any[]; selectedUserId: string; setSelectedUserId: (value: string) => void; branches: Array<{ id: string; name: string }>; branchIds: string[]; setBranchIds: (value: string[]) => void; onAssign: () => void; assigning: boolean }) { return <div className="space-y-6"><Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><ShieldCheck className="size-5 text-primary" /> Asignar acceso Manager</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><select aria-label="Usuario Manager" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm"><option value="">Seleccionar usuario</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}</select><Button className="h-10 rounded-xl" disabled={!selectedUserId || assigning} onClick={onAssign}>{assigning ? 'Guardando...' : 'Asignar acceso'}</Button></div><div><p className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">Sucursales visibles</p><div className="flex flex-wrap gap-2">{branches.map((branch) => { const checked = branchIds.includes(branch.id); return <label key={branch.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm"><input type="checkbox" checked={checked} onChange={() => setBranchIds(checked ? branchIds.filter((id) => id !== branch.id) : [...branchIds, branch.id])} />{branch.name}</label>; })}</div></div></CardContent></Card><Card className="rounded-3xl border-border/60"><CardHeader><CardTitle className="text-lg font-black uppercase">Managers configurados</CardTitle></CardHeader><CardContent><div className="space-y-3">{data.map((assignment) => <div key={assignment.id} className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">{assignment.user?.name}</p><p className="text-xs text-muted-foreground">{assignment.user?.email}</p></div><div className="flex flex-wrap gap-2"><Badge variant={assignment.isOwner ? 'default' : 'outline'}>{assignment.isOwner ? 'Propietario' : 'Delegado'}</Badge><Badge variant="outline">{assignment.branchIds?.length || 0} sucursal(es)</Badge></div></div>)}{!data.length && <p className="py-6 text-center text-sm text-muted-foreground">No hay accesos Manager explícitos todavía.</p>}</div></CardContent></Card></div>; }
