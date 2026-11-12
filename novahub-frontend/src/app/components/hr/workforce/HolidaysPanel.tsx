import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Skeleton } from '../../ui/skeleton';
import { cn } from '../../ui/utils';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { toast } from '../../../services/toast';
import { formatCurrencyAmount } from '../../../utils/currency';
import { WEEKDAY_NAMES, workforceService, type HolidayItem } from '../../../services/workforce.service';
import { dayLabel, failure } from './workforceUtils';

const KIND_LABEL: Record<HolidayItem['kind'], string> = { NATIONAL: 'Nacional', LOCAL: 'Local', CUSTOM: 'De la empresa' };

/** Calendario de feriados del año: cuáles respeta la empresa, cuáles trabaja y cuánto le cuesta trabajarlos. */
export function HolidaysPanel() {
  const client = useQueryClient();
  const { canPerform } = useAuth();
  const canEdit = canPerform('HR_LEAVES', 'edit');
  const [year, setYear] = useState(new Date().getFullYear());
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const query = useTenantQuery(['workforce', 'holidays', year], (signal) => workforceService.getHolidays(year, signal), { staleTime: 15_000 });
  const run = async (action: () => Promise<unknown>, message?: string) => {
    setBusy(true);
    try { await action(); if (message) toast.success(message); void client.invalidateQueries({ queryKey: ['tenant-module'] }); } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  const data = query.data;
  const today = new Date().toISOString().slice(0, 10);
  const worked = data?.items.filter((item) => item.enabled && item.worked) ?? [];
  const totalExtra = worked.reduce((sum, item) => sum + item.extraCost, 0);

  return (
    <section className="space-y-4" aria-label="Feriados">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h3 className="nh-module-title">Feriados del año</h3><p className="text-xs text-muted-foreground">Se avisa a Recursos Humanos una semana antes y la víspera. Marca los que la empresa trabaja para saber cuánto cuestan.</p></div>
        <div className="flex items-center gap-1" role="group" aria-label="Año">
          <Button type="button" variant="outline" size="sm" onClick={() => setYear(year - 1)} aria-label="Año anterior">‹</Button>
          <span className="w-14 text-center text-sm font-black tabular-nums">{year}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => setYear(year + 1)} aria-label="Año siguiente">›</Button>
        </div>
      </div>

      {query.isLoading ? <Skeleton className="h-64 w-full rounded-2xl" aria-busy="true" />
        : query.isError || !data ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">No se pudo cargar el calendario.</p>
        : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Feriados que respeta la empresa</p><p className="mt-1 text-xl font-black tabular-nums">{data.items.filter((item) => item.enabled).length}</p></div>
              <div className="rounded-xl border border-border/60 bg-card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Feriados trabajados</p><p className="mt-1 text-xl font-black tabular-nums">{worked.length}</p></div>
              <div className="rounded-xl border border-border/60 bg-card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Costo extra de trabajarlos</p><p className="mt-1 text-xl font-black tabular-nums">{formatCurrencyAmount(totalExtra, data.currency)}</p><p className="text-[10px] text-muted-foreground">Un día de planilla vale {formatCurrencyAmount(data.dailyPayroll, data.currency)}</p></div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/40 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground"><tr><th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Feriado</th><th className="px-3 py-2">Respeta</th><th className="px-3 py-2">La empresa trabaja</th><th className="px-3 py-2">Pago (veces)</th><th className="px-3 py-2 text-right">Costo extra</th><th className="px-3 py-2"><span className="sr-only">Acciones</span></th></tr></thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id} className={cn('border-t border-border/40', !item.enabled && 'opacity-55')}>
                      <td className="whitespace-nowrap px-3 py-2"><b>{dayLabel(item.date)}</b><span className="ml-1 text-xs text-muted-foreground">{WEEKDAY_NAMES[item.weekday]}</span>{item.date >= today && item.enabled && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-black uppercase text-primary">Próximo</span>}</td>
                      <td className="px-3 py-2">{item.name}<span className="ml-2 text-[10px] uppercase text-muted-foreground">{KIND_LABEL[item.kind]}</span></td>
                      <td className="px-3 py-2"><input type="checkbox" aria-label={`La empresa respeta ${item.name}`} disabled={!canEdit || busy} checked={item.enabled} onChange={(e) => void run(() => workforceService.updateHoliday(item.id, { enabled: e.target.checked }))} /></td>
                      <td className="px-3 py-2"><input type="checkbox" aria-label={`La empresa trabaja ${item.name}`} disabled={!canEdit || busy || !item.enabled} checked={item.worked} onChange={(e) => void run(() => workforceService.updateHoliday(item.id, { worked: e.target.checked }))} /></td>
                      <td className="px-3 py-2"><Input aria-label={`Factor de pago de ${item.name}`} className="h-8 w-20" type="number" min="1" max="5" step="0.25" defaultValue={item.payMultiplier} disabled={!canEdit || busy || !item.worked} onBlur={(e) => { const value = Number(e.target.value); if (value >= 1 && value !== item.payMultiplier) void run(() => workforceService.updateHoliday(item.id, { payMultiplier: value })); }} /></td>
                      <td className="px-3 py-2 text-right tabular-nums">{item.extraCost > 0 ? formatCurrencyAmount(item.extraCost, data.currency) : '—'}</td>
                      <td className="px-3 py-2 text-right">{item.kind === 'CUSTOM' && canEdit && <button type="button" aria-label={`Borrar ${item.name}`} disabled={busy} onClick={() => void run(() => workforceService.removeHoliday(item.id), 'Feriado borrado')} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canEdit && (
              <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border p-3">
                <div className="space-y-1"><label className="text-xs font-semibold" htmlFor="hd-date">Agregar un día no laborable</label><Input id="hd-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-44" /></div>
                <div className="min-w-[200px] flex-1 space-y-1"><label className="text-xs font-semibold" htmlFor="hd-name">Nombre</label><Input id="hd-name" value={newName} maxLength={120} onChange={(e) => setNewName(e.target.value)} placeholder="Aniversario de la empresa" /></div>
                <Button type="button" disabled={busy || !newDate || !newName.trim()} onClick={() => void run(async () => { await workforceService.createHoliday({ date: newDate, name: newName.trim() }); setNewDate(''); setNewName(''); }, 'Día agregado')}><Plus className="mr-1 size-4" />Agregar</Button>
              </div>
            )}
          </>
        )}
    </section>
  );
}
