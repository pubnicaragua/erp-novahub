import { getCurrencyDecimalPlaces } from './currency';
import { formatDateEs } from './dateFormat';
import { buildDownloadFileName } from './exportFileNames';
import { generateConfiguredReportTemplate } from './pdfGenerator';
import { resolveCustomerDebtStatementInstallments } from './customerDebtStatementRows';
import { pdfStatusLabel } from './pdfStatus';

const money = (amount: number, currency: string) => new Intl.NumberFormat('es-NI', {
  style: 'currency',
  currency: ['NIO', 'USD'].includes(currency.toUpperCase()) ? currency.toUpperCase() : 'NIO',
  minimumFractionDigits: getCurrencyDecimalPlaces(),
  maximumFractionDigits: getCurrencyDecimalPlaces(),
}).format(Number(amount || 0));

export async function generateCustomerDebtStatementReport(input: {
  tenantName: string;
  tenantLogo?: string | null;
  customerName: string;
  documentLabel?: 'Crédito' | 'Préstamo';
  contractNumber: string;
  currency: string;
  total: number;
  amountPaid: number;
  balance: number;
  overdueBalance: number;
  status?: string | null;
  date?: string | null;
  dueDate?: string | null;
  principalAmount?: number | null;
  interestAmount?: number | null;
  planEnabled?: boolean;
  planCalculationMode?: 'AMOUNT' | 'DEADLINE' | 'MANUAL' | null;
  installmentAmount?: number | string | null;
  firstInstallmentDate?: string | null;
  frequency?: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | null;
  manualInstallments?: Array<{ dueDate: string; totalAmount: string; interestAmount: string }> | null;
  excludedWeekdays?: number[] | null;
  excludedDates?: string[] | null;
  calendarExclusions?: { excludedWeekdays?: number[]; holidays?: Array<{ date?: string }> } | null;
  installments: Array<any>;
  paymentHistory: Array<any>;
}) {
  const currency = input.currency || 'NIO';
  const statementInstallments = resolveCustomerDebtStatementInstallments(input);
  const isDraft = String(input.status || '').toUpperCase() === 'DRAFT';
  const statusLabel = isDraft
    ? 'Borrador'
    : String(input.status || '').toUpperCase() === 'ISSUED'
      ? 'Aprobado'
      : pdfStatusLabel(input.status);
  const installmentRows = statementInstallments.map((item) => ({
    sortDate: String(item.dueDate || '').slice(0, 10),
    kind: item.draftSummary ? input.documentLabel || 'Crédito' : item.projected ? 'Cuota proyectada' : 'Cuota',
    date: formatDateEs(item.dueDate),
    detail: item.draftSummary
      ? `Borrador de ${String(input.documentLabel || 'Crédito').toLowerCase()} · Sin cuotas ni pagos registrados`
      : item.projected
        ? `Abono proyectado #${item.installmentNumber} · Se registrará al aprobar el crédito`
        : `Abono #${item.installmentNumber} · ${item.status === 'PAID' ? 'Pagado' : item.status === 'PARTIAL' ? 'Parcial' : 'Pendiente'}`,
    amount: money(Number(item.totalAmount || 0), currency),
    balance: money(Number(item.remainingAmount ?? Math.max(0, Number(item.totalAmount || 0) - Number(item.principalPaid || 0) - Number(item.interestPaid || 0))), currency),
  }));
  const paymentRows = input.paymentHistory.flatMap((payment) => {
    const allocations = (payment.allocations || []).filter((allocation: any) => !allocation.reversedAt);
    const allocatedInstallments = [...new Set(allocations.map((allocation: any) => allocation.installmentNumber).filter(Boolean))].join(', ');
    const registeredAt = payment.registeredAt ? new Intl.DateTimeFormat('es-NI', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(payment.registeredAt)) : '—';
    const rows = [{
      sortDate: String(payment.paymentDate || '').slice(0, 10),
      kind: 'Pago',
      date: formatDateEs(payment.paymentDate),
      detail: `Pago ${payment.number || ''}${payment.reversed ? ' · REVERTIDO' : ''} · ${payment.method || '—'} · ${payment.reference || 'Sin referencia'} · Registró ${payment.registeredBy || 'Usuario no identificado'} (${registeredAt}) · Cuotas ${allocatedInstallments || '—'}`,
      amount: money(Number(payment.amount || 0), payment.currency || currency),
      balance: '—',
    }];
    for (const event of payment.auditEvents || []) {
      const action = String(event.action || '').toUpperCase();
      const actionLabel: Record<string, string> = { CREATE: 'Registro', UPDATE: 'Modificación', DELETE: 'Reversión o anulación' };
      if (action === 'CREATE') continue;
      const at = event.at ? new Intl.DateTimeFormat('es-NI', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(event.at)) : '—';
      const actor = event.userName || event.userEmail || 'Usuario no identificado';
      const metadata = event.metadata && typeof event.metadata === 'object' ? JSON.stringify(event.metadata) : '';
      rows.push({
        sortDate: String(event.at || '').slice(0, 10),
        kind: 'Auditoría',
        date: at,
        detail: `${actionLabel[action] || action || 'Evento'} del pago ${payment.number || ''} · ${actor}${event.description ? ` · ${event.description}` : ''}${metadata ? ` · ${metadata}` : ''}`,
        amount: '—',
        balance: '—',
      });
    }
    for (const allocation of (payment.allocations || []).filter((item: any) => item.reversedAt)) {
      const at = new Intl.DateTimeFormat('es-NI', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(allocation.reversedAt));
      rows.push({
        sortDate: String(allocation.reversedAt).slice(0, 10),
        kind: 'Auditoría',
        date: at,
        detail: `Asignación revertida del pago ${payment.number || ''} · Cuota ${allocation.installmentNumber || '—'}`,
        amount: '—',
        balance: '—',
      });
    }
    return rows;
  });
  const rows = [...installmentRows, ...paymentRows].sort((a, b) => a.sortDate.localeCompare(b.sortDate) || a.kind.localeCompare(b.kind));
  return generateConfiguredReportTemplate({
    targetKey: 'ventas.customer-debt-statement',
    title: input.documentLabel === 'Préstamo' ? 'Estado de cuenta de préstamos' : 'Estado de cuenta de créditos',
    tenantName: input.tenantName,
    tenantLogo: input.tenantLogo,
    subtitle: [`Cliente: ${input.customerName}`, `Documento: ${input.contractNumber}`, ...(input.status ? [`Estado: ${statusLabel}`] : [])].filter(Boolean).join(' · '),
    rows,
    columns: [
      { header: 'Tipo', value: (row) => row.kind, align: 'center', width: 12 },
      { header: 'Fecha', value: (row) => row.date, width: 14 },
      { header: 'Detalle y auditoría', value: (row) => row.detail, width: 40 },
      { header: 'Monto', value: (row) => row.amount, align: 'right', width: 17 },
      { header: 'Saldo de cuota', value: (row) => row.balance, align: 'right', width: 17 },
    ],
    totals: {
      Cliente: input.customerName,
      Documento: input.contractNumber,
      ...(input.status ? { Estado: isDraft ? 'Borrador · Aún sin abonos registrados' : statusLabel } : {}),
      [isDraft ? 'Monto del crédito' : 'Total financiado']: money(input.total, currency),
      'Total abonado': money(input.amountPaid, currency),
      [isDraft ? 'Saldo del borrador' : 'Saldo actual']: money(input.balance, currency),
      'Saldo atrasado': money(input.overdueBalance, currency),
    },
    reportMetrics: [
      { label: isDraft ? 'Monto del crédito' : 'Total financiado', value: money(input.total, currency) },
      { label: 'Abonado', value: money(input.amountPaid, currency) },
      { label: isDraft ? 'Saldo proyectado' : 'Saldo actual', value: money(input.balance, currency) },
      { label: 'Saldo atrasado', value: money(input.overdueBalance, currency) },
    ],
    fileName: buildDownloadFileName([`estado_de_cuenta_${input.documentLabel === 'Préstamo' ? 'prestamo' : 'credito'}`, input.customerName, input.contractNumber], 'pdf'),
    format: 'configured',
  });
}
