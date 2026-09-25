import React, { useState, useEffect, useMemo } from 'react';
import { PackagePlus, Pencil, Calculator } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { getApiErrorMessage } from '@/app/services/api';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../ui/dialog';
import { intlImportsService, type IntlImportPackage } from '../../../services/intl-imports.service';
import { customersService } from '@/app/services/ventas.service';

export interface IntlPackageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (pkg: IntlImportPackage) => void;
  packageToEdit?: IntlImportPackage | null;
  volumetricFactor?: number;
}

export function IntlPackageModal({
  open,
  onOpenChange,
  onSuccess,
  packageToEdit = null,
  volumetricFactor = 167,
}: IntlPackageModalProps) {
  const isEditing = Boolean(packageToEdit);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; code?: string }>>([]);

  const [volumeMethod, setVolumeMethod] = useState<'dimensions' | 'direct'>('dimensions');

  const [form, setForm] = useState({
    trackingCode: '',
    originalTrackingNumber: '',
    customerId: '',
    customerName: '',
    supplierName: '',
    senderName: '',
    description: '',
    actualWeightKg: '',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    directVolumeCbm: '',
    declaredValueUsd: '',
  });

  useEffect(() => {
    let mounted = true;
    (customersService.getLookup as any)({ limit: 100 })
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
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (open) {
      if (packageToEdit) {
        const custName = packageToEdit.customer?.name || packageToEdit.customerName || '';
        const suppName = packageToEdit.supplier?.name || packageToEdit.supplierName || '';
        const hasDims = Boolean(packageToEdit.lengthCm || packageToEdit.widthCm || packageToEdit.heightCm);
        setVolumeMethod(hasDims ? 'dimensions' : 'direct');

        setForm({
          trackingCode: packageToEdit.trackingCode || '',
          originalTrackingNumber: packageToEdit.originalTrackingNumber || '',
          customerId: packageToEdit.customerId || packageToEdit.customer?.id || '',
          customerName: custName,
          supplierName: suppName,
          senderName: packageToEdit.senderName || '',
          description: packageToEdit.description || '',
          actualWeightKg: packageToEdit.actualWeightKg != null ? String(packageToEdit.actualWeightKg) : '',
          lengthCm: packageToEdit.lengthCm != null ? String(packageToEdit.lengthCm) : '',
          widthCm: packageToEdit.widthCm != null ? String(packageToEdit.widthCm) : '',
          heightCm: packageToEdit.heightCm != null ? String(packageToEdit.heightCm) : '',
          directVolumeCbm: packageToEdit.volumeCbm != null ? String(packageToEdit.volumeCbm) : '',
          declaredValueUsd: packageToEdit.declaredValueUsd != null ? String(packageToEdit.declaredValueUsd) : '',
        });
      } else {
        setVolumeMethod('dimensions');
        setForm({
          trackingCode: '',
          originalTrackingNumber: '',
          customerId: '',
          customerName: '',
          supplierName: '',
          senderName: '',
          description: '',
          actualWeightKg: '',
          lengthCm: '',
          widthCm: '',
          heightCm: '',
          directVolumeCbm: '',
          declaredValueUsd: '',
        });
      }
    }
  }, [open, packageToEdit]);

  const numericWeightKg = parseFloat(form.actualWeightKg) || 0;
  const numericLength = parseFloat(form.lengthCm) || 0;
  const numericWidth = parseFloat(form.widthCm) || 0;
  const numericHeight = parseFloat(form.heightCm) || 0;
  const numericDirectVolume = parseFloat(form.directVolumeCbm) || 0;
  const numericDeclaredValue = parseFloat(form.declaredValueUsd) || 0;

  const computedVolumeCbm = useMemo(() => {
    if (volumeMethod === 'dimensions') {
      if (numericLength > 0 && numericWidth > 0 && numericHeight > 0) {
        return Number(((numericLength * numericWidth * numericHeight) / 1000000).toFixed(4));
      }
      return 0;
    }
    return numericDirectVolume > 0 ? numericDirectVolume : 0;
  }, [volumeMethod, numericLength, numericWidth, numericHeight, numericDirectVolume]);

  const chargeableWeightKg = useMemo(() => {
    const volumetricWeight = computedVolumeCbm * volumetricFactor;
    return Number(Math.max(numericWeightKg, volumetricWeight).toFixed(2));
  }, [numericWeightKg, computedVolumeCbm, volumetricFactor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numericWeightKg <= 0) {
      toast.error('El peso real debe ser mayor a 0 kg');
      return;
    }

    try {
      setLoading(true);
      const finalCustomerId = form.customerId.trim() || undefined;
      const finalVolume = computedVolumeCbm > 0 ? computedVolumeCbm : 0.001;
      const finalLength = volumeMethod === 'dimensions' ? (numericLength || undefined) : undefined;
      const finalWidth = volumeMethod === 'dimensions' ? (numericWidth || undefined) : undefined;
      const finalHeight = volumeMethod === 'dimensions' ? (numericHeight || undefined) : undefined;

      if (isEditing && packageToEdit) {
        const updated = await intlImportsService.updatePackage(packageToEdit.id, {
          trackingCode: form.trackingCode.trim() || undefined,
          originalTrackingNumber: form.originalTrackingNumber.trim() || undefined,
          customerId: finalCustomerId,
          customerName: form.customerName.trim() || undefined,
          supplierName: form.supplierName.trim() || undefined,
          senderName: form.senderName.trim() || undefined,
          description: form.description.trim() || undefined,
          actualWeightKg: numericWeightKg,
          lengthCm: finalLength,
          widthCm: finalWidth,
          heightCm: finalHeight,
          volumeCbm: finalVolume,
          chargeableWeightKg,
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
          supplierName: form.supplierName.trim() || undefined,
          senderName: form.senderName.trim() || undefined,
          description: form.description.trim() || undefined,
          actualWeightKg: numericWeightKg,
          lengthCm: finalLength,
          widthCm: finalWidth,
          heightCm: finalHeight,
          volumeCbm: finalVolume,
          chargeableWeightKg,
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                N.° Factura / Referencia / Courier Original
              </label>
              <Input
                placeholder="Ej. INV-998822 / 1Z9999999999999999"
                value={form.originalTrackingNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, originalTrackingNumber: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Cliente / Destinatario
              </label>
              <Input
                list="intl-unified-customers-list"
                placeholder="Ej. Comercializadora Nova S.A."
                value={form.customerName}
                onChange={(e) => {
                  const text = e.target.value;
                  const matched = customers.find(
                    (c) => c.name.toLowerCase() === text.toLowerCase() || c.code?.toLowerCase() === text.toLowerCase()
                  );
                  setForm((prev) => ({
                    ...prev,
                    customerName: text,
                    customerId: matched ? matched.id : '',
                  }));
                }}
              />
              <datalist id="intl-unified-customers-list">
                {customers.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.code ? `[${c.code}] ` : ''}{c.name}
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Remitente / Proveedor Origen
              </label>
              <Input
                placeholder="Ej. Shenzhen Trade Co."
                value={form.supplierName}
                onChange={(e) => setForm((prev) => ({ ...prev, supplierName: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Valor Declarado USD (Opcional)
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

          {/* Peso y Cubicaje */}
          <div className="border border-border/70 rounded-lg p-3.5 bg-muted/30 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Calculator className="size-4 text-emerald-600 dark:text-emerald-400" />
                Cubicaje y Peso Cobrable (Regla IATA: {volumetricFactor} kg/CBM)
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
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{computedVolumeCbm} CBM</span>
              </div>
              <div className="flex justify-between items-center bg-background px-3 py-2 rounded border border-border/50">
                <span className="text-muted-foreground font-medium">Peso Cobrable:</span>
                <span className="font-mono font-bold text-foreground">{chargeableWeightKg} kg</span>
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
export function EditIntlPackageModal({ packageData, open, onOpenChange, onSuccess }: any) {
  return (
    <IntlPackageModal
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      packageToEdit={packageData}
    />
  );
}
