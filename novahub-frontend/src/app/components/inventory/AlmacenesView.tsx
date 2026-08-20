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

import { getApiErrorMessage } from '../../services/api';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';
import { consumeImplementationTourContext } from '../../services/implementation-setup.service';
import { useAuth } from '../../contexts/AuthContext';
import { InventoryViewTutorial } from './InventoryViewTutorial';
import { WarehouseSupplyPanel } from './WarehouseSupplyPanel';
interface AlmacenesViewProps {
  warehouses: any[];
  onRefresh: () => void;
}

interface EditingWarehouse {
  id: string;
  name: string;
  location: string;
  type: string;
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
    title: 'Bodegas de la sucursal',
    description: 'Gestiona las bodegas operativas de esta sucursal. Cada bodega conserva su inventario y puede tener su propia cuenta contable.',
    tip: 'Los almacenes corporativos se administran desde la vista Manager.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="almacenes-add-btn"]',
    title: 'Agregar Bodega',
    description: 'Crea una bodega operativa de esta sucursal. La bodega conserva su inventario y cuenta contable de forma independiente.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="almacenes-table"]',
    title: 'Listado de Bodegas',
    description: 'Tabla completa con las bodegas de esta sucursal. Puedes editar con los botones de acción en cada fila.',
    placement: 'top',
  },
];

export function AlmacenesView({ warehouses, onRefresh }: AlmacenesViewProps) {
  const { canPerform } = useAuth();
  const canCreateWarehouse = canPerform('INVENTORY_WAREHOUSES', 'create');
  const canEditWarehouse = canPerform('INVENTORY_WAREHOUSES', 'edit');
  const canDeactivateWarehouse = canPerform('INVENTORY_WAREHOUSES', 'deactivate');
  const canViewPos = canPerform('RETAIL_POS', 'view');
  const canManagePos = canPerform('RETAIL_POS', 'edit');
  const [showTutorial, setShowTutorial] = useState(false);
  const [editingRows, setEditingRows] = useState<Map<string, EditingWarehouse>>(new Map());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const cameFromSetupRef = useRef(false);
  const [stockByWarehouse, setStockByWarehouse] = useState<Record<string, number>>({});
  const [detailWarehouse, setDetailWarehouse] = useState<any | null>(null);

  // Estados de Cajas
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [cajasList, setCajasList] = useState<CashRegister[]>([]);
  const [cajasLoading, setCajasLoading] = useState(false);
  const [isCajaFormOpen, setIsCajaFormOpen] = useState(false);
  const [cajaForm, setCajaForm] = useState<Partial<CashRegister>>({});
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
    if (!canViewPos) {
      setCajasList([]);
      setCajasLoading(false);
      return;
    }

    const controller = new AbortController();
    const loadCatalogs = async () => {
      try {
        setCajasLoading(true);
        const cajas = await cajaService.getRegisters(true, controller.signal);
        setCajasList(Array.isArray(cajas) ? cajas : []);
      } catch (error: any) {
        if (error?.name !== 'AbortError' && !controller.signal.aborted && error?.code !== 'ERR_CANCELED' && error?.name !== 'CanceledError') {
          toast.error(getApiErrorMessage(error, 'Error al cargar catálogos de bodegas'));
        }
      } finally {
        if (!controller.signal.aborted) setCajasLoading(false);
      }
    };
    void loadCatalogs();
    return () => controller.abort();
  }, [canViewPos]);

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
      console.error('Error al cargar stock de bodegas:', e);
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
    }, 250);
  }, []);

  const handleEditRow = (wh: any) => {
    if (!canEditWarehouse) return;
    const editWarehouse: EditingWarehouse = {
      id: wh.id,
      name: wh.name,
      location: wh.location || '',
      type: wh.type || 'STORE',
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
        } as any);
        toast.success('Bodega creada');
      } else {
        await inventoryService.updateWarehouse(id, {
          name: warehouse.name,
          location: warehouse.location,
          type: warehouse.type,
        } as any);
        toast.success('Bodega actualizada');
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
      toast.success('Bodega eliminada');
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
            placeholder="Nombre de la bodega"
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
          {warehouse.isNew ? (
            <span className="text-[10px] text-muted-foreground">Se configura para la bodega</span>
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
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">{draft.isNew ? 'Nueva bodega' : 'Editar bodega'}</p>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="size-8 text-emerald-500" onClick={() => handleSaveRow(draft.id)} disabled={isSaving} aria-label="Guardar bodega">
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => handleCancelEdit(draft.id)} disabled={isSaving} aria-label="Cancelar edición"><X className="size-4" /></Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nombre</p><Input value={draft.name} onChange={(e) => handleUpdateField(draft.id, 'name', e.target.value)} placeholder="Nombre de la bodega" disabled={isSaving} autoFocus={draft.isNew} /></div>
            <div className="space-y-1"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ubicación</p><Input value={draft.location} onChange={(e) => handleUpdateField(draft.id, 'location', e.target.value)} placeholder="Ubicación" disabled={isSaving} /></div>
            <div className="space-y-1"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tipo</p><Select value={draft.type} onValueChange={(value) => handleUpdateField(draft.id, 'type', value)} disabled={isSaving}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{WAREHOUSE_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cuenta contable</p>
              {draft.isNew ? (
                <p className="text-xs text-muted-foreground">Se configura para la bodega</p>
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
    return (
      <Card key={warehouse.id} className={`min-w-0 rounded-2xl border-border/50 bg-card/70 p-4 shadow-sm cursor-pointer ${detailWarehouse?.id === warehouse.id ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30' : ''}`} onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; setDetailWarehouse(warehouse); }}>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Warehouse className="size-5" /></div>
            <div className="min-w-0"><p className="truncate font-bold">{warehouse.name}</p><p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="size-3 shrink-0" />{warehouse.location || 'Sin ubicación'}</p></div>
          </div>
          <Badge variant="outline" className="shrink-0 text-[9px]">{WAREHOUSE_TYPES.find((type) => type.value === warehouse.type)?.label || warehouse.type}</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/40 pt-3 text-xs sm:grid-cols-3">
          <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Cuenta</p><p className="truncate font-medium">{warehouse.inventoryAccount?.code || 'Sin asignar'}</p></div>
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
          <h3 className="font-black text-lg uppercase tracking-tight italic" data-tour="almacenes-title">Bodegas</h3>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
            {warehouses.length} bodegas operativas
          </p>
        </div>
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          <WarehouseSupplyPanel />
          <Button type="button" variant="outline" size="sm" onClick={() => setShowTutorial(true)} className="order-1 h-10 min-w-0 w-full rounded-xl px-3 sm:order-none sm:w-auto">
            <CircleHelp className="size-3.5 mr-1" /> Cómo gestionar bodegas
          </Button>

          {canCreateWarehouse && <Button 
            size="sm" 
            className="order-2 h-10 min-w-0 w-full rounded-xl border border-primary/20 bg-primary px-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 sm:order-none sm:w-auto" 
            onClick={handleAddNewRow}
            data-tour="almacenes-add-btn"
          >
            <Plus className="size-4" />
            Agregar Bodega
          </Button>}
        </div>
      </div>

      <div className={`grid min-w-0 grid-cols-1 gap-6 ${detailWarehouse ? 'lg:grid-cols-[1fr_380px]' : 'lg:grid-cols-1'}`}>
        <div className="min-w-0">
      <div className="space-y-3 lg:hidden" data-tour="almacenes-table">
        {Array.from(editingRows.values()).filter((warehouse) => warehouse.isNew).map(renderMobileWarehouseCard)}
        {warehouses.map(renderMobileWarehouseCard)}
        {warehouses.length === 0 && editingRows.size === 0 && <Card className="rounded-2xl border-dashed p-8 text-center text-muted-foreground"><Warehouse className="mx-auto mb-2 size-9 opacity-20" /><p>No hay bodegas</p></Card>}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border lg:block" data-tour="almacenes-table">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border/50">
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Nombre</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Ubicación</TableHead>
               <TableHead className="font-black text-[10px] uppercase tracking-widest whitespace-nowrap">Tipo</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest whitespace-nowrap">Cuenta contable</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right whitespace-nowrap">Stock</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right whitespace-nowrap">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from(editingRows.values())
              .filter(w => w.isNew)
              .map(warehouse => renderEditableRow(warehouse))}
            
            {warehouses.length === 0 && editingRows.size === 0 ? (
              <TableRow>
              <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <Warehouse className="size-10 mx-auto mb-2 opacity-20" />
                  <p className="font-medium">No hay bodegas</p>
                  <p className="text-sm">Haz clic en "Agregar Bodega" para comenzar</p>
                </TableCell>
              </TableRow>
            ) : (
              warehouses.map((wh: any) => {
                const isEditing = editingRows.has(wh.id);
                if (isEditing) {
                  return renderEditableRow(editingRows.get(wh.id)!);
                }
                
                const stockCount = getStockCount(wh);
                return (
                  <TableRow 
                    key={wh.id} 
                    className={`group hover:bg-muted/30 cursor-pointer ${detailWarehouse?.id === wh.id ? 'bg-muted/40 ring-1 ring-border' : ''}`}
                    onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; setDetailWarehouse(wh); }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Warehouse className="size-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm truncate">{wh.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                        <MapPin className="size-3 shrink-0" />
                        {wh.location || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                        {WAREHOUSE_TYPES.find(t => t.value === wh.type)?.label || wh.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs truncate max-w-[160px]">
                      {wh.inventoryAccount ? (
                        <Badge variant="outline" className="text-[9px] font-mono whitespace-nowrap">{wh.inventoryAccount.code} - {wh.inventoryAccount.name}</Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">No asignada</span>
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
                          className="size-7 text-red-600 hover:text-white hover:bg-red-700"
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
        Haz clic en una fila para ver el detalle · Usa los botones de la fila para editar o eliminar
      </div>
        </div>
        {detailWarehouse && (
          <div className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Warehouse className="size-4 text-muted-foreground" />
                  <h4 className="text-sm font-bold">Detalle de Bodega</h4>
                </div>
                <Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => setDetailWarehouse(null)} title="Cerrar detalle" aria-label="Cerrar detalle">
                  <X className="size-3.5" />
                </Button>
              </div>
              <div className="max-h-[calc(100vh-6rem)] space-y-5 overflow-y-auto p-4 sm:p-5">
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Bodega seleccionada</p>
                      <h3 className="mt-1 truncate text-lg font-black tracking-tight" title={detailWarehouse.name}>{detailWarehouse.name}</h3>
                    </div>
                    <Badge variant="outline" className="shrink-0">{WAREHOUSE_TYPES.find((t) => t.value === detailWarehouse.type)?.label || detailWarehouse.type || 'Almacén'}</Badge>
                  </div>
                </div>
                <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ubicación</p>
                    <p className="mt-1 truncate text-sm font-bold">{detailWarehouse.location || '—'}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cuenta contable de la bodega</p>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cuenta contable</p>
                    <p className="mt-1 truncate text-sm font-bold">{detailWarehouse.inventoryAccount?.code ? `${detailWarehouse.inventoryAccount.code} - ${detailWarehouse.inventoryAccount.name}` : 'Sin asignar'}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Productos con stock</p>
                  <p className="mt-1 text-2xl font-black tabular-nums">{getStockCount(detailWarehouse)}</p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="¿Eliminar bodega?"
        description="Esta acción desactivará la bodega seleccionada."
        confirmLabel="Eliminar"
        loading={deleteLoading}
        onConfirm={handleConfirmDeleteWarehouse}
      />
      {showTutorial && <GuidedTour steps={ALMACEN_TOUR_STEPS} onClose={() => setShowTutorial(false)} title="Bodegas" allowTargetInteraction />}
    </Card>
    {/* Modal de Gestión de Cajas */}
    <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between" data-tour="inventory-pos-manager-title">
          <div>
            <DialogTitle className="flex items-center gap-2 text-lg font-black"><Banknote className="size-5 text-primary" /> Puntos de Venta (Cajas)</DialogTitle>
            <DialogDescription>Crea y gestiona las cajas para el sistema POS</DialogDescription>
          </div>
          <InventoryViewTutorial label="Cómo gestionar cajas" targetPrefix="inventory-pos-manager" stepKeys={['title', 'data', 'actions']} copy={{ data: { description: 'Consulta las cajas existentes, sus sucursales, ubicación y estado.' }, actions: { description: 'Crea una caja nueva o abre sus accesos y edición.' } }} />
          {canManagePos && <Button onClick={() => {
            setIsManageDialogOpen(false);
            setCajaForm({ isActive: true });
            setIsCajaFormOpen(true);
          }} className="gap-2 mt-0 mr-8">
            <Plus className="size-4" /> Nueva Caja
          </Button>}
        </DialogHeader>
        <div className="py-4 overflow-y-auto" data-tour="inventory-pos-manager-data">
          {cajasLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="size-6 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="px-4 py-3 text-left font-semibold">Código</th>
                    <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                    <th className="px-4 py-3 text-left font-semibold">Bodega</th>
                    <th className="px-4 py-3 text-left font-semibold">Ubicación</th>
                    <th className="px-4 py-3 text-left font-semibold">Estado</th>
                    <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {cajasList.map((caja) => {
                    const bodega = caja.warehouse || warehouses.find((warehouse: any) => warehouse.id === caja.warehouseId);
                    return (
                    <tr key={caja.id} className="hover:bg-muted/10">
                      <td className="px-4 py-3 font-medium">{caja.code}</td>
                      <td className="px-4 py-3">{caja.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{bodega ? bodega.name : 'No asignada'}</td>
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
        <DialogFooter data-tour="inventory-pos-manager-actions">
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
        <DialogHeader data-tour="inventory-cash-register-title">
          <DialogTitle>{cajaForm.id ? 'Editar Caja' : 'Nueva Caja'}</DialogTitle>
          <DialogDescription>Completa la información de la caja y su bodega operativa.</DialogDescription>
          <InventoryViewTutorial label={cajaForm.id ? 'Cómo editar caja' : 'Cómo crear caja'} targetPrefix="inventory-cash-register" copy={{ data: { description: 'Completa código, nombre, bodega, ubicación y estado de la caja.' }, actions: { description: 'Guarda la caja para que esté disponible en el sistema POS.' } }} />
        </DialogHeader>
        <div className="space-y-4 py-4" data-tour="inventory-cash-register-data">
          <div className="space-y-2">
            <Label>Código *</Label>
            <Input value={cajaForm.code || ''} onChange={e => setCajaForm({...cajaForm, code: e.target.value})} placeholder="Ej. CJ-01" />
          </div>
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input value={cajaForm.name || ''} onChange={e => setCajaForm({...cajaForm, name: e.target.value})} placeholder="Caja Principal" />
          </div>
          <div className="space-y-2">
            <Label>Bodega</Label>
            <Select value={cajaForm.warehouseId || ''} onValueChange={v => setCajaForm({...cajaForm, warehouseId: v})}>
              <SelectTrigger><SelectValue placeholder="Seleccione una bodega" /></SelectTrigger>
              <SelectContent>
                {warehouses.filter((warehouse: any) => warehouse.scopeType !== 'BUSINESS_UNIT').map((w: any) => (
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
        <DialogFooter data-tour="inventory-cash-register-actions">
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
        <DialogHeader data-tour="inventory-cash-access-title">
          <DialogTitle>Accesos - {accessCaja?.name}</DialogTitle>
          <DialogDescription>Selecciona qué usuarios pueden usar esta caja</DialogDescription>
          <InventoryViewTutorial label="Cómo asignar accesos" targetPrefix="inventory-cash-access" copy={{ data: { description: 'Activa o desactiva los usuarios autorizados para utilizar esta caja.' }, actions: { description: 'Guarda los accesos para aplicar los permisos seleccionados.' } }} />
        </DialogHeader>
        <div className="py-4" data-tour="inventory-cash-access-data">
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
        <DialogFooter data-tour="inventory-cash-access-actions">
          <Button variant="outline" onClick={() => setIsAccessModalOpen(false)}>Cancelar</Button>
          {canManagePos && <Button onClick={handleSaveAccess} disabled={accessLoading}>Guardar Accesos</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>


  </>
  );
}

