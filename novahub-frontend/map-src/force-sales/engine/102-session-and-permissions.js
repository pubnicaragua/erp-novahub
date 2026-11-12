const OFFLINE_DB_NAME = 'nova-force-sales-offline-v1';
const OFFLINE_STORE_LEGACY = 'outbox';
const OFFLINE_STORE_V2 = 'outboxV2';
const OFFLINE_DB_VERSION = 2;
let offlineDbPromise = null;
let legacyOfflineMigrationPromise = null;
let flushingOutbox = false;
const mapQuery = new URLSearchParams(location.search);
// Modo activo del mapa (visits, prospecting, delivery...) y modos habilitados para la empresa, definidos por el ERP.
const ACTIVE_MODE_STATE = window.NovaForceSalesModes.resolve(mapQuery);
const ACTIVE_MODE = ACTIVE_MODE_STATE.mode;
const ENABLED_MODES = ACTIVE_MODE_STATE.modes;
const MODE_LAYER_DEFAULTS = window.NovaForceSalesModes.layerDefaults(ACTIVE_MODE, mapQuery.get('layerDefaults'));
function applyModeVisibility(){
  document.body.dataset.mode = ACTIVE_MODE;
  document.querySelectorAll('[data-mode-only]').forEach(node => {
    const allowed = String(node.dataset.modeOnly || '').split(' ').filter(Boolean);
    node.toggleAttribute('data-mode-hidden', !allowed.includes(ACTIVE_MODE));
  });
}
applyModeVisibility();
let forceSalesPermissions = {};
try {
  const parsedPermissions = JSON.parse(mapQuery.get('permissions') || '{}');
  if (parsedPermissions && typeof parsedPermissions === 'object' && !Array.isArray(parsedPermissions)) forceSalesPermissions = parsedPermissions;
} catch { /* A session without the granular action payload fails closed in the UI. */ }
function canForceSales(action){return forceSalesPermissions[action]===true}
function requireForceSales(action){
  if(canForceSales(action))return true;
  toast('Tu rol no tiene permiso para esta acción');
  return false;
}
const API_BASE = (mapQuery.get('api') || localStorage.getItem('novaApiBase') || 'http://localhost:3000/api').replace(/\/$/, '');
const CAN_LINK_CUSTOMER = mapQuery.get('canLinkCustomer') === 'true' && canForceSales('updateProspect');
const CAN_VIEW_CUSTOMER_SUMMARY = mapQuery.get('canViewCustomerSummary') === 'true';
const EXTERNAL_DURABLE_TRACKING = mapQuery.get('durableTracking') === 'true';
const NOVAHUB_ISOTIPO_URL = mapQuery.get('isotipo') || '';
let ROUTE_LOGO_URI = mapQuery.get('companyLogo') || NOVAHUB_ISOTIPO_URL;
const CURRENT_USER_ID = mapQuery.get('userId') || '';
const CURRENT_TENANT_ID = mapQuery.get('tenantId') || '';
const HAS_AUTHENTICATED_TENANT = Boolean(localStorage.getItem('nh-auth-token'));
const CURRENT_IDENTITY = window.NovaForceSalesOfflineIdentity.normalizedIdentity({tenantId:CURRENT_TENANT_ID,userId:CURRENT_USER_ID});
const TENANT_SCOPE_KEY = CURRENT_TENANT_ID || CURRENT_USER_ID || 'authenticated';
const MAP_LAYERS_STORAGE_KEY=window.NovaForceSalesLocation.mapLayerStorageKey(CURRENT_TENANT_ID,CURRENT_USER_ID,ACTIVE_MODE);
const GOOGLE_MAP_ID=String(mapQuery.get('mapId')||'DEMO_MAP_ID').trim()||'DEMO_MAP_ID';
const GOOGLE_CLEAN_MAP_ID=String(mapQuery.get('cleanMapId')||'').trim();
const MAP_PROVIDER=String(mapQuery.get('mapProvider')||'GOOGLE').toUpperCase();
const CAN_TOGGLE_BASE_PLACES=MAP_PROVIDER==='GOOGLE'&&Boolean(GOOGLE_CLEAN_MAP_ID)&&GOOGLE_CLEAN_MAP_ID!==GOOGLE_MAP_ID;
const savedMapLayers=readStore(MAP_LAYERS_STORAGE_KEY,{});
let mapLayers=window.NovaForceSalesLocation.normalizeMapLayers(savedMapLayers,MODE_LAYER_DEFAULTS);
const MAP_RELOAD_CAMERA_KEY=`novaForceSalesMapCamera:${CURRENT_TENANT_ID||'no-tenant'}:${CURRENT_USER_ID||'no-user'}`;
let mapReloadCamera=null;
try{mapReloadCamera=JSON.parse(sessionStorage.getItem(MAP_RELOAD_CAMERA_KEY)||'null')}catch{mapReloadCamera=null}
if(mapReloadCamera)sessionStorage.removeItem(MAP_RELOAD_CAMERA_KEY);
const LEGACY_LOCAL_POINTS_KEY = HAS_AUTHENTICATED_TENANT ? `novaFuerzaLocalPointsV1:${TENANT_SCOPE_KEY}` : 'novaFuerzaLocalPointsV1';
const LOCAL_POINTS_KEY = window.NovaForceSalesOfflineIdentity.localPointsStorageKey(CURRENT_IDENTITY,HAS_AUTHENTICATED_TENANT);
const storedLocalPoints = readStore(LOCAL_POINTS_KEY, null);
if(Array.isArray(storedLocalPoints))localPoints=storedLocalPoints;
else if(HAS_AUTHENTICATED_TENANT){
  const legacyLocalPoints=readStore(LEGACY_LOCAL_POINTS_KEY,[]);
  legacyLocalPointsWithoutOwner=window.NovaForceSalesOfflineIdentity.countPointsWithoutOwner(legacyLocalPoints);
  localPoints=window.NovaForceSalesOfflineIdentity.selectOwnedPoints(legacyLocalPoints,CURRENT_IDENTITY);
  if(localPoints.length)localStorage.setItem(LOCAL_POINTS_KEY,JSON.stringify(localPoints));
}else localPoints=readStore(LOCAL_POINTS_KEY,[]);
const IS_PLATFORM_ADMIN = mapQuery.get('platformAdmin') === 'true';
const potentialLegend = document.getElementById('potentialLegend');
if(potentialLegend)potentialLegend.hidden=!IS_PLATFORM_ADMIN;
const CAN_ASSIGN_TEAM = mapQuery.get('canAssignTeam') === 'true';
const CAN_ASSIGN_PROSPECT_OWNER = mapQuery.get('canAssignProspectOwner') === 'true';
const CAN_OPERATE_ASSIGNED_ROUTES = mapQuery.get('canOperateAssignedRoutes') === 'true';
const CAN_DELETE_TEST = IS_PLATFORM_ADMIN;
function applyForceSalesPermissionVisibility(){
  const visibility = {
    refresh: 'importProspects', searchGoogle: 'importProspects', searchViewport: 'importProspects', newPoint: 'importProspects',
    clearCatalog: 'delete',
    zoneManager: 'assignProspect', bulkKanban: 'changeStage', bulkRoute: 'createRoute', bulkVisit: 'registerVisit', bulkWhatsApp: 'send', bulkDiscard: 'discardProspect',
    routeImport: 'importProspects', routeImportQuick: 'importProspects', routeOptimize: 'editRoute', routeStart: 'changeRouteStatus', routeCompleteStop: 'completeRouteStop', routeSave: ['createRoute', 'editRoute'],
    routeAssignee: 'assignRoute', zoneAssign: 'assignProspect', quickCaptureTakePhoto: ['attachEvidence', 'importProspects'], quickCaptureChoosePhoto: ['attachEvidence', 'importProspects'], quickCaptureRemovePhoto: ['attachEvidence', 'importProspects'],
    quickCaptureSave: 'importProspects',
  };
  Object.entries(visibility).forEach(([id, action])=>{
    const element=document.getElementById(id);
    if(!element)return;
    const allowed=Array.isArray(action)?action.some(canForceSales):canForceSales(action);
    element.hidden=!allowed;
  });
  const routePlannerQuick=document.getElementById('routePlannerQuick');
  if(routePlannerQuick)routePlannerQuick.hidden=!(CAN_OPERATE_ASSIGNED_ROUTES||canForceSales('createRoute')||canForceSales('editRoute')||canForceSales('assignRoute')||canForceSales('completeRouteStop')||canForceSales('changeRouteStatus'));
  const routeTop=document.getElementById('routeTop');
  if(routeTop){routeTop.hidden=!(CAN_OPERATE_ASSIGNED_ROUTES||canForceSales('createRoute'));routeTop.textContent=canForceSales('createRoute')?'Armar ruta':'Mis rutas'}
  const locationSettings=document.getElementById('locationSettings');
  if(locationSettings)locationSettings.hidden=!(canForceSales('updatePresence')||canForceSales('hidePresence'));
  const togglePresence=document.getElementById('togglePresence');
  if(togglePresence)togglePresence.hidden=!(canForceSales('updatePresence')||canForceSales('hidePresence'));
  const discardConfirm=document.getElementById('discardConfirm');
  if(discardConfirm)discardConfirm.hidden=!canForceSales('discardProspect');
}
applyForceSalesPermissionVisibility();
// Todos los usuarios que llegan a este módulo ya fueron autorizados por
// Fuerza Comercial. La privacidad siempre es de la propia ubicación; nunca
// permite administrar la presencia de otro vendedor.
let CAN_SHARE_PRESENCE = true;
let CAN_MANAGE_CONFIGURATION = false;
let LOCATION_REQUIRED = false;
let LEAD_DISCOVERY_ENABLED = ACTIVE_MODE === 'prospecting';
let forceSalesConfig = null;
let lastForceSalesConfigRefreshAt = 0;
let remoteRoutes = [];
let activeRemoteRouteId = null;
let autoDisplayedRouteId = null;
let routeStopIds = new Map();
let pendingRouteActions = [];
let routeActionsFlushing = false;
let routeActionsLoading = false;
let routeActionsLoadPromise = null;
const PRESENCE_STORAGE_KEY = `novaFuerzaPresenceSharingV1:${CURRENT_USER_ID || 'anonymous'}`;
