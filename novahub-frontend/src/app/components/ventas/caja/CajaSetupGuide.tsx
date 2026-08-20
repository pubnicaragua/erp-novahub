import { useEffect, useMemo, useState, useCallback } from 'react';
import { Banknote, CheckCircle2, Loader2, Warehouse } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { getApiErrorMessage } from '../../../services/api';
import { cajaService, type CashRegister } from '../../../services/caja.service';
import { inventoryService } from '../../../services/inventario.service';
import { useAuth } from '../../../contexts/AuthContext';

type SetupModal = 'warehouse' | 'register' | null;

interface SetupGuideProps {
  registers: CashRegister[];
  selectedRegister: string;
  onSelectRegister: (id: string) => void;
  onRegistersChanged: () => Promise<void> | void;
  onOpenManageCajas: () => void;
}

const initialWarehouseForm = { name: '', location: '', type: 'STORE' };
const initialRegisterForm = { name: '', code: '', location: '', warehouseId: '' };

export function CajaSetupGuide({
  registers,
  selectedRegister,
  onSelectRegister,
  onRegistersChanged,
  onOpenManageCajas,
}: SetupGuideProps) {
  const { canPerform } = useAuth();
  const canViewInventory = canPerform('INVENTORY', 'view');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [modal, setModal] = useState<SetupModal>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [warehouseForm, setWarehouseForm] = useState(initialWarehouseForm);
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);

  const loadSetupData = useCallback(async () => {
    setLoading(true);
    if (!canViewInventory) {
      setWarehouses([]);
      setLoading(false);
      return;
    }
    try {
      const warehouseRes = await inventoryService.getWarehouses();
      const nextWarehouses = Array.isArray(warehouseRes) ? warehouseRes : ((warehouseRes as any)?.data || []);

      setWarehouses(nextWarehouses);
      setRegisterForm((current) => ({ ...current, warehouseId: current.warehouseId || nextWarehouses[0]?.id || '' }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cargar la configuracion inicial de caja'));
    } finally {
      setLoading(false);
    }
  }, [canViewInventory]);

  useEffect(() => {
    const timer = window.setTimeout(loadSetupData, 0);
    return () => window.clearTimeout(timer);
  }, [loadSetupData]);

  const nextStep = useMemo<SetupModal>(() => {
    if (warehouses.length === 0) return 'warehouse';
    if (registers.length === 0) return 'register';
    if (!selectedRegister || selectedRegister === 'ALL') return 'register';
    return null;
  }, [registers.length, selectedRegister, warehouses.length]);

  if (loading) {
    return (
      <Card className="border-border/60 shadow-sm">
        <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Revisando configuracion de caja...
        </CardContent>
      </Card>
    );
  }

  if (!canViewInventory || !nextStep) return null;

  const openNextStep = () => {
    if (nextStep === 'register') {
      if (registers.length > 0) {
        onSelectRegister(registers[0].id);
      } else {
        onOpenManageCajas();
      }
      return;
    }
    setModal(nextStep);
  };

  const completeStep = async (action: () => Promise<void>, successMessage: string) => {
    setSaving(true);
    try {
      await action();
      toast.success(successMessage);
      setModal(null);
      await loadSetupData();
      await onRegistersChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo completar el paso'));
    } finally {
      setSaving(false);
    }
  };

  const createWarehouse = () => completeStep(async () => {
    const payload = {
      name: warehouseForm.name.trim(),
      location: warehouseForm.location.trim(),
      type: warehouseForm.type,
      parentId: null,
    };
    if (!payload.name) throw new Error('Escribe el nombre del almacen.');
    await inventoryService.createWarehouse(payload);
    setWarehouseForm(initialWarehouseForm);
  }, 'Almacen creado');

  const createRegister = () => completeStep(async () => {
    const payload = {
      name: registerForm.name.trim(),
      code: registerForm.code.trim(),
      location: registerForm.location.trim(),
      warehouseId: registerForm.warehouseId,
      isActive: true,
    };
    if (!payload.name || !payload.code || !payload.warehouseId) {
      throw new Error('Completa nombre, codigo y bodega para crear la caja.');
    }
    const created = await cajaService.createRegister(payload);
    onSelectRegister(created.id);
    setRegisterForm({ ...initialRegisterForm, warehouseId: warehouses[0]?.id || '' });
  }, 'Caja creada');

  const steps = [
    { key: 'warehouse', label: 'Bodega operativa', done: warehouses.length > 0, icon: Warehouse },
    { key: 'register', label: 'Caja activa', done: registers.length > 0, icon: Banknote },
  ];

  const pendingSteps = steps.filter((step) => !step.done);
  const allDone = pendingSteps.length === 0;

  return (
    <>
      <Card className="border-border/60 bg-gradient-to-br from-background via-muted/20 to-primary/5 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-black">{allDone ? 'Caja lista para operar' : 'Configurar caja paso a paso'}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {allDone
              ? 'Bodega y caja están configuradas. Solo falta seleccionar la caja con la que vas a operar.'
              : 'Para aperturar caja se necesita una bodega operativa y una caja. Completa el siguiente paso aquí mismo.'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {pendingSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/70 p-3">
                  <Icon className="size-5 text-primary" />
                  <div>
                    <p className="text-sm font-bold">{step.label}</p>
                    <p className="text-xs text-muted-foreground">Pendiente</p>
                  </div>
                </div>
              );
            })}
            {allDone && (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                <CheckCircle2 className="size-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-bold">Todo configurado</p>
                  <p className="text-xs text-muted-foreground">Listo</p>
                </div>
              </div>
            )}
          </div>
          <Button onClick={openNextStep} className="gap-2">
            {nextStep === 'warehouse' && 'Crear almacen ahora'}
            {nextStep === 'warehouse' && 'Crear bodega ahora'}
            {nextStep === 'register' && (registers.length > 0 ? 'Seleccionar caja disponible' : 'Crear caja ahora')}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={modal === 'warehouse'} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear almacen</DialogTitle>
            <DialogDescription>Esta bodega será la base de inventario de la sucursal operativa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={warehouseForm.name} onChange={(event) => setWarehouseForm({ ...warehouseForm, name: event.target.value })} placeholder="Almacen principal" />
            </div>
            <div className="space-y-2">
              <Label>Ubicacion</Label>
              <Input value={warehouseForm.location} onChange={(event) => setWarehouseForm({ ...warehouseForm, location: event.target.value })} placeholder="Direccion o referencia" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
            <Button onClick={createWarehouse} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : 'Guardar almacen'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === 'register'} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear caja</DialogTitle>
            <DialogDescription>La caja queda lista para aperturarse desde Control de Caja.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Codigo</Label>
                <Input value={registerForm.code} onChange={(event) => setRegisterForm({ ...registerForm, code: event.target.value })} placeholder="CJ-01" />
              </div>
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={registerForm.name} onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value })} placeholder="Caja principal" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Bodega</Label>
              <Select value={registerForm.warehouseId} onValueChange={(value) => setRegisterForm({ ...registerForm, warehouseId: value })}>
                <SelectTrigger><SelectValue placeholder="Selecciona bodega" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ubicacion</Label>
              <Input value={registerForm.location} onChange={(event) => setRegisterForm({ ...registerForm, location: event.target.value })} placeholder="Mostrador principal" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
            <Button onClick={createRegister} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : 'Guardar caja'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
