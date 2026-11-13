import { Plus, Printer, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { formatDateEs } from '../../utils/dateFormat';
import type { CustomerCreditManualInstallmentDraft, CustomerCreditPlanInstallment } from '../../utils/customerCreditInstallmentPlan';

export type CustomerCreditScheduleRow = CustomerCreditPlanInstallment & {
  id?: string;
};

interface CustomerCreditInstallmentScheduleProps {
  installments: CustomerCreditScheduleRow[];
  currency: string;
  formatAmount: (amount: number) => string;
  principalAmount?: number;
  interestAmount?: number;
  totalAmount?: number;
  installmentAmount?: number | null;
  finalDueDate?: string;
  frequencyLabel?: string;
  manualInstallments?: CustomerCreditManualInstallmentDraft[];
  manualValidation?: { isValid: boolean; validationErrors: string[] };
  onManualInstallmentChange?: (index: number, field: keyof CustomerCreditManualInstallmentDraft, value: string) => void;
  onAddManualInstallment?: () => void;
  onRemoveManualInstallment?: (index: number) => void;
  manualInterestEditable?: boolean;
  onPrint?: () => void;
  printDisabled?: boolean;
  className?: string;
}

export function CustomerCreditInstallmentSchedule({
  installments,
  currency,
  formatAmount,
  principalAmount,
  interestAmount,
  totalAmount,
  installmentAmount,
  finalDueDate,
  frequencyLabel,
  manualInstallments,
  manualValidation,
  onManualInstallmentChange,
  onAddManualInstallment,
  onRemoveManualInstallment,
  manualInterestEditable = true,
  onPrint,
  printDisabled = false,
  className,
}: CustomerCreditInstallmentScheduleProps) {
  if (installments.length === 0) return null;

  const principal = principalAmount ?? installments.reduce((sum, row) => sum + Number(row.principalAmount || 0), 0);
  const interest = interestAmount ?? installments.reduce((sum, row) => sum + Number(row.interestAmount || 0), 0);
  const total = totalAmount ?? installments.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0);
  const endingDate = finalDueDate || installments[installments.length - 1]?.dueDate || '';
  const lastInstallment = installments[installments.length - 1];
  const lastWasAdjusted = installmentAmount != null
    && Math.abs(Number(lastInstallment.totalAmount) - installmentAmount) > 0.000001;
  const manualEditor = Boolean(onManualInstallmentChange && manualInstallments);

  return (
    <section className={`min-w-0 space-y-3 rounded-xl border border-border/50 bg-card p-3 sm:p-4 ${className || ''}`} aria-label="Calendario de abonos">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Calendario detallado de abonos</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {frequencyLabel ? `Frecuencia ${frequencyLabel.toLowerCase()} · ` : ''}
            {installments.length} {installments.length === 1 ? 'abono programado' : 'abonos programados'}.
            {lastWasAdjusted ? ' El último abono cubre el saldo restante.' : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {manualEditor && onAddManualInstallment && <Button type="button" variant="outline" size="sm" onClick={onAddManualInstallment} className="w-full gap-2 sm:w-auto">
            <Plus className="size-4" /> Agregar abono
          </Button>}
          {onPrint && <Button type="button" variant="outline" size="sm" onClick={onPrint} disabled={printDisabled || (manualEditor && !manualValidation?.isValid)} className="w-full gap-2 sm:w-auto">
            <Printer className="size-4" /> Imprimir plan
          </Button>}
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <SummaryValue label="Capital" value={formatAmount(principal)} />
        <SummaryValue label="Intereses" value={formatAmount(interest)} />
        <SummaryValue label="Total con intereses" value={formatAmount(total)} emphasis />
        <SummaryValue label="Cantidad de abonos" value={String(installments.length)} />
        <SummaryValue label="Último abono" value={formatAmount(Number(lastInstallment.totalAmount || 0))} />
        <SummaryValue label="Vencimiento final" value={endingDate ? formatDateEs(endingDate) : 'Sin fecha'} />
      </div>

      <div className="max-h-72 min-w-0 overflow-auto rounded-lg border border-border/50">
        <Table className="min-w-[720px] text-xs">
          <TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
            <TableRow>
              <TableHead className="w-16">Abono</TableHead>
              <TableHead>Fecha{manualEditor && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}</TableHead>
              {manualEditor ? <>
                <TableHead className="text-right">Monto del abono <span className="text-destructive" aria-hidden="true">*</span></TableHead>
                <TableHead className="text-right">Interés {manualInterestEditable && <span className="text-destructive" aria-hidden="true">*</span>}</TableHead>
                <TableHead className="text-right">Capital calculado</TableHead>
                <TableHead className="w-12" />
              </> : <>
                <TableHead className="text-right">Capital</TableHead>
                <TableHead className="text-right">Interés</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Pendiente de cuota</TableHead>
              </>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {installments.map((row, index) => {
              const paid = Number(row.principalPaid || 0) + Number(row.interestPaid || 0);
              const pending = Math.max(0, Number(row.totalAmount || 0) - paid);
              const adjusted = index === installments.length - 1
                && installmentAmount != null
                && Math.abs(Number(row.totalAmount) - installmentAmount) > 0.000001;
              return (
                <TableRow key={row.id || `${row.installmentNumber}-${row.dueDate}`}>
                  <TableCell className="whitespace-nowrap font-semibold">#{row.installmentNumber}{adjusted && <span className="ml-1 text-[10px] text-muted-foreground">Ajuste</span>}</TableCell>
                  {manualEditor ? <>
                    <TableCell><Input type="date" required aria-label={`Fecha de vencimiento del abono ${index + 1}`} value={manualInstallments![index]?.dueDate || ''} onChange={(event) => onManualInstallmentChange!(index, 'dueDate', event.target.value)} className="h-8 min-w-36 text-xs" /></TableCell>
                    <TableCell><Input type="number" required min="0.01" step="0.01" currencyPrecision aria-label={`Monto total del abono ${index + 1}`} value={manualInstallments![index]?.totalAmount ?? ''} onChange={(event) => onManualInstallmentChange!(index, 'totalAmount', event.target.value)} className="h-8 min-w-32 text-right text-xs tabular-nums" /></TableCell>
                    <TableCell><Input type="number" required={manualInterestEditable} min="0" step="0.01" currencyPrecision aria-label={`Interés del abono ${index + 1}`} value={manualInterestEditable ? (manualInstallments![index]?.interestAmount ?? '') : '0'} onChange={(event) => onManualInstallmentChange!(index, 'interestAmount', event.target.value)} disabled={!manualInterestEditable} className="h-8 min-w-32 text-right text-xs tabular-nums" /></TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">{formatAmount(Number(row.principalAmount || 0))}</TableCell>
                    <TableCell className="text-right"><Button type="button" size="icon" variant="ghost" aria-label={`Quitar abono ${index + 1}`} title={`Quitar abono ${index + 1}`} disabled={installments.length <= 1} onClick={() => onRemoveManualInstallment?.(index)} className="size-8"><Trash2 className="size-4" /></Button></TableCell>
                  </> : <>
                    <TableCell className="whitespace-nowrap">{formatDateEs(row.dueDate)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatAmount(Number(row.principalAmount || 0))}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatAmount(Number(row.interestAmount || 0))}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">{formatAmount(Number(row.totalAmount || 0))}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatAmount(pending)}</TableCell>
                  </>}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {manualEditor && manualValidation && !manualValidation.isValid && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[10px] leading-relaxed text-destructive">
        <p className="font-bold">Revisa el plan manual antes de guardar:</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">{manualValidation.validationErrors.map((error) => <li key={error}>{error}</li>)}</ul>
      </div>}
      <p className="text-[10px] leading-relaxed text-muted-foreground">{manualEditor
        ? `Montos en ${currency}. ${manualInterestEditable ? 'El capital se calcula restando el interés al monto ingresado; ' : 'Cada abono se aplica íntegramente a capital; '}los totales deben coincidir con el contrato.`
        : `Los montos están expresados en ${currency}. Las cuotas se distribuyen según la frecuencia y el último abono se ajusta al saldo exacto del plan.`}</p>
    </section>
  );
}

function SummaryValue({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className="min-w-0 rounded-lg border border-border/40 bg-muted/20 p-2.5">
    <p className="text-[9px] font-bold text-muted-foreground">{label}</p>
    <p className={`mt-1 break-words text-xs tabular-nums ${emphasis ? 'font-black text-foreground' : 'font-semibold text-foreground'}`}>{value}</p>
  </div>;
}
