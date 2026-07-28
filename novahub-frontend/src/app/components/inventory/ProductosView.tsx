import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { Search, Plus, Trash2, X, Check, Copy, Package, Upload, FileSpreadsheet, AlertTriangle, Download, Pencil, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Square, SquareCheckBig } from 'lucide-react';
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
import { ProductImagePicker, ProductThumbnail } from '../ui/ProductImage';
import { storageService } from '../../services/storage.service';
import { AddProductsModal } from './AddProductsModal';


interface ProductosViewProps {
  products: any[];
  categories: any[];
  warehouses?: any[];
  series?: any[];
  movements?: any[];
  onRefresh: () => void;
  itemType?: 'PRODUCT' | 'SERVICE';
}

interface EditingProduct {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  salePrice: number | '';
  costPrice: number | '';
  unit?: string;
  minStock?: number;
  maxStock?: number;
  trackSerialNumbers?: boolean;
  itemType?: 'PRODUCT' | 'SERVICE';
  warehouseId?: string;
  imageUrl?: string;
  imageStorageUri?: string;
  imageFile?: File;
  imagePreviewUrl?: string;
  removeImage?: boolean;
  initialStock?: number;
  initialAllocations?: Array<{
    id: string;
    warehouseId: string;
    quantity: number;
    minStock?: number;
    maxStock?: number;
  }>;
  isNew?: boolean;
}

export function ProductosView({ products, categories, warehouses = [], series = [], movements = [], onRefresh, itemType }: ProductosViewProps) {
  const { formatAmount, baseCurrency } = useCurrency();
  const { canPerform } = useAuth();
  const catalogItemType = itemType || 'PRODUCT';
  const isServiceView = catalogItemType === 'SERVICE';
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
  const [duplicatingIds, setDuplicatingIds] = useState<Set<string>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [productDetail, setProductDetail] = useState<any | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; skipped: number; failed: number; errors: string[] } | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [replenishmentPeriod, setReplenishmentPeriod] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [replenishmentData, setReplenishmentData] = useState<any[] | null>(null);
  const [replenishmentModalOpen, setReplenishmentModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  
  const [skuErrors, setSkuErrors] = useState<Map<string, string>>(new Map());
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const validateSkuDebounced = (productId: string, code: string, isNew: boolean) => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await inventoryService.checkProductCode(code, isNew ? undefined : productId);
        const exists = response?.exists;
        setSkuErrors(prev => {
          const next = new Map(prev);
          if (exists) next.set(productId, 'Código duplicado');
          else next.delete(productId);
          return next;
        });
      } catch (e: any) {
        console.error('Error validating SKU', e);
      }
    }, 1000);
  };

  const newRowRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);


  // Reset page & selection when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [searchTerm, categoryFilters, warehouseFilters, typeFilter, stockFilter, catalogItemType]);

  // Clear selection when products list changes (e.g. after refresh)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [products]);

  const filteredProducts = products.filter((p: any) => {
    const matchesSearch = !searchTerm || 
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilters.length === 0 || categoryFilters.includes(p.categoryId);
    const matchesWarehouse = warehouseFilters.length === 0
      || (Array.isArray(p.stockByWarehouse) && warehouseFilters.some((wId) => Number(p.stockByWarehouse?.[wId] || 0) > 0))
      || (isServiceView && Array.isArray(p.warehouseCatalogs) && warehouseFilters.some((wId) => p.warehouseCatalogs.some((catalog: any) => catalog.warehouseId === wId)));
    const pType = String(p.itemType || p.type || 'PRODUCT').toUpperCase();
    const matchesType = pType === catalogItemType && (itemType ? true : typeFilter === 'all' || pType === typeFilter);
    const stock = Number(p.stock || 0);
    const pMinStock = Number(p.minStock || 0);
    const stockThreshold = pMinStock > 0 ? pMinStock : 10;
    const matchesStock = stockFilter === 'all'
      || (stockFilter === 'available' && pType === 'PRODUCT' && stock > stockThreshold)
      || (stockFilter === 'available' && pType === 'PRODUCT' && stockThreshold <= 0 && stock > 0)
      || (stockFilter === 'low' && pType === 'PRODUCT' && stock > 0 && stock <= stockThreshold)
      || (stockFilter === 'out' && pType === 'PRODUCT' && stock <= 0);
    return matchesSearch && matchesCategory && matchesWarehouse && matchesType && matchesStock;
      });

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));

  const inventorySummary = useMemo(() => {
    const stockProducts = products.filter((product: any) => String(product.itemType || product.type || 'PRODUCT').toUpperCase() === catalogItemType);
    const isLow = (p: any) => {
      const stock = Number(p.stock || 0);
      if (stock <= 0) return false;
      const minStock = Number(p.minStock || 0);
      return minStock > 0 ? stock <= minStock : stock < 10;
    };
    return {
      total: stockProducts.length,
      available: stockProducts.filter((p: any) => {
        if (catalogItemType === 'SERVICE') return true;
        const stock = Number(p.stock || 0);
        if (stock <= 0) return false;
        const minStock = Number(p.minStock || 0);
        return minStock > 0 ? stock > minStock : stock >= 10;
      }).length,
      low: catalogItemType === 'SERVICE' ? 0 : stockProducts.filter(isLow).length,
      out: catalogItemType === 'SERVICE' ? 0 : stockProducts.filter((p: any) => Number(p.stock || 0) <= 0).length,
    };
  }, [products, catalogItemType]);

  const getStockStatus = (product: any) => {
    const stock = Number(product.stock || 0);
    if (stock <= 0) return { label: 'Sin Stock', color: 'bg-red-500/10 text-red-500', icon: 'critical' };
    const minStock = Number(product.minStock || 0);
    if (minStock > 0 && stock <= minStock) return { label: 'Bajo', color: 'bg-orange-500/10 text-orange-500', icon: 'low' };
    if (stock < 10) return { label: 'Bajo', color: 'bg-orange-500/10 text-orange-500', icon: 'low' };
    return { label: 'OK', color: 'bg-green-500/10 text-green-500', icon: 'ok' };
  };

  const getProductMaxStock = (product: any) => {
    const levels = Array.isArray(product.stockLevels) ? product.stockLevels : [];
    const values = levels
      .map((level: any) => Number(level.maxStock || 0))
      .filter((value: number) => value > 0);
    return values.length > 0 ? Math.max(...values) : Number(product.maxStock || 0);
  };

  const getStockAlertColor = (product: any) => {
    const stock = Number(product.stock || 0);
    if (stock <= 0) return 'text-red-500 font-bold';
    const minStock = Number(product.minStock || 0);
    if (minStock > 0 && stock <= minStock) return 'text-orange-500 font-bold';
    if (stock < 10) return 'text-orange-500';
    const maxStock = getProductMaxStock(product);
    if (maxStock > 0 && stock > maxStock) return 'text-blue-500';
    return 'text-foreground';
  };

  const handleAddRow = () => {
    const tempId = `new-${Date.now()}`;
    const newProduct: EditingProduct = {
      id: tempId,
      code: '',
      name: '',
      categoryId: categories[0]?.id || '',
      salePrice: '',
      costPrice: '',
      unit: 'unidad',
      minStock: 0,
      maxStock: 0,
      trackSerialNumbers: false,
      itemType: catalogItemType,
      isNew: true,
      initialStock: 0,
      initialAllocations: warehouses.length > 0 ? [{ id: `alloc-${Date.now()}-0`, warehouseId: warehouses[0]?.id || '', quantity: 0, minStock: 0, maxStock: 0 }] : []
    };
    setEditingRows(new Map(editingRows).set(tempId, newProduct));
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
      unit: product.unit || 'unidad',
      minStock: Number(product.minStock) || 0,
      maxStock: getProductMaxStock(product),
      trackSerialNumbers: Boolean(
        product.trackSerialNumbers ||
        product.serialTracking ||
        product.serialNumberTracking ||
        String(product.trackingType || '').toUpperCase() === 'SERIAL',
      ),
      itemType: String(product.itemType || product.type || 'PRODUCT').toUpperCase() as 'PRODUCT' | 'SERVICE',
      imageUrl: product.imageUrl,
      imageStorageUri: product.imageUrlStorageUri || (String(product.imageUrl || '').startsWith('storage://') ? product.imageUrl : undefined),
      warehouseId: product.warehouseCatalogs?.[0]?.warehouseId || product.warehouseCatalogs?.[0]?.warehouse?.id,
      initialAllocations: String(product.itemType || product.type || 'PRODUCT').toUpperCase() === 'SERVICE'
        ? [{ id: `alloc-service-${Date.now()}`, warehouseId: product.warehouseCatalogs?.[0]?.warehouseId || product.warehouseCatalogs?.[0]?.warehouse?.id || '', quantity: 0, minStock: 0, maxStock: 0 }]
        : (product.stockLevels && product.stockLevels.length > 0)
        ? product.stockLevels.map((sl: any, idx: number) => ({
            id: `alloc-edit-${Date.now()}-${idx}`,
            warehouseId: sl.warehouseId,
            quantity: Number(sl.quantity) || 0,
            minStock: Number(sl.minStock || 0),
            maxStock: Number(sl.maxStock || 0),
          }))
        : [{ id: `alloc-edit-${Date.now()}-0`, warehouseId: '', quantity: 0, minStock: Number(product.minStock || 0), maxStock: getProductMaxStock(product) }]
    };
    setEditingRows(new Map(editingRows.set(product.id, editProduct)));
  };

  const handleCancelEdit = (id: string) => {
    const current = editingRows.get(id);
    if (current?.imagePreviewUrl) URL.revokeObjectURL(current.imagePreviewUrl);
    const newMap = new Map(editingRows);
    newMap.delete(id);
    setEditingRows(newMap);
  };

  const handleImageSelected = (id: string, file: File) => {
    const current = editingRows.get(id);
    if (!current) return;
    if (current.imagePreviewUrl) URL.revokeObjectURL(current.imagePreviewUrl);
    const previewUrl = URL.createObjectURL(file);
    const next = new Map(editingRows);
    next.set(id, { ...current, imageFile: file, imagePreviewUrl: previewUrl, removeImage: false });
    setEditingRows(next);
  };

  const handleImageRemoved = (id: string) => {
    const current = editingRows.get(id);
    if (!current) return;
    if (current.imagePreviewUrl) URL.revokeObjectURL(current.imagePreviewUrl);
    const next = new Map(editingRows);
    next.set(id, {
      ...current,
      imageFile: undefined,
      imagePreviewUrl: undefined,
      imageUrl: undefined,
      removeImage: true,
    });
    setEditingRows(next);
  };

  const handleUpdateField = (id: string, field: keyof EditingProduct, value: any) => {
    const current = editingRows.get(id);
    if (current) {
      let finalValue = value;
      // Keep an empty price as a valid editing draft so users can erase the
      // initial zero before typing a new amount. It is normalized on save.
      if (field === 'salePrice' || field === 'costPrice') {
        if (value === '') {
          finalValue = '';
        } else {
          const parsed = Number(value);
          finalValue = Number.isFinite(parsed) ? Math.max(0, parsed) : current[field];
        }
      } else if (field === 'initialStock' || field === 'minStock' || field === 'maxStock') {
        finalValue = Math.max(0, Number(value) || 0);
      }
      const nextProduct = { ...current, [field]: finalValue };
      if (field === 'minStock' || field === 'maxStock') {
        nextProduct.initialAllocations = (current.initialAllocations || []).map((item) => ({
          ...item,
          [field]: finalValue,
        }));
      }
      setEditingRows(new Map(editingRows.set(id, nextProduct)));
      
      if (field === 'code') {
        validateSkuDebounced(id, finalValue as string, !!current.isNew);
      }
    }
  };

  const updateInitialAllocation = (
    productId: string,
    allocationId: string,
    patch: Partial<{ warehouseId: string; quantity: number; minStock: number; maxStock: number }>,
  ) => {
    const product = editingRows.get(productId);
    if (!product) return;
    const nextAllocations = (product.initialAllocations || []).map((item) =>
      item.id === allocationId ? { ...item, ...patch } : item,
    );
    setEditingRows(new Map(editingRows.set(productId, { ...product, initialAllocations: nextAllocations })));
  };

  const addInitialAllocation = (productId: string) => {
    const product = editingRows.get(productId);
    if (!product) return;
    const next = [
      ...(product.initialAllocations || []),
      {
        id: `alloc-${Date.now()}-${(product.initialAllocations || []).length}`,
        warehouseId: '',
        quantity: 0,
        minStock: Number(product.minStock || 0),
        maxStock: Number(product.maxStock || 0),
      },
    ];
    setEditingRows(new Map(editingRows.set(productId, { ...product, initialAllocations: next })));
  };

  const removeInitialAllocation = (productId: string, allocationId: string) => {
    const product = editingRows.get(productId);
    if (!product) return;
    const current = product.initialAllocations || [];
    if (current.length <= 1) return;
    const next = current.filter((item) => item.id !== allocationId);
    setEditingRows(new Map(editingRows.set(productId, { ...product, initialAllocations: next })));
  };

  const handleSaveRow = async (id: string) => {
    const product = editingRows.get(id);
    if (!product) return;

    if (skuErrors.get(id)) {
      toast.error('Corrige el error en el código antes de guardar');
      return;
    }

    if (!product.name || !product.code) {
      toast.error('Nombre y código son requeridos');
      return;
    }

    const validAllocations = product.isNew
      ? (product.initialAllocations || []).filter((item) =>
          item.warehouseId
          && (Number(item.quantity || 0) > 0 || Number(item.minStock || 0) > 0 || Number(item.maxStock || 0) > 0),
        )
      : [];
    const serviceWarehouseId = product.initialAllocations?.find((item) => item.warehouseId)?.warehouseId || product.warehouseId;
    if (product.itemType === 'SERVICE' && !serviceWarehouseId) {
      toast.error('Selecciona el almacén vinculado al servicio');
      return;
    }
    const uniqueWarehouses = new Set(validAllocations.map((item) => item.warehouseId));

    if (validAllocations.length > 0 && warehouses.length === 0) {
      toast.error('No hay bodegas registradas para asignar stock inicial');
      return;
    }
    if (validAllocations.length > 0 && uniqueWarehouses.size !== validAllocations.length) {
      toast.error('No repitas la misma bodega en la distribución inicial');
      return;
    }
    const invalidMax = (product.initialAllocations || []).some((item) =>
      Number(item.maxStock || 0) > 0 && Number(item.maxStock || 0) < Number(item.minStock || 0),
    );
    if (invalidMax) {
      toast.error('El máximo de inventario no puede ser menor que el mínimo');
      return;
    }

    setSavingIds((current) => new Set(current).add(id));
    let uploadedImageUri: string | undefined;
    try {
      if (product.imageFile) {
        const uploaded = await storageService.uploadFile('product-image', product.imageFile, {
          folder: product.isNew ? 'catalog' : product.id,
        });
        uploadedImageUri = uploaded.uri;
      }
      const nextImageUrl = uploadedImageUri ?? (product.removeImage ? null : product.imageStorageUri);

      if (product.isNew) {
        const createdResponse = await inventoryService.createProduct({
          code: product.code,
          name: product.name,
          categoryId: product.categoryId,
          salePrice: Number(product.salePrice || 0),
          costPrice: Number(product.costPrice || 0),
          unit: product.unit || 'unidad',
          minStock: Number(product.minStock || 0),
          trackSerialNumbers: Boolean(product.trackSerialNumbers),
          type: product.itemType || catalogItemType,
          itemType: product.itemType || 'PRODUCT',
          warehouseId: product.itemType === 'SERVICE' ? serviceWarehouseId : undefined,
          initialStock: 0,
          imageUrl: nextImageUrl || undefined,
        });
        const created = (createdResponse as any)?.data || createdResponse;
        const createdId = created?.id;
        if (validAllocations.length > 0 && createdId) {
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
                    minStock: Number(item.minStock ?? product.minStock ?? 0),
                    maxStock: Number(item.maxStock ?? product.maxStock ?? 0) || undefined,
                  });

                  if (Number(item.quantity || 0) > 0) {
                    await inventoryService.createMovement({
                      productId: createdId,
                      warehouseId: item.warehouseId,
                      variantId: variantId,
                      type: 'IN',
                      quantity: Number(item.quantity || 0),
                      reference: `STOCK-INICIAL-${created.code || createdId}`,
                    });
                  }
                })
              );
            }
          } catch (err: any) {
            console.error('Error allocating initial stock', err);
            toast.error(err?.response?.data?.message || err?.message || 'Producto creado, pero hubo un error al asignar el stock');
          }
        }
        toast.success('Producto creado');
      } else {
        await inventoryService.updateProduct(id, {
          code: product.code,
          name: product.name,
          categoryId: product.categoryId,
          salePrice: Number(product.salePrice || 0),
          costPrice: Number(product.costPrice || 0),
          unit: product.unit || 'unidad',
          minStock: Number(product.minStock || 0),
          trackSerialNumbers: Boolean(product.trackSerialNumbers),
          type: product.itemType || catalogItemType,
          itemType: product.itemType || 'PRODUCT',
          warehouseId: product.itemType === 'SERVICE' ? serviceWarehouseId : undefined,
          imageUrl: nextImageUrl,
        });

        const originalProduct = products.find(p => p.id === id);
        const variantId = originalProduct?.variants?.[0]?.id;
        if (product.itemType !== 'SERVICE' && variantId && product.initialAllocations) {
          const allocations = product.initialAllocations.filter(item => item.warehouseId);
          await Promise.all(
            allocations.map(async (item) => {
              const originalAlloc = originalProduct?.stockLevels?.find((sl: any) => sl.warehouseId === item.warehouseId);
              const oldQuantity = Number(originalAlloc?.quantity || 0);
              const newQuantity = Number(item.quantity || 0);
              const oldMinStock = Number(originalAlloc?.minStock || 0);
              const oldMaxStock = Number(originalAlloc?.maxStock || 0);
              const newMinStock = Number(item.minStock ?? product.minStock ?? 0);
              const newMaxStock = Number(item.maxStock ?? product.maxStock ?? 0);

              if (oldQuantity !== newQuantity || oldMinStock !== newMinStock || oldMaxStock !== newMaxStock) {
                await inventoryService.updateStockLevel({
                  productId: id,
                  warehouseId: item.warehouseId,
                  variantId: variantId,
                  quantity: newQuantity,
                  minStock: newMinStock,
                  maxStock: newMaxStock || undefined,
                });
                const diff = newQuantity - oldQuantity;
                if (diff !== 0) {
                  await inventoryService.createMovement({
                    productId: id,
                    warehouseId: item.warehouseId,
                    variantId: variantId,
                    type: diff > 0 ? 'IN' : 'OUT',
                    quantity: Math.abs(diff),
                    reference: `AJUSTE-EDICION-${product.code || id}`,
                  });
                }
              }
            })
          );
        }

        toast.success('Producto actualizado');
      }
      if (!product.isNew && product.imageStorageUri && product.imageStorageUri !== uploadedImageUri && (uploadedImageUri || product.removeImage)) {
        storageService.deleteFile(product.imageStorageUri).catch((error) => {
          console.warn('No se pudo eliminar la imagen anterior del producto', error);
        });
      }
      handleCancelEdit(id);
      onRefresh();
    } catch (e: any) {
      if (uploadedImageUri) storageService.deleteFile(uploadedImageUri).catch(() => undefined);
      toast.error(e.message || 'Error al guardar');
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDeleteProduct = async (id: string) => {
    setPendingDeleteId(id);
  };

  const handleDuplicateProduct = async (product: any) => {
    setDuplicatingIds((current) => new Set(current).add(product.id));
    try {
      await inventoryService.duplicateProduct(product.id);
      toast.success(`Copia de ${product.name} creada`);
      onRefresh();
    } catch (error: any) {
      toast.error(error?.message || 'Error al duplicar el producto');
    } finally {
      setDuplicatingIds((current) => {
        const next = new Set(current);
        next.delete(product.id);
        return next;
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;
    setDeleteLoading(true);
    try {
      await inventoryService.deleteProduct(pendingDeleteId);
      toast.success('Producto eliminado');
      setPendingDeleteId(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar');
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
        type: catalogItemType,
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
        <TableCell className="align-top pt-3">
          <div className="flex flex-col gap-1 w-full min-w-[90px]">
            <Input
              ref={product.isNew ? newRowRef : undefined}
              value={product.code}
              onChange={(e) => handleUpdateField(product.id, 'code', e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, product.id)}
              className={`h-8 text-xs font-mono w-full ${skuErrors.get(product.id) ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              disabled={isSaving}
            />
            {skuErrors.get(product.id) && (
              <span className="text-[9px] text-red-500 font-bold uppercase tracking-wider leading-tight">{skuErrors.get(product.id)}</span>
            )}
          </div>
        </TableCell>
        <TableCell className="align-top pt-3">
          <div className="flex min-w-[200px] items-start gap-3">
            <ProductImagePicker
              src={product.imagePreviewUrl || product.imageUrl}
              productName={product.name}
              disabled={isSaving}
              onSelect={(file) => handleImageSelected(product.id, file)}
              onRemove={() => handleImageRemoved(product.id)}
            />
            <div className="min-w-0 flex-1 space-y-2 mt-0.5">
              <Input
                value={product.name}
                onChange={(e) => handleUpdateField(product.id, 'name', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, product.id)}
                placeholder="Nombre"
                className="h-8 text-xs w-full min-w-[200px]"
                disabled={isSaving}
              />
              {!isServiceView && <Button
                type="button"
                variant={product.trackSerialNumbers ? 'default' : 'outline'}
                size="sm"
                className={`h-6 text-[9px] uppercase tracking-wider px-2 w-full ${product.trackSerialNumbers ? 'bg-primary text-primary-foreground' : ''}`}
                onClick={() => handleUpdateField(product.id, 'trackSerialNumbers', !product.trackSerialNumbers)}
                disabled={isSaving}
              >
                IMEI {product.trackSerialNumbers ? 'Activo' : 'Inactivo'}
              </Button>}
            </div>
          </div>
        </TableCell>
        <TableCell className="align-top pt-3">
          <div className="space-y-1.5 min-w-[120px]">
            <Select 
              value={product.categoryId} 
              onValueChange={(v) => handleUpdateField(product.id, 'categoryId', v)}
              disabled={isSaving}
            >
              <SelectTrigger className="h-8 text-xs w-full min-w-[120px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[9px] uppercase tracking-wider text-muted-foreground hover:text-primary px-2"
                onClick={() => setCategoryModalOpen(true)}
                disabled={isSaving}
              >
                <Plus className="size-3 mr-1" />
                Categoría
              </Button>
            </div>
          </div>
        </TableCell>
        {!isServiceView && <TableCell className="align-top pt-3">
          <Select 
            value={product.unit || 'unidad'} 
            onValueChange={(v) => handleUpdateField(product.id, 'unit', v)}
            disabled={isSaving}
          >
            <SelectTrigger className="h-8 text-xs w-full min-w-[100px]">
              <SelectValue placeholder="Unidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unidad">Unidad</SelectItem>
              <SelectItem value="kilo">Kilo</SelectItem>
              <SelectItem value="libra">Libra</SelectItem>
              <SelectItem value="docena">Docena</SelectItem>
              <SelectItem value="caja">Caja</SelectItem>
              <SelectItem value="litro">Litro</SelectItem>
              <SelectItem value="metro">Metro</SelectItem>
              <SelectItem value="par">Par</SelectItem>
              <SelectItem value="rollo">Rollo</SelectItem>
              <SelectItem value="pieza">Pieza</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>}
        {!isServiceView && <TableCell className="align-top pt-3">
          <Input
            type="number"
            min={0}
            value={product.minStock ?? 0}
            onChange={(e) => handleUpdateField(product.id, 'minStock', Math.max(0, Number(e.target.value) || 0))}
            onKeyDown={(e) => handleKeyDown(e, product.id)}
            className="h-8 text-xs text-right min-w-[70px]"
            disabled={isSaving}
          />
        </TableCell>}
        {!isServiceView && <TableCell className="align-top pt-3">
          <Input
            type="number"
            min={0}
            value={product.maxStock ?? 0}
            onChange={(e) => handleUpdateField(product.id, 'maxStock', Math.max(0, Number(e.target.value) || 0))}
            onKeyDown={(e) => handleKeyDown(e, product.id)}
            className="h-8 text-xs text-right min-w-[70px]"
            disabled={isSaving}
          />
        </TableCell>}
        <TableCell className="align-top pt-3">
          {product.itemType === 'SERVICE' ? (() => {
            const allocation = product.initialAllocations?.[0];
            return <Select value={allocation?.warehouseId || ''} onValueChange={(v) => {
              if (allocation) updateInitialAllocation(product.id, allocation.id, { warehouseId: v });
            }} disabled={isSaving}>
              <SelectTrigger className="h-8 text-xs w-full min-w-[120px] bg-muted/30"><SelectValue placeholder="Almacén..." /></SelectTrigger>
              <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>;
          })() : (() => {
            const allocations = product.initialAllocations || [];
            return (
              <div className="space-y-1.5 min-w-[120px]">
                {allocations.map((alloc) => (
                  <div key={alloc.id} className="h-8 flex items-center">
                    <Select
                      value={alloc.warehouseId || ''}
                      onValueChange={(v) => updateInitialAllocation(product.id, alloc.id, { warehouseId: v })}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="h-8 text-xs w-full min-w-[120px] bg-muted/30">
                        <SelectValue placeholder="Bodega..." />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((w: any) => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <div className="pt-1">
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
                </div>
              </div>
            );
          })()}
        </TableCell>
        {!isServiceView && <TableCell className="align-top pt-3 text-right">
          {(() => {
            const allocations = product.initialAllocations || [];
            const totalAllocated = allocations.reduce((acc, item) => acc + Number(item.quantity || 0), 0);
            return (
              <div className="space-y-1.5 min-w-[90px]">
                {allocations.map((alloc) => (
                  <div key={alloc.id} className="h-8 flex items-center justify-end gap-1 bg-muted/30 rounded-lg px-1">
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
                <div className="pt-1 flex justify-end">
                  <Badge className={`text-[10px] tabular-nums h-6 flex items-center ${totalAllocated > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted/20 text-muted-foreground'}`}>
                    Total: {totalAllocated}
                  </Badge>
                </div>
              </div>
            );
          })()}
        </TableCell>}
        <TableCell className="align-top pt-3">
          <Input
            type="number"
            min={0}
            step="any"
            value={product.salePrice}
            onChange={(e) => handleUpdateField(product.id, 'salePrice', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, product.id)}
            className="h-8 text-xs text-right min-w-[90px]"
            disabled={isSaving}
          />
        </TableCell>
        {!isServiceView && <TableCell className="align-top pt-3">
          <Input
            type="number"
            min={0}
            step="any"
            value={product.costPrice}
            onChange={(e) => handleUpdateField(product.id, 'costPrice', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, product.id)}
            className="h-8 text-xs text-right min-w-[90px]"
            disabled={isSaving}
          />
        </TableCell>}
        {!isServiceView && <TableCell className="text-right align-top pt-4">
          <Badge className={(Number(product.salePrice || 0) - Number(product.costPrice || 0)) >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}>
            {formatAmount(Number(product.salePrice || 0) - Number(product.costPrice || 0), baseCurrency)}
          </Badge>
        </TableCell>}
        <TableCell className="text-right align-top pt-3">
          <div className="flex items-center justify-end gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="size-7 text-green-600 hover:text-green-700 hover:bg-green-500/10"
              onClick={() => handleSaveRow(product.id)}
              disabled={isSaving || !!skuErrors.get(product.id)}
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

  // ==================== SELECTION ====================
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedProducts.length && paginatedProducts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedProducts.map((p: any) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      await inventoryService.deleteProducts(Array.from(selectedIds));
      toast.success(`${selectedIds.size} producto(s) eliminado(s)`);
      setSelectedIds(new Set());
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar');
    }
  };

  const handlePreviewReplenishment = async () => {
    setDownloadingReport(true);
    try {
      const report = await inventoryService.getReplenishmentReport(replenishmentPeriod);
      const rows = (report.items || []).map((item: any) => ({
        ...item,
        averageDailyDemand: Number(item.averageDailyDemand || 0).toFixed(2),
      }));
      if (rows.length === 0) {
        toast.success('No hay productos que requieran reabastecimiento en este periodo');
        return;
      }
      setReplenishmentData(rows);
      setReplenishmentModalOpen(true);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo generar la solicitud de inventario');
    } finally {
      setDownloadingReport(false);
    }
  };

  const handleExportReplenishmentExcel = () => {
    if (!replenishmentData || replenishmentData.length === 0) return;
    const rows = replenishmentData.map((item: any) => ({
      Código: item.productCode,
      Producto: item.productName,
      Almacén: item.warehouseName,
      Estado: item.status,
      'Stock actual': item.currentStock,
      'Stock mínimo': item.minStock,
      'Stock máximo': item.maxStock || '',
      'Salida del periodo': item.periodDemand,
      'Demanda diaria prom.': item.averageDailyDemand,
      'Demanda proyectada': item.projectedDemand,
      'Cantidad sugerida': item.suggestedQuantity,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Solicitud de inventario');
    XLSX.writeFile(wb, `solicitud-inventario-${replenishmentPeriod}.xlsx`);
    toast.success(`Excel exportado con ${rows.length} producto(s)`);
  };

  // ==================== EXCEL IMPORT ====================
  const handleDownloadTemplate = useCallback(() => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Código', 'Nombre', 'Categoría', 'Tipo', 'Unidad', 'Precio Venta', 'Precio Costo', 'Stock Inicial', 'Stock Mínimo', 'IMEI'],
      [catalogItemType === 'SERVICE' ? 'SRV-001' : 'SKU-001', catalogItemType === 'SERVICE' ? 'Ejemplo Servicio' : 'Ejemplo Producto', catalogItemType === 'SERVICE' ? 'Consultoría' : 'Electrónica', catalogItemType === 'SERVICE' ? 'SERVICIO' : 'PRODUCTO', 'unidad', 150, 100, 0, 0, 'NO'],
    ]);
    ws['!cols'] = [{ wch: 14 }, { wch: 25 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'plantilla_importar_productos.xlsx');
    toast.success('Plantilla descargada');
  }, [catalogItemType]);

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
          unit: ['unidad', 'unit', 'medida', 'u.medida', 'umedida'],
          salePrice: ['precio venta', 'precio_venta', 'sale price', 'saleprice', 'venta', 'precio'],
          costPrice: ['precio costo', 'precio_costo', 'cost price', 'costprice', 'costo'],
          initialStock: ['stock inicial', 'stock', 'initial stock', 'cantidad', 'qty'],
          minStock: ['stock mínimo', 'stock minimo', 'min stock', 'minstock', 'stock min', 'stock_min'],
          imei: ['imei', 'serial', 'tracking'],
        };
        for (const [key, alts] of Object.entries(aliases)) {
          const idx = headers.findIndex((h: string) => alts.includes(h));
          if (idx >= 0) colMap[key] = idx;
        }
        const parsed = raw.slice(1).filter((row: any[]) => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')).map((row: any[]) => {
          const get = (key: string) => colMap[key] !== undefined ? row[colMap[key]] : undefined;
          const isService = catalogItemType === 'SERVICE';
          return {
            code: String(get('code') || '').trim(),
            name: String(get('name') || '').trim(),
            category: String(get('category') || '').trim(),
            itemType: catalogItemType,
            unit: String(get('unit') || 'unidad').trim().toLowerCase() || 'unidad',
            salePrice: Number(get('salePrice') || 0),
            costPrice: Number(get('costPrice') || 0),
            initialStock: isService ? 0 : Number(get('initialStock') || 0),
            minStock: isService ? 0 : Number(get('minStock') || 0),
            trackSerialNumbers: String(get('imei') || '').toUpperCase() === 'SI' || String(get('imei') || '').toUpperCase() === 'YES',
            _hasError: !String(get('code') || '').trim() || !String(get('name') || '').trim(),
          };
        });
        setImportData(parsed);
        setImportFileName(file.name);
        setImportProgress(0);
        toast.success(`${parsed.length} registros encontrados`);
      } catch (err) {
        console.error('Parse error', err);
        toast.error('No se pudo leer el archivo. Asegúrate de que sea un .xlsx o .csv válido.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, [catalogItemType]);

  const handleImportRowUpdate = (index: number, field: string, value: any) => {
    setImportData((prev) => {
      const next = [...prev];
      const row = { ...next[index], [field]: value };
      if (field === 'code') row._hasError = !String(value).trim() || !row.name;
      if (field === 'name') row._hasError = !String(value).trim() || !row.code;
      next[index] = row;
      return next;
    });
  };

  const handleImportConfirm = useCallback(async () => {
    const valid = importData.filter((row) => !row._hasError);
    if (valid.length === 0) {
      toast.error('No hay registros válidos para importar');
      return;
    }
    setImporting(true);
    setImportProgress(0);
    try {
      const defaultCategoryId = categories[0]?.id;
      if (!defaultCategoryId) {
        toast.error('No hay categorías disponibles. Creá al menos una categoría antes de importar.');
        setImporting(false);
        return;
      }
      const items = valid.map((row) => {
        const cat = categories.find((c: any) => c.name?.toLowerCase() === row.category?.toLowerCase());
        return {
          code: row.code,
          name: row.name,
          categoryId: cat?.id || defaultCategoryId,
          itemType: catalogItemType,
          unit: row.unit || 'unidad',
          salePrice: row.salePrice,
          costPrice: row.costPrice,
          initialStock: row.initialStock,
          minStock: row.minStock || 0,
          trackSerialNumbers: row.trackSerialNumbers,
        };
      });
      const results = await inventoryService.bulkCreateProducts(items, (done, total) => {
        flushSync(() => setImportProgress(Math.round((done / total) * 100)));
      });
      setImportResults(results);
      setImportModalOpen(false);
      setImportData([]);
      setImportFileName('');
      onRefresh();
    } catch (e: any) {
      toast.error('Error durante la importación: ' + (e.message || 'Error'));
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
      }, [importData, categories, onRefresh, catalogItemType]);

  return (
    <>
      <Card className="p-4 border bg-card rounded-xl">
      <div className="mb-5">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight">{isServiceView ? 'Servicios' : 'Productos y existencias'}</h2>
            <p className="text-sm text-muted-foreground">{isServiceView ? 'Administra los servicios y el almacén al que están vinculados.' : 'Administra productos, existencias y distribución por almacén.'}</p>
          </div>
          <p className="text-xs font-medium text-muted-foreground">{warehouses.length} almacenes registrados</p>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            { id: 'all', label: isServiceView ? 'Servicios' : 'Productos', value: inventorySummary.total, tone: 'text-foreground' },
            ...(!isServiceView ? [
              { id: 'available', label: 'Disponibles', value: inventorySummary.available, tone: 'text-emerald-600' },
              { id: 'low', label: 'Stock bajo', value: inventorySummary.low, tone: 'text-amber-600' },
              { id: 'out', label: 'Sin stock', value: inventorySummary.out, tone: 'text-rose-600' },
            ] : []),
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
          {!itemType && <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
            <SelectTrigger className="h-9 w-full sm:w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos los tipos</SelectItem><SelectItem value="PRODUCT">🏷 Productos</SelectItem><SelectItem value="SERVICE">⚙ Servicios</SelectItem></SelectContent>
          </Select>}
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
          {!isServiceView && <Select value={replenishmentPeriod} onValueChange={(value) => setReplenishmentPeriod(value as 'weekly' | 'biweekly' | 'monthly')}>
            <SelectTrigger className="h-10 w-[130px] text-xs font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="biweekly">Quincenal</SelectItem>
              <SelectItem value="monthly">Mensual</SelectItem>
            </SelectContent>
          </Select>}
          {!isServiceView && <Button
            size="sm"
            variant="outline"
            className="rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-4"
            onClick={handlePreviewReplenishment}
            disabled={downloadingReport}
          >
            {downloadingReport ? (
              <div className="size-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="size-4 mr-2" />
            )}
            Solicitud
          </Button>}
          {isServiceView && canPerform('INVENTORY_PRODUCTS', 'create') && (
            <Button
              size="sm"
              className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all gap-2 font-black text-xs uppercase tracking-widest h-10 px-6"
              onClick={() => setCreateModalOpen(true)}
            >
              <Plus className="size-4" />
              Agregar servicio
            </Button>
          )}
          {selectedIds.size > 0 && (
            <Button
              size="sm"
              variant="destructive"
              className="rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-4"
              onClick={() => setBatchDeleteOpen(true)}
            >
              <Trash2 className="size-4 mr-2" />
              Eliminar {selectedIds.size}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile cards: the desktop table stays available at md+ without forcing page overflow. */}
      <div className="space-y-3 md:hidden">
        {paginatedProducts.length === 0 ? (
          <Card className="rounded-2xl border-border/40 p-6 text-center">
            <Package className="mx-auto mb-2 size-9 opacity-20" />
            <p className="font-medium">{products.length > 0 ? 'No hay coincidencias' : `No hay ${isServiceView ? 'servicios' : 'productos'} registrados`}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {products.length > 0 ? 'Cambia los filtros o busca otro nombre o código.' : isServiceView ? 'Agrega un servicio para comenzar.' : 'Los productos se administran desde compras, POS u otros módulos.'}
            </p>
          </Card>
        ) : paginatedProducts.map((product) => {
          const status = getStockStatus(product);
          const warehousesForProduct = isServiceView
            ? (product.warehouseCatalogs || []).map((catalog: any) => catalog.warehouse?.name).filter(Boolean)
            : (product.stockLevels || []).filter((level: any) => Number(level.quantity) > 0).map((level: any) => level.warehouse?.name).filter(Boolean);
          return (
            <Card key={product.id} className="min-w-0 overflow-hidden rounded-2xl border-border/40 p-4 shadow-sm" onClick={() => setProductDetail(product)}>
              <div className="flex min-w-0 items-start gap-3">
                <ProductThumbnail src={product.imageUrl} alt={product.name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold" title={product.name}>{product.name}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{product.code}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[9px] font-black uppercase">{isServiceView ? 'Servicio' : 'Producto'}</Badge>
                  </div>
                  <p className="mt-2 truncate text-xs text-muted-foreground">{product.category?.name || 'Sin categoría'}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">{isServiceView ? 'Precio' : 'Precio venta'}</span>
                      <p className="font-bold tabular-nums">{formatAmount(product.salePrice || 0, baseCurrency)}</p>
                    </div>
                    {!isServiceView && <div>
                      <span className="text-muted-foreground">Existencias</span>
                      <p className={`font-bold tabular-nums ${getStockAlertColor(product)}`}>{product.stock || 0}</p>
                    </div>}
                  </div>
                  <div className="mt-3 flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Almacenes</span>
                    <div className="flex min-w-0 flex-wrap gap-1">
                      {warehousesForProduct.length > 0
                        ? Array.from(new Set(warehousesForProduct)).map((name: any) => <Badge key={name} variant="secondary" className="max-w-full truncate text-[9px]">{name}</Badge>)
                        : <span className="text-[10px] text-muted-foreground">-</span>}
                    </div>
                  </div>
                  {!isServiceView && status.label !== 'OK' && <Badge className={`mt-3 ${status.color} text-[10px]`}>{status.label}</Badge>}
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-1 border-t border-border/40 pt-3">
                {canPerform('INVENTORY_PRODUCTS', 'edit') && <Button variant="ghost" size="icon" className="size-8" title="Duplicar" onClick={(e) => { e.stopPropagation(); handleDuplicateProduct(product); }} disabled={duplicatingIds.has(product.id)}>
                  {duplicatingIds.has(product.id) ? <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Copy className="size-3.5" />}
                </Button>}
                {canPerform('INVENTORY_PRODUCTS', 'edit') && <Button variant="ghost" size="icon" className="size-8" title="Editar" onClick={(e) => { e.stopPropagation(); handleEditRow(product); }}><Pencil className="size-3.5" /></Button>}
                {canPerform('INVENTORY_PRODUCTS', 'delete') && <Button variant="ghost" size="icon" className="size-8 text-red-600 hover:bg-red-500 hover:text-white" title="Eliminar" onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }}><Trash2 className="size-3.5" /></Button>}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden max-w-full overflow-x-auto rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border/50">
              <TableHead className="w-10">
                <button type="button" onClick={(e) => { e.stopPropagation(); toggleSelectAll(); }} className="flex items-center justify-center size-7 rounded-md hover:bg-muted/60">
                  {selectedIds.size === paginatedProducts.length && paginatedProducts.length > 0
                    ? <SquareCheckBig className="size-4 text-primary" />
                    : <Square className="size-4 text-muted-foreground" />
                  }
                </button>
              </TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-28">Código</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">{isServiceView ? 'Servicio' : 'Producto'}</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-36">Categoría</TableHead>
              {!isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest w-20">U.Medida</TableHead>}
              {!isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-16">Min</TableHead>}
              {!isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-16">Max</TableHead>}
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Almacenes</TableHead>
              {!isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-20">Stock</TableHead>}
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-28">{isServiceView ? 'Precio' : 'Precio Venta'}</TableHead>
              {!isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-28">Precio Costo</TableHead>}
              {!isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-32">Beneficio</TableHead>}
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
                <TableCell colSpan={isServiceView ? 7 : 13} className="text-center py-12 text-muted-foreground">
                  <Package className="size-10 mx-auto mb-2 opacity-20" />
                  <p className="font-medium">{products.length > 0 ? 'No hay coincidencias' : `No hay ${isServiceView ? 'servicios' : 'productos'} registrados`}</p>
                  <p className="text-sm">
                    {products.length > 0 ? 'Cambia los filtros o busca otro nombre o codigo.' : isServiceView ? 'Agrega un servicio para comenzar.' : 'Los productos se administran desde compras, POS u otros módulos.'}
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
                
                const status = getStockStatus(product);
                 return (
                   <TableRow 
                      key={product.id} 
                      className="group hover:bg-muted/30 cursor-pointer"
                      onClick={() => setProductDetail(product)}
                      onDoubleClick={() => canPerform('INVENTORY_PRODUCTS', 'edit') && handleEditRow(product)}
                     >
                     <TableCell className="w-10">
                       <button type="button" onClick={(e) => { e.stopPropagation(); toggleSelect(product.id); }} className="flex items-center justify-center size-7 rounded-md hover:bg-muted/60">
                         {selectedIds.has(product.id)
                           ? <SquareCheckBig className="size-4 text-primary" />
                           : <Square className="size-4 text-muted-foreground" />
                         }
                       </button>
                     </TableCell>
                     <TableCell className="font-mono text-xs text-muted-foreground">{product.code}</TableCell>
                    <TableCell>
                      <div className="flex min-w-[190px] items-center gap-3">
                        {canPerform('INVENTORY_PRODUCTS', 'edit') ? (
                          <button
                            type="button"
                            className="rounded-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditRow(product);
                            }}
                            aria-label={`${product.imageUrl ? 'Cambiar' : 'Agregar'} foto de ${product.name}`}
                            title={product.imageUrl ? 'Cambiar foto' : 'Agregar foto'}
                          >
                            <ProductThumbnail src={product.imageUrl} alt={product.name} size="md" />
                          </button>
                        ) : (
                          <ProductThumbnail src={product.imageUrl} alt={product.name} size="md" />
                        )}
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="truncate font-medium text-sm hover:text-primary underline-offset-2 hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProductDetail(product);
                            }}
                          >
                            {product.name}
                          </button>
                          {!isServiceView && Boolean(
                            product.trackSerialNumbers ||
                            product.serialTracking ||
                            product.serialNumberTracking ||
                            String(product.trackingType || '').toUpperCase() === 'SERIAL',
                          ) && (
                            <Badge variant="outline" className="text-[9px] font-black">IMEI</Badge>
                          )}
                          {!isServiceView && status.label !== 'OK' && (
                            <Badge className={`${status.color} text-[10px] px-1.5 py-0`}>{status.label}</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{product.category?.name || '-'}</span>
                    </TableCell>
                    {!isServiceView && <TableCell>
                      <span className="text-xs text-muted-foreground capitalize">{product.unit || 'unidad'}</span>
                    </TableCell>}
                    {!isServiceView && <TableCell>
                      <span className="text-xs text-muted-foreground text-right block">{Number(product.minStock || 0)}</span>
                    </TableCell>}
                    {!isServiceView && <TableCell>
                      <span className="text-xs text-muted-foreground text-right block">
                        {getProductMaxStock(product) > 0 ? getProductMaxStock(product) : '-'}
                      </span>
                    </TableCell>}
                    <TableCell>
                      {String(product.itemType || product.type || 'PRODUCT').toUpperCase() === 'SERVICE' ? (
                        <div className="flex flex-wrap gap-1">
                          {product.warehouseCatalogs?.length ? product.warehouseCatalogs.map((catalog: any, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-[9px] bg-muted/50 font-medium">{catalog.warehouse?.name || '-'}</Badge>
                          )) : <span className="text-[10px] text-muted-foreground">-</span>}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {product.stockLevels && product.stockLevels.length > 0 ? (
                            Array.from(new Set(
                              product.stockLevels
                                .filter((sl: any) => Number(sl.quantity) > 0)
                                .map((sl: any) => sl.warehouse?.name)
                                .filter(Boolean)
                            )).map((whName: any, idx) => (
                              <Badge key={idx} variant="secondary" className="text-[9px] bg-muted/50 font-medium">
                                {whName}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-[10px] text-muted-foreground">-</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    {!isServiceView && <TableCell className={`text-right font-medium tabular-nums ${getStockAlertColor(product)}`}>
                      {product.stock || 0}
                    </TableCell>}
                    <TableCell className="text-right font-medium tabular-nums">{formatAmount(product.salePrice || 0, baseCurrency)}</TableCell>
                     {!isServiceView && <TableCell className="text-right text-muted-foreground tabular-nums">{formatAmount(product.costPrice || 0, baseCurrency)}</TableCell>}
                     {!isServiceView && <TableCell className="text-right font-black tabular-nums">
                       <span className={(Number(product.salePrice || 0) - Number(product.costPrice || 0)) >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                         {formatAmount(Number(product.salePrice || 0) - Number(product.costPrice || 0), baseCurrency)}
                       </span>
                     </TableCell>}
                     <TableCell className="text-right">
                       <div className="flex items-center justify-end gap-1 transition-opacity">
                        {canPerform('INVENTORY_PRODUCTS', 'edit') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title="Duplicar producto"
                              aria-label={`Duplicar ${product.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateProduct(product);
                              }}
                              disabled={duplicatingIds.has(product.id)}
                            >
                              {duplicatingIds.has(product.id)
                                ? <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                : <Copy className="size-3.5" />}
                            </Button>
                         )}
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
            : <>Mostrando <span className="font-semibold text-foreground">{((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, filteredProducts.length)}</span> de <span className="font-semibold text-foreground">{filteredProducts.length}</span> {isServiceView ? 'servicios' : 'productos'}</>}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50 / página</SelectItem>
              <SelectItem value="100">100 / página</SelectItem>
              <SelectItem value="200">200 / página</SelectItem>
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
      <AddProductsModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        categories={categories}
        warehouses={warehouses}
        onRefresh={onRefresh}
        itemType={catalogItemType}
      />
      <Dialog open={importModalOpen} onOpenChange={(open) => {
        if (!importing) {
          setImportModalOpen(open);
          if (!open) { setImportData([]); setImportFileName(''); setImportProgress(0); }
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Importar {isServiceView ? 'Servicios' : 'Productos'}</DialogTitle>
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
                  <div className="min-w-[900px]">
                    <Table>
                      <TableHeader className="bg-muted sticky top-0 z-10 shadow-sm">
                        <TableRow>
                          <TableHead className="text-[10px] uppercase w-8"></TableHead>
                          <TableHead className="text-[10px] uppercase w-32">Código</TableHead>
                          <TableHead className="text-[10px] uppercase">Nombre</TableHead>
                            <TableHead className="text-[10px] uppercase w-24">Tipo</TableHead>
                          <TableHead className="text-[10px] uppercase w-32">Categoría</TableHead>
                          <TableHead className="text-[10px] uppercase w-28 text-right">Unidad</TableHead>
                          <TableHead className="text-[10px] uppercase w-28 text-right">Venta</TableHead>
                          <TableHead className="text-[10px] uppercase w-24 text-right">Stock</TableHead>
                          <TableHead className="text-[10px] uppercase w-24 text-right">Min</TableHead>
                          <TableHead className="text-[10px] uppercase w-20 text-center">IMEI</TableHead>
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
                            <TableCell className="p-1">
                              <Input
                                value={row.code}
                                onChange={(e) => handleImportRowUpdate(i, 'code', e.target.value)}
                                className={`h-8 text-xs font-mono ${!row.code ? 'border-red-500' : ''}`}
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                value={row.name}
                                onChange={(e) => handleImportRowUpdate(i, 'name', e.target.value)}
                                className={`h-8 text-xs ${!row.name ? 'border-red-500' : ''}`}
                              />
                            </TableCell>
                            <TableCell className="p-1"><Badge className={isServiceView ? 'bg-violet-500/10 text-violet-500' : 'bg-sky-500/10 text-sky-500'}>{isServiceView ? 'Servicio' : 'Producto'}</Badge></TableCell>
                            <TableCell className="p-1">
                              <Input
                                value={row.category}
                                onChange={(e) => handleImportRowUpdate(i, 'category', e.target.value)}
                                className="h-8 text-xs"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                value={row.unit || 'unidad'}
                                onChange={(e) => handleImportRowUpdate(i, 'unit', e.target.value)}
                                className="h-8 text-xs"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                type="number"
                                min={0}
                                value={row.salePrice}
                                onChange={(e) => handleImportRowUpdate(i, 'salePrice', Number(e.target.value) || 0)}
                                className="h-8 text-xs text-right"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              {row.itemType === 'SERVICE' ? (
                                <span className="text-xs text-muted-foreground/50 italic h-8 flex items-center justify-end">N/A</span>
                              ) : (
                                <Input
                                  type="number"
                                  min={0}
                                  value={row.initialStock}
                                  onChange={(e) => handleImportRowUpdate(i, 'initialStock', Number(e.target.value) || 0)}
                                  className="h-8 text-xs text-right"
                                />
                              )}
                            </TableCell>
                            <TableCell className="p-1">
                              {row.itemType === 'SERVICE' ? (
                                <span className="text-xs text-muted-foreground/50 italic h-8 flex items-center justify-end">N/A</span>
                              ) : (
                                <Input
                                  type="number"
                                  min={0}
                                  value={row.minStock}
                                  onChange={(e) => handleImportRowUpdate(i, 'minStock', Number(e.target.value) || 0)}
                                  className="h-8 text-xs text-right"
                                />
                              )}
                            </TableCell>
                            <TableCell className="p-1 text-center">
                              <input
                                type="checkbox"
                                checked={row.trackSerialNumbers}
                                onChange={(e) => handleImportRowUpdate(i, 'trackSerialNumbers', e.target.checked)}
                                className="size-4 accent-primary"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {importData.length > 100 && (
                    <p className="text-xs text-center p-2 text-muted-foreground border-t bg-muted/20">
                      Mostrando 100 de {importData.length} filas
                    </p>
                  )}
                </div>
                {importing && (
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                )}
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
                {importing ? `Importando... ${importProgress}%` : `Importar ${importData.filter(r => !r._hasError).length} Registros`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
        </Dialog>


      <Dialog open={importResults !== null} onOpenChange={(open) => { if (!open) setImportResults(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Resultado de importación</DialogTitle>
            <DialogDescription>
              {importResults?.success} importados, {importResults?.skipped} saltados, {importResults?.failed} errores
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {importResults?.success ? <p className="text-xs text-emerald-600 font-medium">✓ {importResults.success} producto(s) importado(s) correctamente</p> : null}
            {importResults?.skipped ? <p className="text-xs text-amber-600 font-medium">⏭ {importResults.skipped} producto(s) saltado(s) por código duplicado</p> : null}
            {importResults?.errors?.map((err, i) => (
              <p key={i} className="text-xs text-red-600">✗ {err}</p>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setImportResults(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={batchDeleteOpen}
        onOpenChange={(open) => { if (!open) setBatchDeleteOpen(false); }}
        title={`Eliminar ${selectedIds.size} producto(s)`}
        description="Esta acción no se puede deshacer. Los productos se desactivarán pero no se eliminarán físicamente del sistema."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={batchDeleting}
        onConfirm={async () => {
          setBatchDeleting(true);
          await handleBatchDelete();
          setBatchDeleting(false);
          setBatchDeleteOpen(false);
        }}
      />

      </Card>

      <Dialog open={replenishmentModalOpen} onOpenChange={(open) => { if (!open) setReplenishmentModalOpen(false); }}>
        <DialogContent className="sm:max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Solicitud de Reabastecimiento</DialogTitle>
            <DialogDescription>
              Periodo: {replenishmentPeriod === 'weekly' ? 'Semanal' : replenishmentPeriod === 'biweekly' ? 'Quincenal' : 'Mensual'} — {replenishmentData?.length || 0} producto(s) sugeridos
            </DialogDescription>
          </DialogHeader>
          {replenishmentData && replenishmentData.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-black text-[10px] uppercase">Producto</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Almacén</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right">Stock</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right">Min</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right">Max</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right">Salida periodo</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right">Demanda diaria</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right">Demanda proy.</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right">Sugerido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {replenishmentData.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-xs">{item.productName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.warehouseName || '-'}</TableCell>
                      <TableCell className={`text-right text-xs tabular-nums ${Number(item.currentStock) <= Number(item.minStock) ? 'text-orange-500 font-bold' : ''}`}>{item.currentStock}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{item.minStock}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{item.maxStock || '-'}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{item.periodDemand}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{item.averageDailyDemand}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{item.projectedDemand}</TableCell>
                      <TableCell className="text-right text-xs font-black tabular-nums text-primary">{item.suggestedQuantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReplenishmentModalOpen(false)} className="rounded-xl font-bold text-xs uppercase tracking-widest">Cerrar</Button>
            <Button onClick={handleExportReplenishmentExcel} className="rounded-xl font-bold text-xs uppercase tracking-widest" disabled={!replenishmentData || replenishmentData.length === 0}>
              <Download className="size-4 mr-2" /> Exportar Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
    );
}
