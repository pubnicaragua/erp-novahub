import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  ClipboardCheck,
  CircleDollarSign,
  FileText,
  Headphones,
  Layers3,
  Menu,
  Package,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
  X,
} from 'lucide-react';
import { LANDING_MODULES, MODULE_CATEGORIES, type ModuleCategory } from './landingModules';
import facturacionCajaDemo from '../../assets/landing/facturacion-caja-demo.png';
import { LandingChatModal } from './LandingChatModal';
import { NovaHubLogo } from './NovaHubLogo';
import { buildDownloadFileName } from '../utils/exportFileNames';
import novahubLogotipo from '../../assets/branding/novahub-logotipo-transparent.png';
import '../../styles/landing.css';

const WHATSAPP_URL = 'https://wa.me/50588241003?text=Hola%2C%20quiero%20conocer%20NovaHub%20ERP';
const EXCHANGE_RATE = 36.5;
const ease = [0.22, 1, 0.36, 1] as const;

const NAV_LINKS = [
  { label: 'Producto', href: '#producto' },
  { label: 'Módulos', href: '#catalogo-modulos' },
  { label: 'Giros', href: '#giros' },
  { label: 'Cómo funciona', href: '#flujo' },
] as const;

const MODULES = [
  { title: 'Ventas', body: 'Cotiza, factura y cobra con el contexto completo del cliente.', icon: Receipt, tone: 'cyan' },
  { title: 'Inventario', body: 'Existencias, costos, bodegas y transferencias siempre visibles.', icon: Package, tone: 'green' },
  { title: 'Caja y POS', body: 'Una caja ordenada, con cierres y responsables trazables.', icon: Store, tone: 'amber' },
  { title: 'Compras', body: 'Proveedores, recepción y margen conectados a la operación.', icon: ShoppingCart, tone: 'violet' },
  { title: 'Contabilidad', body: 'Del movimiento diario a los estados financieros sin duplicar trabajo.', icon: CircleDollarSign, tone: 'blue' },
  { title: 'Reportes', body: 'La lectura ejecutiva para decidir con datos, no con intuición.', icon: BarChart3, tone: 'rose' },
];

const INDUSTRIES = [
  { id: 'retail', label: 'Retail y tiendas', icon: Store, title: 'Vende más. Busca menos.', body: 'Catálogos, tallas, colores, cajas, promociones e inventario por sucursal en un mismo flujo.', points: ['Variantes y existencias por bodega', 'POS listo para el equipo de ventas', 'Margen y rotación por producto'] },
  { id: 'logistica', label: 'Logística y transporte', icon: Truck, title: 'Cada entrega bajo control.', body: 'Coordina rutas, clientes, vehículos, servicios y cobros desde una operación que deja rastro.', points: ['Seguimiento de servicios y entregas', 'Costos y rentabilidad por operación', 'Documentos y responsables conectados'] },
  { id: 'construccion', label: 'Construcción y proyectos', icon: Building2, title: 'Del presupuesto a la obra.', body: 'Convierte cotizaciones, compras, avances y costos de proyecto en una sola fuente de verdad.', points: ['Cotizaciones y presupuestos por proyecto', 'Compras y materiales con control', 'Avance, costos y rentabilidad'] },
  { id: 'salud', label: 'Clínicas y consultorios', icon: CalendarDays, title: 'Más tiempo para atender.', body: 'Agenda, pacientes, cobros y operación administrativa alineados a la realidad de tu centro.', points: ['Citas y reservas configurables', 'Historial de clientes y servicios', 'Caja, inventario y reportes'] },
  { id: 'talleres', label: 'Talleres y servicios', icon: ClipboardCheck, title: 'El trabajo entra. El control sale.', body: 'Órdenes de trabajo, agenda, cotizaciones, inventario y seguimiento sin perder conversaciones.', points: ['Órdenes de trabajo e historial', 'Notificaciones por WhatsApp y correo', 'POS, inventario y tareas'] },
] as const;

const PRICES = [
  { title: 'Nova Esencial', note: 'La base para vender, comprar y ordenar tu operación.', price: 600, period: '/año', features: ['Ventas, compras y finanzas', 'Reportes operativos y ejecutivos', 'Nova Suite y comunicación interna', 'Actividades, calendario y eventos por QR'], featured: false },
  { title: 'Nova Premium', note: 'Más control para equipos que ya están creciendo.', price: 100, period: '/mes', features: ['Todo lo de Nova Esencial', 'Vista Manager y consolidado gerencial', 'Facturas editables y documentos configurables', 'Líneas corporativas y personalización comercial'], featured: true },
  { title: 'Nova Enterprise', note: 'La operación completa, con contabilidad y talento conectado.', price: 185, period: '/mes', features: ['Todo lo de Nova Premium', 'Contabilidad y estados financieros', 'Recursos Humanos, nómina y asistencia', 'API, integraciones y desarrollo a medida'], featured: false },
];

function formatPrice(value: number, currency: 'USD' | 'NIO') {
  return currency === 'NIO' ? `C$${(value * EXCHANGE_RATE).toLocaleString('es-NI', { maximumFractionDigits: 0 })}` : `$${value.toLocaleString('en-US')}`;
}

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  return <motion.div initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-70px' }} transition={{ duration: 0.7, delay, ease }} className={className}>{children}</motion.div>;
}

function Kicker({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <p className={`mb-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.25em] ${dark ? 'text-[#5ce1d5]' : 'text-[#0a9f7b]'}`}><span className={`h-px w-8 ${dark ? 'bg-[#5ce1d5]' : 'bg-[#16b978]'}`} />{children}</p>;
}

function PrimaryButton({ href = WHATSAPP_URL, children, onClick, dark = false, className = '' }: { href?: string; children: ReactNode; onClick?: () => void; dark?: boolean; className?: string }) {
  const classes = `group inline-flex items-center justify-center gap-3 rounded-full px-6 py-3.5 text-[11px] font-extrabold uppercase tracking-[0.16em] transition duration-300 hover:-translate-y-0.5 active:translate-y-0 ${dark ? 'bg-[#5ce1d5] text-[#06241f] shadow-[0_16px_45px_-18px_rgba(92,225,213,.9)] hover:bg-white' : 'bg-[#0eaa77] text-white shadow-[0_16px_40px_-18px_rgba(14,170,119,.7)] hover:bg-[#078b65]'} ${className}`;
  const content = <><span>{children}</span><ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" /></>;
  if (onClick) return <button type="button" onClick={onClick} className={classes}>{content}</button>;
  return <a href={href} className={classes}>{content}</a>;
}

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return <header className={`fixed inset-x-0 top-0 z-40 transition duration-300 ${scrolled ? 'bg-[#071b18]/90 shadow-[0_10px_40px_-25px_rgba(0,0,0,.8)] backdrop-blur-xl' : 'bg-transparent'}`}>
    <div className="mx-auto flex h-[76px] max-w-[1280px] items-center justify-between px-5 sm:px-8 lg:px-10">
      <a href="#inicio" className="flex items-center gap-3" aria-label="NovaHub ERP, inicio"><span className="flex size-10 items-center justify-center rounded-xl bg-white p-1.5 shadow-[0_10px_24px_-16px_rgba(1,66,44,.8)]"><NovaHubLogo size={30} /></span><span className="hidden text-sm font-extrabold tracking-[-.03em] text-white sm:block">Nova<span className="text-[#74C044]">Hub</span></span></a>
      <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegación principal">{NAV_LINKS.map((link) => <a key={link.href} href={link.href} className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/65 transition hover:text-[#5ce1d5]">{link.label}</a>)}</nav>
       <div className="hidden items-center gap-5 sm:flex"><a href={WHATSAPP_URL} className="rounded-full bg-[#74C044] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition hover:-translate-y-0.5 hover:bg-[#01422C]">Empezar ahora</a></div>
      <button type="button" onClick={() => setMenuOpen((value) => !value)} className="rounded-full border border-white/15 p-2.5 text-white lg:hidden" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}>{menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}</button>
    </div>
    <AnimatePresence>{menuOpen && <motion.nav initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="border-t border-[#C8E6D0] bg-white px-5 py-4 shadow-[0_18px_34px_-26px_rgba(1,66,44,.6)] lg:hidden"><div className="mx-auto flex max-w-[1280px] flex-col gap-1">{NAV_LINKS.map((link) => <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-3 text-xs font-bold uppercase tracking-[0.15em] text-[#01422C] hover:bg-[#C8E6D0] hover:text-[#01422C]">{link.label}</a>)}<a href={WHATSAPP_URL} className="mt-2 rounded-xl bg-[#74C044] px-3 py-3 text-center text-xs font-bold uppercase tracking-[0.15em] text-white transition hover:bg-[#01422C]">Empezar ahora</a></div></motion.nav>}</AnimatePresence>
  </header>;
}

function HeroSection() {
  return <section id="inicio" className="relative isolate min-h-[790px] overflow-hidden bg-[#071b18] pt-28 text-white lg:min-h-[850px] lg:pt-36">
    <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(92,225,213,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(92,225,213,.06)_1px,transparent_1px)] [background-size:72px_72px]" /><div className="pointer-events-none absolute -left-40 top-24 size-[560px] rounded-full bg-[#0eaa77]/20 blur-[120px]" /><div className="pointer-events-none absolute right-[-180px] top-[-140px] size-[600px] rounded-full bg-[#24d9d0]/15 blur-[130px]" /><div className="pointer-events-none absolute bottom-[-260px] left-1/3 size-[600px] rounded-full bg-[#0eaa77]/10 blur-[120px]" />
    <div className="relative mx-auto grid max-w-[1280px] items-center gap-16 px-5 pb-24 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-8 lg:px-10 lg:pb-32">
      <div className="max-w-[650px]"><Reveal><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#5ce1d5]/25 bg-[#5ce1d5]/[.07] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9af5e9]"><span className="size-1.5 animate-pulse rounded-full bg-[#5ce1d5]" /> ERP diseñado para operar mejor</div><h1 className="max-w-[730px] text-[clamp(3.2rem,7vw,6.75rem)] font-black leading-[.9] tracking-[-0.07em] text-white">El control de tu negocio, <span className="text-[#5ce1d5]">en una sola señal.</span></h1><p className="mt-7 max-w-[580px] text-base leading-7 text-white/60 sm:text-lg">Ventas, inventario, caja, contabilidad y operación conectados en un ERP hecho para empresas que quieren crecer sin improvisar.</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><PrimaryButton href={WHATSAPP_URL} dark>Quiero ver NovaHub</PrimaryButton><a href="#producto" className="group inline-flex items-center justify-center gap-3 rounded-full border border-white/15 px-6 py-3.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/80 transition hover:border-[#5ce1d5]/60 hover:text-white">Explorar el sistema <ArrowDownRight className="size-4 transition group-hover:translate-x-0.5 group-hover:translate-y-0.5" /></a></div><div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40"><span className="flex items-center gap-2"><Check className="size-3.5 text-[#5ce1d5]" /> NIO y USD</span><span className="flex items-center gap-2"><Check className="size-3.5 text-[#5ce1d5]" /> Multisucursal</span><span className="flex items-center gap-2"><Check className="size-3.5 text-[#5ce1d5]" /> Soporte local</span></div></Reveal></div>
       <motion.div initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .8, delay: .12, ease }} className="relative lg:pl-8"><div className="absolute -inset-10 rounded-[3rem] bg-[#5ce1d5]/10 blur-3xl" /><div className="relative rounded-[28px] border border-white/15 bg-white/[.07] p-2 shadow-[0_40px_100px_-35px_rgba(0,0,0,.9)] backdrop-blur-sm sm:p-3"><div className="flex items-center border-b border-white/10 px-3 py-3 sm:px-4"><div className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#ff7c73]" /><span className="size-2 rounded-full bg-[#ffd166]" /><span className="size-2 rounded-full bg-[#5ce1d5]" /></div></div><div className="overflow-hidden rounded-b-[20px] bg-[#f5faf8]"><img src={facturacionCajaDemo} alt="Vista de facturación y caja de NovaHub ERP" className="h-auto w-full object-cover object-top" /></div></div></motion.div>
    </div><div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#f8fbfa] to-transparent" />
  </section>;
}

function SignalStrip() {
  const labels = ['Ventas', 'Inventario', 'Caja', 'Contabilidad', 'Cotizaciones', 'Reportes', 'Clientes', 'Proyectos', 'RRHH'];
  return <div className="overflow-hidden border-y border-[#dbe8e3] bg-[#f7fbf9]"><style>{'@keyframes landing-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}'}</style><div className="flex min-w-max animate-[landing-marquee_30s_linear_infinite] items-center gap-8 py-4 text-[10px] font-extrabold uppercase tracking-[.22em] text-[#56776e]">{[...labels, ...labels].map((label, index) => <span key={`${label}-${index}`} className="flex items-center gap-8"><span>{label}</span><Sparkles className="size-3 text-[#12b77a]" /></span>)}</div></div>;
}

function ConnectedOperation() {
  const items = [{ n: '01', title: 'Captura', body: 'Una cotización, venta o servicio entra una sola vez.' }, { n: '02', title: 'Conexión', body: 'El sistema actualiza inventario, caja, clientes y documentos.' }, { n: '03', title: 'Control', body: 'Cada responsable ve el trabajo, el permiso y el siguiente paso.' }, { n: '04', title: 'Decisión', body: 'La gerencia entiende qué está pasando y dónde actuar.' }];
  return <section id="flujo" className="bg-[#f8fbfa] px-5 py-24 sm:px-8 lg:px-10 lg:py-36"><div className="mx-auto grid max-w-[1280px] gap-14 lg:grid-cols-[.8fr_1.2fr] lg:gap-24"><Reveal><Kicker>La diferencia está en el flujo</Kicker><h2 className="max-w-[520px] text-4xl font-black leading-[.98] tracking-[-.06em] text-[#0c3d31] sm:text-6xl">No son módulos sueltos. Es una operación que se entiende.</h2><p className="mt-7 max-w-[480px] text-base leading-7 text-[#58766e]">NovaHub conecta lo que tu equipo hace todos los días para que la información no se pierda entre chats, hojas de cálculo y sistemas que no conversan.</p><a href="#producto" className="mt-8 inline-flex items-center gap-3 border-b-2 border-[#0eaa77] pb-2 text-[11px] font-extrabold uppercase tracking-[.18em] text-[#0c3d31] transition-colors hover:text-[#0eaa77]">Ver el recorrido <ArrowRight className="size-4" /></a></Reveal><div className="relative grid gap-0 sm:grid-cols-2">{items.map((item, index) => <Reveal key={item.n} delay={index * .07} className="relative border-t border-[#cfe0d9] py-7 sm:pr-8"><span className="text-[10px] font-extrabold tracking-[.18em] text-[#0eaa77]">{item.n}</span><h3 className="mt-3 text-xl font-extrabold tracking-[-.03em] text-[#0c3d31]">{item.title}</h3><p className="mt-2 max-w-[240px] text-sm leading-6 text-[#69837d]">{item.body}</p><ArrowRight className="absolute right-4 top-8 size-4 text-[#b3c9c0] sm:right-8" /></Reveal>)}</div></div></section>;
}

function ProductSection() {
  return <section id="producto" className="bg-white px-5 py-24 sm:px-8 lg:px-10 lg:py-36"><div className="mx-auto max-w-[1280px]"><Reveal className="max-w-[740px]"><Kicker>Un centro de control para tu negocio</Kicker><h2 className="text-4xl font-black leading-[.98] tracking-[-.06em] text-[#0c3d31] sm:text-6xl">Lo que pasa en tu empresa, <span className="text-[#0eaa77]">por fin tiene contexto.</span></h2><p className="mt-6 max-w-[620px] text-base leading-7 text-[#617e76]">Desde la primera cotización hasta el cierre de caja. Cada movimiento conserva su historia y alimenta la siguiente decisión.</p></Reveal><Reveal delay={.12} className="mt-14"><div className="relative overflow-hidden rounded-[30px] border border-[#dce9e4] bg-[#ecf8f3] p-3 shadow-[0_35px_90px_-55px_rgba(8,76,57,.45)] sm:p-5"><div className="absolute -right-20 -top-20 size-72 rounded-full bg-[#5ce1d5]/25 blur-3xl" /><div className="relative grid items-center gap-8 rounded-[22px] border border-white/80 bg-white/75 p-5 backdrop-blur sm:p-8 lg:grid-cols-[1.1fr_.9fr] lg:p-12"><div><div className="mb-5 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.2em] text-[#0eaa77]"><span className="size-2 rounded-full bg-[#0eaa77]" /> Tu operación, en vivo</div><h3 className="max-w-[540px] text-3xl font-black leading-[1] tracking-[-.05em] text-[#0c3d31] sm:text-5xl">Una vista ejecutiva que te dice dónde está el negocio.</h3><p className="mt-5 max-w-[490px] text-sm leading-6 text-[#6d8980]">Ingresos, margen, inventario, cajas y transacciones recientes en una lectura limpia, accionable y lista para compartir.</p><div className="mt-8 flex flex-wrap gap-2"><span className="rounded-full bg-[#e6f7ef] px-3 py-2 text-[10px] font-bold text-[#0a9f7b]">Datos conectados</span><span className="rounded-full bg-[#e6f5f7] px-3 py-2 text-[10px] font-bold text-[#138c95]">Tiempo real</span><span className="rounded-full bg-[#f1f4f2] px-3 py-2 text-[10px] font-bold text-[#56776e]">Por sucursal</span></div></div><div className="relative rounded-[22px] border border-[#d9e9e2] bg-[#f8fcfa] p-4 shadow-[0_20px_45px_-30px_rgba(8,76,57,.5)]"><div className="flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#8aa39c]">Ingresos del mes</p><strong className="mt-1 block text-3xl font-black tracking-[-.06em] text-[#0c3d31]">C$ 1,985.60</strong></div><span className="rounded-xl bg-[#dff8ec] px-2.5 py-2 text-[10px] font-extrabold text-[#0eaa77]">+18.4%</span></div><div className="mt-7 flex h-28 items-end gap-2 border-b border-[#dcebe5] pb-2">{[35, 46, 39, 63, 55, 76, 68, 92, 82, 100, 88, 112].map((height, index) => <motion.span key={index} initial={{ height: 0 }} whileInView={{ height: `${height / 1.15}%` }} viewport={{ once: true }} transition={{ duration: .7, delay: index * .04, ease }} className={`flex-1 rounded-t-md ${index === 9 ? 'bg-[#5ce1d5]' : 'bg-[#b9e8d5]'}`} />)}</div><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-white p-3"><p className="text-[9px] text-[#8aa39c]">Margen líder</p><strong className="mt-1 block text-lg font-black text-[#0c3d31]">50.0%</strong></div><div className="rounded-xl bg-white p-3"><p className="text-[9px] text-[#8aa39c]">Stock bajo</p><strong className="mt-1 block text-lg font-black text-[#f48a56]">10</strong></div></div></div></div></div></Reveal></div></section>;
}

function ModulesSection() {
  return <section className="bg-[#071b18] px-5 py-24 text-white sm:px-8 lg:px-10 lg:py-36"><div className="mx-auto max-w-[1280px]"><Reveal><div className="grid items-end gap-8 lg:grid-cols-[.8fr_1.2fr]"><div><Kicker dark>Todo lo que tu equipo necesita</Kicker><h2 className="max-w-[520px] text-4xl font-black leading-[.98] tracking-[-.06em] sm:text-6xl">Menos fricción. <span className="text-[#5ce1d5]">Más avance.</span></h2></div><p className="max-w-[520px] text-base leading-7 text-white/55">Empieza con lo esencial y agrega capacidades cuando tu empresa las necesite. El sistema crece contigo, no te obliga a cambiar de operación.</p></div></Reveal><div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{MODULES.map((module, index) => { const Icon = module.icon; const tone = module.tone === 'cyan' ? 'text-[#5ce1d5] bg-[#5ce1d5]/10' : module.tone === 'green' ? 'text-[#6ef0bd] bg-[#6ef0bd]/10' : module.tone === 'amber' ? 'text-[#ffd166] bg-[#ffd166]/10' : module.tone === 'violet' ? 'text-[#c9b6ff] bg-[#c9b6ff]/10' : module.tone === 'blue' ? 'text-[#91c7ff] bg-[#91c7ff]/10' : 'text-[#ff9eae] bg-[#ff9eae]/10'; return <Reveal key={module.title} delay={index * .05}><a href={WHATSAPP_URL} className="group block h-full rounded-[22px] border border-white/10 bg-white/[.045] p-6 transition duration-300 hover:-translate-y-1 hover:border-[#5ce1d5]/45 hover:bg-white/[.08]"><div className="flex items-start justify-between"><span className={`flex size-11 items-center justify-center rounded-2xl ${tone}`}><Icon className="size-5" /></span><ArrowRight className="size-4 text-white/20 transition group-hover:translate-x-1 group-hover:text-[#5ce1d5]" /></div><h3 className="mt-8 text-xl font-extrabold tracking-[-.03em]">{module.title}</h3><p className="mt-2 max-w-[270px] text-sm leading-6 text-white/48">{module.body}</p></a></Reveal>; })}</div></div></section>;
}

function ModuleCatalogSection() {
  const [activeCategory, setActiveCategory] = useState<ModuleCategory>('Todos');
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase('es');
  const visibleModules = LANDING_MODULES.filter((item) => {
    const matchesCategory = activeCategory === 'Todos' || item.category === activeCategory;
    const searchableText = `${item.module} ${item.submodule} ${item.features.join(' ')} ${item.advantage}`.toLocaleLowerCase('es');
    return matchesCategory && (!normalizedQuery || searchableText.includes(normalizedQuery));
  });

  return <section id="catalogo-modulos" className="bg-[#C8E6D0]/35 px-5 py-24 sm:px-8 lg:px-10 lg:py-36">
    <div className="mx-auto max-w-[1280px]">
      <Reveal>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[720px]">
            <Kicker>Todo lo que NovaHub puede hacer</Kicker>
            <h2 className="text-4xl font-black leading-[.98] tracking-[-.06em] text-[#01422C] sm:text-6xl">Módulos que se entienden. <span className="landing-serif font-medium italic text-[#74C044]">Ventajas que se sienten.</span></h2>
            <p className="mt-6 max-w-[650px] text-base leading-7 text-[#315f4d]">Explora las capacidades de NovaHub por área. Cada módulo está pensado para resolver una necesidad concreta y conectar el resultado con el resto de tu negocio.</p>
          </div>
          <div className="flex shrink-0 items-end gap-6 border-l border-[#01422C]/15 pl-6">
            <div><strong className="block text-4xl font-black tracking-[-.06em] text-[#01422C]">{LANDING_MODULES.length}+</strong><span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#315f4d]">capacidades</span></div>
            <div><strong className="block text-4xl font-black tracking-[-.06em] text-[#01422C]">{MODULE_CATEGORIES.length - 1}</strong><span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#315f4d]">áreas</span></div>
          </div>
        </div>
      </Reveal>

      <div className="mt-12 rounded-[30px] border border-[#01422C]/10 bg-white/80 p-3 shadow-[0_28px_70px_-48px_rgba(1,66,44,.6)] backdrop-blur sm:p-5">
        <div className="flex flex-col gap-4 border-b border-[#C8E6D0] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-[330px]">
            <span className="sr-only">Buscar módulo</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar módulo o función" className="w-full rounded-full border border-[#C8E6D0] bg-white px-5 py-3 text-sm text-[#01422C] outline-none placeholder:text-[#6f917f] focus:border-[#74C044]" />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar módulos por área">
            {MODULE_CATEGORIES.map((category) => <button key={category} type="button" role="tab" aria-selected={activeCategory === category} onClick={() => setActiveCategory(category)} className={`whitespace-nowrap rounded-full border px-4 py-2.5 text-[10px] font-bold uppercase tracking-[.12em] transition ${activeCategory === category ? 'border-[#01422C] bg-[#01422C] text-white' : 'border-[#C8E6D0] bg-white text-[#315f4d] hover:border-[#74C044] hover:text-[#01422C]'}`}>{category}</button>)}
          </div>
        </div>

        {visibleModules.length > 0 ? <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleModules.map((item, index) => {
            const Icon = item.icon;
            return <Reveal key={`${item.module}-${item.submodule}`} delay={Math.min(index * .015, .18)}>
              <article className="landing-module-card group flex h-full flex-col rounded-[22px] border border-[#C8E6D0] bg-white p-5 transition duration-300 hover:-translate-y-1 hover:border-[#74C044]">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-[#C8E6D0]/70 text-[#01422C]"><Icon className="size-4.5" /></span>
                  <span className="rounded-full bg-[#C8E6D0]/50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#01422C]">{item.category}</span>
                </div>
                <p className="mt-6 text-[10px] font-bold uppercase tracking-[.16em] text-[#74C044]">{item.module}</p>
                <h3 className="mt-2 text-lg font-extrabold leading-tight tracking-[-.03em] text-[#01422C]">{item.submodule}</h3>
                <ul className="mt-4 space-y-2 text-sm leading-5 text-[#315f4d]">{item.features.map((feature) => <li key={feature} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-[#74C044]" />{feature}</li>)}</ul>
                <div className="mt-5 border-t border-[#C8E6D0] pt-4"><p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#74C044]">Ventaja</p><p className="mt-1 text-sm leading-5 text-[#01422C]">{item.advantage}</p></div>
              </article>
            </Reveal>;
          })}
        </div> : <div className="py-16 text-center"><p className="text-lg font-bold text-[#01422C]">No encontramos ese módulo.</p><button type="button" onClick={() => setQuery('')} className="mt-3 text-sm font-semibold text-[#74C044] underline underline-offset-4">Limpiar búsqueda</button></div>}
      </div>
    </div>
  </section>;
}

function IndustriesSection() {
  const [activeId, setActiveId] = useState<(typeof INDUSTRIES)[number]['id']>('retail');
  const active = INDUSTRIES.find((industry) => industry.id === activeId) ?? INDUSTRIES[0];
  const ActiveIcon = active.icon;
  return <section id="giros" className="relative overflow-hidden bg-[#f8fbfa] px-5 py-24 sm:px-8 lg:px-10 lg:py-36"><div className="pointer-events-none absolute right-[-120px] top-20 size-80 rounded-full bg-[#c8fff2] blur-[100px]" /><div className="relative mx-auto max-w-[1280px]"><Reveal><Kicker>Una base. Muchos negocios.</Kicker><div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr] lg:items-end"><h2 className="max-w-[600px] text-4xl font-black leading-[.98] tracking-[-.06em] text-[#0c3d31] sm:text-6xl">La tecnología se adapta a tu giro, <span className="text-[#0eaa77]">no al revés.</span></h2><p className="max-w-[500px] text-base leading-7 text-[#617e76]">Configura lo que necesitas para tu realidad: citas, órdenes de trabajo, proyectos, rutas, variantes, cajas y más.</p></div></Reveal><div className="mt-14 grid gap-4 lg:grid-cols-[.72fr_1.28fr]"><div className="flex flex-col gap-2">{INDUSTRIES.map((industry) => { const Icon = industry.icon; const selected = industry.id === activeId; return <button key={industry.id} type="button" onClick={() => setActiveId(industry.id)} className={`group flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition ${selected ? 'border-[#0eaa77] bg-[#0c3d31] text-white shadow-[0_18px_40px_-28px_rgba(8,76,57,.8)]' : 'border-[#dce9e4] bg-white text-[#0c3d31] hover:border-[#9dd9c1]'}`}><span className="flex items-center gap-3"><Icon className={`size-4 ${selected ? 'text-[#5ce1d5]' : 'text-[#0eaa77]'}`} /><span className="text-sm font-extrabold">{industry.label}</span></span><ArrowRight className={`size-4 transition ${selected ? 'translate-x-1 text-[#5ce1d5]' : 'text-[#b4cac2] group-hover:translate-x-1'}`} /></button>; })}</div><AnimatePresence mode="wait"><motion.div key={active.id} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .35, ease }} className="relative overflow-hidden rounded-[28px] bg-[#0c3d31] p-7 text-white sm:p-10"><div className="absolute -bottom-28 -right-16 size-72 rounded-full border-[35px] border-[#5ce1d5]/10" /><div className="absolute right-16 top-12 size-2 rounded-full bg-[#5ce1d5] shadow-[0_0_0_8px_rgba(92,225,213,.1)]" /><div className="relative"><div className="flex size-12 items-center justify-center rounded-2xl bg-[#5ce1d5]/15"><ActiveIcon className="size-5 text-[#5ce1d5]" /></div><h3 className="mt-8 max-w-[540px] text-3xl font-black leading-[1] tracking-[-.05em] sm:text-5xl">{active.title}</h3><p className="mt-5 max-w-[560px] text-base leading-7 text-white/58">{active.body}</p><div className="mt-8 grid gap-3 sm:grid-cols-3">{active.points.map((point) => <div key={point} className="rounded-2xl border border-white/10 bg-white/[.05] p-4 text-sm leading-5 text-white/80"><Check className="mb-4 size-4 text-[#5ce1d5]" />{point}</div>)}</div><a href={WHATSAPP_URL} className="mt-9 inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[.17em] text-[#5ce1d5]">Diseñar mi operación <ArrowRight className="size-4" /></a></div></motion.div></AnimatePresence></div></div></section>;
}

function PricingSection() {
  const [currency, setCurrency] = useState<'USD' | 'NIO'>('USD');
  return <section id="precios" className="bg-white px-5 py-24 sm:px-8 lg:px-10 lg:py-36"><div className="mx-auto max-w-[1280px]"><Reveal><div className="flex flex-col justify-between gap-7 sm:flex-row sm:items-end"><div><Kicker>Planes NovaHub</Kicker><h2 className="text-4xl font-black leading-[.98] tracking-[-.06em] text-[#0c3d31] sm:text-6xl">Elige la profundidad de tu operación.</h2><p className="mt-5 max-w-[560px] text-base leading-7 text-[#617e76]">Precios de referencia tomados del catálogo actual. Cada plan puede crecer con personalizaciones, implementación y módulos verticales.</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={downloadContract} className="inline-flex items-center gap-2 rounded-full border border-[#cbded6] px-4 py-2 text-[10px] font-extrabold uppercase tracking-[.12em] text-[#0c3d31] transition hover:border-[#0eaa77] hover:text-[#0eaa77]"><FileText className="size-3.5" /> Contrato modelo</button><div className="flex items-center gap-1 rounded-full border border-[#dce9e4] bg-[#f7fbf9] p-1"><button type="button" onClick={() => setCurrency('USD')} className={`rounded-full px-4 py-2 text-[10px] font-extrabold uppercase tracking-[.15em] transition ${currency === 'USD' ? 'bg-[#0c3d31] text-white' : 'text-[#7b968e]'}`}>USD</button><button type="button" onClick={() => setCurrency('NIO')} className={`rounded-full px-4 py-2 text-[10px] font-extrabold uppercase tracking-[.15em] transition ${currency === 'NIO' ? 'bg-[#0c3d31] text-white' : 'text-[#7b968e]'}`}>NIO</button></div></div></div></Reveal><div className="mt-14 grid gap-4 lg:grid-cols-3">{PRICES.map((plan, index) => <Reveal key={plan.title} delay={index * .07}><div className={`relative flex h-full flex-col rounded-[24px] border p-7 transition duration-300 hover:-translate-y-1 ${plan.featured ? 'border-[#0eaa77] bg-[#eafaf2] shadow-[0_25px_60px_-38px_rgba(14,170,119,.65)]' : 'border-[#dce9e4] bg-white'}`}>{plan.featured && <span className="absolute right-6 top-6 rounded-full bg-[#0eaa77] px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[.16em] text-white">Más elegido</span>}<p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-[#0eaa77]">{plan.title}</p><p className="mt-3 min-h-10 max-w-[250px] text-sm leading-5 text-[#617e76]">{plan.note}</p><div className="mt-7 flex items-baseline gap-2"><strong className="text-5xl font-black tracking-[-.07em] text-[#0c3d31]">{formatPrice(plan.price, currency)}</strong><span className="text-sm text-[#78938b]">{plan.period}</span></div><div className="my-7 h-px bg-[#dce9e4]" /><ul className="flex-1 space-y-4">{plan.features.map((feature) => <li key={feature} className="flex gap-3 text-sm text-[#54746a]"><Check className="mt-0.5 size-4 shrink-0 text-[#0eaa77]" />{feature}</li>)}</ul><a href={`${WHATSAPP_URL}%20Plan%3A%20${encodeURIComponent(plan.title)}`} className={`mt-8 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-[.16em] transition ${plan.featured ? 'bg-[#0eaa77] text-white hover:bg-[#078b65]' : 'border border-[#cbded6] text-[#0c3d31] hover:border-[#0eaa77] hover:text-[#0eaa77]'}`}>Hablar de este plan <ArrowRight className="size-4" /></a></div></Reveal>)}</div><p className="mt-7 text-center text-xs text-[#8aa39c]">La implementación, impuestos y desarrollos especiales se cotizan según alcance.</p></div></section>;
}

function TrustSection() {
  const assurances = [{ icon: ShieldCheck, title: 'Acceso por responsabilidad', body: 'Roles, permisos, empresas y sucursales para que cada persona vea lo que corresponde.' }, { icon: Layers3, title: 'Una sola fuente de verdad', body: 'La información entra una vez y se conserva desde la cotización hasta el cobro.' }, { icon: Headphones, title: 'Acompañamiento local', body: 'Implementación, capacitación y soporte en español para que el sistema se use de verdad.' }];
  return <section id="confianza" className="bg-[#f8fbfa] px-5 py-24 sm:px-8 lg:px-10 lg:py-32"><div className="mx-auto max-w-[1280px]"><Reveal><Kicker>Hecho para crecer con confianza</Kicker><h2 className="max-w-[760px] text-4xl font-black leading-[.98] tracking-[-.06em] text-[#0c3d31] sm:text-6xl">La claridad también es una ventaja competitiva.</h2></Reveal><div className="mt-14 grid gap-3 md:grid-cols-3">{assurances.map(({ icon: Icon, title, body }, index) => <Reveal key={title} delay={index * .07}><div className="h-full rounded-[22px] border border-[#dce9e4] bg-white p-6"><Icon className="size-5 text-[#0eaa77]" /><h3 className="mt-8 text-lg font-extrabold tracking-[-.03em] text-[#0c3d31]">{title}</h3><p className="mt-3 text-sm leading-6 text-[#6d8980]">{body}</p></div></Reveal>)}</div></div></section>;
}

function downloadContract() {
  void import('jspdf').then(({ jsPDF }) => {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const margin = 22;
    const green = [14, 170, 119] as const;
    const forest = [12, 61, 49] as const;
    doc.setFillColor(...forest); doc.rect(0, 0, width, 34, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(255, 255, 255); doc.text('NOVAHUB', margin, 22); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(190, 235, 220); doc.text('ERP PLATFORM · MODELO COMERCIAL', margin + 48, 22); doc.setFillColor(...green); doc.rect(0, 34, width, 1.5, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...forest); doc.text('CONTRATO DE LICENCIA DE USO DE SOFTWARE', width / 2, 55, { align: 'center' }); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 110, 102); doc.text('Modelo Software como Servicio (SaaS)', width / 2, 63, { align: 'center' });
    const lines = ['EL PROVEEDOR: NovaHub, empresa de tecnología y software.', 'EL CLIENTE: la persona natural o jurídica que suscribe el documento.', '', 'Este modelo resume las condiciones de licencia, implementación, soporte, seguridad y datos.', 'La propuesta final, impuestos, alcance y forma de pago serán confirmados por escrito antes de la activación.', '', 'Datos del cliente', 'Razón social / nombre: ________________________________________________', 'RUC / cédula: ________________________________________________________', 'Representante legal: _________________________________________________', 'Correo electrónico: _________________________________________________', 'Dirección: __________________________________________________________', 'Teléfono: ___________________________________________________________', '', 'Este archivo es un modelo comercial descargable y no sustituye asesoría legal.'];
    let y = 82; doc.setFontSize(9); lines.forEach((line) => { if (line === 'Datos del cliente') { doc.setFont('helvetica', 'bold'); doc.setTextColor(...forest); } else { doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 110, 102); } doc.text(line, margin, y); y += line ? 8 : 5; }); doc.setDrawColor(...green); doc.line(margin, height - 18, width - margin, height - 18); doc.setFontSize(7); doc.setTextColor(125, 145, 140); doc.text('NovaHub ERP · Modelo sujeto a revisión y firma de las partes.', width / 2, height - 11, { align: 'center' }); doc.save(buildDownloadFileName(['contrato_licencia_novahub_erp'], 'pdf'));
  });
}

function FinalCTA() {
  return <section id="contacto" className="relative overflow-hidden bg-[#0c3d31] px-5 py-24 text-white sm:px-8 lg:px-10 lg:py-32"><div className="pointer-events-none absolute -right-20 -top-32 size-[520px] rounded-full border-[70px] border-[#5ce1d5]/[.07]" /><div className="pointer-events-none absolute bottom-[-220px] left-[-80px] size-[450px] rounded-full bg-[#0eaa77]/20 blur-[110px]" /><div className="relative mx-auto flex max-w-[1280px] flex-col gap-12 lg:flex-row lg:items-end lg:justify-between"><Reveal><Kicker dark>El siguiente paso es más claro</Kicker><h2 className="max-w-[780px] text-5xl font-black leading-[.92] tracking-[-.07em] sm:text-7xl">Tu negocio merece un sistema que <span className="text-[#5ce1d5]">funcione contigo.</span></h2><p className="mt-7 max-w-[560px] text-base leading-7 text-white/60">Agenda una conversación y te mostramos cómo NovaHub puede ordenar tu operación sin perder la forma en que ya trabajas.</p></Reveal><Reveal delay={.1} className="shrink-0"><div className="flex flex-col gap-3 sm:flex-row lg:flex-col"><PrimaryButton href={WHATSAPP_URL} dark>Agendar llamada ahora</PrimaryButton><button type="button" onClick={downloadContract} className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[10px] font-extrabold uppercase tracking-[.16em] text-white/55 transition hover:text-white"><FileText className="size-4" /> Descargar contrato modelo</button></div></Reveal></div></section>;
}

function Footer() {
  return <footer className="bg-white px-5 py-12 text-[#01422C] sm:px-8 lg:px-10"><div className="mx-auto max-w-[1280px]"><div className="grid gap-10 md:grid-cols-[1.2fr_.8fr_.8fr] lg:gap-24"><div><div className="flex h-[82px] w-[250px] items-center justify-center overflow-hidden rounded-2xl border border-[#C8E6D0] bg-white px-4 shadow-[0_16px_36px_-28px_rgba(1,66,44,.45)]"><img src={novahubLogotipo} alt="NovaHub" className="h-full w-full object-contain" /></div><p className="mt-5 max-w-[340px] text-sm leading-6 text-[#58766e]">Una forma más clara de vender, controlar y hacer crecer tu empresa.</p><a href={WHATSAPP_URL} className="mt-6 inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.17em] text-[#74C044] transition hover:text-[#01422C]">Hablar con NovaHub <ArrowRight className="size-4" /></a></div><div><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#74C044]">Explorar</p><div className="mt-4 flex flex-col gap-3 text-sm text-[#58766e]"><a href="#producto" className="transition hover:text-[#74C044]">Producto</a><a href="#giros" className="transition hover:text-[#74C044]">Giros de negocio</a><a href={WHATSAPP_URL} className="transition hover:text-[#74C044]">Contactarnos</a></div></div><div><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#74C044]">Confianza</p><div className="mt-4 flex flex-col gap-3 text-sm text-[#58766e]"><a href="#confianza" className="transition hover:text-[#74C044]">Seguridad y datos</a><a href="#contacto" className="transition hover:text-[#74C044]">Soporte en español</a><a href={WHATSAPP_URL} className="transition hover:text-[#74C044]">Solicitar información</a></div></div></div><div className="mt-10 flex flex-col justify-between gap-4 border-t border-[#C8E6D0] pt-5 text-[10px] text-[#6d8980] sm:flex-row"><span>© {new Date().getFullYear()} NovaHub ERP. Todos los derechos reservados.</span><span>Diseñado para empresas que quieren avanzar.</span></div></div></footer>;
}

function MobileCTA() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const onScroll = () => setVisible(window.scrollY > 520); window.addEventListener('scroll', onScroll, { passive: true }); return () => window.removeEventListener('scroll', onScroll); }, []);
  return <AnimatePresence>{visible && <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="fixed inset-x-0 bottom-0 z-30 border-t border-[#dce9e4] bg-white/95 p-3 shadow-[0_-18px_40px_-25px_rgba(8,76,57,.45)] backdrop-blur-xl sm:hidden"><a href={WHATSAPP_URL} className="flex items-center justify-center gap-2 rounded-full bg-[#0eaa77] py-3 text-[10px] font-extrabold uppercase tracking-[.16em] text-white">Agendar demo <ArrowRight className="size-4" /></a></motion.div>}</AnimatePresence>;
}

export default function LandingPage() {
  useEffect(() => {
    const landing = document.querySelector('#novahub-landing');
    if (!landing) return;
    landing.querySelectorAll('span').forEach((span) => {
      if (span.textContent?.trim() === 'capacidades') span.textContent = 'funcionalidades';
    });
    landing.querySelector('#precios')?.remove();
    landing.querySelectorAll("a[href='#precios']").forEach((link) => link.remove());
    landing.querySelectorAll("a[href='/login']").forEach((link) => {
      link.setAttribute('href', WHATSAPP_URL);
      link.textContent = link.closest('header') ? 'Empezar ahora' : 'Contactarnos';
    });
    const screenshot = landing.querySelector<HTMLImageElement>('img[alt^="Vista de facturación"]');
    const visual = screenshot?.parentElement?.parentElement?.parentElement;
    if (visual && !visual.querySelector('.landing-hero-tagline')) {
      const tagline = document.createElement('p');
      tagline.className = 'landing-hero-tagline';
      tagline.textContent = 'Crece con NovaHub.';
      visual.append(tagline);
    }
    if (screenshot && !screenshot.dataset.zoomReady) {
      screenshot.dataset.zoomReady = 'true';
      screenshot.addEventListener('click', () => {
        const lightbox = document.createElement('div');
        lightbox.className = 'landing-image-lightbox';
        lightbox.innerHTML = `<button type="button" class="landing-image-lightbox-close" aria-label="Cerrar vista ampliada">×</button><img src="${screenshot.getAttribute('src')}" alt="Vista ampliada de NovaHub ERP" />`;
        const closeLightbox = () => {
          lightbox.remove();
          document.body.style.overflow = '';
        };
        lightbox.querySelector('.landing-image-lightbox-close')?.addEventListener('click', closeLightbox);
        lightbox.addEventListener('click', (event) => {
          if (event.target === lightbox) closeLightbox();
        });
        document.body.style.overflow = 'hidden';
        document.body.append(lightbox);
      });
    }
  }, []);
  useEffect(() => { document.title = 'NovaHub ERP | Vende más, controla mejor y crece con NovaHub'; const heroTitle = document.querySelector('#novahub-landing h1'); if (heroTitle) { heroTitle.innerHTML = 'Vende más. <br />Controla mejor. <span class="landing-serif font-medium italic tracking-[-.05em] text-[#C8E6D0]">Crece con NovaHub.</span>'; const heroCopy = heroTitle.parentElement; const eyebrow = heroCopy?.querySelector('div.mb-6'); if (eyebrow) eyebrow.innerHTML = '<span class="size-1.5 animate-pulse rounded-full bg-[#5ce1d5]"></span> ERP para empresas que quieren crecer'; const subhead = heroTitle.nextElementSibling; if (subhead) subhead.textContent = 'Ventas, inventario, caja, contabilidad y operación conectados en un ERP diseñado para que tomes decisiones con claridad.'; } }, []);
  useEffect(() => { document.querySelector('#novahub-landing h1 .landing-serif')?.remove(); }, []);
  return <div id="novahub-landing" className="min-h-screen overflow-x-hidden bg-white text-[#01422C] antialiased selection:bg-[#C8E6D0] selection:text-[#01422C]"><Header /><main><HeroSection /><SignalStrip /><ConnectedOperation /><ProductSection /><ModulesSection /><ModuleCatalogSection /><IndustriesSection /><PricingSection /><TrustSection /><FinalCTA /></main><Footer /><MobileCTA /><LandingChatModal /></div>;
}
