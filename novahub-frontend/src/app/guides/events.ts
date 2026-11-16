export const START_GUIDE_EVENT = 'erp-start-guide';

/** Inicia una guía paso a paso desde cualquier parte (chat, centro de capacitación, ayuda). */
export function startGuide(id: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(START_GUIDE_EVENT, { detail: { id } }));
}

/** `ventas/facturas` → { module: 'ventas', subModule: 'facturas' } */
export function parseGuideRoute(route: string) {
  const [module, subModule] = String(route || '').split('/');
  return { module, subModule: subModule || undefined };
}
