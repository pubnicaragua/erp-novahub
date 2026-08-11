import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Combobox } from '../ui/Combobox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { RefreshCw, Calculator } from 'lucide-react';
import { contabilidadService } from '../../services/contabilidad.service';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';
import { useCurrency } from '../../contexts/CurrencyContext';
import { toast } from 'sonner';

interface AssetSummary {
  id: string;
  code: string;
  name: string;
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

export function ActivosFijosDepreciationTab() {
  const queryClient = useQueryClient();
  const { baseCurrency, formatConvertedAmount } = useCurrency();
  const [selectedId, setSelectedId] = useState('');
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [processing, setProcessing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const assetsQuery = useAccountingQuery<AssetSummary[]>(['fixed-asset-details'], async (signal) =>
    accountingList(await contabilidadService.getFixedAssetsDetail(signal)) as AssetSummary[],
  );
  const assets = assetsQuery.data || [];
  const loading = assetsQuery.isLoading || assetsQuery.isFetching;

  const assetOptions = useMemo(() =>
    assets.map((a) => ({ label: `${a.code} · ${a.name}`, value: a.id, description: a.category?.name })),
    [assets],
  );

  const detailQuery = useAccountingQuery<any>(
    ['fixed-asset-detail', selectedId],
    async (signal) => (selectedId ? contabilidadService.getFixedAssetDetail(selectedId, signal) : null),
    { enabled: !!selectedId },
  );
  const detail = detailQuery.data;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['accounting'] });
  const fmt = (value: number) => formatConvertedAmount(value, baseCurrency);


  async function handleGenerate() {
    if (!selectedId) { toast.error('Selecciona un activo'); return; }
    setGenerating(true);
    try {
      await contabilidadService.generateFixedAssetProjection(selectedId);
      toast.success('Proyección generada');
      await invalidate();
      detailQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || 'Error al generar proyección');
    } finally {
      setGenerating(false);
    }
  }

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
      if (skipped.length) {
        skipped.slice(0, 5).forEach((s: string) => toast.info(s));
      }
      await invalidate();
      assetsQuery.refetch();
      detailQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar depreciación');
    } finally {
      setProcessing(false);
    }
  }

  const derived = detail?.derived;
  const projection: ProjectionRow[] = detail?.projection || [];
  const processedCount = projection.filter((p) => p.status === 'PROCESSED').length;

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
            <div className="flex min-w-0 flex-col gap-2 sm:w-72 sm:flex-row sm:items-center sm:gap-3">
              <span className="shrink-0">Activo</span>
              <Combobox
                options={assetOptions}
                value={selectedId}
                onChange={setSelectedId}
                placeholder={loading ? 'Cargando activos...' : 'Seleccionar activo'}
                emptyMessage="Sin activos registrados"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating || !selectedId} className="h-8 gap-1.5">
                <RefreshCw className={generating ? 'size-3.5 animate-spin' : 'size-3.5'} /> Generar proyección
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!detail ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Calculator className="size-10 mb-2 opacity-30" />
              <p className="text-sm font-medium">Selecciona un activo para ver su depreciación</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <MiniStat label="Costo de adquisición" value={fmt(derived?.cost ?? 0)} />
                <MiniStat label="Base depreciable" value={fmt(derived?.base ?? 0)} />
                <MiniStat label="Depreciación mensual" value={fmt(derived?.monthly ?? 0)} />
                <MiniStat label="Depreciación anual" value={fmt(derived?.annual ?? 0)} />
                <MiniStat label="Dep. acumulada" value={fmt(derived?.accumulated ?? 0)} tone="emerald" />
                <MiniStat label="Valor en libros" value={fmt(derived?.bookValue ?? 0)} tone="primary" />
                <MiniStat label="Meses transcurridos" value={`${derived?.monthsElapsed ?? 0}`} />
                <MiniStat label="Meses pendientes" value={`${derived?.monthsRemaining ?? 0}`} />
              </div>
              <div>
                <p className="mb-1 text-xs font-black tracking-tight uppercase italic text-muted-foreground">
                  Proyección de depreciación ({projection.length} períodos · {processedCount} procesados)
                </p>
                {projection.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/40 py-8 text-center text-sm text-muted-foreground">
                    No hay proyección. Pulsa "Generar proyección".
                  </div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto rounded-xl border border-border/40">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0">
                        <TableRow className="hover:bg-transparent border-border/50">
                          <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Período</TableHead>
                          <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Depreciación</TableHead>
                          <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Acumulada</TableHead>
                          <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Valor en libros</TableHead>
                          <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projection.map((row) => (
                          <TableRow key={row.id} className="hover:bg-muted/30 border-border/30">
                            <TableCell className="font-mono text-xs">{row.period}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{fmt(row.depreciationAmount)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{fmt(row.accumulatedDepreciation)}</TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold">{fmt(row.bookValue)}</TableCell>
                            <TableCell>
                              <Badge variant={row.status === 'PROCESSED' ? 'default' : 'secondary'} className="text-[10px]">
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
    <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 text-base font-black ${color}`}>{value}</p>
    </div>
  );
}
