import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  FileText,
  HeartPulse,
  Layers,
  Package,
  Route,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { NovaHubLogo } from './NovaHubLogo';

const ease = [0.22, 1, 0.36, 1] as const;
const WHATSAPP_BASE = 'https://wa.me/50588241003?text=';

type ModuleCard = {
  title: string;
  body: string;
  icon: LucideIcon;
};

type Vertical = {
  id: string;
  number: string;
  eyebrow: string;
  title: string;
  body: string;
  icon: LucideIcon;
  tone: 'lime' | 'blue' | 'amber' | 'coral' | 'violet';
  stage: string;
  flow: string[];
  modules: ModuleCard[];
  outcomes: string[];
};

const CORE_MODULES: ModuleCard[] = [
  { title: 'Ventas', body: 'Cotizaciones, pedidos, facturas, cobros y clientes.', icon: ClipboardList },
  { title: 'Inventario', body: 'Productos, costos, existencias, bodegas y transferencias.', icon: Package },
  { title: 'Compras', body: 'Proveedores, órdenes, recepción y control del margen.', icon: Truck },
  { title: 'Caja y finanzas', body: 'Cierres, bancos, cuentas por cobrar y por pagar.', icon: Wallet },
  { title: 'Contabilidad', body: 'Diario, mayor, balances y trazabilidad financiera.', icon: BarChart3 },
  { title: 'Personas', body: 'Usuarios, roles, permisos, sucursales y equipo.', icon: Users },
  { title: 'Documentos', body: 'Archivos, contratos, evidencias y reportes.', icon: FileText },
  { title: 'Actividades', body: 'Tareas, eventos, recordatorios y seguimiento.', icon: CalendarDays },
];

const VERTICALS: Vertical[] = [
  {
    id: 'logistics',
    number: '01',
    eyebrow: 'Logística y transporte',
    title: 'Del paquete entregado al negocio controlado.',
    body: 'Una operación para recibir, clasificar, trasladar, entregar y cobrar con el mismo contexto.',
    icon: Route,
    tone: 'lime',
    stage: 'Especialización operativa',
    flow: ['Recepción', 'Clasificación', 'Tránsito', 'Entrega', 'Cobro'],
    modules: [
      { title: 'Paquetes & tracking', body: 'Estados, timeline, portal y consultas seguras.', icon: Route },
      { title: 'Tarifas & cotizaciones', body: 'Reglas por vía, zona, peso, volumen y cliente.', icon: BarChart3 },
      { title: 'Despachos & manifiestos', body: 'Consolida viajes, transportistas y cierres.', icon: Truck },
      { title: 'Incidencias & entrega', body: 'Evidencias, excepciones, responsables y SLA.', icon: ShieldCheck },
    ],
    outcomes: ['Más visibilidad por envío', 'Cobro alineado al servicio', 'Historial útil para cada decisión'],
  },
  {
    id: 'retail',
    number: '02',
    eyebrow: 'Ropa, prendas y retail',
    title: 'Cada talla y color cuenta.',
    body: 'El producto padre organiza el catálogo. La variante real controla precio, stock, compra y venta.',
    icon: Package,
    tone: 'blue',
    stage: 'En expansión',
    flow: ['Catálogo', 'Variante', 'Sucursal', 'Venta', 'Reposición'],
    modules: [
      { title: 'Productos & variantes', body: 'Tallas, colores, temporadas, colecciones y SKU.', icon: Package },
      { title: 'Retail POS', body: 'Venta rápida, cambios, devoluciones y caja.', icon: ClipboardList },
      { title: 'Stock por sucursal', body: 'Existencias, transferencias y reposición inteligente.', icon: Building2 },
      { title: 'Precios & promociones', body: 'Listas por variante, descuentos y margen.', icon: BarChart3 },
    ],
    outcomes: ['Menos quiebres de talla', 'Precio correcto en cada venta', 'Lectura clara por tienda'],
  },
  {
    id: 'construction',
    number: '03',
    eyebrow: 'Construcción y arquitectura',
    title: 'Lo proyectado. Lo ejecutado. Lo que sigue.',
    body: 'Proyectos, cotizaciones, materiales, avances y decisiones financieras en una sola lectura.',
    icon: Building2,
    tone: 'amber',
    stage: 'En expansión',
    flow: ['Cotización', 'Proyecto', 'Partidas', 'Avance', 'Cierre'],
    modules: [
      { title: 'Cotizaciones & proyectos', body: 'Alcance, cliente, fechas, moneda y presupuesto.', icon: FileText },
      { title: 'Presupuesto vs. ejecutado', body: 'Materiales, compras, horas, gastos y variaciones.', icon: BarChart3 },
      { title: 'Fases, hitos & tareas', body: 'Responsables, fechas, entregables y aprobaciones.', icon: CalendarDays },
      { title: 'Documentos & avances', body: 'Planos, evidencias, cambios y versiones.', icon: Layers },
    ],
    outcomes: ['Control del margen por proyecto', 'Decisiones con evidencia', 'Menos información dispersa'],
  },
  {
    id: 'services',
    number: '04',
    eyebrow: 'Marketing y servicios profesionales',
    title: 'De la oportunidad al resultado cobrable.',
    body: 'Clientes, campañas, tareas, horas y facturación conectados para que cada servicio sea rentable.',
    icon: Sparkles,
    tone: 'coral',
    stage: 'En expansión',
    flow: ['Prospecto', 'Propuesta', 'Campaña', 'Entrega', 'Factura'],
    modules: [
      { title: 'CRM & oportunidades', body: 'Prospectos, pipeline, seguimiento y conversión.', icon: Users },
      { title: 'Proyectos & campañas', body: 'Tareas, responsables, entregables y fechas.', icon: Sparkles },
      { title: 'Horas & rentabilidad', body: 'Costos, terceros, bolsas de horas y margen.', icon: BarChart3 },
      { title: 'Facturación recurrente', body: 'Retainers, servicios periódicos y cartera.', icon: Wallet },
    ],
    outcomes: ['Visibilidad del trabajo real', 'Margen por cliente o campaña', 'Cobros alineados a la entrega'],
  },
  {
    id: 'health',
    number: '05',
    eyebrow: 'Farmacias y centros clínicos',
    title: 'Cuidar la operación también es cuidar el dato.',
    body: 'Dos recorridos especializados sobre una base común: farmacia y clínica con control, privacidad y trazabilidad.',
    icon: HeartPulse,
    tone: 'violet',
    stage: 'Especialización operativa',
    flow: ['Paciente / producto', 'Agenda / receta', 'Servicio', 'Cobro', 'Seguimiento'],
    modules: [
      { title: 'Farmacia: lotes & vencimientos', body: 'Existencias, caducidad, FEFO y alertas.', icon: Package },
      { title: 'Clínica: agenda & pacientes', body: 'Citas, profesionales, servicios y seguimiento.', icon: Stethoscope },
      { title: 'Inventario por sucursal', body: 'Compras, transferencias, precios y devoluciones.', icon: Building2 },
      { title: 'Permisos & trazabilidad', body: 'Accesos, documentos y acciones sensibles.', icon: ShieldCheck },
    ],
    outcomes: ['Menos pérdida por vencimiento', 'Agenda y cobro conectados', 'Mayor control sobre información sensible'],
  },
];

const TONE_STYLES: Record<Vertical['tone'], { dot: string; soft: string; border: string; text: string; line: string }> = {
  lime: { dot: 'bg-[#8df06a]', soft: 'bg-[#eaffdf]', border: 'border-[#bdeca9]', text: 'text-[#2d7c30]', line: 'from-[#8df06a]' },
  blue: { dot: 'bg-[#63b3ff]', soft: 'bg-[#e5f3ff]', border: 'border-[#b8dcfa]', text: 'text-[#2670a8]', line: 'from-[#63b3ff]' },
  amber: { dot: 'bg-[#f5c45e]', soft: 'bg-[#fff4d8]', border: 'border-[#f3d899]', text: 'text-[#9b6a11]', line: 'from-[#f5c45e]' },
  coral: { dot: 'bg-[#ff9c7b]', soft: 'bg-[#fff0eb]', border: 'border-[#f6c6b8]', text: 'text-[#a85c46]', line: 'from-[#ff9c7b]' },
  violet: { dot: 'bg-[#c5a4ff]', soft: 'bg-[#f2ebff]', border: 'border-[#d8c5ff]', text: 'text-[#7351a7]', line: 'from-[#c5a4ff]' },
};

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.65, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Kicker({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p className={`mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] ${dark ? 'text-[#8df06a]' : 'text-[#22c55e]'}`}>
      <span className={`h-px w-8 ${dark ? 'bg-[#8df06a]' : 'bg-[#22c55e]'}`} />
      {children}
    </p>
  );
}

function CTA({ href, children, className = '', variant = 'solid' }: { href: string; children: ReactNode; className?: string; variant?: 'solid' | 'light' }) {
  const styles = variant === 'solid'
    ? 'bg-[#22c55e] text-white shadow-[0_18px_45px_-16px_rgba(34,197,94,.6)] hover:bg-[#16a34a]'
    : 'border border-[#d7e5dc] bg-white text-[#174a3a] shadow-sm hover:border-[#22c55e] hover:bg-[#f0fdf4]';
  return (
    <a href={href} className={`inline-flex -skew-x-6 items-center justify-center gap-2.5 rounded-[14px] px-7 py-4 text-sm font-bold uppercase tracking-[0.12em] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${styles} ${className}`}>
      <span className="inline-flex skew-x-6 items-center gap-2.5">{children}</span>
    </a>
  );
}

function whatsappHref(message: string) {
  return `${WHATSAPP_BASE}${encodeURIComponent(message)}`;
}

function Header() {
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <nav className="mx-auto flex h-[78px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <a href="/landing" className="flex items-center gap-2.5" aria-label="Volver a NovaHub ERP">
          <NovaHubLogo size={35} />
          <span className="flex flex-col leading-none">
            <span className="text-[17px] font-black tracking-[-0.04em] text-white">Nova<span className="text-[#8df06a]">Hub</span></span>
            <span className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.22em] text-white/50">ERP Platform</span>
          </span>
        </a>
        <div className="hidden items-center gap-8 text-xs font-bold uppercase tracking-[0.14em] text-white/65 md:flex">
          <a href="#base" className="transition-colors hover:text-[#8df06a]">La base</a>
          <a href="#rubros" className="transition-colors hover:text-[#8df06a]">Los rubros</a>
          <a href="#modelo" className="transition-colors hover:text-[#8df06a]">El modelo</a>
          <a href="/landing" className="flex items-center gap-1.5 text-white transition-colors hover:text-[#8df06a]">Landing principal <ArrowUpRight className="size-3.5" /></a>
        </div>
        <a href={whatsappHref('Hola, quiero conocer los módulos de NovaHub ERP para mi empresa')} className="hidden rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white backdrop-blur transition-colors hover:border-[#8df06a] hover:bg-[#8df06a] hover:text-[#174a3a] sm:block">
          Hablar con NovaHub
        </a>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-[#174a3a] px-5 pb-20 pt-36 text-white sm:px-8 lg:px-10 lg:pb-28 lg:pt-44">
      <div className="pointer-events-none absolute inset-0 opacity-[0.09]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)', backgroundSize: '76px 76px' }} />
      <div className="pointer-events-none absolute -right-52 -top-64 size-[44rem] rounded-full bg-[#22c55e]/20 blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-64 -left-40 size-[32rem] rounded-full bg-[#0b3b31] blur-[80px]" />

      <div className="relative mx-auto grid max-w-7xl gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <Reveal>
          <Kicker dark>NovaHub / catálogo de módulos</Kicker>
          <h1 className="max-w-3xl text-[3.3rem] font-black leading-[0.91] tracking-[-0.06em] sm:text-7xl lg:text-[6.2rem]">
            Un ERP.<br />
            <span className="text-[#8df06a]">Cinco mundos</span><br />
            de negocio.
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-7 text-white/65 sm:text-xl">
            Una base común para operar hoy. Módulos especializados para que cada empresa trabaje con el lenguaje de su propio negocio.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <CTA href="#rubros">Explorar los rubros <ArrowRight className="size-4" /></CTA>
            <CTA href={whatsappHref('Hola, quiero conversar sobre el módulo de NovaHub para mi empresa')} variant="light">Conversar sobre mi empresa</CTA>
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          <ModuleMap />
        </Reveal>
      </div>
      <div className="relative mx-auto mt-20 max-w-7xl border-t border-white/15 pt-5 text-xs font-bold uppercase tracking-[0.16em] text-white/45">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>Ventas · Inventario · Caja · Finanzas · Personas</span>
          <span className="text-[#8df06a]">Una plataforma que crece por capas</span>
        </div>
      </div>
    </section>
  );
}

function ModuleMap() {
  return (
    <div className="relative mx-auto min-h-[420px] w-full max-w-[590px]">
      <div className="absolute left-1/2 top-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#8df06a]/20 bg-[#123d31]/60 shadow-[0_0_100px_rgba(141,240,106,.14)]" />
      <div className="absolute left-1/2 top-1/2 flex size-44 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-[#8df06a]/60 bg-[#0f3027] text-center shadow-[0_20px_80px_rgba(0,0,0,.25)]">
        <NovaHubLogo size={36} />
        <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8df06a]">NovaHub core</p>
        <p className="mt-1 text-xs text-white/50">La base común</p>
      </div>

      <div className="absolute left-[2%] top-[8%] -rotate-6"><MapNode number="01" label="Logística" tone="lime" /></div>
      <div className="absolute right-[2%] top-[7%] rotate-6"><MapNode number="02" label="Ropa & retail" tone="blue" /></div>
      <div className="absolute bottom-[6%] left-[5%] rotate-3"><MapNode number="03" label="Construcción" tone="amber" /></div>
      <div className="absolute bottom-[4%] right-[3%] -rotate-3"><MapNode number="04" label="Marketing" tone="coral" /></div>
      <div className="absolute left-1/2 top-0 -translate-x-1/2 rotate-2"><MapNode number="05" label="Salud" tone="violet" /></div>

      <div className="absolute left-[17%] top-[31%] h-px w-[25%] rotate-[28deg] bg-gradient-to-r from-[#8df06a]/70 to-transparent" />
      <div className="absolute right-[17%] top-[31%] h-px w-[25%] -rotate-[28deg] bg-gradient-to-l from-[#8df06a]/70 to-transparent" />
      <div className="absolute bottom-[28%] left-[18%] h-px w-[26%] -rotate-[24deg] bg-gradient-to-r from-[#8df06a]/60 to-transparent" />
      <div className="absolute bottom-[26%] right-[18%] h-px w-[26%] rotate-[24deg] bg-gradient-to-l from-[#8df06a]/60 to-transparent" />
      <div className="absolute left-1/2 top-[18%] h-[24%] w-px -translate-x-1/2 bg-gradient-to-b from-[#8df06a]/60 to-transparent" />
    </div>
  );
}

function MapNode({ number, label, tone }: { number: string; label: string; tone: Vertical['tone'] }) {
  const styles = TONE_STYLES[tone];
  return (
    <div className="rounded-2xl border border-white/15 bg-[#123d31]/90 px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,.22)] backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${styles.dot}`} />
        <span className="text-[9px] font-black tracking-[0.2em] text-white/45">{number}</span>
      </div>
      <p className="mt-2 whitespace-nowrap text-sm font-bold text-white">{label}</p>
    </div>
  );
}

function BaseSection() {
  return (
    <section id="base" className="relative overflow-hidden bg-white px-5 py-24 sm:px-8 lg:px-10 lg:py-32">
      <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
        <Reveal>
          <Kicker>La plataforma transversal</Kicker>
          <h2 className="max-w-xl text-4xl font-black leading-[0.98] tracking-[-0.05em] text-[#174a3a] sm:text-6xl">
            Una base.<br /><span className="text-[#22c55e]">Muchos ritmos.</span>
          </h2>
          <p className="mt-6 max-w-md text-lg leading-7 text-[#5d7884]">
            Antes de hablar de verticales, toda empresa necesita que sus movimientos estén conectados. Esta es la columna vertebral de NovaHub.
          </p>
          <div className="mt-8 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.15em] text-[#84a1ad]">
            <span className="h-px w-9 bg-[#22c55e]" /> Se activa por empresa y por alcance
          </div>
        </Reveal>

        <div className="grid gap-px overflow-hidden border border-[#dce9e1] bg-[#dce9e1] sm:grid-cols-2 lg:grid-cols-4">
          {CORE_MODULES.map((module, index) => {
            const Icon = module.icon;
            return (
              <Reveal key={module.title} delay={index * 0.035} className="bg-white">
                <article className="group h-full min-h-[178px] p-5 transition-colors hover:bg-[#f0fdf4] sm:p-6">
                  <Icon className="size-5 text-[#22c55e] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
                  <h3 className="mt-8 text-base font-bold text-[#174a3a]">{module.title}</h3>
                  <p className="mt-2 text-sm leading-5 text-[#6b858d]">{module.body}</p>
                  <div className="mt-5 h-1 w-7 bg-[#22c55e]/30 transition-all duration-300 group-hover:w-14 group-hover:bg-[#22c55e]" />
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RubrosSection() {
  const [activeId, setActiveId] = useState(VERTICALS[0].id);
  const active = VERTICALS.find((vertical) => vertical.id === activeId) || VERTICALS[0];
  const styles = TONE_STYLES[active.tone];
  const ActiveIcon = active.icon;

  return (
    <section id="rubros" className="relative overflow-hidden bg-[#f0fdf4] px-5 py-24 sm:px-8 lg:px-10 lg:py-32">
      <div className="pointer-events-none absolute inset-0 opacity-[0.035]" style={{ backgroundImage: 'linear-gradient(#22c55e 1px, transparent 1px), linear-gradient(90deg, #22c55e 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
      <div className="relative mx-auto max-w-7xl">
        <Reveal>
          <div className="flex flex-col justify-between gap-8 border-b border-[#cfe8d8] pb-8 lg:flex-row lg:items-end">
            <div>
              <Kicker>Los cinco mundos de negocio</Kicker>
              <h2 className="max-w-3xl text-4xl font-black leading-[0.96] tracking-[-0.05em] text-[#174a3a] sm:text-6xl">
                Elige el ritmo.<br /><span className="text-[#22c55e]">Mira el flujo.</span>
              </h2>
            </div>
            <p className="max-w-sm text-base leading-6 text-[#5d7884]">
              Cada rubro combina la base NovaHub con un lenguaje operativo propio.
            </p>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-5 lg:grid-cols-[0.42fr_1.58fr]">
          <div role="tablist" aria-label="Rubros de NovaHub" className="flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-2 lg:overflow-visible">
            {VERTICALS.map((vertical) => {
              const Icon = vertical.icon;
              const selected = vertical.id === active.id;
              const itemStyles = TONE_STYLES[vertical.tone];
              return (
                <button
                  key={vertical.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveId(vertical.id)}
                  className={`group flex min-w-[210px] items-center gap-3 rounded-2xl border p-4 text-left transition-all lg:min-w-0 ${selected ? `${itemStyles.soft} ${itemStyles.border} shadow-[0_14px_35px_-22px_rgba(23,74,58,.55)]` : 'border-transparent bg-white/65 hover:border-[#d5e9dc] hover:bg-white'}`}
                >
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${selected ? 'bg-white shadow-sm' : 'bg-[#e4f4e9]'} ${itemStyles.text}`}><Icon className="size-5" /></span>
                  <span className="min-w-0">
                    <span className={`block text-[10px] font-black tracking-[0.18em] ${selected ? itemStyles.text : 'text-[#9ab3a7]'}`}>{vertical.number}</span>
                    <span className="mt-1 block whitespace-nowrap text-sm font-bold text-[#174a3a] lg:whitespace-normal">{vertical.eyebrow}</span>
                  </span>
                  <ChevronRight className={`ml-auto hidden size-4 transition-transform lg:block ${selected ? `${itemStyles.text} translate-x-0.5` : 'text-[#bad0c1]'}`} />
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.article key={active.id} role="tabpanel" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.35, ease }} className="overflow-hidden rounded-[1.75rem] border border-[#d7e9dc] bg-white shadow-[0_28px_70px_-42px_rgba(23,74,58,.35)]">
              <div className="border-b border-[#e4eee7] p-6 sm:p-9">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className={`grid size-12 place-items-center rounded-2xl ${styles.soft} ${styles.text}`}><ActiveIcon className="size-6" /></span>
                      <div>
                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${styles.text}`}>{active.stage}</p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.15em] text-[#9ab3a7]">Módulo {active.number}</p>
                      </div>
                    </div>
                    <h3 className="mt-7 max-w-2xl text-3xl font-black leading-[1] tracking-[-0.045em] text-[#174a3a] sm:text-5xl">{active.title}</h3>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-[#5d7884]">{active.body}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${styles.soft} ${styles.text}`}>Por rubro</span>
                </div>

                <div className="mt-8 overflow-x-auto">
                  <div className="flex min-w-[520px] items-center gap-0">
                    {active.flow.map((step, index) => (
                      <div key={step} className="flex flex-1 items-center">
                        <div className="min-w-0 flex-1">
                          <div className={`mx-auto grid size-8 place-items-center rounded-full border-2 bg-white text-[10px] font-black ${styles.border} ${styles.text}`}>{String(index + 1).padStart(2, '0')}</div>
                          <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.11em] text-[#6e8980]">{step}</p>
                        </div>
                        {index < active.flow.length - 1 && <span className={`h-px w-full bg-gradient-to-r ${styles.line} to-[#dcebe1]`} />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-px bg-[#e4eee7] sm:grid-cols-2">
                {active.modules.map((module, index) => {
                  const Icon = module.icon;
                  return (
                    <div key={module.title} className="bg-white p-6 transition-colors hover:bg-[#fbfefc] sm:p-7">
                      <div className="flex items-start justify-between gap-4">
                        <Icon className={`size-5 ${styles.text}`} />
                        <span className="text-[10px] font-black tracking-[0.15em] text-[#bed2c5]">0{index + 1}</span>
                      </div>
                      <h4 className="mt-7 text-base font-bold text-[#174a3a]">{module.title}</h4>
                      <p className="mt-2 text-sm leading-5 text-[#6b858d]">{module.body}</p>
                    </div>
                  );
                })}
              </div>

              <div className={`${styles.soft} p-6 sm:p-7`}>
                <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${styles.text}`}>Lo que esta capa ordena</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {active.outcomes.map((outcome) => <p key={outcome} className="flex items-start gap-2 text-sm font-semibold text-[#41645a]"><Check className={`mt-0.5 size-4 shrink-0 ${styles.text}`} />{outcome}</p>)}
                </div>
              </div>
            </motion.article>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function ModelSection() {
  const cards = [
    { number: '01', title: 'La base que todos comparten', body: 'Ventas, inventario, caja, compras, finanzas, contabilidad, personas y control.', icon: Layers, color: 'bg-[#e7f9ec] text-[#1f8c50]' },
    { number: '02', title: 'La especialización que se repite', body: 'Un mismo flujo para varias empresas del rubro, con reglas configurables y datos conectados.', icon: Sparkles, color: 'bg-[#fff4d8] text-[#9b6a11]' },
    { number: '03', title: 'La extensión propia de una empresa', body: 'Integraciones, migraciones o procesos particulares que se cotizan con claridad.', icon: Building2, color: 'bg-[#e5f3ff] text-[#2670a8]' },
  ];

  return (
    <section id="modelo" className="bg-white px-5 py-24 sm:px-8 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="grid gap-8 border-b border-[#e0ebe4] pb-8 lg:grid-cols-[1fr_0.58fr] lg:items-end">
            <div>
              <Kicker>Cómo crece NovaHub</Kicker>
              <h2 className="max-w-3xl text-4xl font-black leading-[0.96] tracking-[-0.05em] text-[#174a3a] sm:text-6xl">
                Producto compartido.<br /><span className="text-[#22c55e]">Implementación con criterio.</span>
              </h2>
            </div>
            <p className="max-w-sm text-base leading-6 text-[#5d7884]">
              Cada nueva capacidad debe fortalecer la plataforma y tener un lugar claro en la propuesta de valor.
            </p>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {cards.map((card, index) => {
            const Icon = card.icon;
            return (
              <Reveal key={card.number} delay={index * 0.08}>
                <article className="group relative h-full overflow-hidden border border-[#e0ebe4] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[#bfe6c9] hover:shadow-[0_25px_60px_-40px_rgba(23,74,58,.45)] sm:p-9">
                  <div className={`grid size-11 place-items-center rounded-2xl ${card.color}`}><Icon className="size-5" /></div>
                  <span className="absolute right-6 top-7 text-4xl font-black tracking-[-0.08em] text-[#eaf2ed] transition-colors group-hover:text-[#d9f5e1]">{card.number}</span>
                  <h3 className="mt-10 max-w-xs text-2xl font-black leading-[1.02] tracking-[-0.035em] text-[#174a3a]">{card.title}</h3>
                  <p className="mt-4 max-w-sm text-base leading-6 text-[#6b858d]">{card.body}</p>
                  <div className="mt-8 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#22c55e]">Ver cómo se arma <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" /></div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="relative overflow-hidden bg-[#174a3a] px-5 py-24 text-white sm:px-8 lg:px-10 lg:py-32">
      <div className="pointer-events-none absolute -right-44 -top-48 size-[38rem] rounded-full bg-[#22c55e]/15 blur-[100px]" />
      <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_auto] lg:items-end">
        <Reveal>
          <Kicker dark>El próximo módulo empieza con una conversación</Kicker>
          <h2 className="max-w-4xl text-4xl font-black leading-[0.95] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
            Muéstranos cómo<br /><span className="text-[#8df06a]">opera tu empresa.</span>
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-7 text-white/60">Te ayudamos a ubicar tu operación en la base NovaHub y a definir el módulo que tiene sentido para tu siguiente etapa.</p>
        </Reveal>
        <Reveal delay={0.1} className="flex flex-col gap-4 sm:flex-row lg:flex-col">
          <CTA href={whatsappHref('Hola, quiero solicitar un diagnóstico de módulos NovaHub para mi empresa')}>
            Solicitar diagnóstico <ArrowRight className="size-4" />
          </CTA>
          <a href="/landing" className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold uppercase tracking-[0.12em] text-white/55 transition-colors hover:text-[#8df06a]">Conocer la landing principal <ArrowUpRight className="size-4" /></a>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#0d1f1a] px-5 py-10 text-white sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 border-b border-white/10 pb-8 sm:flex-row sm:items-center">
        <a href="/landing" className="flex items-center gap-2.5">
          <NovaHubLogo size={30} />
          <span className="flex flex-col leading-none"><span className="text-[16px] font-black tracking-[-0.04em]">Nova<span className="text-[#22c55e]">Hub</span></span><span className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.22em] text-white/40">ERP Platform</span></span>
        </a>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/35">Módulos que convierten operación en claridad.</p>
      </div>
      <div className="mx-auto flex max-w-7xl justify-between gap-4 pt-6 text-xs text-white/30"><span>© {new Date().getFullYear()} NovaHub ERP</span><a href="/landing" className="transition-colors hover:text-[#8df06a]">Volver a NovaHub</a></div>
    </footer>
  );
}

export default function ModulosLandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#174a3a] antialiased selection:bg-[#22c55e]/20 selection:text-[#174a3a]">
      <Header />
      <main>
        <Hero />
        <BaseSection />
        <RubrosSection />
        <ModelSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
