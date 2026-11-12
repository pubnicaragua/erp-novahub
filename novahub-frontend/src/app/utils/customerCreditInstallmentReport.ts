import { getCurrencyDecimalPlaces } from './currency';
import { formatDateEs } from './dateFormat';
import type { CustomerCreditScheduleRow } from '../components/ventas/CustomerCreditInstallmentSchedule';
import { generateConfiguredReportTemplate } from './pdfGenerator';

export interface CustomerCreditInstallmentReportInput {
  tenantName: string;
  tenantLogo?: string | null;
  title: string;
  customerName: string;
  contractNumber: string;
  currency: string;
  frequencyLabel?: string;
  principalAmount: number;
  interestAmount: number;
  installments: CustomerCreditScheduleRow[];
}

function reportMoney(amount: number, currency: string) {
  const safeCurrency = ['NIO', 'USD'].includes(currency.toUpperCase()) ? currency.toUpperCase() : 'NIO';
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: safeCurrency,
    minimumFractionDigits: getCurrencyDecimalPlaces(),
    maximumFractionDigits: getCurrencyDecimalPlaces(),
  }).format(Number(amount || 0));
}

function reportFileName(value: string) {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const safe = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
  return `plan-abonos-${safe || 'credito'}.pdf`;
}

export async function generateCustomerCreditInstallmentReport(input: CustomerCreditInstallmentReportInput) {
  const currency = input.currency.toUpperCase();
  const totalAmount = input.installments.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0);
  const firstDueDate = input.installments[0]?.dueDate;
  const finalDueDate = input.installments[input.installments.length - 1]?.dueDate;
  const rows = input.installments.map((installment) => ({
    ...installment,
    dueDateLabel: formatDateEs(installment.dueDate),
  }));

  return generateConfiguredReportTemplate({
    targetKey: 'ventas.customer-installment-plan',
    title: input.title,
    tenantName: input.tenantName,
    tenantLogo: input.tenantLogo,
    rows,
    columns: [
      { header: 'Abono', value: row => `#${row.installmentNumber}`, align: 'center' },
      { header: 'Vencimiento', value: row => row.dueDateLabel },
      { header: 'Capital', value: row => reportMoney(Number(row.principalAmount || 0), currency), align: 'right' },
      { header: 'Intereses', value: row => reportMoney(Number(row.interestAmount || 0), currency), align: 'right' },
      { header: 'Total del abono', value: row => reportMoney(Number(row.totalAmount || 0), currency), align: 'right' },
    ],
    totals: {
      Cliente: input.customerName || '—',
      Contrato: input.contractNumber || '—',
      ...(input.frequencyLabel ? { Frecuencia: input.frequencyLabel } : { Modalidad: 'Plan manual' }),
      Abonos: String(input.installments.length),
      'Primer vencimiento': firstDueDate ? formatDateEs(firstDueDate) : '—',
      'Vencimiento final': finalDueDate ? formatDateEs(finalDueDate) : '—',
      Capital: reportMoney(input.principalAmount, currency),
      Intereses: reportMoney(input.interestAmount, currency),
      'Total con intereses': reportMoney(totalAmount, currency),
    },
    fileName: reportFileName(input.contractNumber || input.customerName || 'credito'),
    format: 'configured',
  });
}
