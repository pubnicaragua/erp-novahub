import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { organizacionService, type SupervisionScope } from '../../services/organizacion.service';
import { toast } from '../../services/toast';
import { EmptyState, ErrorState, Field, NativeSelect, Panel } from './OrgBits';
import { errorMessage } from './organizacion.utils';
import { EquipoResumenes } from './EquipoResumenes';

const SCOPE_LABEL: Record<SupervisionScope, string> = { ALL: 'Todo el equipo', USER: 'Una persona', DEPARTMENT: 'Un departamento', ROLE: 'Un rol' };

/** Administración: quién supervisa a quién. Los jefes de departamento del organigrama se suman automáticamente. */
export function EquipoReglas() {
  const client = useQueryClient();
  const rules = useTenantQuery(['organizacion', 'team-rules'], (s) => organizacionService.getSupervisionRules(s), { staleTime: 15_000 });
  const targets = useTenantQuery(['organizacion', 'team-targets'], (s) => organizacionService.getRuleTargets(s), { staleTime: 60_000 });
  const users = useTenantQuery(['organizacion', 'users'], (s) => organizacionService.getUsers(s), { staleTime: 5 * 60_000 });
  const [supervisor, setSupervisor] = useState('');
  const [scope, setScope] = useState<SupervisionScope>('DEPARTMENT');
  const [value, setValue] = useState('');
  const [subs, setSubs] = useState(true);
  const [busy, setBusy] = useState(false);

  const options = scope === 'USER' ? (users.data ?? []).filter((u) => u.id !== supervisor).map((u) => ({ id: u.id, name: u.name }))
    : scope === 'DEPARTMENT' ? targets.data?.departments ?? [] : scope === 'ROLE' ? targets.data?.roles ?? [] : [];
  const refresh = () => { void client.invalidateQueries({ queryKey: ['tenant-module'] }); };

  const add = async () => {
    if (!supervisor) return toast.error('Selecciona quién supervisará');
    if (scope !== 'ALL' && !value) return toast.error('Selecciona a quién se supervisa');
    setBusy(true);
    try {
      await organizacionService.createSupervisionRule({ supervisorUserId: supervisor, scopeType: scope, scopeValue: scope === 'ALL' ? undefined : value, includeSubDepartments: subs });
      toast.success('Supervisión conectada'); setValue(''); refresh();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    try { await organizacionService.deleteSupervisionRule(id); toast.success('Supervisión eliminada'); refresh(); }
    catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <div className="min-w-0 lg:col-span-2"><EquipoResumenes /></div>
      <Panel title="Conectar calendarios" icon={<Plus className="size-4" />}>
        <div className="space-y-3" data-tour="team-rule-form">
          <Field label="Supervisor" htmlFor="sup-user" required>
            <NativeSelect id="sup-user" value={supervisor} onChange={(e) => { setSupervisor(e.target.value); setValue(''); }}>
              <option value="">Selecciona una persona</option>
              {(users.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Puede ver a" htmlFor="sup-scope" required>
            <NativeSelect id="sup-scope" value={scope} onChange={(e) => { setScope(e.target.value as SupervisionScope); setValue(''); }}>
              {(Object.keys(SCOPE_LABEL) as SupervisionScope[]).map((s) => <option key={s} value={s}>{SCOPE_LABEL[s]}</option>)}
            </NativeSelect>
          </Field>
          {scope !== 'ALL' && (
            <Field label={scope === 'USER' ? 'Persona' : scope === 'DEPARTMENT' ? 'Departamento' : 'Rol'} htmlFor="sup-value" required>
              <NativeSelect id="sup-value" value={value} onChange={(e) => setValue(e.target.value)}>
                <option value="">Selecciona…</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </NativeSelect>
            </Field>
          )}
          {scope === 'DEPARTMENT' && (
            <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" className="size-4 accent-[#01422C]" checked={subs} onChange={(e) => setSubs(e.target.checked)} />Incluir subdepartamentos</label>
          )}
          <Button type="button" className="w-full" disabled={busy} onClick={() => void add()}>{busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Conectar</Button>
          <p className="text-[11px] text-muted-foreground">Además de estas reglas, los jefes de departamento y quienes tienen personal a cargo en el organigrama de Recursos Humanos ven automáticamente a su gente. Todo acceso queda registrado en auditoría.</p>
        </div>
      </Panel>

      <Panel title="Supervisiones activas">
        {rules.isLoading ? <Skeleton className="h-32 w-full" aria-busy="true" />
          : rules.isError ? <ErrorState message={errorMessage(rules.error)} onRetry={() => void rules.refetch()} />
          : (rules.data?.length ?? 0) === 0 ? <EmptyState title="Sin reglas" description="Aún no hay supervisores configurados manualmente." />
          : (
            <ul className="divide-y divide-border">
              {rules.data!.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-[13px] font-semibold">{r.supervisor.name}</p>
                    <p className="break-words text-[11px] text-muted-foreground">ve a: {SCOPE_LABEL[r.scopeType]}{r.scopeType === 'ALL' ? '' : ` · ${r.scopeLabel}`}{r.scopeType === 'DEPARTMENT' && r.includeSubDepartments ? ' (con subdepartamentos)' : ''}</p>
                  </div>
                  <Button type="button" size="icon" variant="outline" className="text-destructive" onClick={() => void remove(r.id)} aria-label={`Quitar supervisión de ${r.supervisor.name}`}><Trash2 className="size-4" /></Button>
                </li>
              ))}
            </ul>
          )}
      </Panel>
    </div>
  );
}
