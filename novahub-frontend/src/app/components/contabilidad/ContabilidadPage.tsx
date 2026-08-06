import { useState } from 'react';
import {
  BookOpen, FileText, Scale, TrendingUp, PieChart,
  DollarSign, Landmark, Calendar, FileBarChart,
  BookOpenCheck, Building2, FileSpreadsheet, HelpCircle,
  Database, GitBranch, ChevronDown, X, Settings2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tag, Wallet } from 'lucide-react';
import { cn } from '../ui/utils';
import { PlanCuentasView } from './PlanCuentasView';
import { DiarioView } from './DiarioView';
import { BalanceComprobacionView } from './BalanceComprobacionView';
import { EstadoResultadosView } from './EstadoResultadosView';
import { BalanceGeneralView } from './BalanceGeneralView';
import { FlujoEfectivoView } from './FlujoEfectivoView';
import { ConciliacionView } from './ConciliacionView';
import { PeriodosView } from './PeriodosView';
import { ReportesFiscalesView } from './ReportesFiscalesView';
import { LibroMayorView } from './LibroMayorView';
import { ActivosFijosView } from './ActivosFijosView';
import { CambiosPatrimonioView } from './CambiosPatrimonioView';
import { ConfiguracionContableView } from './ConfiguracionContableView';
import { CategoriasGastosView } from './CategoriasGastosView';
import { BudgetItemsView } from './BudgetItemsView';

const SECTIONS = [
  { id: 'plan-cuentas', label: 'Plan de Cuentas', icon: BookOpen },
  { id: 'diario', label: 'Libro Diario', icon: FileText },
  { id: 'libro-mayor', label: 'Libro Mayor', icon: BookOpenCheck },
  { id: 'balance-comprobacion', label: 'Balance de Comprobación', icon: Scale },
  { id: 'estado-resultados', label: 'Estado de Resultados', icon: TrendingUp },
  { id: 'balance-general', label: 'Balance General', icon: PieChart },
  { id: 'flujo-efectivo', label: 'Flujo de Efectivo', icon: DollarSign },
  { id: 'cambios-patrimonio', label: 'Cambios Patrimonio', icon: FileSpreadsheet },
  { id: 'activos-fijos', label: 'Activos Fijos', icon: Building2 },
  { id: 'conciliacion', label: 'Conciliación Bancaria', icon: Landmark },
  { id: 'periodos', label: 'Períodos Contables', icon: Calendar },
  { id: 'reportes-fiscales', label: 'Reportes Fiscales', icon: FileBarChart },
  { id: 'presupuestos', label: 'Presupuestos', icon: Wallet },
  { id: 'categorias-gastos', label: 'Categorías Gastos', icon: Tag },
  { id: 'configuracion', label: 'Configuración', icon: Settings2 },
];

const HELP_DATA: Record<string, {
  description: string;
  model: string;
  relationships: { parent: string; child: string; relation: string }[];
  faq: { q: string; a: string }[];
}> = {
  'plan-cuentas': {
    description: 'Estructura jerárquica de cuentas contables. Cada cuenta puede tener subcuentas anidadas y pertenece a una categoría (Activo, Pasivo, Patrimonio, Ingresos, Egresos).',
    model: 'AccountingAccount → AccountingAccount (self-relation via parentId)',
    relationships: [
      { parent: 'AccountingAccount', child: 'AccountingAccount', relation: 'parentId (auto-relación jerárquica)' },
      { parent: 'AccountingAccount', child: 'JournalEntryLine', relation: 'accountId → id (líneas de asientos usan la cuenta)' },
      { parent: 'AccountingAccount', child: 'AccountingAccountBalance', relation: 'accountId → id (saldos iniciales)' },
    ],
    faq: [
      { q: '¿Qué significa el código de la cuenta?', a: 'El código sigue la norma NIC (NIIF). Ejemplo: 1.1.01 = Activo > Circulante > Caja. Los puntos indican la jerarquía padre-hijo.' },
      { q: '¿Puedo eliminar una cuenta que tiene movimientos?', a: 'No. Si tiene JournalEntryLine vinculadas, el sistema bloquea la eliminación. Primero revertí o trasladá los movimientos.' },
      { q: '¿Qué es una cuenta de balance vs. resultado?', a: 'Las de balance (Activos/Pasivos/Patrimonio) acumulan saldos entre períodos. Las de resultado (Ingresos/Egresos) se reinician a cero en cada cierre.' },
    ],
  },
  'diario': {
    description: 'Registro cronológico de todas las transacciones contables. Cada asiento tiene al menos 2 líneas (débito = crédito).',
    model: 'JournalEntry (cabecera) → JournalEntryLine (líneas débito/crédito)',
    relationships: [
      { parent: 'JournalEntry', child: 'JournalEntryLine', relation: 'entryId → id (1:N cada asiento tiene múltiples líneas)' },
      { parent: 'JournalEntryLine', child: 'AccountingAccount', relation: 'accountId → id (cada línea apunta a una cuenta)' },
      { parent: 'JournalEntry', child: 'AccountingPeriod', relation: 'periodId → id (asiento pertenece a un período contable)' },
      { parent: 'JournalEntry', child: 'Invoice', relation: 'sourceId → id (origen opcional: factura, pago, etc.)' },
    ],
    faq: [
      { q: '¿Qué es un asiento de ajuste?', a: 'Registro hecho al cierre del período para corregir o reconocer ingresos/gastos devengados que no se registraron durante el mes.' },
      { q: '¿Por qué no puedo editar un asiento cerrado?', a: 'Los asientos de períodos cerrados están protegidos. Para corregir, hacé un asiento de reversión en el período abierto actual.' },
      { q: '¿Cómo se vincula con facturas?', a: 'Al facturar, el sistema genera automáticamente un JournalEntry con las líneas: Débito en Cuentas por Cobrar, Crédito en Ingresos + IVA.' },
    ],
  },
  'libro-mayor': {
    description: 'Resumen de movimientos y saldo acumulado de cada cuenta. Filtra por cuenta y período para ver todos los débitos, créditos y saldo final.',
    model: 'AccountingAccount (cuenta) + JournalEntryLine (movimientos filtrados por accountId)',
    relationships: [
      { parent: 'AccountingAccount', child: 'JournalEntryLine', relation: 'accountId → id (todas las líneas de esa cuenta)' },
      { parent: 'JournalEntryLine', child: 'JournalEntry', relation: 'entryId → id (para obtener fecha, descripción, comprobante)' },
    ],
    faq: [
      { q: '¿Cómo se calcula el saldo del libro mayor?', a: 'Saldo = Suma(Débitos) - Suma(Créditos) de todas las JournalEntryLine de esa cuenta en el período. Si es positivo es deudor, si es negativo acreedor.' },
      { q: '¿Qué pasa si el libro mayor no cuadra?', a: 'Imposible si los asientos están correctos (débito = crédito). Revisá JournalEntryLine: si falta una línea o el monto está mal, el balance de comprobación lo detecta.' },
    ],
  },
  'balance-comprobacion': {
    description: 'Tabla que verifica la igualdad débito = crédito. Lista todas las cuentas con saldo y verifica que el total débitos = total créditos.',
    model: 'AccountingAccount + JournalEntryLine (agregados por accountId)',
    relationships: [
      { parent: 'AccountingAccount', child: 'JournalEntryLine', relation: 'accountId → id (agregación SUM(debit) y SUM(credit) por cuenta)' },
    ],
    faq: [
      { q: '¿Qué significa cuando no cuadra?', a: 'Hay un error en JournalEntryLine: monto mal ingresado, línea faltante, o cuenta inexistente. El sistema muestra la diferencia para localizar el error.' },
      { q: '¿Qué son las columnas "Debe" y "Haber"?', a: 'Debe = total de débitos de esa cuenta. Haber = total de créditos. Si Debe > Haber, la cuenta tiene saldo deudor (activos). Si Haber > Debe, saldo acreedor (pasivos/ingresos).' },
    ],
  },
  'estado-resultados': {
    description: 'Muestra la rentabilidad del período: Ingresos - Costos - Gastos = Utilidad/Pérdida Neta.',
    model: 'AccountingAccount (tipo INGRESO/EGRESO) + JournalEntryLine (sumatoria por tipo)',
    relationships: [
      { parent: 'AccountingAccount', child: 'JournalEntryLine', relation: 'accountId → id (filtro por accountType IN [INGRESO, EGRESO])' },
      { parent: 'AccountingAccount', child: 'AccountingAccount', relation: 'parentId (agrupación por categoría padre)' },
    ],
    faq: [
      { q: '¿Qué cuentas aparecen aquí?', a: 'Solo cuentas de tipo Ingreso y Egreso (Resultado). Las cuentas de Balance (Activos, Pasivos) NO aparecen aquí.' },
      { q: '¿Puedo comparar períodos?', a: 'Sí. Seleccioná dos períodos contables y el sistema muestra columnas comparativas con variación absoluta y porcentual.' },
    ],
  },
  'balance-general': {
    description: 'Posición financiera de la empresa en una fecha: Activos = Pasivos + Patrimonio.',
    model: 'AccountingAccount (tipo ACTIVO/PASIVO/PATRIMONIO) + JournalEntryLine (saldos acumulados)',
    relationships: [
      { parent: 'AccountingAccount', child: 'JournalEntryLine', relation: 'accountId → id (filtro por accountType IN [ACTIVO, PASIVO, PATRIMONIO])' },
      { parent: 'AccountingAccount', child: 'AccountingAccount', relation: 'parentId (agrupación en secciones: Circulante, No Circulante, etc.)' },
    ],
    faq: [
      { q: '¿Por qué no cuadra con el Estado de Resultados?', a: 'Cuadra siempre: la Utilidad Neta del Estado de Resultados se refleja en Patrimonio del Balance General. Son dos carillas de la misma moneda.' },
      { q: '¿Qué es el pasivo corriente vs. no corriente?', a: 'Corriente: deudas a pagar en < 1 año (proveedores, impuestos). No corriente: deudas a > 1 año (préstamos bancarios, hipotecas).' },
    ],
  },
  'flujo-efectivo': {
    description: 'Movimientos de efectivo clasificados por actividad: Operativa, Inversión y Financiamiento.',
    model: 'FinancialAccount (cuentas bancarias/efectivo) + JournalEntryLine (movimientos clasificados)',
    relationships: [
      { parent: 'FinancialAccount', child: 'JournalEntryLine', relation: 'accountId → id (filtrado por cuentas de efectivo/banco)' },
      { parent: 'JournalEntry', child: 'JournalEntryLine', relation: 'entryId → id (clasificación operativa/inversión/financiamiento)' },
    ],
    faq: [
      { q: '¿Cómo se clasifica cada movimiento?', a: 'Operativo: ventas, pagos a proveedores, nómina. Inversión: compra de activos fijos. Financiamiento: préstamos recibidos, pagos de deuda.' },
      { q: '¿Qué es el flujo de efectivo neto?', a: 'Efectivo Inicial + Ingresos por Operación - Pagos por Operación - Inversión + Financiamiento = Efectivo Final del período.' },
    ],
  },
  'cambios-patrimonio': {
    description: 'Evolución del patrimonio neto: capital social, reservas, utilidades acumuladas y distribución de dividendos.',
    model: 'AccountingAccount (PATRIMONIO) + JournalEntryLine + DividendDistribution',
    relationships: [
      { parent: 'AccountingAccount', child: 'JournalEntryLine', relation: 'accountId → id (cuentas de patrimonio)' },
      { parent: 'JournalEntry', child: 'JournalEntryLine', relation: 'entryId → id (asientos que afectan patrimonio: capital, reservas)' },
    ],
    faq: [
      { q: '¿Qué afecta el patrimonio?', a: 'Aumenta: aportes de capital, utilidades retenidas. Disminuye: pérdidas, dividendos distribuidos, retiros de capital.' },
      { q: '¿Cómo se vincula con el Balance General?', a: 'La sección Patrimonio del Balance General es la suma de todas las cuentas de patrimonio, que se detallan en este reporte.' },
    ],
  },
  'activos-fijos': {
    description: 'Control de bienes de uso: costo, depreciación acumulada, valor neto en libros y vida útil.',
    model: 'FixedAsset → DepreciationEntry (1:N)',
    relationships: [
      { parent: 'FixedAsset', child: 'DepreciationEntry', relation: 'assetId → id (historial de depreciación mensual/anual)' },
      { parent: 'FixedAsset', child: 'AccountingAccount', relation: 'accountId → id (cuenta contable asociada al activo)' },
      { parent: 'FixedAsset', child: 'DepreciationEntry', relation: 'periodId → id (depreciación por período)' },
    ],
    faq: [
      { q: '¿Qué es el valor neto en libros?', a: 'Costo de Adquisición - Depreciación Acumulada. Es el valor contable actual del activo, no su valor de mercado.' },
      { q: '¿Cómo funciona la depreciación mensual?', a: 'Método lineal: (Costo - Residual) / Vida Útil en meses. Ejemplo: equipo $10,000, residual $1,000, 60 meses = $150/mes.' },
    ],
  },
  'conciliacion': {
    description: 'Comparación entre el saldo de extracto bancario y el saldo contable. Identifica diferencias por cheques no cobrados, depósitos en tránsito, etc.',
    model: 'BankReconciliation → ReconciliationItem (1:N)',
    relationships: [
      { parent: 'BankReconciliation', child: 'ReconciliationItem', relation: 'reconciliationId → id (movimientos conciliados/pendientes)' },
      { parent: 'ReconciliationItem', child: 'JournalEntry', relation: 'entryId → id (asiento contable del movimiento bancario)' },
      { parent: 'BankReconciliation', child: 'FinancialAccount', relation: 'accountId → id (cuenta bancaria conciliada)' },
    ],
    faq: [
      { q: '¿Qué es un depósito en tránsito?', a: 'Dinero que vos registraste como depositado pero que el banco aún no procesó. Aparece en tu libro mayor pero no en el extracto bancario.' },
      { q: '¿Por qué hay diferencias?', a: 'Causas: cheques emitidos no cobrados, depósitos en tránsito, comisiones bancarias no registradas, transferencias entre cuentas sin conciliar.' },
    ],
  },
  'periodos': {
    description: 'Gestión de períodos contables: apertura, cierre mensual/anual y congelación de datos.',
    model: 'AccountingPeriod',
    relationships: [
      { parent: 'AccountingPeriod', child: 'JournalEntry', relation: 'periodId → id (todos los asientos del período)' },
      { parent: 'AccountingPeriod', child: 'AccountingPeriod', relation: 'parentPeriodId → id (período anual contiene períodos mensuales)' },
    ],
    faq: [
      { q: '¿Qué pasa al cerrar un período?', a: 'Se bloquean JournalEntry de ese período. Se trasladan saldos de cuentas de resultado (Ingresos/Egresos) a Patrimonio. Se crea el siguiente período.' },
      { q: '¿Puedo reabrir un período cerrado?', a: 'Solo si no hay períodos subsiguientes abiertos. Si ya hay asientos en el siguiente período, necesitás reversar los asientos en el período actual.' },
    ],
  },
  'reportes-fiscales': {
    description: 'Generación de declaraciones para la DGI: Impuesto sobre la Renta (IR), IVA, retenciones y percepciones.',
    model: 'TaxReturn → TaxReturnLine (1:N)',
    relationships: [
      { parent: 'TaxReturn', child: 'TaxReturnLine', relation: 'returnId → id (líneas de la declaración)' },
      { parent: 'TaxReturnLine', child: 'JournalEntry', relation: 'sourceEntryId → id (asiento que originó el impuesto)' },
      { parent: 'TaxReturn', child: 'AccountingPeriod', relation: 'periodId → id (período fiscal declarado)' },
    ],
    faq: [
      { q: '¿Cómo se calcula el IVA a declarar?', a: 'IVA Cobrado (débito fiscal) - IVA Pagado (crédito fiscal) = IVA a pagar. Si el crédito es mayor, te genera crédito fiscal a favor.' },
      { q: '¿Qué es la retención de IR?', a: 'El agente de retención descuenta un porcentaje del pago al proveedor y lo entrega a la DGI. Se registra como crédito fiscal del proveedor.' },
    ],
  },
  'configuracion': {
    description: 'Configuración global del módulo contable. Define parámetros como moneda por defecto, tasa de IVA, mapeo de cuentas para asientos automáticos e importación de catálogos por industria.',
    model: 'AccountingConfig (JSON) + Account (catálogo)',
    relationships: [
      { parent: 'AccountingConfig', child: 'Account', relation: 'clientTenantId → id (cuentas usadas en asientos automáticos)' },
      { parent: 'AccountingConfig', child: 'JournalEntry', relation: 'autoGenEnabled controla la creación de asientos automáticos' },
    ],
    faq: [
      { q: '¿Qué son los asientos automáticos?', a: 'Al activar esta opción, cada factura, cobro, gasto o nómina genera su asiento contable en tiempo real. Puedes configurar qué cuentas contables se usan para cada tipo de transacción.' },
      { q: '¿Cómo importar un catálogo de cuentas?', a: 'Selecciona tu industria en la sección "Catálogo por Defecto" y haz clic en Importar. El sistema creará la jerarquía completa de cuentas padre-hijo automáticamente.' },
      { q: '¿Puedo cambiar las cuentas de los asientos automáticos?', a: 'Sí. En la sección "Mapeo de Cuentas Contables" puedes editar los códigos de cuenta que el sistema usará para cada tipo de transacción.' },
    ],
  },
};

interface ContabilidadPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (module: string) => void;
}

export function ContabilidadPage({ activeSubModule, onSubModuleChange, isSidebarCollapsed}: ContabilidadPageProps) {
  const [activeSection, setActiveSection] = useState(activeSubModule || 'plan-cuentas');
  const [showHelp, setShowHelp] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const help = HELP_DATA[activeSection];

  const [prevSubModule, setPrevSubModule] = useState(activeSubModule);
  if (activeSubModule !== prevSubModule) {
    setPrevSubModule(activeSubModule);
    if (activeSubModule && activeSubModule !== activeSection) {
      const validSection = SECTIONS.find(s => s.id === activeSubModule);
      if (validSection) {
        setActiveSection(validSection.id);
      }
    }
  }

  const handleSectionChange = (id: string) => {
    setActiveSection(id);
    if (onSubModuleChange) {
      onSubModuleChange(id);
    }
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-5rem)]">
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto w-full max-w-[1700px] p-4 sm:p-6 md:p-10">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex size-[66px] shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <BookOpen className="size-9 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tighter flex flex-wrap items-center gap-x-3 gap-y-1 uppercase italic leading-none">
                Contabilidad <span className="text-primary">General</span>
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                  {SECTIONS.find((s) => s.id === activeSection)?.label}
                </Badge>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowHelp(!showHelp); setOpenFaq(null); }}
              className={cn(
                'rounded-xl gap-2 font-bold text-xs shrink-0',
                showHelp && 'bg-primary/10 border-primary/30 text-primary',
              )}
            >
              <HelpCircle className="size-4" />
              <span className="hidden sm:inline">¿Ayuda?</span>
            </Button>
          </div>

          {/* Horizontal tab navigation */}
          <div className={cn("w-full overflow-x-auto custom-scrollbar mb-8", !isSidebarCollapsed && "hidden lg:hidden")}>
            <div className="flex w-max min-w-full gap-1.5 bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 rounded-2xl border border-border/40">
              {SECTIONS.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => handleSectionChange(section.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all shrink-0',
                      isActive
                        ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}
                  >
                    <section.icon className="size-4" />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeSection === 'plan-cuentas' && <PlanCuentasView isSidebarCollapsed={isSidebarCollapsed} />}
                  {activeSection === 'diario' && <DiarioView />}
                  {activeSection === 'libro-mayor' && <LibroMayorView />}
                  {activeSection === 'balance-comprobacion' && <BalanceComprobacionView />}
                  {activeSection === 'estado-resultados' && <EstadoResultadosView />}
                  {activeSection === 'balance-general' && <BalanceGeneralView />}
                  {activeSection === 'flujo-efectivo' && <FlujoEfectivoView />}
                  {activeSection === 'cambios-patrimonio' && <CambiosPatrimonioView />}
                  {activeSection === 'activos-fijos' && <ActivosFijosView />}
                  {activeSection === 'conciliacion' && <ConciliacionView />}
                  {activeSection === 'periodos' && <PeriodosView />}
                  {activeSection === 'reportes-fiscales' && <ReportesFiscalesView />}
                  {activeSection === 'presupuestos' && <BudgetItemsView />}
                  {activeSection === 'categorias-gastos' && <CategoriasGastosView />}
                  {activeSection === 'configuracion' && <ConfiguracionContableView />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Help panel */}
            <AnimatePresence>
              {showHelp && help && (
                <motion.aside
                  initial={{ opacity: 0, x: 30, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: 380 }}
                  exit={{ opacity: 0, x: 30, width: 0 }}
                  transition={{ duration: 0.25 }}
                  className="shrink-0 overflow-hidden"
                >
                  <div className="w-[380px] border border-border/50 rounded-2xl bg-card shadow-sm overflow-y-auto max-h-[calc(100vh-14rem)] sticky top-24">
                    <div className="p-5 border-b border-border/30 flex items-center justify-between sticky top-0 bg-card z-10">
                      <div className="flex items-center gap-2">
                        <HelpCircle className="size-5 text-primary" />
                        <h3 className="text-sm font-black uppercase tracking-tight">¿Qué es esta vista?</h3>
                      </div>
                      <button onClick={() => setShowHelp(false)} className="size-7 rounded-lg hover:bg-muted flex items-center justify-center">
                        <X className="size-4" />
                      </button>
                    </div>

                    <div className="p-5 space-y-5">
                      {/* Description */}
                      <p className="text-sm text-muted-foreground leading-relaxed">{help.description}</p>

                      {/* Data source */}
                      <div className="space-y-2">
                        <h4 className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-primary">
                          <Database className="size-3.5" /> Fuente de datos
                        </h4>
                        <div className="rounded-xl bg-primary/5 border border-primary/10 px-3 py-2">
                          <code className="text-[11px] font-mono text-primary break-all">{help.model}</code>
                        </div>
                      </div>

                      {/* Relationships */}
                      <div className="space-y-2">
                        <h4 className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-primary">
                          <GitBranch className="size-3.5" /> Relaciones padre → hijo
                        </h4>
                        <div className="space-y-1.5">
                          {help.relationships.map((rel, i) => (
                            <div key={i} className="rounded-xl bg-muted/30 border border-border/30 px-3 py-2">
                              <div className="flex items-center gap-1 text-[11px] font-bold">
                                <span className="text-foreground">{rel.parent}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-primary">{rel.child}</span>
                              </div>
                              <code className="text-[10px] text-muted-foreground font-mono">{rel.relation}</code>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* FAQ */}
                      <div className="space-y-2">
                        <h4 className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-foreground">
                          <HelpCircle className="size-3.5" /> Preguntas frecuentes
                        </h4>
                        <div className="space-y-1">
                          {help.faq.map((item, i) => (
                            <div key={i} className="rounded-xl border border-border/40 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-muted/20 transition-colors"
                              >
                                <span className="text-xs font-bold pr-2">{item.q}</span>
                                <ChevronDown
                                  className={cn(
                                    'size-3.5 text-muted-foreground shrink-0 transition-transform duration-200',
                                    openFaq === i && 'rotate-180',
                                  )}
                                />
                              </button>
                              <AnimatePresence>
                                {openFaq === i && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="px-3 pb-3 text-xs text-muted-foreground leading-relaxed border-t border-border/20 pt-2">
                                      {item.a}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.aside>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
