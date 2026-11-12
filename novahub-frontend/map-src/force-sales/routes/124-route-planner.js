function canManageCurrentRoute(){return canForceSales(routeManageAction())}
function canEditRouteComposition(){
  if(!activeRemoteRouteId)return canForceSales('createRoute');
  const route=activeRemoteRoute(),isPlanned=String(route?.status||'').toUpperCase()==='PLANNED';
  return Boolean(route&&isPlanned&&!routeHasPendingStart(route.id)&&canManageCurrentRoute());
}
function setRoutePlanningMode(active){routePlanningMode=Boolean(active);document.body.classList.toggle('route-planning-active',routePlanningMode)}
function renderRouteAssigneeOptions(){
  const picker=document.getElementById('routeAssigneeSearch');
  const hidden=document.getElementById('routeAssignee');
  const options=document.getElementById('routeAssigneeOptions');
  if(!picker||!hidden||!options)return;
  const selected=String(activeRouteAssigneeId??hidden.value??'');
  hidden.value=selected===ROUTE_UNASSIGNED?'':selected;
  const query=routeAssigneePickerOpen?String(picker.value||'').trim().toLocaleLowerCase('es-NI'):'';
  const rows=assignees.filter(item=>!query||String(item.name||'').toLocaleLowerCase('es-NI').includes(query));
  const selectedItem=selected?assignees.find(item=>String(item.id)===selected):null;
  const selectedFallback=selectedItem&&!rows.some(item=>String(item.id)===selected)?[selectedItem]:[];
  const activeRouteCount=userId=>{
    if(assigneesLoadState!=='ready')return null;
    const assignee=assignees.find(item=>String(item.id)===String(userId||''));
    const rawCount=assignee?.activeRouteCount;
    const count=Number(rawCount);
    if(!assignee||rawCount===null||rawCount===undefined||!Number.isFinite(count))return null;
    const currentRoute=activeRemoteRouteId?remoteRoutes.find(route=>String(route.id)===String(activeRemoteRouteId)):null;
    if(activeRemoteRouteId&&!currentRoute&&forceSalesSyncErrors.has('rutas'))return null;
    const excludesCurrent=currentRoute&&String(currentRoute.assignedToId||'')===String(userId||'')&&['PLANNED','IN_PROGRESS'].includes(String(currentRoute.status||'').toUpperCase());
    return Math.max(0,count-(excludesCurrent?1:0));
  };
  const routeCountLabel=count=>count===null?(assigneesLoadState==='loading'?'consultando rutas…':'conteo no disponible'):`${count} ${count===1?'ruta activa':'rutas activas'}`;
  const selfChoice={id:String(CURRENT_USER_ID||''),name:'Yo mismo/a',count:activeRouteCount(CURRENT_USER_ID)};
  const noneChoice={id:ROUTE_UNASSIGNED,name:'Sin asignar',count:null};
  const choices=[...(!query||noneChoice.name.toLocaleLowerCase('es-NI').includes(query)?[{...noneChoice,count:0}]:[]),...(!query||selfChoice.name.toLocaleLowerCase('es-NI').includes(query)?[selfChoice]:[]),...rows.filter(item=>String(item.id)!==String(CURRENT_USER_ID)).map(item=>({id:String(item.id),name:String(item.name||'Usuario'),count:activeRouteCount(item.id)})),...selectedFallback.filter(item=>String(item.id)!==String(CURRENT_USER_ID)).map(item=>({id:String(item.id),name:String(item.name||'Usuario'),count:activeRouteCount(item.id)}))];
  if(routeAssigneePickerOpen){
    options.innerHTML=choices.length?choices.map((item,index)=>`<div class="route-assignee-option" id="route-assignee-option-${index}" role="option" aria-selected="${String(item.id)===selected}" data-active="${index===routeAssigneeActiveOptionIndex}" data-assignee-id="${esc(item.id)}" data-index="${index}"><span>${esc(item.name)}</span><small>${routeCountLabel(item.count)}</small></div>`).join(''):'<div class="route-assignee-no-results">No hay usuarios que coincidan con la búsqueda.</div>';
    options.hidden=false;picker.setAttribute('aria-expanded','true');
    const active=options.querySelector(`[data-index="${routeAssigneeActiveOptionIndex}"]`);
    picker.setAttribute('aria-activedescendant',active?.id||'');
  }else{
    options.hidden=true;picker.setAttribute('aria-expanded','false');picker.setAttribute('aria-activedescendant','');
    picker.value=selected===ROUTE_UNASSIGNED?'Sin asignar':selected?(assignees.find(item=>String(item.id)===selected)?.name||'Usuario seleccionado'):CURRENT_USER_NAME||'Yo mismo/a';
  }
  const status=document.getElementById('routeAssigneeStatus');
  const catalogStatus=assigneeStatusMessage(query);
  const selectedCount=selected&&selected!==ROUTE_UNASSIGNED?activeRouteCount(selected):null;
  const assignmentWarning=selectedCount===null
    ? (selected&&selected!==ROUTE_UNASSIGNED?(assigneesLoadState==='loading'?'Consultando las rutas activas de este gestor…':'No se pudo comprobar si este gestor tiene otra ruta activa. Puedes continuar y guardar.'):'')
    : selectedCount>0
      ? `Este gestor ya tiene ${selectedCount} otra${selectedCount===1?'':'s'} ruta${selectedCount===1?'':'s'} planificada${selectedCount===1?'':'s'} o en curso. Puedes guardar igualmente.`
      : '';
  if(status){status.textContent=[catalogStatus,assignmentWarning].filter(Boolean).join(' ');status.classList.toggle('route-assignee-pending',Boolean(catalogStatus||assignmentWarning));status.classList.toggle('route-assignee-warning',Boolean(assignmentWarning))}
  const retry=document.getElementById('routeAssigneeRetry');
  if(retry)retry.hidden=assigneesLoadState!=='error'||!canForceSales('assignRoute');
  const readOnly=document.getElementById('routeAssigneeReadOnly');
  if(readOnly){const identityId=selected||activeRemoteRoute()?.assignedToId||CURRENT_USER_ID||'';const selectedUser=assignees.find(item=>String(item.id)===String(identityId));readOnly.textContent=selectedUser?.name||(String(identityId)===String(CURRENT_USER_ID)?CURRENT_USER_NAME:'Responsable de la ruta');}
}
function chooseRouteAssignee(id){
  activeRouteAssigneeId=id===ROUTE_UNASSIGNED?ROUTE_UNASSIGNED:(id||null);
  const hidden=document.getElementById('routeAssignee');if(hidden)hidden.value=id===ROUTE_UNASSIGNED?'':(id||'');
  routeAssigneePickerOpen=false;routeAssigneeActiveOptionIndex=-1;
  markRouteDraftChanged();renderRoutePlanner();
}
function assigneeStatusMessage(search=''){
  if(assigneesLoadState==='loading'&&!assignees.length)return 'Cargando usuarios responsables…';
  if(!assignees.length&&assigneesLoadState==='error')return 'No se pudo cargar la lista de responsables.';
  if(!assignees.length)return 'No hay usuarios activos asignables en esta sucursal con acceso a Fuerza Comercial.';
  if(search&&!assignees.some(item=>String(item.name||'').toLocaleLowerCase('es-NI').includes(String(search).toLocaleLowerCase('es-NI'))))return `No hay responsables que coincidan con “${String(search).trim()}”.`;
  if(assigneesLoadState==='error')return 'No se pudo actualizar la lista. Se muestran los usuarios cargados anteriormente.';
  return '';
}
function refreshRoutePermissionVisibility(){
  const canManage=canManageCurrentRoute();
  const route=activeRemoteRoute();
  const routeStatus=String(route?.status||'').toUpperCase();
  const routeIsEditable=!activeRemoteRouteId||Boolean(route&&routeStatus==='PLANNED'&&!routeHasPendingStart(route.id));
  const canAssign=canForceSales('assignRoute')&&routeIsEditable;
  const canTransfer=CAN_ASSIGN_PROSPECT_OWNER&&canForceSales('assignProspect');
  const clear=document.getElementById('routeClear');
  const optimize=document.getElementById('routeOptimize');
  const assignee=document.getElementById('routeAssigneePicker');
  const assigneeReadOnly=document.getElementById('routeAssigneeReadOnly');
  const assigneeSearch=document.getElementById('routeAssigneeSearch');
  const assigneeLabel=document.getElementById('routeAssigneeLabel');
  const assigneeStatus=document.getElementById('routeAssigneeStatus');
  const assigneeRetry=document.getElementById('routeAssigneeRetry');
  const transfer=document.getElementById('routeTransferWrap');
  const newRoute=document.getElementById('routeNew');
  const complete=document.getElementById('routeCompleteStop');
  const save=document.getElementById('routeSave');
  const routeName=document.getElementById('routeName');
  const scheduledFor=document.getElementById('routeScheduledFor');
  if(routeName)routeName.disabled=!canEditRouteComposition();
  if(scheduledFor)scheduledFor.disabled=!canEditRouteComposition();
  if(clear)clear.hidden=!routePlanningMode||!routeDraftDirty;
  if(optimize)optimize.hidden=!canEditRouteComposition();
  if(assignee)assignee.hidden=!canAssign;
  if(assigneeReadOnly)assigneeReadOnly.hidden=canAssign;
  if(assigneeSearch)assigneeSearch.hidden=!canAssign;
  if(assigneeLabel)assigneeLabel.hidden=!canAssign;
  if(assigneeStatus)assigneeStatus.hidden=!canAssign;
  if(assigneeRetry)assigneeRetry.hidden=!canAssign||assigneesLoadState!=='error';
  if(transfer)transfer.hidden=!canTransfer||Boolean(activeRemoteRouteId&&String(activeRemoteRoute()?.status||'').toUpperCase()!=='PLANNED');
  if(newRoute)newRoute.hidden=!canForceSales('createRoute');
  if(complete)complete.hidden=!canOperateAssignedRouteAction('completeRouteStop');
  if(save){
    save.hidden=!(routeIsEditable&&(canEditRouteComposition() || (Boolean(activeRemoteRouteId)&&canAssign)));
    save.textContent=activeRemoteRouteId&&routeDraftDirty?'Guardar cambios':'Guardar ruta';
  }
  const top=document.getElementById('routeTop');
  if(top){
    const canCreate=canForceSales('createRoute');
    top.hidden=!(CAN_OPERATE_ASSIGNED_ROUTES||canCreate||canForceSales('changeRouteStatus')||Boolean(activeRemoteRouteId&&(canForceSales('editRoute')||canForceSales('assignRoute')||canOperateAssignedRouteAction('completeRouteStop'))));
    top.textContent=canCreate?'Armar ruta':'Mis rutas';
    top.setAttribute('aria-label',canCreate?'Armar una ruta comercial':'Consultar mis rutas asignadas');
  }
  const routePlannerQuick=document.getElementById('routePlannerQuick');
  if(routePlannerQuick){
    const canManageRoutes=canForceSales('createRoute')||canForceSales('editRoute')||canForceSales('assignRoute');
    const title=routePlannerQuick.querySelector('.action-card-copy b');
    const description=routePlannerQuick.querySelector('.action-card-copy small');
    if(title)title.textContent=canManageRoutes?'Rutas y gestores':'Mis rutas asignadas';
    if(description)description.textContent=canManageRoutes?'Gestiona rutas y vendedores':'Inicia y sigue tus rutas comerciales';
  }
}
function renderRoutePlanner(){
  const activeRoute=activeRemoteRoute();
  const activeStatus=String(activeRoute?.status||'').toUpperCase();
  const tabs=document.querySelector('.route-planner-tabs');
  const planTab=document.getElementById('routePlanTab');
  const executionView=isRouteExecutionView(activeRoute);
  const showPlan=planTab?.getAttribute('aria-selected')==='true';
  if(tabs)tabs.hidden=executionView;
  document.getElementById('routePlanPane').hidden=executionView||!showPlan;
  document.getElementById('routeListPane').hidden=executionView||showPlan;
  routeProgress=activeRoute?routeNextPendingIndex(activeRoute):Math.max(0,Math.min(routeProgress,routeBusinesses.length));
  renderSavedRouteOptions();
  refreshRoutePermissionVisibility();
  const scheduledFor=document.getElementById('routeScheduledFor');
  if(scheduledFor&&!scheduledFor.value)scheduledFor.value=activeRemoteRouteId ? routeDateValue(remoteRoutes.find(route=>String(route.id)===String(activeRemoteRouteId))) : localRouteDate();
  const frequency=document.getElementById('routeFrequency');
  const frequencyHint=document.getElementById('routeFrequencyHint');
  const isDailyRoute=Boolean(activeRoute?.dailyScheduleId);
  if(frequency){if(activeRoute)frequency.value=isDailyRoute?'DAILY':'ONCE';frequency.disabled=Boolean(activeRoute)}
  if(frequencyHint)frequencyHint.textContent=activeRoute?(isDailyRoute?'Esta ejecución pertenece a una ruta diaria; sus visitas quedan separadas por fecha.':'Esta ruta guarda una sola ejecución.'):(frequency?.value==='DAILY'?'Desde la fecha seleccionada se generará una ejecución nueva cada día, con sus propias visitas.':'Se guardará una sola ejecución de esta ruta.');
  if(scheduledFor)scheduledFor.disabled=isDailyRoute||!canEditRouteComposition();
  const canManage=canEditRouteComposition();
  const canRemoveStops=canManage;
  const select=document.getElementById('routeAssignee');
  const routeAssigneeId=routeAssigneeDraftValue()??CURRENT_USER_ID??'';
  const routeAssigneeName=assignees.find(item=>String(item.id)===String(routeAssigneeId))?.name||(String(routeAssigneeId)===String(CURRENT_USER_ID)?CURRENT_USER_NAME:'Sin asignar');
  const completed=document.getElementById('routeCompletedCount');
  const count=document.getElementById('routeStopCount');
  const next=document.getElementById('routeNextStop');
  const progressBar=document.getElementById('routeProgressBar');
  const completedCount=activeRoute?routeCompletedStopCount(activeRoute):routeProgress;
  if(count)count.textContent=String(routeBusinesses.length);
  if(completed)completed.textContent=String(completedCount);
  if(next)next.textContent=activeStatus==='CANCELLED'?'Cancelada':activeStatus==='COMPLETED'?'Finalizada':routeBusinesses[routeProgress]?.name || (activeRoute?'Finalizada':'—');
  if(progressBar)progressBar.style.width=`${routeBusinesses.length ? Math.round((completedCount/routeBusinesses.length)*100) : 0}%`;
  const stops=document.getElementById('routeStops');
  if(stops){
    stops.innerHTML=routeBusinesses.length ? routeBusinesses.map((b,index)=>{
      const isCurrent=index===routeProgress;
      const stopId=routeStopIds.get(String(stateOf(b).remoteId||''));
      const remoteStop=activeRoute?.stops?.find(stop=>String(stop.id)===String(stopId));
      const action=routeActionsFor(activeRoute?.id).find(item=>item.type==='COMPLETE_STOP'&&String(item.stopId)===String(stopId));
      const isCompleted=String(remoteStop?.status||'').toUpperCase()==='COMPLETED';
      const isPendingSync=action?.status==='PENDING';
      const isBlocked=action?.status==='BLOCKED';
      const tag=isCompleted?'✓ Visita realizada':isPendingSync?'Visita pendiente de sincronizar':isBlocked?'Error de sincronización: revisar':isCurrent?'Siguiente parada':'Pendiente';
      const responsible=assignees.find(item=>String(item.id)===String(stateOf(b).assignedToId||''));
      const reorder=canManage?`<button type="button" title="Subir parada" aria-label="Subir ${esc(b.name)} una posición" onclick="moveRouteStop(${index},-1)">↑</button><button type="button" title="Bajar parada" aria-label="Bajar ${esc(b.name)} una posición" onclick="moveRouteStop(${index},1)">↓</button>`:'';
      const remove=canRemoveStops?`<button class="danger" type="button" title="Quitar parada" aria-label="Quitar ${esc(b.name)} de la ruta" onclick="removeRouteStop(${index})">×</button>`:'';
      const nearby=canManage?`<button class="route-stop-nearby" type="button" aria-label="Seleccionar puntos cercanos a ${esc(b.name)}" onclick="event.stopPropagation();beginRouteVicinity(${index})">＋ Seleccionar puntos cercanos</button>`:'';
      const membership=remoteRoutes.filter(route=>(route.stops||[]).some(stop=>String(stop.prospectId||stop.prospect?.id)===String(stateOf(b).remoteId||''))).map(route=>esc(route.name||'Ruta sin nombre')).join(', ')||'Aún no está en rutas guardadas';
      return `<div class="route-stop ${isCurrent?'current ':''}${isCompleted?'completed':''}" role="button" tabindex="0" aria-label="Centrar mapa en parada ${index+1}: ${esc(b.name)}" onclick="if(!event.target.closest('button'))focusRouteStop(${index})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();focusRouteStop(${index})}"><span class="route-number">${index+1}</span><div class="route-stop-copy"><b>${esc(b.name)}</b><span>${esc(b.address || b.zone || 'Dirección pendiente')}</span><span class="route-stop-tag">${tag}</span><span class="route-stop-assignment">Responsable del punto: ${esc(responsible?.name||stateOf(b).assignedToName||'Sin asignar')} · Responsable de la ruta: ${esc(routeAssigneeName||'Sin asignar')}</span><span class="route-stop-assignment">Rutas guardadas: ${membership}</span></div><div class="route-stop-actions">${reorder}${nearby}<button type="button" title="Abrir esta parada en Waze" aria-label="Abrir ${esc(b.name)} en Waze" onclick="event.stopPropagation();openRouteStop(${index})">W</button>${remove}</div></div>`;
    }).join('') : '<div class="history-empty">Empieza a marcar puntos comerciales en el mapa para agregarlos a la ruta.</div>';
  }
  const title=document.getElementById('routeTitle');
  const description=document.getElementById('routeDescription');
  const orderLockHint=document.getElementById('routeOrderLockHint');
  const routeDate=routeDateLabel(scheduledFor?.value || localRouteDate());
  if(title)title.textContent=activeRoute?'Seguimiento de ruta':'Planificar ruta comercial';
  const startIsPending=Boolean(activeRoute&&routeHasPendingStart(activeRoute.id));
  if(description)description.textContent=activeRoute
    ? `${routeBusinesses.length} paradas · ${routeDate} · ${activeStatus==='IN_PROGRESS'?'la ruta está en curso.':startIsPending?'inicio pendiente de sincronizar.':activeStatus==='COMPLETED'?'la ruta está finalizada.':activeStatus==='CANCELLED'?'la ruta está cancelada.':'ordena las paradas antes de iniciar.'}`
    : routeBusinesses.length ? `${routeBusinesses.length} paradas · ${routeDate} · el recorrido comienza en la primera parada.` : routePlanningMode ? 'Empieza a marcar los puntos comerciales pulsando sus marcadores en el mapa. Cada punto agregado aparecerá aquí.' : 'Activa “Armar ruta” y empieza a marcar los puntos comerciales en el mapa.';
  if(orderLockHint)orderLockHint.textContent=startIsPending
    ? 'El inicio está pendiente de sincronizar. La ruta y su orden están bloqueados en este dispositivo.'
    : activeStatus==='IN_PROGRESS'
      ? 'Ruta iniciada: línea verde continua hasta la parada más cercana y discontinua hacia la siguiente. Al marcar una visita, ambas se actualizan; sin GPS reciente se conserva el orden guardado.'
    : activeStatus==='COMPLETED'||activeStatus==='CANCELLED'
      ? 'Esta ruta ya terminó y su orden no se puede cambiar.'
      : activeRoute
        ? 'Antes de iniciar puedes subir o bajar las paradas y guardar los cambios. Durante la ruta, la línea continua va al punto pendiente más cercano y la discontinua al siguiente; después de cada visita se actualizan ambas.'
        : routeBusinesses.length
          ? 'Ajusta el orden con ↑ y ↓, guarda la ruta y luego iníciala desde el panel de seguimiento.'
          : 'Marca puntos en el mapa para agregarlos. Después podrás cambiar su orden antes de iniciar la ruta.';
  const vicinityHint=document.getElementById('routeVicinityHint');if(vicinityHint)vicinityHint.hidden=!canManage||!routeBusinesses.length;
  const transferCount=document.getElementById('routeTransferCount');
  const transferUnit=document.getElementById('routeTransferUnit');
  const transferAssignee=routeAssigneeDraftValue()??CURRENT_USER_ID??'';
  const transferAssigneeName=document.getElementById('routeTransferAssigneeName');
  const transferHelp=document.getElementById('routeTransferHelp');
  const transferEnabled=document.getElementById('routeTransferOwnership')?.checked===true;
  const selectedAssignee=assignees.find(item=>String(item.id)===String(transferAssignee));
  const hasRouteAssignee=transferAssignee!==''&&transferAssignee!==ROUTE_UNASSIGNED;
  const transferRecipientName=selectedAssignee?.name||(String(transferAssignee)===String(CURRENT_USER_ID)?CURRENT_USER_NAME:'Sin responsable');
  if(transferAssigneeName)transferAssigneeName.textContent=transferRecipientName;
  const transferCheckbox=document.getElementById('routeTransferOwnership');
  if(transferCheckbox){transferCheckbox.disabled=!hasRouteAssignee;if(!hasRouteAssignee)transferCheckbox.checked=false}
  const pendingTransferCount=routeBusinesses.filter(b=>String(stateOf(b).assignedToId||'')!==String(transferAssignee)).length;
  if(transferCount)transferCount.textContent=String(pendingTransferCount);
  if(transferUnit)transferUnit.textContent=pendingTransferCount===1?'punto':'puntos';
  if(transferHelp)transferHelp.textContent=transferEnabled?(pendingTransferCount?`Se transferirá el responsable de ${pendingTransferCount} ${pendingTransferCount===1?'punto':'puntos'} a ${transferRecipientName}.`:'No hay puntos con un responsable diferente para transferir.'):'Si no activas esta opción, cada punto conserva su responsable actual.';
  const offlineStatus=document.getElementById('routeOfflineStatus');
  if(offlineStatus)offlineStatus.hidden=navigator.onLine;
  const saveButton=document.getElementById('routeSave');
  if(saveButton){saveButton.disabled=routeSaving||!navigator.onLine||!routeBusinesses.length;saveButton.textContent=routeSaving?'Guardando…':activeRoute&&routeDraftDirty?'Guardar cambios':'Guardar ruta'}
  renderRouteActionFeedback();
  renderRouteMarkers();
  persistRoute();
  persistRouteDraft();
}
function routePointCoordinates(business){
  if(business?.lat===null||business?.lat===undefined||business?.lat===''||business?.lng===null||business?.lng===undefined||business?.lng==='')return false;
  const lat=Number(business.lat),lng=Number(business.lng);
  return Number.isFinite(lat)&&lat>=-90&&lat<=90&&Number.isFinite(lng)&&lng>=-180&&lng<=180;
}
function routeDistanceMeters(a,b){
  const rad=value=>Number(value)*Math.PI/180,lat1=rad(a.lat),lat2=rad(b.lat),dLat=lat2-lat1,dLng=rad(b.lng)-rad(a.lng);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
function selectRouteVicinityMatches(center,candidates,selectedKeys,mode,count,radiusMeters){
  const selected=new Set((selectedKeys||[]).map(value=>String(value))),centerKey=String(keyOf(center));
  const nearest=(Array.isArray(candidates)?candidates:[]).filter(b=>routePointCoordinates(b)&&!isDiscarded(b)&&!selected.has(String(keyOf(b)))&&String(keyOf(b))!==centerKey).map(b=>({business:b,distance:routeDistanceMeters(center,b)})).sort((a,b)=>a.distance-b.distance||String(keyOf(a.business)).localeCompare(String(keyOf(b.business))));
  const limit=Number(count);return mode==='radius'?nearest.filter(item=>item.distance<=radiusMeters):Number.isInteger(limit)&&limit>=1?nearest.slice(0,Math.min(500,limit)):[];
}
function toggleRouteVicinityKey(keys,key){
  const next=new Set(Array.from(keys||[],value=>String(value))),normalized=String(key);
  if(next.has(normalized))next.delete(normalized);else next.add(normalized);
  return next;
}
function routeVicinityIncludedMatches(candidates,excludedKeys){
  const excluded=new Set(Array.from(excludedKeys||[],value=>String(value)));
  return (Array.isArray(candidates)?candidates:[]).filter(item=>!excluded.has(String(keyOf(item?.business))));
}
function toggleRouteVicinityCandidate(key,restoreFocus=false){
  if(!routeVicinityPreview)return;
  const list=document.getElementById('routeVicinityCandidates'),scrollTop=list.scrollTop;
  routeVicinityPreview.excludedKeys=toggleRouteVicinityKey(routeVicinityPreview.excludedKeys,key);
  renderRouteVicinityPreview();list.scrollTop=scrollTop;
  if(restoreFocus){const checkbox=Array.from(list.querySelectorAll('input[data-vicinity-key]')).find(input=>input.dataset.vicinityKey===String(key));checkbox?.focus({preventScroll:true})}
}
function clearRouteVicinityPreview(){
  routeVicinityMarkers.forEach(marker=>setNovaMarkerMap(marker,null));routeVicinityMarkers=[];
  routeVicinityCircle?.setMap(null);routeVicinityCircle=null;routeVicinityPreview=null;
  document.getElementById('routeVicinityTools').hidden=true;document.getElementById('routeVicinityCandidates').innerHTML='';document.getElementById('routeVicinityCandidates').hidden=true;document.getElementById('routeVicinityAdjustHint').hidden=true;
}
function renderRouteVicinityPreview(){
  if(!routeVicinityPreview)return;
  routeVicinityMarkers.forEach(marker=>setNovaMarkerMap(marker,null));routeVicinityMarkers=[];
  routeVicinityCircle?.setMap(null);routeVicinityCircle=null;
  const center=routeVicinityPreview.center;
  const mode=document.getElementById('routeVicinityMode').value,radiusInput=document.getElementById('routeVicinityRadius'),rawRadius=Number(radiusInput.value),radiusUnit=document.getElementById('routeVicinityRadiusUnit').value,radiusFactor=radiusUnit==='km'?1000:1,validRadius=Number.isFinite(rawRadius)&&rawRadius>0&&rawRadius*radiusFactor<=50000,radiusMeters=validRadius?rawRadius*radiusFactor:0,rawCount=Number(document.getElementById('routeVicinityCount').value),validCount=Number.isInteger(rawCount)&&rawCount>=1&&rawCount<=500,count=validCount?rawCount:0;
  const matches=mode==='count'&&!validCount?[]:selectRouteVicinityMatches(center,Array.isArray(filtered)?filtered:[],routeBusinesses.map(keyOf),mode,count,radiusMeters);
  const excludedKeys=routeVicinityPreview.excludedKeys||new Set(),includedMatches=routeVicinityIncludedMatches(matches,excludedKeys),includedKeys=new Set(includedMatches.map(item=>String(keyOf(item.business))));
  routeVicinityPreview.candidates=matches;routeVicinityPreview.items=includedMatches.map(item=>item.business);
  document.getElementById('routeVicinityCountWrap').hidden=mode!=='count';document.getElementById('routeVicinityRadiusWrap').hidden=mode!=='radius';
  const candidateList=document.getElementById('routeVicinityCandidates'),adjustHint=document.getElementById('routeVicinityAdjustHint');
  candidateList.hidden=!matches.length;adjustHint.hidden=!matches.length;
  candidateList.innerHTML=matches.map(({business,distance})=>{
    const key=String(keyOf(business)),included=includedKeys.has(key),distanceLabel=distance<1000?String(Math.round(distance))+' m':String(Number((distance/1000).toFixed(2)))+' km';
    const checkAttributes=included?'checked':'',statusLabel=included?'Se agregará':'No se agregará';
    return '<label class="route-vicinity-candidate"><input type="checkbox" data-vicinity-key="'+esc(key)+'" aria-label="'+(included?'Quitar':'Incluir')+' '+esc(business.name||'punto')+' '+(included?'de':'en')+' la selección" '+checkAttributes+'><span class="route-vicinity-candidate-copy"><b>'+esc(business.name||'Punto sin nombre')+'</b><small>'+distanceLabel+' del centro · '+statusLabel+'</small></span></label>';
  }).join('');
  const summary=document.getElementById('routeVicinitySummary'),addButton=document.getElementById('routeVicinityAdd'),radiusLabel=radiusMeters<1000?`${radiusMeters} m`:`${Number((radiusMeters/1000).toFixed(2))} km`;
  summary.textContent=mode==='count'?(!validCount?'Ingresa una cantidad de 1 a 500 puntos.':!matches.length?'No hay más puntos disponibles con los filtros y capas actuales.':includedMatches.length?'Se agregarán '+includedMatches.length+' de '+matches.length+' puntos elegibles más cercanos a '+center.name+'.':'Hay '+matches.length+' candidatos, pero ninguno está marcado para agregar.'):!validRadius?'Ingresa un radio mayor que 0 y de hasta 50 km.':!matches.length?'No hay puntos elegibles dentro de '+radiusLabel+'. Prueba con un radio mayor.':includedMatches.length?'Se agregarán '+includedMatches.length+' de '+matches.length+' puntos dentro de '+radiusLabel+' de '+center.name+'.':'Hay '+matches.length+' candidatos dentro de '+radiusLabel+', pero ninguno está marcado para agregar.';
  if(mode==='radius'&&validRadius&&window.google?.maps?.Circle&&googleMap)routeVicinityCircle=new google.maps.Circle({map:googleMap,center:{lat:Number(center.lat),lng:Number(center.lng)},radius:radiusMeters,fillColor:'#08785a',fillOpacity:.09,strokeColor:'#08785a',strokeOpacity:.75,strokeWeight:2,clickable:false,zIndex:1090});
  addButton.disabled=!includedMatches.length;addButton.textContent=includedMatches.length?'Agregar '+includedMatches.length+' punto'+(includedMatches.length===1?'':'s'):'Selecciona puntos';
  matches.forEach(({business})=>{
    const key=String(keyOf(business)),included=includedKeys.has(key),el=document.createElement('div');el.className='nova-route-marker route-vicinity-marker'+(included?'':' route-vicinity-marker-excluded');el.textContent=included?'✓':'×';
    const marker=createMapMarker({map:googleMap,position:{lat:Number(business.lat),lng:Number(business.lng)},title:(included?'Incluido: ':'Excluido: ')+business.name+(included?'. Pulsa para quitarlo.':'. Pulsa para incluirlo.'),zIndex:1120,content:el});
    const toggle=event=>{event?.stopPropagation?.();event?.domEvent?.stopPropagation?.();toggleRouteVicinityCandidate(key)};
    if(typeof marker.addEventListener==='function')marker.addEventListener('gmp-click',toggle);else marker.addListener?.('click',toggle);
    routeVicinityMarkers.push(marker);
  });
}
function beginRouteVicinity(index){
  if(!canEditRouteComposition())return;
  const center=routeBusinesses[index];if(!center||!routePointCoordinates(center))return;
  routeVicinityPreview={center,items:[]};document.getElementById('routeVicinityTitle').textContent=`Seleccionar puntos cercanos a ${center.name||'esta parada'}`;const tools=document.getElementById('routeVicinityTools');tools.hidden=false;renderRouteVicinityPreview();
  if(googleMap){googleMap.panTo({lat:Number(center.lat),lng:Number(center.lng)});if((googleMap.getZoom()||0)<14)googleMap.setZoom(14)}
  tools.scrollIntoView?.({behavior:'smooth',block:'nearest'});document.getElementById('routeVicinityMode').focus({preventScroll:true});
}
function addRouteVicinityPoints(){
  if(!canEditRouteComposition()||!routeVicinityPreview||!routeVicinityPreview.items.length||!requireForceSales(routeManageAction()))return;
  const present=new Set(routeBusinesses.map(keyOf)),added=routeVicinityPreview.items.filter(b=>!present.has(keyOf(b))&&routePointCoordinates(b));
  routeBusinesses.push(...added);clearRouteVicinityPreview();markRouteDraftChanged();renderRoutePlanner();toast(`${added.length} punto(s) cercano(s) agregado(s)`);
}
function toggleRouteBusiness(business){
  if(!routePlanningMode)return;
  if(activeRemoteRouteId&&!canEditRouteComposition()){toast('La ruta ya inició y sus paradas quedaron bloqueadas');return}
  if(!requireForceSales(routeManageAction()))return;
  if(!routePointCoordinates(business)){toast('Este punto no tiene coordenadas válidas. Corrige su ubicación antes de agregarlo.');return}
  const key=keyOf(business),index=routeBusinesses.findIndex(item=>keyOf(item)===key);
  if(index>=0){routeBusinesses.splice(index,1);if(index<routeProgress)routeProgress=Math.max(0,routeProgress-1);toast('Punto retirado del borrador')}
  else{routeBusinesses.push(business);toast(`Punto marcado · parada ${routeBusinesses.length} agregada a la ruta`)}
  markRouteDraftChanged();renderRoutePlanner();
}
