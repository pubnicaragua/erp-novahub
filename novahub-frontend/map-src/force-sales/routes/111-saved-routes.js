async function loadRemoteRoutes(){
  if(!localStorage.getItem('nh-auth-token'))return;
  if(remoteRoutesLoading){remoteRoutesRefreshRequested=true;return}
  remoteRoutesLoading=true;
  try{
    const rows=await forceSalesRequest('/force-sales/routes');
    if(!Array.isArray(rows))throw new Error('La respuesta de rutas no tiene el formato esperado.');
    remoteRoutes=rows;
    forceSalesSyncErrors.delete('rutas');
    const refreshedActiveRoute=activeRemoteRouteId&&!routeDraftDirty?rows.find(route=>String(route.id)===String(activeRemoteRouteId)):null;
    const refreshedStatus=String(refreshedActiveRoute?.status||'').toUpperCase();
    const mayAdvanceAutoRoute=Boolean(autoDisplayedRouteId&&String(autoDisplayedRouteId)===String(activeRemoteRouteId)
      &&(!refreshedActiveRoute||['COMPLETED','CANCELLED'].includes(refreshedStatus)));
    const mayChooseAssignedRoute=!routeDraftDirty&&!routePlanningMode&&(!activeRemoteRouteId||mayAdvanceAutoRoute);
    const assignedRoute=mayChooseAssignedRoute?preferredAssignedRouteForMap(rows):null;
    if(assignedRoute&&String(assignedRoute.id)!==String(activeRemoteRouteId||''))showSavedRouteOnMap(assignedRoute,{automatic:true});
    else if(refreshedActiveRoute)hydrateRemoteRoute(refreshedActiveRoute);
    else renderSavedRouteOptions();
    updateOfflineStatus();
  }catch(error){
    console.warn('No se pudieron cargar las rutas persistentes',error);
    setForceSalesSyncError('rutas',error);
  }finally{
    remoteRoutesLoading=false;
    renderSavedRouteOptions();
    if(remoteRoutesRefreshRequested){remoteRoutesRefreshRequested=false;void loadRemoteRoutes()}
  }
}
function preferredAssignedRouteForMap(routes){
  const today=localRouteDate();
  const active=(Array.isArray(routes)?routes:[]).filter(route=>routeAssignedToCurrentUser(route)
    &&['PLANNED','IN_PROGRESS'].includes(String(route.status||'').toUpperCase()));
  active.sort((a,b)=>{
    const statusRank=route=>String(route.status||'').toUpperCase()==='IN_PROGRESS'?0:1;
    const rankDifference=statusRank(a)-statusRank(b);
    if(rankDifference)return rankDifference;
    const dateA=routeDateValue(a),dateB=routeDateValue(b);
    const dayRank=date=>date===today?0:date>today?1:2;
    const dayDifference=dayRank(dateA)-dayRank(dateB);
    if(dayDifference)return dayDifference;
    if(dateA!==dateB)return dateA>today?dateA.localeCompare(dateB):dateB.localeCompare(dateA);
    return String(b.updatedAt||'').localeCompare(String(a.updatedAt||''));
  });
  return active[0]||null;
}
function showSavedRouteOnMap(route,{automatic=false}={}){
  if(!route?.id||routeDraftDirty)return false;
  if(automatic&&!routeAssignedToCurrentUser(route))return false;
  activeRemoteRouteId=String(route.id);
  autoDisplayedRouteId=routeAssignedToCurrentUser(route)?String(route.id):null;
  if(routeMapRefreshTimer){window.clearTimeout(routeMapRefreshTimer);routeMapRefreshTimer=null}
  routeMapLastOrigin=null;routeMapLastRefreshAt=0;
  clearRoutePolylineSegments();routeDirectionsRequestId+=1;
  setRoutePlanningMode(false);
  hydrateRemoteRoute(route);
  if(!mapLayers.plannedRoutes){mapLayers={...mapLayers,plannedRoutes:true};persistMapLayers()}
  updateMapLayerControls();
  updateMapLayerVisibility();
  renderRouteMarkers();
  void drawRouteOnMap({closeModal:false,silent:true});
  return true;
}
function routeAssigneeName(route){
  const assigned=route?.assignedTo || assignees.find(item=>String(item.id)===String(route?.assignedToId));
  return assigned?.name || assigned?.email || 'Sin gestor';
}
function renderSavedRouteOptions(){
  renderRouteAssigneeOptions();
  const selectedId=routeAssigneeDraftValue() ?? CURRENT_USER_ID ?? '';
  const assigned=route=>String(route.assignedToId||'')===String(selectedId);
  const active=remoteRoutes.filter(route=>assigned(route)&&['PLANNED','IN_PROGRESS'].includes(String(route.status||'').toUpperCase()));
  const history=remoteRoutes.filter(route=>assigned(route)&&['COMPLETED','CANCELLED'].includes(String(route.status||'').toUpperCase()));
  const list=document.getElementById('routeAssigneeRoutes');
  const routeLoadError=forceSalesSyncErrors.has('rutas');
  if(list)list.innerHTML=routeLoadError?'<p class="meta route-empty">No se pudieron cargar las rutas de este usuario.</p>':remoteRoutesLoading?'<p class="meta route-empty">Cargando rutas asignadas…</p>':active.length?active.map(route=>{
    const stops=route.stops||[],completed=routeCompletedStopCount(route);
    const status=String(route.status).toUpperCase()==='IN_PROGRESS'?'En curso':'Planificada';
    const next=nextPendingRouteStop(route);
    const nextName=next?.prospect?.name||next?.prospect?.businessName||'Sin paradas pendientes';
    const started=route.startedAt?` · Inicio ${new Date(route.startedAt).toLocaleString('es-NI',{dateStyle:'short',timeStyle:'short'})}`:'';
    const actionStatus=routeActionStatusText(route.id);
    const actionLine=routeActionsFor(route.id).length?`<span class="route-action-status" data-state="${routeHasBlockedAction(route.id)?'error':'pending'}">${esc(actionStatus)}</span>`:'';
    const recurrenceLine=route.dailyScheduleId?`<span>Ruta diaria · ${route.dailySchedule?.active?'nueva ejecución cada día':'programación detenida'}</span>`:'<span>Ruta de una sola vez</span>';
    const startAction=routeAssignedToCurrentUser(route)&&canOperateAssignedRouteAction('changeRouteStatus',route)&&String(route.status||'').toUpperCase()==='PLANNED';
    const startPending=routeActionsFor(route.id).some(action=>action.type==='START_ROUTE'&&action.status==='PENDING');
    const startBlocked=routeActionsFor(route.id).some(action=>action.type==='START_ROUTE'&&action.status==='BLOCKED');
    const startButton=startAction?`<button type="button" data-start-route="${esc(route.id)}" ${startPending||startBlocked?'disabled':''}>${startPending?'Inicio pendiente':startBlocked?'Revisar inicio':'Iniciar ruta'}</button>`:'';
    const openLabel=String(route.status||'').toUpperCase()==='IN_PROGRESS'?'Continuar':'Abrir';
    return `<article class="route-assignee-card"><div><b>${esc(route.name||'Ruta sin nombre')}</b><span>${esc(routeDateLabel(routeDateValue(route)))} · ${status} · ${completed}/${stops.length} visitas${esc(started)}</span>${recurrenceLine}<span>Siguiente parada: ${esc(nextName)}</span>${actionLine}</div><div class="route-assignee-actions">${startButton}<button type="button" data-open-route="${esc(route.id)}">${openLabel}</button></div></article>`;
  }).join(''):'<p class="meta route-empty">Sin rutas activas para este usuario.</p>';
  list?.querySelectorAll('[data-open-route]').forEach(button=>button.addEventListener('click',()=>openSavedRoute(button.dataset.openRoute)));
  list?.querySelectorAll('[data-start-route]').forEach(button=>button.addEventListener('click',()=>void startSavedRoute(button.dataset.startRoute)));
  const historySection=document.getElementById('routeAssigneeHistory');
  const historyList=document.getElementById('routeAssigneeHistoryList');
  const routeListStatus=document.getElementById('routeListStatus');
  const routeListRetry=document.getElementById('routeListRetry');
  if(routeListStatus)routeListStatus.textContent=routeLoadError?'No se pudieron cargar las rutas de este usuario.':remoteRoutesLoading?'Cargando rutas asignadas…':'';
  if(routeListRetry)routeListRetry.hidden=!routeLoadError;
  if(historySection){historySection.hidden=!history.length;historySection.querySelector('summary').textContent=`Historial · ${history.length}`}
  if(historyList)historyList.innerHTML=history.map(route=>{
    const stops=route.stops||[],completed=stops.filter(stop=>String(stop.status).toUpperCase()==='COMPLETED').length;
    const status=String(route.status).toUpperCase()==='COMPLETED'?'Completada':'Cancelada';
    const recurrenceLine=route.dailyScheduleId?`Ruta diaria · ${route.dailySchedule?.active?'programación activa':'programación detenida'}`:'Ruta de una sola vez';
    return `<article class="route-assignee-history-card"><div><b>${esc(route.name||'Ruta sin nombre')}</b><span>${esc(routeDateLabel(routeDateValue(route)))} · ${status} · ${completed}/${stops.length} visitas</span><span>${recurrenceLine}</span></div><button type="button" data-open-route="${esc(route.id)}">Consultar</button></article>`;
  }).join('');
  historyList?.querySelectorAll('[data-open-route]').forEach(button=>button.addEventListener('click',()=>openSavedRoute(button.dataset.openRoute)));
  renderRouteCatalog();
}
function isRouteExecutionView(route=activeRemoteRoute()){
  const routeId=route?.id||activeRemoteRouteId;
  return String(route?.status||'').toUpperCase()==='IN_PROGRESS'||Boolean(routeId&&routeHasPendingStart(routeId));
}
function setRoutePlannerTab(tab){
  const tabs=document.querySelector('.route-planner-tabs');
  if(isRouteExecutionView()){
    if(tabs)tabs.hidden=true;
    document.getElementById('routePlanPane').hidden=true;
    document.getElementById('routeListPane').hidden=true;
    return;
  }
  if(tabs)tabs.hidden=false;
  const plans=tab==='plan';
  document.getElementById('routePlanPane').hidden=!plans;
  document.getElementById('routeListPane').hidden=plans;
  document.getElementById('routePlanTab').setAttribute('aria-selected',String(plans));
  document.getElementById('routeListTab').setAttribute('aria-selected',String(!plans));
  if(!plans)renderRouteCatalog();
}
function renderRouteCatalog(){
  const list=document.getElementById('routeCatalog'),status=document.getElementById('routeCatalogStatus'),retry=document.getElementById('routeCatalogRetry');if(!list||!status)return;
  const query=String(document.getElementById('routeCatalogSearch')?.value||'').trim().toLocaleLowerCase('es-NI');
  const error=forceSalesSyncErrors.has('rutas');
  if(error){status.textContent='No se pudieron cargar las rutas. Reintenta la carga.';if(retry)retry.hidden=false;list.innerHTML='';return}
  if(retry)retry.hidden=true;
  if(remoteRoutesLoading&&!remoteRoutes.length){status.textContent='Cargando rutas…';list.innerHTML='';return}
  const rows=remoteRoutes.filter(route=>{
    const unassigned=!route.assignedToId;
    if(routeCatalogFilter==='unassigned'&&!unassigned)return false;
    if(routeCatalogFilter==='assigned'&&unassigned)return false;
    const text=[route.name,route.assignedTo?.name,route.status,routeDateLabel(routeDateValue(route))].join(' ').toLocaleLowerCase('es-NI');
    return !query||text.includes(query);
  });
  status.textContent=`${rows.length} ${rows.length===1?'ruta':'rutas'} · ${remoteRoutes.length} disponibles en tu alcance`;
  list.innerHTML=rows.length?rows.map(route=>{
    const stops=route.stops||[],done=stops.filter(stop=>String(stop.status).toUpperCase()==='COMPLETED').length;
    const state=({PLANNED:'Planificada',IN_PROGRESS:'En curso',COMPLETED:'Completada',CANCELLED:'Cancelada'})[String(route.status||'').toUpperCase()]||'Sin estado';
    const assigned=route.assignedTo?.name||assignees.find(user=>String(user.id)===String(route.assignedToId))?.name||'Sin asignar';
    const next=nextPendingRouteStop(route);
    const nextName=next?.prospect?.name||next?.prospect?.businessName||'Sin paradas pendientes';
    const started=route.startedAt?`Inicio: ${new Date(route.startedAt).toLocaleString('es-NI',{dateStyle:'short',timeStyle:'short'})}`:'Sin inicio';
    const startAction=routeAssignedToCurrentUser(route)&&canOperateAssignedRouteAction('changeRouteStatus',route)&&String(route.status||'').toUpperCase()==='PLANNED';
    const startPending=routeActionsFor(route.id).some(action=>action.type==='START_ROUTE'&&action.status==='PENDING');
    const startBlocked=routeActionsFor(route.id).some(action=>action.type==='START_ROUTE'&&action.status==='BLOCKED');
    const startButton=startAction?`<button type="button" data-start-route="${esc(route.id)}" ${startPending||startBlocked?'disabled':''}>${startPending?'Inicio pendiente':startBlocked?'Revisar inicio':'Iniciar ruta'}</button>`:'';
    const recurrenceLabel=route.dailyScheduleId?`Ruta diaria · ${route.dailySchedule?.active?'nueva ejecución cada día':'programación detenida'}`:'Ruta de una sola vez';
    const recurrenceAction=route.dailyScheduleId&&canForceSales('editRoute')?`<button type="button" data-toggle-daily-route="${esc(route.dailyScheduleId)}" data-active="${route.dailySchedule?.active?'true':'false'}">${route.dailySchedule?.active?'Detener ruta diaria':'Reanudar ruta diaria'}</button>`:'';
    const openLabel=String(route.status||'').toUpperCase()==='IN_PROGRESS'?'Continuar':['COMPLETED','CANCELLED'].includes(String(route.status||'').toUpperCase())?'Consultar':'Abrir';
    return `<article class="route-assignee-card"><div><b>${esc(route.name||'Ruta sin nombre')}</b><span>${esc(routeDateLabel(routeDateValue(route)))} · ${state} · ${done}/${stops.length} visitas</span><span>${recurrenceLabel}</span><span>Inicio: ${esc(started.replace(/^Inicio: /,''))}</span><span>Siguiente parada: ${esc(nextName)}</span><span>Responsable: ${esc(assigned)}</span></div><div class="route-assignee-actions">${startButton}<button type="button" data-open-route="${esc(route.id)}">${openLabel}</button>${recurrenceAction}</div></article>`;
  }).join(''):'<p class="meta route-empty">No hay rutas que coincidan con este filtro.</p>';
  list.querySelectorAll('[data-open-route]').forEach(button=>button.addEventListener('click',()=>{if(openSavedRoute(button.dataset.openRoute))setRoutePlannerTab('plan')}));
  list.querySelectorAll('[data-start-route]').forEach(button=>button.addEventListener('click',()=>void startSavedRoute(button.dataset.startRoute)));
  list.querySelectorAll('[data-toggle-daily-route]').forEach(button=>button.addEventListener('click',()=>void setDailyRouteScheduleActive(button.dataset.toggleDailyRoute,button.dataset.active!=='true')));
}
async function setDailyRouteScheduleActive(scheduleId,active){
  if(!canForceSales('editRoute')){requireForceSales('editRoute');return}
  if(!navigator.onLine){toast('Conéctate a internet para cambiar la programación diaria');return}
  const prompt=active?'¿Reanudar esta ruta diaria?':'¿Detener las próximas ejecuciones diarias? Las visitas ya registradas se conservarán.';
  if(!confirm(prompt))return;
  try{
    await forceSalesRequest(`/force-sales/routes/schedules/${encodeURIComponent(scheduleId)}`,{method:'PATCH',body:JSON.stringify({active})});
    forceSalesSyncErrors.delete('rutas');
    await loadRemoteRoutes();
    toast(active?'Programación diaria reanudada':'La ruta diaria quedó detenida');
  }catch(error){
    toast(`No se pudo cambiar la ruta diaria: ${error?.message||'el ERP rechazó la operación'}`);
  }
}
function hydrateRemoteRoute(route){
  if(!route?.id)return;
  const hydrated=(route.stops || []).map(stop=>{
    const existing=businesses.find(item=>String(stateOf(item).remoteId||'')===String(stop.prospectId));
    if(!stop.prospect)return null;
    if(existing){const state=stateOf(existing);state.assignedToId=Object.prototype.hasOwnProperty.call(stop.prospect,'assignedToId')?stop.prospect.assignedToId:null;state.assignedToName=stop.prospect.assignedTo?.name || (state.assignedToId?state.assignedToName:null);return existing}
    const business=remoteBusiness({...stop.prospect,id:stop.prospect.id});
    const state=stateOf(business);
    state.remoteId=stop.prospect.id;
    state.assignedToId=Object.prototype.hasOwnProperty.call(stop.prospect,'assignedToId')?stop.prospect.assignedToId:null;
    state.assignedToName=stop.prospect.assignedTo?.name || null;
    remoteProspects.push(business);
    return business;
  }).filter(Boolean).slice(0,ROUTE_MAX_STOPS);
  if(hydrated.length){mergeBusinesses();populateFilters();render();}
  activeRemoteRouteId=route.id;
  activeRemoteUpdatedAt=route.updatedAt || null;
  activeRouteAssigneeId=route.assignedToId ?? ROUTE_UNASSIGNED;
  activeSavedRouteAssigneeId=route.assignedToId ?? null;
  const routeAssignee=document.getElementById('routeAssignee');if(routeAssignee)routeAssignee.value=route.assignedToId||'';
  routeBusinesses=hydrated;
  const scheduledFor=document.getElementById('routeScheduledFor');
  const routeName=document.getElementById('routeName');
  if(scheduledFor)scheduledFor.value=routeDateValue(route);
  if(routeName)routeName.value=route.name || '';
  routeStopIds=new Map((route.stops || []).map(stop=>[String(stop.prospectId),String(stop.id)]));
  routeProgress=(route.stops || []).filter(stop=>String(stop.status).toUpperCase()==='COMPLETED').length;
  persistRoute();
  routeDraftDirty=false;routeSaveAttemptKey=null;clearRouteDraftStorage();
  renderRoutePlanner();
  // Seleccionar una ruta sincronizada no debe desplazar la cámara.
}
function openSavedRoute(routeId){
  if(routeDraftDirty&&!confirm('Tienes cambios pendientes en el borrador. ¿Descartarlos y abrir otra ruta?'))return false;
  const route=remoteRoutes.find(item=>String(item.id)===String(routeId));
  if(!route)return false;
  setRoutePlanningMode(true);
  hydrateRemoteRoute(route);
  autoDisplayedRouteId=routeAssignedToCurrentUser(route)?String(route.id):null;
  document.getElementById('routeModal').hidden=false;
  void drawRouteOnMap({closeModal:false,silent:true});
  void loadPendingRouteActions().then(()=>renderRoutePlanner());
  return true;
}
async function startSavedRoute(routeId){
  if(!openSavedRoute(routeId))return;
  setRoutePlannerTab('plan');
  await loadPendingRouteActions();
  await startCurrentRoute();
}
function startNewRoute(){
  if(routeDraftDirty&&!confirm('Tienes cambios pendientes. ¿Descartarlos y comenzar otra ruta?'))return;
  const selectedAssignee=routeAssigneeDraftValue();
  clearRouteDraftStorage();routeDraftDirty=false;routeSaveAttemptKey=null;
  clearRoutePolylineSegments();routeDirectionsRequestId+=1;
  routeBusinesses=[];routeProgress=0;activeRemoteRouteId=null;autoDisplayedRouteId=null;activeRouteAssigneeId=selectedAssignee||ROUTE_UNASSIGNED;activeSavedRouteAssigneeId=null;activeRemoteUpdatedAt=null;routeStopIds=new Map();
  document.getElementById('routeName').value='';
  document.getElementById('routeFrequency').value='ONCE';
  document.getElementById('routeScheduledFor').value=localRouteDate();
  document.getElementById('routeTransferOwnership').checked=false;
  setRoutePlanningMode(true);persistRoute();renderRoutePlanner();document.getElementById('routeModal').hidden=false;
  toast('Nueva ruta lista. Selecciona puntos en el mapa.');
}
function clearRouteMarkers(){
  routeStopMarkers.forEach(marker=>setNovaMarkerMap(marker,null));
  routeStopMarkers.clear();
}
function renderRouteMarkers(){
  clearRouteMarkers();
  if(!googleMap)return;
  const activeRoute=activeRemoteRoute();
  const isExecutingAssignedRoute=Boolean(activeRoute&&isRouteExecutionView(activeRoute)&&routeAssignedToCurrentUser(activeRoute));
  const nextStopId=isExecutingAssignedRoute?String(nextPendingRouteStop(activeRoute)?.prospectId||''):'';
  routeBusinesses.forEach((business,index)=>{
    const lat=Number(business.lat),lng=Number(business.lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
    const isNextStop=isExecutingAssignedRoute&&String(stateOf(business).remoteId||'')===nextStopId;
    const content=document.createElement('div');
    content.className=`nova-route-marker${routePlanningMode?' route-stop-selected':''}${isNextStop?' route-stop-next':''}`;
    if(routePlanningMode)content.textContent=String(index+1);
    else if(ROUTE_LOGO_URI){const image=document.createElement('img');image.src=ROUTE_LOGO_URI;image.alt='Logo de la empresa';content.appendChild(image)}else content.textContent='R';
    if(!routePlanningMode){const badge=document.createElement('span');badge.textContent=isNextStop?'→':String(index+1);content.appendChild(badge)}
    content.setAttribute('role','button');content.setAttribute('aria-label',isNextStop?`Siguiente parada más cercana: ${business.name||'punto comercial'}`:`Parada ${index+1}: ${business.name || 'punto comercial'}`);
    const marker=createMapMarker({map:routePlanningMode||mapLayers.plannedRoutes?googleMap:null,position:{lat,lng},title:`${isNextStop?'Siguiente parada más cercana: ':'Parada '+(index+1)+': '}${business.name || ''}`,content,zIndex:isNextStop?1300:1150+routeBusinesses.length-index});
    const removeStop=()=>{if(routePlanningMode)toggleRouteBusiness(business)};
    if(typeof marker.addEventListener==='function')marker.addEventListener('gmp-click',removeStop);else marker.addListener?.('click',removeStop);
    routeStopMarkers.set(keyOf(business),marker);
  });
}
function requestCurrentLocation(){
  if(typeof capturePresenceLocation==='function') capturePresenceLocation();
}
