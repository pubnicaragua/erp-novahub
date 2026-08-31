import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { priceListsService } from '../../services/price-lists.service';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { getSalesLinePriceListId, getSalesUnitPrice, hasSalesProductPriceListConflict, resolveVariantPrice, sameSalesId, unwrapSalesPriceListMatrix } from '../../utils/salesPriceList';


interface SalesLinePriceListSelectProps {
  productId?: string | null;
  variantId?: string | null;
  productCode?: string | null;
  productName?: string | null;
  itemType?: string | null;
  value?: string | null;
  defaultPriceListId?: string | null;
  /** Precio base del catálogo, usado únicamente como respaldo de Minorista mientras se sincroniza la matriz. */
  fallbackPrice?: number;
  currency?: string;
  exchangeRate?: number;
  disabled?: boolean;
  /** Líneas del documento para impedir repetir producto+lista desde cualquier orden de selección. */
  lineItems?: Array<{ productId?: string | null; variantId?: string | null; priceListId?: string | null }>;
  lineIndex?: number;
  onChange: (priceListId: string, result: { unitPrice?: number; priceMissing: boolean }, source?: 'initial' | 'user') => void;
}

/** Selector compacto para elegir la tarifa comercial de una línea y devolver su precio bloqueado. */
export function SalesLinePriceListSelect({ productId, variantId, productCode, productName, itemType, value, defaultPriceListId, fallbackPrice, currency = 'NIO', exchangeRate = 1, disabled, lineItems = [], lineIndex = -1, onChange }: SalesLinePriceListSelectProps) {
  const { user, canPerform } = useAuth();
  const query = useQuery({
    queryKey: ['sales', 'price-lists', 'matrix', user?.tenantId || 'anonymous'],
    queryFn: ({ signal }) => priceListsService.getMatrix(signal),
    enabled: Boolean(user?.tenantId) && canPerform('SALES_PRICE_LISTS', 'view'),
    staleTime: 60_000,
  });

  const matrix = useMemo(() => {
    return unwrapSalesPriceListMatrix(query.data);
  }, [query.data]);

  const lists = Array.isArray(matrix?.lists) ? matrix.lists : [];
  const matrixItems = Array.isArray(matrix?.items) ? matrix.items : [];
  const matrixProduct = matrix.products.find((product: any) =>
    sameSalesId(product.code, productCode) || sameSalesId(product.id, productId),
  ) || matrix.products.find((product: any) =>
    String(product.name || '').trim().toLowerCase() === String(productName || '').trim().toLowerCase(),
  );
  const isService = String(matrixProduct?.itemType || matrixProduct?.type || itemType || '').toUpperCase() === 'SERVICE';

  const inheritedPriceListId = lists.some((list: any) => sameSalesId(list.id, defaultPriceListId))
    ? defaultPriceListId
    : lists.find((list: any) => list.isDefault)?.id || lists[0]?.id || '';
  const blockedPriceListIds = useMemo(() => new Set(
    lineItems
      .filter((line, index) => index !== lineIndex && sameSalesId(line?.productId, productId) && String(line?.variantId || '') === String(variantId || ''))
      .map((line) => getSalesLinePriceListId(line, inheritedPriceListId))
      .filter(Boolean)
      .map((id) => String(id)),
  ), [lineItems, lineIndex, productId, variantId, inheritedPriceListId]);

  // Lista resuelta: la asignada al item, la de la orden, la default o la primera.
  // Si la lista heredada ya está ocupada por el mismo producto, se elige una
  // alternativa libre; nunca se aplica silenciosamente el par duplicado.
  const requestedListId = value || defaultPriceListId || '';
  const preferredListId = lists.some((list: any) => sameSalesId(list.id, requestedListId))
    ? requestedListId
    : inheritedPriceListId;
  const keepsExistingValue = Boolean(
    value
    && lists.some((list: any) => sameSalesId(list.id, value))
    && !blockedPriceListIds.has(String(value)),
  );
  const resolvedListId = keepsExistingValue
    ? String(value)
    : !blockedPriceListIds.has(String(preferredListId))
      ? preferredListId
      : lists.find((list: any) => !blockedPriceListIds.has(String(list.id)))?.id || '';

  /** Calcula el precio para un producto/variant+lista dados */
  const calcPrice = (priceListId: string, pid: string | null | undefined): { unitPrice?: number; priceMissing: boolean } => {
    if (!pid) return { priceMissing: false };

    if (variantId) {
      const resolved = resolveVariantPrice(matrixItems, priceListId, pid, variantId);
      if (resolved) {
        const unitPrice = getSalesUnitPrice(resolved, currency, exchangeRate);
        if (unitPrice !== undefined && unitPrice > 0) return { unitPrice, priceMissing: false };
      }
    }

    const matchedProduct = matrixProduct || matrix.products.find((product: any) => sameSalesId(product.id, pid));
    const matrixProductId = matchedProduct?.id;
    const entry = matrixItems.find((item: any) => {
      if (!sameSalesId(item.priceListId, priceListId)) return false;
      const itemProductId = item.productId ?? item.product?.id;
      return (sameSalesId(itemProductId, pid) || sameSalesId(itemProductId, matrixProductId)) && (!item.variantId || item.variantId === null);
    });
    if (!entry) {
      const selectedList = lists.find((list: any) => sameSalesId(list.id, priceListId));
      const canUseRetailFallback = (
        String(selectedList?.code || '').toUpperCase() === 'RETAIL'
        || String(selectedList?.name || '').trim().toLowerCase() === 'minorista'
      ) && Number(fallbackPrice) > 0;
      if (canUseRetailFallback) {
        const unitPrice = String(currency).toUpperCase() === 'USD'
          ? Number(fallbackPrice) / Math.max(Number(exchangeRate) || 1, 0.000001)
          : Number(fallbackPrice);
        return { unitPrice, priceMissing: false };
      }
      return { unitPrice: 0, priceMissing: true };
    }

    const unitPrice = getSalesUnitPrice(entry, currency, exchangeRate);
    if (unitPrice === undefined) return { unitPrice: 0, priceMissing: true };
    return { unitPrice, priceMissing: false };
  };

  // Solo notificar el precio inicial cuando la matriz carga por primera vez
  const initialAppliedRef = useRef<string>('');
  const latestOnChange = useRef(onChange);
  useEffect(() => {
    latestOnChange.current = onChange;
  });

  useEffect(() => {
    if (isService || !query.isSuccess || !lists.length || !matrix || !productId || !resolvedListId || matrixItems.length === 0) return;

    const key = `${productId}_${variantId || ''}_${resolvedListId}_${currency}_${Math.round((exchangeRate || 1) * 10000)}_${matrixItems.length}`;
    if (initialAppliedRef.current === key) return;
    initialAppliedRef.current = key;

    const result = calcPrice(resolvedListId, productId);
    latestOnChange.current(resolvedListId, result, 'initial');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isSuccess, lists.length, matrix, matrixItems.length, productId, variantId, resolvedListId, currency, exchangeRate, isService]);

  if (isService) return null;

  /** Cuando el usuario elige explícitamente un tipo de precio */
  const handleUserSelect = (priceListId: string) => {
    if (hasSalesProductPriceListConflict(lineItems, productId, priceListId, lineIndex, inheritedPriceListId, variantId)) return;
    const result = calcPrice(priceListId, productId);
    latestOnChange.current(priceListId, result, 'user');
  };

  return (
    <div className="flex w-[7rem] min-w-0 shrink-0 items-center gap-1">
      <Select value={resolvedListId || ''} onValueChange={handleUserSelect} disabled={disabled || query.isLoading || !lists.length}>
        <SelectTrigger className="h-7 w-[7rem] min-w-0 truncate px-2 text-[9px]" aria-label="Tipo de precio">
          <SelectValue placeholder="Tipo de precio" />
        </SelectTrigger>
        <SelectContent>
          {lists.map((list) => {
            const blocked = blockedPriceListIds.has(String(list.id)) && !sameSalesId(list.id, resolvedListId);
            return <SelectItem key={list.id} value={list.id} disabled={blocked}>
              {list.name}{blocked ? ' · Ya utilizada para este producto' : ''}
            </SelectItem>;
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

export function PriceMissingBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-black uppercase text-rose-500 bg-rose-500/10 border border-rose-500/20", className)}>
      <AlertTriangle className="size-3 shrink-0" />
      Sin precio en esta lista · selecciona otra
    </span>
  );
}
