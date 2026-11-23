import { getCurrencyDecimalPlaces } from './currency';
import { formatDateEs } from './dateFormat';
import { buildDownloadFileName } from './exportFileNames';
import { downloadPdfBlob } from './pdfBrowserPreview';
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
  download?: boolean;
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

export async function generateCustomerCreditInstallmentReport(input: CustomerCreditInstallmentReportInput) {
  const currency = input.currency.toUpperCase();
  const totalAmount = input.installments.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0);
  const firstDueDate = input.installments[0]?.dueDate;
  const finalDueDate = input.installments[input.installments.length - 1]?.dueDate;
  const rows = input.installments.map((installment) => ({
    ...installment,
    dueDateLabel: formatDateEs(installment.dueDate),
  }));

  const fileName = buildDownloadFileName(['plan_abonos', input.customerName, input.contractNumber], 'pdf');
  const report = await generateConfiguredReportTemplate({
    targetKey: 'ventas.customer-installment-plan',
    title: input.title,
    tenantName: input.tenantName,
    tenantLogo: input.tenantLogo,
    subtitle: [
      input.customerName ? `Cliente: ${input.customerName}` : '',
      input.contractNumber ? `Contrato: ${input.contractNumber}` : '',
      input.frequencyLabel ? `Frecuencia: ${input.frequencyLabel}` : 'Plan manual',
    ].filter(Boolean).join(' · '),
    rows,
    columns: [
      { header: 'Abono', value: row => `#${row.installmentNumber}`, align: 'center', width: 10 },
      { header: 'Vencimiento', value: row => row.dueDateLabel, width: 18 },
      { header: 'Capital', value: row => reportMoney(Number(row.principalAmount || 0), currency), align: 'right', width: 22 },
      { header: 'Intereses', value: row => reportMoney(Number(row.interestAmount || 0), currency), align: 'right', width: 22 },
      { header: 'Total del abono', value: row => reportMoney(Number(row.totalAmount || 0), currency), align: 'right', width: 28 },
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
    reportMetrics: [
      { label: 'Capital', value: reportMoney(input.principalAmount, currency), detail: 'Monto financiado' },
      { label: 'Intereses', value: reportMoney(input.interestAmount, currency), detail: 'Costo total' },
      { label: 'Total del plan', value: reportMoney(totalAmount, currency), detail: 'Capital + intereses' },
      { label: 'Abonos', value: input.installments.length, detail: 'Programados' },
    ],
    fileName,
    format: 'configured',
  });
  if (input.download && report?.output) downloadPdfBlob(report.output('blob'), fileName);
  return report;
}
