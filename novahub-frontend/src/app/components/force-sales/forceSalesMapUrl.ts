import type { ForceSalesModeId, ForceSalesView } from './forceSalesModes';

export interface ForceSalesMapUrlInput {
  /** Dirección pública del mapa, p. ej. `${BASE_URL}maps/diseñoui_mapas_freelancers.html`. */
  mapUrl: string;
  apiBase: string;
  logo: string;
  view: ForceSalesView;
  userId: string;
  tenantId: string;
  platformAdmin: boolean;
  canAssignTeam: boolean;
  canAssignProspectOwner: boolean;
  canLinkCustomer: boolean;
  canOperateAssignedRoutes: boolean;
  permissions: Record<string, boolean>;
  /** Map ID completo (con lugares de Google) y Map ID limpio (sin ellos); el limpio es opcional. */
  mapId: string;
  cleanMapId: string;
  mapProvider: string;
  mapSearchMode: string;
  mapTileUrl?: string | null;
  mapGeocoderUrl?: string | null;
  mapsKey?: string;
  /** Modo activo y modos habilitados para la empresa; el mapa solo pinta el activo. */
  mode: ForceSalesModeId;
  modes: readonly ForceSalesModeId[];
  /** Capas con las que arranca el modo activo (configuración de la empresa). */
  layerDefaults?: Record<string, boolean> | null;
}

/** Arma la URL del iframe del mapa. Todo viaja como parámetro de consulta codificado. */
export function buildForceSalesMapUrl(input: ForceSalesMapUrlInput): string {
  const params = new URLSearchParams();
  params.set('api', input.apiBase);
  params.set('isotipo', input.logo);
  params.set('companyLogo', input.logo);
  params.set('view', input.view);
  params.set('embedded', '1');
  params.set('userId', input.userId);
  params.set('tenantId', input.tenantId);
  params.set('platformAdmin', String(input.platformAdmin));
  params.set('canAssignTeam', String(input.canAssignTeam));
  params.set('canAssignProspectOwner', String(input.canAssignProspectOwner));
  params.set('canLinkCustomer', String(input.canLinkCustomer));
  params.set('canOperateAssignedRoutes', String(input.canOperateAssignedRoutes));
  params.set('durableTracking', 'true');
  params.set('permissions', JSON.stringify(input.permissions));
  params.set('mapId', input.mapId);
  params.set('cleanMapId', input.cleanMapId);
  params.set('mapProvider', input.mapProvider);
  params.set('mapSearchMode', input.mapSearchMode);
  params.set('mode', input.mode);
  params.set('modes', input.modes.join(','));
  if (input.layerDefaults) params.set('layerDefaults', JSON.stringify(input.layerDefaults));
  if (input.mapTileUrl) params.set('mapTileUrl', input.mapTileUrl);
  if (input.mapGeocoderUrl) params.set('mapGeocoderUrl', input.mapGeocoderUrl);
  if (input.mapsKey) params.set('mapsKey', input.mapsKey);
  return `${input.mapUrl}${input.mapUrl.includes('?') ? '&' : '?'}${params.toString()}`;
}
