import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { ClipboardList, CalendarClock, AlertTriangle, CheckCircle2, ArrowDownToLine, ArrowUpFromLine, Loader2, Landmark, ListChecks, Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { cajaService } from '../../../services/caja.service';
import { api, getApiErrorMessage } from '../../../services/api';

const WEEKDAYS = [
  { index: 1, label: 'L', name: 'Lunes' },
  { index: 2, label: 'M', name: 'Martes' },
  { index: 3, label: 'M', name: 'Miércoles' },
  { index: 4, label: 'J', name: 'Jueves' },
  { index: 5, label: 'V', name: 'Viernes' },
  { index: 6, label: 'S', name: 'Sábado' },
  { index: 0, label: 'D', name: 'Domingo' },
];

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'select', label: 'Selección' },
  { value: 'date', label: 'Fecha' },
  { value: 'boolean', label: 'Sí / No' },
];

interface ProtocolFieldDraft {
  id: string;
  label: string;
  type: string;
  options: string;
  required: boolean;
  placeholder: string;
}

export function NormasProcedimientosPanel() {
  const [norms, setNorms] = useState<any>(null);
  const [autoClose, setAutoClose] = useState<any>(null);
  const [, setProtocol] = useState<any>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [normsLoading, setNormsLoading] = useState(false);
  const [savingNorms, setSavingNorms] = useState(false);
  const [savingAutoClose, setSavingAutoClose] = useState(false);
  const [savingProtocol, setSavingProtocol] = useState(false);
  const [fieldDrafts, setFieldDrafts] = useState<ProtocolFieldDraft[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setNormsLoading(true);
      try {
        const [normsRes, autoCloseRes, protocolRes, banksRes] = await Promise.all([
          cajaService.getCashNorms(),
          cajaService.getAutoCloseConfig(),
          cajaService.getClosureProtocol(),
          api.get<any[]>('/bank-accounts'),
        ]);
        if (cancelled) return;
        setNorms(normsRes);
        setAutoClose(autoCloseRes);
        setProtocol(protocolRes);
        setBankAccounts(Array.isArray(banksRes) ? banksRes : ((banksRes as any)?.data || []));
        setFieldDrafts((protocolRes?.fields || []).map((field: any) => ({
          id: field.id || '',
          label: field.label || '',
          type: field.type || 'text',
          options: (field.options || []).join(', '),
          required: field.required !== false,
          placeholder: field.placeholder || '',
        })));
      } catch (e: any) {
        if (!cancelled) toast.error(getApiErrorMessage(e, 'Error al cargar normas y configuración'));
      } finally {
        if (!cancelled) setNormsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const saveNorms = async () => {
    if (!norms) return;
    setSavingNorms(true);
    try {
      const saved = await cajaService.updateCashNorms(norms);
      setNorms(saved);
      toast.success('Normas actualizadas');
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al guardar las normas'));
    } finally {
      setSavingNorms(false);
    }
  };

  const toggleAutoCloseDay = (dayIndex: number) => {
    if (!autoClose) return;
    const days = Array.isArray(autoClose.days) ? autoClose.days.map(Number) : [];
    setAutoClose({ ...autoClose, days: days.includes(dayIndex) ? days.filter((d: number) => d !== dayIndex) : [...days, dayIndex] });
  };

  const setDaySchedule = (dayIndex: number, time: string) => {
    if (!autoClose) return;
    const schedules = { ...(autoClose.schedules || {}) };
    if (time) schedules[String(dayIndex)] = time;
    else delete schedules[String(dayIndex)];
    setAutoClose({ ...autoClose, schedules });
  };

  const saveAutoClose = async () => {
    if (!autoClose) return;
    setSavingAutoClose(true);
    try {
      const saved = await cajaService.updateAutoCloseConfig({
        ...autoClose,
        days: Array.isArray(autoClose.days) ? autoClose.days.map(Number) : [],
        schedules: autoClose.schedules || {},
      });
      setAutoClose(saved);
      toast.success('Cierre automático configurado');
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al guardar el cierre automático'));
    } finally {
      setSavingAutoClose(false);
    }
  };

  const addField = () => {
    setFieldDrafts(current => [...current, {
      id: `campo_${Date.now()}`,
      label: '',
      type: 'text',
      options: '',
      required: false,
      placeholder: '',
    }]);
  };

  const updateField = (index: number, patch: Partial<ProtocolFieldDraft>) => {
    setFieldDrafts(current => current.map((field, i) => i === index ? { ...field, ...patch } : field));
  };

  const removeField = (index: number) => {
    setFieldDrafts(current => current.filter((_, i) => i !== index));
  };

  const saveProtocol = async () => {
    setSavingProtocol(true);
    try {
      const fields = fieldDrafts
        .map((field, index) => ({
          id: field.id || `campo_${index + 1}`,
          label: field.label.trim(),
          type: field.type,
          options: field.type === 'select' ? field.options.split(',').map((o) => o.trim()).filter(Boolean) : [],
          required: field.required,
          placeholder: field.placeholder.trim(),
        }))
        .filter((field) => field.label);
      const saved = await cajaService.updateClosureProtocol({ fields });
      setProtocol(saved);
      toast.success('Protocolo de cierre actualizado');
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al guardar el protocolo'));
    } finally {
      setSavingProtocol(false);
    }
  };

  const daysMode = autoClose?.mode === 'month' ? 'month' : 'week';
  const activeDays = Array.isArray(autoClose?.days) ? autoClose.days.map(Number) : [];
  const schedules = (autoClose?.schedules && typeof autoClose.schedules === 'object') ? autoClose.schedules : {};

  if (normsLoading && !norms) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-foreground">
          <ClipboardList className="size-4 text-primary" /> Normas operativas de la caja
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          El sistema aplica estas normas en el control de caja. Configura cuáles se notifican o registran automáticamente.
        </p>
        <div className="mt-3 space-y-2.5">
          <NormaRow
            icon={<ArrowDownToLine className="size-4 text-emerald-600" />}
            title="Arqueos en cualquier momento"
            description="Se pueden realizar arqueos (conteos) parciales en cualquier momento de la sesión, sin cerrarla."
            checked={norms?.allowArqueosAnyTime}
            disabled
          />
          <NormaRow
            icon={<CalendarClock className="size-4 text-sky-600" />}
            title="Arqueo final al cerrar"
            description="El cierre requiere un conteo final. En cierre a ciegas, el arqueo es obligatorio antes de cerrar."
            checked={norms?.finalArqueoAtClose}
            disabled
          />
          <NormaRow
            icon={<ArrowUpFromLine className="size-4 text-amber-600" />}
            title="Excedente en caja"
            description="El sobrante se registra en la contabilidad (otros ingresos) como parte del asiento de cierre. Mantén la opción activa para conservar este comportamiento."
            checked={norms?.surplusToOtherIncome}
            onCheckedChange={(v) => setNorms({ ...norms, surplusToOtherIncome: v })}
          />
          <NormaRow
            icon={<AlertTriangle className="size-4 text-rose-600" />}
            title="Faltante en caja"
            description="Si hay diferencia negativa, se notifica a la gerencia y se registra el cobro pendiente para que la gerencia determine cobrárselo al responsable."
            checked={norms?.notifyManagementOnDeficit}
            onCheckedChange={(v) => setNorms({ ...norms, notifyManagementOnDeficit: v })}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 bg-background/40 px-3 py-2">
            <div>
              <p className="text-xs font-bold">Umbral de aviso de faltante</p>
              <p className="text-[10px] text-muted-foreground">Solo notifica si el faltante supera este monto (en C$).</p>
            </div>
            <Input
              type="number"
              min={0}
              className="h-8 w-28 text-right text-xs"
              value={norms?.deficitNotifyThreshold ?? 0}
              onChange={(e) => setNorms({ ...norms, deficitNotifyThreshold: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
          <NormaRow
            icon={<Landmark className="size-4 text-indigo-600" />}
            title="Depósito del cierre a cuenta bancaria"
            description="Al cerrar, todo el efectivo del arqueo se transfiere a la cuenta bancaria seleccionada (asiento contable DEBE Banco / HABER Caja) y queda en caja solo el fondo fijo configurado."
            checked={norms?.bankTransferEnabled}
            onCheckedChange={(v) => setNorms({ ...norms, bankTransferEnabled: v })}
          />
          {norms?.bankTransferEnabled && (
            <div className="space-y-3 rounded-xl border border-indigo-500/30 bg-indigo-500/5 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold">Cuenta bancaria destino</p>
                  <p className="text-[10px] text-muted-foreground">Debe tener cuenta contable vinculada (Contabilidad &gt; Cuentas Bancarias).</p>
                </div>
                <Select value={norms?.bankAccountId || ''} onValueChange={(v) => setNorms({ ...norms, bankAccountId: v })}>
                  <SelectTrigger className="h-8 w-full sm:w-72 text-xs">
                    <SelectValue placeholder="Selecciona una cuenta bancaria" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.length === 0 && (
                      <div className="px-3 py-2 text-[10px] text-muted-foreground">No hay cuentas bancarias. Créalas en Contabilidad.</div>
                    )}
                    {bankAccounts.map((bank: any) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {bank.bankName} · {bank.accountNumber} {bank.accountId ? '' : '(sin cuenta contable)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fondo fijo en caja (C$)</p>
                  <Input
                    type="number"
                    min={0}
                    className="h-8 text-right text-xs"
                    value={norms?.keepInCashNIO ?? 0}
                    onChange={(e) => setNorms({ ...norms, keepInCashNIO: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fondo fijo en caja ($)</p>
                  <Input
                    type="number"
                    min={0}
                    className="h-8 text-right text-xs"
                    value={norms?.keepInCashUSD ?? 0}
                    onChange={(e) => setNorms({ ...norms, keepInCashUSD: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Ejemplo: si el arqueo cierra en C$ 5,000 y el fondo fijo es C$ 500, se depositan C$ 4,500 al banco y C$ 500 quedan como saldo de inicio del siguiente día.
              </p>
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <Button size="sm" className="h-8 gap-1.5 text-[10px] font-black uppercase tracking-widest" onClick={() => void saveNorms()} disabled={savingNorms || !norms}>
            {savingNorms ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />} Guardar normas
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-foreground">
          <CalendarClock className="size-4 text-primary" /> Cierre automático de cajas
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Cierra automáticamente las sesiones abiertas en los días indicados. Puedes configurar una hora distinta para cada día. Las cajas en modo de cierre a ciegas se omiten (requieren arqueo del cajero).
        </p>
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/40 px-3 py-2">
            <div>
              <p className="text-xs font-bold">Activar cierre automático</p>
              <p className="text-[10px] text-muted-foreground">Las sesiones se cierran con el monto esperado del sistema (diferencia 0).</p>
            </div>
            <Switch checked={Boolean(autoClose?.enabled)} onCheckedChange={(v) => setAutoClose({ ...autoClose, enabled: v })} />
          </div>
          <div className="rounded-xl border border-border/50 bg-background/40 px-3 py-2">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold">Días programados</p>
              <Select
                value={daysMode}
                onValueChange={(mode) => setAutoClose({ ...autoClose, mode, days: [] })}
              >
                <SelectTrigger className="h-7 w-[190px] text-[10px] font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Por día de la semana</SelectItem>
                  <SelectItem value="month">Por día del mes (1-31)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {daysMode === 'week' ? (
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((day) => {
                  const active = activeDays.includes(day.index);
                  return (
                    <button
                      key={day.index}
                      type="button"
                      onClick={() => toggleAutoCloseDay(day.index)}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-black transition-colors ${active ? 'border-primary/40 bg-primary/15 text-primary' : 'border-border/60 bg-background text-muted-foreground hover:bg-muted/40'}`}
                      title={day.name}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {MONTH_DAYS.map((day) => {
                  const active = activeDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleAutoCloseDay(day)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border text-[10px] font-black transition-colors ${active ? 'border-primary/40 bg-primary/15 text-primary' : 'border-border/60 bg-background text-muted-foreground hover:bg-muted/40'}`}
                      title={`Día ${day}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2">
            <div>
              <p className="text-xs font-bold">Hora global del cierre</p>
              <p className="text-[10px] text-muted-foreground">Se usa para los días sin hora específica.</p>
            </div>
            <Input
              type="time"
              className="h-8 w-32 text-xs"
              value={autoClose?.time || '20:00'}
              onChange={(e) => setAutoClose({ ...autoClose, time: e.target.value })}
            />
          </div>
          {activeDays.length > 0 && (
            <div className="space-y-2 rounded-xl border border-border/50 bg-background/40 px-3 py-3">
              <p className="text-xs font-bold">Hora específica por día</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(daysMode === 'week' ? WEEKDAYS.filter((day) => activeDays.includes(day.index)) : MONTH_DAYS.filter((day) => activeDays.includes(day)).map((day) => ({ index: day, label: String(day), name: `Día ${day}` }))).map((day: any) => (
                  <div key={day.index} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/10 px-3 py-1.5">
                    <span className="text-xs font-bold">{day.name}</span>
                    <Input
                      type="time"
                      className="h-7 w-28 text-xs"
                      value={schedules[String(day.index)] || autoClose?.time || '20:00'}
                      onChange={(e) => setDaySchedule(day.index, e.target.value)}
                      title={`Hora de cierre para ${day.name}`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">Si no defines hora en un día, se usa la hora global.</p>
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <Button size="sm" className="h-8 gap-1.5 text-[10px] font-black uppercase tracking-widest" onClick={() => void saveAutoClose()} disabled={savingAutoClose || !autoClose}>
            {savingAutoClose ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />} Guardar configuración
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-foreground">
          <ListChecks className="size-4 text-primary" /> Protocolo de datos del cierre
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Define los campos que el cajero debe completar en el modal de cierre. Cada empresa tiene su propio protocolo de ingreso de datos; los campos obligatorios bloquean el cierre hasta completarlos.
        </p>
        <div className="mt-3 space-y-2.5">
          {fieldDrafts.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/60 bg-background/30 px-3 py-4 text-center text-[11px] text-muted-foreground">
              Sin campos definidos. Agrega campos como "N° de depósito", "Responsable del conteo", "Caja fuerte", etc.
            </div>
          )}
          {fieldDrafts.map((field, index) => (
            <div key={field.id} className="space-y-2 rounded-xl border border-border/50 bg-background/40 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <GripVertical className="size-4 shrink-0 text-muted-foreground/40" />
                <Input
                  className="h-8 flex-1 text-xs font-bold"
                  placeholder={`Nombre del campo (ej. N° de depósito)`}
                  value={field.label}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                />
                <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 text-destructive hover:text-destructive" onClick={() => removeField(index)} title="Quitar campo">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={field.type} onValueChange={(v) => updateField(index, { type: v })}>
                  <SelectTrigger className="h-8 w-[150px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {field.type === 'select' && (
                  <Input
                    className="h-8 w-52 text-xs"
                    placeholder="Opciones separadas por coma"
                    value={field.options}
                    onChange={(e) => updateField(index, { options: e.target.value })}
                  />
                )}
                <Input
                  className="h-8 flex-1 min-w-40 text-xs"
                  placeholder="Placeholder (opcional)"
                  value={field.placeholder}
                  onChange={(e) => updateField(index, { placeholder: e.target.value })}
                />
                <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <Switch checked={field.required} onCheckedChange={(v) => updateField(index, { required: v })} /> Obligatorio
                </label>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-[10px] font-black uppercase tracking-widest" onClick={addField}>
            <Plus className="size-3.5" /> Agregar campo
          </Button>
        </div>
        <div className="mt-4 flex justify-end">
          <Button size="sm" className="h-8 gap-1.5 text-[10px] font-black uppercase tracking-widest" onClick={() => void saveProtocol()} disabled={savingProtocol}>
            {savingProtocol ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />} Guardar protocolo
          </Button>
        </div>
      </div>
    </div>
  );
}

interface NormaRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

function NormaRow({ icon, title, description, checked, disabled, onCheckedChange }: NormaRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-bold">{title}</p>
          <p className="text-[10px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={Boolean(checked)} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}
