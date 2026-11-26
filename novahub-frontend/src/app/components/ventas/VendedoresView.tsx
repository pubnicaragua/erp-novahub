import { useMemo, useState, type SetStateAction } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, CircleDollarSign, Eye, Loader2, Plus, RefreshCw, Trash2, Users } from 'lucide-react';
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
import { useAuth } from '../../contexts/AuthContext';
import { salesSellersService, type SalesSellerCommissionRule, type SalesSellerSale } from '../../services/sales-sellers.service';
import { hrService } from '../../services/hr.service';
import { areCommissionScaleRulesConsecutive } from '../../utils/commission-scale';
import { DateField } from '../ui/DateField';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';

type Section = 'vendedores' | 'comisiones' | 'metas' | 'pagos';
type CommissionBasis = 'PER_SALE' | 'MONTHLY_TOTAL';
type CommissionRuleDraft = { minAmount: number | string; maxAmount: number | string; rate: number | string };
type CommissionDraft = { currency: string; basis: CommissionBasis; rules: CommissionRuleDraft[] };
type CommissionPlan = { sellerEmployeeId?: string | null; sellerId?: string | null; salesSeller?: { id: string } | null; currency?: string; calculationBasis?: string; rules?: Array<{ minAmount: number | string; maxAmount: number | string | null; rate: number | string }> };
type PayableCommission = { id: string; amount: number | string; currency: string; seller?: { id: string; name?: string }; invoice?: { number?: string }; creditNote?: { number?: string } };
type PayableAward = { id: string; amount: number | string; currency: string; level: string; goal: { title: string; seller?: { id: string; name?: string } } };

const money = (amount: number, currency: string) => new Intl.NumberFormat('es-NI', {
  style: 'currency', currency: currency === 'USD' ? 'USD' : 'NIO', maximumFractionDigits: 2,
}).format(Number(amount || 0));
const localDateInputValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const commissionStatusLabels: Record<string, string> = {
  PENDING: 'Pendiente de cobro', EARNED: 'Disponible para pago', IN_PAYROLL: 'Incluida en nómina',
  PAID_IN_PAYROLL: 'Pagada en nómina', PAID_DIRECT: 'Pagada directamente', CANCELLED: 'Anulada',
};
const commissionStatus = (status: string) => commissionStatusLabels[String(status || '').toUpperCase()] || 'Estado registrado';

const payoutStatusLabels: Record<string, string> = { PAID: 'Pagado', REVERSED: 'Revertido', REVERSAL: 'Reversión' };
const payoutStatus = (status: string) => payoutStatusLabels[String(status || '').toUpperCase()] || 'Estado registrado';
const goalAwardStatusLabels: Record<string, string> = {
  PENDING_APPROVAL: 'Por aprobar', APPROVED: 'Aprobada', IN_PAYROLL: 'Incluida en nómina',
  PAID_IN_PAYROLL: 'Pagada en nómina', PAID: 'Pagada directamente', REJECTED: 'Rechazada', CANCELLED: 'Anulada',
};
const documentStatusLabels: Record<string, string> = {
  DRAFT: 'Borrador', PENDING: 'Pendiente de cobro', PARTIAL: 'A crédito', CREDIT: 'A crédito', PAID: 'Pagada',
  OVERDUE: 'A crédito · Atrasada', CANCELLED: 'Anulada', REFUNDED: 'Reembolsada', ISSUED: 'Activo', APPLIED: 'Aplicada',
  VOIDED: 'Anulada', APPROVED: 'Aprobada', CONFIRMED: 'Aprobada', IN_PROCESS: 'Borrador',
  IN_PROGRESS: 'Borrador', SENT: 'Borrador', ACTIVE: 'Activo', INACTIVE: 'Inactiva', REJECTED: 'Rechazada',
};
const documentStatus = (status: string) => documentStatusLabels[String(status || '').toUpperCase()] || 'Estado registrado';
const paymentMethodLabels: Record<string, string> = {
  CASH: 'Efectivo', TRANSFER: 'Transferencia', BANK_TRANSFER: 'Transferencia bancaria', CHECK: 'Cheque',
  CARD: 'Tarjeta', QR: 'Código QR', VOUCHER: 'Comprobante', CREDIT: 'Crédito', MIXED: 'Pago mixto', OTHER: 'Otro',
};
const paymentMethod = (method: string) => {
  const normalized = String(method || '').trim().toUpperCase();
  if (paymentMethodLabels[normalized]) return paymentMethodLabels[normalized];
  return normalized ? normalized.replace(/_/g, ' ').toLocaleLowerCase('es-NI').replace(/^./, (letter) => letter.toLocaleUpperCase('es-NI')) : 'No especificado';
};
const goalLevelLabels: Record<string, string> = { TARGET: 'Principal', MINIMUM: 'Mínimo', STRETCH: 'Superior' };
const goalLevel = (level: string) => goalLevelLabels[String(level || '').toUpperCase()] || 'Recompensa';

const stickyHeaderCell = 'sticky top-0 z-10 bg-card px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground';

function InvoiceDetailContent({ invoice }: { invoice?: SalesSellerSale | null }) {
  if (!invoice) return <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Esta comisión no tiene una factura asociada.</p>;
  const customer = invoice.customer?.name || invoice.customCustomerName || 'Cliente general';
  return <div className="min-w-0 space-y-4">
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Factura</p><p className="font-semibold">{invoice.number}</p></div>
      <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Fecha</p><p className="font-semibold">{new Date(invoice.date).toLocaleDateString('es-NI')}</p></div>
      <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Cliente</p><p className="break-words font-semibold">{customer}</p></div>
      <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Estado</p><p className="font-semibold">{documentStatus(invoice.status)}</p></div>
      <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Total</p><p className="font-semibold">{money(Number(invoice.total), invoice.currency)}</p></div>
      <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Abonado</p><p className="font-semibold">{money(Number(invoice.amountPaid), invoice.currency)}</p></div>
      <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Saldo</p><p className="font-semibold">{money(Number(invoice.balance), invoice.currency)}</p></div>
    </div>
    <div className="min-w-0 space-y-2">
      <h3 className="font-semibold">Productos y servicios</h3>
      <div className="max-h-64 overflow-auto rounded-xl border border-border">
        <table className="w-full min-w-[520px] text-sm"><thead><tr><th className={stickyHeaderCell}>Descripción</th><th className={`${stickyHeaderCell} text-right`}>Cantidad</th><th className={`${stickyHeaderCell} text-right`}>Precio</th><th className={`${stickyHeaderCell} text-right`}>Total</th></tr></thead>
          <tbody>{invoice.items.map((item) => <tr key={item.id} className="border-t border-border/60"><td className="max-w-sm whitespace-normal break-words px-3 py-2">{item.description}</td><td className="px-3 py-2 text-right">{Number(item.quantity).toLocaleString('es-NI')}</td><td className="px-3 py-2 text-right">{money(Number(item.unitPrice), invoice.currency)}</td><td className="px-3 py-2 text-right font-medium">{money(Number(item.total), invoice.currency)}</td></tr>)}
            {invoice.items.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">La factura no tiene líneas registradas.</td></tr>}</tbody>
        </table>
      </div>
    </div>
    <div className="min-w-0 space-y-2">
      <h3 className="font-semibold">Pagos recibidos</h3>
      {invoice.payments.length === 0 ? <p className="rounded-xl border border-border p-3 text-sm text-muted-foreground">Sin pagos registrados.</p> : <div className="max-h-48 overflow-auto rounded-xl border border-border"><table className="w-full min-w-[480px] text-sm"><thead><tr><th className={stickyHeaderCell}>Fecha</th><th className={stickyHeaderCell}>Referencia</th><th className={stickyHeaderCell}>Método</th><th className={`${stickyHeaderCell} text-right`}>Importe</th></tr></thead><tbody>
        {invoice.payments.map((payment) => <tr key={payment.id} className="border-t border-border/60"><td className="px-3 py-2">{new Date(payment.date).toLocaleDateString('es-NI')}</td><td className="px-3 py-2">{payment.reference || payment.number}</td><td className="px-3 py-2">{paymentMethod(payment.method)}</td><td className="px-3 py-2 text-right font-medium">{money(Number(payment.amount), payment.currency)}</td></tr>)}
      </tbody></table></div>}
    </div>
  </div>;
}

export function VendedoresView({ historicalOnly = false, employeeMode = false, onBack }: { historicalOnly?: boolean; employeeMode?: boolean; onBack?: () => void }) {
  const queryClient = useQueryClient();
  const { canPerform } = useAuth();
  const { baseCurrency } = useCurrency();
  const [section, setSection] = useState<Section>(historicalOnly ? 'pagos' : employeeMode ? 'metas' : 'vendedores');
  const [selectedSellerId, setSelectedSellerId] = useState('');
  const [sellerDetailId, setSellerDetailId] = useState('');
  const [salesDateFrom, setSalesDateFrom] = useState('');
  const [salesDateTo, setSalesDateTo] = useState('');
  const [goalCurrency, setGoalCurrency] = useState('');
  const [selectedCommissionDetailId, setSelectedCommissionDetailId] = useState('');
  const [selectedPayoutDetailId, setSelectedPayoutDetailId] = useState('');
  const [name, setName] = useState('');
  const [commissionDrafts, setCommissionDrafts] = useState<Record<string, CommissionDraft>>({});
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
  const canViewEmployeeCommissionConfig = employeeMode && canPerform('HR_COMMISSIONS_CONFIG', 'view');
  const canEditEmployeeCommissionConfig = employeeMode && canPerform('HR_COMMISSIONS_CONFIG', 'edit');

  const sellersQuery = useTenantQuery(['sales', 'sellers'], (signal) => salesSellersService.list(undefined, signal), { enabled: !employeeMode });
  const employeeSellersQuery = useTenantQuery(['hr', 'commission-incentive-employees'], (signal) => hrService.getCommissionSellerLookup(signal), { enabled: employeeMode });
  const configurationQuery = useTenantQuery(
    [employeeMode ? 'hr' : 'sales', 'seller-commission-config'],
    (signal) => employeeMode ? hrService.getCommissionConfiguration(signal) : salesSellersService.getCommissionConfiguration(signal),
    { enabled: !employeeMode || canViewEmployeeCommissionConfig },
  );
  const goalsQuery = useTenantQuery(
    [employeeMode ? 'hr' : 'sales', 'seller-goals'],
    (signal) => employeeMode ? hrService.getEmployeeSellerGoals(undefined, signal) : salesSellersService.listGoals(undefined, signal),
  );
  const payableQuery = useTenantQuery(
    [employeeMode ? 'hr' : 'sales', 'seller-payable'],
    (signal) => employeeMode ? hrService.getEmployeeSellerPayable(undefined, signal) : salesSellersService.listPayable(undefined, signal),
  );
  const payoutsQuery = useTenantQuery(
    [employeeMode ? 'hr' : 'sales', 'seller-payouts'],
    (signal) => employeeMode ? hrService.getEmployeeSellerPayouts(undefined, signal) : salesSellersService.listPayouts(undefined, signal),
  );
  const commissionsHistoryQuery = useTenantQuery(
    [employeeMode ? 'hr' : 'sales', 'seller-commission-history', selectedSellerId],
    (signal) => employeeMode
      ? hrService.getEmployeeSellerCommissions(selectedSellerId && selectedSellerId !== 'all' ? selectedSellerId : undefined, signal)
      : salesSellersService.listCommissions(selectedSellerId && selectedSellerId !== 'all' ? selectedSellerId : undefined, signal),
    { enabled: section === 'pagos', retry: 0 },
  );
  const sellerSalesQuery = useTenantQuery(
    [employeeMode ? 'hr' : 'sales', 'seller-sales-detail', sellerDetailId, salesDateFrom, salesDateTo],
    (signal) => employeeMode
      ? hrService.getEmployeeSellerSales(sellerDetailId, salesDateFrom || undefined, salesDateTo || undefined, signal)
      : salesSellersService.listSales(sellerDetailId, salesDateFrom || undefined, salesDateTo || undefined, signal),
    { enabled: Boolean(sellerDetailId), retry: 0 },
  );
  const commissionDetailsQuery = useTenantQuery(
    [employeeMode ? 'hr' : 'sales', 'seller-commission-detail', selectedCommissionDetailId],
    (signal) => employeeMode
      ? hrService.getEmployeeSellerCommissionDetails(selectedCommissionDetailId, signal)
      : salesSellersService.getCommissionDetails(selectedCommissionDetailId, signal),
    { enabled: Boolean(selectedCommissionDetailId), retry: 0 },
  );
  const integrationPolicyQuery = useTenantQuery(
    [employeeMode ? 'hr' : 'sales', 'incentive-payout-integration-policy'],
    (signal) => employeeMode ? hrService.getCommissionPayoutIntegrationPolicy(signal) : salesSellersService.getIntegrationPolicy(signal),
    { enabled: section === 'pagos', staleTime: 60_000, retry: 0 },
  );

  const sellers = employeeMode
    ? (employeeSellersQuery.data || []).map((seller) => ({ id: seller.id, code: seller.employeeNumber, name: seller.name, isActive: true, email: undefined }))
    : sellersQuery.data?.data || [];
  const payable = useMemo<{ commissions: PayableCommission[]; awards: PayableAward[] }>(() => payableQuery.data || { commissions: [], awards: [] }, [payableQuery.data]);
  const commissionPlans = (configurationQuery.data?.sellerPlans || []) as CommissionPlan[];
  const commissionPlan = commissionPlans.find((plan) => employeeMode
    ? plan.sellerEmployeeId === selectedSellerId
    : plan.sellerId === selectedSellerId || plan.salesSeller?.id === selectedSellerId);
  const commissionDraft = commissionDrafts[selectedSellerId] || {
    currency: commissionPlan?.currency === 'USD' ? 'USD' : commissionPlan?.currency === 'NIO' ? 'NIO' : baseCurrency || 'NIO',
    basis: commissionPlan?.calculationBasis === 'MONTHLY_TOTAL' ? 'MONTHLY_TOTAL' : 'PER_SALE',
    rules: commissionPlan?.rules?.length
      ? commissionPlan.rules.map((rule) => ({ minAmount: rule.minAmount, maxAmount: rule.maxAmount ?? '', rate: rule.rate }))
      : [{ minAmount: 0, maxAmount: '', rate: '' }],
  } satisfies CommissionDraft;
  const patchCommissionDraft = (patch: Partial<CommissionDraft>) => setCommissionDrafts((current) => ({
    ...current,
    [selectedSellerId]: { ...commissionDraft, ...patch },
  }));
  const commissionCurrency = commissionDraft.currency;
  const effectiveGoalCurrency = goalCurrency || baseCurrency || 'NIO';
  const commissionBasis = commissionDraft.basis;
  const commissionRules = commissionDraft.rules;
  const setCommissionCurrency = (currency: string) => patchCommissionDraft({ currency });
  const setCommissionBasis = (basis: CommissionBasis) => patchCommissionDraft({ basis });
  const setCommissionRules = (rules: SetStateAction<CommissionRuleDraft[]>) => patchCommissionDraft({
    rules: typeof rules === 'function' ? rules(commissionRules) : rules,
  });
  const selectedSellerHasCommissionPlan = Boolean(commissionPlan || (employeeMode && configurationQuery.data?.global));
  const selectedSellerHasActiveGoal = (goalsQuery.data || []).some((goal) => (employeeMode ? goal.sellerEmployeeId : goal.sellerId) === selectedSellerId && goal.hasActivePeriod);
  const integrationPolicy = integrationPolicyQuery.data;
  const bankMethod = ['TRANSFER', 'CHECK', 'CARD'].includes(paymentMethod);
  const referenceRequired = ['TRANSFER', 'CHECK', 'CARD', 'QR', 'VOUCHER'].includes(paymentMethod);
  const bankMethodsAvailable = Boolean(integrationPolicy?.financeEnabled || integrationPolicy?.accountingEnabled);
  const paidByCurrency = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const payout of payoutsQuery.data || []) {
      if (payout.status !== 'PAID' && payout.status !== 'REVERSAL') continue;
      if (selectedSellerId && selectedSellerId !== 'all' && (employeeMode ? payout.sellerEmployeeId : payout.sellerId) !== selectedSellerId) continue;
      const currency = payout.currency || 'NIO';
      totals[currency] = (totals[currency] || 0) + Number(payout.amount || 0);
    }
    return totals;
  }, [employeeMode, payoutsQuery.data, selectedSellerId]);
  const selectedCommissions = useMemo(() => payable.commissions.filter((item) => selectedCommissionIds.includes(item.id)), [payable.commissions, selectedCommissionIds]);
  const selectedAwards = useMemo(() => payable.awards.filter((item) => selectedAwardIds.includes(item.id)), [payable.awards, selectedAwardIds]);
  const payableItems = useMemo(() => [
    ...payable.commissions.map((item) => ({ id: item.id, type: 'commission' as const, seller: item.seller, amount: item.amount, currency: item.currency, label: item.invoice?.number || item.creditNote?.number || 'Comisión por venta', status: 'Disponible' })),
    ...payable.awards.map((item) => ({ id: item.id, type: 'award' as const, seller: item.goal.seller, amount: item.amount, currency: item.currency, label: `${item.goal.title} · ${goalLevel(item.level)}`, status: 'Aprobada' })),
  ].filter((item) => !selectedSellerId || selectedSellerId === 'all' || item.seller?.id === selectedSellerId), [payable, selectedSellerId]);
  const selectedCurrency = selectedCommissions[0]?.currency || selectedAwards[0]?.currency || baseCurrency || 'NIO';
  const mixedCurrency = [...selectedCommissions, ...selectedAwards].some((item) => item.currency !== selectedCurrency);
  const canCreateEmployeeGoals = !employeeMode || canPerform('HR_COMMISSIONS', 'create');
  const canEvaluateEmployeeGoals = !employeeMode || canPerform('HR_COMMISSIONS', 'edit');
  const canApproveEmployeeAwards = !employeeMode || canPerform('HR_COMMISSIONS', 'approve');
  const canPayEmployeeIncentives = !employeeMode || canPerform('HR_COMMISSIONS', 'pay');
  const canReverseEmployeePayouts = !employeeMode || canPerform('HR_COMMISSIONS', 'reverse');
  const sellerForDetail = sellers.find((seller) => seller.id === sellerDetailId);
  const payoutForDetail = (payoutsQuery.data || []).find((payout) => payout.id === selectedPayoutDetailId);

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
      if (!selectedSellerId || selectedSellerId === 'all') throw new Error('Selecciona un vendedor para configurar su comisión.');
      if (employeeMode && !canEditEmployeeCommissionConfig) throw new Error('No tienes permiso para configurar comisiones de empleados.');
      const rules: SalesSellerCommissionRule[] = commissionRules.map((rule) => ({
        minAmount: Number(rule.minAmount), maxAmount: rule.maxAmount === '' ? null : Number(rule.maxAmount), rate: Number(rule.rate),
      }));
      if (!rules.length || rules.some((rule) => !Number.isFinite(rule.minAmount) || !Number.isFinite(rule.rate) || (rule.maxAmount !== null && !Number.isFinite(rule.maxAmount)))) {
        throw new Error('Completa los límites y porcentajes de todos los tramos.');
      }
      if (rules[0].minAmount !== 0 || rules[rules.length - 1].maxAmount !== null) throw new Error('La escala debe iniciar en cero y terminar sin límite máximo.');
      for (let index = 0; index < rules.length - 1; index += 1) {
        const currentMax = rules[index].maxAmount;
        if (currentMax === null || !areCommissionScaleRulesConsecutive(currentMax, rules[index + 1].minAmount)) {
          throw new Error(`Los tramos ${index + 1} y ${index + 2} deben ser consecutivos.`);
        }
      }
      return employeeMode
        ? hrService.saveCommissionConfiguration({ scope: 'SELLER', sellerEmployeeId: selectedSellerId, currency: commissionCurrency as 'NIO' | 'USD', calculationBasis: commissionBasis, rules })
        : salesSellersService.saveCommissionPlan({ sellerId: selectedSellerId, currency: commissionCurrency, calculationBasis: commissionBasis, rules });
    },
    onSuccess: () => {
      setCommissionDrafts((current) => { const next = { ...current }; delete next[selectedSellerId]; return next; });
      refresh(); toast.success('Comisión guardada.');
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const resetPlan = useMutation({
    mutationFn: () => {
      if (!selectedSellerId || selectedSellerId === 'all') throw new Error('Selecciona un vendedor para restablecer su comisión.');
      if (employeeMode && !canEditEmployeeCommissionConfig) throw new Error('No tienes permiso para configurar comisiones de empleados.');
      return employeeMode
        ? hrService.resetCommissionConfiguration({ scope: 'SELLER', sellerEmployeeId: selectedSellerId })
        : salesSellersService.resetCommissionPlan(selectedSellerId);
    },
    onSuccess: () => {
      setCommissionDrafts((current) => { const next = { ...current }; delete next[selectedSellerId]; return next; });
      refresh(); toast.success('Comisión restablecida. El vendedor podrá usar metas de ventas.');
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const createGoal = useMutation({
    mutationFn: () => {
      const payload = {
        ...(employeeMode ? { sellerEmployeeId: selectedSellerId } : { sellerId: selectedSellerId }),
        title: goalTitle.trim(), targetAmount: Number(targetAmount), rewardAmount: Number(rewardAmount),
        minimumAmount: minimumAmount ? Number(minimumAmount) : null, minimumReward: minimumReward ? Number(minimumReward) : null,
        stretchAmount: stretchAmount ? Number(stretchAmount) : null, stretchReward: stretchReward ? Number(stretchReward) : null,
        currency: effectiveGoalCurrency, periodStart, periodEnd,
      };
      return employeeMode ? hrService.createEmployeeSellerGoal(payload) : salesSellersService.createGoal(payload);
    },
    onSuccess: () => { setGoalTitle(''); refresh(); toast.success('Meta creada.'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const evaluateGoals = useMutation({
    mutationFn: () => employeeMode ? hrService.evaluateEmployeeSellerGoals() : salesSellersService.evaluateGoals(),
    onSuccess: (result) => { refresh(); toast.success(`Evaluación lista. ${result.awardsCreated} recompensas pendientes de aprobación.`); },
    onError: (error: Error) => toast.error(error.message),
  });
  const approveAward = useMutation({
    mutationFn: (id: string) => employeeMode ? hrService.approveEmployeeSellerGoalAward(id, true) : salesSellersService.approveAward(id, true),
    onSuccess: () => { refresh(); toast.success('Recompensa aprobada.'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const pay = useMutation({
    mutationFn: () => employeeMode
      ? hrService.payEmployeeSellerIncentives({
        sellerEmployeeId: selectedSellerId, commissionIds: selectedCommissionIds, awardIds: selectedAwardIds,
        currency: selectedCurrency, method: paymentMethod, bankAccountId: bankAccountId || undefined,
        reference: paymentReference.trim() || undefined,
      })
      : salesSellersService.pay({
        sellerId: selectedSellerId, commissionIds: selectedCommissionIds, awardIds: selectedAwardIds,
        currency: selectedCurrency, method: paymentMethod, bankAccountId: bankAccountId || undefined,
        reference: paymentReference.trim() || undefined,
      }),
    onSuccess: () => { setSelectedCommissionIds([]); setSelectedAwardIds([]); setPaymentReference(''); refresh(); toast.success('Pago registrado.'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const reversePayout = useMutation({
    mutationFn: (id: string) => employeeMode
      ? hrService.reverseEmployeeSellerPayout(id, 'Reversión registrada desde Recursos Humanos')
      : salesSellersService.reversePayout(id, 'Reversión registrada desde Vendedores'),
    onSuccess: () => { refresh(); toast.success('Pago revertido.'); },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleId = (current: string[], setter: (next: string[]) => void, id: string, checked: boolean) => {
    setter(checked ? [...new Set([...current, id])] : current.filter((value) => value !== id));
  };
  const showSellerDetails = (sellerId = selectedSellerId) => {
    if (!sellerId || sellerId === 'all') return;
    setSellerDetailId(sellerId);
    setSalesDateFrom('');
    setSalesDateTo('');
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
  const sectionTabs: Array<[Section, string]> = historicalOnly
    ? [['metas', 'Metas'], ['pagos', 'Liquidaciones']]
    : employeeMode
      ? [...(canViewEmployeeCommissionConfig ? [['comisiones', 'Comisiones'] as [Section, string]] : []), ['metas', 'Metas'], ['pagos', 'Liquidaciones']]
    : [['vendedores', 'Vendedores'], ['comisiones', 'Comisiones'], ['metas', 'Metas'], ['pagos', 'Liquidaciones']];

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden p-4 sm:p-6 md:p-8">
      <header className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-primary"><Users className="size-5" /><span className="text-xs font-semibold uppercase tracking-widest">{employeeMode ? 'Recursos Humanos' : 'Ventas'}</span></div>
          <h1 className="mt-1 text-2xl font-black italic tracking-tight sm:text-3xl">{employeeMode ? 'INCENTIVOS DE EMPLEADOS VENDEDORES' : historicalOnly ? 'HISTORIAL DE VENDEDORES INDEPENDIENTES' : 'VENDEDORES'}</h1>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Apartados de vendedores">
          {sectionTabs.map(([id, label]) => (
            <Button key={id} size="sm" variant={section === id ? 'default' : 'outline'} role="tab" aria-selected={section === id} onClick={() => { if (id === 'comisiones' && selectedSellerId === 'all') setSelectedSellerId(''); setSection(id); }}>{label}</Button>
          ))}
          {onBack && <Button type="button" size="sm" variant="outline" onClick={onBack}>Volver a comisiones</Button>}
        </div>
      </header>

      {!employeeMode && section === 'vendedores' && <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <Card className="min-w-0 rounded-2xl border-border bg-card shadow-sm">
          <CardHeader><CardTitle>Directorio</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {sellersQuery.isPending ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Cargando vendedores…</div>
              : sellersQuery.isError ? <div className="text-sm text-destructive">No se pudo cargar el directorio.</div>
                : sellers.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay vendedores registrados.</p>
                  : sellers.map((seller) => <button key={seller.id} type="button" onClick={() => { setSelectedSellerId(seller.id); showSellerDetails(seller.id); }} className={`flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedSellerId === seller.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
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

      {!employeeMode && section === 'comisiones' && <Card className="min-w-0 rounded-2xl border-border bg-card shadow-sm">
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

      {employeeMode && section === 'comisiones' && canViewEmployeeCommissionConfig && <Card className="min-w-0 rounded-2xl border-border bg-card shadow-sm">
        <CardHeader><CardTitle>Escala particular del empleado</CardTitle></CardHeader>
        <CardContent className="min-w-0 space-y-4">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="hr-seller-commission-select">Empleado vendedor</Label><Select value={selectedSellerId === 'all' ? '' : selectedSellerId} onValueChange={setSelectedSellerId}><SelectTrigger id="hr-seller-commission-select"><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger><SelectContent>{sellers.filter((seller) => seller.isActive).map((seller) => <SelectItem key={seller.id} value={seller.id}>{seller.name} · {seller.code}</SelectItem>)}</SelectContent></Select></div>
            <div className="sm:col-span-2"><Button type="button" variant="outline" disabled={!selectedSellerId || selectedSellerId === 'all'} onClick={() => showSellerDetails()}><Eye className="mr-2 size-4" />Ver ventas del empleado</Button></div>
            <div className="space-y-2"><Label htmlFor="hr-seller-commission-currency">Moneda</Label><Select value={commissionCurrency} onValueChange={setCommissionCurrency} disabled={!selectedSellerId || !canEditEmployeeCommissionConfig || configurationQuery.isFetching}><SelectTrigger id="hr-seller-commission-currency"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NIO">Córdobas (NIO)</SelectItem><SelectItem value="USD">Dólares (USD)</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="hr-seller-commission-basis">Base de cálculo</Label><Select value={commissionBasis} onValueChange={(value) => setCommissionBasis(value as CommissionBasis)} disabled={!selectedSellerId || !canEditEmployeeCommissionConfig || configurationQuery.isFetching}><SelectTrigger id="hr-seller-commission-basis"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PER_SALE">Cada venta</SelectItem><SelectItem value="MONTHLY_TOTAL">Total del mes</SelectItem></SelectContent></Select></div>
          </div>
          <p className="text-xs text-muted-foreground">La escala particular prevalece para este empleado; si no tiene una, hereda la escala global. Puedes usar comisión por venta o metas con recompensa, pero no ambas modalidades activas al mismo tiempo.</p>
          {configurationQuery.isError
            ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 p-3 text-sm"><span className="text-destructive">No se pudo cargar la configuración de comisiones.</span><Button type="button" size="sm" variant="outline" onClick={() => void configurationQuery.refetch()}>Reintentar</Button></div>
            : configurationQuery.isPending
              ? <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">Cargando escalas de comisiones…</p>
              : !selectedSellerId || selectedSellerId === 'all'
            ? <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">Selecciona un empleado vendedor para consultar o editar su escala particular.</p>
            : <>
              {selectedSellerHasActiveGoal && <p className="text-sm text-amber-600 dark:text-amber-400">Este empleado tiene una meta activa. Finalízala antes de guardar una comisión.</p>}
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-muted/30 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-3">Desde</th><th className="px-3 py-3">Hasta (inclusive)</th><th className="px-3 py-3">Porcentaje</th><th className="w-14 px-3 py-3 text-right">Quitar</th></tr></thead>
                  <tbody>{commissionRules.map((rule, index) => <tr key={`hr-seller-commission-rule-${index}`} className="border-t border-border/50">
                    <td className="p-2"><Input type="number" min="0" step="0.01" value={rule.minAmount} disabled={!canEditEmployeeCommissionConfig || configurationQuery.isFetching} onChange={(event) => setCommissionRules((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, minAmount: event.target.value } : row))} aria-label={`Mínimo del tramo ${index + 1}`} /></td>
                    <td className="p-2"><Input type="number" min="0" step="0.01" value={rule.maxAmount} disabled={!canEditEmployeeCommissionConfig || configurationQuery.isFetching} placeholder={index === commissionRules.length - 1 ? 'Sin límite' : 'Máximo'} onChange={(event) => setCommissionRules((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, maxAmount: event.target.value } : row))} aria-label={`Máximo del tramo ${index + 1}`} /></td>
                    <td className="p-2"><Input type="number" min="0" max="100" step="0.01" value={rule.rate} disabled={!canEditEmployeeCommissionConfig || configurationQuery.isFetching} onChange={(event) => setCommissionRules((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, rate: event.target.value } : row))} aria-label={`Porcentaje del tramo ${index + 1}`} /></td>
                    <td className="p-2 text-right"><Button type="button" size="icon" variant="ghost" aria-label={`Eliminar tramo ${index + 1}`} disabled={!canEditEmployeeCommissionConfig || configurationQuery.isFetching || commissionRules.length === 1 || savePlan.isPending} onClick={() => setCommissionRules((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="size-4 text-destructive" /></Button></td>
                  </tr>)}</tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">El primer tramo inicia en 0 y el último queda abierto.</p><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={addCommissionRule} disabled={!canEditEmployeeCommissionConfig || configurationQuery.isFetching || savePlan.isPending || resetPlan.isPending}><Plus className="mr-2 size-4" />Agregar tramo</Button>{commissionPlan && <Button type="button" variant="outline" onClick={() => resetPlan.mutate()} disabled={!canEditEmployeeCommissionConfig || configurationQuery.isFetching || resetPlan.isPending}><RefreshCw className="mr-2 size-4" />Restablecer comisión</Button>}<Button disabled={!canEditEmployeeCommissionConfig || configurationQuery.isFetching || selectedSellerHasActiveGoal || savePlan.isPending || resetPlan.isPending || commissionRules.some((rule) => rule.rate === '')} onClick={() => savePlan.mutate()}><CircleDollarSign className="mr-2 size-4" />Guardar escala</Button></div></div>
            </>}
        </CardContent>
      </Card>}

      {section === 'metas' && <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        {!historicalOnly && canCreateEmployeeGoals && <Card className="min-w-0 rounded-2xl border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle>Nueva meta de ventas</CardTitle>{canEvaluateEmployeeGoals && <Button size="sm" variant="outline" onClick={() => evaluateGoals.mutate()} disabled={evaluateGoals.isPending}><RefreshCw className="mr-2 size-4" />Evaluar cierres</Button>}</CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="grid min-w-0 gap-3 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.55fr)]">
              <div className="min-w-0 space-y-2"><Label htmlFor="seller-goal-seller">{employeeMode ? 'Empleado vendedor' : 'Vendedor'}</Label><Select value={selectedSellerId} onValueChange={setSelectedSellerId}><SelectTrigger id="seller-goal-seller" className="max-w-full"><SelectValue placeholder={employeeMode ? 'Seleccionar empleado' : 'Seleccionar vendedor'} /></SelectTrigger><SelectContent>{sellers.filter((seller) => seller.isActive).map((seller) => <SelectItem key={seller.id} value={seller.id}>{seller.name} · {seller.code}</SelectItem>)}</SelectContent></Select></div>
              <div className="min-w-0 space-y-2"><Label htmlFor="seller-goal-currency">Moneda de la meta</Label><Select value={effectiveGoalCurrency} onValueChange={setGoalCurrency}><SelectTrigger id="seller-goal-currency" className="max-w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NIO">Córdobas (NIO)</SelectItem><SelectItem value="USD">Dólares (USD)</SelectItem></SelectContent></Select></div>
            </div>
            {employeeMode && <div className="sm:col-span-2"><Button type="button" variant="outline" disabled={!selectedSellerId || selectedSellerId === 'all'} onClick={() => showSellerDetails()}><Eye className="mr-2 size-4" />Ver ventas del empleado</Button></div>}
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="seller-goal-title">Descripción</Label><Input id="seller-goal-title" value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="seller-goal-start">Desde</Label><Input id="seller-goal-start" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="seller-goal-end">Hasta</Label><Input id="seller-goal-end" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="seller-goal-target">Meta principal ({effectiveGoalCurrency})</Label><Input id="seller-goal-target" type="number" min="0.01" step="0.01" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="seller-goal-reward">Recompensa principal ({effectiveGoalCurrency})</Label><Input id="seller-goal-reward" type="number" min="0.01" step="0.01" value={rewardAmount} onChange={(event) => setRewardAmount(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="seller-goal-minimum">Nivel mínimo ({effectiveGoalCurrency}, opcional)</Label><Input id="seller-goal-minimum" type="number" min="0.01" step="0.01" value={minimumAmount} onChange={(event) => setMinimumAmount(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="seller-goal-minimum-reward">Recompensa mínima ({effectiveGoalCurrency})</Label><Input id="seller-goal-minimum-reward" type="number" min="0.01" step="0.01" value={minimumReward} onChange={(event) => setMinimumReward(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="seller-goal-stretch">Nivel superior ({effectiveGoalCurrency}, opcional)</Label><Input id="seller-goal-stretch" type="number" min="0.01" step="0.01" value={stretchAmount} onChange={(event) => setStretchAmount(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="seller-goal-stretch-reward">Recompensa superior ({effectiveGoalCurrency})</Label><Input id="seller-goal-stretch-reward" type="number" min="0.01" step="0.01" value={stretchReward} onChange={(event) => setStretchReward(event.target.value)} /></div>
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
                <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{goal.title}</p><p className="text-xs text-muted-foreground">{goal.seller?.name || 'Empleado vendedor'} · {goal.periodStartDate || goal.periodStart.slice(0, 10)} — {goal.periodEndDate || goal.periodEnd.slice(0, 10)}</p></div>{goal.award && <Badge variant={goal.award.status === 'PENDING_APPROVAL' ? 'secondary' : 'default'}>{goalAwardStatusLabels[goal.award.status] || 'Estado registrado'}</Badge>}</div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs"><span>{money(goal.achievedAmount, goal.currency)} de {money(goal.targetAmount, goal.currency)}</span>{goal.award && <span>Recompensa {money(goal.award.amount, goal.award.currency)} · {goalLevel(goal.award.level)}</span>}</div>
                {goal.award?.status === 'PENDING_APPROVAL' && canApproveEmployeeAwards && <Button className="mt-3" size="sm" onClick={() => approveAward.mutate(goal.award!.id)} disabled={approveAward.isPending}><BadgeCheck className="mr-2 size-4" />Aprobar recompensa</Button>}
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
              <Select value={selectedSellerId} onValueChange={(value) => { setSelectedSellerId(value); setSelectedCommissionIds([]); setSelectedAwardIds([]); }}><SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder={employeeMode ? 'Todos los empleados' : 'Todos los vendedores'} /></SelectTrigger><SelectContent><SelectItem value="all">{employeeMode ? 'Todos los empleados' : 'Todos los vendedores'}</SelectItem>{sellers.map((seller) => <SelectItem key={seller.id} value={seller.id}>{seller.name}</SelectItem>)}</SelectContent></Select>
              {employeeMode && selectedSellerId && selectedSellerId !== 'all' && <Button type="button" variant="outline" onClick={() => showSellerDetails()}><Eye className="mr-2 size-4" />Ver ventas</Button>}
              {canPayEmployeeIncentives && <Select value={paymentMethod} onValueChange={(value) => { setPaymentMethod(value); setBankAccountId(''); }}><SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CASH">Efectivo</SelectItem>{bankMethodsAvailable && <><SelectItem value="TRANSFER">Transferencia</SelectItem><SelectItem value="CHECK">Cheque</SelectItem><SelectItem value="CARD">Tarjeta</SelectItem></>}<SelectItem value="QR">QR</SelectItem><SelectItem value="VOUCHER">Vale</SelectItem></SelectContent></Select>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {canPayEmployeeIncentives && integrationPolicyQuery.isError && <p className="text-xs text-muted-foreground">No se pudo consultar la conexión con Finanzas y Contabilidad; se puede registrar pago en efectivo.</p>}
            {canPayEmployeeIncentives && bankMethod && bankMethodsAvailable && <BankAccountSelect currency={selectedCurrency} allowUnlinked={Boolean(integrationPolicy?.financeEnabled && !integrationPolicy?.accountingEnabled)} required={Boolean(integrationPolicy?.accountingEnabled)} endpoint="/bank-accounts/payment-options" value={bankAccountId} onChange={setBankAccountId} label="Cuenta bancaria de salida" showCommissionPercent={false} />}
            {canPayEmployeeIncentives && <div className="space-y-2"><Label htmlFor="seller-payout-reference">Referencia de pago{referenceRequired ? ' *' : ' (opcional)'}</Label><Input id="seller-payout-reference" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} required={referenceRequired} placeholder="Voucher, cheque o transferencia" /></div>}
            <div className="max-h-[440px] overflow-auto rounded-xl border border-border">
              <table className="w-full min-w-[680px] text-sm"><thead><tr><th className={stickyHeaderCell}>Pagar</th><th className={stickyHeaderCell}>{employeeMode ? 'Empleado' : 'Vendedor'}</th><th className={stickyHeaderCell}>Origen</th><th className={stickyHeaderCell}>Estado</th><th className={`${stickyHeaderCell} text-right`}>Importe</th></tr></thead>
                <tbody>{payableItems.map((item) => {
                  const selected = item.type === 'commission' ? selectedCommissionIds.includes(item.id) : selectedAwardIds.includes(item.id);
                  return <tr key={`${item.type}:${item.id}`} className="border-t border-border/60">
                    <td className="px-3 py-2"><input type="checkbox" checked={selected} disabled={!canPayEmployeeIncentives} aria-label={`Seleccionar ${item.label}`} onChange={(event) => item.type === 'commission'
                      ? toggleId(selectedCommissionIds, setSelectedCommissionIds, item.id, event.target.checked)
                      : toggleId(selectedAwardIds, setSelectedAwardIds, item.id, event.target.checked)} /></td>
                    <td className="px-3 py-2">{item.seller?.name || (employeeMode ? 'Empleado vendedor' : 'Vendedor')}</td><td className="max-w-xs whitespace-normal break-words px-3 py-2">{item.label}</td><td className="px-3 py-2">{item.status}</td><td className="px-3 py-2 text-right font-semibold">{money(Number(item.amount), item.currency)}</td>
                  </tr>;
                })}
                  {!payableItems.length && <tr><td colSpan={5} className="px-3 py-5 text-center text-muted-foreground">No hay incentivos disponibles para este filtro.</td></tr>}
                </tbody>
              </table>
            </div>
            {canPayEmployeeIncentives && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"><span className="text-sm">Seleccionado {money([...selectedCommissions, ...selectedAwards].reduce((sum, item) => sum + Number(item.amount), 0), selectedCurrency)}</span><Button disabled={!selectedSellerId || selectedSellerId === 'all' || (!selectedCommissionIds.length && !selectedAwardIds.length) || mixedCurrency || (bankMethod && !bankAccountId) || (referenceRequired && !paymentReference.trim()) || pay.isPending} onClick={() => pay.mutate()}>{pay.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Registrar pago</Button></div>}
            {mixedCurrency && <p className="text-sm text-destructive">Agrupa incentivos de una sola moneda por pago.</p>}
          </CardContent>
        </Card>
        <Card className="min-w-0 rounded-2xl border-border bg-card shadow-sm">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Historial de liquidaciones</CardTitle><div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">Pagado neto histórico:</span>{Object.keys(paidByCurrency).length ? Object.entries(paidByCurrency).map(([currency, amount]) => <Badge key={currency} variant="secondary">{money(amount, currency)}</Badge>) : <Badge variant="secondary">{money(0, baseCurrency || 'NIO')}</Badge>}</div></CardHeader>
          <CardContent>
            <div className="max-h-[440px] overflow-auto rounded-xl border border-border"><table className="w-full min-w-[760px] text-sm"><thead><tr><th className={stickyHeaderCell}>Fecha</th><th className={stickyHeaderCell}>{employeeMode ? 'Empleado' : 'Vendedor'}</th><th className={stickyHeaderCell}>Método / referencia</th><th className={stickyHeaderCell}>Estado</th><th className={`${stickyHeaderCell} text-right`}>Importe</th><th className={stickyHeaderCell}>Detalle</th><th className={stickyHeaderCell}>Acción</th></tr></thead>
              <tbody>{(payoutsQuery.data || []).map((payout) => <tr key={payout.id} className="border-t border-border/60">
                <td className="whitespace-nowrap px-3 py-2">{new Date(payout.paidAt).toLocaleString('es-NI')}</td><td className="px-3 py-2">{payout.seller?.name || (employeeMode ? 'Empleado vendedor' : 'Vendedor')}</td><td className="max-w-xs whitespace-normal break-words px-3 py-2">{paymentMethod(payout.method)}{payout.reference ? ` · ${payout.reference}` : ''}</td><td className="px-3 py-2">{payoutStatus(payout.status)}</td><td className="px-3 py-2 text-right font-semibold">{money(Number(payout.amount), payout.currency)}</td>
                <td className="px-3 py-2"><Button size="sm" variant="outline" onClick={() => setSelectedPayoutDetailId(payout.id)}><Eye className="mr-2 size-4" />Ver detalle</Button></td><td className="px-3 py-2">{payout.status === 'PAID' && canReverseEmployeePayouts && <Button size="sm" variant="outline" onClick={() => reversePayout.mutate(payout.id)} disabled={reversePayout.isPending}>Revertir</Button>}</td>
              </tr>)}
                {(payoutsQuery.data || []).length === 0 && <tr><td colSpan={7} className="px-3 py-5 text-center text-muted-foreground">No hay pagos registrados.</td></tr>}
              </tbody>
            </table></div>
          </CardContent>
        </Card>
        <Card className="min-w-0 rounded-2xl border-border bg-card shadow-sm">
          <CardHeader><CardTitle>Historial de comisiones</CardTitle></CardHeader>
          <CardContent>
            {commissionsHistoryQuery.isPending ? <p className="mb-3 text-sm text-muted-foreground">Cargando comisiones…</p> : commissionsHistoryQuery.isError ? <p className="mb-3 text-sm text-destructive">No se pudo cargar el historial de comisiones.</p> : null}
            <div className="max-h-[440px] overflow-auto rounded-xl border border-border"><table className="w-full min-w-[720px] text-sm"><thead><tr><th className={stickyHeaderCell}>{employeeMode ? 'Empleado' : 'Vendedor'}</th><th className={stickyHeaderCell}>Documento</th><th className={stickyHeaderCell}>Generada</th><th className={stickyHeaderCell}>Estado</th><th className={`${stickyHeaderCell} text-right`}>Comisión</th><th className={stickyHeaderCell}>Detalle</th></tr></thead>
              <tbody>{(commissionsHistoryQuery.data || []).map((commission) => <tr key={commission.id} className="border-t border-border/60">
                <td className="px-3 py-2">{commission.seller?.name || (employeeMode ? 'Empleado vendedor' : 'Vendedor')}</td><td className="px-3 py-2">{commission.invoice?.number || commission.creditNote?.number || 'Venta'}</td><td className="whitespace-nowrap px-3 py-2">{commission.earnedAt ? new Date(commission.earnedAt).toLocaleDateString('es-NI') : '—'}</td><td className="px-3 py-2">{commissionStatus(commission.status)}</td><td className="px-3 py-2 text-right font-semibold">{money(Number(commission.amount), commission.currency)}</td>
                <td className="px-3 py-2"><Button size="sm" variant="outline" onClick={() => setSelectedCommissionDetailId(commission.id)}><Eye className="mr-2 size-4" />Ver detalle</Button></td>
              </tr>)}
                {!commissionsHistoryQuery.isPending && !commissionsHistoryQuery.isError && !(commissionsHistoryQuery.data || []).length && <tr><td colSpan={6} className="px-3 py-5 text-center text-muted-foreground">Todavía no hay comisiones registradas.</td></tr>}
              </tbody>
            </table></div>
          </CardContent>
        </Card>
      </div>}

      <Sheet open={Boolean(sellerDetailId)} onOpenChange={(open) => { if (!open) setSellerDetailId(''); }}>
        <SheetContent side="right" className="erp-detail-panel erp-detail-panel--wide flex w-full min-w-0 flex-col gap-0 overflow-hidden border-l border-border/50 bg-background p-0">
          <SheetHeader className="sticky top-0 z-10 space-y-2 border-b border-border/50 bg-background/95 px-5 py-5 pr-12 backdrop-blur-md sm:px-6">
            <SheetTitle className="break-words text-lg font-black tracking-tight">{sellerForDetail?.name || (employeeMode ? 'Detalle del empleado vendedor' : 'Detalle del vendedor')}</SheetTitle>
            <SheetDescription className="break-words">{sellerForDetail ? `${sellerForDetail.code}${sellerForDetail.email ? ` · ${sellerForDetail.email}` : ''}` : 'Ventas registradas para el vendedor seleccionado.'}</SheetDescription>
          </SheetHeader>
          <div className="min-w-0 space-y-4 px-4 pb-5 sm:px-6">
            <div className="flex min-w-0 flex-wrap items-end gap-3 rounded-xl border border-border p-3">
              <div className="min-w-0 flex-1 space-y-1"><Label htmlFor="seller-detail-from">Desde</Label><DateField id="seller-detail-from" ariaLabel="Filtrar ventas desde" value={salesDateFrom} onChange={(value) => { setSalesDateFrom(value); if (value && salesDateTo && value > salesDateTo) setSalesDateTo(value); }} maxDate={salesDateTo || undefined} clearable /></div>
              <div className="min-w-0 flex-1 space-y-1"><Label htmlFor="seller-detail-to">Hasta</Label><DateField id="seller-detail-to" ariaLabel="Filtrar ventas hasta" value={salesDateTo} onChange={setSalesDateTo} minDate={salesDateFrom || undefined} clearable /></div>
              <Button type="button" variant="outline" onClick={() => { setSalesDateFrom(''); setSalesDateTo(''); }}>Limpiar fechas</Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Ventas del periodo</h3>{sellerSalesQuery.data && <Badge variant="secondary">{sellerSalesQuery.data.length} facturas</Badge>}</div>
            {sellerSalesQuery.isPending ? <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">Cargando ventas…</div>
              : sellerSalesQuery.isError ? <div className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">No se pudieron cargar las ventas del vendedor.</div>
              : <div className="max-h-[calc(100dvh-19rem)] overflow-auto rounded-xl border border-border"><table className="w-full min-w-[820px] text-sm"><thead><tr><th className={stickyHeaderCell}>Fecha</th><th className={stickyHeaderCell}>Factura</th><th className={stickyHeaderCell}>Cliente</th><th className={stickyHeaderCell}>Estado</th><th className={`${stickyHeaderCell} text-right`}>Total</th><th className={`${stickyHeaderCell} text-right`}>Abonado</th><th className={`${stickyHeaderCell} text-right`}>Saldo</th></tr></thead>
                  <tbody>{(sellerSalesQuery.data || []).map((sale) => <tr key={sale.id} className="border-t border-border/60"><td className="whitespace-nowrap px-3 py-2">{new Date(sale.date).toLocaleDateString('es-NI')}</td><td className="px-3 py-2 font-medium">{sale.number}</td><td className="max-w-xs whitespace-normal break-words px-3 py-2">{sale.customer?.name || sale.customCustomerName || 'Cliente general'}</td><td className="px-3 py-2">{documentStatus(sale.status)}</td><td className="px-3 py-2 text-right">{money(Number(sale.total), sale.currency)}</td><td className="px-3 py-2 text-right">{money(Number(sale.amountPaid), sale.currency)}</td><td className="px-3 py-2 text-right">{money(Number(sale.balance), sale.currency)}</td></tr>)}
                    {!(sellerSalesQuery.data || []).length && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No se encontraron ventas para las fechas seleccionadas.</td></tr>}
                  </tbody>
                </table></div>}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(selectedCommissionDetailId)} onOpenChange={(open) => { if (!open) setSelectedCommissionDetailId(''); }}>
        <SheetContent side="right" className="erp-detail-panel erp-detail-panel--wide flex w-full min-w-0 flex-col gap-0 overflow-hidden border-l border-border/50 bg-background p-0">
          <SheetHeader className="sticky top-0 z-10 space-y-2 border-b border-border/50 bg-background/95 px-5 py-5 pr-12 backdrop-blur-md sm:px-6"><SheetTitle className="text-lg font-black tracking-tight">Detalle de comisión</SheetTitle><SheetDescription>Comisión asociada al documento y los datos de la venta.</SheetDescription></SheetHeader>
          <div className="min-w-0 space-y-4 p-4 sm:p-6">
          {commissionDetailsQuery.isPending ? <p className="py-8 text-center text-sm text-muted-foreground">Cargando detalle…</p>
            : commissionDetailsQuery.isError ? <p className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">No se pudo cargar el detalle de la comisión.</p>
              : commissionDetailsQuery.data && <div className="min-w-0 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Vendedor</p><p className="font-semibold">{commissionDetailsQuery.data.seller?.name || `${commissionDetailsQuery.data.employee?.firstName || ''} ${commissionDetailsQuery.data.employee?.lastName || ''}`.trim() || 'Vendedor'}</p></div>
                  <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Estado</p><p className="font-semibold">{commissionStatus(commissionDetailsQuery.data.status)}</p></div>
                  <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Tasa</p><p className="font-semibold">{Number(commissionDetailsQuery.data.rate || 0).toLocaleString('es-NI')}%</p></div>
                  <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Comisión</p><p className="font-semibold">{money(Number(commissionDetailsQuery.data.amount), commissionDetailsQuery.data.currency)}</p></div>
                </div>
                {commissionDetailsQuery.data.invoice ? <InvoiceDetailContent invoice={commissionDetailsQuery.data.invoice} />
                  : commissionDetailsQuery.data.creditNote ? <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-muted-foreground">Nota de crédito</p><p className="font-semibold">{commissionDetailsQuery.data.creditNote.number}</p></div><div><p className="text-xs text-muted-foreground">Fecha</p><p className="font-semibold">{new Date(commissionDetailsQuery.data.creditNote.date).toLocaleDateString('es-NI')}</p></div><div><p className="text-xs text-muted-foreground">Estado</p><p className="font-semibold">{documentStatus(commissionDetailsQuery.data.creditNote.status)}</p></div><div><p className="text-xs text-muted-foreground">Importe</p><p className="font-semibold">{money(Number(commissionDetailsQuery.data.creditNote.total), commissionDetailsQuery.data.creditNote.currency)}</p></div></div>
                    : <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">No hay factura ni nota de crédito vinculada.</p>}
              </div>}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(selectedPayoutDetailId)} onOpenChange={(open) => { if (!open) setSelectedPayoutDetailId(''); }}>
        <DialogContent className="sm:!max-w-3xl">
          <DialogHeader className="pr-10"><DialogTitle>Detalle de liquidación</DialogTitle><DialogDescription>Resumen del pago y de los incentivos incluidos.</DialogDescription></DialogHeader>
          {!payoutForDetail ? <p className="py-8 text-center text-sm text-muted-foreground">No se encontró el pago seleccionado.</p> : <div className="min-w-0 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Vendedor</p><p className="font-semibold">{payoutForDetail.seller?.name || (employeeMode ? 'Empleado vendedor' : 'Vendedor')}</p></div>
              <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Fecha</p><p className="font-semibold">{new Date(payoutForDetail.paidAt).toLocaleString('es-NI')}</p></div>
              <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Estado</p><p className="font-semibold">{payoutStatus(payoutForDetail.status)}</p></div>
              <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Método</p><p className="font-semibold">{paymentMethod(payoutForDetail.method)}</p></div>
              <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Referencia</p><p className="break-words font-semibold">{payoutForDetail.reference || '—'}</p></div>
              <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Total</p><p className="font-semibold">{money(Number(payoutForDetail.amount), payoutForDetail.currency)}</p></div>
            </div>
            {payoutForDetail.reversalReason && <p className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm">Motivo de reversión: {payoutForDetail.reversalReason}</p>}
            <div className="space-y-2"><h3 className="font-semibold">Incentivos liquidados</h3><div className="max-h-72 overflow-auto rounded-xl border border-border"><table className="w-full min-w-[560px] text-sm"><thead><tr><th className={stickyHeaderCell}>Tipo</th><th className={stickyHeaderCell}>Documento / meta</th><th className={stickyHeaderCell}>Fecha</th><th className={`${stickyHeaderCell} text-right`}>Importe</th></tr></thead><tbody>
              {(payoutForDetail.lines || []).map((line) => {
                const invoice = line.commission?.invoice;
                const creditNote = line.commission?.creditNote;
                const goal = line.goalAward?.goal;
                const source = invoice?.number || creditNote?.number || goal?.title || 'Incentivo';
                const date = invoice?.date || creditNote?.date;
                const type = goal ? `Recompensa · ${goalLevel(line.goalAward.level || '')}` : 'Comisión';
                return <tr key={line.id} className="border-t border-border/60"><td className="px-3 py-2">{type}</td><td className="px-3 py-2">{source}</td><td className="px-3 py-2">{date ? new Date(date).toLocaleDateString('es-NI') : '—'}</td><td className="px-3 py-2 text-right font-semibold">{money(Number(line.amount), line.currency || payoutForDetail.currency)}</td></tr>;
              })}
              {!(payoutForDetail.lines || []).length && <tr><td colSpan={4} className="px-3 py-5 text-center text-muted-foreground">Este pago no tiene líneas de detalle disponibles.</td></tr>}
            </tbody></table></div></div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
