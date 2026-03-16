import React, { useState } from 'react';
import { Warehouse, MapPin, Plus, Trash2, Save, X, Check, Box, Edit2 } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { inventoryService } from '../../services/inventario.service';

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
    if (!confirm('¿Eliminar este almacén?')) return;
    try {
      await inventoryService.deleteWarehouse(id);
      toast.success('Almacén eliminado');
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Error al eliminar');
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
    <Card className="p-4 border bg-card rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-black text-lg uppercase tracking-tight italic">Almacenes</h3>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{warehouses.length} almacenes configurados</p>
        </div>
        <Button 
          size="sm" 
          className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all gap-2 font-black text-xs uppercase tracking-widest h-10 px-6" 
          onClick={handleAddNewRow}
        >
          <Plus className="size-4" />
          Agregar Almacén
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border/50">
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Nombre</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Ubicación</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-36">Tipo</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-36">Almacén Padre</TableHead>
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
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
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
                    <TableCell className="text-right font-medium tabular-nums">{stockCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 transition-opacity">
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => handleEditRow(wh)}>
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="size-7 text-red-600 hover:text-black hover:bg-red-500"
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
    </Card>
  );
}
