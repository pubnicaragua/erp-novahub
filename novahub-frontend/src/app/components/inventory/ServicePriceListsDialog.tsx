import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Tags } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from '@/app/services/toast';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { priceListsService, type PriceList } from '../../services/price-lists.service';

interface ServicePriceListsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: { id: string; code?: string; name: string } | null;
  onSaved?: () => void;
}

interface ServicePriceDraft {
  price: string;
  currency: string;
  exchangeRate: number;
}

export function ServicePriceListsDialog({ open, onOpenChange, service, onSaved }: ServicePriceListsDialogProps) {
  const { user, canPerform } = useAuth();
  const { baseCurrency, exchangeRate } = useCurrency();
  const queryClient = useQueryClient();
  const tenantKey = user?.tenantId || 'anonymous';
  const canRead = canPerform('SALES_PRICE_LISTS', 'view');
  const serviceMatrix = useQuery({
    queryKey: ['sales', 'price-lists', 'services', tenantKey],
    queryFn: ({ signal }) => priceListsService.getServiceMatrix(signal),
    enabled: open && Boolean(user?.tenantId) && canRead,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const payload = (serviceMatrix.data as any)?.data || serviceMatrix.data;
  const serviceRecord = payload?.services?.find((entry: any) => String(entry.id) === String(service?.id));
  const rows = useMemo(() => {
    const lists: PriceList[] = Array.isArray(payload?.lists) ? payload.lists : [];
    const items = Array.isArray(payload?.items) ? payload.items : [];
    if (!serviceRecord || !service) return [];
    return lists.filter((list) => list.isActive !== false).map((list) => {
      const item = items.find((entry: any) =>
        String(entry.productId) === String(service.id)
        && String(entry.priceListId) === String(list.id)
        && !entry.variantId,
      );
      const isRetail = String(list.code || '').toUpperCase() === 'RETAIL'
        || String(list.name || '').trim().toLowerCase() === 'minorista'
        || Boolean(list.isDefault);
      const currency = String(item?.currency || serviceRecord.priceCurrency || baseCurrency).toUpperCase();
      const rate = Number(item?.exchangeRate || serviceRecord.priceExchangeRate || (currency === baseCurrency ? 1 : exchangeRate || 1));
      const catalogBasePrice = Number(serviceRecord.salePrice || 0);
      const catalogOriginalPrice = Number(serviceRecord.salePriceOriginal || 0);
      const catalogRetailPrice = catalogOriginalPrice > 0 || catalogBasePrice <= 0
        ? catalogOriginalPrice
        : currency === 'USD'
          ? catalogBasePrice / Math.max(rate, 0.000001)
          : catalogBasePrice;
      return {
        list,
        price: item?.price !== undefined && item?.price !== null
          ? String(item.price)
          : isRetail
            ? String(catalogRetailPrice)
            : '',
        currency,
        exchangeRate: rate,
        configured: Boolean(item),
      };
    });
  }, [payload, serviceRecord, service, baseCurrency, exchangeRate]);

  const [draftState, setDraftState] = useState<{ serviceId: string | null; values: Record<string, ServicePriceDraft> }>({ serviceId: null, values: {} });
  const serviceId = service?.id || null;
  const drafts = draftState.serviceId === serviceId ? draftState.values : {};
  const updateDraft = (listId: string, draft: ServicePriceDraft) => {
    setDraftState((current) => ({
      serviceId,
      values: {
        ...(current.serviceId === serviceId ? current.values : {}),
        [listId]: draft,
      },
    }));
  };

  const savePrice = useMutation({
    mutationFn: async ({ list, draft, serviceId: targetServiceId }: { list: PriceList; draft: ServicePriceDraft; serviceId: string }) => {
      const price = Number(draft.price);
      if (!Number.isFinite(price) || price < 0) throw new Error('Ingresa un precio válido mayor o igual a cero.');
      return priceListsService.updateServiceItem(list.id, targetServiceId, {
        price,
        currency: draft.currency,
        exchangeRate: draft.exchangeRate,
      });
    },
    onSuccess: async (_item, variables) => {
      setDraftState((current) => current.serviceId === variables.serviceId
        ? { ...current, values: Object.fromEntries(Object.entries(current.values).filter(([listId]) => listId !== variables.list.id)) }
        : current);
      await queryClient.invalidateQueries({ queryKey: ['sales', 'price-lists', 'services', tenantKey] });
      onSaved?.();
      toast.success('Precio del servicio actualizado.');
    },
    onError: (error: any) => toast.error(error?.message || 'No se pudo guardar el precio del servicio.'),
  });

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) setDraftState({ serviceId: null, values: {} });
      onOpenChange(nextOpen);
    }}>
      <DialogContent className="max-h-[85vh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex min-w-0 items-center gap-2">
            <Tags className="size-5 shrink-0 text-primary" />
            <span className="truncate">Listas de precios · {service?.name || 'Servicio'}</span>
          </DialogTitle>
          <DialogDescription>
            Configura el precio que se aplicará a este servicio al venderlo con cada lista. Si una lista queda sin precio, se usará el precio del catálogo.
          </DialogDescription>
        </DialogHeader>

        {serviceMatrix.isLoading ? (
          <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando precios…</div>
        ) : serviceMatrix.isError ? (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">No se pudieron cargar las listas de precios. Intenta de nuevo.</div>
        ) : !rows.length ? (
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
            No hay listas de precios activas disponibles para configurar.
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {rows.map(({ list, configured }) => {
              const draft = drafts[list.id] || { price: '', currency: baseCurrency, exchangeRate: 1 };
              const isSaving = savePrice.isPending && savePrice.variables?.list.id === list.id && savePrice.variables?.serviceId === serviceId;
              return (
                <div key={list.id} className="grid min-w-0 gap-3 rounded-xl border border-border/60 bg-card p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:items-end">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{list.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{configured ? 'Precio configurado' : 'Usa el precio base del catálogo'}</p>
                  </div>
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
                    <div className="min-w-0 space-y-1">
                      <Label htmlFor={`service-price-${list.id}`} className="text-[10px] text-muted-foreground">Precio</Label>
                      <Input
                        id={`service-price-${list.id}`}
                        type="number"
                        min={0}
                        step="any"
                        value={draft.price}
                        onChange={(event) => updateDraft(list.id, { ...draft, price: event.target.value })}
                        className="h-9 min-w-0 text-right tabular-nums"
                        aria-label={`Precio ${list.name} para ${service?.name || 'servicio'}`}
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Moneda</Label>
                      <Select value={draft.currency} onValueChange={(currency) => updateDraft(list.id, {
                        ...draft,
                        currency,
                        exchangeRate: currency === baseCurrency ? 1 : Number(exchangeRate || draft.exchangeRate || 1),
                      })}>
                      <SelectTrigger className="h-9 w-full" aria-label={`Moneda ${list.name}`}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="NIO">NIO</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full shrink-0 sm:w-auto"
                    disabled={isSaving || draft.price === '' || !canPerform('SALES_PRICE_LISTS', 'edit')}
                    onClick={() => serviceId && savePrice.mutate({ list, draft, serviceId })}
                  >
                    {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                    Guardar
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => {
            setDraftState({ serviceId: null, values: {} });
            onOpenChange(false);
          }}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
