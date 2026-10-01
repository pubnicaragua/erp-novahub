/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Clipboard, ExternalLink, Link2, Loader2, RefreshCw } from 'lucide-react';
import type { Invoice } from '../../types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { toast } from '@/app/services/toast';
import { getApiErrorMessage } from '../../services/api';
import { poketPayLinkService, type PoketPayLink } from '../../services/poket-paylink.service';

const statusLabels: Record<string, string> = { CREATED: 'Creado', IN_PROGRESS: 'En proceso', RESOLVED: 'Pagado', EXPIRED: 'Vencido', CANCELLED: 'Cancelado', FAILED: 'Fallido' };
const statusClasses: Record<string, string> = { RESOLVED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700', FAILED: 'border-rose-500/30 bg-rose-500/10 text-rose-700', CANCELLED: 'border-muted bg-muted text-muted-foreground', EXPIRED: 'border-amber-500/30 bg-amber-500/10 text-amber-700' };

function localDateTimeAfter24Hours() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function money(value: number | string, currency: string) { return `${currency} ${Number(value || 0).toFixed(2)}`; }
function displayDate(value: string) { return new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }

export function PoketPayLinkDialog({ invoice, open, onOpenChange, onRefresh }: { invoice: Invoice | null; open: boolean; onOpenChange: (open: boolean) => void; onRefresh?: () => void }) {
  const [links, setLinks] = useState<PoketPayLink[]>([]);
  const [amount, setAmount] = useState('0.00');
  const [currency, setCurrency] = useState('NIO');
  const [description, setDescription] = useState('');
  const [expirationDate, setExpirationDate] = useState(localDateTimeAfter24Hours);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const activeLink = useMemo(() => links.find((link) => ['CREATED', 'IN_PROGRESS'].includes(link.status)), [links]);

  const loadLinks = async () => {
    if (!invoice) return;
    try {
      setLoading(true);
      const next = await poketPayLinkService.listForInvoice(invoice.id);
      setLinks(next);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar los links de pago.'));
    } finally {
      setLoading(false);
    }
  };

  // Al cambiar de factura reiniciamos el formulario con su saldo actual.
  useEffect(() => {
    if (!open || !invoice) return;
    const balance = Math.max(0, Number(invoice.balance || Number(invoice.total || 0) - Number(invoice.amountPaid || 0)));
    setAmount(balance.toFixed(2));
    setCurrency(String(invoice.currency || 'NIO'));
    setDescription(`Factura ${invoice.number}`);
    setExpirationDate(localDateTimeAfter24Hours());
    void loadLinks();
  }, [open, invoice?.id]);

  const create = async () => {
    if (!invoice) return;
    try {
      setLoading(true);
      const result = await poketPayLinkService.createForInvoice(invoice.id, { amount: Number(amount), currency, description, expirationDate: new Date(expirationDate).toISOString() });
      setLinks((current) => [result.link, ...current.filter((link) => link.id !== result.link.id)]);
      toast.success(result.existing ? 'Ya existía un PayLink activo para este saldo.' : 'PayLink creado correctamente.');
      onRefresh?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear el PayLink.'));
    } finally {
      setLoading(false);
    }
  };

  const copy = async (link: PoketPayLink) => {
    await navigator.clipboard.writeText(link.permanentLink);
    toast.success('Enlace copiado.');
  };

  const reconcile = async (link: PoketPayLink) => {
    try {
      setWorkingId(link.id);
      const result = await poketPayLinkService.reconcile(link.id);
      setLinks((current) => current.map((item) => item.id === result.link.id ? result.link : item));
      toast.success(result.link.status === 'RESOLVED' ? 'Pago confirmado por Poket.' : 'Estado actualizado desde Poket.');
      onRefresh?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo verificar el estado con Poket.'));
    } finally {
      setWorkingId(null);
    }
  };

  const cancel = async (link: PoketPayLink) => {
    if (!window.confirm('¿Cancelar este PayLink? La factura no se anulará.')) return;
    try {
      setWorkingId(link.id);
      const cancelled = await poketPayLinkService.cancel(link.id);
      setLinks((current) => current.map((item) => item.id === cancelled.id ? cancelled : item));
      toast.success('PayLink cancelado.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cancelar el PayLink.'));
    } finally {
      setWorkingId(null);
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><Link2 className="size-5 text-primary" />Links de pago · {invoice?.number}</DialogTitle><DialogDescription>El pago solo se registra cuando Poket confirma la transacción por webhook o al verificar el estado.</DialogDescription></DialogHeader>
    <div className="space-y-5">
      <div className="grid gap-4 rounded-2xl border border-border/50 bg-muted/20 p-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="paylink-amount">Monto ({currency})</Label><Input id="paylink-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={Boolean(activeLink)} /></div><div className="space-y-2"><Label htmlFor="paylink-expiration">Vence</Label><Input id="paylink-expiration" type="datetime-local" value={expirationDate} onChange={(event) => setExpirationDate(event.target.value)} disabled={Boolean(activeLink)} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="paylink-description">Descripción</Label><Input id="paylink-description" value={description} onChange={(event) => setDescription(event.target.value)} disabled={Boolean(activeLink)} /></div></div>
      {activeLink && <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm"><p className="font-bold">Ya existe un PayLink activo para este monto.</p><p className="text-muted-foreground">Verifica el estado o cancélalo antes de crear otro.</p></div>}
      {!activeLink && <Button type="button" onClick={() => void create()} disabled={loading || !invoice} className="w-full gap-2"><Link2 className="size-4" />{loading ? 'Creando...' : 'Generar link de pago'}</Button>}
      <div className="space-y-3"><div className="flex items-center justify-between"><h3 className="text-sm font-black uppercase tracking-widest">Historial</h3>{loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}</div>{links.length === 0 && !loading && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Esta factura todavía no tiene links de pago.</p>}{links.map((link) => <div key={link.id} className="space-y-3 rounded-2xl border border-border/60 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold">{money(link.amount, link.currency)}</p><p className="text-xs text-muted-foreground">Creado {displayDate(link.createdAt)} · vence {displayDate(link.expirationDate)}</p></div><Badge variant="outline" className={statusClasses[link.status] || ''}>{link.status === 'RESOLVED' && <CheckCircle2 className="mr-1 size-3" />}{statusLabels[link.status] || link.status}</Badge></div>{link.permanentLink && <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-2"><span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{link.permanentLink}</span><Button type="button" size="icon" variant="ghost" onClick={() => void copy(link)} aria-label="Copiar enlace"><Clipboard className="size-4" /></Button><Button type="button" size="icon" variant="ghost" onClick={() => window.open(link.permanentLink, '_blank', 'noopener,noreferrer')} aria-label="Abrir enlace"><ExternalLink className="size-4" /></Button></div>}{link.errorReason && <p className="text-xs text-rose-600">{link.errorReason}</p>}<div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => void reconcile(link)} disabled={workingId === link.id || link.status === 'RESOLVED'} className="gap-1"><RefreshCw className="size-3.5" />{workingId === link.id ? 'Verificando...' : 'Verificar estado'}</Button>{['CREATED', 'IN_PROGRESS'].includes(link.status) && <Button type="button" size="sm" variant="outline" onClick={() => void cancel(link)} disabled={workingId === link.id} className="gap-1 text-rose-600"><Ban className="size-3.5" />Cancelar</Button>}</div></div>)}</div>
    </div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button></DialogFooter></DialogContent></Dialog>;
}
