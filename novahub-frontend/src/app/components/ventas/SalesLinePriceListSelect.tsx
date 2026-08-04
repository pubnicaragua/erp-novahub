import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { priceListsService } from '../../services/price-lists.service';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { getSalesUnitPrice, sameSalesId, unwrapSalesPriceListMatrix } from '../../utils/salesPriceList';


interface SalesLinePriceListSelectProps {
  productId?: string | null;
  productCode?: string | null;
  productName?: string | null;
  itemType?: string | null;
  value?: string | null;
  defaultPriceListId?: string | null;
  currency?: string;
  exchangeRate?: number;
  disabled?: boolean;
  onChange: (priceListId: string, result: { unitPrice?: number; priceMissing: boolean }, source?: 'initial' | 'user') => void;
}

/** Selector compacto para elegir la tarifa comercial de una línea y devolver su precio bloqueado. */
export function SalesLinePriceListSelect({ productId, productCode, productName, itemType, value, defaultPriceListId, currency = 'NIO', exchangeRate = 1, disabled, onChange }: SalesLinePriceListSelectProps) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['sales', 'price-lists', 'matrix', user?.tenantId || 'anonymous'],
    queryFn: ({ signal }) => priceListsService.getMatrix(signal),
    enabled: Boolean(user?.tenantId),
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
  const isService = String(itemType || matrixProduct?.itemType || matrixProduct?.type || '').toUpperCase() === 'SERVICE';

  // Lista resuelta: la asignada al item, la de la orden, la default o la primera
  const requestedListId = value || defaultPriceListId || '';
  const resolvedListId = lists.some((list: any) => sameSalesId(list.id, requestedListId))
    ? requestedListId
    : lists.find((list: any) => list.isDefault)?.id || lists[0]?.id || '';

  /** Calcula el precio para un productId+lista dados */
  const calcPrice = (priceListId: string, pid: string | null | undefined): { unitPrice?: number; priceMissing: boolean } => {
    if (!pid) return { priceMissing: false };
    const matchedProduct = matrixProduct || matrix.products.find((product: any) => sameSalesId(product.id, pid));
    const matrixProductId = matchedProduct?.id;
    const entry = matrixItems.find((item: any) => {
      if (!sameSalesId(item.priceListId, priceListId)) return false;
      const itemProductId = item.productId ?? item.product?.id;
      return sameSalesId(itemProductId, pid) || sameSalesId(itemProductId, matrixProductId);
    });
    if (!entry) return { unitPrice: 0, priceMissing: true };

    const unitPrice = getSalesUnitPrice(entry, currency, exchangeRate);
    if (unitPrice === undefined) return { unitPrice: 0, priceMissing: true };
    return { unitPrice, priceMissing: false };
  };

  // Solo notificar el precio inicial cuando la matriz carga por primera vez
  // La key incluye matrixItems.length para re-disparar cuando la data llega
  // (si el effect corre con items=[] y luego llegan, la key cambia y re-evalúa)
  const initialAppliedRef = useRef<string>('');
  const latestOnChange = useRef(onChange);
  latestOnChange.current = onChange;

  useEffect(() => {
    // Esperar a que la matriz tenga datos reales antes de aplicar
    if (isService || !query.isSuccess || !lists.length || !matrix || !productId || !resolvedListId || matrixItems.length === 0) return;

    // Key incluye matrixItems.length: cuando items cargan (0→N) la key cambia y re-evalúa
    const key = `${productId}_${resolvedListId}_${currency}_${Math.round((exchangeRate || 1) * 10000)}_${matrixItems.length}`;
    if (initialAppliedRef.current === key) return;
    initialAppliedRef.current = key;

    const result = calcPrice(resolvedListId, productId);
    latestOnChange.current(resolvedListId, result, 'initial');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isSuccess, lists.length, matrix, matrixItems.length, productId, resolvedListId, currency, exchangeRate, isService]);

  if (isService) return null;

  /** Cuando el usuario elige explícitamente un tipo de precio */
  const handleUserSelect = (priceListId: string) => {
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
          {lists.map((list) => <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>)}
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
