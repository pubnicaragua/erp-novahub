import { ArrowRight, CircleDollarSign, Info } from 'lucide-react';
import { Card, CardContent } from '../ui/card';

export function ExpenseAccountingNotice() {
  return (
    <Card className="rounded-2xl border-primary/20 bg-primary/[0.04] shadow-none">
      <CardContent className="flex min-w-0 items-start gap-3 p-4 sm:p-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Info className="size-4" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Contabilidad automática</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            El borrador y el pendiente no generan asiento. Al marcar el gasto como pagado, Compras usa la cuenta de gasto y la cuenta configurada para el método elegido, y envía el detalle completo a Finanzas.
          </p>
          <p className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
            <span className="inline-flex items-center gap-1"><CircleDollarSign className="size-3 text-emerald-500" /> Pendiente</span>
            <ArrowRight className="size-3" />
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">Pagado · Finanzas</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
