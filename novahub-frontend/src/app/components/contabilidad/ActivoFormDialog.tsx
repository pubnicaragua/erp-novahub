import { useEffect, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Combobox } from '../ui/Combobox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { contabilidadService } from '../../services/contabilidad.service';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';
import { api } from '../../services/api';
import { toast } from 'sonner';

interface ActivoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface ActivoForm {
  code: string;
  name: string;
  categoryId: string;
  brand: string;
  model: string;
  serialNumber: string;
  location: string;
  branchId: string;
  costCenterId: string;
  responsibleText: string;
  invoiceNumber: string;
  acquisitionDate: string;
  inUseDate: string;
  currency: string;
  exchangeRate: string;
  cost: string;
  residualValue: string;
  initialAccumDepreciation: string;
  cutoffDate: string;
}

function emptyForm(): ActivoForm {
  return {
    code: '', name: '', categoryId: '', brand: '', model: '', serialNumber: '', location: '',
    branchId: '', costCenterId: '', responsibleText: '', invoiceNumber: '',
    acquisitionDate: '', inUseDate: '', currency: 'NIO', exchangeRate: '1',
    cost: '', residualValue: '0', initialAccumDepreciation: '0', cutoffDate: '',
  };
}

export function ActivoFormDialog({ open, onOpenChange, onCreated }: ActivoFormDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<ActivoForm>(emptyForm());
  const [branches, setBranches] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);

  const categoriesQuery = useAccountingQuery<any[]>(['fixed-asset-categories'], async (signal) =>
    accountingList(await contabilidadService.getFixedAssetCategories(signal)),
  );
  const categories = categoriesQuery.data || [];

  useEffect(() => {
    api.get<any[]>('/sucursales').then((res) => setBranches(Array.isArray(res) ? res : [])).catch(() => {});
    api.get<any[]>('/accounting/cost-centers').then((res) => setCostCenters(Array.isArray(res) ? res : [])).catch(() => {});
  }, []);

  useEffect(() => {
    const selectedCategory = categories.find((c) => c.id === form.categoryId);
    const usefulLifeMonths = selectedCategory?.usefulLifeMonths || 0;
    const costVal = Number(form.cost) || 0;
    const residualVal = Number(form.residualValue) || 0;
    const calculated = usefulLifeMonths > 0 ? (costVal - residualVal) / usefulLifeMonths : 0;
    setForm((prev) => ({ ...prev, initialAccumDepreciation: calculated.toFixed(2) }));
  }, [form.cost, form.residualValue, form.categoryId, categories]);

  function setField(field: keyof ActivoForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function reset() {
    setForm(emptyForm());
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.categoryId || !form.cost) { toast.error('Completa Nombre, Categoría y Costo'); return; }
    if (!form.acquisitionDate || !form.inUseDate) { toast.error('Ingresa las fechas de adquisición y puesta en uso'); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      await contabilidadService.createFixedAsset({
        ...form,
        cost: Number(form.cost),
        residualValue: Number(form.residualValue),
        exchangeRate: Number(form.exchangeRate) || 1,
        initialAccumDepreciation: Number(form.initialAccumDepreciation),
        branchId: form.branchId || null,
        costCenterId: form.costCenterId || null,
        cutoffDate: form.cutoffDate || null,
      });
      toast.success('Activo fijo creado');
      onOpenChange(false);
      reset();
      onCreated();
    } catch (err: any) {
      toast.error(err.message || 'Error al crear activo');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Activo Fijo</DialogTitle>
          <DialogDescription>Ingresa los datos del activo para calcular su depreciación</DialogDescription>
        </DialogHeader>
        <Card className="border-0 shadow-none">
          <CardContent className="grid grid-cols-1 gap-3 p-0 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="af-name">Nombre *</Label>
              <Input id="af-name" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Ej: Laptop HP ProBook" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="af-code">Código</Label>
              <Input id="af-code" value={form.code} onChange={(e) => setField('code', e.target.value)} placeholder="ACT-001" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="af-cat">Categoría *</Label>
              <Combobox
                options={categories.map((c) => ({ label: c.name, value: c.id }))}
                value={form.categoryId}
                onChange={(v) => setField('categoryId', v)}
                placeholder="Seleccionar categoría"
                emptyMessage="Sin categorías. Carga las categorías por defecto."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="af-branch">Sucursal</Label>
              <Combobox
                options={branches.map((b) => ({ label: b.name, value: b.id }))}
                value={form.branchId}
                onChange={(v) => setField('branchId', v)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="af-cc">Centro de costo</Label>
              <Combobox
                options={costCenters.map((c) => ({ label: c.name, value: c.id }))}
                value={form.costCenterId}
                onChange={(v) => setField('costCenterId', v)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="af-brand">Marca</Label>
              <Input id="af-brand" value={form.brand} onChange={(e) => setField('brand', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="af-model">Modelo</Label>
              <Input id="af-model" value={form.model} onChange={(e) => setField('model', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="af-serial">No. serie</Label>
              <Input id="af-serial" value={form.serialNumber} onChange={(e) => setField('serialNumber', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="af-loc">Ubicación</Label>
              <Input id="af-loc" value={form.location} onChange={(e) => setField('location', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="af-resp">Responsable</Label>
              <Input id="af-resp" value={form.responsibleText} onChange={(e) => setField('responsibleText', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="af-inv">No. factura</Label>
              <Input id="af-inv" value={form.invoiceNumber} onChange={(e) => setField('invoiceNumber', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="af-addr">Fecha adquisición *</Label>
              <Input id="af-addr" type="date" value={form.acquisitionDate} onChange={(e) => setField('acquisitionDate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="af-use">Fecha puesta en uso *</Label>
              <Input id="af-use" type="date" value={form.inUseDate} onChange={(e) => setField('inUseDate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="af-cost">Costo *</Label>
              <Input id="af-cost" type="number" step="0.01" min="0" value={form.cost} onChange={(e) => setField('cost', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="af-resid">Valor residual</Label>
              <Input id="af-resid" type="number" step="0.01" min="0" value={form.residualValue} onChange={(e) => setField('residualValue', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="af-init">Dep. acumulada inicial</Label>
              <Input id="af-init" type="number" step="0.01" min="0" value={form.initialAccumDepreciation} readOnly disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="af-ccut" title="Opcional. Solo para activos migrados con depreciación acumulada previa. Indica hasta qué fecha se acumuló dicha depreciación.">Inicio depreciación</Label>
              <Input
                id="af-ccut"
                type="date"
                value={form.cutoffDate}
                onChange={(e) => setField('cutoffDate', e.target.value)}
                title="Opcional. Solo para activos migrados con depreciación acumulada previa. Indica hasta qué fecha se acumuló dicha depreciación."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="af-cur">Moneda</Label>
              <Input id="af-cur" value={form.currency} onChange={(e) => setField('currency', e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="af-tc">Tipo de cambio</Label>
              <Input id="af-tc" type="number" step="0.0001" value={form.exchangeRate} onChange={(e) => setField('exchangeRate', e.target.value)} />
            </div>
          </CardContent>
        </Card>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={submitting}>{submitting ? 'Guardando...' : 'Registrar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
