import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, Save, X, Check, Package, ChevronDown } from 'lucide-react';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { inventoryService } from '../../services/inventario.service';

interface ProductosViewProps {
  products: any[];
  categories: any[];
  warehouses?: any[];
  onRefresh: () => void;
}

interface EditingProduct {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  salePrice: number;
  costPrice: number;
  isNew?: boolean;
}

export function ProductosView({ products, categories, warehouses, onRefresh }: ProductosViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingRows, setEditingRows] = useState<Map<string, EditingProduct>>(new Map());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const newRowRef = useRef<HTMLInputElement>(null);

  const filteredProducts = products.filter(p => {
    const matchesSearch = !searchTerm || 
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.categoryId === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getStockStatus = (stock: number) => {
    if (stock <= 0) return { label: 'Sin Stock', color: 'bg-red-500/10 text-red-500' };
    if (stock < 10) return { label: 'Bajo', color: 'bg-orange-500/10 text-orange-500' };
    return { label: 'OK', color: 'bg-green-500/10 text-green-500' };
  };

  const handleAddNewRow = () => {
    const tempId = `new-${Date.now()}`;
    const newProduct: EditingProduct = {
      id: tempId,
      code: '',
      name: '',
      categoryId: categories[0]?.id || '',
      salePrice: 0,
      costPrice: 0,
      isNew: true,
    };
    setEditingRows(new Map(editingRows.set(tempId, newProduct)));
    setTimeout(() => newRowRef.current?.focus(), 100);
  };

  const handleEditRow = (product: any) => {
    const editProduct: EditingProduct = {
      id: product.id,
      code: product.code,
      name: product.name,
      categoryId: product.categoryId || '',
      salePrice: Number(product.salePrice) || 0,
      costPrice: Number(product.costPrice) || 0,
    };
    setEditingRows(new Map(editingRows.set(product.id, editProduct)));
  };

  const handleCancelEdit = (id: string) => {
    const newMap = new Map(editingRows);
    newMap.delete(id);
    setEditingRows(newMap);
  };

  const handleUpdateField = (id: string, field: keyof EditingProduct, value: any) => {
    const current = editingRows.get(id);
    if (current) {
      setEditingRows(new Map(editingRows.set(id, { ...current, [field]: value })));
    }
  };

  const handleSaveRow = async (id: string) => {
    const product = editingRows.get(id);
    if (!product) return;

    if (!product.name || !product.code) {
      toast.error('Nombre y código son requeridos');
      return;
    }

    setSavingIds(new Set(savingIds.add(id)));
    try {
      if (product.isNew) {
        await inventoryService.createProduct({
          code: product.code,
          name: product.name,
          categoryId: product.categoryId,
          salePrice: product.salePrice,
          costPrice: product.costPrice,
        });
        toast.success('Producto creado');
      } else {
        await inventoryService.updateProduct(id, {
          code: product.code,
          name: product.name,
          categoryId: product.categoryId,
          salePrice: product.salePrice,
          costPrice: product.costPrice,
        });
        toast.success('Producto actualizado');
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

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('¿Eliminar este producto?')) return;
    try {
      await inventoryService.deleteProduct(id);
      toast.success('Producto eliminado');
      onRefresh();
    } catch (e) {
      toast.error('Error al eliminar');
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

  const renderEditableRow = (product: EditingProduct) => {
    const isSaving = savingIds.has(product.id);
    return (
      <TableRow key={product.id} className="bg-blue-500/5">
        <TableCell>
          <Input
            ref={product.isNew ? newRowRef : undefined}
            value={product.code}
            onChange={(e) => handleUpdateField(product.id, 'code', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, product.id)}
            placeholder="SKU-001"
            className="h-8 text-xs font-mono"
            disabled={isSaving}
          />
        </TableCell>
        <TableCell>
          <Input
            value={product.name}
            onChange={(e) => handleUpdateField(product.id, 'name', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, product.id)}
            placeholder="Nombre del producto"
            className="h-8 text-xs"
            disabled={isSaving}
          />
        </TableCell>
        <TableCell>
          <Select 
            value={product.categoryId} 
            onValueChange={(v) => handleUpdateField(product.id, 'categoryId', v)}
            disabled={isSaving}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="text-right">
          <span className="text-xs text-muted-foreground">-</span>
        </TableCell>
        <TableCell>
          <Input
            type="number"
            value={product.salePrice}
            onChange={(e) => handleUpdateField(product.id, 'salePrice', parseFloat(e.target.value) || 0)}
            onKeyDown={(e) => handleKeyDown(e, product.id)}
            className="h-8 text-xs text-right"
            disabled={isSaving}
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            value={product.costPrice}
            onChange={(e) => handleUpdateField(product.id, 'costPrice', parseFloat(e.target.value) || 0)}
            onKeyDown={(e) => handleKeyDown(e, product.id)}
            className="h-8 text-xs text-right"
            disabled={isSaving}
          />
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="size-7 text-green-600 hover:text-green-700 hover:bg-green-500/10"
              onClick={() => handleSaveRow(product.id)}
              disabled={isSaving}
            >
              {isSaving ? <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Check className="size-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="size-7 text-red-600 hover:text-red-700 hover:bg-red-500/10"
              onClick={() => handleCancelEdit(product.id)}
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
      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nombre o código..." 
              className="pl-9 h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button 
          size="sm" 
          className="bg-[#05602b] hover:bg-[#044c22] gap-2"
          onClick={handleAddNewRow}
        >
          <Plus className="size-4" />
          Agregar Producto
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold text-xs w-28">Código</TableHead>
              <TableHead className="font-semibold text-xs">Nombre</TableHead>
              <TableHead className="font-semibold text-xs w-36">Categoría</TableHead>
              <TableHead className="font-semibold text-xs text-right w-20">Stock</TableHead>
              <TableHead className="font-semibold text-xs text-right w-28">Precio Venta</TableHead>
              <TableHead className="font-semibold text-xs text-right w-28">Precio Costo</TableHead>
              <TableHead className="font-semibold text-xs text-right w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* New rows being edited */}
            {Array.from(editingRows.values())
              .filter(p => p.isNew)
              .map(product => renderEditableRow(product))}
            
            {/* Existing products */}
            {filteredProducts.length === 0 && editingRows.size === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <Package className="size-10 mx-auto mb-2 opacity-20" />
                  <p className="font-medium">No hay productos</p>
                  <p className="text-sm">Haz clic en "Agregar Producto" para comenzar</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const isEditing = editingRows.has(product.id);
                if (isEditing) {
                  return renderEditableRow(editingRows.get(product.id)!);
                }
                
                const status = getStockStatus(product.stock || 0);
                return (
                  <TableRow 
                    key={product.id} 
                    className="group hover:bg-muted/30 cursor-pointer"
                    onDoubleClick={() => handleEditRow(product)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{product.code}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{product.name}</span>
                        {status.label !== 'OK' && (
                          <Badge className={`${status.color} text-[10px] px-1.5 py-0`}>{status.label}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{product.category?.name || '-'}</span>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{product.stock || 0}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">${Number(product.salePrice || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">${Number(product.costPrice || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="size-7"
                          onClick={() => handleEditRow(product)}
                        >
                          <Save className="size-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="size-7 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                          onClick={() => handleDeleteProduct(product.id)}
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

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
        <p>{filteredProducts.length} de {products.length} productos</p>
        <p className="text-[10px]">Doble clic en una fila para editar · Enter para guardar · Esc para cancelar</p>
      </div>
    </Card>
  );
}
