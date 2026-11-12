let locationTrailArtifacts=[];
let locationTrailLoading=false;
let locationTrailRefreshRequested=false;
let lastLocationTrailRefreshAt=0;
let locationTrailRequestId=0;
let currentLocationTrailData=null;
function clearLocationTrail(){
  locationTrailArtifacts.forEach(artifact=>artifact?.setMap?.(null));
  locationTrailArtifacts=[];
}
function locationTrailSegments(points){return window.NovaForceSalesLocation.processLocationTrail(points)}
function locationTrailUi(){
  const history=activeView==='history';
  return {status:document.getElementById(history?'locationTrailStatus':'mapTrailStatus'),legend:document.getElementById(history?'locationTrailLegend':'mapTrailLegend'),originals:document.getElementById(history?'historyTrailOriginals':'mapTrailOriginals')};
}
function renderLocationTrail(){
  clearLocationTrail();
  const current=currentLocationTrailData;
  if(!current||!shouldLoadLocationTrail())return;
  const {result,truncated,selectedUser,day}=current;
  const {status,legend,originals}=locationTrailUi();
  const showOriginals=originals?.checked===true;
  const colors=new Map();
  const colorFor=userId=>{
    const key=String(userId||'unknown');
    if(!colors.has(key))colors.set(key,window.NovaForceSalesLocation.trailColorForUser(key));
    return colors.get(key);
  };
  const addPosition=(userId,point,reason='single')=>{
    const coordinates=window.NovaForceSalesLocation.normalizeCoordinates(point);
    if(!coordinates)return;
    const color=colorFor(userId);
    const radius=reason==='original'?5:reason==='unknown-accuracy'?9:7;
    locationTrailArtifacts.push(new google.maps.Circle({map:googleMap,center:coordinates,radius,fillColor:color,fillOpacity:reason==='original'?.52:.88,strokeColor:'#ffffff',strokeOpacity:.95,strokeWeight:1.5,clickable:false,zIndex:1150}));
  };
  let cameraPoints=[];
  if(showOriginals){
    const originalPoints=result.originalPoints.slice(-1200);
    originalPoints.forEach(point=>addPosition(String(point.userId||point.userName||'unknown'),point,'original'));
    cameraPoints=originalPoints;
  }else{
    result.segments.forEach(segment=>{
      const color=colorFor(segment.userId);
      const path=segment.points.map(point=>({lat:Number(point.lat),lng:Number(point.lng)}));
      if(path.length>1)locationTrailArtifacts.push(new google.maps.Polyline({map:googleMap,path,geodesic:false,strokeColor:color,strokeOpacity:.88,strokeWeight:4,zIndex:1150}));
      cameraPoints.push(...segment.points);
    });
    result.isolatedPoints.forEach(item=>{addPosition(item.userId,item.point,item.reason);cameraPoints.push(item.point)});
  }
  updateMapLayerVisibility();
  if(legend){
    const users=[...colors.entries()].map(([id,color])=>{
      const name=String(result.originalPoints.find(point=>String(point.userId||point.userName||'unknown')===id)?.userName||assignees.find(item=>String(item.id)===id)?.name||id);
      return `<span><i style="background:${color}" aria-hidden="true"></i>${esc(name)}</span>`;
    });
    const unknownCount=result.isolatedPoints.filter(item=>item.reason==='unknown-accuracy').length;
    if(unknownCount)users.push(`<span><i style="background:#7b8790" aria-hidden="true"></i>Precisión desconocida: ${unknownCount} aisladas</span>`);
    legend.innerHTML=users.join('');
  }
  const reasonLabels={'time-gap':'hueco >120 s','distance-gap':'salto >300 m','speed-gap':'velocidad >45 m/s','low-accuracy':'precisión >100 m','unknown-accuracy':'precisión desconocida'};
  const reasonSummary=[...new Set(result.interruptions.map(item=>item.reason))].map(reason=>`${result.interruptions.filter(item=>item.reason===reason).length} ${reasonLabels[reason]||reason}`).join(' · ');
  const sellerCount=new Set(result.originalPoints.map(point=>String(point.userId||point.userName||'unknown'))).size;
  const selectedLabel=selectedUser?` para ${esc(trailUsers(result.originalPoints).find(([id])=>id===selectedUser)?.[1]||selectedUser)}`:` · ${sellerCount} usuario${sellerCount===1?'':'s'}`;
  if(status)status.textContent=`Trayectoria GPS aproximada${selectedLabel} · ${result.usedCount} lecturas utilizadas · ${result.discardedCount} descartadas · ${result.segments.length} tramos · ${result.interruptions.length} interrupciones${reasonSummary?` (${reasonSummary})`:''}${showOriginals?` · ${Math.min(result.originalPoints.length,1200)} lecturas originales aisladas`:''}${truncated?' · resultado incompleto; filtra por usuario':''} · ${day}. Las líneas unen puntos GPS recibidos y no siguen necesariamente las calles.`;
  if(current.fitCamera&&cameraPoints.length){
    const bounds=new google.maps.LatLngBounds();
    cameraPoints.forEach(point=>bounds.extend({lat:Number(point.lat),lng:Number(point.lng)}));
    if(cameraPoints.length>1)googleMap.fitBounds(bounds,64);
    else googleMap.panTo({lat:Number(cameraPoints[0].lat),lng:Number(cameraPoints[0].lng)});
    current.fitCamera=false;
  }
}
function localDateInputValue(date=new Date()){
  const offset=date.getTimezoneOffset()*60000;
  return new Date(date.getTime()-offset).toISOString().slice(0,10);
}
async function loadLocationTrail(options={}){
  if(!shouldLoadLocationTrail()){locationTrailRefreshRequested=false;return}
  if(locationTrailLoading){locationTrailRefreshRequested=true;return}
  locationTrailLoading=true;
  locationTrailRefreshRequested=false;
  const requestId=++locationTrailRequestId;
  lastLocationTrailRefreshAt=Date.now();
  const {status}=locationTrailUi();
  const history=activeView==='history';
  const dateInput=document.getElementById(history?'locationTrailDate':'mapTrailDate');
  const userSelect=document.getElementById(history?'locationTrailUser':'mapTrailUser');
  const day=String(dateInput?.value||localDateInputValue());
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)){if(status)status.textContent='Selecciona un día válido.';locationTrailLoading=false;return}
  const start=new Date(`${day}T00:00:00`);
  const end=new Date(start);end.setDate(end.getDate()+1);
  const from=start.toISOString();const to=end.toISOString();
  const selectedUser=CAN_ASSIGN_TEAM?String(userSelect?.value||''):'';
  if(status)status.textContent=locationTrailArtifacts.length?'Actualizando recorrido…':'Cargando posiciones guardadas…';
  const points=[];
  let cursor='';
  let truncated=false;
  try{
    for(let page=0;page<10;page++){
      const query=new URLSearchParams({from,to,limit:'1000'});
      if(cursor)query.set('cursor',cursor);
      if(selectedUser)query.set('userId',selectedUser);
      const result=await forceSalesRequest(`/force-sales/location-points?${query.toString()}`);
      points.push(...(Array.isArray(result?.points)?result.points:[]));
      cursor=String(result?.nextCursor||'');
      if(!cursor)break;
      if(page===9)truncated=true;
    }
    forceSalesSyncErrors.delete('recorrido');
    updateOfflineStatus();
    if(requestId!==locationTrailRequestId||!shouldLoadLocationTrail())return;
    const result=locationTrailSegments(points);
    currentLocationTrailData={result,truncated,selectedUser,day,fitCamera:options.fitCamera===true};
    updateMapLayerControls();
    if(!points.length){if(status)status.textContent='No hay puntos sincronizados para ese día. Si el rastreo estuvo suspendido, aquí no se inventan posiciones.';clearLocationTrail();return}
    renderLocationTrail();
  }catch(error){
    if(requestId!==locationTrailRequestId||!shouldLoadLocationTrail())return;
    currentLocationTrailData=null;clearLocationTrail();
    const {legend}=locationTrailUi();if(legend)legend.replaceChildren();
    setForceSalesSyncError('recorrido',error);
    if(status)status.textContent=error instanceof Error?`No se pudo cargar el recorrido: ${error.message}`:'No se pudo cargar el recorrido.';
  }finally{
    locationTrailLoading=false;
    if(locationTrailRefreshRequested&&shouldLoadLocationTrail()){
      locationTrailRefreshRequested=false;
      void loadLocationTrail();
    }else locationTrailRefreshRequested=false;
  }
}
