import { useMemo, useState } from 'react';
import { Scale, Plus, Check, X, CheckCircle, Receipt, Trash2, CircleHelp, ClipboardCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Combobox } from '../ui/Combobox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { toast } from 'sonner';
import { inventoryService } from '../../services/inventario.service';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';
import { InventoryDetailPanel } from './InventoryDetailPanel';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import type { SalesPaginationControls } from '../../types';
import { InventoryViewTutorial } from './InventoryViewTutorial';
import { useDetailOpeningFeedback } from '../../hooks/useDetailOpeningFeedback';

interface ControlStockViewProps {
  adjustments: any[];
  warehouses: any[];
  products: any[];
  series?: any[];
  auditsForAdjustment?: any[];
  onRefresh: () => void;
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  onStatusChange?: (value: string) => void;
}

interface ReceptionAllocation {
  id: string;
  warehouseId: string;
  quantity: number;
}

const REASON_OPTIONS = [
  { value: 'DISCREPANCY', label: 'Discrepancia' },
  { value: 'DAMAGE', label: 'Daño' },
  { value: 'THEFT', label: 'Robo' },
  { value: 'EXPIRATION', label: 'Vencimiento' },
  { value: 'OTHER', label: 'Otro' },
];

const STOCK_TOUR_STEPS: GuidedTourStep[] = [
  {
    target: '[data-tour="stock-title"]',
    title: 'Control de Existencias',
    description: 'Gestiona ajustes manuales, ajustes derivados de auditorías, recepciones y movimientos de IMEI o series desde un solo lugar.',
    tip: 'Los borradores no cambian el stock; las diferencias de auditoría requieren revisión del Manager global.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="stock-imei-btn"]',
    title: 'IMEI / Series',
    description: 'Usa esta opción para agregar o remover un IMEI o número de serie puntual. Cada acción genera un movimiento auditado y conserva la trazabilidad.',
    tip: 'Los productos con serie requieren un tratamiento especial para mantener la trazabilidad.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="stock-audits-btn"]',
    title: 'Ajustes desde auditorías',
    description: 'Las auditorías con diferencias aparecen aquí. Previsualiza los faltantes y sobrantes y crea un borrador sin cambiar el stock todavía.',
    tip: 'Los ajustes creados desde una auditoría solo pueden aprobarse desde el panel del Manager global.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="stock-reception-btn"]',
    title: 'Registrar Recepción',
    description: 'Registra una entrada de mercancía, distribúyela por bodega y captura sus IMEI o series cuando corresponda.',
    tip: 'La cantidad distribuida debe coincidir con la cantidad total recibida.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="stock-new-btn"]',
    title: 'Nuevo Ajuste',
    description: 'Crea un ajuste manual seleccionando bodega, producto, existencia física, costo y razón. El ajuste quedará como borrador hasta que lo apruebes.',
    tip: 'Un ajuste en borrador no afecta el stock real. Debes aprobarlo para que se refleje.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="stock-table"]',
    title: 'Tabla de Ajustes',
    description: 'Aquí verás todos los ajustes registrados. Los borradores aparecen en la primera fila para edición rápida. Usa "Aprobar" para confirmar un ajuste.',
    placement: 'top',
  },
  {
    target: '[data-tour="stock-pagination"]',
    title: 'Paginación',
    description: 'Cambia la cantidad de ajustes por página y recorre el historial con anterior y siguiente. El estado elegido y la búsqueda se conservan durante la navegación.',
    placement: 'top',
  },
];

function normalizeAuditItems(value: unknown): any[] {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}

function auditOriginalStock(item: any): number {
  return Number(item?.originalSystemStock ?? item?.systemStock ?? item?.snapshotStock ?? item?.theoreticalStock ?? 0);
}

function auditDifference(item: any): number {
  return Number(item?.countedStock ?? 0) - auditOriginalStock(item);
}

function adjustmentVariantLabel(variant: any): string {
  const attributes = Array.isArray(variant?.attributes) ? variant.attributes : [];
  if (attributes.length > 0) return attributes.map((attribute: any) => attribute?.value).filter(Boolean).join(' / ');
  return String(variant?.name || variant?.sku || 'Estándar');
}

function adjustmentVariantRows(product: any, warehouseId: string) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const levels = Array.isArray(product?.stockLevels) ? product.stockLevels : [];
  const variantIds = new Set<string>([
    ...variants.map((variant: any) => String(variant?.id || '').trim()).filter(Boolean),
    ...levels.map((level: any) => String(level?.variantId || level?.variant?.id || '').trim()).filter(Boolean),
  ]);
  return Array.from(variantIds).map((variantId) => {
    const variant = variants.find((candidate: any) => String(candidate?.id) === variantId)
      || levels.find((level: any) => String(level?.variantId || level?.variant?.id || '') === variantId)?.variant
      || { id: variantId, sku: variantId, name: 'Estándar' };
    const stock = levels
      .filter((level: any) => (!warehouseId || String(level?.warehouseId || level?.warehouse?.id || '') === String(warehouseId))
        && String(level?.variantId || level?.variant?.id || '') === variantId)
      .reduce((total: number, level: any) => total + Number(level?.quantity || 0), 0);
    return { variantId, variantLabel: adjustmentVariantLabel(variant), variantSku: String(variant?.sku || ''), stock };
  });
}

function adjustmentSelectionValue(productId: string, variantId?: string): string {
  return variantId ? `${productId}::${variantId}` : productId;
}

function isAuditGeneratedAdjustment(adjustment: any): boolean {
  return Boolean(adjustment?.auditGenerated || adjustment?.auditId || adjustment?.auditNumber);
}

export function ControlStockView({ adjustments, warehouses, products, series = [], auditsForAdjustment = [], onRefresh, pagination, onSearchChange, onStatusChange }: ControlStockViewProps) {
  const { canPerform } = useAuth();
  const { openingId, startOpening } = useDetailOpeningFeedback();
  const canViewInventoryCost = canPerform('INVENTORY_ADJUSTMENTS', 'viewCost');
  const { baseCurrency } = useCurrency();
  const [showTutorial, setShowTutorial] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isReceptionOpen, setIsReceptionOpen] = useState(false);
  const [isSerialAdjustOpen, setIsSerialAdjustOpen] = useState(false);
  const [newAdjustment, setNewAdjustment] = useState({ warehouseId: '', reason: 'DISCREPANCY', productId: '', variantId: '', currentStock: 0, actualStock: 0, unitCost: 0, currency: baseCurrency });
  const [newReception, setNewReception] = useState({
    productId: '',
    variantId: '',
    totalQuantity: 0,
    notes: '',
    imeiText: '',
    unitCost: 0,
    currency: baseCurrency,
  });
  const [allocations, setAllocations] = useState<ReceptionAllocation[]>(() => [
    { id: `alloc-${Date.now()}`, warehouseId: '', quantity: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [selectedAdjustment, setSelectedAdjustment] = useState<any>(null);
  const openAdjustment = (adjustment: any) => startOpening(adjustment.id, () => setSelectedAdjustment(adjustment));
  const [auditPickerOpen, setAuditPickerOpen] = useState(false);
  const [auditConfirmation, setAuditConfirmation] = useState<any>(null);
  const [auditAdjustingId, setAuditAdjustingId] = useState<string | null>(null);
  const [serialAdjustment, setSerialAdjustment] = useState({
    action: 'ADD',
    productId: '',
    variantId: '',
    warehouseId: '',
    serialNumber: '',
    notes: '',
  });

  const colFilters = useColumnFilters();
  const filterGetters = {
    number: (a: any) => a.number || '',
    warehouse: (a: any) => a.warehouse?.name || 'Sin almacén',
    reason: (a: any) => String(a.reason || ''),
    product: (a: any) => `${a.items?.[0]?.product?.name || a.items?.[0]?.name || a.product?.name || '—'}${a.items?.[0]?.variant?.name ? ` · ${a.items[0].variant.name}` : ''}`,
    status: (a: any) => String(a.status || '').toUpperCase(),
  };
  const filteredData = colFilters.applyTo(adjustments, filterGetters);
  const auditConfirmationItems = normalizeAuditItems(auditConfirmation?.items);
  const auditConfirmationDifferences = auditConfirmationItems.filter((item: any) => auditDifference(item) !== 0);
  const auditConfirmationShortages = auditConfirmationDifferences.filter((item: any) => auditDifference(item) < 0);
  const auditConfirmationSurpluses = auditConfirmationDifferences.filter((item: any) => auditDifference(item) > 0);
  const warehouseOptions = [...new Map(adjustments.map((a) => [a.warehouse?.name || 'Sin almacén', a.warehouse?.name || 'Sin almacén'])).entries()]
    .map(([, label]) => ({ value: label, label, count: adjustments.filter((a) => (a.warehouse?.name || 'Sin almacén') === label).length }));
  const reasonOptions = REASON_OPTIONS.map((r) => ({ value: r.value, label: r.label, count: adjustments.filter((a) => a.reason === r.value).length }));
  const statusOptionsForFilter = [
    { value: 'DRAFT', label: 'Borrador', count: adjustments.filter((a) => String(a.status || '').toUpperCase() === 'DRAFT').length },
    { value: 'APPROVED', label: 'Aprobado', count: adjustments.filter((a) => String(a.status || '').toUpperCase() === 'APPROVED').length },
  ];

  const totalAllocated = useMemo(
    () => allocations.reduce((acc, item) => acc + Number(item.quantity || 0), 0),
    [allocations],
  );

  const imeiList = useMemo(
    () =>
      newReception.imeiText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    [newReception.imeiText],
  );

  const isSerialTracked = (product: any) =>
    Boolean(
      product?.trackSerialNumbers ||
      product?.serialTracking ||
      product?.serialNumberTracking ||
      String(product?.trackingType || '').toUpperCase() === 'SERIAL',
    );

  const selectedReceptionProduct = useMemo(
    () => products.find((p: any) => p.id === newReception.productId),
    [products, newReception.productId],
  );

  const productWarehouseIds = (product: any): Set<string> => {
    const ids: string[] = [
      ...(Array.isArray(product?.stockLevels) ? product.stockLevels.map((l: any) => l.warehouseId || l.warehouse?.id) : []),
      ...(Array.isArray(product?.warehouseCatalogs) ? product.warehouseCatalogs.map((c: any) => c.warehouseId || c.warehouse?.id) : []),
      ...(Array.isArray(product?.allocations) ? product.allocations.map((a: any) => a.warehouseId || a.warehouse?.id) : []),
    ];
    return new Set(ids.filter(Boolean));
  };

  const isProductInWarehouse = (productId: string, warehouseId: string) => {
    const product = products.find((p: any) => p.id === productId);
    return Boolean(product && warehouseId && productWarehouseIds(product).has(warehouseId));
  };

  // Solo productos presentes en el almacén seleccionado.
  const adjustmentProductOptions = useMemo(() => {
    const warehouseId = newAdjustment.warehouseId;
    return products
      .filter((p: any) => warehouseId && productWarehouseIds(p).has(warehouseId))
      .sort((a: any, b: any) => String(a.code || '').localeCompare(String(b.code || ''), 'es', { numeric: true, sensitivity: 'base' }))
      .flatMap((p: any) => {
        const variants = adjustmentVariantRows(p, warehouseId);
        const rows = variants.length > 0 ? variants : [{ variantId: '', variantLabel: '', variantSku: '', stock: 0 }];
        return rows.map((variant) => ({
          label: `${p.code} — ${p.name}${variant.variantLabel ? ` · ${variant.variantLabel}` : ''}`,
          value: variant.variantId ? `${p.id}::${variant.variantId}` : p.id,
          productId: p.id,
          variantId: variant.variantId,
          variantLabel: variant.variantLabel,
          stock: variant.stock,
        }));
      });
  }, [products, newAdjustment.warehouseId]);

  const receptionProductOptions = useMemo(() => products
    .filter((product: any) => String(product?.itemType || product?.type || 'PRODUCT').toUpperCase() !== 'SERVICE')
    .sort((a: any, b: any) => String(a.code || '').localeCompare(String(b.code || ''), 'es', { numeric: true, sensitivity: 'base' }))
    .flatMap((product: any) => {
      const variants = adjustmentVariantRows(product, '');
      const rows = variants.length > 0 ? variants : [{ variantId: '', variantLabel: '', variantSku: '', stock: 0 }];
      return rows.map((variant) => ({
        label: `${product.code} — ${product.name}${variant.variantLabel ? ` · ${variant.variantLabel}` : ''}`,
        value: variant.variantId ? `${product.id}::${variant.variantId}` : product.id,
        productId: product.id,
        variantId: variant.variantId,
      }));
    }), [products]);

  const serialProductOptions = useMemo(() => {
    const warehouseId = serialAdjustment.warehouseId;
    return products
      .filter((p: any) => warehouseId && productWarehouseIds(p).has(warehouseId))
      .sort((a: any, b: any) => String(a.code || '').localeCompare(String(b.code || ''), 'es', { numeric: true, sensitivity: 'base' }))
      .flatMap((p: any) => {
        const variants = adjustmentVariantRows(p, warehouseId);
        const rows = variants.length > 0 ? variants : [{ variantId: '', variantLabel: '', variantSku: '', stock: 0 }];
        return rows.map((variant) => ({
          label: `${p.code} — ${p.name}${variant.variantLabel ? ` · ${variant.variantLabel}` : ''}`,
          value: variant.variantId ? `${p.id}::${variant.variantId}` : p.id,
          productId: p.id,
          variantId: variant.variantId,
        }));
      });
  }, [products, serialAdjustment.warehouseId]);

  const handleAdjustmentWarehouseChange = (value: string) => {
    setNewAdjustment((prev) => ({
      ...prev,
      warehouseId: value,
      productId: prev.productId && isProductInWarehouse(prev.productId, value) ? prev.productId : '',
      variantId: prev.productId && isProductInWarehouse(prev.productId, value) ? prev.variantId : '',
    }));
  };

  const handleAdjustmentProductChange = (value: string) => {
    const option = adjustmentProductOptions.find((candidate: any) => candidate.value === value);
    setNewAdjustment((prev) => ({
      ...prev,
      productId: option?.productId || value,
      variantId: option?.variantId || '',
      currentStock: Number(option?.stock || 0),
      actualStock: Number(option?.stock || 0),
    }));
  };

  const handleReceptionProductChange = (value: string) => {
    const option = receptionProductOptions.find((candidate: any) => candidate.value === value);
    setNewReception((prev) => ({ ...prev, productId: option?.productId || value, variantId: option?.variantId || '' }));
  };

  const handleSerialProductChange = (value: string) => {
    const option = serialProductOptions.find((candidate: any) => candidate.value === value);
    setSerialAdjustment((prev) => ({ ...prev, productId: option?.productId || value, variantId: option?.variantId || '' }));
  };

  const handleSerialWarehouseChange = (value: string) => {
    setSerialAdjustment((prev) => ({
      ...prev,
      warehouseId: value,
      productId: prev.productId && isProductInWarehouse(prev.productId, value) ? prev.productId : '',
    }));
  };

  const existingSeriesNumbers = useMemo(
    () => new Set(series.map((s: any) => String(s.number || '').trim()).filter(Boolean)),
    [series],
  );

  const handleCreateAdjustment = async () => {
    if (!newAdjustment.warehouseId || !newAdjustment.productId) {
      toast.error('Selecciona almacén y producto');
      return;
    }
    
    setSaving(true);
    try {
      await inventoryService.createAdjustment({
        warehouseId: newAdjustment.warehouseId,
        reason: newAdjustment.reason,
        items: [{
          productId: newAdjustment.productId,
          ...(newAdjustment.variantId ? { variantId: newAdjustment.variantId } : {}),
          currentStock: newAdjustment.currentStock,
          actualStock: newAdjustment.actualStock,
          unitCost: newAdjustment.unitCost,
          currency: newAdjustment.currency,
        }],
      });
      toast.success('Ajuste creado exitosamente');
      setIsCreating(false);
      setNewAdjustment({ warehouseId: '', reason: 'DISCREPANCY', productId: '', variantId: '', currentStock: 0, actualStock: 0, unitCost: 0, currency: baseCurrency });
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Error al crear ajuste');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveAdjustment = async (id: string) => {
    setApprovingId(id);
    try {
      await inventoryService.approveAdjustment(id);
      toast.success('Ajuste aprobado y aplicado');
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Error al aprobar');
    } finally {
      setApprovingId(null);
    }
  };

  const requestCreateAdjustmentFromAudit = (audit: any) => {
    if (audit.adjustmentId) {
      toast.info('Esta auditoría ya tiene un ajuste borrador generado. Apruébalo desde la tabla de ajustes.');
      return;
    }
    setAuditPickerOpen(false);
    setAuditConfirmation(audit);
  };

  const confirmCreateAdjustmentFromAudit = async () => {
    const audit = auditConfirmation;
    if (!audit) return;
    try {
      setAuditAdjustingId(audit.id);
      const result = await inventoryService.createAdjustmentFromAudit(audit.id);
      if (result?.adjustment) {
        toast.success(`Ajuste ${result.adjustment.number} creado como borrador. Apruébalo para aplicar el stock.`);
      } else {
        toast.success(`Auditoría ${audit.number} revisada: no se generó ajuste porque no había diferencias.`);
      }
      setAuditConfirmation(null);
      setAuditPickerOpen(false);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo generar el ajuste desde la auditoría');
      throw e;
    } finally {
      setAuditAdjustingId(null);
    }
  };

  const updateAllocation = (id: string, patch: Partial<ReceptionAllocation>) => {
    setAllocations((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addAllocationRow = () => {
    setAllocations((prev) => [...prev, { id: `alloc-${Date.now()}-${prev.length}`, warehouseId: '', quantity: 0 }]);
  };

  const removeAllocationRow = (id: string) => {
    setAllocations((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
  };

  const resetReception = () => {
    setNewReception({ productId: '', variantId: '', totalQuantity: 0, notes: '', imeiText: '', unitCost: 0, currency: baseCurrency });
    setAllocations([{ id: `alloc-${Date.now()}`, warehouseId: '', quantity: 0 }]);
  };

  const handleCreateReception = async () => {
    if (!newReception.productId) return toast.error('Selecciona un producto');
    if (Number(newReception.totalQuantity || 0) <= 0) return toast.error('La cantidad total debe ser mayor a 0');

    const validAllocations = allocations.filter(
      (item) => item.warehouseId && Number(item.quantity || 0) > 0,
    );

    if (validAllocations.length === 0) {
      return toast.error('Debes distribuir al menos en una bodega');
    }

    if (totalAllocated !== Number(newReception.totalQuantity || 0)) {
      return toast.error('La distribución por bodegas debe sumar la cantidad total recibida');
    }

    const uniqueWarehouses = new Set(validAllocations.map((item) => item.warehouseId));
    if (uniqueWarehouses.size !== validAllocations.length) {
      return toast.error('No repitas la misma bodega en la distribución');
    }

    if (imeiList.length > 0 && imeiList.length !== Number(newReception.totalQuantity || 0)) {
      return toast.error('La cantidad de IMEI/series debe coincidir con la cantidad total recibida');
    }

    const normalizedImeis = imeiList.map((n) => n.trim()).filter(Boolean);
    const uniqueInputImeis = new Set(normalizedImeis);
    if (normalizedImeis.length !== uniqueInputImeis.size) {
      return toast.error('No repitas IMEI/series en la misma recepción');
    }

    const serialRequired = isSerialTracked(selectedReceptionProduct);
    if (serialRequired && normalizedImeis.length !== Number(newReception.totalQuantity || 0)) {
      return toast.error('Este producto requiere IMEI/series por cada unidad recibida');
    }

    const repeatedExisting = normalizedImeis.find((num) => existingSeriesNumbers.has(num));
    if (repeatedExisting) {
      return toast.error(`El IMEI/serie ${repeatedExisting} ya existe en inventario`);
    }

    setSaving(true);
    const reference = `REC-${Date.now().toString().slice(-8)}`;

    try {
      await Promise.all(
        validAllocations.map((item) =>
          inventoryService.createMovement({
            productId: newReception.productId,
            ...(newReception.variantId ? { variantId: newReception.variantId } : {}),
            warehouseId: item.warehouseId,
            type: 'IN',
            quantity: Number(item.quantity || 0),
            unitCost: newReception.unitCost,
            currency: newReception.currency,
            reference: `${reference}${newReception.notes ? ` - ${newReception.notes}` : ''}`,
          }),
        ),
      );

      if (normalizedImeis.length > 0) {
        await Promise.all(
          normalizedImeis.map((seriesNumber) =>
            inventoryService.createSeries({
              productId: newReception.productId,
              number: seriesNumber,
            }),
          ),
        );
      }

      toast.success(`Recepción registrada: ${newReception.totalQuantity} unidades${imeiList.length ? ` + ${imeiList.length} IMEI/series` : ''}`);
      setIsReceptionOpen(false);
      resetReception();
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Error al registrar recepción');
    } finally {
      setSaving(false);
    }
  };

  const handleSerialAdjustment = async () => {
    const serial = serialAdjustment.serialNumber.trim();
    if (!serial || !serialAdjustment.productId || !serialAdjustment.warehouseId) {
      toast.error('Completa producto, almacén e IMEI/serie');
      return;
    }

    const exists = series.find(
      (s: any) =>
        String(s.number || '').trim() === serial &&
        (s.productId === serialAdjustment.productId || s.product?.id === serialAdjustment.productId),
    );

    if (serialAdjustment.action === 'ADD' && exists) {
      toast.error('Ese IMEI/serie ya existe para el producto seleccionado');
      return;
    }
    if (serialAdjustment.action === 'REMOVE' && !exists) {
      toast.error('No se encontró ese IMEI/serie para removerlo');
      return;
    }

    setSaving(true);
    const reference = `AJUSTE-IMEI-${Date.now().toString().slice(-8)}${serialAdjustment.notes ? ` - ${serialAdjustment.notes}` : ''}`;
    try {
      if (serialAdjustment.action === 'ADD') {
        await inventoryService.createSeries({
          productId: serialAdjustment.productId,
          number: serial,
        });
        await inventoryService.createMovement({
          productId: serialAdjustment.productId,
          ...(serialAdjustment.variantId ? { variantId: serialAdjustment.variantId } : {}),
          warehouseId: serialAdjustment.warehouseId,
          type: 'IN',
          quantity: 1,
          reference: `${reference} [${serial}]`,
        });
      } else {
        if (exists?.id) {
          await inventoryService.deleteSeries(exists.id);
        }
        await inventoryService.createMovement({
          productId: serialAdjustment.productId,
          ...(serialAdjustment.variantId ? { variantId: serialAdjustment.variantId } : {}),
          warehouseId: serialAdjustment.warehouseId,
          type: 'OUT',
          quantity: 1,
          reference: `${reference} [${serial}]`,
        });
      }

      toast.success(serialAdjustment.action === 'ADD' ? 'IMEI/serie agregado' : 'IMEI/serie ajustado');
      setIsSerialAdjustOpen(false);
      setSerialAdjustment({ action: 'ADD', productId: '', variantId: '', warehouseId: '', serialNumber: '', notes: '' });
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Error al ajustar IMEI/serie');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-500/10 text-green-600';
      case 'DRAFT': return 'bg-orange-500/10 text-orange-600';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="p-4 border bg-card rounded-xl">
      <div className="flex min-w-0 flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold" data-tour="stock-title">Ajustes de Inventario</h3>
          <p className="text-sm text-muted-foreground">{pagination?.total ?? filteredData.length} ajustes registrados</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {pagination && <>
            <Input placeholder="Buscar ajuste..." className="h-9 w-full sm:w-44" onChange={(event) => onSearchChange?.(event.target.value)} />
            <Select defaultValue="ALL" onValueChange={(value) => onStatusChange?.(value)}>
              <SelectTrigger className="h-9 w-full sm:w-32"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">Todos</SelectItem><SelectItem value="DRAFT">Borrador</SelectItem><SelectItem value="APPROVED">Aprobado</SelectItem></SelectContent>
            </Select>
          </>}
          {canPerform('INVENTORY_ADJUSTMENTS', 'create') && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowTutorial(true)} className="h-10 rounded-xl">
                <CircleHelp className="size-3.5 mr-1" /> Cómo ajustar inventario
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAuditPickerOpen(true)}
                className={`h-10 gap-1.5 rounded-xl ${auditsForAdjustment.length > 0 ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100' : ''}`}
                data-tour="stock-audits-btn"
              >
                <ClipboardCheck className="size-3.5" />
                Auditorías
                {auditsForAdjustment.length > 0 && <Badge className="ml-0.5 h-5 min-w-5 border-0 bg-amber-500 px-1 text-[9px] text-white hover:bg-amber-500">{auditsForAdjustment.length}</Badge>}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-4"
                onClick={() => setIsSerialAdjustOpen(true)}
                data-tour="stock-imei-btn"
              >
                IMEI / Series
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-4"
                onClick={() => setIsReceptionOpen(true)}
                data-tour="stock-reception-btn"
              >
                <Receipt className="size-4 mr-2" />
                Registrar Recepción
              </Button>
              <Button 
                size="sm" 
                className="h-10 min-w-0 flex-1 rounded-xl border border-primary/20 bg-primary px-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 sm:flex-none"
                onClick={() => setIsCreating(true)}
                disabled={isCreating}
                data-tour="stock-new-btn"
              >
                <Plus className="size-4" />
                Nuevo Ajuste
              </Button>
            </>
          )}
        </div>
      </div>

      <div className={`grid min-w-0 grid-cols-1 gap-6 ${selectedAdjustment ? 'xl:grid-cols-[13fr_7fr]' : 'xl:grid-cols-1'}`}>
        <div className="min-w-0">
          <div className="space-y-3 lg:hidden" data-tour="stock-table">
         {isCreating && <Card className="rounded-2xl border-primary/30 bg-primary/5 p-4" data-tour="inventory-adjustment-form-data"><div className="mb-3 flex items-center justify-between" data-tour="inventory-adjustment-form-title"><div><p className="text-[10px] font-black uppercase tracking-widest text-primary">Nuevo ajuste</p><InventoryViewTutorial label="Cómo crear ajuste" targetPrefix="inventory-adjustment-form" copy={{ data: { description: 'Selecciona almacén, razón, producto, variante, cantidad real, costo y moneda.' }, actions: { description: 'Guarda el ajuste como borrador para revisarlo y aprobarlo.' } }} /></div><div className="flex gap-1" data-tour="inventory-adjustment-form-actions"><Button type="button" variant="ghost" size="icon" className="size-8 text-emerald-500" onClick={handleCreateAdjustment} disabled={saving} aria-label="Guardar ajuste">{saving ? <div className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Check className="size-4" />}</Button><Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setIsCreating(false)} disabled={saving} aria-label="Cancelar ajuste"><X className="size-4" /></Button></div></div><div className="grid gap-3 sm:grid-cols-2"><Select value={newAdjustment.warehouseId} onValueChange={(value) => handleAdjustmentWarehouseChange(value)}><SelectTrigger><SelectValue placeholder="Almacén" /></SelectTrigger><SelectContent>{warehouses.map((warehouse: any) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}</SelectContent></Select><Select value={newAdjustment.reason} onValueChange={(value) => setNewAdjustment({ ...newAdjustment, reason: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{REASON_OPTIONS.map((reason) => <SelectItem key={reason.value} value={reason.value}>{reason.label}</SelectItem>)}</SelectContent></Select><Combobox options={adjustmentProductOptions} value={adjustmentSelectionValue(newAdjustment.productId, newAdjustment.variantId)} onChange={handleAdjustmentProductChange} placeholder="Buscar producto o variante..." searchPlaceholder="Buscar por código, nombre o variante..." emptyMessage={newAdjustment.warehouseId ? 'No hay productos en este almacén.' : 'Selecciona primero el almacén.'} maxVisibleOptions={adjustmentProductOptions.length} className="w-full sm:col-span-2" /><Input type="number" min={0} value={newAdjustment.actualStock} onChange={(event) => setNewAdjustment({ ...newAdjustment, actualStock: Number(event.target.value) || 0 })} placeholder="Cantidad real" />{canViewInventoryCost && <div className="flex gap-2"><Input type="number" min={0} step="0.01" value={newAdjustment.unitCost} onChange={(event) => setNewAdjustment({ ...newAdjustment, unitCost: Number(event.target.value) || 0 })} placeholder="Costo" /><Select value={newAdjustment.currency} onValueChange={(value) => setNewAdjustment({ ...newAdjustment, currency: value })}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NIO">NIO</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>}</div></Card>}
        {filteredData.length === 0 && !isCreating ? <Card className="rounded-2xl border-dashed p-8 text-center text-muted-foreground"><Scale className="mx-auto mb-2 size-9 opacity-20" /><p>No hay ajustes</p></Card> : filteredData.map((adjustment: any) => { const isApproving = approvingId === adjustment.id; const auditGenerated = isAuditGeneratedAdjustment(adjustment); const isOpening = String(openingId) === String(adjustment.id); return <Card key={adjustment.id} aria-busy={isOpening || undefined} data-detail-opening={isOpening ? 'true' : undefined} className="min-w-0 cursor-pointer rounded-2xl border-border/50 bg-card/70 p-4 shadow-sm transition-colors hover:bg-muted/30" onClick={() => openAdjustment(adjustment)}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><p className="truncate font-mono font-bold">{adjustment.number}</p>{isOpening && <span role="status" className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-primary"><Loader2 className="size-3 animate-spin" /> Abriendo…</span>}</div><p className="mt-1 truncate text-xs text-muted-foreground">{adjustment.warehouse?.name || 'Sin almacén'}</p></div><Badge className={`shrink-0 text-[10px] ${getStatusBadge(adjustment.status)}`}>{adjustment.status === 'APPROVED' ? 'Aprobado' : 'Borrador'}</Badge></div>{auditGenerated && <Badge variant="outline" className="mt-3 w-fit border-amber-200 bg-amber-50 text-[9px] font-bold text-amber-800">Auditoría {adjustment.auditNumber || 'vinculada'} · aprobar en Manager global</Badge>}<div className={`mt-4 grid grid-cols-2 gap-3 border-t border-border/40 pt-3 text-xs ${canViewInventoryCost ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}><div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Razón</p><p className="truncate">{REASON_OPTIONS.find((reason) => reason.value === adjustment.reason)?.label || adjustment.reason}</p></div><div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Artículos</p><p className="font-bold tabular-nums">{adjustment.items?.length || 0}</p></div>{canViewInventoryCost && <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Costo</p><p className="font-bold tabular-nums">{adjustment.items?.[0] ? `${adjustment.items[0].currency} ${adjustment.items[0].unitCost || 0}` : '—'}</p></div>}</div>{adjustment.status === 'DRAFT' && auditGenerated && <p className="mt-3 border-t border-border/40 pt-3 text-[10px] font-semibold leading-relaxed text-amber-700">Este borrador solo puede aprobarse desde el panel del Manager global.</p>}{adjustment.status === 'DRAFT' && !auditGenerated && canPerform('INVENTORY_ADJUSTMENTS', 'approve') && <div className="mt-3 flex justify-end border-t border-border/40 pt-3"><Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 text-emerald-500" onClick={(e) => { e.stopPropagation(); handleApproveAdjustment(adjustment.id); }} disabled={isApproving}>{isApproving ? <div className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <CheckCircle className="size-3.5" />} Aprobar</Button></div>}</Card>; })}
        </div>

        <div className="hidden overflow-x-auto rounded-lg border xl:block" data-tour="stock-table">
        <Table className="min-w-[1160px]">
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border/50">
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-28"><span className="inline-flex items-center gap-1">Número<ColumnFilterMenu label="Número" sort={colFilters.state.number?.sort || null} onSort={(sort) => colFilters.setSort('number', sort)} /></span></TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest"><span className="inline-flex items-center gap-1">Almacén<ColumnFilterMenu label="Almacén" options={warehouseOptions} selected={colFilters.state.warehouse?.values || []} onSelect={(values) => colFilters.setValues('warehouse', values)} sort={colFilters.state.warehouse?.sort || null} onSort={(sort) => colFilters.setSort('warehouse', sort)} /></span></TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest"><span className="inline-flex items-center gap-1">Razón<ColumnFilterMenu label="Razón" options={reasonOptions} selected={colFilters.state.reason?.values || []} onSelect={(values) => colFilters.setValues('reason', values)} sort={colFilters.state.reason?.sort || null} onSort={(sort) => colFilters.setSort('reason', sort)} /></span></TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest"><span className="inline-flex items-center gap-1">Producto<ColumnFilterMenu label="Producto" sort={colFilters.state.product?.sort || null} onSort={(sort) => colFilters.setSort('product', sort)} /></span></TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-center">Cant. Ajuste</TableHead>
              {canViewInventoryCost && <TableHead className="font-black text-[10px] uppercase tracking-widest text-right">Costo Ref.</TableHead>}
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-center w-24"><span className="inline-flex items-center gap-1">Estado<ColumnFilterMenu label="Estado" options={statusOptionsForFilter} selected={colFilters.state.status?.values || []} onSelect={(values) => colFilters.setValues('status', values)} sort={colFilters.state.status?.sort || null} onSort={(sort) => colFilters.setSort('status', sort)} /></span></TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isCreating && (
              <TableRow className="bg-blue-500/5">
                <TableCell className="text-xs text-muted-foreground" data-tour="inventory-adjustment-form-title">
                  <div className="flex items-center gap-2">
                    <span>Auto</span>
                  </div>
                </TableCell>
                <TableCell data-tour="inventory-adjustment-form-data">
                  <Select value={newAdjustment.warehouseId} onValueChange={(v) => handleAdjustmentWarehouseChange(v)}>
                    <SelectTrigger className="h-8 text-xs min-w-44"><SelectValue placeholder="Almacén" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={newAdjustment.reason} onValueChange={(v) => setNewAdjustment({ ...newAdjustment, reason: v })}>
                    <SelectTrigger
                      className="h-8 text-xs"
                      style={{ width: `${44 + (REASON_OPTIONS.find((r) => r.value === newAdjustment.reason)?.label.length || 4) * 7.5}px`, minWidth: '5.5rem' }}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REASON_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Combobox
                    options={adjustmentProductOptions}
                    value={adjustmentSelectionValue(newAdjustment.productId, newAdjustment.variantId)}
                    onChange={handleAdjustmentProductChange}
                    placeholder="Buscar producto o variante..."
                    searchPlaceholder="Buscar por código, nombre o variante..."
                    emptyMessage={newAdjustment.warehouseId ? 'No hay productos en este almacén.' : 'Selecciona primero el almacén.'}
                    maxVisibleOptions={adjustmentProductOptions.length}
                    className="w-60 min-w-60"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Input 
                      type="number" 
                      min={0}
                      value={newAdjustment.actualStock} 
                      onChange={(e) => setNewAdjustment({ ...newAdjustment, actualStock: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      className="h-8 text-xs w-32 text-right tabular-nums"
                    />
                  </div>
                </TableCell>
                {canViewInventoryCost && <TableCell className="text-right">
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={newAdjustment.unitCost}
                      onChange={(e) => setNewAdjustment({ ...newAdjustment, unitCost: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-xs w-48 text-right tabular-nums"
                      placeholder="0.00"
                    />
                    <Select value={newAdjustment.currency} onValueChange={(v) => setNewAdjustment({ ...newAdjustment, currency: v })}>
                      <SelectTrigger className="h-8 text-xs w-20 px-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NIO">NIO</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TableCell>}
                <TableCell className="text-xs">Borrador</TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end" data-tour="inventory-adjustment-form-actions">
                    <Button size="icon" variant="ghost" className="size-7 text-green-600" onClick={handleCreateAdjustment} disabled={saving}>
                      {saving ? <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Check className="size-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7 text-red-600" onClick={() => setIsCreating(false)} disabled={saving}>
                      <X className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            
            {filteredData.length === 0 && !isCreating ? (
              <TableRow>
                <TableCell colSpan={canViewInventoryCost ? 8 : 7} className="text-center py-12 text-muted-foreground">
                  <Scale className="size-10 mx-auto mb-2 opacity-20" />
                  <p className="font-medium">No hay ajustes</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((adj: any) => {
                const isApproving = approvingId === adj.id;
                return (
                  <TableRow key={adj.id} aria-busy={String(openingId) === String(adj.id) || undefined} data-detail-opening={String(openingId) === String(adj.id) ? 'true' : undefined} className="group cursor-pointer hover:bg-muted/30" onClick={() => openAdjustment(adj)}>
                    <TableCell className="font-mono text-xs"><div className="flex flex-col items-start gap-1"><span className="inline-flex items-center gap-2">{adj.number}{String(openingId) === String(adj.id) && <span role="status" className="inline-flex items-center gap-1 font-sans text-[9px] font-black uppercase tracking-wider text-primary"><Loader2 className="size-3 animate-spin" /> Abriendo…</span>}</span>{isAuditGeneratedAdjustment(adj) && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[9px] font-bold text-amber-800">Auditoría {adj.auditNumber || 'vinculada'}</Badge>}</div></TableCell>
                    <TableCell className="text-sm">{adj.warehouse?.name || '-'}</TableCell>
                    <TableCell className="text-xs">{REASON_OPTIONS.find((r) => r.value === adj.reason)?.label || adj.reason}</TableCell>
                    <TableCell className="text-xs">
                      {adj.items?.[0]?.product ? (
                        <span className="flex items-center gap-1.5" title={`${adj.items[0].product.code} - ${adj.items[0].product.name}`}>
                          <span className="truncate max-w-52">{adj.items[0].product.name}{adj.items[0].variant ? ` · ${adjustmentVariantLabel(adj.items[0].variant)}` : ''}</span>
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{adj.items[0].product.code}</span>
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-center font-medium">{adj.items?.length || 0}</TableCell>
                    {canViewInventoryCost && <TableCell className="text-right text-xs">
                      {adj.items && adj.items[0] && (
                        <div className="flex flex-col">
                          <span>{adj.items[0].currency} {adj.items[0].unitCost || 0}</span>
                        </div>
                      )}
                    </TableCell>}
                    <TableCell>
                      <Badge className={`text-[10px] ${getStatusBadge(adj.status)}`}>
                        {adj.status === 'APPROVED' ? 'Aprobado' : 'Borrador'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {adj.status === 'DRAFT' && isAuditGeneratedAdjustment(adj) ? (
                        <span className="text-[9px] font-bold uppercase tracking-wide text-amber-700">Manager global</span>
                      ) : adj.status === 'DRAFT' && canPerform('INVENTORY_ADJUSTMENTS', 'approve') && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 text-xs text-green-600 hover:bg-green-500/10 gap-1"
                          onClick={(e) => { e.stopPropagation(); handleApproveAdjustment(adj.id); }}
                          disabled={isApproving}
                        >
                          {isApproving ? <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="size-3" />}
                          Aprobar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {pagination && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground" data-tour="stock-pagination">
        <select value={pagination.pageSize} onChange={(event) => pagination.onPageSizeChange(Number(event.target.value) as 50 | 100 | 200)} className="h-7 rounded border bg-background px-1 font-bold text-foreground">
          {[50, 100, 200].map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
        <button type="button" className="rounded border px-2 py-1 disabled:opacity-40" onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))} disabled={pagination.page <= 1}>‹</button>
        <span>Pág. {pagination.page}/{pagination.totalPages}</span>
        <button type="button" className="rounded border px-2 py-1 disabled:opacity-40" onClick={() => pagination.onPageChange(Math.min(pagination.totalPages, pagination.page + 1))} disabled={pagination.page >= pagination.totalPages}>›</button>
      </div>}

      <div className="mt-3 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
        Los ajustes en borrador deben ser aprobados para aplicar cambios al stock. Los generados desde auditoría solo se aprueban en el panel del Manager global.
      </div>
        </div>
        {selectedAdjustment && (
          <InventoryDetailPanel
            kind="adjustment"
            data={selectedAdjustment}
            onClose={() => setSelectedAdjustment(null)}
          />
        )}
      </div>

      <Dialog open={auditPickerOpen} onOpenChange={setAuditPickerOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] !max-w-2xl max-h-[min(88vh,calc(100dvh-3rem))] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
              <ClipboardCheck className="size-5 text-primary" /> Ajuste desde auditoría
            </DialogTitle>
            <DialogDescription className="text-xs">
              Selecciona una auditoría pendiente. El sistema reconocerá automáticamente los faltantes y sobrantes y creará un ajuste como borrador.
            </DialogDescription>
          </DialogHeader>

          {auditsForAdjustment.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground">
              <ClipboardCheck className="mx-auto mb-2 size-8 opacity-30" />
              <p className="font-semibold">No hay auditorías pendientes</p>
              <p className="mt-1">Registra una auditoría con productos inspeccionados para crear un ajuste desde aquí.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {auditsForAdjustment.map((audit: any) => {
                const items = normalizeAuditItems(audit.items);
                const differences = items.filter((item: any) => auditDifference(item) !== 0);
                const shortages = differences.filter((item: any) => auditDifference(item) < 0);
                const surpluses = differences.filter((item: any) => auditDifference(item) > 0);
                const isGenerating = auditAdjustingId === audit.id;
                return (
                  <div key={audit.id} className="rounded-xl border border-border/50 bg-card p-3 shadow-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold">{audit.number}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {audit.auditDate ? new Date(audit.auditDate).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' }) : 'Fecha no disponible'}
                          {' · '}{audit.warehouse?.name || warehouses.find((warehouse: any) => warehouse.id === audit.warehouseId)?.name || 'Bodega no disponible'}
                        </p>
                      </div>
                      {audit.adjustmentId ? (
                        <Badge variant="outline" className="w-fit border-orange-200 bg-orange-50 text-[9px] font-bold text-orange-700">Ajuste ya generado</Badge>
                      ) : differences.length > 0 ? (
                        <Badge variant="outline" className="w-fit border-amber-200 bg-amber-50 text-[9px] font-bold text-amber-700">Requiere ajuste</Badge>
                      ) : (
                        <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-[9px] font-bold text-emerald-700">Sin diferencias</Badge>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/40 pt-3 text-xs sm:grid-cols-4">
                      <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Productos</p><p className="font-bold tabular-nums">{items.length}</p></div>
                      <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Diferencias</p><p className="font-bold tabular-nums">{differences.length}</p></div>
                      <div><p className="text-[9px] font-black uppercase tracking-widest text-red-600">Faltantes</p><p className="font-bold tabular-nums text-red-600">{shortages.length}</p></div>
                      <div><p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Sobrantes</p><p className="font-bold tabular-nums text-emerald-600">{surpluses.length}</p></div>
                    </div>

                    {differences.length > 0 && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-[10px] text-amber-900">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                        <span>Se generará un borrador con los {differences.length} productos que tienen diferencia. El stock todavía no cambiará.</span>
                      </div>
                    )}

                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 gap-1.5 text-xs"
                        onClick={() => requestCreateAdjustmentFromAudit(audit)}
                        disabled={isGenerating || Boolean(audit.adjustmentId)}
                      >
                        {isGenerating ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle className="size-3.5" />}
                        {audit.adjustmentId ? 'Ajuste generado' : differences.length > 0 ? 'Crear ajuste borrador' : 'Marcar revisada'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAuditPickerOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(auditConfirmation)}
        onOpenChange={(open) => {
          if (!open && !auditAdjustingId) {
            setAuditConfirmation(null);
            setAuditPickerOpen(true);
          }
        }}
        title={auditConfirmationDifferences.length > 0 ? '¿Crear ajuste borrador?' : '¿Marcar auditoría como revisada?'}
        description={auditConfirmation
          ? `Auditoría ${auditConfirmation.number}: ${auditConfirmationDifferences.length > 0 ? `se encontraron ${auditConfirmationDifferences.length} producto(s) con diferencia.` : 'no se encontraron diferencias.'}`
          : ''}
        confirmLabel={auditConfirmationDifferences.length > 0 ? 'Crear borrador' : 'Marcar revisada'}
        cancelLabel="Cancelar"
        variant="warning"
        contentClassName="!max-w-[520px]"
        loading={Boolean(auditAdjustingId)}
        onConfirm={confirmCreateAdjustmentFromAudit}
      >
        <div className="mt-4 space-y-3 text-left">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Diferencias</p>
              <p className="mt-1 text-lg font-black tabular-nums">{auditConfirmationDifferences.length}</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-red-700">Faltantes</p>
              <p className="mt-1 text-lg font-black tabular-nums text-red-700">{auditConfirmationShortages.length}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Sobrantes</p>
              <p className="mt-1 text-lg font-black tabular-nums text-emerald-700">{auditConfirmationSurpluses.length}</p>
            </div>
          </div>
          {auditConfirmationDifferences.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Productos a ajustar</p>
                <span className="text-[10px] text-muted-foreground">Sistema → físico</span>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-border/60 bg-background/70">
                {auditConfirmationDifferences.map((item: any, index: number) => {
                  const difference = auditDifference(item);
                  const originalStock = auditOriginalStock(item);
                  const countedStock = Number(item.countedStock ?? 0);
                  return (
                    <div key={`${item.productId || item.code || 'item'}-${index}`} className="flex items-center justify-between gap-3 border-b border-border/40 px-3 py-2.5 last:border-b-0">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{item.name || 'Producto sin nombre'}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{item.code || '—'}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-right">
                        <span className="font-mono text-[10px] text-muted-foreground">{originalStock} → {countedStock}</span>
                        <Badge variant="outline" className={`text-[10px] font-bold ${difference < 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                          {difference > 0 ? '+' : ''}{difference}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p className="leading-relaxed">
              {auditConfirmationDifferences.length > 0
                ? 'Se creará un ajuste como borrador. El stock no cambiará hasta que lo apruebes desde Ajustes.'
                : 'La auditoría se marcará como revisada y no se generará ningún movimiento de stock.'}
            </p>
          </div>
        </div>
      </ConfirmDialog>

      <Dialog open={isSerialAdjustOpen} onOpenChange={setIsSerialAdjustOpen}>
        <DialogContent
          className="grid grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0"
          style={{ width: 'calc(100vw - 2rem)', maxWidth: '520px', maxHeight: 'min(88vh, calc(100dvh - 3rem))' }}
        >
          <DialogHeader className="border-b border-border/60 px-5 pb-3 pt-5 pr-12" data-tour="inventory-serial-adjust-title">
            <DialogTitle className="text-base font-black tracking-tight">Ajustar IMEI / Series</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Alta o baja puntual de IMEI con movimiento auditado.
            </DialogDescription>
            <InventoryViewTutorial compact label="Cómo ajustar IMEI o series" targetPrefix="inventory-serial-adjust" copy={{ data: { description: 'Define agregar o remover, producto, almacén, IMEI o serie y motivo.' }, actions: { description: 'Guarda el ajuste para registrar el movimiento auditado.' } }} />
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto px-5 py-4" data-tour="inventory-serial-adjust-data">
            <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Acción</p>
                <Select value={serialAdjustment.action} onValueChange={(v) => setSerialAdjustment({ ...serialAdjustment, action: v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADD">Agregar</SelectItem>
                    <SelectItem value="REMOVE">Remover</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <p className="text-[10px] text-muted-foreground mb-1">Producto</p>
                <Combobox
                  options={serialProductOptions}
                  value={adjustmentSelectionValue(serialAdjustment.productId, serialAdjustment.variantId)}
                  onChange={handleSerialProductChange}
                  placeholder="Buscar producto o variante..."
                  searchPlaceholder="Buscar por código, nombre o variante..."
                  emptyMessage={serialAdjustment.warehouseId ? 'No hay productos en este almacén.' : 'Selecciona primero el almacén.'}
                  maxVisibleOptions={serialProductOptions.length}
                  className="h-9 w-full"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Almacén</p>
                <Select value={serialAdjustment.warehouseId} onValueChange={(v) => handleSerialWarehouseChange(v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Seleccionar almacén" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">IMEI / Serie</p>
                <Input
                  value={serialAdjustment.serialNumber}
                  onChange={(e) => setSerialAdjustment({ ...serialAdjustment, serialNumber: e.target.value })}
                  className="h-9 text-xs font-mono"
                  placeholder="Ej. 356938035643809"
                />
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Nota (opcional)</p>
              <Input
                value={serialAdjustment.notes}
                onChange={(e) => setSerialAdjustment({ ...serialAdjustment, notes: e.target.value })}
                className="h-9 text-xs"
                placeholder="Motivo del ajuste"
              />
            </div>
            </div>
          </div>
          <DialogFooter className="border-t border-border/60 px-5 py-4" data-tour="inventory-serial-adjust-actions">
            <Button variant="outline" onClick={() => setIsSerialAdjustOpen(false)} disabled={saving}>Cancelar</Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleSerialAdjustment}
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar ajuste'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReceptionOpen} onOpenChange={setIsReceptionOpen}>
        <DialogContent
          className="grid grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0"
          style={{ width: 'calc(100vw - 2rem)', maxWidth: '650px', maxHeight: 'min(88vh, calc(100dvh - 3rem))' }}
        >
          <DialogHeader className="border-b border-border/60 px-5 pb-3 pt-5 pr-12" data-tour="inventory-stock-reception-title">
            <DialogTitle className="text-base font-black tracking-tight">Registrar Recepción de Stock</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Registra entrada por producto, distribuye unidades por bodega y agrega IMEI/series.
            </DialogDescription>
            <InventoryViewTutorial compact label="Cómo registrar recepción de stock" targetPrefix="inventory-stock-reception" stepKeys={['title', 'data', 'items', 'actions']} copy={{ data: { description: 'Selecciona producto, cantidad, costo y moneda de la recepción.' }, items: { description: 'Distribuye las unidades por bodega y registra los IMEI o series cuando corresponda.' }, actions: { description: 'Guarda la recepción para actualizar las existencias.' } }} />
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto px-5 py-4" data-tour="inventory-stock-reception-data">
            <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Producto</p>
                <Select value={adjustmentSelectionValue(newReception.productId, newReception.variantId)} onValueChange={handleReceptionProductChange}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Seleccionar producto o variante" /></SelectTrigger>
                  <SelectContent>
                    {receptionProductOptions.map((p: any) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Cantidad total recibida</p>
                <Input
                  type="number"
                  min={1}
                  value={newReception.totalQuantity || ''}
                  onChange={(e) => setNewReception({ ...newReception, totalQuantity: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  className="h-9 text-xs"
                  placeholder="Ej. 40"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {canViewInventoryCost && <div>
                <p className="text-[10px] text-muted-foreground mb-1">Costo Unitario Referencia</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={newReception.unitCost || ''}
                    onChange={(e) => setNewReception({ ...newReception, unitCost: parseFloat(e.target.value) || 0 })}
                    className="h-9 text-xs flex-1"
                    placeholder="0.00"
                  />
                  <Select value={newReception.currency} onValueChange={(v) => setNewReception({ ...newReception, currency: v })}>
                    <SelectTrigger className="h-9 text-xs w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NIO">NIO</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Si se deja en 0, se usarǭ el costo actual del producto.</p>
              </div>}
            </div>

            <div className="space-y-2" data-tour="inventory-stock-reception-items">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Distribución por bodega/sucursal</p>
                <Button variant="outline" size="sm" className="h-8 text-[10px] uppercase tracking-widest" onClick={addAllocationRow}>
                  <Plus className="size-3 mr-1" /> Agregar fila
                </Button>
              </div>
              {allocations.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_120px_36px] gap-2 items-center">
                  <Select value={item.warehouseId} onValueChange={(v) => updateAllocation(item.id, { warehouseId: v })}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Bodega/Sucursal" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    value={item.quantity || ''}
                    onChange={(e) => updateAllocation(item.id, { quantity: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    className="h-9 text-xs text-right"
                    placeholder="Cantidad"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-rose-500 hover:bg-rose-700 hover:text-white"
                    onClick={() => removeAllocationRow(item.id)}
                    disabled={allocations.length <= 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total distribuido</span>
                <span className={totalAllocated === Number(newReception.totalQuantity || 0) ? 'font-black text-emerald-500' : 'font-black text-rose-500'}>
                  {totalAllocated} / {Number(newReception.totalQuantity || 0)}
                </span>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground mb-1">IMEI / Series (uno por línea, opcional)</p>
              <textarea
                value={newReception.imeiText}
                onChange={(e) => setNewReception({ ...newReception, imeiText: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs min-h-[120px]"
                placeholder={'Ejemplo:\n356938035643809\n356938035643810\n356938035643811'}
              />
              <p className="text-[10px] text-muted-foreground mt-1">{imeiList.length} IMEI/series capturados</p>
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Referencia / Nota (opcional)</p>
              <Input
                value={newReception.notes}
                onChange={(e) => setNewReception({ ...newReception, notes: e.target.value })}
                className="h-9 text-xs"
                placeholder="Ej. Recepción OC-2026-001 / Lote abril"
              />
            </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border/60 px-5 py-4" data-tour="inventory-stock-reception-actions">
            <Button variant="outline" onClick={() => { setIsReceptionOpen(false); resetReception(); }} disabled={saving}>
              Cancelar
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleCreateReception}
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar recepción'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {showTutorial && <GuidedTour steps={STOCK_TOUR_STEPS} onClose={() => setShowTutorial(false)} title="Control de Existencias" />}
    </Card>
  );
}
