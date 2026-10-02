import { Fragment, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { CheckCircle2, Download, FileText, Loader2, Pencil, Plus, Save, Search, Send, Sparkles, Trash2, X } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { enterpriseGroupsService, type PlatformQuote, type PlatformQuoteBillingOption, type PlatformQuoteItem } from '../../services/enterprise-groups.service';
import { calculatePlatformQuoteTotals, downloadPlatformQuoteCommercialReport, downloadPlatformQuotePdf, type CommercialReportOptions } from '../../utils/platformQuotePdf';
import { NovaHubLogoFull } from '../NovaHubLogo';

type BillingType = 'Cobrado' | 'Valor agregado';
type DiscountType = 'AMOUNT' | 'PERCENT';
type CommercialReport = CommercialReportOptions;
type DraftItem = Omit<PlatformQuoteItem, 'id' | 'amount' | 'sortOrder'> & { billingType: BillingType };
type DraftQuote = {
  prospectCompany: string; prospectName: string; prospectEmail: string; prospectPhone: string; country: string;
  companyCount: number;
  currency: 'USD' | 'NIO'; validDays: number; enterpriseGroupId: string; clientTenantId: string;
  discountAmount?: number; taxRate: number; displayInitialTotal: number; displaySubtotal: number; displayMonthlyTotal: number;
  showInitialTotal: boolean; showSubtotal: boolean; showDiscount: boolean; showMonthlyTotal: boolean; showTax: boolean; showTotal: boolean;
  notes: string; items: DraftItem[]; commercialReport: CommercialReport;
};

const baseSection = '1. CONTRATACIÓN INICIAL';
const additionalSection = '2. MÓDULOS Y SERVICIOS ADICIONALES';
const enterpriseSection = '3. ENTERPRISE, INTEGRACIONES Y VERTICALES';
const billingPeriods = ['Mensual', 'Anual', 'Pago único'] as const;
type BillingPeriod = typeof billingPeriods[number];

type QuoteCatalogItem = {
  category: string;
  description: string;
  detail: string;
  section?: string;
  billingType?: BillingType;
  pricingLabel?: string;
  billingOptions?: PlatformQuoteBillingOption[];
  kind?: 'plan' | 'module';
};

const billingOptionsOf = (item: Pick<PlatformQuoteItem, 'billingOptions' | 'periodicity' | 'unitPrice'>): PlatformQuoteBillingOption[] => {
  const source = Array.isArray(item.billingOptions) ? item.billingOptions : [];
  const options = source
    .map((option) => ({ periodicity: safeTrim(option.periodicity), unitPrice: Math.max(0, Number(option.unitPrice || 0)) }))
    .filter((option) => option.periodicity);
  if (options.length) return options;
  return [{ periodicity: safeTrim(item.periodicity) || 'Pago único', unitPrice: Math.max(0, Number(item.unitPrice || 0)) }];
};

const billingOptionFor = (item: DraftItem, periodicity: string) => billingOptionsOf(item).find((option) => option.periodicity.toLowerCase() === periodicity.toLowerCase());
const defaultItems: DraftItem[] = [
  { section: baseSection, description: 'Nova Esencial', periodicity: 'Anual', billingOptions: [{ periodicity: 'Mensual', unitPrice: 45 }, { periodicity: 'Anual', unitPrice: 450 }], detail: 'Plan comercial para vender, cobrar y controlar inventario con trazabilidad.\nVentas y facturación\nCompras y proveedores\nInventario y movimientos de bodega\nCaja y POS\nFinanzas operativas\nReportes gerenciales\nClientes, citas y reservas\nAccesos y notificaciones programadas', quantity: 1, unitPrice: 450, isOptional: false, billingType: 'Cobrado' },
  { section: baseSection, description: 'Implementación y configuración inicial', periodicity: 'Pago único', detail: 'Configuración inicial de la empresa\nParametrización de clientes y usuarios\nPersonalización inicial\nHasta 4 horas de capacitación virtual\nManual de usuario\nPrecio regular USD 250; bonificación comercial USD 50', quantity: 1, unitPrice: 250, discountType: 'AMOUNT', discountValue: 50, isOptional: false, billingType: 'Cobrado' },
  { section: baseSection, description: 'Usuarios y capacidad incluida', periodicity: 'Pago único', detail: '1 sucursal\n1 bodega\n1 caja/POS\n5 usuarios incluidos (3 del plan + 2 usuarios adicionales sin costo)\nEl usuario adicional se cobra a partir del sexto\nHasta 3,000 productos/SKU\nMovimientos de bodega sin límite', quantity: 1, unitPrice: 0, isOptional: false, billingType: 'Valor agregado' },
  { section: baseSection, description: 'Ventas, facturación y cobros', periodicity: 'Pago único', detail: 'Registro de ventas\nDocumentos comerciales\nControl de cobros\nConsulta del estado de las operaciones', quantity: 1, unitPrice: 0, isOptional: false, billingType: 'Valor agregado' },
  { section: baseSection, description: 'Inventario con trazabilidad', periodicity: 'Pago único', detail: 'Productos y existencias\nEntradas, salidas y ajustes\nMovimientos y costos\nSeguimiento de inventario en tiempo real', quantity: 1, unitPrice: 0, isOptional: false, billingType: 'Valor agregado' },
  { section: baseSection, description: 'Clientes, citas y reservas', periodicity: 'Pago único', detail: 'Base de clientes\nAgenda comercial\nCitas y reservas\nHistorial de operaciones', quantity: 1, unitPrice: 0, isOptional: false, billingType: 'Valor agregado' },
  { section: baseSection, description: 'Accesos y notificaciones', periodicity: 'Pago único', detail: 'Acceso para clientes\nRoles y permisos\nNotificaciones operativas\nNotificaciones comerciales programadas', quantity: 1, unitPrice: 0, isOptional: false, billingType: 'Valor agregado' },
];

const quoteCatalog: QuoteCatalogItem[] = [
  { category: 'Planes Nova', kind: 'plan', description: 'Nova Esencial', detail: 'Plan comercial para vender, cobrar y controlar inventario con trazabilidad; incluye ventas, facturación, cobros, clientes, citas, reservas, accesos y notificaciones.', pricingLabel: 'Desde USD 45 mensual o USD 450 anual', billingOptions: [{ periodicity: 'Mensual', unitPrice: 45 }, { periodicity: 'Anual', unitPrice: 450 }] },
  { category: 'Planes Nova', kind: 'plan', description: 'Nova Premium', detail: 'Operación avanzada para empresas con contabilidad, gestión gerencial, automatizaciones, multiempresa y personalización comercial.', pricingLabel: 'Precio por propuesta comercial' },
  { category: 'Planes Nova', kind: 'plan', description: 'Nova Enterprise', detail: 'Arquitectura empresarial con consolidación, integraciones, API, flujos especiales, soporte estratégico y desarrollo a medida.', pricingLabel: 'Precio por propuesta comercial' },
  { category: 'Finanzas', description: 'Contabilidad completa', detail: 'Plan de cuentas, libro diario y mayor, balanza, estados financieros, cierres, conciliación bancaria, impuestos y reportes regulatorios.', pricingLabel: 'Precio por propuesta comercial' },
  { category: 'Finanzas', description: 'Activos fijos y depreciación', detail: 'Registro de activos, categorías, depreciación, movimientos, bajas y trazabilidad del valor contable.', pricingLabel: 'Precio por propuesta comercial' },
  { category: 'Personas', description: 'Recursos Humanos y nómina', detail: 'Expedientes, puestos, departamentos, asistencia, vacaciones, deducciones, comisiones, nómina y pagos.', pricingLabel: 'Precio por propuesta comercial' },
  { category: 'Comercial', description: 'Mapa Comercial', detail: 'Georreferenciación de clientes, zonas, rutas, cobertura, prospectos y lectura territorial de oportunidades.', pricingLabel: 'Precio por propuesta comercial' },
  { category: 'Comercial', description: 'Ventas en Campo', detail: 'Prospección, visitas, pedidos, cobranza, rutas, evidencias, seguimiento de gestores y operación móvil.', pricingLabel: 'Precio por propuesta comercial' },
  { category: 'Comercial', description: 'CRM y fuerza comercial', detail: 'Prospectos, oportunidades, actividades, cotizaciones, seguimiento, metas y recuperación de clientes.', pricingLabel: 'Precio por propuesta comercial' },
  { category: 'Inventario', description: 'Inventario avanzado FEFO', detail: 'Lotes, vencimientos, FEFO, avisos de próximos vencimientos, costo comprometido, productos estancados y reposición.', pricingLabel: 'Precio por propuesta comercial' },
  { category: 'Inventario', description: 'Reposición y compras sugeridas', detail: 'Mínimos, máximos, demanda, alertas de quiebre, sugerencias de compra y control del capital inmovilizado.', pricingLabel: 'Precio por propuesta comercial' },
  { category: 'Operación', description: 'Manager consolidado', detail: 'Vista gerencial de empresas, sucursales, ventas, inventarios, cajas, rentabilidad, alertas y comparativos.', pricingLabel: 'Precio por propuesta comercial' },
  { category: 'Operación', description: 'Control de cajas y turnos', detail: 'Apertura, cierre, arqueo, diferencias, ingresos, egresos, responsables y trazabilidad por sesión.', pricingLabel: 'Precio por propuesta comercial' },
  { category: 'Operación', description: 'Restaurante POS', detail: 'Salón, mesas, comandas, cocina, carta, pedidos, cierres y reportes operativos.', pricingLabel: 'Precio por propuesta comercial' },
  { category: 'Operación', description: 'Logística e importaciones', detail: 'Tracking, paquetes, recepción, lotes, pesos, conciliación de compras y facturación.', pricingLabel: 'Precio por propuesta comercial' },
  { category: 'Gestión', description: 'Proyectos y cronogramas', detail: 'Portafolio, tareas, hitos, presupuesto, costos, contratistas, documentos y avance.', pricingLabel: 'Precio por propuesta comercial' },
  { category: 'Gestión', description: 'Tickets y soporte', detail: 'Tickets, agentes, prioridades, comentarios, SLA, base de conocimiento y seguimiento.', pricingLabel: 'Precio por propuesta comercial' },
  { category: 'Gestión', description: 'Academia virtual', detail: 'Cursos, avances, calificaciones, historial y diplomas verificables para equipos y clientes.', pricingLabel: 'Precio por propuesta comercial' },
  { category: 'Gestión', description: 'Asesoría legal', detail: 'Casos, expedientes, recordatorios, tareas, fechas críticas y documentos.', pricingLabel: 'Precio por propuesta comercial' },
  { category: 'Integraciones', description: 'Nova API e integraciones', detail: 'API, webhooks, conectores, automatizaciones y sincronización con sistemas externos.', pricingLabel: 'Precio por propuesta comercial', section: enterpriseSection },
  { category: 'Integraciones', description: 'Nova Chat y asistencia inteligente', detail: 'Asistente interno, consultas operativas, comunicación y soporte inteligente con contexto.', pricingLabel: 'Precio por propuesta comercial', section: enterpriseSection },
  { category: 'Integraciones', description: 'Nova Cloud y documentos', detail: 'Archivos, carpetas, contratos, facturas, reportes y documentos centralizados.', pricingLabel: 'Precio por propuesta comercial', section: enterpriseSection },
  { category: 'Integraciones', description: 'Líneas corporativas y WhatsApp', detail: 'Canales corporativos, notificaciones, campañas operativas y comunicación por empresa o sucursal.', pricingLabel: 'Precio por propuesta comercial', section: enterpriseSection },
  { category: 'Verticales', description: 'Farmacias y centros clínicos', detail: 'Lotes, vencimientos, FEFO, recetas, pacientes, trazabilidad, reposición y facturación.', pricingLabel: 'Precio por propuesta comercial', section: enterpriseSection },
  { category: 'Verticales', description: 'Clínicas médicas, dentales y veterinarias', detail: 'Citas, pacientes, expedientes, tratamientos, recetas, agenda y facturación.', pricingLabel: 'Precio por propuesta comercial', section: enterpriseSection },
  { category: 'Verticales', description: 'Talleres mecánicos', detail: 'Órdenes de trabajo, vehículos, historial, agenda, inventario y cotizaciones.', pricingLabel: 'Precio por propuesta comercial', section: enterpriseSection },
  { category: 'Verticales', description: 'Constructoras y proyectos', detail: 'Presupuestos, materiales, avances, contratistas, costos, compras y proyectos.', pricingLabel: 'Precio por propuesta comercial', section: enterpriseSection },
  { category: 'Verticales', description: 'Tiendas de ropa y retail', detail: 'Tallas, colores, variantes, temporadas, inventario, ventas y reposición.', pricingLabel: 'Precio por propuesta comercial', section: enterpriseSection },
  { category: 'Servicios profesionales', description: 'Financiamiento PYME', detail: 'Solicitudes, simulación, cálculo de cuotas, evaluación y seguimiento de financiamiento.', pricingLabel: 'Precio por propuesta comercial' },
];

const emptyCommercialReport = (): CommercialReport => ({ commissionRecipient: '', commissionAmount: 0, pricePreferential: false, specialPrice: false, reason: '' });
const reportStorageKey = (quoteId: string) => `novahub:platform-quote-report:${quoteId}`;
const loadCommercialReport = (quoteId: string): CommercialReport => {
  if (typeof window === 'undefined') return emptyCommercialReport();
  try {
    const value = JSON.parse(window.localStorage.getItem(reportStorageKey(quoteId)) || '{}');
    return { ...emptyCommercialReport(), ...value, commissionAmount: Number(value?.commissionAmount || 0), pricePreferential: Boolean(value?.pricePreferential), specialPrice: Boolean(value?.specialPrice) };
  } catch { return emptyCommercialReport(); }
};
const saveCommercialReport = (quoteId: string, report: CommercialReport) => {
  try { window.localStorage.setItem(reportStorageKey(quoteId), JSON.stringify(report)); } catch { /* almacenamiento local no disponible */ }
};
const conditionLabel = (report: CommercialReport) => [report.pricePreferential && 'Precio preferencial', report.specialPrice && 'Condición especial'].filter(Boolean).join(' · ');

const safeTrim = (value: unknown) => String(value ?? '').trim();
const money = (value: number, currency: string) => new Intl.NumberFormat('es-NI', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(value || 0));
const isIncludedDetail = (detail: unknown) => /incluido|valor agregado|sin costo/i.test(safeTrim(detail));
const cleanDetailLine = (line: string) => line.replace(/^\s*[•·▪◦*-]\s*/, '').trim();
const editableDetailValue = (value: unknown) => String(value ?? '').split(/\r?\n/).map((line) => line ? cleanDetailLine(line) : '').join('\n');
const statusLabel = (status: PlatformQuote['status']) => ({ DRAFT: 'Borrador', SENT: 'Enviada', ACCEPTED: 'Aceptada', REJECTED: 'Rechazada', EXPIRED: 'Vencida' }[status]);
const draftAmountOf = (item: DraftItem) => item.billingType === 'Valor agregado' ? 0 : Math.max(0, Number(item.quantity || 0)) * Math.max(0, Number(item.unitPrice || 0));
const draftDiscountAmountOf = (item: DraftItem) => {
  const amount = draftAmountOf(item);
  const value = Math.max(0, Number(item.discountValue || 0));
  return item.discountType === 'PERCENT' ? amount * Math.min(100, value) / 100 : Math.min(amount, value);
};
const isMonthlyItem = (item: DraftItem) => String(item.periodicity || '').toLowerCase().includes('mens');
const monthlyAmountOf = (item: DraftItem) => {
  if (item.billingType === 'Valor agregado') return 0;
  const option = billingOptionFor(item, 'Mensual');
  return option ? Math.max(0, Number(item.quantity || 0)) * Math.max(0, Number(option.unitPrice || 0)) : 0;
};
const draftTotals = (items: DraftItem[], taxRate = 0) => {
  const charged = items.filter((item) => item.billingType !== 'Valor agregado');
  const subtotal = charged.filter((item) => item.section.trim() === baseSection && !item.isOptional).reduce((sum, item) => sum + draftAmountOf(item), 0);
  const optional = charged.filter((item) => item.section.trim() !== baseSection || item.isOptional).reduce((sum, item) => sum + draftAmountOf(item), 0);
  const gross = subtotal + optional;
  const initialTotal = charged.filter((item) => !isMonthlyItem(item)).reduce((sum, item) => sum + draftAmountOf(item), 0);
  const monthlyTotal = charged.reduce((sum, item) => sum + (billingOptionFor(item, 'Mensual') ? monthlyAmountOf(item) : isMonthlyItem(item) ? draftAmountOf(item) : 0), 0);
  const discount = Math.min(gross, charged.reduce((sum, item) => sum + draftDiscountAmountOf(item), 0));
  const tax = Math.max(0, gross - discount) * Math.max(0, Number(taxRate || 0)) / 100;
  return { subtotal: gross, baseSubtotal: subtotal, optional, initialTotal, monthlyTotal, discount, tax, total: gross - discount + tax, included: items.filter((item) => item.billingType === 'Valor agregado').length };
};
const emptyDraft = (): DraftQuote => {
  const items = defaultItems.map((item) => ({ ...item }));
  const totals = draftTotals(items);
  return {
    prospectCompany: '', prospectName: '', prospectEmail: '', prospectPhone: '', country: 'Nicaragua', companyCount: 1, currency: 'USD', validDays: 15,
    enterpriseGroupId: '', clientTenantId: '', discountAmount: undefined, taxRate: 0, displayInitialTotal: totals.initialTotal, displaySubtotal: totals.subtotal, displayMonthlyTotal: totals.monthlyTotal,
    showInitialTotal: true, showSubtotal: true, showDiscount: true, showMonthlyTotal: true, showTax: true, showTotal: true,
    notes: '', items, commercialReport: emptyCommercialReport(),
  };
};

export function PlatformQuotesPanel({ groups = [] }: { groups?: any[] }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [draft, setDraft] = useState<DraftQuote | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reportEdit, setReportEdit] = useState<{ quote: PlatformQuote; draft: CommercialReport } | null>(null);
  const [paymentDate] = useState('');
  const quotesQuery = useTenantQuery(['platform-quotes', search, status], (signal) => enterpriseGroupsService.getPlatformQuotes({ search, status }, signal), { enabled: true });
  const quotes = useMemo(() => quotesQuery.data || [], [quotesQuery.data]);
  const totals = useMemo(() => ({ total: quotes.length, sent: quotes.filter((quote) => quote.status === 'SENT').length, value: quotes.reduce((sum, quote) => sum + calculatePlatformQuoteTotals(quote).total, 0) }), [quotes]);
  const preview = useMemo(() => {
    if (!draft) return { subtotal: 0, optional: 0, tax: 0, total: 0, included: 0, initialTotal: 0, monthlyTotal: 0, discount: 0 };
    const calculated = draftTotals(draft.items, draft.taxRate);
    const subtotal = Math.max(0, Number(draft.displaySubtotal ?? calculated.subtotal));
    const discount = draft.discountAmount !== undefined
      ? Math.min(subtotal, Math.max(0, Number(draft.discountAmount || 0)))
      : Math.min(subtotal, calculated.discount);
    const tax = Math.max(0, subtotal - discount) * Number(draft.taxRate || 0) / 100;
    return { ...calculated, subtotal, discount, tax, total: subtotal - discount + tax, initialTotal: Math.max(0, Number(draft.displayInitialTotal ?? calculated.initialTotal)), monthlyTotal: Math.max(0, Number(draft.displayMonthlyTotal ?? calculated.monthlyTotal)) };
  }, [draft]);
  const openNew = () => { setEditingId(null); setDraft(emptyDraft()); };
  const openEditQuote = (quote: PlatformQuote) => {
    const storedItems = Array.isArray(quote.items) ? quote.items : [];
    const hasStoredLineDiscount = storedItems.some((item) => Number(item.discountValue || 0) > 0 && Number(item.quantity || 0) > 0 && Number(item.unitPrice || 0) > 0);
    const storedGlobalDiscount = Number(quote.discountAmount || 0);
    const items = storedItems.map((item) => ({ section: safeTrim(item.section), description: safeTrim(item.description), detail: safeTrim(item.detail), periodicity: safeTrim(item.periodicity) || 'Pago único', billingOptions: billingOptionsOf(item), quantity: item.quantity, unitPrice: item.unitPrice, discountType: item.discountType === 'PERCENT' ? 'PERCENT' as DiscountType : 'AMOUNT' as DiscountType, discountValue: Number(item.discountValue || 0), isOptional: Boolean(item.isOptional), billingType: Number(item.unitPrice || 0) === 0 && isIncludedDetail(item.detail) ? 'Valor agregado' : 'Cobrado' as BillingType }));
    const planItem = items.find((item) => item.section.trim() === baseSection && /^nova\s/i.test(item.description));
    const calculated = draftTotals(items);
    setEditingId(quote.id); setDraft({
      prospectCompany: safeTrim(quote.prospectCompany), prospectName: safeTrim(quote.prospectName), prospectEmail: safeTrim(quote.prospectEmail), prospectPhone: safeTrim(quote.prospectPhone), country: safeTrim(quote.country), companyCount: Math.max(1, Number(quote.companyCount || planItem?.quantity || 1)), currency: quote.currency,
      validDays: quote.validUntil ? Math.max(1, Math.ceil((new Date(quote.validUntil).getTime() - Date.now()) / 86400000)) : 15, enterpriseGroupId: quote.enterpriseGroup?.id || '', clientTenantId: quote.clientTenant?.id || '', discountAmount: hasStoredLineDiscount || storedGlobalDiscount <= 0 ? undefined : storedGlobalDiscount, taxRate: quote.taxRate,
      displayInitialTotal: Number(quote.displayInitialTotal ?? calculated.initialTotal), displaySubtotal: Number(quote.displaySubtotal ?? calculated.subtotal), displayMonthlyTotal: Number(quote.displayMonthlyTotal ?? calculated.monthlyTotal),
      showInitialTotal: quote.showInitialTotal !== false, showSubtotal: quote.showSubtotal !== false, showDiscount: quote.showDiscount !== false, showMonthlyTotal: quote.showMonthlyTotal !== false, showTax: quote.showTax !== false, showTotal: quote.showTotal !== false,
      notes: quote.notes || '', items, commercialReport: loadCommercialReport(quote.id),
    });
  };
  const saveQuote = async () => {
    if (!draft) return;
    if (!safeTrim(draft.prospectCompany) || !safeTrim(draft.prospectName)) { toast.error('Indica la empresa y el contacto prospecto.'); return; }
    if (!draft.items.length) { toast.error('Agrega al menos un concepto.'); return; }
    const items = draft.items.map(({ billingType, ...item }) => ({ ...item, billingOptions: billingType === 'Valor agregado' ? null : billingOptionsOf(item), quantity: Math.max(0, Number(item.quantity || 0)), unitPrice: billingType === 'Valor agregado' ? 0 : Math.max(0, Number(item.unitPrice || 0)), discountType: item.discountType || 'AMOUNT', discountValue: billingType === 'Valor agregado' ? 0 : Math.max(0, Number(item.discountValue || 0)), isOptional: billingType === 'Valor agregado' ? false : Boolean(item.isOptional), detail: billingType === 'Valor agregado' && !isIncludedDetail(item.detail) ? `${safeTrim(item.detail)}${safeTrim(item.detail) ? ' · ' : ''}Valor agregado incluido sin costo adicional.` : safeTrim(item.detail) }));
    const { commercialReport: _commercialReport, ...quoteDraft } = draft;
    const payload = { ...quoteDraft, ...(draft.discountAmount !== undefined ? { discountAmount: Math.max(0, Number(draft.discountAmount || 0)) } : {}), validUntil: new Date(Date.now() + Math.max(1, Number(draft.validDays || 15)) * 86400000).toISOString(), items };
    try { const savedQuote = editingId ? await enterpriseGroupsService.updatePlatformQuote(editingId, payload) : await enterpriseGroupsService.createPlatformQuote(payload as any); setEditingId(savedQuote.id); toast.success(editingId ? 'Cotización actualizada.' : 'Cotización guardada. Ahora puedes guardar el reporte comercial por separado.'); await quotesQuery.refetch(); } catch (error: any) { toast.error(error?.message || 'No se pudo guardar la cotización.'); }
  };
  const openReportEdit = (quote: PlatformQuote) => setReportEdit({ quote, draft: loadCommercialReport(quote.id) });
  const saveStandaloneReport = async () => {
    if (!reportEdit) return;
    saveCommercialReport(reportEdit.quote.id, reportEdit.draft);
    toast.success('Reporte comercial actualizado sin modificar la cotización.');
    setReportEdit(null);
  };
  const markSent = async (quote: PlatformQuote) => { try { await enterpriseGroupsService.updatePlatformQuoteStatus(quote.id, 'SENT'); toast.success('Cotización marcada como enviada.'); await quotesQuery.refetch(); } catch (error: any) { toast.error(error?.message || 'No se pudo cambiar el estado.'); } };
  const remove = async (quote: PlatformQuote) => { if (!window.confirm(`¿Eliminar ${quote.number}?`)) return; try { await enterpriseGroupsService.deletePlatformQuote(quote.id); toast.success('Cotización eliminada.'); await quotesQuery.refetch(); } catch (error: any) { toast.error(error?.message || 'Solo se pueden eliminar borradores.'); } };

  return <div className="min-w-0 space-y-5">
    <div className="rounded-3xl bg-[#0f4b3a] p-5 text-white shadow-lg sm:p-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-200"><Sparkles className="size-3.5" /> Comercial de plataforma</p><h2 className="mt-2 text-2xl font-black uppercase italic tracking-tight sm:text-3xl">Cotizaciones <span className="text-emerald-300">NOVA</span></h2><p className="mt-2 max-w-xl text-sm text-emerald-50/75">Propuestas claras, editables y listas para entregar a cada prospecto.</p></div><Button className="h-11 rounded-xl bg-emerald-400 px-5 text-[#063b2d] hover:bg-emerald-300" onClick={openNew}><Plus className="mr-2 size-4" /> Nueva cotización</Button></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><Kpi label="Oportunidades" value={totals.total} /><Kpi label="Enviadas" value={totals.sent} /><Kpi label="Valor cotizado" value={money(totals.value, 'USD')} /></div></div>
    {draft && <QuoteEditor draft={draft} setDraft={setDraft} editingId={editingId} groups={groups} preview={preview} onSaveQuote={saveQuote} onClose={() => { setDraft(null); setEditingId(null); }} />}
    {reportEdit && <CommercialReportEditor value={reportEdit.draft} onChange={(value) => setReportEdit((current) => current ? { ...current, draft: value } : current)} onSave={saveStandaloneReport} onClose={() => setReportEdit(null)} />}
     <Card className="rounded-3xl border-border/60 shadow-sm">
       <CardHeader className="gap-4 p-5 pb-3 sm:flex-row sm:items-center sm:justify-between">
         <div>
           <CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><FileText className="size-5 text-primary" /> Historial comercial</CardTitle>
           <p className="mt-1 text-sm text-muted-foreground">La cotización permanece separada de las operaciones del tenant.</p>
         </div>
         <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
           <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar prospecto…" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary sm:w-56" /></div>
           <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"><option value="">Todos los estados</option><option value="DRAFT">Borradores</option><option value="SENT">Enviadas</option><option value="ACCEPTED">Aceptadas</option><option value="REJECTED">Rechazadas</option><option value="EXPIRED">Vencidas</option></select>
         </div>
       </CardHeader>
       <CardContent className="p-0">
         {quotesQuery.isLoading ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div> : !quotes.length ? <div className="p-12 text-center text-sm text-muted-foreground">Aún no hay cotizaciones. Crea la primera propuesta comercial.</div> : <>
           <div className="hidden overflow-x-auto xl:block">
             <table className="w-full min-w-[980px] text-sm">
               <thead className="bg-muted/30 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground"><tr><th className="px-5 py-3">Cotización</th><th className="px-5 py-3">Prospecto</th><th className="px-5 py-3">Empresas</th><th className="px-5 py-3">Vigencia</th><th className="px-5 py-3 text-right">Descuento</th><th className="px-5 py-3 text-right">Total</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3 text-right">Acciones</th></tr></thead>
               <tbody>{quotes.map((quote) => { const quoteTotals = calculatePlatformQuoteTotals(quote); return <tr key={quote.id} className="border-t border-border/50"><td className="px-5 py-4"><p className="font-bold">{quote.number}</p><p className="text-xs text-muted-foreground">{new Date(quote.createdAt).toLocaleDateString('es-NI')}</p></td><td className="px-5 py-4"><p className="font-semibold">{quote.prospectCompany}</p><p className="text-xs text-muted-foreground">{quote.prospectName}</p></td><td className="px-5 py-4 font-black text-emerald-700">{quote.companyCount || 1}</td><td className="px-5 py-4 text-muted-foreground">{quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('es-NI') : 'Sin fecha'}</td><td className="px-5 py-4 text-right font-semibold text-red-600">{quoteTotals.discount > 0 ? '-' + money(quoteTotals.discount, quote.currency) : '—'}</td><td className="px-5 py-4 text-right font-black">{money(quote.total, quote.currency)}</td><td className="px-5 py-4"><Badge variant={quote.status === 'ACCEPTED' ? 'default' : quote.status === 'REJECTED' ? 'destructive' : 'outline'}>{statusLabel(quote.status)}</Badge></td><td className="px-5 py-4"><div className="flex justify-end gap-1"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" title="Descargar PDF"><Download className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="rounded-xl"><DropdownMenuItem className="gap-2 text-xs" onClick={() => downloadPlatformQuotePdf(quote, { mode: 'quote' })}><FileText className="size-3.5 text-primary" /> Descargar cotización</DropdownMenuItem><DropdownMenuItem className="gap-2 text-xs" disabled={quote.status !== 'ACCEPTED'} onClick={() => downloadPlatformQuotePdf(quote, { mode: 'invoice', paymentDate: paymentDate || undefined })}><FileText className="size-3.5 text-emerald-600" /> Descargar factura</DropdownMenuItem><DropdownMenuItem className="gap-2 text-xs" onClick={() => downloadPlatformQuoteCommercialReport(quote, loadCommercialReport(quote.id))}><FileText className="size-3.5 text-orange-500" /> Reporte comercial</DropdownMenuItem></DropdownMenuContent></DropdownMenu><Button variant="ghost" size="icon" title="Editar cotización" disabled={quote.status === 'ACCEPTED'} onClick={() => openEditQuote(quote)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" title="Editar reporte comercial" onClick={() => openReportEdit(quote)}><FileText className="size-4 text-orange-500" /></Button>{quote.status === 'DRAFT' && <Button variant="ghost" size="icon" title="Marcar como enviada" onClick={() => markSent(quote)}><Send className="size-4" /></Button>}{quote.status === 'DRAFT' && <Button variant="ghost" size="icon" title="Eliminar" onClick={() => remove(quote)}><Trash2 className="size-4 text-red-500" /></Button>}</div></td></tr>; })}</tbody>
             </table>
           </div>
           <div className="grid gap-3 p-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))] xl:hidden">
             {quotes.map((quote) => <PlatformQuoteCard key={quote.id} quote={quote} quoteTotals={calculatePlatformQuoteTotals(quote)} paymentDate={paymentDate} onEdit={() => openEditQuote(quote)} onReportEdit={() => openReportEdit(quote)} onMarkSent={() => void markSent(quote)} onRemove={() => void remove(quote)} />)}
           </div>
         </>}
       </CardContent>
     </Card>
  </div>;
}

function PlatformQuoteCard({ quote, quoteTotals, paymentDate, onEdit, onReportEdit, onMarkSent, onRemove }: { quote: PlatformQuote; quoteTotals: ReturnType<typeof calculatePlatformQuoteTotals>; paymentDate: string; onEdit: () => void; onReportEdit: () => void; onMarkSent: () => void; onRemove: () => void }) {
  return <article className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-sm transition-colors hover:border-primary/30">
    <div className="divide-y divide-border/40">
      <QuoteCardField label="Cotización"><p className="font-bold text-foreground">{quote.number}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(quote.createdAt).toLocaleDateString('es-NI')}</p></QuoteCardField>
      <QuoteCardField label="Prospecto"><p className="break-words font-semibold text-foreground">{quote.prospectCompany}</p><p className="mt-1 break-words text-xs text-muted-foreground">{quote.prospectName}</p></QuoteCardField>
      <QuoteCardField label="Empresas cubiertas"><p className="font-black text-emerald-700">{quote.companyCount || 1}</p></QuoteCardField>
      <QuoteCardField label="Vigencia"><p className="text-sm text-muted-foreground">{quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('es-NI') : 'Sin fecha'}</p></QuoteCardField>
      <QuoteCardField label="Descuento"><p className="font-semibold text-red-600">{quoteTotals.discount > 0 ? `-${money(quoteTotals.discount, quote.currency)}` : '—'}</p></QuoteCardField>
      <QuoteCardField label="Total"><p className="font-black text-foreground">{money(quote.total, quote.currency)}</p></QuoteCardField>
      <QuoteCardField label="Estado"><div className="flex justify-end"><Badge variant={quote.status === 'ACCEPTED' ? 'default' : quote.status === 'REJECTED' ? 'destructive' : 'outline'}>{statusLabel(quote.status)}</Badge></div></QuoteCardField>
    </div>
    <div className="flex items-center justify-between gap-3 border-t border-border/40 px-4 py-3">
      <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Acciones</span>
      <div className="flex min-w-0 flex-wrap justify-end gap-1">
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8 rounded-lg" title="Descargar PDF" aria-label="Descargar PDF"><Download className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="rounded-xl"><DropdownMenuItem className="gap-2 text-xs" onClick={() => downloadPlatformQuotePdf(quote, { mode: 'quote' })}><Download className="size-3.5 text-primary" /> Descargar cotización</DropdownMenuItem><DropdownMenuItem className="gap-2 text-xs" disabled={quote.status !== 'ACCEPTED'} onClick={() => downloadPlatformQuotePdf(quote, { mode: 'invoice', paymentDate: paymentDate || undefined })}><FileText className="size-3.5 text-emerald-600" /> Descargar factura</DropdownMenuItem><DropdownMenuItem className="gap-2 text-xs" onClick={() => downloadPlatformQuoteCommercialReport(quote, loadCommercialReport(quote.id))}><FileText className="size-3.5 text-orange-500" /> Reporte comercial</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        <Button variant="ghost" size="icon" className="size-8 rounded-lg" title="Editar cotización" aria-label="Editar cotización" disabled={quote.status === 'ACCEPTED'} onClick={onEdit}><Pencil className="size-4" /></Button>
        <Button variant="ghost" size="icon" className="size-8 rounded-lg" title="Editar reporte comercial" aria-label="Editar reporte comercial" onClick={onReportEdit}><FileText className="size-4 text-orange-500" /></Button>
        {quote.status === 'DRAFT' && <Button variant="ghost" size="icon" className="size-8 rounded-lg" title="Marcar como enviada" aria-label="Marcar como enviada" onClick={onMarkSent}><Send className="size-4" /></Button>}
        {quote.status === 'DRAFT' && <Button variant="ghost" size="icon" className="size-8 rounded-lg" title="Eliminar" aria-label="Eliminar" onClick={onRemove}><Trash2 className="size-4 text-red-500" /></Button>}
      </div>
    </div>
  </article>;
}

function QuoteCardField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid grid-cols-[minmax(5.5rem,34%)_minmax(0,1fr)] items-start gap-3 px-4 py-3"><p className="min-w-0 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><div className="min-w-0 text-right">{children}</div></div>;
}

function Kpi({ label, value }: { label: string; value: string | number }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-3"><p className="text-[10px] font-black uppercase tracking-widest text-emerald-100/70">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>; }

function CommercialReportEditor({ value, onChange, onSave, onClose }: { value: CommercialReport; onChange: (value: CommercialReport) => void; onSave: () => Promise<void>; onClose: () => void }) {
  const update = <K extends keyof CommercialReport,>(key: K, nextValue: CommercialReport[K]) => onChange({ ...value, [key]: nextValue });
  const conditionEnabled = value.pricePreferential || value.specialPrice;
  return <Card className="rounded-3xl border-orange-200 bg-orange-50/60 shadow-lg"><CardHeader className="flex-row items-start justify-between gap-4 border-b border-orange-200/70 p-5"><div><CardTitle className="flex items-center gap-2 text-lg font-black uppercase text-orange-950"><FileText className="size-5 text-orange-600" /> Editar reporte comercial</CardTitle><p className="mt-1 text-sm text-orange-900/70">Este documento interno se guarda de forma independiente y no modifica la cotización del cliente.</p></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar editor de reporte"><X className="size-5" /></Button></CardHeader><CardContent className="space-y-4 p-5"><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]"><label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-orange-950/70">Comisión para<input value={value.commissionRecipient} onChange={(event) => update('commissionRecipient', event.target.value)} placeholder="Vendedor o aliado" className="mt-1 h-10 w-full rounded-xl border border-orange-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none focus:border-orange-500" /></label><label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-orange-950/70">Monto comisión<input type="number" min="0" value={value.commissionAmount} onChange={(event) => update('commissionAmount', event.target.value === '' ? 0 : Number(event.target.value))} className="mt-1 h-10 w-full rounded-xl border border-orange-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none focus:border-orange-500" /></label></div><div className="flex flex-wrap gap-2"><label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${value.pricePreferential ? 'border-orange-500 bg-white text-orange-900' : 'border-orange-200 bg-white/70 text-slate-600'}`}><input type="checkbox" checked={value.pricePreferential} onChange={(event) => update('pricePreferential', event.target.checked)} className="size-4 accent-orange-500" /> Precio preferencial</label><label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${value.specialPrice ? 'border-orange-500 bg-white text-orange-900' : 'border-orange-200 bg-white/70 text-slate-600'}`}><input type="checkbox" checked={value.specialPrice} onChange={(event) => update('specialPrice', event.target.checked)} className="size-4 accent-orange-500" /> Condición especial</label></div>{conditionEnabled && <label className="block space-y-1 text-[10px] font-black uppercase tracking-wider text-orange-950/70">Motivo<textarea value={value.reason} onChange={(event) => update('reason', event.target.value)} placeholder="Explica la autorización comercial…" rows={3} className="mt-1 w-full resize-none rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-900 outline-none focus:border-orange-500" /></label>}<div className="flex justify-end gap-2"><Button variant="outline" className="rounded-xl bg-white" onClick={onClose}>Cancelar</Button><Button className="rounded-xl bg-orange-600 text-white hover:bg-orange-700" onClick={onSave}><Save className="mr-2 size-4" /> Guardar reporte</Button></div></CardContent></Card>;
}

function QuoteEditor({ draft, setDraft, editingId, groups, preview, onSaveQuote, onClose }: { draft: DraftQuote; setDraft: Dispatch<SetStateAction<DraftQuote | null>>; editingId: string | null; groups: any[]; preview: { subtotal: number; baseSubtotal: number; optional: number; tax: number; total: number; included: number; initialTotal: number; monthlyTotal: number; discount: number }; onSaveQuote: () => Promise<void>; onClose: () => void }) {
  const updateDraft = (updater: (current: DraftQuote) => DraftQuote) => setDraft((current) => current ? updater(current) : current);
  const field = (key: keyof DraftQuote, value: string | number | boolean) => updateDraft((current) => ({ ...current, [key]: value }));
  const numberValue = (value: string) => value === '' ? 0 : Number(value);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('Todas');
  const commercialConditionEnabled = draft.commercialReport.pricePreferential || draft.commercialReport.specialPrice;
  const savingPercent = preview.subtotal > 0 ? (preview.discount / preview.subtotal) * 100 : 0;
  const reportField = <K extends keyof CommercialReport,>(key: K, value: CommercialReport[K]) => updateDraft((current) => ({ ...current, commercialReport: { ...current.commercialReport, [key]: value } }));
  const recalculateItems = (current: DraftQuote, items: DraftItem[]) => {
    const before = draftTotals(current.items);
    const after = draftTotals(items);
    const isAuto = (valueToCheck: number, calculated: number) => Math.abs(Number(valueToCheck || 0) - calculated) < 0.01;
    return { ...current, items, displayInitialTotal: isAuto(current.displayInitialTotal, before.initialTotal) ? after.initialTotal : current.displayInitialTotal, displaySubtotal: isAuto(current.displaySubtotal, before.subtotal) ? after.subtotal : current.displaySubtotal, displayMonthlyTotal: isAuto(current.displayMonthlyTotal, before.monthlyTotal) ? after.monthlyTotal : current.displayMonthlyTotal };
  };
  const catalogCategories = useMemo(() => ['Todas', ...Array.from(new Set(quoteCatalog.map((item) => item.category)))], []);
  const filteredCatalog = useMemo(() => {
    const term = catalogSearch.trim().toLowerCase();
    return quoteCatalog.filter((item) => {
      const matchesCategory = catalogCategory === 'Todas' || item.category === catalogCategory;
      const matchesSearch = !term || `${item.category} ${item.description} ${item.detail}`.toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [catalogCategory, catalogSearch]);
  const planIndexOf = (items: DraftItem[]) => items.findIndex((item) => item.section.trim() === baseSection && /^nova\s/i.test(item.description));
  const setCompanyCount = (value: number) => updateDraft((current) => {
    const companyCount = Math.min(10000, Math.max(1, Math.floor(Number(value || 1))));
    const planIndex = planIndexOf(current.items);
    const items = planIndex < 0 ? current.items : current.items.map((item, index) => index === planIndex ? { ...item, quantity: companyCount } : item);
    return recalculateItems({ ...current, companyCount }, items);
  });
  const selectCatalogPlan = (entry: QuoteCatalogItem) => updateDraft((current) => {
    const planIndex = planIndexOf(current.items);
    if (planIndex < 0) return current;
    const isEssential = entry.description === 'Nova Esencial';
    const billingOptions = isEssential ? [{ periodicity: 'Mensual', unitPrice: 45 }, { periodicity: 'Anual', unitPrice: 450 }] : [{ periodicity: 'Pago único', unitPrice: 0 }];
    const items = current.items.map((item, index) => index === planIndex ? {
      ...item,
      description: entry.description,
      detail: `${entry.detail}${entry.pricingLabel ? ` ${entry.pricingLabel}.` : ''}`,
      periodicity: isEssential ? 'Anual' : 'Pago único',
      billingOptions,
      quantity: current.companyCount,
      unitPrice: isEssential ? 450 : 0,
      billingType: 'Cobrado' as BillingType,
    } : item);
    return recalculateItems(current, items);
  });
  const addCatalogItem = (entry: QuoteCatalogItem) => {
    if (entry.kind === 'plan') return selectCatalogPlan(entry);
    updateDraft((current) => {
      if (current.items.some((item) => item.description.trim().toLowerCase() === entry.description.trim().toLowerCase())) return current;
      const detail = `${entry.detail}${entry.pricingLabel ? ` ${entry.pricingLabel}. Ajusta el importe antes de enviar.` : ''}`;
      const items = [...current.items, {
        section: entry.section || additionalSection,
        description: entry.description,
        periodicity: 'Pago único',
        billingOptions: [{ periodicity: 'Pago único', unitPrice: 0 }],
        detail,
        quantity: 1,
        unitPrice: 0,
        isOptional: true,
        billingType: entry.billingType || 'Cobrado',
      } as DraftItem];
      return recalculateItems(current, items);
    });
  };
  const updateItem = (index: number, key: keyof DraftItem, value: string | number | boolean) => updateDraft((current) => {
    const items = current.items.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      if (key === 'billingType' && value === 'Valor agregado') return { ...item, billingType: 'Valor agregado', unitPrice: 0, discountValue: 0, isOptional: false, detail: isIncludedDetail(item.detail) ? item.detail : `${safeTrim(item.detail)}${safeTrim(item.detail) ? ' · ' : ''}Valor agregado incluido sin costo adicional.` };
      if (key === 'billingType') {
        const primary = billingOptionFor(item, String(item.periodicity || 'Pago único')) || billingOptionsOf(item)[0];
        return { ...item, billingType: 'Cobrado', unitPrice: primary?.unitPrice ?? item.unitPrice, detail: isIncludedDetail(item.detail) ? '' : item.detail };
      }
      if (key === 'unitPrice') {
        const options = billingOptionsOf(item).map((option) => option.periodicity.toLowerCase() === String(item.periodicity || '').toLowerCase() ? { ...option, unitPrice: Math.max(0, Number(value || 0)) } : option);
        return { ...item, unitPrice: Math.max(0, Number(value || 0)), billingOptions: options } as DraftItem;
      }
      if (key === 'periodicity') {
        const selected = billingOptionFor(item, String(value));
        return { ...item, periodicity: String(value), unitPrice: selected?.unitPrice ?? item.unitPrice } as DraftItem;
      }
      return { ...item, [key]: value } as DraftItem;
    });
    const planIndex = planIndexOf(current.items);
    const nextCompanyCount = key === 'quantity' && index === planIndex ? Math.min(10000, Math.max(1, Math.floor(Number(value || 1)))) : current.companyCount;
    return recalculateItems({ ...current, companyCount: nextCompanyCount }, items);
  });
  const updateBillingOption = (index: number, periodicity: BillingPeriod, enabled: boolean) => updateDraft((current) => {
    const items = current.items.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const options = billingOptionsOf(item);
      const exists = options.some((option) => option.periodicity.toLowerCase() === periodicity.toLowerCase());
      if (!enabled && exists && options.length === 1) return item;
      const nextOptions = enabled
        ? exists ? options : [...options, { periodicity, unitPrice: periodicity === item.periodicity ? Number(item.unitPrice || 0) : 0 }]
        : options.filter((option) => option.periodicity.toLowerCase() !== periodicity.toLowerCase());
      const primary = nextOptions.find((option) => option.periodicity.toLowerCase() === String(item.periodicity || '').toLowerCase()) || nextOptions[0];
      return { ...item, billingOptions: nextOptions, periodicity: primary?.periodicity || 'Pago único', unitPrice: primary?.unitPrice || 0 } as DraftItem;
    });
    return recalculateItems(current, items);
  });
  const updateBillingOptionPrice = (index: number, periodicity: string, value: number) => updateDraft((current) => {
    const items = current.items.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const billingOptions = billingOptionsOf(item).map((option) => option.periodicity.toLowerCase() === periodicity.toLowerCase() ? { ...option, unitPrice: Math.max(0, Number(value || 0)) } : option);
      return { ...item, billingOptions, unitPrice: item.periodicity.toLowerCase() === periodicity.toLowerCase() ? Math.max(0, Number(value || 0)) : item.unitPrice } as DraftItem;
    });
    return recalculateItems(current, items);
  });
  const removeItem = (index: number) => updateDraft((current) => {
    const before = draftTotals(current.items);
    const items = current.items.filter((_, itemIndex) => itemIndex !== index);
    const after = draftTotals(items);
    const isAuto = (valueToCheck: number, calculated: number) => Math.abs(Number(valueToCheck || 0) - calculated) < 0.01;
    return { ...current, items, displayInitialTotal: isAuto(current.displayInitialTotal, before.initialTotal) ? after.initialTotal : current.displayInitialTotal, displaySubtotal: isAuto(current.displaySubtotal, before.subtotal) ? after.subtotal : current.displaySubtotal, displayMonthlyTotal: isAuto(current.displayMonthlyTotal, before.monthlyTotal) ? after.monthlyTotal : current.displayMonthlyTotal };
  });
  const addItem = () => updateDraft((current) => ({ ...current, items: [...current.items, { section: additionalSection, description: '', periodicity: 'Pago único', billingOptions: [{ periodicity: 'Pago único', unitPrice: 0 }], detail: '', quantity: 1, unitPrice: 0, isOptional: false, billingType: 'Cobrado' }] }));
  return <Card data-platform-quote-editor className="overflow-hidden rounded-[28px] border-emerald-500/25 bg-[#edf8f1] shadow-xl shadow-emerald-950/5"><CardHeader className="border-b border-emerald-950/10 bg-white p-5 sm:px-7"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><CardTitle className="text-lg font-black uppercase tracking-tight text-slate-950">{editingId ? 'Editar cotización' : 'Nueva cotización'}</CardTitle><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700">Documento editable</span></div><p className="mt-1 text-sm text-slate-500">Define qué se cobra y qué se entrega como valor agregado sin costo.</p></div><Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar editor de cotización" title="Cerrar"><X className="size-5" /></Button></div></CardHeader><CardContent className="space-y-4 p-3 sm:p-6">
    <div className="grid gap-4 rounded-2xl border border-emerald-700/20 bg-[#e1f5e9] p-4 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-800"><Sparkles className="size-3.5" /> Cobertura empresarial</p><p className="mt-1 max-w-2xl text-xs leading-relaxed text-emerald-950/70">Define cuántas empresas o tenants cubre esta propuesta. El plan principal se multiplica por esta cantidad; los módulos incluidos quedan documentados por empresa.</p></div><label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-emerald-900">Empresas cubiertas<input type="number" min="1" max="10000" value={draft.companyCount} onChange={(event) => setCompanyCount(numberValue(event.target.value))} className="mt-1 h-10 w-32 rounded-xl border border-emerald-700/20 bg-white px-3 text-lg font-black text-emerald-950 outline-none focus:border-emerald-600" /></label></div>
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-emerald-900/10 bg-white/80 p-3 shadow-sm"><div className="mr-auto"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-700">Configuración comercial</p><p className="mt-1 text-xs text-slate-500">La modalidad queda en cada concepto.</p></div><label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Moneda<select value={draft.currency} onChange={(event) => field('currency', event.target.value)} className="mt-1 h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"><option value="USD">USD — Dólar</option><option value="NIO">NIO — Córdoba</option></select></label><Input label="Vigencia (días)" type="number" value={draft.validDays} onChange={(value) => field('validDays', numberValue(value))} /><Input label="Descuento (monto)" type="number" value={draft.discountAmount ?? ''} onChange={(value) => field('discountAmount', numberValue(value))} /><Input label="Impuesto (%)" type="number" value={draft.taxRate} onChange={(value) => field('taxRate', numberValue(value))} /><label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Grupo<select value={draft.enterpriseGroupId} onChange={(event) => field('enterpriseGroupId', event.target.value)} className="mt-1 h-9 max-w-[180px] rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"><option value="">Sin grupo</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label></div>
    <div className="rounded-2xl border border-emerald-900/10 bg-white/90 p-4 shadow-sm"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-700">Catálogo empresarial</p><p className="mt-1 text-xs leading-relaxed text-slate-500">Agrega solo lo que el prospecto necesita. Contabilidad, Recursos Humanos, Mapa Comercial, Ventas en Campo, integraciones y verticales quedan listos para cotizar.</p></div><div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" /><input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Buscar módulo o función…" className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 sm:w-64" /></div><select value={catalogCategory} onChange={(event) => setCatalogCategory(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500">{catalogCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></div></div><div className="mt-3 grid max-h-96 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">{filteredCatalog.map((entry) => { const isPlan = entry.kind === 'plan'; const plan = draft.items.find((item) => item.section.trim() === baseSection && /^nova\s/i.test(item.description)); const isSelected = isPlan ? plan?.description === entry.description : draft.items.some((item) => item.description.trim().toLowerCase() === entry.description.trim().toLowerCase()); return <button key={`${entry.category}-${entry.description}`} type="button" onClick={() => addCatalogItem(entry)} className={`group rounded-xl border p-3 text-left transition ${isSelected ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50/50 hover:border-emerald-300 hover:bg-emerald-50/60'}`}><div className="flex items-start justify-between gap-2"><span className="rounded-full bg-white px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-100">{entry.category}</span><span className={`text-[9px] font-black ${isSelected ? 'text-emerald-700' : 'text-slate-400 group-hover:text-emerald-700'}`}>{isSelected ? 'Seleccionado' : isPlan ? 'Elegir plan' : '+ Agregar'}</span></div><p className="mt-2 text-xs font-black text-slate-900">{entry.description}</p><p className="mt-1 text-[10px] leading-relaxed text-slate-500">{entry.detail}</p>{entry.pricingLabel && <p className="mt-2 text-[9px] font-bold text-emerald-700">{entry.pricingLabel}</p>}</button>; })}</div>{!filteredCatalog.length && <p className="mt-3 rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">No encontramos ese módulo. Puedes agregar un concepto personalizado abajo.</p>}</div>
    <div className="grid gap-4 rounded-2xl border border-emerald-900/10 bg-white/80 p-4 shadow-sm lg:grid-cols-[auto_1fr]"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-700">Totales de la propuesta</p><p className="mt-1 max-w-[220px] text-xs leading-relaxed text-slate-500">Edita los importes que verá el cliente y decide qué líneas aparecen.</p></div><div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Input label="Total inicial" type="number" value={draft.displayInitialTotal} onChange={(value) => field('displayInitialTotal', numberValue(value))} /><Input label="Subtotal" type="number" value={draft.displaySubtotal} onChange={(value) => field('displaySubtotal', numberValue(value))} /><Input label="Total mensual" type="number" value={draft.displayMonthlyTotal} onChange={(value) => field('displayMonthlyTotal', numberValue(value))} /></div><div className="flex flex-wrap gap-2"><VisibilityToggle label="Total inicial" checked={draft.showInitialTotal} onChange={(value) => field('showInitialTotal', value)} /><VisibilityToggle label="Subtotal" checked={draft.showSubtotal} onChange={(value) => field('showSubtotal', value)} /><VisibilityToggle label="Descuento" checked={draft.showDiscount} onChange={(value) => field('showDiscount', value)} /><VisibilityToggle label="Total mensual" checked={draft.showMonthlyTotal} onChange={(value) => field('showMonthlyTotal', value)} /><VisibilityToggle label="Impuestos" checked={draft.showTax} onChange={(value) => field('showTax', value)} /><VisibilityToggle label="Total" checked={draft.showTotal} onChange={(value) => field('showTotal', value)} /></div></div></div>
    {false && <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-4 shadow-sm"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-700">Reporte comercial</p><p className="mt-1 text-xs leading-relaxed text-slate-600">Se descarga aparte de la cotización y permite documentar condiciones internas sin cambiar el total del cliente.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-orange-700 ring-1 ring-orange-200">Control interno</span></div><div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_150px]" ><label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Comisión para<input value={draft.commercialReport.commissionRecipient} onChange={(event) => reportField('commissionRecipient', event.target.value)} placeholder="Nombre del vendedor o aliado" className="mt-1 h-9 w-full rounded-lg border border-orange-200 bg-white px-3 text-xs font-semibold normal-case tracking-normal text-slate-900 outline-none focus:border-orange-400" /></label><label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Monto comisión<input type="number" min="0" value={draft.commercialReport.commissionAmount} onChange={(event) => reportField('commissionAmount', numberValue(event.target.value))} className="mt-1 h-9 w-full rounded-lg border border-orange-200 bg-white px-3 text-xs font-semibold normal-case tracking-normal text-slate-900 outline-none focus:border-orange-400" /></label></div><div className="mt-4 flex flex-wrap gap-2"><label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${draft.commercialReport.pricePreferential ? 'border-orange-400 bg-white text-orange-800' : 'border-orange-200 bg-white/70 text-slate-600'}`}><input type="checkbox" checked={draft.commercialReport.pricePreferential} onChange={(event) => reportField('pricePreferential', event.target.checked)} className="size-4 accent-orange-500" /> Precio preferencial</label><label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${draft.commercialReport.specialPrice ? 'border-orange-400 bg-white text-orange-800' : 'border-orange-200 bg-white/70 text-slate-600'}`}><input type="checkbox" checked={draft.commercialReport.specialPrice} onChange={(event) => reportField('specialPrice', event.target.checked)} className="size-4 accent-orange-500" /> Condición especial</label></div>{commercialConditionEnabled && <label className="mt-4 block space-y-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Motivo<textarea value={draft.commercialReport.reason} onChange={(event) => reportField('reason', event.target.value)} placeholder="Explica por qué se autorizó la condición comercial..." rows={2} className="mt-1 w-full resize-none rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs font-medium normal-case tracking-normal text-slate-900 outline-none focus:border-orange-400" /></label>}<p className="mt-3 text-[10px] text-slate-500">La columna de condición comercial aparecerá en el reporte solo cuando actives al menos uno de los checks.</p></div>}
    <div data-quote-table className="overflow-x-auto pb-2"><div className="mx-auto min-w-[1040px] max-w-[1160px] overflow-hidden rounded-[6px] bg-white shadow-[0_20px_70px_rgba(15,23,42,0.13)] ring-1 ring-slate-900/10"><div className="flex min-h-[126px] items-start gap-5 overflow-hidden bg-white px-7 py-6 sm:px-9"><div className="flex h-[58px] w-[190px] shrink-0 items-center"><NovaHubLogoFull size={34} /></div><div className="min-w-0 flex-1" /><div className="shrink-0 text-right text-[10px] text-slate-500"><p>Emitida {new Date().toLocaleDateString('es-NI')}</p><p className="mt-2 font-bold text-emerald-700">Válida {draft.validDays} días</p></div></div><div className="h-1 bg-[#16a34a]" /><div className="space-y-4 p-6 sm:p-8"><div className="grid gap-4 rounded-2xl bg-[#effaf4] p-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Cliente / prospecto</p><DocumentInput value={draft.prospectCompany} placeholder="Empresa prospecto *" onChange={(value) => field('prospectCompany', value)} className="mt-1 text-lg font-black text-slate-950" /><div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-slate-500"><DocumentInput value={draft.prospectName} placeholder="Contacto *" onChange={(value) => field('prospectName', value)} /><span>·</span><DocumentInput value={draft.prospectEmail} placeholder="correo" onChange={(value) => field('prospectEmail', value)} /><span>·</span><DocumentInput value={draft.prospectPhone} placeholder="teléfono" onChange={(value) => field('prospectPhone', value)} /><span>·</span><DocumentInput value={draft.country} placeholder="país" onChange={(value) => field('country', value)} /></div></div><div className="sm:text-right"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Moneda</p><p className="mt-1 text-lg font-black text-slate-950">{draft.currency}</p></div></div>
    <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-[10px] leading-relaxed text-emerald-900"><strong>Modalidades:</strong> habilita las formas de cobro que aplican a cada concepto. El total usa solo la modalidad principal seleccionada; las demás quedan como alternativas visibles y no se suman. En el plan principal, “Empresas / unidades” corresponde a las empresas cubiertas por esta cotización.</div><div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[10px]"><span className="font-black uppercase tracking-wide text-emerald-800">Ahorro para el cliente</span><strong className="text-emerald-700">{preview.discount > 0 ? `-${money(preview.discount, draft.currency)} (${savingPercent.toFixed(1)}%)` : 'Sin descuento aplicado'}</strong></div>
    <table className="w-full border-collapse text-[10px]"><thead><tr className="bg-[#0f4b3a] text-left text-[9px] font-black uppercase tracking-wider text-white"><th className="w-9 px-3 py-3">#</th><th className="w-[23%] px-3 py-3">Concepto</th><th className="w-[8%] px-2 py-3 text-center whitespace-nowrap">Empresas / unidades</th><th className="w-[12%] px-2 py-3 text-right whitespace-nowrap">Precio principal</th>{draft.showDiscount && <th className="w-[11%] px-2 py-3 text-right whitespace-nowrap">Descuento</th>}<th className="w-[21%] px-2 py-3">Cobro y modalidades</th><th className="w-[25%] px-2 py-3">Descripción / alcance</th>{commercialConditionEnabled && <th className="w-[18%] px-2 py-3">Condición comercial</th>}</tr></thead><tbody>{draft.items.map((item, index) => <Fragment key={`quote-row-${index}`}>{(index === 0 || item.section !== draft.items[index - 1]?.section) && <tr><td colSpan={6 + (draft.showDiscount ? 1 : 0) + (commercialConditionEnabled ? 1 : 0)} className="border-b border-emerald-900/10 bg-[#e1f5e9] px-3 py-2"><DocumentInput value={item.section} placeholder="Sección" onChange={(value) => updateItem(index, 'section', value)} className="w-full text-[10px] font-black uppercase text-slate-950" /></td></tr>}<tr className="group border-b border-slate-200 align-middle"><td className="px-3 py-2 text-center font-bold text-slate-400">{index + 1}</td><td className="px-3 py-2"><div className="flex items-center gap-1"><DocumentInput value={item.description} placeholder="Concepto" onChange={(value) => updateItem(index, 'description', value)} className="flex-1 font-medium text-slate-800" /><button type="button" aria-label="Eliminar concepto" title="Eliminar concepto" onClick={() => removeItem(index)} className="ml-auto shrink-0 rounded p-1 text-black opacity-100 transition hover:bg-red-50 hover:text-black focus:opacity-100"><Trash2 className="size-3" /></button></div></td><td className="px-2 py-2 text-center"><DocumentNumberInput value={item.quantity} ariaLabel="Empresas o unidades del concepto" onChange={(value) => updateItem(index, 'quantity', numberValue(value))} className="w-12 text-center" /></td><td className="px-2 py-2 text-right">{item.billingType === 'Valor agregado' ? <span className="whitespace-nowrap font-black text-emerald-700">Incluido</span> : <div className="flex items-center justify-end gap-1"><span className="text-[9px] text-slate-400">{draft.currency}</span><DocumentNumberInput value={item.unitPrice} ariaLabel="Precio de la modalidad principal" onChange={(value) => updateItem(index, 'unitPrice', numberValue(value))} className="w-20" /></div>}</td>{draft.showDiscount && <td className="px-2 py-2 text-right font-semibold text-red-600"><div className="space-y-1"><select value={item.discountType || 'AMOUNT'} onChange={(event) => updateItem(index, 'discountType', event.target.value as DiscountType)} disabled={item.billingType === 'Valor agregado'} aria-label="Tipo de descuento" className="h-6 w-full rounded-md border border-slate-200 bg-white px-1 text-[9px] font-bold text-slate-700 outline-none focus:border-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"><option value="AMOUNT">Monto</option><option value="PERCENT">Porcentaje</option></select><div className="flex items-center justify-end gap-1"><span className="text-[9px] text-slate-400">{item.discountType === 'PERCENT' ? '%' : draft.currency}</span><DocumentNumberInput value={Number(item.discountValue || 0)} ariaLabel="Valor de descuento" onChange={(value) => updateItem(index, 'discountValue', numberValue(value))} disabled={item.billingType === 'Valor agregado'} className="w-16 text-red-600" /></div></div></td>}<td className="px-2 py-2"><div className="space-y-2"><select value={item.billingType} onChange={(event) => updateItem(index, 'billingType', event.target.value)} className="h-7 w-full rounded-md border border-slate-200 bg-white px-1 text-[9px] font-bold text-slate-700 outline-none focus:border-emerald-400"><option value="Cobrado">Cobrado</option><option value="Valor agregado">Valor agregado</option></select>{item.billingType === 'Valor agregado' ? <span className="block text-[9px] font-semibold text-emerald-700">Sin costo adicional</span> : <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-1.5"><p className="mb-1 text-[8px] font-black uppercase tracking-wide text-slate-400">Habilitadas · principal</p>{billingPeriods.map((period) => { const option = billingOptionFor(item, period); const enabled = Boolean(option); return <div key={period} className="flex items-center gap-1"><label className="flex min-w-0 flex-1 items-center gap-1 text-[9px] font-semibold text-slate-600"><input type="checkbox" checked={enabled} onChange={(event) => updateBillingOption(index, period, event.target.checked)} className="size-3 accent-emerald-600" /><span className={item.periodicity === period ? 'font-black text-emerald-800' : ''}>{period}</span></label>{enabled && <DocumentNumberInput value={option?.unitPrice || 0} ariaLabel={`Precio ${period} para ${item.description || 'concepto'}`} onChange={(value) => updateBillingOptionPrice(index, period, numberValue(value))} className="w-16 text-[9px]" />}</div>; })}<select value={item.periodicity || 'Pago único'} onChange={(event) => updateItem(index, 'periodicity', event.target.value)} aria-label="Modalidad principal" className="mt-1 h-6 w-full rounded-md border border-transparent bg-transparent text-[9px] font-black text-emerald-800 outline-none hover:border-slate-300 focus:border-emerald-400">{billingOptionsOf(item).map((option) => <option key={option.periodicity} value={option.periodicity}>{option.periodicity} · principal</option>)}</select></div>}</div></td><td className="px-2 py-2"><DocumentInput value={item.detail || ''} placeholder="Descripción o beneficio incluido" onChange={(value) => updateItem(index, 'detail', value)} className="w-full text-[10px] text-slate-500" /></td>{commercialConditionEnabled && <td className="px-2 py-2 text-[9px] font-semibold text-orange-700">{conditionLabel(draft.commercialReport) || '-'}</td>}</tr></Fragment>)}</tbody></table>
    <div className="grid gap-5 border-t border-slate-200 pt-4 sm:grid-cols-[1fr_300px]"><div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">Valor agregado incluido</p><p className="mt-2 text-2xl font-black text-[#0f4b3a]">{preview.included}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">Conceptos incluidos sin costo adicional para hacer más clara la propuesta.</p></div><div className="space-y-1 text-[10px]"><p className="mb-2 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Resumen comercial</p>{draft.showInitialTotal && <SummaryLine label="Total inicial" value={preview.initialTotal} currency={draft.currency} />}{draft.showSubtotal && <SummaryLine label="Subtotal" value={preview.subtotal} currency={draft.currency} />}{draft.showDiscount && preview.discount > 0 && <SummaryLine label="Descuento" value={-preview.discount} currency={draft.currency} negative />}{draft.showMonthlyTotal && <SummaryLine label="Total mensual" value={preview.monthlyTotal} currency={draft.currency} />}{draft.showTax && draft.taxRate > 0 && <SummaryLine label={`Impuestos (${draft.taxRate}%)`} value={preview.tax} currency={draft.currency} />}{draft.showTotal && <div className="mt-2 flex items-center justify-between border-t-2 border-[#16a34a] pt-2 text-sm font-black text-slate-950"><span>TOTAL</span><span className="text-[#16a34a]">{money(preview.total, draft.currency)}</span></div>}</div></div>
    <div className="border-t border-slate-200 pt-4"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-700">Términos y condiciones</p><textarea value={draft.notes} onChange={(event) => field('notes', event.target.value)} placeholder="Escribe condiciones, alcance o notas comerciales..." rows={2} className="mt-1 w-full resize-none rounded-md border border-transparent bg-transparent p-0 text-[10px] leading-relaxed text-slate-500 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-emerald-50/50" /></div></div><div className="flex items-center justify-between border-t border-slate-200 bg-[#f8fafc] px-6 py-3 text-[9px] text-slate-500 sm:px-8"><span>Propuesta comercial confidencial · NovaHub ERP Platform</span><span>Documento editable</span></div></div></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="outline" className="rounded-xl border-emerald-700/20 bg-white" onClick={addItem}><Plus className="mr-2 size-4" /> Agregar concepto</Button><div className="flex flex-wrap items-center justify-end gap-2"><span className="hidden text-xs text-slate-500 sm:inline">El reporte comercial se edita desde su propia acción</span><Button variant="outline" className="rounded-xl bg-white" onClick={onClose}>Cancelar</Button><Button className="rounded-xl bg-[#0f4b3a] text-white hover:bg-[#0a3d30]" onClick={onSaveQuote}><CheckCircle2 className="mr-2 size-4 text-emerald-300" /> Guardar cotización</Button></div></div>
  </CardContent></Card>;
}

function SummaryLine({ label, value, currency, negative = false }: { label: string; value: number; currency: string; negative?: boolean }) { return <div className="flex items-center justify-between gap-4 text-slate-500"><span>{label}</span><strong className={negative ? 'text-red-600' : 'text-slate-800'}>{money(value, currency)}</strong></div>; }
function VisibilityToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition ${checked ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-400'}`}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-3.5 accent-emerald-600" /> {label}</label>; }
function DocumentInput({ value, onChange, placeholder, className = '' }: { value: string; onChange: (value: string) => void; placeholder: string; className?: string }) { if (placeholder.includes('Descripción')) return <div className="min-w-[180px] rounded-lg border border-slate-200 bg-slate-50/70 p-1.5 focus-within:border-emerald-400 focus-within:bg-emerald-50/50"><p className="mb-1 text-[8px] font-black uppercase tracking-wide text-slate-400">Listado editable · un punto por línea</p><textarea value={editableDetailValue(value)} placeholder="Agrega un beneficio o alcance por línea" title="Un beneficio o alcance por línea" rows={Math.min(6, Math.max(3, String(value || '').split(/\r?\n/).length))} onChange={(event) => onChange(editableDetailValue(event.target.value))} className="w-full resize-y bg-transparent px-0 py-0.5 text-[10px] leading-relaxed text-slate-500 outline-none placeholder:text-slate-400" /></div>; return <input value={value} placeholder={placeholder} title="Haz clic para editar" onChange={(event) => onChange(event.target.value)} className={`min-w-0 max-w-full border-b border-transparent bg-transparent px-0 py-0.5 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:bg-emerald-50/60 ${className}`} />; }
function DocumentNumberInput({ value, onChange, className = '', ariaLabel, disabled = false }: { value: number; onChange: (value: string) => void; className?: string; ariaLabel?: string; disabled?: boolean }) { return <input type="number" value={value} title="Haz clic para editar" aria-label={ariaLabel} disabled={disabled} onChange={(event) => onChange(event.target.value)} onWheel={(event) => event.currentTarget.blur()} className={`w-[78px] min-w-0 border-b border-transparent bg-transparent px-0 py-0.5 text-right font-medium text-slate-800 outline-none transition hover:border-slate-300 focus:border-emerald-500 focus:bg-emerald-50/60 disabled:cursor-not-allowed disabled:text-slate-400 ${className}`} />; }
function Input({ label, value, onChange, type = 'text' }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) { return <label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} onWheel={(event) => { if (type === 'number') event.currentTarget.blur(); }} className="mt-1 h-9 w-[92px] rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-emerald-500" /></label>; }
