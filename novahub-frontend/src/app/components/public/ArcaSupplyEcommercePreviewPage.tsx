import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Clock3,
  Menu,
  MessageCircle,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  X,
} from 'lucide-react';

type Product = {
  name: string;
  category: string;
  price: string;
  accent: string;
  badge?: string;
};

const products: Product[] = [
  { name: 'Selección para tu operación', category: 'Destacados', price: 'Desde $—', accent: 'from-[#dcefe7] via-[#eff7f2] to-[#f5eee6]', badge: 'Recomendado' },
  { name: 'Soluciones para cada espacio', category: 'Catálogo', price: 'Ver opciones', accent: 'from-[#f3e5d4] via-[#f8f1e7] to-[#e6eee9]' },
  { name: 'Productos listos para despacho', category: 'Novedades', price: 'Consultar', accent: 'from-[#e2e8f4] via-[#eef2f6] to-[#f5e7df]', badge: 'Nuevo' },
  { name: 'Compra con acompañamiento', category: 'Servicios', price: 'Cotizar', accent: 'from-[#e9e2f2] via-[#f2edf7] to-[#e3f0ed]' },
];

const categories = ['Todos', 'Destacados', 'Catálogo', 'Novedades', 'Servicios'];

const planFeatures = {
  starter: [
    'Landing de ecommerce adaptable a móvil',
    'Catálogo por categorías y productos',
    'Botones de contacto y solicitud por WhatsApp',
    'Carga inicial de contenido y estructura SEO',
    'Guía visual alineada a la marca Arca Supply',
  ],
  connected: [
    'Todo lo incluido en Catálogo + conversión',
    'Carrito y captura estructurada de pedidos',
    'Inventario, precios y disponibilidad conectados',
    'Estados del pedido y seguimiento comercial',
    'Base para pagos, delivery e integraciones',
  ],
};

function ProductVisual({ product }: { product: Product }) {
  return (
    <div className={`relative aspect-[1.1/1] overflow-hidden rounded-[1.35rem] bg-gradient-to-br ${product.accent}`}>
      <div className="absolute -right-8 -top-8 size-36 rounded-full border-[18px] border-white/40" />
      <div className="absolute -bottom-14 -left-8 size-44 rounded-full border border-[#174a3a]/10" />
      <div className="absolute left-6 top-6 flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#174a3a] shadow-sm backdrop-blur">
        <Sparkles className="size-3.5 text-[#e77d52]" /> Arca Supply
      </div>
      <div className="absolute bottom-6 left-6 right-6">
        <div className="mb-3 h-1.5 w-16 rounded-full bg-[#174a3a]/70" />
        <div className="h-3 w-4/5 rounded-full bg-[#174a3a]/20" />
        <div className="mt-2 h-2 w-2/5 rounded-full bg-[#174a3a]/15" />
      </div>
    </div>
  );
}

function PlanCard({
  name,
  price,
  eyebrow,
  description,
  features,
  featured = false,
}: {
  name: string;
  price: string;
  eyebrow: string;
  description: string;
  features: string[];
  featured?: boolean;
}) {
  return (
    <motion.article
      whileHover={{ y: -6 }}
      transition={{ duration: 0.2 }}
      className={`relative flex h-full flex-col rounded-[2rem] border p-7 sm:p-9 ${featured ? 'border-[#174a3a] bg-[#174a3a] text-white shadow-[0_24px_70px_rgba(23,74,58,0.18)]' : 'border-[#d8e5de] bg-white text-[#174a3a]'}`}
    >
      {featured && <span className="absolute right-6 top-6 rounded-full bg-[#a8efc8] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#174a3a]">Más completo</span>}
      <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${featured ? 'text-[#a8efc8]' : 'text-[#18a66a]'}`}>{eyebrow}</p>
      <h3 className="mt-4 text-2xl font-black tracking-[-0.04em] sm:text-3xl">{name}</h3>
      <p className={`mt-3 min-h-12 text-sm leading-6 ${featured ? 'text-white/70' : 'text-[#5d7884]'}`}>{description}</p>
      <div className="mt-7 flex items-end gap-2">
        <span className="text-5xl font-black tracking-[-0.07em]">{price}</span>
        <span className={`pb-1 text-xs font-bold ${featured ? 'text-white/60' : 'text-[#7b9298]'}`}>inversión inicial*</span>
      </div>
      <div className={`my-7 h-px ${featured ? 'bg-white/15' : 'bg-[#d8e5de]'}`} />
      <ul className="space-y-4 text-sm leading-5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${featured ? 'bg-[#a8efc8] text-[#174a3a]' : 'bg-[#e1f5ea] text-[#18a66a]'}`}><Check className="size-3.5" strokeWidth={3} /></span>
            <span className={featured ? 'text-white/85' : 'text-[#365a5d]'}>{feature}</span>
          </li>
        ))}
      </ul>
      <a href="#contacto" className={`mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-xs font-black uppercase tracking-[0.14em] transition-transform hover:scale-[1.02] ${featured ? 'bg-[#a8efc8] text-[#174a3a]' : 'border border-[#174a3a]/20 bg-[#f6faf7] text-[#174a3a]'}`}>
        Solicitar esta propuesta <ArrowRight className="size-4" />
      </a>
    </motion.article>
  );
}

export function ArcaSupplyEcommercePreviewPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [category, setCategory] = useState('Todos');
  const [cartCount, setCartCount] = useState(0);
  const visibleProducts = useMemo(() => category === 'Todos' ? products : products.filter((product) => product.category === category), [category]);

  const jumpTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7faf7] font-sans text-[#174a3a] selection:bg-[#a8efc8] selection:text-[#174a3a]">
      <header className="sticky top-0 z-50 border-b border-[#dbe8df]/80 bg-[#f7faf7]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <button type="button" onClick={() => jumpTo('inicio')} className="flex items-center gap-3 text-left" aria-label="Ir al inicio de Arca Supply">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#174a3a] text-lg font-black text-[#a8efc8] shadow-lg shadow-[#174a3a]/10">A</span>
            <span>
              <span className="block text-lg font-black leading-none tracking-[-0.05em]">ARCA <span className="text-[#18a66a]">SUPPLY</span></span>
              <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.25em] text-[#7a9291]">Propuesta ecommerce</span>
            </span>
          </button>

          <nav className="hidden items-center gap-8 text-[11px] font-black uppercase tracking-[0.15em] text-[#547378] lg:flex">
            <button type="button" onClick={() => jumpTo('catalogo')} className="transition-colors hover:text-[#18a66a]">Catálogo</button>
            <button type="button" onClick={() => jumpTo('flujo')} className="transition-colors hover:text-[#18a66a]">Cómo funcionaría</button>
            <button type="button" onClick={() => jumpTo('planes')} className="transition-colors hover:text-[#18a66a]">Planes</button>
            <a href="https://www.instagram.com/arcasupply/" target="_blank" rel="noreferrer" className="transition-colors hover:text-[#18a66a]">Instagram</a>
          </nav>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setCartCount((count) => count + 1)} className="relative hidden size-11 items-center justify-center rounded-full border border-[#d8e5de] bg-white text-[#174a3a] transition hover:border-[#18a66a] sm:flex" aria-label="Simular agregar producto al carrito">
              <ShoppingBag className="size-4" />
              {cartCount > 0 && <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[#e77d52] text-[10px] font-black text-white">{cartCount}</span>}
            </button>
            <button type="button" onClick={() => setMenuOpen((open) => !open)} className="flex size-11 items-center justify-center rounded-full bg-[#174a3a] text-[#a8efc8] transition hover:bg-[#0d3529] lg:hidden" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}>
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <button type="button" onClick={() => jumpTo('contacto')} className="hidden rounded-full bg-[#e77d52] px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-[#e77d52]/15 transition hover:bg-[#d56840] sm:inline-flex">Ver propuesta</button>
          </div>
        </div>
        {menuOpen && <div className="border-t border-[#dbe8df] bg-white px-5 py-5 lg:hidden"><div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs font-black uppercase tracking-[0.14em] text-[#547378]"><button type="button" onClick={() => jumpTo('catalogo')} className="text-left">Catálogo</button><button type="button" onClick={() => jumpTo('flujo')} className="text-left">Cómo funcionaría</button><button type="button" onClick={() => jumpTo('planes')} className="text-left">Planes</button><a href="https://www.instagram.com/arcasupply/" target="_blank" rel="noreferrer">Instagram</a></div></div>}
      </header>

      <main>
        <section id="inicio" className="relative isolate overflow-hidden bg-[#f7faf7]">
          <div className="absolute -right-32 top-8 -z-10 size-[34rem] rounded-full bg-[#cfeedd]/60 blur-3xl" />
          <div className="absolute -left-40 bottom-0 -z-10 size-[28rem] rounded-full bg-[#f4ded2]/50 blur-3xl" />
          <div className="mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-10 lg:pt-28">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#b9deca] bg-white/70 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#18a66a] shadow-sm"><span className="size-2 rounded-full bg-[#e77d52]" /> Preview exclusiva para Arca Supply</div>
              <h1 className="max-w-xl text-5xl font-black leading-[0.92] tracking-[-0.075em] sm:text-7xl lg:text-[5.65rem]">Tu catálogo listo para <span className="text-[#18a66a]">vender.</span></h1>
              <p className="mt-7 max-w-lg text-base leading-7 text-[#5d7884] sm:text-lg">Una experiencia de compra clara, rápida y alineada a la identidad de Arca Supply. El cliente descubre, consulta y convierte sin perder el contexto.</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <button type="button" onClick={() => jumpTo('catalogo')} className="inline-flex items-center gap-3 rounded-full bg-[#174a3a] px-6 py-4 text-xs font-black uppercase tracking-[0.14em] text-white shadow-xl shadow-[#174a3a]/15 transition hover:-translate-y-0.5">Explorar preview <ArrowRight className="size-4 text-[#a8efc8]" /></button>
                <button type="button" onClick={() => jumpTo('planes')} className="inline-flex items-center gap-3 rounded-full border border-[#174a3a]/20 bg-white px-6 py-4 text-xs font-black uppercase tracking-[0.14em] text-[#174a3a] transition hover:border-[#18a66a]">Ver planes</button>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-[10px] font-black uppercase tracking-[0.15em] text-[#72908d]"><span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-[#18a66a]" /> Marca consistente</span><span className="inline-flex items-center gap-2"><PackageCheck className="size-4 text-[#18a66a]" /> Catálogo ordenado</span><span className="inline-flex items-center gap-2"><Truck className="size-4 text-[#e77d52]" /> Listo para crecer</span></div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.96, rotate: 1 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="relative">
              <div className="absolute -left-4 top-10 z-10 rounded-2xl border border-white/70 bg-[#174a3a] px-5 py-4 text-white shadow-2xl shadow-[#174a3a]/20 sm:-left-7"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#a8efc8]">Experiencia</p><p className="mt-1 text-sm font-black">Descubre → consulta → compra</p></div>
              <div className="rounded-[2.25rem] border border-white bg-white p-3 shadow-[0_30px_100px_rgba(23,74,58,0.16)] sm:p-5">
                <div className="flex items-center justify-between border-b border-[#edf2ee] px-2 pb-4"><div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-[#e77d52]" /><span className="size-2.5 rounded-full bg-[#efc56b]" /><span className="size-2.5 rounded-full bg-[#72c59b]" /></div><div className="flex items-center gap-3 text-[#8ba09c]"><Search className="size-4" /><ShoppingBag className="size-4" /></div></div>
                <div className="grid gap-4 p-3 sm:grid-cols-2 sm:p-5"><div className="rounded-3xl bg-[#f1f8f2] p-6 sm:col-span-2"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#18a66a]">Selección Arca</p><h2 className="mt-3 max-w-sm text-3xl font-black leading-none tracking-[-0.06em] text-[#174a3a]">Encuentra lo que tu operación necesita.</h2><div className="mt-5 h-2 w-36 rounded-full bg-[#174a3a]/15" /><div className="mt-2 h-2 w-24 rounded-full bg-[#174a3a]/10" /></div>{products.slice(0, 2).map((product) => <div key={product.name} className="rounded-2xl bg-[#fbfcfb] p-2"><ProductVisual product={product} /><p className="mt-3 px-2 text-xs font-black text-[#174a3a]">{product.name}</p><p className="px-2 pb-2 pt-1 text-xs font-bold text-[#18a66a]">{product.price}</p></div>)}</div>
              </div>
              <div className="absolute -bottom-5 -right-4 flex items-center gap-3 rounded-2xl border border-[#d8e5de] bg-white px-4 py-3 shadow-xl sm:-right-7"><span className="flex size-9 items-center justify-center rounded-xl bg-[#e1f5ea] text-[#18a66a]"><BarChart3 className="size-4" /></span><span><span className="block text-[9px] font-black uppercase tracking-[0.17em] text-[#7a9291]">Conectado a NovaHub</span><span className="block text-xs font-black text-[#174a3a]">Pedido con seguimiento</span></span></div>
            </motion.div>
          </div>
        </section>

        <section id="catalogo" className="border-y border-[#dceae0] bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="flex flex-col justify-between gap-7 sm:flex-row sm:items-end"><div><p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#18a66a]">Así se sentiría la tienda</p><h2 className="mt-4 max-w-2xl text-4xl font-black leading-[0.95] tracking-[-0.065em] sm:text-6xl">Una vitrina que convierte atención en pedidos.</h2></div><p className="max-w-sm text-sm leading-6 text-[#6d8589]">Una pizca de la experiencia propuesta: contenido visual, categorías claras y una ruta corta hasta la conversación comercial.</p></div>
            <div className="mt-12 flex gap-2 overflow-x-auto pb-2">{categories.map((item) => <button type="button" key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] transition ${category === item ? 'bg-[#174a3a] text-white' : 'border border-[#d8e5de] bg-[#f7faf7] text-[#5d7884] hover:border-[#18a66a]'}`}>{item}</button>)}</div>
            <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{visibleProducts.map((product) => <motion.article layout key={product.name} className="group rounded-[1.5rem] border border-[#e0ebe3] bg-[#fbfdfb] p-3 transition hover:-translate-y-1 hover:border-[#b9deca] hover:shadow-xl hover:shadow-[#174a3a]/5"><div className="relative"><ProductVisual product={product} />{product.badge && <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-[#e77d52] shadow-sm">{product.badge}</span>}</div><div className="flex items-end justify-between gap-3 px-2 pb-2 pt-4"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8ba09c]">{product.category}</p><h3 className="mt-1 text-sm font-black leading-5 text-[#174a3a]">{product.name}</h3></div><ChevronRight className="size-4 shrink-0 text-[#18a66a] transition group-hover:translate-x-1" /></div><p className="px-2 pb-2 text-xs font-bold text-[#e77d52]">{product.price}</p></motion.article>)}</div>
          </div>
        </section>

        <section id="flujo" className="bg-[#edf7ef] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10"><div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start"><div><p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#18a66a]">Más que una página</p><h2 className="mt-4 text-4xl font-black leading-[0.95] tracking-[-0.065em] sm:text-6xl">La tienda y la operación hablan el mismo idioma.</h2><p className="mt-6 max-w-md text-base leading-7 text-[#5d7884]">La propuesta puede evolucionar desde una vitrina elegante hasta un canal conectado con el inventario, los pedidos y el seguimiento comercial.</p></div><div className="grid gap-3 sm:grid-cols-2">{[{ icon: Search, title: 'Descubrimiento', text: 'El cliente encuentra categorías, productos y contenido que sí entiende.' }, { icon: MessageCircle, title: 'Conversión', text: 'Cada consulta llega con contexto para responder y vender más rápido.' }, { icon: PackageCheck, title: 'Operación', text: 'El pedido puede pasar a inventario, preparación y estado de entrega.' }, { icon: BarChart3, title: 'Decisiones', text: 'La gerencia ve qué se consulta, qué se vende y qué debe impulsarse.' }].map(({ icon: Icon, title, text }, index) => <motion.div whileHover={{ y: -3 }} key={title} className="rounded-3xl border border-[#cfe4d5] bg-white p-6"><div className="flex items-center justify-between"><span className="flex size-11 items-center justify-center rounded-2xl bg-[#e1f5ea] text-[#18a66a]"><Icon className="size-5" /></span><span className="text-xs font-black text-[#b0c6bd]">0{index + 1}</span></div><h3 className="mt-6 text-lg font-black text-[#174a3a]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#6d8589]">{text}</p></motion.div>)}</div></div></div>
        </section>

        <section id="planes" className="bg-[#f7faf7] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10"><div className="max-w-2xl"><p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#18a66a]">Dos formas de comenzar</p><h2 className="mt-4 text-4xl font-black leading-[0.95] tracking-[-0.065em] sm:text-6xl">Elige el alcance que necesita Arca Supply hoy.</h2><p className="mt-6 text-sm leading-6 text-[#6d8589]">Precios referenciales para conversar el alcance. El dominio, hosting, pasarela de pago, fotografía y carga masiva se confirman en la propuesta final.</p></div><div className="mt-12 grid gap-6 lg:grid-cols-2"><PlanCard name="Catálogo + conversión" price="$600" eyebrow="Plan 01 · Presencia comercial" description="Una tienda visual, clara y lista para recibir consultas y convertir visitas en oportunidades." features={planFeatures.starter} /><PlanCard name="Tienda conectada" price="$1,000" eyebrow="Plan 02 · Operación integrada" description="Una base ecommerce más completa, preparada para conectar pedidos, inventario y seguimiento." features={planFeatures.connected} featured /></div><p className="mt-6 text-xs leading-5 text-[#8ba09c]">* Los montos son una referencia inicial y deben cerrarse según productos, integraciones, contenido, logística y condiciones comerciales.</p></div>
        </section>

        <section id="contacto" className="bg-[#174a3a] py-20 text-white sm:py-28">
          <div className="mx-auto flex max-w-7xl flex-col gap-10 px-5 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-10"><div><p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#a8efc8]">Siguiente paso</p><h2 className="mt-4 max-w-3xl text-4xl font-black leading-[0.94] tracking-[-0.065em] sm:text-6xl">Arca Supply merece un canal digital a su altura.</h2><p className="mt-6 max-w-xl text-base leading-7 text-white/65">Esta pantalla es una preview comercial. La tienda productiva se definiría con catálogo real, reglas de venta, medios de pago y logística.</p></div><div className="flex flex-wrap gap-3"><a href="https://www.instagram.com/arcasupply/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-3 rounded-full bg-[#a8efc8] px-6 py-4 text-xs font-black uppercase tracking-[0.14em] text-[#174a3a] transition hover:bg-white">Ver Instagram <ArrowRight className="size-4" /></a><button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="inline-flex items-center gap-3 rounded-full border border-white/20 px-6 py-4 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:border-[#a8efc8]">Volver arriba <ArrowRight className="size-4 -rotate-90" /></button></div></div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#103329] px-5 py-7 text-white/55 sm:px-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col gap-3 text-[10px] font-black uppercase tracking-[0.16em] sm:flex-row sm:items-center sm:justify-between"><span>Preview preparada para Arca Supply</span><span>NovaHub Commerce · 2026</span></div></footer>
      <div className="fixed bottom-5 right-5 z-40"><button type="button" onClick={() => jumpTo('contacto')} className="flex size-14 items-center justify-center rounded-full bg-[#e77d52] text-white shadow-2xl shadow-[#e77d52]/30 transition hover:scale-105" aria-label="Solicitar propuesta"><MessageCircle className="size-6" /></button></div>
      <div className="sr-only"><Clock3 /> <ShoppingBag /></div>
    </div>
  );
}

export default ArcaSupplyEcommercePreviewPage;
