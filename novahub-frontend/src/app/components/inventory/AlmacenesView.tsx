import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Warehouse, MapPin, Plus, Trash2, X, Check, Edit2, Banknote, Loader2, Users, CircleHelp } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { inventoryService } from '../../services/inventario.service';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cajaService, type CashRegister } from '../../services/caja.service';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { SucursalesView } from './SucursalesView';

import { api, getApiErrorMessage } from '../../services/api';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';
import { consumeImplementationTourContext } from '../../services/implementation-setup.service';
import { useAuth } from '../../contexts/AuthContext';
interface AlmacenesViewProps {
  warehouses: any[];
  onRefresh: () => void;
}

interface EditingWarehouse {
  id: string;
  name: string;
  location: string;
  type: string;
  parentId: string | null;
  isNew?: boolean;
}

const WAREHOUSE_TYPES = [
  { value: 'MAIN', label: 'Principal' },
  { value: 'STORE', label: 'Tienda' },
  { value: 'DISTRIBUTION_CENTER', label: 'Centro Distribución' },
  { value: 'VIRTUAL', label: 'Virtual' },
];

const ALMACEN_TOUR_STEPS: GuidedTourStep[] = [
  {
    target: '[data-tour="almacenes-title"]',
    title: 'Almacenes y Sucursales',
    description: 'Gestiona todos tus almacenes y sucursales desde esta vista. Puedes crear, editar y desactivar almacenes, asignar tipos y configurar cajas registradoras.',
    tip: 'Cada almacén puede tener su propio inventario y estar asociado a una sucursal.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="almacenes-sucursales-btn"]',
    title: 'Administrar Sucursales',
    description: 'Gestiona las sucursales de tu empresa. Cada sucursal puede tener múltiples almacenes asociados.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="almacenes-add-btn"]',
    title: 'Agregar Almacén',
    description: 'Crea un nuevo almacén o sucursal. Completa el nombre, ubicación, tipo y selecciona la sucursal a la que pertenece.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="almacenes-table"]',
    title: 'Listado de Almacenes',
    description: 'Tabla completa con todos los almacenes. Puedes editar con doble clic o usando los botones de acción en cada fila.',
    placement: 'top',
  },
];

export function AlmacenesView({ warehouses, onRefresh }: AlmacenesViewProps) {
  const { canPerform } = useAuth();
  const canCreateWarehouse = canPerform('INVENTORY_WAREHOUSES', 'create');
  const canEditWarehouse = canPerform('INVENTORY_WAREHOUSES', 'edit');
  const canDeactivateWarehouse = canPerform('INVENTORY_WAREHOUSES', 'deactivate');
  const canManageBranches = canPerform('INVENTORY_WAREHOUSES', 'edit');
  const canManagePos = canPerform('RETAIL_POS', 'edit');
  const [showTutorial, setShowTutorial] = useState(false);
  const [editingRows, setEditingRows] = useState<Map<string, EditingWarehouse>>(new Map());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [autoOpenSucursalForm, setAutoOpenSucursalForm] = useState(false);
  const cameFromSetupRef = useRef(false);
  const [stockByWarehouse, setStockByWarehouse] = useState<Record<string, number>>({});

  // Estados de Cajas
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [cajasList, setCajasList] = useState<CashRegister[]>([]);
  const [cajasLoading, setCajasLoading] = useState(false);
  const [isCajaFormOpen, setIsCajaFormOpen] = useState(false);
  const [cajaForm, setCajaForm] = useState<Partial<CashRegister>>({});
  const [sucursalesList, setSucursalesList] = useState<any[]>([]);

  const fetchSucursales = async () => {
    try {
      const res: any = await api.get('/sucursales');
      setSucursalesList(Array.isArray(res) ? res : (res?.data || []));
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSucursales();
  }, [warehouses]);

  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [accessCaja, setAccessCaja] = useState<CashRegister | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<Set<string>>(new Set());
  const [accessLoading, setAccessLoading] = useState(false);

  const handleManageAccess = async (caja: CashRegister) => {
    if (!canManagePos) return;
    setIsManageDialogOpen(false);
    setAccessCaja(caja);
    setIsAccessModalOpen(true);
    setAccessLoading(true);
    try {
      const res = await cajaService.getRegisterAccess(caja.id!);
      setAllUsers(res.allUsers || []);
      setAssignedUsers(new Set(res.assignedUserIds || []));
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al cargar accesos'));
    } finally {
      setAccessLoading(false);
    }
  };

  const handleSaveAccess = async () => {
    if (!accessCaja) return;
    if (!canManagePos) return;
    try {
      await cajaService.updateRegisterAccess(
        accessCaja.id!,
        Array.from(assignedUsers).map((userId) => ({ userId, closureMode: 'NORMAL' as const }))
      );
      toast.success('Accesos actualizados');
      setIsAccessModalOpen(false);
      setIsManageDialogOpen(true);
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al guardar accesos'));
    }
  };

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

  React.useEffect(() => {
    const controller = new AbortController();
    const loadCatalogs = async () => {
      try {
        setCajasLoading(true);
        const [cajas, sucursales] = await Promise.all([
          cajaService.getRegisters(true, controller.signal),
          api.get('/sucursales', { signal: controller.signal }),
        ]);
        setCajasList(Array.isArray(cajas) ? cajas : []);
        const branches: any = sucursales;
        setSucursalesList(Array.isArray(branches) ? branches : (branches?.data || []));
      } catch (error: any) {
        if (error?.name !== 'AbortError' && !controller.signal.aborted && error?.code !== 'ERR_CANCELED' && error?.name !== 'CanceledError') {
          toast.error(getApiErrorMessage(error, 'Error al cargar catálogos de almacenes'));
        }
      } finally {
        if (!controller.signal.aborted) setCajasLoading(false);
      }
    };
    void loadCatalogs();
    return () => controller.abort();
  }, []);

  const refreshStock = async () => {
    try {
      const res: any = await inventoryService.getAllStock();
      const levels = Array.isArray(res) ? res : (res?.data || []);
      const byWarehouse: Record<string, Set<string>> = {};
      for (const level of levels) {
        const warehouseId = level.warehouseId || level.warehouse?.id;
        const productId = level.productId || level.product?.id;
        if (!warehouseId || !productId) continue;
        if (!byWarehouse[warehouseId]) byWarehouse[warehouseId] = new Set();
        byWarehouse[warehouseId].add(productId);
      }
      const counts: Record<string, number> = {};
      for (const [warehouseId, productIds] of Object.entries(byWarehouse)) {
        counts[warehouseId] = productIds.size;
      }
      setStockByWarehouse(counts);
    } catch (e) {
      console.error('Error al cargar stock de almacenes:', e);
    }
  };

  useEffect(() => {
    void refreshStock();
  }, [warehouses]);

  const handleAddNewRow = () => {
    if (!canCreateWarehouse) return;
    const tempId = `new-${Date.now()}`;
    const newWarehouse: EditingWarehouse = {
      id: tempId,
      name: '',
      location: '',
      type: 'STORE',
      parentId: null,
      isNew: true,
    };
    setEditingRows(new Map(editingRows.set(tempId, newWarehouse)));
  };

  React.useEffect(() => {
    const context = consumeImplementationTourContext('inventario', 'almacenes');
    if (!context) return;

    cameFromSetupRef.current = true;
    setShowTutorial(context.tourActive);
    window.setTimeout(() => {
      if (context.action === 'open-warehouse-form') {
        handleAddNewRow();
      }
      if (context.action === 'open-branch-form') {
        setAutoOpenSucursalForm(true);
      }
    }, 250);
  }, []);

  const handleEditRow = (wh: any) => {
    if (!canEditWarehouse) return;
    const editWarehouse: EditingWarehouse = {
      id: wh.id,
      name: wh.name,
      location: wh.location || '',
      type: wh.type || 'STORE',
      parentId: wh.parentId,
    };
    setEditingRows(new Map(editingRows.set(wh.id, editWarehouse)));
  };

  const handleCancelEdit = (id: string) => {
    const newMap = new Map(editingRows);
    newMap.delete(id);
    setEditingRows(newMap);
  };

  const handleUpdateField = (id: string, field: keyof EditingWarehouse, value: any) => {
    const current = editingRows.get(id);
    if (current) {
      setEditingRows(new Map(editingRows.set(id, { ...current, [field]: value })));
    }
  };

  const handleSaveRow = async (id: string) => {
    const warehouse = editingRows.get(id);
    if (!warehouse) return;
    if (warehouse.isNew ? !canCreateWarehouse : !canEditWarehouse) return;

    if (!warehouse.name) {
      toast.error('El nombre es requerido');
      return;
    }

    setSavingIds(new Set(savingIds.add(id)));
    try {
      if (warehouse.isNew) {
        await inventoryService.createWarehouse({
          name: warehouse.name,
          location: warehouse.location,
          type: warehouse.type,
          parentId: warehouse.parentId,
        } as any);
        toast.success('Almacén creado');
      } else {
        await inventoryService.updateWarehouse(id, {
          name: warehouse.name,
          location: warehouse.location,
          type: warehouse.type,
          parentId: warehouse.parentId,
        } as any);
        toast.success('Almacén actualizado');
      }
      handleCancelEdit(id);
      onRefresh();
      if (cameFromSetupRef.current) {
        cameFromSetupRef.current = false;
        window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: 'overview' } }));
        return;
      }
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar');
    } finally {
      const newSet = new Set(savingIds);
      newSet.delete(id);
      setSavingIds(newSet);
    }
  };

  const handleDeleteWarehouse = async (id: string) => {
    if (!canDeactivateWarehouse) return;
    setPendingDeleteId(id);
  };

  const handleConfirmDeleteWarehouse = async () => {
    if (!pendingDeleteId) return;
    if (!canDeactivateWarehouse) return;
    setDeleteLoading(true);
    try {
      await inventoryService.deleteWarehouse(pendingDeleteId);
      toast.success('Almacén eliminado');
      setPendingDeleteId(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Error al eliminar');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveRow(id);
    } else if (e.key === 'Escape') {
      handleCancelEdit(id);
    }
  };

  const getStockCount = (wh: any) => {
    return stockByWarehouse[wh?.id] || 0;
  };

  const renderEditableRow = (warehouse: EditingWarehouse) => {
    const isSaving = savingIds.has(warehouse.id);
    return (
      <TableRow key={warehouse.id} className="bg-blue-500/5">
        <TableCell>
          <Input
            value={warehouse.name}
            onChange={(e) => handleUpdateField(warehouse.id, 'name', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, warehouse.id)}
            placeholder="Nombre del almacén"
            className="h-8 text-xs"
            disabled={isSaving}
            autoFocus={warehouse.isNew}
          />
        </TableCell>
        <TableCell>
          <Input
            value={warehouse.location}
            onChange={(e) => handleUpdateField(warehouse.id, 'location', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, warehouse.id)}
            placeholder="Ubicación"
            className="h-8 text-xs"
            disabled={isSaving}
          />
        </TableCell>
        <TableCell>
          <Select 
            value={warehouse.type} 
            onValueChange={(v) => handleUpdateField(warehouse.id, 'type', v)}
            disabled={isSaving}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WAREHOUSE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Select 
            value={warehouse.parentId || 'none'} 
            onValueChange={(v) => handleUpdateField(warehouse.id, 'parentId', v === 'none' ? null : v)}
            disabled={isSaving}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Sin padre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin padre</SelectItem>
              {warehouses.filter(w => w.id !== warehouse.id).map((w: any) => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          {warehouse.isNew ? (
            <span className="text-[10px] text-muted-foreground">Se asigna al vincular con sucursales</span>
          ) : (
            (() => {
              const live = warehouses.find((w: any) => w.id === warehouse.id);
              return live?.inventoryAccount ? (
                <Badge variant="outline" className="text-[9px] font-mono">{live.inventoryAccount.code} - {live.inventoryAccount.name}</Badge>
              ) : (
                <span className="text-[10px] text-muted-foreground">Sin asignar</span>
              );
            })()
          )}
        </TableCell>
        <TableCell>
          <span className="text-[10px] text-muted-foreground">-</span>
        </TableCell>
        <TableCell className="text-right">
          {warehouse.isNew ? (
            <span className="text-[10px] font-medium tabular-nums text-muted-foreground">0</span>
          ) : (
            <span className="text-[10px] font-medium tabular-nums">
              {getStockCount(warehouses.find((w: any) => w.id === warehouse.id))}
            </span>
          )}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="size-7 text-green-600 hover:bg-green-500/10"
              onClick={() => handleSaveRow(warehouse.id)}
              disabled={isSaving}
            >
              {isSaving ? <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Check className="size-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="size-7 text-red-600 hover:bg-red-500/10"
              onClick={() => handleCancelEdit(warehouse.id)}
              disabled={isSaving}
            >
              <X className="size-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const renderMobileWarehouseCard = (warehouse: any | EditingWarehouse) => {
    const draft = editingRows.get(warehouse.id);
    if (draft) {
      const isSaving = savingIds.has(draft.id);
      return (
        <Card key={draft.id} className="rounded-2xl border-primary/30 bg-primary/5 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">{draft.isNew ? 'Nuevo almacén' : 'Editar almacén'}</p>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="size-8 text-emerald-500" onClick={() => handleSaveRow(draft.id)} disabled={isSaving} aria-label="Guardar almacén">
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => handleCancelEdit(draft.id)} disabled={isSaving} aria-label="Cancelar edición"><X className="size-4" /></Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nombre</p><Input value={draft.name} onChange={(e) => handleUpdateField(draft.id, 'name', e.target.value)} placeholder="Nombre del almacén" disabled={isSaving} autoFocus={draft.isNew} /></div>
            <div className="space-y-1"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ubicación</p><Input value={draft.location} onChange={(e) => handleUpdateField(draft.id, 'location', e.target.value)} placeholder="Ubicación" disabled={isSaving} /></div>
            <div className="space-y-1"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tipo</p><Select value={draft.type} onValueChange={(value) => handleUpdateField(draft.id, 'type', value)} disabled={isSaving}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{WAREHOUSE_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Almacén matriz</p><Select value={draft.parentId || 'none'} onValueChange={(value) => handleUpdateField(draft.id, 'parentId', value === 'none' ? null : value)} disabled={isSaving}><SelectTrigger><SelectValue placeholder="Sin padre" /></SelectTrigger><SelectContent><SelectItem value="none">Sin padre</SelectItem>{warehouses.filter((item) => item.id !== draft.id).map((item: any) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cuenta contable</p>
              {draft.isNew ? (
                <p className="text-xs text-muted-foreground">Se asigna al vincular con sucursales</p>
              ) : (
                (() => {
                  const live = warehouses.find((w: any) => w.id === draft.id);
                  return live?.inventoryAccount ? (
                    <p className="truncate text-xs font-medium font-mono">{live.inventoryAccount.code} - {live.inventoryAccount.name}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sin asignar</p>
                  );
                })()
              )}
            </div>
          </div>
        </Card>
      );
    }

    const stockCount = getStockCount(warehouse);
    const assignedSucursales = warehouse.branches || [];
    return (
      <Card key={warehouse.id} className="min-w-0 rounded-2xl border-border/50 bg-card/70 p-4 shadow-sm" onDoubleClick={() => handleEditRow(warehouse)}>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Warehouse className="size-5" /></div>
            <div className="min-w-0"><p className="truncate font-bold">{warehouse.name}</p><p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="size-3 shrink-0" />{warehouse.location || 'Sin ubicación'}</p></div>
          </div>
          <Badge variant="outline" className="shrink-0 text-[9px]">{WAREHOUSE_TYPES.find((type) => type.value === warehouse.type)?.label || warehouse.type}</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/40 pt-3 text-xs sm:grid-cols-4">
          <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Matriz</p><p className="truncate font-medium">{warehouse.parent?.name || '—'}</p></div>
          <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Cuenta</p><p className="truncate font-medium">{warehouse.inventoryAccount?.code || 'Sin asignar'}</p></div>
          <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Sucursales</p><p className="font-bold tabular-nums">{assignedSucursales.length}</p></div>
          <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Stock</p><p className="font-bold tabular-nums">{stockCount}</p></div>
        </div>
        <div className="mt-3 flex justify-end gap-1 border-t border-border/40 pt-3">
          {canEditWarehouse && <Button type="button" variant="ghost" size="icon" className="size-9" onClick={() => handleEditRow(warehouse)} aria-label={`Editar ${warehouse.name}`}><Edit2 className="size-4" /></Button>}
          {canDeactivateWarehouse && <Button type="button" variant="ghost" size="icon" className="size-9 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteWarehouse(warehouse.id)} aria-label={`Eliminar ${warehouse.name}`}><Trash2 className="size-4" /></Button>}
        </div>
      </Card>
    );
  };

  return (
    <>
      <Card className="p-4 border bg-card rounded-xl">
      <div className="flex min-w-0 flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-black text-lg uppercase tracking-tight italic" data-tour="almacenes-title">Almacenes</h3>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
            {warehouses.length} ubicaciones · {warehouses.filter((w: any) => String(w.type || '').toUpperCase() === 'STORE').length} sucursales
          </p>
        </div>
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowTutorial(true)} className="order-1 h-10 min-w-0 w-full rounded-xl px-3 sm:order-none sm:w-auto">
            <CircleHelp className="size-3.5 mr-1" /> Tutorial
          </Button>

          {canCreateWarehouse && <Button 
            size="sm" 
            className="order-2 h-10 min-w-0 w-full rounded-xl bg-gradient-to-br from-primary to-primary/80 px-3 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl sm:order-none sm:w-auto" 
            onClick={handleAddNewRow}
            data-tour="almacenes-add-btn"
          >
            <Plus className="size-4" />
            Agregar Almacén
          </Button>}
        </div>
      </div>

      <div className="space-y-3 lg:hidden" data-tour="almacenes-table">
        {Array.from(editingRows.values()).filter((warehouse) => warehouse.isNew).map(renderMobileWarehouseCard)}
        {warehouses.map(renderMobileWarehouseCard)}
        {warehouses.length === 0 && editingRows.size === 0 && <Card className="rounded-2xl border-dashed p-8 text-center text-muted-foreground"><Warehouse className="mx-auto mb-2 size-9 opacity-20" /><p>No hay almacenes</p></Card>}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border lg:block" data-tour="almacenes-table">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border/50">
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Nombre</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Ubicación</TableHead>
               <TableHead className="font-black text-[10px] uppercase tracking-widest w-36">Tipo</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-36">Almacén matriz</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-44">Cuenta contable</TableHead>
               <TableHead className="font-black text-[10px] uppercase tracking-widest">Sucursales</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-20">Stock</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from(editingRows.values())
              .filter(w => w.isNew)
              .map(warehouse => renderEditableRow(warehouse))}
            
            {warehouses.length === 0 && editingRows.size === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  <Warehouse className="size-10 mx-auto mb-2 opacity-20" />
                  <p className="font-medium">No hay almacenes</p>
                  <p className="text-sm">Haz clic en "Agregar Almacén" para comenzar</p>
                </TableCell>
              </TableRow>
            ) : (
              warehouses.map((wh: any) => {
                const isEditing = editingRows.has(wh.id);
                if (isEditing) {
                  return renderEditableRow(editingRows.get(wh.id)!);
                }
                
                const stockCount = getStockCount(wh);
                const assignedSucursales = wh.branches || [];
                return (
                  <TableRow 
                    key={wh.id} 
                    className="group hover:bg-muted/30 cursor-pointer"
                    onDoubleClick={() => handleEditRow(wh)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Warehouse className="size-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{wh.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" />
                        {wh.location || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {WAREHOUSE_TYPES.find(t => t.value === wh.type)?.label || wh.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {wh.parent?.name || '-'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {wh.inventoryAccount ? (
                        <Badge variant="outline" className="text-[9px] font-mono">{wh.inventoryAccount.code} - {wh.inventoryAccount.name}</Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">No asignada</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {assignedSucursales.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {(assignedSucursales as any[]).map((s: any) => (
                            <Badge key={s.id} variant="secondary" className="text-[9px] bg-muted/50" title={s.name}>{s.code || s.id.slice(0, 4)}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{stockCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 transition-opacity">
                        {canEditWarehouse && <Button variant="ghost" size="icon" className="size-7" onClick={() => handleEditRow(wh)}>
                          <Edit2 className="size-3.5" />
                        </Button>}
                        {canDeactivateWarehouse && <Button 
                          variant="ghost" 
                          size="icon" 
                          className="size-7 text-red-600 hover:text-white hover:bg-red-500"
                          onClick={() => handleDeleteWarehouse(wh.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
        Doble clic en una fila para editar · Enter para guardar · Esc para cancelar
      </div>
      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="¿Eliminar almacén?"
        description="Esta acción eliminará el almacén seleccionado."
        confirmLabel="Eliminar"
        loading={deleteLoading}
        onConfirm={handleConfirmDeleteWarehouse}
      />
      {showTutorial && <GuidedTour steps={ALMACEN_TOUR_STEPS} onClose={() => setShowTutorial(false)} title="Almacenes y Sucursales" allowTargetInteraction />}
    </Card>

    <div className="mt-8">
      <SucursalesView
        warehouses={warehouses}
        onRefresh={onRefresh}
        isModal={false}
        autoOpenCreate={autoOpenSucursalForm}
        onAutoOpenHandled={() => setAutoOpenSucursalForm(false)}
      />
    </div>
    {/* Modal de Gestión de Cajas */}
    <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2 text-lg font-black"><Banknote className="size-5 text-primary" /> Puntos de Venta (Cajas)</DialogTitle>
            <DialogDescription>Crea y gestiona las cajas para el sistema POS</DialogDescription>
          </div>
          {canManagePos && <Button onClick={() => {
            setIsManageDialogOpen(false);
            setCajaForm({ isActive: true });
            setIsCajaFormOpen(true);
          }} className="gap-2 mt-0 mr-8">
            <Plus className="size-4" /> Nueva Caja
          </Button>}
        </DialogHeader>
        <div className="py-4 overflow-y-auto">
          {cajasLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="size-6 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="px-4 py-3 text-left font-semibold">Código</th>
                    <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                    <th className="px-4 py-3 text-left font-semibold">Sucursal</th>
                    <th className="px-4 py-3 text-left font-semibold">Ubicación</th>
                    <th className="px-4 py-3 text-left font-semibold">Estado</th>
                    <th className="px-4 py-3 text-right font-semibold">Acciones</th>
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
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canManagePos && <Button variant="ghost" size="icon" onClick={() => handleManageAccess(caja)}>
                            <Users className="size-4" />
                          </Button>}
                          {canManagePos && <Button variant="ghost" size="icon" onClick={() => {
                            setIsManageDialogOpen(false);
                            setCajaForm(caja);
                            setIsCajaFormOpen(true);
                          }}>
                            <Edit2 className="size-4" />
                          </Button>}
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
          <Button variant="outline" onClick={() => setIsManageDialogOpen(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Modal Formulario de Caja */}
    <Dialog open={isCajaFormOpen} onOpenChange={(open) => {
      setIsCajaFormOpen(open);
      if (!open) setIsManageDialogOpen(true);
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
          {canManagePos && <Button onClick={async () => {
            if (!canManagePos) return;
            if (!cajaForm.name || !cajaForm.code) return toast.error('Nombre y código son obligatorios');
            try {
              if (cajaForm.id) {
                await cajaService.updateRegister(cajaForm.id, cajaForm as any);
                toast.success('Caja actualizada');
              } else {
                await cajaService.createRegister(cajaForm as any);
                toast.success('Caja creada');
              }
              setIsCajaFormOpen(false);
              setIsManageDialogOpen(true);
              fetchCajas();
            } catch (e: any) {
              toast.error(getApiErrorMessage(e, 'Error al guardar la caja'));
            }
          }}>Guardar Caja</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Modal Gestión de Accesos a Caja */}
    <Dialog open={isAccessModalOpen} onOpenChange={(open) => {
      setIsAccessModalOpen(open);
      if (!open) setIsManageDialogOpen(true);
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
                return (
                  <div key={user.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <Switch
                      checked={isAssigned}
                      onCheckedChange={(checked) => {
                        const newSet = new Set(assignedUsers);
                        if (checked) newSet.add(user.id);
                        else newSet.delete(user.id);
                        setAssignedUsers(newSet);
                      }}
                    />
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
          {canManagePos && <Button onClick={handleSaveAccess} disabled={accessLoading}>Guardar Accesos</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>


  </>
  );
}

