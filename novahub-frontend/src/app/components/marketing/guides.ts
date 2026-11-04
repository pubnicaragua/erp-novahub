import type { ViewGuideConfig } from '../organizacion/ViewGuide';

const TITLE = '[data-tour="page-title"]';
const ACTIONS = '[data-tour="page-actions"]';
const TABLE = '[data-tour="resource-table"]';
const TABS = '[role="tablist"]';

export const MARKETING_GUIDES: Record<string, ViewGuideConfig> = {
  resumen: {
    title: 'Resumen de Marketing',
    steps: [
      { target: TITLE, title: 'Tu centro de control', description: 'Campañas activas, piezas por aprobar, contenidos programados, alcance, inversión y ROAS del periodo elegido.', placement: 'bottom' },
      { target: ACTIONS, title: 'Accesos rápidos', description: 'Crea una campaña, un brief, un contenido o sube un activo. Solo ves los accesos que tu rol permite.', placement: 'bottom' },
      { target: '[data-tour="overview-kpis"]', title: 'Indicadores', description: 'El alcance indica si viene de métricas manuales o verificadas. «Programada» nunca significa «publicada».', placement: 'bottom' },
    ],
  },
  clientes: {
    title: 'Clientes y briefs',
    steps: [
      { target: TITLE, title: 'Cuentas y briefs', description: 'Registra la cuenta del cliente y su brief con la estrategia. Si ya existe en Ventas, vincúlalo en lugar de duplicarlo.', placement: 'bottom' },
      { target: TABS, title: 'Cuentas o briefs', description: 'Alterna entre el directorio de cuentas y los briefs con su etapa.', placement: 'bottom' },
      { target: TABLE, title: 'Lista y edición', description: 'Busca, filtra y haz clic en una fila para editarla. En un brief puedes solicitar la aprobación de la estrategia: avisa a los aprobadores.', placement: 'top' },
    ],
  },
  campanas: {
    title: 'Campañas',
    steps: [
      { target: TITLE, title: 'Campañas de todo tipo', description: 'Digitales, deportivas, BTL, de eventos e internas. No necesitan parrilla de contenidos obligatoriamente.', placement: 'bottom' },
      { target: TABLE, title: 'Detalle de campaña', description: 'Haz clic en una campaña para ver su presupuesto, resultados, tareas y historial, cambiar su estado y solicitar la aprobación del presupuesto.', tip: 'Para iniciar la ejecución el presupuesto debe estar aprobado en Aprobaciones.', placement: 'top' },
    ],
  },
  contenidos: {
    title: 'Contenidos',
    steps: [
      { target: TITLE, title: 'Parrilla de contenidos', description: 'Planifica piezas por canal, redacta el copy y llévalas por el flujo de revisión.', placement: 'bottom' },
      { target: TABS, title: 'Calendario, lista o kanban', description: 'Tres formas de ver las mismas piezas.', placement: 'bottom' },
      { target: ACTIONS, title: 'Crear contenido', description: 'Nace como idea o borrador. Desde su detalle: enviar a aprobación, programar y registrar la publicación manual.', tip: 'Si editas una pieza ya aprobada se crea una nueva versión y requiere nueva revisión.', placement: 'bottom' },
    ],
  },
  aprobaciones: {
    title: 'Aprobaciones',
    steps: [
      { target: TITLE, title: 'Bandeja de decisiones', description: 'Piezas, presupuestos y estrategias pendientes. Cada decisión queda registrada con su autor y comentario.', placement: 'bottom' },
      { target: TABS, title: 'Pendientes e historial', description: 'Revisa lo que espera tu decisión y consulta lo ya resuelto.', placement: 'bottom' },
    ],
  },
  activos: {
    title: 'Biblioteca de activos',
    steps: [
      { target: TITLE, title: 'Archivos privados', description: 'Imágenes, videos y documentos guardados en almacenamiento privado; se abren con un enlace temporal.', placement: 'bottom' },
      { target: TABLE, title: 'Subir y consultar', description: 'Usa «Subir activos» para cargar archivos. Haz clic en uno para ver sus derechos de uso, abrirlo o eliminarlo.', placement: 'top' },
    ],
  },
  analitica: {
    title: 'Analítica',
    steps: [
      { target: TITLE, title: 'Resultados y mercado', description: 'Presupuesto por campaña, KPI, competencia, estudios y reportes.', placement: 'bottom' },
      { target: TABS, title: 'Tres secciones', description: 'En «Presupuestos y KPI» registras resultados manuales; en «Reportes» eliges un rango y exportas a Excel.', placement: 'bottom' },
    ],
  },
  configuracion: {
    title: 'Configuración de Marketing',
    steps: [
      { target: TITLE, title: 'Parámetros del módulo', description: 'Canales utilizados, moneda y responsables de aprobación. No reemplaza la configuración global del ERP.', placement: 'bottom' },
      { target: ACTIONS, title: 'Guardar', description: 'Guarda los cambios para que apliquen a la parrilla y a las notificaciones de aprobación.', placement: 'bottom' },
    ],
  },
};
