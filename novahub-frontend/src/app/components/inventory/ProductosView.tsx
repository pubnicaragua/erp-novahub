import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Search, Plus, Trash2, X, Check, Package, Upload, FileSpreadsheet, AlertTriangle, Download, Pencil, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Square, SquareCheckBig } from 'lucide-react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
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
import { EditProductModal } from './EditProductModal';


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
  priceCurrency?: string;
  priceExchangeRate?: number;
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
  const { formatAmount, baseCurrency, exchangeRate } = useCurrency();
  const { canPerform } = useAuth();
  const catalogItemType = itemType || 'PRODUCT';
  const isServiceView = catalogItemType === 'SERVICE';
  const entityLabel = isServiceView ? 'servicio' : 'producto';
  const entityLabelCap = isServiceView ? 'Servicio' : 'Producto';
  const [importAddedCategories, setImportAddedCategories] = useState<any[]>([]);
  const [importAddedWarehouses, setImportAddedWarehouses] = useState<any[]>([]);
  const importCategoryOptions = useMemo(() => {
    const unique = new Map<string, any>();
    [...categories, ...importAddedCategories].forEach((category: any) => unique.set(category.id || category.name, category));
    return Array.from(unique.values());
  }, [categories, importAddedCategories]);
  const importWarehouseOptions = useMemo(() => {
    const unique = new Map<string, any>();
    [...warehouses, ...importAddedWarehouses].forEach((warehouse: any) => unique.set(warehouse.id || warehouse.name, warehouse));
    return Array.from(unique.values());
  }, [warehouses, importAddedWarehouses]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [warehouseFilters, setWarehouseFilters] = useState<string[]>([]);
  const [stockFilter, setStockFilter] = useState<'all' | 'available' | 'low' | 'out'>('all');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [initialImportIntroOpen, setInitialImportIntroOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [imageZipFileName, setImageZipFileName] = useState('');
  const [imageZipEntries, setImageZipEntries] = useState<Map<string, File>>(new Map());
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageZipInputRef = useRef<HTMLInputElement>(null);
  const [editingRows, setEditingRows] = useState<Map<string, EditingProduct>>(new Map());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [productDetail, setProductDetail] = useState<any | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [pendingCategoryRowIndex, setPendingCategoryRowIndex] = useState<number | null>(null);
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState('');
  const [creatingWarehouse, setCreatingWarehouse] = useState(false);
  const [pendingWarehouseRowIndex, setPendingWarehouseRowIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; skipped: number; failed: number; errors: string[] } | null>(null);
  const [initialImportCompleted, setInitialImportCompleted] = useState(false);
  const [importCurrency, setImportCurrency] = useState(baseCurrency === 'USD' ? 'USD' : 'NIO');
  const [importExchangeRate, setImportExchangeRate] = useState<number>(Number(exchangeRate || 1));
  const [initialImportConfirmOpen, setInitialImportConfirmOpen] = useState(false);
  const [initialImportConfirmText, setInitialImportConfirmText] = useState('');
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [replenishmentPeriod, setReplenishmentPeriod] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [replenishmentData, setReplenishmentData] = useState<any[] | null>(null);
  const [replenishmentModalOpen, setReplenishmentModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modalProduct, setModalProduct] = useState<any | null>(null);
  
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

  useEffect(() => {
    if (isServiceView) return;
    inventoryService.getInitialImportStatus().then((status) => {
      setInitialImportCompleted(Boolean(status.completed) || products.length > 0);
    }).catch(() => undefined);
  }, [isServiceView, products.length]);


  // Reset page & selection when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [searchTerm, categoryFilters, warehouseFilters, stockFilter, catalogItemType]);

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
    const productWarehouseIds = [
      ...(Array.isArray(p.warehouseCatalogs) ? p.warehouseCatalogs.map((catalog: any) => catalog.warehouseId || catalog.warehouse?.id) : []),
      ...(Array.isArray(p.stockLevels) ? p.stockLevels.map((level: any) => level.warehouseId || level.warehouse?.id) : []),
      ...(Array.isArray(p.allocations) ? p.allocations.map((allocation: any) => allocation.warehouseId || allocation.warehouse?.id) : []),
    ].filter(Boolean);
    const matchesWarehouse = warehouseFilters.length === 0
      || warehouseFilters.some((warehouseId) => productWarehouseIds.includes(warehouseId));
    const pType = String(p.itemType || p.type || 'PRODUCT').toUpperCase();
    const matchesType = pType === catalogItemType;
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

  const serviceSummary = useMemo(() => {
    const services = products.filter((product: any) => String(product.itemType || product.type || '').toUpperCase() === 'SERVICE');
    const categories = new Set(services.map((service: any) => service.categoryId || service.category?.id).filter(Boolean));
    const now = Date.now();
    const twelveWeeksAgo = now - (12 * 7 * 24 * 60 * 60 * 1000);
    const prices = services.map((service: any) => Number(service.salePrice ?? service.price ?? 0)).filter((price) => Number.isFinite(price));
    const createdInLastTwelveWeeks = services.filter((service: any) => {
      const createdAt = new Date(service.createdAt || service.createdDate || service.created_on || '').getTime();
      return Number.isFinite(createdAt) && createdAt >= twelveWeeksAgo && createdAt <= now;
    }).length;
    return {
      categories: categories.size,
      weeklyAverage: createdInLastTwelveWeeks / 12,
      averagePrice: prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0,
    };
  }, [products]);

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
      priceCurrency: baseCurrency,
      priceExchangeRate: baseCurrency === 'NIO' ? 1 : 1,
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
      priceCurrency: product.priceCurrency || baseCurrency,
      priceExchangeRate: Number(product.priceExchangeRate || 1),
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
          salePrice: Number(product.salePrice || 0) * (product.priceCurrency === baseCurrency ? 1 : product.priceCurrency === 'USD' ? 1 / exchangeRate : exchangeRate),
          salePriceOriginal: Number(product.salePrice || 0),
          priceCurrency: product.priceCurrency || baseCurrency,
          priceExchangeRate: Number(product.priceExchangeRate || 1),
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
            toast.error(err?.response?.data?.message || err?.message || `${entityLabelCap} creado, pero hubo un error al asignar el stock`);
          }
        }
        toast.success(`${entityLabelCap} creado`);
      } else {
        await inventoryService.updateProduct(id, {
          code: product.code,
          name: product.name,
          categoryId: product.categoryId,
          salePrice: Number(product.salePrice || 0) * (product.priceCurrency === baseCurrency ? 1 : product.priceCurrency === 'USD' ? 1 / exchangeRate : exchangeRate),
          salePriceOriginal: Number(product.salePrice || 0),
          priceCurrency: product.priceCurrency || baseCurrency,
          priceExchangeRate: Number(product.priceExchangeRate || 1),
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

        toast.success(`${entityLabelCap} actualizado`);
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

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;
    setDeleteLoading(true);
    try {
      await inventoryService.deleteProduct(pendingDeleteId);
      toast.success(`${entityLabelCap} eliminado`);
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
      const response = await inventoryService.createCategory({
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || undefined,
        type: catalogItemType,
      });
      const created = ((response as any)?.data || response || {}) as any;
      const createdCategory = {
        ...created,
        id: created.id || `import-category-${Date.now()}`,
        name: created.name || newCategoryName.trim(),
        type: created.type || catalogItemType,
      };
      setImportAddedCategories((current) => [...current.filter((item) => item.id !== createdCategory.id), createdCategory]);
      if (pendingCategoryRowIndex !== null) {
        setImportData((current) => {
          const next = [...current];
          next[pendingCategoryRowIndex] = { ...next[pendingCategoryRowIndex], category: createdCategory.name, categoryId: createdCategory.id };
          return validateImportRows(next, imageZipEntries, imageZipFileName, [...importCategoryOptions, createdCategory], importWarehouseOptions);
        });
      }
      toast.success('Categoría creada');
      setCategoryModalOpen(false);
      setNewCategoryName('');
      setNewCategoryDescription('');
      setPendingCategoryRowIndex(null);
      onRefresh();
    } catch (error: any) {
      toast.error(error?.message || 'Error al crear categoría');
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleCreateWarehouse = async () => {
    if (!newWarehouseName.trim()) return toast.error('El nombre del almacén es requerido');
    setCreatingWarehouse(true);
    try {
      const response = await inventoryService.createWarehouse({ name: newWarehouseName.trim() });
      const created = ((response as any)?.data || response || {}) as any;
      const createdWarehouse = { ...created, id: created.id || `import-warehouse-${Date.now()}`, name: created.name || newWarehouseName.trim() };
      setImportAddedWarehouses((current) => [...current.filter((item) => item.id !== createdWarehouse.id), createdWarehouse]);
      if (pendingWarehouseRowIndex !== null) {
        setImportData((current) => {
          const next = [...current];
          next[pendingWarehouseRowIndex] = { ...next[pendingWarehouseRowIndex], warehouse: createdWarehouse.name, warehouseId: createdWarehouse.id };
          return validateImportRows(next, imageZipEntries, imageZipFileName, importCategoryOptions, [...importWarehouseOptions, createdWarehouse]);
        });
      }
      toast.success('Almacén creado');
      setWarehouseModalOpen(false);
      setNewWarehouseName('');
      setPendingWarehouseRowIndex(null);
      onRefresh();
    } catch (error: any) { toast.error(error?.message || 'Error al crear almacén'); }
    finally { setCreatingWarehouse(false); }
  };

  const handlePriceCurrencyChange = (id: string, currency: string) => {
    const current = editingRows.get(id);
    if (!current) return;
    const next = new Map(editingRows);
    next.set(id, { ...current, priceCurrency: currency, priceExchangeRate: currency === baseCurrency ? 1 : Number(exchangeRate || 1) });
    setEditingRows(next);
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
        <TableCell className="w-10 align-top pt-4">
          <button type="button" onClick={(e) => { e.stopPropagation(); toggleSelect(product.id); }} className="flex items-center justify-center size-7 rounded-md hover:bg-muted/60">
            {selectedIds.has(product.id)
              ? <SquareCheckBig className="size-4 text-primary" />
              : <Square className="size-4 text-muted-foreground" />
            }
          </button>
        </TableCell>
        <TableCell className="w-28 align-top pt-3">
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
        <TableCell className="w-48 align-top pt-3">
          <div className="flex min-w-0 w-full items-start gap-2">
            <ProductImagePicker
              size="sm"
              src={product.imagePreviewUrl || product.imageUrl}
              productName={product.name}
              disabled={isSaving}
              onSelect={(file) => handleImageSelected(product.id, file)}
              onRemove={() => handleImageRemoved(product.id)}
            />
            <div className="min-w-0 flex-1 space-y-1.5 mt-0.5">
              <Input
                value={product.name}
                onChange={(e) => handleUpdateField(product.id, 'name', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, product.id)}
                placeholder="Nombre"
                className="h-8 w-full min-w-0 text-xs"
                disabled={isSaving}
              />
              {!isServiceView && <Button
                type="button"
                variant={product.trackSerialNumbers ? 'default' : 'outline'}
                size="sm"
                className={`h-5 text-[8px] uppercase tracking-wider px-1.5 w-full ${product.trackSerialNumbers ? 'bg-primary text-primary-foreground' : ''}`}
                onClick={() => handleUpdateField(product.id, 'trackSerialNumbers', !product.trackSerialNumbers)}
                disabled={isSaving || !isServiceView}
              >
                IMEI {product.trackSerialNumbers ? 'Activo' : 'Inactivo'}
              </Button>}
            </div>
          </div>
        </TableCell>
        <TableCell className="w-36 align-top pt-3">
          <div className="space-y-1.5 min-w-0">
            <Select 
              value={product.categoryId} 
              onValueChange={(v) => handleUpdateField(product.id, 'categoryId', v)}
              disabled={isSaving || !isServiceView}
            >
              <SelectTrigger className="h-8 w-full min-w-0 text-xs">
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
              onClick={() => { setPendingCategoryRowIndex(null); setCategoryModalOpen(true); }}
                disabled={isSaving || !isServiceView}
              >
                <Plus className="size-3 mr-1" />
                Categoría
              </Button>
            </div>
          </div>
        </TableCell>
        {!isServiceView && <TableCell className="w-28 align-top pt-3">
          <Select 
            value={product.unit || 'unidad'} 
            onValueChange={(v) => handleUpdateField(product.id, 'unit', v)}
            disabled={isSaving || !isServiceView}
          >
            <SelectTrigger className="h-8 w-full min-w-0 text-xs">
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
        {!isServiceView && <TableCell className="w-20 align-top pt-3">
          <Input
            type="number"
            min={0}
            value={product.minStock ?? 0}
            onChange={(e) => handleUpdateField(product.id, 'minStock', Math.max(0, Number(e.target.value) || 0))}
            onKeyDown={(e) => handleKeyDown(e, product.id)}
            className="h-8 min-w-0 w-full text-right text-xs"
            disabled={isSaving || !isServiceView}
          />
        </TableCell>}
        {!isServiceView && <TableCell className="w-20 align-top pt-3">
          <Input
            type="number"
            min={0}
            value={product.maxStock ?? 0}
            onChange={(e) => handleUpdateField(product.id, 'maxStock', Math.max(0, Number(e.target.value) || 0))}
            onKeyDown={(e) => handleKeyDown(e, product.id)}
            className="h-8 min-w-0 w-full text-right text-xs"
            disabled={isSaving}
          />
        </TableCell>}
        {isServiceView && <TableCell className="w-28 align-top pt-3">
          {(() => {
            const allocations = product.initialAllocations || [];
            return (
              <div className="space-y-1.5 min-w-0">
                {allocations.map((alloc) => (
                  <div key={alloc.id} className="h-8 flex items-center">
                    <Select
                      value={alloc.warehouseId || ''}
                      onValueChange={(v) => updateInitialAllocation(product.id, alloc.id, { warehouseId: v })}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="h-8 w-full min-w-0 bg-muted/30 text-xs px-2 truncate [&>span]:truncate">
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
                {product.itemType !== 'SERVICE' && (
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
                )}
              </div>
            );
          })()}
        </TableCell>}
        {!isServiceView && <TableCell className="w-28 align-top pt-3">
          <div className="flex min-h-8 min-w-0 flex-wrap items-center gap-1 rounded-lg bg-muted/30 px-2 py-1">
            {(product.initialAllocations || [])
              .map((alloc) => warehouses.find((warehouse: any) => warehouse.id === alloc.warehouseId)?.name)
              .filter(Boolean)
              .map((warehouseName, index) => (
                <Badge key={`${warehouseName}-${index}`} variant="secondary" className="max-w-full truncate text-[9px] bg-muted/50 font-medium">
                  {warehouseName}
                </Badge>
              ))}
            {!(product.initialAllocations || []).some((alloc) => warehouses.some((warehouse: any) => warehouse.id === alloc.warehouseId)) && (
              <span className="text-[10px] text-muted-foreground">-</span>
            )}
          </div>
        </TableCell>}
        {!isServiceView && <TableCell className="w-24 align-top pt-3 text-right">
          {(() => {
            const allocations = product.initialAllocations || [];
            const totalAllocated = allocations.reduce((acc, item) => acc + Number(item.quantity || 0), 0);
            return (
              <div className="space-y-1.5 min-w-0">
                {allocations.map((alloc) => (
                  <div key={alloc.id} className="h-8 flex items-center justify-end bg-muted/30 rounded-lg px-2">
                    <Input
                      type="number"
                      min={0}
                      value={alloc.quantity}
                      disabled
                      aria-label="Stock no editable"
                      title="El stock se administra mediante movimientos y ajustes de inventario"
                      className="h-7 text-xs text-right w-full cursor-not-allowed border-none bg-transparent opacity-60 shadow-none"
                      placeholder="0"
                    />
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
        {isServiceView && <TableCell className="align-top pt-3">
          <div className="space-y-1">
            <div className="flex gap-1">
              <Select value={product.priceCurrency || baseCurrency} onValueChange={(value) => handlePriceCurrencyChange(product.id, value)} disabled={isSaving}>
                <SelectTrigger className="h-8 w-20 min-w-0 px-2 text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="NIO">NIO</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                step="any"
                value={product.salePrice}
                onChange={(e) => handleUpdateField(product.id, 'salePrice', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, product.id)}
                className="h-8 min-w-0 flex-1 text-right text-xs"
                disabled={isSaving}
              />
            </div>
            <span className="block text-[9px] text-muted-foreground">Tasa: {product.priceCurrency === baseCurrency ? '1.00' : Number(exchangeRate || 1).toFixed(4)}</span>
          </div>
        </TableCell>}
        {!isServiceView && <TableCell className="w-28 align-top pt-3">
          <Input
            type="number"
            min={0}
            step="any"
            value={product.costPrice}
            onChange={(e) => handleUpdateField(product.id, 'costPrice', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, product.id)}
            className="h-8 min-w-0 w-full text-right text-xs"
            disabled={isSaving || !isServiceView}
          />
        </TableCell>}
        <TableCell className="w-24 text-right align-top pt-3">
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
      toast.success(`${selectedIds.size} ${entityLabel}(s) eliminado(s)`);
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
    const headers = ['Código / SKU', 'Nombre', 'Tipo', 'Categoría', 'Unidad', 'Precio Minorista', 'Precio Mayorista', 'Precio Distribuidor', 'Costo', 'Stock inicial', 'Stock mínimo', 'Almacén'];
    const ws = XLSX.utils.aoa_to_sheet([
      headers,
      ['SKU-001', 'Ejemplo producto', 'PRODUCTO', categories[0]?.name || 'Categoría', 'unidad', 150, 140, 130, 100, 0, 0, warehouses[0]?.name || ''],
    ]);
    ws['!cols'] = headers.map((header) => ({ wch: Math.max(12, Math.min(28, header.length + 2)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    const guide = XLSX.utils.aoa_to_sheet([
      ['GUÍA DE LLENADO · IMPORTACIÓN INICIAL DE INVENTARIO'],
      ['La importación inicial se puede ejecutar una sola vez por empresa. Revisa y corrige la previsualización antes de cargar.'],
      ['Campo', 'Regla'],
      ['Código / SKU', 'Obligatorio y único dentro de la empresa. La carga inicial del catálogo es única por empresa.'],
      ['Nombre', 'Obligatorio. En Productos solo se podrá editar nombre, SKU e imagen posteriormente.'],
      ['Categoría', 'Debe coincidir con una categoría existente de productos; durante la previsualización puedes elegir otra o crearla.'],
      ['Almacén', 'Obligatorio únicamente si Stock inicial es mayor que cero. Debe ser un almacén activo.'],
      ['Costo', 'Es el único precio que permanece visible/editable en Productos.'],
      ['Precio Minorista / Mayorista / Distribuidor', 'Incluye las tres listas predeterminadas. Puedes dejar una o dos vacías, pero cada producto debe tener al menos un precio de venta. Las celdas vacías se mostrarán como advertencias y no impedirán la carga.'],
    ]);
    guide['!cols'] = [{ wch: 36 }, { wch: 110 }];
    XLSX.utils.book_append_sheet(wb, guide, 'Guía de llenado');
    XLSX.writeFile(wb, 'plantilla_importacion_inicial_inventario.xlsx');
    toast.success('Plantilla descargada');
  }, [catalogItemType, categories, warehouses, importCurrency]);

  const handleDownloadImportErrors = useCallback(() => {
    const errors = importData.filter((row) => row._hasError || row._hasWarning).map((row) => ({
      'Código / SKU': row.code || '', Nombre: row.name || '', Categoría: row.category || '', Almacén: row.warehouse || '',
      Costo: row.costPrice ?? '', Minorista: row.prices?.RETAIL ?? '', Mayorista: row.prices?.WHOLESALE ?? '', Distribuidor: row.prices?.DISTRIBUTOR ?? '',
      Tipo: row._hasError ? 'Error' : 'Advertencia', Detalle: row._errorMessage || row._warningMessage || 'Revisar fila',
    }));
    if (!errors.length) return;
    const ws = XLSX.utils.json_to_sheet(errors); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Incidencias'); XLSX.writeFile(wb, 'incidencias_importacion_inicial.xlsx');
    toast.success('Reporte de incidencias descargado');
  }, [importData]);

  const validateImportRows = useCallback((rows: any[], entries = imageZipEntries, zipName = imageZipFileName, categoryOptions = importCategoryOptions, warehouseOptions = importWarehouseOptions) => {
    const codeCounts = new Map<string, number>();
    rows.forEach((row) => {
      const code = String(row.code || '').trim().toLowerCase();
      if (code) codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
    });
    return rows.map((row) => {
      const code = String(row.code || '').trim();
      const categoryOk = categoryOptions.some((c: any) => c.name?.toLowerCase() === String(row.category || '').trim().toLowerCase());
      const cost = row.costPrice === '' || row.costPrice === undefined || row.costPrice === null ? undefined : Number(row.costPrice);
      const prices = row.prices || {};
      const priceEntries = [
        ['Minorista', prices.RETAIL],
        ['Mayorista', prices.WHOLESALE],
        ['Distribuidor', prices.DISTRIBUTOR],
      ] as const;
      const suppliedPrices = priceEntries.filter(([, value]) => value !== undefined && value !== '' && value !== null);
      const invalidPrice = suppliedPrices.find(([, value]) => !Number.isFinite(Number(value)) || Number(value) < 0);
      const hasAtLeastOnePrice = suppliedPrices.some(([, value]) => Number.isFinite(Number(value)) && Number(value) >= 0);
      const missingPrices = priceEntries.filter(([, value]) => value === undefined || value === '' || value === null).map(([label]) => label);
      const stock = Number(row.initialStock || 0);
      const warehouseName = String(row.warehouse || '').trim();
      const warehouseExists = !warehouseName || warehouseOptions.some((warehouse: any) => warehouse.name?.toLowerCase() === warehouseName.toLowerCase());
      const warehouseOk = warehouseExists && (stock <= 0 || Boolean(row.warehouseId || warehouseName));
      const errors = [
        !code ? 'SKU requerido' : codeCounts.get(code.toLowerCase())! > 1 ? 'SKU duplicado en la plantilla' : '',
        !String(row.name || '').trim() ? 'Nombre requerido' : '',
        !categoryOk ? 'Categoría no encontrada' : '',
        cost === undefined || !Number.isFinite(cost) || cost < 0 ? 'Costo requerido y debe ser válido' : '',
        invalidPrice ? `Precio ${invalidPrice[0]} inválido` : !hasAtLeastOnePrice ? 'Debe incluir al menos un precio de venta' : '',
        !Number.isFinite(stock) || stock < 0 ? 'Stock inicial inválido' : !warehouseExists ? 'Almacén no encontrado' : !warehouseOk ? 'Selecciona un almacén para el stock inicial' : '',
      ].filter(Boolean);
      const warningParts = missingPrices.length > 0 ? [`Sin precio: ${missingPrices.join(', ')}`] : [];
      if (zipName && code && !entries.has(code.toLowerCase())) warningParts.push('No se encontró imagen JPG/PNG con el mismo SKU en el ZIP');
      return {
        ...row,
        code,
        name: String(row.name || '').trim(),
        costPrice: cost,
        salePrice: Number(prices.RETAIL ?? prices.WHOLESALE ?? prices.DISTRIBUTOR ?? 0),
        _hasError: errors.length > 0,
        _errorMessage: errors[0],
        _hasWarning: warningParts.length > 0,
        _warningMessage: warningParts.join(' · '),
      };
    });
  }, [importCategoryOptions, importWarehouseOptions, imageZipEntries, imageZipFileName]);

  const handleFileSelected = useCallback((file: File) => {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      toast.error('Selecciona un archivo Excel o CSV válido');
      return;
    }
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
          code: ['código / sku', 'código', 'codigo', 'code', 'sku'], name: ['nombre', 'name', 'producto'], description: ['descripción', 'descripcion', 'description'], category: ['categoría', 'categoria', 'category', 'cat'], itemType: ['tipo', 'type'], taxRate: ['tasa iva', 'iva', 'tax rate'], imageUrl: ['imagen url', 'imagen', 'image url'], barcode: ['código de barras', 'barcode'], brand: ['marca', 'brand'], model: ['modelo', 'model'], color: ['color'], weight: ['peso', 'weight'], weightUnit: ['unidad peso', 'weight unit'], dimensions: ['dimensiones', 'dimensions'], width: ['ancho', 'width'], height: ['alto', 'height'], depth: ['profundidad', 'depth'], dimensionUnit: ['unidad dimensión', 'dimension unit'], warranty: ['garantía', 'garantia', 'warranty'], estimatedDuration: ['duración estimada', 'duracion estimada'], unit: ['unidad', 'unit', 'medida'], trackInventory: ['control de inventario', 'track inventory'], minStock: ['stock mínimo', 'stock minimo', 'min stock'], costPrice: ['costo', 'precio costo', 'cost price'], lastPurchasePrice: ['último costo', 'ultimo costo', 'last purchase price'], initialStock: ['stock inicial', 'initial stock', 'cantidad', 'qty'], warehouse: ['almacén', 'almacen', 'warehouse'], trackBatch: ['control de lotes', 'track batch'], trackSeries: ['control de series', 'track series'], attributes: ['atributos json', 'atributos', 'attributes'], retailPrice: ['precio minorista', 'minorista', 'retail price'], wholesalePrice: ['precio mayorista', 'mayorista', 'wholesale price'], distributorPrice: ['precio distribuidor', 'distribuidor', 'distributor price'],
        };
        for (const [key, alts] of Object.entries(aliases)) {
          const idx = headers.findIndex((h: string) => alts.includes(h));
          if (idx >= 0) colMap[key] = idx;
        }
        const parsed = raw.slice(1).filter((row: any[]) => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')).map((row: any[]) => {
          const get = (key: string) => colMap[key] !== undefined ? row[colMap[key]] : undefined;
          const isService = catalogItemType === 'SERVICE';
          const toNumber = (key: string) => get(key) === '' || get(key) === undefined ? undefined : Number(get(key));
          const prices = { RETAIL: toNumber('retailPrice'), WHOLESALE: toNumber('wholesalePrice'), DISTRIBUTOR: toNumber('distributorPrice') };
          let attributes: any = undefined;
          if (get('attributes')) { try { attributes = JSON.parse(String(get('attributes'))); } catch { attributes = String(get('attributes')); } }
          return {
            code: String(get('code') || '').trim(),
            name: String(get('name') || '').trim(),
            category: String(get('category') || '').trim(),
            itemType: catalogItemType,
            description: String(get('description') || '').trim(), taxRate: toNumber('taxRate') ?? 0.15, imageUrl: String(get('imageUrl') || '').trim() || undefined, barcode: String(get('barcode') || '').trim() || undefined, brand: String(get('brand') || '').trim() || undefined, model: String(get('model') || '').trim() || undefined, color: String(get('color') || '').trim() || undefined, weight: toNumber('weight'), weightUnit: String(get('weightUnit') || '').trim() || undefined, dimensions: String(get('dimensions') || '').trim() || undefined, width: toNumber('width'), height: toNumber('height'), depth: toNumber('depth'), dimensionUnit: String(get('dimensionUnit') || '').trim() || undefined, warranty: String(get('warranty') || '').trim() || undefined, estimatedDuration: toNumber('estimatedDuration'), trackInventory: String(get('trackInventory') || 'SI').toUpperCase() !== 'NO', lastPurchasePrice: toNumber('lastPurchasePrice'), trackBatch: String(get('trackBatch') || '').toUpperCase() === 'SI', trackSeries: String(get('trackSeries') || '').toUpperCase() === 'SI', attributes,
            unit: String(get('unit') || 'unidad').trim().toLowerCase() || 'unidad',
            salePrice: Number(prices.RETAIL ?? prices.WHOLESALE ?? prices.DISTRIBUTOR ?? 0),
            costPrice: get('costPrice') === '' || get('costPrice') === undefined ? undefined : Number(get('costPrice')),
            initialStock: isService ? 0 : Number(get('initialStock') || 0),
            minStock: isService ? 0 : Number(get('minStock') || 0),
            warehouse: String(get('warehouse') || '').trim(), prices,
          };
        });
        setImportData(validateImportRows(parsed));
        setImportFileName(file.name);
        setImportProgress(0);
        toast.success(`${parsed.length} registros encontrados`);
      } catch (err) {
        console.error('Parse error', err);
        toast.error('No se pudo leer el archivo. Asegúrate de que sea un .xlsx o .csv válido.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, [catalogItemType, validateImportRows]);

  const handleImageZipSelected = useCallback(async (file: File) => {
    if (!/\.zip$/i.test(file.name)) {
      toast.error('Selecciona un archivo ZIP válido');
      return;
    }
    try {
      const zip = await JSZip.loadAsync(file);
      const entries = new Map<string, File>();
      const files = Object.values(zip.files).filter((entry) => !entry.dir && /\.(jpg|png)$/i.test(entry.name));
      await Promise.all(files.map(async (entry) => {
        const fileName = entry.name.split('/').pop() || '';
        const sku = fileName.replace(/\.(jpg|png)$/i, '').trim().toLowerCase();
        if (!sku) return;
        const blob = await entry.async('blob');
        entries.set(sku, new File([blob], fileName, { type: /\.png$/i.test(fileName) ? 'image/png' : 'image/jpeg' }));
      }));
      setImageZipEntries(entries);
      setImageZipFileName(file.name);
      setImportData((prev) => validateImportRows(prev, entries, file.name));
      toast.success(`${entries.size} imagen(es) válidas encontradas en el ZIP`);
    } catch (error) {
      console.error('ZIP image parse error', error);
      toast.error('No se pudo leer el ZIP de imágenes');
    }
  }, [validateImportRows]);

  const handleImportRowUpdate = (index: number, field: string, value: any) => {
    setImportData((prev) => {
      const next = [...prev];
      const row = { ...next[index], prices: { ...(next[index].prices || {}) } };
      if (field.startsWith('price.')) {
        const priceCode = field.split('.')[1];
        row.prices[priceCode] = value === '' ? undefined : Number(value);
        row.salePrice = Number(row.prices.RETAIL ?? row.prices.WHOLESALE ?? row.prices.DISTRIBUTOR ?? 0);
      } else {
        row[field] = value;
      }
      if (field === 'category') {
        const category = importCategoryOptions.find((c: any) => c.name?.toLowerCase() === String(value).trim().toLowerCase());
        row.categoryId = category?.id;
      }
      if (field === 'warehouse') {
        const warehouse = importWarehouseOptions.find((w: any) => w.name?.toLowerCase() === String(value).trim().toLowerCase());
        row.warehouseId = warehouse?.id;
      }
      next[index] = row;
      return validateImportRows(next);
    });
  };

  const handleImportConfirm = useCallback(() => {
    const valid = importData.filter((row) => !row._hasError);
    if (valid.length === 0) {
      toast.error('No hay registros válidos para importar');
      return;
    }
    if (valid.length !== importData.length) {
      toast.warning(`Se omitirán ${importData.length - valid.length} fila(s) con errores. Las advertencias no impedirán la carga.`);
    }
    setInitialImportConfirmOpen(true);
  }, [importData]);

  const handleFinalInitialImport = useCallback(async () => {
    const valid = importData.filter((row) => !row._hasError);
    if (initialImportConfirmText !== 'IMPORTAR' || valid.length === 0) return;
    setImporting(true);
    setImportProgress(0);
    try {
      const items = [];
      for (let index = 0; index < valid.length; index += 1) {
        const row = valid[index];
        const cat = importCategoryOptions.find((c: any) => c.name?.toLowerCase() === row.category?.toLowerCase());
        const warehouse = importWarehouseOptions.find((w: any) => w.name?.toLowerCase() === row.warehouse?.toLowerCase());
        let imageUrl = row.imageUrl;
        const imageFile = imageZipEntries.get(String(row.code || '').trim().toLowerCase());
        if (imageFile) {
          try {
            const uploaded = await storageService.uploadFile('product-image', imageFile, { folder: 'catalogo-inicial' });
            imageUrl = uploaded.uri;
          } catch (error) {
            toast.warning(`No se pudo cargar la imagen de ${row.code}; el producto se importará sin ella.`);
          }
        }
        items.push({
          code: row.code,
          name: row.name,
          categoryId: cat?.id,
          description: row.description, taxRate: row.taxRate, imageUrl, barcode: row.barcode, brand: row.brand, model: row.model, color: row.color, weight: row.weight, weightUnit: row.weightUnit, dimensions: row.dimensions, width: row.width, height: row.height, depth: row.depth, dimensionUnit: row.dimensionUnit, warranty: row.warranty, estimatedDuration: row.estimatedDuration, trackInventory: row.trackInventory, lastPurchasePrice: row.lastPurchasePrice, trackBatch: row.trackBatch, attributes: row.attributes,
          unit: row.unit || 'unidad',
          costPrice: row.costPrice,
          initialStock: row.initialStock,
          minStock: row.minStock || 0,
          warehouseId: warehouse?.id,
          prices: row.prices,
          price: row.salePrice,
          trackSeries: Boolean(row.trackSeries),
        });
        setImportProgress(Math.round(((index + 1) / valid.length) * 70));
      }
      const results = await inventoryService.importInitialCatalog({ items, currency: importCurrency, exchangeRate: importExchangeRate, priceListCode: 'RETAIL', confirmText: 'IMPORTAR' });
      setImportProgress(100);
      setImportResults({ success: results.success || 0, skipped: 0, failed: results.errors?.length || 0, errors: results.errors || [] });
      setImportModalOpen(false);
      setInitialImportConfirmOpen(false);
      setInitialImportConfirmText('');
      setImportData([]);
      setImportFileName('');
      setInitialImportCompleted(true);
      onRefresh();
    } catch (e: any) {
      toast.error('Error durante la importación: ' + (e.message || 'Error'));
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  }, [importData, importCategoryOptions, importWarehouseOptions, imageZipEntries, importCurrency, importExchangeRate, initialImportConfirmText, onRefresh]);

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
            ...(isServiceView ? [
              { id: 'service-categories', label: 'Categorías', value: serviceSummary.categories, tone: 'text-blue-600' },
              { id: 'service-weekly-average', label: 'Promedio de servicios por semana', value: serviceSummary.weeklyAverage, tone: 'text-emerald-600', decimals: 1 },
              { id: 'service-average', label: 'Precio promedio', value: serviceSummary.averagePrice, tone: 'text-amber-600', isCurrency: true },
            ] : [
              { id: 'available', label: 'Disponibles', value: inventorySummary.available, tone: 'text-emerald-600' },
              { id: 'low', label: 'Stock bajo', value: inventorySummary.low, tone: 'text-amber-600' },
              { id: 'out', label: 'Sin stock', value: inventorySummary.out, tone: 'text-rose-600' },
            ]),
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={['all', 'available', 'low', 'out'].includes(item.id) && stockFilter === item.id}
              onClick={() => ['all', 'available', 'low', 'out'].includes(item.id) && setStockFilter(item.id as typeof stockFilter)}
              className={`rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                stockFilter === item.id ? 'border-primary bg-primary/5' : 'border-border/70 bg-muted/20 hover:bg-muted/50'
              }`}
            >
              <span className="block text-xs font-semibold text-muted-foreground">{item.label}</span>
              <span className={`mt-1 block text-2xl font-black tabular-nums ${item.tone}`}>{'isCurrency' in item && item.isCurrency ? formatAmount(item.value) : 'decimals' in item && item.decimals !== undefined ? item.value.toFixed(item.decimals) : item.value}</span>
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
          <div className="flex items-center gap-1">
            <MultiSelectFilter
              label="Categorías"
              placeholder="Buscar categoría..."
              options={categories.map((c: any) => ({ value: c.id, label: c.name }))}
              selected={categoryFilters}
              onChange={setCategoryFilters}
              className="h-9 rounded-lg"
            />
            <Button type="button" variant="outline" size="sm" className="h-9 w-9 shrink-0 rounded-lg p-0" onClick={() => { setPendingCategoryRowIndex(null); setCategoryModalOpen(true); }} title="Agregar categoría" aria-label="Agregar categoría">
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <MultiSelectFilter
              label="Almacenes"
              placeholder="Buscar almacén..."
              searchable
              options={warehouses.map((w: any) => ({ value: w.id, label: w.name }))}
              selected={warehouseFilters}
              onChange={setWarehouseFilters}
              className="h-9 rounded-lg"
            />
            <Button type="button" variant="outline" size="sm" className="h-9 w-9 shrink-0 rounded-lg p-0" onClick={() => { setPendingWarehouseRowIndex(null); setWarehouseModalOpen(true); }} title="Agregar almacén" aria-label="Agregar almacén">
              <Plus className="size-4" />
            </Button>
          </div>
          {(categoryFilters.length > 0 || warehouseFilters.length > 0 || searchTerm || stockFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearchTerm('');
                setCategoryFilters([]);
                setWarehouseFilters([]);
                setStockFilter('all');
              }}
            >
              <X className="size-3.5 mr-1" />
              Limpiar filtros
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isServiceView && !initialImportCompleted && products.length === 0 && <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-lg px-3 font-black text-[10px] uppercase tracking-widest"
            onClick={() => setInitialImportIntroOpen(true)}
            disabled={initialImportCompleted}
            title={initialImportCompleted ? 'La importación inicial ya fue completada' : 'Importar catálogo inicial'}
          >
            <Upload className="size-4 mr-2" /> {initialImportCompleted ? 'Carga inicial completada' : 'Importar catálogo'}
          </Button>}
          {!isServiceView && <Select value={replenishmentPeriod} onValueChange={(value) => setReplenishmentPeriod(value as 'weekly' | 'biweekly' | 'monthly')}>
            <SelectTrigger className="h-9 w-[120px] rounded-lg text-xs font-bold">
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
            className="h-9 rounded-lg px-3 font-black text-[10px] uppercase tracking-widest"
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
            <>
              <Button
                size="sm"
                className="hidden 2xl:flex h-9 rounded-lg bg-gradient-to-br from-primary to-primary/80 px-4 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
                onClick={handleAddRow}
              >
                <Plus className="size-4" /> Agregar servicio
              </Button>
              <Button
                size="sm"
                className="flex h-9 rounded-lg bg-gradient-to-br from-primary to-primary/80 px-4 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl 2xl:hidden"
                onClick={() => setCreateModalOpen(true)}
              >
                <Plus className="size-4" /> Agregar servicio
              </Button>
            </>
          )}
          {selectedIds.size > 0 && (
            <Button
              size="sm"
              variant="destructive"
              className="h-9 rounded-lg px-3 font-black text-[10px] uppercase tracking-widest"
              onClick={() => setBatchDeleteOpen(true)}
            >
              <Trash2 className="size-4 mr-2" />
              Eliminar {selectedIds.size}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile cards: the desktop table stays available at md+ without forcing page overflow. */}
      <div className="space-y-3 2xl:hidden">
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
            : (product.stockLevels || []).map((level: any) => level.warehouse?.name).filter(Boolean);
          const salePrice = Number(product.salePrice || 0);
          const costPrice = Number(product.costPrice || 0);
          const maxStock = getProductMaxStock(product);
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
                  <div className="mt-3 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3 xl:grid-cols-4">
                    {isServiceView && <div>
                      <span className="text-muted-foreground">{isServiceView ? 'Precio' : 'Precio venta'}</span>
                      <p className="font-bold tabular-nums">{formatAmount(product.salePrice || 0, baseCurrency)}</p>
                    </div>}
                    {!isServiceView && <div>
                      <span className="text-muted-foreground">Existencias</span>
                      <p className={`font-bold tabular-nums ${getStockAlertColor(product)}`}>{product.stock || 0}</p>
                    </div>}
                    {!isServiceView && <>
                      <div className="min-w-0"><span className="text-muted-foreground">U. medida</span><p className="truncate font-medium">{product.unit || 'unidad'}</p></div>
                      <div><span className="text-muted-foreground">Mínimo</span><p className="font-bold tabular-nums">{product.minStock || 0}</p></div>
                      <div><span className="text-muted-foreground">Máximo</span><p className="font-bold tabular-nums">{maxStock}</p></div>
                      <div><span className="text-muted-foreground">Precio costo</span><p className="font-medium tabular-nums">{formatAmount(costPrice, baseCurrency)}</p></div>
                    </>}
                  </div>
                  {!isServiceView && <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="font-bold uppercase tracking-wider">IMEI</span>
                    <Badge variant="secondary" className="text-[9px]">{product.trackSerialNumbers ? 'Activo' : 'Inactivo'}</Badge>
                  </div>}
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
                {canPerform('INVENTORY_PRODUCTS', 'edit') && <Button variant="ghost" size="icon" className="size-8" title="Editar" onClick={(e) => { e.stopPropagation(); setModalProduct(product); }}><Pencil className="size-3.5" /></Button>}
                {canPerform('INVENTORY_PRODUCTS', 'delete') && <Button variant="ghost" size="icon" className="size-8 text-red-600 hover:bg-red-500 hover:text-white" title="Eliminar" onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }}><Trash2 className="size-3.5" /></Button>}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden max-w-full overflow-x-auto rounded-lg border 2xl:block">
        <Table className="w-full table-fixed">
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
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-48">{isServiceView ? 'Servicio' : 'Nombre'}</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-36">Categoría</TableHead>
              {!isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest w-28">U.Medida</TableHead>}
              {!isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-20">Min</TableHead>}
              {!isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-20">Max</TableHead>}
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-28">Almacenes</TableHead>
              {!isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-24">Stock</TableHead>}
              {isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-28">Precio</TableHead>}
              {!isServiceView && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-28">Precio Costo</TableHead>}
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
                <TableCell colSpan={isServiceView ? 7 : 11} className="text-center py-12 text-muted-foreground">
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
                    {isServiceView && <TableCell className="text-right font-medium tabular-nums">{formatAmount(product.salePrice || 0, baseCurrency)}</TableCell>}
                     {!isServiceView && <TableCell className="text-right text-muted-foreground tabular-nums">{formatAmount(product.costPrice || 0, baseCurrency)}</TableCell>}
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
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Mostrar</span>
          <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-8 rounded-lg border border-border/50 bg-background px-2 font-bold text-foreground outline-none" aria-label="Registros por página">
            {[50, 100, 200].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          <span>por página</span>
          <span className="ml-2 rounded-lg border border-border/40 px-2 py-1">
            {filteredProducts.length === 0 ? 0 : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, filteredProducts.length)}`} de {filteredProducts.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="rounded-lg border border-border/50 p-2 disabled:opacity-30" onClick={() => setPage(1)} disabled={page <= 1} aria-label="Primera página"><ChevronsLeft className="size-4" /></button>
          <button type="button" className="rounded-lg border border-border/50 p-2 disabled:opacity-30" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Página anterior"><ChevronLeft className="size-4" /></button>
          <span className="min-w-24 text-center font-bold text-foreground">Pág. {page} / {Math.max(1, totalPages)}</span>
          <button type="button" className="rounded-lg border border-border/50 p-2 disabled:opacity-30" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} aria-label="Página siguiente"><ChevronRight className="size-4" /></button>
          <button type="button" className="rounded-lg border border-border/50 p-2 disabled:opacity-30" onClick={() => setPage(totalPages)} disabled={page >= totalPages} aria-label="Última página"><ChevronsRight className="size-4" /></button>
        </div>
      </div>
      <EditProductModal
        product={modalProduct}
        categories={categories}
        warehouses={warehouses}
        itemType={catalogItemType}
        onClose={() => setModalProduct(null)}
        onRefresh={onRefresh}
      />
      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="¿Eliminar producto?"
        description="Esta acción eliminará el producto del inventario."
        confirmLabel="Eliminar"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
      />
      <Dialog open={categoryModalOpen} onOpenChange={(open) => { setCategoryModalOpen(open); if (!open) setPendingCategoryRowIndex(null); }}>
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
      <Dialog open={warehouseModalOpen} onOpenChange={(open) => { setWarehouseModalOpen(open); if (!open) setPendingWarehouseRowIndex(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo almacén</DialogTitle><DialogDescription>Créalo y podrás seleccionarlo en la previsualización del inventario.</DialogDescription></DialogHeader>
          <Input value={newWarehouseName} onChange={(event) => setNewWarehouseName(event.target.value)} placeholder="Ej. Bodega principal" />
          <DialogFooter><Button variant="outline" onClick={() => setWarehouseModalOpen(false)}>Cancelar</Button><Button onClick={handleCreateWarehouse} disabled={creatingWarehouse}>{creatingWarehouse ? 'Guardando…' : 'Guardar almacén'}</Button></DialogFooter>
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
      <Dialog open={initialImportIntroOpen} onOpenChange={setInitialImportIntroOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Importación inicial de inventario</DialogTitle>
            <DialogDescription>
              Esta carga se realiza una sola vez por empresa. Primero descarga la plantilla, completa los datos y después revisa la previsualización antes de confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-xl border bg-muted/20 p-4 text-sm">
            <p><b>La plantilla siempre incluye:</b> costo, Minorista, Mayorista y Distribuidor.</p>
            <p>Cada producto debe tener SKU único, nombre, categoría, costo y al menos uno de los tres precios. Los precios faltantes serán advertencias.</p>
            <p>Opcionalmente puedes cargar un ZIP con imágenes JPG o PNG cuyo nombre sea exactamente el SKU.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleDownloadTemplate}><Download className="size-4 mr-2" />Descargar plantilla</Button>
            <Button onClick={() => { setInitialImportIntroOpen(false); setImportModalOpen(true); }}>Continuar con la carga</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={importModalOpen} onOpenChange={(open) => {
        if (!importing) {
          setImportModalOpen(open);
          if (!open) { setImportData([]); setImportFileName(''); setImageZipFileName(''); setImageZipEntries(new Map()); setImportProgress(0); }
        }
      }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[1100px] sm:max-w-[1100px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Importar {isServiceView ? 'Servicios' : 'Productos'}</DialogTitle>
            <DialogDescription>
              Sube el catálogo inicial. Esta carga es única por empresa y se confirma en dos pasos.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><p className="mb-1 text-[10px] font-black uppercase text-muted-foreground">Listas incluidas</p><p className="h-9 flex items-center text-xs font-semibold">Minorista · Mayorista · Distribuidor</p></div>
            <div><p className="mb-1 text-[10px] font-black uppercase text-muted-foreground">Moneda del archivo</p><Select value={importCurrency} onValueChange={setImportCurrency}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NIO">Córdoba (NIO)</SelectItem><SelectItem value="USD">Dólar (USD)</SelectItem></SelectContent></Select></div>
            <div><p className="mb-1 text-[10px] font-black uppercase text-muted-foreground">Tasa USD / moneda base</p><Input className="h-9 text-xs" type="number" min="0.0001" step="any" value={importExchangeRate} onChange={(event) => setImportExchangeRate(Number(event.target.value) || 1)} disabled={importCurrency === 'NIO'} /></div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed p-3">
            <div className="min-w-0">
              <p className="text-xs font-bold">Imágenes de productos (opcional)</p>
              <p className="whitespace-normal text-[11px] text-muted-foreground">ZIP con archivos JPG o PNG nombrados exactamente como el SKU para asociarlos automáticamente.</p>
              {imageZipFileName && <p className="mt-1 text-[11px] text-emerald-600">{imageZipFileName} · {imageZipEntries.size} imagen(es) reconocida(s)</p>}
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => imageZipInputRef.current?.click()} disabled={importing}>
              <Upload className="size-3 mr-2" />{imageZipFileName ? 'Cambiar ZIP' : 'Cargar ZIP'}
            </Button>
            <input type="file" className="hidden" accept=".zip" ref={imageZipInputRef} onChange={(e) => { if (e.target.files?.[0]) handleImageZipSelected(e.target.files[0]); }} />
          </div>
          
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
                    <p>• <b>Precios por lista</b></p>
                    <p>• <b>Costo</b></p>
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
                  <div className="flex gap-1"><Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleDownloadImportErrors} disabled={!importData.some((row) => row._hasError || row._hasWarning)}>Descargar incidencias</Button><Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setImportFileName(''); setImportData([]); }} disabled={importing}>Cambiar archivo</Button></div>
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
                          <TableHead className="text-[10px] uppercase w-28 text-right">Minorista</TableHead>
                          <TableHead className="text-[10px] uppercase w-28 text-right">Mayorista</TableHead>
                          <TableHead className="text-[10px] uppercase w-28 text-right">Distribuidor</TableHead>
                          <TableHead className="text-[10px] uppercase w-28 text-right">Costo</TableHead>
                          <TableHead className="text-[10px] uppercase w-24 text-right">Stock</TableHead>
                          <TableHead className="text-[10px] uppercase w-24 text-right">Min</TableHead>
                          <TableHead className="text-[10px] uppercase w-32">Almacén</TableHead>
                          <TableHead className="text-[10px] uppercase w-36">Validación</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importData.slice(0, 100).map((row, i) => (
                          <TableRow key={i} className={row._hasError ? 'bg-red-500/10' : row._hasWarning ? 'bg-amber-500/5' : ''}>
                            <TableCell>
                              {row._hasError ? (
                                <AlertTriangle className="size-4 text-red-500" />
                              ) : row._hasWarning ? (
                                <AlertTriangle className="size-4 text-amber-500" />
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
                              {importCategoryOptions.some((category: any) => category.name?.toLowerCase() === String(row.category || '').trim().toLowerCase()) ? (
                                <Input
                                  value={row.category}
                                  onChange={(e) => handleImportRowUpdate(i, 'category', e.target.value)}
                                  className="h-8 text-xs"
                                />
                              ) : (
                                <div className="flex items-center gap-1">
                                  <Select value="__none__" onValueChange={(value) => {
                                    const category = importCategoryOptions.find((item: any) => item.id === value);
                                    if (category) handleImportRowUpdate(i, 'category', category.name);
                                  }}>
                                    <SelectTrigger className="h-8 min-w-0 flex-1 border-amber-500/60 text-xs text-amber-600"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">{row.category ? `No existe: ${row.category}` : 'Seleccionar categoría'}</SelectItem>
                                      {importCategoryOptions.map((category: any) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <Button type="button" variant="outline" size="sm" className="h-8 w-8 shrink-0 rounded-lg p-0 text-amber-600" title="Crear esta categoría" aria-label="Crear esta categoría" onClick={() => {
                                    setPendingCategoryRowIndex(i);
                                    setNewCategoryName(row.category || '');
                                    setNewCategoryDescription('');
                                    setCategoryModalOpen(true);
                                  }}><Plus className="size-3.5" /></Button>
                                </div>
                              )}
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
                                value={row.prices?.RETAIL ?? ''}
                                onChange={(e) => handleImportRowUpdate(i, 'price.RETAIL', e.target.value)}
                                className="h-8 text-xs text-right"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input type="number" min={0} value={row.prices?.WHOLESALE ?? ''} onChange={(e) => handleImportRowUpdate(i, 'price.WHOLESALE', e.target.value)} className="h-8 text-xs text-right" />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input type="number" min={0} value={row.prices?.DISTRIBUTOR ?? ''} onChange={(e) => handleImportRowUpdate(i, 'price.DISTRIBUTOR', e.target.value)} className="h-8 text-xs text-right" />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input type="number" min={0} value={row.costPrice ?? ''} onChange={(e) => handleImportRowUpdate(i, 'costPrice', e.target.value)} className="h-8 text-xs text-right" />
                            </TableCell>
                            <TableCell className="p-1">
                              {row.itemType === 'SERVICE' ? (
                                <span className="text-xs text-muted-foreground/50 italic h-8 flex items-center justify-end">N/A</span>
                              ) : (
                                <Input
                                  type="number"
                                  min={0}
                                  value={row.initialStock}
                                  disabled
                                  aria-label="Stock inicial no editable"
                                  title="El stock inicial se toma de la plantilla y no puede editarse durante la previsualización"
                                  className="h-8 text-xs text-right cursor-not-allowed opacity-60"
                                />
                              )}
                            </TableCell>
                            <TableCell className="p-1">
                              <Input type="number" min={0} value={row.minStock} onChange={(e) => handleImportRowUpdate(i, 'minStock', Number(e.target.value) || 0)} className="h-8 text-xs text-right" />
                            </TableCell>
                            <TableCell className="p-1 text-center">
                              {!row.warehouse || importWarehouseOptions.some((warehouse: any) => warehouse.name?.toLowerCase() === String(row.warehouse || '').trim().toLowerCase()) ? (
                                <Select value={row.warehouse || '__none__'} onValueChange={(value) => handleImportRowUpdate(i, 'warehouse', value === '__none__' ? '' : value)}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent><SelectItem value="__none__">Sin almacén</SelectItem>{importWarehouseOptions.map((warehouse: any) => <SelectItem key={warehouse.id} value={warehouse.name}>{warehouse.name}</SelectItem>)}</SelectContent></Select>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <Select value="__none__" onValueChange={(value) => handleImportRowUpdate(i, 'warehouse', value === '__none__' ? '' : value)}>
                                    <SelectTrigger className="h-8 min-w-0 flex-1 border-amber-500/60 text-xs text-amber-600"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">{`No existe: ${row.warehouse}`}</SelectItem>
                                      {importWarehouseOptions.map((warehouse: any) => <SelectItem key={warehouse.id} value={warehouse.name}>{warehouse.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <Button type="button" variant="outline" size="sm" className="h-8 w-8 shrink-0 rounded-lg p-0 text-amber-600" title="Crear este almacén" aria-label="Crear este almacén" onClick={() => {
                                    setPendingWarehouseRowIndex(i);
                                    setNewWarehouseName(row.warehouse || '');
                                    setWarehouseModalOpen(true);
                                  }}><Plus className="size-3.5" /></Button>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="p-1 text-xs"><span className={row._hasError ? 'text-red-600' : row._hasWarning ? 'text-amber-600' : 'text-emerald-600'}>{row._errorMessage || row._warningMessage || 'Correcto'}</span>
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

      <Dialog open={initialImportConfirmOpen} onOpenChange={setInitialImportConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Formalizar importación inicial</DialogTitle>
            <DialogDescription>Esta acción creará {importData.filter((row) => !row._hasError).length} productos y omitirá {importData.filter((row) => row._hasError).length} fila(s) con errores. No podrá repetirse para esta empresa. Los precios Minorista, Mayorista y Distribuidor se guardarán en {importCurrency}; las listas sin precio quedarán pendientes. Escribe IMPORTAR para confirmar.</DialogDescription>
          </DialogHeader>
          <Input value={initialImportConfirmText} onChange={(event) => setInitialImportConfirmText(event.target.value.toUpperCase())} placeholder="IMPORTAR" autoFocus />
          <DialogFooter><Button variant="outline" onClick={() => setInitialImportConfirmOpen(false)}>Cancelar</Button><Button onClick={handleFinalInitialImport} disabled={initialImportConfirmText !== 'IMPORTAR' || importing}>Confirmar importación</Button></DialogFooter>
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
