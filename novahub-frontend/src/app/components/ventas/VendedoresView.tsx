import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, CircleDollarSign, Loader2, Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { useTenantQuery, invalidateTenantQueries } from '../../hooks/useTenantQuery';
import { useCurrency } from '../../contexts/CurrencyContext';
import { salesSellersService, type SalesSellerCommissionRule } from '../../services/sales-sellers.service';

type Section = 'vendedores' | 'comisiones' | 'metas' | 'pagos';
type CommissionBasis = 'PER_SALE' | 'MONTHLY_TOTAL';
type CommissionRuleDraft = { minAmount: number | string; maxAmount: number | string; rate: number | string };

const money = (amount: number, currency: string) => new Intl.NumberFormat('es-NI', {
  style: 'currency', currency: currency === 'USD' ? 'USD' : 'NIO', maximumFractionDigits: 2,
}).format(Number(amount || 0));
const localDateInputValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const commissionStatusLabels: Record<string, string> = {
  PENDING: 'Pendiente de cobro', EARNED: 'Disponible para pago', PAID_DIRECT: 'Pagada', CANCELLED: 'Anulada',
};
const commissionStatus = (status: string) => commissionStatusLabels[status] || status;

const payoutStatusLabels: Record<string, string> = { PAID: 'Pagado', REVERSED: 'Revertido', REVERSAL: 'Reversión' };
const payoutStatus = (status: string) => payoutStatusLabels[status] || status;

export function VendedoresView({ historicalOnly = false }: { historicalOnly?: boolean }) {
  const queryClient = useQueryClient();
  const { baseCurrency } = useCurrency();
  const [section, setSection] = useState<Section>(historicalOnly ? 'pagos' : 'vendedores');
  const [selectedSellerId, setSelectedSellerId] = useState('');
  const [name, setName] = useState('');
  const [commissionCurrency, setCommissionCurrency] = useState('NIO');
  const [commissionBasis, setCommissionBasis] = useState<CommissionBasis>('PER_SALE');
  const [commissionRules, setCommissionRules] = useState<CommissionRuleDraft[]>([{ minAmount: 0, maxAmount: '', rate: '' }]);
  const [goalTitle, setGoalTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [minimumAmount, setMinimumAmount] = useState('');
  const [minimumReward, setMinimumReward] = useState('');
  const [stretchAmount, setStretchAmount] = useState('');
  const [stretchReward, setStretchReward] = useState('');
  const [rewardAmount, setRewardAmount] = useState('');
  const [periodStart, setPeriodStart] = useState(localDateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [periodEnd, setPeriodEnd] = useState(localDateInputValue(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)));
  const [selectedCommissionIds, setSelectedCommissionIds] = useState<string[]>([]);
  const [selectedAwardIds, setSelectedAwardIds] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [bankAccountId, setBankAccountId] = useState('');
  const [paymentReference, setPaymentReference] = useState('');

  const sellersQuery = useTenantQuery(['sales', 'sellers'], (signal) => salesSellersService.list(undefined, signal));
  const configurationQuery = useTenantQuery(['sales', 'seller-commission-config'], (signal) => salesSellersService.getCommissionConfiguration(signal));
  const goalsQuery = useTenantQuery(['sales', 'seller-goals'], (signal) => salesSellersService.listGoals(undefined, signal));
  const payableQuery = useTenantQuery(['sales', 'seller-payable'], (signal) => salesSellersService.listPayable(undefined, signal));
  const payoutsQuery = useTenantQuery(['sales', 'seller-payouts'], (signal) => salesSellersService.listPayouts(undefined, signal));
  const commissionsHistoryQuery = useTenantQuery(
    ['sales', 'seller-commission-history', selectedSellerId],
    (signal) => salesSellersService.listCommissions(selectedSellerId && selectedSellerId !== 'all' ? selectedSellerId : undefined, signal),
    { enabled: section === 'pagos', retry: 0 },
  );
  const integrationPolicyQuery = useTenantQuery(['sales', 'integration-policy'], (signal) => salesSellersService.getIntegrationPolicy(signal), { enabled: section === 'pagos', staleTime: 60_000, retry: 0 });

  const sellers = sellersQuery.data?.data || [];
  const payable = payableQuery.data || { commissions: [], awards: [] };
  const commissionPlan = configurationQuery.data?.sellerPlans?.find((plan: any) => plan.sellerId === selectedSellerId || plan.salesSeller?.id === selectedSellerId);
  const selectedSellerHasCommissionPlan = Boolean(commissionPlan);
  const selectedSellerHasActiveGoal = (goalsQuery.data || []).some((goal) => goal.sellerId === selectedSellerId && goal.status === 'ACTIVE' && new Date(goal.periodEnd).getTime() > Date.now());
  const integrationPolicy = integrationPolicyQuery.data;
  const bankMethod = ['TRANSFER', 'CHECK', 'CARD'].includes(paymentMethod);
  const referenceRequired = ['TRANSFER', 'CHECK', 'CARD', 'QR', 'VOUCHER'].includes(paymentMethod);
  const bankMethodsAvailable = Boolean(integrationPolicy?.financeEnabled || integrationPolicy?.accountingEnabled);
  const paidByCurrency = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const payout of payoutsQuery.data || []) {
      if (payout.status !== 'PAID' && payout.status !== 'REVERSAL') continue;
      if (selectedSellerId && selectedSellerId !== 'all' && payout.sellerId !== selectedSellerId) continue;
      const currency = payout.currency || 'NIO';
      totals[currency] = (totals[currency] || 0) + Number(payout.amount || 0);
    }
    return totals;
  }, [payoutsQuery.data, selectedSellerId]);
  const selectedCommissions = useMemo(() => payable.commissions.filter((item) => selectedCommissionIds.includes(item.id)), [payable.commissions, selectedCommissionIds]);
  const selectedAwards = useMemo(() => payable.awards.filter((item) => selectedAwardIds.includes(item.id)), [payable.awards, selectedAwardIds]);
  const selectedCurrency = selectedCommissions[0]?.currency || selectedAwards[0]?.currency || baseCurrency || 'NIO';
  const mixedCurrency = [...selectedCommissions, ...selectedAwards].some((item) => item.currency !== selectedCurrency);

  useEffect(() => {
    setCommissionCurrency(commissionPlan?.currency === 'USD' ? 'USD' : commissionPlan?.currency === 'NIO' ? 'NIO' : baseCurrency || 'NIO');
    setCommissionBasis(commissionPlan?.calculationBasis === 'MONTHLY_TOTAL' ? 'MONTHLY_TOTAL' : 'PER_SALE');
    setCommissionRules(commissionPlan?.rules?.length
      ? commissionPlan.rules.map((rule: any) => ({ minAmount: rule.minAmount, maxAmount: rule.maxAmount ?? '', rate: rule.rate }))
      : [{ minAmount: 0, maxAmount: '', rate: '' }]);
  }, [baseCurrency, commissionPlan, selectedSellerId]);

  useEffect(() => {
    if (historicalOnly && (section === 'vendedores' || section === 'comisiones')) setSection('pagos');
  }, [historicalOnly, section]);

  const refresh = () => invalidateTenantQueries(queryClient);
  const createSeller = useMutation({
    mutationFn: () => salesSellersService.create({ name: name.trim() }),
    onSuccess: (seller) => {
      setName(''); setSelectedSellerId(seller.id); refresh(); toast.success(`Vendedor creado con código ${seller.code}.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const savePlan = useMutation({
    mutationFn: () => {
      const rules: SalesSellerCommissionRule[] = commissionRules.map((rule) => ({
        minAmount: Number(rule.minAmount), maxAmount: rule.maxAmount === '' ? null : Number(rule.maxAmount), rate: Number(rule.rate),
      }));
      if (!rules.length || rules.some((rule) => !Number.isFinite(rule.minAmount) || !Number.isFinite(rule.rate) || (rule.maxAmount !== null && !Number.isFinite(rule.maxAmount)))) {
        throw new Error('Completa los límites y porcentajes de todos los tramos.');
      }
      if (rules[0].minAmount !== 0 || rules[rules.length - 1].maxAmount !== null) throw new Error('La escala debe iniciar en cero y terminar sin límite máximo.');
      for (let index = 0; index < rules.length - 1; index += 1) {
        if (rules[index].maxAmount === null || Math.round(rules[index + 1].minAmount * 100) !== Math.round(rules[index].maxAmount * 100) + 1) {
          throw new Error(`Los tramos ${index + 1} y ${index + 2} deben ser consecutivos.`);
        }
      }
      return salesSellersService.saveCommissionPlan({ sellerId: selectedSellerId, currency: commissionCurrency, calculationBasis: commissionBasis, rules });
    },
    onSuccess: () => { refresh(); toast.success('Comisión guardada.'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const resetPlan = useMutation({
    mutationFn: () => salesSellersService.resetCommissionPlan(selectedSellerId),
    onSuccess: () => { refresh(); toast.success('Comisión restablecida. El vendedor podrá usar metas de ventas.'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const createGoal = useMutation({
    mutationFn: () => salesSellersService.createGoal({
      sellerId: selectedSellerId, title: goalTitle.trim(), targetAmount: Number(targetAmount), rewardAmount: Number(rewardAmount),
      minimumAmount: minimumAmount ? Number(minimumAmount) : null, minimumReward: minimumReward ? Number(minimumReward) : null,
      stretchAmount: stretchAmount ? Number(stretchAmount) : null, stretchReward: stretchReward ? Number(stretchReward) : null,
      currency: baseCurrency || 'NIO', periodStart, periodEnd,
    }),
    onSuccess: () => { setGoalTitle(''); refresh(); toast.success('Meta creada.'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const evaluateGoals = useMutation({
    mutationFn: salesSellersService.evaluateGoals,
    onSuccess: (result) => { refresh(); toast.success(`Evaluación lista. ${result.awardsCreated} recompensas pendientes de aprobación.`); },
    onError: (error: Error) => toast.error(error.message),
  });
  const approveAward = useMutation({
    mutationFn: (id: string) => salesSellersService.approveAward(id, true),
    onSuccess: () => { refresh(); toast.success('Recompensa aprobada.'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const pay = useMutation({
    mutationFn: () => salesSellersService.pay({
      sellerId: selectedSellerId, commissionIds: selectedCommissionIds, awardIds: selectedAwardIds,
      currency: selectedCurrency, method: paymentMethod, bankAccountId: bankAccountId || undefined,
      reference: paymentReference.trim() || undefined,
    }),
    onSuccess: () => { setSelectedCommissionIds([]); setSelectedAwardIds([]); setPaymentReference(''); refresh(); toast.success('Pago registrado.'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const reversePayout = useMutation({
    mutationFn: (id: string) => salesSellersService.reversePayout(id, 'Reversión registrada desde Vendedores'),
    onSuccess: () => { refresh(); toast.success('Pago revertido.'); },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleId = (current: string[], setter: (next: string[]) => void, id: string, checked: boolean) => {
    setter(checked ? [...new Set([...current, id])] : current.filter((value) => value !== id));
  };

  const addCommissionRule = () => setCommissionRules((current) => {
    const last = current[current.length - 1];
    if (!last) return [{ minAmount: 0, maxAmount: '', rate: '' }];
    const nextMin = last.maxAmount === ''
      ? Math.max(1000, Number(last.minAmount || 0) + 1000)
      : Math.round((Number(last.maxAmount) + 0.01) * 100) / 100;
    const updated = last.maxAmount === '' ? { ...last, maxAmount: Math.round((nextMin - 0.01) * 100) / 100 } : last;
    return [...current.slice(0, -1), updated, { minAmount: nextMin, maxAmount: '', rate: last.rate }];
  });

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden p-4 sm:p-6 md:p-8">
      <header className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-primary"><Users className="size-5" /><span className="text-xs font-semibold uppercase tracking-widest">Ventas</span></div>
          <h1 className="mt-1 text-2xl font-black italic tracking-tight sm:text-3xl">{historicalOnly ? 'HISTORIAL DE VENDEDORES INDEPENDIENTES' : 'VENDEDORES'}</h1>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Apartados de vendedores">
          {(historicalOnly ? [
            ['metas', 'Metas'], ['pagos', 'Liquidaciones'],
          ] as const : [
            ['vendedores', 'Vendedores'], ['comisiones', 'Comisiones'], ['metas', 'Metas'], ['pagos', 'Liquidaciones'],
          ] as const).map(([id, label]) => (
            <Button key={id} size="sm" variant={section === id ? 'default' : 'outline'} role="tab" aria-selected={section === id} onClick={() => setSection(id)}>{label}</Button>
          ))}
        </div>
      </header>

      {section === 'vendedores' && <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <Card className="min-w-0 rounded-2xl border-border bg-card shadow-sm">
          <CardHeader><CardTitle>Directorio</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {sellersQuery.isPending ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Cargando vendedores…</div>
              : sellersQuery.isError ? <div className="text-sm text-destructive">No se pudo cargar el directorio.</div>
                : sellers.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay vendedores registrados.</p>
                  : sellers.map((seller) => <button key={seller.id} type="button" onClick={() => setSelectedSellerId(seller.id)} className={`flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedSellerId === seller.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <span className="min-w-0"><span className="block truncate font-semibold">{seller.name}</span><span className="block truncate text-xs text-muted-foreground">{seller.code}{seller.email ? ` · ${seller.email}` : ''}</span></span>
                    <Badge variant={seller.isActive ? 'default' : 'secondary'}>{seller.isActive ? 'Activo' : 'Archivado'}</Badge>
                  </button>)}
          </CardContent>
        </Card>
        <Card className="min-w-0 rounded-2xl border-border bg-card shadow-sm">
          <CardHeader><CardTitle>Agregar vendedor</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label htmlFor="sales-seller-name">Nombre</Label><Input id="sales-seller-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={160} /></div>
            <Button disabled={!name.trim() || createSeller.isPending} onClick={() => createSeller.mutate()}><Plus className="mr-2 size-4" />Crear vendedor</Button>
          </CardContent>
        </Card>
      </div>}

      {section === 'comisiones' && <Card className="min-w-0 rounded-2xl border-border bg-card shadow-sm">
        <CardHeader><CardTitle>Escala de comisiones</CardTitle></CardHeader>
        <CardContent className="min-w-0 space-y-4">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="seller-commission-select">Vendedor</Label><Select value={selectedSellerId} onValueChange={setSelectedSellerId}><SelectTrigger id="seller-commission-select"><SelectValue placeholder="Seleccionar vendedor" /></SelectTrigger><SelectContent>{sellers.filter((seller) => seller.isActive).map((seller) => <SelectItem key={seller.id} value={seller.id}>{seller.name} · {seller.code}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="seller-commission-currency">Moneda</Label><Select value={commissionCurrency} onValueChange={setCommissionCurrency}><SelectTrigger id="seller-commission-currency"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NIO">Córdobas (NIO)</SelectItem><SelectItem value="USD">Dólares (USD)</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="seller-commission-basis">Base de cálculo</Label><Select value={commissionBasis} onValueChange={(value) => setCommissionBasis(value as CommissionBasis)}><SelectTrigger id="seller-commission-basis"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PER_SALE">Cada venta</SelectItem><SelectItem value="MONTHLY_TOTAL">Total del mes</SelectItem></SelectContent></Select></div>
          </div>
          <p className="text-xs text-muted-foreground">{commissionBasis === 'MONTHLY_TOTAL' ? 'El tramo usa el total vendido en el mes y recalcula las comisiones mientras no estén en nómina ni pagadas.' : 'Cada venta se compara con los tramos. Las comisiones se habilitan después del cobro completo, también en ventas a crédito.'} Un vendedor puede usar comisión o metas con recompensa; restablece la comisión para cambiar de modalidad.</p>
          {selectedSellerHasActiveGoal && <p className="text-sm text-amber-600 dark:text-amber-400">Este vendedor tiene una meta activa. Finalízala antes de guardar una comisión.</p>}
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/30 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-3">Desde</th><th className="px-3 py-3">Hasta (inclusive)</th><th className="px-3 py-3">Porcentaje</th><th className="w-14 px-3 py-3 text-right">Quitar</th></tr></thead>
              <tbody>{commissionRules.map((rule, index) => <tr key={`sales-commission-rule-${index}`} className="border-t border-border/50">
                <td className="p-2"><Input type="number" min="0" step="0.01" value={rule.minAmount} onChange={(event) => setCommissionRules((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, minAmount: event.target.value } : row))} aria-label={`Mínimo del tramo ${index + 1}`} /></td>
                <td className="p-2"><Input type="number" min="0" step="0.01" value={rule.maxAmount} placeholder={index === commissionRules.length - 1 ? 'Sin límite' : 'Máximo'} onChange={(event) => setCommissionRules((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, maxAmount: event.target.value } : row))} aria-label={`Máximo del tramo ${index + 1}`} /></td>
                <td className="p-2"><Input type="number" min="0" max="100" step="0.01" value={rule.rate} onChange={(event) => setCommissionRules((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, rate: event.target.value } : row))} aria-label={`Porcentaje del tramo ${index + 1}`} /></td>
                <td className="p-2 text-right"><Button type="button" size="icon" variant="ghost" aria-label={`Eliminar tramo ${index + 1}`} disabled={commissionRules.length === 1 || savePlan.isPending} onClick={() => setCommissionRules((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="size-4 text-destructive" /></Button></td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">El primer tramo inicia en 0 y el último queda abierto.</p><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={addCommissionRule} disabled={savePlan.isPending || resetPlan.isPending}><Plus className="mr-2 size-4" />Agregar tramo</Button>{commissionPlan && <Button type="button" variant="outline" onClick={() => resetPlan.mutate()} disabled={!selectedSellerId || resetPlan.isPending}><RefreshCw className="mr-2 size-4" />Restablecer comisión</Button>}<Button disabled={!selectedSellerId || selectedSellerHasActiveGoal || savePlan.isPending || resetPlan.isPending || commissionRules.some((rule) => rule.rate === '')} onClick={() => savePlan.mutate()}><CircleDollarSign className="mr-2 size-4" />Guardar escala</Button></div></div>
        </CardContent>
      </Card>}

      {section === 'metas' && <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        {!historicalOnly && <Card className="min-w-0 rounded-2xl border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle>Nueva meta de ventas</CardTitle><Button size="sm" variant="outline" onClick={() => evaluateGoals.mutate()} disabled={evaluateGoals.isPending}><RefreshCw className="mr-2 size-4" />Evaluar cierres</Button></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="seller-goal-seller">Vendedor</Label><Select value={selectedSellerId} onValueChange={setSelectedSellerId}><SelectTrigger id="seller-goal-seller"><SelectValue placeholder="Seleccionar vendedor" /></SelectTrigger><SelectContent>{sellers.filter((seller) => seller.isActive).map((seller) => <SelectItem key={seller.id} value={seller.id}>{seller.name} · {seller.code}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="seller-goal-title">Descripción</Label><Input id="seller-goal-title" value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="seller-goal-start">Desde</Label><Input id="seller-goal-start" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="seller-goal-end">Hasta</Label><Input id="seller-goal-end" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="seller-goal-target">Meta principal</Label><Input id="seller-goal-target" type="number" min="0.01" step="0.01" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="seller-goal-reward">Recompensa principal</Label><Input id="seller-goal-reward" type="number" min="0.01" step="0.01" value={rewardAmount} onChange={(event) => setRewardAmount(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="seller-goal-minimum">Nivel mínimo (opcional)</Label><Input id="seller-goal-minimum" type="number" min="0.01" step="0.01" value={minimumAmount} onChange={(event) => setMinimumAmount(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="seller-goal-minimum-reward">Recompensa mínima</Label><Input id="seller-goal-minimum-reward" type="number" min="0.01" step="0.01" value={minimumReward} onChange={(event) => setMinimumReward(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="seller-goal-stretch">Nivel superior (opcional)</Label><Input id="seller-goal-stretch" type="number" min="0.01" step="0.01" value={stretchAmount} onChange={(event) => setStretchAmount(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="seller-goal-stretch-reward">Recompensa superior</Label><Input id="seller-goal-stretch-reward" type="number" min="0.01" step="0.01" value={stretchReward} onChange={(event) => setStretchReward(event.target.value)} /></div>
            {selectedSellerHasCommissionPlan && <p className="text-sm text-amber-600 dark:text-amber-400 sm:col-span-2">Este vendedor tiene una comisión activa. Restablécela antes de asignarle metas con recompensa.</p>}
            <Button className="sm:col-span-2" disabled={!selectedSellerId || selectedSellerHasCommissionPlan || !goalTitle.trim() || !targetAmount || !rewardAmount || createGoal.isPending} onClick={() => createGoal.mutate()}><Plus className="mr-2 size-4" />Crear meta</Button>
          </CardContent>
        </Card>}
        <Card className="min-w-0 rounded-2xl border-border bg-card shadow-sm">
          <CardHeader><CardTitle>Seguimiento y recompensas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {goalsQuery.isPending ? <p className="text-sm text-muted-foreground">Cargando metas…</p> : (goalsQuery.data || []).length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay metas configuradas.</p> : (goalsQuery.data || []).map((goal) => {
              const progress = Math.min(100, goal.targetAmount > 0 ? (goal.achievedAmount / goal.targetAmount) * 100 : 0);
              return <div key={goal.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{goal.title}</p><p className="text-xs text-muted-foreground">{goal.seller.name} · {goal.periodStartDate || goal.periodStart.slice(0, 10)} — {goal.periodEndDate || goal.periodEnd.slice(0, 10)}</p></div>{goal.award && <Badge variant={goal.award.status === 'PENDING_APPROVAL' ? 'secondary' : 'default'}>{goal.award.status === 'PENDING_APPROVAL' ? 'Por aprobar' : goal.award.status}</Badge>}</div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs"><span>{money(goal.achievedAmount, goal.currency)} de {money(goal.targetAmount, goal.currency)}</span>{goal.award && <span>Recompensa {money(goal.award.amount, goal.award.currency)} · {goal.award.level}</span>}</div>
                {goal.award?.status === 'PENDING_APPROVAL' && <Button className="mt-3" size="sm" onClick={() => approveAward.mutate(goal.award!.id)} disabled={approveAward.isPending}><BadgeCheck className="mr-2 size-4" />Aprobar recompensa</Button>}
              </div>;
            })}
          </CardContent>
        </Card>
      </div>}

      {section === 'pagos' && <div className="space-y-4">
        <Card className="min-w-0 rounded-2xl border-border bg-card shadow-sm">
          <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-3">
            <CardTitle>Incentivos disponibles para pago</CardTitle>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Select value={selectedSellerId} onValueChange={(value) => { setSelectedSellerId(value); setSelectedCommissionIds([]); setSelectedAwardIds([]); }}><SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Todos los vendedores" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los vendedores</SelectItem>{sellers.map((seller) => <SelectItem key={seller.id} value={seller.id}>{seller.name}</SelectItem>)}</SelectContent></Select>
              <Select value={paymentMethod} onValueChange={(value) => { setPaymentMethod(value); setBankAccountId(''); }}><SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CASH">Efectivo</SelectItem>{bankMethodsAvailable && <><SelectItem value="TRANSFER">Transferencia</SelectItem><SelectItem value="CHECK">Cheque</SelectItem><SelectItem value="CARD">Tarjeta</SelectItem></>}<SelectItem value="QR">QR</SelectItem><SelectItem value="VOUCHER">Vale</SelectItem></SelectContent></Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {integrationPolicyQuery.isError && <p className="text-xs text-muted-foreground">No se pudo consultar la conexión con Finanzas y Contabilidad; se puede registrar pago en efectivo.</p>}
            {bankMethod && bankMethodsAvailable && <BankAccountSelect currency={selectedCurrency} allowUnlinked={Boolean(integrationPolicy?.financeEnabled && !integrationPolicy?.accountingEnabled)} required={Boolean(integrationPolicy?.accountingEnabled)} endpoint="/bank-accounts/payment-options" value={bankAccountId} onChange={setBankAccountId} label="Cuenta bancaria de salida" showCommissionPercent={false} />}
            <div className="space-y-2"><Label htmlFor="seller-payout-reference">Referencia de pago{referenceRequired ? ' *' : ' (opcional)'}</Label><Input id="seller-payout-reference" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} required={referenceRequired} placeholder="Voucher, cheque o transferencia" /></div>
            {[...payable.commissions.map((item) => ({ id: item.id, type: 'commission' as const, seller: item.seller, amount: item.amount, currency: item.currency, label: item.invoice?.number || item.creditNote?.number || 'Comisión por venta', status: 'Disponible' })), ...payable.awards.map((item) => ({ id: item.id, type: 'award' as const, seller: item.goal.seller, amount: item.amount, currency: item.currency, label: `${item.goal.title} · ${item.level}`, status: 'Aprobada' }))]
              .filter((item) => !selectedSellerId || selectedSellerId === 'all' || item.seller.id === selectedSellerId)
              .map((item) => {
                const selected = item.type === 'commission' ? selectedCommissionIds.includes(item.id) : selectedAwardIds.includes(item.id);
                return <label key={`${item.type}:${item.id}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-border p-3">
                  <input type="checkbox" checked={selected} onChange={(event) => item.type === 'commission'
                    ? toggleId(selectedCommissionIds, setSelectedCommissionIds, item.id, event.target.checked)
                    : toggleId(selectedAwardIds, setSelectedAwardIds, item.id, event.target.checked)} />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{item.seller.name} · {item.label}</span><span className="text-xs text-muted-foreground">{item.status}</span></span>
                  <span className="shrink-0 font-semibold">{money(item.amount, item.currency)}</span>
                </label>;
              })}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"><span className="text-sm">Seleccionado {money([...selectedCommissions, ...selectedAwards].reduce((sum, item) => sum + Number(item.amount), 0), selectedCurrency)}</span><Button disabled={!selectedSellerId || selectedSellerId === 'all' || (!selectedCommissionIds.length && !selectedAwardIds.length) || mixedCurrency || (bankMethod && !bankAccountId) || (referenceRequired && !paymentReference.trim()) || pay.isPending} onClick={() => pay.mutate()}>{pay.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Registrar pago</Button></div>
            {mixedCurrency && <p className="text-sm text-destructive">Agrupa incentivos de una sola moneda por pago.</p>}
          </CardContent>
        </Card>
        <Card className="min-w-0 rounded-2xl border-border bg-card shadow-sm">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Historial de liquidaciones</CardTitle><div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">Pagado neto histórico:</span>{Object.keys(paidByCurrency).length ? Object.entries(paidByCurrency).map(([currency, amount]) => <Badge key={currency} variant="secondary">{money(amount, currency)}</Badge>) : <Badge variant="secondary">{money(0, baseCurrency || 'NIO')}</Badge>}</div></CardHeader>
          <CardContent className="space-y-2">
            {(payoutsQuery.data || []).length === 0 ? <p className="text-sm text-muted-foreground">No hay pagos registrados.</p> : (payoutsQuery.data || []).map((payout) => <div key={payout.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"><div><p className="font-medium">{payout.seller.name} · {money(Number(payout.amount), payout.currency)}</p><p className="text-xs text-muted-foreground">{new Date(payout.paidAt).toLocaleString('es-NI')} · {payout.method} · {payoutStatus(payout.status)}{payout.reference ? ` · ${payout.reference}` : ''}</p></div>{payout.status === 'PAID' && <Button size="sm" variant="outline" onClick={() => reversePayout.mutate(payout.id)} disabled={reversePayout.isPending}>Revertir</Button>}</div>)}
          </CardContent>
        </Card>
        <Card className="min-w-0 rounded-2xl border-border bg-card shadow-sm">
          <CardHeader><CardTitle>Historial de comisiones</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {commissionsHistoryQuery.isPending ? <p className="text-sm text-muted-foreground">Cargando comisiones…</p>
              : commissionsHistoryQuery.isError ? <p className="text-sm text-destructive">No se pudo cargar el historial de comisiones.</p>
                : (commissionsHistoryQuery.data || []).length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay comisiones registradas.</p>
                  : (commissionsHistoryQuery.data || []).map((commission) => <div key={commission.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"><div className="min-w-0"><p className="truncate font-medium">{commission.seller.name} · {commission.invoice?.number || commission.creditNote?.number || 'Venta'}</p><p className="text-xs text-muted-foreground">{commissionStatus(commission.status)}{commission.earnedAt ? ` · ${new Date(commission.earnedAt).toLocaleDateString('es-NI')}` : ''}</p></div><span className="shrink-0 font-semibold">{money(Number(commission.amount), commission.currency)}</span></div>)}
          </CardContent>
        </Card>
      </div>}
    </div>
  );
}
