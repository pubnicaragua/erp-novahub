import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { ProductImagePicker } from '../ui/ProductImage';
import { inventoryService } from '../../services/inventario.service';
import { storageService } from '../../services/storage.service';
import { toast } from 'sonner';
import { Package, Check, Tag, X } from 'lucide-react';
import { useCurrency } from '@/app/contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { InventoryViewTutorial } from './InventoryViewTutorial';

interface EditProductModalProps {
  product: any | null;
  categories: any[];
  warehouses?: any[];
  itemType?: 'PRODUCT' | 'SERVICE';
  onClose: () => void;
  onRefresh: () => void;
}

export function EditProductModal({ product, categories, warehouses = [], itemType = 'PRODUCT', onClose, onRefresh }: EditProductModalProps) {
  const { exchangeRate, baseCurrency } = useCurrency();
  const { canPerform } = useAuth();
  const canViewInventoryCost = canPerform('INVENTORY_PRODUCTS', 'viewCost');
  const [draft, setDraft] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [catalogAttributes, setCatalogAttributes] = useState<any[]>([]);
  const isService = itemType === 'SERVICE' || String(product?.itemType || product?.type || '').toUpperCase() === 'SERVICE';

  useEffect(() => {
    const timer = setTimeout(() => {
      if (product) {
        const stockLevels = Array.isArray(product.stockLevels) ? product.stockLevels : [];
        const warehouseCatalogs = Array.isArray(product.warehouseCatalogs) ? product.warehouseCatalogs : [];
        const allocationIds = Array.from(new Set([
          ...stockLevels.map((level: any) => level.warehouseId).filter(Boolean),
          ...warehouseCatalogs.map((catalog: any) => catalog.warehouseId).filter(Boolean),
        ]));
        const initialAllocations = allocationIds.length > 0
          ? allocationIds.map((warehouseId: string, i: number) => {
              const sl = stockLevels.find((level: any) => level.warehouseId === warehouseId);
              return {
                id: `alloc-edit-${Date.now()}-${i}`,
                warehouseId,
                quantity: Number(sl?.quantity || 0),
                minStock: Number(sl?.minStock ?? product.minStock ?? 0),
                maxStock: Number(sl?.maxStock ?? product.maxStock ?? 0),
                originalQuantity: Number(sl?.quantity || 0),
                originalMinStock: Number(sl?.minStock ?? product.minStock ?? 0),
                originalMaxStock: Number(sl?.maxStock ?? product.maxStock ?? 0),
              };
            })
          : [{
              id: `alloc-edit-${Date.now()}-0`,
              warehouseId: '',
              quantity: Number(product.stock || 0),
              minStock: Number(product.minStock || 0),
              maxStock: Number(product.maxStock || 0),
              originalQuantity: Number(product.stock || 0),
              originalMinStock: Number(product.minStock || 0),
              originalMaxStock: Number(product.maxStock || 0),
            }];
        setDraft({
          id: product.id,
          code: product.code,
          name: product.name,
          description: product.description || '',
          commercialNote: product.commercialNote || '',
          categoryId: product.categoryId || '',
          priceCurrency: baseCurrency || 'NIO',
          salePrice: Number(product.salePrice) || 0,
        ...(canViewInventoryCost ? { costPrice: Number(product.costPrice) || 0 } : {}),
          trackSerialNumbers: Boolean(
            product.trackSerialNumbers ||
            product.serialTracking ||
            product.serialNumberTracking ||
            String(product.trackingType || '').toUpperCase() === 'SERIAL',
          ),
          imeiNumber: product.serialNumber || product.imei || '',
          itemType: (product.itemType || 'PRODUCT').toUpperCase(),
          isActive: product.isActive !== false,
          minStock: Number(product.minStock) || 0,
          maxStock: Number(product.maxStock) || 0,
          unit: product.unit || 'unidad',
          initialAllocations,
          imageUrl: product.imageUrl,
          imageStorageUri: product.imageUrlStorageUri || (String(product.imageUrl || '').startsWith('storage://') ? product.imageUrl : undefined),
          imageFile: null,
          imagePreviewUrl: '',
          removeImage: false,
          attributeIds: Array.isArray(product.attributeIds) ? product.attributeIds : [],
          linkedAttributes: (() => {
            if (Array.isArray(product.linkedAttributes) && product.linkedAttributes.length > 0) return product.linkedAttributes;
            if (Array.isArray(product.attributes) && product.attributes.length > 0) return product.attributes;
            if (Array.isArray(product.attributeIds) && product.attributeIds.length > 0) {
              return product.attributeIds.map((id: string) => ({ attributeId: id, selectedOptions: [] }));
            }
            return [];
          })(),
        });
      } else {
        setDraft(null);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [product, baseCurrency, canViewInventoryCost]);

  useEffect(() => {
    if (!product) return;
    const controller = new AbortController();
    inventoryService.getAttributes(controller.signal)
      .then((res) => {
        const data = (res as any)?.data || res || [];
        const attrs = Array.isArray(data) ? data : [];
        setCatalogAttributes(attrs);
        // Enriquecer linkedAttributes con nombres del catálogo
        setDraft((prev: any) => {
          if (!prev || !prev.linkedAttributes || prev.linkedAttributes.length === 0) return prev;
          return {
            ...prev,
            linkedAttributes: prev.linkedAttributes.map((la: any) => {
              if (la.name) return la;
              const attr = attrs.find((a: any) => a.id === la.attributeId);
              return { ...la, name: attr?.name || la.attributeId };
            }),
          };
        });
      })
      .catch(() => setCatalogAttributes([]));
    return () => controller.abort();
  }, [product]);

  if (!draft) return null;

  const handleUpdate = (field: string, value: any) => {
    setDraft((prev: any) => ({ ...prev, [field]: value }));
  };

  const toggleAttribute = (attrId: string) => {
    setDraft((prev: any) => {
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
    setDraft((prev: any) => ({
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

  const getSelectedAttributes = () => {
    return catalogAttributes.filter((a: any) =>
      draft.linkedAttributes.some((la: any) => la.attributeId === a.id)
    );
  };

  const combinationCount = (attrs: any[]) => {
    if (attrs.length === 0) return 0;
    return attrs.reduce((acc: number, attr: any) => {
      const linked = draft.linkedAttributes.find((la: any) => la.attributeId === attr.id);
      const selectedCount = linked?.selectedOptions?.length || attr.options?.length || 0;
      return acc * Math.max(1, selectedCount);
    }, 1);
  };

  const updateAllocation = (id: string, updates: any) => {
    setDraft((prev: any) => ({
      ...prev,
      initialAllocations: prev.initialAllocations.map((a: any) => a.id === id ? { ...a, ...updates } : a)
    }));
  };

  const handleCurrencyChange = (newCurrency: string) => {
    if (!draft || newCurrency === draft.priceCurrency) return;
    
    let rate = 1;
    // Si cambia a USD desde base, se divide entre la tasa. Si cambia a base desde USD, se multiplica.
    if (newCurrency === 'USD' && draft.priceCurrency === baseCurrency) rate = 1 / exchangeRate;
    if (newCurrency === baseCurrency && draft.priceCurrency === 'USD') rate = exchangeRate;

    setDraft((prev: any) => ({
      ...prev,
      priceCurrency: newCurrency,
      costPrice: prev.costPrice ? Number((Number(prev.costPrice) * rate).toFixed(4)) : prev.costPrice,
      salePrice: prev.salePrice ? Number((Number(prev.salePrice) * rate).toFixed(4)) : prev.salePrice,
    }));
  };

  const handleImageSelected = (file: File) => {
    if (draft.imagePreviewUrl) URL.revokeObjectURL(draft.imagePreviewUrl);
    setDraft((prev: any) => ({ ...prev, imageFile: file, imagePreviewUrl: URL.createObjectURL(file), removeImage: false }));
  };

  const handleImageRemoved = () => {
    if (draft.imagePreviewUrl) URL.revokeObjectURL(draft.imagePreviewUrl);
    setDraft((prev: any) => ({ ...prev, imageFile: null, imagePreviewUrl: '', imageUrl: null, removeImage: true }));
  };

  const handleSave = async () => {
    if (!draft.name || !draft.code) {
      toast.error('Nombre y código son requeridos');
      return;
    }

    setIsSaving(true);
    let uploadedImageUri: string | undefined;
    try {
      if (draft.imageFile) {
        const uploaded = await storageService.uploadFile('product-image', draft.imageFile, {
          folder: draft.id,
        });
        uploadedImageUri = uploaded.uri;
      }
      const nextImageUrl = uploadedImageUri ?? (draft.removeImage ? null : draft.imageStorageUri);

      const rate = draft.priceCurrency !== baseCurrency ? 
                    (draft.priceCurrency === 'USD' ? exchangeRate : (1 / exchangeRate)) 
                    : 1;

      await inventoryService.updateProduct(draft.id, {
        code: draft.code,
        name: draft.name,
        description: draft.description || '',
        commercialNote: draft.commercialNote || '',
        categoryId: draft.categoryId,
         ...(canViewInventoryCost ? { costPrice: Number(draft.costPrice || 0) * rate } : {}),
        trackSerialNumbers: Boolean(draft.trackSerialNumbers),
        itemType: draft.itemType || 'PRODUCT',
        isActive: draft.isActive !== false,
        unit: draft.unit,
        minStock: draft.minStock,
        maxStock: draft.maxStock,
        warehouseId: draft.itemType === 'SERVICE' ? draft.initialAllocations?.[0]?.warehouseId : undefined,
        warehouseIds: draft.itemType !== 'SERVICE' ? draft.initialAllocations?.map((a: any) => a.warehouseId).filter(Boolean) : undefined,
        imageUrl: nextImageUrl,
        attributeIds: draft.attributeIds?.length > 0 ? draft.attributeIds : [],
        linkedAttributes: draft.linkedAttributes?.length > 0 ? draft.linkedAttributes : [],
      });

      // Manejar IMEI/Serie si está habilitado
      if (draft.trackSerialNumbers && draft.imeiNumber && draft.imeiNumber.trim()) {
        try {
          // Verificar si ya existe una serie para este producto
          const existingSeries = await inventoryService.getSeries({ productId: draft.id } as any);
          const seriesList = Array.isArray(existingSeries) ? existingSeries : ((existingSeries as any)?.data || []);
          if (seriesList.length === 0) {
            // Crear nueva serie
            await inventoryService.createSeries({
              productId: draft.id,
              number: draft.imeiNumber.trim(),
            });
          }
        } catch (seriesErr) {
          console.error('Error managing serial number', seriesErr);
        }
      }

      const variantId = product?.variants?.[0]?.id;
      if (draft.itemType !== 'SERVICE' && variantId && draft.initialAllocations) {
        const allocations = draft.initialAllocations.filter((item: any) => item.warehouseId);
        await Promise.all(
          allocations.map(async (item: any) => {
            const oldQuantity = Number(item.originalQuantity || 0);
            const newQuantity = Number(item.quantity || 0);
            const oldMinStock = Number(item.originalMinStock || 0);
            const oldMaxStock = Number(item.originalMaxStock || 0);
            const newMinStock = Number(item.minStock ?? draft.minStock ?? 0);
            const newMaxStock = Number(item.maxStock ?? draft.maxStock ?? 0);

            if (oldQuantity !== newQuantity || oldMinStock !== newMinStock || oldMaxStock !== newMaxStock) {
              await inventoryService.updateStockLevel({
                productId: draft.id,
                warehouseId: item.warehouseId,
                variantId: variantId,
                quantity: newQuantity,
                minStock: newMinStock,
                maxStock: newMaxStock || undefined,
              });
              const diff = newQuantity - oldQuantity;
              if (diff !== 0) {
                await inventoryService.createMovement({
                  productId: draft.id,
                  warehouseId: item.warehouseId,
                  variantId: variantId,
                  type: diff > 0 ? 'IN' : 'OUT',
                  quantity: Math.abs(diff),
                  reference: 'Ajuste desde edición de producto',
                });
              }
            }
          })
        );
      }

      if (draft.imageStorageUri && draft.imageStorageUri !== uploadedImageUri && (uploadedImageUri || draft.removeImage)) {
        storageService.deleteFile(draft.imageStorageUri).catch(() => {});
      }

      toast.success(`${isService ? 'Servicio' : 'Producto'} actualizado`);
      onRefresh();
      onClose();
    } catch (e: any) {
      if (uploadedImageUri) storageService.deleteFile(uploadedImageUri).catch(() => {});
      toast.error(e.message || 'Error al actualizar');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={!!product} onOpenChange={(v) => { if (!isSaving && !v) onClose(); }}>
      <DialogContent className="w-[calc(100vw-2rem)] !max-w-[min(92vw,780px)] max-h-[min(88vh,calc(100dvh-3rem))] flex flex-col overflow-hidden">
        <DialogHeader data-tour="inventory-product-edit-title">
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <Package className="size-5 text-primary" /> Editar {isService ? 'Servicio' : 'Producto'}
          </DialogTitle>
          <InventoryViewTutorial
            label={isService ? 'Cómo editar servicio' : 'Cómo editar producto'}
            targetPrefix="inventory-product-edit"
            copy={{ data: { description: 'Actualiza código, nombre, categoría, moneda, costos, almacén y controles de stock.' }, actions: { description: 'Guarda los cambios para actualizar el catálogo.' } }}
          />
        </DialogHeader>

        <div className="flex-1 overflow-auto flex flex-col gap-6 p-1" data-tour="inventory-product-edit-data">

          {/* FORMULARIO SUPERIOR */}
          <div className="flex flex-col gap-4 rounded-xl border border-dashed bg-muted/30 p-4 sm:flex-row">
            <div>
              <ProductImagePicker
                src={draft.imagePreviewUrl || draft.imageUrl}
                productName={draft.name}
                onSelect={handleImageSelected}
                onRemove={handleImageRemoved}
              />
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
              <div className="col-span-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Código *</label>
                <Input
                  value={draft.code}
                  onChange={e => handleUpdate('code', e.target.value)}
                  className="h-8 text-xs font-mono mt-1"
                  placeholder="SKU-001"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Nombre *</label>
                <Input
                  value={draft.name}
                  onChange={e => handleUpdate('name', e.target.value)}
                  className="h-8 text-xs mt-1"
                  placeholder="Nombre del producto"
                />
              </div>

              <div className="sm:col-span-2 md:col-span-5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Descripción</label>
                <Input
                  value={draft.description || ''}
                  onChange={e => handleUpdate('description', e.target.value)}
                  className="h-8 text-xs mt-1"
                  placeholder="Descripción del producto"
                />
                <div className="mt-2">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Nota comercial</label>
                  <Input
                    value={draft.commercialNote || ''}
                    onChange={e => handleUpdate('commercialNote', Array.from(e.target.value).slice(0, 100).join(''))}
                    maxLength={100}
                    className="h-8 text-xs mt-1"
                    placeholder="Nota visible en ventas, compras y facturas"
                  />
                  <p className="mt-1 text-right text-[10px] text-muted-foreground">{Array.from(String(draft.commercialNote || '')).length}/100</p>
                </div>
              </div>

              <div className="sm:col-span-2 md:col-span-5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Categoría</label>
                <Select value={draft.categoryId} onValueChange={v => handleUpdate('categoryId', v)} disabled={isSaving}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Moneda</label>
                <Select value={draft.priceCurrency} onValueChange={handleCurrencyChange} disabled={isSaving}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NIO">NIO</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

               {!isService && canViewInventoryCost && <div className="col-span-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Costo</label>
                <Input
                  type="number" min={0} step="any"
                  value={draft.costPrice}
                  onChange={e => handleUpdate('costPrice', e.target.value)}
                  className="h-8 text-xs text-right mt-1 tabular-nums"
                  readOnly
                />
              </div>}

              {!isService && (
                <div className="col-span-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">U. Medida</label>
                  <Select value={draft.unit || 'unidad'} onValueChange={v => handleUpdate('unit', v)} disabled={isSaving}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Unidad" /></SelectTrigger>
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
                </div>
              )}

              {!isService && <div className="col-span-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Serie/IMEI</label>
                <Button
                  type="button"
                  variant={draft.trackSerialNumbers ? 'default' : 'outline'}
                  className={`h-8 w-full mt-1 text-[10px] uppercase tracking-wider ${draft.trackSerialNumbers ? 'bg-primary text-primary-foreground' : ''}`}
                  onClick={() => handleUpdate('trackSerialNumbers', !draft.trackSerialNumbers)}
                  disabled={isSaving}
                >
                  {draft.trackSerialNumbers ? 'Sí' : 'No'}
                </Button>
              </div>}

              {!isService && draft.trackSerialNumbers && (
                <div className="col-span-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">IMEI / Serie *</label>
                  <Input
                    value={draft.imeiNumber}
                    onChange={e => handleUpdate('imeiNumber', e.target.value)}
                    className="h-8 text-xs font-mono mt-1"
                    placeholder="Número de serie o IMEI"
                  />
                </div>
              )}

              {!isService && (
                <div className="sm:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Almacén</label>
                  <Select value={draft.initialAllocations?.[0]?.warehouseId || ''} onValueChange={v => updateAllocation(draft.initialAllocations?.[0]?.id, { warehouseId: v })} disabled>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Almacén..." /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!isService && draft.initialAllocations?.[0] && (
                <>
                  <div className="col-span-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Stock Actual</label>
                    <Input type="number" disabled min={0} value={draft.initialAllocations[0].quantity} onChange={e => updateAllocation(draft.initialAllocations[0].id, { quantity: Math.max(0, parseInt(e.target.value) || 0) })} className="h-8 text-xs text-right mt-1" placeholder="Stock" />
                  </div>
                  <div className="col-span-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Stock Mínimo</label>
                    <Input type="number" min={0} value={draft.initialAllocations[0].minStock} onChange={e => updateAllocation(draft.initialAllocations[0].id, { minStock: Math.max(0, parseInt(e.target.value) || 0) })} className="h-8 text-xs text-right mt-1" placeholder="Min" />
                  </div>
                  <div className="col-span-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Stock Máximo</label>
                    <Input type="number" min={0} value={draft.initialAllocations[0].maxStock} onChange={e => updateAllocation(draft.initialAllocations[0].id, { maxStock: Math.max(0, parseInt(e.target.value) || 0) })} className="h-8 text-xs text-right mt-1" placeholder="Max" />
                  </div>
                </>
              )}

              {isService && (
                <div className="sm:col-span-2 md:col-span-3">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Almacén Vinculado *</label>
                  <Select value={draft.initialAllocations?.[0]?.warehouseId || ''} onValueChange={v => updateAllocation(draft.initialAllocations?.[0]?.id, { warehouseId: v })}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Seleccionar almacén..." /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isService && (
                <div className="col-span-1 sm:col-span-2 md:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Disponibilidad</label>
                  <Select value={draft.isActive === false ? 'unavailable' : 'available'} onValueChange={v => handleUpdate('isActive', v === 'available')}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Disponible</SelectItem>
                      <SelectItem value="unavailable">No disponible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

        {/* Selector de atributos del catálogo */}
        {!isService && (
          <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 space-y-3">
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

            {catalogAttributes.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">Selecciona los atributos y sus opciones específicas para este producto.</p>
            ) : (
              <div className="space-y-2">
                {catalogAttributes.map((attr: any) => {
                  const linked = draft.linkedAttributes.find((la: any) => la.attributeId === attr.id);
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

        <DialogFooter className="mt-2 pt-4 border-t" data-tour="inventory-product-edit-actions">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="font-bold bg-primary text-primary-foreground gap-2"
          >
            {isSaving ? (
              <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Guardar Cambios
          </Button>
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
