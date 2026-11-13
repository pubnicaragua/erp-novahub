import { getCurrencyDecimalPlaces } from './currency';
import { formatDateEs } from './dateFormat';
import { generateConfiguredReportTemplate } from './pdfGenerator';

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
  contractNumber: string;
  currency: string;
  total: number;
  amountPaid: number;
  balance: number;
  overdueBalance: number;
  installments: Array<any>;
  paymentHistory: Array<any>;
}) {
  const currency = input.currency || 'NIO';
  const installmentRows = input.installments.map((item) => ({
    sortDate: String(item.dueDate || '').slice(0, 10),
    kind: 'Cuota',
    date: formatDateEs(item.dueDate),
    detail: `Abono #${item.installmentNumber} · ${item.status === 'PAID' ? 'Pagado' : item.status === 'PARTIAL' ? 'Parcial' : 'Pendiente'}`,
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
    title: 'Estado de deuda actualizado',
    tenantName: input.tenantName,
    tenantLogo: input.tenantLogo,
    subtitle: [`Cliente: ${input.customerName}`, `Documento: ${input.contractNumber}`].filter(Boolean).join(' · '),
    rows,
    columns: [
      { header: 'Tipo', value: (row) => row.kind, align: 'center' },
      { header: 'Fecha', value: (row) => row.date },
      { header: 'Detalle y auditoría', value: (row) => row.detail },
      { header: 'Monto', value: (row) => row.amount, align: 'right' },
      { header: 'Saldo de cuota', value: (row) => row.balance, align: 'right' },
    ],
    totals: {
      Cliente: input.customerName,
      Documento: input.contractNumber,
      'Total financiado': money(input.total, currency),
      'Total abonado': money(input.amountPaid, currency),
      'Saldo actual': money(input.balance, currency),
      'Saldo atrasado': money(input.overdueBalance, currency),
    },
    reportMetrics: [
      { label: 'Total financiado', value: money(input.total, currency) },
      { label: 'Abonado', value: money(input.amountPaid, currency) },
      { label: 'Saldo actual', value: money(input.balance, currency) },
      { label: 'Saldo atrasado', value: money(input.overdueBalance, currency) },
    ],
    fileName: `estado-de-deuda-${String(input.contractNumber || input.customerName).replace(/[^a-z0-9-]/gi, '-')}.pdf`,
    format: 'configured',
  });
}
