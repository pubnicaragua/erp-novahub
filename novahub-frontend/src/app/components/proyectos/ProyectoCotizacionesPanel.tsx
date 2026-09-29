import { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  History,
  Layers,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { asList, invalidateTenantQueries, useTenantQuery } from '../../hooks/useTenantQuery';
import {
  projectsService,
  type ProjectDetail,
  type ProjectMaterialQuotation,
  type ProjectSubQuotation,
  type ProjectSubQuotationHistorySnapshot,
  type QuotationComparison,
} from '../../services/projects.service';
import { suppliersService } from '../../services/compras.service';
import { queryClient } from '../../services/query-client';

interface ProyectoCotizacionesPanelProps {
  projectId: string;
  project: ProjectDetail;
}

export function ProyectoCotizacionesPanel({ projectId, project: _project }: ProyectoCotizacionesPanelProps) {
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);

  // Queries
  const quotationsQuery = useTenantQuery<ProjectMaterialQuotation[]>(
    ['projects', projectId, 'materialQuotations'],
    (signal) => projectsService.materialQuotations(projectId, undefined, signal),
  );

  const detailQuery = useTenantQuery<ProjectMaterialQuotation>(
    ['projects', projectId, 'materialQuotations', selectedQuotationId],
    (signal) => projectsService.materialQuotation(projectId, selectedQuotationId!, signal),
    { enabled: Boolean(selectedQuotationId) },
  );

  const comparisonQuery = useTenantQuery<QuotationComparison>(
    ['projects', projectId, 'materialQuotations', selectedQuotationId, 'comparison'],
    (signal) => projectsService.quotationComparison(projectId, selectedQuotationId!, signal),
    { enabled: Boolean(selectedQuotationId) },
  );

  const suppliersQuery = useTenantQuery(
    ['purchases', 'suppliers', 'lookup'],
    (signal) => suppliersService.getLookup({ page: 1, pageSize: 200 }, signal).then((res: any) => asList(res)),
  );

  // Modal: Crear Cotización
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    currency: 'NIO',
    materials: [{ description: '', quantity: 1, unit: 'UND', specifications: '' }],
  });
  const [isCreatingQuotation, setIsCreatingQuotation] = useState(false);

  // Modal: Asignar Proveedor (Subcotización)
  const [showSubModal, setShowSubModal] = useState(false);
  const [subForm, setSubForm] = useState({
    supplierId: '',
    editWindowHours: 24,
    expiresAt: '',
    materialIds: [] as string[],
  });
  const [isCreatingSub, setIsCreatingSub] = useState(false);
  const [newSubLink, setNewSubLink] = useState<{ url: string; token: string } | null>(null);

  // Modal: Llenado Manual
  const [manualSub, setManualSub] = useState<ProjectSubQuotation | null>(null);
  const [manualOffers, setManualOffers] = useState<{ [materialId: string]: { unitPrice: number; deliveryDays?: number } }>({});
  const [manualTax, setManualTax] = useState(0);
  const [isSavingManual, setIsSavingManual] = useState(false);

  // Modal: Historial Snapshot Sobrescritura
  const [historySubId, setHistorySubId] = useState<string | null>(null);
  const [historySnapshots, setHistorySnapshots] = useState<ProjectSubQuotationHistorySnapshot[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const quotations = quotationsQuery.data || [];
  const currentQuotation = detailQuery.data;
  const comparison = comparisonQuery.data?.comparison || [];
  const suppliers: Array<{ id: string; name: string; code?: string }> = asList(suppliersQuery.data) as Array<{ id: string; name: string; code?: string }>;

  // Material helpers for create form
  const addMaterialRow = () => {
    setCreateForm((prev) => ({
      ...prev,
      materials: [...prev.materials, { description: '', quantity: 1, unit: 'UND', specifications: '' }],
    }));
  };

  const removeMaterialRow = (idx: number) => {
    setCreateForm((prev) => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== idx),
    }));
  };

  const updateMaterialRow = (idx: number, field: string, val: string | number) => {
    setCreateForm((prev) => ({
      ...prev,
      materials: prev.materials.map((m, i) => (i === idx ? { ...m, [field]: val } : m)),
    }));
  };

  // Submit Create Quotation
  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name || createForm.materials.length === 0) return;

    try {
      setIsCreatingQuotation(true);
      const res = await projectsService.createMaterialQuotation(projectId, {
        name: createForm.name,
        description: createForm.description || undefined,
        currency: createForm.currency,
        materials: createForm.materials.map((m, idx) => ({
          description: m.description,
          quantity: Number(m.quantity) || 1,
          unit: m.unit || 'UND',
          specifications: m.specifications || undefined,
          sortOrder: idx,
        })),
      });

      await invalidateTenantQueries(queryClient);
      setShowCreateModal(false);
      setSelectedQuotationId(res.id);
      setCreateForm({
        name: '',
        description: '',
        currency: 'NIO',
        materials: [{ description: '', quantity: 1, unit: 'UND', specifications: '' }],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Error al crear la cotización.');
    } finally {
      setIsCreatingQuotation(false);
    }
  };

  // Submit Create SubQuotation
  const handleCreateSubQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuotationId || !subForm.supplierId) return;

    try {
      setIsCreatingSub(true);
      const res = await projectsService.createSubQuotation(projectId, selectedQuotationId, {
        supplierId: subForm.supplierId,
        editWindowHours: Number(subForm.editWindowHours) || 24,
        expiresAt: subForm.expiresAt ? new Date(subForm.expiresAt) : undefined,
        materialIds: subForm.materialIds.length > 0 ? subForm.materialIds : undefined,
      });

      await invalidateTenantQueries(queryClient);
      setNewSubLink({ url: `${window.location.origin}${res.publicPath}`, token: res.token });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Error al asignar proveedor.');
    } finally {
      setIsCreatingSub(false);
    }
  };

  // Open manual fill
  const handleOpenManualFill = (sub: ProjectSubQuotation) => {
    setManualSub(sub);
    const initial: { [id: string]: { unitPrice: number; deliveryDays?: number } } = {};
    (sub.offers || []).forEach((o) => {
      initial[o.materialId] = {
        unitPrice: Number(o.unitPrice || 0),
        deliveryDays: o.deliveryDays || undefined,
      };
    });
    setManualOffers(initial);
    setManualTax(Number(sub.taxAmount || 0));
  };

  // Submit manual fill
  const handleSaveManualFill = async () => {
    if (!selectedQuotationId || !manualSub) return;
    try {
      setIsSavingManual(true);
      const offersPayload = Object.entries(manualOffers).map(([matId, vals]) => ({
        materialId: matId,
        unitPrice: Number(vals.unitPrice) || 0,
        deliveryDays: vals.deliveryDays,
      }));

      await projectsService.manualFillSubQuotation(projectId, selectedQuotationId, manualSub.id, {
        offers: offersPayload,
        taxAmount: Number(manualTax) || 0,
      });

      await invalidateTenantQueries(queryClient);
      await invalidateTenantQueries(queryClient);
      setManualSub(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Error al guardar llenado manual.');
    } finally {
      setIsSavingManual(false);
    }
  };

  // Dismiss overwrite
  const handleDismissOverwrite = async (subId: string) => {
    if (!selectedQuotationId) return;
    try {
      await projectsService.dismissOverwrite(projectId, selectedQuotationId, subId);
      await invalidateTenantQueries(queryClient);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Error al descartar aviso.');
    }
  };

  // View History Snapshots
  const handleViewHistory = async (subId: string) => {
    if (!selectedQuotationId) return;
    setHistorySubId(subId);
    setLoadingHistory(true);
    try {
      const history = await projectsService.subQuotationHistory(projectId, selectedQuotationId, subId);
      setHistorySnapshots(history);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Error al cargar historial.');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Auto select lowest
  const handleAutoSelectLowest = async () => {
    if (!selectedQuotationId) return;
    try {
      await projectsService.selectOffers(projectId, selectedQuotationId, { autoSelectLowest: true });
      await invalidateTenantQueries(queryClient);
      await invalidateTenantQueries(queryClient);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Error al auto-seleccionar mejores precios.');
    }
  };

  // Manual toggle select offer
  const handleToggleSelectOffer = async (offerId: string) => {
    if (!selectedQuotationId) return;
    try {
      // Tomar las ofertas seleccionadas actuales y reemplazar la del mismo material
      const currentSelectedIds: string[] = [];
      (currentQuotation?.materials || []).forEach((m) => {
        (m.offers || []).forEach((o) => {
          if (o.id === offerId) {
            currentSelectedIds.push(offerId);
          } else if (o.isSelected && o.materialId !== m.id) {
            currentSelectedIds.push(o.id);
          }
        });
      });

      await projectsService.selectOffers(projectId, selectedQuotationId, { selectedOfferIds: currentSelectedIds });
      await invalidateTenantQueries(queryClient);
      await invalidateTenantQueries(queryClient);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Error al seleccionar oferta.');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  // If no quotation selected: Show List
  if (!selectedQuotationId) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <ShoppingCart className="size-5 text-primary" /> Cotizaciones de Materiales Compuestas
            </h3>
            <p className="text-xs text-muted-foreground">
              Gestione listas de materiales requeridos y recolecte subcotizaciones de múltiples proveedores en simultáneo.
            </p>
          </div>
          <Button size="sm" onClick={() => setShowCreateModal(true)} className="gap-1.5 text-xs font-bold">
            <Plus className="size-4" /> Nueva Cotización de Materiales
          </Button>
        </div>

        {quotationsQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
        ) : quotations.length === 0 ? (
          <Card className="border-dashed border-border/60 text-center p-8 text-muted-foreground space-y-2">
            <Package className="size-10 mx-auto text-muted-foreground/30" />
            <p className="text-sm font-semibold">No hay cotizaciones de materiales registradas</p>
            <p className="text-xs">Cree una cotización para armar una lista de materiales y solicitar ofertas a sus proveedores.</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quotations.map((q) => (
              <Card
                key={q.id}
                onClick={() => setSelectedQuotationId(q.id)}
                className="border-border/60 hover:border-primary/50 cursor-pointer shadow-sm hover:shadow-md transition-all group"
              >
                <CardHeader className="p-4 pb-2 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-primary">{q.code}</span>
                    <Badge
                      variant="outline"
                      className={
                        q.status === 'COMPLETE'
                          ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10'
                          : q.status === 'IN_PROCESS'
                          ? 'border-blue-500/30 text-blue-500 bg-blue-500/10'
                          : ''
                      }
                    >
                      {q.status === 'COMPLETE' ? 'Completa' : q.status === 'IN_PROCESS' ? 'En Proceso' : 'Borrador'}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-bold group-hover:text-primary transition-colors line-clamp-1">
                    {q.name}
                  </CardTitle>
                  {q.description ? (
                    <CardDescription className="text-xs line-clamp-1">{q.description}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>{q._count?.materials || 0} Materiales · {q._count?.subQuotations || 0} Proveedores</span>
                    <span className="font-mono font-bold text-foreground">
                      {q.currency} {Number(q.selectedTotalAmount || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal: Crear Cotización Compuesta */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCreateQuotation} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-base font-bold">Nueva Cotización de Materiales Compuesta</DialogTitle>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold">Nombre de la Cotización *</label>
                  <Input
                    required
                    placeholder="Ej: Materiales para Fase 1 - Estructura y Acero"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold">Moneda Base</label>
                  <select
                    value={createForm.currency}
                    onChange={(e) => setCreateForm({ ...createForm, currency: e.target.value })}
                    className="w-full h-8 px-2 rounded-md border border-border bg-background text-xs font-mono"
                  >
                    <option value="NIO">Córdobas (NIO)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold">Descripción (Opcional)</label>
                  <Input
                    placeholder="Notas o alcances..."
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Dynamic Materials */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-xs">Materiales Requeridos</label>
                  <Button type="button" size="sm" variant="outline" onClick={addMaterialRow} className="h-7 text-xs gap-1">
                    <Plus className="size-3" /> Agregar Ítem
                  </Button>
                </div>

                <div className="space-y-2">
                  {createForm.materials.map((row, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg border border-border/40 bg-muted/10 text-xs">
                      <span className="font-mono text-muted-foreground w-4">{idx + 1}</span>
                      <Input
                        required
                        placeholder="Descripción del material *"
                        value={row.description}
                        onChange={(e) => updateMaterialRow(idx, 'description', e.target.value)}
                        className="h-7 text-xs flex-1 min-w-[180px]"
                      />
                      <Input
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        placeholder="Cant."
                        value={row.quantity}
                        onChange={(e) => updateMaterialRow(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs w-20 text-right font-mono"
                        required
                      />
                      <Input
                        placeholder="Unidad (UND, m2, kg)"
                        value={row.unit}
                        onChange={(e) => updateMaterialRow(idx, 'unit', e.target.value)}
                        className="h-7 text-xs w-24"
                      />
                      {createForm.materials.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeMaterialRow(idx)}
                          className="size-7 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)} disabled={isCreatingQuotation} className="h-8 text-xs">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isCreatingQuotation} className="h-8 text-xs font-bold">
                  {isCreatingQuotation ? 'Creando...' : 'Crear Cotización'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Quotation Detail View
  if (!currentQuotation) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  const isComplete = currentQuotation.status === 'COMPLETE';

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedQuotationId(null)}
            className="group size-9 shrink-0 rounded-xl border border-border/50 bg-background/50 transition-all hover:bg-muted"
            title="Volver a la lista de cotizaciones"
            aria-label="Volver a la lista de cotizaciones"
          >
            <ArrowLeft className="size-4 text-muted-foreground transition-transform group-hover:-translate-x-0.5 group-hover:text-foreground" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-primary">{currentQuotation.code}</span>
              <h2 className="text-lg font-black tracking-tight">{currentQuotation.name}</h2>
              <Badge
                variant="outline"
                className={
                  isComplete
                    ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10'
                    : 'border-blue-500/30 text-blue-500 bg-blue-500/10'
                }
              >
                {isComplete ? 'Completa' : 'En Proceso'}
              </Badge>
            </div>
            {currentQuotation.description ? (
              <p className="text-xs text-muted-foreground">{currentQuotation.description}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowSubModal(true)} className="gap-1.5 text-xs font-bold h-8">
            <Plus className="size-4" /> Asignar Proveedor
          </Button>
        </div>
      </div>

      {/* Totals Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Cotizado (Informativo) */}
        <Card className="border-border/60 shadow-sm bg-muted/10">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Cotizado (Informativo)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-1">
            <div className="text-2xl font-black font-mono">
              {currentQuotation.currency} {Number(currentQuotation.quotedTotalAmount || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Suma de todas las ofertas recibidas de los proveedores.
            </p>
          </CardContent>
        </Card>

        {/* Total Seleccionado (Efectivo) */}
        <Card className="border-primary/40 shadow-sm bg-primary/5">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-semibold text-primary uppercase tracking-wider">
              Total Seleccionado (Efectivo)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-1">
            <div className="text-2xl font-black font-mono text-primary">
              {currentQuotation.currency} {Number(currentQuotation.selectedTotalAmount || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Suma de ofertas elegidas para compra + IVA proporcional por proveedor.
            </p>
          </CardContent>
        </Card>

        {/* Status / Completeness */}
        <Card className="border-border/60 shadow-sm sm:col-span-2 lg:col-span-1">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Estado de Completitud
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-1.5">
            <div className="flex items-center gap-2">
              {isComplete ? (
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/10 gap-1 text-xs py-0.5">
                  <CheckCircle2 className="size-3.5" /> Cotización Completa
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/10 gap-1 text-xs py-0.5">
                  <Clock className="size-3.5" /> Esperando Respuestas
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isComplete
                ? 'Todos los proveedores respondieron o fueron completados manualmente.'
                : 'Pasa a Completa automáticamente al recibir todas las subcotizaciones.'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Subcotizaciones vs Matriz Comparativa */}
      <Tabs defaultValue="subcotizaciones" className="w-full">
        <TabsList className="inline-flex h-auto w-fit max-w-full flex-wrap gap-1 rounded-xl p-1">
          <TabsTrigger value="subcotizaciones" className="px-3.5 py-1.5 text-xs font-bold gap-1.5 whitespace-nowrap rounded-lg">
            <Users className="size-3.5" /> Subcotizaciones por Proveedor ({currentQuotation.subQuotations?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="comparativa" className="px-3.5 py-1.5 text-xs font-bold gap-1.5 whitespace-nowrap rounded-lg">
            <Layers className="size-3.5" /> Matriz Comparativa de Precios
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Subcotizaciones por Proveedor */}
        <TabsContent value="subcotizaciones" className="space-y-4 pt-2">
          {(currentQuotation.subQuotations || []).length === 0 ? (
            <Card className="border-dashed border-border/60 text-center p-8 text-muted-foreground space-y-2">
              <Users className="size-8 mx-auto text-muted-foreground/30" />
              <p className="text-xs">Aún no se han asignado proveedores a esta cotización.</p>
              <Button size="sm" onClick={() => setShowSubModal(true)} className="gap-1.5 text-xs">
                <Plus className="size-3.5" /> Asignar Primer Proveedor
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(currentQuotation.subQuotations || []).map((sub) => {
                const isOverwritten = sub.overwrittenBySupplier && !sub.overwriteDismissedAt;
                const publicUrl = `${window.location.origin}/public/subquotation/${sub.tokenHash || ''}`;

                return (
                  <Card key={sub.id} className="border-border/60 shadow-sm overflow-hidden flex flex-col justify-between">
                    <CardHeader className="p-4 pb-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-muted-foreground">{sub.code}</span>
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={
                              sub.status === 'RECEIVED'
                                ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10'
                                : sub.status === 'COMPLETED_MANUAL'
                                ? 'border-blue-500/30 text-blue-500 bg-blue-500/10'
                                : 'border-amber-500/30 text-amber-500 bg-amber-500/10'
                            }
                          >
                            {sub.status === 'RECEIVED'
                              ? 'Recibida'
                              : sub.status === 'COMPLETED_MANUAL'
                              ? 'Llenado Manual'
                              : sub.status === 'SENT'
                              ? 'Enviada'
                              : 'Pendiente'}
                          </Badge>
                        </div>
                      </div>

                      <div>
                        <CardTitle className="text-base font-bold">{sub.supplier?.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {sub.supplier?.contactName ? `Contacto: ${sub.supplier.contactName}` : ''}
                          {sub.supplier?.phone ? ` · Tel: ${sub.supplier.phone}` : ''}
                        </CardDescription>
                      </div>

                      {/* Badge Sobrescritura */}
                      {isOverwritten ? (
                        <div className="p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300 space-y-1.5 text-xs">
                          <div className="flex items-center gap-1.5 font-bold">
                            <AlertCircle className="size-4 shrink-0 text-amber-500" />
                            <span>Sobrescrito por Proveedor</span>
                          </div>
                          <p className="text-[11px] opacity-90">
                            El proveedor envió su oferta y actualizó los valores que habían sido cargados manualmente.
                          </p>
                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewHistory(sub.id)}
                              className="h-6 text-[10px] px-2 gap-1 border-amber-500/30"
                            >
                              <History className="size-3" /> Ver Datos Anteriores
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleDismissOverwrite(sub.id)}
                              className="h-6 text-[10px] px-2 gap-1"
                            >
                              <Check className="size-3" /> Marcar Revisado
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </CardHeader>

                    <CardContent className="p-4 pt-1 space-y-3">
                      {/* Financials */}
                      <div className="flex justify-between items-baseline border-t border-border/40 pt-2 text-xs">
                        <span className="text-muted-foreground">Total Ofertado:</span>
                        <span className="font-mono text-base font-bold text-foreground">
                          {sub.currency} {Number(sub.total || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Semi-private Link */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Enlace Semiprivado para Proveedor:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Input readOnly value={publicUrl} className="h-7 text-[11px] font-mono bg-background" />
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 px-2 text-xs shrink-0"
                            onClick={() => copyToClipboard(publicUrl, sub.id)}
                          >
                            {copiedToken === sub.id ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                          </Button>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                        {sub.status !== 'RECEIVED' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenManualFill(sub)}
                            className="h-7 text-xs gap-1"
                          >
                            <Edit3 className="size-3.5" /> Llenar Manualmente
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: Matriz Comparativa de Precios */}
        <TabsContent value="comparativa" className="space-y-4 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Compare las ofertas de cada proveedor por material. La mejor oferta de menor precio está sugerida automáticamente.
            </p>
            <Button size="sm" onClick={handleAutoSelectLowest} className="gap-1.5 text-xs font-bold h-8">
              <Zap className="size-3.5" /> Seleccionar Mejores Precios
            </Button>
          </div>

          <Card className="border-border/60 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/20 text-muted-foreground text-[11px] uppercase tracking-wider">
                    <th className="p-3 pl-4">Material</th>
                    <th className="p-3 text-right">Cant. Requerida</th>
                    <th className="p-3">Ofertas por Proveedor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {comparison.map((item) => (
                    <tr key={item.materialId} className="hover:bg-muted/5 transition-colors">
                      <td className="p-3 pl-4 align-top w-56">
                        <p className="font-bold text-foreground">{item.description}</p>
                        <span className="font-mono text-[10px] text-muted-foreground">{item.unit}</span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold align-top w-28">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="p-3">
                        {item.offers.length === 0 ? (
                          <span className="text-muted-foreground text-[11px] italic">Sin ofertas registradas</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {item.offers.map((off) => {
                              const isQuoted = off.isQuoted && off.unitPrice > 0;
                              return (
                                <div
                                  key={off.id}
                                  onClick={() => isQuoted && handleToggleSelectOffer(off.id)}
                                  className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex flex-col justify-between min-w-[150px] ${
                                    off.isSelected
                                      ? 'border-primary bg-primary/10 shadow-sm'
                                      : off.isSuggestedLowestPrice
                                      ? 'border-amber-500/50 bg-amber-500/5'
                                      : 'border-border/50 bg-card hover:border-border'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span
                                      className={`font-semibold truncate max-w-[110px] text-[11px] ${
                                        off.isSelected ? 'text-primary' : ''
                                      }`}
                                    >
                                      {off.supplierName}
                                    </span>
                                    {off.isSuggestedLowestPrice ? (
                                      <Badge variant="outline" className="border-primary/30 text-primary text-[10px] py-0 px-1">
                                        Menor
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <div className="pt-1 flex items-baseline justify-between font-mono">
                                    <span className="text-xs font-bold">
                                      {isQuoted ? `C$ ${off.unitPrice.toFixed(2)}` : 'Sin precio'}
                                    </span>
                                    {off.isSelected ? (
                                      <CheckCircle2 className="size-3.5 text-primary" />
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal: Asignar Proveedor */}
      <Dialog open={showSubModal} onOpenChange={setShowSubModal}>
        <DialogContent className="sm:max-w-md">
          {newSubLink ? (
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="size-6" />
              </div>
              <h3 className="font-bold text-base">¡Proveedor Asignado Exitosamente!</h3>
              <p className="text-xs text-muted-foreground">
                Comparta este enlace semiprivado con el proveedor para que ingrese sus precios:
              </p>
              <div className="flex items-center gap-1.5 pt-2">
                <Input readOnly value={newSubLink.url} className="h-8 text-xs font-mono" />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 px-2.5 text-xs shrink-0"
                  onClick={() => copyToClipboard(newSubLink.url, 'new-sub')}
                >
                  {copiedToken === 'new-sub' ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
              <DialogFooter className="pt-3">
                <Button
                  onClick={() => {
                    setNewSubLink(null);
                    setShowSubModal(false);
                    setSubForm({ supplierId: '', editWindowHours: 24, expiresAt: '', materialIds: [] });
                  }}
                  className="w-full text-xs font-bold"
                >
                  Finalizar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreateSubQuotation} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-base font-bold">Asignar Proveedor a la Cotización</DialogTitle>
              </DialogHeader>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold">Proveedor *</label>
                  <select
                    required
                    value={subForm.supplierId}
                    onChange={(e) => setSubForm({ ...subForm, supplierId: e.target.value })}
                    className="w-full h-8 px-2 rounded-md border border-border bg-background text-xs"
                  >
                    <option value="">Seleccione un proveedor...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold">Ventana de Edición Post-Envío (Horas)</label>
                  <Input
                    type="number"
                    min="0"
                    value={subForm.editWindowHours}
                    onChange={(e) => setSubForm({ ...subForm, editWindowHours: parseInt(e.target.value, 10) || 0 })}
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Tiempo durante el cual el proveedor puede ajustar su oferta una vez enviada.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold">Fecha Límite para Responder (Opcional)</label>
                  <Input
                    type="date"
                    value={subForm.expiresAt}
                    onChange={(e) => setSubForm({ ...subForm, expiresAt: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowSubModal(false)} disabled={isCreatingSub} className="h-8 text-xs">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isCreatingSub || !subForm.supplierId} className="h-8 text-xs font-bold">
                  {isCreatingSub ? 'Generando...' : 'Asignar y Crear Enlace'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Llenado Manual */}
      <Dialog open={Boolean(manualSub)} onOpenChange={(open) => !open && setManualSub(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          {manualSub && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-base font-bold">
                  Llenado Manual de Cotización: {manualSub.supplier?.name}
                </DialogTitle>
                <CardDescription className="text-xs">
                  Ingrese los precios remitidos por el proveedor mediante cotización física o correo.
                </CardDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/50 text-muted-foreground uppercase text-[10px]">
                        <th className="p-2">Material</th>
                        <th className="p-2 text-right">Cant.</th>
                        <th className="p-2 text-right w-28">P. Unitario ({manualSub.currency})</th>
                        <th className="p-2 text-right w-20">Plazo (días)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {(currentQuotation.materials || []).map((m) => {
                        const vals = manualOffers[m.id] || { unitPrice: 0 };
                        return (
                          <tr key={m.id}>
                            <td className="p-2 font-medium">{m.description}</td>
                            <td className="p-2 text-right font-mono">{m.quantity} {m.unit}</td>
                            <td className="p-2 text-right">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={vals.unitPrice === 0 ? '' : vals.unitPrice}
                                onChange={(e) =>
                                  setManualOffers((prev) => ({
                                    ...prev,
                                    [m.id]: { ...prev[m.id], unitPrice: parseFloat(e.target.value) || 0 },
                                  }))
                                }
                                placeholder="0.00"
                                className="h-7 text-right font-mono text-xs"
                              />
                            </td>
                            <td className="p-2 text-right">
                              <Input
                                type="number"
                                min="0"
                                value={vals.deliveryDays === undefined ? '' : vals.deliveryDays}
                                onChange={(e) =>
                                  setManualOffers((prev) => ({
                                    ...prev,
                                    [m.id]: { ...prev[m.id], deliveryDays: parseInt(e.target.value, 10) || undefined },
                                  }))
                                }
                                placeholder="Días"
                                className="h-7 text-right font-mono text-xs"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-border/50 text-xs">
                  <span className="font-semibold">Impuesto / IVA ({manualSub.currency}):</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={manualTax === 0 ? '' : manualTax}
                    onChange={(e) => setManualTax(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="h-7 w-28 text-right font-mono text-xs"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button variant="ghost" onClick={() => setManualSub(null)} disabled={isSavingManual} className="h-8 text-xs">
                  Cancelar
                </Button>
                <Button onClick={handleSaveManualFill} disabled={isSavingManual} className="h-8 text-xs font-bold">
                  {isSavingManual ? 'Guardando...' : 'Guardar Datos Manuales'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Historial de Sobrescritura */}
      <Dialog open={Boolean(historySubId)} onOpenChange={(open) => !open && setHistorySubId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <History className="size-4 text-primary" /> Historial de Sobrescritura
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {loadingHistory ? (
              <Skeleton className="h-24 rounded-lg" />
            ) : historySnapshots.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No hay snapshots registrados.</p>
            ) : (
              historySnapshots.map((snap) => (
                <div key={snap.id} className="p-3 rounded-lg border border-border/50 bg-muted/10 space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                    <span className="font-semibold">{snap.reason}</span>
                    <span>{new Date(snap.createdAt).toLocaleString('es-NI')}</span>
                  </div>
                  <div className="font-mono text-xs">
                    <p>Subtotal previo: C$ {snap.snapshot?.subtotal?.toFixed(2) || '0.00'}</p>
                    <p>Total previo: C$ {snap.snapshot?.total?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setHistorySubId(null)} className="h-8 text-xs">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
