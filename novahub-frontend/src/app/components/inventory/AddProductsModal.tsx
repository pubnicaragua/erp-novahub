import { useState, useRef, useEffect, useMemo } from 'react';
import { MeasureUnitItems, ProductClassFields, useProductCatalogOptions } from './ProductCatalogOptions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Combobox } from '@/app/components/ui/Combobox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { ProductImagePicker } from '../ui/ProductImage';
import { ArrowLeft, Trash2, Plus, Package, X, Tag, Check, ChevronDown, AlertTriangle } from 'lucide-react';
import { useCurrency } from '@/app/contexts/CurrencyContext';
import { useAuth } from '@/app/contexts/AuthContext';
import { inventoryService } from '@/app/services/inventario.service';
import { storageService } from '@/app/services/storage.service';
import { toast } from '@/app/services/toast';
import { beginNotificationAction, completeNotificationAction, failNotificationAction } from '../../services/notification-action-coordinator';
import { InventoryViewTutorial } from './InventoryViewTutorial';
import type { SimilarProductGroup, SimilarProductMatch } from '@/app/services/inventario.service';
import { priceListsService, type PriceList } from '@/app/services/price-lists.service';
import { resolveStandardProductPriceLists } from '@/app/utils/product-price-lists';
import { PriceListPricingEditor, PriceListPricingModeSelect, type PriceListPricingMode } from '../ui/PriceListPricingEditor';

interface AddProductsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories?: any[];
  warehouses?: any[];
  brands?: string[];
  priceLists?: Array<Pick<PriceList, 'code' | 'name'>>;
  onRefresh: () => void;
  onSelectExistingProduct?: (match: SimilarProductMatch) => void;
  itemType?: 'PRODUCT' | 'SERVICE';
  presentation?: 'dialog' | 'page';
}

import { MarginPriceSuggestion, BulkMarginBar } from './MarginPricing';
import { priceFromCost, type MarginMode } from '../../utils/marginPricing';

const makeDefaultDraft = (categoryId: string, itemType: string) => ({
  id: `draft-${Date.now()}`,
  code: '',
  name: '',
  categoryId,
  itemType,
  description: '',
  commercialNote: '',
  priceCurrency: 'NIO',
  pricingMode: 'FIXED' as PriceListPricingMode,
  prices: {} as Record<string, number | string>,
  priceSettings: {} as Record<string, { pricingMode: PriceListPricingMode; marginPercent: number | string }>,
  costPrice: '',
  taxRate: itemType === 'SERVICE' ? '0' : '0.15',
  unit: 'unidad',
  productClass: '',
  presentation: '',
  brand: '',
  minStock: '',
  maxStock: '',
  trackBatch: false,
  salePrice: '',
  trackSerialNumbers: false,
  isActive: true,
  initialStock: '',
  variantInitialStocks: {} as Record<string, number>,
  variantPrices: {} as Record<string, Record<string, number | string>>,
  variantPriceSettings: {} as Record<string, Record<string, { pricingMode: PriceListPricingMode; marginPercent: number | string }>>,
  variantCostPrices: {} as Record<string, number | string>,
  variantMinStocks: {} as Record<string, number | string>,
  variantMaxStocks: {} as Record<string, number | string>,
  initialWarehouseId: '',
  imageUrl: '',
  imageFile: null as File | null,
  imagePreviewUrl: '',
  isVariable: false,
  linkedAttributes: [] as Array<{ attributeId: string; selectedOptions: string[] }>,
  imeiNumber: '',
});

type VariantCombination = Array<{ attributeId: string; attributeName: string; value: string }>;

const buildVariantCombinations = (linkedAttributes: any[] = []): VariantCombination[] => {
  const attributes = linkedAttributes.filter((attribute) => Array.isArray(attribute.selectedOptions) && attribute.selectedOptions.length > 0);
  if (attributes.length === 0) return [];

  return attributes.reduce<VariantCombination[]>((combinations, attribute) => {
    const options = attribute.selectedOptions.map((value: string) => ({
      attributeId: attribute.attributeId,
      attributeName: attribute.name || attribute.attributeId,
      value,
    }));
    if (combinations.length === 0) return options.map((option: any) => [option]);
    return combinations.flatMap((combination) => options.map((option: any) => [...combination, option]));
  }, []);
};

const variantCombinationKey = (combination: VariantCombination) =>
  combination.map((attribute) => `${attribute.attributeId}::${attribute.value}`).join('|');

const getVariantStockTotal = (product: any) =>
  buildVariantCombinations(product?.linkedAttributes).reduce(
    (total, combination) => total + Number(product?.variantInitialStocks?.[variantCombinationKey(combination)] || 0),
    0,
  );

const normalizeSimilarityInputKey = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase();

interface ProductSimilarityDecisionPanelProps {
  groups: SimilarProductGroup[];
  itemType: 'PRODUCT' | 'SERVICE';
  canEditExistingProduct: boolean;
  onSelectExisting: (group: SimilarProductGroup, match: SimilarProductMatch) => void;
  onCreateNew: (group: SimilarProductGroup) => void;
}

function ProductSimilarityDecisionPanel({ groups, itemType, canEditExistingProduct, onSelectExisting, onCreateNew }: ProductSimilarityDecisionPanelProps) {
  const itemLabel = itemType === 'SERVICE' ? 'servicio' : 'producto';

  return (
    <section
      role="alert"
      aria-live="polite"
      aria-label={`Revisión de posible ${itemLabel} duplicado`}
      data-testid="inventory-product-similarity-decision"
      className="space-y-3 rounded-xl border border-warning/40 bg-warning/[0.04] p-3 sm:p-4"
    >
      <header className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="font-bold text-foreground">Este {itemLabel} podría estar duplicado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Compara las coincidencias y elige editar el registro existente o confirmar la creación. Los datos escritos siguen en este formulario.
          </p>
        </div>
      </header>

      {groups.map((group) => {
        const hasExactSkuMatch = group.matches.some((match) => (match.reasons || []).includes('SKU'));
        return (
          <article key={group.inputKey} className="space-y-3 rounded-lg border border-warning/30 bg-background p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Código que estás registrando</p>
                <p className="mt-1 break-all font-mono text-sm font-bold text-foreground">{group.inputKey || 'Sin código'}</p>
              </div>
              <Badge variant="outline" className="border-warning/50 text-warning">
                {group.matches.length} coincidencia{group.matches.length === 1 ? '' : 's'} posible{group.matches.length === 1 ? '' : 's'}
              </Badge>
            </div>

            {group.matches.map((match) => (
              <div key={`${group.inputKey}:${match.id}`} className="flex flex-col gap-3 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="break-words font-semibold text-foreground">{match.name || 'Producto sin nombre'}</p>
                  <p className="break-all font-mono text-xs text-muted-foreground">Código/SKU: {match.sku || match.code || 'Sin código'}</p>
                  <p className="text-xs text-muted-foreground">
                    Coincidencia por: {(match.reasons || []).join(', ') || 'datos del producto'}
                  </p>
                  {(itemType !== 'SERVICE' && match.brand || match.category) && (
                    <p className="text-xs text-muted-foreground">
                      {itemType !== 'SERVICE' && match.brand ? `Marca: ${match.brand}` : ''}{itemType !== 'SERVICE' && match.brand && match.category ? ' · ' : ''}{match.category ? `Categoría: ${match.category}` : ''}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-2"
                  disabled={!canEditExistingProduct}
                  title={!canEditExistingProduct ? `No tienes permiso para editar ${itemLabel === 'servicio' ? 'servicios' : 'productos'}.` : undefined}
                  onClick={() => onSelectExisting(group, match)}
                >
                  <Check className="size-4" /> Editar {itemLabel} existente
                </Button>
              </div>
            ))}

            {hasExactSkuMatch ? (
              <p className="rounded-md border border-warning/30 bg-warning/[0.05] px-3 py-2 text-sm font-medium text-warning">
                Ese código ya está registrado y debe ser único. Cámbialo para crear un {itemLabel} nuevo o edita el existente.
              </p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                <p className="text-xs text-muted-foreground">Si son registros distintos, puedes confirmar la creación con el código actual.</p>
                <Button type="button" size="sm" className="gap-2" onClick={() => onCreateNew(group)}>
                  <Plus className="size-4" /> Crear {itemLabel} nuevo
                </Button>
              </div>
            )}

            {!canEditExistingProduct && (
              <p className="text-xs text-muted-foreground">Tu usuario no tiene permiso para editar este registro.</p>
            )}
          </article>
        );
      })}
    </section>
  );
}

export function AddProductsModal({ open, onOpenChange, categories, warehouses, brands = [], priceLists, onRefresh, onSelectExistingProduct, itemType = 'PRODUCT', presentation = 'dialog' }: AddProductsModalProps) {
  const { exchangeRate, baseCurrency } = useCurrency();
  const { canPerform } = useAuth();
  const catalogPermissionModule = itemType === 'SERVICE' ? 'INVENTORY_SERVICES' : 'INVENTORY_PRODUCTS';
  const canEditExistingProduct = canPerform(catalogPermissionModule, 'edit');
  const canViewInventoryCost = canPerform(catalogPermissionModule, 'viewCost');
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
  const brandOptions = useMemo(() => {
    const uniqueBrands = new Map<string, string>();
    brands.forEach((brand) => {
      const label = String(brand || '').trim();
      if (!label) return;
      const normalized = label.toLocaleLowerCase();
      if (!uniqueBrands.has(normalized)) uniqueBrands.set(normalized, label);
    });
    return Array.from(uniqueBrands.values())
      .sort((left, right) => left.localeCompare(right, 'es', { sensitivity: 'base' }))
      .map((brand) => ({ label: brand, value: brand }));
  }, [brands]);
  const categoryOptions = useMemo(() => allCategories.map((category: any) => ({
    label: category.name,
    value: category.id,
  })), [allCategories]);
  const effectiveWarehouses = warehouses ?? internalWarehouses;
  const [internalPriceLists, setInternalPriceLists] = useState<Array<Pick<PriceList, 'code' | 'name'>>>([
    { code: 'RETAIL', name: 'Minorista' },
    { code: 'WHOLESALE', name: 'Mayorista' },
    { code: 'DISTRIBUTOR', name: 'Distribuidor' },
  ]);
  const catalogItemType = itemType;
  const sourcePriceLists = priceLists && priceLists.length > 0 ? priceLists : internalPriceLists;
  const effectivePriceLists = catalogItemType === 'SERVICE'
    ? Array.from(new Map(sourcePriceLists
      .map((list) => ({ code: String(list.code || '').trim(), name: String(list.name || '').trim() }))
      .filter((list) => list.code && list.name)
      .map((list) => [list.code.toUpperCase(), list] as const)).values())
    : resolveStandardProductPriceLists(sourcePriceLists);
  const categoryRequired = catalogItemType !== 'SERVICE';
  const codeRequired = catalogItemType === 'PRODUCT';
  const canCreateServiceCategory = canPerform('INVENTORY_ATTRIBUTES', 'create');
  const isPagePresentation = presentation === 'page';

  const [productsList, setProductsList] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingAccounting, setIsCheckingAccounting] = useState(false);

  const defaultDraft = makeDefaultDraft(effectiveCategories[0]?.id || '', catalogItemType);

  const [draftProduct, setDraftProduct] = useState<any>({ ...defaultDraft });
  
  const [skuError, setSkuError] = useState('');
  const [skuConflictNeedsList, setSkuConflictNeedsList] = useState(false);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const catalogOptions = useProductCatalogOptions();
  const [catalogAttributes, setCatalogAttributes] = useState<any[]>([]);
  const [similarGroups, setSimilarGroups] = useState<SimilarProductGroup[]>([]);
  const [similarPendingProducts, setSimilarPendingProducts] = useState<any[]>([]);
  const [similarResolutions, setSimilarResolutions] = useState<Record<string, { action: 'USE_EXISTING' | 'CREATE_NEW'; match?: SimilarProductMatch }>>({});
  const similarityDecisionPanelRef = useRef<HTMLDivElement>(null);
  const skuInputRef = useRef<HTMLInputElement>(null);
  const [attributesStepExpanded, setAttributesStepExpanded] = useState(true);
  const [valuesStepExpanded, setValuesStepExpanded] = useState(true);
  const [expandedAttributeId, setExpandedAttributeId] = useState<string | null>(null);
  const [variantsExpanded, setVariantsExpanded] = useState(true);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const skuValidationRequestIdRef = useRef(0);

  useEffect(() => {
    if (similarGroups.length > 0) {
      similarityDecisionPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      similarityDecisionPanelRef.current?.focus({ preventScroll: true });
    }
  }, [similarGroups]);

  const focusSkuInput = () => {
    window.requestAnimationFrame(() => {
      skuInputRef.current?.focus();
      skuInputRef.current?.select();
    });
  };

  const invalidatePendingSkuCheck = () => {
    skuValidationRequestIdRef.current += 1;
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  };

  const handleExactSkuConflict = (
    groups: SimilarProductGroup[],
    pendingProducts: any[],
    remainingProducts = pendingProducts,
  ) => {
    const skuConflictGroup = groups.find((group) => {
      const groupKey = normalizeSimilarityInputKey(group.inputKey);
      return group.matches.some((match) => (
        (match.reasons || []).some((reason) => reason.toLowerCase() === 'sku')
        || [match.code, match.sku, ...(match.variants || []).map((variant) => variant.sku)]
          .some((value) => normalizeSimilarityInputKey(value) === groupKey)
      ));
    });
    if (!skuConflictGroup) return false;

    invalidatePendingSkuCheck();
    const inputKey = normalizeSimilarityInputKey(skuConflictGroup.inputKey);
    const conflictingProduct = pendingProducts.find((product) =>
      [product.code, product.sku, product.name]
        .some((value) => normalizeSimilarityInputKey(value) === inputKey),
    );
    const conflictWasListed = Boolean(conflictingProduct && remainingProducts.some((product) => product.id === conflictingProduct.id));
    if (conflictingProduct) setDraftProduct({ ...conflictingProduct });
    setProductsList(remainingProducts.filter((product) => product.id !== conflictingProduct?.id));
    setSkuConflictNeedsList(conflictWasListed);
    setSimilarGroups([]);
    setSimilarPendingProducts([]);
    setSimilarResolutions({});
    const sku = String(conflictingProduct?.code || skuConflictGroup.inputKey || '').trim();
    const itemLabel = catalogItemType === 'SERVICE' ? 'servicio' : 'producto';
    setSkuError(`El SKU “${sku}” ya existe. Ingresa otro SKU antes de guardar este ${itemLabel}.`);
    focusSkuInput();
    return true;
  };

  const validateSkuDebounced = (code: string) => {
    const requestId = ++skuValidationRequestIdRef.current;
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    if (!code.trim()) {
      setSkuError('');
      return;
    }
    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await inventoryService.checkProductCode(code);
        if (requestId !== skuValidationRequestIdRef.current) return;
        const exists = response?.exists;
        setSkuError(exists
          ? `El SKU “${code.trim()}” ya existe. Ingresa otro SKU antes de guardar este ${catalogItemType === 'SERVICE' ? 'servicio' : 'producto'}.`
          : '');
        if (exists && productsList.length > 0) setSkuConflictNeedsList(true);
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

  useEffect(() => {
    if (!open || (priceLists && priceLists.length > 0)) return;
    const controller = new AbortController();
    priceListsService.getAll(controller.signal)
      .then((lists) => setInternalPriceLists(resolveStandardProductPriceLists(Array.isArray(lists) ? lists.filter((list) => list.isActive !== false) : [])))
      .catch(() => undefined);
    return () => controller.abort();
  }, [open, priceLists]);

  const getSelectedAttributes = () => {
    return catalogAttributes.filter((a: any) =>
      draftProduct.linkedAttributes.some((la: any) => la.attributeId === a.id)
    );
  };

  const variantCombinations = useMemo(
    () => buildVariantCombinations(draftProduct.linkedAttributes),
    [draftProduct.linkedAttributes],
  );

  const variantSkuPreviews = useMemo(() => {
    const parentSku = String(draftProduct.code || '').trim() || 'SKU-PADRE';
    const usedSkus = new Set<string>();
    const previews: Record<string, string> = {};

    variantCombinations.forEach((combination) => {
      const suffix = combination.map((attribute) => {
        const normalized = attribute.value.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
        return normalized.substring(0, 8);
      }).filter(Boolean).join('-');
      let sku = suffix ? `${parentSku}-${suffix}` : parentSku;
      let counter = 2;
      while (usedSkus.has(sku.toLowerCase())) sku = `${parentSku}-${suffix}-${counter++}`;
      usedSkus.add(sku.toLowerCase());
      previews[variantCombinationKey(combination)] = sku;
    });

    return previews;
  }, [draftProduct.code, variantCombinations]);

  const allocatedVariantStock = getVariantStockTotal(draftProduct);

  const updateVariantInitialStock = (combination: VariantCombination, value: string) => {
    const key = variantCombinationKey(combination);
    const parsed = value === '' ? 0 : Math.max(0, Number(value));
    setDraftProduct((prev: any) => ({
      ...prev,
      variantInitialStocks: {
        ...(prev.variantInitialStocks || {}),
        [key]: Number.isFinite(parsed) ? parsed : 0,
      },
    }));
  };

  const updateVariantCostPrice = (combination: VariantCombination, value: string) => {
    const key = variantCombinationKey(combination);
    setDraftProduct((prev: any) => ({
      ...prev,
      variantCostPrices: {
        ...(prev.variantCostPrices || {}),
        [key]: value,
      },
    }));
  };

  const updateVariantPrice = (combination: VariantCombination, priceListCode: string, value: string) => {
    const key = variantCombinationKey(combination);
    setDraftProduct((prev: any) => ({
      ...prev,
      variantPrices: {
        ...(prev.variantPrices || {}),
        [key]: {
          ...(prev.variantPrices?.[key] || {}),
          [priceListCode]: value,
        },
      },
      variantPriceSettings: {
        ...(prev.variantPriceSettings || {}),
        [key]: {
          ...(prev.variantPriceSettings?.[key] || {}),
          [priceListCode]: { pricingMode: 'FIXED', marginPercent: '' },
        },
      },
    }));
  };

  const updateVariantMargin = (combination: VariantCombination, listCode: string, marginPercent: string) => {
    const key = variantCombinationKey(combination);
    setDraftProduct((prev: any) => ({
      ...prev,
      variantPriceSettings: {
        ...(prev.variantPriceSettings || {}),
        [key]: {
          ...(prev.variantPriceSettings?.[key] || {}),
          [listCode]: { pricingMode: 'MARGIN', marginPercent },
        },
      },
    }));
  };

  const applyVariantMargin = (combination: VariantCombination, listCode: string, price: number) => {
    const key = variantCombinationKey(combination);
    setDraftProduct((prev: any) => ({
      ...prev,
      variantPrices: {
        ...(prev.variantPrices || {}),
        [key]: { ...(prev.variantPrices?.[key] || {}), [listCode]: price },
      },
    }));
  };

  const updateVariantStockThreshold = (kind: 'min' | 'max', combination: VariantCombination, value: string) => {
    const key = variantCombinationKey(combination);
    const field = kind === 'min' ? 'variantMinStocks' : 'variantMaxStocks';
    setDraftProduct((prev: any) => ({
      ...prev,
      [field]: { ...(prev[field] || {}), [key]: value },
    }));
  };

  const updatePrice = (code: string, value: string) => {
    setDraftProduct((prev: any) => ({
      ...prev,
      prices: { ...(prev.prices || {}), [code]: value },
      priceSettings: { ...(prev.priceSettings || {}), [code]: { pricingMode: 'FIXED', marginPercent: '' } },
      salePrice: (() => {
        const nextPrices = { ...(prev.prices || {}), [code]: value };
        const hasPrice = (list: Pick<PriceList, 'code' | 'name'>) => nextPrices[list.code] !== undefined && nextPrices[list.code] !== null && nextPrices[list.code] !== '';
        const retailList = effectivePriceLists.find((list) => list.code.toUpperCase() === 'RETAIL');
        const primaryList = (retailList && hasPrice(retailList) ? retailList : undefined) || effectivePriceLists.find(hasPrice);
        return primaryList ? nextPrices[primaryList.code] ?? '' : '';
      })(),
    }));
  };

  const updateProductPricingMode = (pricingMode: PriceListPricingMode) => {
    setDraftProduct((prev: any) => ({ ...prev, pricingMode }));
  };

  const updateMargin = (code: string, marginPercent: string) => {
    setDraftProduct((prev: any) => ({
      ...prev,
      priceSettings: { ...(prev.priceSettings || {}), [code]: { pricingMode: 'MARGIN', marginPercent } },
    }));
  };

  const applyListMargin = (code: string, price: number) => {
    setDraftProduct((prev: any) => ({
      ...prev,
      prices: { ...(prev.prices || {}), [code]: price },
      salePrice: (() => {
        const nextPrices = { ...(prev.prices || {}), [code]: price };
        const retailList = effectivePriceLists.find((list) => list.code.toUpperCase() === 'RETAIL');
        const primaryList = (retailList && nextPrices[retailList.code] !== undefined ? retailList : undefined) || effectivePriceLists.find((list) => nextPrices[list.code] !== undefined);
        return primaryList ? nextPrices[primaryList.code] ?? '' : '';
      })(),
    }));
  };

  const applySuggestedPrice = (price: number) => {
    setDraftProduct((prev: any) => {
      const prices: Record<string, number | string> = { ...(prev.prices || {}) };
      effectivePriceLists.forEach((list) => { prices[list.code] = price; });
      const priceSettings = { ...(prev.priceSettings || {}) };
      effectivePriceLists.forEach((list) => { priceSettings[list.code] = { pricingMode: 'FIXED', marginPercent: '' }; });
      return { ...prev, prices, priceSettings, pricingMode: 'FIXED', salePrice: price };
    });
    toast.success('Precio sugerido aplicado. Puedes ajustarlo antes de guardar.');
  };

  // Masivo: cada producto de la lista recibe su precio calculado desde su propio costo.
  const applyMarginToList = (percent: number, mode: MarginMode) => {
    let updated = 0;
    let skipped = 0;
    setProductsList((current) => current.map((product) => {
      const price = priceFromCost(Number(product.costPrice), percent, mode);
      if (price === null) { skipped += 1; return product; }
      updated += 1;
      const prices: Record<string, number | string> = { ...(product.prices || {}) };
      effectivePriceLists.forEach((list) => { prices[list.code] = price; });
      const priceSettings = { ...(product.priceSettings || {}) };
      effectivePriceLists.forEach((list) => { priceSettings[list.code] = { pricingMode: 'FIXED', marginPercent: '' }; });
      return { ...product, prices, priceSettings, pricingMode: 'FIXED', salePrice: price };
    }));
    // setState diferido: el conteo se informa en el siguiente turno del event loop
    window.setTimeout(() => {
      if (updated > 0) toast.success(`Precio calculado en ${updated} producto(s)${skipped ? `; ${skipped} sin costo se omitieron` : ''}.`);
      else toast.warning('Ningún producto de la lista tiene costo para calcular el precio.');
    }, 0);
  };

  const materializePriceSettings = (product: any) => {
    const prices: Record<string, number | string> = { ...(product.prices || {}) };
    const pricingMode: PriceListPricingMode = canViewInventoryCost && product.pricingMode === 'MARGIN' ? 'MARGIN' : 'FIXED';
    const priceSettings: Record<string, { pricingMode: PriceListPricingMode; marginPercent: number | null }> = {};
    for (const list of effectivePriceLists) {
      const setting = product.priceSettings?.[list.code] || { pricingMode: 'FIXED' as const, marginPercent: '' };
      if (pricingMode === 'MARGIN') {
        if (setting.marginPercent === '' || setting.marginPercent === null || setting.marginPercent === undefined) {
          delete prices[list.code];
          continue;
        }
        const marginPercent = Number(setting.marginPercent);
        const calculated = priceFromCost(Number(product.costPrice), marginPercent, 'markup');
        if (calculated === null) {
          throw new Error(`${product.name || (catalogItemType === 'SERVICE' ? 'Servicio' : 'Producto')} · ${list.name}: ingresa un costo mayor que cero y un porcentaje de ganancia válido.`);
        }
        prices[list.code] = calculated;
        priceSettings[list.code] = { pricingMode: 'MARGIN', marginPercent };
        continue;
      }
      const rawPrice = prices[list.code];
      if (rawPrice === undefined || rawPrice === null || rawPrice === '') continue;
      priceSettings[list.code] = { pricingMode: 'FIXED', marginPercent: null };
    }

    const variantPrices: Record<string, Record<string, number | string>> = { ...(product.variantPrices || {}) };
    const variantPriceSettings: Record<string, Record<string, { pricingMode: PriceListPricingMode; marginPercent: number | null }>> = {};
    if (product.isVariable) {
      for (const combination of buildVariantCombinations(product.linkedAttributes)) {
        const key = variantCombinationKey(combination);
        variantPrices[key] = { ...(variantPrices[key] || {}) };
        variantPriceSettings[key] = {};
        const rawVariantCost = product.variantCostPrices?.[key];
        const variantCost = rawVariantCost === '' || rawVariantCost === null || rawVariantCost === undefined
          ? Number(product.costPrice)
          : Number(rawVariantCost);
        for (const list of effectivePriceLists) {
          const setting = product.variantPriceSettings?.[key]?.[list.code] || { pricingMode: 'FIXED' as const, marginPercent: '' };
          if (pricingMode === 'MARGIN') {
            if (setting.marginPercent === '' || setting.marginPercent === null || setting.marginPercent === undefined) {
              delete variantPrices[key][list.code];
              continue;
            }
            const marginPercent = Number(setting.marginPercent);
            const calculated = priceFromCost(variantCost, marginPercent, 'markup');
            if (calculated === null) {
              const label = combination.map((attribute) => attribute.value).join(' / ');
              throw new Error(`${product.name || 'Producto'} · ${label} · ${list.name}: ingresa un costo mayor que cero y un porcentaje de ganancia válido.`);
            }
            variantPrices[key][list.code] = calculated;
            variantPriceSettings[key][list.code] = { pricingMode: 'MARGIN', marginPercent };
            continue;
          }
          const rawPrice = variantPrices[key][list.code];
          if (rawPrice !== undefined && rawPrice !== null && rawPrice !== '') {
            variantPriceSettings[key][list.code] = { pricingMode: 'FIXED', marginPercent: null };
          }
        }
      }
    }
    return { ...product, prices, priceSettings, variantPrices, variantPriceSettings };
  };

  const validateVariableStockDistribution = (product: any) => {
    if (!product.isVariable) return true;
    const combinations = buildVariantCombinations(product.linkedAttributes);
    if (combinations.length === 0) {
      toast.error('Selecciona al menos una combinación válida para las variantes');
      return false;
    }
    const invalid = combinations.find((combination) => {
      const quantity = Number(product.variantInitialStocks?.[variantCombinationKey(combination)] || 0);
      return !Number.isFinite(quantity) || quantity < 0;
    });
    if (invalid) {
      toast.error('El stock inicial de cada variante debe ser un número mayor o igual que cero');
      return false;
    }
    return true;
  };

  const hasValidSellingPrice = (product: any) => {
    const pricingMode: PriceListPricingMode = canViewInventoryCost && product.pricingMode === 'MARGIN' ? 'MARGIN' : 'FIXED';
    const hasPrice = (prices: Record<string, any>, settings: Record<string, any>, listCode: string, cost: number) => {
      const setting = settings?.[listCode];
      if (pricingMode === 'MARGIN') return priceFromCost(cost, Number(setting?.marginPercent), 'markup') !== null;
      const value = prices?.[listCode];
      return value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
    };
    if (product.itemType === 'SERVICE') return effectivePriceLists.some((list) => hasPrice(product.prices, product.priceSettings, list.code, Number(product.costPrice)));
    const hasParentPrice = effectivePriceLists.some((list) => hasPrice(product.prices, product.priceSettings, list.code, Number(product.costPrice)));
    const hasVariantPrice = product.isVariable && Object.entries(product.variantPrices || {}).some(([key, prices]: [string, any]) =>
      effectivePriceLists.some((list) => {
        const rawCost = product.variantCostPrices?.[key];
        const cost = rawCost === '' || rawCost === undefined || rawCost === null ? Number(product.costPrice) : Number(rawCost);
        return hasPrice(prices, product.variantPriceSettings?.[key], list.code, cost);
      }),
    );
    return hasParentPrice || hasVariantPrice;
  };

  const toggleAttribute = (attrId: string) => {
    const isCurrentlySelected = draftProduct.linkedAttributes.some((la: any) => la.attributeId === attrId);
    setDraftProduct((prev: any) => {
      const exists = prev.linkedAttributes.find((la: any) => la.attributeId === attrId);
      if (exists) {
        return { ...prev, linkedAttributes: prev.linkedAttributes.filter((la: any) => la.attributeId !== attrId) };
      }
      const attr = catalogAttributes.find((a: any) => a.id === attrId);
      return {
        ...prev,
        linkedAttributes: [...prev.linkedAttributes, { attributeId: attrId, name: attr?.name || '', selectedOptions: [] }],
      };
    });
    setExpandedAttributeId(isCurrentlySelected ? null : attrId);
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
    const actionToken = beginNotificationAction();
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
      completeNotificationAction(actionToken);
    } catch (e: any) {
      const existingCategory = (e?.data as any)?.category;
      const isDuplicate = e?.code === 'CATEGORY_DUPLICATE'
        || Boolean(existingCategory?.id)
        || /ya existe la categoría|categor[ií]a.*duplic/i.test(String(e?.message || ''));
      if (isDuplicate) {
        if (existingCategory?.id) {
          setExtraCategories((prev) => [
            ...prev.filter((category) => category.id !== existingCategory.id),
            existingCategory,
          ]);
          handleUpdateDraft('categoryId', existingCategory.id);
        }
        setNewCategoryName('');
        setNewCategoryDesc('');
        setNewCategoryOpen(false);
        toast.warning(existingCategory?.name
          ? `Observación: la categoría "${existingCategory.name}" ya existe. Se seleccionó la existente.`
          : `Observación: ${e?.message || 'la categoría ya existe'}`);
      } else {
        toast.error(e?.message || 'Error al crear categoría');
      }
      failNotificationAction(actionToken);
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
      setSkuError('');
      validateSkuDebounced(value as string);
    }
    if ((field === 'code' || field === 'name') && similarGroups.length > 0) {
      // El aviso corresponde a los valores ya comprobados y se valida otra vez al guardar.
      setSimilarGroups([]);
      setSimilarPendingProducts([]);
      setSimilarResolutions({});
    }
  };

  const handleInitialWarehouseChange = (warehouseId: string) => {
    setDraftProduct((prev: any) => ({ ...prev, initialWarehouseId: warehouseId }));
  };

  const validateStockCosts = (product: any) => {
    const isProduct = String(product.itemType || 'PRODUCT').toUpperCase() === 'PRODUCT';
    const stock = product.isVariable ? getVariantStockTotal(product) : Number(product.initialStock || 0);
    if (!isProduct || !Number.isFinite(stock) || stock <= 0) return true;

    if (!canViewInventoryCost) {
      toast.warning('Observación: no puedes registrar stock inicial sin permiso para indicar el costo del producto. Solicita acceso al costo o deja el stock en cero.');
      return false;
    }

    const parentCost = product.costPrice === '' || product.costPrice === null || product.costPrice === undefined
      ? NaN
      : Number(product.costPrice);
    if (!product.isVariable) {
      if (!Number.isFinite(parentCost) || parentCost <= 0) {
        toast.warning('Observación: el costo debe ser mayor que cero cuando el producto tiene stock inicial.');
        return false;
      }
      return true;
    }

    const missingCostCombination = buildVariantCombinations(product.linkedAttributes).find((combination) => {
      const key = variantCombinationKey(combination);
      const quantity = Number(product.variantInitialStocks?.[key] || 0);
      if (!Number.isFinite(quantity) || quantity <= 0) return false;
      const rawVariantCost = product.variantCostPrices?.[key];
      const effectiveCost = rawVariantCost === '' || rawVariantCost === null || rawVariantCost === undefined
        ? parentCost
        : Number(rawVariantCost);
      return !Number.isFinite(effectiveCost) || effectiveCost <= 0;
    });
    if (missingCostCombination) {
      const label = missingCostCombination.map((attribute) => `${attribute.attributeName}: ${attribute.value}`).join(' · ');
      toast.warning(`Observación: la variante ${label} tiene stock inicial y necesita un costo mayor que cero.`);
      return false;
    }
    return true;
  };

  const validateProductsStockAccounting = async (products: any[]) => {
    if (products.some((product) => !validateStockCosts(product))) return false;
    const stockProducts = products.filter((product) => {
      const isProduct = String(product.itemType || 'PRODUCT').toUpperCase() === 'PRODUCT';
      const stock = product.isVariable ? getVariantStockTotal(product) : Number(product.initialStock || 0);
      return isProduct && Number.isFinite(stock) && stock > 0;
    });
    if (stockProducts.length === 0) return true;

    const warehouseIds = [...new Set(stockProducts
      .map((product) => String(product.initialWarehouseId || '').trim())
      .filter(Boolean))];
    if (stockProducts.some((product) => !String(product.initialWarehouseId || '').trim())) {
      toast.error('Cada producto con stock inicial debe tener una bodega destino seleccionada.');
      return false;
    }

    setIsCheckingAccounting(true);
    try {
      const response = await inventoryService.previewProductStockAccounting(warehouseIds);
      const preview = (response as any)?.data || response;
      if (!preview?.ready) {
        const message = Array.isArray(preview?.errors) && preview.errors.length > 0
          ? preview.errors.join(' ')
          : 'Completa la configuración contable de Inventario y de las bodegas antes de agregar stock.';
        toast.error(message);
        return false;
      }
      return true;
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo validar la configuración contable del inventario.');
      return false;
    } finally {
      setIsCheckingAccounting(false);
    }
  };

  const handleAddToList = async () => {
    if ((codeRequired && !draftProduct.code.trim()) || !draftProduct.name.trim() || (categoryRequired && !draftProduct.categoryId)) {
      toast.error(catalogItemType === 'SERVICE' ? 'El nombre del servicio es obligatorio' : 'Código, Nombre y Categoría son obligatorios');
      return;
    }
    if (skuError) {
      if (productsList.length > 0) setSkuConflictNeedsList(true);
      focusSkuInput();
      return;
    }
    if (!hasValidSellingPrice(draftProduct)) {
      toast.error('Ingresa al menos un precio de venta válido');
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
      if (!validateVariableStockDistribution(draftProduct)) return;
    }
    if (draftProduct.itemType === 'PRODUCT' && !draftProduct.initialWarehouseId) {
      toast.error('Debes seleccionar una Bodega para el producto');
      return;
    }
    if (draftProduct.isVariable && !draftProduct.initialWarehouseId) {
      toast.error('Debes seleccionar una Bodega para el producto');
      return;
    }
    if (!(await validateProductsStockAccounting([draftProduct]))) return;
    setProductsList((prev) => [
      ...prev,
      {
        ...draftProduct,
        initialStock: draftProduct.isVariable ? getVariantStockTotal(draftProduct) : draftProduct.initialStock,
      },
    ]);
    
    // Reset draft
    setDraftProduct({
      ...defaultDraft,
      id: `draft-${Date.now()}`,
      categoryId: effectiveCategories[0]?.id || '',
    });
    invalidatePendingSkuCheck();
    setSkuError('');
    setSkuConflictNeedsList(false);
  };

  const handleRemoveFromList = (id: string) => {
    setProductsList((prev) => prev.filter(p => p.id !== id));
  };

  const persistProducts = async (listToSave: any[]) => {
    try {
      listToSave = listToSave.map(materializePriceSettings);
    } catch (error: any) {
      toast.error(error?.message || 'Revisa el costo y los márgenes configurados.');
      return;
    }
    setIsSaving(true);
    let successCount = 0;
    const actionToken = beginNotificationAction();

    try {
      for (const product of listToSave) {
        let uploadedImageUri: string | undefined;
        if (product.imageFile) {
          const uploaded = await storageService.uploadFile('product-image', product.imageFile, {
            folder: 'catalog',
          });
          uploadedImageUri = uploaded.uri;
        }

        const rate = product.priceCurrency !== baseCurrency
          ? (product.priceCurrency === 'USD' ? exchangeRate : (1 / exchangeRate))
          : 1;
        const convertedCost = Number(product.costPrice || 0) * rate;
        const hasPrice = (list: Pick<PriceList, 'code' | 'name'>) => product.prices?.[list.code] !== undefined && product.prices?.[list.code] !== null && product.prices?.[list.code] !== '';
        const retailList = effectivePriceLists.find((list) => list.code.toUpperCase() === 'RETAIL');
        const primaryList = (retailList && hasPrice(retailList) ? retailList : undefined) || effectivePriceLists.find(hasPrice);
        const primaryPrice = Number((primaryList ? product.prices?.[primaryList.code] : product.salePrice) || 0);
        const prices = Object.fromEntries(
          effectivePriceLists
            .map((list) => [list.code, product.prices?.[list.code]] as const)
            .filter(([, value]) => value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0),
        );

        const createdResponse = await inventoryService.createProduct({
          code: product.code,
          name: product.name,
          categoryId: product.categoryId,
          type: product.itemType || 'PRODUCT',
          ...(product.itemType === 'PRODUCT' ? { warehouseId: product.initialWarehouseId || undefined } : {}),
          trackInventory: product.itemType === 'PRODUCT',
          trackSeries: Boolean(product.trackSerialNumbers),
          trackBatch: Boolean(product.trackBatch),
          ...(canViewInventoryCost ? { costPrice: convertedCost } : {}),
          salePrice: primaryPrice * rate,
          salePriceOriginal: primaryPrice,
          priceCurrency: product.priceCurrency || baseCurrency,
          priceExchangeRate: Number(product.priceCurrency === baseCurrency ? 1 : exchangeRate),
          prices,
          priceSettings: Object.fromEntries(Object.entries(product.priceSettings || {})
            .filter(([code]) => Object.prototype.hasOwnProperty.call(prices, code))),
          taxRate: Number(product.taxRate ?? 0),
          trackSerialNumbers: Boolean(product.trackSerialNumbers),
          isActive: product.isActive !== false,
          description: product.description || '',
          commercialNote: product.commercialNote || '',
          ...(product.itemType === 'PRODUCT' ? { brand: product.brand || undefined } : {}),
          unit: product.unit || 'unidad',
          productClass: product.productClass || undefined,
          presentation: product.productClass ? (product.presentation || undefined) : undefined,
          minStock: Number(product.minStock || 0),
          maxStock: product.maxStock === '' ? undefined : Number(product.maxStock),
          itemType: product.itemType || 'PRODUCT',
          initialStock: product.isVariable ? getVariantStockTotal(product) : Number(product.initialStock || 0),
          variantInitialStocks: product.isVariable
            ? buildVariantCombinations(product.linkedAttributes).map((combination) => ({
              attributes: combination,
              quantity: Number(product.variantInitialStocks?.[variantCombinationKey(combination)] || 0),
              minStock: Number(product.variantMinStocks?.[variantCombinationKey(combination)] || 0),
              maxStock: product.variantMaxStocks?.[variantCombinationKey(combination)] === undefined || product.variantMaxStocks?.[variantCombinationKey(combination)] === ''
                ? undefined
                : Number(product.variantMaxStocks[variantCombinationKey(combination)]),
              prices: Object.fromEntries(
                effectivePriceLists
                  .map((list) => [list.code, product.variantPrices?.[variantCombinationKey(combination)]?.[list.code]] as const)
                  .filter(([, value]) => value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0),
              ),
              priceSettings: Object.fromEntries(Object.entries(product.variantPriceSettings?.[variantCombinationKey(combination)] || {})
                .filter(([code]) => Object.prototype.hasOwnProperty.call(product.variantPrices?.[variantCombinationKey(combination)] || {}, code))),
              costPrice: (() => {
                const rawCost = product.variantCostPrices?.[variantCombinationKey(combination)];
                return rawCost === undefined || rawCost === '' ? null : Number(rawCost) * rate;
              })(),
            }))
            : undefined,
           imageUrl: uploadedImageUri || product.imageUrl || undefined,
          isVariable: Boolean(product.isVariable),
          linkedAttributes: product.isVariable ? product.linkedAttributes : undefined,
          allowSimilarProductCreate: product.allowSimilarProductCreate === true,
        } as any);

        const created = (createdResponse as any)?.data || createdResponse;
        const createdId = created?.id;
        if (product.trackSerialNumbers && product.imeiNumber && product.imeiNumber.trim() && createdId) {
          try {
            await inventoryService.createSeries({ productId: createdId, number: product.imeiNumber.trim() });
          } catch (seriesErr) {
            console.error('Error creating serial number', seriesErr);
          }
        }
        successCount++;
      }
      toast.success(`${successCount} ${catalogItemType === 'SERVICE' ? 'servicio(s)' : 'producto(s)'} guardado(s) correctamente`);
      completeNotificationAction(actionToken);
      setProductsList([]);
      setDraftProduct({ ...defaultDraft, id: `draft-${Date.now()}`, categoryId: effectiveCategories[0]?.id || '' });
      setSimilarPendingProducts([]);
      setSimilarResolutions({});
      invalidatePendingSkuCheck();
      setSkuError('');
      setSkuConflictNeedsList(false);
      onOpenChange(false);
      onRefresh();
    } catch (error: any) {
      const similarMatches = (error?.data as any)?.matches;
      if (error?.code === 'PRODUCT_SIMILAR_MATCH' && Array.isArray(similarMatches) && similarMatches.length > 0) {
        const pendingProducts = listToSave.slice(successCount);
        const pendingListedProducts = productsList.slice(successCount);
        if (!handleExactSkuConflict(similarMatches, pendingProducts, pendingListedProducts)) {
          setSimilarGroups(similarMatches);
          setSimilarPendingProducts(pendingProducts);
          setProductsList(pendingProducts);
          setSimilarResolutions({});
        }
      } else {
        toast.error(error?.message || `Hubo un error guardando. Solo se guardaron ${successCount} ${catalogItemType === 'SERVICE' ? 'servicios' : 'productos'}.`);
      }
      failNotificationAction(actionToken);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (skuError || skuConflictNeedsList) {
      if (skuError && productsList.length > 0) setSkuConflictNeedsList(true);
      focusSkuInput();
      return;
    }

    const listToSave = productsList.map((product) => ({
      ...product,
      initialStock: product.isVariable ? getVariantStockTotal(product) : product.initialStock,
    }));

    if (productsList.length === 0) {
      if ((codeRequired && !draftProduct.code.trim()) || !draftProduct.name.trim() || (categoryRequired && !draftProduct.categoryId)) {
        toast.error(catalogItemType === 'SERVICE' ? 'El nombre del servicio es obligatorio' : 'Código, Nombre y Categoría son obligatorios');
        return;
      }
      if (!hasValidSellingPrice(draftProduct)) {
        toast.error('Ingresa al menos un precio de venta válido');
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
        if (!validateVariableStockDistribution(draftProduct)) return;
      }
      if (!draftProduct.isVariable && draftProduct.itemType === 'PRODUCT' && !draftProduct.initialWarehouseId) {
        toast.error('Debes seleccionar una Bodega para el producto');
        return;
      }
      if (draftProduct.isVariable && !draftProduct.initialWarehouseId) {
        toast.error('Debes seleccionar una Bodega para el producto');
        return;
      }
      listToSave.push({
        ...draftProduct,
        initialStock: draftProduct.isVariable ? getVariantStockTotal(draftProduct) : draftProduct.initialStock,
      });
    }

    if (listToSave.length === 0) return;
    for (const product of listToSave) {
      if (!validateVariableStockDistribution(product)) return;
    }
    if (!(await validateProductsStockAccounting(listToSave))) return;

    try {
      const response = await inventoryService.checkSimilarProducts(listToSave.map((product) => ({
        code: product.code,
        name: product.name,
        description: product.description,
        ...(product.itemType === 'PRODUCT' ? { brand: product.brand } : {}),
        categoryId: product.categoryId,
        categoryName: allCategories.find((category: any) => String(category.id) === String(product.categoryId))?.name,
        linkedAttributes: product.linkedAttributes,
        variants: product.isVariable ? buildVariantCombinations(product.linkedAttributes).map((attributes) => ({ attributes })) : undefined,
      })));
      const groups = response?.matches || [];
      if (groups.length > 0) {
        if (handleExactSkuConflict(groups, listToSave, productsList)) return;
        setSimilarGroups(groups);
        setSimilarPendingProducts(listToSave);
        setSimilarResolutions({});
        return;
      }
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo validar si el producto ya existe.');
      return;
    }
    await persistProducts(listToSave);
  };

  const resolveSimilarGroup = async (group: SimilarProductGroup, resolution: { action: 'USE_EXISTING' | 'CREATE_NEW'; match?: SimilarProductMatch }) => {
    if (resolution.action === 'CREATE_NEW') {
      const inputKey = normalizeSimilarityInputKey(group.inputKey);
      const exactSku = group.matches.some((match) => [
        match.code,
        match.sku,
        ...(match.variants || []).map((variant) => variant.sku),
      ].some((value) => normalizeSimilarityInputKey(value) === inputKey));
      if (exactSku) {
        handleExactSkuConflict([group], similarPendingProducts, productsList);
        return;
      }
    }
    const nextResolutions = { ...similarResolutions, [normalizeSimilarityInputKey(group.inputKey)]: resolution };
    const remainingGroups = similarGroups.filter((candidate) => normalizeSimilarityInputKey(candidate.inputKey) !== normalizeSimilarityInputKey(group.inputKey));
    setSimilarResolutions(nextResolutions);
    setSimilarGroups(remainingGroups);
    if (remainingGroups.length > 0) return;

    const selected = Object.values(nextResolutions).find((entry) => entry.action === 'USE_EXISTING' && entry.match)?.match;
    const similarityGroupKeys = new Set(similarGroups.map((candidate) => normalizeSimilarityInputKey(candidate.inputKey)));
    const productsToCreate = similarPendingProducts.filter((product) => {
      const key = normalizeSimilarityInputKey(product.code || product.name);
      return !similarityGroupKeys.has(key) || nextResolutions[key]?.action === 'CREATE_NEW';
    }).map((product) => ({ ...product, allowSimilarProductCreate: true }));
    setSimilarPendingProducts([]);
    setSimilarResolutions({});
    if (selected && onSelectExistingProduct) onSelectExistingProduct(selected);
    if (productsToCreate.length > 0) await persistProducts(productsToCreate);
    else if (selected) onOpenChange(false);
  };

  return (
    <>
    <Dialog modal={false} open={open} onOpenChange={(v) => { if (!isSaving) onOpenChange(v); }}>
      <DialogContent className={presentation === 'page'
        ? '!fixed !inset-0 !top-0 !left-0 !z-[60] !h-dvh !max-h-none !w-screen !max-w-none !translate-x-0 !translate-y-0 !gap-0 !overflow-hidden !rounded-none !border-0 !bg-background !p-4 !shadow-none !backdrop-blur-none sm:!p-6 lg:!p-10'
        : 'w-[calc(100vw-2rem)] !max-w-[min(95vw,1100px)] max-h-[min(88vh,calc(100dvh-3rem))] flex flex-col overflow-hidden'}>
        <DialogHeader data-tour="inventory-product-add-title">
          {presentation === 'page' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mb-1 w-fit -translate-x-2 rounded-lg px-2 text-xs font-bold text-muted-foreground hover:text-foreground"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              <ArrowLeft className="mr-2 size-4" /> Volver a productos
            </Button>
          )}
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
            copy={{ data: { description: catalogItemType === 'SERVICE' ? 'Completa nombre, categoría, moneda, costo y precios. El código es opcional y se asigna al guardar si lo dejas vacío.' : 'Completa código, nombre, categoría, moneda, costos, bodega y el stock de cada variante cuando corresponda.' }, items: { description: 'Revisa la lista de productos o servicios que agregarás en una sola operación.' }, actions: { description: 'Guarda uno o varios registros para incorporarlos al catálogo.' } }}
          />
        </DialogHeader>

        <div className={isPagePresentation ? 'min-h-0 flex-1 overflow-auto flex flex-col gap-3 p-0 xl:mx-auto xl:w-full xl:max-w-[1800px]' : 'flex-1 overflow-auto flex flex-col gap-6 p-1'} data-tour="inventory-product-add-data">
          {similarGroups.length > 0 && (
            <div
              ref={similarityDecisionPanelRef}
              tabIndex={-1}
              aria-label="Decisión sobre coincidencias de productos"
              className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-warning focus-visible:ring-offset-2"
            >
              <ProductSimilarityDecisionPanel
                groups={similarGroups}
                itemType={catalogItemType}
                canEditExistingProduct={canEditExistingProduct}
                onSelectExisting={(group, match) => { void resolveSimilarGroup(group, { action: 'USE_EXISTING', match }); }}
                onCreateNew={(group) => { void resolveSimilarGroup(group, { action: 'CREATE_NEW' }); }}
              />
            </div>
          )}
          
          {/* FORMULARIO SUPERIOR */}
          <div className={catalogItemType === 'SERVICE'
            ? 'grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-dashed bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-12'
            : isPagePresentation
              ? 'grid min-w-0 grid-cols-1 gap-2 rounded-xl border border-dashed bg-muted/30 p-3 sm:grid-cols-2 md:grid-cols-12'
              : 'grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-dashed bg-muted/30 p-4 sm:grid-cols-2 md:grid-cols-8'}>
            <div className={isPagePresentation
              ? catalogItemType === 'SERVICE'
                ? 'flex items-center justify-center sm:col-span-1 lg:col-span-1'
                : 'flex items-start justify-center sm:col-span-1 md:col-span-1 md:row-span-2 md:items-center md:pt-0'
              : catalogItemType === 'SERVICE'
                ? 'flex items-center justify-center sm:col-span-1 lg:col-span-1'
                : 'flex items-start justify-center sm:col-span-1 md:row-span-2 md:items-center md:pt-0'}>
              <ProductImagePicker
                src={draftProduct.imagePreviewUrl}
                productName={draftProduct.name}
                onSelect={handleImageSelected}
                onRemove={handleImageRemoved}
                className={catalogItemType === 'SERVICE' ? '!size-16 !rounded-xl' : '!size-24 !rounded-xl'}
              />
            </div>
              <div className={catalogItemType === 'SERVICE'
                ? 'col-span-1 min-w-0 lg:col-span-2'
                : isPagePresentation ? 'col-span-1 md:col-start-2 md:row-start-1 md:col-span-2' : 'col-span-1 md:col-start-2 md:row-start-1'}>
                <label className="text-[10px] uppercase font-bold text-muted-foreground">{catalogItemType === 'SERVICE' ? 'Código (opcional)' : 'Código/Sku *'}</label>
                <div className="flex flex-col gap-1 mt-1 w-full">
                  <Input
                    data-testid="inventory-product-code"
                    ref={skuInputRef}
                    aria-invalid={Boolean(skuError)}
                    aria-describedby={[
                      ...(skuError ? ['inventory-product-sku-error'] : []),
                      ...(skuConflictNeedsList ? ['inventory-product-sku-recovery-hint'] : []),
                    ].join(' ') || undefined}
                    value={draftProduct.code} 
                    onChange={e => handleUpdateDraft('code', e.target.value)} 
                    className={`h-8 text-xs font-mono w-full ${skuError ? 'border-warning focus-visible:ring-warning' : ''}`}
                    placeholder={catalogItemType === 'SERVICE' ? 'Código del servicio' : 'SKU-001'}
                  />
                  {skuError && <p id="inventory-product-sku-error" role="alert" className="text-xs text-warning leading-snug">{skuError}</p>}
                  {skuConflictNeedsList && <p id="inventory-product-sku-recovery-hint" role="status" className="text-xs text-muted-foreground leading-snug">Después de cambiar el SKU, agrega este producto a la lista para conservarlo en el lote.</p>}
                  {catalogItemType === 'SERVICE' && !skuError && !skuConflictNeedsList && <p className="text-[10px] leading-snug text-muted-foreground">Déjalo vacío para asignarlo automáticamente.</p>}
                </div>
              </div>
              <div className={catalogItemType === 'SERVICE'
                ? 'col-span-full min-w-0 sm:col-span-1 lg:col-span-4'
                : isPagePresentation ? 'sm:col-span-2 md:col-start-4 md:row-start-1 md:col-span-9' : 'sm:col-span-2 md:col-start-3 md:row-start-1 md:col-span-3'}>
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Nombre *</label>
                <Input
                  data-testid="inventory-product-name"
                  value={draftProduct.name} 
                  onChange={e => handleUpdateDraft('name', e.target.value)} 
                  className="h-8 text-xs mt-1" 
                    placeholder={`Nombre del ${catalogItemType === 'SERVICE' ? 'servicio' : 'producto'}`}
                />
              </div>
              {catalogItemType !== 'SERVICE' && <>
                <div className={isPagePresentation ? 'col-span-1 md:col-start-2 md:row-start-2 md:col-span-3' : 'col-span-1 md:col-start-6 md:row-start-1 md:col-span-3'}>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Marca</label>
                  <Combobox
                    value={draftProduct.brand}
                    onChange={value => handleUpdateDraft('brand', value)}
                    options={brandOptions}
                    allowCustomValue
                    searchPlaceholder="Buscar o escribir una marca..."
                    emptyMessage="No hay marcas registradas. Puedes escribir una nueva."
                    className="mt-1 !h-8 !rounded-none text-xs"
                    contentClassName="!z-[70] min-w-[320px]"
                    placeholder="Marca del producto"
                  />
                </div>
                <div className={isPagePresentation ? 'sm:col-span-2 md:col-start-5 md:row-start-2 md:col-span-4' : 'sm:col-span-2 md:col-start-2 md:row-start-2 md:col-span-4'}>
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
                    <div className="mt-1 flex min-w-0 gap-1.5">
                      <div data-testid="inventory-product-category" className="min-w-0 flex-1">
                        <Combobox
                          value={draftProduct.categoryId}
                          onChange={value => handleUpdateDraft('categoryId', value)}
                          options={categoryOptions}
                          searchPlaceholder="Buscar categoría..."
                          emptyMessage="No se encontraron categorías."
                          className="!h-8 w-full !rounded-none text-xs"
                          contentClassName="!z-[70] min-w-[360px]"
                          placeholder="Seleccionar categoría"
                        />
                      </div>
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
                <div className={isPagePresentation ? 'col-span-1 md:col-start-9 md:row-start-2 md:col-span-4' : 'col-span-1 md:col-start-6 md:row-start-2 md:col-span-3'}>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Unidad</label>
                  <Select value={draftProduct.unit || 'unidad'} onValueChange={v => handleUpdateDraft('unit', v)}>
                    <SelectTrigger className="h-8 !rounded-none text-xs mt-1"><SelectValue placeholder="Unidad" /></SelectTrigger>
                    <SelectContent className="!rounded-none">
                      <MeasureUnitItems units={catalogOptions.units} current={draftProduct.unit} />
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-full grid grid-cols-2 gap-3 md:grid-cols-4">
                  <ProductClassFields
                    classes={catalogOptions.classes}
                    productClass={draftProduct.productClass}
                    presentation={draftProduct.presentation}
                    onChange={(next) => setDraftProduct((prev: any) => ({ ...prev, ...next }))}
                  />
                </div>
              </>}
              {catalogItemType === 'SERVICE' && (
                <div className="col-span-full min-w-0 lg:col-span-5">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Categoría del servicio (opcional)</label>
                  {newCategoryOpen ? (
                    <div className="mt-1 space-y-1.5 rounded-lg border border-primary/40 bg-primary/5 p-2">
                      <Input
                        value={newCategoryName}
                        onChange={event => setNewCategoryName(event.target.value)}
                        className="h-8 text-xs"
                        placeholder="Nombre de la categoría"
                        autoFocus
                      />
                      <Input
                        value={newCategoryDesc}
                        onChange={event => setNewCategoryDesc(event.target.value)}
                        className="h-8 text-xs"
                        placeholder="Descripción (opcional)"
                      />
                      <div className="flex gap-2">
                        <Button type="button" size="sm" className="h-8 flex-1" onClick={handleCreateCategory} disabled={creatingCategory || !newCategoryName.trim()}>
                          {creatingCategory ? 'Creando…' : 'Crear categoría'}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => { setNewCategoryOpen(false); setNewCategoryName(''); setNewCategoryDesc(''); }}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 flex min-w-0 gap-2">
                      <div data-testid="inventory-service-category" className="min-w-0 flex-1">
                        <Combobox
                          value={draftProduct.categoryId}
                          onChange={value => handleUpdateDraft('categoryId', value)}
                          options={categoryOptions}
                          searchPlaceholder="Buscar categoría de servicio…"
                          emptyMessage="No se encontraron categorías de servicio."
                          className="!h-8 w-full !rounded-none text-xs"
                          contentClassName="!z-[70] min-w-[320px]"
                          placeholder="Seleccionar categoría"
                          ariaLabel="Categoría del servicio"
                        />
                      </div>
                      {canCreateServiceCategory && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-8 shrink-0 rounded-lg border-primary/30 text-primary hover:bg-primary/10"
                          onClick={() => setNewCategoryOpen(true)}
                          title="Crear categoría de servicio"
                          aria-label="Crear categoría de servicio"
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className={catalogItemType === 'SERVICE'
                ? 'col-span-full grid min-w-0 grid-cols-1 gap-2'
                : isPagePresentation
                  ? 'sm:col-span-2 md:col-start-1 md:row-start-3 md:col-span-12 md:grid md:grid-cols-2 md:gap-2'
                  : 'sm:col-span-2 md:col-start-1 md:row-start-3 md:col-span-8'}>
                <div className="min-w-0">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Descripción <span className="normal-case font-medium">(opcional)</span></label>
                  <Textarea
                    value={draftProduct.description}
                    onChange={e => handleUpdateDraft('description', e.target.value)}
                    className={catalogItemType === 'SERVICE' ? 'mt-1 min-h-12 text-xs' : isPagePresentation ? 'mt-1 min-h-12 text-xs' : 'mt-1 min-h-16 text-xs'}
                    placeholder={`Descripción del ${catalogItemType === 'SERVICE' ? 'servicio' : 'producto'}`}
                  />
                </div>
                <div className={catalogItemType === 'SERVICE' ? 'min-w-0' : isPagePresentation ? 'min-w-0' : 'mt-2'}>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Nota comercial <span className="normal-case font-medium">(opcional)</span></label>
                  <Textarea
                    value={draftProduct.commercialNote || ''}
                    onChange={e => handleUpdateDraft('commercialNote', Array.from(e.target.value).slice(0, 100).join(''))}
                    maxLength={100}
                    className={catalogItemType === 'SERVICE' ? 'mt-1 min-h-12 text-xs' : isPagePresentation ? 'mt-1 min-h-12 text-xs' : 'mt-1 min-h-14 text-xs'}
                    placeholder="Nota visible en ventas, compras y facturas"
                  />
                   <p className="mt-0.5 text-right text-[10px] text-muted-foreground">{Array.from(String(draftProduct.commercialNote || '')).length}/100</p>
                 </div>
              </div>
              {!itemType && <div className={isPagePresentation ? 'col-span-1 md:row-start-4 md:col-span-1' : 'col-span-1'}>
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Tipo</label>
                <Select value={draftProduct.itemType} onValueChange={v => handleUpdateDraft('itemType', v)}>
                  <SelectTrigger className="h-8 !rounded-none text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="!rounded-none">
                    <SelectItem value="PRODUCT">Producto</SelectItem>
                    <SelectItem value="SERVICE">Servicio</SelectItem>
                  </SelectContent>
                </Select>
              </div>}

              {catalogItemType !== 'SERVICE' && <div className={isPagePresentation ? 'col-span-1 md:row-start-4 md:col-span-1' : 'col-span-1'}>
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Variable</label>
                <Button
                  type="button"
                  variant={draftProduct.isVariable ? 'default' : 'outline'}
                  className={`h-8 w-full mt-1 text-[10px] uppercase tracking-wider gap-1.5 ${draftProduct.isVariable ? 'bg-primary text-primary-foreground' : ''}`}
                  onClick={() => {
                    handleUpdateDraft('isVariable', !draftProduct.isVariable);
                    if (!draftProduct.isVariable && draftProduct.linkedAttributes.length === 0) {
                      setDraftProduct((prev: any) => ({ ...prev, isVariable: true }));
                    }
                  }}
                >
                  <Tag className="size-3" />
                  {draftProduct.isVariable ? 'Sí' : 'No'}
                </Button>
              </div>}

              <div className={catalogItemType === 'SERVICE'
                ? 'col-span-1 min-w-0 lg:col-span-2'
                : isPagePresentation ? 'col-span-1 md:row-start-4 md:col-span-1' : 'col-span-1'}>
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Moneda</label>
                <Select value={draftProduct.priceCurrency} onValueChange={v => handleUpdateDraft('priceCurrency', v)}>
                  <SelectTrigger className="h-8 !rounded-none text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="!rounded-none">
                    <SelectItem value="NIO">NIO</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {canViewInventoryCost && <div className={catalogItemType === 'SERVICE'
                ? 'col-span-1 min-w-0 lg:col-span-2'
                : isPagePresentation ? 'col-span-1 md:row-start-4 md:col-span-2' : 'col-span-1'}>
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Costo</label>
                <Input
                  data-testid="inventory-product-cost"
                  type="number" min={0}
                  value={draftProduct.costPrice}
                  onChange={e => handleUpdateDraft('costPrice', e.target.value)}
                  className="h-8 text-xs text-right mt-1 tabular-nums"
                  placeholder="0.00" currencyPrecision />
              </div>}
              {effectivePriceLists.length > 0 && <div className="col-span-full flex min-w-0 flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Modo para todas las listas de precios</label>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Elige una vez y configura el valor de cada lista por separado.</p>
                </div>
                <PriceListPricingModeSelect
                  value={draftProduct.pricingMode || 'FIXED'}
                  onValueChange={updateProductPricingMode}
                  allowMargin={canViewInventoryCost}
                  disabled={isSaving}
                  ariaLabel="Modo de precio para todas las listas"
                  className="sm:w-52"
                />
              </div>}
              {catalogItemType === 'SERVICE' && effectivePriceLists.map((list) => (
                <div key={list.code} className="col-span-1 min-w-0 lg:col-span-2">
                  <PriceListPricingEditor
                    listName={list.name}
                    price={draftProduct.prices?.[list.code] ?? ''}
                    pricingMode={draftProduct.pricingMode || 'FIXED'}
                    marginPercent={draftProduct.priceSettings?.[list.code]?.marginPercent ?? ''}
                    cost={draftProduct.costPrice}
                    currency={draftProduct.priceCurrency || baseCurrency}
                    allowMargin={canViewInventoryCost}
                    disabled={isSaving}
                    inputTestId={`inventory-service-price-${list.code}`}
                    onPriceChange={(value) => updatePrice(list.code, value)}
                    onMarginPercentChange={(value) => updateMargin(list.code, value)}
                    onApplyMargin={(price) => applyListMargin(list.code, price)}
                  />
                </div>
              ))}
              {catalogItemType === 'SERVICE' && (
                <div className="col-span-1 min-w-0 lg:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Disponibilidad</label>
                  <Select value={draftProduct.isActive === false ? 'unavailable' : 'available'} onValueChange={v => handleUpdateDraft('isActive', v === 'available')}>
                    <SelectTrigger className="mt-1 h-8 w-full !rounded-none text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="!rounded-none">
                      <SelectItem value="available">Disponible</SelectItem>
                      <SelectItem value="unavailable">No disponible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {catalogItemType !== 'SERVICE' && effectivePriceLists.map((list) => (
                <div key={list.code} className={isPagePresentation ? 'col-span-1 md:row-start-4 md:col-span-2' : 'col-span-1'}>
                  <PriceListPricingEditor
                    listName={list.name}
                    price={draftProduct.prices?.[list.code] ?? ''}
                    pricingMode={draftProduct.pricingMode || 'FIXED'}
                    marginPercent={draftProduct.priceSettings?.[list.code]?.marginPercent ?? ''}
                    cost={draftProduct.costPrice}
                    currency={draftProduct.priceCurrency || baseCurrency}
                    allowMargin={canViewInventoryCost}
                    disabled={isSaving}
                    inputTestId={`inventory-product-price-${list.code}`}
                    onPriceChange={(value) => updatePrice(list.code, value)}
                    onMarginPercentChange={(value) => updateMargin(list.code, value)}
                    onApplyMargin={(price) => applyListMargin(list.code, price)}
                  />
                </div>
              ))}
              {catalogItemType !== 'SERVICE' && canViewInventoryCost && <MarginPriceSuggestion cost={draftProduct.costPrice} onApply={applySuggestedPrice} compact />}
               {catalogItemType !== 'SERVICE' && <div className={isPagePresentation ? 'col-span-1 md:row-start-4 md:col-span-2' : 'col-span-1'}>
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
               {catalogItemType !== 'SERVICE' && <div className={isPagePresentation ? 'col-span-1 md:row-start-4 md:col-span-2' : 'col-span-1'}>
                 <label className="text-[10px] uppercase font-bold text-muted-foreground">Lotes</label>
                 <Button
                   type="button"
                   variant={draftProduct.trackBatch ? 'default' : 'outline'}
                   className={`h-8 w-full mt-1 text-[10px] uppercase tracking-wider ${draftProduct.trackBatch ? 'bg-primary text-primary-foreground' : ''}`}
                   onClick={() => handleUpdateDraft('trackBatch', !draftProduct.trackBatch)}
                 >
                   {draftProduct.trackBatch ? 'Sí' : 'No'}
                 </Button>
               </div>}

              {catalogItemType !== 'SERVICE' && draftProduct.trackSerialNumbers && (
              <div className={isPagePresentation ? 'col-span-1 md:row-start-4 md:col-span-2' : 'col-span-1'}>
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
                  <div className={isPagePresentation ? 'sm:col-span-2 md:row-start-5 md:col-span-4' : 'sm:col-span-2'}>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Bodega (Stock Inicial)</label>
                    <div data-testid="inventory-product-warehouse">
                    <Select value={draftProduct.initialWarehouseId} onValueChange={handleInitialWarehouseChange}>
                      <SelectTrigger className="h-8 !rounded-none text-xs mt-1"><SelectValue placeholder="Bodega para ingreso" /></SelectTrigger>
                    <SelectContent className="!rounded-none">
                      {effectiveWarehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                    </Select>
                  </div>
                  </div>
                  <div className={isPagePresentation ? 'col-span-1 md:row-start-5 md:col-span-2' : 'col-span-1'}>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Stock Inicial</label>
                    <Input
                      data-testid="inventory-product-initial-stock"
                      type="number"
                      min={0}
                      value={draftProduct.initialStock}
                      onChange={e => handleUpdateDraft('initialStock', e.target.value)}
                      className="h-8 text-xs text-right mt-1 tabular-nums"
                    />
                  </div>
                  <div className={isPagePresentation ? 'col-span-1 md:row-start-5 md:col-span-3' : 'col-span-1'}>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Stock mínimo</label>
                    <Input type="number" min={0} value={draftProduct.minStock} onChange={e => handleUpdateDraft('minStock', e.target.value)} className="h-8 text-xs text-right mt-1 tabular-nums" />
                  </div>
                  <div className={isPagePresentation ? 'col-span-1 md:row-start-5 md:col-span-3' : 'col-span-1'}>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Stock máximo</label>
                    <Input type="number" min={0} value={draftProduct.maxStock} onChange={e => handleUpdateDraft('maxStock', e.target.value)} className="h-8 text-xs text-right mt-1 tabular-nums" />
                  </div>
                </>
                ) : (
                <>
                  <div className={isPagePresentation ? 'sm:col-span-2 md:row-start-5 md:col-span-4' : 'sm:col-span-2 md:col-span-4'}>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Bodega *</label>
                    <Select value={draftProduct.initialWarehouseId} onValueChange={handleInitialWarehouseChange}>
                      <SelectTrigger className="h-8 !rounded-none text-xs mt-1"><SelectValue placeholder="Bodega del producto" /></SelectTrigger>
                    <SelectContent className="!rounded-none">
                      {effectiveWarehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                    </Select>
                  </div>
                  <div className={isPagePresentation ? 'col-span-1 sm:col-span-2 md:row-start-5 md:col-span-8' : 'col-span-1 sm:col-span-2 md:col-span-2'}>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Stock total de variantes</label>
                    <Input
                      type="number"
                      min={0}
                      step="1"
                      value={allocatedVariantStock}
                      readOnly
                      disabled
                      aria-label="Stock total calculado de las variantes"
                      title="Se calcula sumando el stock de cada variante"
                      className="h-8 text-xs text-right mt-1 tabular-nums bg-muted/50 text-muted-foreground cursor-not-allowed"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">Se calcula sumando el stock de cada variante.</p>
                  </div>
                </>
                )
              ) : null}
              
              <div className={catalogItemType === 'SERVICE'
                ? 'col-span-full flex justify-end'
                : `sm:col-span-2 ${isPagePresentation ? 'md:col-span-12 md:row-start-6' : 'md:col-span-8'} flex justify-end`}>
                <Button data-testid="inventory-product-add-to-list" onClick={handleAddToList} className="h-8 text-xs font-bold" variant="secondary" disabled={isCheckingAccounting || isSaving}>
                  <Plus className="size-3 mr-2" />
                  {isCheckingAccounting ? 'Validando contabilidad...' : 'Agregar a la lista'}
                </Button>
              </div>

          </div>

          {/* CONFIGURACIÓN DE VARIANTES (solo productos variables) */}
          {draftProduct.isVariable && (
            <div className={isPagePresentation ? 'rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 space-y-3' : 'rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 space-y-4'}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <Tag className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-primary">Configurar variantes</h4>
                    <p className="mt-1 text-[10px] text-muted-foreground">Elige primero los atributos y después los valores que tendrá cada producto.</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {getSelectedAttributes().length > 0 && (
                    <Badge variant="outline" className="text-[9px] tabular-nums">
                      {getSelectedAttributes().length} atributo{getSelectedAttributes().length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[9px] tabular-nums">
                    {variantCombinations.length} variante{variantCombinations.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>

              {catalogAttributes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 bg-background/50 p-4 text-center">
                  <p className="text-xs text-muted-foreground">No hay atributos creados.</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Crea atributos desde <span className="font-bold text-primary">Inventario → Atributos</span> primero.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <section className="rounded-lg border border-border/60 bg-background/60 p-3">
                    <button
                      type="button"
                      className="flex w-full min-w-0 items-center justify-between gap-3 text-left"
                      onClick={() => setAttributesStepExpanded((expanded) => !expanded)}
                      aria-expanded={attributesStepExpanded}
                    >
                      <span className="flex min-w-0 items-start gap-2">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">1</span>
                        <span className="min-w-0">
                          <span className="block text-[10px] font-black uppercase tracking-wider text-foreground">Elige los atributos</span>
                          <span className="mt-0.5 block text-[10px] text-muted-foreground">Ejemplo: Color, talla o capacidad.</span>
                        </span>
                      </span>
                      <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${attributesStepExpanded ? 'rotate-180 text-primary' : ''}`} />
                    </button>
                    {attributesStepExpanded && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {catalogAttributes.filter((attr: any) => !draftProduct.linkedAttributes.some((la: any) => la.attributeId === attr.id)).map((attr: any) => (
                          <Button
                            key={attr.id}
                            type="button"
                            variant="outline"
                            className="h-auto min-w-0 justify-between gap-2 rounded-lg px-3 py-2 text-left"
                            onClick={() => toggleAttribute(attr.id)}
                          >
                            <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-wide">{attr.name}</span>
                            <span className="shrink-0 text-[9px] text-muted-foreground">{attr.options?.length || 0} valores</span>
                            <Plus className="size-3.5 shrink-0 text-primary" />
                          </Button>
                        ))}
                        {catalogAttributes.every((attr: any) => draftProduct.linkedAttributes.some((la: any) => la.attributeId === attr.id)) && (
                          <p className="text-[10px] text-muted-foreground sm:col-span-2 lg:col-span-3 xl:col-span-4">Ya seleccionaste todos los atributos disponibles.</p>
                        )}
                      </div>
                    )}
                  </section>

                  {getSelectedAttributes().length > 0 && (
                    <section className="rounded-lg border border-border/60 bg-background/60 p-3">
                      <button
                        type="button"
                        className="flex w-full min-w-0 items-center justify-between gap-3 text-left"
                        onClick={() => setValuesStepExpanded((expanded) => !expanded)}
                        aria-expanded={valuesStepExpanded}
                      >
                        <span className="flex min-w-0 items-start gap-2">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">2</span>
                          <span className="min-w-0">
                            <span className="block text-[10px] font-black uppercase tracking-wider text-foreground">Selecciona los valores</span>
                            <span className="mt-0.5 block text-[10px] text-muted-foreground">Abre cada atributo y marca solo las opciones que realmente venderás.</span>
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <Badge variant="secondary" className="text-[9px] tabular-nums">{getSelectedAttributes().length} atributo{getSelectedAttributes().length !== 1 ? 's' : ''}</Badge>
                          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${valuesStepExpanded ? 'rotate-180 text-primary' : ''}`} />
                        </span>
                      </button>
                      {valuesStepExpanded && <div className="mt-2 space-y-2">
                        {getSelectedAttributes().map((attr: any) => {
                          const linked = draftProduct.linkedAttributes.find((la: any) => la.attributeId === attr.id);
                          const isExpanded = expandedAttributeId === attr.id;
                          const selectedCount = linked?.selectedOptions?.length || 0;
                          return (
                            <div key={attr.id} className="overflow-hidden rounded-lg border border-border/60 bg-card">
                              <div className="flex min-w-0 items-center gap-2 px-3 py-2">
                                <button
                                  type="button"
                                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                  onClick={() => setExpandedAttributeId(isExpanded ? null : attr.id)}
                                  aria-expanded={isExpanded}
                                >
                                  <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180 text-primary' : ''}`} />
                                  <span className="min-w-0 truncate text-xs font-bold uppercase tracking-wide">{attr.name}</span>
                                  <Badge variant={selectedCount > 0 ? 'secondary' : 'outline'} className="shrink-0 text-[9px] tabular-nums">
                                    {selectedCount} de {attr.options?.length || 0}
                                  </Badge>
                                </button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => toggleAttribute(attr.id)}
                                  aria-label={`Quitar atributo ${attr.name}`}
                                  title="Quitar atributo"
                                >
                                  <X className="size-3.5" />
                                </Button>
                              </div>
                              {isExpanded && (
                                <div className="border-t border-border/60 bg-muted/20 px-3 py-3">
                                  {Array.isArray(attr.options) && attr.options.length > 0 ? (
                                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                      {attr.options.map((opt: string, index: number) => {
                                        const isOptSelected = linked?.selectedOptions?.includes(opt);
                                        return (
                                          <button
                                            key={`${attr.id}-${index}`}
                                            type="button"
                                            aria-pressed={isOptSelected}
                                            onClick={() => toggleAttributeOption(attr.id, opt)}
                                            className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-[10px] font-bold transition-colors ${
                                              isOptSelected
                                                ? 'border-primary/50 bg-primary text-primary-foreground shadow-sm'
                                                : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                                            }`}
                                          >
                                            <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${isOptSelected ? 'border-primary-foreground/70' : 'border-muted-foreground/40'}`}>
                                              {isOptSelected && <Check className="size-2.5" />}
                                            </span>
                                            <span className="min-w-0 truncate">{opt}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-muted-foreground">Este atributo todavía no tiene valores configurados.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>}
                    </section>
                  )}
                </div>
              )}

              {variantCombinations.length > 0 && (
                <section className={isPagePresentation ? 'rounded-lg border border-primary/25 bg-background/80 p-3' : 'rounded-lg border border-primary/25 bg-background/80 p-3'}>
                  <button
                    type="button"
                    className="flex w-full min-w-0 items-center justify-between gap-3 text-left"
                    onClick={() => setVariantsExpanded((expanded) => !expanded)}
                    aria-expanded={variantsExpanded}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">3</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[10px] font-black uppercase tracking-wider text-foreground">Revisa las variantes generadas</span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">Aquí puedes definir stock, costos y precios por variante. Todas usarán la bodega del producto.</span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant="secondary" className="text-[9px] tabular-nums">{allocatedVariantStock} unidades</Badge>
                      <ChevronDown className={`size-4 text-muted-foreground transition-transform ${variantsExpanded ? 'rotate-180' : ''}`} />
                    </span>
                  </button>

                  {variantsExpanded && (
                    <div className="mt-3 space-y-2">
                      <div className="rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground">
                        El SKU de cada variante se genera automáticamente con el SKU padre y sus valores. Ejemplo: <span className="font-mono font-bold text-foreground">{draftProduct.code.trim() || 'SKU-PADRE'}-ROJO-M</span>.
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {variantCombinations.map((combination) => {
                          const key = variantCombinationKey(combination);
                          const combinationLabel = combination.map((attribute) => attribute.value).join(' / ');
                          return (
                            <div key={key} className="min-w-0 rounded-xl border border-border/60 bg-card p-3 shadow-sm">
                              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-bold text-foreground" title={combinationLabel}>{combinationLabel}</p>
                                  <p className="mt-1 flex min-w-0 flex-wrap items-center gap-1 text-[9px] text-muted-foreground">
                                    <span>SKU generado:</span>
                                    <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono font-bold text-foreground">{variantSkuPreviews[key]}</code>
                                  </p>
                                </div>
                                <Badge variant="outline" className="shrink-0 text-[9px]">Variante</Badge>
                              </div>
                              <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
                                <div className="min-w-0">
                                  <span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Stock</span>
                                  <Input type="number" min={0} step="1" value={draftProduct.variantInitialStocks?.[key] || ''} onChange={(e) => updateVariantInitialStock(combination, e.target.value)} className="h-8 w-full text-right text-xs tabular-nums" aria-label={`Stock inicial para ${combinationLabel}`} />
                                </div>
                                <div className="min-w-0">
                                  <span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Mín.</span>
                                  <Input type="number" min={0} value={draftProduct.variantMinStocks?.[key] ?? ''} onChange={(e) => updateVariantStockThreshold('min', combination, e.target.value)} className="h-8 w-full text-right text-xs tabular-nums" aria-label={`Stock mínimo para ${combinationLabel}`} />
                                </div>
                                <div className="min-w-0">
                                  <span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Máx.</span>
                                  <Input type="number" min={0} value={draftProduct.variantMaxStocks?.[key] ?? ''} onChange={(e) => updateVariantStockThreshold('max', combination, e.target.value)} className="h-8 w-full text-right text-xs tabular-nums" aria-label={`Stock máximo para ${combinationLabel}`} />
                                </div>
                                {canViewInventoryCost && <div className="min-w-0">
                                  <span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Costo propio</span>
                                  <Input type="number" min={0} step="any" value={draftProduct.variantCostPrices?.[key] ?? ''} onChange={(e) => updateVariantCostPrice(combination, e.target.value)} className="h-8 w-full text-right text-xs tabular-nums" placeholder="Hereda base" aria-label={`Costo propio para ${combinationLabel}`} currencyPrecision />
                                </div>}
                                {effectivePriceLists.map((list) => <PriceListPricingEditor
                                  key={list.code}
                                  listName={list.name}
                                  price={draftProduct.variantPrices?.[key]?.[list.code] ?? ''}
                                  pricingMode={draftProduct.pricingMode || 'FIXED'}
                                  marginPercent={draftProduct.variantPriceSettings?.[key]?.[list.code]?.marginPercent ?? ''}
                                  cost={draftProduct.variantCostPrices?.[key] ?? draftProduct.costPrice}
                                  currency={draftProduct.priceCurrency || baseCurrency}
                                  allowMargin={canViewInventoryCost}
                                  disabled={isSaving}
                                  onPriceChange={(value) => updateVariantPrice(combination, list.code, value)}
                                  onMarginPercentChange={(value) => updateVariantMargin(combination, list.code, value)}
                                  onApplyMargin={(price) => applyVariantMargin(combination, list.code, price)}
                                />)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}

          {/* TABLA INFERIOR */}
          {productsList.length > 1 && canViewInventoryCost && <BulkMarginBar count={productsList.length} onApply={applyMarginToList} />}
          {productsList.length > 0 && (
            <div className="sales-responsive-table border rounded-md bg-card flex-1 overflow-auto min-h-[200px]" data-tour="inventory-product-add-items">
               <Table>
                 <TableHeader className="bg-muted sticky top-0 z-10 shadow-sm">
                 <TableRow>
                   <TableHead className="text-[10px] uppercase w-8"></TableHead>
                          <TableHead className="text-[10px] uppercase">Código/Sku</TableHead>
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
                          {product.itemType === 'SERVICE' ? '-' : product.isVariable ? `${Number(product.initialStock || 0)} total · ${(() => {
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
                           className="size-6 text-destructive hover:text-destructive-foreground hover:bg-destructive"
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving || isCheckingAccounting}>
            Cancelar
          </Button>
          <Button
            data-testid="inventory-product-save"
            onClick={handleSave} 
            disabled={isSaving || isCheckingAccounting || skuConflictNeedsList || (productsList.length === 0 && ((codeRequired && !draftProduct.code.trim()) || !draftProduct.name.trim()))}
            className="font-bold bg-primary text-primary-foreground"
          >
            {isSaving ? 'Guardando...' : (productsList.length > 0 ? `Guardar ${productsList.length} ${catalogItemType === 'SERVICE' ? 'servicio(s)' : 'producto(s)'}` : `Guardar ${catalogItemType === 'SERVICE' ? 'servicio' : 'producto'}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
