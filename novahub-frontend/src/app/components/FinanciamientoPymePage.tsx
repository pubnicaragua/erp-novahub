import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Landmark, FileText, Calculator, Plus, Loader2, ArrowRight, ArrowLeft,
  CheckCircle2, Eye,
  DollarSign, Calendar, CreditCard, Shield, Send,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from './ui/utils';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { financingService, type FinancingApplication, type PrefillData } from '../services/financing.service';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';

const PURPOSES = [
  { value: 'capital_trabajo', label: 'Capital de trabajo' },
  { value: 'compra_activos', label: 'Compra de activos fijos' },
  { value: 'expansion', label: 'Expansión del negocio' },
  { value: 'pago_deudas', label: 'Pago de deudas' },
  { value: 'compra_inventario', label: 'Compra de inventario' },
  { value: 'mejoras_local', label: 'Mejoras al local' },
  { value: 'otro', label: 'Otro' },
];

const GUARANTEES = [
  { value: 'hipotecaria', label: 'Hipotecaria' },
  { value: 'prendaria', label: 'Prendaria' },
  { value: 'fianza_personal', label: 'Fianza personal' },
  { value: 'codeudor', label: 'Codeudor' },
  { value: 'sin_garantia', label: 'Sin garantía' },
];

const TERMS = [6, 12, 18, 24, 36, 48, 60];

export function FinanciamientoPymePage() {
  const { user, canPerform } = useAuth();
  const [applications, setApplications] = useState<FinancingApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedApp, setSelectedApp] = useState<FinancingApplication | null>(null);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const res: any = await financingService.list();
      setApplications(res?.data || res || []);
    } catch {
      toast.error('Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-[1700px] mx-auto min-h-[calc(100vh-5rem)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Landmark className="size-9 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter flex flex-wrap items-center gap-x-3 gap-y-1 uppercase italic leading-none">
              Financiamiento <span className="text-primary">PyME</span>
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                {applications.length} solicitudes
              </Badge>
            </div>
          </div>
        </div>
        {!selectedApp && canPerform('FINANCING', 'create') && (
          <Button onClick={() => setShowWizard(true)} className="rounded-xl gap-2 font-bold">
            <Plus className="size-4" /> Nueva Solicitud
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {selectedApp ? (
          <motion.div key="detail" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            <ApplicationDetail
              app={selectedApp}
              onBack={() => setSelectedApp(null)}
              onRefresh={fetchApplications}
            />
          </motion.div>
        ) : (
          <motion.div key="main" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            <Tabs defaultValue="solicitudes" className="w-full">
              <TabsList className="w-full h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex overflow-x-auto justify-start pb-2 flex-nowrap gap-1.5 rounded-2xl border border-border/40 mb-6">
                <TabsTrigger value="solicitudes"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
                    data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80
                    data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                  <FileText className="size-4" /> Mis Solicitudes
                </TabsTrigger>
                <TabsTrigger value="calculadora"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
                    data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80
                    data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                  <Calculator className="size-4" /> Calculadora
                </TabsTrigger>
              </TabsList>

              <TabsContent value="solicitudes" className="mt-0">
                {loading ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="size-8 animate-spin text-primary" /></div>
                ) : applications.length === 0 ? (
                  <Card className="border-dashed border-2 border-border/40">
                    <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                      <Landmark className="size-12 text-muted-foreground/30" />
                      <p className="text-muted-foreground text-center">No tenés solicitudes de financiamiento todavía.</p>
                      {canPerform('FINANCING', 'create') && (
                        <Button onClick={() => setShowWizard(true)} className="rounded-xl gap-2 font-bold">
                          <Plus className="size-4" /> Crear Primera Solicitud
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {applications.map((app) => (
                      <Card key={app.id} className="hover:border-primary/50 cursor-pointer transition-all border-border/50" onClick={() => setSelectedApp(app)}>
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                              <span className="font-mono text-xs text-muted-foreground">{app.number}</span>
                              <Badge className={cn('text-[10px] border', financingService.getStatusColor(app.status))}>
                                {financingService.getStatusLabel(app.status)}
                              </Badge>
                            </div>
                            <div className="flex items-baseline gap-4">
                              <span className="text-lg font-black">${Number(app.requestedAmount).toLocaleString()}</span>
                              <span className="text-xs text-muted-foreground">{app.termMonths} meses · {financingService.getPurposeLabel(app.purpose)}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{new Date(app.createdAt).toLocaleDateString('es-NI')}</span>
                          </div>
                          <Eye className="size-5 text-muted-foreground shrink-0" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="calculadora" className="mt-0">
                <PaymentCalculator />
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto p-0 rounded-3xl border-none">
          <div className="p-4 sm:p-6 border-b border-border/30 bg-muted/10">
            <DialogTitle className="text-lg font-black">Nueva Solicitud de Financiamiento</DialogTitle>
          </div>
          <div className="p-4 sm:p-6">
            <ApplicationWizard
              tenantId={user?.tenantId || ''}
              onBack={() => setShowWizard(false)}
              onComplete={(app) => {
                setApplications((prev) => [app, ...prev]);
                setShowWizard(false);
                toast.success('Solicitud enviada correctamente');
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentCalculator() {
  const [amount, setAmount] = useState<number>(50000);
  const [term, setTerm] = useState<number>(24);
  const [rate, setRate] = useState<number>(18);

  const calc = useMemo(() => {
    const monthlyRate = rate / 100 / 12;
    if (monthlyRate === 0 || amount === 0) return { monthly: 0, total: 0, interest: 0 };
    const monthly = amount * (monthlyRate * Math.pow(1 + monthlyRate, term)) / (Math.pow(1 + monthlyRate, term) - 1);
    const total = monthly * term;
    return { monthly, total, interest: total - amount };
  }, [amount, term, rate]);

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="border-b border-border/30 bg-muted/10">
        <CardTitle className="flex items-center gap-2 text-lg font-black"><Calculator className="size-5 text-primary" />Calculadora de Cuotas</CardTitle>
        <CardDescription>Amortización francesa — tasa referencial BCN</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-black tracking-widest">Monto (C$)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))}
              className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-black tracking-widest">Plazo (meses)</Label>
            <Select value={term.toString()} onValueChange={(v) => setTerm(Number(v))}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TERMS.map((t) => <SelectItem key={t} value={t.toString()}>{t} meses</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-black tracking-widest">Tasa anual (%)</Label>
            <Input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} step={0.5}
              className="h-11 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Cuota mensual', value: calc.monthly, color: 'text-primary' },
            { label: 'Total a pagar', value: calc.total, color: 'text-foreground' },
            { label: 'Total intereses', value: calc.interest, color: 'text-amber-600' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl bg-muted/30 p-4 text-center border border-border/30">
              <div className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-1">{item.label}</div>
              <div className={cn('text-2xl font-black', item.color)}>
                ${Math.round(item.value).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ApplicationWizard({ tenantId, onBack, onComplete }: { tenantId: string; onBack: () => void; onComplete: (app: FinancingApplication) => void }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [prefill, setPrefill] = useState<PrefillData | null>(null);

  const [form, setForm] = useState({
    requestedAmount: 100000,
    termMonths: 24,
    purpose: 'capital_trabajo',
    guarantees: [] as string[],
    repaymentSource: 'ingresos_operativos',
    monthlyRevenue: 0,
    monthlyExpenses: 0,
    totalAssets: 0,
    totalLiabilities: 0,
    monthlyPayroll: 0,
    hasActiveCredits: false,
    activeCreditDetail: '',
    hasPastDue: false,
    pastDueDetail: '',
    isRucRegistered: true,
    hasIrDeclarations: true,
    hasDgiDebts: false,
    hasInssDebts: false,
    fundsDeclaration: false,
    references: '',
  });

  useEffect(() => {
    if (step === 1 && tenantId && !prefill) {
      setLoading(true);
      financingService.getPrefill(tenantId)
        .then((res: any) => {
          const data = res?.data || res;
          setPrefill(data);
          setForm((prev) => ({
            ...prev,
            monthlyRevenue: data.monthlyRevenue || 0,
            monthlyExpenses: data.monthlyExpenses || 0,
          }));
        })
        .catch(() => toast.error('Error al cargar datos del ERP'))
        .finally(() => setLoading(false));
    }
  }, [step, tenantId]);

  const toggleGuarantee = (g: string) => {
    setForm((prev) => ({
      ...prev,
      guarantees: prev.guarantees.includes(g)
        ? prev.guarantees.filter((x) => x !== g)
        : [...prev.guarantees, g],
    }));
  };

  const calc = useMemo(() => {
    const monthlyRate = 0.18 / 12;
    if (monthlyRate === 0 || form.requestedAmount === 0) return { monthly: 0, total: 0 };
    const monthly = form.requestedAmount * (monthlyRate * Math.pow(1 + monthlyRate, form.termMonths)) / (Math.pow(1 + monthlyRate, form.termMonths) - 1);
    return { monthly, total: monthly * form.termMonths };
  }, [form.requestedAmount, form.termMonths]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res: any = await financingService.create({
        requestedAmount: form.requestedAmount,
        termMonths: form.termMonths,
        purpose: form.purpose,
        guarantees: form.guarantees,
        repaymentSource: form.repaymentSource,
        monthlyRevenue: form.monthlyRevenue || undefined,
        monthlyExpenses: form.monthlyExpenses || undefined,
        totalAssets: form.totalAssets || undefined,
        totalLiabilities: form.totalLiabilities || undefined,
        monthlyPayroll: form.monthlyPayroll || undefined,
        hasActiveCredits: form.hasActiveCredits,
        activeCreditDetail: form.activeCreditDetail || undefined,
        hasPastDue: form.hasPastDue,
        pastDueDetail: form.pastDueDetail || undefined,
        isRucRegistered: form.isRucRegistered,
        hasIrDeclarations: form.hasIrDeclarations,
        hasDgiDebts: form.hasDgiDebts,
        hasInssDebts: form.hasInssDebts,
        fundsDeclaration: form.fundsDeclaration,
        references: form.references ? form.references : undefined,
      });
      const app = res?.data || res;
      onComplete(app);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al crear solicitud');
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Empresa', 'Finanzas', 'Crédito', 'Historial', 'Revisión'];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={cn('size-8 rounded-full flex items-center justify-center text-xs font-black shrink-0',
              i === step ? 'bg-primary text-primary-foreground' : i < step ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground')}>
              {i < step ? <CheckCircle2 className="size-4" /> : i + 1}
            </div>
            <span className={cn('text-xs font-bold hidden sm:block', i === step ? 'text-primary' : 'text-muted-foreground')}>{s}</span>
            {i < 4 && <div className={cn('flex-1 h-0.5 rounded', i < step ? 'bg-primary' : 'bg-muted')} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>

          {step === 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-black tracking-tighter">Información de la Empresa</h3>
              {loading ? (
                <div className="flex items-center gap-3 py-8"><Loader2 className="size-5 animate-spin text-primary" /><span className="text-muted-foreground">Cargando datos del ERP...</span></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <EditField label="Nombre de la empresa" value={prefill?.companyName || ''} onChange={(v) => setPrefill(prev => prev ? { ...prev, companyName: v } : null)} />
                  <EditField label="RUC/NIT" value={prefill?.ruc || ''} onChange={(v) => setPrefill(prev => prev ? { ...prev, ruc: v } : null)} />
                  <EditField label="Giro de negocio" value={prefill?.industry || ''} onChange={(v) => setPrefill(prev => prev ? { ...prev, industry: v } : null)} />
                  <EditField label="Años de operación" value={prefill?.yearsOfOperation?.toString() || '0'} onChange={(v) => setPrefill(prev => prev ? { ...prev, yearsOfOperation: parseInt(v) || 0 } : null)} />
                  <EditField label="Dirección fiscal" value={prefill?.address || ''} onChange={(v) => setPrefill(prev => prev ? { ...prev, address: v } : null)} />
                  <EditField label="Teléfono" value={prefill?.phone || ''} onChange={(v) => setPrefill(prev => prev ? { ...prev, phone: v } : null)} />
                  <EditField label="Representante legal" value={prefill?.legalRepresentative || ''} onChange={(v) => setPrefill(prev => prev ? { ...prev, legalRepresentative: v } : null)} />
                  <EditField label="Email" value={prefill?.legalRepresentativeEmail || ''} onChange={(v) => setPrefill(prev => prev ? { ...prev, legalRepresentativeEmail: v } : null)} />
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-black tracking-tighter">Información Financiera</h3>
              <p className="text-sm text-muted-foreground">Completá los datos financieros de tu empresa.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black tracking-widest">Ingresos mensuales promedio</Label>
                  <Input type="number" value={form.monthlyRevenue || ''} onChange={(e) => setForm({ ...form, monthlyRevenue: Number(e.target.value) })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black tracking-widest">Gastos operativos mensuales</Label>
                  <Input type="number" value={form.monthlyExpenses || ''} onChange={(e) => setForm({ ...form, monthlyExpenses: Number(e.target.value) })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black tracking-widest">Activos totales</Label>
                  <Input type="number" value={form.totalAssets || ''} onChange={(e) => setForm({ ...form, totalAssets: Number(e.target.value) })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black tracking-widest">Pasivos totales</Label>
                  <Input type="number" value={form.totalLiabilities || ''} onChange={(e) => setForm({ ...form, totalLiabilities: Number(e.target.value) })} className="h-11 rounded-xl" />
                </div>
                <div className="rounded-2xl bg-muted/30 p-4 border border-border/30">
                  <div className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Patrimonio neto</div>
                  <div className="text-lg font-black">${(form.totalAssets - form.totalLiabilities).toLocaleString()}</div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black tracking-widest">Nómina mensual</Label>
                  <Input type="number" value={form.monthlyPayroll || ''} onChange={(e) => setForm({ ...form, monthlyPayroll: Number(e.target.value) })} className="h-11 rounded-xl" />
                </div>
                <div className="rounded-2xl bg-muted/30 p-4 border border-border/30">
                  <div className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Nivel de endeudamiento</div>
                  <div className="text-lg font-black">
                    {form.monthlyRevenue > 0 ? `${((form.monthlyExpenses / form.monthlyRevenue) * 100).toFixed(1)}%` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-black tracking-tighter">Detalles del Crédito Solicitado</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black tracking-widest">Monto solicitado (C$)</Label>
                  <Input type="number" value={form.requestedAmount} onChange={(e) => setForm({ ...form, requestedAmount: Number(e.target.value) })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black tracking-widest">Plazo en meses</Label>
                  <Select value={form.termMonths.toString()} onValueChange={(v) => setForm({ ...form, termMonths: Number(v) })}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{TERMS.map((t) => <SelectItem key={t} value={t.toString()}>{t} meses</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black tracking-widest">Destino del crédito</Label>
                  <Select value={form.purpose} onValueChange={(v) => setForm({ ...form, purpose: v })}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{PURPOSES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black tracking-widest">Fuente de repago</Label>
                  <Input value={form.repaymentSource} onChange={(e) => setForm({ ...form, repaymentSource: e.target.value })} className="h-11 rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest">Garantías ofrecidas</Label>
                <div className="flex flex-wrap gap-2">
                  {GUARANTEES.map((g) => (
                    <button key={g.value} type="button" onClick={() => toggleGuarantee(g.value)}
                      className={cn('px-3 py-1.5 rounded-xl text-xs font-bold border transition-all',
                        form.guarantees.includes(g.value) ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50')}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4">
                <div className="flex items-center gap-2 text-primary font-bold text-sm mb-2">
                  <Calculator className="size-4" /> Cuota mensual estimada
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div><div className="text-[10px] uppercase text-muted-foreground">Cuota</div><div className="text-lg font-black text-primary">${Math.round(calc.monthly).toLocaleString()}</div></div>
                  <div><div className="text-[10px] uppercase text-muted-foreground">Total</div><div className="text-lg font-black">${Math.round(calc.total).toLocaleString()}</div></div>
                  <div><div className="text-[10px] uppercase text-muted-foreground">Intereses</div><div className="text-lg font-black text-amber-600">${Math.round(calc.total - form.requestedAmount).toLocaleString()}</div></div>
                </div>
                <p className="text-[10px] text-primary mt-2">Tasa referencial BCN: 18% anual</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-black tracking-tighter">Historial Crediticio</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ToggleField label="¿Créditos activos con otras instituciones?" value={form.hasActiveCredits} onChange={(v) => setForm({ ...form, hasActiveCredits: v })} />
                {form.hasActiveCredits && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black tracking-widest">Detalle</Label>
                    <Input value={form.activeCreditDetail} onChange={(e) => setForm({ ...form, activeCreditDetail: e.target.value })} placeholder="Institución, monto, cuota" className="h-11 rounded-xl" />
                  </div>
                )}
                <ToggleField label="¿Morosidades en últimos 24 meses?" value={form.hasPastDue} onChange={(v) => setForm({ ...form, hasPastDue: v })} />
                {form.hasPastDue && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black tracking-widest">Detalle</Label>
                    <Input value={form.pastDueDetail} onChange={(e) => setForm({ ...form, pastDueDetail: e.target.value })} placeholder="Institución, monto, si fue regularizado" className="h-11 rounded-xl" />
                  </div>
                )}
                <ToggleField label="Inscrito en RUC" value={form.isRucRegistered} onChange={(v) => setForm({ ...form, isRucRegistered: v })} />
                <ToggleField label="Declaraciones de IR al día" value={form.hasIrDeclarations} onChange={(v) => setForm({ ...form, hasIrDeclarations: v })} />
                <ToggleField label="Deudas con DGI" value={form.hasDgiDebts} onChange={(v) => setForm({ ...form, hasDgiDebts: v })} />
                <ToggleField label="Deudas con INSS" value={form.hasInssDebts} onChange={(v) => setForm({ ...form, hasInssDebts: v })} />
              </div>
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.fundsDeclaration} onChange={(e) => setForm({ ...form, fundsDeclaration: e.target.checked })}
                    className="mt-1 size-4 rounded border-border bg-background text-primary focus:ring-primary/30" />
                  <span className="text-xs text-muted-foreground">
                    Declaro que los fondos provienen de actividades lícitas (requerido por UAF)
                  </span>
                </label>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black tracking-widest">Referencias comerciales</Label>
                <Textarea value={form.references} onChange={(e) => setForm({ ...form, references: e.target.value })}
                  placeholder="Nombre y teléfono de al menos 2 referencias comerciales" rows={3} className="rounded-xl resize-none" />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-black tracking-tighter">Revisión y Envío</h3>
              <div className="rounded-2xl border border-border/50 divide-y divide-border/30 text-sm">
                <SummaryRow label="Empresa" value={prefill?.companyName || ''} />
                <SummaryRow label="Monto" value={`C$ ${form.requestedAmount.toLocaleString()}`} />
                <SummaryRow label="Plazo" value={`${form.termMonths} meses`} />
                <SummaryRow label="Destino" value={PURPOSES.find((p) => p.value === form.purpose)?.label || form.purpose} />
                <SummaryRow label="Garantías" value={form.guarantees.length > 0 ? form.guarantees.map((g) => GUARANTEES.find((x) => x.value === g)?.label || g).join(', ') : 'Ninguna'} />
                <SummaryRow label="Cuota estimada" value={`$${Math.round(calc.monthly).toLocaleString()}/mes`} highlight />
                <SummaryRow label="Ingresos mensuales" value={`C$ ${form.monthlyRevenue.toLocaleString()}`} />
                <SummaryRow label="Gastos mensuales" value={`C$ ${form.monthlyExpenses.toLocaleString()}`} />
                <SummaryRow label="Créditos activos" value={form.hasActiveCredits ? `Sí — ${form.activeCreditDetail}` : 'No'} />
                <SummaryRow label="Morosidades" value={form.hasPastDue ? `Sí — ${form.pastDueDetail}` : 'No'} />
                <SummaryRow label="Declaración fondos lícitos" value={form.fundsDeclaration ? 'Sí' : 'No'} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(3)} className="h-12 rounded-xl font-bold uppercase tracking-widest gap-2 flex-1">
                  <ArrowLeft className="size-4" /> Atrás
                </Button>
                <Button onClick={handleSubmit} disabled={loading || !form.fundsDeclaration}
                  className="h-12 rounded-xl font-bold uppercase tracking-widest gap-2 flex-1">
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Enviar Solicitud
                </Button>
              </div>
              {!form.fundsDeclaration && <p className="text-xs text-destructive text-center">Debés aceptar la declaración de origen de fondos para enviar.</p>}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {step < 4 && (
        <div className="flex gap-3">
          <Button variant="outline" onClick={step === 0 ? onBack : () => setStep(step - 1)}
            className="h-12 rounded-xl font-bold uppercase tracking-widest gap-2 flex-1">
            <ArrowLeft className="size-4" /> {step === 0 ? 'Cancelar' : 'Atrás'}
          </Button>
          <Button onClick={() => setStep(step + 1)}
            className="h-12 rounded-xl font-bold uppercase tracking-widest gap-2 flex-1"
            disabled={step === 2 && form.requestedAmount <= 0}>
            Siguiente <ArrowRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function ApplicationDetail({ app, onBack, onRefresh }: { app: FinancingApplication; onBack: () => void; onRefresh: () => void }) {
  const { canPerform } = useAuth();
  const [note, setNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const handleAddNote = async () => {
    if (!note.trim()) return;
    setAddingNote(true);
    try {
      await financingService.addNote(app.id, note);
      setNote('');
      onRefresh();
      toast.success('Nota agregada');
    } catch { toast.error('Error al agregar nota'); }
    finally { setAddingNote(false); }
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black tracking-tighter">{app.number}</h2>
            <Badge className={cn('text-[10px] border', financingService.getStatusColor(app.status))}>
              {financingService.getStatusLabel(app.status)}
            </Badge>
          </div>
          <Button variant="outline" onClick={onBack} className="gap-2 rounded-xl"><ArrowLeft className="size-4" /> Volver</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={DollarSign} label="Monto" value={`C$ ${Number(app.requestedAmount).toLocaleString()}`} />
          <StatCard icon={Calendar} label="Plazo" value={`${app.termMonths} meses`} />
          <StatCard icon={CreditCard} label="Destino" value={financingService.getPurposeLabel(app.purpose)} />
          <StatCard icon={Shield} label="Garantías" value={app.guarantees.length > 0 ? app.guarantees.map((g) => financingService.getGuaranteeLabel(g)).join(', ') : 'Sin garantía'} />
        </div>

        <div className="rounded-2xl border border-border/50 divide-y divide-border/30 text-sm">
          <SummaryRow label="Estado" value={financingService.getStatusLabel(app.status)} />
          <SummaryRow label="Ingresos mensuales" value={app.monthlyRevenue ? `C$ ${Number(app.monthlyRevenue).toLocaleString()}` : 'N/A'} />
          <SummaryRow label="Gastos mensuales" value={app.monthlyExpenses ? `C$ ${Number(app.monthlyExpenses).toLocaleString()}` : 'N/A'} />
          <SummaryRow label="Patrimonio neto" value={app.netWorth ? `C$ ${Number(app.netWorth).toLocaleString()}` : 'N/A'} />
          <SummaryRow label="Ratio deuda/ingreso" value={app.debtRatio ? `${(Number(app.debtRatio) * 100).toFixed(1)}%` : 'N/A'} />
          <SummaryRow label="Créditos activos" value={app.hasActiveCredits ? 'Sí' : 'No'} />
          <SummaryRow label="Morosidades" value={app.hasPastDue ? 'Sí' : 'No'} />
          <SummaryRow label="Fecha solicitud" value={new Date(app.createdAt).toLocaleDateString('es-NI')} />
        </div>

        {app.reviewNotes && (
          <div className="rounded-2xl bg-muted/30 p-4 border border-border/30">
            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Notas del revisor</h4>
            <p className="text-sm whitespace-pre-wrap">{app.reviewNotes}</p>
          </div>
        )}

        {canPerform('FINANCING', 'edit') && (
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-black tracking-widest">Agregar nota</Label>
            <div className="flex gap-2">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Escribí una nota..." className="flex-1 h-11 rounded-xl" />
              <Button onClick={handleAddNote} disabled={addingNote || !note.trim()} className="h-11 rounded-xl gap-2">
                {addingNote ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Enviar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase font-black tracking-widest">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-11 rounded-xl" />
    </div>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/50 p-3">
      <span className="text-sm font-bold">{label}</span>
      <button type="button" onClick={() => onChange(!value)}
        className={cn('relative w-10 h-6 rounded-full transition-colors', value ? 'bg-emerald-500' : 'bg-muted')}>
        <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform', value ? 'left-[18px]' : 'left-0.5')} />
      </button>
    </div>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-bold', highlight && 'text-emerald-600')}>{value}</span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/30 p-3 space-y-1">
      <Icon className="size-4 text-muted-foreground" />
      <div className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

export default FinanciamientoPymePage;
