function setGpsIndicator(state,accuracy=null){
  const button=document.getElementById('locateMe');
  if(!button)return;
  if(gpsIndicatorTimer){clearTimeout(gpsIndicatorTimer);gpsIndicatorTimer=null}
  button.classList.remove('gps-pending','gps-good','gps-weak');
  if(state==='idle'){
    button.setAttribute('aria-label','Mi ubicación');
    button.title='Mi ubicación';
    return;
  }
  button.classList.add(`gps-${state}`);
  const meters=Number(accuracy);
  const accuracyText=Number.isFinite(meters)&&meters>=0?` Precisión aproximada: ±${Math.round(meters)} metros.`:'';
  const label=state==='pending'?'Buscando señal GPS.':state==='good'?`GPS activo; ubicación precisa.${accuracyText}`:`Ubicación recibida; falta mejorar la precisión.${accuracyText}`;
  button.setAttribute('aria-label',`Mi ubicación. ${label}`);
  button.title=label;
  gpsIndicatorTimer=window.setTimeout(()=>setGpsIndicator('idle'),state==='pending'?12000:15000);
}
function showUserLocation(position){
  const coords=position?.coords || position;
  const capturedAt=Number(position?.timestamp);
  const coordinates=window.NovaForceSalesLocation.normalizeCoordinates(coords);
  if(!coordinates||!Number.isFinite(capturedAt)||!window.NovaForceSalesLocation.isFreshLocationTimestamp(capturedAt)){
    setGpsIndicator('idle');
    return false;
  }
  if(lastKnownCoords&&capturedAt<=Date.parse(lastKnownCoords.capturedAt))return false;
  const activeRoute=activeRemoteRoute();
  const previousNextStopId=activeRoute?nextPendingRouteStop(activeRoute)?.prospectId:null;
  if(!userLocationMarker){
    const locationContent=document.createElement('div');
    locationContent.className='nova-user-location-marker';
    locationContent.setAttribute('aria-label','Mi ubicación');
    userLocationMarker=createMapMarker({map:googleMap,title:'Mi ubicación',zIndex:1200,content:locationContent});
    userLocationCircle=new google.maps.Circle({map:googleMap,fillColor:'#08785a',fillOpacity:.12,strokeColor:'#08785a',strokeOpacity:.55,strokeWeight:1.5,clickable:false});
  }
  lastKnownCoords={latitude:coordinates.lat,longitude:coordinates.lng,accuracy:coords.accuracy,heading:coords.heading,capturedAt:new Date(capturedAt).toISOString()};
  const accuracy=Number(coords.accuracy);
  setGpsIndicator(Number.isFinite(accuracy)&&accuracy>=0&&accuracy<=50?'good':'weak',coords.accuracy);
  const markerPosition={lat:coordinates.lat,lng:coordinates.lng};
  userLocationMarker.setPosition(markerPosition);
  userLocationCircle?.setCenter(markerPosition);
  userLocationCircle?.setRadius(Math.max(18,Math.min(Number(coords.accuracy)||40,160)));
  presenceWatchRequested=canForceSales('updatePresence');
  startPresenceWatch();
  void syncSellerPresence(lastKnownCoords,lastKnownCoords.capturedAt);
  const nextStopChanged=Boolean(activeRoute&&String(nextPendingRouteStop(activeRoute)?.prospectId||'')!==String(previousNextStopId||''));
  if(nextStopChanged)renderRoutePlanner();
  scheduleActiveRouteMapRefresh(nextStopChanged);
  return true;
}
function presenceRouteLabel(row){
  const name=String(row?.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const routeNumber=name.match(/\bruta\s*(?:n(?:um(?:ero)?|ro|o)?\s*)?[#.:º°-]*\s*(\d+)\b/i)?.[1];
  if(routeNumber)return `R${Number(routeNumber)}`;
  const initials=String(row?.initials||'').trim().toLocaleUpperCase('es-NI');
  const initialsNumber=initials.match(/^R0*(\d+)$/)?.[1];
  return initialsNumber?`R${Number(initialsNumber)}`:'';
}
function presenceContent(row){
  const wrapper=document.createElement('div');
  wrapper.className=`nova-presence-marker${row.isOnline===false?' stale':''}`;
  wrapper.style.width='44px';wrapper.style.height='44px';
  wrapper.title=row.name || 'Vendedor';
  const routeLabel=presenceRouteLabel(row);
  if(routeLabel){
    wrapper.textContent=routeLabel;
    wrapper.setAttribute('aria-label',`${row.name||routeLabel} · ${routeLabel}`);
  }else if(row.avatar){
    const image=document.createElement('img');
    image.src=String(row.avatar);
    image.alt=row.name || 'Vendedor';
    image.addEventListener('error',()=>{image.remove();wrapper.textContent=row.initials || 'V'}, {once:true});
    wrapper.appendChild(image);
  }else{
    wrapper.textContent=row.initials || 'V';
  }
  return wrapper;
}
function presencePopupContent(row){
  const current=row.currentClient?.name ? `<b>Cliente actual:</b> ${esc(row.currentClient.name)}` : '<b>Cliente actual:</b> Sin cliente activo';
  const last=row.lastClient?.name ? `<b>Último cliente:</b> ${esc(row.lastClient.name)}` : '<b>Último cliente:</b> Sin visita registrada';
  const online=row.isOnline!==false;
  const presenceLabel=online?'En línea':'Sin conexión';
  const gpsLabel=row.gpsStatus==='recent'?'GPS reciente':row.gpsStatus==='stale'?'Sin lectura GPS reciente':'GPS sin confirmar';
  const gpsTime=row.gpsCapturedAt?` · captura ${new Date(row.gpsCapturedAt).toLocaleString('es-NI',{dateStyle:'short',timeStyle:'short'})}`:'';
  const routeLabel=presenceRouteLabel(row);
  const markerContent=routeLabel?esc(routeLabel):row.avatar?`<img src="${esc(row.avatar)}" alt="${esc(row.name||'Colaborador')}">`:esc(row.initials||'V');
  return `<div style="min-width:220px;padding:4px 2px;font:12px Poppins,Arial,sans-serif;color:#123f35"><div style="display:flex;align-items:center;gap:9px;margin-bottom:8px"><div class="nova-presence-marker${online?'':' stale'}" style="width:42px;height:42px;flex:0 0 auto">${markerContent}</div><div><h3 style="margin:0;font-size:14px">${esc(row.name||'Colaborador')}</h3><span style="color:#687a73;font-size:10px">${esc(row.email||'')} · ${esc(row.role||'')}</span></div></div><div style="display:grid;gap:5px;font-size:10px"><div><b>Presencia:</b> ${presenceLabel}</div><div><b>GPS:</b> ${gpsLabel}${esc(gpsTime)}</div><div><b>Actividad:</b> ${esc(row.currentActivity||'Disponible')}</div><div>${current}</div><div>${last}</div><div style="color:#687a73">Última actualización del servidor ${new Date(row.lastSeenAt).toLocaleString('es-NI',{dateStyle:'short',timeStyle:'short'})}</div></div></div>`;
}
function openPresenceDetails(row,anchor){
  presenceClusterListOpen=false;
  presenceClusterListGroupKey=null;
  closeBusinessDetailPopup();
  infoWindow.setContent(presencePopupContent(row));
  try{infoWindow.open({map:googleMap,anchor})}catch(error){infoWindow.open(googleMap,anchor)}
  nativeInfoWindowOpen=true;
}
function createPresenceClusterContent(count){
  const badge=document.createElement('div');
  badge.className='nova-presence-cluster-marker';
  badge.setAttribute('role','img');
  badge.setAttribute('aria-label',`${count} usuarios; abrir grupo`);
  badge.textContent=String(count);
  Object.assign(badge.style,{width:'44px',height:'44px',display:'grid',placeItems:'center',border:'3px solid #fff',borderRadius:'50%',background:'#123f35',color:'#fff',boxShadow:'0 4px 14px rgba(12,53,43,.35)',font:'900 14px/1 Poppins,Arial,sans-serif',pointerEvents:'none'});
  return badge;
}
function clearPresenceClusterLines(){
  presenceClusterLines.forEach(line=>line.setMap(null));
  presenceClusterLines.clear();
}
function setPresenceMarkerPosition(marker,position){
  if(marker&&position)marker.setPosition({lat:Number(position.lat),lng:Number(position.lng)});
}
function presenceClusterListContent(groupMarker){
  const container=document.createElement('div');
  container.className='nova-presence-cluster-list';
  Object.assign(container.style,{width:'min(300px,70vw)',maxHeight:'min(360px,60vh)',overflowY:'auto',padding:'4px',fontFamily:'Poppins,Arial,sans-serif',color:'#123f35'});
  const heading=document.createElement('strong');
  heading.textContent=`${groupMarker._presenceGroup.rows.length} usuarios en esta ubicación`;
  Object.assign(heading.style,{display:'block',padding:'6px 8px',fontSize:'12px'});
  container.appendChild(heading);
  groupMarker._presenceGroup.rows.forEach(entry=>{
    const row=entry._presenceRow;
    const button=document.createElement('button');
    button.type='button';
    button.className='nova-presence-list-item';
    button.setAttribute('aria-label',`Abrir ${row.name||'Colaborador'}, ${row.isOnline===false?'sin conexión':'en línea'}, ${row.gpsStatus==='recent'?'GPS reciente':row.gpsStatus==='stale'?'sin lectura GPS reciente':'GPS sin confirmar'}`);
    Object.assign(button.style,{display:'flex',width:'100%',minHeight:'52px',alignItems:'center',gap:'10px',padding:'6px 8px',border:'0',borderRadius:'8px',background:'transparent',textAlign:'left',cursor:'pointer',font:'inherit'});
    const avatar=presenceContent(row);
    avatar.style.width='38px';avatar.style.height='38px';avatar.style.flex='0 0 38px';
    button.appendChild(avatar);
    const details=document.createElement('span');
    details.style.cssText='display:grid;min-width:0;gap:3px';
    const name=document.createElement('b');name.textContent=String(row.name||'Colaborador');name.style.cssText='overflow-wrap:anywhere;font-size:11px';
    const status=document.createElement('span');status.textContent=`${row.isOnline===false?'Sin conexión':'En línea'} · ${row.gpsStatus==='recent'?'GPS reciente':row.gpsStatus==='stale'?'sin lectura GPS reciente':'GPS sin confirmar'}`;status.style.cssText='color:#687a73;font-size:9px';
    details.append(name,status);button.appendChild(details);
    button.addEventListener('focus',()=>button.style.background='#eaf4ef');
    button.addEventListener('blur',()=>button.style.background='transparent');
    button.addEventListener('click',()=>openPresenceDetails(row,groupMarker));
    container.appendChild(button);
  });
  return container;
}
function openPresenceClusterList(groupMarker){
  presenceClusterListOpen=true;
  presenceClusterListGroupKey=groupMarker?._presenceGroup?.key||null;
  closeBusinessDetailPopup();
  infoWindow.setContent(presenceClusterListContent(groupMarker));
  try{infoWindow.open({map:googleMap,anchor:groupMarker})}catch(error){infoWindow.open(googleMap,groupMarker)}
  nativeInfoWindowOpen=true;
}
function showPresenceCluster(groupMarker){
  const group=groupMarker?._presenceGroup;
  if(!group)return;
  if(group.rows.length>8){expandedPresenceClusterKey=null;renderPresenceClusters();openPresenceClusterList(groupMarker);return}
  if(expandedPresenceClusterKey===group.key){expandedPresenceClusterKey=null;renderPresenceClusters();return}
  expandedPresenceClusterKey=group.key;
  presenceClusterListOpen=false;
  renderPresenceClusters();
}
function renderPresenceClusters(){
  presenceMarkers.forEach(marker=>setPresenceMarkerPosition(marker,marker._gpsPosition));
  clearPresenceClusterLines();
  if(activeView!=='map'||!mapLayers.users){
    presenceClusterMarkers.forEach(marker=>setNovaMarkerMap(marker,null));
    expandedPresenceClusterKey=null;
    if(presenceClusterListOpen){presenceClusterListOpen=false;presenceClusterListGroupKey=null;infoWindow.close()}
    return;
  }
  const entries=[...presenceMarkers.values()].filter(marker=>marker._presenceRow&&marker._gpsPosition).map(marker=>({
    ...marker._presenceRow,
    _presenceRow:marker._presenceRow,
    _presencePosition:marker._gpsPosition,
    _presenceMarker:marker,
  }));
  const groups=window.NovaForceSalesLocation.clusterPresenceRows(entries,row=>projectPresencePosition(row._presencePosition),44);
  const activeGroupKeys=new Set(groups.map(group=>group.key));
  if(expandedPresenceClusterKey&&!activeGroupKeys.has(expandedPresenceClusterKey))expandedPresenceClusterKey=null;
  if(presenceClusterListOpen&&presenceClusterListGroupKey&&!activeGroupKeys.has(presenceClusterListGroupKey)){
    presenceClusterListOpen=false;
    presenceClusterListGroupKey=null;
    infoWindow.close();
  }
  presenceClusterMarkers.forEach((marker,key)=>{if(!activeGroupKeys.has(key)){setNovaMarkerMap(marker,null);presenceClusterMarkers.delete(key)}});
  const clusteredIds=new Set(groups.flatMap(group=>group.rows.map(row=>String(row.userId))));
  presenceMarkers.forEach((marker,id)=>setNovaMarkerMap(marker,clusteredIds.has(String(id))?null:googleMap));
  groups.forEach(group=>{
    const groupPosition=unprojectPresencePosition(group.center.x,group.center.y);
    if(!groupPosition){group.rows.forEach(row=>setNovaMarkerMap(row._presenceMarker,googleMap));return}
    let groupMarker=presenceClusterMarkers.get(group.key);
    if(!groupMarker){
      const clusterContent=createPresenceClusterContent(group.rows.length);
      groupMarker=createMapMarker({position:groupPosition,title:`${group.rows.length} usuarios superpuestos; abrir grupo`,content:clusterContent,zIndex:1450});
      groupMarker._clusterContent=clusterContent;
      groupMarker._presenceGroup=group;
      const open=()=>showPresenceCluster(groupMarker);
      if(typeof groupMarker.addEventListener==='function')groupMarker.addEventListener('gmp-click',open);else groupMarker.addListener?.('click',open);
      presenceClusterMarkers.set(group.key,groupMarker);
    }
    groupMarker._presenceGroup=group;
    groupMarker.title=`${group.rows.length} usuarios superpuestos; abrir grupo`;
    groupMarker._clusterContent.textContent=String(group.rows.length);
    groupMarker._clusterContent.setAttribute('aria-label',`${group.rows.length} usuarios; abrir grupo`);
    groupMarker.setPosition(groupPosition);
    if(expandedPresenceClusterKey!==group.key){setNovaMarkerMap(groupMarker,googleMap);return}
    setNovaMarkerMap(groupMarker,null);
    if(group.rows.length>8){setNovaMarkerMap(groupMarker,googleMap);return}
    const mapElement=document.getElementById('map');
    const spread=window.NovaForceSalesLocation.spreadPresenceRows(group,{width:Number(mapElement?.clientWidth)||0,height:Number(mapElement?.clientHeight)||0});
    const displayPoints=spread.fits?group.rows.map((row,index)=>{
      const point=unprojectPresencePosition(spread.positions[index].x,spread.positions[index].y);
      return point?{row,point}:null;
    }):[];
    if(!spread.fits||displayPoints.some(item=>!item)){
      setNovaMarkerMap(groupMarker,googleMap);
      if(!presenceClusterListOpen)openPresenceClusterList(groupMarker);
      return;
    }
    displayPoints.forEach(({row,point})=>{
      setPresenceMarkerPosition(row._presenceMarker,point);
      setNovaMarkerMap(row._presenceMarker,googleMap);
      const line=new google.maps.Polyline({map:googleMap,path:[row._presencePosition,point],strokeColor:'#2364d2',strokeOpacity:.72,strokeWeight:2,clickable:false,zIndex:1200});
      presenceClusterLines.set(String(row.userId),line);
    });
  });
}
function closeExpandedPresenceCluster(){
  if(!expandedPresenceClusterKey&&!presenceClusterListOpen)return;
  const closeList=presenceClusterListOpen;
  pendingPresenceClosePointer=null;
  expandedPresenceClusterKey=null;
  presenceClusterListOpen=false;
  presenceClusterListGroupKey=null;
  if(closeList)infoWindow.close();
  renderPresenceClusters();
}
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeExpandedPresenceCluster()});
document.addEventListener('pointerdown',event=>{
  if(!expandedPresenceClusterKey&&!presenceClusterListOpen)return;
  if(event.target?.closest?.('.nova-presence-cluster-marker,.nova-presence-marker,.nova-presence-cluster-list,.gm-style-iw,.leaflet-popup-content')){pendingPresenceClosePointer=null;return}
  pendingPresenceClosePointer={pointerId:event.pointerId,x:event.clientX,y:event.clientY};
});
document.addEventListener('pointerup',event=>{
  const pending=pendingPresenceClosePointer;
  if(!pending||pending.pointerId!==event.pointerId)return;
  pendingPresenceClosePointer=null;
  if(Math.hypot(event.clientX-pending.x,event.clientY-pending.y)<=8)closeExpandedPresenceCluster();
});
document.addEventListener('pointercancel',()=>{pendingPresenceClosePointer=null});
function renderPresence(rows,gpsCaptures=recentGpsCapturesByUser){
  if(gpsCaptures instanceof Map)recentGpsCapturesByUser=gpsCaptures;
  const historyAvailable=gpsCaptures instanceof Map;
  const activeIds=new Set();
  (Array.isArray(rows)?rows:[]).forEach(row=>{
    const lat=Number(row.lat); const lng=Number(row.lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
    const id=String(row.userId);
    const gpsCapturedAt=historyAvailable?gpsCaptures.get(id)||null:null;
    const mapRow={...row,gpsCapturedAt,gpsStatus:window.NovaForceSalesLocation.presenceGpsState({capturedAt:gpsCapturedAt,now:Date.now(),historyAvailable})};
    activeIds.add(id);
    const title=(row.name || 'Vendedor') + (row.isOnline===false?' · presencia sin conexión':' · presencia en línea') + (mapRow.gpsStatus==='recent'?' · GPS reciente':mapRow.gpsStatus==='stale'?' · sin lectura GPS reciente':' · GPS sin confirmar') + ' · ' + new Date(row.lastSeenAt).toLocaleTimeString('es-NI',{hour:'2-digit',minute:'2-digit'});
    let marker=presenceMarkers.get(id);
    if(marker){
      marker._presenceRow=mapRow;
      marker._gpsPosition={lat,lng};
      marker.setPosition({lat,lng});
      marker.title=title;
      const avatarKey=String(row.avatar || '');
      if(marker._avatarKey!==avatarKey){marker.content=presenceContent(row);marker._avatarKey=avatarKey}
      setNovaMarkerMap(marker,googleMap);
    }else{
      marker=createMapMarker({map:googleMap,position:{lat,lng},title,content:presenceContent(row),zIndex:1300});
      marker._avatarKey=String(row.avatar || '');
      marker._presenceRow=mapRow;
      marker._gpsPosition={lat,lng};
      const openPresence=()=>openPresenceDetails(marker._presenceRow||row,marker);
      marker._openPresence=openPresence;
      if(typeof marker.addEventListener==='function')marker.addEventListener('gmp-click',openPresence);else marker.addListener?.('click',openPresence);
      presenceMarkers.set(id,marker);
    }
  });
  presenceMarkers.forEach((marker,id)=>{if(!activeIds.has(id)){setNovaMarkerMap(marker,null);presenceMarkers.delete(id)}});
  updateMapLayerVisibility();
}
function shouldLoadLocationTrail(){return CAN_ASSIGN_TEAM&&((activeView==='map'&&mapLayers.gpsTrail)||activeView==='history')}
function persistMapLayers(){
  try{localStorage.setItem(MAP_LAYERS_STORAGE_KEY,JSON.stringify(mapLayers))}
  catch(error){console.warn('No se pudieron guardar las capas del mapa',error)}
}
function trailUsers(points=currentLocationTrailData?.originalPoints||[]){
  const users=new Map();
  assignees.filter(item=>item?.id&&item?.isActive!==false).forEach(item=>users.set(String(item.id),String(item.name||item.email||'Usuario')));
  (Array.isArray(points)?points:[]).forEach(point=>{if(point?.userId)users.set(String(point.userId),String(point.userName||users.get(String(point.userId))||'Usuario'))});
  return [...users].sort((a,b)=>a[1].localeCompare(b[1]));
}
function syncTrailUserSelect(select){
  if(!select)return;
  const selected=String(select.value||'');
  const options=trailUsers().map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('');
  select.innerHTML=`<option value="">Todos los usuarios</option>${options}`;
  if([...select.options].some(option=>option.value===selected))select.value=selected;
}
function updateMapStyleNotice(){
  const notice=document.getElementById('mapStyleNotice');
  if(!notice)return;
  if(MAP_PROVIDER==='OPENSTREETMAP'||MAP_PROVIDER==='CUSTOM'){
    notice.textContent='Los nombres e iconos vienen dentro de los mosaicos de este proveedor y no se pueden apagar individualmente desde NovaHub.';
    return;
  }
  if(!CAN_TOGGLE_BASE_PLACES){
    notice.textContent='Para activar este interruptor, configura VITE_GOOGLE_MAPS_CLEAN_MAP_ID con un segundo Map ID y publica en Google Cloud un estilo que oculte Puntos de interés.';
    return;
  }
  notice.textContent=mapLayers.basePlaces
    ? 'Lugares de Google visibles. Desactívalos para dejar solo los elementos de NovaHub que estén activos.'
    : 'Lugares de Google ocultos. El mapa conserva calles y barrios junto con las capas de NovaHub activas.';
}
function updateMapLayerControls(){
  const basePlacesLabel=document.getElementById('basePlacesLayerLabel');
  if(basePlacesLabel)basePlacesLabel.hidden=MAP_PROVIDER!=='GOOGLE';
  document.querySelectorAll('[data-map-layer]').forEach(input=>{
    input.checked=input.dataset.mapLayer==='basePlaces'&&!CAN_TOGGLE_BASE_PLACES?true:Boolean(mapLayers[input.dataset.mapLayer]);
    if(input.dataset.mapLayer==='basePlaces')input.disabled=!CAN_TOGGLE_BASE_PLACES;
  });
  const gpsLabel=document.getElementById('gpsTrailLayerLabel');
  const gpsControls=document.getElementById('gpsTrailControls');
  if(gpsLabel)gpsLabel.hidden=!CAN_ASSIGN_TEAM;
  if(gpsControls)gpsControls.hidden=!CAN_ASSIGN_TEAM||!mapLayers.gpsTrail;
  syncBusinessLabelControls();
  syncTrailUserSelect(document.getElementById('mapTrailUser'));
  updateMapStyleNotice();
}
function updateMapLayerVisibility(){
  presenceMarkers.forEach(marker=>setNovaMarkerMap(marker,mapLayers.users?googleMap:null));
  renderPresenceClusters();
  routePolyline?.setMap(mapLayers.plannedRoutes?googleMap:null);
  routePreviewPolyline?.setMap(mapLayers.plannedRoutes?googleMap:null);
  routeStopMarkers.forEach(marker=>setNovaMarkerMap(marker,routePlanningMode||mapLayers.plannedRoutes?googleMap:null));
}
function saveMapCameraForReload(){
  const center=googleMap.getCenter?.();
  const coordinates=typeof center?.toJSON==='function'?center.toJSON():{lat:Number(typeof center?.lat==='function'?center.lat():center?.lat),lng:Number(typeof center?.lng==='function'?center.lng():center?.lng)};
  const zoom=Number(googleMap.getZoom?.());
  if(!Number.isFinite(coordinates.lat)||!Number.isFinite(coordinates.lng)||!Number.isFinite(zoom))return;
  try{sessionStorage.setItem(MAP_RELOAD_CAMERA_KEY,JSON.stringify({center:coordinates,zoom}))}catch{}
}
function setMapLayer(name,enabled){
  if(!['users','manualPoints','catalog','plannedRoutes','gpsTrail','basePlaces'].includes(name))return;
  if(name==='basePlaces'){
    if(!CAN_TOGGLE_BASE_PLACES){updateMapLayerControls();return}
    mapLayers={...mapLayers,basePlaces:Boolean(enabled)};
    persistMapLayers();
    saveMapCameraForReload();
    location.reload();
    return;
  }
  if(name==='gpsTrail'&&!CAN_ASSIGN_TEAM){updateMapLayerControls();return}
  const next={...mapLayers,[name]:Boolean(enabled)};
  mapLayers=next;
  persistMapLayers();
  updateMapLayerControls();
  updateMapLayerVisibility();
  if(name==='users'&&mapLayers.users)void loadSellerPresence();
  if(name==='gpsTrail'){
    if(mapLayers.gpsTrail){
      if(!document.getElementById('mapTrailDate')?.value)document.getElementById('mapTrailDate').value=localDateInputValue();
      void loadLocationTrail({fitCamera:false});
    }else{
      locationTrailRequestId++;
      locationTrailRefreshRequested=false;
      currentLocationTrailData=null;
      clearLocationTrail();
      const status=document.getElementById('mapTrailStatus');
      if(status)status.textContent='Activa Recorrido GPS para consultar posiciones guardadas.';
    }
  }
  render();
}
function resetCleanMap(){
  const previousBasePlaces=mapLayers.basePlaces;
  mapLayers=window.NovaForceSalesLocation.normalizeMapLayers({},MODE_LAYER_DEFAULTS);
  labelMode=mapLayers.labelMode;
  persistMapLayers();
  selectedZone='Todos';pipelineFilter='all';activeNearbyCenter=null;activeNearbyRadius=null;activeView='map';
  const search=document.getElementById('search');if(search)search.value='';
  zonesVisible=false;clearZonePolygons();
  locationTrailRequestId++;locationTrailRefreshRequested=false;currentLocationTrailData=null;clearLocationTrail();
  const status=document.getElementById('mapTrailStatus');if(status)status.textContent='Activa Recorrido GPS para consultar posiciones guardadas.';
  updateMapLayerControls();updateMapLayerVisibility();populateFilters();render();
  if(CAN_TOGGLE_BASE_PLACES&&previousBasePlaces!==mapLayers.basePlaces){saveMapCameraForReload();location.reload()}
}
function openMapLayers(){
  const panel=document.getElementById('mapLayersPanel');
  if(!panel)return;
  const moreTools=document.getElementById('moreToolsPanel');
  if(moreTools)moreTools.open=true;
  panel.open=true;
  if(innerWidth<=820){document.getElementById('sheet')?.classList.remove('collapsed');window.setTimeout(()=>panel.scrollIntoView({block:'nearest',behavior:'smooth'}),80)}
  document.getElementById('openMapLayers')?.closest('details')?.removeAttribute('open');
}
function stopPresenceWatch(){
  if(presenceWatchId===null)return;
  navigator.geolocation?.clearWatch(presenceWatchId);
  presenceWatchId=null;
}
function startPresenceWatch(){
  if(EXTERNAL_DURABLE_TRACKING||!canForceSales('updatePresence')||!presenceWatchRequested||!presenceSharingEnabled||presenceWatchId!==null||!navigator.geolocation)return;
  presenceWatchId=navigator.geolocation.watchPosition(
    position=>showUserLocation(position),
    error=>console.warn('No se pudo actualizar la ubicación en vivo',error),
    {enableHighAccuracy:false,maximumAge:15000,timeout:20000}
  );
}
async function loadSellerPresence(){
  if(activeView!=='map'||document.visibilityState!=='visible'||!localStorage.getItem('nh-auth-token')||presenceRequestInFlight)return;
  presenceRequestInFlight=true;
  try{
    const presence=await forceSalesRequest('/force-sales/presence');
    let gpsCaptures=null;
    try{gpsCaptures=await loadRecentGpsCaptures()}catch(error){console.warn('No se pudo confirmar la frescura GPS de presencia',error)}
    renderPresence(presence,gpsCaptures);
    forceSalesSyncErrors.delete('presencia');
    updateOfflineStatus();
  }catch(error){
    console.warn('No se pudo actualizar la presencia comercial',error);
    setForceSalesSyncError('presencia',error);
  }
  finally{presenceRequestInFlight=false}
}
async function loadRecentGpsCaptures(){
  if(recentGpsCapturesInFlight)return recentGpsCapturesInFlight;
  if(Date.now()-recentGpsCapturesRequestedAt<15000)return recentGpsCapturesByUser;
  recentGpsCapturesRequestedAt=Date.now();
  recentGpsCapturesInFlight=(async()=>{
    const now=Date.now();
    const from=new Date(now-90000).toISOString();
    const to=new Date(now).toISOString();
    const captures=new Map();
    let cursor='';
    for(let page=0;page<10;page++){
      const query=new URLSearchParams({from,to,limit:'1000'});
      if(cursor)query.set('cursor',cursor);
      const result=await forceSalesRequest(`/force-sales/location-points?${query.toString()}`);
      for(const point of Array.isArray(result?.points)?result.points:[]){
        const userId=String(point?.userId||'');
        const capturedAt=String(point?.capturedAt||'');
        if(!userId||!window.NovaForceSalesLocation.isFreshLocationTimestamp(capturedAt,now))continue;
        const existing=captures.get(userId);
        if(!existing||Date.parse(capturedAt)>Date.parse(existing))captures.set(userId,capturedAt);
      }
      cursor=String(result?.nextCursor||'');
      if(!cursor)break;
    }
    recentGpsCapturesByUser=captures;
    return captures;
  })().catch(error=>{recentGpsCapturesByUser=null;throw error}).finally(()=>{recentGpsCapturesInFlight=null});
  return recentGpsCapturesInFlight;
}
function distanceBetweenPresencePoints(a,b){
  if(!a||!b)return Number.POSITIVE_INFINITY;
  const earthRadius=6371000;
  const dLat=(b.lat-a.lat)*Math.PI/180;
  const dLng=(b.lng-a.lng)*Math.PI/180;
  const lat1=a.lat*Math.PI/180;
  const lat2=b.lat*Math.PI/180;
  const sinLat=Math.sin(dLat/2); const sinLng=Math.sin(dLng/2);
  const h=sinLat*sinLat+Math.cos(lat1)*Math.cos(lat2)*sinLng*sinLng;
  return 2*earthRadius*Math.asin(Math.sqrt(h));
}
async function syncSellerPresence(coords,capturedAt=coords?.capturedAt){
  if(EXTERNAL_DURABLE_TRACKING||!canForceSales('updatePresence')||!presenceSharingEnabled||!localStorage.getItem('nh-auth-token'))return;
  if(!window.NovaForceSalesLocation.isFreshLocationTimestamp(capturedAt))return;
  const now=Date.now();
  const point=window.NovaForceSalesLocation.normalizeCoordinates(coords);
  if(!point)return;
  const moved=distanceBetweenPresencePoints(lastSentPresenceCoords,point)>=12;
  // La presencia solo se renueva a partir de esta captura GPS nueva y reciente.
  if(presenceSyncInFlight || (!moved && now-lastPresenceSentAt<30000))return;
  presenceSyncInFlight=true;
  try{
    await forceSalesRequest('/force-sales/presence',{method:'POST',body:JSON.stringify({lat:point.lat,lng:point.lng,accuracy:coords.accuracy,heading:coords.heading})});
    lastPresenceSentAt=Date.now();
    lastSentPresenceCoords=point;
  }
  catch(error){console.warn('No se pudo sincronizar la presencia comercial',error)}
  finally{presenceSyncInFlight=false}
}
function updatePresenceToggle(){
  const button=document.getElementById('togglePresence');
  const privacy=document.getElementById('locationPrivacy');
  const settings=document.getElementById('locationSettings');
  if(privacy)privacy.hidden=!(canForceSales('updatePresence')||canForceSales('hidePresence'));
  if(settings)settings.hidden=!(canForceSales('updatePresence')||canForceSales('hidePresence'));
  if(!button)return;
  const canHide=presenceSharingEnabled&&canForceSales('hidePresence');
  const canShow=!presenceSharingEnabled&&canForceSales('updatePresence');
  button.hidden=!(canHide||canShow);
  button.disabled=LOCATION_REQUIRED && !CAN_SHARE_PRESENCE;
  button.textContent=LOCATION_REQUIRED && !CAN_SHARE_PRESENCE ? 'Ubicación obligatoria' : (presenceSharingEnabled?'Ocultar mi ubicación':'Mostrar mi ubicación');
  button.title=button.disabled?'La empresa exige ubicación durante el horario configurado':(presenceSharingEnabled?'Tu última ubicación puede verse por vendedores autorizados':'Tu ubicación está oculta para otros vendedores');
}
async function setPresenceSharing(enabled){
  if(!requireForceSales(enabled?'updatePresence':'hidePresence'))return;
  if(!enabled && LOCATION_REQUIRED && !CAN_SHARE_PRESENCE){toast('La empresa exige compartir ubicación durante la operación');return}
  presenceSharingEnabled=enabled;
  localStorage.setItem(PRESENCE_STORAGE_KEY,String(enabled));
  if(EXTERNAL_DURABLE_TRACKING)window.parent.postMessage({source:'novahub-force-sales',type:'presence-sharing-changed',enabled},location.origin);
  if(!enabled){
    stopPresenceWatch();
    presenceWatchRequested=false;
    setNovaMarkerMap(userLocationMarker,null);
    userLocationCircle?.setMap(null);
    try{await forceSalesRequest('/force-sales/presence/me',{method:'DELETE'});}catch(error){console.warn('No se pudo ocultar la presencia comercial',error)}
    await loadSellerPresence();
    toast('Tu ubicación quedó oculta');
  }else{
    toast('Tu ubicación volverá a compartirse al usar Mi ubicación o registrar una visita');
    if(lastKnownCoords&&window.NovaForceSalesLocation.isFreshLocationTimestamp(lastKnownCoords.capturedAt)){
      presenceWatchRequested=true;
      setNovaMarkerMap(userLocationMarker,googleMap);
      userLocationCircle?.setMap(googleMap);
    }
    startPresenceWatch();
  }
  updatePresenceToggle();
}
function locateMe(){
  setGpsIndicator('pending');
  withLocationAccess(position=>{
    showUserLocation(position);
    googleMap.panTo({lat:position.coords.latitude,lng:position.coords.longitude});
    googleMap.setZoom(16);
  },'No se pudo obtener la ubicación para centrar el mapa');
}
function capturePresenceLocation(){
  withLocationAccess(position=>showUserLocation(position),'No se pudo actualizar la ubicación compartida');
}
function toggleMap3D(){
  map3DEnabled=!map3DEnabled;
  if(typeof googleMap.setTilt==='function')googleMap.setTilt(map3DEnabled?45:0);
  if(map3DEnabled && typeof googleMap.setHeading==='function')googleMap.setHeading(0);
  const button=document.getElementById('toggle3d');
  if(button){button.classList.toggle('active',map3DEnabled);button.textContent=map3DEnabled?'2D':'3D'}
  toast(map3DEnabled?'Vista 3D activada · gira y acerca el mapa':'Vista 2D activada');
}
window.saveProspectAssignee=async function(id){
  if(!CAN_ASSIGN_PROSPECT_OWNER||!requireForceSales('assignProspect'))return;
  const business=findBusiness(id);if(!business)return;
  const selector=document.getElementById(`point-assignee-${safeId(id)}`);
  if(!selector)return;
  const assignedToId=selector.value||null;
  const saved=await persistProspectAction(business,'assignProspect','',{assignedToId});
  if(!saved)return;
  stateOf(business).assignedToId=assignedToId;
  stateOf(business).assignedToName=assignees.find(item=>String(item.id)===String(assignedToId||''))?.name || null;
  persistCommercial();
  rerenderKeepingPopup(business);
  toast(assignedToId?'Responsable del punto actualizado':'Responsable del punto retirado');
};
window.saveFollowup = async function(id){
  const sid = safeId(id);
  const b = findBusiness(id);
  if(!b) return;
  const c=stateOf(b);
  const actions=[];
  const body={};
  const updatedAt=new Date().toISOString();
  if(canForceSales('updateProspect')){
    const contactName=document.getElementById('contact-' + sid)?.value.trim() || '';
    const contactPhone=document.getElementById('phone-' + sid)?.value.trim() || '';
    const note=document.getElementById('nt-' + sid)?.value || '';
    const date=document.getElementById('dt-' + sid)?.value || '';
    c.contactName=contactName;c.contactPhone=contactPhone;
    if(contactPhone)b.phone=contactPhone;
    followups[id]={...(followups[id]||{}),date,note,updatedAt};
    followups[id].note=note;
    body.phone=contactPhone || b.phone || null;body.notes=note;
    actions.push('updateProspect');
  }
  if(canForceSales('changeStage')){
    const status=document.getElementById('st-' + sid)?.value;
    if(status){c.stage=status;c.discarded=false;followups[id]={...(followups[id]||{}),status,updatedAt};body.stage=stageToApi(status);actions.push('changeStage')}
  }
  const file=canForceSales('attachEvidence') ? document.getElementById('ev-' + sid)?.files?.[0] : null;
  const validFile=file && file.size <= 10 * 1024 * 1024 ? file : null;
  if(file && !validFile){toast('La evidencia supera el límite de 10 MB');return}
  if(validFile){c.evidenceName=validFile.name;c.evidenceType=validFile.type;c.evidencePending=true;actions.push('attachEvidence')}
  localStorage.setItem('novaManaguaFollowupsV4', JSON.stringify(followups));
  persistCommercial();
  if(actions.length){
    const saved=await persistProspectAction(b,actions,'',body,validFile);
    if(!saved)return;
  }
  if(!validFile)toast('Seguimiento guardado');
  rerenderKeepingPopup(b);
};
window.saveWhatsAppConsent = async function(id){
  if(!requireForceSales('manageConsent'))return;
  const sid=safeId(id); const b=findBusiness(id); if(!b)return;
  const optedIn=Boolean(document.getElementById('wa-optin-'+sid)?.checked);
  const phone=(document.getElementById('wa-'+sid)?.value || '').trim();
  const source=(document.getElementById('wa-source-'+sid)?.value || '').trim();
  if(optedIn && (!phone || !source)){toast('Para activar WhatsApp indica teléfono y fuente del consentimiento');return}
  const c=stateOf(b); c.whatsappPhone=phone || b.phone || ''; c.whatsappOptIn=optedIn; c.whatsappOptInSource=optedIn ? source : '';
  persistCommercial();
  if(localStorage.getItem('nh-auth-token')){
    await persistProspectAction(b,'manageConsent','/whatsapp-consent',{optIn:optedIn,phone,source});
  }else toast(optedIn?'Consentimiento guardado localmente':'Consentimiento retirado localmente');
  rerenderKeepingPopup(b);
};
function applyLabels(){
  markerById.forEach((m) => {
    const b = m._b;
    m.unbindTooltip();
    if(shouldLabel(b)){
      m.bindTooltip(esc(b.name), {permanent:true, direction:'right', offset:[10,-2], className:'business-label'});
    }
  });
}
