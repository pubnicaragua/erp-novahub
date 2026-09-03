import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Archive,
  ArrowRight,
  Banknote,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Circle,
  Contact,
  FolderTree,
  Landmark,
  ListChecks,
  Package,
  ReceiptText,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Tags,
  TestTube2,
  UserCog,
  Users,
  WalletCards,
} from 'lucide-react';
import type { Module } from '../../contexts/AuthContext';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../ui/utils';

interface ImplementationGuideViewProps {
  onNavigate?: (module: Module) => void;
}

type GuidePhase = 'Base' | 'Estructura' | 'Catálogo' | 'Operación';

interface GuideStep {
  id: string;
  number: number;
  phase: GuidePhase;
  title: string;
  summary: string;
  why: string;
  configure: string[];
  dependsOn: string;
  enables: string;
  icon: typeof Building2;
  tone: string;
  platformTarget?: Module;
  targetLabel?: string;
}

const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'contexto-empresa',
    number: 1,
    phase: 'Base',
    title: 'Crear la empresa y su estructura',
    summary: 'Define el grupo empresarial, la empresa operativa y las sucursales que utilizarán el ERP.',
    why: 'Todos los registros posteriores necesitan un tenant y, cuando corresponde, una sucursal o bodega de referencia.',
    configure: ['Grupo empresarial y empresa', 'Sucursales activas', 'Alcance de cada operación'],
    dependsOn: 'Ninguno',
    enables: 'El espacio de trabajo donde se aplicará toda la configuración.',
    icon: Building2,
    tone: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    platformTarget: 'suscripciones',
    targetLabel: 'Abrir grupos',
  },
  {
    id: 'configuracion-base',
    number: 2,
    phase: 'Base',
    title: 'Configurar los datos generales',
    summary: 'Completa identidad, moneda, datos fiscales, numeración y parámetros generales de la empresa.',
    why: 'La moneda base y los datos de la empresa condicionan importes, reportes, documentos y asientos.',
    configure: ['Nombre y datos fiscales', 'Moneda base y divisas', 'Identidad visual y documentos'],
    dependsOn: 'Empresa y sucursales creadas',
    enables: 'Valores consistentes en contabilidad, ventas, compras y reportes.',
    icon: Settings2,
    tone: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    platformTarget: 'configuracion',
    targetLabel: 'Abrir configuración',
  },
  {
    id: 'contabilidad',
    number: 3,
    phase: 'Base',
    title: 'Preparar la contabilidad',
    summary: 'Carga o revisa el plan de cuentas y configura las cuentas que utilizarán los módulos.',
    why: 'Las bodegas, cajas, productos, compras, ventas y pagos necesitan cuentas contables posteables.',
    configure: ['Plan de cuentas', 'Cuenta de inventario por bodega', 'Ingresos, costos, impuestos y formas de pago'],
    dependsOn: 'Datos generales y moneda base',
    enables: 'Asientos automáticos y reportes contables confiables.',
    icon: Landmark,
    tone: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
  },
  {
    id: 'bodegas',
    number: 4,
    phase: 'Estructura',
    title: 'Crear y vincular las bodegas',
    summary: 'Define dónde existe el inventario y asigna la cuenta contable correspondiente a cada bodega.',
    why: 'El stock y sus movimientos se controlan por bodega; además, la cuenta de inventario debe estar disponible.',
    configure: ['Bodegas y sucursales', 'Cuenta de inventario', 'Alcance operativo y existencias iniciales'],
    dependsOn: 'Contabilidad preparada',
    enables: 'Productos con stock por ubicación, transferencias y ajustes.',
    icon: Archive,
    tone: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
  },
  {
    id: 'departamentos',
    number: 5,
    phase: 'Estructura',
    title: 'Definir departamentos y puestos',
    summary: 'Construye la estructura organizacional antes de registrar personas y accesos.',
    why: 'Los empleados se asignan a departamentos y puestos; por eso esta estructura debe existir primero.',
    configure: ['Departamentos', 'Puestos y responsabilidades', 'Reglas de acceso por área cuando apliquen'],
    dependsOn: 'Empresa y sucursales',
    enables: 'Empleados correctamente clasificados y permisos organizados.',
    icon: FolderTree,
    tone: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
  },
  {
    id: 'empleados',
    number: 6,
    phase: 'Estructura',
    title: 'Registrar empleados',
    summary: 'Crea las fichas de las personas que participarán en operaciones, nómina o aprobaciones.',
    why: 'Los usuarios pueden vincularse a empleados y los procesos de RR. HH. necesitan una ficha laboral.',
    configure: ['Datos personales y laborales', 'Departamento y puesto', 'Estado, salario y datos de nómina si aplica'],
    dependsOn: 'Departamentos y puestos',
    enables: 'Usuarios vinculados, nóminas, asistencia y responsables de documentos.',
    icon: Users,
    tone: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  },
  {
    id: 'usuarios',
    number: 7,
    phase: 'Estructura',
    title: 'Crear usuarios y roles',
    summary: 'Entrega accesos según responsabilidades y limita cada usuario a los módulos que necesita.',
    why: 'Los usuarios deben operar sobre una estructura ya definida y con permisos mínimos claros.',
    configure: ['Usuarios y contraseñas', 'Roles y permisos', 'Sucursal, bodega y alcance de cada usuario'],
    dependsOn: 'Empleados y estructura organizacional',
    enables: 'Operación segura y trazabilidad de las acciones.',
    icon: UserCog,
    tone: 'text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/20',
  },
  {
    id: 'atributos-categorias',
    number: 8,
    phase: 'Catálogo',
    title: 'Organizar atributos y categorías',
    summary: 'Define la clasificación y los atributos que se reutilizarán en productos con o sin variantes.',
    why: 'Las variantes deben construirse con atributos existentes y el catálogo debe quedar fácil de buscar.',
    configure: ['Categorías', 'Atributos y valores', 'Reglas internas para SKU y variantes'],
    dependsOn: 'Bodegas creadas',
    enables: 'Catálogo consistente, variantes trazables e importaciones más limpias.',
    icon: Tags,
    tone: 'text-pink-500 bg-pink-500/10 border-pink-500/20',
  },
  {
    id: 'productos',
    number: 9,
    phase: 'Catálogo',
    title: 'Cargar productos y servicios',
    summary: 'Registra productos padres, variantes, SKU, imágenes, costos, unidades y reglas de inventario.',
    why: 'Los precios, compras, ventas y existencias dependen de que exista primero un catálogo identificable por SKU.',
    configure: ['Productos y servicios', 'Variantes y SKU', 'Imágenes, costos, mínimos y máximos'],
    dependsOn: 'Bodegas, categorías y atributos',
    enables: 'Precios, existencias, compras, ventas y reportes de inventario.',
    icon: Package,
    tone: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  },
  {
    id: 'listas-precios',
    number: 10,
    phase: 'Catálogo',
    title: 'Configurar listas de precios',
    summary: 'Define los precios comerciales que se aplicarán sobre productos y variantes.',
    why: 'Una lista de precios referencia productos existentes; configurarla antes puede dejar precios sin destino.',
    configure: ['Listas y códigos', 'Precios por producto o variante', 'Reglas para clientes, ventas y cajas'],
    dependsOn: 'Productos y SKU creados',
    enables: 'Cotizaciones, órdenes, facturas y precios diferenciados.',
    icon: ListChecks,
    tone: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  },
  {
    id: 'clientes',
    number: 11,
    phase: 'Operación',
    title: 'Registrar clientes',
    summary: 'Carga clientes, condiciones comerciales y datos fiscales para vender y cobrar con trazabilidad.',
    why: 'Los documentos de venta y el crédito necesitan un tercero con información comercial válida.',
    configure: ['Datos generales y fiscales', 'Condiciones de pago y crédito', 'Lista de precios cuando corresponda'],
    dependsOn: 'Listas de precios y configuración comercial',
    enables: 'Cotizaciones, ventas, cuentas por cobrar y estados de cuenta.',
    icon: Contact,
    tone: 'text-teal-500 bg-teal-500/10 border-teal-500/20',
  },
  {
    id: 'proveedores',
    number: 12,
    phase: 'Operación',
    title: 'Registrar proveedores',
    summary: 'Carga proveedores y condiciones de compra para abastecer el catálogo y registrar obligaciones.',
    why: 'Las compras y recepciones deben identificar a quién se adquieren los productos y cómo se paga.',
    configure: ['Datos generales y fiscales', 'Condiciones de pago', 'Cuentas y documentos de compra'],
    dependsOn: 'Productos y contabilidad preparada',
    enables: 'Solicitudes, órdenes, recepciones, facturas y cuentas por pagar.',
    icon: ShoppingCart,
    tone: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
  },
  {
    id: 'cajas',
    number: 13,
    phase: 'Operación',
    title: 'Configurar cajas y medios de pago',
    summary: 'Crea las cajas, asigna responsables y revisa sus cuentas antes de facturar o cobrar.',
    why: 'El cierre de caja y los cobros generan movimientos que deben quedar asociados a la sucursal y a contabilidad.',
    configure: ['Cajas por sucursal', 'Usuarios responsables', 'Medios de pago y cuentas'],
    dependsOn: 'Usuarios, bodegas y cuentas contables',
    enables: 'Facturación por caja, cobros, cierres y conciliación.',
    icon: WalletCards,
    tone: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  },
  {
    id: 'saldos-iniciales',
    number: 14,
    phase: 'Operación',
    title: 'Cargar saldos y existencias iniciales',
    summary: 'Ingresa el inventario inicial y los saldos necesarios para comenzar con una base coherente.',
    why: 'Los saldos iniciales solo son confiables cuando ya existen cuentas, bodegas, productos y terceros.',
    configure: ['Existencias por SKU y bodega', 'Saldos contables de apertura', 'Cuentas por cobrar y pagar si aplica'],
    dependsOn: 'Todo el catálogo y la estructura operativa',
    enables: 'Inicio operativo con stock, reportes y saldos conciliables.',
    icon: Banknote,
    tone: 'text-lime-500 bg-lime-500/10 border-lime-500/20',
  },
  {
    id: 'pruebas',
    number: 15,
    phase: 'Operación',
    title: 'Ejecutar una prueba de punta a punta',
    summary: 'Valida un ciclo pequeño de compra, recepción, venta, cobro, cierre y reporte.',
    why: 'La implementación se confirma con documentos reales de prueba y no solo con catálogos cargados.',
    configure: ['Compra y recepción', 'Venta y cobro', 'Cierre, asiento y reportes'],
    dependsOn: 'Configuración y saldos iniciales',
    enables: 'Detección temprana de cuentas, permisos, precios o existencias mal configurados.',
    icon: TestTube2,
    tone: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  },
];

const PHASE_STYLES: Record<GuidePhase, string> = {
  Base: 'border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400',
  Estructura: 'border-orange-500/20 bg-orange-500/5 text-orange-600 dark:text-orange-400',
  Catálogo: 'border-violet-500/20 bg-violet-500/5 text-violet-600 dark:text-violet-400',
  Operación: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
};

export function ImplementationGuideView({ onNavigate }: ImplementationGuideViewProps) {
  const [expandedId, setExpandedId] = useState(GUIDE_STEPS[0].id);
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set());
  const completedCount = completedIds.size;
  const progress = useMemo(() => Math.round((completedCount / GUIDE_STEPS.length) * 100), [completedCount]);

  const toggleCompleted = (id: string) => {
    setCompletedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openPlatformTarget = (step: GuideStep) => {
    if (step.platformTarget && onNavigate) onNavigate(step.platformTarget);
  };

  return (
    <div data-implementation-guide className="min-w-0 max-w-full overflow-x-hidden bg-background">
      <div className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-[1500px] min-w-0 p-4 sm:p-6 md:p-10">
        <div className="space-y-6 sm:space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
          >
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/20 bg-primary/5 text-[10px] font-black uppercase tracking-widest text-primary">
                  Solo Superadmin
                </Badge>
                <Badge variant="outline" className="border-border/60 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Implementación ERP
                </Badge>
              </div>
              <h1 className="flex min-w-0 flex-wrap items-center gap-3 text-3xl font-black uppercase italic leading-none tracking-tighter text-foreground sm:text-4xl">
                <ClipboardCheck className="size-9 shrink-0 text-primary sm:size-10" />
                Guía de <span className="text-primary">implementación</span>
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                Ruta recomendada para preparar una empresa en NovaHub respetando las dependencias entre configuración, estructura, catálogo y operación.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-border/60 bg-card/70 p-3 shadow-sm">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Progreso de esta sesión</p>
                <p className="text-xl font-black tracking-tight text-foreground">{completedCount} de {GUIDE_STEPS.length} pasos</p>
              </div>
            </div>
          </motion.div>

          <Card className="overflow-hidden rounded-3xl border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card to-card shadow-sm">
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex">
                    <ArrowRight className="size-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-widest text-primary">Criterio de orden</p>
                    <p className="mt-2 text-sm leading-6 text-foreground/80">
                      La moneda y la empresa van primero; después las cuentas contables, porque alimentan bodegas, cajas y documentos. Luego se construye la estructura humana y el catálogo. Las listas de precios van después de los productos porque sus importes se vinculan a SKU existentes.
                    </p>
                  </div>
                </div>
                <div className="w-full shrink-0 lg:max-w-xs">
                  <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <span>Avance visual</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted/50">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={false}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.25 }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">El avance es local y no modifica la configuración de ninguna empresa.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['Base', 'Estructura', 'Catálogo', 'Operación'] as GuidePhase[]).map((phase, index) => {
              const phaseSteps = GUIDE_STEPS.filter((step) => step.phase === phase);
              const phaseCompleted = phaseSteps.filter((step) => completedIds.has(step.id)).length;
              return (
                <div key={phase} className={cn('rounded-2xl border p-4', PHASE_STYLES[phase])}>
                  <p className="text-[10px] font-black uppercase tracking-widest">Fase 0{index + 1}</p>
                  <p className="mt-1 text-sm font-black text-foreground">{phase}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{phaseCompleted}/{phaseSteps.length} revisados</p>
                </div>
              );
            })}
          </div>

          <Card className="rounded-3xl border-border/50 bg-card/50 shadow-sm">
            <CardHeader className="border-b border-border/50 px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
                    <ListChecks className="size-5 text-primary" /> Ruta recomendada
                  </CardTitle>
                  <CardDescription className="mt-1">Expande cada paso para revisar qué configurar, por qué y qué habilita.</CardDescription>
                </div>
                <Badge variant="outline" className="w-fit border-primary/20 bg-primary/5 text-[10px] font-black uppercase tracking-widest text-primary">
                  {GUIDE_STEPS.length} pasos ordenados
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5">
              <div className="space-y-2">
                {GUIDE_STEPS.map((step, index) => {
                  const isExpanded = expandedId === step.id;
                  const isCompleted = completedIds.has(step.id);
                  const Icon = step.icon;
                  return (
                    <motion.div
                      key={step.id}
                      layout
                      className={cn(
                        'relative overflow-hidden rounded-2xl border transition-colors',
                        isExpanded ? 'border-primary/30 bg-primary/[0.035]' : 'border-border/50 bg-background/40 hover:border-primary/20',
                        isCompleted && 'border-emerald-500/25',
                      )}
                    >
                      {index < GUIDE_STEPS.length - 1 && (
                        <div className="absolute bottom-[-10px] left-[27px] top-[68px] hidden w-px bg-border/60 sm:block" aria-hidden="true" />
                      )}
                      <div className="relative flex min-w-0 items-start gap-3 p-3 sm:gap-4 sm:p-4">
                        <div className={cn('relative z-10 flex size-10 shrink-0 items-center justify-center rounded-xl border', step.tone)}>
                          {isCompleted ? <Check className="size-5 text-emerald-500" /> : <Icon className="size-5" />}
                        </div>
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                          aria-expanded={isExpanded}
                          aria-controls={`${step.id}-content`}
                          onClick={() => setExpandedId(isExpanded ? '' : step.id)}
                        >
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Paso {String(step.number).padStart(2, '0')}</span>
                            <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-widest', PHASE_STYLES[step.phase])}>{step.phase}</Badge>
                            {isCompleted && <Badge className="border-none bg-emerald-500/10 text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Revisado</Badge>}
                          </div>
                          <p className="mt-1 truncate text-sm font-black text-foreground sm:text-base">{step.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{step.summary}</p>
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-9 rounded-xl text-muted-foreground hover:text-primary"
                            aria-label={isCompleted ? `Quitar revisado de ${step.title}` : `Marcar revisado: ${step.title}`}
                            title={isCompleted ? 'Quitar revisado' : 'Marcar como revisado'}
                            onClick={() => toggleCompleted(step.id)}
                          >
                            {isCompleted ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4" />}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-9 rounded-xl text-muted-foreground hover:text-primary"
                            aria-label={isExpanded ? `Contraer ${step.title}` : `Expandir ${step.title}`}
                            onClick={() => setExpandedId(isExpanded ? '' : step.id)}
                          >
                            <ChevronDown className={cn('size-4 transition-transform', isExpanded && 'rotate-180')} />
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div id={`${step.id}-content`} className="border-t border-border/50 px-3 pb-4 pt-4 sm:px-[72px] sm:pb-5">
                          <div className="grid min-w-0 gap-4 lg:grid-cols-[1.1fr_1fr]">
                            <div className="min-w-0 space-y-4">
                              <div>
                                <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-primary">Por qué va aquí</p>
                                <p className="text-sm leading-6 text-foreground/80">{step.why}</p>
                              </div>
                              <div>
                                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-primary">Qué configurar</p>
                                <ul className="space-y-2">
                                  {step.configure.map((item) => (
                                    <li key={item} className="flex items-start gap-2 text-sm text-foreground/80">
                                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                            <div className="min-w-0 rounded-2xl border border-border/50 bg-muted/15 p-4">
                              <div className="flex items-start gap-3">
                                <div className="rounded-xl bg-background p-2 text-primary shadow-sm">
                                  <ArrowRight className="size-4" />
                                </div>
                                <div className="min-w-0 space-y-3">
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Depende de</p>
                                    <p className="mt-1 text-sm font-semibold text-foreground">{step.dependsOn}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Habilita</p>
                                    <p className="mt-1 text-sm leading-5 text-foreground/80">{step.enables}</p>
                                  </div>
                                  {step.platformTarget && (
                                    <Button type="button" variant="outline" className="mt-1 h-9 w-full justify-between rounded-xl text-xs font-bold" onClick={() => openPlatformTarget(step)}>
                                      {step.targetLabel}
                                      <ArrowRight className="size-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-amber-500/20 bg-amber-500/[0.04] shadow-sm">
            <CardContent className="flex items-start gap-3 p-5 sm:p-6">
              <div className="rounded-xl bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
                <ReceiptText className="size-5" />
              </div>
              <div>
                <p className="text-sm font-black text-foreground">Regla práctica para la puesta en marcha</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Configura primero una empresa de prueba, ejecuta el ciclo completo y después repite la carga en producción. La guía orienta el orden, pero no marca pasos como configurados ni modifica datos automáticamente.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
