import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  Cloud,
  Code2,
  FileText,
  FolderKanban,
  GraduationCap,
  Headphones,
  Layers3,
  LayoutDashboard,
  Package,
  Pill,
  Receipt,
  Scale,
  Settings,
  ShoppingCart,
  Shirt,
  Stethoscope,
  Store,
  Tag,
  Ticket,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';

export const MODULE_CATEGORIES = ['Todos', 'Operación', 'Finanzas', 'Personas y gestión', 'Especializados', 'Plataforma', 'Enterprise', 'Verticales'] as const;

export type ModuleCategory = (typeof MODULE_CATEGORIES)[number];

export type LandingModule = {
  category: Exclude<ModuleCategory, 'Todos'>;
  module: string;
  submodule: string;
  features: string[];
  advantage: string;
  icon: LucideIcon;
};

export const LANDING_MODULES: LandingModule[] = [
  {
    category: 'Operación', module: 'General', submodule: 'Dashboard gerencial', icon: LayoutDashboard,
    features: ['KPIs de ventas, gastos e inventario', 'Rentabilidad y productos más vendidos', 'Alertas y accesos directos al detalle'],
    advantage: 'Una lectura ejecutiva para saber cómo está el negocio en segundos.',
  },
  {
    category: 'Operación', module: 'Ventas', submodule: 'Clientes', icon: Users,
    features: ['Registro, edición y clasificación', 'Crédito, historial y documentos', 'Información lista para cotizar y facturar'],
    advantage: 'Cada conversación y operación queda asociada al cliente correcto.',
  },
  {
    category: 'Operación', module: 'Ventas', submodule: 'Cotizaciones', icon: FileText,
    features: ['Crear, editar, enviar y descargar PDF', 'Descuentos, subtotales y totales configurables', 'Conversión a orden o factura'],
    advantage: 'Propuestas profesionales que se preparan más rápido y se pueden adaptar.',
  },
  {
    category: 'Operación', module: 'Ventas', submodule: 'Órdenes de venta', icon: ClipboardCheck,
    features: ['Seguimiento de pedidos y estados', 'Aprobación y responsables', 'Conversión a factura'],
    advantage: 'Menos pedidos perdidos y mayor control desde la venta hasta la entrega.',
  },
  {
    category: 'Operación', module: 'Ventas', submodule: 'Facturación', icon: Receipt,
    features: ['Impuestos, descuentos y moneda', 'Pagos y estados de factura', 'Documentos centralizados'],
    advantage: 'Facturación conectada con caja, inventario y contabilidad.',
  },
  {
    category: 'Operación', module: 'Ventas', submodule: 'Facturación por caja', icon: Store,
    features: ['POS para productos y servicios', 'Pagos, vuelto e impresión', 'Apertura, cierre y control de sesión'],
    advantage: 'Una caja ágil y trazable para cada sucursal o punto de venta.',
  },
  {
    category: 'Operación', module: 'Ventas', submodule: 'Facturas recurrentes', icon: Receipt,
    features: ['Programación de cobros', 'Facturación periódica', 'Seguimiento de próximas emisiones'],
    advantage: 'Reduce tareas repetitivas y protege la continuidad de los ingresos.',
  },
  {
    category: 'Operación', module: 'Ventas', submodule: 'Pagos recibidos', icon: CircleDollarSign,
    features: ['Registro y aplicación de pagos', 'Saldos pendientes', 'Recibos y trazabilidad'],
    advantage: 'Visibilidad real de lo cobrado y lo que todavía está pendiente.',
  },
  {
    category: 'Operación', module: 'Ventas', submodule: 'Notas de crédito y devoluciones', icon: Receipt,
    features: ['Devoluciones y anulaciones', 'Aplicación contra facturas', 'Ajustes con historial'],
    advantage: 'Corrige operaciones sin perder el control financiero ni documental.',
  },
  {
    category: 'Operación', module: 'Ventas', submodule: 'Listas de precios', icon: Tag,
    features: ['Precios retail, mayorista y distribución', 'Precios por cliente', 'Variantes y condiciones comerciales'],
    advantage: 'Cada cliente recibe el precio que corresponde a su relación comercial.',
  },
  {
    category: 'Operación', module: 'Ventas', submodule: 'Control de caja', icon: CircleDollarSign,
    features: ['Apertura, cierre y arqueo', 'Diferencias, ingresos y egresos', 'Responsables por sesión'],
    advantage: 'Caja ordenada, conciliable y fácil de auditar.',
  },
  {
    category: 'Operación', module: 'Compras', submodule: 'Proveedores', icon: ShoppingCart,
    features: ['Registro y clasificación', 'Saldos, documentos e historial', 'Relación con compras y pagos'],
    advantage: 'Decisiones de compra con contexto de costo, proveedor y compromiso.',
  },
  {
    category: 'Operación', module: 'Compras', submodule: 'Solicitudes de compra', icon: ClipboardCheck,
    features: ['Solicitudes internas', 'Aprobación y seguimiento', 'Trazabilidad del requerimiento'],
    advantage: 'Ordena quién solicita, quién aprueba y qué se debe comprar.',
  },
  {
    category: 'Operación', module: 'Compras', submodule: 'Órdenes de compra', icon: ShoppingCart,
    features: ['Creación y aprobación', 'Recepción y control de compras', 'Documentos asociados'],
    advantage: 'Compra con un proceso claro y menos errores de comunicación.',
  },
  {
    category: 'Operación', module: 'Compras', submodule: 'Recepciones de compra', icon: Package,
    features: ['Recepción parcial o total', 'Cantidades, costos y bodegas', 'Actualización de existencias'],
    advantage: 'Lo recibido se refleja en inventario sin duplicar trabajo.',
  },
  {
    category: 'Operación', module: 'Compras', submodule: 'Gastos y gastos recurrentes', icon: CircleDollarSign,
    features: ['Registro y categorías', 'Vencimientos y recurrencia', 'Control del gasto operativo'],
    advantage: 'Anticipa compromisos y evita que los gastos queden fuera del análisis.',
  },
  {
    category: 'Operación', module: 'Compras', submodule: 'Pagos realizados', icon: Receipt,
    features: ['Pagos a proveedores', 'Documentos asociados', 'Saldos y seguimiento'],
    advantage: 'Una cuenta por pagar más clara y fácil de conciliar.',
  },
  {
    category: 'Operación', module: 'Inventario', submodule: 'Productos y servicios', icon: Package,
    features: ['Catálogo, SKU y variantes', 'Precios, costos e impuestos', 'Imágenes y estado'],
    advantage: 'Un catálogo confiable para vender, comprar y reportar.',
  },
  {
    category: 'Operación', module: 'Inventario', submodule: 'Existencias y bodegas', icon: Package,
    features: ['Stock por bodega', 'Mínimos, máximos y disponibilidad', 'Alertas de inventario'],
    advantage: 'Evita quiebres y compras innecesarias con existencias visibles.',
  },
  {
    category: 'Operación', module: 'Inventario', submodule: 'Marcas por cliente', icon: Layers3,
    features: ['Asociar una marca a un cliente consignatario', 'Filtrar inventario y ventas por cliente', 'Vista controlada para el cliente'],
    advantage: 'Controla consignaciones por marca sin cambiar el flujo normal de venta.',
  },
  {
    category: 'Operación', module: 'Inventario', submodule: 'Atributos y categorías', icon: Layers3,
    features: ['Variantes y atributos', 'Categorías y unidades de medida', 'Clasificación comercial'],
    advantage: 'Encuentra y administra productos con una estructura consistente.',
  },
  {
    category: 'Operación', module: 'Inventario', submodule: 'Transferencias', icon: Truck,
    features: ['Transferencias entre sucursales', 'Movimientos entre bodegas', 'Estados y responsables'],
    advantage: 'Mueve inventario con trazabilidad y menos diferencias.',
  },
  {
    category: 'Operación', module: 'Inventario', submodule: 'Ajustes y pérdidas', icon: ClipboardCheck,
    features: ['Ajustes, pérdidas y mermas', 'Autorizaciones', 'Motivo e historial'],
    advantage: 'Explica cada diferencia antes de que se convierta en un problema.',
  },
  {
    category: 'Operación', module: 'Inventario', submodule: 'Movimientos y kardex', icon: BarChart3,
    features: ['Entradas y salidas', 'Costos y movimientos', 'Historial por producto y bodega'],
    advantage: 'Sigue la historia del producto y respalda cada saldo.',
  },
  {
    category: 'Operación', module: 'Inventario', submodule: 'Auditorías', icon: ClipboardCheck,
    features: ['Revisión de existencias', 'Diferencias y ajustes', 'Trazabilidad de la revisión'],
    advantage: 'Convierte el conteo físico en una fuente de control confiable.',
  },
  {
    category: 'Operación', module: 'Inventario', submodule: 'Mobiliario y equipos', icon: Building2,
    features: ['Control de activos operativos', 'Equipos por ubicación', 'Historial y responsables'],
    advantage: 'También ordena los recursos que hacen posible la operación diaria.',
  },
  {
    category: 'Finanzas', module: 'Finanzas', submodule: 'Resumen financiero', icon: CircleDollarSign,
    features: ['Ingresos, egresos y liquidez', 'Saldos y principales indicadores', 'Lectura por período'],
    advantage: 'La salud financiera queda visible sin armar reportes manuales.',
  },
  {
    category: 'Finanzas', module: 'Finanzas', submodule: 'Caja y bancos', icon: CircleDollarSign,
    features: ['Cuentas bancarias y movimientos', 'Ingresos, egresos y saldos', 'Control por cuenta'],
    advantage: 'Conecta el dinero disponible con la operación real.',
  },
  {
    category: 'Finanzas', module: 'Finanzas', submodule: 'Cuentas por cobrar', icon: Receipt,
    features: ['Pendientes y vencimientos', 'Abonos y antigüedad de saldos', 'Seguimiento por cliente'],
    advantage: 'Prioriza la recuperación de efectivo con información actualizada.',
  },
  {
    category: 'Finanzas', module: 'Finanzas', submodule: 'Cuentas por pagar', icon: Receipt,
    features: ['Proveedores pendientes', 'Vencimientos y compromisos', 'Saldos por período'],
    advantage: 'Anticipa obligaciones y protege la liquidez.',
  },
  {
    category: 'Finanzas', module: 'Finanzas', submodule: 'Ingresos y gastos recurrentes', icon: CircleDollarSign,
    features: ['Programación de movimientos', 'Automatización de cargos', 'Calendario financiero'],
    advantage: 'Convierte compromisos repetitivos en una agenda controlable.',
  },
  {
    category: 'Finanzas', module: 'Finanzas', submodule: 'Análisis financiero', icon: BarChart3,
    features: ['Comparativos y tendencias', 'Calendario financiero', 'Rentabilidad'],
    advantage: 'Pasa del saldo aislado a una lectura de comportamiento.',
  },
  {
    category: 'Finanzas', module: 'Contabilidad', submodule: 'Plan de cuentas', icon: Layers3,
    features: ['Creación del catálogo contable', 'Organización por niveles', 'Cuentas parametrizables'],
    advantage: 'La contabilidad se adapta a la estructura de cada empresa.',
  },
  {
    category: 'Finanzas', module: 'Contabilidad', submodule: 'Libro diario y mayor', icon: FileText,
    features: ['Asientos y comprobantes', 'Movimientos y auxiliares', 'Historial contable'],
    advantage: 'Del movimiento diario a la revisión contable sin hojas paralelas.',
  },
  {
    category: 'Finanzas', module: 'Contabilidad', submodule: 'Balanza de comprobación', icon: BarChart3,
    features: ['Movimientos y saldos', 'Filtros por período y cuenta', 'Exportación a Excel y PDF'],
    advantage: 'Una balanza lista para revisar, compartir y respaldar.',
  },
  {
    category: 'Finanzas', module: 'Contabilidad', submodule: 'Estado de resultados', icon: BarChart3,
    features: ['Ingresos, costos y gastos', 'Utilidad y comparativos', 'Lectura por período'],
    advantage: 'Entiende qué está generando o consumiendo rentabilidad.',
  },
  {
    category: 'Finanzas', module: 'Contabilidad', submodule: 'Balance general', icon: Scale,
    features: ['Activos, pasivos y patrimonio', 'Comparativos', 'Consulta estructurada'],
    advantage: 'Una fotografía financiera clara para administrar con confianza.',
  },
  {
    category: 'Finanzas', module: 'Contabilidad', submodule: 'Flujo de efectivo', icon: BarChart3,
    features: ['Entradas y salidas', 'Flujo operativo', 'Análisis por período'],
    advantage: 'Mide el efectivo que realmente sostiene la operación.',
  },
  {
    category: 'Finanzas', module: 'Contabilidad', submodule: 'Conciliación bancaria', icon: CircleDollarSign,
    features: ['Movimientos bancarios', 'Cruce contra contabilidad', 'Diferencias identificables'],
    advantage: 'Reduce descuadres y acelera el cierre de cada período.',
  },
  {
    category: 'Finanzas', module: 'Contabilidad', submodule: 'Activos fijos', icon: Building2,
    features: ['Registro y categorías', 'Depreciación', 'Movimientos de activos'],
    advantage: 'Mantiene el valor y la historia de los activos bajo control.',
  },
  {
    category: 'Finanzas', module: 'Contabilidad', submodule: 'Períodos y cierres', icon: ClipboardCheck,
    features: ['Bloqueo de períodos', 'Cierres mensuales', 'Auditoría de cambios'],
    advantage: 'Protege la integridad de la información que ya fue cerrada.',
  },
  {
    category: 'Finanzas', module: 'Contabilidad', submodule: 'Reportes fiscales', icon: FileText,
    features: ['Impuestos y retenciones', 'Reportes fiscales', 'Exportaciones'],
    advantage: 'Prepara la información fiscal desde la misma operación.',
  },
  {
    category: 'Finanzas', module: 'Reportes', submodule: 'Reportes de ventas', icon: BarChart3,
    features: ['Período, cliente y producto', 'Vendedor, caja y sucursal', 'Filtros y detalle'],
    advantage: 'Encuentra qué se vendió, dónde y por quién.',
  },
  {
    category: 'Finanzas', module: 'Reportes', submodule: 'Reportes de compras', icon: ShoppingCart,
    features: ['Compras y proveedores', 'Costos y recepción', 'Pagos'],
    advantage: 'Compara lo comprado con lo recibido y lo pagado.',
  },
  {
    category: 'Finanzas', module: 'Reportes', submodule: 'Reportes de inventario', icon: Package,
    features: ['Existencias y kardex', 'Productos sin movimiento', 'Alertas'],
    advantage: 'Detecta capital inmovilizado y riesgos de disponibilidad.',
  },
  {
    category: 'Finanzas', module: 'Reportes', submodule: 'Reportes financieros', icon: BarChart3,
    features: ['Ingresos y gastos', 'Rentabilidad', 'Cuentas por cobrar y pagar'],
    advantage: 'Convierte la operación en una lectura financiera completa.',
  },
  {
    category: 'Finanzas', module: 'Reportes', submodule: 'Exportación multi formato', icon: FileText,
    features: ['Excel y PDF', 'Archivos estructurados', 'Información lista para compartir'],
    advantage: 'Lleva los datos al formato que necesita tu equipo o asesor.',
  },
  {
    category: 'Personas y gestión', module: 'Recursos Humanos', submodule: 'Empleados', icon: Users,
    features: ['Expedientes y documentos', 'Puestos y departamentos', 'Información del equipo'],
    advantage: 'Un expediente ordenado para administrar mejor a las personas.',
  },
  {
    category: 'Personas y gestión', module: 'Recursos Humanos', submodule: 'Nómina', icon: CircleDollarSign,
    features: ['Salarios y deducciones', 'Comisiones', 'Pagos'],
    advantage: 'Reduce cálculos dispersos y mantiene la nómina trazable.',
  },
  {
    category: 'Personas y gestión', module: 'Recursos Humanos', submodule: 'Asistencia y vacaciones', icon: CalendarDays,
    features: ['Asistencia y permisos', 'Ausencias', 'Vacaciones'],
    advantage: 'Planifica la disponibilidad del equipo sin perder contexto.',
  },
  {
    category: 'Personas y gestión', module: 'Recursos Humanos', submodule: 'Desempeño y capacitación', icon: GraduationCap,
    features: ['Evaluaciones', 'Cursos y avances', 'Certificados'],
    advantage: 'Conecta el desarrollo del equipo con los objetivos del negocio.',
  },
  {
    category: 'Personas y gestión', module: 'Actividades', submodule: 'Tareas, eventos y calendario', icon: CalendarDays,
    features: ['Agenda y recordatorios', 'Reuniones y bitácora', 'Seguimiento'],
    advantage: 'Lo importante tiene responsable, fecha y seguimiento.',
  },
  {
    category: 'Personas y gestión', module: 'Proyectos', submodule: 'Proyectos y cronogramas', icon: FolderKanban,
    features: ['Portafolio, tareas y hitos', 'Costos y presupuesto', 'Documentos'],
    advantage: 'Alinea avance, presupuesto y responsables en un mismo lugar.',
  },
  {
    category: 'Especializados', module: 'Restaurante POS', submodule: 'Salón, mesas, comandas y cocina', icon: Store,
    features: ['Mesas y pedidos', 'Cocina y carta', 'Reportes del restaurante'],
    advantage: 'Del salón a la caja con menos esperas y más control.',
  },
  {
    category: 'Especializados', module: 'Logística', submodule: 'Tracking de importaciones', icon: Truck,
    features: ['Paquetes, recepción y lotes', 'Conciliación y facturación', 'Tracking'],
    advantage: 'Cada paquete conserva su recorrido hasta convertirse en entrega.',
  },
  {
    category: 'Especializados', module: 'Logística', submodule: 'Recepción y conciliación', icon: Truck,
    features: ['Recepción de PDF', 'Peso físico y peso proveedor', 'Conciliación de compras'],
    advantage: 'Convierte la recepción en un control de costos y diferencias.',
  },
  {
    category: 'Especializados', module: 'Fuerza Comercial', submodule: 'Gestión comercial', icon: Users,
    features: ['Prospectos y oportunidades', 'Actividades', 'Seguimiento comercial'],
    advantage: 'La oportunidad no depende de la memoria de un vendedor.',
  },
  {
    category: 'Especializados', module: 'Tickets', submodule: 'Soporte y base de conocimiento', icon: Ticket,
    features: ['Tickets y agentes', 'Comentarios y seguimiento', 'FAQ'],
    advantage: 'Resuelve solicitudes con historial y tiempos visibles.',
  },
  {
    category: 'Especializados', module: 'Centro de capacitación', submodule: 'Academia virtual', icon: GraduationCap,
    features: ['Cursos y avances', 'Calificaciones', 'Diplomas verificables'],
    advantage: 'La implementación se convierte en aprendizaje medible.',
  },
  {
    category: 'Especializados', module: 'Asesoría legal', submodule: 'Casos y recordatorios', icon: Scale,
    features: ['Expedientes legales', 'Tareas y fechas', 'Documentos'],
    advantage: 'Fechas y compromisos legales visibles antes de que venzan.',
  },
  {
    category: 'Especializados', module: 'Financiamiento PYME', submodule: 'Solicitudes y calculadora', icon: CircleDollarSign,
    features: ['Solicitudes', 'Simulación', 'Cálculo de financiamiento'],
    advantage: 'Evalúa escenarios antes de comprometer recursos.',
  },
  {
    category: 'Plataforma', module: 'Nova Suite', submodule: 'Nova Chat', icon: Headphones,
    features: ['Asistente y comunicación interna', 'Soporte inteligente', 'Contexto operativo'],
    advantage: 'El equipo encuentra ayuda y respuestas sin salir de la operación.',
  },
  {
    category: 'Plataforma', module: 'Nova Cloud', submodule: 'Archivos y documentos', icon: Cloud,
    features: ['Archivos y carpetas', 'Contratos y facturas', 'Reportes'],
    advantage: 'La documentación vive cerca del proceso que la necesita.',
  },
  {
    category: 'Plataforma', module: 'Notificaciones', submodule: 'Alertas, mensajes y push', icon: Bell,
    features: ['Notificaciones internas', 'Alertas automáticas', 'Mensajes y push'],
    advantage: 'El sistema avisa a tiempo, no cuando el problema ya creció.',
  },
  {
    category: 'Plataforma', module: 'Mi sucursal', submodule: 'Usuarios y roles', icon: Users,
    features: ['Sucursales, usuarios y roles', 'Permisos y departamentos', 'Dominio'],
    advantage: 'Cada persona entra con el alcance que necesita.',
  },
  {
    category: 'Plataforma', module: 'Configuración', submodule: 'Marca, PDF, seguridad y moneda', icon: Settings,
    features: ['Branding y documentos', 'Seguridad y auditoría', 'Tipo de cambio'],
    advantage: 'El ERP se presenta y opera de acuerdo con tu empresa.',
  },
  {
    category: 'Plataforma', module: 'Manager', submodule: 'Consolidado gerencial', icon: BarChart3,
    features: ['Sucursales e inventario', 'Ventas y cajas', 'Reportes consolidados'],
    advantage: 'La dirección compara unidades sin perder el detalle de origen.',
  },
  {
    category: 'Enterprise', module: 'Enterprise', submodule: 'API e integraciones', icon: Code2,
    features: ['Integraciones externas', 'Webhooks y automatizaciones', 'Conectores'],
    advantage: 'NovaHub se conecta con el ecosistema que tu empresa ya usa.',
  },
  {
    category: 'Enterprise', module: 'Enterprise', submodule: 'Desarrollo a medida', icon: Code2,
    features: ['Flujos especiales', 'Verticales y personalizaciones', 'Alcance por proyecto'],
    advantage: 'La plataforma puede crecer con procesos que sí son propios de tu negocio.',
  },
  {
    category: 'Enterprise', module: 'Portal de clientes', submodule: 'Acceso por cliente', icon: Users,
    features: ['Usuario y contraseña para cada cliente', 'Información autorizada por marca', 'Ventas, facturación, inventario y reportes'],
    advantage: 'Comparte resultados con clientes consignatarios sin exponer la operación completa.',
  },
  {
    category: 'Verticales', module: 'Clínicas', submodule: 'Médicas, dentales y veterinarias', icon: Stethoscope,
    features: ['Citas y pacientes', 'Expedientes, tratamientos y recetas', 'Facturación'],
    advantage: 'La atención y la administración trabajan sobre la misma agenda.',
  },
  {
    category: 'Verticales', module: 'Talleres', submodule: 'Talleres mecánicos', icon: Wrench,
    features: ['Órdenes de trabajo y vehículos', 'Historial y agenda', 'Inventario y cotizaciones'],
    advantage: 'Más control sobre cada vehículo, trabajo y repuesto.',
  },
  {
    category: 'Verticales', module: 'Constructoras', submodule: 'Construcción y proyectos', icon: Building2,
    features: ['Presupuestos y materiales', 'Avances y contratistas', 'Costos y proyectos'],
    advantage: 'Mide la obra con la misma precisión que el presupuesto.',
  },
  {
    category: 'Verticales', module: 'Tiendas de ropa', submodule: 'Prendas y retail', icon: Shirt,
    features: ['Tallas, colores y variantes', 'Temporadas e inventario', 'Ventas'],
    advantage: 'Vende por variante sin perder el control de existencias.',
  },
  {
    category: 'Verticales', module: 'Farmacias y centros clínicos', submodule: 'Salud y dispensación', icon: Pill,
    features: ['Lotes y vencimientos', 'Recetas y pacientes', 'Inventario y trazabilidad'],
    advantage: 'Más seguridad para productos sensibles y decisiones de reposición.',
  },
  {
    category: 'Operación', module: 'Ventas', submodule: 'Donación de facturas', icon: Receipt,
    features: ['Registro de facturas donadas', 'Documentos y beneficiarios', 'Trazabilidad de la operación'],
    advantage: 'Registra operaciones especiales sin perder respaldo ni control.',
  },
  {
    category: 'Operación', module: 'Ventas', submodule: 'Auditoría y reversión de facturas', icon: ClipboardCheck,
    features: ['Detección de anomalías', 'Anulación y reversión controlada', 'Historial de cambios'],
    advantage: 'Corrige una operación con evidencia y sin romper el saldo contable.',
  },
  {
    category: 'Operación', module: 'Ventas', submodule: 'Comisiones y vendedores', icon: Users,
    features: ['Asignación por vendedor', 'Cálculo de comisiones', 'Seguimiento por periodo'],
    advantage: 'Conoce quién vende, cuánto genera y qué debe recibir.',
  },
  {
    category: 'Operación', module: 'Compras', submodule: 'Recepción parcial y conciliación', icon: Package,
    features: ['Recepciones parciales', 'Comparación contra orden', 'Diferencias de cantidad y costo'],
    advantage: 'Recibe lo que llegó y deja pendiente lo que todavía falta.',
  },
  {
    category: 'Operación', module: 'Compras', submodule: 'Anticipos y saldos de proveedores', icon: CircleDollarSign,
    features: ['Registro de anticipos', 'Aplicación a documentos', 'Saldos actualizados'],
    advantage: 'Evita pagar dos veces y conoce el compromiso real con cada proveedor.',
  },
  {
    category: 'Operación', module: 'Inventario', submodule: 'Transferencias entre bodegas', icon: Truck,
    features: ['Solicitudes de traslado', 'Envío y recepción', 'Existencias por origen y destino'],
    advantage: 'Mueve inventario entre bodegas manteniendo responsables y trazabilidad.',
  },
  {
    category: 'Operación', module: 'Inventario', submodule: 'Lotes, series y vencimientos', icon: Tag,
    features: ['Control por lote o serie', 'Fechas de vencimiento', 'Trazabilidad de salida'],
    advantage: 'Sabe exactamente qué producto entró, dónde está y cuándo vence.',
  },
  {
    category: 'Operación', module: 'Inventario', submodule: 'Costos y valorización', icon: CircleDollarSign,
    features: ['Costo de compra', 'Valorización de existencias', 'Margen por producto'],
    advantage: 'El inventario deja de ser una cantidad y se convierte en una lectura financiera.',
  },
  {
    category: 'Operación', module: 'Inventario', submodule: 'Conteos físicos', icon: ClipboardCheck,
    features: ['Conteos por bodega', 'Diferencias encontradas', 'Ajustes autorizados'],
    advantage: 'Compara el sistema con la realidad antes de tomar decisiones.',
  },
  {
    category: 'Operación', module: 'Inventario', submodule: 'Inventario consignado por cliente', icon: Users,
    features: ['Marca asociada a cliente', 'Filtros por cliente y marca', 'Reportes de venta e inventario'],
    advantage: 'Entrega visibilidad a consignatarios sin exponer el resto de la empresa.',
  },
  {
    category: 'Finanzas', module: 'Finanzas', submodule: 'Cuentas bancarias y movimientos', icon: CircleDollarSign,
    features: ['Cuentas y saldos', 'Ingresos y egresos', 'Movimientos por periodo'],
    advantage: 'La liquidez se entiende desde una sola vista.',
  },
  {
    category: 'Finanzas', module: 'Finanzas', submodule: 'Cobranzas y antigüedad de saldos', icon: Receipt,
    features: ['Pendientes por cliente', 'Vencimientos y abonos', 'Antigüedad de cartera'],
    advantage: 'Prioriza la cobranza con información clara y actualizada.',
  },
  {
    category: 'Finanzas', module: 'Finanzas', submodule: 'Presupuestos y centros de costo', icon: BarChart3,
    features: ['Presupuesto por área', 'Centros de costo', 'Comparación real contra plan'],
    advantage: 'Mide dónde se está usando el dinero y contra qué objetivo.',
  },
  {
    category: 'Finanzas', module: 'Finanzas', submodule: 'Calendario financiero', icon: CalendarDays,
    features: ['Vencimientos próximos', 'Cobros y pagos programados', 'Vista por semana o mes'],
    advantage: 'Anticipa compromisos antes de que se conviertan en urgencias.',
  },
  {
    category: 'Finanzas', module: 'Contabilidad', submodule: 'Libro diario', icon: FileText,
    features: ['Asientos y comprobantes', 'Débitos y créditos', 'Filtros por fecha y sucursal'],
    advantage: 'Cada movimiento queda documentado en el origen contable.',
  },
  {
    category: 'Finanzas', module: 'Contabilidad', submodule: 'Libro mayor', icon: FileText,
    features: ['Movimientos por cuenta', 'Saldos acumulados', 'Auxiliares contables'],
    advantage: 'Pasa del comprobante a la historia completa de cada cuenta.',
  },
  {
    category: 'Finanzas', module: 'Contabilidad', submodule: 'Balanza por nivel y sucursal', icon: BarChart3,
    features: ['Niveles del plan de cuentas', 'Filtros por sucursal', 'Exportación a Excel y PDF'],
    advantage: 'Revisa que la contabilidad esté cuadrada con el detalle que necesitas.',
  },
  {
    category: 'Finanzas', module: 'Contabilidad', submodule: 'Estado de resultados comparativo', icon: BarChart3,
    features: ['Ingresos, costos y gastos', 'Utilidad del periodo', 'Comparativos históricos'],
    advantage: 'Entiende si el negocio está ganando y qué está moviendo el resultado.',
  },
  {
    category: 'Finanzas', module: 'Contabilidad', submodule: 'Balance general comparativo', icon: Scale,
    features: ['Activos, pasivos y patrimonio', 'Cortes por periodo', 'Comparación de saldos'],
    advantage: 'Conoce la posición financiera de la empresa en cada cierre.',
  },
  {
    category: 'Finanzas', module: 'Contabilidad', submodule: 'Depreciación de activos fijos', icon: Building2,
    features: ['Métodos y vida útil', 'Cálculo de depreciación', 'Movimientos del activo'],
    advantage: 'El valor de tus equipos acompaña correctamente a la contabilidad.',
  },
  {
    category: 'Finanzas', module: 'Contabilidad', submodule: 'Asientos automáticos', icon: Receipt,
    features: ['Ventas y compras', 'Caja, bancos e inventario', 'Reglas contables configurables'],
    advantage: 'Reduce digitación repetida y mantiene conectada la operación con contabilidad.',
  },
  {
    category: 'Finanzas', module: 'Contabilidad', submodule: 'Cierres mensuales y fiscales', icon: ClipboardCheck,
    features: ['Pre-cierre y revisión', 'Bloqueo de periodos', 'Traslado de saldos'],
    advantage: 'Cierra con orden y evita cambios accidentales en periodos terminados.',
  },
  {
    category: 'Finanzas', module: 'Reportes', submodule: 'Reportes por cliente y marca', icon: BarChart3,
    features: ['Ventas por cliente', 'Inventario por marca', 'Filtros y detalle operativo'],
    advantage: 'Responde rápido qué se vendió, a quién y con qué marca.',
  },
  {
    category: 'Finanzas', module: 'Reportes', submodule: 'Exportación Excel, PDF y datos estructurados', icon: FileText,
    features: ['Excel para análisis', 'PDF para compartir', 'Formatos estructurados'],
    advantage: 'Lleva la información de NovaHub al formato que tu equipo necesita.',
  },
  {
    category: 'Personas y gestión', module: 'Recursos Humanos', submodule: 'Comisiones y liquidaciones', icon: CircleDollarSign,
    features: ['Variables por colaborador', 'Cálculo de comisiones', 'Historial de pagos'],
    advantage: 'Conecta desempeño, variables y pagos en un solo proceso.',
  },
  {
    category: 'Personas y gestión', module: 'Actividades', submodule: 'Reservas y citas configurables', icon: CalendarDays,
    features: ['Tipos de cita', 'Disponibilidad y responsables', 'Confirmaciones y recordatorios'],
    advantage: 'Una agenda adaptable a clínicas, talleres, servicios y equipos.',
  },
  {
    category: 'Personas y gestión', module: 'Actividades', submodule: 'Recordatorios y seguimiento', icon: Bell,
    features: ['Tareas pendientes', 'Fechas límite', 'Alertas automáticas'],
    advantage: 'El equipo sabe qué sigue y cuándo debe atenderlo.',
  },
  {
    category: 'Personas y gestión', module: 'Proyectos', submodule: 'Presupuestos y costos de proyecto', icon: FolderKanban,
    features: ['Presupuesto por proyecto', 'Costos y materiales', 'Rentabilidad acumulada'],
    advantage: 'Controla el proyecto desde la promesa comercial hasta el costo real.',
  },
  {
    category: 'Plataforma', module: 'Nova Suite', submodule: 'Líneas corporativas y WhatsApp', icon: Headphones,
    features: ['Líneas por empresa o área', 'WhatsApp para equipos', 'Conversaciones vinculadas al cliente'],
    advantage: 'Nova Premium centraliza las líneas corporativas que tu operación necesita.',
  },
  {
    category: 'Plataforma', module: 'Nova Suite', submodule: 'Plantillas y notificaciones automáticas', icon: Bell,
    features: ['Plantillas por evento', 'WhatsApp y correo', 'Envíos automáticos'],
    advantage: 'Comunica avances, cobros y confirmaciones sin perseguir cada operación.',
  },
  {
    category: 'Plataforma', module: 'Configuración', submodule: 'Documentos editables y branding', icon: Settings,
    features: ['Facturas configurables', 'Logotipo y colores', 'PDF por empresa'],
    advantage: 'Cada documento conserva la identidad y las reglas comerciales de tu empresa.',
  },
  {
    category: 'Enterprise', module: 'Enterprise', submodule: 'Webhooks y eventos de negocio', icon: Code2,
    features: ['Eventos de ventas e inventario', 'Webhooks configurables', 'Automatizaciones externas'],
    advantage: 'Conecta NovaHub con procesos que viven fuera del ERP.',
  },
  {
    category: 'Enterprise', module: 'Portal de clientes', submodule: 'Dashboard por marca', icon: LayoutDashboard,
    features: ['Acceso por usuario', 'Ventas e inventario filtrados', 'Reportes por marca asignada'],
    advantage: 'Cada cliente ve únicamente la información de sus marcas.',
  },
  {
    category: 'Verticales', module: 'Servicios', submodule: 'Agenda universal por giro', icon: CalendarDays,
    features: ['Citas para clínicas y talleres', 'Reservas para servicios', 'Configuración por negocio'],
    advantage: 'Un mismo motor de agenda se adapta al lenguaje de cada empresa.',
  },
];
