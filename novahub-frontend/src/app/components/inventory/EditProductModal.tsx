import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ProductImagePicker } from '../ui/ProductImage';
import { inventoryService } from '../../services/inventario.service';
import { storageService } from '../../services/storage.service';
import { toast } from 'sonner';
import { Package, Check } from 'lucide-react';
import { useCurrency } from '@/app/contexts/CurrencyContext';

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
  const [draft, setDraft] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
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
          categoryId: product.categoryId || '',
          priceCurrency: baseCurrency || 'NIO',
          salePrice: Number(product.salePrice) || 0,
          costPrice: Number(product.costPrice) || 0,
          trackSerialNumbers: Boolean(
            product.trackSerialNumbers ||
            product.serialTracking ||
            product.serialNumberTracking ||
            String(product.trackingType || '').toUpperCase() === 'SERIAL',
          ),
          itemType: (product.itemType || 'PRODUCT').toUpperCase(),
          minStock: Number(product.minStock) || 0,
          maxStock: Number(product.maxStock) || 0,
          unit: product.unit || 'unidad',
          initialAllocations,
          imageUrl: product.imageUrl,
          imageStorageUri: product.imageUrlStorageUri || (String(product.imageUrl || '').startsWith('storage://') ? product.imageUrl : undefined),
          imageFile: null,
          imagePreviewUrl: '',
          removeImage: false
        });
      } else {
        setDraft(null);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [product, baseCurrency]);

  if (!draft) return null;

  const handleUpdate = (field: string, value: any) => {
    setDraft((prev: any) => ({ ...prev, [field]: value }));
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
        categoryId: draft.categoryId,
        costPrice: Number(draft.costPrice || 0) * rate,
        trackSerialNumbers: Boolean(draft.trackSerialNumbers),
        itemType: draft.itemType || 'PRODUCT',
        unit: draft.unit,
        minStock: draft.minStock,
        maxStock: draft.maxStock,
        warehouseId: draft.itemType === 'SERVICE' ? draft.initialAllocations?.[0]?.warehouseId : undefined,
        warehouseIds: draft.itemType !== 'SERVICE' ? draft.initialAllocations?.map((a: any) => a.warehouseId).filter(Boolean) : undefined,
        imageUrl: nextImageUrl,
      });

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
    <Dialog open={!!product} onOpenChange={(v) => { if (!isSaving && !v) onClose(); }}>      <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[calc(100dvh-1rem)] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <Package className="size-5 text-primary" /> Editar Producto
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 py-4">
          <div className="md:col-span-1 flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2">
              <ProductImagePicker
                src={draft.imagePreviewUrl || draft.imageUrl}
                productName={draft.name}
                onSelect={handleImageSelected}
                onRemove={handleImageRemoved}
              />
              <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest text-center mt-2">Imagen</p>
            </div>
            
            {!isService && (
              <Button
                type="button"
                variant={draft.trackSerialNumbers ? 'default' : 'outline'}
                className={`h-auto min-h-9 py-2 w-full text-[10px] uppercase tracking-wider font-bold whitespace-normal text-center ${draft.trackSerialNumbers ? 'bg-primary text-primary-foreground shadow-sm' : ''}`}
                onClick={() => handleUpdate('trackSerialNumbers', !draft.trackSerialNumbers)}
                disabled={!isService || isSaving}
              >
                Seguimiento Serie/IMEI:<br/>{draft.trackSerialNumbers ? 'Activado' : 'Desactivado'}
              </Button>
            )}
          </div>
          
          <div className="md:col-span-3 grid grid-cols-2 gap-4">
            <div className="col-span-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Código *</label>
              <Input 
                value={draft.code} 
                onChange={e => handleUpdate('code', e.target.value)} 
                className="h-9 text-xs font-mono mt-1" 
                placeholder="SKU-001" 
              />
            </div>

            <div className="col-span-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Categoría</label>
              <Select value={draft.categoryId} onValueChange={v => handleUpdate('categoryId', v)} disabled={!isService || isSaving}>
                <SelectTrigger className="h-9 text-xs mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Nombre *</label>
              <Input 
                value={draft.name} 
                onChange={e => handleUpdate('name', e.target.value)} 
                className="h-9 text-xs mt-1" 
                placeholder="Nombre del producto" 
              />
            </div>

            {!isService && (
              <div className="col-span-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">U. Medida</label>
                <Select value={draft.unit || 'unidad'} onValueChange={v => handleUpdate('unit', v)} disabled={!isService || isSaving}>
                  <SelectTrigger className="h-9 text-xs mt-1"><SelectValue placeholder="Unidad" /></SelectTrigger>
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

            <div className="col-span-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Moneda</label>
              <Select value={draft.priceCurrency} onValueChange={handleCurrencyChange} disabled={!isService || isSaving}>
                <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NIO">NIO</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!isService && <div className="col-span-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Costo</label>
              <Input 
                type="number" min={0} step="any"
                value={draft.costPrice} 
                onChange={e => handleUpdate('costPrice', e.target.value)} 
                className="h-9 text-xs text-right mt-1 tabular-nums" readOnly
              />
            </div>}
            
            {(!isService && draft.initialAllocations?.[0]) && (
              <>
                <div className="col-span-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Almacén Principal</label>
                  <Select value={draft.initialAllocations[0].warehouseId || ''} onValueChange={v => updateAllocation(draft.initialAllocations[0].id, { warehouseId: v })} disabled>
                    <SelectTrigger className="h-9 text-xs mt-1"><SelectValue placeholder="Almacén..." /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Stock Actual</label>
                  <Input type="number" disabled min={0} value={draft.initialAllocations[0].quantity} onChange={e => updateAllocation(draft.initialAllocations[0].id, { quantity: Math.max(0, parseInt(e.target.value) || 0) })} className="h-9 text-xs text-right mt-1" placeholder="Stock" />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Stock Mínimo</label>
                  <Input type="number" disabled min={0} value={draft.initialAllocations[0].minStock} onChange={e => updateAllocation(draft.initialAllocations[0].id, { minStock: Math.max(0, parseInt(e.target.value) || 0) })} className="h-9 text-xs text-right mt-1" placeholder="Min" />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Stock Máximo</label>
                  <Input type="number" disabled min={0} value={draft.initialAllocations[0].maxStock} onChange={e => updateAllocation(draft.initialAllocations[0].id, { maxStock: Math.max(0, parseInt(e.target.value) || 0) })} className="h-9 text-xs text-right mt-1" placeholder="Max" />
                </div>
              </>
            )}

            {isService && (
              <div className="col-span-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Almacén Vinculado *</label>
                <Select value={draft.initialAllocations?.[0]?.warehouseId || ''} onValueChange={v => updateAllocation(draft.initialAllocations?.[0]?.id, { warehouseId: v })}>
                  <SelectTrigger className="h-9 text-xs mt-1"><SelectValue placeholder="Seleccionar almacén..." /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-2 pt-4 border-t">
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
      </DialogContent>
    </Dialog>
  );
}
