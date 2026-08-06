import { useEffect, useMemo, useState, useCallback } from 'react';
import { Banknote, CheckCircle2, Loader2, Store, Warehouse } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { api, getApiErrorMessage } from '../../../services/api';
import { cajaService, type CashRegister } from '../../../services/caja.service';
import { inventoryService } from '../../../services/inventario.service';

type SetupModal = 'warehouse' | 'branch' | 'register' | null;

interface SetupGuideProps {
  registers: CashRegister[];
  selectedRegister: string;
  onSelectRegister: (id: string) => void;
  onRegistersChanged: () => Promise<void> | void;
}

const initialWarehouseForm = { name: '', location: '', type: 'STORE' };
const initialBranchForm = { name: '', code: '', location: '', warehouseId: '' };
const initialRegisterForm = { name: '', code: '', location: '', branchId: '' };

export function CajaSetupGuide({
  registers,
  selectedRegister,
  onSelectRegister,
  onRegistersChanged,
}: SetupGuideProps) {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [modal, setModal] = useState<SetupModal>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [warehouseForm, setWarehouseForm] = useState(initialWarehouseForm);
  const [branchForm, setBranchForm] = useState(initialBranchForm);
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);

  const loadSetupData = useCallback(async () => {
    setLoading(true);
    try {
      const [warehouseRes, branchRes] = await Promise.all([
        inventoryService.getWarehouses(),
        api.get<any[]>('/sucursales'),
      ]);
      const nextWarehouses = Array.isArray(warehouseRes) ? warehouseRes : ((warehouseRes as any)?.data || []);
      const nextBranches = Array.isArray(branchRes) ? branchRes : ((branchRes as any)?.data || []);

      setWarehouses(nextWarehouses);
      setBranches(nextBranches);
      setBranchForm((current) => ({ ...current, warehouseId: current.warehouseId || nextWarehouses[0]?.id || '' }));
      setRegisterForm((current) => ({ ...current, branchId: current.branchId || nextBranches[0]?.id || '' }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cargar la configuracion inicial de caja'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadSetupData, 0);
    return () => window.clearTimeout(timer);
  }, [loadSetupData]);

  const nextStep = useMemo<SetupModal>(() => {
    if (warehouses.length === 0) return 'warehouse';
    if (branches.length === 0) return 'branch';
    if (registers.length === 0) return 'register';
    if (!selectedRegister || selectedRegister === 'ALL') return 'register';
    return null;
  }, [branches.length, registers.length, selectedRegister, warehouses.length]);

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

  if (!nextStep) return null;

  const openNextStep = () => {
    if (nextStep === 'register' && registers.length > 0) {
      onSelectRegister(registers[0].id);
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

  const createBranch = () => completeStep(async () => {
    const payload = {
      name: branchForm.name.trim(),
      code: branchForm.code.trim(),
      location: branchForm.location.trim(),
      warehouseId: branchForm.warehouseId,
      isActive: true,
    };
    if (!payload.name || !payload.code || !payload.warehouseId) {
      throw new Error('Completa nombre, codigo y almacen para crear la sucursal.');
    }
    await api.post('/sucursales', payload);
    setBranchForm({ ...initialBranchForm, warehouseId: warehouses[0]?.id || '' });
  }, 'Sucursal creada');

  const createRegister = () => completeStep(async () => {
    const payload = {
      name: registerForm.name.trim(),
      code: registerForm.code.trim(),
      location: registerForm.location.trim(),
      branchId: registerForm.branchId,
      isActive: true,
    };
    if (!payload.name || !payload.code || !payload.branchId) {
      throw new Error('Completa nombre, codigo y sucursal para crear la caja.');
    }
    const created = await cajaService.createRegister(payload);
    onSelectRegister(created.id);
    setRegisterForm({ ...initialRegisterForm, branchId: branches[0]?.id || '' });
  }, 'Caja creada');

  const steps = [
    { key: 'warehouse', label: 'Almacen operativo', done: warehouses.length > 0, icon: Warehouse },
    { key: 'branch', label: 'Sucursal vinculada', done: branches.length > 0, icon: Store },
    { key: 'register', label: 'Caja activa', done: registers.length > 0, icon: Banknote },
  ];

  return (
    <>
      <Card className="border-border/60 bg-gradient-to-br from-background via-muted/20 to-primary/5 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-black">Configurar caja paso a paso</CardTitle>
          <p className="text-sm text-muted-foreground">
            Para aperturar caja se necesita este orden: almacen, sucursal y caja. Completa el siguiente paso aqui mismo.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/70 p-3">
                  {step.done ? <CheckCircle2 className="size-5 text-emerald-600" /> : <Icon className="size-5 text-primary" />}
                  <div>
                    <p className="text-sm font-bold">{step.label}</p>
                    <p className="text-xs text-muted-foreground">{step.done ? 'Listo' : 'Pendiente'}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <Button onClick={openNextStep} className="gap-2">
            {nextStep === 'warehouse' && 'Crear almacen ahora'}
            {nextStep === 'branch' && 'Crear sucursal ahora'}
            {nextStep === 'register' && (registers.length > 0 ? 'Seleccionar caja disponible' : 'Crear caja ahora')}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={modal === 'warehouse'} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear almacen</DialogTitle>
            <DialogDescription>Este almacen sera la base de inventario para la sucursal.</DialogDescription>
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

      <Dialog open={modal === 'branch'} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear sucursal</DialogTitle>
            <DialogDescription>La sucursal agrupa las cajas que operan en una ubicacion.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Codigo</Label>
                <Input value={branchForm.code} onChange={(event) => setBranchForm({ ...branchForm, code: event.target.value })} placeholder="SUC-01" />
              </div>
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={branchForm.name} onChange={(event) => setBranchForm({ ...branchForm, name: event.target.value })} placeholder="Sucursal central" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Almacen padre</Label>
              <Select value={branchForm.warehouseId} onValueChange={(value) => setBranchForm({ ...branchForm, warehouseId: value })}>
                <SelectTrigger><SelectValue placeholder="Selecciona almacen" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ubicacion</Label>
              <Input value={branchForm.location} onChange={(event) => setBranchForm({ ...branchForm, location: event.target.value })} placeholder="Direccion o referencia" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
            <Button onClick={createBranch} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : 'Guardar sucursal'}</Button>
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
              <Label>Sucursal</Label>
              <Select value={registerForm.branchId} onValueChange={(value) => setRegisterForm({ ...registerForm, branchId: value })}>
                <SelectTrigger><SelectValue placeholder="Selecciona sucursal" /></SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
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
