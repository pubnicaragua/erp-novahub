import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { ProductImagePicker } from '../ui/ProductImage';
import { Trash2, Plus, Package, Check, AlertTriangle } from 'lucide-react';
import { useCurrency } from '@/app/contexts/CurrencyContext';
import { inventoryService } from '@/app/services/inventario.service';
import { storageService } from '@/app/services/storage.service';
import { toast } from 'sonner';

interface AddProductsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories?: any[];
  warehouses?: any[];
  onRefresh: () => void;
  itemType?: 'PRODUCT' | 'SERVICE';
}

export function AddProductsModal({ open, onOpenChange, categories, warehouses, onRefresh, itemType = 'PRODUCT' }: AddProductsModalProps) {
  const { formatAmount, exchangeRate, baseCurrency } = useCurrency();
  const [internalCategories, setInternalCategories] = useState<any[]>([]);
  const [internalWarehouses, setInternalWarehouses] = useState<any[]>([]);

  useEffect(() => {
    if (!categories && open) {
      inventoryService.getCategories().then(r => setInternalCategories((r as any)?.data || r || []));
    }
    if (!warehouses && open) {
      inventoryService.getWarehouses().then(r => setInternalWarehouses((r as any)?.data || r || []));
    }
  }, [open, categories, warehouses]);

  const effectiveCategories = categories ?? internalCategories;
  const effectiveWarehouses = warehouses ?? internalWarehouses;
  const catalogItemType = itemType;

  const [productsList, setProductsList] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const defaultDraft = {
    id: `draft-${Date.now()}`,
    code: '',
    name: '',
    categoryId: effectiveCategories[0]?.id || '',
    itemType: catalogItemType,
    priceCurrency: 'NIO',
    costPrice: '',
    salePrice: '',
    trackSerialNumbers: false,
    initialStock: '',
    initialWarehouseId: '',
    imageFile: null as File | null,
    imagePreviewUrl: ''
  };

  const [draftProduct, setDraftProduct] = useState<any>({ ...defaultDraft });
  
  const [skuError, setSkuError] = useState('');
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

  // Categories arrive asynchronously when this modal is opened from POS.
  // Select the first one once loaded so the required category is not left empty.
  useEffect(() => {
    if (!open || draftProduct.categoryId || effectiveCategories.length === 0) return;
    setDraftProduct((prev: any) => ({ ...prev, categoryId: effectiveCategories[0].id }));
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
    const initialStockNum = Number(draftProduct.initialStock || 0);
    if (draftProduct.itemType === 'PRODUCT' && initialStockNum > 0 && !draftProduct.initialWarehouseId) {
      toast.error('Debes seleccionar un almacén para el stock inicial');
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
      const initialStockNum = Number(draftProduct.initialStock || 0);
      if (draftProduct.itemType === 'PRODUCT' && initialStockNum > 0 && !draftProduct.initialWarehouseId) {
        toast.error('Debes seleccionar un almacén para el stock inicial');
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
        const convertedSale = Number(product.salePrice || 0) * rate;

        const createdResponse = await inventoryService.createProduct({
          code: product.code,
          name: product.name,
          categoryId: product.categoryId,
          type: product.itemType || 'PRODUCT',
          warehouseId: product.initialWarehouseId || undefined,
          trackInventory: product.itemType === 'PRODUCT',
          trackSeries: Boolean(product.trackSerialNumbers),
          salePrice: convertedSale,
          costPrice: convertedCost,
          trackSerialNumbers: Boolean(product.trackSerialNumbers),
          itemType: product.itemType || 'PRODUCT',
          initialStock: 0,
          imageUrl: uploadedImageUri || undefined,
        } as any);

        const created = (createdResponse as any)?.data || createdResponse;
        const createdId = created?.id;
        const initialStockNum = Number(product.initialStock || 0);

        if (product.itemType === 'PRODUCT' && initialStockNum > 0 && createdId && product.initialWarehouseId) {
          try {
            const productDetailResp = await inventoryService.getProduct(createdId);
            const fullProduct = (productDetailResp as any)?.data || productDetailResp;
            const variantId = fullProduct?.variants?.[0]?.id;

            if (variantId) {
              await inventoryService.updateStockLevel({
                productId: createdId,
                warehouseId: product.initialWarehouseId,
                variantId: variantId,
                quantity: initialStockNum,
                minStock: 0,
              });

              await inventoryService.createMovement({
                productId: createdId,
                warehouseId: product.initialWarehouseId,
                variantId: variantId,
                type: 'IN',
                quantity: initialStockNum,
                reference: `STOCK-INICIAL-${created.code || createdId}`,
              });
            }
          } catch (err) {
            console.error('Error allocating initial stock', err);
            toast.error(`Error al asignar stock al producto ${product.name}`);
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
    } catch (error: any) {
      toast.error(`Hubo un error guardando. Solo se guardaron ${successCount} productos.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isSaving) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <Package className="size-5 text-primary" /> Agregar {catalogItemType === 'SERVICE' ? 'servicios' : 'productos'}
          </DialogTitle>
          <DialogDescription>
            Llena los campos para guardar un {catalogItemType === 'SERVICE' ? 'servicio' : 'producto'}, o agrega varios a la lista.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto flex flex-col gap-6 p-1">
          
          {/* FORMULARIO SUPERIOR */}
          <div className="bg-muted/30 p-4 rounded-xl border border-dashed flex gap-4">
            <div>
              <ProductImagePicker
                src={draftProduct.imagePreviewUrl}
                productName={draftProduct.name}
                onSelect={handleImageSelected}
                onRemove={handleImageRemoved}
              />
            </div>
            <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-3">
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
              <div className="col-span-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Nombre *</label>
                <Input 
                  value={draftProduct.name} 
                  onChange={e => handleUpdateDraft('name', e.target.value)} 
                  className="h-8 text-xs mt-1" 
                  placeholder="Nombre del producto" 
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Categoría *</label>
                <Select value={draftProduct.categoryId} onValueChange={v => handleUpdateDraft('categoryId', v)}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {effectiveCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
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
              
              <div className="col-span-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Venta</label>
                <Input 
                  type="number" min={0}
                  value={draftProduct.salePrice} 
                  onChange={e => handleUpdateDraft('salePrice', e.target.value)} 
                  className="h-8 text-xs text-right mt-1 tabular-nums" 
                  placeholder="0.00" 
                />
              </div>

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

              {draftProduct.itemType === 'PRODUCT' ? (
                <>
                  <div className="col-span-2">
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
                      type="number" min={0}
                      value={draftProduct.initialStock} 
                      onChange={e => handleUpdateDraft('initialStock', e.target.value)} 
                      className="h-8 text-xs text-right mt-1 tabular-nums" 
                      placeholder="0" 
                    />
                  </div>
                </>
              ) : (
                <div className="col-span-3">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Almacén vinculado *</label>
                  <Select value={draftProduct.initialWarehouseId} onValueChange={v => handleUpdateDraft('initialWarehouseId', v)}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Seleccionar almacén" /></SelectTrigger>
                    <SelectContent>
                      {effectiveWarehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className={`col-span-5 flex justify-end ${draftProduct.itemType === 'SERVICE' ? 'mt-0' : 'mt-0'}`}>
                <Button onClick={handleAddToList} className="h-8 text-xs font-bold" variant="secondary" disabled={!!skuError}>
                  <Plus className="size-3 mr-2" />
                  Agregar a la lista
                </Button>
              </div>

            </div>
          </div>

          {/* TABLA INFERIOR */}
          {productsList.length > 0 && (
            <div className="sales-responsive-table border rounded-md bg-card flex-1 overflow-auto min-h-[200px]">
               <Table>
                 <TableHeader className="bg-muted sticky top-0 z-10 shadow-sm">
                 <TableRow>
                   <TableHead className="text-[10px] uppercase w-8"></TableHead>
                   <TableHead className="text-[10px] uppercase">Código</TableHead>
                   <TableHead className="text-[10px] uppercase">Nombre</TableHead>
                   <TableHead className="text-[10px] uppercase">Categoría</TableHead>
                   <TableHead className="text-[10px] uppercase text-right">Stock Inicial</TableHead>
                   <TableHead className="text-[10px] uppercase text-right">Venta</TableHead>
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
                       </TableCell>
                       <TableCell className="text-xs p-2">
                         {effectiveCategories.find(c => c.id === product.categoryId)?.name}
                       </TableCell>
                       <TableCell className="text-xs text-right p-2 tabular-nums">
                         {product.itemType === 'SERVICE' ? '-' : (product.initialStock || 0)}
                       </TableCell>
                       <TableCell className="text-xs text-right p-2 tabular-nums">
                         {product.priceCurrency === 'USD' ? '$' : 'C$'} {Number(product.salePrice || 0).toFixed(2)}
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

        <DialogFooter className="mt-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || (productsList.length === 0 && (!!skuError || !draftProduct.code.trim() || !draftProduct.name.trim()))}
            className="font-bold bg-primary text-primary-foreground"
          >
            {isSaving ? 'Guardando...' : (productsList.length > 0 ? `Guardar ${productsList.length} producto(s)` : 'Guardar producto')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
