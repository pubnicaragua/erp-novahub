import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Plus, Search, RefreshCw, DollarSign, Package, Tags, Calculator, Upload, LayoutGrid, X, FileSpreadsheet, Download, Loader2 } from 'lucide-react';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';
import { fetchFixedAssetDetails, exportFixedAssetsExcel } from './fixedAssetsExport';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ActivosFijosCategoriesTab } from './ActivosFijosCategoriesTab';
import { ActivosFijosDepreciationTab } from './ActivosFijosDepreciationTab';
import { ActivosFijosImportTab } from './ActivosFijosImportTab';
import { ActivoFormDialog } from './ActivoFormDialog';

interface FixedAsset {
  id: string;
  code: string;
  name: string;
  status: string;
  currency?: string;
  exchangeRate?: number;
  category?: { name: string };
  derived?: {
    cost: number;
    accumulated: number;
    bookValue: number;
  };
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  DEPRECIATED: 'Depreciado',
  DISPOSED: 'Baja',
};

export function ActivosFijosView() {
  const { canPerform } = useAuth();
  const { displayCurrency, formatConvertedAmount, convertAmount, toBaseAmount, baseCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  const detailQuery = useAccountingQuery<any>(
    ['fixed-asset-detail', selectedAssetId],
    async (signal) => (selectedAssetId ? contabilidadService.getFixedAssetDetail(selectedAssetId, signal) : null),
    { enabled: !!selectedAssetId },
  );
  const detail = detailQuery.data;
  const detailLoading = detailQuery.isLoading || detailQuery.isFetching;

  const assetsQuery = useAccountingQuery<FixedAsset[]>(['fixed-assets'], async (signal) =>
    accountingList(await contabilidadService.getFixedAssetsDetail(signal)) as FixedAsset[],
  );
  const assets = assetsQuery.data || [];
  const loading = assetsQuery.isLoading || assetsQuery.isFetching;
  const loadAssets = () => assetsQuery.refetch();

  const filtered = assets.filter((a) =>
    !searchTerm ||
    a.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.category?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAcquisition = filtered.reduce((s, a) => s + convertAmount(a.derived?.cost ?? 0, a.currency, a.exchangeRate), 0);
  const totalBookValue = filtered.reduce((s, a) => s + convertAmount(a.derived?.bookValue ?? 0, a.currency, a.exchangeRate), 0);
  const formatCurrency = (value: number, sourceCurrency?: string, sourceRate?: number) => formatConvertedAmount(value, sourceCurrency, sourceRate);

  function handleCreated() {
    queryClient.invalidateQueries({ queryKey: ['accounting'] });
    assetsQuery.refetch();
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(a => a.id));
    }
  };

  async function handleExport(scope: 'all' | 'selected') {
    const ids = scope === 'selected' ? selectedIds : assets.map(a => a.id);
    if (ids.length === 0) { toast.error(scope === 'selected' ? 'No hay activos seleccionados' : 'No hay activos para exportar'); return; }
    setExporting(true);
    try {
      const details = await fetchFixedAssetDetails(ids);
      exportFixedAssetsExcel(details, { toBase: toBaseAmount, baseCurrency });
      toast.success(`Exportados ${details.length} activo${details.length !== 1 ? 's' : ''}`);
    } catch (err: any) {
      toast.error(err.message || 'Error al exportar activos');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <Tabs defaultValue="activos">
        <TabsList className="flex h-auto w-full flex-wrap gap-1.5 rounded-2xl border border-border/40 bg-muted/40 p-1.5">
          <TabsTrigger value="activos"><LayoutGrid className="size-4 mr-1.5" /> Activos</TabsTrigger>
          <TabsTrigger value="categorias"><Tags className="size-4 mr-1.5" /> Categorías y Depreciación</TabsTrigger>
          <TabsTrigger value="depreciacion"><Calculator className="size-4 mr-1.5" /> Depreciación</TabsTrigger>
          <TabsTrigger value="importar"><Upload className="size-4 mr-1.5" /> Importar Activos</TabsTrigger>
        </TabsList>
        <TabsContent value="activos" className="m-0 mt-4 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase italic">
            Activos <span className="text-primary">Fijos</span>
          </h2>
        </div>
        <div className="erp-toolbar-primary-group flex flex-wrap items-center gap-2">
          {selectedIds.length > 0 && (
            <Badge variant="outline" className="h-8 border-primary/30 bg-primary/10 text-[10px] font-black uppercase tracking-widest text-primary">
              {selectedIds.length} seleccionado{selectedIds.length !== 1 ? 's' : ''}
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={exporting || assets.length === 0} className="gap-2">
                {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
                {exporting ? 'Exportando...' : 'Exportar'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuLabel className="text-xs">Exportar activos fijos</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport('all')} disabled={exporting || assets.length === 0} className="cursor-pointer gap-2 text-xs">
                <Download className="size-3.5" /> Exportar todos ({assets.length})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('selected')} disabled={exporting || selectedIds.length === 0} className="cursor-pointer gap-2 text-xs">
                <Download className="size-3.5" /> Exportar seleccionados ({selectedIds.length})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canPerform('ACCOUNTING_ASSETS', 'create') && (
            <Button className="gap-2" data-toolbar-role="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Nuevo Activo Fijo
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Package className="size-3.5" /> Total Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black">{assets.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <DollarSign className="size-3.5" /> Costo Adquisición
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-emerald-600">{formatCurrency(totalAcquisition, displayCurrency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <DollarSign className="size-3.5" /> Valor en Libros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-primary">{formatCurrency(totalBookValue, displayCurrency)}</p>
          </CardContent>
        </Card>
      </div>

      <div className={cn("grid grid-cols-1 gap-6 items-start mt-6", selectedAssetId ? "lg:grid-cols-[1.2fr_0.8fr]" : "lg:grid-cols-1")}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-lg font-bold">
              <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                <span className="font-black tracking-tight uppercase italic">Activos Fijos Registrados</span>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 w-full pl-9 text-xs sm:w-[200px]"
                  />
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={loadAssets} disabled={loading} className="h-8">
                <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Search className="size-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">No hay activos fijos</p>
                <p className="text-xs mt-1">Registra un nuevo activo para comenzar</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="hover:bg-transparent border-border/50">
                        <TableHead className="w-8">
                          <Checkbox
                            checked={filtered.length > 0 && selectedIds.length === filtered.length}
                            onCheckedChange={toggleSelectAll}
                            title="Seleccionar todos los activos visibles"
                            aria-label="Seleccionar todos los activos visibles"
                          />
                        </TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Código</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Nombre del Activo</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Categoría</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Costo</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Dep. Acumulada</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Valor en Libros</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((asset) => {
                        const isSelected = selectedAssetId === asset.id;
                        return (
                          <TableRow
                            key={asset.id}
                            onClick={() => setSelectedAssetId(isSelected ? null : asset.id)}
                            className={cn(
                              "hover:bg-muted/30 border-border/30 cursor-pointer transition-colors",
                              isSelected && "bg-muted/50 hover:bg-muted/50 font-semibold"
                            )}
                          >
                            <TableCell className="py-2">
                              <Checkbox
                                checked={selectedIds.includes(asset.id)}
                                onCheckedChange={() => toggleSelect(asset.id)}
                                onClick={(e) => e.stopPropagation()}
                                title="Marcar para exportar"
                                aria-label={`Seleccionar ${asset.name}`}
                                className="align-middle"
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs">{asset.code || '—'}</TableCell>
                            <TableCell className="font-medium text-xs">{asset.name}</TableCell>
                            <TableCell className="text-xs">{asset.category?.name || '—'}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatCurrency(asset.derived?.cost ?? 0, asset.currency, asset.exchangeRate)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatCurrency(asset.derived?.accumulated ?? 0, asset.currency, asset.exchangeRate)}</TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold text-emerald-600">{formatCurrency(asset.derived?.bookValue ?? 0, asset.currency, asset.exchangeRate)}</TableCell>
                            <TableCell>
                              <Badge variant={asset.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[10px] font-bold">
                                {STATUS_LABELS[asset.status] || asset.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="space-y-2 p-3 md:hidden">
                  {filtered.map((asset) => {
                    const isSelected = selectedAssetId === asset.id;
                    return (
                      <div
                        key={asset.id}
                        onClick={() => setSelectedAssetId(isSelected ? null : asset.id)}
                        className={cn(
                          "min-w-0 rounded-xl border border-border/30 bg-muted/20 p-3 cursor-pointer transition-all",
                          isSelected && "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                        )}
                      >
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-mono text-muted-foreground">{asset.code || '—'}</p>
                            <p className="break-words text-xs font-bold">{asset.name}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Checkbox
                              checked={selectedIds.includes(asset.id)}
                              onCheckedChange={() => toggleSelect(asset.id)}
                              onClick={(e) => e.stopPropagation()}
                              title="Marcar para exportar"
                              aria-label={`Seleccionar ${asset.name}`}
                            />
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              {STATUS_LABELS[asset.status] || asset.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/20 pt-2 text-[10px]">
                          <div>
                            <span className="block text-muted-foreground">Costo</span>
                            <span className="font-mono">{formatCurrency(asset.derived?.cost ?? 0, asset.currency, asset.exchangeRate)}</span>
                          </div>
                          <div>
                            <span className="block text-muted-foreground">Dep. acum.</span>
                            <span className="font-mono">{formatCurrency(asset.derived?.accumulated ?? 0, asset.currency, asset.exchangeRate)}</span>
                          </div>
                          <div>
                            <span className="block text-muted-foreground">Valor libros</span>
                            <span className="font-bold text-emerald-600">{formatCurrency(asset.derived?.bookValue ?? 0, asset.currency, asset.exchangeRate)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
          {filtered.length > 0 && (
            <div className="px-6 py-3 flex items-center justify-between bg-muted/20 border-t border-border/50 rounded-b-2xl text-xs font-bold">
              <span className="uppercase tracking-wider text-muted-foreground">{filtered.length} activos</span>
              <div className="flex items-center gap-6">
                <span className="text-muted-foreground">Costo Total: <span className="text-foreground">{formatCurrency(totalAcquisition, displayCurrency)}</span></span>
                <span className="text-muted-foreground">Valor en Libros: <span className="text-emerald-600">{formatCurrency(totalBookValue, displayCurrency)}</span></span>
              </div>
            </div>
          )}
        </Card>

        {selectedAssetId && (
          <div className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start space-y-4">
            <Card className="overflow-hidden border-border/40 shadow-lg">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] font-black uppercase tracking-widest text-primary">Activo Seleccionado · {detail?.code || '—'}</p>
                    <h3 className="mt-1 truncate text-lg font-black tracking-tight uppercase italic" title={detail?.name}>{detail?.name || 'Cargando...'}</h3>
                    {detail?.category && (
                      <Badge variant="outline" className="mt-1.5 text-[10px] font-bold">
                        {detail.category.name}
                      </Badge>
                    )}
                  </div>
                  <Button variant="outline" size="icon" className="size-8 rounded-full shrink-0" onClick={() => setSelectedAssetId(null)}>
                    <X className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-5 max-h-[calc(100vh-12rem)] overflow-y-auto">
                {detailLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <RefreshCw className="size-8 animate-spin text-primary" />
                    <p className="text-xs font-semibold mt-2">Cargando detalles...</p>
                  </div>
                ) : !detail ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No se pudo cargar la información del activo.
                  </div>
                ) : (
                  <>
                    {/* Ficha Técnica */}
                    <div className="space-y-2.5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ficha Técnica</p>
                      <div className="grid grid-cols-2 gap-2 text-xs rounded-xl border border-border/30 bg-muted/10 p-3">
                        <div><span className="block text-[10px] text-muted-foreground font-semibold">Marca</span><span className="font-medium">{detail.brand || '—'}</span></div>
                        <div><span className="block text-[10px] text-muted-foreground font-semibold">Modelo</span><span className="font-medium">{detail.model || '—'}</span></div>
                        <div><span className="block text-[10px] text-muted-foreground font-semibold">No. Serie</span><span className="font-medium">{detail.serialNumber || '—'}</span></div>
                        <div><span className="block text-[10px] text-muted-foreground font-semibold">Ubicación</span><span className="font-medium">{detail.location || '—'}</span></div>
                        <div className="col-span-2 border-t border-border/20 pt-1.5 mt-0.5">
                          <span className="block text-[10px] text-muted-foreground font-semibold">Responsable</span><span className="font-medium">{typeof detail.responsible === 'string' ? detail.responsible : detail.responsible?.name || detail.responsibleText || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Fechas y Adquisición */}
                    <div className="space-y-2.5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fechas y Documentación</p>
                      <div className="grid grid-cols-2 gap-2 text-xs rounded-xl border border-border/30 bg-muted/10 p-3">
                        <div><span className="block text-[10px] text-muted-foreground font-semibold">No. Factura</span><span className="font-medium">{detail.invoiceNumber || '—'}</span></div>
                        <div><span className="block text-[10px] text-muted-foreground font-semibold">Moneda</span><span className="font-medium">{detail.currency} (TC: {detail.exchangeRate})</span></div>
                        <div><span className="block text-[10px] text-muted-foreground font-semibold">Adquisición</span><span className="font-medium">{detail.acquisitionDate ? new Date(detail.acquisitionDate).toLocaleDateString('es-NI') : '—'}</span></div>
                        <div><span className="block text-[10px] text-muted-foreground font-semibold">Puesta en uso</span><span className="font-medium">{detail.inUseDate ? new Date(detail.inUseDate).toLocaleDateString('es-NI') : '—'}</span></div>
                      </div>
                    </div>

                    {/* Resumen Financiero */}
                    <div className="space-y-2.5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resumen Financiero</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-border/40 bg-muted/20 p-2.5">
                          <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Costo Adquisición</p>
                          <p className="mt-0.5 text-sm font-black">{formatCurrency(detail.derived?.cost ?? 0, detail.currency, detail.exchangeRate)}</p>
                        </div>
                        <div className="rounded-xl border border-border/40 bg-muted/20 p-2.5">
                          <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Valor Residual</p>
                          <p className="mt-0.5 text-sm font-black">{formatCurrency(detail.residualValue ?? 0, detail.currency, detail.exchangeRate)}</p>
                        </div>
                        <div className="rounded-xl border border-border/40 bg-muted/20 p-2.5">
                          <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Dep. Acumulada</p>
                          <p className="mt-0.5 text-sm font-black text-emerald-600">{formatCurrency(detail.derived?.accumulated ?? 0, detail.currency, detail.exchangeRate)}</p>
                        </div>
                        <div className="rounded-xl border border-border/40 bg-muted/20 p-2.5">
                          <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Dep. Mensual</p>
                          <p className="mt-0.5 text-sm font-black">{formatCurrency(detail.derived?.monthly ?? 0, detail.currency, detail.exchangeRate)}</p>
                        </div>
                        <div className="rounded-xl border border-border/40 bg-muted/20 p-2.5">
                          <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Dep. Acumulada Inicial</p>
                          <p className="mt-0.5 text-sm font-black">{formatCurrency(detail.initialAccumDepreciation ?? 0, detail.currency, detail.exchangeRate)}</p>
                        </div>
                        <div className="rounded-xl border border-border/40 bg-muted/20 p-2.5">
                          <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Valor en Libros</p>
                          <p className="mt-0.5 text-sm font-black text-primary">{formatCurrency(detail.derived?.bookValue ?? 0, detail.currency, detail.exchangeRate)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Tabla de Proyección */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Proyección e Historial de Depreciación
                      </p>
                      {(!detail.projection || detail.projection.length === 0) ? (
                        <div className="rounded-xl border border-dashed border-border/40 py-6 text-center text-xs text-muted-foreground">
                          No hay proyección generada para este activo.
                        </div>
                      ) : (
                        <div className="max-h-[260px] overflow-y-auto rounded-xl border border-border/30">
                          <Table>
                            <TableHeader className="bg-muted/50 sticky top-0">
                              <TableRow className="hover:bg-transparent border-border/50">
                                <TableHead className="text-[9px] py-2 font-bold uppercase tracking-wider text-muted-foreground">Período</TableHead>
                                <TableHead className="text-[9px] py-2 font-bold uppercase tracking-wider text-muted-foreground text-right">Depreciación</TableHead>
                                <TableHead className="text-[9px] py-2 font-bold uppercase tracking-wider text-muted-foreground text-right">En libros</TableHead>
                                <TableHead className="text-[9px] py-2 font-bold uppercase tracking-wider text-muted-foreground">Estado</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {detail.projection.map((row: any) => (
                                <TableRow key={row.id} className="hover:bg-muted/30 border-border/20">
                                  <TableCell className="font-mono text-[11px] py-1.5">{row.period}</TableCell>
                                  <TableCell className="text-right font-mono text-[11px] py-1.5">{formatCurrency(row.depreciationAmount, detail.currency, detail.exchangeRate)}</TableCell>
                                  <TableCell className="text-right font-mono text-[11px] py-1.5 font-bold">{formatCurrency(row.bookValue, detail.currency, detail.exchangeRate)}</TableCell>
                                  <TableCell className="py-1.5">
                                    <Badge variant={row.status === 'PROCESSED' ? 'default' : 'secondary'} className="text-[8px] px-1 py-0 h-4">
                                      {row.status === 'PROCESSED' ? 'Sí' : 'No'}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <ActivoFormDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={handleCreated} />
        </TabsContent>
        <TabsContent value="categorias" className="m-0 mt-4">
          <ActivosFijosCategoriesTab />
        </TabsContent>
        <TabsContent value="depreciacion" className="m-0 mt-4">
          <ActivosFijosDepreciationTab />
        </TabsContent>
        <TabsContent value="importar" className="m-0 mt-4">
          <ActivosFijosImportTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
