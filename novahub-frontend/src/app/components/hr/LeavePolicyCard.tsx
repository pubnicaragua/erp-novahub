import { useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Switch } from '../ui/switch';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { toast } from '../../services/toast';
import { employeeProfileService, type LeavePolicy } from '../../services/employee-profile.service';

function PolicyForm({ policy }: { policy: LeavePolicy }) {
  const client = useQueryClient();
  const { canPerform } = useAuth();
  const canEdit = canPerform('HR_LEAVES', 'edit');
  const [minNotice, setMinNotice] = useState(String(policy.minNoticeHours));
  const [policyNotice, setPolicyNotice] = useState(String(policy.policyNoticeHours));
  const [allowExtra, setAllowExtra] = useState(policy.allowExtraordinary);
  const [busy, setBusy] = useState(false);
  const changed = Number(minNotice) !== policy.minNoticeHours || Number(policyNotice) !== policy.policyNoticeHours || allowExtra !== policy.allowExtraordinary;
  const valid = [minNotice, policyNotice].every((value) => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 720);
  const save = async () => {
    setBusy(true);
    try {
      await employeeProfileService.saveLeavePolicy({ minNoticeHours: Number(minNotice), policyNoticeHours: Number(policyNotice), allowExtraordinary: allowExtra });
      toast.success('Política de vacaciones guardada');
      void client.invalidateQueries({ queryKey: ['tenant-module'] });
    } catch (error) { toast.error((error as any)?.response?.data?.message?.toString?.() || 'No se pudo guardar.'); } finally { setBusy(false); }
  };
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5"><Label htmlFor="lp-min">Aviso mínimo (horas)</Label><Input id="lp-min" type="number" min="0" max="720" value={minNotice} disabled={!canEdit} onChange={(e) => setMinNotice(e.target.value)} /><p className="text-[11px] text-muted-foreground">Con menos horas la solicitud es extraordinaria.</p></div>
        <div className="space-y-1.5"><Label htmlFor="lp-policy">Aviso del reglamento (horas)</Label><Input id="lp-policy" type="number" min="0" max="720" value={policyNotice} disabled={!canEdit} onChange={(e) => setPolicyNotice(e.target.value)} /><p className="text-[11px] text-muted-foreground">Solo informativo: se le muestra al empleado.</p></div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 p-3 text-sm"><Switch checked={allowExtra} disabled={!canEdit} onCheckedChange={setAllowExtra} /><span><span className="font-semibold">Permitir solicitudes extraordinarias</span><span className="block text-[11px] text-muted-foreground">Si se apaga, no se puede pedir con menos aviso del mínimo. Si está encendido, piden el motivo y quien aprueba decide.</span></span></label>
      </div>
      {canEdit && <div className="flex justify-end"><Button type="button" onClick={() => void save()} disabled={busy || !changed || !valid}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Guardar</Button></div>}
    </>
  );
}

/** Reglas para que el empleado pida vacaciones desde el ERP. */
export function LeavePolicyCard() {
  const query = useTenantQuery(['hr', 'leave-policy'], (signal) => employeeProfileService.getLeavePolicy(signal), { staleTime: 60_000 });
  return (
    <Card className="mb-4 space-y-4 rounded-2xl border-border/60 bg-card/80 p-4 shadow-sm sm:p-5" data-testid="hr-leave-policy">
      <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest"><CalendarClock className="size-4 text-primary" aria-hidden /> Vacaciones pedidas desde el ERP</h3>
      {query.isLoading ? <Skeleton className="h-24 w-full" aria-busy="true" />
        : query.isError || !query.data ? <p className="text-sm text-destructive" role="alert">No se pudo cargar la política.</p>
        : <PolicyForm key={`${query.data.minNoticeHours}-${query.data.policyNoticeHours}-${query.data.allowExtraordinary}`} policy={query.data} />}
    </Card>
  );
}
