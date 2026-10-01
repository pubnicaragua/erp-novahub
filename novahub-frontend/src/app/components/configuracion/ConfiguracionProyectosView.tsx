import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Coins,
  TrendingUp,
  Wrench,
  Truck,
  Save,
  RefreshCw,
  Info,
  FolderKanban,
  RotateCcw,
  Percent,
  Layers,
  Calculator,
  ShieldCheck,
  Building2,
  Clock,
  HardHat,
  Scale,
  Plus,
  Pencil,
  Archive,
  Trash2,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '../ui/alert-dialog';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from '@/app/services/toast';
import { getApiErrorMessage } from '../../services/api';
import { projectsService, type ProjectCostTemplate, type ProjectCostTemplateInput, type ProjectCostTemplateLineInput } from '../../services/projects.service';
import { useAuth } from '../../contexts/AuthContext';
import { invalidateTenantQueries, useTenantQuery } from '../../hooks/useTenantQuery';

export interface ProjectGlassLadderTier {
  id: string;
  name: string;
  rangeMin: number;
  rangeMax: number;
  discountPct: number;
  marginPct: number;
}

export interface ProjectTenantConfig {
  // Pestaña 1: Moneda y Fiscal
  exchangeRate: number;
  ivaPct: number;
  retentionIrPct: number;
  retentionImiPct: number;
  grossUpRetentions: boolean;
  salesCommissionPct: number;
  contingenciesPct: number;
  administrativeExpensesPct: number;
  collectionTermDays: number;
  financialRatePct: number;

  // Pestaña 2: Márgenes y Precios
  marginAcmPct: number;
  marginGlassPct: number;
  marginLaborPct: number;
  floorMarginPct: number;
  importedProjectDiscountPct: number;
  nationalProjectDiscountPct: number;
  glassLadder: ProjectGlassLadderTier[];

  // Pestaña 3: Rendimientos y Equipos
  rentalScaffoldingDailyNio: number;
  rentalPlatformDailyNio: number;
  rentalCastersDailyNio: number;
  daysAcm: number;
  daysGlass: number;
  crewSize: number;
  perDiemDays: number;
  acmSheetWidthM: number;
  acmSheetLengthM: number;
  acmWastePct: number;
  profileBarLengthM: number;
  glassBreakageProvisionPct: number;

  // Pestaña 4: Importación y Políticas
  freightInternationalPct: number;
  daiPct: number;
  customsPct: number;
  freightInternalPct: number;
  nationalizationFactor: number;
  quoteValidityDays: number;
  sparePanelsQty: number;
}

const DEFAULT_GLASS_LADDER: ProjectGlassLadderTier[] = [
  { id: 'retail', name: 'Retail', rangeMin: 0, rangeMax: 10, discountPct: 0, marginPct: 28 },
  { id: 'pequeno', name: 'Pequeño', rangeMin: 10, rangeMax: 50, discountPct: 5, marginPct: 25 },
  { id: 'mediano', name: 'Mediano', rangeMin: 50, rangeMax: 150, discountPct: 10, marginPct: 22 },
  { id: 'grande', name: 'Grande', rangeMin: 150, rangeMax: 500, discountPct: 15, marginPct: 18 },
  { id: 'estrategico', name: 'Estratégico', rangeMin: 500, rangeMax: 9999, discountPct: 20, marginPct: 15 },
];

const DEFAULT_PROJECT_CONFIG: ProjectTenantConfig = {
  // Pestaña 1: Moneda y Fiscal
  exchangeRate: 36.6242,
  ivaPct: 15,
  retentionIrPct: 2,
  retentionImiPct: 1,
  grossUpRetentions: true,
  salesCommissionPct: 2.5,
  contingenciesPct: 5,
  administrativeExpensesPct: 4,
  collectionTermDays: 30,
  financialRatePct: 1.5,

  // Pestaña 2: Márgenes y Precios
  marginAcmPct: 26,
  marginGlassPct: 24,
  marginLaborPct: 20,
  floorMarginPct: 15,
  importedProjectDiscountPct: 20,
  nationalProjectDiscountPct: 0,
  glassLadder: DEFAULT_GLASS_LADDER,

  // Pestaña 3: Rendimientos y Equipos
  rentalScaffoldingDailyNio: 40,
  rentalPlatformDailyNio: 30,
  rentalCastersDailyNio: 100,
  daysAcm: 15,
  daysGlass: 20,
  crewSize: 8,
  perDiemDays: 19,
  acmSheetWidthM: 1.50,
  acmSheetLengthM: 4.98,
  acmWastePct: 13,
  profileBarLengthM: 6.40,
  glassBreakageProvisionPct: 2,

  // Pestaña 4: Importación y Políticas
  freightInternationalPct: 8.5,
  daiPct: 5,
  customsPct: 2.5,
  freightInternalPct: 3,
  nationalizationFactor: 1.25,
  quoteValidityDays: 15,
  sparePanelsQty: 2,
};

export function ConfiguracionProyectosView({ canEdit = true }: { canEdit?: boolean }) {
  const { user, canPerform } = useAuth();
  const [config, setConfig] = useState<ProjectTenantConfig>(DEFAULT_PROJECT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('moneda-fiscal');

  useEffect(() => {
    let active = true;
    projectsService.getTenantConfig()
      .then((res) => {
        if (!active) return;
        const data = res?.data || res;
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          setConfig((prev) => ({
            ...prev,
            ...data,
            glassLadder: Array.isArray(data.glassLadder) && data.glassLadder.length > 0
              ? data.glassLadder
              : prev.glassLadder,
          }));
        }
      })
      .catch((error) => {
        console.warn('Configuración de proyectos remota no encontrada o error en carga, utilizando valores por defecto:', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      await projectsService.updateTenantConfig(config);
      toast.success('Configuración de proyectos guardada correctamente');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al guardar la configuración de proyectos'));
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setConfig(DEFAULT_PROJECT_CONFIG);
    toast.info('Se han cargado los valores de referencia sugeridos');
  };

  const updateNumberField = (field: keyof ProjectTenantConfig, val: string) => {
    const parsed = parseFloat(val);
    setConfig((prev) => ({
      ...prev,
      [field]: isNaN(parsed) ? 0 : parsed,
    }));
  };

  const updateGlassLadderRow = (
    index: number,
    field: keyof ProjectGlassLadderTier,
    val: string | number
  ) => {
    setConfig((prev) => {
      const nextLadder = [...prev.glassLadder];
      const target = { ...nextLadder[index] };
      if (field === 'name') {
        target.name = String(val);
      } else {
        const num = typeof val === 'number' ? val : parseFloat(val);
        const safeNum = isNaN(num) ? 0 : num;
        if (field === 'rangeMin') target.rangeMin = safeNum;
        else if (field === 'rangeMax') target.rangeMax = safeNum;
        else if (field === 'discountPct') target.discountPct = safeNum;
        else if (field === 'marginPct') target.marginPct = safeNum;
      }
      nextLadder[index] = target;
      return { ...prev, glassLadder: nextLadder };
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <Card className="overflow-hidden border-border/50 shadow-sm">
        <CardHeader className="border-b border-border/30 bg-muted/10 pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FolderKanban className="size-5" />
                </div>
                <CardTitle className="text-xl font-black">
                  Parámetros Globales de Proyectos
                </CardTitle>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-primary border-primary/30">
                  MGP Proyectos
                </Badge>
              </div>
              <CardDescription>
                Define tasas impositivas, márgenes estándar, rendimientos de mano de obra y costos de importación para cotizaciones y presupuestos de proyectos.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetDefaults}
                disabled={!canEdit || saving || loading}
                className="gap-1.5 text-xs font-bold"
              >
                <RotateCcw className="size-3.5" />
                Restablecer sugeridos
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSave()}
                disabled={!canEdit || saving || loading}
                className="gap-2 text-xs font-black shadow-md transition-all hover:shadow-lg"
              >
                {saving ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {saving ? 'Guardando...' : 'Guardar Configuración'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {loading ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-muted-foreground">
              <RefreshCw className="size-6 animate-spin text-primary" />
              <p className="text-sm font-medium">Cargando parámetros de proyectos...</p>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto p-1.5 gap-1.5 bg-muted/40 rounded-xl border border-border/40">
                <TabsTrigger
                  value="moneda-fiscal"
                  className="flex items-center gap-2 py-2.5 text-xs font-black uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg"
                >
                  <Coins className="size-4" />
                  Moneda y Fiscal
                </TabsTrigger>
                <TabsTrigger
                  value="margenes-precios"
                  className="flex items-center gap-2 py-2.5 text-xs font-black uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg"
                >
                  <TrendingUp className="size-4" />
                  Márgenes y Precios
                </TabsTrigger>
                <TabsTrigger
                  value="rendimientos-equipos"
                  className="flex items-center gap-2 py-2.5 text-xs font-black uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg"
                >
                  <Wrench className="size-4" />
                  Rendimientos y Equipos
                </TabsTrigger>
                <TabsTrigger
                  value="importacion-politicas"
                  className="flex items-center gap-2 py-2.5 text-xs font-black uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg"
                >
                  <Truck className="size-4" />
                  Importación y Políticas
                </TabsTrigger>
              </TabsList>

              {/* ══════════════ PESTAÑA 1: MONEDA Y FISCAL ══════════════ */}
              <TabsContent value="moneda-fiscal" className="space-y-6 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Card Impuestos y Retenciones */}
                  <Card className="border-border/50 bg-background/50 shadow-none">
                    <CardHeader className="pb-3 border-b border-border/30">
                      <CardTitle className="text-sm font-black flex items-center gap-2">
                        <Scale className="size-4 text-primary" />
                        Régimen Fiscal y Retenciones
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Tasas aplicadas en presupuestos de venta y costos de subcontratos.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="tc-proyectos" className="text-xs font-bold">Tipo de Cambio Oficial (C$/US$)</Label>
                          <span className="text-[11px] text-muted-foreground">BCN / Referencia</span>
                        </div>
                        <Input
                          id="tc-proyectos"
                          type="number"
                          step="0.0001"
                          disabled={!canEdit}
                          value={config.exchangeRate}
                          onChange={(e) => updateNumberField('exchangeRate', e.target.value)}
                          className="font-mono text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="iva-pct" className="text-xs font-bold">IVA (%)</Label>
                          <Input
                            id="iva-pct"
                            type="number"
                            step="0.1"
                            disabled={!canEdit}
                            value={config.ivaPct}
                            onChange={(e) => updateNumberField('ivaPct', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="ret-ir-pct" className="text-xs font-bold">Retención IR (%)</Label>
                          <Input
                            id="ret-ir-pct"
                            type="number"
                            step="0.1"
                            disabled={!canEdit}
                            value={config.retentionIrPct}
                            onChange={(e) => updateNumberField('retentionIrPct', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="ret-imi-pct" className="text-xs font-bold">Ret. IMI Alcaldía (%)</Label>
                          <Input
                            id="ret-imi-pct"
                            type="number"
                            step="0.1"
                            disabled={!canEdit}
                            value={config.retentionImiPct}
                            onChange={(e) => updateNumberField('retentionImiPct', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-3.5">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold">Aplicar Gross-up en Retenciones</p>
                          <p className="text-[11px] text-muted-foreground">
                            Ajusta el valor cotizado para que el ingreso neto recibido absorba las retenciones de ley.
                          </p>
                        </div>
                        <Switch
                          checked={config.grossUpRetentions}
                          onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, grossUpRetentions: checked }))}
                          disabled={!canEdit}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card Gastos Operativos y Financieros */}
                  <Card className="border-border/50 bg-background/50 shadow-none">
                    <CardHeader className="pb-3 border-b border-border/30">
                      <CardTitle className="text-sm font-black flex items-center gap-2">
                        <Calculator className="size-4 text-primary" />
                        Factores Indirectos y Financieros
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Recargos por contingencias, comisiones de venta y costo de capital.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="comision-ventas" className="text-xs font-bold">Comisión de Ventas (%)</Label>
                          <Input
                            id="comision-ventas"
                            type="number"
                            step="0.1"
                            disabled={!canEdit}
                            value={config.salesCommissionPct}
                            onChange={(e) => updateNumberField('salesCommissionPct', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="imprevistos" className="text-xs font-bold">Imprevistos (%)</Label>
                          <Input
                            id="imprevistos"
                            type="number"
                            step="0.1"
                            disabled={!canEdit}
                            value={config.contingenciesPct}
                            onChange={(e) => updateNumberField('contingenciesPct', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="gastos-admin" className="text-xs font-bold">Gastos Administrativos / Overhead (%)</Label>
                        <Input
                          id="gastos-admin"
                          type="number"
                          step="0.1"
                          disabled={!canEdit}
                          value={config.administrativeExpensesPct}
                          onChange={(e) => updateNumberField('administrativeExpensesPct', e.target.value)}
                          className="font-mono text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="plazo-cobro" className="text-xs font-bold">Plazo Cobro Estimado (Días)</Label>
                          <Input
                            id="plazo-cobro"
                            type="number"
                            step="1"
                            disabled={!canEdit}
                            value={config.collectionTermDays}
                            onChange={(e) => updateNumberField('collectionTermDays', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="tasa-financiera" className="text-xs font-bold">Tasa Financiera Mensual (%)</Label>
                          <Input
                            id="tasa-financiera"
                            type="number"
                            step="0.1"
                            disabled={!canEdit}
                            value={config.financialRatePct}
                            onChange={(e) => updateNumberField('financialRatePct', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ══════════════ PESTAÑA 2: MÁRGENES Y PRECIOS ══════════════ */}
              <TabsContent value="margenes-precios" className="space-y-6 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Márgenes Base */}
                  <Card className="border-border/50 bg-background/50 shadow-none">
                    <CardHeader className="pb-3 border-b border-border/30">
                      <CardTitle className="text-sm font-black flex items-center gap-2">
                        <Percent className="size-4 text-primary" />
                        Márgenes Operativos Base
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Márgenes brutos mínimos aplicados a los componentes de cotización.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="margen-acm" className="text-xs font-bold">Margen ACM (%)</Label>
                          <Input
                            id="margen-acm"
                            type="number"
                            step="0.5"
                            disabled={!canEdit}
                            value={config.marginAcmPct}
                            onChange={(e) => updateNumberField('marginAcmPct', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="margen-vidrio" className="text-xs font-bold">Margen Vidrio (%)</Label>
                          <Input
                            id="margen-vidrio"
                            type="number"
                            step="0.5"
                            disabled={!canEdit}
                            value={config.marginGlassPct}
                            onChange={(e) => updateNumberField('marginGlassPct', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="margen-mo" className="text-xs font-bold">Margen Mano de Obra (%)</Label>
                          <Input
                            id="margen-mo"
                            type="number"
                            step="0.5"
                            disabled={!canEdit}
                            value={config.marginLaborPct}
                            onChange={(e) => updateNumberField('marginLaborPct', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="margen-piso" className="text-xs font-bold text-amber-600 dark:text-amber-400">
                            Margen Piso Mínimo (%)
                          </Label>
                          <Input
                            id="margen-piso"
                            type="number"
                            step="0.5"
                            disabled={!canEdit}
                            value={config.floorMarginPct}
                            onChange={(e) => updateNumberField('floorMarginPct', e.target.value)}
                            className="font-mono text-xs border-amber-500/40"
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Info className="size-3.5 text-amber-500 shrink-0" />
                        Las cotizaciones por debajo del margen piso requerirán autorización gerencial.
                      </p>
                    </CardContent>
                  </Card>

                  {/* Políticas de Descuento */}
                  <Card className="border-border/50 bg-background/50 shadow-none">
                    <CardHeader className="pb-3 border-b border-border/30">
                      <CardTitle className="text-sm font-black flex items-center gap-2">
                        <Building2 className="size-4 text-primary" />
                        Descuentos por Origen de Proyecto
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Descuentos comerciales automáticos según procedencia del material.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="desc-importado" className="text-xs font-bold">
                          Descuento Proyectos Importado (%)
                        </Label>
                        <Input
                          id="desc-importado"
                          type="number"
                          step="0.5"
                          disabled={!canEdit}
                          value={config.importedProjectDiscountPct}
                          onChange={(e) => updateNumberField('importedProjectDiscountPct', e.target.value)}
                          className="font-mono text-xs"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Descuento estándar por volumen de importación de contenedores directos.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="desc-nacional" className="text-xs font-bold">
                          Descuento Nacional (%)
                        </Label>
                        <Input
                          id="desc-nacional"
                          type="number"
                          step="0.5"
                          disabled={!canEdit}
                          value={config.nationalProjectDiscountPct}
                          onChange={(e) => updateNumberField('nationalProjectDiscountPct', e.target.value)}
                          className="font-mono text-xs"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Materiales de adquisición en plaza local / stock de sucursal.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabla Editable: Escalera de Vidrio */}
                <Card className="border-border/50 bg-background/50 shadow-none">
                  <CardHeader className="pb-3 border-b border-border/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-black flex items-center gap-2">
                          <Layers className="size-4 text-primary" />
                          Escalera de Precios y Márgenes de Vidrio
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Escalonamiento de volumen en m² con descuentos y márgenes asociados por escala de proyecto.
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground">
                        {config.glassLadder.length} Niveles
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="overflow-x-auto rounded-lg border border-border/40">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/40 font-bold uppercase text-[10px] tracking-wider text-muted-foreground border-b border-border/40">
                          <tr>
                            <th className="p-3">Categoría</th>
                            <th className="p-3 text-right">Rango Mín (m²)</th>
                            <th className="p-3 text-right">Rango Máx (m²)</th>
                            <th className="p-3 text-right">Descuento (%)</th>
                            <th className="p-3 text-right">Margen Objetivo (%)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30 font-medium">
                          {config.glassLadder.map((tier, idx) => (
                            <tr key={tier.id} className="hover:bg-muted/20 transition-colors">
                              <td className="p-2.5 font-bold">
                                <Input
                                  value={tier.name}
                                  disabled={!canEdit}
                                  onChange={(e) => updateGlassLadderRow(idx, 'name', e.target.value)}
                                  className="h-8 text-xs font-bold max-w-[140px]"
                                />
                              </td>
                              <td className="p-2.5 text-right">
                                <Input
                                  type="number"
                                  disabled={!canEdit}
                                  value={tier.rangeMin}
                                  onChange={(e) => updateGlassLadderRow(idx, 'rangeMin', e.target.value)}
                                  className="h-8 text-xs font-mono text-right max-w-[100px] ml-auto"
                                />
                              </td>
                              <td className="p-2.5 text-right">
                                <Input
                                  type="number"
                                  disabled={!canEdit}
                                  value={tier.rangeMax}
                                  onChange={(e) => updateGlassLadderRow(idx, 'rangeMax', e.target.value)}
                                  className="h-8 text-xs font-mono text-right max-w-[100px] ml-auto"
                                />
                              </td>
                              <td className="p-2.5 text-right">
                                <Input
                                  type="number"
                                  step="0.5"
                                  disabled={!canEdit}
                                  value={tier.discountPct}
                                  onChange={(e) => updateGlassLadderRow(idx, 'discountPct', e.target.value)}
                                  className="h-8 text-xs font-mono text-right max-w-[100px] ml-auto text-emerald-600 dark:text-emerald-400 font-bold"
                                />
                              </td>
                              <td className="p-2.5 text-right">
                                <Input
                                  type="number"
                                  step="0.5"
                                  disabled={!canEdit}
                                  value={tier.marginPct}
                                  onChange={(e) => updateGlassLadderRow(idx, 'marginPct', e.target.value)}
                                  className="h-8 text-xs font-mono text-right max-w-[100px] ml-auto text-primary font-bold"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ══════════════ PESTAÑA 3: RENDIMIENTOS Y EQUIPOS ══════════════ */}
              <TabsContent value="rendimientos-equipos" className="space-y-6 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Alquiler de Equipos */}
                  <Card className="border-border/50 bg-background/50 shadow-none">
                    <CardHeader className="pb-3 border-b border-border/30">
                      <CardTitle className="text-sm font-black flex items-center gap-2">
                        <Wrench className="size-4 text-primary" />
                        Alquiler Diario de Equipos (C$)
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Costo por día calendario en Córdobas.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="alq-andamio" className="text-xs font-bold">Andamio (C$/día)</Label>
                        <Input
                          id="alq-andamio"
                          type="number"
                          step="1"
                          disabled={!canEdit}
                          value={config.rentalScaffoldingDailyNio}
                          onChange={(e) => updateNumberField('rentalScaffoldingDailyNio', e.target.value)}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="alq-plataforma" className="text-xs font-bold">Plataforma (C$/día)</Label>
                        <Input
                          id="alq-plataforma"
                          type="number"
                          step="1"
                          disabled={!canEdit}
                          value={config.rentalPlatformDailyNio}
                          onChange={(e) => updateNumberField('rentalPlatformDailyNio', e.target.value)}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="alq-rodos" className="text-xs font-bold">Rodos (C$/día)</Label>
                        <Input
                          id="alq-rodos"
                          type="number"
                          step="1"
                          disabled={!canEdit}
                          value={config.rentalCastersDailyNio}
                          onChange={(e) => updateNumberField('rentalCastersDailyNio', e.target.value)}
                          className="font-mono text-xs"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tiempos y Cuadrilla */}
                  <Card className="border-border/50 bg-background/50 shadow-none">
                    <CardHeader className="pb-3 border-b border-border/30">
                      <CardTitle className="text-sm font-black flex items-center gap-2">
                        <HardHat className="size-4 text-primary" />
                        Tiempos y Cuadrilla
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Parámetros estándar de jornadas y cuadrilla de montaje.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="dias-acm" className="text-xs font-bold">Días ACM</Label>
                          <Input
                            id="dias-acm"
                            type="number"
                            step="1"
                            disabled={!canEdit}
                            value={config.daysAcm}
                            onChange={(e) => updateNumberField('daysAcm', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="dias-vidrio" className="text-xs font-bold">Días Vidrio</Label>
                          <Input
                            id="dias-vidrio"
                            type="number"
                            step="1"
                            disabled={!canEdit}
                            value={config.daysGlass}
                            onChange={(e) => updateNumberField('daysGlass', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="cuadrilla" className="text-xs font-bold">Cuadrilla (Pers.)</Label>
                          <Input
                            id="cuadrilla"
                            type="number"
                            step="1"
                            disabled={!canEdit}
                            value={config.crewSize}
                            onChange={(e) => updateNumberField('crewSize', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="dias-viaticos" className="text-xs font-bold">Días Viáticos</Label>
                          <Input
                            id="dias-viaticos"
                            type="number"
                            step="1"
                            disabled={!canEdit}
                            value={config.perDiemDays}
                            onChange={(e) => updateNumberField('perDiemDays', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Medidas y Mermas de Material */}
                  <Card className="border-border/50 bg-background/50 shadow-none">
                    <CardHeader className="pb-3 border-b border-border/30">
                      <CardTitle className="text-sm font-black flex items-center gap-2">
                        <Layers className="size-4 text-primary" />
                        Medidas y Mermas
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Dimensionamiento de lámina, barra perfil y provisión de rotura.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="acm-ancho" className="text-xs font-bold">Lámina ACM Ancho (m)</Label>
                          <Input
                            id="acm-ancho"
                            type="number"
                            step="0.01"
                            disabled={!canEdit}
                            value={config.acmSheetWidthM}
                            onChange={(e) => updateNumberField('acmSheetWidthM', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="acm-largo" className="text-xs font-bold">Lámina ACM Largo (m)</Label>
                          <Input
                            id="acm-largo"
                            type="number"
                            step="0.01"
                            disabled={!canEdit}
                            value={config.acmSheetLengthM}
                            onChange={(e) => updateNumberField('acmSheetLengthM', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="merma-acm" className="text-xs font-bold">Merma ACM (%)</Label>
                          <Input
                            id="merma-acm"
                            type="number"
                            step="0.5"
                            disabled={!canEdit}
                            value={config.acmWastePct}
                            onChange={(e) => updateNumberField('acmWastePct', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="barra-perfil" className="text-xs font-bold">Barra Perfil (m)</Label>
                          <Input
                            id="barra-perfil"
                            type="number"
                            step="0.01"
                            disabled={!canEdit}
                            value={config.profileBarLengthM}
                            onChange={(e) => updateNumberField('profileBarLengthM', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="rotura-vidrio" className="text-xs font-bold">Provisión Rotura Vidrio (%)</Label>
                        <Input
                          id="rotura-vidrio"
                          type="number"
                          step="0.5"
                          disabled={!canEdit}
                          value={config.glassBreakageProvisionPct}
                          onChange={(e) => updateNumberField('glassBreakageProvisionPct', e.target.value)}
                          className="font-mono text-xs"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ══════════════ PESTAÑA 4: IMPORTACIÓN Y POLÍTICAS ══════════════ */}
              <TabsContent value="importacion-politicas" className="space-y-6 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Factor de Nacionalización y Aduana */}
                  <Card className="border-border/50 bg-background/50 shadow-none">
                    <CardHeader className="pb-3 border-b border-border/30">
                      <CardTitle className="text-sm font-black flex items-center gap-2">
                        <Truck className="size-4 text-primary" />
                        Costos de Importación y Aduana
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Recargos arancelarios y logísticos para compras internacionales.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="flete-int" className="text-xs font-bold">Flete Internacional (%)</Label>
                          <Input
                            id="flete-int"
                            type="number"
                            step="0.1"
                            disabled={!canEdit}
                            value={config.freightInternationalPct}
                            onChange={(e) => updateNumberField('freightInternationalPct', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="dai-pct" className="text-xs font-bold">DAI Arancel (%)</Label>
                          <Input
                            id="dai-pct"
                            type="number"
                            step="0.1"
                            disabled={!canEdit}
                            value={config.daiPct}
                            onChange={(e) => updateNumberField('daiPct', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="aduanas-pct" className="text-xs font-bold">Gastos Aduaneros (%)</Label>
                          <Input
                            id="aduanas-pct"
                            type="number"
                            step="0.1"
                            disabled={!canEdit}
                            value={config.customsPct}
                            onChange={(e) => updateNumberField('customsPct', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="flete-interno" className="text-xs font-bold">Flete Interno (%)</Label>
                          <Input
                            id="flete-interno"
                            type="number"
                            step="0.1"
                            disabled={!canEdit}
                            value={config.freightInternalPct}
                            onChange={(e) => updateNumberField('freightInternalPct', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="factor-nacionalizacion" className="text-xs font-black text-primary uppercase tracking-wider">
                            Factor de Nacionalización (Multiplicador)
                          </Label>
                          <Badge className="bg-primary text-primary-foreground text-[10px] font-mono">
                            ×{config.nationalizationFactor}
                          </Badge>
                        </div>
                        <Input
                          id="factor-nacionalizacion"
                          type="number"
                          step="0.01"
                          disabled={!canEdit}
                          value={config.nationalizationFactor}
                          onChange={(e) => updateNumberField('nationalizationFactor', e.target.value)}
                          className="font-mono text-xs font-bold bg-background"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Multiplicador aplicado sobre el costo FOB para estimar el costo nacionalizado en bodega.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Políticas Comerciales y Repuestos */}
                  <Card className="border-border/50 bg-background/50 shadow-none">
                    <CardHeader className="pb-3 border-b border-border/30">
                      <CardTitle className="text-sm font-black flex items-center gap-2">
                        <Clock className="size-4 text-primary" />
                        Políticas de Validez y Stock de Seguridad
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Tiempos de vigencia en cotizaciones enviadas a clientes y reserva técnica.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="validez-cotizacion" className="text-xs font-bold">
                          Días de Validez de Cotización (Días)
                        </Label>
                        <Input
                          id="validez-cotizacion"
                          type="number"
                          step="1"
                          disabled={!canEdit}
                          value={config.quoteValidityDays}
                          onChange={(e) => updateNumberField('quoteValidityDays', e.target.value)}
                          className="font-mono text-xs"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Plazo tras el cual la cotización expira y debe revisarse el tipo de cambio y listas de precios.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="paneles-repuesto" className="text-xs font-bold">
                          Paneles de Repuesto / Muestra (Unidades)
                        </Label>
                        <Input
                          id="paneles-repuesto"
                          type="number"
                          step="1"
                          disabled={!canEdit}
                          value={config.sparePanelsQty}
                          onChange={(e) => updateNumberField('sparePanelsQty', e.target.value)}
                          className="font-mono text-xs"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Cantidad de paneles de repuesto incluidos automáticamente en pedidos mayores de fachadas.
                        </p>
                      </div>

                      <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                          <ShieldCheck className="size-4 text-emerald-600" />
                          Garantía de Cálculo Centralizado
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Todos los proyectos creados o actualizados tomarán estos parámetros de referencia como valores predeterminados para sus hojas de cálculo y subcotizaciones.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* Bottom Save bar */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border/40 pt-4">
            <p className="text-xs text-muted-foreground">
              Los cambios guardados aplicarán inmediatamente a los nuevos presupuestos y estimaciones del módulo de Proyectos.
            </p>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canEdit || saving || loading}
              className="gap-2 font-black shadow-md transition-all hover:shadow-lg"
            >
              {saving ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </Button>
          </div>
        </CardContent>
      </Card>
      {user?.isTenantAdmin && canPerform('PROJECTS', 'read') && (
        <ProjectCostTemplatesSection canEdit={canEdit && canPerform('PROJECTS', 'edit')} />
      )}
    </div>
  );
}

const COST_DIMENSIONS = [
  { key: 'materiales', label: 'Materiales' },
  { key: 'consumibles', label: 'Consumibles' },
  { key: 'manoObra', label: 'Mano de obra' },
  { key: 'andamiosEquipos', label: 'Andamios y equipos' },
  { key: 'fletes', label: 'Fletes' },
  { key: 'viaticos', label: 'Viáticos' },
] as const;

type CostDimension = typeof COST_DIMENSIONS[number]['key'];
type TemplateLineDraft = Record<CostDimension | 'quantity' | 'gmMaterial' | 'gmInstalacion', string> & {
  key: string;
  name: string;
  code: string;
  description: string;
  unit: string;
  includeInExposure: boolean;
};
type TemplateDraft = { id?: string; name: string; description: string; lines: TemplateLineDraft[] };

function createTemplateLineDraft(line?: ProjectCostTemplate['lines'][number]): TemplateLineDraft {
  return {
    key: crypto.randomUUID(),
    name: line?.name ?? '', code: line?.code ?? '', description: line?.description ?? '',
    unit: line?.unit ?? 'Global', quantity: String(line?.quantity ?? 1),
    materiales: String(line?.materiales ?? 0), consumibles: String(line?.consumibles ?? 0),
    manoObra: String(line?.manoObra ?? 0), andamiosEquipos: String(line?.andamiosEquipos ?? 0),
    fletes: String(line?.fletes ?? 0), viaticos: String(line?.viaticos ?? 0),
    gmMaterial: line?.gmMaterial == null ? '' : String(Number(line.gmMaterial) * 100),
    gmInstalacion: line?.gmInstalacion == null ? '' : String(Number(line.gmInstalacion) * 100),
    includeInExposure: line?.includeInExposure ?? true,
  };
}

function ProjectCostTemplatesSection({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const templatesQuery = useTenantQuery<ProjectCostTemplate[]>(
    ['projects', 'cost-templates'], (signal) => projectsService.getCostTemplates(signal),
  );
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ProjectCostTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const templates = templatesQuery.data ?? [];

  const openEditor = (template?: ProjectCostTemplate) => {
    if (!canEdit || busy) return;
    setFormError('');
    setDraft({
      id: template?.id, name: template?.name ?? '', description: template?.description ?? '',
      lines: template ? template.lines.map(createTemplateLineDraft) : [createTemplateLineDraft()],
    });
  };

  const updateLine = (key: string, values: Partial<TemplateLineDraft>) => {
    setDraft((current) => current && ({ ...current, lines: current.lines.map((line) => line.key === key ? { ...line, ...values } : line) }));
  };

  const moveLine = (index: number, offset: number) => {
    setDraft((current) => {
      if (!current || index + offset < 0 || index + offset >= current.lines.length) return current;
      const lines = [...current.lines];
      [lines[index], lines[index + offset]] = [lines[index + offset], lines[index]];
      return { ...current, lines };
    });
  };

  const handleSaveTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || !canEdit || busy) return;
    const invalidLine = draft.lines.some((line) => !line.name.trim()
      || [...COST_DIMENSIONS.map(({ key }) => line[key]), line.quantity].some((value) => value.trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0)
      || [line.gmMaterial, line.gmInstalacion].some((value) => value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100)));
    if (!draft.name.trim() || !draft.lines.length || invalidLine) {
      setFormError('Escribe un nombre para la plantilla y cada partida. Usa costos y cantidades no negativos y márgenes entre 0 y 100 %.');
      return;
    }
    const data: ProjectCostTemplateInput = {
      name: draft.name.trim(), description: draft.description.trim(),
      lines: draft.lines.map((line, position): ProjectCostTemplateLineInput => ({
        name: line.name.trim(), code: line.code.trim(), description: line.description.trim(),
        unit: line.unit.trim() || 'Global', quantity: Number(line.quantity), position,
        materiales: Number(line.materiales), consumibles: Number(line.consumibles), manoObra: Number(line.manoObra),
        andamiosEquipos: Number(line.andamiosEquipos), fletes: Number(line.fletes), viaticos: Number(line.viaticos),
        ...(line.gmMaterial === '' ? {} : { gmMaterial: Number(line.gmMaterial) / 100 }),
        ...(line.gmInstalacion === '' ? {} : { gmInstalacion: Number(line.gmInstalacion) / 100 }),
        includeInExposure: line.includeInExposure,
      })),
    };
    setBusy(true);
    setFormError('');
    try {
      if (draft.id) await projectsService.updateCostTemplate(draft.id, data);
      else await projectsService.createCostTemplate(data);
      setDraft(null);
      toast.success(draft.id ? 'Plantilla actualizada' : 'Plantilla creada');
      await invalidateTenantQueries(queryClient);
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'No se pudo guardar la plantilla. Intenta nuevamente.'));
    } finally {
      setBusy(false);
    }
  };

  const setArchived = async (template: ProjectCostTemplate, isArchived: boolean) => {
    if (!canEdit || busy) return;
    setBusy(true);
    try {
      await projectsService.updateCostTemplate(template.id, { isArchived });
      setArchiveTarget(null);
      toast.success(isArchived ? 'Plantilla archivada' : 'Plantilla reactivada');
      await invalidateTenantQueries(queryClient);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cambiar el estado de la plantilla.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="min-w-0 max-w-full border-border/50">
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg"><Layers className="size-5 shrink-0 text-primary" aria-hidden="true" />Plantillas de costeo 6D</CardTitle>
          <CardDescription>Define partidas reutilizables para los proyectos de tu empresa.</CardDescription>
        </div>
        <Button type="button" onClick={() => openEditor()} disabled={!canEdit || busy} className="gap-2"><Plus className="size-4" aria-hidden="true" />Crear plantilla</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {!canEdit && <p className="text-sm text-muted-foreground">Necesitas permiso de edición de proyectos para administrar estas plantillas.</p>}
        {templatesQuery.isLoading ? (
          <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><RefreshCw className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Cargando plantillas...</p>
        ) : templatesQuery.isError ? (
          <div role="alert" className="space-y-2 text-sm">
            <p className="text-destructive">{getApiErrorMessage(templatesQuery.error, 'No se pudieron cargar las plantillas.')}</p>
            <Button type="button" variant="outline" onClick={() => void templatesQuery.refetch()} disabled={templatesQuery.isFetching}>Reintentar</Button>
          </div>
        ) : templates.length === 0 ? (
          <p className="border border-dashed border-border p-5 text-sm text-muted-foreground">No hay plantillas. Crea una con las partidas que utilizas en tus presupuestos.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {templates.map((template) => (
              <li key={template.id} className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="break-words font-medium">{template.name}</span><Badge variant={template.isArchived ? 'secondary' : 'outline'}>{template.isArchived ? 'Archivada' : 'Activa'}</Badge></div>
                  {template.description && <p className="break-words text-sm text-muted-foreground">{template.description}</p>}
                  <p className="text-xs text-muted-foreground">{template.lines.length} partidas</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={!canEdit || busy} onClick={() => openEditor(template)} aria-label={`Editar plantilla ${template.name}`} className="gap-2"><Pencil className="size-4" aria-hidden="true" />Editar</Button>
                  {template.isArchived ? (
                    <Button type="button" size="sm" variant="outline" disabled={!canEdit || busy} onClick={() => void setArchived(template, false)} aria-label={`Reactivar plantilla ${template.name}`}>Reactivar</Button>
                  ) : (
                    <Button type="button" size="sm" variant="outline" disabled={!canEdit || busy} onClick={() => setArchiveTarget(template)} aria-label={`Archivar plantilla ${template.name}`} className="gap-2"><Archive className="size-4" aria-hidden="true" />Archivar</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={Boolean(draft)} onOpenChange={(open) => { if (!open && !busy) setDraft(null); }}>
        <DialogContent className="sm:max-w-4xl" onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onPointerDownOutside={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Editar plantilla de costeo' : 'Crear plantilla de costeo'}</DialogTitle>
            <DialogDescription>Configura las partidas y sus seis costos de referencia. Los importes se aplican en la moneda del proyecto.</DialogDescription>
          </DialogHeader>
          {draft && (
            <form onSubmit={(event) => void handleSaveTemplate(event)} className="min-w-0 space-y-4">
              <fieldset disabled={busy || !canEdit} className="min-w-0 space-y-4">
                <div className="space-y-1.5"><Label htmlFor="cost-template-name">Nombre de la plantilla</Label><Input id="cost-template-name" required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="cost-template-description">Descripción (opcional)</Label><Textarea id="cost-template-description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></div>
                <p className="text-xs text-muted-foreground">Los márgenes opcionales heredan el margen del proyecto al dejarlos vacíos.</p>
                {draft.lines.map((line, index) => (
                  <fieldset key={line.key} className="min-w-0 space-y-3 rounded-md border border-border p-3">
                    <legend className="px-1 text-sm font-medium">Partida {index + 1}</legend>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button type="button" size="icon" variant="ghost" disabled={index === 0} aria-label={`Subir partida ${index + 1}`} onClick={() => moveLine(index, -1)}><ArrowUp className="size-4" aria-hidden="true" /></Button>
                      <Button type="button" size="icon" variant="ghost" disabled={index === draft.lines.length - 1} aria-label={`Bajar partida ${index + 1}`} onClick={() => moveLine(index, 1)}><ArrowDown className="size-4" aria-hidden="true" /></Button>
                      <Button type="button" size="icon" variant="ghost" disabled={draft.lines.length === 1} aria-label={`Eliminar partida ${index + 1}`} onClick={() => setDraft({ ...draft, lines: draft.lines.filter((item) => item.key !== line.key) })}><Trash2 className="size-4 text-destructive" aria-hidden="true" /></Button>
                    </div>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <div className="min-w-0 space-y-1.5"><Label htmlFor={`${line.key}-name`}>Nombre de la partida</Label><Input id={`${line.key}-name`} required value={line.name} onChange={(event) => updateLine(line.key, { name: event.target.value })} /></div>
                      <div className="min-w-0 space-y-1.5"><Label htmlFor={`${line.key}-code`}>Código (opcional)</Label><Input id={`${line.key}-code`} value={line.code} onChange={(event) => updateLine(line.key, { code: event.target.value })} /></div>
                      <div className="min-w-0 space-y-1.5"><Label htmlFor={`${line.key}-unit`}>Unidad</Label><Input id={`${line.key}-unit`} value={line.unit} onChange={(event) => updateLine(line.key, { unit: event.target.value })} /></div>
                      <div className="min-w-0 space-y-1.5"><Label htmlFor={`${line.key}-quantity`}>Cantidad</Label><Input id={`${line.key}-quantity`} type="number" required min="0" step="any" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} /></div>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor={`${line.key}-description`}>Descripción de la partida (opcional)</Label><Textarea id={`${line.key}-description`} value={line.description} onChange={(event) => updateLine(line.key, { description: event.target.value })} /></div>
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {COST_DIMENSIONS.map(({ key, label }) => (
                        <div key={key} className="min-w-0 space-y-1.5"><Label htmlFor={`${line.key}-${key}`}>{label}</Label><Input id={`${line.key}-${key}`} type="number" required min="0" step="any" value={line[key]} onChange={(event) => updateLine(line.key, { [key]: event.target.value })} /></div>
                      ))}
                    </div>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      {([{ key: 'gmMaterial', label: 'Margen de materiales (%)' }, { key: 'gmInstalacion', label: 'Margen de instalación (%)' }] as const).map(({ key, label }) => (
                        <div key={key} className="min-w-0 space-y-1.5"><Label htmlFor={`${line.key}-${key}`}>{label}</Label><Input id={`${line.key}-${key}`} type="number" min="0" max="100" step="any" placeholder="Usar margen del proyecto" value={line[key]} onChange={(event) => updateLine(line.key, { [key]: event.target.value })} /></div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2"><Switch id={`${line.key}-exposure`} checked={line.includeInExposure} onCheckedChange={(checked) => updateLine(line.key, { includeInExposure: checked })} /><Label htmlFor={`${line.key}-exposure`}>Incluir en exposición financiera</Label></div>
                  </fieldset>
                ))}
                <Button type="button" variant="outline" className="gap-2" onClick={() => setDraft({ ...draft, lines: [...draft.lines, createTemplateLineDraft()] })}><Plus className="size-4" aria-hidden="true" />Agregar partida</Button>
              </fieldset>
              {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" disabled={busy} onClick={() => setDraft(null)}>Cancelar</Button>
                <Button type="submit" disabled={busy || !canEdit}>{busy ? 'Guardando...' : 'Guardar plantilla'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => { if (!open && !busy) setArchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Archivar plantilla</AlertDialogTitle><AlertDialogDescription>La plantilla «{archiveTarget?.name}» dejará de estar disponible para nuevos proyectos. Las partidas ya aplicadas se conservarán. Puedes reactivarla después.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busy || !canEdit} onClick={(event) => { event.preventDefault(); if (archiveTarget) void setArchived(archiveTarget, true); }}>{busy ? 'Archivando...' : 'Archivar plantilla'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
