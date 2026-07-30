import { useState, useEffect, useRef } from 'react';
import { Store, Plus, Trash2, Edit2, Loader2, MapPin, Users } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { api, getApiErrorMessage } from '../../services/api';

function toSucursalPayload(form: any) {
  return {
    name: String(form.name || '').trim(),
    code: String(form.code || '').trim(),
    location: String(form.location || '').trim(),
    warehouseId: form.warehouseId,
    isActive: form.isActive !== false,
  };
}

export function SucursalesView({
  warehouses,
  isModal = false,
  autoOpenCreate = false,
  onAutoOpenHandled,
}: {
  warehouses: any[];
  onRefresh: () => void;
  isModal?: boolean;
  autoOpenCreate?: boolean;
  onAutoOpenHandled?: () => void;
}) {
  const [branches, setBranches] = useState<any[]>([]);
  const [cajas, setCajas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [usersDialogBranch, setUsersDialogBranch] = useState<any | null>(null);
  const [branchUsers, setBranchUsers] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingUsers, setSavingUsers] = useState(false);
  const autoOpenHandledRef = useRef(false);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const response: any = await api.get('/sucursales');
      const branchesData = Array.isArray(response) ? response : (response?.data || []);
      setBranches(branchesData);

      const cajasRes: any = await api.get('/caja/registers?all=true');
      const cajasData = Array.isArray(cajasRes) ? cajasRes : (cajasRes?.data || []);
      setCajas(cajasData);
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al cargar sucursales'));
    } finally {
      setLoading(false);
    }
  };

  const openUsersDialog = async (branch: any) => {
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
    fetchBranches();
  }, []);

  useEffect(() => {
    if (!autoOpenCreate || autoOpenHandledRef.current) return;
    autoOpenHandledRef.current = true;
    setForm({ warehouseId: warehouses[0]?.id || '', isActive: true });
    setIsFormOpen(true);
    onAutoOpenHandled?.();
  }, [autoOpenCreate, onAutoOpenHandled, warehouses]);

  const handleSave = async () => {
    if (!form.name || !form.code || !form.warehouseId) {
      return toast.error('Nombre, código y almacén padre son requeridos');
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
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al guardar sucursal'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/sucursales/${deleteId}`);
      toast.success('Sucursal eliminada');
      fetchBranches();
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al eliminar sucursal'));
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <Card className={isModal ? "border-none shadow-none bg-transparent" : "p-4 border bg-card rounded-xl"}>
      <div className={`flex items-center justify-between mb-4 ${isModal ? 'pt-2' : ''}`}>
        {!isModal ? (
          <div>
            <h3 className="font-black text-lg uppercase tracking-tight italic">Sucursales</h3>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              {branches?.length || 0} sucursales
            </p>
          </div>
        ) : <div />}
        <Button 
          size="sm" 
          onClick={() => { setForm({}); setIsFormOpen(true); }}
          className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-xl shadow-lg hover:-translate-y-0.5 transition-all font-black text-xs uppercase tracking-widest h-10 px-6"
        >
          <Plus className="mr-2 size-4" /> Agregar Sucursal
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border/50">
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Código</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Nombre</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Ubicación</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Almacén Padre</TableHead>
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
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.code}</TableCell>
                    <TableCell>{b.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" /> {b.location || '-'}
                      </div>
                    </TableCell>
                    <TableCell>{b.warehouse?.name || '-'}</TableCell>
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
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openUsersDialog(b)}>
                        <Users className="size-3.5" />
                        Gestionar
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => {
                      setForm({
                        id: b.id,
                        name: b.name,
                        code: b.code,
                        location: b.location || '',
                        warehouseId: b.warehouseId,
                        isActive: b.isActive !== false,
                      });
                      setIsFormOpen(true);
                    }}>
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-600 hover:bg-red-500 hover:text-white" onClick={() => setDeleteId(b.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ); })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar' : 'Nueva'} Sucursal</DialogTitle>
            <DialogDescription>Completa la información de la sucursal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Almacén Padre</label>
              <Select value={form.warehouseId || ''} onValueChange={v => setForm({...form, warehouseId: v})}>
                <SelectTrigger><SelectValue placeholder="Seleccione un almacén" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : 'Guardar'}</Button>
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
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-5" />
              Usuarios - {usersDialogBranch?.name}
            </DialogTitle>
            <DialogDescription>
              Selecciona los usuarios que tendrán acceso a esta sucursal.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-1 py-2">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setUsersDialogBranch(null)}>Cancelar</Button>
            <Button onClick={saveBranchUsers} disabled={savingUsers}>
              {savingUsers && <Loader2 className="size-4 mr-1 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
