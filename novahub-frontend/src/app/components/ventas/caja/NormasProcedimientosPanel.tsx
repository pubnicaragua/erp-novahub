import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { ClipboardList, CalendarClock, AlertTriangle, CheckCircle2, ArrowDownToLine, ArrowUpFromLine, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cajaService } from '../../../services/caja.service';
import { getApiErrorMessage } from '../../../services/api';

const WEEKDAYS = [
  { index: 1, label: 'L' },
  { index: 2, label: 'M' },
  { index: 3, label: 'X' },
  { index: 4, label: 'J' },
  { index: 5, label: 'V' },
  { index: 6, label: 'S' },
  { index: 0, label: 'D' },
];

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export function NormasProcedimientosPanel() {
  const [norms, setNorms] = useState<any>(null);
  const [autoClose, setAutoClose] = useState<any>(null);
  const [normsLoading, setNormsLoading] = useState(false);
  const [savingNorms, setSavingNorms] = useState(false);
  const [savingAutoClose, setSavingAutoClose] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setNormsLoading(true);
      try {
        const [normsRes, autoCloseRes] = await Promise.all([cajaService.getCashNorms(), cajaService.getAutoCloseConfig()]);
        if (cancelled) return;
        setNorms(normsRes);
        setAutoClose(autoCloseRes);
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

  const saveAutoClose = async () => {
    if (!autoClose) return;
    setSavingAutoClose(true);
    try {
      const saved = await cajaService.updateAutoCloseConfig({ ...autoClose, days: Array.isArray(autoClose.days) ? autoClose.days.map(Number) : [] });
      setAutoClose(saved);
      toast.success('Cierre automático configurado');
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al guardar el cierre automático'));
    } finally {
      setSavingAutoClose(false);
    }
  };

  const daysMode = autoClose?.mode === 'month' ? 'month' : 'week';
  const activeDays = Array.isArray(autoClose?.days) ? autoClose.days.map(Number) : [];

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
            description="Si hay diferencia negativa, se notifica a la gerencia (ADMIN) para que determine el cobro al responsable."
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
          Cierra automáticamente las sesiones abiertas en los días y hora indicados. Las cajas en modo de cierre a ciegas se omiten (requieren arqueo del cajero).
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
                      title={day.label}
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
              <p className="text-xs font-bold">Hora del cierre</p>
              <p className="text-[10px] text-muted-foreground">Las sesiones abiertas se cerrarán a esta hora los días seleccionados.</p>
            </div>
            <Input
              type="time"
              className="h-8 w-32 text-xs"
              value={autoClose?.time || '20:00'}
              onChange={(e) => setAutoClose({ ...autoClose, time: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button size="sm" className="h-8 gap-1.5 text-[10px] font-black uppercase tracking-widest" onClick={() => void saveAutoClose()} disabled={savingAutoClose || !autoClose}>
            {savingAutoClose ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />} Guardar configuración
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
