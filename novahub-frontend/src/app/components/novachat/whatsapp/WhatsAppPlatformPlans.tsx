import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { toast } from '@/app/services/toast';
import { api, getApiErrorMessage } from '../../../services/api';
import { useTenantQuery } from '../../../hooks/useTenantQuery';

interface PlanRow { id: string; name: string; plan: { planName: string; maxLines: number; isActive: boolean } | null; linesUsed: number }
interface PlansResponse { plans: Array<{ code: string; name: string; maxLines: number; priceUsd: number }>; tenants: PlanRow[] }

const base = '/novachat/wa/admin';

/** Solo personal de NovaHub: activa el servicio de WhatsApp multilínea y elige el plan de cada empresa. */
export function WhatsAppPlatformPlans() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const data = useTenantQuery<PlansResponse>(['wa', 'platform-plans', q], (signal) => api.get<PlansResponse>(`${base}/plans`, { params: q ? { q } : {}, signal }), { staleTime: 10_000 });

  const change = async (row: PlanRow, value: string) => {
    setSaving(row.id);
    try {
      if (value === 'none') await api.put(`${base}/plan/${encodeURIComponent(row.id)}`, { plan: row.plan?.planName?.toUpperCase() || 'STARTER', isActive: false });
      else await api.put(`${base}/plan/${encodeURIComponent(row.id)}`, { plan: value, isActive: true });
      toast.success(value === 'none' ? `WhatsApp desactivado para ${row.name}.` : `Plan actualizado para ${row.name}.`);
      await qc.invalidateQueries({ queryKey: ['tenant-module'] });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cambiar el plan.'));
    } finally {
      setSaving(null);
    }
  };

  const plans = data.data?.plans || [];
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div><p className="text-base font-black">Planes de WhatsApp multilínea</p><p className="text-xs text-muted-foreground">Activa el servicio por empresa y elige cuántos números puede conectar. Sin plan activo, la empresa no ve esta función.</p></div>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar empresa" aria-label="Buscar empresa" className="h-9 w-full rounded-xl border border-border/60 bg-background pl-8 pr-3 text-xs outline-none focus:border-primary" />
        </div>
        {data.isLoading && <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {data.isError && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">No se pudieron cargar las empresas.</p>}
        {data.data && (
          <div className="overflow-x-auto rounded-2xl border border-border/50 bg-card">
            <table className="w-full min-w-[520px] text-xs">
              <thead><tr className="border-b border-border/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground"><th className="px-4 py-3">Empresa</th><th className="px-3 py-3">Plan</th><th className="px-4 py-3 text-right">Números en uso</th></tr></thead>
              <tbody>
                {data.data.tenants.map((row) => {
                  const active = row.plan?.isActive ? plans.find((p) => p.name === row.plan?.planName)?.code || 'CUSTOM' : 'none';
                  return (
                    <tr key={row.id} className="border-b border-border/20 last:border-0">
                      <td className="px-4 py-3 font-bold">{row.name}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Select value={active} onValueChange={(v) => void change(row, v)} disabled={saving === row.id}>
                            <SelectTrigger className="h-8 w-56 rounded-lg text-xs" aria-label={`Plan de ${row.name}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin plan (desactivado)</SelectItem>
                              {plans.map((p) => <SelectItem key={p.code} value={p.code}>{p.name} · hasta {p.maxLines} números · ${p.priceUsd}/mes</SelectItem>)}
                              {row.plan?.isActive && active === 'CUSTOM' && <SelectItem value="CUSTOM">{row.plan.planName} · {row.plan.maxLines} números</SelectItem>}
                            </SelectContent>
                          </Select>
                          {saving === row.id && <Loader2 className="size-3.5 animate-spin" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.linesUsed}{row.plan?.isActive ? ` / ${row.plan.maxLines}` : ''}</td>
                    </tr>
                  );
                })}
                {data.data.tenants.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No se encontraron empresas.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
