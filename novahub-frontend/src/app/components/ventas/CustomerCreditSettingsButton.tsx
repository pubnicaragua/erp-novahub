import { useState } from 'react';
import { Bell, CalendarDays, Settings2, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { customerCreditCalendarService, customerCreditRemindersService, type CustomerCreditHoliday } from '../../services/ventas.service';
import { toast } from '@/app/services/toast';

const reminderDefaults = {
  enabled: false,
  beforeDays: [] as number[],
  dueDayEnabled: true,
  firstOverdueDays: 1,
  repeatOverdueEveryDays: null as number | null,
  upcomingMessage: 'Hola {{cliente}}, el abono {{cuota}} del documento {{documento}} vence el {{fecha}}. Saldo de capital: {{saldo_capital}}; intereses: {{saldo_intereses}}.',
  dueTodayMessage: 'Hola {{cliente}}, hoy vence el abono {{cuota}} del documento {{documento}}. Saldo de capital: {{saldo_capital}}; intereses: {{saldo_intereses}}.',
  overdueMessage: 'Hola {{cliente}}, el abono {{cuota}} del documento {{documento}} venció el {{fecha}}. Atraso: {{dias_atraso}} día(s). Saldo de capital: {{saldo_capital}}; intereses: {{saldo_intereses}}.',
};

const unwrap = (value: any) => value?.data?.data ?? value?.data ?? value;
const dateOnly = (value: string) => String(value || '').slice(0, 10);

/** Configuración por sucursal compartida por Créditos y Préstamos a clientes. */
export function CustomerCreditSettingsButton({ canEdit, canSend = false }: { canEdit: boolean; canSend?: boolean }) {
  const [open, setOpen] = useState(false);
  const [holidaysOpen, setHolidaysOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [holidays, setHolidays] = useState<CustomerCreditHoliday[]>([]);
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [holidaySaving, setHolidaySaving] = useState(false);
  const [config, setConfig] = useState<any>(reminderDefaults);
  const [beforeDaysText, setBeforeDaysText] = useState('1');
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderSaving, setReminderSaving] = useState(false);

  const refreshHolidays = async () => {
    try {
      const result = unwrap(await customerCreditCalendarService.listHolidays());
      setHolidays(Array.isArray(result) ? result : result?.items || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudieron cargar los feriados.');
    }
  };

  const loadReminderConfiguration = async () => {
    setReminderLoading(true);
    try {
      const result = await customerCreditRemindersService.getConfig();
      const next = { ...reminderDefaults, ...(unwrap(result) || {}) };
      setConfig(next);
      setBeforeDaysText(Array.isArray(next.beforeDays) ? next.beforeDays.join(', ') : '');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo cargar la configuración de recordatorios.');
    } finally { setReminderLoading(false); }
  };

  const saveHoliday = async () => {
    const name = holidayName.trim();
    if (!name || !holidayDate) return void toast.error('Indica el nombre y la fecha del feriado.');
    setHolidaySaving(true);
    try {
      if (editingHolidayId) await customerCreditCalendarService.updateHoliday(editingHolidayId, { name, date: holidayDate });
      else await customerCreditCalendarService.createHoliday({ name, date: holidayDate });
      await refreshHolidays();
      setHolidayName(''); setHolidayDate(''); setEditingHolidayId(null);
      toast.success(editingHolidayId ? 'Feriado actualizado.' : 'Feriado agregado al calendario de la sucursal.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo guardar el feriado.');
    } finally { setHolidaySaving(false); }
  };

  const deleteHoliday = async (id: string) => {
    try {
      await customerCreditCalendarService.deleteHoliday(id);
      await refreshHolidays();
      toast.success('Feriado eliminado; los planes existentes conservan su calendario.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo eliminar el feriado.');
    }
  };

  const saveReminders = async () => {
    setReminderSaving(true);
    try {
      const beforeDays = beforeDaysText.split(',').map((item) => Number(item.trim())).filter((item) => Number.isFinite(item) && item > 0);
      const result = unwrap(await customerCreditRemindersService.saveConfig({ ...config, beforeDays }));
      setConfig({ ...reminderDefaults, ...(result || {}), beforeDays });
      toast.success('Configuración guardada para los créditos y préstamos nuevos.');
      setRemindersOpen(false);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo guardar la configuración.');
    } finally { setReminderSaving(false); }
  };

  if (!canEdit && !canSend) return null;

  return <>
    <Button type="button" variant="outline" onClick={() => { setOpen(true); void refreshHolidays(); }} className="h-10 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest"><Settings2 className="mr-2 size-4" /> Configuración</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100%-1rem)] rounded-2xl sm:max-w-2xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings2 className="size-5 text-primary" /> Configuración de pagos</DialogTitle><DialogDescription>El calendario y los avisos son los mismos para Créditos y Préstamos de esta sucursal.</DialogDescription></DialogHeader>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {canEdit && <Card className="rounded-2xl border-border/60"><CardContent className="flex h-full flex-col items-start gap-3 p-4"><CalendarDays className="size-6 text-primary" /><div><h3 className="font-semibold">Feriados</h3><p className="mt-1 text-sm text-muted-foreground">Administra fechas que pueden excluirse de planes automáticos.</p></div><Button type="button" variant="outline" className="mt-auto w-full rounded-xl" onClick={() => { setOpen(false); setHolidaysOpen(true); void refreshHolidays(); }}>Administrar feriados</Button></CardContent></Card>}
          {canEdit && <Card className="rounded-2xl border-border/60"><CardContent className="flex h-full flex-col items-start gap-3 p-4"><Bell className="size-6 text-primary" /><div><h3 className="font-semibold">Recordatorios</h3><p className="mt-1 text-sm text-muted-foreground">Configura avisos previos, del día y por atraso.</p></div><Button type="button" variant="outline" className="mt-auto w-full rounded-xl" onClick={() => { setOpen(false); setRemindersOpen(true); void loadReminderConfiguration(); }}>Configurar recordatorios</Button></CardContent></Card>}
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={holidaysOpen} onOpenChange={(next) => { setHolidaysOpen(next); if (!next) { setEditingHolidayId(null); setHolidayName(''); setHolidayDate(''); } }}>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-1rem)] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <DialogHeader><DialogTitle>Feriados de la sucursal</DialogTitle><DialogDescription>Las fechas afectan los planes nuevos de créditos y préstamos. Los contratos emitidos conservan su calendario.</DialogDescription></DialogHeader>
        {canEdit && <div className="grid gap-3 rounded-xl border border-border/50 bg-muted/10 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(150px,190px)_auto] sm:items-end">
          <div className="space-y-1.5"><Label htmlFor="shared-credit-holiday-name">Nombre del feriado</Label><Input id="shared-credit-holiday-name" maxLength={120} value={holidayName} onChange={(event) => setHolidayName(event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="shared-credit-holiday-date">Fecha exacta</Label><Input id="shared-credit-holiday-date" type="date" value={holidayDate} onChange={(event) => setHolidayDate(event.target.value)} /></div>
          <div className="flex gap-2"><Button type="button" onClick={() => void saveHoliday()} disabled={holidaySaving}>{editingHolidayId ? 'Actualizar' : 'Agregar'}</Button>{editingHolidayId && <Button type="button" variant="outline" onClick={() => { setEditingHolidayId(null); setHolidayName(''); setHolidayDate(''); }}>Cancelar</Button>}</div>
        </div>}
        <div className="max-h-72 space-y-2 overflow-y-auto">{holidays.length ? holidays.map((holiday) => <div key={holiday.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 p-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{holiday.name}</p><p className="text-xs text-muted-foreground">{dateOnly(holiday.date)}</p></div>{canEdit && <div className="flex shrink-0 gap-2"><Button type="button" variant="outline" size="sm" onClick={() => { setEditingHolidayId(holiday.id); setHolidayName(holiday.name); setHolidayDate(dateOnly(holiday.date)); }}>Editar</Button><Button type="button" variant="ghost" size="icon" aria-label={`Eliminar feriado ${holiday.name}`} onClick={() => void deleteHoliday(holiday.id)}><Trash2 className="size-4" /></Button></div>}</div>) : <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No hay feriados para esta sucursal.</p>}</div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setHolidaysOpen(false)}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={remindersOpen} onOpenChange={setRemindersOpen}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] overflow-y-auto rounded-2xl sm:max-w-3xl">
        <DialogHeader><DialogTitle>Recordatorios de pagos</DialogTitle><DialogDescription>Esta configuración de sucursal aplica por igual a créditos y préstamos nuevos; el envío continúa requiriendo confirmación manual.</DialogDescription></DialogHeader>
        {reminderLoading ? <p role="status" className="py-6 text-sm text-muted-foreground">Cargando configuración…</p> : <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-4 accent-primary" checked={Boolean(config.enabled)} onChange={(event) => setConfig({ ...config, enabled: event.target.checked })} /> Configuración activa</label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="shared-reminder-before">Avisar antes (días separados por coma)</Label><Input id="shared-reminder-before" value={beforeDaysText} onChange={(event) => setBeforeDaysText(event.target.value)} placeholder="3, 1" /></div>
            <div className="space-y-1.5"><Label htmlFor="shared-reminder-first-overdue">Primer aviso de atraso (días)</Label><Input id="shared-reminder-first-overdue" type="number" min="1" max="90" value={config.firstOverdueDays} onChange={(event) => setConfig({ ...config, firstOverdueDays: Number(event.target.value) })} /></div>
            <div className="space-y-1.5"><Label htmlFor="shared-reminder-repeat">Repetir atraso cada (días, opcional)</Label><Input id="shared-reminder-repeat" type="number" min="1" max="90" value={config.repeatOverdueEveryDays ?? ''} onChange={(event) => setConfig({ ...config, repeatOverdueEveryDays: event.target.value ? Number(event.target.value) : null })} /></div>
            <label className="flex items-center gap-2 self-end rounded-xl border border-border/50 p-3 text-sm font-semibold"><input type="checkbox" className="size-4 accent-primary" checked={Boolean(config.dueDayEnabled)} onChange={(event) => setConfig({ ...config, dueDayEnabled: event.target.checked })} /> Avisar el día del vencimiento</label>
          </div>
          {([['upcomingMessage', 'Mensaje previo'], ['dueTodayMessage', 'Mensaje del día'], ['overdueMessage', 'Mensaje de atraso']] as const).map(([key, label]) => <div key={key} className="space-y-1.5"><Label htmlFor={`shared-reminder-${key}`}>{label}</Label><textarea id={`shared-reminder-${key}`} rows={3} maxLength={1500} value={config[key]} onChange={(event) => setConfig({ ...config, [key]: event.target.value })} className="min-h-20 w-full max-w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>)}
          <p className="text-xs text-muted-foreground">Variables: {'{{cliente}}'}, {'{{documento}}'}, {'{{cuota}}'}, {'{{fecha}}'}, {'{{saldo_capital}}'}, {'{{saldo_intereses}}'}, {'{{dias_atraso}}'}.</p>
        </div>}
        <DialogFooter><Button type="button" variant="outline" onClick={() => setRemindersOpen(false)}>Cancelar</Button><Button type="button" onClick={() => void saveReminders()} disabled={!canEdit || reminderLoading || reminderSaving}>{reminderSaving ? 'Guardando…' : 'Guardar configuración'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
