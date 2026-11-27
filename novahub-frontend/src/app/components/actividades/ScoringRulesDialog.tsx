import { useEffect, useState } from 'react';
import { Loader2, Scale } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { tasksService } from '../../services/actividades.service';
import type { ActivityScoringConfig } from '../../types';

const FIELDS: Array<{ key: keyof ActivityScoringConfig; label: string }> = [
  { key: 'creditFirstPass', label: 'Aprobada a la primera' },
  { key: 'creditOneRebound', label: 'Con un rebote por error' },
  { key: 'creditManyRebounds', label: 'Con dos o más rebotes por error' },
];

/** Cuánto vale cada entrega según sus rebotes. Lo usa la puntuación de desempeño; solo lo cambia un administrador. */
export function ScoringRulesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setFailed(false);
    tasksService.getScoringConfig()
      .then((config) => { if (alive) setValues(Object.fromEntries(FIELDS.map((f) => [f.key, String(config?.[f.key] ?? '')]))); })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open]);

  const numbers = FIELDS.map((f) => (String(values[f.key] ?? '').trim() === '' ? Number.NaN : Number(values[f.key])));
  const inRange = numbers.every((n) => Number.isInteger(n) && n >= 0 && n <= 100);
  const ordered = inRange && numbers[1] <= numbers[0] && numbers[2] <= numbers[1];

  const save = async () => {
    try {
      setSaving(true);
      await tasksService.updateScoringConfig({ creditFirstPass: numbers[0], creditOneRebound: numbers[1], creditManyRebounds: numbers[2] });
      toast.success('Reglas de cumplimiento guardadas');
      onOpenChange(false);
    } catch (error) {
      const e = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(e?.response?.data?.message || e?.message || 'No se pudieron guardar las reglas');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-3xl border-border/60 bg-background p-0 shadow-2xl" data-testid="activities-scoring-dialog">
        <DialogHeader className="border-b border-border/50 px-6 py-5 text-left">
          <DialogTitle className="flex items-center gap-2 font-black tracking-tight"><Scale className="size-5 text-primary" />Reglas de cumplimiento</DialogTitle>
          <p className="text-xs leading-5 text-muted-foreground">Cuánto vale cada tarea entregada, de 0 a 100. Solo cuentan los rebotes marcados como «error o entrega incompleta».</p>
        </DialogHeader>
        <div className="grid gap-3 px-6 py-5">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="size-4 animate-spin" />Cargando reglas…</p>
          ) : failed ? (
            <p className="text-sm font-semibold text-destructive">No se pudieron cargar las reglas. Cierra y vuelve a intentarlo.</p>
          ) : FIELDS.map((field) => (
            <div key={field.key} className="flex items-center justify-between gap-3">
              <Label htmlFor={`scoring-${field.key}`} className="text-sm font-semibold text-foreground">{field.label}</Label>
              <div className="flex items-center gap-1.5">
                <Input id={`scoring-${field.key}`} data-testid={`activities-scoring-${field.key}`} type="number" min={0} max={100} step={1} inputMode="numeric" value={values[field.key] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} className="h-10 w-20 rounded-xl text-right text-sm" />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          ))}
          {!loading && !failed && !inRange && <p className="text-xs font-semibold text-destructive">Cada valor debe ser un número entero de 0 a 100.</p>}
          {!loading && !failed && inRange && !ordered && <p className="text-xs font-semibold text-destructive">Una entrega con más rebotes no puede valer más que una con menos.</p>}
        </div>
        <DialogFooter className="gap-2 border-t border-border/40 px-6 py-4">
          <Button type="button" variant="outline" className="rounded-xl" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" className="rounded-xl font-black uppercase tracking-widest" disabled={loading || failed || saving || !ordered} onClick={() => void save()} data-testid="activities-scoring-save">
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
