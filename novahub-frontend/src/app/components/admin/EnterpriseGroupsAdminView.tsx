import { useMemo, useState } from 'react';
import { Building2, CalendarClock, Clock3, FileText, GitBranch, HardDrive, Link2, Loader2, Plus, Search, UserRound, Users, Warehouse } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { enterpriseGroupsService } from '../../services/enterprise-groups.service';
import { getBusinessTypeLabel } from '../../constants/businessTypes';
import { GroupBranchSupportDialog } from './GroupBranchSupportDialog';
import { GroupManagerSupportDialog } from './GroupManagerSupportDialog';
import { EnterpriseGroupSetupView } from './EnterpriseGroupSetupView';
import { TrialExtensionRequestsPanel } from '../suscripciones/TrialExtensionRequestsPanel';
import { PlatformQuotesPanel } from './PlatformQuotesPanel';

function formatStorage(value: unknown) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = bytes;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index += 1; }
  return `${amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

export function EnterpriseGroupsAdminView({ embedded = false }: { embedded?: boolean }) {
  const [workspace, setWorkspace] = useState<{ mode: 'create' | 'edit'; groupId?: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'groups' | 'legacy' | 'requests' | 'quotes'>('groups');
  const query = useTenantQuery(['platform-enterprise-groups'], (signal) => enterpriseGroupsService.getPlatformGroups(signal));
  const legacyQuery = useTenantQuery(['platform-enterprise-groups-legacy-users'], (signal) => enterpriseGroupsService.getPlatformLegacyUsers(signal), { enabled: activeTab === 'legacy' });
  const data = query.data;
  const totalGroupUsers = (data?.groups || []).reduce((total: number, group: any) => total + Number(group.userCount || 0), 0);
  const filteredGroups = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase();
    if (!term) return data?.groups || [];
    return (data?.groups || []).filter((group: any) => {
      const haystack = [
        group.name,
        group.description,
        ...(group.businessUnits || []).map((unit: any) => unit.name),
        ...(group.branches || []).map((branch: any) => branch.name),
      ].filter(Boolean).join(' ').toLocaleLowerCase();
      return haystack.includes(term);
    });
  }, [data?.groups, searchTerm]);
  const extendLegacyTrial = async (tenantId: string) => {
    try {
      await enterpriseGroupsService.extendPlatformLegacyTrial(tenantId, 7);
      toast.success('Trial extendido 7 días');
      await legacyQuery.refetch();
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo extender el trial');
    }
  };
  if (workspace) {
    const selectedGroup = workspace.groupId ? data?.groups?.find((group: any) => group.id === workspace.groupId) : undefined;
    return <EnterpriseGroupSetupView mode={workspace.mode} initialGroup={selectedGroup} onBack={() => setWorkspace(null)} onChanged={() => query.refetch()} />;
  }
  const content = (
    <section className="space-y-8">
      <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-[66px] shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Building2 className="size-9" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Nueva jerarquía</p>
            <h1 className="text-3xl font-black uppercase italic leading-none tracking-tighter sm:text-4xl">
              Grupos <span className="text-primary">empresariales</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-muted-foreground/70">
              Crea primero el grupo y administra dentro sus sucursales, soporte y métricas.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
            {data?.groups?.length || 0} grupos · {data?.unassignedBranches?.length || 0} pendientes
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
            Métrica global en Master Console
          </Badge>
          <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1 text-xs"><Users className="size-3.5 text-primary" /> {totalGroupUsers} usuarios</Badge>
          <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1 text-xs"><HardDrive className="size-3.5 text-primary" /> {formatStorage(data?.storageBytes)} · {data?.storageObjects || 0} archivos</Badge>
        </div>
      </div>

      <div className="flex min-w-0 gap-2 overflow-x-auto rounded-2xl border border-border/60 bg-muted/20 p-1" role="tablist" aria-label="Administración de grupos empresariales">
        {([
          ['groups', 'Grupos actuales', Building2],
          ['legacy', 'Usuarios heredados', UserRound],
          ['requests', 'Solicitudes de trial', Clock3],
          ['quotes', 'Cotizaciones', FileText],
        ] as const).map(([tab, label, Icon]) => (
          <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wide transition ${activeTab === tab ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-background hover:text-foreground'}`}>
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'groups' ? <>
      <Card className="rounded-3xl border-primary/20 bg-primary/[0.03] shadow-sm">
        <CardContent className="space-y-6 p-6 sm:p-7">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <label className="text-xs font-bold text-muted-foreground">
              Crear un grupo empresarial
              <p className="mt-2 text-sm font-normal text-muted-foreground">Se abrirá el flujo avanzado para capturar Manager, rubros, almacenes y sucursales.</p>
            </label>
            <div className="flex items-end justify-end lg:col-span-2">
              <Button className="h-11 rounded-xl px-5" onClick={() => setWorkspace({ mode: 'create' })}>
                <Plus className="mr-2 size-4" /> Iniciar configuración
              </Button>
            </div>
          </div>

          <p className="rounded-2xl border border-dashed border-primary/30 bg-primary/[0.04] p-4 text-xs font-medium text-muted-foreground">
            Después de crear el grupo, la primera y las siguientes sucursales se registran desde su propia tarjeta. Así ninguna sucursal queda creada fuera de un grupo.
          </p>
        </CardContent>
      </Card>

      <div className="relative max-w-2xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar grupo empresarial, rubro o sucursal…"
          aria-label="Buscar grupo empresarial"
          className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
        {filteredGroups.map((group: any) => (
          <GroupCard
            key={group.id}
            group={group}
            onOpenWorkspace={() => setWorkspace({ mode: 'edit', groupId: group.id })}
            onChanged={() => query.refetch()}
          />
        ))}
        {!filteredGroups.length && <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground xl:col-span-2">No se encontraron grupos con ese criterio.</div>}
      </div>

      {!!data?.unassignedBranches?.length && (
        <Card className="rounded-3xl border-dashed border-amber-500/40 shadow-sm">
          <CardHeader className="p-6 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-black uppercase">
              <Link2 className="size-5 text-amber-500" /> Sucursales pendientes de clasificar
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 p-6 pt-3">
            {data.unassignedBranches.map((branch: any) => (
              <Badge key={branch.id} variant="outline" className="px-3 py-2">
                {branch.name}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
      </> : activeTab === 'legacy' ? (
        <LegacyUsersPanel data={legacyQuery.data} loading={legacyQuery.isLoading} onExtend={extendLegacyTrial} />
      ) : activeTab === 'requests' ? (
        <TrialExtensionRequestsPanel />
      ) : (
        <PlatformQuotesPanel groups={data?.groups || []} />
      )}
    </section>
  );

  if (embedded) return content;

  return (
    <div className="master-console-module min-w-0 max-w-full overflow-x-hidden bg-background">
      <div className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-[1700px] min-w-0 p-4 sm:p-6 md:p-10">
        {content}
      </div>
    </div>
  );
}

function LegacyUsersPanel({ data, loading, onExtend }: { data?: { cutoff: string; totalUsers: number; totalTenants: number; tenants: any[] }; loading: boolean; onExtend: (tenantId: string) => Promise<void> }) {
  const [term, setTerm] = useState('');
  const tenants = useMemo(() => {
    const normalized = term.trim().toLocaleLowerCase();
    return (data?.tenants || []).filter((tenant: any) => !normalized || [tenant.name, tenant.slug, tenant.enterpriseGroup?.name, ...(tenant.users || []).map((user: any) => `${user.name} ${user.email}`)].join(' ').toLocaleLowerCase().includes(normalized));
  }, [data?.tenants, term]);
  return (
    <Card className="rounded-3xl border-border/60 shadow-sm">
      <CardHeader className="gap-4 p-6 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><UserRound className="size-5 text-primary" /> Usuarios de configuración anterior</CardTitle><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Empresas y usuarios creados antes de la jerarquía de grupos. El trial se extiende a nivel de empresa para conservar el acceso de toda la sucursal.</p></div>
        <div className="relative w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar empresa o usuario…" className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus:border-primary" /></div>
      </CardHeader>
      <CardContent className="space-y-4 p-6 pt-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline"><Users className="mr-1 size-3" /> {data?.totalUsers || 0} usuarios</Badge><Badge variant="outline"><Building2 className="mr-1 size-3" /> {data?.totalTenants || 0} empresas</Badge>{data?.cutoff && <span>Antes de {new Date(data.cutoff).toLocaleDateString('es-NI')}</span>}</div>
        {loading ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div> : !tenants.length ? <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No se encontraron usuarios heredados.</div> : <div className="grid gap-4 xl:grid-cols-2">{tenants.map((tenant: any) => <div key={tenant.id} className="rounded-2xl border border-border/60 bg-muted/[0.08] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black">{tenant.name}</p><p className="text-xs text-muted-foreground">{tenant.enterpriseGroup?.name || 'Sin grupo visible'} · {tenant.slug}</p></div><Button size="sm" className="shrink-0 rounded-lg" onClick={() => onExtend(tenant.id)}><CalendarClock className="mr-1.5 size-4" /> +7 días</Button></div><div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground"><Badge variant={tenant.isActive ? 'outline' : 'destructive'}>{tenant.isActive ? 'Activa' : 'Inactiva'}</Badge><span>Vence: {tenant.expiresAt ? new Date(tenant.expiresAt).toLocaleDateString('es-NI') : 'Sin fecha'}</span></div><div className="mt-3 space-y-2 border-t border-border/50 pt-3">{(tenant.users || []).map((user: any) => <div key={user.id} className="flex min-w-0 items-center justify-between gap-3 text-xs"><span className="truncate font-semibold">{user.name} <span className="font-normal text-muted-foreground">· {user.email}</span></span><span className="shrink-0 text-muted-foreground">{user.isActive ? 'Activo' : 'Inactivo'}</span></div>)}</div></div>)}</div>}
      </CardContent>
    </Card>
  );
}

function GroupCard({ group, onOpenWorkspace, onChanged }: { group: any; onOpenWorkspace: () => void; onChanged: () => void }) {
  const units = group.businessUnits || [];
  const warehouses = group.warehouses || [];
  return (
    <Card className="rounded-3xl border-border/60 bg-card/60 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="p-6 pb-4">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="flex min-w-0 items-center gap-2 text-lg font-black"><Building2 className="size-5 shrink-0 text-primary" /><span className="truncate">{group.name}</span></CardTitle>
            <p className="mt-2 truncate text-xs text-muted-foreground">Catálogo por rubro · inventario compartido dentro del rubro</p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2"><GroupManagerSupportDialog group={group} onChanged={onChanged} /><Button className="rounded-xl" onClick={onOpenWorkspace}><GitBranch className="mr-2 size-4" /> Configurar</Button></div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-6 pt-0">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric icon={Building2} label="Sucursales" value={group.branchCount} />
          <Metric icon={Users} label="Usuarios" value={group.userCount} />
          <Metric icon={GitBranch} label="Rubros" value={units.length} />
          <Metric icon={Warehouse} label="Almacenes" value={warehouses.length} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-muted/15 p-4"><p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><GitBranch className="size-4 text-primary" /> Rubros</p><div className="space-y-2">{units.slice(0, 4).map((unit: any) => <div key={unit.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate font-semibold">{unit.name}</span><Badge variant="outline" className="shrink-0 text-[10px]">{group.branches.filter((branch: any) => branch.businessUnitId === unit.id).length} suc.</Badge></div>)}{!units.length && <p className="text-xs text-muted-foreground">Configura los rubros desde el flujo avanzado.</p>}{units.length > 4 && <p className="text-xs text-primary">+{units.length - 4} rubros más</p>}</div></div>
          <div className="rounded-2xl border border-border/60 bg-muted/15 p-4"><p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><Warehouse className="size-4 text-primary" /> Almacenes corporativos</p><div className="space-y-2">{warehouses.slice(0, 4).map((warehouse: any) => <div key={warehouse.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate font-semibold">{warehouse.name}</span><span className="shrink-0 text-[10px] text-muted-foreground">{units.find((unit: any) => unit.id === warehouse.businessUnitId)?.name || 'Rubro pendiente'}</span></div>)}{!warehouses.length && <p className="text-xs text-muted-foreground">Aún no hay almacenes fuera de las sucursales.</p>}{warehouses.length > 4 && <p className="text-xs text-primary">+{warehouses.length - 4} almacenes más</p>}</div></div>
        </div>
        <div className="space-y-2"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sucursales y soporte</p>{(group.branches || []).slice(0, 5).map((branch: any) => <div key={branch.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border/50 p-3 text-sm"><div className="flex min-w-0 items-center gap-3"><Building2 className="size-4 shrink-0 text-primary" /><div className="min-w-0"><p className="truncate font-semibold">{branch.name}</p><p className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">{units.find((unit: any) => unit.id === branch.businessUnitId)?.name || getBusinessTypeLabel(branch.industry, branch.subIndustry)} · {branch._count?.users || 0} usuarios</p></div></div><GroupBranchSupportDialog branch={branch} onChanged={onChanged} /></div>)}{!group.branches?.length && <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Este grupo todavía no tiene sucursales.</p>}{group.branches?.length > 5 && <p className="text-xs text-primary">+{group.branches.length - 5} sucursales más. Abre Configurar para verlas.</p>}</div>
      </CardContent>
    </Card>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value?: number }) {
  return (
    <div className="rounded-2xl bg-muted/30 p-4 text-center">
      <Icon className="mx-auto mb-2 size-4 text-primary" />
      <p className="text-lg font-black">{value || 0}</p>
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
