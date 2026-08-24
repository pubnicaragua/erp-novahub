import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useScroll, useTransform } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  Calculator,
  Check,
  CircleDollarSign,
  FileText,
  Headphones,
  LockKeyhole,
  Menu,
  Package,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Store,
  Users,
  X,
  Zap,
} from 'lucide-react';
import facturacionCajaDemo from '../../assets/landing/facturacion-caja-demo.png';
import { NovaHubLogo } from './NovaHubLogo';
import { LandingChatModal } from './LandingChatModal';

const EXCHANGE_RATE = 36.5;
const ease = [0.22, 1, 0.36, 1] as const;

const NAV_LINKS = [
  { label: 'Producto', href: '#producto' },
  { label: 'Cómo funciona', href: '#proceso' },
  { label: 'Giros', href: '#giros' },
  { label: 'Precios', href: '#precios' },
  { label: 'Confianza', href: '#confianza' },
] as const;

const MODULES = [
  { title: 'Ventas', body: 'Cotizaciones, facturas, anticipos, créditos y seguimiento de clientes.', icon: Receipt },
  { title: 'Inventario', body: 'Productos, bodegas, costos, existencias y transferencias entre sucursales.', icon: Package },
  { title: 'Compras', body: 'Proveedores, órdenes de compra, recepción y control del margen.', icon: ShoppingCart },
  { title: 'Caja y POS', body: 'Cobros, cierres de caja, tickets y operación por responsable.', icon: Store },
  { title: 'Contabilidad', body: 'Plan de cuentas, asientos, balances y trazabilidad completa.', icon: Calculator },
  { title: 'Reportes', body: 'Dashboard ejecutivo con métricas en tiempo real para tomar decisiones.', icon: BarChart3 },
  { title: 'Personas', body: 'Usuarios, roles, permisos, sucursales y control de acceso.', icon: Users },
  { title: 'Soporte', body: 'Tickets, evidencias, base de conocimiento y seguimiento.', icon: Headphones },
];

const INDUSTRIES = [
  { title: 'Comercio y retail', body: 'Productos, cajas, compras, promociones e inventario por sucursal.' },
  { title: 'Restaurantes y POS', body: 'Mesas, comandas, cocina, menú digital y pedidos por QR.' },
  { title: 'Distribución', body: 'Bodegas, rutas, precios, crédito y control de entregas.' },
  { title: 'Servicios profesionales', body: 'Clientes, proyectos, horas, tareas y facturación.' },
  { title: 'Empresas multisucursal', body: 'Grupos, rubros, permisos y operación consolidada.' },
  { title: 'Empresas en crecimiento', body: 'Procesos ordenados sin cambiar de sistema cada año.' },
];

const PROCESS_STEPS = [
  { kicker: 'Captura', title: 'Una venta deja de ser un dato aislado.', body: 'Cotizas, vendes o facturas una vez. El cliente, el producto y el responsable quedan registrados con contexto.' },
  { kicker: 'Movimiento', title: 'Inventario y caja siguen el movimiento.', body: 'Existencias, pagos, créditos y cierres se actualizan alrededor del documento, no en hojas separadas.' },
  { kicker: 'Control', title: 'Cada persona ve lo que necesita hacer.', body: 'Roles, permisos, sucursales y trazabilidad convierten la operación diaria en un proceso controlable.' },
  { kicker: 'Decisión', title: 'La gerencia deja de adivinar.', body: 'Reportes, contabilidad y métricas muestran qué se vendió, qué falta, qué se cobró y dónde está el margen.' },
];

const PRICES = [
  {
    title: 'Base',
    value: 600,
    period: '/año',
    note: '10 módulos incluidos con 5 usuarios',
    features: ['Inventario', 'Ventas', 'Compras', 'Caja', 'Finanzas', 'Reportes', 'Actividades', 'Herramientas', 'Tickets', 'Conocimiento'],
    featured: false,
    cta: 'Empezar ahora',
  },
  {
    title: 'Contabilidad',
    value: 100,
    period: '/mes',
    note: 'Contabilidad completa para tu empresa',
    features: ['Plan de cuentas', 'Asientos contables', 'Balance general', 'Estado de resultados', 'Conciliación bancaria', 'Reportes fiscales', 'IVA / IR automático', 'Cuentas por pagar/cobrar'],
    featured: true,
    cta: 'Lo quiero',
  },
  {
    title: 'RRHH',
    value: 85,
    period: '/mes',
    note: 'Gestión completa de Recursos Humanos',
    features: ['Nómina Nicaragua (INSS/IR)', 'Control de asistencia', 'Vacaciones y permisos', 'Evaluaciones de desempeño', 'Capacitaciones', 'KPIs y métricas', 'Dashboard RRHH', 'Empleados y departamentos'],
    featured: false,
    cta: 'Agregar a mi plan',
  },
];

function formatPrice(value: number, currency: 'USD' | 'NIO') {
  return currency === 'NIO' ? `C$${(value * EXCHANGE_RATE).toLocaleString('es-NI')}` : `$${value.toLocaleString('en-US')}`;
}

function planWhatsAppHref(title: string) {
  const message = encodeURIComponent(`Hola, me interesa el plan ${title} de NovaHub ERP`);
  return `https://wa.me/50588241003?text=${message}`;
}

/* ──────────── REUSABLE ──────────── */

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-[#22c55e]">
      <span className="h-px w-8 bg-[#22c55e]" />
      {children}
    </p>
  );
}

function Headline({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`text-4xl font-black leading-[1.02] tracking-[-0.04em] text-[#174a3a] sm:text-5xl lg:text-6xl ${className}`}>
      {children}
    </h2>
  );
}

function CTA({ href, children, className = '', onClick, variant = 'solid' }: { href?: string; children: ReactNode; className?: string; onClick?: () => void; variant?: 'solid' | 'soft' }) {
  const styles = variant === 'solid'
    ? 'bg-[#22c55e] text-white shadow-[0_18px_45px_-16px_rgba(34,197,94,.5)] hover:bg-[#16a34a] hover:shadow-[0_24px_50px_-16px_rgba(34,197,94,.6)]'
    : 'bg-white text-[#174a3a] border border-[#d8e3df] shadow-sm hover:bg-[#f0fdf4] hover:border-[#22c55e]';
  const cls = `inline-flex -skew-x-6 items-center justify-center gap-2.5 rounded-[14px] px-8 py-4 text-sm font-bold uppercase tracking-[0.12em] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] ${styles} ${className}`;
  const inner = <span className="inline-flex skew-x-6 items-center gap-2.5">{children}</span>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  return <a href={href} className={cls}>{inner}</a>;
}

/* ──────────── HEADER ──────────── */

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || menuOpen
          ? 'border-b border-[#e0ebe4]/80 bg-white/95 shadow-[0_8px_40px_-20px_rgba(23,74,58,.08)] backdrop-blur-2xl'
          : 'bg-white/80 backdrop-blur-xl'
      }`}
    >
      <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <a href="/landing" className="flex items-center gap-2.5">
          <NovaHubLogo size={34} />
          <span className="flex flex-col leading-none">
            <span className="text-[17px] font-black tracking-[-0.04em] text-[#174a3a]">Nova<span className="text-[#22c55e]">Hub</span></span>
            <span className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.22em] text-[#84a1ad]">ERP Platform</span>
          </span>
        </a>

        <div className="flex items-center gap-3">
          <a href="/login" className="hidden text-sm font-bold text-[#5d7884] transition-colors hover:text-[#174a3a] sm:block">
            Iniciar sesión
          </a>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            className="relative z-50 grid size-11 place-items-center rounded-xl border border-[#e0ebe4] bg-white text-[#174a3a] shadow-sm transition-colors hover:border-[#22c55e]"
          >
            <motion.span animate={menuOpen ? { rotate: 90, opacity: 0 } : { rotate: 0, opacity: 1 }} transition={{ duration: 0.2 }} className="absolute">
              <Menu className="size-5" />
            </motion.span>
            <motion.span animate={menuOpen ? { rotate: 0, opacity: 1 } : { rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }} className="absolute">
              <X className="size-5" />
            </motion.span>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease }}
            className="overflow-hidden border-t border-[#e0ebe4]/60 bg-white/98 backdrop-blur-2xl"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-6 sm:px-8">
              {NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href} onClick={closeMenu} className="rounded-xl px-4 py-4 text-base font-bold text-[#5d7884] transition-colors hover:bg-[#e5f5eb] hover:text-[#22c55e]">
                  {link.label}
                </a>
              ))}
              <div className="mt-4 flex flex-col gap-3 border-t border-[#e0ebe4]/60 pt-4">
                <a href="/login" onClick={closeMenu} className="rounded-xl px-4 py-3.5 text-center text-sm font-bold text-[#5d7884]">
                  Iniciar sesión
                </a>
                <CTA href="https://wa.me/50588241003?text=Hola%2C%20quiero%20agendar%20una%20llamada%20para%20conocer%20NovaHub%20ERP" className="w-full text-center">
                  Agendar llamada
                </CTA>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ──────────── HERO ──────────── */

function HeroSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const blobY = useTransform(scrollYProgress, [0, 1], [0, 60]);

  return (
    <section ref={ref} className="relative isolate overflow-hidden bg-white px-5 pt-36 sm:px-8 lg:px-10 lg:pt-44">
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(23,74,58,1) 1px, transparent 1px), linear-gradient(90deg, rgba(23,74,58,1) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
      <motion.div style={{ y: blobY }} className="pointer-events-none absolute left-[-10%] top-[-10%] size-[40rem] rounded-full bg-[#22c55e]/10 blur-[140px]" />

      <div className="relative mx-auto max-w-7xl pb-12 lg:pb-16">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <Kicker>Sistema de gestión empresarial</Kicker>
            <h1 className="text-[2.5rem] font-black leading-[0.96] tracking-[-0.05em] text-[#174a3a] sm:text-6xl lg:text-[5.5rem]">
              Un solo sistema para manejar{' '}
              <span className="text-[#22c55e]">tu negocio completo.</span>
            </h1>
            <p className="mx-auto mt-8 max-w-xl text-lg leading-7 text-[#5d7884]">
              Ventas, inventario, caja y contabilidad en el mismo lugar. Sin hojas de cálculo, sin coordinar por WhatsApp, sin perder datos.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <CTA href="https://wa.me/50588241003?text=Hola%2C%20quiero%20agendar%20una%20llamada%20para%20conocer%20NovaHub%20ERP">
                Agendar llamada <ArrowRight className="size-4" />
              </CTA>
              <CTA href="#precios" variant="soft">
                Ver precios
              </CTA>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-bold text-[#84a1ad]">
              <span className="flex items-center gap-2"><Check className="size-4 text-[#22c55e]" /> Sin tarjeta de crédito</span>
              <span className="flex items-center gap-2"><Check className="size-4 text-[#22c55e]" /> Soporte en español</span>
              <span className="flex items-center gap-2"><Check className="size-4 text-[#22c55e]" /> Desde $600/año</span>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.15} className="mt-16">
          <ProductWindow />
        </Reveal>
      </div>
      <WaveHero />
    </section>
  );
}

function ProductWindow() {
  return (
    <div className="relative mx-auto w-full max-w-[960px]">
      <div className="absolute -inset-8 rounded-[3rem] bg-[#22c55e]/8 blur-[80px]" />
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.2, ease }}
        className="relative overflow-hidden rounded-[18px] border border-[#e0ebe4] bg-[#f8faf9] p-2 shadow-[0_40px_90px_-30px_rgba(34,197,94,.2)] sm:p-3"
      >
        <div className="flex items-center justify-between rounded-t-[13px] bg-white px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#f59e9e]" />
            <span className="size-2.5 rounded-full bg-[#f4c95d]" />
            <span className="size-2.5 rounded-full bg-[#4acb8d]" />
          </div>
          <div className="rounded-full bg-[#f0fdf4] px-3 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#5d7884]">
            Sistema en funcionamiento
          </div>
        </div>
        <div className="relative overflow-hidden rounded-b-[13px] bg-white">
          <img src={facturacionCajaDemo} alt="NovaHub ERP — Sistema de facturación e inventario" className="block h-auto w-full" loading="eager" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#22c55e]/5 via-transparent to-white/10" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, delay: 0.9, ease }}
        className="absolute -bottom-5 -left-3 hidden rounded-2xl border border-[#d8e3df] bg-white px-5 py-3.5 shadow-xl sm:block"
      >
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#84a1ad]">Conectado</p>
        <p className="mt-1 text-sm font-bold text-[#174a3a]">Venta → caja → contabilidad</p>
      </motion.div>
    </div>
  );
}

/* ──────────── SCROLLING BANNER ──────────── */

function ScrollingBanner() {
  const items = ['Ventas', 'Inventario', 'Caja', 'Contabilidad', 'Restaurant POS', 'Reportes', 'Compras', 'Personas'];
  return (
    <div className="relative overflow-hidden border-t border-[#d1fae5] bg-[#f0fdf4] pt-5">
      <motion.div className="flex w-max whitespace-nowrap" animate={{ x: ['0%', '-50%'] }} transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}>
        {[0, 1].map((copy) => (
          <div key={copy} className="flex items-center" aria-hidden={copy === 1}>
            {items.map((item) => (
              <span key={item} className="flex items-center text-xs font-bold uppercase tracking-[0.18em] text-[#5d7884]">
                <span className="mx-7">{item}</span>
                <span className="text-[#22c55e]">✦</span>
              </span>
            ))}
            <span className="flex items-center text-xs font-black uppercase tracking-[0.18em] text-[#22c55e]">
              <span className="mx-7">NovaHub ERP</span>
              <span>✦</span>
            </span>
          </div>
        ))}
      </motion.div>
      <WaveBanner />
    </div>
  );
}

/* ──────────── WAVE DIVIDERS — dos capas, sin franja posterior ──────────── */

type WaveDestination = '#f0fdf4' | '#ffffff' | '#174a3a';
type WaveShape = 'hero' | 'banner' | 'process' | 'standard';

const WAVE_SHAPES: Record<WaveShape, { green: string; destination: string }> = {
  hero: {
    green: 'M0 42 C150 4 300 26 450 54 C610 84 760 12 920 38 C1080 64 1240 62 1440 20 L1440 140 L0 140 Z',
    destination: 'M0 96 C150 58 300 80 450 108 C610 136 760 66 920 92 C1080 118 1240 116 1440 74 L1440 140 L0 140 Z',
  },
  banner: {
    green: 'M0 34 C180 82 360 6 540 48 C720 90 900 18 1080 58 C1240 94 1360 24 1440 42 L1440 140 L0 140 Z',
    destination: 'M0 94 C180 132 360 56 540 98 C720 136 900 68 1080 108 C1240 140 1360 74 1440 92 L1440 140 L0 140 Z',
  },
  process: {
    green: 'M0 30 C120 74 240 4 360 38 C480 72 600 8 720 42 C840 76 960 10 1080 44 C1200 78 1320 12 1440 40 L1440 140 L0 140 Z',
    destination: 'M0 92 C120 128 240 58 360 96 C480 130 600 66 720 100 C840 134 960 68 1080 102 C1200 136 1320 70 1440 98 L1440 140 L0 140 Z',
  },
  standard: {
    green: 'M0 38 C160 0 320 28 480 54 C640 80 800 16 960 42 C1120 68 1280 64 1440 24 L1440 140 L0 140 Z',
    destination: 'M0 96 C160 60 320 88 480 112 C640 136 800 72 960 98 C1120 124 1280 120 1440 82 L1440 140 L0 140 Z',
  },
};

function WaveDivider({ destination, shape = 'standard', bleed = false }: { destination: WaveDestination; shape?: WaveShape; bleed?: boolean }) {
  const paths = WAVE_SHAPES[shape];
  return (
    <div className={`relative -mt-px h-20 overflow-hidden leading-none sm:h-32 ${bleed ? '-mx-5 sm:-mx-8 lg:-mx-10' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 1440 140" preserveAspectRatio="none" className="block h-full w-full">
        <path d={paths.green} fill="#22c55e" />
        <path d={paths.destination} fill={destination} />
      </svg>
    </div>
  );
}

function WaveHero() { return <WaveDivider destination="#f0fdf4" shape="hero" bleed />; }
function WaveBanner() { return <WaveDivider destination="#ffffff" shape="banner" />; }
function WaveProduct() { return <WaveDivider destination="#f0fdf4" bleed />; }
function WaveProcess() { return <WaveDivider destination="#ffffff" shape="process" bleed />; }
function WaveModules() { return <WaveDivider destination="#f0fdf4" bleed />; }
function WaveIndustries() { return <WaveDivider destination="#ffffff" shape="banner" bleed />; }
function WavePricing() { return <WaveDivider destination="#f0fdf4" shape="process" bleed />; }
function WaveTrust() { return <WaveDivider destination="#174a3a" shape="hero" bleed />; }

/* ──────────── PRODUCTO ──────────── */

function ProductSection() {
  return (
    <section id="producto" className="relative overflow-hidden bg-white px-5 pt-24 sm:px-8 lg:px-10 lg:pt-32">
      <div className="relative mx-auto max-w-7xl pb-12 lg:pb-16">
        <div className="grid gap-14 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <Reveal>
            <Kicker>La diferencia está en el flujo</Kicker>
            <Headline className="mt-4 max-w-lg">
              Todo conectado desde la primera venta.
            </Headline>
            <p className="mt-6 max-w-md text-lg leading-7 text-[#5d7884]">
              La operación que ves arriba es la que tu equipo usaría: con sus documentos, sus responsables, sus sucursales y sus números.
            </p>
            <a href="#proceso" className="mt-8 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-[#174a3a] underline decoration-[#22c55e] decoration-2 underline-offset-8 transition-colors hover:text-[#22c55e]">
              Ver el recorrido <ArrowRight className="size-4" />
            </a>
          </Reveal>

          <div className="space-y-0">
            {[
              { title: 'Una sola captura', body: 'La información entra una vez y se conserva desde la cotización hasta el cobro.' },
              { title: 'Una lectura compartida', body: 'Ventas, inventario, caja y contabilidad trabajan con el mismo contexto.' },
              { title: 'Un control por responsabilidad', body: 'Cada usuario tiene acceso por rol, módulo, empresa, rubro y sucursal.' },
              { title: 'Una decisión más rápida', body: 'La dirección deja de perseguir datos y empieza a leer la operación.' },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 0.06}>
                <div className="group border-t border-[#e0ebe4] py-6 transition-colors hover:border-[#22c55e]">
                  <h3 className="text-lg font-bold text-[#174a3a]">{item.title}</h3>
                  <p className="mt-2 max-w-sm text-base leading-6 text-[#5d7884]">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
      <WaveProduct />
    </section>
  );
}

/* ──────────── CÓMO FUNCIONA ──────────── */

function ProcessSection() {
  return (
    <section id="proceso" className="relative overflow-hidden bg-[#f0fdf4] px-5 pt-24 text-[#174a3a] sm:px-8 lg:px-10 lg:pt-32">
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(34,197,94,1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      <div className="relative mx-auto grid max-w-7xl gap-14 pb-12 lg:grid-cols-[0.45fr_1.55fr] lg:pb-16">
        <div className="lg:sticky lg:top-32 lg:h-fit">
          <Reveal>
            <Kicker>El recorrido completo</Kicker>
            <Headline className="mt-4 max-w-sm">
              Cada venta alimenta tu inventario, caja y contabilidad.
            </Headline>
            <p className="mt-6 max-w-sm text-lg leading-7 text-[#5d7884]">
              Así funciona un sistema cuando todo está conectado.
            </p>
            <div className="mt-10 flex items-center gap-3 text-sm font-bold uppercase tracking-[0.14em] text-[#84a1ad]">
              <span className="h-px w-9 bg-[#22c55e]" /> Desliza para avanzar
            </div>
          </Reveal>
        </div>

        <div className="relative space-y-10 sm:space-y-14">
          <div className="absolute bottom-8 left-4 top-8 w-px bg-gradient-to-b from-transparent via-[#22c55e]/30 to-transparent sm:left-9" />

          {PROCESS_STEPS.map((step, index) => (
            <Reveal key={step.kicker} delay={index * 0.06}>
              <article className={`relative max-w-2xl border border-[#d1fae5] bg-white p-6 shadow-[0_24px_60px_-45px_rgba(34,197,94,.15)] sm:p-9 ${index % 2 ? 'ml-4 sm:ml-16' : 'mr-4 sm:mr-16'}`}>
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#22c55e]">{step.kicker}</p>
                <h3 className="mt-4 max-w-2xl text-2xl font-black leading-[1.05] tracking-[-0.03em] text-[#174a3a] sm:text-4xl">{step.title}</h3>
                <p className="mt-4 max-w-xl text-base leading-7 text-[#5d7884]">{step.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
      <WaveProcess />
    </section>
  );
}

/* ──────────── MÓDULOS ──────────── */

function ModulesSection() {
  return (
    <section className="bg-white px-5 pt-24 sm:px-8 lg:px-10 lg:pt-32">
      <div className="mx-auto max-w-7xl pb-12 lg:pb-16">
        <Reveal>
          <div className="flex flex-col justify-between gap-6 border-b border-[#e0ebe4] pb-8 sm:flex-row sm:items-end">
            <div>
              <Kicker>Módulos que trabajan juntos</Kicker>
              <Headline className="mt-2">
                Todo conectado.<br className="hidden sm:block" /> Sin trabajo duplicado.
              </Headline>
            </div>
            <p className="max-w-xs text-base leading-6 text-[#5d7884]">
              Activa lo que necesitas hoy. Mañana creces sin cambiar de sistema.
            </p>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-px overflow-hidden border border-[#e0ebe4] bg-[#e0ebe4] sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((mod, index) => {
            const Icon = mod.icon;
            return (
              <Reveal key={mod.title} delay={index * 0.04} className="bg-white">
                <div className="group h-full p-6 transition-colors hover:bg-[#f0fdf4]">
                  <Icon className="size-5 text-[#22c55e]" />
                  <h3 className="mt-8 text-lg font-bold text-[#174a3a]">{mod.title}</h3>
                  <p className="mt-3 text-base leading-6 text-[#5d7884]">{mod.body}</p>
                  <div className="mt-6 h-1 w-7 bg-[#22c55e]/25 transition-all group-hover:w-14 group-hover:bg-[#22c55e]" />
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
      <WaveModules />
    </section>
  );
}

/* ──────────── INDUSTRIAS ──────────── */

function IndustriesSection() {
  return (
    <section id="giros" className="bg-[#f0fdf4] px-5 pt-24 sm:px-8 lg:px-10 lg:pt-32">
      <div className="mx-auto grid max-w-7xl gap-14 pb-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:pb-16">
        <Reveal>
          <Kicker>Funciona para tu tipo de negocio</Kicker>
          <Headline className="mt-4 max-w-md">
            No importa cómo vendes. Importa que puedas controlarlo.
          </Headline>
          <p className="mt-6 max-w-md text-lg leading-7 text-[#5d7884]">
            Desde una tienda hasta un grupo empresarial con varias sucursales, NovaHub ordena la operación alrededor de tus procesos.
          </p>
        </Reveal>

        <div className="grid gap-3 sm:grid-cols-2">
          {INDUSTRIES.map((industry, index) => (
            <Reveal key={industry.title} delay={index * 0.04}>
              <div className="group relative min-h-[160px] overflow-hidden border border-[#d1fae5] bg-white p-6 shadow-[0_20px_50px_-40px_rgba(34,197,94,.12)]">
                <div className="pointer-events-none absolute -right-8 -top-8 size-24 rotate-12 border-8 border-[#d1fae5]/50" />
                <h3 className="text-lg font-bold text-[#174a3a]">{industry.title}</h3>
                <p className="mt-2 max-w-xs text-base leading-6 text-[#5d7884]">{industry.body}</p>
                <div className="absolute bottom-0 left-0 h-1 w-0 bg-[#22c55e] transition-all duration-300 group-hover:w-full" />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
      <WaveIndustries />
    </section>
  );
}

/* ──────────── PRECIOS ──────────── */

function PricingSection({ currency, setCurrency }: { currency: 'USD' | 'NIO'; setCurrency: (c: 'USD' | 'NIO') => void }) {
  return (
    <section id="precios" className="relative overflow-hidden bg-white px-5 pt-24 text-[#174a3a] sm:px-8 lg:px-10 lg:pt-32">
      <div className="relative mx-auto max-w-7xl pb-12 lg:pb-16">
        <div className="flex flex-col justify-between gap-8 border-b border-[#e0ebe4] pb-8 sm:flex-row sm:items-end">
          <Reveal>
            <Kicker>Planes claros. Sin sorpresas.</Kicker>
            <Headline className="mt-2">
              Empieza con lo esencial.<br className="hidden sm:block" /> Crece con la operación.
            </Headline>
          </Reveal>

          <div className="flex items-center gap-2 self-start rounded-xl border border-[#e0ebe4] bg-[#f0fdf4] p-1">
            <button type="button" onClick={() => setCurrency('USD')} className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] transition-all ${currency === 'USD' ? 'bg-[#22c55e] text-white shadow-md' : 'text-[#6a8490]'}`}>
              USD
            </button>
            <button type="button" onClick={() => setCurrency('NIO')} className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] transition-all ${currency === 'NIO' ? 'bg-[#22c55e] text-white shadow-md' : 'text-[#6a8490]'}`}>
              NIO
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {PRICES.map((plan, index) => (
            <Reveal key={plan.title} delay={index * 0.07}>
              <article className={`relative h-full border p-6 sm:p-8 ${plan.featured ? 'border-[#22c55e] bg-[#f0fdf4]' : 'border-[#e0ebe4] bg-white'}`}>
                {plan.featured && (
                  <span className="absolute right-5 top-5 rounded-full bg-[#22c55e] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-md">
                    Popular
                  </span>
                )}
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#22c55e]">{plan.title}</p>
                <p className="mt-3 text-base text-[#5d7884]">{plan.note}</p>
                <div className="mt-8 flex items-end gap-2">
                  <span className="text-5xl font-black tracking-[-0.05em] text-[#174a3a]">{formatPrice(plan.value, currency)}</span>
                  <span className="mb-1.5 text-base text-[#5d7884]">{plan.period}</span>
                </div>
                <ul className="mt-8 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-base text-[#5d7884]">
                      <Check className="mt-0.5 size-4 shrink-0 text-[#22c55e]" /> {f}
                    </li>
                  ))}
                </ul>
                <CTA href={planWhatsAppHref(plan.title)} variant={plan.featured ? 'solid' : 'soft'} className="mt-8 w-full text-center">
                  {plan.cta}
                </CTA>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
      <WavePricing />
    </section>
  );
}

/* ──────────── CONFIANZA ──────────── */

function TrustSection() {
  const items = [
    { icon: ShieldCheck, title: 'Control de acceso', body: 'Cada usuario ve solo lo que le corresponde por rol, módulo y sucursal.' },
    { icon: LockKeyhole, title: 'Sesiones seguras', body: 'Autenticación y autorización protegidas en cada petición.' },
    { icon: CircleDollarSign, title: 'Trazabilidad', body: 'Cada movimiento financiero se conecta con documentos, responsables y fechas.' },
    { icon: Zap, title: 'Monitoreo activo', body: 'Registros y alertas para detectar problemas antes de que crezcan.' },
  ];

  return (
    <section id="confianza" className="bg-[#f0fdf4] px-5 pt-24 sm:px-8 lg:px-10 lg:pt-32">
      <div className="mx-auto max-w-7xl pb-12 lg:pb-16">
        <div className="grid gap-14 lg:grid-cols-[0.74fr_1.26fr]">
          <Reveal>
            <Kicker>Control total sobre quién ve qué</Kicker>
            <Headline className="mt-4 max-w-md">
              La seguridad se refleja en cada detalle.
            </Headline>
            <p className="mt-6 max-w-md text-lg leading-7 text-[#5d7884]">
              Cómo acceden los usuarios, cómo se separan las empresas y cómo se registra cada acción.
            </p>
          </Reveal>

          <div className="grid gap-px border border-[#d1fae5] bg-[#d1fae5] sm:grid-cols-2">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="bg-[#f0fdf4] p-6 sm:p-8">
                  <Icon className="size-6 text-[#22c55e]" />
                  <h3 className="mt-6 text-lg font-bold text-[#174a3a]">{item.title}</h3>
                  <p className="mt-3 text-base leading-6 text-[#5d7884]">{item.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <WaveTrust />
    </section>
  );
}

/* ──────────── CTA FINAL ──────────── */

function CTASection({ onDownloadContract }: { onDownloadContract: () => void }) {
  return (
    <section id="contacto" className="relative overflow-hidden bg-[#174a3a] px-5 pt-24 pb-12 sm:px-8 lg:px-10 lg:pt-32 lg:pb-16">
      <div className="pointer-events-none absolute -right-32 top-0 size-[30rem] rounded-full bg-[#22c55e]/10 blur-[120px]" />

      <div className="relative mx-auto flex max-w-7xl flex-col justify-between gap-10 lg:flex-row lg:items-end">
        <Reveal>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#22c55e]">No esperes más</p>
          <h2 className="mt-4 max-w-3xl text-4xl font-black leading-[0.96] tracking-[-0.05em] text-white sm:text-6xl">
            Tu negocio merece un sistema que funcione.
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-7 text-white/60">
            Agenda una demo y te mostramos cómo NovaHub ordena tu operación en minutos.
          </p>
        </Reveal>

        <div className="flex flex-col gap-4 sm:flex-row lg:flex-col">
          <CTA href="https://wa.me/50588241003?text=Hola%2C%20quiero%20agendar%20una%20llamada%20para%20conocer%20NovaHub%20ERP">
            Agendar llamada ahora <ArrowRight className="size-4" />
          </CTA>
          <button type="button" onClick={onDownloadContract} className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-white/50 transition-colors hover:text-white">
            <FileText className="size-4" /> Descargar contrato modelo
          </button>
        </div>
      </div>
    </section>
  );
}

/* ──────────── FOOTER ──────────── */

function Footer() {
  return (
    <footer className="bg-[#0d1f1a] px-5 pt-16 pb-10 text-white sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr_1fr]">
          {/* Marca */}
          <div>
            <div className="flex items-center gap-2.5">
              <NovaHubLogo size={30} />
              <span className="flex flex-col leading-none">
                <span className="text-[16px] font-black tracking-[-0.04em] text-white">Nova<span className="text-[#22c55e]">Hub</span></span>
                <span className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.22em] text-white/40">ERP Platform</span>
              </span>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-5 text-white/50">
              Una forma más clara de vender, controlar y hacer crecer tu empresa.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold uppercase tracking-[0.1em] text-white/40">
              <a href="/login" className="transition-colors hover:text-[#22c55e]">Iniciar sesión</a>
              <a href="/register" className="transition-colors hover:text-[#22c55e]">Crear cuenta</a>
              <a href="#precios" className="transition-colors hover:text-[#22c55e]">Precios</a>
              <a href="#contacto" className="transition-colors hover:text-[#22c55e]">Contacto</a>
            </div>
          </div>

          {/* Seguridad y datos */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-[#22c55e]">Seguridad y datos</h4>
            <ul className="mt-5 space-y-3 text-sm leading-5 text-white/50">
              <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#22c55e]/60" /> Control de acceso por rol, módulo y sucursal. Cada usuario ve solo lo que le corresponde.</li>
              <li className="flex items-start gap-2"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-[#22c55e]/60" /> Autenticación y autorización protegidas en cada petición. Sesiones seguras con expiración.</li>
              <li className="flex items-start gap-2"><CircleDollarSign className="mt-0.5 size-4 shrink-0 text-[#22c55e]/60" /> Trazabilidad completa: cada movimiento financiero se conecta con documentos, responsables y fechas.</li>
              <li className="flex items-start gap-2"><Zap className="mt-0.5 size-4 shrink-0 text-[#22c55e]/60" /> Copias de seguridad automáticas diarias. Monitoreo activo con alertas para detectar problemas.</li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-[#22c55e]">Legal</h4>
            <ul className="mt-5 space-y-3 text-sm leading-5 text-white/50">
              <li><a href="#privacidad" className="transition-colors hover:text-[#22c55e]">Política de Privacidad</a></li>
              <li><a href="#terminos" className="transition-colors hover:text-[#22c55e]">Términos y Condiciones</a></li>
              <li><a href="#datos" className="transition-colors hover:text-[#22c55e]">Tratamiento de Datos</a></li>
              <li><a href="#backups" className="transition-colors hover:text-[#22c55e]">Copias de Seguridad</a></li>
            </ul>
            <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs leading-5 text-white/40">
                Tus datos son tuyos. NovaHub no comparte información con terceros. Puedes exportar o eliminar tu información en cualquier momento.
              </p>
            </div>
          </div>
        </div>

        {/* Línea inferior */}
        <div className="mt-12 flex flex-col justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-white/30">© {new Date().getFullYear()} NovaHub ERP. Todos los derechos reservados.</p>
          <div className="flex gap-6 text-xs text-white/30">
            <a href="#privacidad" className="transition-colors hover:text-[#22c55e]">Privacidad</a>
            <a href="#terminos" className="transition-colors hover:text-[#22c55e]">Términos</a>
            <a href="#datos" className="transition-colors hover:text-[#22c55e]">Datos</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ──────────── MOBILE STICKY CTA ──────────── */

function MobileStickyCTA() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3, ease }}
          className="fixed bottom-0 inset-x-0 z-30 border-t border-[#d1fae5] bg-white/95 px-5 py-3 shadow-[0_-10px_40px_-15px_rgba(34,197,94,.15)] backdrop-blur-xl lg:hidden"
        >
          <CTA href="https://wa.me/50588241003?text=Hola%2C%20quiero%20agendar%20una%20llamada%20para%20conocer%20NovaHub%20ERP" className="w-full text-center">
            Agendar llamada
          </CTA>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ──────────── CONTRACT PDF ──────────── */

function downloadContract() {
  void import('jspdf').then(({ jsPDF }) => {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const margin = 22;
    let y = 48;
    const green = [34, 197, 94] as const;
    const forest = [23, 74, 58] as const;
    const body = [71, 92, 99] as const;
    const footer = () => { doc.setDrawColor(...green); doc.line(margin, height - 17, width - margin, height - 17); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(120, 135, 137); doc.text('NovaHub ERP · Modelo comercial sujeto a revisión y firma de las partes.', width / 2, height - 11, { align: 'center' }); };
    const header = () => { doc.setFillColor(23, 74, 58); doc.rect(0, 0, width, 34, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(255, 255, 255); doc.text('NOVAHUB', margin, 22); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(190, 225, 205); doc.text('ERP PLATFORM · MODELO SAAS', margin + 48, 22); doc.setFillColor(...green); doc.rect(0, 34, width, 1.5, 'F'); };
    const nextPage = () => { footer(); doc.addPage(); header(); y = 51; };
    const ensure = (space: number) => { if (y + space > height - 26) nextPage(); };
    const heading = (text: string) => { ensure(16); doc.setFillColor(231, 245, 235); doc.roundedRect(margin, y - 5, width - margin * 2, 9, 1.5, 1.5, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...forest); doc.text(text.toUpperCase(), margin + 4, y + 1); y += 13; };
    const paragraph = (text: string) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...body); const lines = doc.splitTextToSize(text, width - margin * 2); ensure(lines.length * 4.5 + 6); lines.forEach((line: string) => { doc.text(line, margin, y); y += 4.5; }); y += 4; };
    header(); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...forest); doc.text('CONTRATO DE LICENCIA DE USO DE SOFTWARE', width / 2, y, { align: 'center' }); y += 8; doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...body); doc.text('Modelo Software como Servicio (SaaS)', width / 2, y, { align: 'center' }); y += 14;
    heading('I. Partes contratantes'); paragraph('EL PROVEEDOR: NovaHub, empresa de tecnología y software. EL CLIENTE: la persona natural o jurídica que suscribe el documento.');
    ['Razón social / nombre', 'RUC / cédula', 'Representante legal', 'Correo electrónico', 'Dirección', 'Teléfono'].forEach((label) => { ensure(9); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...body); doc.text(`${label}:`, margin, y); doc.line(margin + 42, y + 0.5, width - margin, y + 0.5); y += 8; });
    heading('II. Objeto y licencia'); paragraph('EL PROVEEDOR otorga a EL CLIENTE una licencia de uso no exclusiva, intransferible y limitada del NovaHub ERP para sus operaciones internas, conforme al plan, módulos y usuarios contratados.');
    heading('III. Precio y forma de pago'); paragraph('Los precios de referencia se detallan en la cotización vigente. La propuesta final, impuestos, implementación, equipos, alcance y forma de pago serán confirmados por escrito antes de la activación.');
    [['Plan base', 'USD 600 / año'], ['Contabilidad', 'USD 100 / mes'], ['Recursos humanos', 'USD 85 / mes'], ['Usuario adicional', 'USD 5 / mes'], ['Implementación', 'USD 200 / pago único'], ['Dominio, hosting y 5 correos', 'USD 100 / año']].forEach(([label, value]) => { ensure(7); doc.setFontSize(8.5); doc.text(`• ${label}`, margin + 4, y); doc.setFont('helvetica', 'bold'); doc.text(value, width - margin, y, { align: 'right' }); doc.setFont('helvetica', 'normal'); y += 5.5; }); y += 4;
    heading('IV. Seguridad, confidencialidad y datos'); paragraph('Las partes tratarán como confidencial la información a la que tengan acceso. NovaHub aplicará controles de autenticación, autorización, separación por empresa y medidas técnicas razonables para proteger la información.');
    heading('V. Implementación y soporte'); paragraph('La implementación puede incluir configuración inicial, carga de catálogos, permisos, capacitación y acompañamiento. El soporte cubre incidencias técnicas y consultas de uso según el horario y nivel contratado.');
    heading('VI. Vigencia y aceptación'); paragraph('La vigencia, renovación, terminación y exportación de información se determinarán en la propuesta aceptada. Este archivo es un modelo comercial descargable y no sustituye asesoría legal.');
    ensure(32); y += 10; doc.line(margin, y, margin + 70, y); doc.line(width - margin - 70, y, width - margin, y); y += 5; doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('EL PROVEEDOR', margin + 35, y, { align: 'center' }); doc.text('EL CLIENTE', width - margin - 35, y, { align: 'center' }); footer(); doc.save('Contrato_Licencia_NovaHub_ERP.pdf');
  });
}

/* ──────────── MAIN ──────────── */

export default function LandingPage() {
  const [currency, setCurrency] = useState<'USD' | 'NIO'>('USD');

  return (
    <div id="novahub-landing" className="min-h-screen overflow-x-hidden bg-white text-[#174a3a] antialiased selection:bg-[#22c55e]/20 selection:text-[#174a3a]">
      <Header />

      <main>
        <HeroSection />
        <ScrollingBanner />
        <ProductSection />
        <ProcessSection />
        <ModulesSection />
        <IndustriesSection />
        <PricingSection currency={currency} setCurrency={setCurrency} />
        <TrustSection />
        <CTASection onDownloadContract={downloadContract} />
      </main>

      <Footer />
      <MobileStickyCTA />
      <LandingChatModal />
    </div>
  );
}
