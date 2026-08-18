import { useState, useEffect, useRef } from 'react';
import { Store, Plus, Trash2, Edit2, Loader2, MapPin, Users, X } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { api, getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { InventoryViewTutorial } from './InventoryViewTutorial';

function toSucursalPayload(form: any) {
  const warehouseIds = Array.isArray(form.warehouseIds) ? form.warehouseIds : [];
  const primaryWarehouseId =
    warehouseIds.includes(form.primaryWarehouseId) ? form.primaryWarehouseId : warehouseIds[0] || null;
  return {
    name: String(form.name || '').trim(),
    code: String(form.code || '').trim(),
    location: String(form.location || '').trim(),
    warehouseIds,
    primaryWarehouseId,
    isActive: form.isActive !== false,
  };
}

export function SucursalesView({
  warehouses,
  onRefresh,
  isModal = false,
  autoOpenCreate = false,
  onAutoOpenHandled,
  permissionModule = 'INVENTORY_WAREHOUSES',
}: {
  warehouses: any[];
  onRefresh: () => void;
  isModal?: boolean;
  autoOpenCreate?: boolean;
  onAutoOpenHandled?: () => void;
  permissionModule?: string;
}) {
  const { canPerform } = useAuth();
  const queryClient = useQueryClient();
  const canCreateBranch = canPerform(permissionModule, 'create');
  const canEditBranch = canPerform(permissionModule, 'edit');
  const canDeactivateBranch = canPerform(permissionModule, 'deactivate');
  const canAssignBranchUsers = canPerform(permissionModule, 'assign');
  const [branches, setBranches] = useState<any[]>([]);
  const [cajas, setCajas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailBranch, setDetailBranch] = useState<any | null>(null);
  const [usersDialogBranch, setUsersDialogBranch] = useState<any | null>(null);
  const [branchUsers, setBranchUsers] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingUsers, setSavingUsers] = useState(false);
  const autoOpenHandledRef = useRef(false);

  const fetchBranches = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const response: any = await api.get('/sucursales', { signal });
      const branchesData = Array.isArray(response) ? response : (response?.data || []);
      setBranches(branchesData);

      const cajasRes: any = await api.get('/caja/registers', { params: { all: 'true' }, signal });
      const cajasData = Array.isArray(cajasRes) ? cajasRes : (cajasRes?.data || []);
      setCajas(cajasData);
    } catch (e: any) {
      if (e?.name === 'AbortError' || signal?.aborted) return;
      toast.error(getApiErrorMessage(e, 'Error al cargar sucursales'));
    } finally {
      setLoading(false);
    }
  };

  const openUsersDialog = async (branch: any) => {
    if (!canAssignBranchUsers) return;
    setUsersDialogBranch(branch);
    setLoadingUsers(true);
    try {
      const res: any = await api.get(`/sucursales/${branch.id}/users`);
      const list = Array.isArray(res) ? res : (res?.data || []);
      setBranchUsers(list);
      setSelectedUserIds(new Set(list.filter((u: any) => u.assigned).map((u: any) => u.id)));
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al cargar usuarios'));
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const saveBranchUsers = async () => {
    if (!canAssignBranchUsers) return;
    if (!usersDialogBranch) return;
    setSavingUsers(true);
    try {
      await api.post(`/sucursales/${usersDialogBranch.id}/users`, { userIds: Array.from(selectedUserIds) });
      toast.success('Usuarios asignados correctamente');
      setUsersDialogBranch(null);
      fetchBranches();
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al asignar usuarios'));
    } finally {
      setSavingUsers(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void fetchBranches(controller.signal);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!autoOpenCreate || autoOpenHandledRef.current) return;
    autoOpenHandledRef.current = true;
    setForm({ warehouseIds: [], primaryWarehouseId: '', isActive: true });
    setIsFormOpen(true);
    onAutoOpenHandled?.();
  }, [autoOpenCreate, onAutoOpenHandled, warehouses]);

  const handleSave = async () => {
    if (form.id ? !canEditBranch : !canCreateBranch) return;
    if (!form.name || !form.code) {
      return toast.error('Nombre y código son requeridos');
    }
    if (!Array.isArray(form.warehouseIds) || form.warehouseIds.length === 0) {
      return toast.error('Selecciona al menos un almacén para la sucursal');
    }
    setSaving(true);
    try {
      const payload = toSucursalPayload(form);
      if (form.id) {
        await api.put(`/sucursales/${form.id}`, payload);
        toast.success('Sucursal actualizada');
      } else {
        await api.post('/sucursales', payload);
        toast.success('Sucursal creada');
      }
      setIsFormOpen(false);
      fetchBranches();
      await queryClient.invalidateQueries({ queryKey: ['accounting'] });
      window.dispatchEvent(new CustomEvent('sucursales-changed'));
      onRefresh?.();
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al guardar sucursal'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDeactivateBranch) return;
    if (!deleteId) return;
    try {
      await api.delete(`/sucursales/${deleteId}`);
      toast.success('Sucursal eliminada');
      fetchBranches();
      window.dispatchEvent(new CustomEvent('sucursales-changed'));
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al eliminar sucursal'));
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <Card className={isModal ? "border-none shadow-none bg-transparent" : "p-4 border bg-card rounded-xl"}>
      <div className={`flex min-w-0 flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between ${isModal ? 'pt-2' : ''}`} data-tour="inventory-branches-title">
        {!isModal ? (
          <div>
            <h3 className="font-black text-lg uppercase tracking-tight italic">Sucursales</h3>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              {branches?.length || 0} sucursales
            </p>
          </div>
        ) : <div />}
        <div className="flex flex-wrap items-center gap-2" data-tour="inventory-branches-actions">
        <InventoryViewTutorial label="Cómo gestionar sucursales" targetPrefix="inventory-branches" copy={{ data: { description: 'Consulta sucursales, almacenes vinculados, cajas y usuarios con acceso.' }, actions: { description: 'Crea, edita o asigna usuarios a una sucursal.' } }} />
        {canCreateBranch && <Button 
          size="sm" 
          onClick={() => { setForm({ warehouseIds: [], primaryWarehouseId: '', isActive: true }); setIsFormOpen(true); }}
          className="h-10 w-full rounded-xl border border-primary/20 bg-primary px-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 sm:w-auto"
        >
          <Plus className="mr-2 size-4" /> Agregar Sucursal
        </Button>}
        </div>
      </div>

      <div className={`grid min-w-0 grid-cols-1 gap-6 ${detailBranch ? 'lg:grid-cols-[13fr_7fr]' : 'lg:grid-cols-1'}`} data-tour="inventory-branches-data">
        <div className="min-w-0">
      <div className="space-y-3 lg:hidden">
        {loading ? <Card className="rounded-2xl p-8 text-center"><Loader2 className="mx-auto size-6 animate-spin text-primary" /></Card> : branches.length === 0 ? <Card className="rounded-2xl border-dashed p-8 text-center text-muted-foreground"><Store className="mx-auto mb-2 size-9 opacity-20" /><p>No hay sucursales</p></Card> : branches.map((branch) => {
          const assignedCajas = cajas.filter((caja) => caja.branchId === branch.id);
          return (
            <Card key={branch.id} className={`min-w-0 rounded-2xl border-border/50 bg-card/70 p-4 shadow-sm cursor-pointer ${detailBranch?.id === branch.id ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30' : ''}`} onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; setDetailBranch(branch); }}>
              <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-bold">{branch.name}</p><p className="mt-0.5 font-mono text-xs text-muted-foreground">{branch.code}</p></div><Badge variant={branch.isActive === false ? 'secondary' : 'default'}>{branch.isActive === false ? 'Inactiva' : 'Activa'}</Badge></div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/40 pt-3 text-xs sm:grid-cols-3"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Ubicación</p><p className="truncate">{branch.location || '—'}</p></div><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Almacenes</p><div className="flex flex-wrap gap-1">{((branch.warehouses || []) as any[]).map((w: any) => (<Badge key={w.id} variant={w.id === branch.primaryWarehouseId ? 'default' : 'secondary'} className={w.id === branch.primaryWarehouseId ? 'bg-primary/15 text-primary' : 'bg-muted/50'} title={w.id === branch.primaryWarehouseId ? 'Almacén primario' : ''}>{w.name}</Badge>))}</div></div><div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Cajas</p><p className="font-bold tabular-nums">{assignedCajas.length}</p></div></div>
              <div className="mt-3 flex justify-end gap-1 border-t border-border/40 pt-3">{canAssignBranchUsers && <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => openUsersDialog(branch)}><Users className="mr-1.5 size-3.5" /> Usuarios</Button>}{canEditBranch && <Button type="button" variant="ghost" size="icon" className="size-9" onClick={() => { setForm({ id: branch.id, name: branch.name, code: branch.code, location: branch.location || '', warehouseIds: (branch.warehouses || []).map((w: any) => w.id), primaryWarehouseId: branch.primaryWarehouseId || (branch.warehouses || [])[0]?.id || '', isActive: branch.isActive !== false }); setIsFormOpen(true); }} aria-label={`Editar ${branch.name}`}><Edit2 className="size-4" /></Button>}{canDeactivateBranch && <Button type="button" variant="ghost" size="icon" className="size-9 text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(branch.id)} aria-label={`Eliminar ${branch.name}`}><Trash2 className="size-4" /></Button>}</div>
            </Card>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border lg:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border/50">
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Código</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Nombre</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Ubicación</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Almacenes</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Cajas</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Usuarios</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="size-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : branches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <Store className="size-10 mx-auto mb-2 opacity-20" />
                  <p className="font-medium">No hay sucursales</p>
                </TableCell>
              </TableRow>
            ) : (
              branches.map(b => {
                const assignedCajas = cajas.filter(c => c.branchId === b.id);
                return (
                  <TableRow key={b.id} className={`cursor-pointer hover:bg-muted/30 ${detailBranch?.id === b.id ? 'bg-muted/40 ring-1 ring-border' : ''}`} onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; setDetailBranch(b); }}>
                    <TableCell className="font-medium">{b.code}</TableCell>
                    <TableCell>{b.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" /> {b.location || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {((b.warehouses || []) as any[]).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {((b.warehouses || []) as any[]).map(w => (
                            <Badge key={w.id} variant={w.id === b.primaryWarehouseId ? 'default' : 'secondary'} className={w.id === b.primaryWarehouseId ? 'bg-primary/15 text-primary' : 'bg-muted/50'} title={w.id === b.primaryWarehouseId ? 'Almacén primario' : ''}>{w.name}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {assignedCajas.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {assignedCajas.map(c => (
                            <Badge key={c.id} variant="secondary" className="text-[9px] bg-muted/50" title={c.name}>{c.code}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {canAssignBranchUsers && <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openUsersDialog(b)}>
                        <Users className="size-3.5" />
                        Gestionar
                      </Button>}
                    </TableCell>
                    <TableCell className="text-right">
                    {canEditBranch && <Button variant="ghost" size="icon" onClick={() => {
                      setForm({
                        id: b.id,
                        name: b.name,
                        code: b.code,
                        location: b.location || '',
                        warehouseIds: (b.warehouses || []).map((w: any) => w.id),
                        primaryWarehouseId: b.primaryWarehouseId || (b.warehouses || [])[0]?.id || '',
                        isActive: b.isActive !== false,
                      });
                      setIsFormOpen(true);
                    }}>
                      <Edit2 className="size-3.5" />
                    </Button>}
                    {canDeactivateBranch && <Button variant="ghost" size="icon" className="text-red-600 hover:bg-red-700 hover:text-white" onClick={() => setDeleteId(b.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>}
                  </TableCell>
                </TableRow>
              ); })
            )}
          </TableBody>
        </Table>
      </div>
        </div>
        {detailBranch && (
          <div className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Store className="size-4 text-muted-foreground" />
                  <h4 className="text-sm font-bold">Detalle de Sucursal</h4>
                </div>
                <Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => setDetailBranch(null)} title="Cerrar detalle" aria-label="Cerrar detalle">
                  <X className="size-3.5" />
                </Button>
              </div>
              <div className="max-h-[calc(100vh-6rem)] space-y-5 overflow-y-auto p-4 sm:p-5">
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Sucursal seleccionada</p>
                      <h3 className="mt-1 truncate text-lg font-black tracking-tight" title={detailBranch.name}>{detailBranch.name}</h3>
                    </div>
                    <Badge variant={detailBranch.isActive === false ? 'secondary' : 'default'} className="shrink-0">{detailBranch.isActive === false ? 'Inactiva' : 'Activa'}</Badge>
                  </div>
                </div>
                <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Código</p>
                    <p className="mt-1 font-mono text-sm font-bold">{detailBranch.code || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ubicación</p>
                    <p className="mt-1 truncate text-sm font-bold">{detailBranch.location || '—'}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Almacenes vinculados</p>
                  <div className="flex flex-wrap gap-1">
                    {((detailBranch.warehouses || []) as any[]).length > 0 ? (
                      ((detailBranch.warehouses || []) as any[]).map((w: any) => (
                        <Badge key={w.id} variant={w.id === detailBranch.primaryWarehouseId ? 'default' : 'secondary'} className={w.id === detailBranch.primaryWarehouseId ? 'bg-primary/15 text-primary' : 'bg-muted/50'} title={w.id === detailBranch.primaryWarehouseId ? 'Almacén primario' : ''}>{w.name}</Badge>
                      ))
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Sin almacenes</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cajas</p>
                  <div className="flex flex-wrap gap-1">
                    {cajas.filter((caja) => caja.branchId === detailBranch.id).length > 0 ? (
                      cajas.filter((caja) => caja.branchId === detailBranch.id).map((caja) => (
                        <Badge key={caja.id} variant="secondary" className="text-[9px] bg-muted/50" title={caja.name}>{caja.code}</Badge>
                      ))
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Sin cajas</Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader data-tour="inventory-branch-form-title">
            <DialogTitle>{form.id ? 'Editar' : 'Nueva'} Sucursal</DialogTitle>
            <DialogDescription>Completa la información de la sucursal.</DialogDescription>
            <InventoryViewTutorial label={form.id ? 'Cómo editar sucursal' : 'Cómo crear sucursal'} targetPrefix="inventory-branch-form" copy={{ data: { description: 'Completa código, nombre, ubicación, almacenes vinculados y almacén primario.' }, actions: { description: 'Guarda la sucursal para actualizar la estructura operativa.' } }} />
          </DialogHeader>
          <div className="space-y-4 py-4" data-tour="inventory-branch-form-data">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Código</label>
              <Input value={form.code || ''} onChange={e => setForm({...form, code: e.target.value})} placeholder="Ej. SUC-01" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nombre</label>
              <Input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nombre" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ubicación</label>
              <Input value={form.location || ''} onChange={e => setForm({...form, location: e.target.value})} placeholder="Dirección" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Almacenes</label>
              <div className="mt-2 space-y-1.5 rounded-lg border border-border/40 p-2">
                {warehouses.length === 0 ? (
                  <p className="p-2 text-center text-xs text-muted-foreground">No hay almacenes disponibles</p>
                ) : warehouses.map(w => {
                  const isSelected = (form.warehouseIds || []).includes(w.id);
                  const isPrimary = form.primaryWarehouseId === w.id;
                  return (
                    <div key={w.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          const next = new Set(form.warehouseIds || []);
                          if (checked) next.add(w.id); else next.delete(w.id);
                          const ids = Array.from(next);
                          setForm({
                            ...form,
                            warehouseIds: ids,
                            primaryWarehouseId: ids.includes(form.primaryWarehouseId) ? form.primaryWarehouseId : (ids[0] || ''),
                          });
                        }}
                      />
                      <span className="flex-1 text-sm">{w.name}</span>
                      {isSelected && (
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, primaryWarehouseId: w.id })}
                          className={`text-[10px] font-black uppercase tracking-widest rounded-md px-2 py-0.5 transition-colors ${isPrimary ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary'}`}
                          title="Marcar como almacén primario"
                        >
                          Primario
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter data-tour="inventory-branch-form-actions">
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
            {(form.id ? canEditBranch : canCreateBranch) && <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : 'Guardar'}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="¿Eliminar sucursal?"
        description="Esta acción eliminará la sucursal. Asegúrese de que no tenga cajas activas."
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />

      <Dialog open={!!usersDialogBranch} onOpenChange={(o) => !o && setUsersDialogBranch(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader data-tour="inventory-branch-users-title">
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-5" />
              Usuarios - {usersDialogBranch?.name}
            </DialogTitle>
            <DialogDescription>
              Selecciona los usuarios que tendrán acceso a esta sucursal.
            </DialogDescription>
            <InventoryViewTutorial label="Cómo asignar usuarios a sucursal" targetPrefix="inventory-branch-users" copy={{ data: { description: 'Activa los usuarios autorizados para operar en esta sucursal.' }, actions: { description: 'Guarda la selección para actualizar los accesos.' } }} />
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-1 py-2" data-tour="inventory-branch-users-data">
            {loadingUsers ? (
              <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>
            ) : branchUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No hay usuarios disponibles</p>
            ) : (
              branchUsers.map(u => (
                <label
                  key={u.id}
                  className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedUserIds.has(u.id)}
                    onChange={() => toggleUser(u.id)}
                    className="rounded border-input size-4"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <Badge variant={u.isActive ? 'default' : 'secondary'} className="text-[10px]">
                    {u.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </label>
              ))
            )}
          </div>
          <DialogFooter data-tour="inventory-branch-users-actions">
            <Button variant="outline" onClick={() => setUsersDialogBranch(null)}>Cancelar</Button>
            {canAssignBranchUsers && <Button onClick={saveBranchUsers} disabled={savingUsers}>
              {savingUsers && <Loader2 className="size-4 mr-1 animate-spin" />}
              Guardar
            </Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
