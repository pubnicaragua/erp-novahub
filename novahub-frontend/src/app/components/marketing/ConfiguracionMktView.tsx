import { useState } from 'react';
import { MARKETING_GUIDES } from './guides';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { Switch } from '../ui/switch';
import { useAuth } from '../../contexts/AuthContext';
import { marketingApi, type MktConfig } from '../../services/marketing.service';
import { toast } from '../../services/toast';
import { ErrorState, Field, PageTitle, Panel } from '../organizacion/OrgBits';
import { errorMessage } from '../organizacion/organizacion.utils';
import { useMktConfig, useMktRefresh, useMktUsers } from './mkt.helpers';

export function ConfiguracionMktView() {
  const config = useMktConfig();
  if (config.isLoading) return <Skeleton className="h-96 w-full" aria-busy="true" />;
  if (config.isError || !config.data) return <ErrorState message={errorMessage(config.error)} onRetry={() => void config.refetch()} />;
  return <ConfigForm initial={config.data} />;
}

function ConfigForm({ initial }: { initial: MktConfig }) {
  const { canPerform } = useAuth();
  const refresh = useMktRefresh();
  const users = useMktUsers();
  const canEdit = canPerform('MARKETING_SETTINGS', 'edit');
  const [channels, setChannels] = useState(initial.channels.join(', '));
  const [approvers, setApprovers] = useState<string[]>(initial.approverUserIds);
  const [self, setSelf] = useState(initial.allowSelfApproval);
  const [currency, setCurrency] = useState(initial.currency);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true); setError('');
    try {
      await marketingApi.saveSettings({ channels: channels.split(',').map((c) => c.trim()).filter(Boolean), approverUserIds: approvers, allowSelfApproval: self, currency });
      toast.success('Configuración guardada');
      refresh();
    } catch (e) { setError(errorMessage(e)); } finally { setSaving(false); }
  };
  const toggle = (id: string) => setApprovers((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <PageTitle guide={MARKETING_GUIDES.configuracion} eyebrow="Marketing" title="Configuración" subtitle="Canales, aprobadores y parámetros del módulo. No reemplaza la configuración global del ERP."
        actions={canEdit ? <Button type="button" onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" aria-hidden="true" />}Guardar cambios</Button> : undefined} />
      {!canEdit && <p role="status" className="rounded-xl border border-border bg-muted/40 p-3 text-[12px] text-muted-foreground">Tu rol solo puede consultar esta configuración.</p>}
      {error && <ErrorState message={error} />}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Canales utilizados">
          <Field label="Canales (separados por coma)" htmlFor="cfg-ch" hint="Se usan en la parrilla de contenidos y en los resultados."><Input id="cfg-ch" disabled={!canEdit} value={channels} onChange={(e) => setChannels(e.target.value)} /></Field>
          <Field label="Moneda de reportes" htmlFor="cfg-cur" className="mt-3" hint="Código de 3 letras (NIO, USD…)."><Input id="cfg-cur" disabled={!canEdit} maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></Field>
        </Panel>
        <Panel title="Responsables de aprobación">
          <p className="mb-2 text-[12px] text-muted-foreground">Reciben las notificaciones de solicitudes. Si no eliges ninguno, se avisa a los administradores de la empresa. Resolver una solicitud sigue requiriendo el permiso «Aprobar» del rol.</p>
          <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border p-1.5">
            {(users.data ?? []).map((u) => (
              <li key={u.id}><label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-muted/50"><input type="checkbox" className="size-4 accent-[#01422C]" disabled={!canEdit} checked={approvers.includes(u.id)} onChange={() => toggle(u.id)} />{u.name}<span className="text-[11px] text-muted-foreground">{u.email}</span></label></li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
            <label htmlFor="cfg-self" className="text-[13px]">Permitir que el solicitante apruebe su propia solicitud</label>
            <Switch id="cfg-self" disabled={!canEdit} checked={self} onCheckedChange={setSelf} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
