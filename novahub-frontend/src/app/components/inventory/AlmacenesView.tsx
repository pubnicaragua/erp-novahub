import React, { useState } from 'react';
import { Warehouse, MapPin, Plus, Trash2, X, Check, Edit2, Banknote, Loader2, Settings2, Users, CircleHelp } from 'lucide-react';
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
import { Store } from 'lucide-react';
import { api, getApiErrorMessage } from '../../services/api';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';
import { consumeImplementationTourContext } from '../../services/implementation-setup.service';

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
    target: '[data-tour="almacenes-cajas-btn"]',
    title: 'Administrar Cajas',
    description: 'Desde aquí puedes crear y gestionar las cajas registradoras del POS. Cada caja se asigna a un almacén y puedes controlar qué usuarios tienen acceso.',
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
  const [showTutorial, setShowTutorial] = useState(false);
  const [editingRows, setEditingRows] = useState<Map<string, EditingWarehouse>>(new Map());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isManageSucursalesDialogOpen, setIsManageSucursalesDialogOpen] = useState(false);
  const [autoOpenSucursalForm, setAutoOpenSucursalForm] = useState(false);

  // Estados de Cajas
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [cajasList, setCajasList] = useState<CashRegister[]>([]);
  const [cajasLoading, setCajasLoading] = useState(false);
  const [isCajaFormOpen, setIsCajaFormOpen] = useState(false);
  const [cajaForm, setCajaForm] = useState<Partial<CashRegister>>({});
  const [pendingDeleteCajaId, setPendingDeleteCajaId] = useState<string | null>(null);
  const [sucursalesList, setSucursalesList] = useState<any[]>([]);

  const fetchSucursales = async () => {
    try {
      const res: any = await api.get('/sucursales');
      setSucursalesList(Array.isArray(res) ? res : (res?.data || []));
    } catch (e) {
      console.error(e);
    }
  };

  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [accessCaja, setAccessCaja] = useState<CashRegister | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<Set<string>>(new Set());
  const [accessLoading, setAccessLoading] = useState(false);

  const handleManageAccess = async (caja: CashRegister) => {
    setIsManageDialogOpen(false);
    setAccessCaja(caja);
    setIsAccessModalOpen(true);
    setAccessLoading(true);
    try {
      const res = await cajaService.getRegisterAccess(caja.id!);
      setAllUsers(res.allUsers || []);
      setAssignedUsers(new Set(res.assignedUserIds || []));
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Error al cargar accesos'));
    } finally {
      setAccessLoading(false);
    }
  };

  const handleSaveAccess = async () => {
    if (!accessCaja) return;
    try {
      await cajaService.updateRegisterAccess(
        accessCaja.id!,
        Array.from(assignedUsers).map((userId) => ({ userId, closureMode: 'NORMAL' as const }))
      );
      toast.success('Accesos actualizados');
      setIsAccessModalOpen(false);
      setIsManageDialogOpen(true);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Error al guardar accesos'));
    }
  };

  const fetchCajas = async () => {
    setCajasLoading(true);
    try {
      const res = await cajaService.getRegisters(true);
      setCajasList(Array.isArray(res) ? res : []);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Error al cargar cajas'));
    } finally {
      setCajasLoading(false);
    }
  };

  React.useEffect(() => {
    fetchCajas();
    fetchSucursales();
  }, []);

  const handleAddNewRow = () => {
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

    setShowTutorial(context.tourActive);
    window.setTimeout(() => {
      if (context.action === 'open-warehouse-form') {
        handleAddNewRow();
      }
      if (context.action === 'open-branch-form') {
        setAutoOpenSucursalForm(true);
        setIsManageSucursalesDialogOpen(true);
      }
    }, 250);
  }, []);

  const handleEditRow = (wh: any) => {
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
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar');
    } finally {
      const newSet = new Set(savingIds);
      newSet.delete(id);
      setSavingIds(newSet);
    }
  };

  const handleDeleteWarehouse = async (id: string) => {
    setPendingDeleteId(id);
  };

  const handleConfirmDeleteWarehouse = async () => {
    if (!pendingDeleteId) return;
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
    return wh.stockLevels?.reduce((acc: number, sl: any) => acc + Number(sl.quantity || 0), 0) || 0;
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
        <TableCell>-</TableCell>
        <TableCell className="text-right">-</TableCell>
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

  return (
    <>
      <Card className="p-4 border bg-card rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-black text-lg uppercase tracking-tight italic" data-tour="almacenes-title">Almacenes y Sucursales</h3>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
            {warehouses.length} ubicaciones · {warehouses.filter((w: any) => String(w.type || '').toUpperCase() === 'STORE').length} sucursales
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowTutorial(true)} className="mr-1">
            <CircleHelp className="size-3.5 mr-1" /> Tutorial
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-10 gap-2 font-black text-xs uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground border-primary/20 rounded-xl"
            onClick={() => {
              fetchCajas();
              fetchSucursales();
              setIsManageDialogOpen(true);
            }}
            data-tour="almacenes-cajas-btn"
          >
            <Settings2 className="size-4" /> Administrar Cajas
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-10 gap-2 font-black text-xs uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground border-primary/20 rounded-xl"
            onClick={() => {
              setIsManageSucursalesDialogOpen(true);
            }}
            data-tour="almacenes-sucursales-btn"
          >
            <Store className="size-4" /> Administrar Sucursales
          </Button>
          <Button 
            size="sm" 
            className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all gap-2 font-black text-xs uppercase tracking-widest h-10 px-6" 
            onClick={handleAddNewRow}
            data-tour="almacenes-add-btn"
          >
            <Plus className="size-4" />
            Agregar Almacén/Sucursal
          </Button>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden" data-tour="almacenes-table">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border/50">
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Nombre</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Ubicación</TableHead>
               <TableHead className="font-black text-[10px] uppercase tracking-widest w-36">Tipo</TableHead>
               <TableHead className="font-black text-[10px] uppercase tracking-widest w-36">Ubicación Padre</TableHead>
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
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
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
                const assignedSucursales = sucursalesList.filter(s => s.warehouseId === wh.id);
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
                    <TableCell>
                      {assignedSucursales.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {assignedSucursales.map(s => (
                            <Badge key={s.id} variant="secondary" className="text-[9px] bg-muted/50" title={s.name}>{s.code}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{stockCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 transition-opacity">
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => handleEditRow(wh)}>
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="size-7 text-red-600 hover:text-white hover:bg-red-500"
                          onClick={() => handleDeleteWarehouse(wh.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
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
      <ConfirmDialog
        open={pendingDeleteCajaId !== null}
        onOpenChange={(open) => !open && setPendingDeleteCajaId(null)}
        title="¿Eliminar caja?"
        description="¿Estás seguro de que deseas eliminar esta caja registradora? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDeleteCajaId) return;
          try {
            await cajaService.deleteRegister(pendingDeleteCajaId);
            toast.success('Caja eliminada');
            fetchCajas();
          } catch(e) {
            toast.error(getApiErrorMessage(e, 'Error al eliminar la caja'));
          } finally {
            setPendingDeleteCajaId(null);
          }
        }}
      />
      {showTutorial && <GuidedTour steps={ALMACEN_TOUR_STEPS} onClose={() => setShowTutorial(false)} title="Almacenes y Sucursales" allowTargetInteraction />}
    </Card>
    {/* Modal de Gestión de Cajas */}
    <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2 text-lg font-black"><Banknote className="size-5 text-primary" /> Puntos de Venta (Cajas)</DialogTitle>
            <DialogDescription>Crea y gestiona las cajas para el sistema POS</DialogDescription>
          </div>
          <Button onClick={() => {
            setIsManageDialogOpen(false);
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
                          <Button variant="ghost" size="icon" onClick={() => handleManageAccess(caja)}>
                            <Users className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => {
                            setIsManageDialogOpen(false);
                            setCajaForm(caja);
                            setIsCajaFormOpen(true);
                          }}>
                            <Edit2 className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setPendingDeleteCajaId(caja.id!)}>
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
          <Button onClick={async () => {
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
            } catch (e) {
              toast.error(getApiErrorMessage(e, 'Error al guardar la caja'));
            }
          }}>Guardar Caja</Button>
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
          <Button onClick={handleSaveAccess} disabled={accessLoading}>Guardar Accesos</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={isManageSucursalesDialogOpen} onOpenChange={(open) => {
      setIsManageSucursalesDialogOpen(open);
      if (!open) fetchSucursales();
    }}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black"><Store className="size-5 text-primary" /> Administrar Sucursales</DialogTitle>
          <DialogDescription>Gestiona las sucursales asociadas a los almacenes.</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto py-2">
          <SucursalesView
            warehouses={warehouses}
            onRefresh={onRefresh}
            isModal={true}
            autoOpenCreate={autoOpenSucursalForm}
            onAutoOpenHandled={() => setAutoOpenSucursalForm(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
}

