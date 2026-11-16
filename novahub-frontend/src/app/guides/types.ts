/**
 * Guías paso a paso del ERP: cada guía lleva al usuario a la pantalla correcta y le
 * señala el botón o campo de cada paso. Las usa Nova AI (chat), el Centro de
 * Capacitación y el panel flotante que acompaña al usuario mientras trabaja.
 */

/** Pantalla del ERP: `módulo/submódulo` tal como aparece en la URL (?m=ventas&sm=facturas). */
export type GuideRoute = string;

export interface GuideStep {
  /** Qué hacer, en lenguaje sencillo. */
  text: string;
  /** Pantalla a la que hay que ir antes de este paso (se navega sola). */
  to?: GuideRoute;
  /**
   * Qué resaltar. Selector CSS o `text:Nombre del botón` (busca botones, pestañas,
   * enlaces y etiquetas visibles con ese texto). Varias opciones se separan con `||`.
   */
  target?: string;
  /** Consejo corto que se muestra debajo del paso. */
  tip?: string;
}

export interface ErpGuide {
  id: string;
  /** Nombre del área tal como aparece en el menú (Ventas, Inventario…). */
  area: string;
  /** Módulo del menú que debe estar habilitado para ver la guía. */
  module: string;
  title: string;
  /** Frases con las que la gente pregunta por esta tarea (sin tildes no importa). */
  keywords: string[];
  summary: string;
  steps: GuideStep[];
  /** Aviso previo: permisos o configuración que se necesita. */
  requires?: string;
}

export interface GuideMatch {
  guide: ErpGuide;
  score: number;
}
