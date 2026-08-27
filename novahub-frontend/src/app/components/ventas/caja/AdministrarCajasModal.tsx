import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Switch } from '../../ui/switch';
import { Badge } from '../../ui/badge';
import { Banknote, Plus, Loader2, Edit2, Ban, Users } from 'lucide-react';
import { toast } from 'sonner';
import { cajaService, type CashRegister, type CashClosureMode } from '../../../services/caja.service';
import { getApiErrorMessage } from '../../../services/api';
import { SalesViewTutorial } from '../SalesViewTutorial';

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
    isActive: form.isActive !== false,
  };
}

export function AdministrarCajasModal({ open, onOpenChange, onRegistersChanged, initialMode, onInitialModeHandled }: AdministrarCajasModalProps) {
  const [cajasList, setCajasList] = useState<CashRegister[]>([]);
  const [cajasLoading, setCajasLoading] = useState(false);
  const [isCajaFormOpen, setIsCajaFormOpen] = useState(false);
  const [cajaForm, setCajaForm] = useState<Partial<CashRegister>>({});

  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [accessCaja, setAccessCaja] = useState<CashRegister | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<Map<string, CashClosureMode>>(new Map());
  const [accessLoading, setAccessLoading] = useState(false);

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

  useEffect(() => {
    if (open) {
      Promise.resolve().then(fetchCajas);
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

  const toggleCajaStatus = async (caja: CashRegister) => {
    if (!caja.id) return;
    try {
      await cajaService.updateRegister(caja.id, { isActive: !caja.isActive });
      toast.success(caja.isActive ? 'Caja inhabilitada' : 'Caja habilitada');
      fetchCajas();
      onRegistersChanged?.();
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al cambiar el estado de la caja'));
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
          
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4">
            {cajasLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="size-6 animate-spin text-primary" /></div>
            ) : (
              <div className="py-4">
                <div className="sales-responsive-table rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className="px-4 py-3 text-left font-semibold">Código</th>
                        <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                        <th className="px-4 py-3 text-left font-semibold">Ubicación</th>
                        <th className="px-4 py-3 text-left font-semibold">Estado</th>
                        <th data-actions-column="compact" className="px-4 py-3 text-right font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {cajasList.map((caja) => (
                        <tr key={caja.id} className="hover:bg-muted/10">
                          <td className="px-4 py-3 font-medium">{caja.code}</td>
                          <td className="px-4 py-3">{caja.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{caja.location || '-'}</td>
                          <td className="px-4 py-3">
                            <Badge variant={caja.isActive ? 'default' : 'secondary'} className={caja.isActive ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : ''}>
                              {caja.isActive ? 'Activa' : 'Inactiva'}
                            </Badge>
                          </td>
                           <td data-actions-column="compact" className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="icon" title="Gestionar accesos" onClick={() => handleManageAccess(caja)}>
                                <Users className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Editar caja" onClick={() => {
                                onOpenChange(false);
                                setCajaForm({
                                  id: caja.id,
                                  name: caja.name,
                                  code: caja.code,
                                  location: caja.location || '',
                                  isActive: caja.isActive !== false,
                                });
                                setIsCajaFormOpen(true);
                              }}>
                                <Edit2 className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                                title={caja.isActive ? 'Inhabilitar caja' : 'Habilitar caja'}
                                aria-label={caja.isActive ? 'Inhabilitar caja' : 'Habilitar caja'}
                                onClick={() => void toggleCajaStatus(caja)}
                              >
                                <Ban className="size-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {cajasList.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                            No hay cajas creadas. Haz clic en "Nueva Caja" para empezar.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Formulario de Caja */}
      <Dialog open={isCajaFormOpen} onOpenChange={(open) => {
        setIsCajaFormOpen(open);
        if (!open) onOpenChange(true);
      }}>
        <DialogContent>
          <DialogHeader data-tour="sales-form-title">
            <DialogTitle>{cajaForm.id ? 'Editar Caja' : 'Nueva Caja'}</DialogTitle>
            <DialogDescription>Completa la información de la caja. Quedará asociada a la sucursal activa.</DialogDescription>
            <SalesViewTutorial view="cash-registers" context="form" />
          </DialogHeader>
          <div className="space-y-4 py-4" data-tour="sales-form-data">
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input value={cajaForm.code || ''} onChange={e => setCajaForm({...cajaForm, code: e.target.value})} placeholder="Ej. CJ-01" />
            </div>
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={cajaForm.name || ''} onChange={e => setCajaForm({...cajaForm, name: e.target.value})} placeholder="Caja Principal" />
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              La caja no se vincula a una bodega. En Facturación por Caja seleccionarás la bodega de salida de cada producto.
            </div>
            <div className="space-y-2">
              <Label>Ubicación</Label>
              <Input value={cajaForm.location || ''} onChange={e => setCajaForm({...cajaForm, location: e.target.value})} placeholder="Primer Piso" />
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground" data-tour="sales-form-summary">
              Las cuentas contables de efectivo, tarjetas, transferencias, ingresos e IVA se configuran de forma global en Contabilidad → Configuración → Facturación por Caja.
            </div>
            <div className="flex items-center justify-between">
              <Label>Estado de la Caja</Label>
              <Switch checked={cajaForm.isActive} onCheckedChange={c => setCajaForm({...cajaForm, isActive: c})} />
            </div>
          </div>
          <DialogFooter data-tour="sales-form-actions">
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
