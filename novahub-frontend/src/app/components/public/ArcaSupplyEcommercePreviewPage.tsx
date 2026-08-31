import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleUserRound,
  CreditCard,
  FileText,
  LayoutGrid,
  MapPin,
  Menu,
  MessageCircle,
  Monitor,
  Package,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
  X,
} from 'lucide-react';

type Category = 'Todos' | 'Tecnología' | 'Operación' | 'Despacho' | 'Servicios';

type Product = {
  category: Exclude<Category, 'Todos'>;
  code: string;
  name: string;
  summary: string;
  price: string;
  availability: string;
  tone: 'blue' | 'green' | 'sand' | 'violet';
  icon: typeof Monitor;
};

type Plan = {
  id: 'catalogo' | 'commerce';
  eyebrow: string;
  name: string;
  price: string;
  shortDescription: string;
  bestFor: string;
  includes: string[];
  notIncluded: string[];
  featured?: boolean;
};

const categories: Category[] = ['Todos', 'Tecnología', 'Operación', 'Despacho', 'Servicios'];

const products: Product[] = [
  { category: 'Tecnología', code: 'ARCA-TEC-001', name: 'Soluciones de conectividad', summary: 'Equipos y accesorios para mantener tu operación comunicada.', price: 'Cotizar', availability: 'Disponible para cotizar', tone: 'blue', icon: Monitor },
  { category: 'Operación', code: 'ARCA-OPS-014', name: 'Equipamiento para tu equipo', summary: 'Herramientas pensadas para trabajar con más continuidad.', price: 'Cotizar', availability: 'Entrega coordinada', tone: 'green', icon: PackageCheck },
  { category: 'Despacho', code: 'ARCA-DES-008', name: 'Soluciones para despacho', summary: 'Lo necesario para preparar, organizar y entregar mejor.', price: 'Cotizar', availability: 'Stock por confirmar', tone: 'sand', icon: Truck },
  { category: 'Servicios', code: 'ARCA-SRV-003', name: 'Acompañamiento comercial', summary: 'Te ayudamos a encontrar la solución que realmente necesitas.', price: 'Hablar con un asesor', availability: 'Atención personalizada', tone: 'violet', icon: MessageCircle },
];

const plans: Plan[] = [
  {
    id: 'catalogo',
    eyebrow: 'PRESENCIA DIGITAL',
    name: 'Catálogo que convierte',
    price: '$600',
    shortDescription: 'Una tienda clara para presentar tu oferta y abrir conversaciones comerciales.',
    bestFor: 'Ideal para ordenar tu presencia digital.',
    includes: ['Portada comercial y navegación', 'Catálogo por categorías', 'Fichas de productos y servicios', 'Botones de contacto y cotización', 'Diseño responsive'],
    notIncluded: ['Carrito de compra', 'Sincronización de inventario'],
  },
  {
    id: 'commerce',
    eyebrow: 'VENTA DIGITAL',
    name: 'Commerce conectado',
    price: '$1,000',
    shortDescription: 'La tienda preparada para recibir pedidos estructurados y darles seguimiento.',
    bestFor: 'Ideal para convertir visitas en oportunidades medibles.',
    includes: ['Todo lo del plan Catálogo', 'Carrito y solicitud de pedido', 'Datos de cliente y entrega', 'Disponibilidad y precios del catálogo', 'Registro y seguimiento de pedidos'],
    notIncluded: ['Comisiones de pasarela', 'Dominio, hosting y carga masiva'],
    featured: true,
  },
];

const productTone: Record<Product['tone'], string> = {
  blue: 'bg-[#dfeafa] text-[#1f5eaa]',
  green: 'bg-[#d9f2df] text-[#157346]',
  sand: 'bg-[#f7e9d3] text-[#a16218]',
  violet: 'bg-[#e9e1f7] text-[#6c46a0]',
};

function ProductArt({ product }: { product: Product }) {
  const Icon = product.icon;
  return (
    <div className={`relative flex h-44 flex-col justify-between overflow-hidden p-5 ${productTone[product.tone]}`}>
      <div className="absolute right-[-20px] top-[-28px] h-36 w-36 rounded-full border border-current/20" />
      <div className="absolute bottom-[-42px] left-[-20px] h-32 w-32 rounded-full border border-current/15" />
      <div className="relative flex items-start justify-between"><span className="rounded-md bg-white/75 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em]">{product.category}</span><span className="text-[9px] font-bold tracking-[0.14em]">ARCA</span></div>
      <div className="relative flex items-end justify-between"><div><p className="text-[9px] font-black tracking-[0.15em] opacity-70">{product.code}</p><p className="mt-1 max-w-[180px] text-xl font-black leading-[0.95] tracking-[-0.06em]">{product.name}</p></div><Icon size={38} strokeWidth={1.25} /></div>
    </div>
  );
}

function Storefront({ onProductSelect }: { onProductSelect: (product: Product) => void }) {
  const [category, setCategory] = useState<Category>('Todos');
  const [cartCount, setCartCount] = useState(0);
  const visibleProducts = useMemo(() => category === 'Todos' ? products : products.filter((product) => product.category === category), [category]);

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#d7e4da] bg-white shadow-[0_28px_75px_rgba(18,60,46,0.16)]">
      <div className="flex items-center gap-2 border-b border-[#e5ece6] bg-[#fafcfb] px-4 py-3"><span className="h-2.5 w-2.5 rounded-full bg-[#ff907d]" /><span className="h-2.5 w-2.5 rounded-full bg-[#f4bf5e]" /><span className="h-2.5 w-2.5 rounded-full bg-[#54c98a]" /><div className="ml-3 hidden h-7 flex-1 items-center rounded-md border border-[#e2eae3] bg-white px-3 text-[10px] font-semibold tracking-[0.12em] text-[#7c9685] sm:flex">arcasupply.com</div><span className="ml-auto text-[9px] font-black uppercase tracking-[0.15em] text-[#94a89a]">demo navegable</span></div>
      <div className="border-b border-[#e3ebe4] px-5 py-4 sm:px-7"><div className="flex items-center gap-5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#123c2e] text-white"><ShoppingBag size={17} /></div><div><p className="text-sm font-black tracking-[-0.04em] text-[#123c2e]">ARCA <span className="text-[#19ab6b]">SUPPLY</span></p><p className="text-[8px] font-bold tracking-[0.18em] text-[#8ca092]">EQUIPAR PARA CRECER</p></div></div><div className="hidden flex-1 items-center gap-5 text-[10px] font-black uppercase tracking-[0.1em] text-[#6b8274] md:flex"><span>Catálogo</span><span>Soluciones</span><span>Nosotros</span></div><div className="ml-auto flex items-center gap-3 text-[#315d48]"><Search size={16} /><CircleUserRound size={16} /><button type="button" onClick={() => setCartCount((count) => count + 1)} className="relative" aria-label="Agregar solicitud"><ShoppingBag size={17} />{cartCount > 0 && <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#18ad6b] text-[8px] font-black text-white">{cartCount}</span>}</button></div></div></div>
      <div className="bg-[#123c2e] px-5 py-3 text-center text-[10px] font-bold tracking-[0.11em] text-[#d3f1dc] sm:px-7">SOLUCIONES PARA TU OPERACIÓN · ASESORÍA PARA ELEGIR MEJOR</div>
      <div className="bg-[#fbfdfb] px-5 py-7 sm:px-8 sm:py-9"><div className="grid gap-8 lg:grid-cols-[0.65fr_1.35fr] lg:items-end"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#18a967]">CATÁLOGO ARCA SUPPLY</p><h3 className="mt-4 max-w-lg text-3xl font-black leading-[0.96] tracking-[-0.07em] text-[#123c2e] sm:text-4xl">Lo que necesitas para que tu operación avance.</h3><p className="mt-4 max-w-md text-sm leading-6 text-[#668172]">Encuentra una solución, revisa sus detalles y solicita acompañamiento sin perder tiempo.</p><button type="button" onClick={() => setCategory('Todos')} className="mt-5 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.13em] text-[#18a967]">Ver todo el catálogo <ArrowRight size={14} /></button></div><div className="grid gap-3 sm:grid-cols-3"><div className="border-l-2 border-[#18ad6b] pl-3"><p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#91a598]">Explora</p><p className="mt-2 text-sm font-black text-[#315b47]">Por categoría</p></div><div className="border-l-2 border-[#f1ba56] pl-3"><p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#91a598]">Compara</p><p className="mt-2 text-sm font-black text-[#315b47]">Con contexto</p></div><div className="border-l-2 border-[#789be1] pl-3"><p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#91a598]">Decide</p><p className="mt-2 text-sm font-black text-[#315b47]">Con asesoría</p></div></div></div><div className="mt-8 flex items-center justify-between gap-4 border-b border-[#dfeae1] pb-4"><div className="flex flex-wrap gap-2">{categories.map((item) => <button type="button" key={item} onClick={() => setCategory(item)} className={`rounded-full px-3 py-2 text-[9px] font-black uppercase tracking-[0.1em] transition ${category === item ? 'bg-[#123c2e] text-white' : 'bg-white text-[#698274] hover:bg-[#e6f4e8]'}`}>{item}</button>)}</div><button type="button" className="hidden items-center gap-2 text-[10px] font-bold text-[#698274] sm:flex"><SlidersHorizontal size={14} /> Filtrar</button></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{visibleProducts.map((product) => <article key={product.code} className="group overflow-hidden rounded-xl border border-[#dfe9e1] bg-white transition hover:-translate-y-1 hover:shadow-[0_16px_30px_rgba(18,60,46,0.1)]"><ProductArt product={product} /><div className="p-4"><p className="text-[9px] font-semibold text-[#93a398]">{product.code}</p><p className="mt-2 min-h-[40px] text-sm font-black leading-tight tracking-[-0.03em] text-[#1c4935]">{product.summary}</p><div className="mt-4 flex items-end justify-between gap-2 border-t border-[#edf2ed] pt-3"><div><p className="text-[9px] font-semibold text-[#81978a]">{product.availability}</p><p className="mt-1 text-xs font-black text-[#1c4935]">{product.price}</p></div><button type="button" onClick={() => onProductSelect(product)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e9f7ec] text-[#18a967] transition group-hover:bg-[#18a967] group-hover:text-white" aria-label={`Ver ${product.name}`}><ChevronRight size={15} /></button></div></div></article>)}</div></div>
      <div className="grid grid-cols-2 border-t border-[#e3ebe4] sm:grid-cols-4">{[['01', 'Encuentra'], ['02', 'Entiende'], ['03', 'Solicita'], ['04', 'Recibe']].map(([number, label], index) => <div key={label} className={`px-4 py-4 ${index < 3 ? 'border-r border-[#e3ebe4]' : ''} ${index > 1 ? 'border-t sm:border-t-0' : ''}`}><p className="text-[9px] font-black tracking-[0.15em] text-[#18ad6b]">{number}</p><p className="mt-2 text-[11px] font-bold text-[#315b47]">{label}</p></div>)}</div>
    </div>
  );
}

function ProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0b241c]/60 px-4 py-6 backdrop-blur-sm" role="presentation" onMouseDown={onClose}><motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} role="dialog" aria-modal="true" aria-labelledby="arca-product-title" onMouseDown={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-[0_32px_100px_rgba(5,35,23,0.28)]"><ProductArt product={product} /><div className="p-6 sm:p-8"><div className="flex items-start justify-between gap-5"><div><p className="text-[9px] font-black tracking-[0.16em] text-[#18a967]">{product.code} · {product.category}</p><h2 id="arca-product-title" className="mt-2 text-2xl font-black leading-tight tracking-[-0.05em] text-[#123c2e]">{product.name}</h2></div><button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-[#dbe8de] text-[#547564]" aria-label="Cerrar ficha"><X size={16} /></button></div><p className="mt-5 text-sm leading-6 text-[#668172]">{product.summary} Esta ficha puede mostrar características, disponibilidad, opciones y el camino correcto para solicitar una cotización.</p><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-[#f3f8f3] p-3"><p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8ba092]">Estado</p><p className="mt-1 text-xs font-bold text-[#315b47]">{product.availability}</p></div><div className="rounded-lg bg-[#f3f8f3] p-3"><p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8ba092]">Precio</p><p className="mt-1 text-xs font-bold text-[#315b47]">{product.price}</p></div><div className="rounded-lg bg-[#f3f8f3] p-3"><p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8ba092]">Atención</p><p className="mt-1 text-xs font-bold text-[#315b47]">Personalizada</p></div></div><a href="https://www.instagram.com/arcasupply/" target="_blank" rel="noreferrer" className="mt-7 flex items-center justify-center gap-2 rounded-xl bg-[#123c2e] px-5 py-3.5 text-xs font-black uppercase tracking-[0.12em] text-white">Solicitar cotización <ArrowRight size={15} /></a></div></motion.div></div>;
}

function PlanModal({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0b241c]/60 px-4 py-6 backdrop-blur-sm" role="presentation" onMouseDown={onClose}><motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} role="dialog" aria-modal="true" aria-labelledby="arca-plan-title" onMouseDown={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_32px_100px_rgba(5,35,23,0.28)] sm:p-8"><div className="flex items-start justify-between gap-5"><div><p className="text-[9px] font-black tracking-[0.17em] text-[#18a967]">{plan.eyebrow}</p><h2 id="arca-plan-title" className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#123c2e]">{plan.name}</h2></div><button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-[#dbe8de] text-[#547564]" aria-label="Cerrar plan"><X size={16} /></button></div><div className="mt-6 flex items-end justify-between gap-4 border-y border-[#e3ece5] py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#81998b]">Inversión inicial · pago único</p><p className="mt-1 text-5xl font-black tracking-[-0.08em] text-[#123c2e]">{plan.price}</p></div><span className="rounded-full bg-[#e3f7e8] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#087443]">Alcance a definir</span></div><p className="mt-5 text-sm leading-6 text-[#668172]">{plan.shortDescription}</p><div className="mt-6 grid gap-6 sm:grid-cols-2"><div><p className="text-xs font-black uppercase tracking-[0.12em] text-[#173f30]">Incluye</p><ul className="mt-3 space-y-3">{plan.includes.map((item) => <li key={item} className="flex gap-2 text-sm leading-5 text-[#5f7a6a]"><Check size={16} className="mt-0.5 shrink-0 text-[#17ad6b]" />{item}</li>)}</ul></div><div><p className="text-xs font-black uppercase tracking-[0.12em] text-[#173f30]">Se define aparte</p><ul className="mt-3 space-y-3">{plan.notIncluded.map((item) => <li key={item} className="flex gap-2 text-sm leading-5 text-[#7c8f83]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c5d3c9]" />{item}</li>)}</ul></div></div><a href="https://www.instagram.com/arcasupply/" target="_blank" rel="noreferrer" className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#123c2e] px-5 py-3.5 text-xs font-black uppercase tracking-[0.12em] text-white">Conversar sobre este plan <ArrowRight size={16} /></a></motion.div></div>;
}

export function ArcaSupplyEcommercePreviewPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  useEffect(() => {
    if (!selectedProduct && !selectedPlan) return undefined;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setSelectedProduct(null); setSelectedPlan(null); } };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = ''; };
  }, [selectedProduct, selectedPlan]);

  const scrollTo = (id: string) => { setMenuOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return <main className="min-h-screen overflow-hidden bg-[#f4f8f4] font-sans text-[#123c2e] selection:bg-[#bdeecb] selection:text-[#123c2e]">
    <header className="sticky top-0 z-50 border-b border-[#dfe9e1]/90 bg-[#fbfdfb]/95 backdrop-blur-xl"><div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12"><button type="button" onClick={() => scrollTo('inicio')} className="flex items-center gap-3 text-left" aria-label="Ir al inicio"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#123c2e] text-white"><ShoppingBag size={19} /></span><span><span className="block text-[15px] font-black tracking-[-0.04em] text-[#123c2e]">ARCA <span className="text-[#18ad6b]">SUPPLY</span></span><span className="block text-[8px] font-black tracking-[0.22em] text-[#87a092]">PROPUESTA DIGITAL</span></span></button><nav className="hidden items-center gap-8 text-[10px] font-black uppercase tracking-[0.14em] text-[#637f70] lg:flex"><button type="button" onClick={() => scrollTo('demo')} className="hover:text-[#14a868]">Experiencia</button><button type="button" onClick={() => scrollTo('alcance')} className="hover:text-[#14a868]">Alcance</button><button type="button" onClick={() => scrollTo('planes')} className="hover:text-[#14a868]">Planes</button></nav><div className="flex items-center gap-3"><button type="button" onClick={() => scrollTo('planes')} className="hidden items-center gap-2 rounded-full border border-[#cfe0d3] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#1b6047] hover:bg-[#eff9f1] sm:flex">Ver propuesta <ArrowRight size={14} /></button><button type="button" onClick={() => setMenuOpen((open) => !open)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d7e5da] text-[#174633] lg:hidden" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button></div></div>{menuOpen && <div className="border-t border-[#e5ece6] bg-white px-5 py-4 lg:hidden"><div className="mx-auto grid max-w-7xl gap-1"><button type="button" onClick={() => scrollTo('demo')} className="rounded-lg px-3 py-3 text-left text-xs font-bold text-[#345a48] hover:bg-[#f0f8f1]">Experiencia de compra</button><button type="button" onClick={() => scrollTo('alcance')} className="rounded-lg px-3 py-3 text-left text-xs font-bold text-[#345a48] hover:bg-[#f0f8f1]">Qué incluye</button><button type="button" onClick={() => scrollTo('planes')} className="rounded-lg px-3 py-3 text-left text-xs font-bold text-[#345a48] hover:bg-[#f0f8f1]">Planes</button></div></div>}</header>
    <section id="inicio" className="relative px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:px-12 lg:pb-28 lg:pt-24"><div className="absolute inset-0 bg-[linear-gradient(rgba(24,107,75,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(24,107,75,0.045)_1px,transparent_1px)] bg-[size:56px_56px]" /><div className="relative mx-auto grid max-w-7xl items-end gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16"><div><p className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.22em] text-[#16a967]"><span className="h-px w-8 bg-[#16a967]" />Experiencia ecommerce para Arca Supply</p><h1 className="mt-6 max-w-xl text-[clamp(3.3rem,7vw,6.6rem)] font-black leading-[0.86] tracking-[-0.085em] text-[#113c2d]">Una tienda que se entiende <span className="text-[#18ad6b]">en segundos.</span></h1><p className="mt-7 max-w-lg text-base leading-7 text-[#587565] sm:text-lg">Presenta tus soluciones, guía al cliente y recibe solicitudes con la información necesaria para atenderlas mejor.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => scrollTo('demo')} className="group inline-flex items-center justify-center gap-3 rounded-xl bg-[#123c2e] px-6 py-4 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_12px_24px_rgba(18,60,46,0.18)] hover:bg-[#0c2d22]">Explorar tienda <ArrowRight size={16} className="transition group-hover:translate-x-1" /></button><button type="button" onClick={() => scrollTo('planes')} className="inline-flex items-center justify-center gap-3 rounded-xl border border-[#bad3bf] bg-white/65 px-6 py-4 text-xs font-black uppercase tracking-[0.12em] text-[#225b43] hover:bg-white">Ver inversión <ChevronRight size={16} /></button></div><div className="mt-10 grid max-w-lg grid-cols-3 border-t border-[#c5dfca] pt-5">{[['01', 'Oferta ordenada'], ['02', 'Pedido guiado'], ['03', 'Seguimiento claro']].map(([number, text]) => <div key={number} className="pr-3"><p className="text-[9px] font-black tracking-[0.16em] text-[#16a967]">{number}</p><p className="mt-2 text-[11px] font-bold leading-4 text-[#406452]">{text}</p></div>)}</div></div><motion.div id="demo" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="scroll-mt-24"><div className="mb-4 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-[#729080]"><span>Vista navegable del ecommerce</span><span className="flex items-center gap-2 text-[#18a967]"><span className="h-2 w-2 rounded-full bg-[#18ad6b]" />Interfaz de muestra</span></div><Storefront onProductSelect={setSelectedProduct} /></motion.div></div></section>
    <section id="alcance" className="scroll-mt-20 bg-white px-5 py-20 sm:px-8 sm:py-28 lg:px-12"><div className="mx-auto max-w-7xl"><div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-end"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#16a967]">Qué resuelve para tu cliente</p><h2 className="mt-5 max-w-xl text-4xl font-black leading-[0.94] tracking-[-0.07em] text-[#123c2e] sm:text-6xl">No solo muestra.<br /><span className="text-[#18ad6b]">Hace avanzar la compra.</span></h2></div><p className="max-w-xl text-base leading-7 text-[#668172] lg:justify-self-end">La experiencia se construye alrededor de una pregunta sencilla: ¿qué necesita saber el cliente para dar el siguiente paso?</p></div><div className="mt-14 grid border-y border-[#dfeae1] md:grid-cols-4">{[{ icon: LayoutGrid, title: 'Descubre', text: 'Encuentra por categorías y necesidades.' }, { icon: FileText, title: 'Comprende', text: 'Ve fichas con información útil.' }, { icon: CreditCard, title: 'Solicita', text: 'Deja datos para cotizar o pedir.' }, { icon: ShieldCheck, title: 'Confía', text: 'Recibe seguimiento de tu equipo.' }].map(({ icon: Icon, title, text }, index) => <div key={title} className={`py-8 pr-6 md:px-6 md:py-10 ${index < 3 ? 'border-b md:border-b-0 md:border-r' : ''} border-[#dfeae1]`}><Icon size={22} strokeWidth={1.7} className="text-[#17ad6b]" /><p className="mt-6 text-lg font-black tracking-[-0.04em] text-[#153f30]">{title}</p><p className="mt-3 text-sm leading-6 text-[#6c8577]">{text}</p></div>)}</div></div></section>
    <section id="planes" className="scroll-mt-20 bg-[#f0f8f1] px-5 py-20 sm:px-8 sm:py-28 lg:px-12"><div className="mx-auto max-w-7xl"><div className="max-w-3xl"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#16a967]">La inversión depende del alcance</p><h2 className="mt-5 text-4xl font-black leading-[0.93] tracking-[-0.075em] text-[#123c2e] sm:text-6xl">Empieza con claridad.<br /><span className="text-[#18ad6b]">Crece con conexión.</span></h2><p className="mt-6 max-w-2xl text-base leading-7 text-[#668172]">Dos planes fáciles de explicar: uno presenta y convierte; el otro recibe pedidos y prepara la operación para crecer.</p></div><div className="mt-12 grid gap-5 lg:grid-cols-2">{plans.map((plan) => <article key={plan.id} className={`relative flex flex-col rounded-[22px] border p-7 sm:p-9 ${plan.featured ? 'border-[#18ad6b] bg-white shadow-[0_18px_45px_rgba(24,173,107,0.12)]' : 'border-[#d6e5d9] bg-[#fbfdfb]'}`}>{plan.featured && <span className="absolute right-7 top-7 rounded-full bg-[#18ad6b] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-white">Recomendado</span>}<p className="text-[10px] font-black tracking-[0.18em] text-[#16a967]">{plan.eyebrow}</p><h3 className="mt-5 max-w-sm text-3xl font-black tracking-[-0.06em] text-[#123c2e] sm:text-4xl">{plan.name}</h3><p className="mt-4 max-w-lg text-sm leading-6 text-[#668172]">{plan.shortDescription}</p><div className="mt-7 flex items-end justify-between gap-4 border-y border-[#dbe8de] py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7f9989]">Inversión inicial</p><p className="mt-1 text-5xl font-black tracking-[-0.08em] text-[#123c2e]">{plan.price}</p></div><p className="max-w-[150px] text-right text-[11px] font-bold leading-4 text-[#587565]">{plan.bestFor}</p></div><div className="mt-7 grid gap-3">{plan.includes.map((item) => <div key={item} className="flex items-start gap-2 text-sm text-[#4f6f5e]"><Check size={16} className="mt-0.5 shrink-0 text-[#18ad6b]" />{item}</div>)}</div><button type="button" onClick={() => setSelectedPlan(plan)} className={`mt-8 flex items-center justify-center gap-2 rounded-xl px-5 py-4 text-xs font-black uppercase tracking-[0.13em] transition ${plan.featured ? 'bg-[#123c2e] text-white hover:bg-[#0c2d22]' : 'border border-[#bdd6c2] bg-white text-[#205a42] hover:border-[#18ad6b] hover:bg-[#effaf1]'}`}>Ver alcance completo <ArrowRight size={16} /></button></article>)}</div></div></section>
    <section className="bg-[#123c2e] px-5 py-20 text-white sm:px-8 sm:py-28 lg:px-12"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-10 lg:flex-row lg:items-center"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#7ee3a7]">Siguiente paso</p><h2 className="mt-5 max-w-3xl text-4xl font-black leading-[0.92] tracking-[-0.075em] sm:text-6xl">Hagamos que tu catálogo<br /><span className="text-[#7ee3a7]">trabaje por tu equipo.</span></h2><p className="mt-6 max-w-xl text-base leading-7 text-[#b5d2be]">Revisamos tus categorías, productos y forma de atender pedidos para definir el alcance correcto.</p></div><a href="https://www.instagram.com/arcasupply/" target="_blank" rel="noreferrer" className="flex shrink-0 items-center justify-center gap-3 rounded-xl bg-[#18ad6b] px-7 py-4 text-xs font-black uppercase tracking-[0.13em] text-white hover:bg-[#25c87c]">Hablar con Arca Supply <ArrowRight size={16} /></a></div></section>
    <footer className="bg-[#0e2b22] px-5 py-8 text-[#96b5a2] sm:px-8 lg:px-12"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-[10px] font-bold uppercase tracking-[0.12em] sm:flex-row"><span>ARCA SUPPLY · PROPUESTA DIGITAL</span><span>Preview de experiencia · 2026</span></div></footer>
    {selectedProduct && <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />}
    {selectedPlan && <PlanModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />}
  </main>;
}

export default ArcaSupplyEcommercePreviewPage;
