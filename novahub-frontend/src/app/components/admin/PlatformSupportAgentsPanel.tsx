import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Loader2, Plus, ShieldCheck, UserRound, Users } from 'lucide-react';
import { supportConversationsService, type SupportAgent, type SupportScope, type SupportScopeType } from '../../services/support-conversations.service';
import { useTenantQuery, asList } from '../../hooks/useTenantQuery';
import { toast } from '@/app/services/toast';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';

interface ScopeOptions {
  groups: Array<{ id: string; name: string; businessUnits: Array<{ id: string; name: string }>; branches: Array<{ id: string; name: string; businessUnitId: string }> }>;
}

const EMPTY_FORM = { name: '', email: '', password: '' };

export function PlatformSupportAgentsPanel() {
  const queryClient = useQueryClient();
  const agentsQuery = useTenantQuery<SupportAgent[]>(['platform-support-agents'], (signal) => supportConversationsService.listAgents(signal));
  const scopesQuery = useTenantQuery<ScopeOptions>(['platform-support-agent-scope-options'], (signal) => supportConversationsService.getScopeOptions(signal));
  const agents = asList(agentsQuery.data) as SupportAgent[];
  const groups = scopesQuery.data?.groups || [];
  const [editing, setEditing] = useState<SupportAgent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [scopes, setScopes] = useState<SupportScope[]>([]);
  const [saving, setSaving] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['platform-support-agents'] });
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setScopes([]);
    setDialogOpen(true);
  };

  const openEdit = (agent: SupportAgent) => {
    setEditing(agent);
    setForm({ name: agent.name, email: agent.email, password: '' });
    setScopes(agent.scopes.map(({ type, id }) => ({ type, id })));
    setDialogOpen(true);
  };

  const toggleScope = (scope: SupportScope) => setScopes((current) => current.some((item) => item.type === scope.type && item.id === scope.id)
    ? current.filter((item) => item.type !== scope.type || item.id !== scope.id)
    : [...current, scope]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || (!editing && !form.password)) return;
    setSaving(true);
    try {
      if (editing) {
        await supportConversationsService.updateAgent(editing.id, { name: form.name.trim(), email: form.email.trim(), ...(form.password ? { password: form.password } : {}) });
        await supportConversationsService.replaceScopes(editing.id, scopes);
        toast.success('Cuenta de soporte actualizada');
      } else {
        await supportConversationsService.createAgent({ name: form.name.trim(), email: form.email.trim(), password: form.password, scopes });
        toast.success('Cuenta de soporte creada');
      }
      setDialogOpen(false);
      await refresh();
    } catch (error: any) { toast.error(error?.response?.data?.message || 'No pudimos guardar la cuenta de soporte'); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (agent: SupportAgent) => {
    setPendingStatusId(agent.id);
    try {
      await supportConversationsService.updateStatus(agent.id, !agent.isActive);
      toast.success(agent.isActive ? 'Cuenta desactivada' : 'Cuenta activada');
      await refresh();
    } catch (error: any) { toast.error(error?.response?.data?.message || 'No pudimos cambiar el estado de la cuenta'); }
    finally { setPendingStatusId(null); }
  };

  return <section className="space-y-5">
    <Card className="rounded-3xl border-primary/20 bg-primary/[0.03] shadow-sm"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="flex min-w-0 items-start gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="size-5" /></div><div><h2 className="text-base font-black uppercase">Agentes externos de soporte</h2><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Estas cuentas solo entran a la bandeja de soporte. Asigna grupos, rubros o sucursales para controlar dónde pueden iniciar y continuar conversaciones.</p></div></div><Button onClick={openCreate} className="shrink-0 rounded-xl"><Plus className="mr-2 size-4" /> Crear cuenta</Button></CardContent></Card>

    {agentsQuery.isLoading || scopesQuery.isLoading ? <div className="flex justify-center rounded-2xl border border-border bg-card p-12"><Loader2 className="size-5 animate-spin text-primary" /></div>
      : agentsQuery.isError || scopesQuery.isError ? <Card className="rounded-2xl"><CardContent className="p-8 text-center text-sm text-destructive">No pudimos cargar las cuentas o los alcances disponibles.</CardContent></Card>
        : agents.length === 0 ? <Card className="rounded-2xl border-dashed"><CardContent className="p-10 text-center"><Users className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-bold">Aún no hay agentes</p><p className="mt-1 text-sm text-muted-foreground">Crea una cuenta externa y define sus sucursales autorizadas.</p></CardContent></Card>
          : <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">{agents.map((agent) => <Card key={agent.id} className="min-w-0 rounded-2xl border-border/70 shadow-sm"><CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 p-5 pb-3"><div className="flex min-w-0 items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-4" /></div><div className="min-w-0"><CardTitle className="break-words text-base font-black">{agent.name}</CardTitle><p className="break-all text-sm text-muted-foreground">{agent.email}</p></div></div><Badge variant={agent.isActive ? 'default' : 'secondary'} className="shrink-0">{agent.isActive ? 'Activa' : 'Inactiva'}</Badge></CardHeader><CardContent className="space-y-4 px-5 pb-5 pt-2"><div className="flex flex-wrap gap-2">{agent.scopes.length ? agent.scopes.map((scope) => <Badge key={`${scope.type}:${scope.id}`} variant="outline" className="max-w-full gap-1.5 whitespace-normal break-words text-left"><ScopeIcon type={scope.type} />{scope.type === 'GROUP' ? 'Grupo' : scope.type === 'BUSINESS_UNIT' ? 'Rubro' : 'Sucursal'} · {scope.name}</Badge>) : <span className="text-xs text-amber-600">Sin alcances asignados; no puede operar.</span>}</div><div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-3"><Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => openEdit(agent)}>Editar y alcances</Button><Button type="button" variant={agent.isActive ? 'ghost' : 'outline'} size="sm" className="rounded-lg" onClick={() => void toggleStatus(agent)} disabled={pendingStatusId === agent.id}>{pendingStatusId === agent.id && <Loader2 className="mr-2 size-3.5 animate-spin" />}{agent.isActive ? 'Desactivar' : 'Activar'}</Button></div></CardContent></Card>)}</div>}

    <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}><DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto rounded-2xl p-4 sm:p-6"><DialogHeader><DialogTitle className="text-xl font-black">{editing ? 'Editar agente de soporte' : 'Crear agente de soporte'}</DialogTitle><DialogDescription>La cuenta no tendrá acceso a los módulos ERP ni a la administración de plataforma.</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-5"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="text-xs font-bold">Nombre<Input className="mt-1.5 rounded-xl" value={form.name} maxLength={160} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} /></label><label className="text-xs font-bold">Correo<Input className="mt-1.5 rounded-xl" type="email" value={form.email} maxLength={254} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} /></label><label className="text-xs font-bold sm:col-span-2">{editing ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}<Input className="mt-1.5 rounded-xl" type="password" autoComplete="new-password" value={form.password} maxLength={200} onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))} /></label></div><div className="rounded-2xl border border-border/70 bg-muted/20 p-3 sm:p-4"><div className="mb-3"><h3 className="text-sm font-black">Alcances asignados</h3><p className="text-xs text-muted-foreground">Puedes combinar alcances; en un envío las sucursales superpuestas se deduplican.</p></div><div className="max-h-64 space-y-3 overflow-y-auto pr-1">{groups.map((group) => <div key={group.id} className="space-y-1"><ScopeOption scope={{ type: 'GROUP', id: group.id }} label={group.name} checked={containsScope(scopes, 'GROUP', group.id)} onChange={toggleScope} /><div className="ml-4 space-y-1 border-l border-border/70 pl-3 sm:ml-6 sm:pl-4">{group.businessUnits.map((unit) => <div key={unit.id}><ScopeOption scope={{ type: 'BUSINESS_UNIT', id: unit.id }} label={unit.name} detail={`Rubro · ${group.name}`} checked={containsScope(scopes, 'BUSINESS_UNIT', unit.id)} onChange={toggleScope} /><div className="ml-4 space-y-1 border-l border-border/60 pl-3">{group.branches.filter((branch) => branch.businessUnitId === unit.id).map((branch) => <ScopeOption key={branch.id} scope={{ type: 'BRANCH', id: branch.id }} label={branch.name} detail="Sucursal" checked={containsScope(scopes, 'BRANCH', branch.id)} onChange={toggleScope} />)}</div></div>)}{group.branches.filter((branch) => !group.businessUnits.some((unit) => unit.id === branch.businessUnitId)).map((branch) => <ScopeOption key={branch.id} scope={{ type: 'BRANCH', id: branch.id }} label={branch.name} detail="Sucursal" checked={containsScope(scopes, 'BRANCH', branch.id)} onChange={toggleScope} />)}</div></div>)}{groups.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No hay grupos, rubros o sucursales activas.</p>}</div></div><DialogFooter className="gap-2 sm:gap-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button><Button type="submit" disabled={saving || !form.name.trim() || !form.email.trim() || (!editing && !form.password)}>{saving && <Loader2 className="mr-2 size-4 animate-spin" />}{editing ? 'Guardar cambios' : 'Crear cuenta'}</Button></DialogFooter></form></DialogContent></Dialog>
  </section>;
}

function ScopeOption({ scope, label, detail, checked, onChange }: { scope: SupportScope; label: string; detail?: string; checked: boolean; onChange: (scope: SupportScope) => void }) {
  return <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-background/70"><input type="checkbox" checked={checked} onChange={() => onChange(scope)} className="mt-0.5 size-4 shrink-0 accent-primary" /><span className="min-w-0"><span className="block break-words text-sm font-semibold">{label}</span>{detail && <span className="block text-[11px] text-muted-foreground">{detail}</span>}</span></label>;
}

function ScopeIcon({ type }: { type: SupportScopeType }) { return type === 'GROUP' ? <Building2 className="size-3.5 shrink-0" /> : type === 'BUSINESS_UNIT' ? <Users className="size-3.5 shrink-0" /> : <UserRound className="size-3.5 shrink-0" />; }
function containsScope(scopes: SupportScope[], type: SupportScopeType, id: string) { return scopes.some((scope) => scope.type === type && scope.id === id); }
