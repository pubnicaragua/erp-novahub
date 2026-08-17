import { useState, useRef, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { ProductImagePicker } from '../ui/ProductImage';
import { Trash2, Plus, Package, X, Tag, Check } from 'lucide-react';
import { useCurrency } from '@/app/contexts/CurrencyContext';
import { inventoryService } from '@/app/services/inventario.service';
import { storageService } from '@/app/services/storage.service';
import { toast } from 'sonner';
import { InventoryViewTutorial } from './InventoryViewTutorial';

interface AddProductsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories?: any[];
  warehouses?: any[];
  onRefresh: () => void;
  itemType?: 'PRODUCT' | 'SERVICE';
}

const makeDefaultDraft = (categoryId: string, itemType: string) => ({
  id: `draft-${Date.now()}`,
  code: '',
  name: '',
  categoryId,
  itemType,
  description: '',
  priceCurrency: 'NIO',
  costPrice: '',
  salePrice: '',
  trackSerialNumbers: false,
  isActive: true,
  initialStock: '',
  initialWarehouseId: '',
  imageFile: null as File | null,
  imagePreviewUrl: '',
  isVariable: false,
  linkedAttributes: [] as Array<{ attributeId: string; selectedOptions: string[] }>,
  imeiNumber: '',
});

export function AddProductsModal({ open, onOpenChange, categories, warehouses, onRefresh, itemType = 'PRODUCT' }: AddProductsModalProps) {
  const { exchangeRate, baseCurrency } = useCurrency();
  const [internalCategories, setInternalCategories] = useState<any[]>([]);
  const [internalWarehouses, setInternalWarehouses] = useState<any[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    if (!categories && open) {
      inventoryService.getCategories(controller.signal).then(r => setInternalCategories((r as any)?.data || r || [])).catch(() => undefined);
    }
    if (!warehouses && open) {
      inventoryService.getWarehouses(controller.signal).then(r => setInternalWarehouses((r as any)?.data || r || [])).catch(() => undefined);
    }
    return () => controller.abort();
  }, [open, categories, warehouses]);

  const effectiveCategories = categories ?? internalCategories;
  const [extraCategories, setExtraCategories] = useState<any[]>([]);
  const allCategories = useMemo(() => {
    const map = new Map<string, any>();
    [...effectiveCategories, ...extraCategories].forEach((c: any) => map.set(c.id, c));
    return Array.from(map.values());
  }, [effectiveCategories, extraCategories]);
  const effectiveWarehouses = warehouses ?? internalWarehouses;
  const catalogItemType = itemType;

  const [productsList, setProductsList] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const defaultDraft = makeDefaultDraft(effectiveCategories[0]?.id || '', catalogItemType);

  const [draftProduct, setDraftProduct] = useState<any>({ ...defaultDraft });
  
  const [skuError, setSkuError] = useState('');
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [catalogAttributes, setCatalogAttributes] = useState<any[]>([]);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const validateSkuDebounced = (code: string) => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    if (!code.trim()) {
      setSkuError('');
      return;
    }
    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await inventoryService.checkProductCode(code);
        const exists = response?.exists;
        setSkuError(exists ? 'Código duplicado' : '');
      } catch (e: any) {
        console.error('Error validating SKU', e);
      }
    }, 1000);
  };

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    inventoryService.getAttributes(controller.signal)
      .then((res) => {
        const data = (res as any)?.data || res || [];
        setCatalogAttributes(Array.isArray(data) ? data : []);
      })
      .catch(() => setCatalogAttributes([]));
    return () => controller.abort();
  }, [open]);

  const getSelectedAttributes = () => {
    return catalogAttributes.filter((a: any) =>
      draftProduct.linkedAttributes.some((la: any) => la.attributeId === a.id)
    );
  };

  const combinationCount = (attrs: any[]) => {
    if (attrs.length === 0) return 0;
    return attrs.reduce((acc: number, attr: any) => {
      const linked = draftProduct.linkedAttributes.find((la: any) => la.attributeId === attr.id);
      const selectedCount = linked?.selectedOptions?.length || attr.options?.length || 0;
      return acc * Math.max(1, selectedCount);
    }, 1);
  };

  const toggleAttribute = (attrId: string) => {
    setDraftProduct((prev: any) => {
      const exists = prev.linkedAttributes.find((la: any) => la.attributeId === attrId);
      if (exists) {
        return { ...prev, linkedAttributes: prev.linkedAttributes.filter((la: any) => la.attributeId !== attrId) };
      }
      const attr = catalogAttributes.find((a: any) => a.id === attrId);
      return {
        ...prev,
        linkedAttributes: [...prev.linkedAttributes, { attributeId: attrId, name: attr?.name || '', selectedOptions: attr?.options || [] }],
      };
    });
  };

  const toggleAttributeOption = (attrId: string, option: string) => {
    setDraftProduct((prev: any) => ({
      ...prev,
      linkedAttributes: prev.linkedAttributes.map((la: any) => {
        if (la.attributeId !== attrId) return la;
        const has = la.selectedOptions.includes(option);
        return {
          ...la,
          selectedOptions: has
            ? la.selectedOptions.filter((o: string) => o !== option)
            : [...la.selectedOptions, option],
        };
      }),
    }));
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Ingresa un nombre para la categoría');
      return;
    }
    setCreatingCategory(true);
    try {
      const created = await inventoryService.createCategory({
        name: newCategoryName.trim(),
        description: newCategoryDesc.trim() || undefined,
        type: catalogItemType as 'PRODUCT' | 'SERVICE',
      });
      const newCat = (created as any)?.data || created;
      setExtraCategories((prev) => [...prev, newCat]);
      handleUpdateDraft('categoryId', newCat.id);
      setNewCategoryName('');
      setNewCategoryDesc('');
      setNewCategoryOpen(false);
      toast.success('Categoría creada');
    } catch (e: any) {
      toast.error(e?.message || 'Error al crear categoría');
    } finally {
      setCreatingCategory(false);
    }
  };

  // Categories arrive asynchronously when this modal is opened from POS.
  // Select the first one once loaded so the required category is not left empty.
  useEffect(() => {
    if (!open || draftProduct.categoryId || effectiveCategories.length === 0) return;
    const timer = setTimeout(() => {
      setDraftProduct((prev: any) => ({ ...prev, categoryId: effectiveCategories[0].id }));
    }, 0);
    return () => clearTimeout(timer);
  }, [open, draftProduct.categoryId, effectiveCategories]);

  const handleImageSelected = (file: File) => {
    if (draftProduct.imagePreviewUrl) URL.revokeObjectURL(draftProduct.imagePreviewUrl);
    setDraftProduct((prev: any) => ({ ...prev, imageFile: file, imagePreviewUrl: URL.createObjectURL(file) }));
  };

  const handleImageRemoved = () => {
    if (draftProduct.imagePreviewUrl) URL.revokeObjectURL(draftProduct.imagePreviewUrl);
    setDraftProduct((prev: any) => ({ ...prev, imageFile: null, imagePreviewUrl: '' }));
  };

  const handleUpdateDraft = (field: string, value: any) => {
    setDraftProduct((prev: any) => ({ ...prev, [field]: value }));
    if (field === 'code') {
      validateSkuDebounced(value as string);
    }
  };

  const handleAddToList = () => {
    if (!draftProduct.code.trim() || !draftProduct.name.trim() || !draftProduct.categoryId) {
      toast.error('Código, Nombre y Categoría son obligatorios');
      return;
    }
    if (draftProduct.isVariable) {
      if (draftProduct.linkedAttributes.length === 0) {
        toast.error('Selecciona al menos un atributo del catálogo');
        return;
      }
      const invalid = draftProduct.linkedAttributes.find((la: any) => la.selectedOptions.length === 0);
      if (invalid) {
        toast.error('Cada atributo debe tener al menos una opción seleccionada');
        return;
      }
    }
    if (draftProduct.itemType === 'PRODUCT' && !draftProduct.initialWarehouseId) {
      toast.error('Debes seleccionar un almacén para el producto');
      return;
    }
    if (draftProduct.isVariable && !draftProduct.initialWarehouseId) {
      toast.error('Debes seleccionar un almacén para el producto');
      return;
    }
    if (draftProduct.itemType === 'SERVICE' && !draftProduct.initialWarehouseId) {
      toast.error('Debes seleccionar el almacén del servicio');
      return;
    }

    setProductsList((prev) => [...prev, { ...draftProduct }]);
    
    // Reset draft
    setDraftProduct({
      ...defaultDraft,
      id: `draft-${Date.now()}`,
      categoryId: effectiveCategories[0]?.id || '',
    });
    setSkuError('');
  };

  const handleRemoveFromList = (id: string) => {
    setProductsList((prev) => prev.filter(p => p.id !== id));
  };

  const handleSave = async () => {
    const listToSave = [...productsList];
    
    if (productsList.length === 0) {
      if (!draftProduct.code.trim() || !draftProduct.name.trim() || !draftProduct.categoryId) {
        toast.error('Código, Nombre y Categoría son obligatorios');
        return;
      }
      if (skuError) {
        toast.error('Corrige el error en el código antes de guardar');
        return;
      }
      if (draftProduct.isVariable) {
        if (draftProduct.linkedAttributes.length === 0) {
          toast.error('Selecciona al menos un atributo del catálogo');
          return;
        }
        const invalidAttr = draftProduct.linkedAttributes.find((la: any) => la.selectedOptions.length === 0);
        if (invalidAttr) {
          toast.error('Cada atributo debe tener al menos una opción seleccionada');
          return;
        }
      }
      if (!draftProduct.isVariable && draftProduct.itemType === 'PRODUCT' && !draftProduct.initialWarehouseId) {
        toast.error('Debes seleccionar un almacén para el producto');
        return;
      }
      if (draftProduct.isVariable && !draftProduct.initialWarehouseId) {
        toast.error('Debes seleccionar un almacén para el producto');
        return;
      }
      if (draftProduct.itemType === 'SERVICE' && !draftProduct.initialWarehouseId) {
        toast.error('Debes seleccionar el almacén del servicio');
        return;
      }
      listToSave.push(draftProduct);
    }

    if (listToSave.length === 0) return;
    
    setIsSaving(true);
    let successCount = 0;

    try {
      for (const product of listToSave) {
        let uploadedImageUri: string | undefined;
        if (product.imageFile) {
          const uploaded = await storageService.uploadFile('product-image', product.imageFile, {
            folder: 'catalog',
          });
          uploadedImageUri = uploaded.uri;
        }

        const rate = product.priceCurrency !== baseCurrency ? 
                      (product.priceCurrency === 'USD' ? exchangeRate : (1 / exchangeRate)) 
                      : 1;
        const convertedCost = Number(product.costPrice || 0) * rate;

        const createdResponse = await inventoryService.createProduct({
          code: product.code,
          name: product.name,
          categoryId: product.categoryId,
          type: product.itemType || 'PRODUCT',
          warehouseId: product.initialWarehouseId || undefined,
          trackInventory: product.itemType === 'PRODUCT',
          trackSeries: Boolean(product.trackSerialNumbers),
          costPrice: convertedCost,
          salePrice: Number(product.salePrice || 0) * (product.priceCurrency === baseCurrency ? 1 : product.priceCurrency === 'USD' ? 1 / exchangeRate : exchangeRate),
          priceCurrency: product.priceCurrency || baseCurrency,
          trackSerialNumbers: Boolean(product.trackSerialNumbers),
          isActive: product.isActive !== false,
          description: product.description || '',
          itemType: product.itemType || 'PRODUCT',
          initialStock: 0,
          imageUrl: uploadedImageUri || undefined,
          isVariable: Boolean(product.isVariable),
          linkedAttributes: product.isVariable ? product.linkedAttributes : undefined,
        } as any);

        const created = (createdResponse as any)?.data || createdResponse;
        const createdId = created?.id;

        // Si tiene IMEI/Serie, crear la entrada en ProductSeries
        if (product.trackSerialNumbers && product.imeiNumber && product.imeiNumber.trim() && createdId) {
          try {
            await inventoryService.createSeries({
              productId: createdId,
              number: product.imeiNumber.trim(),
            });
          } catch (seriesErr) {
            console.error('Error creating serial number', seriesErr);
          }
        }

        successCount++;
      }
      toast.success(`${successCount} ${catalogItemType === 'SERVICE' ? 'servicio(s)' : 'producto(s)'} guardado(s) correctamente`);
      setProductsList([]);
      setDraftProduct({
        ...defaultDraft,
        id: `draft-${Date.now()}`,
        categoryId: effectiveCategories[0]?.id || '',
      });
      setSkuError('');
      onOpenChange(false);
      onRefresh();
    } catch {
            toast.error(`Hubo un error guardando. Solo se guardaron ${successCount} ${catalogItemType === 'SERVICE' ? 'servicios' : 'productos'}.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isSaving) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader data-tour="inventory-product-add-title">
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <Package className="size-5 text-primary" /> Agregar {catalogItemType === 'SERVICE' ? 'servicios' : 'productos'}
          </DialogTitle>
          <DialogDescription>
            Llena los campos para guardar un {catalogItemType === 'SERVICE' ? 'servicio' : 'producto'}, o agrega varios a la lista.
          </DialogDescription>
          <InventoryViewTutorial
            label={catalogItemType === 'SERVICE' ? 'Cómo crear servicio' : 'Cómo crear producto'}
            targetPrefix="inventory-product-add"
            stepKeys={['title', 'data', 'items', 'actions']}
            copy={{ data: { description: 'Completa código, nombre, categoría, moneda, costos, almacén y stock inicial.' }, items: { description: 'Revisa la lista de productos o servicios que agregarás en una sola operación.' }, actions: { description: 'Guarda uno o varios registros para incorporarlos al catálogo.' } }}
          />
        </DialogHeader>

        <div className="flex-1 overflow-auto flex flex-col gap-6 p-1" data-tour="inventory-product-add-data">
          
          {/* FORMULARIO SUPERIOR */}
          <div className="flex flex-col gap-4 rounded-xl border border-dashed bg-muted/30 p-4 sm:flex-row">
            <div>
              <ProductImagePicker
                src={draftProduct.imagePreviewUrl}
                productName={draftProduct.name}
                onSelect={handleImageSelected}
                onRemove={handleImageRemoved}
              />
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
              <div className="col-span-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Código *</label>
                <div className="flex flex-col gap-1 mt-1 w-full">
                  <Input 
                    value={draftProduct.code} 
                    onChange={e => handleUpdateDraft('code', e.target.value)} 
                    className={`h-8 text-xs font-mono w-full ${skuError ? 'border-red-500 focus-visible:ring-red-500' : ''}`} 
                    placeholder="SKU-001" 
                  />
                  {skuError && <span className="text-[9px] text-red-500 font-bold uppercase tracking-wider leading-tight">{skuError}</span>}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Nombre *</label>
                <Input 
                  value={draftProduct.name} 
                  onChange={e => handleUpdateDraft('name', e.target.value)} 
                  className="h-8 text-xs mt-1" 
                    placeholder={`Nombre del ${catalogItemType === 'SERVICE' ? 'servicio' : 'producto'}`}
                />
              </div>
              <div className="sm:col-span-2 md:col-span-5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Descripción <span className="normal-case font-medium">(opcional)</span></label>
                <Textarea
                  value={draftProduct.description}
                  onChange={e => handleUpdateDraft('description', e.target.value)}
                  className="mt-1 min-h-16 text-xs"
                  placeholder={`Descripción del ${catalogItemType === 'SERVICE' ? 'servicio' : 'producto'}`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Categoría *</label>
                {newCategoryOpen ? (
                  <div className="mt-1 space-y-1.5 rounded-lg border border-primary/40 bg-primary/5 p-2">
                    <Input
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      className="h-7 text-xs"
                      placeholder="Nombre de la categoría"
                      autoFocus
                    />
                    <Input
                      value={newCategoryDesc}
                      onChange={e => setNewCategoryDesc(e.target.value)}
                      className="h-7 text-xs"
                      placeholder="Descripción (opcional)"
                    />
                    <div className="flex gap-1.5">
                      <Button type="button" size="sm" className="h-6 flex-1 text-[9px] font-bold" onClick={handleCreateCategory} disabled={creatingCategory || !newCategoryName.trim()}>
                        {creatingCategory ? 'Creando...' : 'Crear'}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="h-6 text-[9px]" onClick={() => { setNewCategoryOpen(false); setNewCategoryName(''); setNewCategoryDesc(''); }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1.5 mt-1">
                    <Select value={draftProduct.categoryId} onValueChange={v => handleUpdateDraft('categoryId', v)}>
                      <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {allCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0 rounded-lg border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => setNewCategoryOpen(true)}
                      title="Crear nueva categoría"
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {!itemType && <div className="col-span-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Tipo</label>
                <Select value={draftProduct.itemType} onValueChange={v => handleUpdateDraft('itemType', v)}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRODUCT">Producto</SelectItem>
                    <SelectItem value="SERVICE">Servicio</SelectItem>
                  </SelectContent>
                </Select>
              </div>}

              {catalogItemType !== 'SERVICE' && <div className="col-span-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Variable</label>
                <Button
                  type="button"
                  variant={draftProduct.isVariable ? 'default' : 'outline'}
                  className={`h-8 w-full mt-1 text-[10px] uppercase tracking-wider gap-1.5 ${draftProduct.isVariable ? 'bg-primary text-primary-foreground' : ''}`}
                  onClick={() => {
                    handleUpdateDraft('isVariable', !draftProduct.isVariable);
                    if (!draftProduct.isVariable && draftProduct.attributes.length === 0) {
                      setDraftProduct((prev: any) => ({ ...prev, isVariable: true, attributes: [{ name: '', options: [] }] }));
                    }
                  }}
                >
                  <Tag className="size-3" />
                  {draftProduct.isVariable ? 'Sí' : 'No'}
                </Button>
              </div>}

              <div className="col-span-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Moneda</label>
                <Select value={draftProduct.priceCurrency} onValueChange={v => handleUpdateDraft('priceCurrency', v)}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NIO">NIO</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {catalogItemType === 'SERVICE' && <div className="col-span-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Precio</label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={draftProduct.salePrice}
                  onChange={e => handleUpdateDraft('salePrice', e.target.value)}
                  className="h-8 text-xs text-right mt-1 tabular-nums"
                  placeholder="0.00"
                />
              </div>}
              
              {catalogItemType !== 'SERVICE' && <div className="col-span-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Costo</label>
                <Input 
                  type="number" min={0}
                  value={draftProduct.costPrice} 
                  onChange={e => handleUpdateDraft('costPrice', e.target.value)} 
                  className="h-8 text-xs text-right mt-1 tabular-nums" 
                  placeholder="0.00" 
                />
              </div>}
              
              {catalogItemType !== 'SERVICE' && <div className="col-span-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Serie/IMEI</label>
                <Button
                  type="button"
                  variant={draftProduct.trackSerialNumbers ? 'default' : 'outline'}
                  className={`h-8 w-full mt-1 text-[10px] uppercase tracking-wider ${draftProduct.trackSerialNumbers ? 'bg-primary text-primary-foreground' : ''}`}
                  onClick={() => handleUpdateDraft('trackSerialNumbers', !draftProduct.trackSerialNumbers)}
                >
                  {draftProduct.trackSerialNumbers ? 'Sí' : 'No'}
                </Button>
              </div>}

              {catalogItemType !== 'SERVICE' && draftProduct.trackSerialNumbers && (
                <div className="col-span-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">IMEI / Serie *</label>
                  <Input
                    value={draftProduct.imeiNumber}
                    onChange={e => handleUpdateDraft('imeiNumber', e.target.value)}
                    className="h-8 text-xs font-mono mt-1"
                    placeholder="Número de serie o IMEI"
                  />
                </div>
              )}

              {draftProduct.itemType === 'PRODUCT' ? (
                !draftProduct.isVariable ? (
                <>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Almacén (Stock Inicial)</label>
                    <Select value={draftProduct.initialWarehouseId} onValueChange={v => handleUpdateDraft('initialWarehouseId', v)}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Bodega para ingreso" /></SelectTrigger>
                      <SelectContent>
                        {effectiveWarehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Stock Inicial</label>
                    <Input 
                      type="number"
                      value={0}
                      disabled
                      className="h-8 text-xs text-right mt-1 tabular-nums bg-muted/50 text-muted-foreground cursor-not-allowed" 
                      title="El stock inicia en 0. Se gestiona desde Inventario."
                    />
                  </div>
                </>
                ) : (
                <>
                  <div className="sm:col-span-2 md:col-span-3">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Almacén *</label>
                    <Select value={draftProduct.initialWarehouseId} onValueChange={v => handleUpdateDraft('initialWarehouseId', v)}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Bodega del producto" /></SelectTrigger>
                      <SelectContent>
                        {effectiveWarehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1 sm:col-span-2 md:col-span-2 flex items-end">
                    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 w-full h-8 flex items-center">
                      <p className="text-[10px] text-muted-foreground"><span className="font-bold text-primary">Stock:</span> Se configura después por variante.</p>
                    </div>
                  </div>
                </>
                )
              ) : (
                <>
                  <div className="sm:col-span-2 md:col-span-3">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Almacén vinculado *</label>
                    <Select value={draftProduct.initialWarehouseId} onValueChange={v => handleUpdateDraft('initialWarehouseId', v)}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Seleccionar almacén" /></SelectTrigger>
                      <SelectContent>
                        {effectiveWarehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Disponibilidad</label>
                    <Select value={draftProduct.isActive === false ? 'unavailable' : 'available'} onValueChange={v => handleUpdateDraft('isActive', v === 'available')}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Disponible</SelectItem>
                        <SelectItem value="unavailable">No disponible</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              
              <div className={`sm:col-span-2 md:col-span-5 flex justify-end ${draftProduct.itemType === 'SERVICE' ? 'mt-0' : 'mt-0'}`}>
                <Button onClick={handleAddToList} className="h-8 text-xs font-bold" variant="secondary" disabled={!!skuError}>
                  <Plus className="size-3 mr-2" />
                  Agregar a la lista
                </Button>
              </div>

            </div>
          </div>

          {/* SECCIÓN DE ATRIBUTOS (solo productos variables) */}
          {draftProduct.isVariable && (
            <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="size-4 text-primary" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-primary">Atributos del producto</h4>
                </div>
                {getSelectedAttributes().length > 0 && (
                  <Badge variant="outline" className="text-[9px] font-mono">
                    {combinationCount(getSelectedAttributes())} variante{combinationCount(getSelectedAttributes()) !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>

              <p className="text-[10px] text-muted-foreground">
                Selecciona los atributos y sus opciones específicas para este producto.
              </p>

              {catalogAttributes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 bg-background/50 p-4 text-center">
                  <p className="text-xs text-muted-foreground">No hay atributos creados.</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Crea atributos desde <span className="font-bold text-primary">Inventario → Atributos</span> primero.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {catalogAttributes.map((attr: any) => {
                    const linked = draftProduct.linkedAttributes.find((la: any) => la.attributeId === attr.id);
                    const isSelected = !!linked;
                    return (
                      <div
                        key={attr.id}
                        className={`rounded-lg border p-3 transition-colors ${
                          isSelected
                            ? 'border-primary/40 bg-primary/10'
                            : 'border-border/60 bg-background/80 hover:border-primary/20 cursor-pointer'
                        }`}
                        onClick={() => !isSelected && toggleAttribute(attr.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`size-4 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`}>
                              {isSelected && <Check className="size-2.5 text-primary-foreground" />}
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider">{attr.name}</span>
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[9px]">
                                {linked.selectedOptions.length} de {attr.options?.length || 0}
                              </Badge>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-5 text-red-500 hover:text-white hover:bg-red-500"
                                onClick={(e) => { e.stopPropagation(); toggleAttribute(attr.id); }}
                              >
                                <X className="size-3" />
                              </Button>
                            </div>
                          )}
                          {!isSelected && (
                            <Badge variant="secondary" className="text-[9px]">
                              {attr.options?.length || 0} opciones
                            </Badge>
                          )}
                        </div>
                        {isSelected && attr.options && attr.options.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5 ml-6" onClick={(e) => e.stopPropagation()}>
                            {attr.options.map((opt: string, i: number) => {
                              const isOptSelected = linked.selectedOptions.includes(opt);
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => toggleAttributeOption(attr.id, opt)}
                                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition-colors ${
                                    isOptSelected
                                      ? 'border-primary/40 bg-primary text-primary-foreground'
                                      : 'border-border/60 bg-background text-muted-foreground hover:border-primary/30'
                                  }`}
                                >
                                  {isOptSelected && <Check className="size-2.5" />}
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TABLA INFERIOR */}
          {productsList.length > 0 && (
            <div className="sales-responsive-table border rounded-md bg-card flex-1 overflow-auto min-h-[200px]" data-tour="inventory-product-add-items">
               <Table>
                 <TableHeader className="bg-muted sticky top-0 z-10 shadow-sm">
                 <TableRow>
                   <TableHead className="text-[10px] uppercase w-8"></TableHead>
                   <TableHead className="text-[10px] uppercase">Código</TableHead>
                   <TableHead className="text-[10px] uppercase">Nombre</TableHead>
                   <TableHead className="text-[10px] uppercase">Categoría</TableHead>
                   <TableHead className="text-[10px] uppercase text-right">Stock Inicial</TableHead>
                   <TableHead className="w-10"></TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {productsList.map((product) => (
                     <TableRow key={product.id}>
                       <TableCell className="p-2">
                         {product.imagePreviewUrl ? (
                           <img src={product.imagePreviewUrl} className="w-6 h-6 object-cover rounded-sm" alt="Preview" />
                         ) : (
                           <Package className="size-4 text-muted-foreground" />
                         )}
                       </TableCell>
                       <TableCell className="text-xs font-mono p-2">{product.code}</TableCell>
                        <TableCell className="text-xs p-2">
                          {product.name}
                          {product.trackSerialNumbers && <Badge variant="outline" className="ml-2 text-[8px] px-1 py-0 h-4">IMEI</Badge>}
                          {product.isVariable && <Badge variant="outline" className="ml-2 text-[8px] px-1 py-0 h-4 border-primary/40 text-primary"><Tag className="size-2.5 mr-0.5" />Variable</Badge>}
                        </TableCell>
                       <TableCell className="text-xs p-2">
                          {allCategories.find(c => c.id === product.categoryId)?.name}
                       </TableCell>
                        <TableCell className="text-xs text-right p-2 tabular-nums">
                          {product.itemType === 'SERVICE' ? '-' : product.isVariable ? `${(() => {
                            const attrs = catalogAttributes.filter((a: any) => product.linkedAttributes?.some((la: any) => la.attributeId === a.id));
                            return attrs.length > 0 ? attrs.reduce((acc: number, attr: any) => {
                              const linked = product.linkedAttributes?.find((la: any) => la.attributeId === attr.id);
                              return acc * Math.max(1, linked?.selectedOptions?.length || attr.options?.length || 0);
                            }, 1) : 0;
                          })()} vars` : '0'}
                        </TableCell>
                       <TableCell className="text-right p-2">
                         <Button 
                           variant="ghost" 
                           size="icon" 
                           className="size-6 text-red-500 hover:text-white hover:bg-red-500"
                           onClick={() => handleRemoveFromList(product.id)}
                         >
                           <Trash2 className="size-3" />
                         </Button>
                       </TableCell>
                     </TableRow>
                   ))}
               </TableBody>
             </Table>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2 pt-4 border-t" data-tour="inventory-product-add-actions">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || (productsList.length === 0 && (!!skuError || !draftProduct.code.trim() || !draftProduct.name.trim()))}
            className="font-bold bg-primary text-primary-foreground"
          >
            {isSaving ? 'Guardando...' : (productsList.length > 0 ? `Guardar ${productsList.length} ${catalogItemType === 'SERVICE' ? 'servicio(s)' : 'producto(s)'}` : `Guardar ${catalogItemType === 'SERVICE' ? 'servicio' : 'producto'}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
