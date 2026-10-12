import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Eye, EyeOff, Loader2, Plus, Search, ShieldCheck, UserRound, Users, X } from 'lucide-react';
import { supportConversationsService, type SupportAgent, type SupportScope, type SupportScopeType } from '../../services/support-conversations.service';
import { useTenantQuery, asList } from '../../hooks/useTenantQuery';
import { toast } from '@/app/services/toast';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import {
  filterSupportScopeTree,
  isSupportScopeChecked,
  isSupportScopeInherited,
  normalizeSupportScopes,
  toggleSupportScope,
  type SupportScopeTreeGroup,
} from './support-scope-selection';

interface ScopeOptions {
  groups: SupportScopeTreeGroup[];
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
  const [scopeSearch, setScopeSearch] = useState('');
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['platform-support-agents'] });
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setScopes([]);
    setScopeSearch('');
    setShowOnlySelected(false);
    setDialogOpen(true);
  };

  const openEdit = (agent: SupportAgent) => {
    setEditing(agent);
    setForm({ name: agent.name, email: agent.email, password: '' });
    setScopes(normalizeSupportScopes(agent.scopes.map(({ type, id }) => ({ type, id })), groups));
    setScopeSearch('');
    setShowOnlySelected(false);
    setDialogOpen(true);
  };

  const toggleScope = (scope: SupportScope) => setScopes((current) => toggleSupportScope(current, scope, groups));
  const visibleGroups = filterSupportScopeTree(groups, scopeSearch, { scopes, onlySelected: showOnlySelected });
  const selectedScopeDetails = scopes.map((scope) => ({ scope, ...getScopeDisplay(scope, groups) }));

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
    } catch (error) { toast.error(getErrorMessage(error, 'No pudimos guardar la cuenta de soporte')); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (agent: SupportAgent) => {
    setPendingStatusId(agent.id);
    try {
      await supportConversationsService.updateStatus(agent.id, !agent.isActive);
      toast.success(agent.isActive ? 'Cuenta desactivada' : 'Cuenta activada');
      await refresh();
    } catch (error) { toast.error(getErrorMessage(error, 'No pudimos cambiar el estado de la cuenta')); }
    finally { setPendingStatusId(null); }
  };

  return <section className="space-y-5">
    <Card className="rounded-3xl border-primary/20 bg-primary/[0.03] shadow-sm"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="flex min-w-0 items-start gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="size-5" /></div><div><h2 className="text-base font-black uppercase">Agentes externos de soporte</h2><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Estas cuentas solo entran a la bandeja de soporte. Asigna grupos, rubros o sucursales para controlar dónde pueden iniciar y continuar conversaciones.</p></div></div><Button onClick={openCreate} className="shrink-0 rounded-xl"><Plus className="mr-2 size-4" /> Crear cuenta</Button></CardContent></Card>

    {agentsQuery.isLoading || scopesQuery.isLoading ? <div className="flex justify-center rounded-2xl border border-border bg-card p-12"><Loader2 className="size-5 animate-spin text-primary" /></div>
      : agentsQuery.isError || scopesQuery.isError ? <Card className="rounded-2xl"><CardContent className="p-8 text-center text-sm text-destructive">No pudimos cargar las cuentas o los alcances disponibles.</CardContent></Card>
        : agents.length === 0 ? <Card className="rounded-2xl border-dashed"><CardContent className="p-10 text-center"><Users className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-bold">Aún no hay agentes</p><p className="mt-1 text-sm text-muted-foreground">Crea una cuenta externa y define sus sucursales autorizadas.</p></CardContent></Card>
          : <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">{agents.map((agent) => <Card key={agent.id} className="min-w-0 rounded-2xl border-border/70 shadow-sm"><CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 p-5 pb-3"><div className="flex min-w-0 items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-4" /></div><div className="min-w-0"><CardTitle className="break-words text-base font-black">{agent.name}</CardTitle><p className="break-all text-sm text-muted-foreground">{agent.email}</p></div></div><Badge variant={agent.isActive ? 'default' : 'secondary'} className="shrink-0">{agent.isActive ? 'Activa' : 'Inactiva'}</Badge></CardHeader><CardContent className="space-y-4 px-5 pb-5 pt-2"><div className="flex flex-wrap gap-2">{agent.scopes.length ? agent.scopes.map((scope) => <Badge key={`${scope.type}:${scope.id}`} variant="outline" className="max-w-full gap-1.5 whitespace-normal break-words text-left"><ScopeIcon type={scope.type} />{scope.type === 'GROUP' ? 'Grupo' : scope.type === 'BUSINESS_UNIT' ? 'Rubro' : 'Sucursal'} · {scope.name}</Badge>) : <span className="text-xs text-amber-600">Sin alcances asignados; no puede operar.</span>}</div><div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-3"><Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => openEdit(agent)}>Editar y alcances</Button><Button type="button" variant={agent.isActive ? 'ghost' : 'outline'} size="sm" className="rounded-lg" onClick={() => void toggleStatus(agent)} disabled={pendingStatusId === agent.id}>{pendingStatusId === agent.id && <Loader2 className="mr-2 size-3.5 animate-spin" />}{agent.isActive ? 'Desactivar' : 'Activar'}</Button></div></CardContent></Card>)}</div>}

    <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
      <DialogContent className="!flex !h-[min(95vh,calc(100dvh-1rem))] !max-h-[min(95vh,calc(100dvh-1rem))] !w-[calc(100vw-1rem)] !max-w-[1100px] flex-col overflow-hidden rounded-2xl p-4 sm:!h-[min(90vh,calc(100dvh-1rem))] sm:!max-h-[min(90vh,calc(100dvh-1rem))] sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-xl font-black">{editing ? 'Editar agente de soporte' : 'Crear agente de soporte'}</DialogTitle>
          <DialogDescription>La cuenta no tendrá acceso a los módulos ERP ni a la administración de plataforma.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-xs font-bold">Nombre<Input className="mt-1.5 rounded-xl" value={form.name} maxLength={160} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} /></label>
              <label className="text-xs font-bold">Correo<Input className="mt-1.5 rounded-xl" type="email" value={form.email} maxLength={254} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} /></label>
              <label className="text-xs font-bold sm:col-span-2">{editing ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}<Input className="mt-1.5 rounded-xl" type="password" autoComplete="new-password" value={form.password} maxLength={200} onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))} /></label>
            </div>

            <section aria-labelledby="support-agent-scopes-heading" className="rounded-2xl border border-border/70 bg-muted/20 p-3 sm:p-4">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 id="support-agent-scopes-heading" className="text-sm font-black">Alcances seleccionados</h3>
                  <p className="text-xs text-muted-foreground">Rubros y grupos también cubren sus sucursales futuras.</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground" aria-live="polite">{scopes.length} {scopes.length === 1 ? 'alcance' : 'alcances'}</span>
              </div>

              <div className={`mb-3 ${selectedScopeDetails.length ? 'max-h-28 min-h-12 overflow-y-auto rounded-xl border border-border/60 bg-background/50 p-2' : ''}`} role="list" aria-label="Alcances seleccionados">
                {selectedScopeDetails.length ? <div className="flex flex-wrap gap-2">{selectedScopeDetails.map(({ scope, label, detail }) => <div key={`${scope.type}:${scope.id}`} role="listitem" className="flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-primary/20 bg-primary/[0.06] px-2.5 py-1.5 text-xs"><ScopeIcon type={scope.type} /><span className="min-w-0"><span className="block break-words font-semibold">{label}</span><span className="block break-words text-[10px] text-muted-foreground">{detail}</span></span><Button type="button" variant="ghost" size="icon" className="size-7 shrink-0 rounded-lg" aria-label={`Quitar alcance ${label}`} title={`Quitar ${label}`} onClick={() => toggleScope(scope)}><X className="size-3.5" /></Button></div>)}</div>
                  : <p className="px-1 py-1 text-xs text-muted-foreground">Sin alcances seleccionados.</p>}
              </div>

              <div className="mb-3 flex flex-row items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input id="support-scope-search" type="search" value={scopeSearch} onChange={(event) => setScopeSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && event.preventDefault()} placeholder="Buscar por nombre..." aria-label="Buscar grupos, rubros o sucursales" className="rounded-xl pl-9 pr-10" />
                  {scopeSearch && <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 size-8 -translate-y-1/2 rounded-lg" aria-label="Limpiar búsqueda de alcances" onClick={() => setScopeSearch('')}><X className="size-4" /></Button>}
                </div>
                <Button type="button" variant={showOnlySelected ? 'default' : 'outline'} aria-label={showOnlySelected ? 'Ver árbol completo' : 'Mostrar solo seleccionados'} aria-pressed={showOnlySelected} title={showOnlySelected ? 'Ver árbol completo' : 'Mostrar solo seleccionados'} disabled={scopes.length === 0} className="size-10 shrink-0 rounded-xl p-0 sm:h-10 sm:w-auto sm:px-4" onClick={() => setShowOnlySelected((value) => !value)}>
                  {showOnlySelected ? <EyeOff className="size-4 sm:mr-2" /> : <Eye className="size-4 sm:mr-2" />}<span className="sr-only sm:not-sr-only">{showOnlySelected ? 'Ver árbol completo' : 'Mostrar solo seleccionados'}</span>
                </Button>
              </div>

              <div className="max-h-[min(30vh,280px)] min-h-[160px] space-y-3 overflow-y-auto overscroll-contain rounded-xl border border-border/60 bg-background/40 p-2 pr-1 sm:p-3" aria-label="Árbol de alcances">
                {visibleGroups.map((group) => <div key={group.id} className="space-y-1">
                  <ScopeOption scope={{ type: 'GROUP', id: group.id }} label={group.name} detail="Grupo empresarial · incluye rubros y sucursales actuales y futuras" checked={isSupportScopeChecked(scopes, { type: 'GROUP', id: group.id }, groups)} inherited={isSupportScopeInherited(scopes, { type: 'GROUP', id: group.id }, groups)} onChange={toggleScope} />
                  <div className="ml-3 space-y-1 border-l border-border/70 pl-2 sm:ml-6 sm:pl-4">
                    {group.businessUnits.map((unit) => <div key={unit.id}>
                      <ScopeOption scope={{ type: 'BUSINESS_UNIT', id: unit.id }} label={unit.name} detail={`Rubro · ${group.name} · incluye sus sucursales actuales y futuras`} checked={isSupportScopeChecked(scopes, { type: 'BUSINESS_UNIT', id: unit.id }, groups)} inherited={isSupportScopeInherited(scopes, { type: 'BUSINESS_UNIT', id: unit.id }, groups)} onChange={toggleScope} />
                      <div className="ml-3 space-y-1 border-l border-border/60 pl-2 sm:ml-5 sm:pl-3">
                        {group.branches.filter((branch) => branch.businessUnitId === unit.id).map((branch) => <ScopeOption key={branch.id} scope={{ type: 'BRANCH', id: branch.id }} label={branch.name} detail="Sucursal" checked={isSupportScopeChecked(scopes, { type: 'BRANCH', id: branch.id }, groups)} inherited={isSupportScopeInherited(scopes, { type: 'BRANCH', id: branch.id }, groups)} onChange={toggleScope} />)}
                      </div>
                    </div>)}
                    {group.branches.filter((branch) => !group.businessUnits.some((unit) => unit.id === branch.businessUnitId)).map((branch) => <ScopeOption key={branch.id} scope={{ type: 'BRANCH', id: branch.id }} label={branch.name} detail="Sucursal sin rubro" checked={isSupportScopeChecked(scopes, { type: 'BRANCH', id: branch.id }, groups)} inherited={isSupportScopeInherited(scopes, { type: 'BRANCH', id: branch.id }, groups)} onChange={toggleScope} />)}
                  </div>
                </div>)}
                {visibleGroups.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{showOnlySelected ? 'No hay alcances seleccionados que coincidan.' : scopeSearch ? 'No encontramos grupos, rubros o sucursales con ese nombre.' : 'No hay grupos, rubros o sucursales activas.'}</p>}
              </div>
            </section>
          </div>
          <DialogFooter className="!flex-row shrink-0 gap-2 border-t border-border/60 pt-3 sm:gap-2">
            <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" className="flex-1 sm:flex-none" disabled={saving || !form.name.trim() || !form.email.trim() || (!editing && !form.password)}>{saving && <Loader2 className="mr-2 size-4 animate-spin" />}{editing ? 'Guardar cambios' : 'Crear cuenta'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}

function ScopeOption({ scope, label, detail, checked, inherited, onChange }: { scope: SupportScope; label: string; detail?: string; checked: boolean; inherited: boolean; onChange: (scope: SupportScope) => void }) {
  return <label className={`flex items-start gap-2.5 rounded-lg px-2 py-2 ${inherited ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:bg-background/70'}`}><input type="checkbox" checked={checked} disabled={inherited} onChange={() => onChange(scope)} className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:[color-scheme:dark]" /><span className="min-w-0"><span className="block break-words text-sm font-semibold">{label}</span>{detail && <span className="block text-[11px] text-muted-foreground">{detail}{inherited ? ' · heredado' : ''}</span>}</span></label>;
}

function ScopeIcon({ type }: { type: SupportScopeType }) { return type === 'GROUP' ? <Building2 className="size-3.5 shrink-0" /> : type === 'BUSINESS_UNIT' ? <Users className="size-3.5 shrink-0" /> : <UserRound className="size-3.5 shrink-0" />; }

function getScopeDisplay(scope: SupportScope, groups: SupportScopeTreeGroup[]) {
  const group = groups.find((item) => item.id === scope.id && scope.type === 'GROUP')
    || groups.find((item) => item.businessUnits.some((unit) => unit.id === scope.id) && scope.type === 'BUSINESS_UNIT')
    || groups.find((item) => item.branches.some((branch) => branch.id === scope.id) && scope.type === 'BRANCH');
  if (!group) return { label: `${scope.type === 'GROUP' ? 'Grupo' : scope.type === 'BUSINESS_UNIT' ? 'Rubro' : 'Sucursal'} · ${scope.id}`, detail: 'Alcance no disponible en el árbol actual' };
  if (scope.type === 'GROUP') return { label: group.name, detail: 'Grupo empresarial' };
  if (scope.type === 'BUSINESS_UNIT') return { label: group.businessUnits.find((unit) => unit.id === scope.id)?.name || scope.id, detail: `Rubro · ${group.name}` };
  const branch = group.branches.find((item) => item.id === scope.id);
  const unitName = group.businessUnits.find((unit) => unit.id === branch?.businessUnitId)?.name;
  return { label: branch?.name || scope.id, detail: `Sucursal · ${group.name}${unitName ? ` · ${unitName}` : ''}` };
}

function getErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}
