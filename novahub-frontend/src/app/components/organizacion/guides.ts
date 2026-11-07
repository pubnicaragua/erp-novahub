import type { ViewGuideConfig } from './ViewGuide';

const TITLE = '[data-tour="page-title"]';
const ACTIONS = '[data-tour="page-actions"]';

export const ORGANIZACION_GUIDES: Record<'agenda' | 'compartido' | 'configuracion' | 'equipo', ViewGuideConfig> = {
  agenda: {
    title: 'Mi agenda',
    steps: [
      { target: TITLE, title: 'Tu agenda unificada', description: 'Aquí ves tus tareas, eventos, reuniones y recordatorios en un solo calendario. Son los mismos registros de Actividades: lo que cambies aquí cambia allá.', placement: 'bottom' },
      { target: ACTIONS, title: 'Nueva actividad', description: 'Crea una tarea, un evento o un recordatorio sin salir del calendario. En eventos puedes invitar compañeros y programar un aviso previo.', tip: 'También puedes hacer clic en una hora vacía del calendario para crearla justo ahí.', placement: 'bottom' },
      { target: '[aria-label="Vista del calendario"]', title: 'Día, semana, mes o agenda', description: 'Cambia la forma de ver tu tiempo. Tu vista predeterminada se define en Configuración.', placement: 'bottom' },
      { target: 'section[aria-live="polite"]', title: 'Calendario y filtros', description: 'Navega entre periodos, usa «Filtrar» por tipo o estado, y haz clic en cualquier elemento para editarlo, reprogramarlo, completarlo o eliminarlo según tus permisos. La zona horaria activa se muestra siempre.', placement: 'top' },
    ],
  },
  compartido: {
    title: 'Compartido',
    steps: [
      { target: TITLE, title: 'Eventos del equipo', description: 'Consulta los eventos con invitados en los que participas o que otras personas comparten contigo. Respeta los permisos de Actividades.', placement: 'bottom' },
      { target: '[aria-label="Secciones de Compartido"]', title: 'Tres secciones', description: 'Eventos compartidos, tus invitaciones RSVP y los usuarios autorizados a tu agenda.', placement: 'bottom' },
      { target: '[data-tour="page-actions"]', title: 'Nuevo evento', description: 'Crea un evento e invita a tu equipo. Las confirmaciones (RSVP) solo confirman asistencia: no son reservas ni booking público.', placement: 'bottom' },
    ],
  },
  equipo: {
    title: 'Equipo',
    steps: [
      { target: TITLE, title: 'Tu equipo en un solo lugar', description: 'Aquí ves, en solo lectura, en qué trabajan las personas que supervisas: tareas pendientes, vencidas e historial. Nadie ve a quien no tenga asignado.', placement: 'bottom' },
      { target: '[data-tour="team-tabs"]', title: 'Resumen, calendario e historial', description: 'El resumen muestra la carga y el cumplimiento de cada persona; el calendario junta todas sus actividades por día; el historial permite filtrar por persona, estado y fechas, indica los minutos registrados, si cada tarea se entregó a tiempo y su calificación.', tip: 'Haz clic en una persona del resumen para abrir su historial. Si puedes aprobar tareas, califícalas desde ahí con «Calificar».', placement: 'bottom' },
      { target: '[data-tour="team-kpis"]', title: 'Indicadores', description: 'Pendientes, vencidas, completadas, entregas a tiempo y calificación promedio de los últimos 30 días de todo tu equipo. Se cuentan por fecha de cierre de la tarea.', placement: 'bottom' },
      { target: '[data-tour="team-rule-form"]', title: 'Supervisores y avisos (solo administración)', description: 'Conecta a un supervisor con todo el equipo, una persona, un departamento o un rol. Los jefes de departamento y quienes tienen personal a cargo en el organigrama ven automáticamente a su gente. Todo queda en auditoría. Arriba puedes programar los resúmenes del día: inicio de jornada, antes del almuerzo y cierre, a la hora local de cada persona.', placement: 'right' },
    ],
  },
  configuracion: {
    title: 'Configuración de agenda',
    steps: [
      { target: TITLE, title: 'Tus preferencias', description: 'Zona horaria, vista predeterminada, primer día de la semana, horario laboral y privacidad. Solo afectan a tu agenda, no a la configuración global de la empresa.', placement: 'bottom' },
      { target: ACTIONS, title: 'Guardar cambios', description: 'Los cambios quedan pendientes hasta que los guardes. El botón se activa cuando modificas algo.', placement: 'bottom' },
    ],
  },
};
