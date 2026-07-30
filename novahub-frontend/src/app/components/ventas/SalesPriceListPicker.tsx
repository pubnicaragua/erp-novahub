import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { priceListsService, type PriceList } from '../../services/price-lists.service';
import { useAuth } from '../../contexts/AuthContext';
import { getSalesUnitPrice, sameSalesId, unwrapSalesPriceListMatrix } from '../../utils/salesPriceList';

type Line = { productId?: string | null; unitPrice?: number; quantity?: number; total?: number; [key: string]: any };

interface SalesPriceListPickerProps {
  customer?: { priceListId?: string | null; priceList?: { id: string } | null } | null;
  value?: string | null;
  items: Line[];
  currency?: string;
  exchangeRate?: number;
  disabled?: boolean;
  onChange: (priceListId: string, items: Line[], missingProductIds: string[]) => void;
}

/** Selecciona la tarifa comercial y aplica sus precios sin permitir edición manual. */
export function SalesPriceListPicker({ customer, value, items, currency = 'NIO', exchangeRate = 1, disabled, onChange }: SalesPriceListPickerProps) {
  const { user } = useAuth();
  const matrixQuery = useQuery({
    queryKey: ['sales', 'price-lists', 'matrix', user?.tenantId || 'anonymous'],
    queryFn: priceListsService.getMatrix,
    enabled: Boolean(user?.tenantId),
    staleTime: 60_000,
  });
  const matrix = useMemo(() => unwrapSalesPriceListMatrix(matrixQuery.data), [matrixQuery.data]);
  const lists = matrix.lists;
  const customerListId = customer?.priceListId || customer?.priceList?.id;
  const requestedListId = value || customerListId;
  const resolvedValue = lists.some((list) => sameSalesId(list.id, requestedListId))
    ? requestedListId
    : lists.find((list) => list.isDefault)?.id || lists[0]?.id || '';
  const prices = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of matrix.items) {
      if (sameSalesId(item.priceListId, resolvedValue)) {
        const price = getSalesUnitPrice(item, currency, exchangeRate);
        if (price !== undefined) map.set(String(item.productId), price);
      }
    }
    return map;
  }, [matrix.items, resolvedValue, currency, exchangeRate]);

  const apply = (priceListId: string) => {
    const nextPrices = new Map<string, number>();
    for (const item of matrix.items) {
      if (sameSalesId(item.priceListId, priceListId)) {
        const price = getSalesUnitPrice(item, currency, exchangeRate);
        if (price !== undefined) nextPrices.set(String(item.productId), price);
      }
    }
    const missing: string[] = [];
    const nextItems = items.map((item) => {
      if (!item.productId) return item;
      const base = nextPrices.get(String(item.productId));
      if (base === undefined) { missing.push(item.productId); return { ...item, priceListId, unitPrice: 0, total: 0, priceMissing: true }; }
      return { ...item, priceListId, unitPrice: base, total: Number(item.quantity || 1) * base, priceMissing: false };
    });
    onChange(priceListId, nextItems, missing);
  };

  useEffect(() => {
    if (!resolvedValue || value || !lists.length || !matrix.items.length) return;
    apply(resolvedValue);
  // Sólo inicializa cuando cambian cliente/listas; aplicar también en cada render sobrescribiría cantidades.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerListId, lists.length, resolvedValue, matrix.items.length]);

  const missingCount = items.filter((item) => item.productId && !prices.has(item.productId)).length;
  return <div className="flex min-w-0 flex-wrap items-center gap-2">
    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lista de precios</span>
    <Select value={resolvedValue} onValueChange={apply} disabled={disabled || !lists.length || matrixQuery.isLoading}>
      <SelectTrigger className="h-9 w-52"><SelectValue placeholder="Cargando listas…" /></SelectTrigger>
      <SelectContent>{lists.map((list: PriceList) => <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>)}</SelectContent>
    </Select>
    {missingCount > 0 && <Badge variant="outline" className="border-rose-500/40 text-rose-600"><AlertTriangle className="mr-1 size-3" />{missingCount} sin precio</Badge>}
  </div>;
}
