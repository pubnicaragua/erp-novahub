import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { cn } from '../../ui/utils';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { orgDocumentsService, type OrgDocAudience, type OrgDocPermission, type OrgDocumentDetail } from '../../../services/org-documents.service';
import { toast } from '../../../services/toast';
import { Field, NativeSelect, controlClass } from '../OrgBits';
import { AUDIENCE_LABEL, PERMISSION_LABEL } from './labels';
import { errorMessage } from '../organizacion.utils';

/** Con quién se comparte un documento y con qué permiso (ver o editar). */
export function ShareDialog({ doc, users, onClose, onSaved }: { doc: OrgDocumentDetail; users: Array<{ id: string; name: string }>; onClose: () => void; onSaved: (detail: OrgDocumentDetail) => void }) {
  const { user } = useAuth();
  const [audience, setAudience] = useState<OrgDocAudience>(doc.audience);
  const [permission, setPermission] = useState<OrgDocPermission>(doc.permission);
  const [ids, setIds] = useState<string[]>(doc.audienceUserIds);
  const [departmentId, setDepartmentId] = useState(doc.departmentId ?? '');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const departments = useTenantQuery(['org-documents', 'departments'], (signal) => orgDocumentsService.departments(signal), { staleTime: 5 * 60_000, enabled: audience === 'DEPARTMENT' });

  const others = users.filter((u) => u.id !== doc.ownerId && u.id !== user?.id);
  const shown = others.filter((u) => u.name.toLowerCase().includes(query.trim().toLowerCase()));
  const valid = audience === 'PRIVATE' || (audience === 'USERS' && ids.length > 0) || (audience === 'DEPARTMENT' && !!departmentId) || audience === 'TEAM';

  const save = async () => {
    setBusy(true);
    try {
      const saved = await orgDocumentsService.update(doc.id, { audience, permission, audienceUserIds: audience === 'USERS' ? ids : [], departmentId: audience === 'DEPARTMENT' ? departmentId : null });
      toast.success('Se actualizó con quién compartes');
      onSaved(saved);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="break-words pr-6">Compartir «{doc.title}»</DialogTitle>
          <DialogDescription>Tú decides quién lo ve y si puede editarlo. Los cambios se aplican al guardar.</DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className="text-[12px] font-semibold">¿Quién lo ve?</legend>
          <div role="radiogroup" aria-label="Quién lo ve" className="flex flex-wrap gap-2">
            {(Object.keys(AUDIENCE_LABEL) as OrgDocAudience[]).map((value) => (
              <button key={value} type="button" role="radio" aria-checked={audience === value} onClick={() => setAudience(value)}
                className={cn('rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition', audience === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted/50')}>{AUDIENCE_LABEL[value]}</button>
            ))}
          </div>
        </fieldset>

        {audience === 'USERS' && (
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <input aria-label="Buscar persona" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar persona…" className={cn(controlClass, 'h-8 max-w-[220px] text-[12px]')} />
              <button type="button" className="text-[12px] font-semibold text-primary underline dark:text-accent" onClick={() => setIds(Array.from(new Set([...ids, ...shown.map((u) => u.id)])))}>Elegir {query.trim() ? 'las que se ven' : 'a todas'}</button>
              <button type="button" className="text-[12px] font-semibold text-muted-foreground underline" onClick={() => setIds([])}>Quitar todas</button>
              <span className="text-[12px] text-muted-foreground">{ids.length} elegidas</span>
            </div>
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {shown.map((u) => <li key={u.id}><label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[13px] hover:bg-muted/50"><input type="checkbox" checked={ids.includes(u.id)} onChange={() => setIds((cur) => (cur.includes(u.id) ? cur.filter((x) => x !== u.id) : [...cur, u.id]))} />{u.name}</label></li>)}
              {shown.length === 0 && <li className="px-2 py-1 text-[12px] text-muted-foreground">{others.length === 0 ? 'No hay más personas activas en tu empresa.' : 'Nadie coincide con la búsqueda.'}</li>}
            </ul>
          </div>
        )}

        {audience === 'DEPARTMENT' && (
          <Field label="Departamento" htmlFor="doc-department" required hint="Lo ve quien pertenece a ese departamento.">
            <NativeSelect id="doc-department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} disabled={departments.isLoading}>
              <option value="">{departments.isLoading ? 'Cargando…' : 'Elige un departamento'}</option>
              {(departments.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </NativeSelect>
          </Field>
        )}

        {audience !== 'PRIVATE' && (
          <fieldset className="space-y-2">
            <legend className="text-[12px] font-semibold">¿Qué pueden hacer?</legend>
            <div role="radiogroup" aria-label="Permiso" className="flex flex-wrap gap-2">
              {(Object.keys(PERMISSION_LABEL) as OrgDocPermission[]).map((value) => (
                <button key={value} type="button" role="radio" aria-checked={permission === value} onClick={() => setPermission(value)}
                  className={cn('rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition', permission === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted/50')}>{PERMISSION_LABEL[value]}</button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">Quien edita no puede cambiar con quién se comparte; eso solo lo hace quien lo creó o administra Organización.</p>
          </fieldset>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="button" onClick={() => void save()} disabled={busy || !valid}>{busy && <Loader2 className="size-4 animate-spin" />}Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
