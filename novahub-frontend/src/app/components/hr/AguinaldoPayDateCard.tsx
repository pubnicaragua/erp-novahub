import { useState } from 'react';
import { CalendarCheck, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { DateField } from '../ui/DateField';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { hrService } from '../../services/hr.service';
import { toast } from '../../services/toast';

export interface AguinaldoSchedule {
  year: number;
  payDate: string;
  isDefault: boolean;
  legalDeadline: string;
  notes: string | null;
}

const longDate = (iso: string) => new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' });

/** «Pagaremos el aguinaldo {año} el …»: la fecha que usa la proyección de nómina para poner el aguinaldo en su mes. */
export function AguinaldoPayDateCard({ year }: { year: number }) {
  const client = useQueryClient();
  const { canPerform } = useAuth();
  const canEdit = canPerform('HR_PAYROLL', 'edit');
  const query = useTenantQuery<AguinaldoSchedule>(['hr', 'aguinaldo-schedule', year], (signal) => hrService.getAguinaldoSchedule(year, signal) as Promise<AguinaldoSchedule>);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const payDate = draft ?? query.data?.payDate ?? '';
  const setPayDate = (value: string) => setDraft(value);

  const changed = Boolean(query.data) && payDate !== query.data?.payDate;
  const lateWarning = payDate && query.data && payDate > query.data.legalDeadline;

  const save = async () => {
    setBusy(true);
    try {
      await hrService.saveAguinaldoSchedule({ year, payDate });
      toast.success(`Fecha de pago del aguinaldo ${year} guardada`);
      await query.refetch();
      setDraft(null);
      void client.invalidateQueries({ predicate: (q) => JSON.stringify(q.queryKey).includes('payroll-projection') });
    } catch (error) {
      const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
      toast.error(message ? String(message) : 'No se pudo guardar la fecha.');
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-end sm:justify-between" data-testid="hr-aguinaldo-paydate">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs font-bold"><CalendarCheck className="size-4 shrink-0 text-primary" aria-hidden /> Fecha en que pagaremos el aguinaldo {year}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {query.isLoading ? 'Cargando…' : query.data?.isDefault
            ? `Sin elegir: la proyección usa la fecha límite legal (${longDate(query.data.legalDeadline)}).`
            : query.data ? `La proyección de gastos pone el aguinaldo en ${longDate(query.data.payDate)}.` : 'No se pudo leer la fecha.'}
        </p>
        {lateWarning && <p className="mt-1 text-[11px] font-semibold text-warning">Esta fecha es posterior a la fecha límite legal del 10 de diciembre.</p>}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <Label className="sr-only">Fecha de pago del aguinaldo {year}</Label>
          <DateField value={payDate} onChange={setPayDate} disabled={!canEdit || query.isLoading} title={`Fecha de pago del aguinaldo ${year}`} className="h-9 w-full sm:w-[170px]" />
        </div>
        {canEdit && (
          <Button type="button" size="sm" className="h-9" onClick={() => void save()} disabled={busy || !changed || !payDate}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}Guardar fecha
          </Button>
        )}
      </div>
    </div>
  );
}
