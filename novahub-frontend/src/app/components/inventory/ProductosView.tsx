import React, { useMemo, useState, useRef } from 'react';
import { Search, Plus, Trash2, Save, X, Check, Package, FilePlus, PlusCircle } from 'lucide-react';
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
import { cn } from '../ui/utils';

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
  const [adjustStockProduct, setAdjustStockProduct] = useState<any | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustWarehouse, setAdjustWarehouse] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);
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

  const handleAdjustStock = async () => {
    if (!adjustStockProduct || adjustQty <= 0 || !adjustWarehouse) {
      toast.error('Datos incompletos para el ajuste');
      return;
    }
    setAdjustLoading(true);
    try {
      // Intentar obtener variantId del producto
      let variantId = adjustStockProduct.variants?.[0]?.id;
      if (!variantId) {
        const full = await inventoryService.getProduct(adjustStockProduct.id);
        variantId = (full as any)?.data?.variants?.[0]?.id || (full as any)?.variants?.[0]?.id;
      }

      await inventoryService.createMovement({
        productId: adjustStockProduct.id,
        warehouseId: adjustWarehouse,
        variantId,
        type: 'IN',
        quantity: adjustQty,
        reference: 'AJUSTE MANUAL'
      });
      toast.success('Stock actualizado correctamente');
      setAdjustStockProduct(null);
      setAdjustQty(0);
      setAdjustWarehouse('');
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Error al ajustar stock');
    } finally {
      setAdjustLoading(false);
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
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">Catálogo de Productos</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Gestión integral de inventario y precios.</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-4"
              onClick={() => setCategoryModalOpen(true)}
            >
              <PlusCircle className="size-4 mr-2" /> Categoría
            </Button>
            {canPerform('INVENTORY_PRODUCTS', 'create') && (
              <Button 
                onClick={handleAddNewRow}
                className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20"
              >
                <FilePlus className="size-4" /> Nuevo Producto
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-muted/5 p-2 rounded-2xl border border-border/40">
          <div className="flex flex-col sm:flex-row items-center gap-2 flex-1 w-full">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/40" />
              <Input 
                placeholder="Buscar producto..." 
                className="pl-9 h-10 w-full bg-background/50 border-border/50 rounded-xl text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-64 h-10 bg-background/50 border-border/50 rounded-xl text-xs font-bold uppercase">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">TODAS LAS CATEGORÍAS</SelectItem>
                {categories.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className="hidden sm:flex h-10 px-4 rounded-xl border-border/50 bg-background/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
            {filteredProducts.length} Registros
          </Badge>
        </div>
      </div>

      {/* Mobile View (Cards) */}
      <div className="md:hidden space-y-4">
        {Array.from(editingRows.values()).filter(p => p.isNew).map(product => (
          <Card key={product.id} className="p-4 border-2 border-primary/20 bg-primary/5 rounded-2xl space-y-4 shadow-xl">
             <div className="space-y-3">
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Nombre</p>
                   <Input value={product.name} onChange={e => handleUpdateField(product.id, 'name', e.target.value)} className="h-10 text-xs font-bold uppercase" placeholder="NOMBRE DEL PRODUCTO" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Código</p>
                    <Input value={product.code} onChange={e => handleUpdateField(product.id, 'code', e.target.value)} className="h-10 text-xs font-mono uppercase" placeholder="SKU-001" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Categoría</p>
                    <Select value={product.categoryId} onValueChange={v => handleUpdateField(product.id, 'categoryId', v)}>
                        <SelectTrigger className="h-10 text-xs font-bold uppercase"><SelectValue /></SelectTrigger>
                        <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name.toUpperCase()}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
             </div>
             <div className="flex gap-2 pt-2 border-t border-border/20">
                <Button className="flex-1 bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest h-10 rounded-xl shadow-lg shadow-primary/20" onClick={() => handleSaveRow(product.id)}>Guardar Producto</Button>
                <Button variant="ghost" className="size-10 rounded-xl text-rose-500 hover:bg-rose-500/10" onClick={() => handleCancelEdit(product.id)}><X className="size-4" /></Button>
             </div>
          </Card>
        ))}

        {filteredProducts.length === 0 && editingRows.size === 0 ? (
          <div className="text-center py-20 bg-muted/5 rounded-3xl border border-dashed border-border/50">
            <Package className="size-12 mx-auto mb-4 text-muted-foreground/20" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/40">No se encontraron productos</p>
          </div>
        ) : (
          filteredProducts.map(product => {
            const isEditing = editingRows.has(product.id);
            if (isEditing) {
              const editData = editingRows.get(product.id)!;
              return (
                <Card key={product.id} className="p-4 border-2 border-primary/20 bg-primary/5 rounded-2xl space-y-4">
                   <Input value={editData.name} onChange={e => handleUpdateField(product.id, 'name', e.target.value)} className="h-10 text-xs font-black uppercase" />
                   <div className="flex gap-2">
                      <Button className="flex-1 bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest h-10 rounded-xl shadow-lg" onClick={() => handleSaveRow(product.id)}>Guardar</Button>
                      <Button variant="ghost" className="size-10 rounded-xl" onClick={() => handleCancelEdit(product.id)}><X className="size-4" /></Button>
                   </div>
                </Card>
              );
            }
            const status = getStockStatus(product.stock || 0);
            return (
              <Card key={product.id} className="p-4 border-border/50 rounded-2xl shadow-sm active:scale-[0.98] transition-all" onClick={() => setProductDetail(product)}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h4 className="font-black text-sm uppercase text-foreground leading-none mb-1">{product.name}</h4>
                    <p className="text-[10px] font-mono font-black text-muted-foreground/40 uppercase tracking-tighter">{product.code}</p>
                  </div>
                  <Badge className={`${status.color} text-[9px] font-black uppercase px-2 py-0.5 border-none rounded-lg`}>{status.label}: {product.stock || 0}</Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 py-2.5 mb-2 rounded-xl bg-muted/5 border border-border/40">
                  <div className="text-center px-1">
                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Venta</p>
                    <p className="text-[11px] font-black italic tabular-nums">{formatAmount(product.salePrice || 0)}</p>
                  </div>
                  <div className="text-center px-1 border-x border-border/40">
                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Costo</p>
                    <p className="text-[11px] font-black italic text-muted-foreground/60 tabular-nums">{formatAmount(product.costPrice || 0)}</p>
                  </div>
                  <div className="text-center px-1">
                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Margen</p>
                    <p className={cn("text-[11px] font-black italic tabular-nums", (product.salePrice - product.costPrice) >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
                      {formatAmount((product.salePrice || 0) - (product.costPrice || 0))}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-border/40">
                  <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">{product.category?.name || 'SIN CATEGORÍA'}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={(e) => { e.stopPropagation(); handleEditRow(product); }}><Save className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-8 rounded-lg text-rose-500" onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }}><Trash2 className="size-4" /></Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Table Container */}
      <div className="hidden md:block rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
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
                     onDoubleClick={() => canPerform('INVENTORY_PRODUCTS', 'edit') && handleEditRow(product)}
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
                         <Button 
                           variant="ghost" 
                           size="icon" 
                           className="size-7 text-emerald-600 hover:bg-emerald-500/10"
                           onClick={(e) => {
                             e.stopPropagation();
                             setAdjustStockProduct(product);
                             setAdjustWarehouse(warehouses[0]?.id || '');
                           }}
                           title="Añadir Stock"
                         >
                           <PlusCircle className="size-3.5" />
                         </Button>
                         {canPerform('INVENTORY_PRODUCTS', 'edit') && (
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
                         {canPerform('INVENTORY_PRODUCTS', 'delete') && (
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
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
        variant="destructive"
      />

      {/* Diálogo Ajuste de Stock */}
      <Dialog open={!!adjustStockProduct} onOpenChange={(open) => !open && setAdjustStockProduct(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">Añadir Stock</DialogTitle>
            <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
              {adjustStockProduct?.name} ({adjustStockProduct?.code})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bodega</label>
              <Select value={adjustWarehouse} onValueChange={setAdjustWarehouse}>
                <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-none font-bold text-xs uppercase">
                  <SelectValue placeholder="Seleccionar bodega" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cantidad a añadir</label>
              <Input 
                type="number" 
                value={adjustQty || ''} 
                onChange={e => setAdjustQty(Math.max(0, parseInt(e.target.value) || 0))}
                className="h-10 rounded-xl bg-muted/30 border-none font-bold text-xs"
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setAdjustStockProduct(null)} className="rounded-xl font-black uppercase text-[10px] tracking-widest h-10">
              Cancelar
            </Button>
            <Button 
              onClick={handleAdjustStock} 
              disabled={adjustLoading || adjustQty <= 0 || !adjustWarehouse}
              className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest px-6 h-10 shadow-lg shadow-emerald-500/20"
            >
              {adjustLoading ? 'Procesando...' : 'Confirmar Entrada'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}

