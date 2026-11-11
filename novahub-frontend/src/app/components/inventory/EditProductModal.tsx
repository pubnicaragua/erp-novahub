import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { ProductImagePicker } from '../ui/ProductImage';
import { useAuth } from '../../contexts/AuthContext';
import { inventoryService } from '../../services/inventario.service';
import { storageService } from '../../services/storage.service';
import { toast } from '@/app/services/toast';
import { Package, Check, Tag, X, Plus } from 'lucide-react';
import { InventoryViewTutorial } from './InventoryViewTutorial';
import { beginNotificationAction, completeNotificationAction, failNotificationAction } from '../../services/notification-action-coordinator';
import { ProductStockIncreaseSection } from './ProductStockIncreaseSection';

interface EditProductModalProps {
  product: any | null;
  categories: any[];
  itemType?: 'PRODUCT' | 'SERVICE';
  baseCurrency: string;
  exchangeRate: number;
  onClose: () => void;
  onRefresh: () => void;
}

export function EditProductModal({ product, categories, itemType = 'PRODUCT', baseCurrency, exchangeRate, onClose, onRefresh }: EditProductModalProps) {
  const { canPerform } = useAuth();
  const [draft, setDraft] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [catalogAttributes, setCatalogAttributes] = useState<any[]>([]);
  const [createdCategories, setCreatedCategories] = useState<any[]>([]);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const isService = itemType === 'SERVICE' || String(product?.itemType || product?.type || '').toUpperCase() === 'SERVICE';
  const canCreateServiceCategory = canPerform('INVENTORY_ATTRIBUTES', 'create');
  const tenantBaseCurrency = String(baseCurrency || 'NIO').toUpperCase();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (product) {
        const existingLinkedAttributes = (() => {
          if (Array.isArray(product.linkedAttributes) && product.linkedAttributes.length > 0) return product.linkedAttributes;
          if (Array.isArray(product.attributes) && product.attributes.length > 0) return product.attributes;
          if (Array.isArray(product.attributeIds) && product.attributeIds.length > 0) {
            return product.attributeIds.map((id: string) => ({ attributeId: id, selectedOptions: [] }));
          }
          return [];
        })();
        const activeVariants = Array.isArray(product.variants)
          ? product.variants.filter((variant: any) => variant?.isActive !== false)
          : [];
        setDraft({
          id: product.id,
          code: product.code,
          name: product.name,
          description: product.description || '',
          commercialNote: product.commercialNote || '',
          brand: product.brand || '',
          trackBatch: Boolean(product.trackBatch),
          categoryId: product.categoryId || '',
          trackSerialNumbers: Boolean(
            product.trackSerialNumbers ||
            product.serialTracking ||
            product.serialNumberTracking ||
            String(product.trackingType || '').toUpperCase() === 'SERIAL',
          ),
          itemType: String(product.itemType || product.type || itemType || 'PRODUCT').toUpperCase(),
          salePrice: product.salePriceOriginal ?? product.salePrice ?? 0,
          priceCurrency: String(product.priceCurrency || tenantBaseCurrency).toUpperCase(),
          isActive: product.isActive !== false,
          unit: product.unit || 'unidad',
          imageUrl: product.imageUrl,
          imageStorageUri: product.imageUrlStorageUri || (String(product.imageUrl || '').startsWith('storage://') ? product.imageUrl : undefined),
          imageFile: null,
          imagePreviewUrl: '',
          removeImage: false,
          attributeIds: Array.isArray(product.attributeIds) ? product.attributeIds : [],
          linkedAttributes: existingLinkedAttributes,
             isVariable: !isService && Boolean(
            product.isVariable
            || activeVariants.length > 1
            || activeVariants.some((variant: any) => Array.isArray(variant?.attributes) && variant.attributes.length > 0)
            || existingLinkedAttributes.some((attribute: any) => Array.isArray(attribute?.selectedOptions) && attribute.selectedOptions.length > 0),
          ),
        });
      } else {
        setDraft(null);
        setCreatedCategories([]);
        setNewCategoryOpen(false);
        setNewCategoryName('');
        setNewCategoryDescription('');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [product, itemType, isService, tenantBaseCurrency]);

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

  const handleCreateServiceCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error('Ingresa un nombre para la categoría');
      return;
    }

    setIsCreatingCategory(true);
    const actionToken = beginNotificationAction();
    try {
      const response = await inventoryService.createCategory({
        name,
        description: newCategoryDescription.trim() || undefined,
        type: 'SERVICE',
      });
      const created = (response as any)?.data || response;
      setCreatedCategories((previous) => [...previous.filter((category) => category.id !== created.id), created]);
      handleUpdate('categoryId', created.id);
      setNewCategoryName('');
      setNewCategoryDescription('');
      setNewCategoryOpen(false);
      toast.success('Categoría de servicio creada y seleccionada');
      completeNotificationAction(actionToken);
      onRefresh();
    } catch (error: any) {
      const existingCategory = error?.data?.category;
      const isDuplicate = error?.code === 'CATEGORY_DUPLICATE'
        || Boolean(existingCategory?.id)
        || /ya existe la categoría|categor[ií]a.*duplic/i.test(String(error?.message || ''));
      if (isDuplicate && existingCategory?.id) {
        setCreatedCategories((previous) => [...previous.filter((category) => category.id !== existingCategory.id), existingCategory]);
        handleUpdate('categoryId', existingCategory.id);
        setNewCategoryName('');
        setNewCategoryDescription('');
        setNewCategoryOpen(false);
        toast.warning(`La categoría "${existingCategory.name}" ya existe. Se seleccionó la existente.`);
      } else {
        toast.error(error?.message || 'No se pudo crear la categoría de servicio');
      }
      failNotificationAction(actionToken);
    } finally {
      setIsCreatingCategory(false);
    }
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

    const servicePrice = Number(draft.salePrice);
    if (isService && (draft.salePrice === '' || !Number.isFinite(servicePrice) || servicePrice < 0)) {
      toast.error('Ingresa un precio válido mayor o igual a cero');
      return;
    }

    setIsSaving(true);
    const actionToken = beginNotificationAction();
    let uploadedImageUri: string | undefined;
    try {
      if (draft.imageFile) {
        const uploaded = await storageService.uploadFile('product-image', draft.imageFile, {
          folder: draft.id,
        });
        uploadedImageUri = uploaded.uri;
      }
      const nextImageUrl = uploadedImageUri ?? (draft.removeImage ? null : (draft.imageStorageUri || draft.imageUrl));
      const priceCurrency = String(draft.priceCurrency || tenantBaseCurrency).toUpperCase();
      const currentExchangeRate = Number(exchangeRate);
      const storedExchangeRate = Number(product.priceExchangeRate);
      const appliedExchangeRate = priceCurrency === tenantBaseCurrency
        ? 1
        : currentExchangeRate > 0
          ? currentExchangeRate
          : storedExchangeRate > 0 ? storedExchangeRate : 1;
      const baseServicePrice = priceCurrency === tenantBaseCurrency
        ? servicePrice
        : priceCurrency === 'USD'
          ? servicePrice * appliedExchangeRate
          : servicePrice / appliedExchangeRate;

      await inventoryService.updateProduct(draft.id, {
        code: draft.code,
        name: draft.name,
        description: draft.description || '',
        commercialNote: draft.commercialNote || '',
        categoryId: draft.categoryId,
        trackSerialNumbers: Boolean(draft.trackSerialNumbers),
        itemType: draft.itemType || itemType || 'PRODUCT',
        isVariable: Boolean(draft.isVariable),
        ...(draft.isActive !== (product.isActive !== false) ? { isActive: draft.isActive !== false } : {}),
        unit: draft.unit,
        ...(!isService ? { brand: draft.brand || '' } : {}),
        trackBatch: Boolean(draft.trackBatch),
        imageUrl: nextImageUrl,
        ...(isService ? {
          salePrice: baseServicePrice,
          salePriceOriginal: servicePrice,
          priceCurrency,
          priceExchangeRate: appliedExchangeRate,
        } : {}),
        attributeIds: draft.attributeIds?.length > 0 ? draft.attributeIds : [],
        linkedAttributes: draft.linkedAttributes?.length > 0 ? draft.linkedAttributes : [],
      });

      if (draft.imageStorageUri && draft.imageStorageUri !== uploadedImageUri && (uploadedImageUri || draft.removeImage)) {
        storageService.deleteFile(draft.imageStorageUri).catch(() => {});
      }

      toast.success(`${isService ? 'Servicio' : 'Producto'} actualizado`);
      completeNotificationAction(actionToken);
      onRefresh();
      onClose();
    } catch (e: any) {
      if (uploadedImageUri) storageService.deleteFile(uploadedImageUri).catch(() => {});
      toast.error(e.message || 'Error al actualizar');
      failNotificationAction(actionToken);
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
            copy={{ data: { description: 'Actualiza los datos del catálogo: código, nombre, categoría, precios y características.' }, actions: { description: 'Guarda los cambios para actualizar el catálogo.' } }}
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
                <label className="text-[10px] uppercase font-bold text-muted-foreground">{isService ? 'Código' : 'Código/Sku'} *</label>
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

              {!isService && (
                <div className="sm:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Marca</label>
                  <Input
                    value={draft.brand || ''}
                    onChange={e => handleUpdate('brand', e.target.value)}
                    className="h-8 text-xs mt-1"
                    placeholder="Marca del producto"
                  />
                </div>
              )}

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
                <label className="text-[10px] uppercase font-bold text-muted-foreground">{isService ? 'Categoría del servicio' : 'Categoría'}</label>
                {isService ? (
                  <>
                    <div className="mt-1 flex min-w-0 gap-2">
                      <Select value={draft.categoryId || ''} onValueChange={value => handleUpdate('categoryId', value)} disabled={isSaving}>
                        <SelectTrigger className="h-8 min-w-0 flex-1 text-xs"><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                        <SelectContent>
                          {[...categories, ...createdCategories]
                            .filter((category, index, all) => all.findIndex(candidate => candidate.id === category.id) === index)
                            .map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {canCreateServiceCategory && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="mt-0.5 size-8 shrink-0 rounded-lg border-primary/30 text-primary hover:bg-primary/10"
                          onClick={() => setNewCategoryOpen((open) => !open)}
                          disabled={isSaving || isCreatingCategory}
                          title="Crear categoría de servicio"
                          aria-label="Crear categoría de servicio"
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      )}
                    </div>
                    {newCategoryOpen && canCreateServiceCategory && (
                      <div className="mt-2 space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
                        <Input
                          value={newCategoryName}
                          onChange={event => setNewCategoryName(event.target.value)}
                          className="h-9 text-xs"
                          placeholder="Nombre de la categoría"
                          aria-label="Nombre de la categoría de servicio"
                          disabled={isCreatingCategory}
                        />
                        <Input
                          value={newCategoryDescription}
                          onChange={event => setNewCategoryDescription(event.target.value)}
                          className="h-9 text-xs"
                          placeholder="Descripción (opcional)"
                          aria-label="Descripción de la categoría de servicio"
                          disabled={isCreatingCategory}
                        />
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => { setNewCategoryOpen(false); setNewCategoryName(''); setNewCategoryDescription(''); }} disabled={isCreatingCategory}>
                            Cancelar
                          </Button>
                          <Button type="button" size="sm" onClick={handleCreateServiceCategory} disabled={isCreatingCategory || !newCategoryName.trim()}>
                            {isCreatingCategory ? 'Creando…' : 'Crear y seleccionar'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <Select value={draft.categoryId} onValueChange={v => handleUpdate('categoryId', v)} disabled={isSaving}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {isService && (
                <div className="col-span-1 sm:col-span-2 md:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Precio del servicio ({draft.priceCurrency || tenantBaseCurrency}) *</label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={draft.salePrice}
                    onChange={(event) => handleUpdate('salePrice', event.target.value)}
                    className="mt-1 h-8 text-xs text-right tabular-nums"
                    aria-label={`Precio del servicio en ${draft.priceCurrency || tenantBaseCurrency}`}
                    disabled={isSaving} currencyPrecision />
                </div>
              )}

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

              {!isService && <div className="col-span-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Lotes</label>
                <Button
                  type="button"
                  variant={draft.trackBatch ? 'default' : 'outline'}
                  className="h-8 w-full mt-1 text-[10px] uppercase tracking-wider"
                  onClick={() => handleUpdate('trackBatch', !draft.trackBatch)}
                  disabled={isSaving}
                >
                  {draft.trackBatch ? 'Sí' : 'No'}
                </Button>
              </div>}

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
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="text-[10px] uppercase font-black tracking-wider text-primary">Producto con variantes</label>
                <p className="mt-1 text-[10px] text-muted-foreground">Actívalo para manejar color, talla, almacenamiento u otras combinaciones.</p>
              </div>
              <Button
                type="button"
                variant={draft.isVariable ? 'default' : 'outline'}
                className="h-8 shrink-0 text-[10px] font-black uppercase"
                onClick={() => handleUpdate('isVariable', !draft.isVariable)}
                disabled={isSaving}
              >
                <Tag className="mr-1.5 size-3" /> {draft.isVariable ? 'Sí' : 'No'}
              </Button>
            </div>
          </div>
        )}
        {!isService && draft.isVariable && (
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
                              className="size-5 text-destructive hover:text-destructive-foreground hover:bg-destructive"
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

        {!isService && (
          <ProductStockIncreaseSection
            product={product}
            baseCurrency={tenantBaseCurrency}
            onStockIncreased={onRefresh}
          />
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
