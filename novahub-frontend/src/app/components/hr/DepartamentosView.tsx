import { useMemo, useState } from 'react';
import { Building2, Check, Edit2, Mail, Plus, Search, Trash2, UserRound, UserRoundCheck, UsersRound } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useAuth } from '../../contexts/AuthContext';
import { hrService } from '../../services/hr.service';
import { HRViewTutorial } from './HRViewTutorial';

interface DepartmentForm {
  code: string;
  name: string;
  description: string;
  headUserIds: string[];
}

const emptyForm: DepartmentForm = {
  code: '',
  name: '',
  description: '',
  headUserIds: [],
};

const initials = (name: string) => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase())
  .join('') || '?';

export function DepartamentosView({ departments = [], users = [], onRefresh }: any) {
  const { canPerform } = useAuth();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DepartmentForm>(emptyForm);
  const [headSearch, setHeadSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = canPerform('HR_EMPLOYEES', 'create');
  const canEdit = canPerform('HR_EMPLOYEES', 'edit');
  const canDelete = canPerform('HR_EMPLOYEES', 'delete');
  const activeUsers = useMemo(
    () => users.filter((user: any) => user?.isActive !== false),
    [users],
  );
  const filteredUsers = useMemo(() => {
    const term = headSearch.trim().toLowerCase();
    if (!term) return activeUsers;
    return activeUsers.filter((user: any) => `${user.name || ''} ${user.email || ''}`.toLowerCase().includes(term));
  }, [activeUsers, headSearch]);
  const assignedUsers = useMemo(
    () => activeUsers.filter((user: any) => form.headUserIds.includes(user.id)),
    [activeUsers, form.headUserIds],
  );
  const availableUsers = useMemo(
    () => filteredUsers.filter((user: any) => !form.headUserIds.includes(user.id)),
    [filteredUsers, form.headUserIds],
  );

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, code: `DEP-${String(Date.now()).slice(-5)}` });
    setHeadSearch('');
    setEditorOpen(true);
  };

  const openEdit = (department: any) => {
    setEditingId(department.id);
    setForm({
      code: department.code || '',
      name: department.name || '',
      description: department.description || '',
      headUserIds: (department.departmentHeads || [])
        .map((head: any) => head.userId || head.user?.id)
        .filter(Boolean),
    });
    setHeadSearch('');
    setEditorOpen(true);
  };

  const toggleHead = (userId: string) => {
    setForm((current) => ({
      ...current,
      headUserIds: current.headUserIds.includes(userId)
        ? current.headUserIds.filter((id) => id !== userId)
        : [...current.headUserIds, userId],
    }));
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const code = form.code.trim().toUpperCase();
    if (!name) {
      toast.error('Ingresa el nombre del departamento');
      return;
    }
    if (!code) {
      toast.error('Ingresa el código del departamento');
      return;
    }

    try {
      setSaving(true);
      const payload = { code, name, description: form.description.trim() || null, headUserIds: form.headUserIds };
      if (editingId) {
        await hrService.updateDepartment(editingId, payload);
        toast.success('Departamento actualizado');
      } else {
        await hrService.createDepartment(payload);
        toast.success('Departamento creado');
      }
      setEditorOpen(false);
      onRefresh?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo guardar el departamento');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      setDeleting(true);
      await hrService.deleteDepartment(pendingDeleteId);
      toast.success('Departamento eliminado');
      setPendingDeleteId(null);
      onRefresh?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo eliminar el departamento');
    } finally {
      setDeleting(false);
    }
  };

  const departmentToDelete = departments.find((department: any) => department.id === pendingDeleteId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end" data-tour="hr-departments-title">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            <h2 className="text-xl font-black uppercase tracking-tight">Departamentos</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Organiza las áreas de tu empresa y asigna uno o varios usuarios como jefes de cada departamento.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-tour="hr-departments-actions">
          {canCreate && (
            <Button type="button" onClick={openCreate} className="h-10 shrink-0 gap-2 rounded-xl border border-primary/20 bg-primary px-4 text-[10px] font-black uppercase tracking-widest !text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90">
              <Plus className="size-4" /> Nuevo departamento
            </Button>
          )}
          <HRViewTutorial label="Cómo gestionar departamentos" targetPrefix="hr-departments" copy={{ data: { description: 'Consulta las áreas, códigos, empleados y jefes asignados.' }, actions: { description: 'Crea, edita o desactiva departamentos según tus permisos.' } }} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-tour="hr-departments-data">
        {departments.map((department: any, index: number) => {
          const heads = department.departmentHeads || [];
          return (
            <motion.div key={department.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
              <Card className="h-full overflow-hidden rounded-2xl border-border/50 shadow-sm transition-shadow hover:shadow-md">
                <CardHeader className="border-b border-border/40 bg-muted/10 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Building2 className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base font-black">{department.name}</CardTitle>
                        <Badge variant="outline" className="mt-1 font-mono text-[10px] uppercase tracking-widest">{department.code}</Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {canEdit && <Button type="button" variant="ghost" size="icon" className="size-8 rounded-lg" title="Editar departamento" aria-label={`Editar ${department.name}`} onClick={() => openEdit(department)}><Edit2 className="size-4" /></Button>}
                      {canDelete && <Button type="button" variant="ghost" size="icon" className="size-8 rounded-lg" title="Eliminar departamento" aria-label={`Eliminar ${department.name}`} onClick={() => setPendingDeleteId(department.id)}><Trash2 className="size-4" /></Button>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-5">
                  <p className="min-h-10 text-sm text-muted-foreground">{department.description || 'Sin descripción registrada.'}</p>
                  <div className="flex items-center gap-4 border-t border-border/40 pt-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><UsersRound className="size-3.5" /> {department._count?.employees ?? department.employees?.length ?? 0} empleados</span>
                    <span className="inline-flex items-center gap-1.5"><UserRound className="size-3.5" /> {heads.length} {heads.length === 1 ? 'jefe' : 'jefes'}</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Jefes de departamento</p>
                    {heads.length ? (
                      <div className="space-y-2">
                        {heads.map((head: any) => (
                          <div key={head.id || head.userId} className="flex min-w-0 items-center gap-2 rounded-xl border border-border/40 bg-muted/10 px-3 py-2">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">{initials(head.user?.name || '')}</div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold">{head.user?.name || 'Usuario'}</p>
                              <p className="truncate text-[10px] text-muted-foreground">{head.user?.email || 'Sin correo'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/60 px-3 py-3 text-xs text-muted-foreground">No hay jefes asignados.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {!departments.length && (
        <Card className="rounded-2xl border-dashed border-border/70">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Building2 className="size-7" /></div>
            <p className="font-black">Aún no hay departamentos</p>
            <p className="max-w-md text-sm text-muted-foreground">Crea el primer departamento y define quiénes podrán gestionarlo como jefes.</p>
            {canCreate && <Button type="button" onClick={openCreate} className="mt-2 rounded-xl"><Plus className="size-4" /> Crear departamento</Button>}
          </CardContent>
        </Card>
      )}

      <Dialog open={editorOpen} onOpenChange={(open) => { if (!saving) setEditorOpen(open); }}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-3xl p-0">
          <DialogHeader className="border-b border-border/40 px-6 py-5" data-tour="hr-department-form-title">
            <DialogTitle className="flex items-center gap-2 text-xl font-black"><Building2 className="size-5 text-primary" /> {editingId ? 'Editar departamento' : 'Nuevo departamento'}</DialogTitle>
            <DialogDescription>Define los datos del área y selecciona uno o varios usuarios activos como jefes.</DialogDescription>
            <HRViewTutorial label={editingId ? 'Cómo editar departamento' : 'Cómo crear departamento'} targetPrefix="hr-department-form" stepKeys={['title', 'data', 'items', 'actions']} copy={{ data: { description: 'Completa nombre, código y descripción del área.' }, items: { title: 'Jefes del departamento', description: 'Selecciona usuarios activos como responsables del departamento.' }, actions: { description: 'Guarda el departamento y sus jefes asignados.' } }} />
          </DialogHeader>
          <div className="space-y-5 px-6 py-5" data-tour="hr-department-form-data">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
              <div className="space-y-2"><Label htmlFor="department-name">Nombre del departamento</Label><Input id="department-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. Ventas" autoFocus /></div>
              <div className="space-y-2"><Label htmlFor="department-code">Código</Label><Input id="department-code" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder="Ej. VEN" /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="department-description">Descripción</Label><Textarea id="department-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Responsabilidad principal del departamento" rows={3} /></div>

            <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/[0.03] p-4" data-tour="hr-department-form-items">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <Label className="text-sm font-black">Jefes de departamento</Label>
                  <p className="mt-1 text-xs text-muted-foreground">Los jefes son usuarios con acceso. Un usuario puede tener o no un empleado vinculado.</p>
                </div>
                <Badge variant="outline" className="w-fit">{form.headUserIds.length} seleccionados</Badge>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600"><UserRoundCheck className="size-3.5" /> Jefes asignados</p><Badge variant="secondary" className="text-[9px]">{assignedUsers.length}</Badge></div>
                  <div className="grid max-h-48 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {!assignedUsers.length && <p className="col-span-full rounded-xl border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">Aún no hay jefes asignados.</p>}
                    {assignedUsers.map((user: any) => (
                      <button key={user.id} type="button" aria-pressed onClick={() => toggleHead(user.id)} className="flex min-w-0 items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2.5 text-left transition-colors hover:bg-emerald-500/[0.08]">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">{initials(user.name || '')}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{user.name}</span><span className="flex min-w-0 items-center gap-1 truncate text-[10px] text-muted-foreground"><Mail className="size-3 shrink-0" />{user.email}</span><span className="mt-1 inline-flex rounded-full border border-border/60 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">{user.employee?.id ? 'Usuario + empleado' : 'Usuario sin empleado'}</span></span>
                        <Check className="size-4 shrink-0 text-emerald-600" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-border/40 pt-4">
                  <div className="mb-2 flex items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><UsersRound className="size-3.5" /> Usuarios disponibles</p><Badge variant="secondary" className="text-[9px]">{availableUsers.length}</Badge></div>
                  <div className="relative mb-2"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={headSearch} onChange={(event) => setHeadSearch(event.target.value)} placeholder="Buscar usuario por nombre o correo" className="pl-9" /></div>
                  <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {availableUsers.map((user: any) => (
                      <button key={user.id} type="button" aria-pressed={false} onClick={() => toggleHead(user.id)} className="flex min-w-0 items-center gap-3 rounded-xl border border-border/50 bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/40">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-black text-muted-foreground">{initials(user.name || '')}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{user.name}</span><span className="flex min-w-0 items-center gap-1 truncate text-[10px] text-muted-foreground"><Mail className="size-3 shrink-0" />{user.email}</span><span className="mt-1 inline-flex rounded-full border border-border/60 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">{user.employee?.id ? 'Usuario + empleado' : 'Usuario sin empleado'}</span></span>
                        <Plus className="size-4 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                  {!availableUsers.length && <p className="mt-2 rounded-xl border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">No hay usuarios disponibles que coincidan con la búsqueda.</p>}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 px-6 py-4" data-tour="hr-department-form-actions">
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear departamento'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Eliminar departamento"
        description={`Se desactivará ${departmentToDelete?.name || 'este departamento'}. Los jefes asignados dejarán de estar vinculados.`}
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
