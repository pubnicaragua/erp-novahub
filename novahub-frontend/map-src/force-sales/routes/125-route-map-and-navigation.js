function openRoutePlanner(ids){
  const requested=(ids || []).map(findBusiness).filter(Boolean);
  if(!canForceSales('createRoute')){
    if(activeRemoteRouteId&&(canForceSales('editRoute')||canForceSales('assignRoute')||canOperateAssignedRouteAction('completeRouteStop'))){
      setRoutePlanningMode(true);renderRoutePlanner();document.getElementById('routeModal').hidden=false;return;
    }
    if(CAN_OPERATE_ASSIGNED_ROUTES){
      setRoutePlanningMode(true);renderRoutePlanner();document.getElementById('routeModal').hidden=false;setRoutePlannerTab('routes');void loadRemoteRoutes();return;
    }
    requireForceSales('createRoute');return;
  }
  setRoutePlanningMode(true);
  const restored=requested.length===0&&restoreRouteDraft();
  if(requested.length){
    routeBusinesses=[];routeProgress=0;activeRemoteRouteId=null;autoDisplayedRouteId=null;activeRouteAssigneeId=defaultRouteAssigneeValue();activeSavedRouteAssigneeId=null;activeRemoteUpdatedAt=null;routeStopIds=new Map();
    const routeAssignee=document.getElementById('routeAssignee');if(routeAssignee)routeAssignee.value='';
    const frequency=document.getElementById('routeFrequency');if(frequency)frequency.value='ONCE';
    requested.forEach(business=>{if(routePointCoordinates(business)&&!routeBusinesses.some(item=>keyOf(item)===keyOf(business)))routeBusinesses.push(business)});
    const scheduledFor=document.getElementById('routeScheduledFor');if(scheduledFor)scheduledFor.value=localRouteDate();
    const routeName=document.getElementById('routeName');if(routeName)routeName.value='';
    const transfer=document.getElementById('routeTransferOwnership');if(transfer)transfer.checked=false;
    markRouteDraftChanged();
  }else if(!restored){
    routeBusinesses=[];routeProgress=0;activeRemoteRouteId=null;autoDisplayedRouteId=null;activeRouteAssigneeId=defaultRouteAssigneeValue();activeSavedRouteAssigneeId=null;activeRemoteUpdatedAt=null;routeStopIds=new Map();
    const routeAssignee=document.getElementById('routeAssignee');if(routeAssignee)routeAssignee.value='';
    const frequency=document.getElementById('routeFrequency');if(frequency)frequency.value='ONCE';
    const scheduledFor=document.getElementById('routeScheduledFor');if(scheduledFor)scheduledFor.value=localRouteDate();
    const routeName=document.getElementById('routeName');if(routeName)routeName.value='';
    const transfer=document.getElementById('routeTransferOwnership');if(transfer)transfer.checked=false;
    markRouteDraftChanged();
  }
  renderRoutePlanner();
  document.getElementById('routeModal').hidden=false;
  if(!routeBusinesses.length)toast('Empieza a marcar los puntos comerciales pulsando sus marcadores en el mapa.');
}
function focusRouteStop(index){
  const business=routeBusinesses[index];if(!business||!routePointCoordinates(business))return;
  googleMap.panTo({lat:Number(business.lat),lng:Number(business.lng)});googleMap.setZoom(Math.max(15,Number(googleMap.getZoom())||15));
  const marker=routeStopMarkers.get(keyOf(business));if(marker?.openPopup)marker.openPopup();
}
function routeDistance(a,b){return Math.hypot(Number(a.lat)-Number(b.lat),Number(a.lng)-Number(b.lng))}
function optimizeRoute(){
  if(!canEditRouteComposition()||!requireForceSales(routeManageAction()))return;
  if(routeBusinesses.length<3){toast('Agrega al menos tres paradas para ordenar por cercanía');return}
  const pending=routeBusinesses.slice(1); const ordered=[routeBusinesses[0]];
  while(pending.length){
    const current=ordered[ordered.length-1];
    let bestIndex=0; let bestDistance=Infinity;
    pending.forEach((candidate,index)=>{const distance=routeDistance(current,candidate);if(distance<bestDistance){bestDistance=distance;bestIndex=index}});
    ordered.push(pending.splice(bestIndex,1)[0]);
  }
  routeBusinesses=ordered;routeProgress=0;markRouteDraftChanged();renderRoutePlanner();toast('Orden aproximado por cercanía desde la primera parada');
}
function requestGoogleDirections(service,request){
  return new Promise((resolve,reject)=>{
    try{
      service.route(request,(result,status)=>status==='OK'&&result?.routes?.[0] ? resolve(result) : reject(new Error(`No se pudo calcular la ruta por carretera (${status || 'sin respuesta'})`)));
    }catch(error){reject(error)}
  });
}
function scheduleActiveRouteMapRefresh(force=false){
  const route=activeRemoteRoute();
  if(!route||!isRouteExecutionView(route)||!routeAssignedToCurrentUser(route)||!mapLayers.plannedRoutes||!window.google?.maps?.DirectionsService)return;
  const origin=currentRouteOrigin(route,true);
  if(!origin)return;
  const now=Date.now();
  const movedMeters=routeMapLastOrigin?routeDistanceMeters(routeMapLastOrigin,origin):Infinity;
  const elapsed=now-routeMapLastRefreshAt;
  if(!force&&routeMapLastOrigin&&elapsed<20000)return;
  if(!force&&routeMapLastOrigin&&movedMeters<150)return;
  if(routeMapRefreshTimer)window.clearTimeout(routeMapRefreshTimer);
  routeMapRefreshTimer=window.setTimeout(()=>{
    routeMapRefreshTimer=null;
    const latestRoute=activeRemoteRoute();
    if(!latestRoute||!isRouteExecutionView(latestRoute)||!routeAssignedToCurrentUser(latestRoute))return;
    void drawRouteOnMap({closeModal:false,silent:true,fitBounds:false});
  },450);
}
async function drawRouteOnMap(options={}){
  const notify=message=>{if(!options.silent)toast(message)};
  if(routeMapRefreshTimer){window.clearTimeout(routeMapRefreshTimer);routeMapRefreshTimer=null}
  clearRoutePolylineSegments();routeDirectionsRequestId+=1;
  const route=activeRemoteRoute();
  const liveRoute=Boolean(route&&isRouteExecutionView(route)&&routeAssignedToCurrentUser(route));
  const origin=liveRoute?currentRouteOrigin(route,true):null;
  if(liveRoute&&!origin){routeMapLastOrigin=null;routeMapLastRefreshAt=0}
  const pendingStops=liveRoute?routeNavigationBusinesses(route,origin):routeBusinesses;
  const stops=liveRoute?pendingStops.slice(0,2):pendingStops;
  const metrics=document.getElementById('routeMetrics');
  if(!stops.length){
    if(liveRoute&&metrics){metrics.hidden=false;metrics.textContent='No quedan paradas pendientes en esta ruta.'}
    else notify('Selecciona negocios para armar una ruta');
    return;
  }
  if(stops.some(b=>!routePointCoordinates(b))){notify('Una o más paradas necesitan coordenadas válidas');return}
  if(liveRoute&&!origin){
    googleMap.panTo({lat:Number(stops[0].lat),lng:Number(stops[0].lng)});googleMap.setZoom(Math.max(15,Number(googleMap.getZoom())||15));
    if(metrics){metrics.hidden=false;metrics.textContent=`GPS sin lectura reciente · orden guardado: ${stops[0].name||'siguiente parada'} · pulsa “Mi ubicación” para trazar desde tu posición.`}
    notify('Actualiza tu ubicación para trazar la ruta desde tu posición');return;
  }
  const points=[...(origin?[origin]:[]),...stops.map(b=>({lat:Number(b.lat),lng:Number(b.lng)}))];
  if(points.length===1){googleMap.panTo(points[0]);googleMap.setZoom(Math.max(15,Number(googleMap.getZoom())||15));if(metrics){metrics.hidden=false;metrics.textContent='Una parada · no requiere trazar un tramo por carretera.'}notify('Ruta de una parada enfocada en el mapa');return}
  if(!window.google?.maps?.DirectionsService){if(liveRoute&&metrics){metrics.hidden=false;metrics.textContent=`No está disponible el servicio de rutas por carretera. Puedes abrir ${stops[0].name||'la siguiente parada'} en Waze o Google Maps.`}notify('El motor de rutas por carretera no está disponible');return}
  const requestId=++routeDirectionsRequestId;
  const service=new google.maps.DirectionsService();
  let mainRoadPath=[],previewRoadPath=[];
  let mainDistance=0,mainDuration=0,previewDistance=0,previewDuration=0,totalDistance=0,totalDuration=0,previewError=null;
  if(origin){routeMapLastOrigin=origin;routeMapLastRefreshAt=Date.now()}
  const overviewPath=result=>(result.routes[0].overview_path||[]).map(point=>({lat:point.lat(),lng:point.lng()}));
  const routeMetricsFor=result=>(result.routes[0].legs||[]).reduce((sum,leg)=>({
    distance:sum.distance+(Number(leg.distance?.value)||0),
    duration:sum.duration+(Number(leg.duration?.value)||0),
  }),{distance:0,duration:0});
  try{
    if(liveRoute){
      const mainResult=await requestGoogleDirections(service,{
        origin:points[0],destination:points[1],waypoints:[],optimizeWaypoints:false,travelMode:google.maps.TravelMode.DRIVING,
      });
      mainRoadPath=overviewPath(mainResult);
      const mainStats=routeMetricsFor(mainResult);mainDistance=mainStats.distance;mainDuration=mainStats.duration;
      if(points.length>2){
        try{
          const previewResult=await requestGoogleDirections(service,{
            origin:points[1],destination:points[2],waypoints:[],optimizeWaypoints:false,travelMode:google.maps.TravelMode.DRIVING,
          });
          previewRoadPath=overviewPath(previewResult);
          const previewStats=routeMetricsFor(previewResult);previewDistance=previewStats.distance;previewDuration=previewStats.duration;
        }catch(error){previewError=error;console.warn('No se pudo calcular el siguiente tramo de la ruta',error)}
      }
    }else{
      // Google Directions admite un número limitado de waypoints por consulta.
      // Se divide una ruta larga en tramos contiguos y se conserva el orden elegido.
      let start=0;
      while(start<points.length-1){
        const end=Math.min(points.length-1,start+23);
        const result=await requestGoogleDirections(service,{
          origin:points[start],destination:points[end],waypoints:points.slice(start+1,end).map(location=>({location,stopover:true})),
          optimizeWaypoints:false,travelMode:google.maps.TravelMode.DRIVING,
        });
        const stats=routeMetricsFor(result);totalDistance+=stats.distance;totalDuration+=stats.duration;
        const segment=overviewPath(result);
        mainRoadPath.push(...(start>0?segment.slice(1):segment));
        start=end;
      }
    }
  }catch(error){routeMapLastOrigin=null;console.warn('No se pudo calcular la ruta por carretera',error);if(metrics){metrics.hidden=false;metrics.textContent=liveRoute?`No se pudo calcular el tramo hasta ${stops[0].name||'la siguiente parada'}. Puedes abrirla en Waze o Google Maps.`:'No se pudo calcular el recorrido por carretera. Las paradas se conservaron y puedes guardar la ruta.'}notify(error?.message || 'No se pudo calcular la ruta por carretera');return}
  if(liveRoute){totalDistance=mainDistance+previewDistance;totalDuration=mainDuration+previewDuration}
  if(requestId!==routeDirectionsRequestId||mainRoadPath.length<2)return;
  if(!mapLayers.plannedRoutes){mapLayers={...mapLayers,plannedRoutes:true};persistMapLayers();updateMapLayerControls();updateMapLayerVisibility()}
  routePolyline=new google.maps.Polyline({map:mapLayers.plannedRoutes?googleMap:null,path:mainRoadPath,geodesic:false,strokeColor:'#08785a',strokeOpacity:.95,strokeWeight:5,zIndex:1101});
  if(liveRoute&&previewRoadPath.length>=2)routePreviewPolyline=new google.maps.Polyline({
    map:mapLayers.plannedRoutes?googleMap:null,path:previewRoadPath,geodesic:false,strokeColor:'#08785a',strokeOpacity:0,strokeWeight:1,
    icons:[{icon:{path:google.maps.SymbolPath.CIRCLE,fillColor:'#08785a',fillOpacity:1,strokeColor:'#fff',strokeOpacity:.95,strokeWeight:1,scale:3},offset:'0',repeat:'12px'}],zIndex:1100,
  });
  if(metrics){metrics.hidden=false;metrics.textContent=liveRoute
    ? `Línea continua hasta ${stops[0].name||'la parada más cercana'}: ${(mainDistance/1000).toFixed(1)} km · ${Math.max(1,Math.round(mainDuration/60))} min${previewRoadPath.length>=2?` · luego discontinua hasta ${stops[1].name||'la siguiente parada'}: ${(previewDistance/1000).toFixed(1)} km`:(previewError?' · no se pudo calcular el tramo siguiente':'')} · ${pendingStops.length} parada${pendingStops.length===1?' pendiente':'s pendientes'}.`
    : `${stops.length} parada${stops.length===1?'':'s'} restantes · aproximadamente ${(totalDistance/1000).toFixed(1)} km · ${Math.max(1,Math.round(totalDuration/60))} min por carretera.`}
  const bounds=new google.maps.LatLngBounds();
  [...mainRoadPath,...previewRoadPath].forEach(point=>bounds.extend(point));
  if(options.fitBounds!==false)googleMap.fitBounds(bounds,64);
  if(options.closeModal!==false)document.getElementById('routeModal').hidden=true;
  notify(liveRoute?`Línea continua hasta ${stops[0].name||'la parada más cercana'}${previewRoadPath.length>=2?` · discontinua hacia ${stops[1].name||'la siguiente parada'}`:''}`:`${stops.length} parada${stops.length===1?'':'s'} trazada${stops.length===1?'':'s'} por carretera`);
}
function openRouteStop(index){
  const stop=routeBusinesses[index];
  const url=routeWazeUrl(stop);
  if(!stop||!url){toast('Esta parada no tiene coordenadas válidas');return}
  window.open(url,'_blank','noopener,noreferrer');
  toast(`Waze abierto · parada ${index+1} de ${routeBusinesses.length}`);
}
// La siguiente parada que se abre en Waze o Google Maps debe ser la misma que dibuja el mapa: con una ruta en
// curso y GPS reciente, la pendiente más cercana a la ubicación actual; si no, la siguiente en el orden guardado.
function nextNavigationStop(route){
  if(route){
    const nearest=routeNavigationBusinesses(route,currentRouteOrigin(route,true));
    if(nearest.length)return nearest[0];
  }
  return routeBusinesses[route?routeNextPendingIndex(route):routeProgress];
}
function openFullRouteInGoogleMaps(){
  const route=activeRemoteRoute();
  const ordered=route?routeNavigationBusinesses(route,currentRouteOrigin(route,true)):routeBusinesses.slice(routeProgress);
  const result=window.NovaForceSalesRouteTools.googleMapsRouteUrl(ordered);
  if(!result.url){toast('No hay paradas pendientes con coordenadas válidas');return}
  window.open(result.url,'_blank','noopener,noreferrer');
  toast(result.omitted>0
    ?`Google Maps abierto con ${result.used} paradas · ${result.omitted} quedan fuera por el límite de Google; ábrelas al terminar`
    :`Google Maps abierto con la ruta completa · ${result.used} ${result.used===1?'parada':'paradas'}`);
}
function openNextRouteStop(provider='waze'){
  const route=activeRemoteRoute();
  const index=route?routeNextPendingIndex(route):routeProgress;
  const business=nextNavigationStop(route);
  const urls=window.NovaForceSalesRouteTools.navigationUrls(business||{});
  const url=provider==='google'?urls.googleMaps:urls.waze;
  if(!url){toast('La siguiente parada no tiene coordenadas válidas');return}
  window.open(url,'_blank','noopener,noreferrer');
  const sequencePosition=route?Math.min(routeBusinesses.length,routeCompletedStopCount(route)+1):index+1;
  toast(`${provider==='google'?'Google Maps':'Waze'} abierto · parada ${sequencePosition} de ${routeBusinesses.length}`);
}
function openRouteInMaps(){openNextRouteStop('waze')}
async function startCurrentRoute(){
  const route=activeRemoteRoute();
  if(!route){toast('Abre una ruta asignada antes de iniciarla');return}
  if(routeDraftDirty){toast('Guarda los cambios de la ruta antes de iniciarla');return}
  if(!requireAssignedRouteAction('changeRouteStatus',route))return;
  if(!routeAssignedToCurrentUser(route)){toast('Solo la persona asignada puede iniciar esta ruta');return}
  if(String(route.status||'').toUpperCase()==='IN_PROGRESS'){toast('La ruta ya está iniciada');return}
  if(String(route.status||'').toUpperCase()!=='PLANNED'){toast('Esta ruta ya no se puede iniciar');return}
  if(routeActionsFor(route.id).some(action=>action.type==='START_ROUTE')){toast('El inicio ya está en la cola; revisa su estado o reintenta la sincronización');return}
  try{
    const startedAt=new Date().toISOString();
    await window.NovaForceSalesRouteActionQueue.enqueue(CURRENT_IDENTITY,{
      actionId:`START_ROUTE:${route.id}`,type:'START_ROUTE',routeId:String(route.id),
      routeName:route.name||'Ruta comercial',idempotencyKey:newRouteIdempotencyKey(),payload:{status:'IN_PROGRESS',startedAt},
    });
    await loadPendingRouteActions();
    renderRoutePlanner();
    syncRouteVisitNotesDraft(true);
    await flushPendingRouteActions();
    void drawRouteOnMap({closeModal:false,silent:true});
    const startAction=routeActionsFor(route.id).find(action=>action.type==='START_ROUTE');
    if(startAction?.status==='BLOCKED')toast(`Inicio requiere revisión: ${startAction.error||'el servidor rechazó la acción.'}`);
    else if(startAction?.status==='PENDING')toast('Inicio pendiente de sincronizar; se conservará en este dispositivo');
    else toast(String(activeRemoteRoute()?.status||'').toUpperCase()==='IN_PROGRESS'?'Ruta iniciada':'Inicio guardado y sincronizado');
  }catch(error){console.warn('No se pudo guardar el inicio de la ruta',error);toast(error?.message||'No se pudo guardar el inicio de esta ruta')}
}
async function completeCurrentRouteStop(){
  const route=activeRemoteRoute();
  if(!route){toast('Guarda la ruta en el ERP antes de completar una visita');return}
  if(!requireAssignedRouteAction('completeRouteStop',route))return;
  if(!routeAssignedToCurrentUser(route)){toast('Solo la persona asignada puede registrar visitas de esta ruta');return}
  const started=String(route.status||'').toUpperCase()==='IN_PROGRESS'||routeHasPendingStart(route.id);
  if(!started){toast('Inicia la ruta antes de registrar una visita');return}
  if(routeHasBlockedAction(route.id)){toast('Hay una acción de esta ruta que necesita revisión antes de continuar');return}
  const index=routeNextPendingIndex(route);
  if(index>=routeBusinesses.length){toast('Todas las paradas ya están completadas');return}
  const business=routeBusinesses[index];
  const stopId=routeStopIds.get(String(stateOf(business).remoteId||''));
  if(!stopId){toast('No se encontró la parada persistida en el ERP');return}
  if(routeActionsFor(route.id).some(action=>action.type==='COMPLETE_STOP'&&String(action.stopId)===String(stopId))){toast('Esta visita ya está pendiente de sincronización');return}
  try{
    const freshRouteLocation=lastKnownCoords&&window.NovaForceSalesLocation.isFreshLocationTimestamp(lastKnownCoords.capturedAt)
      ? {lat:lastKnownCoords.latitude,lng:lastKnownCoords.longitude}
      : {};
    const notes=String(document.getElementById('routeVisitNotes')?.value||'').trim();
    await window.NovaForceSalesRouteActionQueue.enqueue(CURRENT_IDENTITY,{
      actionId:`COMPLETE_STOP:${route.id}:${stopId}`,type:'COMPLETE_STOP',routeId:String(route.id),stopId:String(stopId),
      routeName:route.name||'Ruta comercial',stopName:business.name||business.address||'Parada de ruta',
      idempotencyKey:newRouteIdempotencyKey(),payload:{...freshRouteLocation,notes,occurredAt:new Date().toISOString()},
    });
    deleteRouteVisitDraft(route.id,stopId);
    const notesField=document.getElementById('routeVisitNotes');if(notesField)notesField.value='';
    await loadPendingRouteActions();
    renderRoutePlanner();
    syncRouteVisitNotesDraft(true);
    await flushPendingRouteActions();
    const updatedRoute=activeRemoteRoute();
    if(!updatedRoute||routeNextPendingIndex(updatedRoute)>=routeBusinesses.length){
      clearRoutePolylineSegments();routeDirectionsRequestId+=1;routeMapLastOrigin=null;routeMapLastRefreshAt=0;
      const routeFinished=String(updatedRoute?.status||'').toUpperCase()==='COMPLETED';
      const hasPendingVisitSync=routePendingStopIds(updatedRoute?.id).length>0;
      const metrics=document.getElementById('routeMetrics');if(metrics){metrics.hidden=false;metrics.textContent=routeFinished?'Ruta finalizada · no quedan paradas pendientes.':hasPendingVisitSync?'No quedan más destinos; la última visita está pendiente de sincronizar.':'No quedan paradas pendientes.'}
    }else void drawRouteOnMap({closeModal:false,silent:true,fitBounds:false});
  }catch(error){console.warn('No se pudo guardar la visita de ruta',error);toast(error?.message||'No se pudo guardar la visita');return}
  const action=routeActionsFor(route.id).find(item=>item.type==='COMPLETE_STOP'&&String(item.stopId)===String(stopId));
  if(action?.status==='BLOCKED')toast(`Visita requiere revisión: ${action.error||'el servidor rechazó la acción.'}`);
  else if(action?.status==='PENDING')toast('Visita pendiente de sincronizar; se conservará en este dispositivo');
  else{
    const updatedRoute=activeRemoteRoute();
    const nextIndex=routeNextPendingIndex(updatedRoute);
    const nextPosition=Math.min(routeBusinesses.length,routeCompletedStopCount(updatedRoute)+1);
    toast(nextIndex<routeBusinesses.length?`Visita realizada · siguiente parada ${nextPosition}/${routeBusinesses.length}`:'Visita realizada · todas las paradas completadas');
  }
}
function moveRouteStop(index,direction){
  if(!canEditRouteComposition()||!requireForceSales(routeManageAction()))return;
  const next=index+direction;
  if(index<0||next<0||next>=routeBusinesses.length)return;
  [routeBusinesses[index],routeBusinesses[next]]=[routeBusinesses[next],routeBusinesses[index]];
  markRouteDraftChanged();
  renderRoutePlanner();
}
function removeRouteStop(index){
  if(!canEditRouteComposition()||!requireForceSales(routeManageAction()))return;
  if(index<0||index>=routeBusinesses.length)return;
  routeBusinesses.splice(index,1);
  if(index<routeProgress)routeProgress-=1;
  markRouteDraftChanged();
  renderRoutePlanner();
  toast('Parada retirada de la ruta');
}
function closeRoutePanel(){
  document.getElementById('routeModal').hidden=true;
  setRoutePlanningMode(false);
  renderRouteMarkers();
  persistRouteDraft();
}
function clearRoute(){
  if(!routeDraftDirty){toast('No hay cambios de ruta que descartar');return}
  if(!confirm('¿Descartar los cambios pendientes de esta ruta?'))return;
  clearRouteDraftStorage();routeDraftDirty=false;routeSaveAttemptKey=null;
  clearRoutePolylineSegments();routeDirectionsRequestId+=1;
  if(activeRemoteRouteId){
    const saved=activeRemoteRoute();
    if(saved){hydrateRemoteRoute(saved);setRoutePlanningMode(true);document.getElementById('routeModal').hidden=false;toast('Cambios descartados; se restauró la ruta guardada');return}
  }
  routeBusinesses=[];routeProgress=0;activeRemoteRouteId=null;activeRouteAssigneeId=defaultRouteAssigneeValue();activeSavedRouteAssigneeId=null;activeRemoteUpdatedAt=null;routeStopIds=new Map();
  const routeAssignee=document.getElementById('routeAssignee');if(routeAssignee)routeAssignee.value='';
  setRoutePlanningMode(false);persistRoute();clearRouteMarkers();document.getElementById('routeModal').hidden=true;render();toast('Borrador descartado');
}
window.openRouteStop=openRouteStop;
window.moveRouteStop=moveRouteStop;
window.removeRouteStop=removeRouteStop;
window.focusRouteStop=focusRouteStop;
window.beginRouteVicinity=beginRouteVicinity;
async function saveRouteAssignment(){
  if(routeSaving)return;
  const isExisting=Boolean(activeRemoteRouteId);
  const existingRoute=activeRemoteRoute();
  const existingStatus=String(existingRoute?.status||'').toUpperCase();
  if(isExisting&&(existingStatus!=='PLANNED'||routeHasPendingStart(activeRemoteRouteId))){toast('La ruta ya inició o tiene el inicio pendiente; sus datos y paradas quedaron bloqueados');return}
  const canManage=canEditRouteComposition();
  const canAssign=canForceSales('assignRoute')&&(!isExisting||existingStatus==='PLANNED');
  if(!canManage&&!(isExisting&&canAssign)){
    requireForceSales(isExisting?'assignRoute':'createRoute');
    return;
  }
  if(!isExisting&&!requireForceSales('createRoute'))return;
  if(!routeBusinesses.length){toast('Agrega al menos una parada para guardar la ruta');return}
  if(routeBusinesses.some(b=>!routePointCoordinates(b))){toast('Cada parada necesita coordenadas válidas antes de guardar');return}
  if(!navigator.onLine){document.getElementById('routeOfflineStatus').hidden=false;toast('Conéctate para guardar y asignar. El borrador quedó guardado.');return}
  if(isExisting&&String(activeRemoteRoute()?.status||'').toUpperCase()!=='PLANNED'&&canManage){toast('Solo puedes modificar paradas de una ruta planificada');return}
  const assigneeId=canAssign?(routeAssigneeDraftValue()===ROUTE_UNASSIGNED?null:(routeAssigneeDraftValue()||null)):(CURRENT_USER_ID||null);
  const scheduledFor=document.getElementById('routeScheduledFor')?.value || localRouteDate();
  const routeName=document.getElementById('routeName')?.value.trim() || `Ruta ${routeDateLabel(scheduledFor)}`;
  const transferOwnership=document.getElementById('routeTransferOwnership')?.checked===true;
  if(transferOwnership&&(!canAssign||!canForceSales('assignProspect'))){toast('Tu rol no puede transferir los puntos de esta ruta');return}
  const transferCount=routeBusinesses.filter(b=>String(stateOf(b).assignedToId||'')!==String(assigneeId||'')).length;
  if(transferOwnership&&!confirm(`Se cambiará el responsable comercial de ${transferCount} punto(s) al responsable de esta ruta. ¿Continuar?`))return;
  routeSaving=true;renderRoutePlanner();
  try{
    const unsynced=routeBusinesses.filter(b=>!stateOf(b).remoteId);
    if(unsynced.length){
      if(!requireForceSales('importProspects'))return;
      const imported=await syncProspects(unsynced);
      if(!imported||unsynced.some(b=>!stateOf(b).remoteId)){toast('No se pudieron preparar todas las paradas en el ERP');return}
    }
  const payload={};
  if(isExisting){
    if(canManage){
      const prospectIds=routeBusinesses.map(b=>stateOf(b).remoteId).filter(Boolean);
      if(prospectIds.length!==routeBusinesses.length){toast('La ruta contiene paradas que el ERP aún no reconoce');return}
      payload.prospectIds=prospectIds;
      payload.name=routeName;
      payload.scheduledFor=scheduledFor;
      payload.expectedUpdatedAt=activeRemoteUpdatedAt;
      payload.transferProspectOwnership=transferOwnership;
    }
    if(canAssign&&(String(assigneeId||'')!==String(activeSavedRouteAssigneeId||'')||transferOwnership))payload.assignedToId=assigneeId;
    if(!Object.keys(payload).length){toast('No hay cambios autorizados para guardar');return}
  }else{
    payload.name=routeName;
    payload.frequency=document.getElementById('routeFrequency')?.value==='DAILY'?'DAILY':'ONCE';
    payload.scheduledFor=scheduledFor;
    payload.prospectIds=routeBusinesses.map(b=>stateOf(b).remoteId).filter(Boolean);
    payload.logoUri=ROUTE_LOGO_URI || null;
    if(canAssign)payload.assignedToId=assigneeId;
    payload.transferProspectOwnership=transferOwnership;
  }
  routeSaveAttemptKey ||= window.crypto?.randomUUID?.() || `route-${CURRENT_USER_ID}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    persistRouteDraft();
    const saved=await forceSalesRequest(isExisting?`/force-sales/routes/${encodeURIComponent(activeRemoteRouteId)}`:'/force-sales/routes',{method:isExisting?'PATCH':'POST',headers:{'Idempotency-Key':routeSaveAttemptKey},body:JSON.stringify(payload)});
    activeRemoteRouteId=saved?.id || activeRemoteRouteId;
    autoDisplayedRouteId=routeAssignedToCurrentUser(saved)?String(saved.id):null;
    activeRouteAssigneeId=saved?.assignedToId===null?ROUTE_UNASSIGNED:(saved?.assignedToId ?? assigneeId ?? null);
    activeSavedRouteAssigneeId=saved?.assignedToId ?? assigneeId;
    const routeAssignee=document.getElementById('routeAssignee');if(routeAssignee)routeAssignee.value=(saved?.assignedToId ?? assigneeId)===null?'':(saved?.assignedToId ?? assigneeId ?? '');
    activeRemoteUpdatedAt=saved?.updatedAt || activeRemoteUpdatedAt;
    routeStopIds=new Map((saved?.stops || []).map(stop=>[String(stop.prospectId),String(stop.id)]));
    remoteRoutes=[saved,...remoteRoutes.filter(route=>route.id!==saved?.id)].filter(Boolean);
    routeBusinesses.forEach(business=>{const state=stateOf(business);state.routeId=activeRemoteRouteId;if(transferOwnership){state.assignedToId=assigneeId;state.assignedToName=assignees.find(item=>String(item.id)===String(assigneeId||''))?.name || state.assignedToName || null}});
    persistCommercial();persistRoute();routeDraftDirty=false;routeSaveAttemptKey=null;clearRouteDraftStorage();document.getElementById('routeModal').hidden=false;
    // El editor debe ver la ruta inmediatamente después de guardarla; los
    // demás dispositivos la reciben en el siguiente refresh compartido.
    await loadRemoteRoutes();
    if(routeBusinesses.length)await drawRouteOnMap({closeModal:false});
    toast(isExisting?(assigneeId?'Ruta actualizada':'Ruta actualizada sin responsable'):(assigneeId?'Ruta guardada y asignada':'Ruta guardada sin responsable'));
  }catch(error){
    console.warn('No se pudo persistir la ruta en el ERP',error);
    if(error?.status===409)toast(`${error?.message || 'La ruta tiene un conflicto.'} El borrador se conservó.`);
    else toast(`No se pudo guardar la ruta: ${error?.message || 'el ERP rechazó la operación'}`);
  }finally{routeSaving=false;renderRoutePlanner()}
}
function addSelectedToRoute(){
  if(!requireForceSales('createRoute'))return;
  const chosen=selectedBusinesses(); if(!chosen.length){toast('Selecciona negocios para armar una ruta');return}
  const startsNewRoute=Boolean(activeRemoteRouteId);
  if(startsNewRoute){routeBusinesses=[];routeProgress=0;activeRemoteRouteId=null;autoDisplayedRouteId=null;activeRouteAssigneeId=defaultRouteAssigneeValue();activeSavedRouteAssigneeId=null;activeRemoteUpdatedAt=null;routeStopIds=new Map();const routeAssignee=document.getElementById('routeAssignee');if(routeAssignee)routeAssignee.value='';const frequency=document.getElementById('routeFrequency');if(frequency)frequency.value='ONCE'}
  const current=startsNewRoute?[]:routeBusinesses; const keys=new Set(current.map(keyOf));
  chosen.forEach(b=>{if(!keys.has(keyOf(b))){current.push(b)}});
  routeBusinesses=current.slice(0,ROUTE_MAX_STOPS);setRoutePlanningMode(true);markRouteDraftChanged();renderRoutePlanner();document.getElementById('routeModal').hidden=false;
}
