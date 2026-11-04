import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { cn } from '../ui/utils';
import { organizacionService, type OrgAccessLevel, type OrgUser } from '../../services/organizacion.service';
import { toast } from '../../services/toast';
import { Field, NativeSelect } from './OrgBits';
import { ACCESS_LEVELS, errorMessage, serifStyle } from './organizacion.utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: OrgUser[];
  /** Usuarios que ya tienen acceso (no se vuelven a ofrecer). */
  excludeIds: string[];
  onSaved: () => void;
}

export function AutorizarAccesoSheet(props: Props) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {props.open && <AutorizarAccesoForm {...props} />}
      </SheetContent>
    </Sheet>
  );
}

function AutorizarAccesoForm({ onOpenChange, users, excludeIds, onSaved }: Props) {
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState('');
  const [level, setLevel] = useState<OrgAccessLevel>('SHARED_EVENTS');
  const [allowTasks, setAllowTasks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => !excludeIds.includes(u.id) && (!q || `${u.name} ${u.email}`.toLowerCase().includes(q)));
  }, [users, excludeIds, search]);

  const save = async () => {
    if (!userId) return setError('Selecciona un usuario.');
    setSaving(true); setError('');
    try {
      await organizacionService.grantAccess({ granteeUserId: userId, level, allowPersonalTaskEdit: level === 'EDIT' && allowTasks });
      toast.success('Acceso guardado');
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e, 'No se pudo guardar el acceso'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
        <SheetHeader className="space-y-1 border-b border-border px-6 pb-4 pt-6 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Organización personal</p>
          <SheetTitle className="text-3xl text-primary dark:text-foreground" style={serifStyle}>Autorizar acceso</SheetTitle>
          <SheetDescription>Comparte únicamente la información permitida de tu agenda.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <Field label="Buscar usuario" htmlFor="acc-search" required>
            <Input id="acc-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre o correo" />
            <NativeSelect className="mt-2" value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="Usuario a autorizar" size={Math.min(5, Math.max(2, candidates.length))} style={{ height: 'auto' }}>
              {candidates.length === 0 && <option value="" disabled>Sin usuarios disponibles</option>}
              {candidates.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}
            </NativeSelect>
          </Field>

          <fieldset>
            <legend className="mb-2 text-[15px] font-semibold" style={serifStyle}>Nivel de acceso</legend>
            <div role="radiogroup" className="space-y-2">
              {ACCESS_LEVELS.map((l) => (
                <button key={l.id} type="button" role="radio" aria-checked={level === l.id} onClick={() => setLevel(l.id)}
                  className={cn('flex w-full items-start gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', level === l.id ? 'border-accent bg-accent/10' : 'border-border hover:bg-muted/40')}>
                  <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border', level === l.id ? 'border-primary bg-primary' : 'border-border')} aria-hidden="true">
                    {level === l.id && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                  </span>
                  <span><span className="block text-[14px] font-semibold">{l.title}</span><span className="block text-[12px] text-muted-foreground">{l.hint}</span></span>
                </button>
              ))}
            </div>
          </fieldset>

          <section aria-labelledby="acc-limits">
            <h3 id="acc-limits" className="mb-2 text-[15px] font-semibold" style={serifStyle}>Límites de visibilidad</h3>
            <div className="divide-y divide-border rounded-xl border border-border">
              <div className="flex items-center justify-between gap-3 px-3 py-2.5"><span className="text-[13px]">Aplicar solo a esta empresa</span><Switch checked disabled aria-label="Aplicar solo a esta empresa (siempre activo)" /></div>
              <div className="flex items-center justify-between gap-3 px-3 py-2.5"><span className="text-[13px]">Respetar permisos de eventos privados</span><Switch checked disabled aria-label="Respetar permisos de eventos privados (siempre activo)" /></div>
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <label htmlFor="acc-tasks" className="text-[13px]">Permitir edición de tareas personales</label>
                <Switch id="acc-tasks" checked={level === 'EDIT' && allowTasks} disabled={level !== 'EDIT'} onCheckedChange={setAllowTasks} />
              </div>
            </div>
            {level !== 'EDIT' && <p className="mt-1 text-[11px] text-muted-foreground">Solo disponible con el nivel «Ver y editar autorizados».</p>}
          </section>

          <p className="rounded-xl bg-accent/10 p-3 text-[12px]">
            <strong>Este acceso no reemplaza los permisos por empresa, rol o vista que ya establece NovaHub ERP.</strong>
          </p>
          {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[12px] text-destructive">{error}</p>}
        </div>

        <SheetFooter className="grid grid-cols-2 gap-3 border-t border-border px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={save} disabled={saving || !userId}>{saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Guardar acceso</Button>
        </SheetFooter>
    </>
  );
}
