import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { formatCurrencyAmount } from '../../utils/currency';
import { toast } from '@/app/services/toast';

type IntegrityStatus = 'OK' | 'REVISAR' | 'ERROR' | 'INFO';
type IntegrityCheck = {
  id: string;
  title: string;
  status: IntegrityStatus;
  expected?: number;
  actual?: number;
  difference?: number;
  message: string;
  howToFix?: string;
  details?: Array<Record<string, string | number | null>>;
};
type IntegrityReport = {
  generatedAt: string;
  baseCurrency: string;
  summary: { ok: number; revisar: number; error: number; info: number };
  checks: IntegrityCheck[];
};

const STATUS_STYLE: Record<IntegrityStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  OK: { label: 'Cuadra', icon: CheckCircle2, className: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300' },
  REVISAR: { label: 'Revisar', icon: AlertTriangle, className: 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300' },
  ERROR: { label: 'No cuadra', icon: XCircle, className: 'border-rose-500/40 bg-rose-500/5 text-rose-700 dark:text-rose-300' },
  INFO: { label: 'Informativo', icon: Info, className: 'border-border/60 bg-muted/20 text-muted-foreground' },
};

const COLUMN_LABEL: Record<string, string> = {
  asiento: 'Asiento', descripcion: 'Descripción', debitos: 'Débitos', creditos: 'Créditos', diferencia: 'Diferencia',
  code: 'Código', nombre: 'Cuenta', saldoGuardado: 'Saldo guardado', saldoPorMovimientos: 'Saldo por movimientos',
  concepto: 'Concepto', monto: 'Monto', cantidad: 'Cantidad', documento: 'Documento', total: 'Total', sinAsiento: 'Sin asiento', ejemplos: 'Ejemplos',
};

/**
 * Control de cuadres: compara la contabilidad con las facturas, créditos, saldos iniciales, compras y reportes.
 * Solo lee; no corrige nada. Cada fila explica qué se comparó y qué hacer.
 */
export function IntegrityCheckPanel() {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const result = await contabilidadService.getIntegrityReport();
      setReport(result as IntegrityReport);
      const failing = (result as IntegrityReport).checks.find((check) => check.status === 'ERROR') || (result as IntegrityReport).checks.find((check) => check.status === 'REVISAR');
      setOpenId(failing?.id ?? null);
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo ejecutar la verificación. Inténtalo de nuevo y, si se repite, envía el código de seguimiento a soporte.');
    } finally {
      setLoading(false);
    }
  };

  const money = (value: number | undefined) => formatCurrencyAmount(Number(value || 0), report?.baseCurrency || 'NIO');
  const cell = (key: string, value: string | number | null) => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'number' && ['debitos', 'creditos', 'diferencia', 'saldoGuardado', 'saldoPorMovimientos', 'monto'].includes(key)) return money(value);
    return String(value);
  };

  return (
    <Card id="control-de-cuadres" className="min-w-0 border-primary/25 bg-gradient-to-br from-card via-card to-primary/[0.04] shadow-sm">
      <CardHeader className="border-b border-border/30 px-5 pb-4 pt-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><ShieldCheck className="size-5" /></div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-black uppercase tracking-tight">Control de cuadres</CardTitle>
              <p className="mt-1 max-w-4xl text-xs leading-relaxed text-muted-foreground">
                Compara la contabilidad con tus facturas, créditos, saldos iniciales, compras y reportes. Solo revisa; no cambia ningún dato.
              </p>
            </div>
          </div>
          <Button type="button" onClick={() => void run()} disabled={loading} className="w-fit shrink-0 gap-2 self-end lg:self-start">
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
            {report ? 'Volver a verificar' : 'Verificar ahora'}
          </Button>
        </div>
      </CardHeader>
      {report && (
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className={STATUS_STYLE.OK.className}>{report.summary.ok} cuadran</Badge>
            <Badge variant="outline" className={STATUS_STYLE.REVISAR.className}>{report.summary.revisar} por revisar</Badge>
            <Badge variant="outline" className={STATUS_STYLE.ERROR.className}>{report.summary.error} no cuadran</Badge>
            <span className="text-muted-foreground">Ejecutado {new Date(report.generatedAt).toLocaleString('es-NI')}</span>
          </div>
          <ul className="space-y-2">
            {report.checks.map((check) => {
              const style = STATUS_STYLE[check.status];
              const Icon = style.icon;
              const expanded = openId === check.id;
              const columns = check.details?.length ? Object.keys(check.details[0]) : [];
              return (
                <li key={check.id} className={cn('rounded-xl border p-3', style.className)}>
                  <button type="button" className="flex w-full items-start gap-3 text-left" aria-expanded={expanded} onClick={() => setOpenId(expanded ? null : check.id)}>
                    <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{check.title}</span>
                        <Badge variant="outline" className="text-[10px]">{style.label}</Badge>
                      </span>
                      <span className="mt-1 block text-xs text-foreground/80">{check.message}</span>
                    </span>
                  </button>
                  {expanded && (
                    <div className="mt-3 space-y-3 pl-7">
                      {(check.expected !== undefined && check.actual !== undefined && ['RECEIVABLES', 'PAYABLES', 'JOURNAL_VS_REPORTS', 'TRIAL_BALANCE'].includes(check.id)) && (
                        <dl className="grid gap-2 text-xs sm:grid-cols-3">
                          <div><dt className="text-muted-foreground">{check.id === 'RECEIVABLES' || check.id === 'PAYABLES' ? 'Según documentos' : 'Primer total'}</dt><dd className="font-semibold tabular-nums text-foreground">{money(check.expected)}</dd></div>
                          <div><dt className="text-muted-foreground">{check.id === 'RECEIVABLES' || check.id === 'PAYABLES' ? 'Según contabilidad' : 'Segundo total'}</dt><dd className="font-semibold tabular-nums text-foreground">{money(check.actual)}</dd></div>
                          <div><dt className="text-muted-foreground">Diferencia</dt><dd className="font-semibold tabular-nums text-foreground">{money(check.difference)}</dd></div>
                        </dl>
                      )}
                      {check.howToFix && <p className="rounded-lg bg-background/60 p-2 text-xs text-foreground"><span className="font-semibold">Qué hacer: </span>{check.howToFix}</p>}
                      {check.details && check.details.length > 0 && (
                        <div data-table-content-sized="true" className="max-w-full overflow-x-auto rounded-lg border border-border/50 bg-background/60">
                          <table className="w-full min-w-[420px] text-xs">
                            <thead><tr className="text-left text-muted-foreground">{columns.map((column) => <th key={column} className="px-2 py-1.5 font-semibold">{COLUMN_LABEL[column] || column}</th>)}</tr></thead>
                            <tbody>
                              {check.details.map((row, index) => (
                                <tr key={index} className="border-t border-border/40">
                                  {columns.map((column) => <td key={column} className="px-2 py-1.5 tabular-nums text-foreground">{cell(column, row[column])}</td>)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
