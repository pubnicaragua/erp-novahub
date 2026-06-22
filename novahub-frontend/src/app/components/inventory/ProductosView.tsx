import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Search, Plus, Trash2, X, Check, Package, Upload, FileSpreadsheet, AlertTriangle, Download, Pencil, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Pagination, PaginationContent, PaginationItem } from '../ui/pagination';
import { toast } from 'sonner';
import { MultiSelectFilter } from './MultiSelectFilter';
import { ProductDetailDrawer } from './ProductDetailDrawer';
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
  itemType?: 'PRODUCT' | 'SERVICE';
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
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [warehouseFilters, setWarehouseFilters] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'PRODUCT' | 'SERVICE'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'available' | 'low' | 'out'>('all');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, categoryFilters, warehouseFilters, typeFilter, stockFilter]);

  const filteredProducts = products.filter((p: any) => {
    const matchesSearch = !searchTerm || 
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilters.length === 0 || categoryFilters.includes(p.categoryId);
    const matchesWarehouse = warehouseFilters.length === 0
      || (Array.isArray(p.stockByWarehouse) && warehouseFilters.some((wId) => Number(p.stockByWarehouse?.[wId] || 0) > 0));
    const pType = (p.itemType || 'PRODUCT').toUpperCase();
    const matchesType = typeFilter === 'all' || pType === typeFilter;
    const stock = Number(p.stock || 0);
    const matchesStock = stockFilter === 'all'
      || (stockFilter === 'available' && pType === 'PRODUCT' && stock >= 10)
      || (stockFilter === 'low' && pType === 'PRODUCT' && stock > 0 && stock < 10)
      || (stockFilter === 'out' && pType === 'PRODUCT' && stock <= 0);
    return matchesSearch && matchesCategory && matchesWarehouse && matchesType && matchesStock;
      });

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));

  const inventorySummary = useMemo(() => {
    const stockProducts = products.filter((product: any) => (product.itemType || 'PRODUCT').toUpperCase() === 'PRODUCT');
    return {
      total: stockProducts.length,
      available: stockProducts.filter((product: any) => Number(product.stock || 0) >= 10).length,
      low: stockProducts.filter((product: any) => Number(product.stock || 0) > 0 && Number(product.stock || 0) < 10).length,
      out: stockProducts.filter((product: any) => Number(product.stock || 0) <= 0).length,
    };
  }, [products]);

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
      itemType: 'PRODUCT',
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
      itemType: (product.itemType || 'PRODUCT').toUpperCase() as 'PRODUCT' | 'SERVICE',
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
          itemType: product.itemType || 'PRODUCT',
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
          itemType: product.itemType || 'PRODUCT',
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
        <TableCell>
          <Select 
            value={product.itemType || 'PRODUCT'} 
            onValueChange={(v) => handleUpdateField(product.id, 'itemType', v)}
            disabled={isSaving || !product.isNew}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PRODUCT">Producto</SelectItem>
              <SelectItem value="SERVICE">Servicio</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="text-right">
          {product.itemType === 'SERVICE' ? (
            <span className="text-xs text-muted-foreground/50 italic flex justify-end items-center h-8">N/A</span>
          ) : product.isNew ? (() => {
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
            {formatAmount((product.salePrice || 0) - (product.costPrice || 0), 'NIO')}
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

  // ==================== EXCEL IMPORT ====================
  const handleDownloadTemplate = useCallback(() => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Código', 'Nombre', 'Categoría', 'Tipo', 'Precio Venta', 'Precio Costo', 'Stock Inicial', 'IMEI'],
      ['SKU-001', 'Ejemplo Producto', 'Electrónica', 'PRODUCTO', 150, 100, 50, 'NO'],
      ['SRV-001', 'Ejemplo Servicio', 'Consultoría', 'SERVICIO', 500, 0, 0, 'NO'],
    ]);
    ws['!cols'] = [{ wch: 14 }, { wch: 25 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'plantilla_importar_productos.xlsx');
    toast.success('Plantilla descargada');
  }, []);

  const handleFileSelected = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        if (raw.length < 2) {
          toast.error('El archivo está vacío o no tiene datos');
          return;
        }
        const headers = raw[0].map((h: any) => String(h || '').trim().toLowerCase());
        const colMap: Record<string, number> = {};
        const aliases: Record<string, string[]> = {
          code: ['código', 'codigo', 'code', 'sku'],
          name: ['nombre', 'name', 'producto', 'descripción', 'descripcion'],
          category: ['categoría', 'categoria', 'category', 'cat'],
          itemType: ['tipo', 'type', 'item type', 'itemtype'],
          salePrice: ['precio venta', 'precio_venta', 'sale price', 'saleprice', 'venta', 'precio'],
          costPrice: ['precio costo', 'precio_costo', 'cost price', 'costprice', 'costo'],
          initialStock: ['stock inicial', 'stock', 'initial stock', 'cantidad', 'qty'],
          imei: ['imei', 'serial', 'tracking'],
        };
        for (const [key, alts] of Object.entries(aliases)) {
          const idx = headers.findIndex((h: string) => alts.includes(h));
          if (idx >= 0) colMap[key] = idx;
        }
        const parsed = raw.slice(1).filter((row: any[]) => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')).map((row: any[]) => {
          const get = (key: string) => colMap[key] !== undefined ? row[colMap[key]] : undefined;
          const typeStr = String(get('itemType') || 'PRODUCTO').toUpperCase();
          const isService = typeStr === 'SERVICIO' || typeStr === 'SERVICE';
          return {
            code: String(get('code') || '').trim(),
            name: String(get('name') || '').trim(),
            category: String(get('category') || '').trim(),
            itemType: isService ? 'SERVICE' : 'PRODUCT',
            salePrice: Number(get('salePrice') || 0),
            costPrice: Number(get('costPrice') || 0),
            initialStock: isService ? 0 : Number(get('initialStock') || 0),
            trackSerialNumbers: String(get('imei') || '').toUpperCase() === 'SI' || String(get('imei') || '').toUpperCase() === 'YES',
            _hasError: !String(get('code') || '').trim() || !String(get('name') || '').trim(),
          };
        });
        setImportData(parsed);
        setImportFileName(file.name);
        toast.success(`${parsed.length} registros encontrados`);
      } catch (err) {
        console.error('Parse error', err);
        toast.error('No se pudo leer el archivo. Asegúrate de que sea un .xlsx o .csv válido.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleImportConfirm = useCallback(async () => {
    const valid = importData.filter((row) => !row._hasError);
    if (valid.length === 0) {
      toast.error('No hay registros válidos para importar');
      return;
    }
    setImporting(true);
    try {
      const items = valid.map((row) => {
        const cat = categories.find((c: any) => c.name?.toLowerCase() === row.category?.toLowerCase());
        return {
          code: row.code,
          name: row.name,
          categoryId: cat?.id || categories[0]?.id || '',
          itemType: row.itemType as 'PRODUCT' | 'SERVICE',
          salePrice: row.salePrice,
          costPrice: row.costPrice,
          initialStock: row.initialStock,
          trackSerialNumbers: row.trackSerialNumbers,
        };
      });
      const results = await inventoryService.bulkCreateProducts(items);
      if (results.success > 0) toast.success(`${results.success} registros importados correctamente`);
      if (results.failed > 0) toast.error(`${results.failed} registros fallaron: ${results.errors.slice(0, 3).join(', ')}`);
      setImportModalOpen(false);
      setImportData([]);
      setImportFileName('');
      onRefresh();
    } catch (e: any) {
      toast.error('Error durante la importación: ' + (e.message || 'Error'));
    } finally {
      setImporting(false);
    }
  }, [importData, categories, onRefresh]);

  return (
    <Card className="p-4 border bg-card rounded-xl">
      <div className="mb-5">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight">Existencias actuales</h2>
            <p className="text-sm text-muted-foreground">Selecciona un estado para filtrar la lista.</p>
          </div>
          <p className="text-xs font-medium text-muted-foreground">{warehouses.length} almacenes registrados</p>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            { id: 'all', label: 'Productos', value: inventorySummary.total, tone: 'text-foreground' },
            { id: 'available', label: 'Disponibles', value: inventorySummary.available, tone: 'text-emerald-600' },
            { id: 'low', label: 'Stock bajo', value: inventorySummary.low, tone: 'text-amber-600' },
            { id: 'out', label: 'Sin stock', value: inventorySummary.out, tone: 'text-rose-600' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={stockFilter === item.id}
              onClick={() => setStockFilter(item.id as typeof stockFilter)}
              className={`rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                stockFilter === item.id ? 'border-primary bg-primary/5' : 'border-border/70 bg-muted/20 hover:bg-muted/50'
              }`}
            >
              <span className="block text-xs font-semibold text-muted-foreground">{item.label}</span>
              <span className={`mt-1 block text-2xl font-black tabular-nums ${item.tone}`}>{item.value}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nombre o código..." 
              className="pl-9 h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <MultiSelectFilter
            label="Categorías"
            placeholder="Buscar categoría..."
            options={categories.map((c: any) => ({ value: c.id, label: c.name }))}
            selected={categoryFilters}
            onChange={setCategoryFilters}
          />
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
            <SelectTrigger className="h-9 w-full sm:w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="PRODUCT">🏷 Productos</SelectItem>
              <SelectItem value="SERVICE">⚙ Servicios</SelectItem>
            </SelectContent>
          </Select>
          <MultiSelectFilter
            label="Almacenes"
            placeholder="Buscar almacén..."
            searchable
            options={warehouses.map((w: any) => ({ value: w.id, label: w.name }))}
            selected={warehouseFilters}
            onChange={setWarehouseFilters}
          />
          {(categoryFilters.length > 0 || warehouseFilters.length > 0 || searchTerm || typeFilter !== 'all' || stockFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearchTerm('');
                setCategoryFilters([]);
                setWarehouseFilters([]);
                setTypeFilter('all');
                setStockFilter('all');
              }}
            >
              <X className="size-3.5 mr-1" />
              Limpiar filtros
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-4"
            onClick={() => setCategoryModalOpen(true)}
          >
            <Plus className="size-4 mr-2" />
            Nueva Categoría
          </Button>
          {canPerform('INVENTORY_PRODUCTS', 'create') && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-4 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => { setImportData([]); setImportFileName(''); setImportModalOpen(true); }}
            >
              <Upload className="size-4 mr-2" />
              Importar Excel
            </Button>
          )}
          {canPerform('INVENTORY_PRODUCTS', 'create') && (
            <Button 
              size="sm" 
              className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all gap-2 font-black text-xs uppercase tracking-widest h-10 px-6"
              onClick={handleAddNewRow}
            >
              <Plus className="size-4" />
              Agregar
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border/50">
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-28">Código</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Nombre</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-36">Categoría</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-24">Tipo</TableHead>
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
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  <Package className="size-10 mx-auto mb-2 opacity-20" />
                  <p className="font-medium">{products.length > 0 ? 'No hay coincidencias' : 'No hay productos registrados'}</p>
                  <p className="text-sm">
                    {products.length > 0 ? 'Cambia los filtros o busca otro nombre o codigo.' : 'Agrega un producto o importa tu catalogo para comenzar.'}
                  </p>
                  {products.length > 0 && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-4"
                                        onClick={() => {
                                          setSearchTerm('');
                                          setCategoryFilters([]);
                                          setWarehouseFilters([]);
                                          setTypeFilter('all');
                                          setStockFilter('all');
                                        }}
                                      >
                                        Limpiar filtros
                                      </Button>
                                    )}
                </TableCell>
              </TableRow>
            ) : (
              paginatedProducts.map((product) => {
                const isEditing = editingRows.has(product.id);
                if (isEditing) {
                  return renderEditableRow(editingRows.get(product.id)!);
                }
                
                const status = getStockStatus(product.stock || 0);
                 return (
                   <TableRow 
                     key={product.id} 
                     className="group hover:bg-muted/30 cursor-pointer"
                     onClick={() => setProductDetail(product)}
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
                    <TableCell>
                      {(product.itemType || 'PRODUCT').toUpperCase() === 'SERVICE' ? (
                        <Badge className="bg-violet-500/10 text-violet-500 text-[9px] font-black uppercase px-1.5 py-0">Servicio</Badge>
                      ) : (
                        <Badge className="bg-sky-500/10 text-sky-500 text-[9px] font-black uppercase px-1.5 py-0">Producto</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {(product.itemType || 'PRODUCT').toUpperCase() === 'SERVICE' ? (
                        <span className="text-xs text-muted-foreground/50 italic">N/A</span>
                      ) : (product.stock || 0)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatAmount(product.salePrice || 0, 'NIO')}</TableCell>
                     <TableCell className="text-right text-muted-foreground tabular-nums">{formatAmount(product.costPrice || 0, 'NIO')}</TableCell>
                     <TableCell className="text-right font-black tabular-nums">
                       <span className={(Number(product.salePrice || 0) - Number(product.costPrice || 0)) >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                         {formatAmount(Number(product.salePrice || 0) - Number(product.costPrice || 0), 'NIO')}
                       </span>
                     </TableCell>
                     <TableCell className="text-right">
                       <div className="flex items-center justify-end gap-1 transition-opacity">
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
                             <Pencil className="size-3.5" />
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

      {/* Pagination Footer */}
      <div className="flex flex-col gap-3 mt-4 px-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {filteredProducts.length === 0
            ? 'Sin resultados'
            : <>Mostrando <span className="font-semibold text-foreground">{((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, filteredProducts.length)}</span> de <span className="font-semibold text-foreground">{filteredProducts.length}</span> productos</>}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / página</SelectItem>
              <SelectItem value="25">25 / página</SelectItem>
              <SelectItem value="50">50 / página</SelectItem>
              <SelectItem value="100">100 / página</SelectItem>
            </SelectContent>
          </Select>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  aria-label="Primera página"
                >
                  <ChevronsLeft className="size-4" />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="size-4" />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <span className="text-xs font-medium px-3 tabular-nums whitespace-nowrap">
                  Página {page} de {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  aria-label="Última página"
                >
                  <ChevronsRight className="size-4" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
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
      <ProductDetailDrawer
        productId={productDetail?.id ?? null}
        onOpenChange={(open) => !open && setProductDetail(null)}
        productSnapshot={productDetail}
        warehouses={warehouses}
        movements={movements}
        series={series}
      />
      <Dialog open={importModalOpen} onOpenChange={(open) => {
        if (!importing) {
          setImportModalOpen(open);
          if (!open) { setImportData([]); setImportFileName(''); }
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Importar Productos/Servicios</DialogTitle>
            <DialogDescription>
              Sube un archivo Excel (.xlsx) o CSV con tu catálogo. 
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto min-h-0 space-y-4 py-2">
            {!importFileName ? (
              <div className="space-y-4">
                <div 
                  className="border-2 border-dashed border-primary/20 rounded-xl p-8 hover:bg-primary/5 transition-colors cursor-pointer text-center flex flex-col items-center gap-3"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) handleFileSelected(e.dataTransfer.files[0]);
                  }}
                >
                  <div className="size-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <FileSpreadsheet className="size-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold">Haz clic para buscar un archivo</p>
                    <p className="text-xs text-muted-foreground mt-1">O arrástralo y suéltalo aquí</p>
                  </div>
                  <input type="file" className="hidden" accept=".xlsx,.xls,.csv" ref={fileInputRef} onChange={(e) => {
                    if (e.target.files?.[0]) handleFileSelected(e.target.files[0]);
                  }} />
                </div>
                <div className="bg-muted/30 p-4 rounded-xl border">
                  <p className="text-sm font-semibold mb-2">Columnas soportadas:</p>
                  <div className="text-xs text-muted-foreground grid grid-cols-2 gap-2">
                    <p>• <b>Código</b> (requerido)</p>
                    <p>• <b>Nombre</b> (requerido)</p>
                    <p>• <b>Categoría</b></p>
                    <p>• <b>Tipo</b> (Producto / Servicio)</p>
                    <p>• <b>Precio Venta</b></p>
                    <p>• <b>Precio Costo</b></p>
                    <p>• <b>Stock Inicial</b></p>
                    <p>• <b>IMEI</b> (Si/No)</p>
                  </div>
                  <Button variant="outline" size="sm" className="mt-4 text-xs font-bold w-full" onClick={handleDownloadTemplate}>
                    <Download className="size-3 mr-2" />
                    Descargar Plantilla de Ejemplo
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 flex flex-col h-full">
                <div className="flex items-center justify-between">
                  <p className="text-sm">
                    Archivo: <span className="font-semibold">{importFileName}</span> 
                    <span className="text-muted-foreground ml-2">({importData.length} filas válidas)</span>
                  </p>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setImportFileName(''); setImportData([]); }} disabled={importing}>
                    Cambiar archivo
                  </Button>
                </div>

                <div className="border rounded-md flex-1 overflow-auto">
                  <Table>
                    <TableHeader className="bg-muted sticky top-0 z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="text-[10px] uppercase w-8"></TableHead>
                        <TableHead className="text-[10px] uppercase">Código</TableHead>
                        <TableHead className="text-[10px] uppercase">Nombre</TableHead>
                        <TableHead className="text-[10px] uppercase">Tipo</TableHead>
                        <TableHead className="text-[10px] uppercase">Categoría</TableHead>
                        <TableHead className="text-[10px] uppercase text-right">Venta</TableHead>
                        <TableHead className="text-[10px] uppercase text-right">Stock</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importData.slice(0, 100).map((row, i) => (
                        <TableRow key={i} className={row._hasError ? 'bg-red-500/10' : ''}>
                          <TableCell>
                            {row._hasError ? (
                              <AlertTriangle className="size-4 text-red-500" />
                            ) : (
                              <Check className="size-4 text-emerald-500" />
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{row.code || <span className="text-red-500">Falta</span>}</TableCell>
                          <TableCell className="text-xs truncate max-w-[200px]">{row.name || <span className="text-red-500">Falta</span>}</TableCell>
                          <TableCell className="text-xs">
                            {row.itemType === 'SERVICE' ? 'Servicio' : 'Producto'}
                          </TableCell>
                          <TableCell className="text-xs max-w-[120px] truncate">{row.category || '-'}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{formatAmount(row.salePrice, 'NIO')}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {row.itemType === 'SERVICE' ? 'N/A' : row.initialStock}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {importData.length > 100 && (
                    <p className="text-xs text-center p-2 text-muted-foreground border-t bg-muted/20">
                      Mostrando 100 de {importData.length} filas
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="mt-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setImportModalOpen(false)} disabled={importing}>
              Cerrar
            </Button>
            {importData.length > 0 && (
              <Button 
                onClick={handleImportConfirm} 
                disabled={importing || importData.filter(r => !r._hasError).length === 0}
                className="bg-primary text-primary-foreground font-bold"
              >
                {importing ? 'Importando...' : `Importar ${importData.filter(r => !r._hasError).length} Registros`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

