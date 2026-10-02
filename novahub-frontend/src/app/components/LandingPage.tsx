import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Check,
  CircleDollarSign,
  FileText,
  Layers3,
  Menu,
  Package,
  Receipt,
  ShoppingCart,
  Store,
  Truck,
  Users,
  X,
} from 'lucide-react';
import facturacionCajaDemo from '../../assets/landing/facturacion-caja-demo.png';
import novahubLogotipo from '../../assets/branding/novahub-logotipo-transparent.png';
import { LandingChatModal } from './LandingChatModal';
import '../../styles/landing.css';

const WHATSAPP_URL = 'https://wa.me/50588241003?text=Hola%2C%20quiero%20conocer%20NovaHub%20ERP';
const ease = [0.22, 1, 0.36, 1] as const;

const NAV_LINKS = [
  { label: 'Ecosistema', href: '#ecosistema' },
  { label: 'Módulos', href: '#modulos' },
  { label: 'Sectores', href: '#sectores' },
  { label: 'Cómo funciona', href: '#flujo' },
] as const;

const MODULES = [
  { number: '01', name: 'Ventas', body: 'Cotizaciones, clientes, facturación y cobros en un mismo recorrido.', icon: Receipt },
  { number: '02', name: 'Inventario', body: 'Existencias, costos, bodegas y transferencias con trazabilidad.', icon: Package },
  { number: '03', name: 'Compras', body: 'Proveedores, recepciones y compromisos conectados a tu operación.', icon: ShoppingCart },
  { number: '04', name: 'Finanzas', body: 'Caja, bancos, cuentas por cobrar y lectura financiera del negocio.', icon: CircleDollarSign },
  { number: '05', name: 'Contabilidad', body: 'De cada movimiento diario a los estados financieros de la empresa.', icon: FileText },
  { number: '06', name: 'Manager', body: 'Una vista consolidada para comparar, priorizar y decidir.', icon: BarChart3 },
] as const;

const INDUSTRIES = [
  { number: '01', name: 'Logística y transporte', body: 'Recepción, bodegas, tracking, entregas y cobros en una operación visible.', icon: Truck },
  { number: '02', name: 'Retail y tiendas', body: 'Productos, variantes, cajas, existencias y ventas por sucursal.', icon: Store },
  { number: '03', name: 'Construcción y proyectos', body: 'Cotizaciones, compras, materiales, avances y costos por proyecto.', icon: Building2 },
  { number: '04', name: 'Marketing y servicios', body: 'Clientes, propuestas, actividades, equipos y rentabilidad.', icon: Users },
  { number: '05', name: 'Farmacias y centros clínicos', body: 'Pacientes, agenda, inventario sensible y operación administrativa.', icon: Layers3 },
] as const;

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.75, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div className={`nh-eyebrow ${dark ? 'nh-eyebrow-dark' : ''}`}>
      <span />
      {children}
    </div>
  );
}
function ActionLink({ href, children, dark = false }: { href: string; children: ReactNode; dark?: boolean }) {
  return (
    <a href={href} className={`nh-action group ${dark ? 'nh-action-dark' : ''}`}>
      <span>{children}</span>
      <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
    </a>
  );
}

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 28);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`nh-header ${scrolled ? 'nh-header-scrolled' : ''}`}>
      <div className="nh-shell flex h-[78px] items-center justify-between">
        <a href="#inicio" aria-label="NovaHub, inicio" className="shrink-0">
          <img src={novahubLogotipo} alt="NovaHub" className="h-10 w-auto object-contain" />
        </a>

        <nav aria-label="Navegación principal" className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="nh-nav-link">{link.label}</a>
          ))}
        </nav>

        <div className="hidden items-center gap-5 sm:flex">
          <a href="/login" className="nh-login-link">Ingresar</a>
          <a href={WHATSAPP_URL} className="nh-header-cta">Conversemos <ArrowUpRight className="size-4" /></a>
        </div>

        <button type="button" onClick={() => setMenuOpen((open) => !open)} className="nh-menu-button lg:hidden" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}>
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="nh-mobile-menu lg:hidden">
            <div className="nh-shell flex flex-col gap-1 py-4">
              {NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="nh-mobile-link">{link.label}</a>
              ))}
              <a href={WHATSAPP_URL} className="nh-mobile-cta">Conversemos <ArrowUpRight className="size-4" /></a>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

function HeroSection() {
  return (
    <section id="inicio" className="nh-hero">
      <div className="nh-hero-grid" />
      <div className="nh-hero-orbit nh-hero-orbit-one" />
      <div className="nh-hero-orbit nh-hero-orbit-two" />
      <div className="nh-shell relative z-10 grid min-h-[780px] items-end gap-16 pb-20 pt-36 lg:grid-cols-[0.88fr_1.12fr] lg:gap-10 lg:pb-28">
        <Reveal className="max-w-[640px]">
          <Eyebrow dark>El sistema operativo de tu empresa</Eyebrow>
          <h1 className="nh-display nh-display-hero">
            Toda tu empresa.
            <span className="nh-serif nh-hero-serif">Una sola operación.</span>
          </h1>
          <p className="nh-hero-copy">
            NovaHub integra ventas, inventario, compras, finanzas, contabilidad y gestión para convertir lo que ocurre cada día en información para decidir.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a href="#ecosistema" className="nh-button nh-button-green">Explorar NovaHub <ArrowDownRight className="size-4" /></a>
            <a href={WHATSAPP_URL} className="nh-button nh-button-outline">Solicitar conversación <ArrowUpRight className="size-4" /></a>
          </div>
          <div className="nh-hero-signals">
            <span><Check className="size-3.5" /> Modular</span>
            <span><Check className="size-3.5" /> Multisucursal</span>
            <span><Check className="size-3.5" /> NIO y USD</span>
          </div>
        </Reveal>

        <Reveal delay={0.12} className="relative lg:pb-2 lg:pl-5">
          <div className="nh-hero-index"><strong>01</strong><span>OPERACIÓN</span></div>
          <div className="nh-product-frame">
            <div className="nh-frame-bar"><span>NovaHub / Panel de operación</span><span className="nh-frame-live"><i /> Sistema conectado</span></div>
            <div className="nh-frame-image"><img src={facturacionCajaDemo} alt="Panel de facturación y caja de NovaHub" /></div>
          </div>
          <p className="nh-hero-caption">Una plataforma para que cada movimiento tenga un siguiente paso.</p>
        </Reveal>
      </div>
      <div className="nh-hero-footer"><span>NovaHub ERP</span><span>Todo comienza a conectarse.</span><span>Scroll para explorar</span></div>
    </section>
  );
}

function SignalStrip() {
  const signals = ['Ventas', 'Inventario', 'Compras', 'Finanzas', 'Contabilidad', 'Personas', 'Proyectos', 'Reportes'];
  return (
    <div className="nh-signal-strip">
      <div className="nh-shell nh-signal-track">
        {signals.map((signal, index) => <span key={signal}><b>{String(index + 1).padStart(2, '0')}</b>{signal}</span>)}
      </div>
    </div>
  );
}

function ManifestoSection() {
  return (
    <section id="producto" className="nh-light-section nh-manifesto">
      <div className="nh-shell grid gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:gap-24">
        <Reveal className="relative">
          <div className="nh-section-number">01</div>
          <Eyebrow>Una nueva forma de operar</Eyebrow>
          <p className="nh-small-note">La operación cotidiana también puede convertirse en criterio.</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="nh-display nh-display-light">Una empresa no debería depender de hojas de cálculo, mensajes y sistemas que no conversan.</h2>
          <p className="nh-body-copy mt-8 max-w-[660px]">NovaHub nace escuchando cómo funcionan las distintas actividades empresariales. Integra ese aprendizaje en una plataforma que convierte cada operación en estructura, control y capacidad de decisión.</p>
          <ActionLink href="#ecosistema">Conocer el ecosistema</ActionLink>
        </Reveal>
      </div>
    </section>
  );
}

function EcosystemSection() {
  return (
    <section id="ecosistema" className="nh-dark-section nh-ecosystem">
      <div className="nh-ecosystem-lines" />
      <div className="nh-shell relative z-10">
        <Reveal className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
          <div>
            <Eyebrow dark>Un ecosistema, no un conjunto de pantallas</Eyebrow>
            <h2 className="nh-display nh-display-dark">Lo que tu equipo hace. Lo que tu empresa aprende.</h2>
          </div>
          <p className="nh-body-copy nh-body-copy-dark max-w-[500px] lg:justify-self-end">Cada módulo trabaja en su lugar, pero la información no termina ahí. Una venta puede alimentar inventario, caja, cuentas por cobrar y contabilidad sin volver a capturar lo mismo.</p>
        </Reveal>

        <Reveal delay={0.1} className="nh-flow-map">
          <div className="nh-flow-line" />
          {[
            ['01', 'Vender', 'Clientes y documentos'],
            ['02', 'Registrar', 'Inventario y caja'],
            ['03', 'Ordenar', 'Compras y finanzas'],
            ['04', 'Decidir', 'Reportes y manager'],
          ].map(([number, title, subtitle]) => (
            <div key={number} className="nh-flow-node">
              <span>{number}</span>
              <strong>{title}</strong>
              <small>{subtitle}</small>
            </div>
          ))}
        </Reveal>

        <div className="mt-20 grid gap-5 border-t border-white/15 pt-6 sm:grid-cols-3">
          <div className="nh-data-line"><span>01</span><p>Una captura</p><small>La información nace una vez.</small></div>
          <div className="nh-data-line"><span>02</span><p>Más contexto</p><small>Cada área recibe lo que necesita.</small></div>
          <div className="nh-data-line"><span>03</span><p>Mejor decisión</p><small>La gerencia ve el siguiente paso.</small></div>
        </div>
      </div>
    </section>
  );
}

function ModulesSection() {
  return (
    <section id="modulos" className="nh-light-section nh-modules-section">
      <div className="nh-shell">
        <Reveal className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div><Eyebrow>Las capacidades de NovaHub</Eyebrow><h2 className="nh-display nh-display-light">Empieza donde estás. Crece cuando lo necesites.</h2></div>
          <div className="lg:justify-self-end"><p className="nh-body-copy max-w-[520px]">La plataforma se adapta al nivel de gestión de tu empresa. Incorpora las herramientas necesarias sin obligarte a cambiar la forma en que trabajas.</p><ActionLink href="/modulos">Ver todos los módulos</ActionLink></div>
        </Reveal>
        <div className="nh-module-list mt-16">
          {MODULES.map((module, index) => {
            const Icon = module.icon;
            return (
              <Reveal key={module.name} delay={index * 0.035}>
                <a href="/modulos" className="nh-module-row group">
                  <span className="nh-module-number">{module.number}</span>
                  <Icon className="nh-module-icon" strokeWidth={1.5} />
                  <span className="nh-module-name">{module.name}</span>
                  <span className="nh-module-body">{module.body}</span>
                  <ArrowUpRight className="nh-module-arrow" />
                </a>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function IndustriesSection() {
  return (
    <section id="sectores" className="nh-dark-section nh-industries">
      <div className="nh-shell grid gap-16 lg:grid-cols-[0.76fr_1.24fr] lg:gap-24">
        <Reveal>
          <Eyebrow dark>Construido escuchando negocios reales</Eyebrow>
          <h2 className="nh-display nh-display-dark">Una base común. La forma de trabajar de cada sector.</h2>
          <p className="nh-body-copy nh-body-copy-dark mt-8 max-w-[440px]">NovaHub no parte del tamaño de una organización. Parte de las capacidades que necesita para avanzar con más orden, más información y más control.</p>
        </Reveal>
        <div className="nh-industry-list">
          {INDUSTRIES.map((industry, index) => {
            const Icon = industry.icon;
            return (
              <Reveal key={industry.name} delay={index * 0.045}>
                <div className="nh-industry-row">
                  <span className="nh-industry-number">{industry.number}</span>
                  <Icon className="nh-industry-icon" strokeWidth={1.5} />
                  <div><h3>{industry.name}</h3><p>{industry.body}</p></div>
                  <ArrowRight className="nh-industry-arrow" />
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProcessSection() {
  const steps = [
    ['01', 'Escuchamos', 'Entendemos cómo trabaja tu empresa y qué capacidad necesita hoy.'],
    ['02', 'Conectamos', 'Ordenamos la operación en módulos que comparten información.'],
    ['03', 'Acompañamos', 'El equipo incorpora el sistema a su ritmo, con una ruta clara.'],
    ['04', 'Evolucionamos', 'La plataforma crece con las preguntas que el negocio empieza a hacerse.'],
  ];
  return (
    <section id="flujo" className="nh-light-section nh-process">
      <div className="nh-shell">
        <Reveal className="max-w-[760px]"><Eyebrow>Cómo trabaja NovaHub</Eyebrow><h2 className="nh-display nh-display-light">La tecnología importa. El acompañamiento también.</h2></Reveal>
        <div className="mt-16 grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([number, title, body], index) => (
            <Reveal key={number} delay={index * 0.06} className="nh-process-step">
              <span>{number}</span><h3>{title}</h3><p>{body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductProofSection() {
  return (
    <section className="nh-proof-section">
      <div className="nh-shell">
        <Reveal className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
          <div><Eyebrow>La operación en contexto</Eyebrow><h2 className="nh-display nh-display-light">No mostramos promesas. Mostramos cómo se mueve el trabajo.</h2></div>
          <p className="nh-body-copy max-w-[500px] lg:justify-self-end">Una vista real del producto ayuda a entender la diferencia: menos pasos repetidos, más trazabilidad y una lectura que sirve tanto al equipo como a la dirección.</p>
        </Reveal>
        <Reveal delay={0.1} className="mt-14">
          <div className="nh-proof-frame"><div className="nh-proof-label">NovaHub / Facturación y caja</div><img src={facturacionCajaDemo} alt="Demostración real de facturación y caja en NovaHub" /></div>
        </Reveal>
      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section className="nh-about-section">
      <div className="nh-shell grid gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:gap-24">
        <Reveal><Eyebrow dark>Acerca de NovaHub</Eyebrow><div className="nh-section-number nh-section-number-dark">02</div><p className="nh-small-note nh-small-note-dark">Todo comienza a conectarse.</p></Reveal>
        <Reveal delay={0.08}><blockquote className="nh-quote">“Convertimos la operación cotidiana en información, estructura y capacidad de decisión.”</blockquote><p className="nh-body-copy nh-body-copy-dark mt-8 max-w-[620px]">NovaHub es un ecosistema de herramientas para la gestión empresarial. Una base para que organizaciones de diferentes tamaños incorporen, progresivamente, las capacidades que necesitan conforme evolucionan.</p></Reveal>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section id="contacto" className="nh-final-cta">
      <div className="nh-final-grid" />
      <div className="nh-shell relative z-10 grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
        <Reveal><Eyebrow dark>El siguiente movimiento es tuyo</Eyebrow><h2 className="nh-display nh-display-dark max-w-[780px]">Tu empresa ya está evolucionando. <span className="nh-serif nh-hero-serif">Tu sistema también.</span></h2></Reveal>
        <Reveal delay={0.08}><a href={WHATSAPP_URL} className="nh-button nh-button-green">Hablemos de tu operación <ArrowUpRight className="size-4" /></a></Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="nh-footer">
      <div className="nh-shell grid gap-12 py-12 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><img src={novahubLogotipo} alt="NovaHub" className="h-10 w-auto" /><p className="mt-5 max-w-[360px] text-sm leading-6 text-white/45">Herramientas conectadas para empresas que quieren operar con más claridad.</p></div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs font-semibold text-white/55"><a href="#ecosistema">Ecosistema</a><a href="/modulos">Módulos</a><a href="#sectores">Sectores</a><a href="/login">Ingresar</a></div>
      </div>
      <div className="nh-shell flex flex-col gap-2 border-t border-white/10 py-5 text-[10px] uppercase tracking-[0.16em] text-white/30 sm:flex-row sm:items-center sm:justify-between"><span>© {new Date().getFullYear()} NovaHub</span><span>Todo comienza a conectarse.</span></div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div id="novahub-landing" className="min-h-screen overflow-x-hidden bg-[#f7f7f4] text-[#141313] antialiased selection:bg-[#C8E6D0] selection:text-[#01422C]">
      <Header />
      <main><HeroSection /><SignalStrip /><ManifestoSection /><EcosystemSection /><ModulesSection /><IndustriesSection /><ProcessSection /><ProductProofSection /><AboutSection /><FinalCTA /></main>
      <Footer />
      <LandingChatModal />
    </div>
  );
}
