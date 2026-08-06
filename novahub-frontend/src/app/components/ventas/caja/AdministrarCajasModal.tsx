import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Switch } from '../../ui/switch';
import { Badge } from '../../ui/badge';
import { Banknote, Plus, Loader2, Edit2, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { cajaService, type CashRegister, type CashClosureMode } from '../../../services/caja.service';
import { api, getApiErrorMessage } from '../../../services/api';
import { ConfirmDialog } from '../../ui/ConfirmDialog';

interface AdministrarCajasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistersChanged?: () => void;
  initialMode?: 'create-register';
  onInitialModeHandled?: () => void;
}

function toCajaPayload(form: Partial<CashRegister>) {
  return {
    name: String(form.name || '').trim(),
    code: String(form.code || '').trim(),
    location: String(form.location || '').trim(),
    branchId: form.branchId || undefined,
    isActive: form.isActive !== false,
  };
}

export function AdministrarCajasModal({ open, onOpenChange, onRegistersChanged, initialMode, onInitialModeHandled }: AdministrarCajasModalProps) {
  const [cajasList, setCajasList] = useState<CashRegister[]>([]);
  const [cajasLoading, setCajasLoading] = useState(false);
  const [isCajaFormOpen, setIsCajaFormOpen] = useState(false);
  const [cajaForm, setCajaForm] = useState<Partial<CashRegister>>({});
  const [sucursalesList, setSucursalesList] = useState<any[]>([]);

  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [accessCaja, setAccessCaja] = useState<CashRegister | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<Map<string, CashClosureMode>>(new Map());
  const [accessLoading, setAccessLoading] = useState(false);
  const [pendingDeleteCaja, setPendingDeleteCaja] = useState<CashRegister | null>(null);

  const fetchCajas = async () => {
    setCajasLoading(true);
    try {
      const res = await cajaService.getRegisters(true);
      setCajasList(Array.isArray(res) ? res : []);
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al cargar cajas'));
    } finally {
      setCajasLoading(false);
    }
  };

  const fetchSucursales = async () => {
    try {
      const res: any = await api.get('/sucursales');
      setSucursalesList(Array.isArray(res) ? res : (res?.data || []));
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (open) {
      Promise.resolve().then(fetchCajas);
      Promise.resolve().then(fetchSucursales);
    }
  }, [open]);

  useEffect(() => {
    if (!open || initialMode !== 'create-register') return;

    const timer = window.setTimeout(() => {
      onOpenChange(false);
      setCajaForm({ isActive: true });
      setIsCajaFormOpen(true);
      onInitialModeHandled?.();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [initialMode, onInitialModeHandled, onOpenChange, open]);

  const handleManageAccess = async (caja: CashRegister) => {
    onOpenChange(false);
    setAccessCaja(caja);
    setIsAccessModalOpen(true);
    setAccessLoading(true);
    try {
      const res = await cajaService.getRegisterAccess(caja.id!);
      setAllUsers(res.allUsers || []);
      const assignments = res.assignments || (res.assignedUserIds || []).map(userId => ({ userId, closureMode: 'NORMAL' as CashClosureMode }));
      setAssignedUsers(new Map(assignments.map(assignment => [assignment.userId, assignment.closureMode || 'NORMAL'])));
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al cargar accesos'));
    } finally {
      setAccessLoading(false);
    }
  };

  const handleSaveAccess = async () => {
    if (!accessCaja) return;
    try {
      await cajaService.updateRegisterAccess(accessCaja.id!, Array.from(assignedUsers.entries()).map(([userId, closureMode]) => ({ userId, closureMode })));
      toast.success('Accesos actualizados');
      setIsAccessModalOpen(false);
      onOpenChange(true);
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al guardar accesos'));
    }
  };

  const confirmDeleteCaja = async () => {
    if (!pendingDeleteCaja?.id) return;
    try {
      await cajaService.deleteRegister(pendingDeleteCaja.id);
      toast.success('Caja eliminada');
      setPendingDeleteCaja(null);
      fetchCajas();
      onRegistersChanged?.();
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al eliminar la caja'));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sales-modal sm:max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg font-black">
                <Banknote className="size-5 text-primary" /> Puntos de Venta (Cajas)
              </DialogTitle>
              <DialogDescription>Crea y gestiona las cajas para el sistema POS</DialogDescription>
            </div>
            <Button onClick={() => {
              onOpenChange(false);
              setCajaForm({ isActive: true });
              setIsCajaFormOpen(true);
            }} className="gap-2 mt-0 mr-8">
              <Plus className="size-4" /> Nueva Caja
            </Button>
          </DialogHeader>
          
          <div className="py-4 overflow-y-auto">
            {cajasLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="size-6 animate-spin text-primary" /></div>
            ) : (
              <div className="sales-responsive-table rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="px-4 py-3 text-left font-semibold">Código</th>
                      <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                      <th className="px-4 py-3 text-left font-semibold">Sucursal</th>
                      <th className="px-4 py-3 text-left font-semibold">Ubicación</th>
                      <th className="px-4 py-3 text-left font-semibold">Estado</th>
                      <th data-actions-column="compact" className="px-4 py-3 text-right font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {cajasList.map((caja) => {
                      const sucursal = sucursalesList.find(s => s.id === caja.branchId);
                      return (
                      <tr key={caja.id} className="hover:bg-muted/10">
                        <td className="px-4 py-3 font-medium">{caja.code}</td>
                        <td className="px-4 py-3">{caja.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{sucursal ? sucursal.name : 'No Asignada'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{caja.location || '-'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={caja.isActive ? 'default' : 'secondary'} className={caja.isActive ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : ''}>
                            {caja.isActive ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </td>
                         <td data-actions-column="compact" className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleManageAccess(caja)}>
                              <Users className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => {
                              onOpenChange(false);
                              setCajaForm({
                                id: caja.id,
                                name: caja.name,
                                code: caja.code,
                                location: caja.location || '',
                                branchId: caja.branchId,
                                isActive: caja.isActive !== false,
                              });
                              setIsCajaFormOpen(true);
                            }}>
                              <Edit2 className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setPendingDeleteCaja(caja)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )})}
                    {cajasList.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          No hay cajas creadas. Haz clic en "Nueva Caja" para empezar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDeleteCaja)}
        onOpenChange={open => { if (!open) setPendingDeleteCaja(null); }}
        title="¿Eliminar caja?"
        description={pendingDeleteCaja ? `La caja «${pendingDeleteCaja.name}» se eliminará y esta acción no se puede deshacer.` : undefined}
        confirmLabel="Eliminar caja"
        variant="destructive"
        onConfirm={confirmDeleteCaja}
      />

      {/* Modal Formulario de Caja */}
      <Dialog open={isCajaFormOpen} onOpenChange={(open) => {
        setIsCajaFormOpen(open);
        if (!open) onOpenChange(true);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cajaForm.id ? 'Editar Caja' : 'Nueva Caja'}</DialogTitle>
            <DialogDescription>Completa la información de la caja.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input value={cajaForm.code || ''} onChange={e => setCajaForm({...cajaForm, code: e.target.value})} placeholder="Ej. CJ-01" />
            </div>
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={cajaForm.name || ''} onChange={e => setCajaForm({...cajaForm, name: e.target.value})} placeholder="Caja Principal" />
            </div>
            <div className="space-y-2">
              <Label>Sucursal</Label>
              <Select value={cajaForm.branchId || ''} onValueChange={v => setCajaForm({...cajaForm, branchId: v})}>
                <SelectTrigger><SelectValue placeholder="Seleccione una Sucursal" /></SelectTrigger>
                <SelectContent>
                  {sucursalesList.map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ubicación</Label>
              <Input value={cajaForm.location || ''} onChange={e => setCajaForm({...cajaForm, location: e.target.value})} placeholder="Primer Piso" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Estado de la Caja</Label>
              <Switch checked={cajaForm.isActive} onCheckedChange={c => setCajaForm({...cajaForm, isActive: c})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCajaFormOpen(false)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!cajaForm.name || !cajaForm.code) return toast.error('Nombre y código son obligatorios');
              try {
                const payload = toCajaPayload(cajaForm);
                if (cajaForm.id) {
                  await cajaService.updateRegister(cajaForm.id, payload);
                  toast.success('Caja actualizada');
                } else {
                  await cajaService.createRegister(payload);
                  toast.success('Caja creada');
                }
                setIsCajaFormOpen(false);
                onOpenChange(true);
                fetchCajas();
                onRegistersChanged?.();
              } catch (e: any) {
                toast.error(getApiErrorMessage(e, 'Error al guardar la caja'));
              }
            }}>Guardar Caja</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Gestión de Accesos a Caja */}
      <Dialog open={isAccessModalOpen} onOpenChange={(open) => {
        setIsAccessModalOpen(open);
        if (!open) onOpenChange(true);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Accesos - {accessCaja?.name}</DialogTitle>
            <DialogDescription>Selecciona qué usuarios pueden usar esta caja</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {accessLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="size-6 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                {allUsers.map(user => {
                  const isAssigned = assignedUsers.has(user.id);
                  const closureMode = assignedUsers.get(user.id) || 'NORMAL';
                  return (
                    <div key={user.id} className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
                      <div>
                        <p className="font-medium text-sm">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAssigned && (
                          <Select
                            value={closureMode}
                            onValueChange={(value: CashClosureMode) => {
                              const next = new Map(assignedUsers);
                              next.set(user.id, value);
                              setAssignedUsers(next);
                            }}
                          >
                            <SelectTrigger className="h-8 w-[150px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NORMAL">Cierre normal</SelectItem>
                              <SelectItem value="BLIND">Cierre a ciegas</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <Switch
                          checked={isAssigned}
                          onCheckedChange={(checked) => {
                            const next = new Map(assignedUsers);
                            if (checked) next.set(user.id, 'NORMAL');
                            else next.delete(user.id);
                            setAssignedUsers(next);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                {allUsers.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">No hay usuarios disponibles</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAccessModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveAccess} disabled={accessLoading}>Guardar Accesos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
