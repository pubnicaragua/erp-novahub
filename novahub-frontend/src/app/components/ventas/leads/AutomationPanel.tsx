import { useState } from 'react';
import { Copy, KeyRound, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Skeleton } from '../../ui/skeleton';
import { cn } from '../../ui/utils';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { getApiUrl } from '../../../services/api';
import { toast } from '../../../services/toast';
import { businessLeadsService } from '../../../services/business-leads.service';
import { failure } from './leadUtils';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-NI', { dateStyle: 'medium', timeStyle: 'short' }) : 'Nunca');
const copy = async (text: string, done: string) => {
  try { await navigator.clipboard.writeText(text); toast.success(done); } catch { toast.error('El navegador no permitió copiar el texto. Selecciónalo y cópialo manualmente.'); }
};

/** Llaves para que la extensión de Chrome, Zapier, n8n o un formulario envíen leads: lo que llega queda «por revisar». */
export function AutomationPanel({ isAdmin }: { isAdmin: boolean }) {
  const client = useQueryClient();
  const keys = useTenantQuery(['sales', 'business-leads-keys'], (signal) => businessLeadsService.keys(signal), { staleTime: 15_000 });
  const [name, setName] = useState('');
  const [fresh, setFresh] = useState<{ name: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const endpoint = getApiUrl('/public/leads/ingest');
  const example = `curl -X POST "${endpoint}" \\\n  -H "x-api-key: TU_LLAVE" -H "Content-Type: application/json" \\\n  -d '{"leads":[{"company":"Clínica Vida","phone":"8888-1234","country":"Nicaragua","industry":"Clínica","signals":["NO_WEBSITE"],"sourceUrl":"https://..."}]}'`;

  const create = async () => {
    setBusy(true);
    try {
      const created = await businessLeadsService.createKey(name.trim());
      setFresh({ name: created.name, key: created.key });
      setName('');
      void client.invalidateQueries({ queryKey: ['tenant-module'] });
    } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  const revoke = async (id: string) => {
    try { await businessLeadsService.revokeKey(id); toast.success('Llave revocada'); void client.invalidateQueries({ queryKey: ['tenant-module'] }); } catch (error) { toast.error(failure(error)); }
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">Cada llave pertenece a una persona: los leads que lleguen con ella se le asignan. Todo entra a «Por revisar», nunca directo al embudo, y los repetidos (empresa, teléfono o sitio web) se descartan solos.</p>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border bg-muted/20 p-3">
        <label className="min-w-[220px] flex-1 space-y-1 text-xs font-semibold">Nombre de la llave<Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Mi extensión de Chrome, n8n, formulario web…" /></label>
        <Button type="button" onClick={() => void create()} disabled={busy || !name.trim()}><KeyRound className="mr-1.5 size-4" />Crear llave</Button>
      </div>

      {fresh && (
        <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950" role="status">
          <p className="text-sm font-bold">Llave «{fresh.name}» creada. Cópiala ahora: no se vuelve a mostrar.</p>
          <div className="flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-background px-2 py-1.5 text-xs">{fresh.key}</code><Button type="button" size="sm" variant="outline" onClick={() => void copy(fresh.key, 'Llave copiada')}><Copy className="mr-1 size-4" />Copiar</Button><Button type="button" size="sm" variant="ghost" onClick={() => setFresh(null)}>Ya la guardé</Button></div>
        </div>
      )}

      {keys.isLoading ? <Skeleton className="h-24 w-full rounded-2xl" aria-busy="true" />
        : (keys.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay llaves.</p>
        : (
          <div className="overflow-x-auto rounded-xl border border-border/60"><table className="w-full min-w-[560px] text-sm"><thead className="bg-muted/30 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground"><tr><th className="px-3 py-2">Nombre</th><th className="px-3 py-2">Empieza con</th>{isAdmin && <th className="px-3 py-2">Persona</th>}<th className="px-3 py-2">Último uso</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2" /></tr></thead>
            <tbody>{(keys.data ?? []).map((key) => (
              <tr key={key.id} className="border-t border-border/40">
                <td className="px-3 py-2 font-semibold">{key.name}</td><td className="px-3 py-2 font-mono text-xs">{key.prefix}…</td>{isAdmin && <td className="px-3 py-2">{key.userName ?? '—'}</td>}
                <td className="px-3 py-2 text-xs">{when(key.lastUsedAt)}</td>
                <td className="px-3 py-2"><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black uppercase', key.active ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-slate-700')}>{key.active ? 'Activa' : 'Revocada'}</span></td>
                <td className="px-3 py-2 text-right">{key.active && <Button type="button" variant="ghost" size="sm" aria-label={`Revocar ${key.name}`} onClick={() => void revoke(key.id)}><Trash2 className="size-4" /></Button>}</td>
              </tr>))}</tbody></table></div>
        )}

      <section className="space-y-2 rounded-xl border border-border/60 bg-card p-3" aria-label="Cómo conectarlo">
        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cómo conectarlo</h3>
        <p className="text-xs text-muted-foreground"><b>Extensión de Chrome:</b> pega esta dirección y tu llave en sus opciones. Zapier, n8n o un formulario: haz un envío POST a la misma dirección con la llave en el encabezado <code>x-api-key</code>. Hasta 100 leads por envío y 60 envíos por minuto.</p>
        <div className="flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-muted px-2 py-1.5 text-xs">{endpoint}</code><Button type="button" size="sm" variant="outline" onClick={() => void copy(endpoint, 'Dirección copiada')}><Copy className="mr-1 size-4" />Copiar</Button></div>
        <details className="text-xs"><summary className="cursor-pointer font-semibold">Ejemplo de envío</summary><pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-2 text-[11px]">{example}</pre></details>
      </section>
    </div>
  );
}
