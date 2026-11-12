function persistRoute(){
  localStorage.setItem(ROUTE_STORAGE_KEY,JSON.stringify(routeBusinesses.map(keyOf)));
  localStorage.setItem(ROUTE_PROGRESS_KEY,String(Math.max(0,Math.min(routeProgress,routeBusinesses.length))));
}
function routeBusinessesFromStore(){
  const keys=readStore(ROUTE_STORAGE_KEY,readStore('novaFuerzaRouteV1',[]));
  return keys.map(key=>findBusinessByKey(key)).filter(Boolean).slice(0,ROUTE_MAX_STOPS);
}
function routeWazeUrl(b){
  const lat=Number(b?.lat), lng=Number(b?.lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return '';
  // Solo coordenadas: con «q» Waze busca por texto y puede abrir otro lugar con nombre parecido.
  return `https://waze.com/ul?ll=${encodeURIComponent(`${lat},${lng}`)}&navigate=yes&utm_source=novahub`;
}
function routeManageAction(){return activeRemoteRouteId?'editRoute':'createRoute'}
function activeRemoteRoute(){return remoteRoutes.find(route=>String(route.id)===String(activeRemoteRouteId||''))||null}
function routeActionsFor(routeId=activeRemoteRouteId){return pendingRouteActions.filter(action=>String(action.routeId)===String(routeId||''))}
function routePendingStopIds(routeId=activeRemoteRouteId){return routeActionsFor(routeId).filter(action=>action.type==='COMPLETE_STOP'&&action.status==='PENDING').map(action=>String(action.stopId))}
function canOperateAssignedRouteAction(action,route=activeRemoteRoute()){
  return canForceSales(action)||(['changeRouteStatus','completeRouteStop'].includes(action)&&CAN_OPERATE_ASSIGNED_ROUTES&&routeAssignedToCurrentUser(route));
}
function requireAssignedRouteAction(action,route=activeRemoteRoute()){
  if(canOperateAssignedRouteAction(action,route))return true;
  toast('Tu rol no tiene permiso para esta acción');
  return false;
}
const ROUTE_VISIT_DRAFTS_STORAGE_KEY=`novaFuerzaRouteVisitDraftsV1:${window.NovaForceSalesOfflineIdentity.scopeKey(CURRENT_IDENTITY)||'unresolved-identity'}`;
function routeVisitDrafts(){try{const value=JSON.parse(localStorage.getItem(ROUTE_VISIT_DRAFTS_STORAGE_KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return {}}}
function routeVisitDraftKey(routeId,stopId){return JSON.stringify([String(routeId||''),String(stopId||'')])}
function saveRouteVisitDraft(routeId,stopId,value){try{const drafts=routeVisitDrafts(),key=routeVisitDraftKey(routeId,stopId),notes=String(value||'').slice(0,1000);if(notes)drafts[key]=notes;else delete drafts[key];localStorage.setItem(ROUTE_VISIT_DRAFTS_STORAGE_KEY,JSON.stringify(drafts))}catch{}}
function deleteRouteVisitDraft(routeId,stopId){saveRouteVisitDraft(routeId,stopId,'')}
function currentRouteVisitContext(){
  const route=activeRemoteRoute();
  if(!route)return null;
  const index=routeNextPendingIndex(route),business=routeBusinesses[index];
  const stopId=business?routeStopIds.get(String(stateOf(business).remoteId||'')):null;
  return stopId?{routeId:String(route.id),stopId:String(stopId)}:null;
}
function syncRouteVisitNotesDraft(force=false){
  const textarea=document.getElementById('routeVisitNotes');
  if(!textarea||(!force&&document.activeElement===textarea))return;
  const context=currentRouteVisitContext();
  textarea.value=context?String(routeVisitDrafts()[routeVisitDraftKey(context.routeId,context.stopId)]||''):'';
}
function routeNextPendingIndex(route=activeRemoteRoute()){
  if(!route)return Math.max(0,Math.min(routeProgress,routeBusinesses.length));
  const nextStop=nextPendingRouteStop(route);
  if(!nextStop)return routeBusinesses.length;
  const index=routeBusinesses.findIndex(business=>String(stateOf(business).remoteId||'')===String(nextStop.prospectId||''));
  if(index>=0)return index;
  const stops=routeBusinesses.map(business=>{
    const prospectId=String(stateOf(business).remoteId||'');
    const id=routeStopIds.get(prospectId);
    return route.stops?.find(stop=>String(stop.id)===String(id))||{id,status:'PENDING'};
  });
  const fallback=window.NovaForceSalesRouteTools.nextPendingStopIndex(stops,routePendingStopIds(route.id));
  return fallback<0?routeBusinesses.length:fallback;
}
function nextPendingRouteStop(route){
  if(['COMPLETED','CANCELLED'].includes(String(route?.status||'').toUpperCase()))return null;
  const pendingIds=new Set(routePendingStopIds(route?.id));
  const pending=(route?.stops||[])
    .filter(stop=>!['COMPLETED','SKIPPED'].includes(String(stop.status||'PENDING').toUpperCase())&&!pendingIds.has(String(stop.id)))
    .slice()
    .sort((a,b)=>(Number(a.position)||0)-(Number(b.position)||0));
  if(!pending.length)return null;
  const origin=currentRouteOrigin(route,false);
  if(origin&&routePointCoordinates(origin)){
    const candidates=pending.map((stop,index)=>{
      const business=stop.prospect||routeBusinesses.find(item=>String(stateOf(item).remoteId||'')===String(stop.prospectId||''));
      return routePointCoordinates(business)?{stop,index,distance:routeDistanceMeters(origin,business)}:null;
    }).filter(Boolean).sort((a,b)=>a.distance-b.distance||a.index-b.index);
    if(candidates.length)return candidates[0].stop;
  }
  return pending[0];
}
function currentRouteOrigin(route=activeRemoteRoute(),executionOnly=true){
  if(!route||!routeAssignedToCurrentUser(route)||(executionOnly&&!isRouteExecutionView(route))||!lastKnownCoords
    ||!window.NovaForceSalesLocation.isFreshLocationTimestamp(lastKnownCoords.capturedAt))return null;
  const origin={lat:Number(lastKnownCoords.latitude),lng:Number(lastKnownCoords.longitude)};
  return routePointCoordinates(origin)?origin:null;
}
function routeNavigationBusinesses(route=activeRemoteRoute(),origin=currentRouteOrigin(route,true)){
  if(!route)return [];
  const pendingIds=new Set(routePendingStopIds(route.id));
  const remaining=(route.stops||[])
    .filter(stop=>!['COMPLETED','SKIPPED'].includes(String(stop.status||'PENDING').toUpperCase())&&!pendingIds.has(String(stop.id)))
    .slice()
    .sort((a,b)=>(Number(a.position)||0)-(Number(b.position)||0))
    .map(stop=>({stop,business:routeBusinesses.find(item=>String(stateOf(item).remoteId||'')===String(stop.prospectId||''))||stop.prospect}))
    .filter(item=>routePointCoordinates(item.business));
  if(!origin)return remaining.map(item=>item.business);
  const ordered=[];
  let current=origin;
  while(remaining.length){
    let nearestIndex=0;
    let nearestDistance=Infinity;
    remaining.forEach((item,index)=>{
      const distance=routeDistanceMeters(current,item.business);
      if(distance<nearestDistance){nearestDistance=distance;nearestIndex=index}
    });
    const [next]=remaining.splice(nearestIndex,1);
    ordered.push(next.business);
    current=next.business;
  }
  return ordered;
}
function routeCompletedStopCount(route=activeRemoteRoute()){
  const confirmed=(route?.stops||[]).filter(stop=>String(stop.status||'').toUpperCase()==='COMPLETED').length;
  const pending=new Set(routeActionsFor(route?.id).filter(action=>action.type==='COMPLETE_STOP'&&action.status==='PENDING').map(action=>String(action.stopId)));
  return confirmed+[...pending].filter(id=>!(route?.stops||[]).some(stop=>String(stop.id)===id&&String(stop.status||'').toUpperCase()==='COMPLETED')).length;
}
function routeAssignedToCurrentUser(route=activeRemoteRoute()){
  return Boolean(route?.assignedToId&&CURRENT_USER_ID&&String(route.assignedToId)===String(CURRENT_USER_ID));
}
function routeHasPendingStart(routeId=activeRemoteRouteId){return routeActionsFor(routeId).some(action=>action.type==='START_ROUTE'&&action.status==='PENDING')}
function routeHasBlockedAction(routeId=activeRemoteRouteId){return routeActionsFor(routeId).some(action=>action.status==='BLOCKED')}
function newRouteIdempotencyKey(){return window.crypto?.randomUUID?.()||`route-${CURRENT_USER_ID||'user'}-${Date.now()}-${Math.random().toString(36).slice(2)}`}
function loadPendingRouteActions(){
  if(routeActionsLoadPromise)return routeActionsLoadPromise;
  routeActionsLoading=true;
  routeActionsLoadPromise=(async()=>{
    try{
      pendingRouteActions=await window.NovaForceSalesRouteActionQueue.list(CURRENT_IDENTITY);
      pendingRouteActions=pendingRouteActions.filter(action=>window.NovaForceSalesOfflineIdentity.entryMatchesIdentity(action,CURRENT_IDENTITY));
    }catch(error){
      console.warn('No se pudieron cargar las acciones guardadas de rutas',error);
      const status=document.getElementById('routeActionStatus');
      if(status){status.hidden=false;status.dataset.state='error';status.textContent=error?.message||'No se pudieron leer las acciones de ruta guardadas en este dispositivo.'}
    }finally{
      routeActionsLoading=false;
      routeActionsLoadPromise=null;
      renderRouteQueueNotice();
      renderRouteActionFeedback();
      renderSavedRouteOptions();
    }
    return pendingRouteActions;
  })();
  return routeActionsLoadPromise;
}
async function applyConfirmedRouteAction(action,savedRoute){
  if(!savedRoute?.id)return;
  remoteRoutes=[savedRoute,...remoteRoutes.filter(route=>String(route.id)!==String(savedRoute.id))];
  if(String(activeRemoteRouteId)===String(savedRoute.id)){
    routeStopIds=new Map((savedRoute.stops||[]).map(stop=>[String(stop.prospectId),String(stop.id)]));
    if(action.type==='COMPLETE_STOP'){
      const completedStop=(savedRoute.stops||[]).find(stop=>String(stop.id)===String(action.stopId));
      const business=routeBusinesses.find(item=>String(stateOf(item).remoteId||'')===String(completedStop?.prospectId||''));
      if(business){
        const completedAt=completedStop?.completedAt||new Date().toISOString();
        const state=stateOf(business);state.routeCompletedAt=completedAt;state.visitedAt=state.visitedAt||completedAt;state.stage='Visitado';state.kanban=true;
        followups[business.id]={...(followups[business.id]||{}),status:'Visitado',updatedAt:completedAt};
        localStorage.setItem('novaManaguaFollowupsV4',JSON.stringify(followups));persistCommercial();
      }
    }
    hydrateRemoteRoute(savedRoute);
  }else{
    renderSavedRouteOptions();
  }
}
async function flushPendingRouteActions(){
  if(routeActionsFlushing||!navigator.onLine)return;
  const token=localStorage.getItem('nh-auth-token')||'';
  if(!token||!window.NovaForceSalesOfflineIdentity.tokenMatchesIdentity(token,CURRENT_IDENTITY))return;
  routeActionsFlushing=true;
  let transientFailure=false;
  try{
    pendingRouteActions=await window.NovaForceSalesRouteActionQueue.list(CURRENT_IDENTITY);
    const blockedRoutes=new Set(pendingRouteActions.filter(action=>action.status==='BLOCKED').map(action=>String(action.routeId)));
    for(const action of pendingRouteActions){
      if(!window.NovaForceSalesOfflineIdentity.entryMatchesIdentity(action,CURRENT_IDENTITY))continue;
      if(action.status==='BLOCKED'||blockedRoutes.has(String(action.routeId)))continue;
      try{
        let savedRoute;
        if(action.type==='START_ROUTE'){
          savedRoute=await forceSalesRequest(`/force-sales/routes/${encodeURIComponent(action.routeId)}`,{
            method:'PATCH',headers:{'Idempotency-Key':action.idempotencyKey},body:JSON.stringify(action.payload||{status:'IN_PROGRESS'}),
          });
        }else if(action.type==='COMPLETE_STOP'){
          savedRoute=await forceSalesRequest(`/force-sales/routes/${encodeURIComponent(action.routeId)}/stops/${encodeURIComponent(action.stopId)}/complete`,{
            method:'POST',headers:{'Idempotency-Key':action.idempotencyKey},body:JSON.stringify(action.payload||{}),
          });
        }else{
          await window.NovaForceSalesRouteActionQueue.markBlocked(CURRENT_IDENTITY,action.queueId,'Tipo de acción de ruta desconocido.');
          blockedRoutes.add(String(action.routeId));
          continue;
        }
        await window.NovaForceSalesRouteActionQueue.remove(CURRENT_IDENTITY,action.queueId);
        pendingRouteActions=await window.NovaForceSalesRouteActionQueue.list(CURRENT_IDENTITY);
        await applyConfirmedRouteAction(action,savedRoute);
      }catch(error){
        const statusCode=Number(error?.status)||0;
        if(statusCode>=400&&statusCode<500){
          await window.NovaForceSalesRouteActionQueue.markBlocked(CURRENT_IDENTITY,action.queueId,error?.message||'El servidor rechazó la acción de ruta.');
          blockedRoutes.add(String(action.routeId));
        }else{
          transientFailure=true;
          break;
        }
      }
      renderRouteActionFeedback();
      if(routePlanningMode)renderRoutePlanner();
    }
  }catch(error){
    console.warn('No se pudieron sincronizar las acciones de ruta',error);
    transientFailure=true;
  }finally{
    try{pendingRouteActions=await window.NovaForceSalesRouteActionQueue.list(CURRENT_IDENTITY)}catch{}
    routeActionsFlushing=false;
    renderRouteQueueNotice();
    renderRouteActionFeedback();
    renderSavedRouteOptions();
    if(routePlanningMode)renderRoutePlanner();
    if(transientFailure){
      const status=document.getElementById('routeActionStatus');
      if(status&&activeRemoteRouteId&&routeActionsFor(activeRemoteRouteId).some(action=>action.status==='PENDING')){
        status.hidden=false;status.dataset.state='pending';status.textContent='La conexión falló. La acción sigue pendiente y se volverá a intentar al reconectar.';
      }
    }
  }
}
async function retryBlockedRouteActions(){
  const blocked=routeActionsFor().filter(action=>action.status==='BLOCKED');
  if(!blocked.length)return;
  for(const action of blocked)await window.NovaForceSalesRouteActionQueue.retry(CURRENT_IDENTITY,action.queueId);
  await loadPendingRouteActions();
  await flushPendingRouteActions();
}
async function retryBlockedRouteAction(queueId){
  const action=pendingRouteActions.find(item=>String(item.queueId)===String(queueId)&&item.status==='BLOCKED');
  if(!action)return;
  await window.NovaForceSalesRouteActionQueue.retry(CURRENT_IDENTITY,action.queueId);
  await loadPendingRouteActions();
  await flushPendingRouteActions();
}
function renderRouteQueueNotice(){
  const notice=document.getElementById('routeSyncNotice');
  if(!notice)return;
  const records=pendingRouteActions.filter(action=>action.status==='PENDING'||action.status==='BLOCKED');
  notice.hidden=!records.length;
  document.body.classList.toggle('route-sync-notice-visible',Boolean(records.length));
  if(!records.length){notice.innerHTML='';return}
  const blockedCount=records.filter(action=>action.status==='BLOCKED').length;
  const heading=blockedCount
    ? `${blockedCount} ${blockedCount===1?'acción requiere':'acciones requieren'} revisión`
    : `${records.length} ${records.length===1?'acción pendiente':'acciones pendientes'} de sincronizar`;
  notice.innerHTML=`<h2>${heading}</h2><div class="route-sync-notice-list">${records.map(action=>{
    const blocked=action.status==='BLOCKED';
    const name=action.type==='START_ROUTE'?action.routeName||'Ruta comercial':`${action.routeName||'Ruta comercial'} · ${action.stopName||'Parada de ruta'}`;
    const state=blocked?`Requiere revisión: ${action.error||'El servidor no aceptó esta acción.'}`:'Pendiente de sincronizar; se conservará en este dispositivo.';
    const retry=blocked?`<button type="button" data-retry-route-action="${esc(action.queueId)}" ${navigator.onLine?'':'disabled'}>Reintentar</button>`:'';
    return `<article class="route-sync-notice-item" data-state="${blocked?'error':'pending'}"><div><b>${esc(name)}</b><span>${esc(state)}</span></div>${retry}</article>`;
  }).join('')}</div>`;
}
function routeActionStatusText(routeId=activeRemoteRouteId){
  const records=routeActionsFor(routeId);
  const blocked=records.find(action=>action.status==='BLOCKED');
  if(blocked)return `Requiere revisión: ${blocked.error||'el servidor no aceptó esta acción.'}`;
  const pending=records.filter(action=>action.status==='PENDING').length;
  if(pending)return `${pending} ${pending===1?'acción pendiente':'acciones pendientes'} de sincronizar. Se conservarán en este dispositivo.`;
  if(routeActionsLoading)return 'Cargando acciones guardadas en este dispositivo…';
  return navigator.onLine?'Las acciones están sincronizadas.':'Sin conexión. Las acciones se guardarán en este dispositivo.';
}
function renderRouteActionFeedback(){
  const route=activeRemoteRoute();
  const started=document.getElementById('routeStartedAt');
  const heading=document.getElementById('routeActionHeading');
  const nextDetails=document.getElementById('routeNextStopDetails');
  const status=document.getElementById('routeActionStatus');
  const retry=document.getElementById('routeRetryActions');
  const panel=document.getElementById('routeActionPanel');
  const start=document.getElementById('routeStart');
  const complete=document.getElementById('routeCompleteStop');
  const waze=document.getElementById('routeOpenMaps');
  const google=document.getElementById('routeOpenGoogleMaps');
  syncRouteVisitNotesDraft();
  if(panel)panel.hidden=!route;
  const pendingStart=routeHasPendingStart(route?.id);
  const blockedStart=routeActionsFor(route?.id).some(action=>action.type==='START_ROUTE'&&action.status==='BLOCKED');
  const isStarted=String(route?.status||'').toUpperCase()==='IN_PROGRESS';
  const routeStatus=String(route?.status||'').toUpperCase();
  if(heading)heading.textContent=pendingStart?'Inicio pendiente de sincronizar':blockedStart?'Inicio requiere revisión':isStarted?'Ruta en curso':routeStatus==='COMPLETED'?'Ruta finalizada':routeStatus==='CANCELLED'?'Ruta cancelada':route?(routeAssignedToCurrentUser(route)?'Ruta lista para iniciar':'Ruta planificada'):'';
  if(start){
    start.hidden=!route||!routeAssignedToCurrentUser(route)||!canOperateAssignedRouteAction('changeRouteStatus',route)||!['PLANNED'].includes(String(route.status||'').toUpperCase());
    start.disabled=pendingStart||blockedStart||routeActionsLoading||routeDraftDirty;
    start.textContent=pendingStart?'Inicio pendiente de sincronizar':blockedStart?'Inicio requiere revisión':routeDraftDirty?'Guarda cambios antes de iniciar':'Iniciar ruta';
  }
  if(started){
    started.hidden=!route;
    started.textContent=route?.startedAt?`Inicio: ${new Date(route.startedAt).toLocaleString('es-NI',{dateStyle:'short',timeStyle:'short'})}`
      :pendingStart?'Inicio pendiente de sincronizar'
        :blockedStart?'No se pudo confirmar el inicio de la ruta'
          :isStarted?'Ruta iniciada':'La ruta todavía no ha iniciado';
  }
  const records=routeActionsFor(route?.id);
  const blocked=records.find(action=>action.status==='BLOCKED');
  if(status){
    status.hidden=!route||(!records.length&&!routeActionsLoading&&navigator.onLine);
    status.textContent=routeActionStatusText(route?.id);
    status.dataset.state=blocked?'error':records.length?'pending':'ready';
  }
  if(retry){retry.hidden=!records.some(action=>action.status==='BLOCKED');retry.disabled=routeActionsFlushing||!navigator.onLine;}
  const canVisit=Boolean(route&&routeAssignedToCurrentUser(route)&&canOperateAssignedRouteAction('completeRouteStop',route)&&(isStarted||pendingStart));
  if(complete){complete.hidden=!route||['COMPLETED','CANCELLED'].includes(routeStatus)||!canOperateAssignedRouteAction('completeRouteStop',route);complete.disabled=!canVisit||routeNextPendingIndex(route)>=routeBusinesses.length||routeActionsFlushing||routeHasBlockedAction(route.id);}
  const index=route?routeNextPendingIndex(route):routeProgress;
  const business=routeBusinesses[index];
  const nextSequencePosition=route?Math.min(routeBusinesses.length,routeCompletedStopCount(route)+1):index+1;
  if(nextDetails){nextDetails.hidden=!route;nextDetails.textContent=routeStatus==='CANCELLED'?'La ruta fue cancelada.':business?`Siguiente parada: ${business.name||'Punto comercial'} · ${nextSequencePosition} de ${routeBusinesses.length}`:routeBusinesses.length?'Todas las paradas están completadas.':'La ruta no tiene paradas.'}
  const urls=window.NovaForceSalesRouteTools.navigationUrls(business||{});
  if(waze)waze.disabled=!business||['COMPLETED','CANCELLED'].includes(routeStatus)||!urls.waze;
  if(google)google.disabled=!business||['COMPLETED','CANCELLED'].includes(routeStatus)||!urls.googleMaps;
  const fullGoogle=document.getElementById('routeOpenFullGoogleMaps');
  if(fullGoogle)fullGoogle.disabled=!business||['COMPLETED','CANCELLED'].includes(routeStatus)||!urls.googleMaps;
}
