import { api } from './api';

export interface CountryConfig {
  id: string;
  code: string;
  name: string;
  currencyCode: string;
  currencySymbol: string;
  locale: string;
  phoneCode: string;
  taxAuthName: string;
  taxIdLabel: string;
  ivaRate: number;
  ivaLabel: string;
  incomeTaxLabel: string;
  socialSecurityLabel: string;
  usesUf: boolean;
  ufName?: string;
  usesCentavos: boolean;
  dateFormat: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  inssLaboralPct?: number;
  inssPatronalPct?: number;
  inatecPct?: number;
  trecenoMesPct?: number;
  vacacionesPct?: number;
  indemnizacionPct?: number;
  irEnabled: boolean;
  irTramo1Limite?: number;
  irTramo1Pct?: number;
  irTramo2Limite?: number;
  irTramo2Base?: number;
  irTramo2Pct?: number;
  irTramo3Limite?: number;
  irTramo3Base?: number;
  irTramo3Pct?: number;
  irTramo4Limite?: number;
  irTramo4Base?: number;
  irTramo4Pct?: number;
  irTramo5Base?: number;
  irTramo5Pct?: number;
}

// ─── DEEP IMPACT ANALYSIS ──────────────────────────────────────────

export interface ImpactTemplate {
  name: string;
  description: string;
  format: string;
  authority: string;
  mandatory: boolean;
  periodicity: string;
}

export interface ImpactViewChange {
  view: string;           // nombre del componente/vista
  description: string;    // qué cambiaría
  category: 'currency' | 'tax' | 'document' | 'format' | 'validation' | 'integration' | 'ui' | 'template';
}

export interface ImpactSubmodule {
  submodule: string;       // ej: "Estimaciones", "Facturas", "Clientes"
  views: ImpactViewChange[];
  templates?: ImpactTemplate[];
}

export interface ImpactModule {
  module: string;
  label: string;
  icon: string;
  submodules: ImpactSubmodule[];
}

// ─── CHILE-SPECIFIC IMPACT ─────────────────────────────────────────

const CL_TEMPLATES: Record<string, ImpactTemplate[]> = {
  'Facturas': [
    { name: 'DTE Factura Electrónica', description: 'Documento Tributario Electrónico principal para facturación SII', format: 'XML (DTE v70/v80)', authority: 'SII', mandatory: true, periodicity: 'Cada factura' },
    { name: 'DTE Factura Exenta', description: 'Factura electrónica exenta de IVA', format: 'XML DTE (Código 34)', authority: 'SII', mandatory: true, periodicity: 'Cada factura' },
    { name: 'DTE Boleta Electrónica', description: 'Boleta electrónica para ventas a consumidor final', format: 'XML DTE (Código 39)', authority: 'SII', mandatory: true, periodicity: 'Cada boleta' },
    { name: 'DTE Guía de Despacho', description: 'Guía de despacho electrónica para traslado de mercadería', format: 'XML DTE (Código 52)', authority: 'SII', mandatory: true, periodicity: 'Cada despacho' },
    { name: 'DTE Nota de Crédito', description: 'Nota de crédito electrónica para anulaciones/descuentos', format: 'XML DTE (Código 61)', authority: 'SII', mandatory: true, periodicity: 'Según necesidad' },
    { name: 'DTE Nota de Débito', description: 'Nota de débito electrónica para cobros adicionales', format: 'XML DTE (Código 56)', authority: 'SII', mandatory: true, periodicity: 'Según necesidad' },
    { name: 'DTE Liquidación-Factura', description: 'Liquidación factura para operaciones de consignación', format: 'XML DTE (Código 43)', authority: 'SII', mandatory: true, periodicity: 'Según necesidad' },
    { name: 'CAF/CAE', description: 'Código de Autorización de Folios - timbre electrónico SII', format: 'XML firmado por SII', authority: 'SII', mandatory: true, periodicity: 'Antes de emitir DTEs' },
    { name: 'Intercambio DTE', description: 'Envío y recepción de DTE entre empresas (RCOF, RCV)', format: 'XML + firma electrónica', authority: 'SII', mandatory: true, periodicity: 'Diario' },
  ],
  'Reportes Fiscales': [
    { name: 'Formulario 29 (F29)', description: 'Declaración mensual de IVA - impuestos mensuales', format: 'Web SII / XML', authority: 'SII', mandatory: true, periodicity: 'Mensual' },
    { name: 'Formulario 22 (F22)', description: 'Declaración anual de impuesto a la renta', format: 'Web SII / XML', authority: 'SII', mandatory: true, periodicity: 'Anual (Abril)' },
    { name: 'Formulario 30 (F30)', description: 'Declaración de retenciones', format: 'Web SII', authority: 'SII', mandatory: true, periodicity: 'Mensual' },
    { name: 'Formulario 1887', description: 'Resumen anual de remuneraciones (rentas del trabajo)', format: 'Web SII / XML', authority: 'SII', mandatory: true, periodicity: 'Anual' },
    { name: 'Libro de Compra', description: 'Registro electrónico de compras (RCV)', format: 'XML / CSV SII', authority: 'SII', mandatory: true, periodicity: 'Mensual' },
    { name: 'Libro de Venta', description: 'Registro electrónico de ventas (RCOF)', format: 'XML / CSV SII', authority: 'SII', mandatory: true, periodicity: 'Mensual' },
  ],
  'Nóminas': [
    { name: 'Cotizaciones Previsionales', description: 'Pago de cotizaciones AFP + FONASA/ISAPRE + AFC', format: 'Plataforma Previred', authority: 'PREVIRED', mandatory: true, periodicity: 'Mensual' },
    { name: 'Declaración de Trabajadores', description: 'Reporte de trabajadores dependientes e independientes', format: 'Web SII / XML', authority: 'SII', mandatory: true, periodicity: 'Mensual' },
    { name: 'Finiquito Electrónico', description: 'Documento de término de relación laboral', format: 'Plataforma DT', authority: 'Dirección del Trabajo', mandatory: true, periodicity: 'Al término' },
  ],
};

export function getImpactByCountry(country: CountryConfig): ImpactModule[] {
  const isCL = country.code === 'CL';
  const templates = isCL ? CL_TEMPLATES : {};

  return [
    {
      module: 'ventas', label: 'Ventas', icon: 'ShoppingBag',
      submodules: [
        {
          submodule: 'Estimaciones (Cotizaciones)', views: [
            { view: 'EstimacionesView', description: `Moneda: ${country.currencySymbol} (${country.currencyCode})`, category: 'currency' },
            { view: 'EstimacionesView', description: `IVA: ${country.ivaRate}% (${country.ivaLabel}) aplicado automáticamente`, category: 'tax' },
            { view: 'EstimacionesView', description: `ID Tributario cliente: ${country.taxIdLabel} con formato local`, category: 'format' },
            { view: 'EstimacionesView', description: !country.usesCentavos ? 'Precios redondeados sin decimales' : 'Precios con decimales', category: 'format' },
            { view: 'EstimacionesView', description: isCL ? 'Incluir referencias a cotización en pesos chilenos' : '', category: 'ui' },
            { view: 'EstimacionesView', description: country.usesUf ? `Mostrar valores en ${country.ufName} como referencia` : '', category: 'ui' },
          ].filter(Boolean) as ImpactViewChange[] },
        {
          submodule: 'Facturas Electrónicas', views: [
            { view: 'FacturasView', description: `Moneda base: ${country.currencyCode}`, category: 'currency' },
            { view: 'FacturasView', description: `Tasa ${country.ivaLabel}: ${country.ivaRate}%`, category: 'tax' },
            { view: 'FacturasView', description: `Número de identificación fiscal: ${country.taxIdLabel}`, category: 'format' },
            { view: 'FacturasView', description: `Autoridad: ${country.taxAuthName}`, category: 'ui' },
            { view: 'FacturasView', description: isCL ? 'Formato RUT: XX.XXX.XXX-X con dígito verificador' : '', category: 'format' },
            { view: 'FacturasView', description: !country.usesCentavos ? 'Totales redondeados (CLP no tiene centavos)' : 'Totales con 2 decimales', category: 'format' },
          ].filter(Boolean) as ImpactViewChange[],
          templates: templates['Facturas'],
        },
        {
          submodule: 'Clientes', views: [
            { view: 'ClientesPage', description: `ID Tributario: ${country.taxIdLabel}`, category: 'format' },
            { view: 'ClientesPage', description: isCL ? 'Validación de RUT con DV (módulo 11)' : '', category: 'validation' },
            { view: 'ClientesPage', description: `Formato telefónico: +${country.phoneCode}`, category: 'format' },
            { view: 'ClientesPage', description: isCL ? 'Giros comerciales según SII' : '', category: 'ui' },
          ].filter(Boolean) as ImpactViewChange[] },
        {
          submodule: 'Caja / POS', views: [
            { view: 'ControlCajaView', description: `Moneda: ${country.currencySymbol} (${country.currencyCode})`, category: 'currency' },
            { view: 'FacturacionCajaView', description: isCL ? 'Integración Boleta Electrónica SII' : 'Facturación DGI', category: 'integration' },
            { view: 'FacturacionCajaView', description: !country.usesCentavos ? 'Redondeo de montos en efectivo' : 'Manejo de centavos', category: 'format' },
          ].filter(Boolean) as ImpactViewChange[] },
      ],
    },
    {
      module: 'compras', label: 'Compras', icon: 'ShoppingCart',
      submodules: [
        {
          submodule: 'Órdenes de Compra', views: [
            { view: 'OrdenesCompraView', description: `Moneda: ${country.currencySymbol} (${country.currencyCode})`, category: 'currency' },
            { view: 'OrdenesCompraView', description: isCL ? 'Número de OC con formato chileno' : '', category: 'format' },
          ].filter(Boolean) as ImpactViewChange[] },
        {
          submodule: 'Recepciones de Compra', views: [
            { view: 'RecepcionesCompraView', description: `Validación ${country.taxIdLabel} del proveedor`, category: 'validation' },
            { view: 'RecepcionesCompraView', description: isCL ? 'Validación RUT proveedor + aceptación DTE en SII' : '', category: 'integration' },
            { view: 'RecepcionesCompraView', description: isCL ? 'Recepción de DTE de proveedores (RCV - Registro de Compras)' : '', category: 'integration' },
            { view: 'RecepcionesCompraView', description: `Tasa ${country.ivaLabel}: ${country.ivaRate}%`, category: 'tax' },
          ] },
        {
          submodule: 'Proveedores', views: [
            { view: 'ProveedoresView', description: `ID Tributario: ${country.taxIdLabel}`, category: 'format' },
            { view: 'ProveedoresView', description: isCL ? 'Validación RUT con DV' : '', category: 'validation' },
          ].filter(Boolean) as ImpactViewChange[] },
      ],
    },
    {
      module: 'inventario', label: 'Inventario', icon: 'Package',
      submodules: [
        {
          submodule: 'Productos', views: [
            { view: 'ProductosView', description: `Precios en ${country.currencySymbol} (${country.currencyCode})`, category: 'currency' },
            { view: 'ProductosView', description: !country.usesCentavos ? 'Redondeo de precios unitarios' : 'Precios con decimales', category: 'format' },
            { view: 'ProductosView', description: isCL ? 'Códigos de producto según clasificación SII' : '', category: 'ui' },
          ].filter(Boolean) as ImpactViewChange[] },
        {
          submodule: 'Transferencias', views: [
            { view: 'TransferenciasView', description: isCL ? 'Guía de Despacho Electrónica obligatoria para traslados' : 'Guía de remisión', category: 'template' },
          ] },
      ],
    },
    {
      module: 'contabilidad', label: 'Contabilidad', icon: 'BookOpen',
      submodules: [
        {
          submodule: 'Plan de Cuentas', views: [
            { view: 'PlanCuentasView', description: `Moneda funcional: ${country.currencyCode}`, category: 'currency' },
            { view: 'PlanCuentasView', description: country.usesUf ? `Cuentas en UF para activos indexados` : 'Sin cuentas indexadas', category: 'ui' },
            { view: 'PlanCuentasView', description: isCL ? 'Clasificación de cuentas según SII (Código 2.0, 3.0, 5.0)' : 'Clasificación DGI Nicaragua', category: 'template' },
          ].filter(Boolean) as ImpactViewChange[] },
        {
          submodule: 'Asientos Contables', views: [
            { view: 'AsientosView', description: `Moneda de registro: ${country.currencyCode}`, category: 'currency' },
            { view: 'JournalEntries', description: country.usesUf ? 'Registro de operaciones en UF + CLP' : 'Registro en moneda local', category: 'format' },
          ] },
        {
          submodule: 'Configuración Contable', views: [
            { view: 'ConfiguracionContableView', description: `Tasa ${country.ivaLabel}: ${country.ivaRate}%`, category: 'tax' },
            { view: 'ConfiguracionContableView', description: `Entidad: ${country.taxAuthName}`, category: 'ui' },
            { view: 'ConfiguracionContableView', description: isCL ? 'Mapeo de cuentas para DTE (códigos SII)' : 'Mapeo DGI', category: 'template' },
          ] },
        {
          submodule: 'Reportes Fiscales', views: [
            { view: 'FiscalReports', description: isCL ? 'F29 (IVA mensual) + F22 (Renta anual)' : 'Declaración IVA + IR + INSS', category: 'template' },
            { view: 'FiscalReports', description: isCL ? 'Libro de Compra y Venta electrónico (RCV/RCOF)' : 'Registros de compra/venta DGI', category: 'template' },
            { view: 'FiscalReports', description: `Declaración de ${country.ivaLabel} ante ${country.taxAuthName}`, category: 'tax' },
          ] },
      ],
    },
    {
      module: 'rh', label: 'RH / Nóminas', icon: 'Users',
      submodules: [
        {
          submodule: 'Empleados', views: [
            { view: 'EmpleadosView', description: `Documento identificación: ${country.taxIdLabel}`, category: 'format' },
            { view: 'EmpleadosView', description: isCL ? 'RUT trabajador + DV' : 'Cédula/RUC Nicaragua', category: 'format' },
            { view: 'EmpleadosView', description: isCL ? 'AFP + FONASA/ISAPRE + AFC como datos obligatorios' : 'INSS como dato obligatorio', category: 'ui' },
          ] },
        {
          submodule: 'Nóminas / Planilla', views: [
            { view: 'NominasView', description: `Moneda: ${country.currencySymbol} (${country.currencyCode})`, category: 'currency' },
            { view: 'NominasView', description: country.inssLaboralPct ? `Descuento empleado: ${country.inssLaboralPct}%` : 'Cotización AFP (10%) + comisión AFP variable', category: 'tax' },
            { view: 'NominasView', description: country.inssPatronalPct ? `Aporte empleador: ${country.inssPatronalPct}%` : 'Aporte empleador FONASA/ISAPRE + Seguro Cesantía (AFC)', category: 'tax' },
            { view: 'NominasView', description: isCL ? 'Cálculo de Impuesto Único de Segunda Categoría (tabla progresiva SII)' : 'Cálculo IR según Ley 822', category: 'tax' },
            { view: 'NominasView', description: isCL ? 'Sin INATEC, sin treceavo (aguinaldo distinto, basado en meses trabajados)' : 'INATEC 2% + Treceavo 8.33%', category: 'tax' },
            { view: 'NominasView', description: isCL ? 'Seguro de Cesantía (AFC): 3% empleador + 0.6% trabajador' : '', category: 'tax' },
            { view: 'NominasView', description: isCL ? 'Finiquito electrónico obligatorio al término' : 'Carta de renuncia/despido', category: 'template' },
          ].filter(Boolean) as ImpactViewChange[] },
        {
          submodule: 'Configuración Nómina', views: [
            { view: 'ConfigNominaView', description: isCL ? 'AFP múltiples (Provida, Capital, Habitat, Cuprum, PlanVital, Uno)' : 'INSS único', category: 'ui' },
            { view: 'ConfigNominaView', description: isCL ? 'ISAPRE/FONASA con planes de salud variables' : '', category: 'ui' },
            { view: 'ConfigNominaView', description: isCL ? 'Tabla de Impuesto Único SII actualizable' : 'Tabla IR Ley 822 Nicaragua', category: 'template' },
          ] },
      ],
    },
    {
      module: 'asesoria-legal', label: 'Asesoría Legal', icon: 'Scale',
      submodules: [
        {
          submodule: 'Tipos de Trámite', views: [
            { view: 'AsesoriaLegalView', description: isCL ? 'Constitución SpA, EIRL, Ltda, SA (vs Nicaragua: SAS, Cía. Ltda)' : 'Tipos societarios Nicaragua', category: 'template' },
            { view: 'AsesoriaLegalView', description: isCL ? 'RUT ante SII (vs RUC ante DGI)' : 'RUC/DGI', category: 'format' },
            { view: 'AsesoriaLegalView', description: isCL ? 'Inicio de actividades en SII + Municipal' : 'Registro DGI + Municipal', category: 'template' },
          ] },
        {
          submodule: 'Documentos Legales', views: [
            { view: 'DocumentosView', description: isCL ? 'Escrituras notariales chilenas (formato distinto)' : 'Escrituras Nicaragua', category: 'template' },
            { view: 'DocumentosView', description: isCL ? 'Contratos bajo Código de Comercio chileno' : 'Código de Comercio Nicaragua', category: 'template' },
          ] },
      ],
    },
    {
      module: 'finanzas', label: 'Finanzas', icon: 'DollarSign',
      submodules: [
        {
          submodule: 'Cuentas por Cobrar/Pagar', views: [
            { view: 'CobrosView', description: `Moneda: ${country.currencySymbol} (${country.currencyCode})`, category: 'currency' },
            { view: 'PagosView', description: `Moneda: ${country.currencySymbol} (${country.currencyCode})`, category: 'currency' },
            { view: 'CobrosView', description: isCL ? 'Intereses y reajustes en UF para cuentas morosas' : 'Intereses moratorios en C$', category: 'tax' },
          ] },
        {
          submodule: 'Conciliación Bancaria', views: [
            { view: 'ConciliacionView', description: `Formato de cuentas bancarias locales`, category: 'format' },
            { view: 'ConciliacionView', description: isCL ? 'Banco Estado, Santander, BCI, Scotiabank, Itaú (vs BAC, Lafise, BANPRO Nicaragua)' : 'Bancos Nicaragua', category: 'ui' },
          ] },
      ],
    },
    {
      module: 'inventario', label: 'Inventario', icon: 'Package',
      submodules: [
        {
          submodule: 'Control de Stock', views: [
            { view: 'ControlStockView', description: `Costos en ${country.currencySymbol}`, category: 'currency' },
            { view: 'MovimientosView', description: isCL ? 'Guía de Despacho Electrónica requerida' : 'Guía de remisión física', category: 'template' },
          ] },
      ],
    },
    {
      module: 'reportes', label: 'Reportes', icon: 'BarChart3',
      submodules: [
        {
          submodule: 'Reportes Fiscales', views: [
            { view: 'SalesReportTab', description: `Reportes con ${country.ivaLabel} al ${country.ivaRate}%`, category: 'tax' },
            { view: 'FinanceReportTab', description: `Estados financieros en ${country.currencyCode}`, category: 'currency' },
            { view: 'FinanceReportTab', description: country.usesUf ? `Balance General en ${country.currencyCode} + UF` : 'Balance en moneda local', category: 'format' },
            { view: 'PurchasesReportTab', description: isCL ? 'Libro de Compras formato SII' : '', category: 'template' },
            { view: 'SalesReportTab', description: isCL ? 'Libro de Ventas formato SII' : '', category: 'template' },
          ].filter(Boolean) as ImpactViewChange[] },
      ],
    },
    {
      module: 'plataforma', label: 'Plataforma / Configuración', icon: 'Settings',
      submodules: [
        {
          submodule: 'Configuración General', views: [
            { view: 'ConfiguracionPage', description: `País: ${country.name} - afecta moneda, impuestos, formatos`, category: 'ui' },
            { view: 'CurrencyContext', description: `Soporte para ${country.currencyCode} como moneda base`, category: 'currency' },
            { view: 'Topbar', description: `Selector de moneda: ${country.currencySymbol} (${country.currencyCode})`, category: 'ui' },
            { view: 'ConfiguracionPage', description: country.usesUf ? `Mostrar UF como unidad de referencia` : '', category: 'ui' },
          ].filter(Boolean) as ImpactViewChange[] },
        {
          submodule: 'Integraciones', views: [
            { view: 'IntegracionesView', description: isCL ? 'API SII para DTE (firma electrónica avanzada)' : 'API DGI Nicaragua', category: 'integration' },
            { view: 'IntegracionesView', description: isCL ? 'PREVIRED para cotizaciones previsionales' : '', category: 'integration' },
            { view: 'IntegracionesView', description: isCL ? 'Banco Central de Chile para UF diaria' : 'BCN para tasa de cambio', category: 'integration' },
          ].filter(Boolean) as ImpactViewChange[] },
      ],
    },
    {
      module: 'financiamiento', label: 'Financiamiento PYME', icon: 'HandCoins',
      submodules: [
        {
          submodule: 'Solicitudes', views: [
            { view: 'FinanciamientoView', description: isCL ? 'Referencias a SII (ingresos declarados) en vez de DGI' : 'Referencias DGI/INSS', category: 'ui' },
            { view: 'FinanciamientoView', description: isCL ? 'RUT empresarial + inicio de actividades en SII' : 'RUC + inscripción DGI', category: 'format' },
          ] },
      ],
    },
    {
      module: 'novachat', label: 'NovaChat', icon: 'MessageCircle',
      submodules: [
        {
          submodule: 'WhatsApp', views: [
            { view: 'NovaChatView', description: `Código de país: +${country.phoneCode}`, category: 'format' },
            { view: 'LegalChatPanel', description: `Formato de teléfono: +${country.phoneCode} para redirección WhatsApp`, category: 'format' },
          ] },
      ],
    },
  ];
}

// ─── SIMPLIFIED FLAT IMPACT (for card previews) ────────────────────

export interface ImpactPreview {
  module: string;
  label: string;
  icon: string;
  changes: string[];
}

export function getImpactPreviews(country: CountryConfig): ImpactPreview[] {
  return getImpactByCountry(country).map((mod) => ({
    module: mod.module,
    label: mod.label,
    icon: mod.icon,
    changes: mod.submodules.flatMap((sm) =>
      sm.views.map((v) => v.description).filter(Boolean)
    ),
  }));
}

// ─── SERVICE ───────────────────────────────────────────────────────

export const countryConfigService = {
  list: () => api.get<CountryConfig[]>('/country-config'),
  get: (code: string) => api.get<CountryConfig>(`/country-config/${code}`),
  create: (data: Partial<CountryConfig>) => api.post<CountryConfig>('/country-config', data),
  update: (code: string, data: Partial<CountryConfig>) => api.patch<CountryConfig>(`/country-config/${code}`, data),
  delete: (code: string) => api.delete(`/country-config/${code}`),
};

export const COUNTRY_FLAGS: Record<string, string> = {
  NI: '\u{1F1F3}\u{1F1EE}',
  CL: '\u{1F1E8}\u{1F1F1}',
  PE: '\u{1F1F5}\u{1F1EA}',
};
