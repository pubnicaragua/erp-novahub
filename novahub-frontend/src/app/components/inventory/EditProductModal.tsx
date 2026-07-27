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
  onClose: () => void;
  onRefresh: () => void;
}

export function EditProductModal({ product, categories, onClose, onRefresh }: EditProductModalProps) {
  const { exchangeRate, baseCurrency } = useCurrency();
  const [draft, setDraft] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (product) {
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
        imageUrl: product.imageUrl,
        imageStorageUri: product.imageUrlStorageUri || (String(product.imageUrl || '').startsWith('storage://') ? product.imageUrl : undefined),
        imageFile: null,
        imagePreviewUrl: '',
        removeImage: false
      });
    } else {
      setDraft(null);
    }
  }, [product]);

  if (!draft) return null;

  const handleUpdate = (field: string, value: any) => {
    setDraft((prev: any) => ({ ...prev, [field]: value }));
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
        salePrice: Number(draft.salePrice || 0) * rate,
        costPrice: Number(draft.costPrice || 0) * rate,
        trackSerialNumbers: Boolean(draft.trackSerialNumbers),
        itemType: draft.itemType || 'PRODUCT',
        imageUrl: nextImageUrl,
      });

      if (draft.imageStorageUri && draft.imageStorageUri !== uploadedImageUri && (uploadedImageUri || draft.removeImage)) {
        storageService.deleteFile(draft.imageStorageUri).catch(() => {});
      }

      toast.success('Producto actualizado');
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <Package className="size-5 text-primary" /> Editar Producto
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 py-4">
          <div className="md:col-span-1 flex flex-col items-center gap-2">
            <ProductImagePicker
              src={draft.imagePreviewUrl || draft.imageUrl}
              productName={draft.name}
              onSelect={handleImageSelected}
              onRemove={handleImageRemoved}
            />
            <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest text-center mt-2">Imagen</p>
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
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Tipo</label>
              <Select value={draft.itemType} onValueChange={v => handleUpdate('itemType', v)}>
                <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRODUCT">Producto</SelectItem>
                  <SelectItem value="SERVICE">Servicio</SelectItem>
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

            <div className="col-span-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Categoría</label>
              <Select value={draft.categoryId} onValueChange={v => handleUpdate('categoryId', v)}>
                <SelectTrigger className="h-9 text-xs mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Moneda</label>
              <Select value={draft.priceCurrency} onValueChange={handleCurrencyChange}>
                <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NIO">NIO</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Costo</label>
              <Input 
                type="number" min={0} step="any"
                value={draft.costPrice} 
                onChange={e => handleUpdate('costPrice', e.target.value)} 
                className="h-9 text-xs text-right mt-1 tabular-nums" 
              />
            </div>
            
            <div className="col-span-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Venta</label>
              <Input 
                type="number" min={0} step="any"
                value={draft.salePrice} 
                onChange={e => handleUpdate('salePrice', e.target.value)} 
                className="h-9 text-xs text-right mt-1 tabular-nums" 
              />
            </div>

            <div className="col-span-2">
              <Button
                type="button"
                variant={draft.trackSerialNumbers ? 'default' : 'outline'}
                className={`h-9 w-full mt-1 text-[10px] uppercase tracking-wider font-bold ${draft.trackSerialNumbers ? 'bg-primary text-primary-foreground shadow-sm' : ''}`}
                onClick={() => handleUpdate('trackSerialNumbers', !draft.trackSerialNumbers)}
              >
                Seguimiento por Serie / IMEI: {draft.trackSerialNumbers ? 'Activado' : 'Desactivado'}
              </Button>
            </div>
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
