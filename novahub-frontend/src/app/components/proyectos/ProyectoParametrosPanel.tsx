import { useState } from 'react';
import {
  Coins,
  FileText,
  Info,
  Layers,
  Lock,
  Percent,
  RefreshCw,
  Save,
  Sliders,
  Unlock,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Skeleton } from '../ui/skeleton';
import { toast } from '@/app/services/toast';
import { cn } from '../ui/utils';
import { useTenantQuery, invalidateTenantQueries } from '../../hooks/useTenantQuery';
import { projectsService, type ProjectDetail } from '../../services/projects.service';
import { useQueryClient } from '@tanstack/react-query';

interface ProyectoParametrosPanelProps {
  projectId: string;
  project: ProjectDetail;
}

interface GlassTierOption {
  key: string;
  label: string;
  field: 'glassTierRetailPrice' | 'glassTierSmallPrice' | 'glassTierMediumPrice' | 'glassTierLargePrice' | 'glassTierStrategicPrice';
  defaultPrice: number;
  description: string;
}

const GLASS_TIERS: GlassTierOption[] = [
  { key: 'RETAIL', label: 'Retail', field: 'glassTierRetailPrice', defaultPrice: 74.70, description: '< 10 m²' },
  { key: 'SMALL', label: 'Pequeño', field: 'glassTierSmallPrice', defaultPrice: 72.00, description: '10 - 50 m²' },
  { key: 'MEDIUM', label: 'Mediano', field: 'glassTierMediumPrice', defaultPrice: 69.00, description: '50 - 150 m²' },
  { key: 'LARGE', label: 'Grande', field: 'glassTierLargePrice', defaultPrice: 66.50, description: '150 - 500 m²' },
  { key: 'STRATEGIC', label: 'Estratégico', field: 'glassTierStrategicPrice', defaultPrice: 64.50, description: '> 500 m²' },
];

function buildInitialFormData(data: Record<string, unknown> | undefined, project: ProjectDetail) {
  const d = data || {};
  return {
    exchangeRate: d.exchangeRate !== undefined ? Number(d.exchangeRate) : (project.exchangeRate || 36.6243),
    lockExchangeRate: d.lockExchangeRate !== undefined ? Boolean(d.lockExchangeRate) : false,
    ivaRate: d.ivaRate !== undefined ? Number(d.ivaRate) * (Number(d.ivaRate) <= 1 ? 100 : 1) : 15.00,
    irRetentionRate: d.irRetentionRate !== undefined ? Number(d.irRetentionRate) * (Number(d.irRetentionRate) <= 1 ? 100 : 1) : 2.00,
    imiRetentionRate: d.imiRetentionRate !== undefined ? Number(d.imiRetentionRate) * (Number(d.imiRetentionRate) <= 1 ? 100 : 1) : 1.00,
    enableGrossUp: d.enableGrossUp !== undefined ? Boolean(d.enableGrossUp) : true,
    salesCommissionRate: d.salesCommissionRate !== undefined ? Number(d.salesCommissionRate) * (Number(d.salesCommissionRate) <= 1 ? 100 : 1) : 2.50,
    contingencyRate: d.contingencyRate !== undefined ? Number(d.contingencyRate) * (Number(d.contingencyRate) <= 1 ? 100 : 1) : 5.00,
    overheadRate: d.overheadRate !== undefined ? Number(d.overheadRate) * (Number(d.overheadRate) <= 1 ? 100 : 1) : 4.00,
    collectionDays: d.collectionDays !== undefined ? Number(d.collectionDays) : 15,
    retentionFundRate: d.retentionFundRate !== undefined ? Number(d.retentionFundRate) * (Number(d.retentionFundRate) <= 1 ? 100 : 1) : 0.00,
    retentionReleaseDays: d.retentionReleaseDays !== undefined ? Number(d.retentionReleaseDays) : 0,
    monthlyFinanceRate: d.monthlyFinanceRate !== undefined ? Number(d.monthlyFinanceRate) * (Number(d.monthlyFinanceRate) <= 1 ? 100 : 1) : 0.00,

    gmMaterialAcm: d.gmMaterialAcm !== undefined ? Number(d.gmMaterialAcm) * (Number(d.gmMaterialAcm) <= 1 ? 100 : 1) : 26.00,
    gmMaterialGlass: d.gmMaterialGlass !== undefined ? Number(d.gmMaterialGlass) * (Number(d.gmMaterialGlass) <= 1 ? 100 : 1) : 24.00,
    gmLabor: d.gmLabor !== undefined ? Number(d.gmLabor) * (Number(d.gmLabor) <= 1 ? 100 : 1) : 20.00,
    gmFloor: d.gmFloor !== undefined ? Number(d.gmFloor) * (Number(d.gmFloor) <= 1 ? 100 : 1) : 15.00,
    projectDiscountImported: d.projectDiscountImported !== undefined ? Number(d.projectDiscountImported) * (Number(d.projectDiscountImported) <= 1 ? 100 : 1) : 20.00,
    projectDiscountNational: d.projectDiscountNational !== undefined ? Number(d.projectDiscountNational) * (Number(d.projectDiscountNational) <= 1 ? 100 : 1) : 0.00,
    glassVolumeTier: (d.glassVolumeTier as string) || 'MEDIUM',
    glassAppliedPrice: d.glassAppliedPrice !== undefined ? Number(d.glassAppliedPrice) : 69.00,
    glassTierRetailPrice: d.glassTierRetailPrice !== undefined ? Number(d.glassTierRetailPrice) : 74.70,
    glassTierSmallPrice: d.glassTierSmallPrice !== undefined ? Number(d.glassTierSmallPrice) : 72.00,
    glassTierMediumPrice: d.glassTierMediumPrice !== undefined ? Number(d.glassTierMediumPrice) : 69.00,
    glassTierLargePrice: d.glassTierLargePrice !== undefined ? Number(d.glassTierLargePrice) : 66.50,
    glassTierStrategicPrice: d.glassTierStrategicPrice !== undefined ? Number(d.glassTierStrategicPrice) : 64.50,
    glassSaqueCost: d.glassSaqueCost !== undefined ? Number(d.glassSaqueCost) : 0.00,
    glassBarrenoCost: d.glassBarrenoCost !== undefined ? Number(d.glassBarrenoCost) : 0.00,
    glassPulidoCost: d.glassPulidoCost !== undefined ? Number(d.glassPulidoCost) : 0.00,
    glassPriceIncludesProcesses: d.glassPriceIncludesProcesses !== undefined ? Boolean(d.glassPriceIncludesProcesses) : true,
    glassTemperedWaste: d.glassTemperedWaste !== undefined ? Number(d.glassTemperedWaste) * (Number(d.glassTemperedWaste) <= 1 ? 100 : 1) : 0.00,
    glassBreakageProvision: d.glassBreakageProvision !== undefined ? Number(d.glassBreakageProvision) * (Number(d.glassBreakageProvision) <= 1 ? 100 : 1) : 2.00,
    targetMargin: d.targetMargin !== undefined ? Number(d.targetMargin) * (Number(d.targetMargin) <= 1 ? 100 : 1) : 25.00,
    targetProfitAmount: d.targetProfitAmount !== undefined ? Number(d.targetProfitAmount) : 0.00,

    workDaysAcm: d.workDaysAcm !== undefined ? Number(d.workDaysAcm) : 15,
    workDaysCurtainWall: d.workDaysCurtainWall !== undefined ? Number(d.workDaysCurtainWall) : 20,
    crewSize: d.crewSize !== undefined ? Number(d.crewSize) : 8,
    perDiemDays: d.perDiemDays !== undefined ? Number(d.perDiemDays) : 19,
    scaffoldDailyRateNio: d.scaffoldDailyRateNio !== undefined ? Number(d.scaffoldDailyRateNio) : 40.00,
    platformDailyRateNio: d.platformDailyRateNio !== undefined ? Number(d.platformDailyRateNio) : 30.00,
    castersDailyRateNio: d.castersDailyRateNio !== undefined ? Number(d.castersDailyRateNio) : 100.00,
    acmStandardWidth: d.acmStandardWidth !== undefined ? Number(d.acmStandardWidth) : 1.500,
    acmStandardHeight: d.acmStandardHeight !== undefined ? Number(d.acmStandardHeight) : 4.980,
    acmStandardWaste: d.acmStandardWaste !== undefined ? Number(d.acmStandardWaste) * (Number(d.acmStandardWaste) <= 1 ? 100 : 1) : 13.00,
    profileStandardLength: d.profileStandardLength !== undefined ? Number(d.profileStandardLength) : 6.400,
    freightPct: d.freightPct !== undefined ? Number(d.freightPct) * (Number(d.freightPct) <= 1 ? 100 : 1) : 0.00,
    daiPct: d.daiPct !== undefined ? Number(d.daiPct) * (Number(d.daiPct) <= 1 ? 100 : 1) : 0.00,
    customsAgentPct: d.customsAgentPct !== undefined ? Number(d.customsAgentPct) * (Number(d.customsAgentPct) <= 1 ? 100 : 1) : 0.00,
    inlandTransportPct: d.inlandTransportPct !== undefined ? Number(d.inlandTransportPct) * (Number(d.inlandTransportPct) <= 1 ? 100 : 1) : 0.00,
    nationalizationFactor: d.nationalizationFactor !== undefined ? Number(d.nationalizationFactor) : 1.0000,

    clientName: (d.clientName as string) || project.customer?.name || '',
    quoteNumber: (d.quoteNumber as string) || project.code || '',
    advisorName: (d.advisorName as string) || project.manager?.name || '',
    quoteValidityDays: d.quoteValidityDays !== undefined ? Number(d.quoteValidityDays) : 15,
    spareParts: d.spareParts !== undefined ? Number(d.spareParts) : 0,
  };
}

export function ProyectoParametrosPanel({ projectId, project }: ProyectoParametrosPanelProps) {
  const pricingQuery = useTenantQuery<Record<string, unknown>>(
    ['projects', projectId, 'pricing-engine'],
    (signal) => projectsService.getProjectPricingEngine(projectId, signal),
    { enabled: !!projectId },
  );

  if (pricingQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <ProyectoParametrosForm
      key={String(pricingQuery.data?.updatedAt || pricingQuery.dataUpdatedAt)}
      projectId={projectId}
      project={project}
      initialData={pricingQuery.data}
      onRefetch={async () => {
        await pricingQuery.refetch();
      }}
    />
  );
}

interface ProyectoParametrosFormProps {
  projectId: string;
  project: ProjectDetail;
  initialData?: Record<string, unknown>;
  onRefetch: () => Promise<void>;
}

function ProyectoParametrosForm({ projectId, project, initialData, onRefetch }: ProyectoParametrosFormProps) {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<'fiscal' | 'margenes' | 'rendimientos' | 'cotizacion'>('fiscal');
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Inicialización limpia sin sincronización en efecto
  const [formData, setFormData] = useState(() => buildInitialFormData(initialData, project));

  const updateNumberField = (field: keyof typeof formData, value: string) => {
    const num = parseFloat(value);
    setFormData((prev) => ({
      ...prev,
      [field]: isNaN(num) ? 0 : num,
    }));
  };

  const updateStringField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSelectGlassTier = (tierKey: string) => {
    const tier = GLASS_TIERS.find((t) => t.key === tierKey);
    if (!tier) return;
    const currentTierPrice = formData[tier.field] ?? tier.defaultPrice;
    setFormData((prev) => ({
      ...prev,
      glassVolumeTier: tierKey,
      glassAppliedPrice: currentTierPrice,
    }));
  };

  const handleSyncGlobal = async () => {
    setIsSyncing(true);
    try {
      await projectsService.syncProjectPricingEngine(projectId);
      toast.success('Parámetros sincronizados exitosamente con la configuración global.');
      await onRefetch();
      invalidateTenantQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message;
      toast.error(msg || 'Error al sincronizar con la configuración global.');
    } finally {
      setIsSyncing(false);
      setShowSyncConfirm(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Preparamos payload convirtiendo porcentajes a factores decimales para backend
      const payload = {
        exchangeRate: Number(formData.exchangeRate),
        lockExchangeRate: Boolean(formData.lockExchangeRate),
        ivaRate: Number(formData.ivaRate) / 100,
        irRetentionRate: Number(formData.irRetentionRate) / 100,
        imiRetentionRate: Number(formData.imiRetentionRate) / 100,
        enableGrossUp: Boolean(formData.enableGrossUp),
        salesCommissionRate: Number(formData.salesCommissionRate) / 100,
        contingencyRate: Number(formData.contingencyRate) / 100,
        overheadRate: Number(formData.overheadRate) / 100,
        collectionDays: Math.round(Number(formData.collectionDays)),
        retentionFundRate: Number(formData.retentionFundRate) / 100,
        retentionReleaseDays: Math.round(Number(formData.retentionReleaseDays)),
        monthlyFinanceRate: Number(formData.monthlyFinanceRate) / 100,

        gmMaterialAcm: Number(formData.gmMaterialAcm) / 100,
        gmMaterialGlass: Number(formData.gmMaterialGlass) / 100,
        gmLabor: Number(formData.gmLabor) / 100,
        gmFloor: Number(formData.gmFloor) / 100,
        projectDiscountImported: Number(formData.projectDiscountImported) / 100,
        projectDiscountNational: Number(formData.projectDiscountNational) / 100,
        glassVolumeTier: formData.glassVolumeTier,
        glassAppliedPrice: Number(formData.glassAppliedPrice),
        glassTierRetailPrice: Number(formData.glassTierRetailPrice),
        glassTierSmallPrice: Number(formData.glassTierSmallPrice),
        glassTierMediumPrice: Number(formData.glassTierMediumPrice),
        glassTierLargePrice: Number(formData.glassTierLargePrice),
        glassTierStrategicPrice: Number(formData.glassTierStrategicPrice),
        glassSaqueCost: Number(formData.glassSaqueCost),
        glassBarrenoCost: Number(formData.glassBarrenoCost),
        glassPulidoCost: Number(formData.glassPulidoCost),
        glassPriceIncludesProcesses: Boolean(formData.glassPriceIncludesProcesses),
        glassTemperedWaste: Number(formData.glassTemperedWaste) / 100,
        glassBreakageProvision: Number(formData.glassBreakageProvision) / 100,
        targetMargin: Number(formData.targetMargin) / 100,
        targetProfitAmount: Number(formData.targetProfitAmount),

        workDaysAcm: Math.round(Number(formData.workDaysAcm)),
        workDaysCurtainWall: Math.round(Number(formData.workDaysCurtainWall)),
        crewSize: Math.round(Number(formData.crewSize)),
        perDiemDays: Math.round(Number(formData.perDiemDays)),
        scaffoldDailyRateNio: Number(formData.scaffoldDailyRateNio),
        platformDailyRateNio: Number(formData.platformDailyRateNio),
        castersDailyRateNio: Number(formData.castersDailyRateNio),
        acmStandardWidth: Number(formData.acmStandardWidth),
        acmStandardHeight: Number(formData.acmStandardHeight),
        acmStandardWaste: Number(formData.acmStandardWaste) / 100,
        profileStandardLength: Number(formData.profileStandardLength),
        freightPct: Number(formData.freightPct) / 100,
        daiPct: Number(formData.daiPct) / 100,
        customsAgentPct: Number(formData.customsAgentPct) / 100,
        inlandTransportPct: Number(formData.inlandTransportPct) / 100,
        nationalizationFactor: Number(formData.nationalizationFactor),

        clientName: formData.clientName,
        quoteNumber: formData.quoteNumber,
        advisorName: formData.advisorName,
        quoteValidityDays: Math.round(Number(formData.quoteValidityDays)),
        spareParts: Math.round(Number(formData.spareParts)),
      };

      await projectsService.updateProjectPricingEngine(projectId, payload);
      toast.success('Parámetros del proyecto guardados exitosamente.');
      await onRefetch();
      invalidateTenantQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message;
      toast.error(msg || 'Error al guardar los parámetros del proyecto.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de cabecera con acciones principales */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="size-5 text-primary" />
            <h3 className="text-lg font-black tracking-tight">Parámetros del Motor de Precios y Cotización</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Configura los supuestos de cálculo, tasas impositivas, rendimientos operativos y políticas comerciales para este proyecto.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowSyncConfirm(true)}
            disabled={isSyncing}
            className="rounded-xl border-border/60 font-bold uppercase tracking-wider text-xs gap-2"
          >
            <RefreshCw className={cn('size-3.5', isSyncing && 'animate-spin text-primary')} />
            <span>Sincronizar con Configuración Global</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl font-bold uppercase tracking-wider text-xs gap-2 shadow-sm"
          >
            <Save className="size-3.5" />
            <span>{isSaving ? 'Guardando…' : 'Guardar Parámetros'}</span>
          </Button>
        </div>
      </div>

      {/* Switch destacado: Fijar Tipo de Cambio por Contrato */}
      <Card
        className={cn(
          'relative overflow-hidden rounded-2xl border transition-all duration-200 shadow-sm',
          formData.lockExchangeRate
            ? 'border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:border-amber-500/30'
            : 'border-border/60 bg-muted/20',
        )}
      >
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors',
                  formData.lockExchangeRate
                    ? 'border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'border-border/60 bg-background text-muted-foreground',
                )}
              >
                {formData.lockExchangeRate ? <Lock className="size-5" /> : <Unlock className="size-5" />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-black tracking-tight">Fijar Tipo de Cambio por Contrato</h4>
                  <TooltipProvider>
                    <Tooltip delayDuration={150}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex size-4 items-center justify-center text-muted-foreground hover:text-foreground"
                          aria-label="Más información sobre Fijar Tipo de Cambio"
                        >
                          <Info className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        Si este switch está activo, la sincronización global no alterará el Tipo de Cambio pactado por contrato en este proyecto.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] font-bold uppercase',
                      formData.lockExchangeRate
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        : 'border-border/60 text-muted-foreground',
                    )}
                  >
                    {formData.lockExchangeRate ? 'TC Contractual Fijado' : 'TC Dinámico'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formData.lockExchangeRate
                    ? 'El tipo de cambio está blindado. La sincronización masiva o periódica no modificará el valor acordado con el cliente.'
                    : 'El proyecto actualizará su tipo de cambio automáticamente cuando se sincronice con la configuración global del ERP.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-center">
              <span className="font-mono text-xs font-bold text-muted-foreground">
                1 USD = {Number(formData.exchangeRate).toFixed(4)} NIO
              </span>
              <Switch
                checked={formData.lockExchangeRate}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, lockExchangeRate: checked }))}
                aria-label="Fijar Tipo de Cambio por Contrato"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pestañas de Secciones */}
      <Tabs
        value={activeSubTab}
        onValueChange={(val) => setActiveSubTab(val as 'fiscal' | 'margenes' | 'rendimientos' | 'cotizacion')}
        className="w-full space-y-4"
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl border border-border/40 bg-muted/40 p-1.5 backdrop-blur-sm">
          <TabsTrigger
            value="fiscal"
            className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wider"
          >
            <Coins className="size-3.5" />
            <span>Moneda y Fiscal</span>
          </TabsTrigger>
          <TabsTrigger
            value="margenes"
            className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wider"
          >
            <Percent className="size-3.5" />
            <span>Márgenes y Precios</span>
          </TabsTrigger>
          <TabsTrigger
            value="rendimientos"
            className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wider"
          >
            <Layers className="size-3.5" />
            <span>Rendimientos y Mermas</span>
          </TabsTrigger>
          <TabsTrigger
            value="cotizacion"
            className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wider"
          >
            <FileText className="size-3.5" />
            <span>Datos de Cotización</span>
          </TabsTrigger>
        </TabsList>

        {/* ==================== A) MONEDA Y FISCAL ==================== */}
        <TabsContent value="fiscal" className="space-y-4 outline-none">
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black uppercase tracking-wider">Políticas de Moneda y Retenciones Fiscales</CardTitle>
              <CardDescription className="text-xs">
                Valores base de conversión cambiaria, impuestos obligatorios y retenciones impositivas de ley en Nicaragua.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Tipo de cambio */}
                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <Label htmlFor="tc" className="text-xs font-bold">Tipo de Cambio (NIO / USD)</Label>
                  <div className="relative">
                    <Input
                      id="tc"
                      type="number"
                      step="0.0001"
                      min="0"
                      value={formData.exchangeRate}
                      onChange={(e) => updateNumberField('exchangeRate', e.target.value)}
                      className="font-mono font-bold pr-12 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                      NIO
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Tasa oficial de referencia para valorización del proyecto.</p>
                </div>

                {/* IVA */}
                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <Label htmlFor="iva" className="text-xs font-bold">Tasa IVA</Label>
                  <div className="relative">
                    <Input
                      id="iva"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.ivaRate}
                      onChange={(e) => updateNumberField('ivaRate', e.target.value)}
                      className="font-mono font-bold pr-8 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                      %
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Impuesto al Valor Agregado estándar (15%).</p>
                </div>

                {/* Retención IR */}
                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <Label htmlFor="ir" className="text-xs font-bold">Retención IR</Label>
                  <div className="relative">
                    <Input
                      id="ir"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.irRetentionRate}
                      onChange={(e) => updateNumberField('irRetentionRate', e.target.value)}
                      className="font-mono font-bold pr-8 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                      %
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Retención de Impuesto sobre la Renta (habitualmente 2.0%).</p>
                </div>

                {/* Retención IMI */}
                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <Label htmlFor="imi" className="text-xs font-bold">Retención IMI (Alcaldía)</Label>
                  <div className="relative">
                    <Input
                      id="imi"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.imiRetentionRate}
                      onChange={(e) => updateNumberField('imiRetentionRate', e.target.value)}
                      className="font-mono font-bold pr-8 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                      %
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Impuesto Municipal sobre Ingresos (habitualmente 1.0%).</p>
                </div>

                {/* Comisión de Venta */}
                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <Label htmlFor="comision" className="text-xs font-bold">Comisión de Venta</Label>
                  <div className="relative">
                    <Input
                      id="comision"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.salesCommissionRate}
                      onChange={(e) => updateNumberField('salesCommissionRate', e.target.value)}
                      className="font-mono font-bold pr-8 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                      %
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Comisión comercial por cierre de proyecto (2.5%).</p>
                </div>

                {/* Imprevistos */}
                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <Label htmlFor="imprevistos" className="text-xs font-bold">Contingencias e Imprevistos</Label>
                  <div className="relative">
                    <Input
                      id="imprevistos"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.contingencyRate}
                      onChange={(e) => updateNumberField('contingencyRate', e.target.value)}
                      className="font-mono font-bold pr-8 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                      %
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Fondo para desvíos de obra o costos ocultos (5.0%).</p>
                </div>

                {/* Gastos de Administración */}
                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <Label htmlFor="overhead" className="text-xs font-bold">Gastos de Administración (Overhead)</Label>
                  <div className="relative">
                    <Input
                      id="overhead"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.overheadRate}
                      onChange={(e) => updateNumberField('overheadRate', e.target.value)}
                      className="font-mono font-bold pr-8 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                      %
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Costo operativo indirecto de oficina central (4.0%).</p>
                </div>

                {/* Plazo de Cobro */}
                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <Label htmlFor="plazoCobro" className="text-xs font-bold">Plazo de Cobro</Label>
                  <div className="relative">
                    <Input
                      id="plazoCobro"
                      type="number"
                      step="1"
                      min="0"
                      value={formData.collectionDays}
                      onChange={(e) => updateNumberField('collectionDays', e.target.value)}
                      className="font-mono font-bold pr-14 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                      días
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Días calendario estimados para la cobranza de facturas (15).</p>
                </div>

                {/* Switch Gross-Up */}
                <div className="flex flex-col justify-between rounded-xl border border-border/50 bg-muted/15 p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="grossUp" className="text-xs font-bold cursor-pointer">
                      Ajuste Gross-Up
                    </Label>
                    <Switch
                      id="grossUp"
                      checked={formData.enableGrossUp}
                      onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, enableGrossUp: checked }))}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Ajusta la base imponible del presupuesto para que las retenciones y comisiones no erosionen el margen neto de utilidad.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== B) MÁRGENES Y PRECIOS ==================== */}
        <TabsContent value="margenes" className="space-y-4 outline-none">
          {/* Márgenes Comerciales */}
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black uppercase tracking-wider">Márgenes Brutos por Tipo de Insumo</CardTitle>
              <CardDescription className="text-xs">
                Porcentajes de rentabilidad bruta aplicados a los costos directos de cada categoría.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gmAcm" className="text-xs font-bold">Margen ACM</Label>
                    <Badge variant="outline" className="font-mono text-[10px]">Aluminio</Badge>
                  </div>
                  <div className="relative">
                    <Input
                      id="gmAcm"
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={formData.gmMaterialAcm}
                      onChange={(e) => updateNumberField('gmMaterialAcm', e.target.value)}
                      className="font-mono font-bold pr-8 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">%</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Objetivo estándar: 26.0%</p>
                </div>

                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gmGlass" className="text-xs font-bold">Margen Vidrio</Label>
                    <Badge variant="outline" className="font-mono text-[10px]">Templado</Badge>
                  </div>
                  <div className="relative">
                    <Input
                      id="gmGlass"
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={formData.gmMaterialGlass}
                      onChange={(e) => updateNumberField('gmMaterialGlass', e.target.value)}
                      className="font-mono font-bold pr-8 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">%</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Objetivo estándar: 24.0%</p>
                </div>

                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gmLabor" className="text-xs font-bold">Margen Mano de Obra</Label>
                    <Badge variant="outline" className="font-mono text-[10px]">Instalación</Badge>
                  </div>
                  <div className="relative">
                    <Input
                      id="gmLabor"
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={formData.gmLabor}
                      onChange={(e) => updateNumberField('gmLabor', e.target.value)}
                      className="font-mono font-bold pr-8 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">%</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Objetivo estándar: 20.0%</p>
                </div>

                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gmFloor" className="text-xs font-bold">Margen Piso Mínimo</Label>
                    <Badge variant="outline" className="font-mono text-[10px]">Límite</Badge>
                  </div>
                  <div className="relative">
                    <Input
                      id="gmFloor"
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={formData.gmFloor}
                      onChange={(e) => updateNumberField('gmFloor', e.target.value)}
                      className="font-mono font-bold pr-8 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">%</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Umbral de descuento máximo: 15.0%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selector Interactivo de Nivel de Vidrio */}
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-sm font-black uppercase tracking-wider">
                    Nivel de Volumen y Precio Base de Vidrio
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Selecciona el nivel por volumen de metros cuadrados para aplicar el precio escalonado correspondiente.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5">
                  <span className="text-xs font-bold text-muted-foreground">Precio Aplicado Actual:</span>
                  <span className="font-mono text-sm font-black text-primary">
                    ${Number(formData.glassAppliedPrice).toFixed(2)} USD/m²
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tarjetas de Nivel (Tiers) */}
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                {GLASS_TIERS.map((tier) => {
                  const isSelected = formData.glassVolumeTier === tier.key;
                  const price = formData[tier.field] ?? tier.defaultPrice;
                  return (
                    <button
                      key={tier.key}
                      type="button"
                      onClick={() => handleSelectGlassTier(tier.key)}
                      className={cn(
                        'group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all',
                        isSelected
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-xs'
                          : 'border-border/60 bg-muted/15 hover:border-border hover:bg-muted/30',
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-tight">{tier.label}</span>
                          {isSelected && <CheckCircle2 className="size-4 text-primary" />}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{tier.description}</p>
                      </div>
                      <div className="mt-3">
                        <span className="font-mono text-base font-black text-foreground group-hover:text-primary transition-colors">
                          ${Number(price).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-1">/m²</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Ajuste manual de precio aplicado y metas */}
              <div className="grid gap-4 sm:grid-cols-3 pt-2">
                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <Label htmlFor="appliedGlassPrice" className="text-xs font-bold">Precio Aplicado Personalizado</Label>
                  <div className="relative">
                    <Input
                      id="appliedGlassPrice"
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.glassAppliedPrice}
                      onChange={(e) => updateNumberField('glassAppliedPrice', e.target.value)}
                      className="font-mono font-bold pr-16 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                      USD/m²
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Permite sobreescribir el precio base para este proyecto específico.</p>
                </div>

                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <Label htmlFor="targetMargin" className="text-xs font-bold">Meta de Margen General</Label>
                  <div className="relative">
                    <Input
                      id="targetMargin"
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={formData.targetMargin}
                      onChange={(e) => updateNumberField('targetMargin', e.target.value)}
                      className="font-mono font-bold pr-8 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">%</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Margen de rentabilidad global esperado para la propuesta (25%).</p>
                </div>

                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <Label htmlFor="targetProfit" className="text-xs font-bold">Meta de Utilidad Neta</Label>
                  <div className="relative">
                    <Input
                      id="targetProfit"
                      type="number"
                      step="100"
                      min="0"
                      value={formData.targetProfitAmount}
                      onChange={(e) => updateNumberField('targetProfitAmount', e.target.value)}
                      className="font-mono font-bold pr-12 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                      USD
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Ganancia neta monetaria pactada como objetivo.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== C) RENDIMIENTOS Y MERMAS ==================== */}
        <TabsContent value="rendimientos" className="space-y-4 outline-none">
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black uppercase tracking-wider">Tiempos de Trabajo, Cuadrillas y Equipos</CardTitle>
              <CardDescription className="text-xs">
                Rendimientos técnicos de montaje en obra, composición de personal y costos de equipos de altura.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <Label htmlFor="daysAcm" className="text-xs font-bold">Días de Trabajo ACM</Label>
                  <div className="relative">
                    <Input
                      id="daysAcm"
                      type="number"
                      step="1"
                      min="0"
                      value={formData.workDaysAcm}
                      onChange={(e) => updateNumberField('workDaysAcm', e.target.value)}
                      className="font-mono font-bold pr-14 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">días</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Duración estimada para paneles compuestos (15).</p>
                </div>

                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <Label htmlFor="daysGlass" className="text-xs font-bold">Días Vidrio / Muro Cortina</Label>
                  <div className="relative">
                    <Input
                      id="daysGlass"
                      type="number"
                      step="1"
                      min="0"
                      value={formData.workDaysCurtainWall}
                      onChange={(e) => updateNumberField('workDaysCurtainWall', e.target.value)}
                      className="font-mono font-bold pr-14 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">días</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Duración estimada para fachadas de vidrio (20).</p>
                </div>

                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <Label htmlFor="crew" className="text-xs font-bold">Tamaño de Cuadrilla</Label>
                  <div className="relative">
                    <Input
                      id="crew"
                      type="number"
                      step="1"
                      min="1"
                      value={formData.crewSize}
                      onChange={(e) => updateNumberField('crewSize', e.target.value)}
                      className="font-mono font-bold pr-16 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">personas</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Operarios e instaladores en sitio (8).</p>
                </div>

                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <Label htmlFor="perDiem" className="text-xs font-bold">Días de Viáticos</Label>
                  <div className="relative">
                    <Input
                      id="perDiem"
                      type="number"
                      step="1"
                      min="0"
                      value={formData.perDiemDays}
                      onChange={(e) => updateNumberField('perDiemDays', e.target.value)}
                      className="font-mono font-bold pr-14 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">días</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Días de alimentación y hospedaje (19).</p>
                </div>
              </div>

              {/* Alquiler de Equipos */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-3">
                  Tarifas Diarias de Alquiler de Andamios y Plataformas (NIO)
                </h4>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                    <Label htmlFor="scaffoldRate" className="text-xs font-bold">Andamios Convencionales</Label>
                    <div className="relative">
                      <Input
                        id="scaffoldRate"
                        type="number"
                        step="5"
                        min="0"
                        value={formData.scaffoldDailyRateNio}
                        onChange={(e) => updateNumberField('scaffoldDailyRateNio', e.target.value)}
                        className="font-mono font-bold pr-16 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                        C$/día
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">C$ 40.00 / cuerpo / día.</p>
                  </div>

                  <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                    <Label htmlFor="platformRate" className="text-xs font-bold">Plataformas Metálicas</Label>
                    <div className="relative">
                      <Input
                        id="platformRate"
                        type="number"
                        step="5"
                        min="0"
                        value={formData.platformDailyRateNio}
                        onChange={(e) => updateNumberField('platformDailyRateNio', e.target.value)}
                        className="font-mono font-bold pr-16 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                        C$/día
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">C$ 30.00 / plataforma / día.</p>
                  </div>

                  <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                    <Label htmlFor="castersRate" className="text-xs font-bold">Juegos de Rodos Móviles</Label>
                    <div className="relative">
                      <Input
                        id="castersRate"
                        type="number"
                        step="5"
                        min="0"
                        value={formData.castersDailyRateNio}
                        onChange={(e) => updateNumberField('castersDailyRateNio', e.target.value)}
                        className="font-mono font-bold pr-16 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                        C$/día
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">C$ 100.00 / juego / día.</p>
                  </div>
                </div>
              </div>

              {/* Láminas ACM y Barras de Aluminio */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-3">
                  Formatos Estándar de Lámina ACM y Perfilería
                </h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                    <Label htmlFor="acmWidth" className="text-xs font-bold">Ancho Estándar Lámina</Label>
                    <div className="relative">
                      <Input
                        id="acmWidth"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.acmStandardWidth}
                        onChange={(e) => updateNumberField('acmStandardWidth', e.target.value)}
                        className="font-mono font-bold pr-8 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">m</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Ancho nominal (1.50 m).</p>
                  </div>

                  <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                    <Label htmlFor="acmHeight" className="text-xs font-bold">Alto Estándar Lámina</Label>
                    <div className="relative">
                      <Input
                        id="acmHeight"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.acmStandardHeight}
                        onChange={(e) => updateNumberField('acmStandardHeight', e.target.value)}
                        className="font-mono font-bold pr-8 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">m</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Longitud nominal (4.98 m).</p>
                  </div>

                  <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                    <Label htmlFor="acmWaste" className="text-xs font-bold">Merma / Desperdicio ACM</Label>
                    <div className="relative">
                      <Input
                        id="acmWaste"
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={formData.acmStandardWaste}
                        onChange={(e) => updateNumberField('acmStandardWaste', e.target.value)}
                        className="font-mono font-bold pr-8 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">%</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Desperdicio por corte y dobladillo (13.0%).</p>
                  </div>

                  <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                    <Label htmlFor="profileLen" className="text-xs font-bold">Barras de Perfilería</Label>
                    <div className="relative">
                      <Input
                        id="profileLen"
                        type="number"
                        step="0.1"
                        min="0"
                        value={formData.profileStandardLength}
                        onChange={(e) => updateNumberField('profileStandardLength', e.target.value)}
                        className="font-mono font-bold pr-8 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">m</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Largo comercial estándar (6.40 m).</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== D) DATOS DE COTIZACIÓN ==================== */}
        <TabsContent value="cotizacion" className="space-y-4 outline-none">
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black uppercase tracking-wider">Encabezado y Términos de la Propuesta</CardTitle>
              <CardDescription className="text-xs">
                Información del cliente, asesor comercial, vigencia legal y paneles adicionales de repuesto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <Label htmlFor="clientName" className="text-xs font-bold">Nombre del Cliente</Label>
                  <Input
                    id="clientName"
                    type="text"
                    value={formData.clientName}
                    placeholder="Ej. Desarrollos Comerciales S.A."
                    onChange={(e) => updateStringField('clientName', e.target.value)}
                    className="font-bold text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Razón social o cliente final para la carátula de cotización.</p>
                </div>

                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <Label htmlFor="quoteNum" className="text-xs font-bold">N° de Cotización / Código</Label>
                  <Input
                    id="quoteNum"
                    type="text"
                    value={formData.quoteNumber}
                    placeholder="Ej. COT-2026-089"
                    onChange={(e) => updateStringField('quoteNumber', e.target.value)}
                    className="font-mono font-bold text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Identificador formal de la propuesta comercial.</p>
                </div>

                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <Label htmlFor="advisor" className="text-xs font-bold">Asesor de Ventas</Label>
                  <Input
                    id="advisor"
                    type="text"
                    value={formData.advisorName}
                    placeholder="Ej. Ing. Carlos Mendoza"
                    onChange={(e) => updateStringField('advisorName', e.target.value)}
                    className="font-bold text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Especialista técnico o comercial responsable del cálculo.</p>
                </div>

                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <Label htmlFor="validity" className="text-xs font-bold">Vigencia de la Cotización</Label>
                  <div className="relative">
                    <Input
                      id="validity"
                      type="number"
                      step="1"
                      min="1"
                      value={formData.quoteValidityDays}
                      onChange={(e) => updateNumberField('quoteValidityDays', e.target.value)}
                      className="font-mono font-bold pr-14 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">días</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Plazo de validez de precios antes de caducar (15 días).</p>
                </div>

                <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/15 p-3">
                  <Label htmlFor="spares" className="text-xs font-bold">Paneles de Repuesto / Stock</Label>
                  <div className="relative">
                    <Input
                      id="spares"
                      type="number"
                      step="1"
                      min="0"
                      value={formData.spareParts}
                      onChange={(e) => updateNumberField('spareParts', e.target.value)}
                      className="font-mono font-bold pr-16 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">paneles</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Piezas de recambio adicionales solicitadas por contrato.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Botón inferior para guardar */}
      <div className="flex justify-end pt-2">
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-xl px-6 font-bold uppercase tracking-wider text-xs gap-2 shadow-sm"
        >
          <Save className="size-4" />
          <span>{isSaving ? 'Guardando Parámetros…' : 'Guardar Parámetros del Proyecto'}</span>
        </Button>
      </div>

      {/* Diálogo de Confirmación para Sincronizar con Configuración Global */}
      <ConfirmDialog
        open={showSyncConfirm}
        onOpenChange={setShowSyncConfirm}
        title="¿Sincronizar con Configuración Global?"
        description={
          formData.lockExchangeRate
            ? 'Esta acción actualizará las tasas fiscales, márgenes y rendimientos desde la configuración global del ERP. Debido a que "Fijar Tipo de Cambio por Contrato" está activado, el tipo de cambio de este proyecto NO será alterado.'
            : 'Esta acción actualizará todas las tasas fiscales, márgenes, rendimientos y el Tipo de Cambio con los valores predeterminados globales del ERP.'
        }
        confirmLabel="Sincronizar Ahora"
        cancelLabel="Cancelar"
        variant="warning"
        loading={isSyncing}
        onConfirm={handleSyncGlobal}
      />
    </div>
  );
}
