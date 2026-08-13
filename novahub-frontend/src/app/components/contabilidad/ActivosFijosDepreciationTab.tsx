import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { RefreshCw, Calculator, ChevronDown, ChevronUp, Loader2, Search } from 'lucide-react';
import { cn } from '../ui/utils';
import { Input } from '../ui/input';
import { contabilidadService } from '../../services/contabilidad.service';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';
import { useCurrency } from '../../contexts/CurrencyContext';
import { toast } from 'sonner';

interface AssetSummary {
  id: string;
  code: string;
  name: string;
  status?: string;
  category?: { id: string; name: string; depreciable: boolean };
  derived?: any;
}

interface ProjectionRow {
  id: string;
  period: string;
  depreciationAmount: number;
  accumulatedDepreciation: number;
  bookValue: number;
  status: 'PENDING' | 'PROCESSED';
  processedAt?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  DEPRECIATED: 'Depreciado',
  INACTIVE: 'Inactivo',
  RETIRED: 'Retirado',
};

export function ActivosFijosDepreciationTab() {
  const queryClient = useQueryClient();
  const { baseCurrency, formatConvertedAmount } = useCurrency();
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [processing, setProcessing] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<Record<string, any>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const assetsQuery = useAccountingQuery<AssetSummary[]>(['fixed-asset-details'], async (signal) =>
    accountingList(await contabilidadService.getFixedAssetsDetail(signal)) as AssetSummary[],
  );
  const assets = assetsQuery.data || [];
  const loading = assetsQuery.isLoading || assetsQuery.isFetching;

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return assets;
    const q = searchTerm.trim().toLowerCase();
    return assets.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.code.toLowerCase().includes(q) ||
      (a.category?.name || '').toLowerCase().includes(q),
    );
  }, [assets, searchTerm]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['accounting'] });
  const fmt = (value: number) => formatConvertedAmount(value, baseCurrency);

  async function handleProcess() {
    if (!period) { toast.error('Selecciona un período'); return; }
    setProcessing(true);
    try {
      const res = await contabilidadService.processFixedAssetDepreciation(period);
      const skipped = Array.isArray(res?.skipped) ? res.skipped : [];
      toast.success(`Depreciación procesada: ${res?.processed ?? 0} activos (${skipped.length} omitidos)`);
      if (res?.errors?.length) {
        res.errors.slice(0, 5).forEach((e: string) => toast.error(e));
      }
      if (skipped.length) skipped.slice(0, 5).forEach((s: string) => toast.info(s));
      await invalidate();
      assetsQuery.refetch();
      setDetailMap({});
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar depreciación');
    } finally {
      setProcessing(false);
    }
  }

  async function handleGenerate(id: string) {
    setGeneratingId(id);
    try {
      await contabilidadService.generateFixedAssetProjection(id);
      toast.success('Proyección generada');
      await invalidate();
      assetsQuery.refetch();
      setDetailMap(prev => { const next = { ...prev }; delete next[id]; return next; });
    } catch (err: any) {
      toast.error(err.message || 'Error al generar proyección');
    } finally {
      setGeneratingId(null);
    }
  }

  async function toggleDetail(asset: AssetSummary) {
    if (expandedId === asset.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(asset.id);
    if (!detailMap[asset.id]) {
      setLoadingDetail(asset.id);
      try {
        const detail = await contabilidadService.getFixedAssetDetail(asset.id);
        setDetailMap(prev => ({ ...prev, [asset.id]: detail }));
      } catch (e: any) {
        toast.error(e?.message || 'Error al cargar el detalle del activo');
      } finally {
        setLoadingDetail(null);
      }
    }
  }

  const totals = useMemo(() => {
    const sum = (key: string) => assets.reduce((s, a) => s + Number(a.derived?.[key] || 0), 0);
    return {
      count: assets.length,
      cost: sum('cost'),
      monthly: sum('monthly'),
      accumulated: sum('accumulated'),
      bookValue: sum('bookValue'),
    };
  }, [assets]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-lg font-bold">
            <span className="font-black tracking-tight uppercase italic">Procesar Depreciación por Período</span>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="dep-period" className="text-xs">Período</Label>
                <input
                  id="dep-period"
                  type="month"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                />
              </div>
              <Button size="sm" onClick={handleProcess} disabled={processing || !period} className="h-8 gap-1.5">
                <Calculator className="size-3.5" /> {processing ? 'Procesando...' : 'Procesar Depreciación'}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base font-bold">
            <span className="font-black tracking-tight uppercase italic">
              Depreciación de Todos los Activos
            </span>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                placeholder="Buscar activo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 w-56 pl-8 text-xs"
              />
            </div>
          </CardTitle>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {totals.count} activos · Costo {fmt(totals.cost)} · Dep. mensual {fmt(totals.monthly)} · Dep. acumulada {fmt(totals.accumulated)} · Valor en libros {fmt(totals.bookValue)}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Cargando activos fijos...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground">
              {assets.length === 0 ? 'No hay activos fijos registrados.' : 'Sin resultados para la búsqueda.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Activo</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Categoría</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Costo</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Dep. mensual</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Dep. acumulada</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Valor en libros</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Meses restantes</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(asset => {
                    const d = asset.derived || {};
                    const expanded = expandedId === asset.id;
                    const detail = detailMap[asset.id];
                    const projection: ProjectionRow[] = detail?.projection || [];
                    const processedCount = projection.filter(p => p.status === 'PROCESSED').length;
                    return (
                      <>
                        <TableRow
                          key={asset.id}
                          className={cn('cursor-pointer border-border/30 hover:bg-muted/30', expanded && 'bg-muted/40')}
                          onClick={() => toggleDetail(asset)}
                        >
                          <TableCell className="py-2.5">
                            {loadingDetail === asset.id ? (
                              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                            ) : (
                              <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform duration-200', expanded && 'rotate-180')} />
                            )}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <span className="text-xs font-bold">{asset.name}</span>
                            <p className="text-[9px] font-mono text-muted-foreground">{asset.code}</p>
                          </TableCell>
                          <TableCell className="py-2.5 text-xs">{asset.category?.name || '—'}</TableCell>
                          <TableCell className="py-2.5 text-right text-xs tabular-nums">{fmt(Number(d.cost || 0))}</TableCell>
                          <TableCell className="py-2.5 text-right text-xs tabular-nums">{fmt(Number(d.monthly || 0))}</TableCell>
                          <TableCell className="py-2.5 text-right text-xs tabular-nums text-amber-600">{fmt(Number(d.accumulated || 0))}</TableCell>
                          <TableCell className="py-2.5 text-right text-xs font-bold tabular-nums text-primary">{fmt(Number(d.bookValue || 0))}</TableCell>
                          <TableCell className="py-2.5 text-right text-xs tabular-nums">{d.monthsRemaining ?? '—'}</TableCell>
                          <TableCell className="py-2.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[9px] font-black uppercase tracking-widest px-2 py-0.5',
                                asset.status === 'DEPRECIATED'
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                  : 'bg-blue-500/10 text-blue-600 border-blue-500/20',
                              )}
                            >
                              {STATUS_LABELS[asset.status || ''] || asset.status || 'Activo'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        {expanded && (
                          <TableRow key={`${asset.id}-detail`}>
                            <TableCell colSpan={9} className="p-0">
                              <div className="rounded-xl border border-border/40 bg-muted/10 m-2 p-3">
                                {!detail ? (
                                  <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                                    <Loader2 className="size-3.5 animate-spin" /> Cargando detalle...
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                                      <MiniStat label="Costo" value={fmt(Number(d.cost || 0))} />
                                      <MiniStat label="Base dep." value={fmt(Number(d.base || 0))} />
                                      <MiniStat label="Dep. mensual" value={fmt(Number(d.monthly || 0))} />
                                      <MiniStat label="Dep. anual" value={fmt(Number(d.annual || 0))} />
                                      <MiniStat label="Dep. acum." value={fmt(Number(d.accumulated || 0))} tone="emerald" />
                                      <MiniStat label="Valor en libros" value={fmt(Number(d.bookValue || 0))} tone="primary" />
                                      <MiniStat label="Meses trans." value={`${d.monthsElapsed ?? 0}`} />
                                      <MiniStat label="Meses rest." value={`${d.monthsRemaining ?? 0}`} />
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                        Proyección ({projection.length} períodos · {processedCount} procesados)
                                      </p>
                                      <Button variant="outline" size="sm" onClick={() => handleGenerate(asset.id)} disabled={generatingId === asset.id} className="h-7 gap-1.5">
                                        <RefreshCw className={generatingId === asset.id ? 'size-3 animate-spin' : 'size-3'} /> Generar proyección
                                      </Button>
                                    </div>
                                    {projection.length === 0 ? (
                                      <div className="rounded-xl border border-dashed border-border/40 py-4 text-center text-xs text-muted-foreground">
                                        No hay proyección. Pulsa "Generar proyección".
                                      </div>
                                    ) : (
                                      <div className="max-h-[320px] overflow-y-auto rounded-xl border border-border/40">
                                        <Table>
                                          <TableHeader className="bg-muted/50 sticky top-0">
                                            <TableRow className="hover:bg-transparent border-border/50">
                                              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Período</TableHead>
                                              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Depreciación</TableHead>
                                              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Acumulada</TableHead>
                                              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Valor en libros</TableHead>
                                              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estado</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {projection.map(row => (
                                              <TableRow key={row.id} className="hover:bg-muted/30 border-border/30">
                                                <TableCell className="font-mono text-xs">{row.period}</TableCell>
                                                <TableCell className="text-right font-mono text-xs">{fmt(row.depreciationAmount)}</TableCell>
                                                <TableCell className="text-right font-mono text-xs">{fmt(row.accumulatedDepreciation)}</TableCell>
                                                <TableCell className="text-right font-mono text-xs font-bold">{fmt(row.bookValue)}</TableCell>
                                                <TableCell>
                                                  <Badge variant={row.status === 'PROCESSED' ? 'default' : 'secondary'} className="text-[9px]">
                                                    {row.status === 'PROCESSED' ? 'Procesado' : 'Pendiente'}
                                                  </Badge>
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'primary' | 'emerald' }) {
  const color = tone === 'emerald' ? 'text-emerald-600' : tone === 'primary' ? 'text-primary' : '';
  return (
    <div className="rounded-xl border border-border/40 bg-background/60 p-2.5">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-sm font-black', color)}>{value}</p>
    </div>
  );
}
