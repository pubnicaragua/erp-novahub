import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Truck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, createIdempotencyKey } from '../../services/api';
import { cajaService, type PosHold, type PosPaymentLine } from '../../services/caja.service';
import { SuspendedSalesPanel } from './caja/SuspendedSalesPanel';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { formatSalesAmount } from '../../utils/salesPriceList';
import { isBankPaymentMethod, isCardPaymentMethod, calculateCardCommission, formatCommissionPercent, requiresPaymentReference } from '../../utils/paymentMethods';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

interface EntregasViewProps {
  branchId?: string;
}

export function EntregasView({ branchId }: EntregasViewProps) {
  const queryClient = useQueryClient();
  const [holds, setHolds] = useState<PosHold[]>([]);
  const [holdsLoading, setHoldsLoading] = useState(true);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [deliveryBranchFilter, setDeliveryBranchFilter] = useState('all');
  const [holdToPay, setHoldToPay] = useState<PosHold | null>(null);
  const [holdToDeliver, setHoldToDeliver] = useState<PosHold | null>(null);
  const [holdToCancel, setHoldToCancel] = useState<PosHold | null>(null);
  const [holdActionLoading, setHoldActionLoading] = useState(false);
  const [highlightedHoldId, setHighlightedHoldId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('pending-pos-hold-focus');
    } catch {
      return null;
    }
  });

  const [showPayment, setShowPayment] = useState(false);
  const [payments, setPayments] = useState<PosPaymentLine[]>([{ method: 'CASH', amount: 0 }]);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const loadHolds = useCallback(async (filter: string = deliveryBranchFilter) => {
    setHoldsLoading(true);
    try {
      const res = await cajaService.getHolds({
        deliveryClientTenantId: filter === 'all' ? undefined : filter,
      });
      const data = (res as any)?.data !== undefined ? (res as any).data : res;
      setHolds(data?.items || (Array.isArray(data) ? data : []));
    } catch (error: unknown) {
      if ((error as any)?.name !== 'AbortError') setHolds([]);
    } finally {
      setHoldsLoading(false);
    }
  }, [deliveryBranchFilter]);

  useEffect(() => {
    let active = true;
    api.get<any>('/inventory/warehouse-supply-requests/options').then((res) => {
      const data = Array.isArray(res) ? { branches: res } : (res as any)?.data || res;
      const list = Array.isArray(data?.branches) ? data.branches : [];
      if (active) setBranches(list.map((b: any) => ({ id: b.id, name: b.name })));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  // Sincroniza el filtro de sucursal de entrega con la sucursal seleccionada
  // en el selector global del módulo.
  useEffect(() => {
    const targetFilter = branchId || 'all';
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setDeliveryBranchFilter((current) => (current === targetFilter ? current : targetFilter));
      await loadHolds(targetFilter);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  // Si el usuario llegó desde una notificación, resalta el hold objetivo.
  useEffect(() => {
    if (!highlightedHoldId) return;
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setHoldsLoading(true);
      try {
        const res = await cajaService.getHolds({});
        const data = (res as any)?.data !== undefined ? (res as any).data : res;
        const allHolds = data?.items || (Array.isArray(data) ? data : []);
        const target = allHolds.find((h: PosHold) => h.id === highlightedHoldId);
        if (!target) return;
        if (target.deliveryClientTenantId) {
          setDeliveryBranchFilter(target.deliveryClientTenantId);
          await loadHolds(target.deliveryClientTenantId);
        } else {
          setHolds(allHolds);
        }
      } catch {
        // El foco es informativo; si falla la carga, no se interrumpe la vista.
      } finally {
        if (active) setHoldsLoading(false);
      }
    })();
    try {
      sessionStorage.removeItem('pending-pos-hold-focus');
    } catch {
      // El almacenamiento es opcional; el foco ya se procesó en memoria.
    }
    const clearTimer = setTimeout(() => {
      if (active) setHighlightedHoldId(null);
    }, 8000);
    return () => {
      active = false;
      clearTimeout(clearTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedHoldId]);

  const openHoldPayment = (hold: PosHold) => {
    setHoldToPay(hold);
    setPayments([{ method: 'CASH', amount: 0 }]);
    setShowPayment(true);
  };

  const submitHoldPayPayment = async () => {
    if (!holdToPay || submittingRef.current) return;
    const received = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    if (received + 0.005 < Number(holdToPay.total)) {
      toast.error('El monto recibido debe ser igual o mayor al total');
      return;
    }
    if (payments.some((payment) => requiresPaymentReference(payment.method) && !payment.reference?.trim())) {
      toast.error('La transferencia, tarjeta o cheque requiere una referencia');
      return;
    }
    if (payments.some((payment) => isBankPaymentMethod(payment.method) && !payment.bankAccountId)) {
      toast.error('Selecciona el banco global para cada pago con tarjeta, transferencia o cheque');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    const submitToastId = toast.loading('Cobrando venta suspendida...');
    try {
      const res = await cajaService.confirmHold(
        holdToPay.id,
        {
          currency: 'NIO',
          exchangeRate: Number(holdToPay.exchangeRate || 1),
          payments,
        },
        createIdempotencyKey('holdpay'),
      );
      const created = (res as any)?.data || res;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales'] }),
        queryClient.invalidateQueries({ queryKey: ['finance'] }),
        queryClient.invalidateQueries({ queryKey: ['accounting'] }),
      ]);
      toast.success(`Venta ${created.number} cobrada. Factura ${created.invoiceNumber || ''} emitida.`, { id: submitToastId });
      setShowPayment(false);
      setHoldToPay(null);
      void loadHolds();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Error al cobrar la venta'), { id: submitToastId });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleDeliverHold = async () => {
    if (!holdToDeliver) return;
    setHoldActionLoading(true);
    try {
      const res = await cajaService.deliverHold(holdToDeliver.id, createIdempotencyKey('holddeliver'));
      const created = (res as any)?.data || res;
      toast.success(`Venta ${created.number} entregada. Inventario descontado en ${created.deliveryBranch?.name || 'la sucursal de entrega'}.`);
      setHoldToDeliver(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory'] }),
        loadHolds(),
      ]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Error al registrar la entrega'));
    } finally {
      setHoldActionLoading(false);
    }
  };

  const handleCancelHold = async () => {
    if (!holdToCancel) return;
    setHoldActionLoading(true);
    try {
      const res = await cajaService.cancelHold(holdToCancel.id, createIdempotencyKey('holdcancel'));
      const created = (res as any)?.data || res;
      toast.success(`Venta suspendida ${created.number} cancelada. La reserva de inventario fue liberada.`);
      setHoldToCancel(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory'] }),
        loadHolds(),
      ]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Error al cancelar la venta'));
    } finally {
      setHoldActionLoading(false);
    }
  };

  const summary = useMemo(() => {
    const pending = holds.filter((hold) => hold.status !== 'DELIVERED' && hold.status !== 'CANCELLED');
    const ready = holds.filter((hold) => hold.status === 'READY' && hold.deliveryStatus !== 'DELIVERED');
    const delivered = holds.filter((hold) => hold.status === 'DELIVERED');
    const suspended = holds.filter((hold) => hold.status === 'SUSPENDED');
    return { pending, ready, delivered, suspended };
  }, [holds]);

  return (
    <div className="space-y-4">
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-tight">
                <Truck className="size-4 text-primary" /> Entregas
              </h3>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Ventas facturadas o reservadas cuya entrega ocurre desde otra sucursal.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-blue-500/30 bg-blue-500/5 text-blue-600 text-[10px] dark:text-blue-400">
                {summary.ready.length} por entregar
              </Badge>
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/5 text-amber-600 text-[10px] dark:text-amber-400">
                {summary.suspended.length} sin cobrar
              </Badge>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/5 text-emerald-600 text-[10px] dark:text-emerald-400">
                {summary.delivered.length} entregadas
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {holdsLoading && holds.length === 0 ? (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-primary" />
            <p className="text-xs">Cargando ventas suspendidas...</p>
          </CardContent>
        </Card>
      ) : (
        <SuspendedSalesPanel
          holds={holds}
          loading={holdsLoading}
          branches={branches}
          deliveryBranchFilter={deliveryBranchFilter}
          onDeliveryBranchFilterChange={(value) => {
            setDeliveryBranchFilter(value);
            setHoldsLoading(true);
            void loadHolds(value);
          }}
          canPay
          canDeliver={() => true}
          onConfirm={openHoldPayment}
          onDeliver={(hold) => setHoldToDeliver(hold)}
          onCancel={(hold) => setHoldToCancel(hold)}
          highlightHoldId={highlightedHoldId}
        />
      )}

      {showPayment && holdToPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[calc(100dvh-2rem)] w-full min-w-0 max-w-xl overflow-y-auto rounded-2xl border bg-background p-4 shadow-2xl sm:p-6">
            <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-black">Cobrar venta suspendida</h2>
                <p className="text-xs font-bold text-primary">{holdToPay.number} · {holdToPay.customer?.name || holdToPay.customCustomerName || 'Cliente General'}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Entrega desde {holdToPay.deliveryBranch?.name || 'la sucursal de entrega'}</p>
              </div>
              <Button type="button" variant="ghost" className="text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Cerrar pago de venta suspendida" title="Cerrar" onClick={() => { setShowPayment(false); setHoldToPay(null); }}>✕</Button>
            </div>

            <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-primary/10 p-3">
                <span className="text-xs text-primary font-bold">Total a cobrar</span>
                <div className="text-xl font-black text-primary">C$ {formatSalesAmount(Number(holdToPay.total))}</div>
              </div>
              <div className="rounded-xl bg-muted/40 p-3 border border-border/50">
                <span className="text-xs text-muted-foreground">Total pagado</span>
                <div className="text-xl font-black">C$ {formatSalesAmount(payments.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</div>
              </div>
            </div>

            <div className="mb-4 space-y-2">
              <Label>Moneda de pago</Label>
              <div className="flex h-10 items-center rounded-xl border border-border/50 bg-muted/20 px-3 text-sm font-bold">
                Córdobas (NIO)
                <span className="ml-2 text-[10px] font-normal text-muted-foreground">Las ventas suspendidas se cobran en córdobas.</span>
              </div>
            </div>

            <div className="space-y-3">
              {payments.map((payment, index) => (
                <div key={`${payment.method}-${index}`} className="rounded-xl border p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <Select value={payment.method} onValueChange={(value: PosPaymentLine['method']) => setPayments(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, method: value, reference: value === 'TRANSFER' || value === 'CHECK' ? item.reference : undefined, bankAccountId: isBankPaymentMethod(value) ? item.bankAccountId : undefined, cardCommissionPercent: value === 'CARD' ? item.cardCommissionPercent : 0, cardCommissionAmount: value === 'CARD' ? item.cardCommissionAmount : 0 } : item))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">Efectivo</SelectItem>
                        <SelectItem value="CARD">Tarjeta</SelectItem>
                        <SelectItem value="TRANSFER">Transferencia</SelectItem>
                        <SelectItem value="CHECK">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" min="0" step="0.01" placeholder="Monto" value={payment.amount || ''} onChange={(event) => setPayments(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: Number(event.target.value) || 0, cardCommissionAmount: isCardPaymentMethod(item.method) ? calculateCardCommission(Number(event.target.value) || 0, Number(item.cardCommissionPercent || 0)) : item.cardCommissionAmount } : item))} />
                    <Button variant="ghost" disabled={payments.length === 1} onClick={() => setPayments(current => current.filter((_, itemIndex) => itemIndex !== index))}>✕</Button>
                  </div>
                  {payment.method === 'CARD' && <Input className="mt-2" placeholder="Voucher / referencia *" value={payment.reference || ''} onChange={(event) => setPayments(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, reference: event.target.value } : item))} />}
                  {payment.method === 'TRANSFER' && (
                    <Input className="mt-2" placeholder="ID de referencia *" value={payment.reference || ''} onChange={(event) => setPayments(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, reference: event.target.value } : item))} />
                  )}
                  {payment.method === 'CHECK' && <Input className="mt-2" placeholder="Número de cheque *" value={payment.reference || ''} onChange={(event) => setPayments(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, reference: event.target.value } : item))} />}
                  {isBankPaymentMethod(payment.method) && <BankAccountSelect className="mt-2" value={payment.bankAccountId} onChange={(bankAccountId) => setPayments(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, bankAccountId } : item))} onAccountSelect={(account) => setPayments(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, cardCommissionPercent: account?.cardCommissionPercent || 0, cardCommissionAmount: isCardPaymentMethod(item.method) ? calculateCardCommission(Number(item.amount || 0), account?.cardCommissionPercent || 0) : 0, cardCommissionAccountId: account?.cardCommissionAccountId || undefined } : item))} label="Banco global de destino" />}
                  {isCardPaymentMethod(payment.method) && payment.bankAccountId && Number(payment.cardCommissionPercent || 0) > 0 && (
                    <div className="mt-2 flex items-center gap-3 rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-[10px]">
                      <span className="font-black uppercase tracking-widest text-purple-600">Comisión:</span>
                      <span className="font-mono font-bold">{formatCommissionPercent(payment.cardCommissionPercent)}</span>
                      <span className="text-muted-foreground">|</span>
                      <span className="font-black uppercase tracking-widest text-muted-foreground">Monto:</span>
                      <span className="font-mono font-bold text-purple-600">C$ {formatSalesAmount(Number(payment.cardCommissionAmount || calculateCardCommission(Number(payment.amount || 0), Number(payment.cardCommissionPercent || 0))))}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button variant="outline" className="mt-3 w-full" onClick={() => setPayments(current => [...current, { method: 'CARD', amount: 0 }])}>+ Agregar pago mixto</Button>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setShowPayment(false); setHoldToPay(null); }}>Cancelar</Button>
              <Button onClick={() => void submitHoldPayPayment()} disabled={submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : 'Cobrar venta'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(holdToDeliver)}
        onOpenChange={(open) => { if (!open) setHoldToDeliver(null); }}
        title="Confirmar entrega"
        description={`¿Confirmás la entrega de ${holdToDeliver?.number || 'la venta suspendida'}? Se descontará el inventario del almacén de ${holdToDeliver?.deliveryBranch?.name || 'la sucursal de entrega'} y se registrará el movimiento de salida.`}
        confirmLabel="Marcar entregado"
        cancelLabel="Revisar"
        variant="default"
        loading={holdActionLoading}
        onConfirm={() => void handleDeliverHold()}
      />
      <ConfirmDialog
        open={Boolean(holdToCancel)}
        onOpenChange={(open) => { if (!open) setHoldToCancel(null); }}
        title="Cancelar venta suspendida"
        description={`¿Seguro que deseas cancelar ${holdToCancel?.number || 'la venta suspendida'}? Se liberará la reserva del inventario en la sucursal de entrega.`}
        confirmLabel="Cancelar venta"
        cancelLabel="Revisar"
        variant="warning"
        loading={holdActionLoading}
        onConfirm={() => void handleCancelHold()}
      />
    </div>
  );
}
