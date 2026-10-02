/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, ExternalLink, Loader2, RefreshCw, Smartphone, XCircle } from 'lucide-react';
import type { Invoice } from '../../types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { toast } from '@/app/services/toast';
import { getApiErrorMessage } from '../../services/api';
import { poketPayLinkService, type PoketAppTransaction } from '../../services/poket-paylink.service';

const statusLabels: Record<string, string> = {
  CREATED: 'Creado',
  IN_PROGRESS: 'Esperando tarjeta',
  RESOLVED: 'Pagado',
  EXPIRED: 'Firma vencida',
  CANCELLED: 'Cancelado',
  FAILED: 'Fallido',
};

const statusClasses: Record<string, string> = {
  RESOLVED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  FAILED: 'border-rose-500/30 bg-rose-500/10 text-rose-700',
  CANCELLED: 'border-muted bg-muted text-muted-foreground',
  EXPIRED: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  IN_PROGRESS: 'border-blue-500/30 bg-blue-500/10 text-blue-700',
};

function money(value: number | string, currency: string) {
  return `${currency} ${Number(value || 0).toFixed(2)}`;
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function PoketAppToAppDialog({
  invoice,
  open,
  onOpenChange,
  onRefresh,
}: {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}) {
  const [transactions, setTransactions] = useState<PoketAppTransaction[]>([]);
  const [amount, setAmount] = useState('0.00');
  const [taxAmount, setTaxAmount] = useState('0.00');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const activeTransaction = useMemo(
    () => transactions.find((item) => ['CREATED', 'IN_PROGRESS'].includes(item.status)),
    [transactions],
  );

  const load = async () => {
    if (!invoice) return;
    try {
      setLoading(true);
      setTransactions(await poketPayLinkService.listAppToApp(invoice.id));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar los cobros Poket.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !invoice) return;
    const balance = Math.max(0, Number(invoice.balance || Number(invoice.total || 0) - Number(invoice.amountPaid || 0)));
    setAmount(balance.toFixed(2));
    setTaxAmount(Number(invoice.taxAmount || 0).toFixed(2));
    setDescription(`Factura ${invoice.number}`);
    void load();
  }, [open, invoice?.id]);

  const createAndOpen = async () => {
    if (!invoice) return;
    try {
      setLoading(true);
      const result = await poketPayLinkService.createAppToApp(invoice.id, {
        amount: Number(amount),
        taxAmount: Number(taxAmount),
        currency: String(invoice.currency || 'NIO'),
        description,
      });
      setTransactions((current) => [result.transaction, ...current.filter((item) => item.id !== result.transaction.id)]);
      onRefresh?.();
      if (result.transaction.deepLink) {
        toast.success(result.existing ? 'Se reutilizó una firma Poket vigente.' : 'Firma lista. Abriendo Poket...');
        window.location.href = result.transaction.deepLink;
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo preparar el cobro con Poket.'));
    } finally {
      setLoading(false);
    }
  };

  const reconcile = async (transaction: PoketAppTransaction) => {
    try {
      setWorkingId(transaction.id);
      const result = await poketPayLinkService.reconcileAppToApp(transaction.id);
      setTransactions((current) => current.map((item) => item.id === result.transaction.id ? result.transaction : item));
      toast.success(result.transaction.status === 'RESOLVED' ? 'Pago confirmado por Poket.' : 'Estado actualizado desde Poket.');
      onRefresh?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo verificar el cobro con Poket.'));
    } finally {
      setWorkingId(null);
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><Smartphone className="size-5 text-primary" />Cobrar con Poket · {invoice?.number}</DialogTitle><DialogDescription>Abre la aplicación Poket para acercar la tarjeta al teléfono. NovaHub registra el pago únicamente después de recibir la confirmación del backend de Poket.</DialogDescription></DialogHeader>
    <div className="space-y-5">
      <div className="grid gap-4 rounded-2xl border border-border/50 bg-muted/20 p-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="poket-app-amount">Monto ({invoice?.currency || 'NIO'})</Label><Input id="poket-app-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={Boolean(activeTransaction)} /></div><div className="space-y-2"><Label htmlFor="poket-app-tax">Impuesto enviado a Poket</Label><Input id="poket-app-tax" type="number" min="0" step="0.01" value={taxAmount} onChange={(event) => setTaxAmount(event.target.value)} disabled={Boolean(activeTransaction)} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="poket-app-description">Descripción</Label><Input id="poket-app-description" value={description} onChange={(event) => setDescription(event.target.value)} disabled={Boolean(activeTransaction)} /></div></div>
      {activeTransaction && <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm"><p className="font-bold">Ya existe un cobro NFC activo para este monto.</p><p className="text-muted-foreground">Verifica su estado o vuelve a abrirlo desde el botón de Poket.</p></div>}
      {!activeTransaction && <Button type="button" onClick={() => void createAndOpen()} disabled={loading || !invoice} className="w-full gap-2"><CreditCard className="size-4" />{loading ? 'Preparando Poket...' : 'Abrir Poket y cobrar con NFC'}</Button>}
      <div className="space-y-3"><div className="flex items-center justify-between"><h3 className="text-sm font-black uppercase tracking-widest">Historial App-to-App</h3>{loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}</div>{transactions.length === 0 && !loading && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Esta factura todavía no tiene cobros NFC.</p>}{transactions.map((transaction) => <div key={transaction.id} className="space-y-3 rounded-2xl border border-border/60 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold">{money(transaction.amount, transaction.currency)}</p><p className="text-xs text-muted-foreground">Creado {displayDate(transaction.createdAt)} · ID {transaction.transactionId}</p></div><Badge variant="outline" className={statusClasses[transaction.status] || ''}>{transaction.status === 'RESOLVED' && <CheckCircle2 className="mr-1 size-3" />}{['FAILED', 'EXPIRED', 'CANCELLED'].includes(transaction.status) && <XCircle className="mr-1 size-3" />}{statusLabels[transaction.status] || transaction.status}</Badge></div>{transaction.errorReason && <p className="text-xs text-rose-600">{transaction.errorReason}</p>}<div className="flex flex-wrap gap-2">{transaction.deepLink && ['CREATED', 'IN_PROGRESS'].includes(transaction.status) && <Button type="button" size="sm" variant="outline" onClick={() => { window.location.href = transaction.deepLink || ''; }} className="gap-1"><ExternalLink className="size-3.5" />Abrir Poket</Button>}<Button type="button" size="sm" variant="outline" onClick={() => void reconcile(transaction)} disabled={workingId === transaction.id || transaction.status === 'RESOLVED'} className="gap-1"><RefreshCw className="size-3.5" />{workingId === transaction.id ? 'Verificando...' : 'Verificar estado'}</Button></div></div>)}</div>
    </div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button></DialogFooter></DialogContent></Dialog>;
}
