import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BriefcaseBusiness, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { useAuth } from '../../contexts/AuthContext';
import { hrService } from '../../services/hr.service';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

type CommissionScope = 'GLOBAL' | 'SELLER';
type CommissionRuleRow = { minAmount: number | string; maxAmount: number | string; rate: number | string };
type CommissionPlan = { sellerEmployeeId?: string | null; currency?: string; isActive?: boolean; rules?: CommissionRuleRow[] };
type CommissionConfiguration = { global?: CommissionPlan | null; sellerPlans?: CommissionPlan[]; sellers?: Array<{ id: string; name: string; employeeNumber?: string | null }> };

const emptyCommissionRule = (): CommissionRuleRow => ({ minAmount: 0, maxAmount: '', rate: 0 });

export function CommissionScaleConfigurationView({ onBack }: { onBack?: () => void }) {
  const { user, canPerform } = useAuth();
  const canRead = canPerform('HR_COMMISSIONS_CONFIG', 'view');
  const canEdit = canPerform('HR_COMMISSIONS_CONFIG', 'edit');
  const [commissionScope, setCommissionScope] = useState<CommissionScope>('GLOBAL');
  const [commissionSellerId, setCommissionSellerId] = useState('');
  const [commissionCurrency, setCommissionCurrency] = useState<'NIO' | 'USD'>('NIO');
  const [commissionRules, setCommissionRules] = useState<CommissionRuleRow[]>([emptyCommissionRule()]);
  const [commissionPreviewAmount, setCommissionPreviewAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const configurationQuery = useQuery({
    queryKey: ['hr', 'commission-configuration', user?.clientTenantId],
    queryFn: ({ signal }) => hrService.getCommissionConfiguration(signal),
    enabled: canRead,
    staleTime: 30_000,
  });
  const configuration = configurationQuery.data as CommissionConfiguration | undefined;
  const sellers = configuration?.sellers || [];
  const sellerPlans = configuration?.sellerPlans || [];
  const selectedCommissionPlan = commissionScope === 'GLOBAL'
    ? configuration?.global
    : sellerPlans.find((plan) => plan.sellerEmployeeId === commissionSellerId);

  useEffect(() => {
    const plan = selectedCommissionPlan;
    setCommissionCurrency(plan?.currency === 'USD' ? 'USD' : 'NIO');
    setCommissionRules(plan?.rules?.length
      ? plan.rules.map((rule) => ({ minAmount: rule.minAmount, maxAmount: rule.maxAmount ?? '', rate: rule.rate }))
      : [emptyCommissionRule()]);
  }, [commissionScope, commissionSellerId, selectedCommissionPlan]);

  const validationError = () => {
    if (!commissionRules.length) return 'Agrega al menos un tramo.';
    const parsed = commissionRules.map((rule) => ({
      minAmount: Number(rule.minAmount),
      maxAmount: rule.maxAmount === '' || rule.maxAmount === null ? null : Number(rule.maxAmount),
      rate: Number(rule.rate),
    }));
    if (parsed.some((rule) => !Number.isFinite(rule.minAmount) || !Number.isFinite(rule.rate) || (rule.maxAmount !== null && !Number.isFinite(rule.maxAmount)))) return 'Completa todos los límites y porcentajes con valores válidos.';
    if (Math.round(parsed[0].minAmount * 100) !== 0) return 'El primer tramo debe comenzar en 0.';
    for (let index = 0; index < parsed.length; index += 1) {
      const current = parsed[index];
      const isLast = index === parsed.length - 1;
      if (current.minAmount < 0 || current.rate < 0 || current.rate > 100) return `Revisa el tramo ${index + 1}.`;
      if (current.maxAmount !== null && current.maxAmount < current.minAmount) return `El máximo del tramo ${index + 1} debe ser mayor o igual al mínimo.`;
      if (isLast && current.maxAmount !== null) return 'El último tramo debe quedar abierto.';
      if (!isLast && current.maxAmount === null) return 'Solo el último tramo puede quedar abierto.';
      const next = parsed[index + 1];
      if (next && current.maxAmount !== null && Math.round(next.minAmount * 100) !== Math.round(current.maxAmount * 100) + 1) return `Los tramos ${index + 1} y ${index + 2} deben ser consecutivos, sin huecos ni solapamientos.`;
    }
    return null;
  };

  const saveConfiguration = async () => {
    if (!canEdit) return;
    if (commissionScope === 'SELLER' && !commissionSellerId) {
      toast.error('Selecciona un vendedor para guardar una escala particular.');
      return;
    }
    const error = validationError();
    if (error) {
      toast.error(error);
      return;
    }
    try {
      setSaving(true);
      await hrService.saveCommissionConfiguration({
        scope: commissionScope,
        sellerEmployeeId: commissionScope === 'SELLER' ? commissionSellerId : null,
        currency: commissionCurrency,
        rules: commissionRules.map((rule) => ({ minAmount: Number(rule.minAmount), maxAmount: rule.maxAmount === '' ? null : Number(rule.maxAmount), rate: Number(rule.rate) })),
      });
      await configurationQuery.refetch();
      toast.success('Escala de comisiones guardada.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo guardar la escala.');
    } finally {
      setSaving(false);
    }
  };

  const resetConfiguration = async () => {
    if (!canEdit || !selectedCommissionPlan) return;
    if (commissionScope === 'SELLER' && !commissionSellerId) return;
    try {
      setSaving(true);
      await hrService.resetCommissionConfiguration({
        scope: commissionScope,
        sellerEmployeeId: commissionScope === 'SELLER' ? commissionSellerId : null,
      });
      await configurationQuery.refetch();
      toast.success(commissionScope === 'SELLER' ? 'Escala particular restablecida; el vendedor usará la global.' : 'Escala global restablecida.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo restablecer la escala.');
    } finally {
      setSaving(false);
    }
  };

  const updateCommissionRule = (index: number, field: keyof CommissionRuleRow, value: string) => {
    setCommissionRules((current) => current.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, [field]: value } : rule));
  };

  const addCommissionRule = () => {
    setCommissionRules((current) => {
      const last = current[current.length - 1];
      if (!last) return [emptyCommissionRule()];
      const start = Math.max(0, Number(last.minAmount) || 0);
      const nextMin = last.maxAmount === '' ? start + 1000 : Number(last.maxAmount) + 0.01;
      const next = last.maxAmount === '' ? { ...last, maxAmount: Number((nextMin - 0.01).toFixed(2)) } : last;
      return [...current.slice(0, -1), next, { minAmount: Number(nextMin.toFixed(2)), maxAmount: '', rate: last.rate }];
    });
  };

  const commissionPreview = useMemo(() => {
    const amount = Number(commissionPreviewAmount);
    if (!Number.isFinite(amount) || amount < 0) return null;
    const row = commissionRules.find((rule) => amount >= Number(rule.minAmount || 0) && (rule.maxAmount === '' || amount <= Number(rule.maxAmount)));
    if (!row) return null;
    const rate = Number(row.rate || 0);
    return { rate, amount: amount * rate / 100 };
  }, [commissionPreviewAmount, commissionRules]);

  if (!canRead) return null;

  return (
    <div className="min-w-0 space-y-4" data-tour="hr-commission-config">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-primary"><BriefcaseBusiness className="size-3.5" /> Configuración de comisiones</div>
          <h2 className="text-xl font-black tracking-tight sm:text-2xl">Escalas de vendedores</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Se aplica al subtotal neto antes de IVA y cargos. Una escala particular prevalece solo para ese vendedor; la escala global continúa activa como respaldo para los demás.</p>
        </div>
        {onBack && <Button variant="outline" onClick={onBack} className="h-10 shrink-0 gap-2 rounded-xl"><ArrowLeft className="size-4" /> Volver al reporte</Button>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="rounded-2xl border-border/60"><CardContent className="flex items-center justify-between gap-3 p-4"><div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Escala global</p><p className="mt-1 text-sm font-bold">{configuration?.global ? 'Activa para vendedores sin escala particular' : 'Sin escala activa'}</p></div><Badge variant={configuration?.global ? 'default' : 'secondary'}>{configuration?.global ? 'Activa' : 'Pendiente'}</Badge></CardContent></Card>
        <Card className="rounded-2xl border-border/60"><CardContent className="flex items-center justify-between gap-3 p-4"><div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Escalas particulares</p><p className="mt-1 text-sm font-bold">Prevalecen solo para el vendedor asignado</p></div><Badge variant="outline">{sellerPlans.length} activa(s)</Badge></CardContent></Card>
      </div>

      {configurationQuery.isError ? <Card className="rounded-2xl border-destructive/30"><CardContent className="flex flex-col justify-between gap-3 p-5 text-sm sm:flex-row sm:items-center"><span className="text-destructive">{configurationQuery.error instanceof Error ? configurationQuery.error.message : 'No se pudo cargar la configuración de comisiones.'}</span><Button variant="outline" size="sm" onClick={() => void configurationQuery.refetch()} disabled={configurationQuery.isFetching}>Reintentar</Button></CardContent></Card>
        : configurationQuery.isLoading ? <Card className="rounded-2xl border-border/60"><CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">Cargando escalas de comisiones…</CardContent></Card>
          : <Card className="overflow-hidden rounded-2xl border-primary/25 shadow-sm">
            <CardHeader className="border-b border-border/40 bg-primary/[0.04] pb-4"><CardTitle className="text-base font-black">Editar escala</CardTitle></CardHeader>
            <CardContent className="space-y-5 p-4 sm:p-6">
              <div className="grid min-w-0 gap-4 md:grid-cols-3">
                <div className="space-y-2"><Label htmlFor="commission-scope">Alcance</Label><select id="commission-scope" value={commissionScope} onChange={(event) => setCommissionScope(event.target.value as CommissionScope)} className="h-10 w-full max-w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"><option value="GLOBAL">Escala global</option><option value="SELLER">Escala particular por vendedor</option></select></div>
                <div className="space-y-2"><Label htmlFor="commission-seller">Vendedor</Label><select id="commission-seller" value={commissionSellerId || '__none__'} onChange={(event) => setCommissionSellerId(event.target.value === '__none__' ? '' : event.target.value)} disabled={commissionScope !== 'SELLER'} className="h-10 w-full max-w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary"><option value="__none__">Seleccionar vendedor</option>{sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}{seller.employeeNumber ? ` · ${seller.employeeNumber}` : ''}</option>)}</select></div>
                <div className="space-y-2"><Label htmlFor="commission-currency">Moneda de los tramos</Label><select id="commission-currency" value={commissionCurrency} onChange={(event) => setCommissionCurrency(event.target.value as 'NIO' | 'USD')} disabled={!canEdit} className="h-10 w-full max-w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"><option value="NIO">Córdobas (NIO)</option><option value="USD">Dólares (USD)</option></select></div>
              </div>
              {commissionScope === 'SELLER' && !commissionSellerId && <p className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">Selecciona un vendedor para consultar su escala. Si no tiene una particular, usará la escala global.</p>}
              {commissionScope === 'SELLER' && commissionSellerId && !selectedCommissionPlan && <p className="rounded-xl border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">Este vendedor todavía no tiene escala particular. Usará la escala global si está activa; una escala particular solo cambiará el cálculo de este vendedor.</p>}
              {!selectedCommissionPlan && !canEdit ? <p className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">No hay una escala activa para este alcance.</p> : <><div data-table-content-sized="true" className="overflow-x-auto rounded-xl border border-border/60"><table className="w-full min-w-[620px] text-sm"><thead className="bg-muted/30 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-3">Desde</th><th className="px-3 py-3">Hasta (inclusive)</th><th className="px-3 py-3">Porcentaje</th>{canEdit && <th className="px-3 py-3 text-right">Acción</th>}</tr></thead><tbody>{commissionRules.map((rule, index) => <tr key={`commission-rule-${index}`} className="border-t border-border/50"><td className="p-2"><Input type="number" min="0" step="0.01" value={rule.minAmount} disabled={!canEdit} onChange={(event) => updateCommissionRule(index, 'minAmount', event.target.value)} className="h-9" aria-label={`Mínimo tramo ${index + 1}`} /></td><td className="p-2"><Input type="number" min="0" step="0.01" value={rule.maxAmount} disabled={!canEdit} onChange={(event) => updateCommissionRule(index, 'maxAmount', event.target.value)} placeholder={index === commissionRules.length - 1 ? 'Sin límite' : 'Máximo'} className="h-9" aria-label={`Máximo tramo ${index + 1}`} /></td><td className="p-2"><div className="relative"><Input type="number" min="0" max="100" step="0.01" value={rule.rate} disabled={!canEdit} onChange={(event) => updateCommissionRule(index, 'rate', event.target.value)} className="h-9 pr-8" aria-label={`Porcentaje tramo ${index + 1}`} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span></div></td>{canEdit && <td className="p-2 text-right"><Button type="button" variant="ghost" size="icon" aria-label={`Eliminar tramo ${index + 1}`} disabled={commissionRules.length === 1 || saving} onClick={() => setCommissionRules((current) => current.filter((_, ruleIndex) => ruleIndex !== index))}><Trash2 className="size-4 text-destructive" /></Button></td>}</tr>)}</tbody></table></div>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><p className="text-xs text-muted-foreground">El primer tramo inicia en 0, los límites son inclusivos y el último debe quedar abierto.</p>{canEdit && <Button type="button" variant="outline" size="sm" onClick={addCommissionRule} disabled={saving} className="w-fit gap-2"><Plus className="size-4" /> Agregar tramo</Button>}</div>
              <div className="grid gap-4 rounded-xl border border-border/60 bg-muted/10 p-4 md:grid-cols-[1fr_auto_1fr] md:items-end"><div className="space-y-2"><Label htmlFor="commission-preview-amount">Vista previa en {commissionCurrency}</Label><Input id="commission-preview-amount" type="number" min="0" step="0.01" value={commissionPreviewAmount} onChange={(event) => setCommissionPreviewAmount(event.target.value)} placeholder="Ej. 5000" /></div><div className="text-center text-xs font-black text-muted-foreground md:flex md:h-10 md:items-center md:justify-center">→</div><div className="flex min-h-10 items-center rounded-xl border border-primary/20 bg-primary/[0.05] px-4 py-2 text-sm">{commissionPreview ? <><span className="font-black text-primary">{commissionPreview.rate.toFixed(2)}%</span><span className="mx-2 text-muted-foreground">=</span><span className="font-black">{commissionPreview.amount.toFixed(2)} {commissionCurrency}</span></> : <span className="text-muted-foreground">Ingresa un monto que esté dentro de un tramo válido.</span>}</div></div>
              {canEdit && <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row"><Button type="button" variant="outline" onClick={() => void resetConfiguration()} disabled={saving || !selectedCommissionPlan} className="gap-2"><RotateCcw className="size-4" /> Restablecer</Button><Button type="button" onClick={() => void saveConfiguration()} disabled={saving || (commissionScope === 'SELLER' && !commissionSellerId)} className="gap-2"><Save className="size-4" /> {saving ? 'Guardando…' : 'Guardar escala'}</Button></div>}
              </>}
            </CardContent>
          </Card>}
    </div>
  );
}
