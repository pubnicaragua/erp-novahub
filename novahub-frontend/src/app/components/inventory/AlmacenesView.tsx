import React, { useState } from 'react';
import { Warehouse, MapPin, Plus, Trash2, X, Check, Edit2, PlusCircle, FilePlus } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { inventoryService } from '../../services/inventario.service';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';

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

export function AlmacenesView({ warehouses, onRefresh }: AlmacenesViewProps) {
  const [editingRows, setEditingRows] = useState<Map<string, EditingWarehouse>>(new Map());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
        });
        toast.success('Almacén creado');
      } else {
        await inventoryService.updateWarehouse(id, {
          name: warehouse.name,
          location: warehouse.location,
          type: warehouse.type,
          parentId: warehouse.parentId,
        });
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
        <div>
          <h3 className="text-xl font-black uppercase tracking-tight italic">Almacenes y Sucursales</h3>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mt-1">
            {warehouses.length} ubicaciones registradas · {warehouses.filter((w: any) => String(w.type || '').toUpperCase() === 'STORE').length} sucursales activas
          </p>
        </div>
        <Button 
          onClick={handleAddNewRow}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 w-full sm:w-auto"
        >
          <PlusCircle className="size-4" /> Agregar Almacén/Sucursal
        </Button>
      </div>

      {/* Mobile View (Cards) */}
      <div className="md:hidden space-y-4">
        {Array.from(editingRows.values()).filter(w => w.isNew).map(wh => (
          <Card key={wh.id} className="p-4 border-2 border-primary/20 bg-primary/5 rounded-2xl space-y-3 shadow-xl">
             <div className="space-y-3">
                <div>
                   <p className="text-[10px] font-black uppercase text-muted-foreground/60 mb-1">Nombre</p>
                   <Input value={wh.name} onChange={e => handleUpdateField(wh.id, 'name', e.target.value)} className="h-9 text-xs font-bold uppercase" placeholder="NOMBRE DEL ALMACÉN" />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase text-muted-foreground/60 mb-1">Ubicación</p>
                   <Input value={wh.location} onChange={e => handleUpdateField(wh.id, 'location', e.target.value)} className="h-9 text-xs" placeholder="DIRECCIÓN / CIUDAD" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase text-muted-foreground/60 mb-1">Tipo</p>
                    <Select value={wh.type} onValueChange={v => handleUpdateField(wh.id, 'type', v)}>
                       <SelectTrigger className="h-9 text-xs font-bold uppercase"><SelectValue /></SelectTrigger>
                       <SelectContent>{WAREHOUSE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label.toUpperCase()}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-muted-foreground/60 mb-1">Padre</p>
                    <Select value={wh.parentId || 'none'} onValueChange={v => handleUpdateField(wh.id, 'parentId', v === 'none' ? null : v)}>
                       <SelectTrigger className="h-9 text-xs font-bold uppercase"><SelectValue /></SelectTrigger>
                       <SelectContent>
                          <SelectItem value="none">NINGUNO</SelectItem>
                          {warehouses.filter(w => w.id !== wh.id).map(w => <SelectItem key={w.id} value={w.id}>{w.name.toUpperCase()}</SelectItem>)}
                       </SelectContent>
                    </Select>
                  </div>
                </div>
             </div>
             <div className="flex gap-2 pt-2 border-t border-border/20">
                <Button className="flex-1 bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest h-9 rounded-xl shadow-lg shadow-primary/20" onClick={() => handleSaveRow(wh.id)}>Guardar</Button>
                <Button variant="ghost" className="size-9 rounded-xl text-rose-500 hover:bg-rose-500/10" onClick={() => handleCancelEdit(wh.id)}><X className="size-4" /></Button>
             </div>
          </Card>
        ))}

        {warehouses.length === 0 && editingRows.size === 0 ? (
          <div className="text-center py-20 bg-muted/5 rounded-3xl border border-dashed border-border/50">
            <Warehouse className="size-12 mx-auto mb-4 text-muted-foreground/20" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/40">No hay almacenes configurados</p>
          </div>
        ) : (
          warehouses.map(wh => {
            const isEditing = editingRows.has(wh.id);
            if (isEditing) {
              const editData = editingRows.get(wh.id)!;
              return (
                <Card key={wh.id} className="p-4 border-2 border-primary/20 bg-primary/5 rounded-2xl space-y-3">
                   <Input value={editData.name} onChange={e => handleUpdateField(wh.id, 'name', e.target.value)} className="h-9 text-xs font-black uppercase" />
                   <div className="flex gap-2">
                      <Button className="flex-1 bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest h-9 rounded-xl" onClick={() => handleSaveRow(wh.id)}>Listo</Button>
                      <Button variant="ghost" className="size-9 rounded-xl" onClick={() => handleCancelEdit(wh.id)}><X className="size-4" /></Button>
                   </div>
                </Card>
              );
            }
            const stockCount = getStockCount(wh);
            return (
              <Card key={wh.id} className="p-4 border-border/50 rounded-2xl shadow-sm" onDoubleClick={() => handleEditRow(wh)}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Warehouse className="size-4 text-primary" />
                      <h4 className="font-black text-sm uppercase text-foreground leading-none">{wh.name}</h4>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-black text-muted-foreground/40 uppercase tracking-tighter">
                      <MapPin className="size-3" />
                      {wh.location || 'SIN UBICACIÓN'}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-black uppercase px-2 py-0.5 border-border/50 bg-muted/5">STOCK: {stockCount}</Badge>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-border/40">
                  <Badge className="bg-primary/5 text-primary border-none text-[9px] font-black uppercase">
                    {WAREHOUSE_TYPES.find(t => t.value === wh.type)?.label || wh.type}
                  </Badge>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => handleEditRow(wh)}><Edit2 className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => handleDeleteWarehouse(wh.id)}><Trash2 className="size-4" /></Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Desktop View (Table) */}
      <div className="hidden md:block rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border/50">
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Nombre</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Ubicación</TableHead>
               <TableHead className="font-black text-[10px] uppercase tracking-widest w-36">Tipo</TableHead>
               <TableHead className="font-black text-[10px] uppercase tracking-widest w-40">Padre</TableHead>
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
                <TableCell colSpan={6} className="text-center py-16">
                  <Warehouse className="size-12 mx-auto mb-4 text-muted-foreground/20" />
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/40">No hay almacenes registrados</p>
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
                    className="group hover:bg-muted/30 cursor-pointer transition-colors"
                    onDoubleClick={() => handleEditRow(wh)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <Warehouse className="size-4" />
                        </div>
                        <span className="font-black text-xs uppercase tracking-tight">{wh.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">
                        <MapPin className="size-3 text-primary/40" />
                        {wh.location || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] font-black uppercase border-border/50 bg-background/50 text-muted-foreground/60">
                        {WAREHOUSE_TYPES.find(t => t.value === wh.type)?.label || wh.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">
                      {wh.parent?.name || '-'}
                    </TableCell>
                    <TableCell className="text-right font-black tabular-nums text-primary">{stockCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => handleEditRow(wh)}>
                          <Edit2 className="size-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500"
                          onClick={() => handleDeleteWarehouse(wh.id)}
                        >
                          <Trash2 className="size-4" />
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

      <div className="flex items-center justify-between px-2 text-[10px] text-muted-foreground font-black uppercase tracking-widest">
        <span>{warehouses.length} almacenes totales</span>
        <span className="hidden sm:block">Doble clic para editar · Enter para guardar · Esc para cancelar</span>
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="¿Eliminar almacén?"
        description="Esta acción eliminará el almacén seleccionado de forma permanente."
        confirmLabel="Eliminar Almacén"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleConfirmDeleteWarehouse}
      />
    </div>
  );
}

