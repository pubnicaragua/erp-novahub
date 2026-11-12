import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, PackagePlus, Plus, Warehouse } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { useAuth } from '../../contexts/AuthContext';
import { inventoryService } from '../../services/inventario.service';
import { createIdempotencyKey, getApiErrorMessage } from '../../services/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';

interface ProductStockIncreaseSectionProps {
  product: any;
  baseCurrency: string;
  onStockIncreased: () => void;
}

type StockIncreasePayload = Parameters<typeof inventoryService.increaseProductStock>[1];

export function ProductStockIncreaseSection({ product, baseCurrency, onStockIncreased }: ProductStockIncreaseSectionProps) {
  const { canPerform } = useAuth();
  const canCreateAdjustment = canPerform('INVENTORY_ADJUSTMENTS', 'create');
  const canApproveAdjustment = canPerform('INVENTORY_ADJUSTMENTS', 'approve');
  const canIncreaseStock = canCreateAdjustment && canApproveAdjustment;
  const canOverrideCost = canPerform('INVENTORY_ADJUSTMENTS', 'viewCost');
  const [enabled, setEnabled] = useState(false);
  const [settingLoaded, setSettingLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [costCurrency, setCostCurrency] = useState(String(baseCurrency || 'NIO').toUpperCase());
  const [lotNumber, setLotNumber] = useState('');
  const [manufactureDate, setManufactureDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [seriesText, setSeriesText] = useState('');
  const [saving, setSaving] = useState(false);
  const idempotencyAttempt = useRef<{ fingerprint: string; key: string } | null>(null);

  const variants = useMemo(() => Array.isArray(product?.variants) ? product.variants : [], [product?.variants]);
  const trackBatch = Boolean(product?.trackBatch || product?.details?.trackBatch);
  const trackSeries = Boolean(
    product?.trackSeries
    || product?.details?.trackSeries
    || product?.trackSerialNumbers
    || product?.serialTracking
    || product?.serialNumberTracking,
  );
  const currencyOptions = [...new Set([String(baseCurrency || 'NIO').toUpperCase(), 'NIO', 'USD'])];

  useEffect(() => {
    let active = true;
    setSettingLoaded(false);
    setEnabled(false);
    if (!canIncreaseStock) {
      setSettingLoaded(true);
      return () => { active = false; };
    }
    inventoryService.getManualProductStockIncreaseSetting()
      .then((setting) => {
        if (active) setEnabled(setting.enabled === true);
      })
      .catch(() => {
        if (active) setEnabled(false);
      })
      .finally(() => {
        if (active) setSettingLoaded(true);
      });
    return () => { active = false; };
  }, [canIncreaseStock, product?.id]);

  useEffect(() => {
    if (!enabled || !canIncreaseStock) return;
    let active = true;
    setLoadingWarehouses(true);
    inventoryService.getWarehouses()
      .then((result) => {
        const list = (Array.isArray(result) ? result : []).filter((warehouse: any) =>
          warehouse?.isActive !== false && (!warehouse?.scopeType || warehouse.scopeType === 'BRANCH'),
        );
        if (!active) return;
        setWarehouses(list);
        setWarehouseId((current) => current && list.some((warehouse: any) => warehouse.id === current)
          ? current
          : String(list[0]?.id || ''));
      })
      .catch((error) => {
        if (active) {
          setWarehouses([]);
          toast.error(getApiErrorMessage(error, 'No se pudieron cargar las bodegas'));
        }
      })
      .finally(() => { if (active) setLoadingWarehouses(false); });
    return () => { active = false; };
  }, [enabled, canIncreaseStock]);

  useEffect(() => {
    if (variants.length === 1) setVariantId(String(variants[0]?.id || ''));
    else if (variants.length === 0) setVariantId('');
  }, [variants]);

  if (!settingLoaded || !enabled || !canIncreaseStock || String(product?.type || product?.itemType || '').toUpperCase() === 'SERVICE') {
    return null;
  }

  const handleIncrease = async () => {
    const parsedQuantity = Number(quantity);
    if (!warehouseId) {
      toast.error('Selecciona la bodega donde agregarás las existencias.');
      return;
    }
    if (variants.length > 1 && !variantId) {
      toast.error('Selecciona la variante del producto.');
      return;
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      toast.error('La cantidad debe ser mayor que cero.');
      return;
    }
    if (trackBatch && !lotNumber.trim()) {
      toast.error('Indica el número de lote.');
      return;
    }

    const seriesNumbers = seriesText.split(/[\r\n,;]+/).map((value) => value.trim()).filter(Boolean);
    if (trackSeries) {
      if (parsedQuantity > 500) {
        toast.error('Puedes registrar un máximo de 500 números de serie por entrada.');
        return;
      }
      if (!Number.isInteger(parsedQuantity) || seriesNumbers.length !== parsedQuantity) {
        toast.error(`Ingresa un número de serie por cada unidad (${parsedQuantity}).`);
        return;
      }
      if (new Set(seriesNumbers.map((value) => value.toLocaleUpperCase())).size !== seriesNumbers.length) {
        toast.error('Hay números de serie repetidos en la lista.');
        return;
      }
    }

    const parsedCost = unitCost.trim() === '' ? undefined : Number(unitCost);
    if (parsedCost !== undefined && (!Number.isFinite(parsedCost) || parsedCost <= 0)) {
      toast.error('El costo unitario debe ser mayor que cero.');
      return;
    }

    const payload: StockIncreasePayload = {
      warehouseId,
      ...(variants.length > 0 ? { variantId: variantId || String(variants[0]?.id || '') } : {}),
      quantity: parsedQuantity,
      ...(parsedCost !== undefined ? { unitCost: parsedCost, currency: costCurrency } : {}),
      ...(trackBatch ? {
        lot: {
          number: lotNumber.trim(),
          ...(manufactureDate ? { manufactureDate } : {}),
          ...(expirationDate ? { expirationDate } : {}),
        },
      } : {}),
      ...(trackSeries ? { seriesNumbers } : {}),
    };
    const fingerprint = JSON.stringify({ productId: product.id, payload });
    if (!idempotencyAttempt.current || idempotencyAttempt.current.fingerprint !== fingerprint) {
      idempotencyAttempt.current = { fingerprint, key: createIdempotencyKey('stock-increase') };
    }

    setSaving(true);
    try {
      const result = await inventoryService.increaseProductStock(product.id, payload, idempotencyAttempt.current.key);
      idempotencyAttempt.current = null;
      toast.success(`Existencias agregadas. Stock: ${result.stockBefore} → ${result.stockAfter}. Ajuste ${result.adjustmentNumber}.`);
      setQuantity('');
      setUnitCost('');
      setLotNumber('');
      setManufactureDate('');
      setExpirationDate('');
      setSeriesText('');
      setExpanded(false);
      onStockIncreased();
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, 'No se pudieron agregar las existencias'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-primary/20 bg-primary/[0.035] p-4" aria-labelledby="product-stock-increase-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PackagePlus className="size-4.5" />
          </div>
          <div className="min-w-0">
            <h3 id="product-stock-increase-title" className="text-sm font-bold">Agregar existencias</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Registra una entrada por sobrante y conserva el costo maestro del producto.</p>
          </div>
        </div>
        <Button type="button" variant={expanded ? 'outline' : 'default'} className="shrink-0" onClick={() => setExpanded((value) => !value)} disabled={saving}>
          <Plus className="mr-1.5 size-4" /> {expanded ? 'Cerrar entrada' : 'Agregar stock'}
        </Button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-border/50 pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="manual-stock-warehouse" className="flex items-end leading-tight sm:min-h-10">Bodega</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId} disabled={saving || loadingWarehouses}>
                <SelectTrigger id="manual-stock-warehouse" className="h-9"><SelectValue placeholder={loadingWarehouses ? 'Cargando bodegas…' : 'Seleccionar bodega'} /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse: any) => <SelectItem key={warehouse.id} value={String(warehouse.id)}>{warehouse.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {!loadingWarehouses && warehouses.length === 0 && <p className="text-[11px] text-destructive">No hay bodegas operativas disponibles para tu usuario.</p>}
            </div>

            {variants.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="manual-stock-variant" className="flex items-end leading-tight sm:min-h-10">Variante</Label>
                <Select value={variantId} onValueChange={setVariantId} disabled={saving}>
                  <SelectTrigger id="manual-stock-variant" className="h-9"><SelectValue placeholder="Seleccionar variante" /></SelectTrigger>
                  <SelectContent>
                    {variants.map((variant: any) => <SelectItem key={variant.id} value={String(variant.id)}>{variant.sku}{variant.name ? ` · ${variant.name}` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="manual-stock-quantity" className="flex items-end leading-tight sm:min-h-10">Cantidad a agregar</Label>
              <Input id="manual-stock-quantity" type="number" min="0.0000001" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={saving} inputMode="decimal" />
            </div>

            {canOverrideCost && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="manual-stock-unit-cost" className="flex items-end leading-tight sm:min-h-10">Costo unitario de esta entrada (opcional)</Label>
                  <Input id="manual-stock-unit-cost" type="number" min="0" step="any" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} disabled={saving} inputMode="decimal" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manual-stock-cost-currency" className="flex items-end leading-tight sm:min-h-10">Moneda del costo indicado</Label>
                  <Select value={costCurrency} onValueChange={setCostCurrency} disabled={saving}>
                    <SelectTrigger id="manual-stock-cost-currency" className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{currencyOptions.map((currency) => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          {canOverrideCost && <p className="-mt-2 text-[11px] text-muted-foreground">Si dejas el costo vacío se usa el costo actual de la variante o del producto; el costo maestro no cambia.</p>}

          {trackBatch && (
            <div className="rounded-lg border border-border/50 bg-background/70 p-3">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold"><Warehouse className="size-3.5 text-primary" /> Datos del lote</div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="manual-stock-lot-number" className="flex items-end leading-tight sm:min-h-10">Número de lote</Label>
                  <Input id="manual-stock-lot-number" value={lotNumber} onChange={(event) => setLotNumber(event.target.value)} disabled={saving} maxLength={128} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manual-stock-lot-manufactured" className="flex items-end leading-tight sm:min-h-10">Fecha de fabricación</Label>
                  <Input id="manual-stock-lot-manufactured" type="date" value={manufactureDate} onChange={(event) => setManufactureDate(event.target.value)} disabled={saving} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manual-stock-lot-expiration" className="flex items-end leading-tight sm:min-h-10">Fecha de vencimiento</Label>
                  <Input id="manual-stock-lot-expiration" type="date" value={expirationDate} onChange={(event) => setExpirationDate(event.target.value)} disabled={saving} />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Al reutilizar un lote, ingresa las mismas fechas que ya tiene registradas.</p>
            </div>
          )}

          {trackSeries && (
            <div className="space-y-1.5">
              <Label htmlFor="manual-stock-series">Números de serie o IMEI (uno por unidad)</Label>
              <Textarea id="manual-stock-series" value={seriesText} onChange={(event) => setSeriesText(event.target.value)} disabled={saving} rows={3} placeholder="Un número de serie por línea" />
              <p className="text-[11px] text-muted-foreground">Deben coincidir con la cantidad indicada{trackBatch ? ' y quedarán asociados al lote' : ''}.</p>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-border/50 pt-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setExpanded(false)} disabled={saving}>Cancelar</Button>
            <Button type="button" onClick={() => void handleIncrease()} disabled={saving || loadingWarehouses || warehouses.length === 0}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <PackagePlus className="mr-2 size-4" />}
              {saving ? 'Registrando…' : 'Confirmar aumento'}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
