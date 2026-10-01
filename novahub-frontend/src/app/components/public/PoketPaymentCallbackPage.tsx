import { useEffect, useState } from 'react';
import { CheckCircle2, FileText, Loader2, XCircle } from 'lucide-react';
import { generateSalesTransactionPDF } from '../../utils/pdfGenerator';
import { SalesDocumentDetailSheet, type SalesDocumentPanelData } from '../ventas/SalesDocumentDetailSheet';
import type { PdfDownloadFormat } from '../../utils/pdfDownloadFormats';
import { Button } from '../ui/button';
import { toast } from '@/app/services/toast';
import {
  poketPayLinkService,
  type PoketPayLinkStatus,
  type PoketPublicReceipt,
} from '../../services/poket-paylink.service';

function money(value: unknown, currency = 'NIO') {
  return `${currency} ${new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))}`;
}

function formatDate(value: unknown) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(String(value)));
}

function buildReceiptPanel(receipt: PoketPublicReceipt): SalesDocumentPanelData {
  const invoice = receipt.invoice;
  const payment = receipt.payment;
  const customer = invoice.customer || payment.customer || {};
  const customerName = String(invoice.customCustomerName || customer.name || invoice.customCustomerEmail || 'Cliente general');
  const paymentNumber = String(payment.number || `PAGO-${invoice.number}`);
  const paymentCurrency = String(payment.currency || invoice.currency || 'NIO').toUpperCase();
  const paymentAmount = Number(payment.amount || 0);

  return {
    id: String(payment.id || paymentNumber),
    number: paymentNumber,
    title: 'Recibo de pago',
    customerName,
    status: 'PAID',
    sourceLabel: 'Poket · Tarjeta',
    sourceCurrency: paymentCurrency,
    sourceExchangeRate: Number(payment.exchangeRate || invoice.exchangeRate || 1),
    totalLabel: money(paymentAmount, paymentCurrency),
    summaryDetails: [
      { label: 'Factura', value: invoice.number },
      { label: 'Método', value: 'Tarjeta · Poket' },
      { label: 'Referencia', value: String(payment.reference || paymentNumber) },
    ],
    metadata: [
      { label: 'Fecha del pago', value: formatDate(payment.date) },
      { label: 'Moneda', value: paymentCurrency },
      { label: 'Saldo posterior', value: money(invoice.balance, invoice.currency) },
    ],
    lines: [{
      id: String(payment.id || paymentNumber),
      description: 'Pago confirmado con tarjeta mediante Poket',
      quantity: 1,
      unitPriceLabel: money(paymentAmount, paymentCurrency),
      totalLabel: money(paymentAmount, paymentCurrency),
    }],
    notes: String(payment.notes || `Pago aplicado a la factura ${invoice.number}`),
  };
}

export function PoketPaymentCallbackPage() {
  const paymentLinkId = new URLSearchParams(window.location.search).get('paymentLinkId') || '';
  const [status, setStatus] = useState<PoketPayLinkStatus | 'LOADING' | 'ERROR'>(paymentLinkId ? 'LOADING' : 'ERROR');
  const [receipt, setReceipt] = useState<PoketPublicReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  useEffect(() => {
    if (!paymentLinkId) return;
    let stopped = false;
    let attempts = 0;
    const maxAttempts = 48;
    const check = async () => {
      try {
        if (attempts === 0 || attempts % 4 === 0) {
          await poketPayLinkService.publicReconcile(paymentLinkId).catch(() => undefined);
        }
        const result = await poketPayLinkService.publicStatus(paymentLinkId);
        if (stopped) return;
        setStatus(result.status);
        if (!['RESOLVED', 'FAILED', 'EXPIRED', 'CANCELLED'].includes(result.status) && attempts < maxAttempts) {
          attempts += 1;
          window.setTimeout(() => void check(), 2500);
        } else if (!['RESOLVED', 'FAILED', 'EXPIRED', 'CANCELLED'].includes(result.status)) {
          setStatus('ERROR');
        }
      } catch {
        if (!stopped) setStatus('ERROR');
      }
    };
    void check();
    return () => { stopped = true; };
  }, [paymentLinkId]);

  useEffect(() => {
    if (status !== 'RESOLVED' || !paymentLinkId) return;
    let stopped = false;
    const loadReceipt = async () => {
      setReceiptLoading(true);
      for (let attempt = 0; attempt < 5 && !stopped; attempt += 1) {
        try {
          const result = await poketPayLinkService.publicReceipt(paymentLinkId);
          if (!stopped) {
            setReceipt(result);
            setReceiptOpen(true);
          }
          break;
        } catch {
          if (attempt < 4) await new Promise((resolve) => window.setTimeout(resolve, 1000));
        }
      }
      if (!stopped) setReceiptLoading(false);
    };
    void loadReceipt();
    return () => { stopped = true; };
  }, [paymentLinkId, status]);

  const downloadReceipt = async (format: PdfDownloadFormat = 'configured') => {
    if (!receipt) return;
    try {
      setDownloadLoading(true);
      const invoice = receipt.invoice;
      const payment = receipt.payment;
      const voucher = {
        ...payment,
        invoice,
        customer: payment.customer || invoice.customer,
        number: payment.number || `PAGO-${invoice.number}`,
        currency: payment.currency || invoice.currency,
        exchangeRate: Number(payment.exchangeRate || invoice.exchangeRate || 1),
        remaining: Number(invoice.balance || 0),
        balance: Number(invoice.balance || 0),
        total: Number(payment.amount || 0),
        items: [{
          description: `Pago ${String(payment.method || 'CARD').toUpperCase()}${payment.reference ? ` · Ref. ${payment.reference}` : ''}`,
          quantity: 1,
          unitPrice: Number(payment.amount || 0),
          total: Number(payment.amount || 0),
        }],
        notes: `${payment.notes || ''}${payment.notes ? '\n' : ''}Factura aplicada: ${invoice.number}`,
      };
      const result = await generateSalesTransactionPDF({
        document: voucher,
        tenantName: receipt.company.name,
        tenantLogo: receipt.company.logo || undefined,
        formatAmount: (amount, currency) => money(amount, currency || invoice.currency),
        documentType: 'payment',
        format,
        save: false,
      });
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Recibo-${invoice.number}.pdf`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'No se pudo generar el recibo en PDF.');
    } finally {
      setDownloadLoading(false);
    }
  };

  const resolved = status === 'RESOLVED';
  const failed = ['FAILED', 'EXPIRED', 'CANCELLED', 'ERROR'].includes(status);
  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8"><section className="w-full max-w-2xl rounded-3xl border border-border/60 bg-card p-6 shadow-xl sm:p-8">
    <div className="text-center">{resolved ? <CheckCircle2 className="mx-auto size-14 text-emerald-600" /> : failed ? <XCircle className="mx-auto size-14 text-rose-600" /> : <Loader2 className="mx-auto size-14 animate-spin text-primary" />}<h1 className="mt-5 text-2xl font-black">{resolved ? 'Pago confirmado' : failed ? 'No pudimos confirmar el pago' : 'Confirmando pago...'}</h1><p className="mt-3 text-sm text-muted-foreground">{resolved ? 'NovaHub ya registró el pago y actualizó la factura.' : failed ? 'Puedes cerrar esta ventana o contactar a la empresa para verificar el estado.' : 'Estamos consultando a NovaHub. No cierres esta ventana todavía.'}</p></div>
    {resolved && <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/[0.04] p-5">{receiptLoading && <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Preparando recibo...</div>}{receipt && <><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Recibo listo</p><p className="mt-1 text-sm text-muted-foreground">Factura {receipt.invoice.number} · {formatDate(receipt.payment.date)}</p></div><FileText className="size-7 text-primary" /></div><Button type="button" onClick={() => setReceiptOpen(true)} disabled={downloadLoading} className="mt-5 w-full gap-2"><FileText className="size-4" />Ver recibo y descargar PDF</Button><SalesDocumentDetailSheet document={buildReceiptPanel(receipt)} entity="PAYMENT_RECEIVED" open={receiptOpen} onClose={() => setReceiptOpen(false)} onDownloadPdf={(format) => { void downloadReceipt(format); }} /></>}</div>}
  </section></main>;
}
