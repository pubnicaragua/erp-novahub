import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Link2, Plus, Users, Warehouse } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { enterpriseGroupsService } from '../../services/enterprise-groups.service';

export function EnterpriseGroupsAdminView() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const query = useTenantQuery(['platform-enterprise-groups'], (signal) => enterpriseGroupsService.getPlatformGroups(signal));
  const data = query.data;
  const createMutation = useMutation({
    mutationFn: () => enterpriseGroupsService.createPlatformGroup({ name, description, branchIds: selectedBranchIds }),
    onSuccess: () => { setName(''); setDescription(''); setSelectedBranchIds([]); query.refetch(); toast.success('Grupo empresarial creado'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const assignMutation = useMutation({
    mutationFn: ({ groupId, branchIds }: { groupId: string; branchIds: string[] }) => enterpriseGroupsService.updatePlatformGroup(groupId, { branchIds }),
    onSuccess: () => { query.refetch(); toast.success('Sucursales actualizadas'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const allBranches = (data?.groups || []).flatMap((group: any) => group.branches || []);

  return <section className="space-y-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Nueva jerarquía</p><h2 className="text-xl font-black uppercase tracking-tight">Grupos empresariales</h2></div><div className="flex flex-wrap gap-2"><Badge variant="outline">{data?.groups?.length || 0} grupos · {data?.unassignedBranches?.length || 0} pendientes</Badge><Badge variant="outline">{formatBytes(data?.storageBytes)} registrados</Badge></div></div>
    <Card className="rounded-3xl border-primary/20 bg-primary/[0.03]"><CardContent className="space-y-4 p-5"><div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end"><label className="text-xs font-bold text-muted-foreground">Nombre del grupo<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Grupo Comercial Nova" className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" /></label><label className="text-xs font-bold text-muted-foreground">Descripción<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Opcional" className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" /></label><Button className="h-10 rounded-xl" disabled={!name.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}><Plus className="mr-2 size-4" /> Crear grupo</Button></div><div><p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sucursales a incluir (permite reagrupar tenants existentes)</p><div className="grid max-h-40 grid-cols-1 gap-2 overflow-y-auto rounded-2xl border border-border/50 p-3 sm:grid-cols-2 xl:grid-cols-3">{allBranches.map((branch: any) => <label key={branch.id} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted/50"><input type="checkbox" checked={selectedBranchIds.includes(branch.id)} onChange={(event) => setSelectedBranchIds(event.target.checked ? [...selectedBranchIds, branch.id] : selectedBranchIds.filter((id) => id !== branch.id))} /><span className="truncate">{branch.name}</span></label>)}{!allBranches.length && <p className="text-xs text-muted-foreground">No hay sucursales cargadas.</p>}</div></div></CardContent></Card>
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{(data?.groups || []).map((group: any) => <GroupCard key={group.id} group={group} onAssign={(branchIds) => assignMutation.mutate({ groupId: group.id, branchIds })} saving={assignMutation.isPending} />)}</div>
    {!!data?.unassignedBranches?.length && <Card className="rounded-3xl border-dashed border-amber-500/40"><CardHeader><CardTitle className="flex items-center gap-2 text-base font-black uppercase"><Link2 className="size-5 text-amber-500" /> Sucursales pendientes de clasificar</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{data.unassignedBranches.map((branch: any) => <Badge key={branch.id} variant="outline" className="px-3 py-2">{branch.name}</Badge>)}</CardContent></Card>}
  </section>;
}

function formatBytes(value: unknown) {
  const bytes = Number(value || 0);
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function GroupCard({ group, onAssign, saving }: { group: any; onAssign: (branchIds: string[]) => void; saving: boolean }) {
  const [selected, setSelected] = useState<string[]>(group.branches.map((branch: any) => branch.id));
  return <Card className="rounded-3xl border-border/60 bg-card/60"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-lg font-black"><Building2 className="size-5 text-primary" />{group.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">/{group.slug} · catálogo {group.catalogMode}</p></div><Badge variant={group.isActive ? 'default' : 'secondary'}>{group.isActive ? 'Activo' : 'Inactivo'}</Badge></div></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-3 gap-2"><Metric icon={Building2} label="Sucursales" value={group.branchCount} /><Metric icon={Users} label="Usuarios" value={group.userCount} /><Metric icon={Warehouse} label="Almacenes" value={group.localWarehouseCount + group._count.warehouses} /></div><div><p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sucursales del grupo</p><div className="space-y-2">{group.branches.map((branch: any) => <label key={branch.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 p-3 text-sm"><span className="flex min-w-0 items-center gap-2"><input type="checkbox" checked={selected.includes(branch.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, branch.id] : selected.filter((id) => id !== branch.id))} /><span className="truncate font-semibold">{branch.name}</span></span><span className="shrink-0 text-xs text-muted-foreground">{branch._count.users} usuarios</span></label>)}</div></div><Button variant="outline" className="w-full rounded-xl" disabled={saving} onClick={() => onAssign(selected)}>Guardar sucursales</Button></CardContent></Card>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: number }) { return <div className="rounded-2xl bg-muted/30 p-3 text-center"><Icon className="mx-auto mb-1 size-4 text-primary" /><p className="text-lg font-black">{value || 0}</p><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p></div>; }
