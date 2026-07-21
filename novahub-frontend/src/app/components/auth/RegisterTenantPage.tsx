import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Package, Mail, Lock, User, Building2, CheckCircle2, ArrowRight, ArrowLeft,
  Sparkles, Loader2, Store, Laptop, Wrench, Factory, HardHat, UtensilsCrossed,
  Stethoscope, GraduationCap, Briefcase, Building,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';
import { toast } from 'sonner';
import { authService, type ModuleRecommendationsResponse } from '../../services/auth.service';
import { useAuth } from '../../contexts/AuthContext';

type IndustryKey = 'ARCHITECTURE' | 'RETAIL' | 'TECHNOLOGY' | 'SERVICES' | 'MANUFACTURING' | 'CONSTRUCTION' | 'HEALTHCARE' | 'EDUCATION' | 'RESTAURANT' | 'OTHER' | 'CUSTOM';
type CompanySize = 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE';

const INDUSTRIES: { key: IndustryKey; label: string; description: string; icon: any }[] = [
  { key: 'RETAIL', label: 'Retail / Comercio', description: 'Tiendas, ferreterías, conveniencia', icon: Store },
  { key: 'TECHNOLOGY', label: 'Tecnología', description: 'Celulares, computadoras, reparaciones', icon: Laptop },
  { key: 'ARCHITECTURE', label: 'Arquitectura', description: 'Construcción, bienes raíces', icon: Building },
  { key: 'SERVICES', label: 'Servicios', description: 'Talleres, consultoría, técnicos', icon: Wrench },
  { key: 'MANUFACTURING', label: 'Manufactura', description: 'Fabricación, producción, maquila', icon: Factory },
  { key: 'CONSTRUCTION', label: 'Construcción', description: 'Constructoras, contratistas', icon: HardHat },
  { key: 'RESTAURANT', label: 'Restaurante', description: 'Restaurantes, cafeterías', icon: UtensilsCrossed },
  { key: 'HEALTHCARE', label: 'Salud', description: 'Clínicas, consultorios, farmacias', icon: Stethoscope },
  { key: 'EDUCATION', label: 'Educación', description: 'Academias, colegios, capacitación', icon: GraduationCap },
  { key: 'OTHER', label: 'Otro', description: 'Otro tipo de negocio', icon: Briefcase },
];

const COMPANY_SIZES: { key: CompanySize; label: string }[] = [
  { key: 'MICRO', label: 'Micro (1-5 empleados)' },
  { key: 'SMALL', label: 'Pequeña (6-20 empleados)' },
  { key: 'MEDIUM', label: 'Mediana (21-100 empleados)' },
  { key: 'LARGE', label: 'Grande (100+ empleados)' },
];

const step1Schema = z.object({
  companyName: z.string().min(2, 'Mínimo 2 caracteres').max(100).trim(),
  userName: z.string().min(2, 'Mínimo 2 caracteres').max(100).trim(),
  email: z.string().email('Email inválido').trim().toLowerCase(),
  password: z.string().min(8, 'Mínimo 8 caracteres').regex(/[A-Z]/, 'Debe incluir mayúscula').regex(/[0-9]/, 'Debe incluir número'),
  acceptTerms: z.boolean().refine((v) => v === true, 'Debés aceptar los términos'),
});

type Step1Data = z.infer<typeof step1Schema>;

const STEP_MESSAGES = [
  'Contanos sobre tu empresa para empezar',
  'Seleccioná tu industria para recomendarte los mejores módulos',
  'Personalizá tu NovaHub con los módulos que necesitás',
];

const LEFT_BRANDING = [
  {
    title: 'Probá NovaHub gratis por 3 días',
    subtitle: 'Acceso completo a las herramientas que usan las empresas que crecen. Sin tarjeta, sin compromiso.',
    benefits: ['Ventas, Inventario y Compras integrados', 'Reportes en tiempo real con datos reales', 'Configura tu empresa en minutos', 'Soporte por email incluido'],
  },
  {
    title: 'Contanos sobre tu negocio',
    subtitle: 'Personalizamos NovaHub para tu industria. Cada empresa es única y merece herramientas a medida.',
    benefits: ['Recomendaciones inteligentes de módulos', 'Configuración optimizada para tu giro', 'Precios justos, solo lo que necesitás', 'Dashboard adaptado a tu negocio'],
  },
  {
    title: 'Módulos para tu negocio',
    subtitle: 'Seleccioná los módulos que mejor se adapten a tu empresa. Podés agregar o quitar en cualquier momento.',
    benefits: ['Solo pagás por lo que usás', 'Escalable: crece con tu negocio', 'Todos integrados entre sí', 'Sin contratos largos'],
  },
  {
    title: '¡Todo listo!',
    subtitle: 'Tu workspace está preparado. Bienvenido a NovaHub, el ERP que se adapta a vos.',
    benefits: ['3 días de prueba gratis', 'Sin tarjeta de crédito', 'Soporte incluido', 'Empezá a facturar hoy'],
  },
];

const PARENT_SUBMODULES: Record<string, string[]> = {
  SALES: ['SALES_CLIENTS', 'SALES_QUOTES', 'SALES_ORDERS', 'SALES_INVOICES', 'SALES_RECURRING', 'SALES_PAYMENTS', 'SALES_RETURNS', 'SALES_CREDIT_NOTES', 'SALES_COMMISSIONS'],
  PURCHASES: ['PURCHASES_PROVIDERS', 'PURCHASES_EXPENSES', 'PURCHASES_EXPENSES_REC', 'PURCHASES_REQUESTS', 'PURCHASES_QUOTES', 'PURCHASES_ORDERS', 'PURCHASES_RECEIPTS', 'PURCHASES_INVOICES', 'PURCHASES_INVOICES_REC', 'PURCHASES_RETURNS', 'PURCHASES_PAYMENTS'],
  INVENTORY: ['INVENTORY_PRODUCTS', 'INVENTORY_WAREHOUSES', 'INVENTORY_TRANSFERS', 'INVENTORY_ADJUSTMENTS', 'INVENTORY_MOVEMENTS', 'INVENTORY_COUNT', 'INVENTORY_SERIALS', 'INVENTORY_LOTS', 'INVENTORY_DASHBOARD'],
  FINANCIAL: ['FINANCIAL_ACCOUNTS', 'FINANCIAL_JOURNAL', 'FINANCIAL_LEDGER', 'FINANCIAL_BANK', 'FINANCIAL_BUDGET', 'FINANCIAL_REPORTS', 'FINANCIAL_INCOMES', 'FINANCIAL_EXPENSES', 'FINANCIAL_EXPENSES_REC', 'FINANCIAL_BALANCE', 'FINANCIAL_DASHBOARD', 'FINANCIAL_INCOMES_REC'],
  HR: ['HR_EMPLOYEES', 'HR_PAYROLL', 'HR_ATTENDANCE', 'HR_LEAVES', 'HR_PERFORMANCE', 'HR_TRAINING', 'HR_BENEFITS', 'HR_DASHBOARD', 'HR_PAYROLL_CONFIG'],
  PROJECTS: ['PROJECTS_LIST', 'PROJECTS_TASKS', 'PROJECTS_MILESTONES'],
  REPORTS: ['REPORTS_SALES', 'REPORTS_FINANCIAL', 'REPORTS_INVENTORY', 'REPORTS_PURCHASES', 'REPORTS_CLIENTS', 'REPORTS_PROVIDERS', 'REPORTS_HR', 'REPORTS_SUBSCRIPTIONS'],
  DOCUMENTS: ['DOCUMENTS_FILES', 'DOCUMENTS_FOLDERS', 'DOCUMENTS_CONTRACTS', 'DOCUMENTS_INVOICES', 'DOCUMENTS_REPORTS'],
  ACTIVITIES: ['ACTIVITIES_TASKS', 'ACTIVITIES_EVENTS', 'ACTIVITIES_REMINDERS', 'ACTIVITIES_BITACORA', 'ACTIVITIES_LOGS', 'ACTIVITIES_CALENDAR', 'ACTIVITIES_MEETINGS'],
  CONFIGURATION: ['CONFIG_COMPANY', 'CONFIG_BRANDING', 'CONFIG_ROLES', 'CONFIG_SECURITY', 'CONFIG_CURRENCY', 'CONFIG_USERS', 'CONFIG_SUBSCRIPTION', 'CONFIG_TENANCY', 'CONFIG_PLATFORM', 'CONFIG_DOMAINS'],
  NOTIFICATIONS: ['NOTIFICATIONS_ALERTS', 'NOTIFICATIONS_MESSAGES', 'NOTIFICATIONS_PUSH'],
  ACCOUNTING: ['ACCOUNTING_CHART', 'ACCOUNTING_JOURNAL'],
  LEGAL: [],
  TOOLS: [],
  FINANCING: [],
};
const PARENT_KEYS = new Set(Object.keys(PARENT_SUBMODULES));

export function RegisterTenantPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [industry, setIndustry] = useState<IndustryKey | null>(null);
  const [subIndustry, setSubIndustry] = useState('');
  const [companySize, setCompanySize] = useState<CompanySize | null>(null);
  const [companyDescription, setCompanyDescription] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<ModuleRecommendationsResponse | null>(null);
  const [loadingModules, setLoadingModules] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);
  const [expandedParent, setExpandedParent] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, watch } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { companyName: '', userName: '', email: '', password: '', acceptTerms: false },
  });

  const acceptTerms = watch('acceptTerms');

  useEffect(() => {
    if (step === 2 && industry && !recommendations) {
      setLoadingModules(true);
      authService.getModuleRecommendations(industry)
        .then((res: any) => {
          const data = res?.data || res;
          setRecommendations(data);
          setSelectedModules(data.recommended?.map((m: any) => m.module) || []);
        })
        .catch(() => toast.error('Error al carrar recomendaciones'))
        .finally(() => setLoadingModules(false));
    }
  }, [step, industry, recommendations]);

  useEffect(() => {
    if (!showWelcome) return;
    setMsgIndex(0);
    const interval = setInterval(() => {
      setMsgIndex((prev) => {
        if (prev >= 5) { clearInterval(interval); return prev; }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showWelcome]);

  const onStep1Submit = (data: Step1Data) => {
    setStep1Data(data);
    setStep(1);
  };

  const canGoStep2 = industry !== null && companySize !== null;
  const totalPrice = selectedModules.reduce((sum, mod) => {
    const found = [
      ...(recommendations?.recommended || []),
      ...(recommendations?.optional || []),
    ].find((m) => m.module === mod);
    return sum + (found?.price || 0);
  }, 0);

  const handleFinalSubmit = async () => {
    if (!step1Data) return;
    setSubmitting(true);
    setError(null);
    try {
      const response: any = await authService.registerTenant({
        companyName: step1Data.companyName,
        userName: step1Data.userName,
        email: step1Data.email,
        password: step1Data.password,
        industry: industry || undefined,
        subIndustry: subIndustry || undefined,
        companySize: companySize || undefined,
        companyDescription: companyDescription || undefined,
        selectedModules,
      });
      const token = response?.access_token || response?.data?.access_token;
      const user = response?.user || response?.data?.user;
      if (token && user) {
        setSession(token, user);
        setShowWelcome(true);
        setTimeout(() => navigate('/dashboard'), 7000);
      } else {
        setError('Respuesta inesperada del servidor');
        setSubmitting(false);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Error al crear la cuenta';
      setError(Array.isArray(msg) ? msg[0] : msg);
      setSubmitting(false);
    }
  };

  const toggleModule = (moduleKey: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleKey) ? prev.filter((m) => m !== moduleKey) : [...prev, moduleKey],
    );
  };

  const renderProgress = () => {
    const totalSteps = 3;
    const percent = Math.round(((step + 1) / totalSteps) * 100);
    return (
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-600">
            Paso {step + 1}/{totalSteps} — {percent}%
          </span>
          <AnimatePresence mode="wait">
            <motion.span
              key={step}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.2 }}
              className="text-[10px] text-muted-foreground italic"
            >
              {STEP_MESSAGES[step]}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between">
          {['Cuenta', 'Negocio', 'Módulos'].map((label, i) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <motion.div
                initial={false}
                animate={i <= step ? { scale: 1 } : { scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                className={cn(
                  'size-7 rounded-full flex items-center justify-center text-[10px] font-black transition-colors',
                  i === step ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' :
                  i < step ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground/50',
                )}
              >
                {i < step ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 10 }}
                  >
                    <CheckCircle2 className="size-3.5" />
                  </motion.div>
                ) : i + 1}
              </motion.div>
              <span className={cn(
                'text-[9px] font-bold',
                i === step ? 'text-emerald-600' : i < step ? 'text-emerald-400' : 'text-muted-foreground/40',
              )}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLeftPanel = () => {
    if (step === 2) return null;
    const content = LEFT_BRANDING[step] || LEFT_BRANDING[0];
    return (
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute -top-20 -right-20 size-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 size-96 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="size-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Package className="size-7 text-white" />
            </div>
            <span className="text-2xl font-black tracking-tighter">NovaHub</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <h1 className="text-4xl font-black tracking-tighter leading-tight mb-6">{content.title}</h1>
              <p className="text-emerald-100 text-lg max-w-md mb-10">{content.subtitle}</p>
              <ul className="space-y-3 max-w-md">
                {content.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-emerald-300 shrink-0 mt-0.5" />
                    <span className="text-emerald-50">{benefit}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="relative z-10 text-xs text-emerald-200/80">
          &copy; {new Date().getFullYear()} NovaHub. Todos los derechos reservados.
        </div>
      </div>
    );
  };

  const renderStep1 = () => (
    <form onSubmit={handleSubmit(onStep1Submit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="companyName" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Nombre de empresa</Label>
        <div className="relative">
          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input id="companyName" {...register('companyName')} placeholder="Ej: Mi Empresa S.A." autoComplete="organization"
            className={cn('h-11 pl-11 rounded-xl bg-white/5 border-white/10', errors.companyName && 'border-destructive')} />
        </div>
        {errors.companyName && <p className="text-xs text-destructive ml-1">{errors.companyName.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="userName" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Tu nombre</Label>
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input id="userName" {...register('userName')} placeholder="Juan Pérez" autoComplete="name"
            className={cn('h-11 pl-11 rounded-xl bg-white/5 border-white/10', errors.userName && 'border-destructive')} />
        </div>
        {errors.userName && <p className="text-xs text-destructive ml-1">{errors.userName.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Email</Label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input id="email" {...register('email')} type="email" placeholder="tu@empresa.com" autoComplete="email"
            className={cn('h-11 pl-11 rounded-xl bg-white/5 border-white/10', errors.email && 'border-destructive')} />
        </div>
        {errors.email && <p className="text-xs text-destructive ml-1">{errors.email.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Contraseña</Label>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input id="password" {...register('password')} type="password" placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número" autoComplete="new-password"
            className={cn('h-11 pl-11 rounded-xl bg-white/5 border-white/10', errors.password && 'border-destructive')} />
        </div>
        {errors.password && <p className="text-xs text-destructive ml-1">{errors.password.message}</p>}
      </div>
      <div className="space-y-1.5 pt-1">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" id="acceptTerms" {...register('acceptTerms')}
            className="mt-1 size-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/30" />
          <span className="text-xs text-muted-foreground">
            Acepto los{' '}<a href="#" className="text-primary hover:underline">términos de servicio</a>{' '}y la{' '}
            <a href="#" className="text-primary hover:underline">política de privacidad</a>.
          </span>
        </label>
        {errors.acceptTerms && <p className="text-xs text-destructive ml-1">{errors.acceptTerms.message}</p>}
      </div>
      <Button type="submit" disabled={!acceptTerms}
        className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest gap-2 shadow-lg shadow-emerald-900/40 mt-2">
        Siguiente <ArrowRight className="size-4" />
      </Button>
    </form>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      <div>
        <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block mb-3">Industria</Label>
        <motion.div className="grid grid-cols-2 gap-2.5" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.04 } } }}>
          {INDUSTRIES.map((ind) => {
            const Icon = ind.icon;
            const selected = industry === ind.key;
            return (
              <motion.button
                key={ind.key} type="button" onClick={() => setIndustry(ind.key)}
                variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'rounded-2xl border border-border/50 p-3 cursor-pointer transition-all text-left',
                  selected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'hover:border-primary/50',
                )}>
                <Icon className={cn('size-5 mb-1.5', selected ? 'text-primary' : 'text-muted-foreground')} />
                <div className="text-xs font-bold leading-tight">{ind.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{ind.description}</div>
              </motion.button>
            );
          })}
        </motion.div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Sub-industria (opcional)</Label>
        <Input value={subIndustry} onChange={(e) => setSubIndustry(e.target.value)}
          placeholder="Ej: Ferretería de materiales de construcción"
          className="h-11 rounded-xl bg-white/5 border-white/10" />
      </div>
      <div>
        <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block mb-3">Tamaño de empresa</Label>
        <div className="grid grid-cols-2 gap-2.5">
          {COMPANY_SIZES.map((cs) => (
            <button key={cs.key} type="button" onClick={() => setCompanySize(cs.key)}
              className={cn(
                'rounded-2xl border border-border/50 p-3 cursor-pointer transition-all text-center',
                companySize === cs.key ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'hover:border-primary/50',
              )}>
              <div className="text-xs font-bold">{cs.label}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Descripción breve (opcional)</Label>
        <Textarea value={companyDescription} onChange={(e) => setCompanyDescription(e.target.value)}
          placeholder="Contanos brevemente qué hace tu empresa..." maxLength={300} rows={3}
          className="rounded-xl bg-white/5 border-white/10 resize-none" />
        <span className="text-[10px] text-muted-foreground ml-1">{companyDescription.length}/300</span>
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => setStep(0)}
          className="h-12 rounded-xl font-bold uppercase tracking-widest gap-2 flex-1">
          <ArrowLeft className="size-4" /> Atrás
        </Button>
        <Button type="button" disabled={!canGoStep2} onClick={() => setStep(2)}
          className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest gap-2 shadow-lg shadow-emerald-900/40 flex-1">
          Siguiente <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );

  const renderStep3 = () => {
    if (loadingModules) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Loader2 className="size-8 animate-spin text-emerald-500" />
          <p className="text-muted-foreground text-sm">Cargando recomendaciones...</p>
        </div>
      );
    }
    if (!recommendations) {
      return <p className="text-muted-foreground text-center py-8">No se pudieron cargar las recomendaciones.</p>;
    }

    const toParentMod = (list: { module: string; name: string; price: number }[]) => {
      const parentMap = new Map<string, { module: string; name: string; price: number; submodules: { module: string; name: string; price: number }[] }>();
      for (const item of list) {
        if (PARENT_KEYS.has(item.module)) {
          parentMap.set(item.module, { ...item, submodules: [] });
        }
      }
      for (const item of list) {
        for (const [parent, subs] of Object.entries(PARENT_SUBMODULES)) {
          if (subs.includes(item.module)) {
            const p = parentMap.get(parent);
            if (p) p.submodules.push(item);
            break;
          }
        }
      }
      for (const [, p] of parentMap) {
        if (p.submodules.length === 0) {
          p.submodules = list.filter(i => {
            for (const subs of Object.values(PARENT_SUBMODULES)) {
              if (subs.includes(i.module)) return false;
            }
            return false;
          });
        }
      }
      return Array.from(parentMap.values());
    };

    const recommendedParents = toParentMod(recommendations.recommended);
    const optionalParents = toParentMod(recommendations.optional);

    const isParentActive = (parent: string) => {
      const subs = PARENT_SUBMODULES[parent] || [];
      if (subs.length === 0) return selectedModules.includes(parent);
      return subs.every(s => selectedModules.includes(s));
    };

    const getParentActiveCount = (parent: string) => {
      const subs = PARENT_SUBMODULES[parent] || [];
      if (subs.length === 0) return selectedModules.includes(parent) ? subs.length + 1 : 0;
      return subs.filter(s => selectedModules.includes(s)).length;
    };

    const getParentTotal = (parent: string) => {
      const subs = PARENT_SUBMODULES[parent] || [];
      return subs.length || 1;
    };

    const expandParent = (parent: string) => {
      setExpandedParent(expandedParent === parent ? null : parent);
    };

    const renderParentCards = (list: any[], recommended: boolean) => {
      if (list.length === 0) return null;
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {list.map((mod) => {
            const active = isParentActive(mod.module);
            const activeCount = getParentActiveCount(mod.module);
            const totalCount = getParentTotal(mod.module);
            const isExpanded = expandedParent === mod.module;
            const hasSubs = (PARENT_SUBMODULES[mod.module]?.length || 0) > 0;
            return (
              <div key={mod.module} className="rounded-2xl border overflow-hidden transition-all"
                style={{
                  borderColor: active ? (recommended ? '#10b981' : 'hsl(var(--primary))') : undefined,
                  backgroundColor: active ? (recommended ? '#f0fdf4' : 'hsl(var(--primary) / 0.03)') : undefined,
                  boxShadow: active ? (recommended ? '0 1px 3px rgba(16,185,129,0.1)' : '0 1px 3px rgba(0,0,0,0.05)') : undefined,
                }}>
                <button type="button" onClick={() => { if (hasSubs) { expandParent(mod.module); } else { toggleModule(mod.module); } }}
                  className="w-full p-4 text-left cursor-pointer flex flex-col gap-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className={cn('size-7 rounded-lg flex items-center justify-center',
                      active ? (recommended ? 'bg-emerald-500 text-white' : 'bg-primary text-white') : (recommended ? 'bg-emerald-100 text-emerald-600' : 'bg-primary/10 text-primary'))}>
                      {active ? <CheckCircle2 className="size-4" /> : <Package className="size-4" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs font-black', active ? (recommended ? 'text-emerald-600' : 'text-primary') : 'text-muted-foreground')}>
                        ${mod.price}/mes
                      </span>
                      {activeCount > 0 && activeCount < totalCount && (
                        <span className="text-[9px] uppercase font-black text-amber-600">{activeCount}/{totalCount}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold">{mod.name}</div>
                      <div className={cn('text-[10px] mt-0.5', recommended ? 'text-emerald-600/70' : 'text-muted-foreground')}>
                        {recommended ? 'Incluido en tu trial' : `$${mod.price}/mes`}
                      </div>
                    </div>
                    {hasSubs && (
                      <span className="text-[10px] text-muted-foreground">{isExpanded ? '▲' : '▼'}</span>
                    )}
                  </div>
                </button>
                {hasSubs && isExpanded && (
                  <div className="border-t border-border/40 bg-muted/10 px-4 py-2 space-y-1">
                    {(PARENT_SUBMODULES[mod.module] || []).map((subKey: string) => {
                      const subInfo = [...recommendedParents, ...optionalParents].flatMap(p => p.submodules).find(s => s.module === subKey);
                      const subActive = selectedModules.includes(subKey);
                      return (
                        <button key={subKey} type="button" onClick={() => toggleModule(subKey)}
                          className={cn('w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all hover:bg-muted/50',
                            subActive ? 'text-foreground font-bold' : 'text-muted-foreground')}>
                          <span className="flex items-center gap-2">
                            <span className={cn('size-1.5 rounded-full', subActive ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
                            {subInfo?.name || subKey.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}
                          </span>
                          <span className="text-[10px]">{subActive ? '✓ Activo' : `+$${subInfo?.price || 0}`}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    };

    return (
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">Basado en tu industria, te recomendamos estos módulos:</p>
        <div className="space-y-3">
          <h4 className="text-[10px] uppercase font-black tracking-widest text-emerald-600">Incluidos en tu trial</h4>
          {renderParentCards(recommendedParents, true)}
        </div>
        <div className="space-y-3">
          <h4 className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Módulos adicionales</h4>
          {renderParentCards(optionalParents, false)}
        </div>
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-center justify-between">
          <div>
            <span className="text-sm text-emerald-700">Total estimado si contratas:</span>
            <p className="text-[10px] text-emerald-600/70">Durante los 3 días de prueba, todos los módulos seleccionados son GRATIS</p>
          </div>
          <span className="text-2xl font-black text-emerald-600">${totalPrice}/mes</span>
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => setStep(1)}
            className="h-12 rounded-xl font-bold uppercase tracking-widest gap-2 flex-1">
            <ArrowLeft className="size-4" /> Atrás
          </Button>
          <Button type="button" disabled={selectedModules.length === 0 || submitting} onClick={handleFinalSubmit}
            className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest gap-2 shadow-lg shadow-emerald-900/40 flex-1">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Comenzar prueba gratis
          </Button>
        </div>
        {error && <p className="text-xs text-destructive text-center">{error}</p>}
      </div>
    );
  };

  const SETUP_MESSAGES = [
    'Creando tu workspace...',
    'Configurando módulos seleccionados...',
    'Preparando base de datos...',
    'Inicializando tu dashboard...',
    'Aplicando personalización...',
    'Casi listo...',
  ];

  const renderWelcome = () => {
    const selectedCount = selectedModules.length;
    const sizeLabel = COMPANY_SIZES.find(s => s.key === companySize)?.label || companySize || '';
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="flex flex-col items-center py-8 text-center gap-6"
      >
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.1 }}
          className="size-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/30"
        >
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Sparkles className="size-10 text-white" />
          </motion.div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-black tracking-tighter"
        >
          ¡Tu NovaHub está listo!
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-muted-foreground"
        >
          Hemos configurado todo para <strong className="text-foreground">{step1Data?.companyName || 'tu empresa'}</strong>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-3 gap-3 w-full max-w-sm"
        >
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-center">
            <div className="text-2xl font-black text-emerald-600">{selectedCount}</div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-700/60">Módulos</div>
          </div>
          <div className="rounded-2xl bg-blue-50 border border-blue-200 p-3 text-center">
            <div className="text-lg font-black text-blue-600 truncate">{industry ? INDUSTRIES.find(i => i.key === industry)?.label?.split('/')[0] || '—' : '—'}</div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-blue-700/60">Industria</div>
          </div>
          <div className="rounded-2xl bg-purple-50 border border-purple-200 p-3 text-center">
            <div className="text-lg font-black text-purple-600 truncate">{sizeLabel.split('(')[0]?.trim() || '—'}</div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-purple-700/60">Tamaño</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="space-y-3 w-full max-w-sm"
        >
          <AnimatePresence mode="wait">
            <motion.p
              key={msgIndex}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.25 }}
              className="text-xs text-emerald-600 font-bold text-center"
            >
              {SETUP_MESSAGES[msgIndex]}
            </motion.p>
          </AnimatePresence>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 7, ease: 'easeInOut' }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-center">Redirigiendo a tu dashboard...</p>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {renderLeftPanel()}
      <div className={cn(
        "flex-1 flex items-center justify-center p-6 md:p-10 bg-background",
        step === 2 && "lg:w-full"
      )}>
        <div className={cn("w-full space-y-6", step === 2 ? "max-w-3xl" : "max-w-md")}>
          <div className="lg:hidden flex items-center gap-3 mb-4">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package className="size-6 text-primary" />
            </div>
            <span className="text-xl font-black tracking-tighter">NovaHub</span>
          </div>
          {showWelcome ? renderWelcome() : (
            <>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.2 }}
                >
                  {renderProgress()}
                  <h2 className="text-2xl font-black tracking-tighter uppercase italic mb-6">
                    {step === 0 && <>Crear <span className="text-primary">cuenta</span></>}
                    {step === 1 && <>Tu <span className="text-primary">negocio</span></>}
                    {step === 2 && <>Tus <span className="text-primary">módulos</span></>}
                  </h2>
                  {step === 0 && renderStep1()}
                  {step === 1 && renderStep2()}
                  {step === 2 && renderStep3()}
                </motion.div>
              </AnimatePresence>
              <p className="text-center text-sm text-muted-foreground pt-4">
                {step === 0 && <>Ya tenés cuenta?{' '}<Link to="/login" className="text-primary font-bold hover:underline">Iniciar sesión</Link></>}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default RegisterTenantPage;
