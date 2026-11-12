import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, CalendarDays, Clock3, FileText, Loader2, Plus, Save, Settings2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { cajaService } from '../../services/caja.service';
import { customersService } from '../../services/ventas.service';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { toast } from '@/app/services/toast';
import { getCustomerLoanMoraActions } from '../../utils/customer-loan-permissions';
import { getCurrencyDecimalPlaces, roundCurrencyNumber } from '../../utils/currency';
import { calculateCustomerCreditPlanEstimate, type CustomerCreditManualInstallmentDraft, type CustomerCreditPlanInstallment } from '../../utils/customerCreditInstallmentPlan';
import { CustomerCreditInstallmentSchedule } from './CustomerCreditInstallmentSchedule';
import { generateCustomerCreditInstallmentReport } from '../../utils/customerCreditInstallmentReport';

type MoraType = { id: string; name: string; description: string; isActive: boolean };
type LoanFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
type CustomerLoan = {
  id: string;
  principal: number | string;
  interest: number | string;
  principalBalance?: number | string;
  interestBalance?: number | string;
  installmentAmount?: number | string | null;
  planEnabled?: boolean;
  firstInstallmentDate?: string | null;
  installments?: Array<{ id: string; installmentNumber: number; dueDate: string; totalAmount: number | string; principalAmount: number | string; interestAmount: number | string; principalPaid: number | string; interestPaid: number | string }>;
  total: number | string;
  frequency: LoanFrequency | null;
  planCalculationMode?: 'AMOUNT' | 'DEADLINE' | 'MANUAL' | null;
  dueDate: string;
  currency: string;
  moraTypeNameSnapshot?: string | null;
  moraTypeDescriptionSnapshot?: string | null;
  invoice: { id: string; number: string; date: string; dueDate?: string | null; total: number | string; amountPaid: number | string; balance: number | string; currency: string; status: string };
};
const loanFrequencyLabels: Record<LoanFrequency, string> = {
  DAILY: 'Diaria',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quincenal',
  MONTHLY: 'Mensual',
};
type CashSessionOption = { id: string; registerId: string; registerName: string; sessionName: string };
type LoanCurrency = 'NIO' | 'USD';
const emptyManualInstallment = (): CustomerCreditManualInstallmentDraft => ({ dueDate: '', totalAmount: '', interestAmount: '' });

const unwrap = (response: any) => response?.data?.data ?? response?.data ?? response;
const unwrapList = (response: any): any[] => {
  const value = unwrap(response);
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
};
const money = (value: unknown, currency: string) => new Intl.NumberFormat('es-NI', {
  style: 'currency', currency: String(currency || 'NIO').toUpperCase(), maximumFractionDigits: getCurrencyDecimalPlaces(),
}).format(Number(value || 0));
const localDate = (value?: string | null) => {
  if (!value) return 'Sin fecha';
  const raw = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(Number(raw.slice(0, 4)), Number(raw.slice(5, 7)) - 1, Number(raw.slice(8, 10)))
    : new Date(raw);
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium' }).format(date);
};

interface CustomerLoansPanelProps {
  customerId: string;
  customerName: string;
  moraTypeId?: string | null;
  moraType?: MoraType | null;
  enabled: boolean;
  canCreateLoan: boolean;
  canCreateMora: boolean;
  canEditMora: boolean;
  onUpdated?: () => void;
  onMoraTypeUpdated?: (moraType: MoraType | null) => void;
  onReady?: () => void;
}

export function CustomerLoansPanel({ customerId, customerName, moraTypeId, moraType, enabled, canCreateLoan, canCreateMora, canEditMora, onUpdated, onMoraTypeUpdated, onReady }: CustomerLoansPanelProps) {
  const { baseCurrency } = useCurrency();
  const { user, selectedBranchId } = useAuth();
  const { themeConfig } = useTheme();
  const queryClient = useQueryClient();
  const tenantId = String(user?.clientTenantId || user?.tenantId || '');
  const loansQueryKey = useMemo(() => ['sales', 'customer-loans', tenantId, selectedBranchId || 'all-branches', customerId] as const, [tenantId, selectedBranchId, customerId]);
  const loansQuery = useInfiniteQuery({
    queryKey: loansQueryKey,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => customersService.getCustomerLoansPage(customerId, { limit: 50, cursor: pageParam || undefined }, signal),
    getNextPageParam: (page) => page.hasMore ? page.nextCursor || undefined : undefined,
    enabled: Boolean(enabled && tenantId && customerId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const moraTypesQuery = useQuery({
    queryKey: ['sales', 'customer-loan-mora-types', tenantId],
    queryFn: customersService.getLoanMoraTypes,
    enabled: Boolean(enabled && tenantId && customerId),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const loans = loansQuery.data?.pages.flatMap((page) => page.data) as CustomerLoan[] | undefined || [];
  const moraTypes = unwrapList(moraTypesQuery.data) as MoraType[];
  const moraActions = getCustomerLoanMoraActions(canCreateMora, canEditMora);
  const loading = loansQuery.isPending || moraTypesQuery.isPending;
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [moraOpen, setMoraOpen] = useState(false);
  const [moraFormOpen, setMoraFormOpen] = useState(false);
  const [editingMora, setEditingMora] = useState<MoraType | null>(null);
  const [moraName, setMoraName] = useState('');
  const [moraDescription, setMoraDescription] = useState('');
  const [assignedMoraTypeId, setAssignedMoraTypeId] = useState(moraTypeId || '');
  const [moraTypeSelection, setMoraTypeSelection] = useState(moraTypeId || '');
  const readyReported = useRef(false);
  const [form, setForm] = useState<{
    principal: string; interest: string; interestMode: 'NONE' | 'FIXED_AMOUNT' | 'PERCENTAGE'; frequency: LoanFrequency;
    dueDate: string; firstInstallmentDate: string; planCalculationMode: 'AMOUNT' | 'DEADLINE' | 'MANUAL';
    planEnabled: boolean; installmentAmount: string; manualInstallments: CustomerCreditManualInstallmentDraft[];
    currency: LoanCurrency; disbursementSource: 'CASH' | 'BANK';
    cashRegisterSessionId: string; bankAccountId: string; notes: string;
  }>({
    principal: '', interest: '', interestMode: 'NONE', frequency: 'WEEKLY' as LoanFrequency, dueDate: '', firstInstallmentDate: '', planCalculationMode: 'AMOUNT', planEnabled: false, installmentAmount: '', manualInstallments: [emptyManualInstallment()],
    currency: baseCurrency as LoanCurrency, disbursementSource: 'CASH',
    cashRegisterSessionId: '', bankAccountId: '', notes: '',
  });

  const loadLoans = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: loansQueryKey });
  }, [queryClient, loansQueryKey]);

  useEffect(() => {
    if (loansQuery.error) toast.error((loansQuery.error as any)?.message || 'No se pudo cargar el historial de préstamos.');
  }, [loansQuery.error]);

  useEffect(() => {
    if (moraTypesQuery.error) toast.error((moraTypesQuery.error as any)?.message || 'No se pudieron cargar los tipos de mora.');
  }, [moraTypesQuery.error]);

  useEffect(() => {
    readyReported.current = false;
  }, [customerId, enabled]);

  useEffect(() => {
    if (!enabled || readyReported.current || !loansQuery.isSuccess || !moraTypesQuery.isSuccess) return;
    readyReported.current = true;
    onReady?.();
  }, [enabled, loansQuery.isSuccess, moraTypesQuery.isSuccess, loansQuery.dataUpdatedAt, moraTypesQuery.dataUpdatedAt, onReady]);

  useEffect(() => {
    const currentId = moraTypeId || '';
    setAssignedMoraTypeId(currentId);
    setMoraTypeSelection(currentId);
  }, [customerId, moraTypeId]);

  const cashSessionsQuery = useQuery({
    queryKey: ['caja', 'customer-loan-disbursement-sessions', tenantId, user?.id],
    queryFn: async () => {
      const registers = unwrapList(await cajaService.getRegisterLookup());
      const sessions = await Promise.all(registers.filter((item: any) => item.isActive !== false).map(async (register: any) => {
        try {
          const active = unwrap(await cajaService.getActiveSession(String(register.id)));
          const session = active?.session || active?.activeSession || active;
          const id = String(session?.id || session?.sessionId || '');
          if (!id || String(session?.status || 'OPEN').toUpperCase() !== 'OPEN') return null;
          return { id, registerId: String(register.id), registerName: String(register.name || register.code || 'Caja'), sessionName: String(session.name || session.number || '') } satisfies CashSessionOption;
        } catch { return null; }
      }));
      return sessions.filter((item): item is CashSessionOption => item !== null);
    },
    enabled: createOpen && form.disbursementSource === 'CASH' && Boolean(tenantId),
  });
  const cashSessions = cashSessionsQuery.data ?? [];
  const cashLoading = cashSessionsQuery.isFetching;
  const selectedCashSessionId = cashSessions.some((item) => item.id === form.cashRegisterSessionId)
    ? form.cashRegisterSessionId
    : cashSessions[0]?.id || '';

  useEffect(() => {
    if (cashSessionsQuery.error) toast.error((cashSessionsQuery.error as any)?.message || 'No se pudieron cargar las sesiones de Caja.');
  }, [cashSessionsQuery.error]);

  const pageSummary = loansQuery.data?.pages[0]?.summary;
  const outstandingByCurrency = pageSummary?.outstandingByCurrency.reduce<Record<string, number>>((totals, item) => {
    totals[item.currency] = Number(item.amount || 0);
    return totals;
  }, {}) ?? loans.reduce<Record<string, number>>((totals, loan) => {
    const currency = String(loan.invoice?.currency || loan.currency || baseCurrency).toUpperCase();
    totals[currency] = (totals[currency] || 0) + Math.max(0, Number(loan.invoice?.balance || 0));
    return totals;
  }, {});
  const formInterest = form.interestMode === 'NONE' ? 0 : form.interestMode === 'PERCENTAGE'
    ? roundCurrencyNumber(Number(form.principal || 0) * Number(form.interest || 0) / 100)
    : roundCurrencyNumber(Number(form.interest || 0));
  const installmentPlanEstimate = form.planEnabled
    ? calculateCustomerCreditPlanEstimate({
      principal: Number(form.principal || 0),
      interest: formInterest,
      frequency: form.frequency,
      firstInstallmentDate: form.firstInstallmentDate,
      calculationMode: form.planCalculationMode,
      installmentAmount: form.installmentAmount,
      finalDueDate: form.dueDate,
      manualInstallments: form.manualInstallments,
    })
    : null;

  const printInstallmentPlan = async (input: {
    installments: CustomerCreditPlanInstallment[];
    principalAmount: number;
    interestAmount: number;
    currency: string;
    contractNumber: string;
    frequency?: LoanFrequency | null;
  }) => {
    const toastId = toast.loading('Preparando el reporte de abonos...');
    try {
      const report = await generateCustomerCreditInstallmentReport({
        tenantName: user?.sessionBranding?.name || themeConfig?.tenantName || user?.tenantName || 'Mi Empresa',
        tenantLogo: themeConfig?.logo || user?.sessionBranding?.logo,
        title: 'Plan de abonos del préstamo',
        customerName,
        contractNumber: input.contractNumber,
        currency: input.currency,
        frequencyLabel: input.frequency ? loanFrequencyLabels[input.frequency] || input.frequency : undefined,
        principalAmount: input.principalAmount,
        interestAmount: input.interestAmount,
        installments: input.installments,
      });
      if (!report) throw new Error('No se pudo generar el reporte.');
      toast.success('Reporte de abonos listo para imprimir o guardar como PDF.', { id: toastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo preparar el reporte de abonos.', { id: toastId });
    }
  };
  const resetLoanForm = () => setForm({
    principal: '', interest: '', interestMode: 'NONE', frequency: 'WEEKLY', dueDate: '', firstInstallmentDate: '', planCalculationMode: 'AMOUNT', planEnabled: false, installmentAmount: '', manualInstallments: [emptyManualInstallment()],
    currency: baseCurrency as LoanCurrency, disbursementSource: 'CASH', cashRegisterSessionId: '', bankAccountId: '', notes: '',
  });

  const submitLoan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.planEnabled && (!installmentPlanEstimate || !installmentPlanEstimate.isValid)) { toast.error(installmentPlanEstimate?.validationErrors[0] || 'Completa los datos del plan de abonos para calcular el vencimiento.'); return; }
    if (form.disbursementSource === 'CASH' && !selectedCashSessionId) { toast.error('No hay una sesión abierta de Caja seleccionada.'); return; }
    if (form.disbursementSource === 'BANK' && !form.bankAccountId) { toast.error('Selecciona una cuenta bancaria.'); return; }
    setSaving(true);
    try {
      const key = globalThis.crypto?.randomUUID?.() || `loan-${customerId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await customersService.createCustomerLoan(customerId, {
        principal: Number(form.principal), interest: Number(form.interest || 0), interestMode: form.interestMode,
        interestValue: Number(form.interest || 0), planEnabled: form.planEnabled,
        planCalculationMode: form.planCalculationMode,
        ...(form.planCalculationMode !== 'MANUAL' ? { installmentAmount: installmentPlanEstimate?.installmentAmount || Number(form.installmentAmount || 0), frequency: form.frequency } : {}),
        firstInstallmentDate: form.planEnabled ? installmentPlanEstimate?.firstInstallmentDate : undefined,
        manualInstallments: form.planEnabled && form.planCalculationMode === 'MANUAL'
          ? form.manualInstallments.map((item) => ({ dueDate: item.dueDate, totalAmount: Number(item.totalAmount), interestAmount: Number(item.interestAmount) }))
          : undefined,
        dueDate: form.planEnabled ? installmentPlanEstimate?.finalDueDate : form.dueDate, currency: form.currency,
        disbursementSource: form.disbursementSource,
        ...(form.disbursementSource === 'CASH' ? { cashRegisterSessionId: selectedCashSessionId } : { bankAccountId: form.bankAccountId }),
        notes: form.notes,
      }, key);
      toast.success('Préstamo creado y desembolsado.');
      setCreateOpen(false);
      resetLoanForm();
      await loadLoans();
      onUpdated?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo crear el préstamo.');
    } finally { setSaving(false); }
  };

  const saveCustomerMoraType = async () => {
    setSaving(true);
    try {
      const nextId = moraTypeSelection || '';
      await customersService.update(customerId, { moraTypeId: nextId || null });
      setAssignedMoraTypeId(nextId);
      onMoraTypeUpdated?.(nextId ? moraTypes.find((item) => item.id === nextId) || moraType || null : null);
      toast.success(nextId ? 'Clasificación de mora actualizada para el cliente.' : 'Clasificación de mora retirada del cliente.');
      onUpdated?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo actualizar la clasificación de mora.');
    } finally { setSaving(false); }
  };

  const openMoraForm = (item?: MoraType) => {
    setEditingMora(item || null);
    setMoraName(item?.name || '');
    setMoraDescription(item?.description || '');
    setMoraFormOpen(true);
  };

  const saveMoraType = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingMora) await customersService.updateLoanMoraType(editingMora.id, { name: moraName, description: moraDescription });
      else await customersService.createLoanMoraType({ name: moraName, description: moraDescription });
      toast.success(editingMora ? 'Tipo de mora actualizado.' : 'Tipo de mora creado.');
      setMoraFormOpen(false);
      await loadLoans();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo guardar el tipo de mora.');
    } finally { setSaving(false); }
  };

  const toggleMoraType = async (item: MoraType) => {
    try {
      await customersService.updateLoanMoraType(item.id, { isActive: !item.isActive });
      await loadLoans();
      toast.success(item.isActive ? 'Tipo de mora desactivado; su historial se conserva.' : 'Tipo de mora activado.');
    } catch (error: any) { toast.error(error?.response?.data?.message || error?.message || 'No se pudo cambiar el estado.'); }
  };

  return (
    <section className="min-w-0 space-y-4" aria-label="Préstamos del cliente">
      <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm sm:p-5">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-foreground"><Banknote className="size-4 text-primary" /> Préstamos de {customerName}</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">Cada préstamo conserva su factura, desembolso y saldo por separado.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {moraActions.canOpenCatalog && <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl text-xs" onClick={() => setMoraOpen(true)}><Settings2 className="size-3.5" /> Tipos de mora</Button>}
            {enabled && canCreateLoan && <Button type="button" size="sm" className="h-9 gap-1.5 rounded-xl text-xs" onClick={() => { resetLoanForm(); setCreateOpen(true); }}><Plus className="size-3.5" /> Nuevo préstamo</Button>}
          </div>
        </div>
        {!enabled && <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">Los préstamos y sus recordatorios están ocultos mientras esta función esté desactivada. Los datos históricos se conservan.</p>}
      </Card>

      <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm sm:p-5">
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 flex-1 space-y-1.5">
            {canEditMora ? <Label htmlFor="customer-mora-type">Clasificación de mora del cliente</Label> : <p className="text-xs font-medium text-muted-foreground">Clasificación de mora del cliente</p>}
            {canEditMora ? (
              <Select value={moraTypeSelection || '__none__'} onValueChange={(value) => setMoraTypeSelection(value === '__none__' ? '' : value)}>
                <SelectTrigger id="customer-mora-type" className="max-w-full"><SelectValue placeholder="Sin clasificación asignada" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin clasificación asignada</SelectItem>
                  {moraType && !moraTypes.some((item) => item.id === moraType.id) && <SelectItem value={moraType.id} disabled={!moraType.isActive}>{moraType.name}{!moraType.isActive ? ' · Inactivo' : ''}</SelectItem>}
                  {moraTypes.map((item) => <SelectItem key={item.id} value={item.id} disabled={!item.isActive && item.id !== assignedMoraTypeId}>{item.name}{!item.isActive ? ' · Inactivo' : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex min-h-10 items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-3">
                <Badge variant="outline">{moraType?.name || moraTypes.find((item) => item.id === assignedMoraTypeId)?.name || 'Sin clasificación asignada'}</Badge>
                {moraType && !moraType.isActive && <Badge variant="outline" className="text-[9px]">Inactivo</Badge>}
              </div>
            )}
            <p className="text-[11px] leading-relaxed text-muted-foreground">Se asigna o cambia manualmente cuando el cliente deja de estar al día. No avanza automáticamente por días ni por vencimientos.</p>
          </div>
          {canEditMora && <Button type="button" variant="outline" className="shrink-0 gap-2 rounded-xl" disabled={saving || moraTypeSelection === assignedMoraTypeId} onClick={() => void saveCustomerMoraType()}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Guardar clasificación</Button>}
        </div>
      </Card>

      <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm sm:p-5">
        <div className="mt-0 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Préstamos vigentes</p><p className="mt-1 text-lg font-black tabular-nums text-foreground">{pageSummary?.activeCount ?? loans.filter((item) => Number(item.invoice?.balance || 0) > 0.01).length}</p></div>
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Saldo pendiente por moneda</p><div className="mt-1 space-y-1">{Object.entries(outstandingByCurrency).length ? Object.entries(outstandingByCurrency).map(([currency, amount]) => <p key={currency} className="break-words text-lg font-black tabular-nums text-rose-600 dark:text-rose-400">{money(amount, currency)}</p>) : <p className="text-lg font-black tabular-nums text-rose-600 dark:text-rose-400">{money(0, baseCurrency)}</p>}</div></div>
        </div>
      </Card>

      {loading ? <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/50 p-8 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando préstamos…</div> : loans.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-border/60 bg-muted/10 p-8 text-center"><Banknote className="mx-auto size-8 text-muted-foreground/40" /><p className="mt-2 text-sm font-bold text-foreground">Sin préstamos registrados</p><p className="mt-1 text-xs text-muted-foreground">Los préstamos nuevos aparecerán aquí con su factura y fecha de vencimiento.</p></Card>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
          {loans.map((loan) => {
            const balance = Math.max(0, Number(loan.invoice?.balance || 0));
            const status = String(loan.invoice?.status || '').toUpperCase();
            return (
              <Card key={loan.id} className="min-w-0 rounded-2xl border-border/60 bg-card p-4 shadow-sm sm:p-5">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0"><p className="flex items-center gap-2 break-all text-sm font-black text-foreground"><FileText className="size-4 shrink-0 text-primary" /> Factura {loan.invoice?.number || '—'}</p><p className="mt-1 text-[10px] text-muted-foreground">Desembolsado {localDate(loan.invoice?.date)}</p></div>
                  <Badge variant="outline" className={balance > 0.01 ? 'shrink-0 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'shrink-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}>{balance > 0.01 ? (status === 'OVERDUE' ? 'Vencido' : 'Pendiente') : 'Liquidado'}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5"><p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Principal</p><p className="mt-1 break-words font-bold tabular-nums">{money(loan.principal, loan.currency)}</p></div>
                  <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5"><p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Interés fijo</p><p className="mt-1 break-words font-bold tabular-nums">{money(loan.interest, loan.currency)}</p></div>
                  <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5"><p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-muted-foreground"><Clock3 className="size-3" /> Calendario</p><p className="mt-1 font-bold">{loan.planEnabled ? (loan.planCalculationMode === 'MANUAL' ? 'Manual' : loan.frequency ? loanFrequencyLabels[loan.frequency] : '—') : 'Vencimiento único'}</p></div>
                  {loan.planEnabled ? <><div className="rounded-lg border border-border/40 bg-muted/20 p-2.5"><p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-muted-foreground"><CalendarDays className="size-3" /> Primer abono</p><p className="mt-1 font-bold">{localDate(loan.firstInstallmentDate || loan.installments?.[0]?.dueDate)}</p></div><div className="rounded-lg border border-border/40 bg-muted/20 p-2.5"><p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-muted-foreground"><CalendarDays className="size-3" /> Vencimiento final</p><p className="mt-1 font-bold">{localDate(loan.installments?.[loan.installments.length - 1]?.dueDate || loan.dueDate || loan.invoice?.dueDate)}</p></div></> : <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5"><p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-muted-foreground"><CalendarDays className="size-3" /> Vencimiento</p><p className="mt-1 font-bold">{localDate(loan.dueDate || loan.invoice?.dueDate)}</p></div>}
                  {loan.installments?.length ? <><div className="rounded-lg border border-border/40 bg-muted/20 p-2.5"><p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Saldo de capital</p><p className="mt-1 font-bold">{money(loan.principalBalance, loan.currency)}</p></div><div className="rounded-lg border border-border/40 bg-muted/20 p-2.5"><p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Saldo de intereses</p><p className="mt-1 font-bold">{money(loan.interestBalance, loan.currency)}</p></div></> : null}
                </div>
                <div className="mt-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  {loan.moraTypeNameSnapshot && <div className="min-w-0 rounded-xl border border-border/50 bg-muted/10 p-3"><p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Clasificación histórica guardada al emitir</p><p className="mt-1 break-words text-xs font-bold text-foreground">{loan.moraTypeNameSnapshot}</p>{loan.moraTypeDescriptionSnapshot && <p className="mt-1 break-words text-[11px] text-muted-foreground">{loan.moraTypeDescriptionSnapshot}</p>}</div>}
                  <div className="shrink-0 sm:ml-auto sm:text-right"><p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Pendiente</p><p className="mt-1 text-sm font-black tabular-nums text-rose-600 dark:text-rose-400">{money(balance, loan.currency)}</p></div>
                </div>
                <p className="mt-3 text-[10px] text-muted-foreground">Total facturado: <span className="font-bold text-foreground">{money(loan.total, loan.currency)}</span> · Abonado: <span className="font-bold text-foreground">{money(loan.invoice?.amountPaid, loan.currency)}</span></p>
                {loan.installments?.length ? <details className="mt-3 rounded-xl border border-border/50 p-3"><summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest">Ver calendario ({loan.installments.length} cuotas)</summary><div className="mt-3"><CustomerCreditInstallmentSchedule
                  installments={loan.installments}
                  currency={loan.currency}
                  formatAmount={(amount) => money(amount, loan.currency)}
                  principalAmount={Number(loan.principal || 0)}
                  interestAmount={Number(loan.interest || 0)}
                  totalAmount={Number(loan.total || 0)}
                  installmentAmount={loan.installmentAmount == null ? undefined : Number(loan.installmentAmount)}
                  finalDueDate={loan.installments[loan.installments.length - 1]?.dueDate || loan.dueDate}
                  frequencyLabel={loan.frequency ? loanFrequencyLabels[loan.frequency] || loan.frequency : undefined}
                  onPrint={() => void printInstallmentPlan({ installments: loan.installments!, principalAmount: Number(loan.principal || 0), interestAmount: Number(loan.interest || 0), currency: loan.currency, contractNumber: loan.invoice?.number || loan.id, frequency: loan.frequency })}
                /></div></details> : null}
              </Card>
            );
          })}
        </div>
      )}
      {loansQuery.hasNextPage && <div className="flex justify-center"><Button type="button" variant="outline" onClick={() => loansQuery.fetchNextPage()} disabled={loansQuery.isFetchingNextPage} className="gap-2 rounded-xl">{loansQuery.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />} Cargar más préstamos</Button></div>}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] overflow-y-auto rounded-2xl sm:max-w-xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Banknote className="size-5 text-primary" /> Crear préstamo</DialogTitle><DialogDescription>Se emitirá una factura de servicio por el principal y el interés fijo, y se registrará el desembolso. El sistema valida el límite de crédito disponible.</DialogDescription></DialogHeader>
          <form id="customer-loan-form" onSubmit={submitLoan} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="loan-principal" className="flex items-end leading-tight sm:min-h-10">Principal a prestar *</Label><Input id="loan-principal" type="number" min="0.01" step="0.01" required value={form.principal} onChange={(event) => setForm({ ...form, principal: event.target.value })} currencyPrecision /></div>
            <div className="space-y-1.5"><Label className="flex items-end leading-tight sm:min-h-10">Interés opcional</Label><Select value={form.interestMode} onValueChange={(value) => setForm({ ...form, interestMode: value as typeof form.interestMode, interest: value === 'NONE' ? '' : form.interest })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">Sin interés</SelectItem><SelectItem value="FIXED_AMOUNT">Monto fijo</SelectItem><SelectItem value="PERCENTAGE">Porcentaje único</SelectItem></SelectContent></Select></div>
            {form.interestMode !== 'NONE' && <div className="space-y-1.5"><Label htmlFor="loan-interest" className="flex items-end leading-tight sm:min-h-10">{form.interestMode === 'PERCENTAGE' ? 'Porcentaje sobre el principal (%)' : 'Interés fijo'}</Label><Input id="loan-interest" type="number" min="0" max={form.interestMode === 'PERCENTAGE' ? 100 : undefined} step="0.01" required value={form.interest} onChange={(event) => setForm({ ...form, interest: event.target.value })} currencyPrecision /></div>}
            <div className="flex items-start gap-2 rounded-xl border border-border/50 p-3 sm:col-span-2"><input id="loan-plan-enabled" type="checkbox" className="mt-0.5 size-4 accent-primary" checked={form.planEnabled} onChange={(event) => setForm({ ...form, planEnabled: event.target.checked })} /><Label htmlFor="loan-plan-enabled" className="cursor-pointer text-xs">Definir un plan de abonos</Label></div>
            {form.planEnabled ? <>
              {form.planCalculationMode !== 'MANUAL' && <div className="space-y-1.5"><Label className="flex items-end leading-tight sm:min-h-10">Frecuencia de pago *</Label><Select value={form.frequency} onValueChange={(value) => setForm({ ...form, frequency: value as LoanFrequency })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DAILY">Diaria</SelectItem><SelectItem value="WEEKLY">Semanal</SelectItem><SelectItem value="BIWEEKLY">Quincenal</SelectItem><SelectItem value="MONTHLY">Mensual</SelectItem></SelectContent></Select></div>}
              <div className="space-y-1.5"><Label className="flex items-end leading-tight sm:min-h-10">Método de cálculo *</Label><Select value={form.planCalculationMode} onValueChange={(value) => setForm({ ...form, planCalculationMode: value as typeof form.planCalculationMode })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AMOUNT">Monto por abono</SelectItem><SelectItem value="DEADLINE">Fecha de vencimiento</SelectItem><SelectItem value="MANUAL">Manual</SelectItem></SelectContent></Select></div>
              {form.planCalculationMode !== 'MANUAL' && <div className="space-y-1.5"><Label htmlFor="loan-first-installment" className="flex items-end leading-tight sm:min-h-10">Fecha del primer abono *</Label><Input id="loan-first-installment" type="date" required value={form.firstInstallmentDate} onChange={(event) => setForm({ ...form, firstInstallmentDate: event.target.value })} /></div>}
              {form.planCalculationMode === 'AMOUNT'
                ? <div className="space-y-1.5"><Label htmlFor="loan-installment-amount" className="flex items-end leading-tight sm:min-h-10">Monto por abono *</Label><Input id="loan-installment-amount" type="number" min="0.01" step="0.01" required value={form.installmentAmount} onChange={(event) => setForm({ ...form, installmentAmount: event.target.value })} currencyPrecision /></div>
                : form.planCalculationMode === 'DEADLINE' ? <div className="space-y-1.5"><Label htmlFor="loan-final-due-date" className="flex items-end leading-tight sm:min-h-10">Fecha final de vencimiento *</Label><Input id="loan-final-due-date" type="date" required min={form.firstInstallmentDate || undefined} value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></div> : null}
              {installmentPlanEstimate && <div className="sm:col-span-2"><CustomerCreditInstallmentSchedule
                installments={installmentPlanEstimate.schedule}
                currency={form.currency}
                formatAmount={(amount) => money(amount, form.currency)}
                principalAmount={installmentPlanEstimate.principalAmount}
                interestAmount={installmentPlanEstimate.interestAmount}
                totalAmount={installmentPlanEstimate.totalAmount}
                installmentAmount={installmentPlanEstimate.installmentAmount}
                finalDueDate={installmentPlanEstimate.finalDueDate}
                frequencyLabel={form.planCalculationMode === 'MANUAL' ? undefined : loanFrequencyLabels[form.frequency]}
                manualInstallments={form.planCalculationMode === 'MANUAL' ? form.manualInstallments : undefined}
                manualValidation={form.planCalculationMode === 'MANUAL' ? installmentPlanEstimate : undefined}
                onManualInstallmentChange={form.planCalculationMode === 'MANUAL' ? (index, field, value) => setForm((previous) => ({ ...previous, manualInstallments: previous.manualInstallments.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) })) : undefined}
                onAddManualInstallment={form.planCalculationMode === 'MANUAL' ? () => setForm((previous) => ({ ...previous, manualInstallments: [...previous.manualInstallments, emptyManualInstallment()] })) : undefined}
                onRemoveManualInstallment={form.planCalculationMode === 'MANUAL' ? (index) => setForm((previous) => ({ ...previous, manualInstallments: previous.manualInstallments.filter((_, itemIndex) => itemIndex !== index) })) : undefined}
                onPrint={() => void printInstallmentPlan({ installments: installmentPlanEstimate.schedule, principalAmount: installmentPlanEstimate.principalAmount, interestAmount: installmentPlanEstimate.interestAmount, currency: form.currency, contractNumber: `Préstamo · ${customerName}`, frequency: form.planCalculationMode === 'MANUAL' ? null : form.frequency })}
              /></div>}
            </> : <div className="space-y-1.5"><Label htmlFor="loan-due-date" className="flex items-end leading-tight sm:min-h-10">Fecha de vencimiento *</Label><Input id="loan-due-date" type="date" required value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></div>}
             <div className="space-y-1.5"><Label className="flex items-end leading-tight sm:min-h-10">Moneda *</Label><Select value={form.currency} onValueChange={(value) => setForm({ ...form, currency: value as LoanCurrency, bankAccountId: '' })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NIO">Córdoba (NIO)</SelectItem><SelectItem value="USD">Dólar (USD)</SelectItem></SelectContent></Select></div>
             <div className="space-y-1.5 sm:col-span-2"><Label className="flex items-end leading-tight sm:min-h-10">Desembolso desde *</Label><Select value={form.disbursementSource} onValueChange={(value) => setForm({ ...form, disbursementSource: value as 'CASH' | 'BANK', cashRegisterSessionId: '', bankAccountId: '' })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CASH">Caja</SelectItem><SelectItem value="BANK">Banco</SelectItem></SelectContent></Select></div>
             {form.disbursementSource === 'CASH' ? <div className="space-y-1.5 sm:col-span-2"><Label className="flex items-end leading-tight sm:min-h-10">Sesión abierta de Caja *</Label><Select value={selectedCashSessionId} onValueChange={(value) => setForm({ ...form, cashRegisterSessionId: value })} disabled={cashLoading || cashSessions.length === 0}><SelectTrigger className="h-9"><SelectValue placeholder={cashLoading ? 'Buscando sesiones abiertas…' : 'Seleccionar sesión'} /></SelectTrigger><SelectContent>{cashSessions.map((item) => <SelectItem key={item.id} value={item.id}>{item.registerName}{item.sessionName ? ` · ${item.sessionName}` : ''}</SelectItem>)}</SelectContent></Select>{!cashLoading && cashSessions.length === 0 && <p className="text-[11px] text-destructive">No hay cajas con sesión abierta disponible.</p>}</div> : <BankAccountSelect className="sm:col-span-2" currency={form.currency} endpoint="/bank-accounts/payment-options" value={form.bankAccountId} onChange={(value) => setForm({ ...form, bankAccountId: value })} label="Cuenta bancaria de salida" showCommissionPercent={false} />}
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="loan-notes">Notas (opcional)</Label><Input id="loan-notes" maxLength={500} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Referencia o acuerdo de pago" /></div>
            <p className="text-[11px] leading-relaxed text-muted-foreground sm:col-span-2">El principal más el interés debe caber en el límite de crédito disponible. La clasificación de mora se administra manualmente en la ficha del cliente.</p>
          </form>
          <DialogFooter className="gap-2 sm:justify-end"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button type="submit" form="customer-loan-form" disabled={saving || (form.disbursementSource === 'CASH' && cashLoading) || (form.planEnabled && (!installmentPlanEstimate || !installmentPlanEstimate.isValid))}>{saving && <Loader2 className="mr-2 size-4 animate-spin" />} Emitir y desembolsar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moraOpen} onOpenChange={setMoraOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] overflow-y-auto rounded-2xl sm:max-w-xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings2 className="size-5 text-primary" /> Tipos de mora</DialogTitle><DialogDescription>Define las clasificaciones que se asignan manualmente a la ficha del cliente cuando deja de estar al día. No se modifican automáticamente según la fecha.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            {moraTypes.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">{moraActions.canCreateType ? 'Aún no hay tipos de mora. Agrega uno para asignarlo manualmente a un cliente cuando corresponda.' : 'Aún no hay tipos de mora configurados para esta sucursal.'}</p>}
            {moraTypes.map((item) => <div key={item.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-border/50 bg-muted/10 p-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex items-center gap-2"><p className="break-words text-xs font-bold text-foreground">{item.name}</p><Badge variant="outline" className="shrink-0 text-[9px]">{item.isActive ? 'Activo' : 'Inactivo'}</Badge></div><p className="mt-1 break-words text-[11px] text-muted-foreground">{item.description}</p></div>{moraActions.canEditTypes && <div className="flex shrink-0 gap-2"><Button type="button" size="sm" variant="outline" className="h-8 rounded-lg text-[10px]" onClick={() => openMoraForm(item)}>Editar</Button><Button type="button" size="sm" variant="outline" className="h-8 rounded-lg text-[10px]" onClick={() => void toggleMoraType(item)}>{item.isActive ? 'Desactivar' : 'Activar'}</Button></div>}</div>)}
            {moraActions.canCreateType && <Button type="button" className="w-full gap-2 rounded-xl" onClick={() => openMoraForm()}><Plus className="size-4" /> Agregar tipo de mora</Button>}
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setMoraOpen(false)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moraFormOpen} onOpenChange={setMoraFormOpen}>
        <DialogContent className="w-[calc(100%-1rem)] rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle>{editingMora ? 'Editar tipo de mora' : 'Agregar tipo de mora'}</DialogTitle><DialogDescription>La clasificación se asigna manualmente al cliente. Los datos históricos guardados en préstamos anteriores se conservan.</DialogDescription></DialogHeader>
          <form id="mora-type-form" onSubmit={saveMoraType} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="mora-name">Nombre *</Label><Input id="mora-name" required maxLength={80} value={moraName} onChange={(event) => setMoraName(event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="mora-description">Explicación *</Label><textarea id="mora-description" required maxLength={500} value={moraDescription} onChange={(event) => setMoraDescription(event.target.value)} className="min-h-24 w-full max-w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
          </form>
          <DialogFooter className="gap-2"><Button type="button" variant="outline" onClick={() => setMoraFormOpen(false)}>Cancelar</Button><Button type="submit" form="mora-type-form" disabled={saving}>{saving && <Loader2 className="mr-2 size-4 animate-spin" />}Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
