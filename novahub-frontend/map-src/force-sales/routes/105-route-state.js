let assignees = [];
let assigneesLoadState = 'loading';
let routeBusinesses = [];
const ROUTE_MAX_STOPS = Number.POSITIVE_INFINITY;
const ROUTE_STORAGE_KEY = 'novaFuerzaRouteV2';
const ROUTE_PROGRESS_KEY = 'novaFuerzaRouteProgressV2';
let routeProgress = Math.max(0, Number(readStore(ROUTE_PROGRESS_KEY, 0)) || 0);
let routePolyline = null;
let routePreviewPolyline = null;
let routeDirectionsRequestId = 0;
let routeMapRefreshTimer = null;
let routeMapLastRefreshAt = 0;
let routeMapLastOrigin = null;
let routeStopMarkers = new Map();
function clearRoutePolylineSegments(){
  routePolyline?.setMap(null);routePolyline=null;
  routePreviewPolyline?.setMap(null);routePreviewPolyline=null;
}
let activeRouteAssigneeId = null;
let activeSavedRouteAssigneeId = null;
const ROUTE_UNASSIGNED = '__unassigned__';
let routeCatalogFilter = 'all';
let routeVicinityPreview = null;
let routeVicinityMarkers = [];
let routeVicinityCircle = null;
function routeAssigneeDraftValue(){return activeRouteAssigneeId===ROUTE_UNASSIGNED?ROUTE_UNASSIGNED:(activeRouteAssigneeId??document.getElementById('routeAssignee')?.value??'')}
function defaultRouteAssigneeValue(){return canForceSales('assignRoute')?ROUTE_UNASSIGNED:null}
let routeAssigneePickerOpen = false;
let routeAssigneeActiveOptionIndex = -1;
let activeRemoteUpdatedAt = null;
let routePlanningMode = false;
let routeDraftDirty = false;
let routeSaving = false;
let routeSaveAttemptKey = null;
const ROUTE_DRAFT_STORAGE_KEY = `novaFuerzaRouteDraftV1:${CURRENT_IDENTITY}`;
function markRouteDraftChanged(){
  routeDraftDirty=true;
  routeSaveAttemptKey=null;
  routeDirectionsRequestId+=1;
  clearRoutePolylineSegments();
  const metrics=document.getElementById('routeMetrics');if(metrics){metrics.hidden=true;metrics.textContent=''}
  persistRouteDraft();
}
function persistRouteDraft(){
  if(!routePlanningMode||!routeDraftDirty)return;
  try{
    localStorage.setItem(ROUTE_DRAFT_STORAGE_KEY,JSON.stringify({
      routeId:activeRemoteRouteId,
      prospectIds:routeBusinesses.map(b=>String(stateOf(b).remoteId||keyOf(b))),
      name:document.getElementById('routeName')?.value || '',
      frequency:document.getElementById('routeFrequency')?.value || 'ONCE',
      scheduledFor:document.getElementById('routeScheduledFor')?.value || localRouteDate(),
      assignedToId:activeRouteAssigneeId===ROUTE_UNASSIGNED?null:(document.getElementById('routeAssignee')?.value || activeRouteAssigneeId || ''),
      originalAssignedToId:activeSavedRouteAssigneeId,
      transferProspectOwnership:document.getElementById('routeTransferOwnership')?.checked===true,
      expectedUpdatedAt:activeRemoteUpdatedAt,
      idempotencyKey:routeSaveAttemptKey,
    }));
  }catch(error){console.warn('No se pudo conservar el borrador local de ruta',error)}
}
function hasStoredRouteDraft(){try{return Boolean(localStorage.getItem(ROUTE_DRAFT_STORAGE_KEY))}catch{return false}}
function clearRouteDraftStorage(){try{localStorage.removeItem(ROUTE_DRAFT_STORAGE_KEY)}catch(error){console.warn('No se pudo limpiar el borrador local de ruta',error)}}
function restoreRouteDraft(){
  if(routeDraftDirty)return true;
  let draft=null;
  try{draft=JSON.parse(localStorage.getItem(ROUTE_DRAFT_STORAGE_KEY)||'null')}catch(error){clearRouteDraftStorage()}
  if(!draft||!Array.isArray(draft.prospectIds))return false;
  const byRemoteId=new Map(businesses.map(b=>[String(stateOf(b).remoteId||''),b]).filter(([id])=>id));
  routeBusinesses=draft.prospectIds.map(id=>byRemoteId.get(String(id))||findBusinessByKey(id)).filter(Boolean);
  activeRemoteRouteId=draft.routeId||null;
  activeRouteAssigneeId=draft.assignedToId===null?ROUTE_UNASSIGNED:(draft.assignedToId||null);
  activeSavedRouteAssigneeId=Object.prototype.hasOwnProperty.call(draft,'originalAssignedToId')?draft.originalAssignedToId:(activeRemoteRoute()?.assignedToId??null);
  const routeAssignee=document.getElementById('routeAssignee');if(routeAssignee)routeAssignee.value=draft.assignedToId||'';
  activeRemoteUpdatedAt=draft.expectedUpdatedAt||null;
  routeSaveAttemptKey=draft.idempotencyKey||null;
  routeProgress=0;
  routeStopIds=new Map();
  const name=document.getElementById('routeName');if(name)name.value=draft.name||'';
  const frequency=document.getElementById('routeFrequency');if(frequency)frequency.value=draft.frequency==='DAILY'?'DAILY':'ONCE';
  const date=document.getElementById('routeScheduledFor');if(date)date.value=draft.scheduledFor||localRouteDate();
  const transfer=document.getElementById('routeTransferOwnership');if(transfer)transfer.checked=draft.transferProspectOwnership===true;
  routeDraftDirty=true;
  return true;
}
function localRouteDate(date=new Date()){
  const year=date.getFullYear();
  const month=String(date.getMonth()+1).padStart(2,'0');
  const day=String(date.getDate()).padStart(2,'0');
  return `${year}-${month}-${day}`;
}
function shiftRouteDate(value,offset){
  const date=new Date(`${value || localRouteDate()}T12:00:00`);
  date.setDate(date.getDate()+offset);
  return localRouteDate(date);
}
function routeDateValue(route){
  return String(route?.scheduledFor || route?.createdAt || localRouteDate()).slice(0,10);
}
function routeDateLabel(value){
  if(!value)return 'Sin fecha';
  const date=new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-NI',{day:'2-digit',month:'2-digit',year:'numeric'});
}
