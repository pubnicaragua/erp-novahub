import { useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, ArrowLeftRight, BookOpenCheck, CheckCircle2, FileCheck2, Info, Loader2, RefreshCw, RotateCcw, Save, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { contabilidadService } from '../../services/contabilidad.service';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';
import { useAuth } from '../../contexts/AuthContext';

type RevaluationPreview = {
  asOfDate: string;
  baseCurrency: string;
  foreignCurrency: string;
  valuationRate: number;
  rateSource: string;
  status: string;
  totals: {
    unrealizedGain: number;
    unrealizedLoss: number;
    net: number;
    itemCount: number;
    missingHistoricalRateCount: number;
  };
  items: Array<{
    sourceType: 'RECEIVABLE' | 'PAYABLE';
    sourceId: string;
    documentNumber: string;
    partyName: string | null;
    documentDate: string;
    dueDate: string | null;
    currency: string;
    balance: number;
    historicalRate: number;
    historicalBaseAmount: number;
    valuationRate: number;
    valuationBaseAmount: number;
    difference: number;
    economicEffect: 'GAIN' | 'LOSS' | 'NEUTRAL';
    rateStatus: 'STORED' | 'MISSING_OR_INVALID';
    status: string;
  }>;
};

type RevaluationRun = {
  id: string;
  status: 'PREVIEW' | 'DRAFT' | 'POSTED' | string;
  asOfDate: string;
  valuationRate: number;
  baseCurrency?: string;
  totalUnrealizedGain?: number;
  totalUnrealizedLoss?: number;
  itemCount?: number;
  rateSource?: string;
  createdAt?: string;
  journal?: { id: string; number: string; status: string } | null;
  reversal?: { id: string; number: string; status: string } | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value: number, currency: string) {
  const symbol = currency === 'USD' ? '$' : 'C$';
  return `${symbol} ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-NI');
}

export function DiferenciasCambiariasView() {
  const { canPerform } = useAuth();
  const canCreate = canPerform('ACCOUNTING', 'create');
  const canApprove = canPerform('ACCOUNTING_EXCHANGE_DIFFERENCES', 'approve');
  const [asOfDate, setAsOfDate] = useState(today());
  const [rateInput, setRateInput] = useState('');
  const [appliedAsOfDate, setAppliedAsOfDate] = useState(today());
  const [appliedRate, setAppliedRate] = useState('');
  const [run, setRun] = useState<RevaluationRun | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const previewQuery = useAccountingQuery<RevaluationPreview>(
    ['exchange-differences', appliedAsOfDate, appliedRate],
    async signal => accountingServiceResult(
      await contabilidadService.getExchangeDifferencesPreview(
        {
          asOfDate: appliedAsOfDate,
          ...(appliedRate ? { rate: Number(appliedRate) } : {}),
        },
        signal,
      ),
    ),
  );
  const historyQuery = useAccountingQuery<RevaluationRun[]>(
    ['exchange-differences-runs'],
    async signal => accountingList(await contabilidadService.getExchangeDifferencesRuns(20, signal)),
    { staleTime: 30_000 },
  );

  const preview = previewQuery.data;
  const items = accountingList(preview?.items) as RevaluationPreview['items'];
  const history = accountingList(historyQuery.data) as RevaluationRun[];
  const loading = previewQuery.isLoading || previewQuery.isFetching;

  const applyFilters = () => {
    setAppliedAsOfDate(asOfDate);
    setAppliedRate(rateInput.trim());
    setRun(null);
  };

  const unwrap = (response: any) => response?.data || response;
  const runFromResponse = (response: any): RevaluationRun | null => {
    const data = unwrap(response);
    if (!data) return null;
    if (data.run) return { ...data.run, journal: data.journal ?? null, reversal: data.reversal ?? null };
    return data;
  };

  const runAction = async (key: string, action: () => Promise<any>, successMessage: string) => {
    setActionLoading(key);
    try {
      const nextRun = runFromResponse(await action());
      if (nextRun) setRun(nextRun);
      await historyQuery.refetch();
      toast.success(successMessage);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo completar la acción cambiaria.');
    } finally {
      setActionLoading(null);
    }
  };

  const saveValuation = () => runAction(
    'save',
    () => {
      if (!canCreate) return Promise.resolve(null);
      return contabilidadService.saveExchangeDifferencesRun({
        asOfDate: appliedAsOfDate,
        ...(appliedRate ? { rate: Number(appliedRate) } : {}),
      });
    },
    'Valoración cambiaria guardada como ejecución auditable.',
  );

  const createDraftJournal = () => {
    if (!run || !canCreate) return;
    runAction('journal', () => contabilidadService.createExchangeDifferencesJournal(run.id), 'Asiento borrador creado. Revisa sus líneas antes de contabilizarlo.');
  };

  const postValuation = () => {
    if (!run || !canApprove || !window.confirm('¿Contabilizar la valoración cambiaria? Esta acción actualizará los saldos contables y no modifica las facturas ni los pagos.')) return;
    runAction('post', () => contabilidadService.postExchangeDifferencesRun(run.id), 'Valoración cambiaria contabilizada correctamente.');
  };

  const createReversal = () => {
    if (!run || !canCreate || !window.confirm('¿Crear el asiento borrador de reversión para el siguiente período? El borrador deberá revisarse y contabilizarse desde el Diario.')) return;
    runAction('reversal', () => contabilidadService.createExchangeDifferencesReversal(run.id), 'Borrador de reversión creado.');
  };

  return (
    <div className="min-w-0 space-y-5">
      <Card className="rounded-2xl border-primary/20 bg-primary/[0.04] shadow-sm">
        <CardContent className="flex min-w-0 flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ArrowLeftRight className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="font-black uppercase tracking-tight">Valoración cambiaria</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Consulta los saldos pendientes con su valor histórico y su equivalente a la tasa de corte. El asiento solo se crea y contabiliza cuando lo solicites.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit shrink-0 border-primary/30 bg-primary/10 text-primary">
            Control contable
          </Badge>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black uppercase tracking-wider">Parámetros de valoración</CardTitle>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="exchange-differences-date">Fecha de corte</Label>
            <Input id="exchange-differences-date" type="date" value={asOfDate} onChange={event => setAsOfDate(event.target.value)} className="max-w-full" />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="exchange-differences-rate">Tasa de corte opcional</Label>
            <Input id="exchange-differences-rate" type="number" min="0.00000001" step="0.00000001" placeholder="Usar configuración actual" value={rateInput} onChange={event => setRateInput(event.target.value)} className="max-w-full" />
            <p className="text-[11px] text-muted-foreground">1 USD = tasa en moneda base cuando la base es NIO.</p>
          </div>
          <Button type="button" onClick={applyFilters} disabled={!asOfDate || loading} className="gap-2 rounded-xl font-bold">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Actualizar vista
          </Button>
        </CardContent>
      </Card>

      {preview && (
        <>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Ganancia no realizada" value={formatMoney(preview.totals.unrealizedGain, preview.baseCurrency)} tone="gain" icon={<TrendingUp className="size-4" />} />
            <SummaryCard label="Pérdida no realizada" value={formatMoney(preview.totals.unrealizedLoss, preview.baseCurrency)} tone="loss" icon={<TrendingDown className="size-4" />} />
            <SummaryCard label="Neto cambiario" value={formatMoney(preview.totals.net, preview.baseCurrency)} tone={preview.totals.net >= 0 ? 'gain' : 'loss'} icon={<ArrowLeftRight className="size-4" />} />
            <SummaryCard label="Saldos valorados" value={String(preview.totals.itemCount)} tone="neutral" icon={<Info className="size-4" />} />
          </div>

          <Card className="rounded-2xl border-primary/20 bg-primary/[0.025] shadow-sm">
            <CardContent className="flex min-w-0 flex-col gap-4 p-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {run?.status === 'POSTED' ? <CheckCircle2 className="size-5" /> : <FileCheck2 className="size-5" />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black uppercase tracking-tight">Ciclo contable de la valoración</p>
                    <Badge variant="outline" className="text-[9px] uppercase tracking-wider">{run ? statusLabel(run.status) : 'No guardada'}</Badge>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Guarda el corte para conservar sus tasas y saldos; luego crea un borrador separado y contabilízalo cuando haya sido revisado.
                  </p>
                  {run?.journal && <p className="mt-1 text-[11px] text-muted-foreground">Asiento: <strong className="text-foreground">{run.journal.number}</strong> · {statusLabel(run.journal.status)}</p>}
                  {run?.reversal && <p className="text-[11px] text-muted-foreground">Reversión: <strong className="text-foreground">{run.reversal.number}</strong> · {statusLabel(run.reversal.status)}</p>}
                </div>
              </div>
              <div className="flex min-w-0 flex-wrap gap-2 xl:justify-end">
                {canCreate && <Button type="button" variant="outline" onClick={saveValuation} disabled={loading || Boolean(actionLoading)} className="gap-2 rounded-xl text-xs font-bold">
                  {actionLoading === 'save' ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Guardar valoración
                </Button>}
                {canCreate && <Button type="button" variant="outline" onClick={createDraftJournal} disabled={!run || run.status !== 'PREVIEW' || preview.totals.missingHistoricalRateCount > 0 || Boolean(actionLoading)} className="gap-2 rounded-xl text-xs font-bold">
                  {actionLoading === 'journal' ? <Loader2 className="size-4 animate-spin" /> : <BookOpenCheck className="size-4" />}
                  Crear asiento borrador
                </Button>}
                {canApprove && <Button type="button" onClick={postValuation} disabled={!run || run.status !== 'DRAFT' || Boolean(actionLoading)} className="gap-2 rounded-xl text-xs font-bold">
                  {actionLoading === 'post' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Contabilizar ajuste
                </Button>}
                {canCreate && <Button type="button" variant="ghost" onClick={createReversal} disabled={!run || run.status !== 'POSTED' || Boolean(run.reversal) || Boolean(actionLoading)} className="gap-2 rounded-xl text-xs font-bold">
                  {actionLoading === 'reversal' ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                  Crear reversión
                </Button>}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardContent className="flex min-w-0 flex-col gap-2 p-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>Base: <strong className="text-foreground">{preview.baseCurrency}</strong> · Tasa: <strong className="text-foreground">{preview.valuationRate}</strong> · Corte: <strong className="text-foreground">{formatDate(preview.asOfDate)}</strong></span>
              <span>Origen: <strong className="text-foreground">{preview.rateSource}</strong></span>
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card className="min-w-0 overflow-hidden rounded-2xl shadow-sm">
              <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-sm font-black uppercase tracking-wider">Histórico de valoraciones</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">Las ejecuciones son inmutables como evidencia del corte; los asientos vinculados se gestionan por separado.</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => historyQuery.refetch()} disabled={historyQuery.isFetching} className="w-fit gap-2 rounded-xl text-xs font-bold">
                  <RefreshCw className={`size-3.5 ${historyQuery.isFetching ? 'animate-spin' : ''}`} />
                  Actualizar histórico
                </Button>
              </CardHeader>
              <CardContent className="min-w-0 p-0">
                <div className="sales-responsive-table min-w-0 overflow-x-auto">
                  <table className="w-full min-w-[920px] text-sm">
                    <thead className="border-y border-border/40 bg-muted/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Corte</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Tasa</th>
                        <th className="px-4 py-3 text-right">Ganancia</th>
                        <th className="px-4 py-3 text-right">Pérdida</th>
                        <th className="px-4 py-3">Asiento</th>
                        <th className="px-4 py-3">Creada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {history.map(row => (
                        <tr key={row.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3">
                            <p className="font-bold">{formatDate(row.asOfDate)}</p>
                            <p className="text-[11px] text-muted-foreground">{row.itemCount ?? 0} saldo(s) · {row.rateSource || '—'}</p>
                          </td>
                          <td className="px-4 py-3"><Badge variant="outline" className="text-[9px] uppercase tracking-wider">{statusLabel(row.status)}</Badge></td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">{row.valuationRate} {row.baseCurrency || preview.baseCurrency}</td>
                          <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-600">{formatMoney(Number(row.totalUnrealizedGain || 0), row.baseCurrency || preview.baseCurrency)}</td>
                          <td className="px-4 py-3 text-right font-bold tabular-nums text-red-600">{formatMoney(Number(row.totalUnrealizedLoss || 0), row.baseCurrency || preview.baseCurrency)}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{row.journal ? `${row.journal.number} · ${statusLabel(row.journal.status)}` : 'Sin asiento'}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(row.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {preview.totals.missingHistoricalRateCount > 0 && (
            <Card className="rounded-2xl border-amber-500/30 bg-amber-500/[0.06] shadow-sm">
              <CardContent className="flex gap-3 p-4 text-xs text-amber-800 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>Hay {preview.totals.missingHistoricalRateCount} saldo(s) con tasa histórica ausente o inválida. Se muestran para revisión, pero no deben registrarse como ajuste automático hasta corregir su origen.</p>
              </CardContent>
            </Card>
          )}

          <Card className="min-w-0 overflow-hidden rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black uppercase tracking-wider">Detalle de saldos abiertos</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 p-0">
              {items.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No hay cuentas por cobrar o pagar en moneda extranjera pendientes de valoración.</div>
              ) : (
                <div className="sales-responsive-table min-w-0 overflow-x-auto">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="border-y border-border/40 bg-muted/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Tipo / documento</th>
                        <th className="px-4 py-3">Tercero</th>
                        <th className="px-4 py-3">Vencimiento</th>
                        <th className="px-4 py-3 text-right">Saldo original</th>
                        <th className="px-4 py-3 text-right">Histórico</th>
                        <th className="px-4 py-3 text-right">Actual</th>
                        <th className="px-4 py-3 text-right">Diferencia</th>
                        <th className="px-4 py-3">Efecto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {items.map(item => (
                        <tr key={`${item.sourceType}-${item.sourceId}`} className="align-middle hover:bg-muted/20">
                          <td className="px-4 py-3">
                            <p className="font-bold">{item.documentNumber}</p>
                            <p className="text-[11px] text-muted-foreground">{item.sourceType === 'RECEIVABLE' ? 'Cuenta por cobrar' : 'Cuenta por pagar'} · {formatDate(item.documentDate)}</p>
                          </td>
                          <td className="max-w-[190px] truncate px-4 py-3 text-muted-foreground">{item.partyName || 'Sin tercero'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(item.dueDate)}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(item.balance, item.currency)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatMoney(item.historicalBaseAmount, preview.baseCurrency)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatMoney(item.valuationBaseAmount, preview.baseCurrency)}</td>
                          <td className={`px-4 py-3 text-right font-bold tabular-nums ${item.difference > 0 ? 'text-emerald-600' : item.difference < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                            {formatMoney(item.difference, preview.baseCurrency)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={item.economicEffect === 'GAIN' ? 'border-emerald-500/30 text-emerald-600' : item.economicEffect === 'LOSS' ? 'border-red-500/30 text-red-600' : ''}>
                              {item.economicEffect === 'GAIN' ? 'Ganancia' : item.economicEffect === 'LOSS' ? 'Pérdida' : 'Sin diferencia'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function accountingServiceResult(response: any): RevaluationPreview {
  return response?.data || response;
}

function statusLabel(status?: string | null) {
  if (status === 'PREVIEW') return 'Vista guardada';
  if (status === 'DRAFT') return 'Borrador';
  if (status === 'POSTED') return 'Contabilizado';
  if (status === 'VOIDED') return 'Anulado';
  return status || 'Pendiente';
}

function SummaryCard({ label, value, tone, icon }: { label: string; value: string; tone: 'gain' | 'loss' | 'neutral'; icon: ReactNode }) {
  const color = tone === 'gain' ? 'text-emerald-600' : tone === 'loss' ? 'text-red-600' : 'text-primary';
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="flex items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className={`mt-2 truncate text-xl font-black tabular-nums ${color}`}>{value}</p>
        </div>
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/50 ${color}`}>{icon}</div>
      </CardContent>
    </Card>
  );
}
