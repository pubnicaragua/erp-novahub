import type { ViewGuideConfig } from '../organizacion/ViewGuide';

/**
 * Modos del mapa de Fuerza Comercial. Cada empresa tiene activos los que el super admin habilitó en
 * Suscripciones; el backend los entrega en `enabledModes` junto con las capas de cada uno. Para sumar un cuarto modo
 * basta una entrada en estas constantes y un archivo en public/maps/force-sales (map-src/force-sales/modes).
 */
export type ForceSalesModeId = string;

export const FORCE_SALES_MODE_LABELS: Record<string, string> = {
  visits: 'Visitas y zonas',
  prospecting: 'Prospección',
  delivery: 'Entregas',
};

/** Acción de permiso por rol que habilita cada modo (con herencia de Fuerza Comercial mientras no se niegue). */
export const FORCE_SALES_MODE_PERMISSIONS: Record<string, string> = {
  visits: 'useVisitsMode',
  prospecting: 'useProspectingMode',
  delivery: 'useDeliveryMode',
};

/** Módulo de suscripción de cada modo (los mismos valores de ModuleType del backend). */
export const FORCE_SALES_MODE_MODULES: Record<string, string> = {
  visits: 'FORCE_SALES_VISITS',
  prospecting: 'FORCE_SALES_PROSPECTING',
  delivery: 'FORCE_SALES_DELIVERY',
};

/** Sin información del backend (versión anterior) se conserva el comportamiento previo. */
export const LEGACY_FORCE_SALES_MODES: ForceSalesModeId[] = ['visits', 'prospecting'];

export interface ForceSalesModeConfig {
  enabledModes?: string[];
  modeLayers?: Record<string, Record<string, boolean>>;
}

export type ForceSalesView = 'map' | 'kanban' | 'history';

export function enabledModesFromConfig(config: ForceSalesModeConfig | null | undefined): ForceSalesModeId[] {
  const modes = Array.isArray(config?.enabledModes)
    ? config.enabledModes.filter((mode): mode is string => typeof mode === 'string' && /^[a-z][a-z0-9-]{1,30}$/.test(mode))
    : null;
  return modes ?? [...LEGACY_FORCE_SALES_MODES];
}

export function modeStorageKey(tenantId?: string | null, userId?: string | null) {
  return `nh-force-sales-mode:${tenantId || 'no-tenant'}:${userId || 'no-user'}`;
}

/**
 * Modo con el que se abre el mapa: el último que usó la persona si sigue disponible; si no, el primero.
 * El Kanban es del modo Prospección; el historial usa el modo actual.
 */
export function resolveActiveMode(allowedModes: readonly string[], stored: string | null | undefined, view: ForceSalesView): ForceSalesModeId | null {
  if (!allowedModes.length) return null;
  if (view === 'kanban') return allowedModes.includes('prospecting') ? 'prospecting' : null;
  if (stored && allowedModes.includes(stored)) return stored;
  return allowedModes[0];
}

export interface ForceSalesKpi { id: string; label: string; value: string | number }
export interface ForceSalesPrimaryAction { label: string; disabled: boolean }
export interface ForceSalesSummary {
  mode: string;
  title: string;
  searchPlaceholder: string;
  primaryAction: ForceSalesPrimaryAction | null;
  kpis: ForceSalesKpi[];
}

/** Valida el resumen que publica el mapa antes de dibujarlo (el iframe es otra página: nunca se confía a ciegas). */
export function parseForceSalesSummary(data: unknown): ForceSalesSummary | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  if (record.source !== 'novahub-force-sales' || record.type !== 'force-sales-summary') return null;
  if (typeof record.mode !== 'string' || !record.mode) return null;
  const kpis = Array.isArray(record.kpis)
    ? record.kpis.flatMap((item): ForceSalesKpi[] => {
      const entry = item as Record<string, unknown>;
      if (typeof entry?.id !== 'string' || typeof entry.label !== 'string') return [];
      const value = typeof entry.value === 'number' || typeof entry.value === 'string' ? entry.value : '—';
      return [{ id: entry.id, label: entry.label.slice(0, 60), value: typeof value === 'string' ? value.slice(0, 80) : value }];
    }).slice(0, 6)
    : [];
  const action = record.primaryAction as Record<string, unknown> | null | undefined;
  return {
    mode: record.mode,
    title: typeof record.title === 'string' ? record.title.slice(0, 80) : record.mode,
    searchPlaceholder: typeof record.searchPlaceholder === 'string' ? record.searchPlaceholder.slice(0, 120) : 'Buscar…',
    primaryAction: action && typeof action.label === 'string' && action.label
      ? { label: action.label.slice(0, 60), disabled: action.disabled === true }
      : null,
    kpis,
  };
}

const TITLE = '[data-tour="page-title"]';
const TOOLBAR = '[data-tour="force-sales-toolbar"]';
const KPIS = '[data-tour="force-sales-kpis"]';


/** Guía del «?» de cada modo: qué hace cada paso para que el equipo pueda probarlo con el demo. */
export const FORCE_SALES_MODE_GUIDES: Record<string, ViewGuideConfig> = {
  visits: {
    title: 'Visitas y zonas',
    steps: [
      { target: TITLE, title: 'Solo tus puntos', description: 'Este modo muestra únicamente los clientes y puntos de tu empresa, sin negocios de Google. Cada visita queda amarrada a un cliente y a quien la hizo.', placement: 'bottom' },
      { target: KPIS, title: 'Cómo va el día', description: 'Clientes en el mapa, visitados hoy, por visitar y gestores en campo.', placement: 'bottom' },
      { target: TOOLBAR, title: 'Buscar y marcar', description: 'Busca un cliente por nombre o dirección. «Nuevo punto» marca un cliente en el mapa; si ya existe en Ventas, vincúlalo desde su ficha.', placement: 'bottom' },
    ],
  },
  prospecting: {
    title: 'Prospección',
    steps: [
      { target: TITLE, title: 'Negocios nuevos', description: 'Con tu ubicación actual encuentra los negocios cercanos con Google Maps y llévalos por el embudo: seleccionar, Kanban, visita, WhatsApp.', placement: 'bottom' },
      { target: TOOLBAR, title: 'Encontrar negocios', description: '«Encontrar negocios cerca de mí» usa tu ubicación. También puedes escribir un rubro (ferretería, farmacia…) y pulsar Enter para buscarlo.', placement: 'bottom' },
      { target: KPIS, title: 'Tu embudo', description: 'Encontrados, seleccionados, en Kanban, visitados e interesados.', placement: 'bottom' },
    ],
  },
  delivery: {
    title: 'Entregas',
    steps: [
      { target: TITLE, title: 'Rutas de entrega', description: 'Arma una ruta de un punto a otro, con regreso o con varias paradas. Los lugares de referencia de Google se ven para ubicar direcciones dadas por referencia.', placement: 'bottom' },
      { target: TOOLBAR, title: 'Nueva ruta', description: '«Nueva ruta» abre el planificador. Luego puedes abrir la siguiente parada o la ruta completa en Waze o Google Maps.', placement: 'bottom' },
      { target: KPIS, title: 'Seguimiento', description: 'Rutas activas, paradas, completadas y la siguiente parada.', placement: 'bottom' },
    ],
  },
};

