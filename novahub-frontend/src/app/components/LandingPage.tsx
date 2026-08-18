import { useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Check, Shield, Clock, Database, Lock, Users, ArrowRight, Zap, Globe, Mail, Download, Calculator, Package, BarChart3, ShoppingCart, Receipt, Briefcase, Headphones, BookOpen, Settings, ChevronDown, Star } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

const EXCHANGE_RATE = 36.5;

const fadeIn = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } };
const fadeInLeft = { hidden: { opacity: 0, x: -40 }, visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } };
const fadeInRight = { hidden: { opacity: 0, x: 40 }, visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } };
const stagger = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const scaleIn = { hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } };
const popIn = { hidden: { opacity: 0, scale: 0.5, rotate: -5 }, visible: { opacity: 1, scale: 1, rotate: 0, transition: { duration: 0.5, type: 'spring', stiffness: 200 } } };

const BASE_MODULES = [
  { name: 'Inventario', icon: Package, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { name: 'Ventas', icon: Receipt, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { name: 'Compras', icon: ShoppingCart, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { name: 'Caja', icon: BarChart3, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { name: 'Finanzas', icon: Calculator, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  { name: 'Reportes', icon: BarChart3, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  { name: 'Actividades', icon: Briefcase, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { name: 'Herramientas', icon: Settings, color: 'text-slate-500', bg: 'bg-slate-500/10' },
  { name: 'Tickets', icon: Headphones, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { name: 'Conocimiento', icon: BookOpen, color: 'text-teal-500', bg: 'bg-teal-500/10' },
];

const EXTRA_MODULES = [
  { name: 'Contabilidad', icon: Calculator, priceUsd: 100, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { name: 'Recursos Humanos', icon: Users, priceUsd: 85, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
];

const SECURITY = [
  { icon: Database, title: 'Servidores AWS', desc: 'Infraestructura dedicada en Amazon Web Services con servidores aislados por cliente.', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { icon: Lock, title: 'Cifrado Total', desc: 'TLS 1.3 en transito, AES-256 en reposo. Tus datos viajan y se almacenan cifrados.', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { icon: Clock, title: 'Backups Semanales', desc: 'Copias automaticas cada 7 dias con retencion de 30 dias. Restauracion garantizada.', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { icon: Shield, title: 'Confidencialidad', desc: 'Contrato legal. Datos aislados por tenant. Cero filtraciones bajo responsabilidad.', color: 'text-rose-500', bg: 'bg-rose-500/10' },
];

function WaveDivider({ flip = false, color = 'fill-muted/20' }: { flip?: boolean; color?: string }) {
  return (
    <div className={`w-full overflow-hidden leading-[0] ${flip ? 'rotate-180' : ''}`}>
      <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-16 md:h-24">
        <path d="M0,60 C150,120 350,0 600,60 C850,120 1050,0 1200,60 L1200,120 L0,120 Z" className={color} />
      </svg>
    </div>
  );
}

function FloatingBlob({ className }: { className: string }) {
  return <div className={`absolute rounded-full blur-[100px] pointer-events-none animate-pulse ${className}`} style={{ animationDuration: '4s' }} />;
}

function formatPrice(usd: number, currency: 'USD' | 'NIO') {
  if (currency === 'NIO') return `C$${(usd * EXCHANGE_RATE).toLocaleString('es-NI')}`;
  return `$${usd.toLocaleString('en-US')}`;
}

function downloadContract() {
  import('jspdf').then(({ jsPDF }) => {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const ml = 25;
    const mr = 25;
    const cw = pw - ml - mr;
    let y = 0;

    const addPage = () => { doc.addPage(); y = 25; };
    const checkPage = (needed: number) => { if (y + needed > ph - 30) addPage(); };

    // ─── PAGE 1: HEADER ───
    doc.setFillColor(25, 25, 25);
    doc.rect(0, 0, pw, 40, 'F');
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('NOVAHUB', ml, 24);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 160, 160);
    doc.text('SOLUCIONES EMPRESARIALES INTEGRADAS', ml + 72, 24);

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Managua, Nicaragua`, pw - mr, 18, { align: 'right' });
    doc.text(`${new Date().toLocaleDateString('es-NI', { year: 'numeric', month: 'long', day: 'numeric' })}`, pw - mr, 24, { align: 'right' });

    // Accent line
    doc.setFillColor(225, 29, 72);
    doc.rect(0, 40, pw, 2, 'F');

    y = 58;

    // Title block
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(25, 25, 25);
    doc.text('CONTRATO DE LICENCIA DE USO DE SOFTWARE', pw / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Modelo Software como Servicio (SaaS)', pw / 2, y, { align: 'center' });
    y += 12;

    // Divider
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(ml, y, pw - mr, y);
    y += 12;

    // ─── PARTIES ───
    const sectionTitle = (num: string, title: string) => {
      checkPage(20);
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(ml, y - 4, cw, 9, 1, 1, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(25, 25, 25);
      doc.text(`${num}. ${title.toUpperCase()}`, ml + 4, y + 2.5);
      y += 12;
    };

    const bodyText = (text: string, indent = 0) => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      const lines = doc.splitTextToSize(text, cw - indent * 4);
      for (const line of lines) {
        checkPage(6);
        doc.text(line, ml + indent, y);
        y += 4.5;
      }
      y += 2;
    };

    const fieldLine = (label: string) => {
      checkPage(8);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      doc.text(label, ml + 2, y + 1);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.line(ml + 55, y + 1.5, pw - mr - 2, y + 1.5);
      y += 9;
    };

    sectionTitle('I', 'Partes Contratantes');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('EL PROVEEDOR:', ml + 2, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('NovaHub — Empresa de tecnologia y software.', ml + 6, y);
    y += 9;

    doc.setFont('helvetica', 'bold');
    doc.text('EL CLIENTE:', ml + 2, y);
    y += 7;

    fieldLine('Razon Social / Nombre:  ____________________________________________');
    fieldLine('RUC / Cedula:  ____________________________________________');
    fieldLine('Representante Legal:  ____________________________________________');
    fieldLine('Correo Electronico:  ____________________________________________');
    fieldLine('Direccion:  ____________________________________________');
    fieldLine('Telefono:  ____________________________________________');
    y += 4;

    // ─── SECTIONS ───
    sectionTitle('II', 'Objeto del Contrato');
    bodyText('EL PROVEEDOR otorga a EL CLIENTE una licencia de uso del software NOVAHUB ERP, bajo el modelo de pago por uso a plazo de doce (12) meses. EL CLIENTE podra utilizar el software para todas sus operaciones comerciales internas incluyendo, pero no limitado a: inventario, ventas, compras, contabilidad, recursos humanos, reportes y demas modulos incluidos en el plan contratado.');

    sectionTitle('III', 'Duracion');
    bodyText('Este contrato tiene una duracion de DOCE (12) meses a partir de la fecha de activacion del servicio. La renovacion es automatica por periodos iguales salvo que cualquiera de las partes notifique por escrito su intencion de no renovar con al menos treinta (30) dias de antelacion al vencimiento del periodo vigente.');

    sectionTitle('IV', 'Licencia de Uso');
    bodyText('EL CLIENTE adquiere el derecho de uso del software NOVAHUB ERP para sus operaciones comerciales internas. Esta licencia es intransferible, no exclusiva y esta vinculada exclusivamente a la empresa contratante. EL CLIENTE no podra: (a) revender, arrendar o ceder la licencia a terceros; (b) descompilar, modificar o crear trabajos derivados del software; (c) eliminar o alterar avisos de propiedad intelectual.');

    sectionTitle('V', 'Precio y Forma de Pago');
    bodyText('Los precios aplicables son los siguientes:', 0);
    y += 1;

    const pricingItems = [
      ['Paquete Base (10 modulos, 5 usuarios)', 'USD $600.00 / anio'],
      ['Modulo Contabilidad (adicional)', 'USD $100.00 / mes'],
      ['Modulo Recursos Humanos (adicional)', 'USD $85.00 / mes'],
      ['Usuario adicional', 'USD $5.00 / mes'],
      ['Implementacion y configuracion', 'USD $200.00 (pago unico)'],
      ['Dominio + Hosting + 5 correos', 'USD $100.00 / anio'],
    ];
    for (const [desc, price] of pricingItems) {
      checkPage(8);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(`• ${desc}`, ml + 6, y);
      doc.setFont('helvetica', 'bold');
      doc.text(price, pw - mr - 2, y, { align: 'right' });
      y += 5.5;
    }
    y += 2;
    bodyText('El pago total anual se realizara por adelantado via transferencia bancaria o tarjeta de credito/debito. Los pagos mensuales de modulos adicionales se facturaran el primer dia de cada mes.');

    sectionTitle('VI', 'Implementacion');
    bodyText('EL PROVEEDOR se compromete a realizar la implementacion completa del ERP, incluyendo: (a) configuracion inicial del sistema con datos de la empresa; (b) carga de datos iniciales (clientes, proveedores, productos, inventario); (c) configuracion de modulos seleccionados; (d) capacitacion basica al personal designado por EL CLIENTE. La implementacion tiene una duracion estimada de quince (15) dias habiles a partir de la confirmacion del pago.');

    sectionTitle('VII', 'Confidencialidad y Proteccion de Datos');
    bodyText('EL PROVEEDOR se compromete a: (a) mantener estricta confidencialidad sobre toda la informacion de EL CLIENTE; (b) almacenar datos unicamente en servidores privados de Amazon Web Services (AWS) con cifrado AES-256 en reposo y TLS 1.3 en transito; (c) realizar copias de seguridad automaticas cada siete (7) dias con retencion de treinta (30) dias; (d) no compartir, vender ni divulgar datos de EL CLIENTE a terceros bajo ninguna circunstancia; (e) garantizar confidencialidad absoluta bajo responsabilidad contractual y legal. Los datos de cada cliente estan fisicamente aislados (multi-tenant architecture).');

    sectionTitle('VIII', 'Soporte Tecnico');
    bodyText('Incluido en el plan: soporte tecnico via ticket y correo electronico durante horario laboral de lunes a viernes de 8:00 AM a 5:00 PM (hora de Nicaragua). El soporte cubre incidencias tecnicas, consultas de uso y orientacion en la configuracion del sistema. No incluye desarrollo personalizado ni integraciones con sistemas de terceros.');

    sectionTitle('IX', 'Propiedad Intelectual');
    bodyText('El software NOVAHUB ERP, su codigo fuente, documentacion, disenos, interfaces y todos los derechos de propiedad intelectual pertenecen exclusivamente a EL PROVEEDOR. EL CLIENTE no adquiere ningun derecho de propiedad sobre el software, unicamente una licencia de uso limitada y revocable conforme a los terminos de este contrato.');

    sectionTitle('X', 'Terminacion');
    bodyText('Cualquiera de las partes podra dar por terminado este contrato mediante notificacion por escrito con treinta (30) dias de antelacion. En caso de terminacion, EL PROVEEDOR proporcionara a EL CLIENTE un archivo exportado de todos sus datos en formato estandar (CSV o JSON) dentro de los quince (15) dias siguientes a la notificacion. El uso del software cesara inmediatamente al vencimiento del periodo de notificacion.');

    sectionTitle('XI', 'Ley Aplicable y Jurisdiccion');
    bodyText('Este contrato se rige e interpreta conforme a las leyes de la Republica de Nicaragua. Cualquier controversia derivada de este contrato sera resuelta en los tribunales competentes de Managua, Nicaragua, renunciando expresamente a cualquier otro fuero que pudiera corresponderles.');

    // ─── SIGNATURES ───
    checkPage(60);
    y += 6;
    doc.setDrawColor(220, 220, 220);
    doc.line(ml, y, pw - mr, y);
    y += 14;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(25, 25, 25);
    doc.text('FIRMAS', pw / 2, y, { align: 'center' });
    y += 16;

    // Left signature
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.4);
    doc.line(ml, y, ml + 80, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('EL PROVEEDOR', ml + 40, y, { align: 'center' });
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('NovaHub', ml + 40, y, { align: 'center' });
    y += 5;
    doc.text('Fecha: _______________', ml + 40, y, { align: 'center' });

    // Right signature
    const rx = pw - mr - 80;
    y -= 14;
    doc.line(rx, y, rx + 80, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('EL CLIENTE', rx + 40, y, { align: 'center' });
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Nombre: ___________________', rx + 40, y, { align: 'center' });
    y += 5;
    doc.text('Fecha: _______________', rx + 40, y, { align: 'center' });

    // ─── FOOTER ───
    const footerY = ph - 15;
    doc.setDrawColor(225, 29, 72);
    doc.setLineWidth(0.5);
    doc.line(ml, footerY, pw - mr, footerY);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text('NovaHub — Soluciones Empresariales Integradas — www.novahub.com.ni', pw / 2, footerY + 5, { align: 'center' });
    doc.text('Este documento es un ejemplo del contrato de licencia. Los terminos finales seran confirmados al momento de la firma.', pw / 2, footerY + 9, { align: 'center' });

    doc.save('Contrato_Licencia_NOVAHUB_ERP.pdf');
  });
}

export default function LandingPage() {
  const [currency, setCurrency] = useState<'USD' | 'NIO'>('USD');
  const [scrolled, setScrolled] = useState(false);
  const { scrollYProgress } = useScroll();
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.97]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0.6]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased overflow-x-hidden">
      {/* Nav */}
      <motion.nav initial={{ y: -80 }} animate={{ y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? 'bg-background/95 backdrop-blur-xl shadow-lg shadow-black/5 border-b border-border/30' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/landing" className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-foreground">NovaHub</span>
          </a>
          <div className="hidden md:flex items-center gap-7 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <a href="#modules" className="hover:text-foreground transition-colors">Modulos</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Precios</a>
            <a href="#security" className="hover:text-foreground transition-colors">Seguridad</a>
            <a href="#contract" className="hover:text-foreground transition-colors">Contrato</a>
          </div>
          <div className="flex items-center gap-3">
            <a href="/login"><Button variant="ghost" className="text-xs font-bold uppercase tracking-widest hidden sm:inline-flex">Iniciar Sesion</Button></a>
            <a href="/register"><Button className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold uppercase tracking-widest px-5 h-9 rounded-xl shadow-lg shadow-primary/25">Comenzar</Button></a>
          </div>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="relative pt-32 pb-8 px-4 overflow-hidden">
        <FloatingBlob className="top-20 left-[10%] w-[600px] h-[600px] bg-primary/[0.06]" />
        <FloatingBlob className="top-40 right-[5%] w-[400px] h-[400px] bg-primary/[0.04]" style={{ animationDelay: '2s' } as any} />
        <FloatingBlob className="bottom-0 left-[40%] w-[500px] h-[500px] bg-primary/[0.03]" style={{ animationDelay: '4s' } as any} />

        <motion.div style={{ scale: heroScale, opacity: heroOpacity }} className="relative max-w-5xl mx-auto text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={popIn}>
              <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 text-[10px] font-bold uppercase tracking-[0.25em] px-5 py-1.5 shadow-sm">ERP para Negocios Nicaraguenses</Badge>
            </motion.div>
            <motion.h1 variants={fadeIn} className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
              Tu negocio{' '}
              <span className="relative inline-block">
                <span className="relative z-10 text-primary">centralizado</span>
                <motion.span initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ delay: 0.8, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute bottom-1 left-0 h-3 bg-primary/15 -z-0 rounded-full" />
              </span>
              <br />
              <span className="text-2xl sm:text-3xl md:text-5xl text-muted-foreground/70 font-medium mt-2 block">en una sola plataforma</span>
            </motion.h1>
            <motion.p variants={fadeIn} className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Inventario, ventas, compras, contabilidad, RRHH y mas. Todo integrado para que crezcas sin complicaciones.
            </motion.p>
            <motion.div variants={fadeIn} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="#pricing">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs uppercase tracking-widest px-10 h-12 rounded-xl shadow-xl shadow-primary/25 gap-2">
                  Ver Planes <ArrowRight className="size-4" />
                </Button>
              </a>
              <a href="#modules">
                <Button size="lg" variant="outline" className="font-bold text-xs uppercase tracking-widest px-10 h-12 rounded-xl border-2">
                  Explorar Modulos
                </Button>
              </a>
            </motion.div>
            <motion.div variants={fadeIn} className="mt-12 flex items-center justify-center gap-1 text-muted-foreground/40">
              <ChevronDown className="size-5 animate-bounce" style={{ animationDuration: '1.5s' }} />
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      <WaveDivider color="fill-primary/[0.08]" />

      {/* Modules */}
      <section id="modules" className="relative py-20 px-4 bg-gradient-to-b from-primary/[0.02] to-transparent">
        <FloatingBlob className="top-20 right-[10%] w-[400px] h-[400px] bg-blue-500/[0.03]" />
        <div className="max-w-6xl mx-auto relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} className="text-center mb-14">
            <motion.div variants={popIn}><Badge className="mb-4 bg-blue-500/10 text-blue-500 border-blue-500/20 text-[9px] font-bold uppercase tracking-widest">Modulos</Badge></motion.div>
            <motion.h2 variants={fadeIn} className="text-3xl md:text-4xl font-black tracking-tight mb-4">Todo lo que necesitas, <span className="text-primary">nada que no</span></motion.h2>
            <motion.p variants={fadeIn} className="text-sm text-muted-foreground max-w-lg mx-auto">10 modulos incluidos en el plan base. Disenados para trabajar juntos, sin integraciones complicadas.</motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={stagger} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
            {BASE_MODULES.map((mod, i) => (
              <motion.div key={mod.name} variants={scaleIn} whileHover={{ y: -6, scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }}
                className="rounded-2xl border border-border/40 bg-background/80 backdrop-blur p-5 text-center hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 transition-shadow cursor-default">
                <div className={`size-12 rounded-xl ${mod.bg} mx-auto mb-3 flex items-center justify-center`}>
                  <mod.icon className={`size-6 ${mod.color}`} />
                </div>
                <p className="text-xs font-bold">{mod.name}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="mt-6 flex flex-wrap justify-center gap-4">
            {EXTRA_MODULES.map((mod) => (
              <motion.div key={mod.name} variants={scaleIn} whileHover={{ y: -4 }} className="rounded-2xl border-2 border-amber-500/30 bg-background/80 backdrop-blur p-5 px-7 flex items-center gap-4 hover:border-amber-500/50 hover:shadow-lg transition-all cursor-default">
                <div className={`size-12 rounded-xl ${mod.bg} flex items-center justify-center`}><mod.icon className={`size-6 ${mod.color}`} /></div>
                <div className="text-left">
                  <p className="text-sm font-bold">{mod.name}</p>
                  <p className="text-[11px] text-muted-foreground">+{formatPrice(mod.priceUsd, currency)}/mes</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <WaveDivider flip color="fill-primary/[0.08]" />

      {/* Pricing */}
      <section id="pricing" className="relative py-24 px-4">
        <FloatingBlob className="top-10 left-[5%] w-[500px] h-[500px] bg-emerald-500/[0.03]" />
        <div className="max-w-6xl mx-auto relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} className="text-center mb-14">
            <motion.div variants={popIn}><Badge className="mb-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] font-bold uppercase tracking-widest">Precios</Badge></motion.div>
            <motion.h2 variants={fadeIn} className="text-3xl md:text-4xl font-black tracking-tight mb-4">Precios <span className="text-primary">transparentes</span></motion.h2>
            <motion.p variants={fadeIn} className="text-sm text-muted-foreground mb-8">Sin sorpresas. Paga solo lo que necesitas.</motion.p>
            <motion.div variants={fadeIn} className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-1 shadow-inner">
              <button onClick={() => setCurrency('USD')} className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 ${currency === 'USD' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'text-muted-foreground hover:text-foreground'}`}>USD</button>
              <button onClick={() => setCurrency('NIO')} className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 ${currency === 'NIO' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'text-muted-foreground hover:text-foreground'}`}>Cordobas (C$)</button>
            </motion.div>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={stagger} className="grid md:grid-cols-3 gap-5 md:gap-6">
            {/* Base */}
            <motion.div variants={scaleIn} whileHover={{ y: -8 }} className="rounded-3xl border border-border/40 bg-background/80 backdrop-blur p-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 text-[9px] font-bold uppercase tracking-widest relative z-10">Base</Badge>
              <div className="mb-5 relative z-10">
                <motion.span key={currency} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-4xl font-black">{formatPrice(600, currency)}</motion.span>
                <span className="text-sm text-muted-foreground"> /anio</span>
              </div>
              <p className="text-xs text-muted-foreground mb-6 relative z-10">10 modulos incluidos con 5 usuarios</p>
              <ul className="space-y-2.5 mb-8 relative z-10">
                {BASE_MODULES.map(m => <li key={m.name} className="flex items-center gap-2.5 text-xs"><Check className="size-4 text-primary shrink-0" />{m.name}</li>)}
              </ul>
              <a href="/register"><Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[10px] uppercase tracking-widest h-10 rounded-xl relative z-10">Comenzar</Button></a>
            </motion.div>

            {/* Contabilidad - Featured */}
            <motion.div variants={scaleIn} whileHover={{ y: -8 }} className="rounded-3xl border-2 border-primary bg-background p-8 relative overflow-hidden shadow-2xl shadow-primary/10 group">
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute -top-1 -right-1">
                <div className="bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-widest px-4 py-1 rounded-bl-xl rounded-tr-2xl shadow-lg">Popular</div>
              </div>
              <div className="mb-5 relative z-10 mt-2">
                <motion.span key={currency} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-4xl font-black">{formatPrice(100, currency)}</motion.span>
                <span className="text-sm text-muted-foreground"> /mes</span>
              </div>
              <p className="text-xs text-muted-foreground mb-6 relative z-10">Contabilidad completa para tu empresa</p>
              <ul className="space-y-2.5 mb-8 relative z-10">
                {['Plan de cuentas', 'Asientos contables', 'Balance general', 'Estado de resultados', 'Conciliacion bancaria', 'Reportes fiscales', 'IVA / IR automatico', 'Cuentas por pagar/cobrar'].map(f => <li key={f} className="flex items-center gap-2.5 text-xs"><Check className="size-4 text-primary shrink-0" />{f}</li>)}
              </ul>
              <a href="/register"><Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[10px] uppercase tracking-widest h-10 rounded-xl relative z-10 shadow-lg shadow-primary/25">Agregar modulo</Button></a>
            </motion.div>

            {/* RRHH */}
            <motion.div variants={scaleIn} whileHover={{ y: -8 }} className="rounded-3xl border border-border/40 bg-background/80 backdrop-blur p-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <Badge className="mb-4 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] font-bold uppercase tracking-widest relative z-10">RRHH</Badge>
              <div className="mb-5 relative z-10">
                <motion.span key={currency} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-4xl font-black">{formatPrice(85, currency)}</motion.span>
                <span className="text-sm text-muted-foreground"> /mes</span>
              </div>
              <p className="text-xs text-muted-foreground mb-6 relative z-10">Gestion completa de Recursos Humanos</p>
              <ul className="space-y-2.5 mb-8 relative z-10">
                {['Nomina Nicaragua (INSS/IR)', 'Control de asistencia', 'Vacaciones y permisos', 'Evaluaciones de desempeno', 'Capacitaciones', 'KPIs y metricas', 'Dashboard RRHH', 'Empleados y departamentos'].map(f => <li key={f} className="flex items-center gap-2.5 text-xs"><Check className="size-4 text-emerald-500 shrink-0" />{f}</li>)}
              </ul>
              <a href="/register"><Button variant="outline" className="w-full font-bold text-[10px] uppercase tracking-widest h-10 rounded-xl border-2 relative z-10">Agregar modulo</Button></a>
            </motion.div>
          </motion.div>

          {/* Extra pricing cards */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Users, label: 'Usuario adicional', price: 5, unit: '/mes', color: 'text-blue-500', bg: 'bg-blue-500/10' },
              { icon: Settings, label: 'Implementacion completa', price: 200, unit: 'pago unico', color: 'text-purple-500', bg: 'bg-purple-500/10' },
              { icon: Globe, label: 'Dominio + Hosting + 5 correos', price: 100, unit: '/anio', color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
            ].map((item, i) => (
              <motion.div key={item.label} variants={fadeIn} whileHover={{ y: -4 }} className="rounded-2xl border border-border/40 bg-muted/30 p-6 text-center hover:shadow-lg transition-all cursor-default">
                <div className={`size-11 rounded-xl ${item.bg} mx-auto mb-3 flex items-center justify-center`}><item.icon className={`size-5 ${item.color}`} /></div>
                <motion.p key={currency} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-black">{formatPrice(item.price, currency)}<span className="text-xs text-muted-foreground font-normal"> {item.unit}</span></motion.p>
                <p className="text-[11px] text-muted-foreground mt-1.5">{item.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <WaveDivider color="fill-primary/[0.08]" />

      {/* Security */}
      <section id="security" className="relative py-24 px-4 bg-gradient-to-b from-primary/[0.02] to-transparent">
        <FloatingBlob className="bottom-10 right-[10%] w-[400px] h-[400px] bg-rose-500/[0.03]" />
        <div className="max-w-6xl mx-auto relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} className="text-center mb-14">
            <motion.div variants={popIn}><Badge className="mb-4 bg-rose-500/10 text-rose-500 border-rose-500/20 text-[9px] font-bold uppercase tracking-widest">Seguridad</Badge></motion.div>
            <motion.h2 variants={fadeIn} className="text-3xl md:text-4xl font-black tracking-tight mb-4">Tus datos estan <span className="text-primary">protegidos</span></motion.h2>
            <motion.p variants={fadeIn} className="text-sm text-muted-foreground max-w-lg mx-auto">Infraestructura de clase mundial. Tu informacion es tuya y nadie mas puede acceder a ella.</motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={stagger} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SECURITY.map((f, i) => (
              <motion.div key={f.title} variants={scaleIn} whileHover={{ y: -6, scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }}
                className="rounded-2xl border border-border/40 bg-background/80 backdrop-blur p-7 text-center hover:shadow-xl transition-shadow cursor-default">
                <motion.div initial={{ rotate: -10, scale: 0 }} whileInView={{ rotate: 0, scale: 1 }} viewport={{ once: true }}
                  transition={{ delay: i * 0.1, type: 'spring', stiffness: 200 }}
                  className={`size-14 rounded-2xl ${f.bg} mx-auto mb-4 flex items-center justify-center`}>
                  <f.icon className={`size-7 ${f.color}`} />
                </motion.div>
                <h3 className="text-sm font-bold mb-2">{f.title}</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <WaveDivider flip color="fill-primary/[0.08]" />

      {/* Contract */}
      <section id="contract" className="relative py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] via-primary/[0.02] to-transparent p-10 md:p-14 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            <motion.div variants={fadeInLeft} className="flex flex-col md:flex-row items-start md:items-center gap-8 relative z-10">
              <motion.div initial={{ rotate: -20, scale: 0 }} whileInView={{ rotate: 0, scale: 1 }} viewport={{ once: true }} transition={{ type: 'spring', stiffness: 150 }}
                className="size-16 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0 shadow-lg shadow-primary/10">
                <Shield className="size-8 text-primary" />
              </motion.div>
              <div className="flex-1">
                <h3 className="text-2xl font-black mb-3">Contrato de Confidencialidad y Licencia</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-xl">Cada cliente recibe un contrato legal que garantiza la confidencialidad absoluta de sus datos. Nos comprometemos contractualmente a cero filtraciones. Tus datos se almacenan exclusivamente en servidores privados de AWS con backups cada 7 dias.</p>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button onClick={downloadContract} variant="outline" className="gap-2.5 font-bold text-xs uppercase tracking-widest h-11 rounded-xl border-2 hover:bg-primary hover:text-primary-foreground transition-colors">
                    <Download className="size-4" /> Descargar Contrato (PDF)
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <WaveDivider color="fill-primary" />

      {/* CTA */}
      <section className="relative py-24 px-4 bg-primary text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_60%)]" />
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-white/5 rounded-full blur-[100px] pointer-events-none" />
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div variants={popIn}>
            <div className="flex justify-center gap-1 mb-6">
              {[...Array(5)].map((_, i) => <Star key={i} className="size-5 fill-white/80 text-white/80" />)}
            </div>
          </motion.div>
          <motion.h2 variants={fadeIn} className="text-3xl md:text-5xl font-black tracking-tight mb-5">Listo para transformar tu negocio?</motion.h2>
          <motion.p variants={fadeIn} className="text-primary-foreground/75 max-w-lg mx-auto mb-10 text-sm md:text-base leading-relaxed">Empresas nicaraguenses ya confian en NovaHub ERP para gestionar sus operaciones diarias. Unete a ellas.</motion.p>
          <motion.div variants={fadeIn} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.a href="/register" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 font-bold text-xs uppercase tracking-widest px-10 h-12 rounded-xl shadow-2xl shadow-black/20 gap-2">
                Comenzar Ahora <ArrowRight className="size-4" />
              </Button>
            </motion.a>
            <motion.a href="mailto:ventas@novahub.com.ni" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button size="lg" variant="outline" className="border-2 border-white text-white bg-white/10 hover:bg-white hover:text-primary font-bold text-xs uppercase tracking-widest px-10 h-12 rounded-xl gap-2">
                <Mail className="size-4" /> Contactar Ventas
              </Button>
            </motion.a>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-background">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">NovaHub ERP</span>
          </div>
          <p className="text-[11px] text-muted-foreground">&copy; {new Date().getFullYear()} NovaHub. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
