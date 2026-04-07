import React, { useMemo, useState, useRef } from 'react';
import { Search, Plus, Trash2, Save, X, Check, Package } from 'lucide-react';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { inventoryService } from '../../services/inventario.service';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

interface ProductosViewProps {
  products: any[];
  categories: any[];
  warehouses?: any[];
  series?: any[];
  movements?: any[];
  onRefresh: () => void;
}

interface EditingProduct {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  salePrice: number;
  costPrice: number;
  trackSerialNumbers?: boolean;
  initialStock?: number;
  initialAllocations?: Array<{
    id: string;
    warehouseId: string;
    quantity: number;
  }>;
  isNew?: boolean;
}

export function ProductosView({ products, categories, warehouses = [], series = [], movements = [], onRefresh }: ProductosViewProps) {
  const { formatAmount } = useCurrency();
  const { canPerform } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingRows, setEditingRows] = useState<Map<string, EditingProduct>>(new Map());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [productDetail, setProductDetail] = useState<any | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const newRowRef = useRef<HTMLInputElement>(null);

  const filteredProducts = products.filter((p: any) => {
    const matchesSearch = !searchTerm || 
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category?.name?.toLowerCase().includes(searchTerm.toLowerCase());
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
      trackSerialNumbers: false,
      initialStock: 0,
      initialAllocations: [{ id: `alloc-${Date.now()}`, warehouseId: '', quantity: 0 }],
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
      trackSerialNumbers: Boolean(
        product.trackSerialNumbers ||
        product.serialTracking ||
        product.serialNumberTracking ||
        String(product.trackingType || '').toUpperCase() === 'SERIAL',
      ),
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
      let finalValue = value;
      // Validate prices are non-negative
      if (field === 'salePrice' || field === 'costPrice' || field === 'initialStock') {
        finalValue = Math.max(0, value);
      }
      setEditingRows(new Map(editingRows.set(id, { ...current, [field]: finalValue })));
    }
  };

  const updateInitialAllocation = (
    productId: string,
    allocationId: string,
    patch: Partial<{ warehouseId: string; quantity: number }>,
  ) => {
    const product = editingRows.get(productId);
    if (!product || !product.isNew) return;
    const nextAllocations = (product.initialAllocations || []).map((item) =>
      item.id === allocationId ? { ...item, ...patch } : item,
    );
    setEditingRows(new Map(editingRows.set(productId, { ...product, initialAllocations: nextAllocations })));
  };

  const addInitialAllocation = (productId: string) => {
    const product = editingRows.get(productId);
    if (!product || !product.isNew) return;
    const next = [
      ...(product.initialAllocations || []),
      { id: `alloc-${Date.now()}-${(product.initialAllocations || []).length}`, warehouseId: '', quantity: 0 },
    ];
    setEditingRows(new Map(editingRows.set(productId, { ...product, initialAllocations: next })));
  };

  const removeInitialAllocation = (productId: string, allocationId: string) => {
    const product = editingRows.get(productId);
    if (!product || !product.isNew) return;
    const current = product.initialAllocations || [];
    if (current.length <= 1) return;
    const next = current.filter((item) => item.id !== allocationId);
    setEditingRows(new Map(editingRows.set(productId, { ...product, initialAllocations: next })));
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
        const validAllocations = (product.initialAllocations || []).filter(
          (item) => item.warehouseId && Number(item.quantity || 0) > 0,
        );
        const initialStock = validAllocations.reduce((acc, item) => acc + Number(item.quantity || 0), 0);
        const uniqueWarehouses = new Set(validAllocations.map((item) => item.warehouseId));

        if (initialStock > 0 && warehouses.length === 0) {
          toast.error('No hay bodegas registradas para asignar stock inicial');
          return;
        }
        if (initialStock > 0 && uniqueWarehouses.size !== validAllocations.length) {
          toast.error('No repitas la misma bodega en la distribución inicial');
          return;
        }

        const createdResponse = await inventoryService.createProduct({
          code: product.code,
          name: product.name,
          categoryId: product.categoryId,
          salePrice: product.salePrice,
          costPrice: product.costPrice,
          trackSerialNumbers: Boolean(product.trackSerialNumbers),
          initialStock: 0,
        });
        const created = (createdResponse as any)?.data || createdResponse;
        const createdId = created?.id;
        if (initialStock > 0 && createdId) {
          try {
            const productDetailResp = await inventoryService.getProduct(createdId);
            const fullProduct = (productDetailResp as any)?.data || productDetailResp;
            const variantId = fullProduct?.variants?.[0]?.id;

            if (variantId) {
              await Promise.all(
                validAllocations.map(async (item) => {
                  await inventoryService.updateStockLevel({
                    productId: createdId,
                    warehouseId: item.warehouseId,
                    variantId: variantId,
                    quantity: Number(item.quantity || 0),
                    minStock: 0,
                  });

                  await inventoryService.createMovement({
                    productId: createdId,
                    warehouseId: item.warehouseId,
                    variantId: variantId,
                    type: 'IN',
                    quantity: Number(item.quantity || 0),
                    reference: `STOCK-INICIAL-${created.code || createdId}`,
                  });
                })
              );
            }
          } catch (err) {
            console.error('Error allocating initial stock', err);
            toast.error('Producto creado, pero hubo un error al asignar el stock');
          }
        }
        toast.success('Producto creado');
      } else {
        await inventoryService.updateProduct(id, {
          code: product.code,
          name: product.name,
          categoryId: product.categoryId,
          salePrice: product.salePrice,
          costPrice: product.costPrice,
          trackSerialNumbers: Boolean(product.trackSerialNumbers),
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
    setPendingDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;
    setDeleteLoading(true);
    try {
      await inventoryService.deleteProduct(pendingDeleteId);
      toast.success('Producto eliminado');
      setPendingDeleteId(null);
      onRefresh();
    } catch (e) {
      toast.error('Error al eliminar');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return toast.error('El nombre de la categoría es requerido');
    setCreatingCategory(true);
    try {
      await inventoryService.createCategory({
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || undefined,
      });
      toast.success('Categoría creada');
      setCategoryModalOpen(false);
      setNewCategoryName('');
      setNewCategoryDescription('');
      onRefresh();
    } catch (error: any) {
      toast.error(error?.message || 'Error al crear categoría');
    } finally {
      setCreatingCategory(false);
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

  const stockByWarehouse = useMemo(() => {
    if (!productDetail) return [];
    const stockLevels = Array.isArray(productDetail.stockLevels) ? productDetail.stockLevels : [];

    if (stockLevels.length > 0) {
      return stockLevels
        .map((level: any) => {
          const warehouseId = level.warehouseId || level.warehouse?.id;
          const warehouseName =
            level.warehouse?.name ||
            warehouses.find((w: any) => w.id === warehouseId)?.name ||
            'Sin bodega';
          return {
            warehouseId,
            warehouseName,
            quantity: Number(level.quantity || 0),
          };
        })
        .sort((a: any, b: any) => b.quantity - a.quantity);
    }

    const summary = new Map<string, number>();
    movements
      .filter((move: any) => move.productId === productDetail.id || move.product?.id === productDetail.id)
      .forEach((move: any) => {
        const warehouseId = move.warehouseId || move.warehouse?.id || 'unknown';
        const qty = Number(move.quantity || 0);
        const delta = move.type === 'OUT' ? -qty : qty;
        summary.set(warehouseId, Number(summary.get(warehouseId) || 0) + delta);
      });

    return Array.from(summary.entries())
      .map(([warehouseId, quantity]) => ({
        warehouseId,
        warehouseName:
          warehouses.find((w: any) => w.id === warehouseId)?.name ||
          'Sin bodega',
        quantity,
      }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [productDetail, warehouses, movements]);

  const productSeries = useMemo(() => {
    if (!productDetail) return [];
    return series.filter(
      (item: any) =>
        item.productId === productDetail.id ||
        item.product?.id === productDetail.id,
    );
  }, [productDetail, series]);

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
          <div className="space-y-1.5">
            <Input
              value={product.name}
              onChange={(e) => handleUpdateField(product.id, 'name', e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, product.id)}
              placeholder="Nombre del producto"
              className="h-8 text-xs"
              disabled={isSaving}
            />
            <Button
              type="button"
              variant={product.trackSerialNumbers ? 'default' : 'outline'}
              size="sm"
              className={`h-6 text-[9px] uppercase tracking-wider px-2 ${product.trackSerialNumbers ? 'bg-primary text-primary-foreground' : ''}`}
              onClick={() => handleUpdateField(product.id, 'trackSerialNumbers', !product.trackSerialNumbers)}
              disabled={isSaving}
            >
              IMEI {product.trackSerialNumbers ? 'Activado' : 'Desactivado'}
            </Button>
          </div>
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
          {product.isNew ? (() => {
            const allocations = product.initialAllocations || [];
            const totalAllocated = allocations.reduce((acc, item) => acc + Number(item.quantity || 0), 0);
            return (
              <div className="space-y-2">
                <div className="flex flex-col items-end gap-1.5">
                  {allocations.map((alloc) => (
                    <div key={alloc.id} className="flex items-center gap-1.5 bg-muted/30 rounded-lg px-2 py-1">
                      <Select
                        value={alloc.warehouseId || ''}
                        onValueChange={(v) => updateInitialAllocation(product.id, alloc.id, { warehouseId: v })}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="h-7 text-xs min-w-[120px] border-none bg-transparent shadow-none px-1">
                          <SelectValue placeholder="Bodega..." />
                        </SelectTrigger>
                        <SelectContent>
                          {warehouses.map((w: any) => (
                            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={0}
                        value={alloc.quantity}
                        onChange={(e) => updateInitialAllocation(product.id, alloc.id, { quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="h-7 text-xs text-right w-16 border-none bg-transparent shadow-none"
                        placeholder="0"
                        disabled={isSaving}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded-md"
                        onClick={() => removeInitialAllocation(product.id, alloc.id)}
                        disabled={isSaving || allocations.length <= 1}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[9px] uppercase tracking-wider text-muted-foreground hover:text-primary px-2"
                    onClick={() => addInitialAllocation(product.id)}
                    disabled={isSaving}
                  >
                    <Plus className="size-3 mr-1" />
                    Bodega
                  </Button>
                  <Badge className={`text-[10px] tabular-nums ${totalAllocated > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted/20 text-muted-foreground'}`}>
                    Total: {totalAllocated}
                  </Badge>
                </div>
              </div>
            );
          })() : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
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
          <Badge className={(product.salePrice - product.costPrice) >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}>
            {formatAmount((product.salePrice || 0) - (product.costPrice || 0))}
          </Badge>
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
            <SelectTrigger className="w-[240px] max-w-[45vw] h-9">
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
          variant="outline"
          className="rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-4"
          onClick={() => setCategoryModalOpen(true)}
        >
          <Plus className="size-4 mr-2" />
          Nueva Categoría
        </Button>
        {canPerform('inventario', 'create') && (
          <Button 
            size="sm" 
            className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all gap-2 font-black text-xs uppercase tracking-widest h-10 px-6"
            onClick={handleAddNewRow}
          >
            <Plus className="size-4" />
            Agregar Producto
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border/50">
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-28">Código</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Nombre</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-36">Categoría</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-20">Stock</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-28">Precio Venta</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-28">Precio Costo</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-32">Beneficio</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-24">Acciones</TableHead>
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
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
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
                     onDoubleClick={() => canPerform('inventario', 'edit') && handleEditRow(product)}
                    >
                    <TableCell className="font-mono text-xs text-muted-foreground">{product.code}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="font-medium text-sm hover:text-primary underline-offset-2 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProductDetail(product);
                          }}
                        >
                          {product.name}
                        </button>
                        {Boolean(
                          product.trackSerialNumbers ||
                          product.serialTracking ||
                          product.serialNumberTracking ||
                          String(product.trackingType || '').toUpperCase() === 'SERIAL',
                        ) && (
                          <Badge variant="outline" className="text-[9px] font-black">IMEI</Badge>
                        )}
                        {status.label !== 'OK' && (
                          <Badge className={`${status.color} text-[10px] px-1.5 py-0`}>{status.label}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{product.category?.name || '-'}</span>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{product.stock || 0}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatAmount(product.salePrice || 0)}</TableCell>
                     <TableCell className="text-right text-muted-foreground tabular-nums">{formatAmount(product.costPrice || 0)}</TableCell>
                     <TableCell className="text-right font-black tabular-nums">
                       <span className={(Number(product.salePrice || 0) - Number(product.costPrice || 0)) >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                         {formatAmount(Number(product.salePrice || 0) - Number(product.costPrice || 0))}
                       </span>
                     </TableCell>
                     <TableCell className="text-right">
                       <div className="flex items-center justify-end gap-1 transition-opacity">
                         {canPerform('inventario', 'edit') && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                             className="size-7"
                             onClick={(e) => {
                               e.stopPropagation();
                               handleEditRow(product);
                             }}
                           >
                             <Save className="size-3.5" />
                           </Button>
                        )}
                         {canPerform('inventario', 'delete') && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="size-7 text-red-600 hover:text-white hover:bg-red-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProduct(product.id);
                              }}
                            >
                              <Trash2 className="size-3.5" />
                           </Button>
                        )}
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
        <p className="text-[10px]">Clic en nombre para detalle · Doble clic para editar · Enter para guardar · Esc para cancelar</p>
      </div>
      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="¿Eliminar producto?"
        description="Esta acción eliminará el producto del inventario."
        confirmLabel="Eliminar"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
      />
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva categoría</DialogTitle>
            <DialogDescription>Crea una categoría para usarla de inmediato en productos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Nombre</p>
              <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Ej. Electrónica" className="h-9 text-xs" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Descripción (opcional)</p>
              <Input value={newCategoryDescription} onChange={(e) => setNewCategoryDescription(e.target.value)} placeholder="Descripción corta" className="h-9 text-xs" />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setCategoryModalOpen(false)}>Cancelar</Button>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleCreateCategory} disabled={creatingCategory}>
              {creatingCategory ? 'Guardando...' : 'Guardar categoría'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={productDetail !== null} onOpenChange={(open) => !open && setProductDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle del producto</DialogTitle>
            <DialogDescription>
              {productDetail?.name || '-'} · {productDetail?.code || '-'}
            </DialogDescription>
          </DialogHeader>

          {productDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Stock total</p>
                  <p className="text-lg font-black">{Number(productDetail.stock || 0)}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Categoría</p>
                  <p className="text-sm font-bold">{productDetail.category?.name || '-'}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Venta</p>
                  <p className="text-sm font-bold">{formatAmount(Number(productDetail.salePrice || 0))}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Costo</p>
                  <p className="text-sm font-bold">{formatAmount(Number(productDetail.costPrice || 0))}</p>
                </Card>
              </div>

              <Card className="p-3 border rounded-xl">
                <p className="font-semibold mb-2">Stock por almacén</p>
                {stockByWarehouse.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin movimientos o stock detallado por almacén.</p>
                ) : (
                  <div className="space-y-1.5">
                    {stockByWarehouse.map((item: any) => (
                      <div key={`${item.warehouseId}-${item.warehouseName}`} className="flex items-center justify-between text-sm">
                        <span>{item.warehouseName}</span>
                        <Badge variant="outline" className="font-mono">{Number(item.quantity || 0)}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-3 border rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold">IMEI / Números de serie</p>
                  <Badge variant="outline">{productSeries.length}</Badge>
                </div>
                {productSeries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aún no hay series para este producto. Se agregan en Ajustes de inventario &gt; Registrar Recepción.
                  </p>
                ) : (
                  <div className="max-h-44 overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px] uppercase tracking-widest">Serie/IMEI</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-widest">Estado</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-widest">Almacén</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productSeries.map((item: any) => (
                          <TableRow key={item.id || item.number}>
                            <TableCell className="font-mono text-xs">{item.number || '-'}</TableCell>
                            <TableCell className="text-xs">{item.status || 'AVAILABLE'}</TableCell>
                            <TableCell className="text-xs">{item.warehouse?.name || warehouses.find((w: any) => w.id === item.warehouseId)?.name || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
