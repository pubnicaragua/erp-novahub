import { AlertTriangle, CheckCircle2, FileSpreadsheet, ShieldAlert } from 'lucide-react';

interface ImportReviewSummaryProps {
  total: number;
  valid: number;
  skipped: number;
  warnings?: number;
  entityLabel?: string;
}

export function ImportReviewSummary({ total, valid, skipped, warnings = 0, entityLabel = 'registros' }: ImportReviewSummaryProps) {
  return (
    <section className="space-y-3" aria-live="polite" aria-label="Resumen de validación de la importación">
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <div className="min-h-24 rounded-xl border border-primary/25 bg-primary/5 p-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">Total revisado</p>
            <FileSpreadsheet className="size-4 text-primary" aria-hidden="true" />
          </div>
          <p className="mt-1.5 text-3xl font-black leading-none tabular-nums text-foreground sm:text-4xl">{total}</p>
          <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">{entityLabel}</p>
        </div>

        <div className="min-h-24 rounded-xl border-2 border-emerald-500/35 bg-emerald-500/10 p-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">Se importarán</p>
            <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
          </div>
          <p className="mt-1.5 text-3xl font-black leading-none tabular-nums text-emerald-700 dark:text-emerald-300 sm:text-4xl">{valid}</p>
          <p className="mt-1.5 text-[11px] font-bold text-emerald-700/80 dark:text-emerald-300/80">válidos</p>
        </div>

        <div className={`min-h-24 rounded-xl border-2 p-3 shadow-sm ${skipped > 0 ? 'border-rose-500/55 bg-rose-500/10 ring-2 ring-rose-500/15' : 'border-border/60 bg-muted/20'}`}>
          <div className="flex items-start justify-between gap-2">
            <p className={`text-[9px] font-black uppercase tracking-[0.14em] ${skipped > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-muted-foreground'}`}>Se omitirán</p>
            <ShieldAlert className={`size-4 ${skipped > 0 ? 'text-rose-600' : 'text-muted-foreground'}`} aria-hidden="true" />
          </div>
          <p className={`mt-1.5 text-3xl font-black leading-none tabular-nums sm:text-4xl ${skipped > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-muted-foreground'}`}>{skipped}</p>
          <p className={`mt-1.5 text-[11px] font-bold ${skipped > 0 ? 'text-rose-700/80 dark:text-rose-300/80' : 'text-muted-foreground'}`}>con errores</p>
        </div>

        <div className={`min-h-24 rounded-xl border-2 p-3 shadow-sm ${warnings > 0 ? 'border-amber-500/45 bg-amber-500/10' : 'border-border/60 bg-muted/20'}`}>
          <div className="flex items-start justify-between gap-2">
            <p className={`text-[9px] font-black uppercase tracking-[0.14em] ${warnings > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`}>Avisos</p>
            <AlertTriangle className={`size-4 ${warnings > 0 ? 'text-amber-600' : 'text-muted-foreground'}`} aria-hidden="true" />
          </div>
          <p className={`mt-1.5 text-3xl font-black leading-none tabular-nums sm:text-4xl ${warnings > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`}>{warnings}</p>
          <p className={`mt-1.5 text-[11px] font-bold ${warnings > 0 ? 'text-amber-700/80 dark:text-amber-300/80' : 'text-muted-foreground'}`}>no bloquean</p>
        </div>
      </div>

      {skipped > 0 && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-rose-600" aria-hidden="true" />
          <p><span className="font-black">Atención:</span> se importarán {valid} {entityLabel} válidos y se omitirán {skipped} con errores. Revisa las filas marcadas antes de confirmar.</p>
        </div>
      )}
    </section>
  );
}
