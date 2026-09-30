import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PackagePlus, Pencil, Calculator, UserPlus, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { getApiErrorMessage } from '@/app/services/api';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Combobox } from '../../ui/Combobox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../ui/dialog';
import { intlImportsService, type IntlImportPackage, type ChargeablePreviewResult, type IntlVolumetricFactor } from '../../../services/intl-imports.service';
import { customersService } from '@/app/services/ventas.service';
import { suppliersService } from '@/app/services/compras.service';

export interface IntlPackageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (pkg: IntlImportPackage) => void;
  packageToEdit?: IntlImportPackage | null;
  /**
   * @deprecated El factor ya no se aplica en el cliente: lo resuelve el backend
   * con las reglas vigentes del tenant. Se conserva la prop para no romper los
   * llamadores que aún la pasan.
   */
  volumetricFactor?: number;
}

export function IntlPackageModal({
  open,
  onOpenChange,
  onSuccess,
  packageToEdit = null,
}: IntlPackageModalProps) {
  const isEditing = Boolean(packageToEdit);
  const [loading, setLoading] = useState(false);
  const [fetchingCustomers, setFetchingCustomers] = useState(false);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string; code?: string }>>([]);

  const [volumeMethod, setVolumeMethod] = useState<'dimensions' | 'direct'>('dimensions');
  const [volumetricRules, setVolumetricRules] = useState<IntlVolumetricFactor[]>([]);

  /**
   * 'auto'  -> el backend resuelve por pais + modalidad + transportista.
   * 'rule'  -> el operador asigna una de las reglas configuradas.
   * 'manual'-> factor escrito a mano, que exige un motivo.
   */
  const [ruleMode, setRuleMode] = useState<'auto' | 'rule' | 'manual'>('auto');

  const [form, setForm] = useState({
    trackingCode: '',
    originalTrackingNumber: '',
    customerId: '',
    customerName: '',
    supplierId: '',
    supplierName: '',
    senderName: '',
    description: '',
    actualWeightKg: '',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    directVolumeCbm: '',
    declaredValueUsd: '',
    originCountry: '',
    transportMode: '',
    carrier: '',
    volumetricRuleId: '',
    manualFactor: '',
    factorOverrideReason: '',
  });

  const loadVolumetricRules = useCallback(async () => {
    try {
      const list = await intlImportsService.listVolumetricFactors();
      setVolumetricRules(Array.isArray(list) ? list : []);
    } catch {
      setVolumetricRules([]);
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    try {
      setFetchingCustomers(true);
      const res = await (customersService.getLookup as (params?: { limit?: number }) => Promise<unknown>)({ limit: 100 });
      const list = Array.isArray(res)
        ? res
        : Array.isArray((res as { data?: unknown })?.data)
          ? (res as { data: unknown[] }).data
          : [];
      setCustomers(list as Array<{ id: string; name: string; code?: string }>);
    } catch {
      // silent catch
    } finally {
      setFetchingCustomers(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (customersService.getLookup as (params?: { limit?: number }) => Promise<unknown>)({ limit: 100 })
      .then((res: unknown) => {
        if (!mounted) return;
        const list = Array.isArray(res)
          ? res
          : Array.isArray((res as { data?: unknown })?.data)
            ? (res as { data: unknown[] }).data
            : [];
        setCustomers(list as Array<{ id: string; name: string; code?: string }>);
      })
      .catch(() => undefined);

    (suppliersService.getLookup as (params?: { limit?: number }) => Promise<unknown>)({ limit: 100 })
      .then((res: unknown) => {
        if (!mounted) return;
        const list = Array.isArray(res)
          ? res
          : Array.isArray((res as { data?: unknown })?.data)
            ? (res as { data: unknown[] }).data
            : [];
        setSuppliers(list as Array<{ id: string; name: string; code?: string }>);
      })
      .catch(() => undefined);

    return () => { mounted = false; };
  }, []);

  const customerOptions = useMemo(() => {
    return customers.map((c) => ({
      value: c.name,
      label: c.name,
      description: c.code ? `[${c.code}] ${c.name}` : undefined,
    }));
  }, [customers]);

  const supplierOptions = useMemo(() => {
    return suppliers.map((s) => ({
      value: s.name,
      label: s.name,
      description: s.code ? `[${s.code}] ${s.name}` : undefined,
    }));
  }, [suppliers]);

  useEffect(() => {
    if (open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      if (packageToEdit) {
        const custName = packageToEdit.customer?.name || packageToEdit.customerName || '';
        const suppId = packageToEdit.supplierId || packageToEdit.supplier?.id || '';
        const suppName = packageToEdit.supplier?.name || packageToEdit.supplierName || '';
        const hasDims = Boolean(packageToEdit.lengthCm || packageToEdit.widthCm || packageToEdit.heightCm);
        setVolumeMethod(hasDims ? 'dimensions' : 'direct');

        setForm({
          trackingCode: packageToEdit.trackingCode || '',
          originalTrackingNumber: packageToEdit.originalTrackingNumber || '',
          customerId: packageToEdit.customerId || packageToEdit.customer?.id || '',
          customerName: custName,
          supplierId: suppId,
          supplierName: suppName,
          senderName: packageToEdit.senderName || '',
          description: packageToEdit.description || '',
          actualWeightKg: packageToEdit.actualWeightKg != null ? String(packageToEdit.actualWeightKg) : '',
          lengthCm: packageToEdit.lengthCm != null ? String(packageToEdit.lengthCm) : '',
          widthCm: packageToEdit.widthCm != null ? String(packageToEdit.widthCm) : '',
          heightCm: packageToEdit.heightCm != null ? String(packageToEdit.heightCm) : '',
          directVolumeCbm: packageToEdit.volumeCbm != null ? String(packageToEdit.volumeCbm) : '',
          declaredValueUsd: packageToEdit.declaredValueUsd != null ? String(packageToEdit.declaredValueUsd) : '',
          originCountry: packageToEdit.originCountry || '',
          transportMode: packageToEdit.transportMode || '',
          carrier: packageToEdit.carrier || '',
          volumetricRuleId: packageToEdit.volumetricRuleId || '',
          manualFactor: '',
          factorOverrideReason: packageToEdit.factorOverrideReason || '',
        });
      } else {
        setVolumeMethod('dimensions');
        setRuleMode('auto');
        setForm({
          trackingCode: '',
          originalTrackingNumber: '',
          customerId: '',
          customerName: '',
          supplierId: '',
          supplierName: '',
          senderName: '',
          description: '',
          actualWeightKg: '',
          lengthCm: '',
          widthCm: '',
          heightCm: '',
          directVolumeCbm: '',
          declaredValueUsd: '',
          originCountry: '',
          transportMode: '',
          carrier: '',
          volumetricRuleId: '',
          manualFactor: '',
          factorOverrideReason: '',
        });
      }
      // El catalogo de reglas se recarga al abrir: si el operador creo o edito
      // una regla en Configuracion, el selector la ve sin recargar la pagina.
      void loadVolumetricRules();
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open, packageToEdit, loadVolumetricRules]);

  const isUnregisteredCustomer = Boolean(form.customerName.trim()) && !form.customerId;

  const numericWeightKg = parseFloat(form.actualWeightKg) || 0;
  const numericLength = parseFloat(form.lengthCm) || 0;
  const numericWidth = parseFloat(form.widthCm) || 0;
  const numericHeight = parseFloat(form.heightCm) || 0;
  const numericDirectVolume = parseFloat(form.directVolumeCbm) || 0;
  const numericDeclaredValue = parseFloat(form.declaredValueUsd) || 0;
  const numericManualFactor = parseFloat(form.manualFactor) || 0;

  const computedVolumeCbm = useMemo(() => {
    if (volumeMethod === 'dimensions') {
      if (numericLength > 0 && numericWidth > 0 && numericHeight > 0) {
        return Number(((numericLength * numericWidth * numericHeight) / 1000000).toFixed(4));
      }
      return 0;
    }
    return numericDirectVolume > 0 ? numericDirectVolume : 0;
  }, [volumeMethod, numericLength, numericWidth, numericHeight, numericDirectVolume]);

  /**
   * El peso facturable lo decide el backend con la regla vigente del tenant.
   * Antes se replicaba la formula aqui con el factor global, lo que producia
   * pantallas que no coincidian con lo persistido. Ahora solo se muestra lo
   * que devuelve el servidor.
   */
  const [chargeablePreview, setChargeablePreview] = useState<ChargeablePreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    // Todo el setState ocurre dentro del temporizador: llamarlo de forma
    // sincrona en el efecto provoke renders en cascada.
    const timer = setTimeout(async () => {
      if (numericWeightKg <= 0 || computedVolumeCbm <= 0) {
        setChargeablePreview(null);
        setPreviewLoading(false);
        return;
      }
      setPreviewLoading(true);
      try {
        const result = await intlImportsService.previewChargeable({
          actualWeightKg: numericWeightKg,
          volumeCbm: computedVolumeCbm,
          originCountry: form.originCountry.trim().toUpperCase() || undefined,
          transportMode: form.transportMode || undefined,
          carrier: form.carrier.trim().toUpperCase() || undefined,
          // Solo viaja un factor escrito a mano; la regla viaja por ID para que
          // el backend lea el factor de la regla almacenada y lo congele.
          volumetricRuleId: ruleMode === 'rule' && form.volumetricRuleId ? form.volumetricRuleId : undefined,
          volumetricFactorKgPerCbm: ruleMode === 'manual' ? numericManualFactor || undefined : undefined,
        });
        if (!cancelled) setChargeablePreview(result);
      } catch {
        // Un fallo del preview no debe bloquear el formulario: el backend
        // vuelve a calcular y validar al guardar.
        if (!cancelled) setChargeablePreview(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    open,
    numericWeightKg,
    computedVolumeCbm,
    form.originCountry,
    form.transportMode,
    form.carrier,
    form.volumetricRuleId,
    form.manualFactor,
    numericManualFactor,
    ruleMode,
  ]);

  const chargeableWeightKg = chargeablePreview?.chargeableWeight ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numericWeightKg <= 0) {
      toast.error('El peso real debe ser mayor a 0 kg');
      return;
    }
    if (computedVolumeCbm <= 0) {
      // Antes se enviaba 0.001 CBM inventado cuando faltaban dimensiones,
      // lo que persistia un volumen falso irreconocible.
      toast.error(
        volumeMethod === 'dimensions'
          ? 'Complete largo, ancho y alto para calcular el volumen'
          : 'Indique el volumen en CBM',
      );
      return;
    }
    if (ruleMode === 'rule' && !form.volumetricRuleId) {
      toast.error('Seleccione la regla de factor volumetrico a aplicar');
      return;
    }
    if (ruleMode === 'manual') {
      if (numericManualFactor <= 0) {
        toast.error('Indique el factor volumetrico a aplicar');
        return;
      }
      if (!form.factorOverrideReason.trim()) {
        toast.error('El factor manual exige un motivo: queda registrado en la auditoria');
        return;
      }
    }

    try {
      setLoading(true);
      const finalCustomerId = form.customerId.trim() || undefined;
      const finalSupplierId = form.supplierId.trim() || undefined;
      const finalLength = volumeMethod === 'dimensions' ? (numericLength || undefined) : undefined;
      const finalWidth = volumeMethod === 'dimensions' ? (numericWidth || undefined) : undefined;
      const finalHeight = volumeMethod === 'dimensions' ? (numericHeight || undefined) : undefined;

      if (isEditing && packageToEdit) {
        const updated = await intlImportsService.updatePackage(packageToEdit.id, {
          trackingCode: form.trackingCode.trim() || undefined,
          originalTrackingNumber: form.originalTrackingNumber.trim() || undefined,
          customerId: finalCustomerId,
          customerName: form.customerName.trim() || undefined,
          supplierId: finalSupplierId,
          supplierName: form.supplierName.trim() || undefined,
          senderName: form.senderName.trim() || undefined,
          description: form.description.trim() || undefined,
          actualWeightKg: numericWeightKg,
          lengthCm: finalLength,
          widthCm: finalWidth,
          heightCm: finalHeight,
          volumeCbm: computedVolumeCbm,
          originCountry: form.originCountry.trim().toUpperCase() || undefined,
          transportMode: form.transportMode || undefined,
          carrier: form.carrier.trim().toUpperCase() || undefined,
          volumetricRuleId: ruleMode === 'rule' ? form.volumetricRuleId : undefined,
          volumetricFactorKgPerCbm: ruleMode === 'manual' ? numericManualFactor : undefined,
          factorOverrideReason: ruleMode === 'manual' ? form.factorOverrideReason.trim() : undefined,
          declaredValueUsd: numericDeclaredValue || 0,
        });

        toast.success(`Paquete ${updated.trackingCode} actualizado exitosamente`);
        onSuccess(updated);
      } else {
        const created = await intlImportsService.createPackage({
          trackingCode: form.trackingCode.trim() || undefined,
          originalTrackingNumber: form.originalTrackingNumber.trim() || undefined,
          customerId: finalCustomerId,
          customerName: form.customerName.trim() || undefined,
          supplierId: finalSupplierId,
          supplierName: form.supplierName.trim() || undefined,
          senderName: form.senderName.trim() || undefined,
          description: form.description.trim() || undefined,
          actualWeightKg: numericWeightKg,
          lengthCm: finalLength,
          widthCm: finalWidth,
          heightCm: finalHeight,
          volumeCbm: computedVolumeCbm,
          originCountry: form.originCountry.trim().toUpperCase() || undefined,
          transportMode: form.transportMode || undefined,
          carrier: form.carrier.trim().toUpperCase() || undefined,
          volumetricRuleId: ruleMode === 'rule' ? form.volumetricRuleId : undefined,
          volumetricFactorKgPerCbm: ruleMode === 'manual' ? numericManualFactor : undefined,
          factorOverrideReason: ruleMode === 'manual' ? form.factorOverrideReason.trim() : undefined,
          declaredValueUsd: numericDeclaredValue || undefined,
          status: 'RECEIVED_AT_WAREHOUSE',
        });

        toast.success(`Paquete ${created.trackingCode} registrado exitosamente`);
        onSuccess(created);
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, `Error al ${isEditing ? 'actualizar' : 'crear'} el paquete`));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold">
            {isEditing ? <Pencil className="size-5" /> : <PackagePlus className="size-5" />}
            <DialogTitle>
              {isEditing ? `Editar Paquete ${packageToEdit?.trackingCode}` : 'Nuevo Paquete - Bodega Origen'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isEditing
              ? 'Modifica las características, cliente, peso, dimensiones o valor declarado de este paquete.'
              : 'Registra el ingreso del paquete en la bodega origen (Panamá, China, EE.UU., etc.).'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Bloque 1: Contenedor del Cliente */}
          <div className="border border-border/70 rounded-lg p-3 bg-muted/20 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-foreground block">
                Cliente / Destinatario
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                  onClick={loadCustomers}
                  disabled={fetchingCustomers}
                  title="Refrescar lista de clientes"
                >
                  <RefreshCw className={`size-3 ${fetchingCustomers ? 'animate-spin' : ''}`} />
                  Refrescar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[11px] text-primary hover:text-primary/80 gap-1"
                  onClick={() => window.open('/clientes', '_blank')}
                  title="Registrar cliente en el portal de clientes"
                >
                  <UserPlus className="size-3" />
                  Registrar cliente
                </Button>
              </div>
            </div>

            <Combobox
              options={customerOptions}
              value={form.customerName}
              onChange={(val) => {
                const matched = customers.find(
                  (c) => c.name.toLowerCase() === val.toLowerCase() || c.code?.toLowerCase() === val.toLowerCase()
                );
                setForm((prev) => ({
                  ...prev,
                  customerName: val,
                  customerId: matched ? matched.id : '',
                }));
              }}
              placeholder="Ej. Comercializadora Nova S.A."
              searchPlaceholder="Buscar cliente por nombre o código..."
              emptyMessage="No se encontraron clientes coincidentes."
              allowCustomValue={true}
            />

            {isUnregisteredCustomer && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-amber-500/10 border border-amber-500/30 rounded-md p-2.5 text-[11px] text-amber-800 dark:text-amber-300">
                <span className="flex items-start sm:items-center gap-1.5 min-w-0">
                  <UserPlus className="size-3.5 shrink-0 mt-0.5 sm:mt-0 text-amber-600 dark:text-amber-400" />
                  <span className="break-words">
                    El cliente <strong className="font-semibold text-foreground">{form.customerName}</strong> no está en el catálogo. ¿Deseas registrarlo?
                  </span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 w-full sm:w-auto text-[11px] bg-background hover:bg-muted shrink-0 border-amber-500/40 text-amber-900 dark:text-amber-200"
                  onClick={() => window.open('/clientes', '_blank')}
                  title="Abrir portal de clientes en una pestaña nueva"
                >
                  Ir a Clientes
                  <ExternalLink className="size-3 ml-1" />
                </Button>
              </div>
            )}
          </div>

          {/* Bloque 2: Contenedor dedicado al Proveedor (Proveedor Origen, Factura, Valor Declarado) */}
          <div className="border border-border/70 rounded-lg p-3 bg-muted/20 space-y-3">
            <div className="text-xs font-bold text-foreground">
              Proveedor, Origen y Referencia
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Proveedor Origen / Remitente
                </label>
                <Combobox
                  options={supplierOptions}
                  value={form.supplierName}
                  onChange={(val) => {
                    const matched = suppliers.find(
                      (s) => s.name.toLowerCase() === val.toLowerCase() || s.code?.toLowerCase() === val.toLowerCase()
                    );
                    setForm((prev) => ({
                      ...prev,
                      supplierName: val,
                      supplierId: matched ? matched.id : '',
                    }));
                  }}
                  placeholder="Ej. Shenzhen Trade Co."
                  searchPlaceholder="Buscar proveedor por nombre o código..."
                  emptyMessage="No se encontraron proveedores coincidentes."
                  allowCustomValue={true}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  N.° Factura / Referencia / Courier
                </label>
                <Input
                  placeholder="Ej. INV-998822 / 1Z999..."
                  value={form.originalTrackingNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, originalTrackingNumber: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Valor Declarado (USD)
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.declaredValueUsd}
                  onChange={(e) => setForm((prev) => ({ ...prev, declaredValueUsd: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Bloque 3: Descripción del Contenido */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Descripción del Contenido
            </label>
            <Input
              placeholder="Ej. Repuestos electrónicos, accesorios de computadora"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {/* Bloque 4: Cubicaje y Peso Cobrable */}
          <div className="border border-border/70 rounded-lg p-3 sm:p-3.5 bg-muted/30 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Calculator className="size-4 text-primary shrink-0" />
                <span>Cubicaje y Peso Cobrable</span>
              </div>
              {chargeablePreview && (
                <span className="text-[11px] font-medium text-muted-foreground font-mono">
                  {chargeablePreview.appliedRule.label} · {chargeablePreview.volumetricFactorKgPerCbm} kg/CBM
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-3">
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Regla de factor volumétrico
                </label>
                <select
                  value={ruleMode}
                  onChange={(e) => {
                    const mode = e.target.value as 'auto' | 'rule' | 'manual';
                    setRuleMode(mode);
                    // El factor solo viaja en un sentido: al salir de 'manual'
                    // se descarta el override para no mandarlo con una regla.
                    setForm((prev) => ({
                      ...prev,
                      volumetricRuleId: mode === 'rule' ? prev.volumetricRuleId : '',
                      manualFactor: mode === 'manual' ? prev.manualFactor : '',
                      factorOverrideReason: mode === 'manual' ? prev.factorOverrideReason : '',
                    }));
                  }}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="auto">Automática — según país, transporte y transportista</option>
                  <option value="rule">Regla específica — asignar una del catálogo</option>
                  <option value="manual">Otro factor — manual, exige motivo</option>
                </select>
              </div>
            </div>

            {ruleMode === 'rule' && (
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Regla a aplicar
                  </label>
                  <select
                    value={form.volumetricRuleId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const rule = volumetricRules.find((r) => r.id === id);
                      setForm((prev) => ({
                        ...prev,
                        volumetricRuleId: id,
                        // Solo se completa lo que el operador dejo en blanco.
                        // Si ya declaro un origen distinto al de la regla, ese
                        // valor manda: es justamente el caso que motiva poder
                        // asignar una regla que no coincide con el ambito.
                        originCountry: prev.originCountry.trim() || rule?.originCountry || '',
                        transportMode: prev.transportMode || rule?.transportMode || '',
                        carrier: prev.carrier.trim() || rule?.carrier || '',
                      }));
                    }}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="">Seleccione una regla…</option>
                    {volumetricRules.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label} — {r.factorKgPerCbm} kg/CBM
                        {r.originCountry ? ` [${r.originCountry}${r.transportMode ? ` / ${r.transportMode}` : ''}${r.carrier ? ` / ${r.carrier}` : ''}]` : ' [global]'}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    El factor y su configuración quedan congelados en el paquete: si la regla cambia después, este paquete no se recalcula.
                  </p>
                </div>
              </div>
            )}

            {ruleMode === 'manual' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Factor (kg/CBM) *
                  </label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.manualFactor}
                    onChange={(e) => setForm((prev) => ({ ...prev, manualFactor: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Motivo del ajuste *
                  </label>
                  <Input
                    type="text"
                    placeholder="Ej. Ajuste acordado con el transportista"
                    value={form.factorOverrideReason}
                    onChange={(e) => setForm((prev) => ({ ...prev, factorOverrideReason: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1" title="Determina qué regla volumétrica aplica">
                  País de origen
                </label>
                <Input
                  type="text"
                  placeholder="PAN"
                  value={form.originCountry}
                  onChange={(e) => setForm((prev) => ({ ...prev, originCountry: e.target.value }))}
                  className="font-mono uppercase"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">Medio de transporte</label>
                <select
                  value={form.transportMode}
                  onChange={(e) => setForm((prev) => ({ ...prev, transportMode: e.target.value }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="">Sin especificar</option>
                  <option value="MARITIMO">Marítimo</option>
                  <option value="AEREO">Aéreo</option>
                  <option value="TERRESTRE">Terrestre</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">Transportista</label>
                <Input
                  type="text"
                  placeholder="MAERSK"
                  value={form.carrier}
                  onChange={(e) => setForm((prev) => ({ ...prev, carrier: e.target.value }))}
                  className="font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">Peso Real (kg) *</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="0.00"
                  value={form.actualWeightKg}
                  onChange={(e) => setForm((prev) => ({ ...prev, actualWeightKg: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Método de Cálculo de Volumen
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-muted/80 rounded-lg border border-border/60 text-xs h-10 items-center">
                  <button
                    type="button"
                    className={`h-full rounded-md font-medium text-xs transition-colors flex items-center justify-center ${
                      volumeMethod === 'dimensions'
                        ? 'bg-background text-foreground shadow-sm font-bold border border-border/50'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setVolumeMethod('dimensions')}
                  >
                    Dimensiones (cm)
                  </button>
                  <button
                    type="button"
                    className={`h-full rounded-md font-medium text-xs transition-colors flex items-center justify-center ${
                      volumeMethod === 'direct'
                        ? 'bg-background text-foreground shadow-sm font-bold border border-border/50'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setVolumeMethod('direct')}
                  >
                    Directo (CBM)
                  </button>
                </div>
              </div>
            </div>

            {volumeMethod === 'dimensions' ? (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Largo (cm)</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={form.lengthCm}
                    onChange={(e) => setForm((prev) => ({ ...prev, lengthCm: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Ancho (cm)</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={form.widthCm}
                    onChange={(e) => setForm((prev) => ({ ...prev, widthCm: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Alto (cm)</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={form.heightCm}
                    onChange={(e) => setForm((prev) => ({ ...prev, heightCm: e.target.value }))}
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Volumen Directo (CBM) *
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.0000"
                  value={form.directVolumeCbm}
                  onChange={(e) => setForm((prev) => ({ ...prev, directVolumeCbm: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/40 text-xs">
              <div className="flex justify-between items-center bg-background px-3 py-2 rounded border border-border/50">
                <span className="text-muted-foreground font-medium">Volumen Final:</span>
                <span className="font-mono font-bold text-primary">{computedVolumeCbm} CBM</span>
              </div>
              <div className="flex justify-between items-center bg-background px-3 py-2 rounded border border-border/50">
                <span className="text-muted-foreground font-medium">Peso Cobrable:</span>
                <span className="font-mono font-bold text-foreground">
                  {previewLoading ? 'Calculando...' : chargeableWeightKg != null ? `${chargeableWeightKg} kg` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center bg-background px-3 py-2 rounded border border-border/50 sm:col-span-2">
                <span className="text-muted-foreground font-medium">CBM Facturable:</span>
                <span className="font-mono font-bold text-foreground">
                  {chargeablePreview ? `${chargeablePreview.billableCbm} CBM` : '—'}
                  {chargeablePreview && (
                    <span className="ml-2 font-sans text-[10px] font-semibold text-muted-foreground">
                      (base {chargeablePreview.chargeableBasis === 'WEIGHT_BASED' ? 'por peso' : 'por volumen'})
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Registrar Paquete'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Aliases for backwards compatibility
export const NewIntlPackageModal = IntlPackageModal;
export function EditIntlPackageModal({
  packageData,
  open,
  onOpenChange,
  onSuccess,
}: {
  packageData?: IntlImportPackage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (pkg: IntlImportPackage) => void;
}) {
  return (
    <IntlPackageModal
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      packageToEdit={packageData}
    />
  );
}
