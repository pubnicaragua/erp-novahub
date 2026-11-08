import { useState } from 'react';
import { Gift, Loader2, Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Skeleton } from '../../ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { toast } from '../../../services/toast';
import { BONUS_FREQUENCY_LABEL, BONUS_TYPE_LABEL, WEEKDAY_LABEL, employeeProfileService, type BonusFrequency, type BonusPlan } from '../../../services/employee-profile.service';

const select = 'h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary';
const failure = (error: unknown) => (error as any)?.response?.data?.message?.toString?.() || (error as Error)?.message || 'No se pudo guardar.';

function describe(plan: BonusPlan) {
  if (plan.frequency === 'WEEKLY') return `Todos los ${WEEKDAY_LABEL[plan.weekday ?? 6]}`;
  if (plan.frequency === 'BIWEEKLY') return `Cada dos ${WEEKDAY_LABEL[plan.weekday ?? 6]}`;
  if (plan.frequency === 'MONTHLY') return plan.dayOfMonth ? `El día ${plan.dayOfMonth} de cada mes` : 'Al final de cada mes';
  return `El ${new Date(plan.startDate).toLocaleDateString('es-NI', { dateStyle: 'medium', timeZone: 'UTC' })}`;
}

function BonusDialog({ employeeId, currency, onClose, onSaved }: { employeeId: string; currency: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [bonusType, setBonusType] = useState('PRODUCTIVITY');
  const [amount, setAmount] = useState('');
  const [cur, setCur] = useState(currency);
  const [frequency, setFrequency] = useState<BonusFrequency>('MONTHLY');
  const [weekday, setWeekday] = useState('6');
  const [dayOfMonth, setDayOfMonth] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [minScore, setMinScore] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await employeeProfileService.createBonusPlan(employeeId, {
        name: name.trim(), bonusType, amount: Number(amount), currency: cur, frequency, startDate,
        weekday: frequency === 'WEEKLY' || frequency === 'BIWEEKLY' ? Number(weekday) : null,
        dayOfMonth: frequency === 'MONTHLY' && dayOfMonth ? Number(dayOfMonth) : null,
        endDate: endDate || null, notes: notes.trim() || undefined, minScore: minScore === '' ? null : Number(minScore),
      });
      toast.success('Bono guardado');
      onSaved();
    } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nuevo bono para este empleado</DialogTitle><DialogDescription>La nómina del empleado suma automáticamente los bonos que caen dentro de cada período.</DialogDescription></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="bn-name">Nombre del bono</Label><Input id="bn-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Bono de producción de los sábados" /></div>
          <div className="space-y-1.5"><Label htmlFor="bn-type">Tipo</Label><select id="bn-type" className={select} value={bonusType} onChange={(e) => setBonusType(e.target.value)}>{Object.entries(BONUS_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="space-y-1.5"><Label htmlFor="bn-amount">Monto por vez</Label><div className="flex gap-2"><Input id="bn-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /><select aria-label="Moneda" className="h-10 w-24 rounded-xl border border-border/60 bg-background px-2 text-sm" value={cur} onChange={(e) => setCur(e.target.value)}><option value="NIO">NIO</option><option value="USD">USD</option></select></div></div>
          <div className="space-y-1.5"><Label htmlFor="bn-freq">Cada cuánto</Label><select id="bn-freq" className={select} value={frequency} onChange={(e) => setFrequency(e.target.value as BonusFrequency)}>{Object.entries(BONUS_FREQUENCY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          {(frequency === 'WEEKLY' || frequency === 'BIWEEKLY') && <div className="space-y-1.5"><Label htmlFor="bn-weekday">Qué día</Label><select id="bn-weekday" className={select} value={weekday} onChange={(e) => setWeekday(e.target.value)}>{WEEKDAY_LABEL.slice(1).map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></div>}
          {frequency === 'MONTHLY' && <div className="space-y-1.5"><Label htmlFor="bn-dom">Día del mes (vacío = último)</Label><Input id="bn-dom" type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} /></div>}
          <div className="space-y-1.5"><Label htmlFor="bn-start">{frequency === 'ONCE' ? 'Fecha del bono' : 'Desde'}</Label><Input id="bn-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          {frequency !== 'ONCE' && <div className="space-y-1.5"><Label htmlFor="bn-end">Hasta (opcional)</Label><Input id="bn-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>}
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="bn-min">Puntuación mínima de desempeño (opcional, 0 a 100)</Label><Input id="bn-min" type="number" min="0" max="100" value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="Ej. 75: solo se paga si llega a 75 en el período" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="bn-notes">Condición o notas</Label><Input id="bn-notes" value={notes} maxLength={400} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. si cumple la meta de producción del día" /></div>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="button" onClick={() => void save()} disabled={busy || !name.trim() || !(Number(amount) > 0) || !startDate}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Guardar bono</Button></div>
      </DialogContent>
    </Dialog>
  );
}

/** Pestaña «Bonos»: bonos ligados al empleado (únicos o recurrentes) que la nómina suma sola. */
export function EmployeeBonusPanel({ employeeId, currency, canEdit }: { employeeId: string; currency: string; canEdit: boolean }) {
  const client = useQueryClient();
  const [creating, setCreating] = useState(false);
  const plans = useTenantQuery(['hr', 'employee-bonus-plans', employeeId], (signal) => employeeProfileService.getBonusPlans(employeeId, signal), { staleTime: 15_000 });
  const refresh = () => void client.invalidateQueries({ queryKey: ['tenant-module'] });
  return (
    <Card className="space-y-4 rounded-2xl border-border/60 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><Gift className="size-4 text-primary" /> Bonos del empleado</h3>
        {canEdit && <Button type="button" size="sm" onClick={() => setCreating(true)}><Plus className="mr-1.5 size-4" /> Nuevo bono</Button>}
      </div>
      {plans.isLoading ? <Skeleton className="h-20 w-full" aria-busy="true" />
        : plans.isError ? <p className="text-sm text-destructive" role="alert">No se pudieron cargar los bonos.</p>
        : !plans.data?.length ? <p className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">Este empleado no tiene bonos. Crea uno (por ejemplo «todos los sábados») y la nómina lo sumará solo.</p>
        : (
          <ul className="space-y-2">
            {plans.data.map((plan) => (
              <li key={plan.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${plan.isActive ? 'border-border/60' : 'border-dashed border-border/40 opacity-60'}`}>
                <div className="min-w-0">
                  <p className="break-words font-bold">{plan.name} <Badge variant="outline" className="ml-1 text-[10px]">{BONUS_TYPE_LABEL[plan.bonusType] ?? plan.bonusType}</Badge></p>
                  <p className="text-xs text-muted-foreground">{describe(plan)} · desde el {new Date(plan.startDate).toLocaleDateString('es-NI', { dateStyle: 'medium', timeZone: 'UTC' })}{plan.endDate ? ` hasta el ${new Date(plan.endDate).toLocaleDateString('es-NI', { dateStyle: 'medium', timeZone: 'UTC' })}` : ''}{plan.minScore !== null && plan.minScore !== undefined ? ` · solo si su puntuación llega a ${plan.minScore}` : ''}{plan.notes ? ` · ${plan.notes}` : ''}</p>
                </div>
                <div className="flex items-center gap-3"><span className="font-black tabular-nums">{plan.currency} {new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2 }).format(plan.amount)}</span>{canEdit && <button type="button" className="text-xs font-semibold text-primary underline dark:text-accent" onClick={() => void employeeProfileService.updateBonusPlan(employeeId, plan.id, { isActive: !plan.isActive }).then(refresh).catch((error) => toast.error(failure(error)))}>{plan.isActive ? 'Pausar' : 'Reactivar'}</button>}</div>
              </li>
            ))}
          </ul>
        )}
      <p className="text-[11px] text-muted-foreground">Al procesar la nómina del empleado se suma el bono por cada vez que cae en el período (por ejemplo, 4 sábados = 4 veces el monto). Solo se suman los bonos de la misma moneda de la nómina.</p>
      {creating && <BonusDialog employeeId={employeeId} currency={currency} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); refresh(); }} />}
    </Card>
  );
}
