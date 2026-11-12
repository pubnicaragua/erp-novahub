function isAppleTouchDevice(){return /iPad|iPhone|iPod/.test(navigator.userAgent)|| (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)}
function showLocationHelp(){
  const text=document.getElementById('locationHelpText');
  const steps=document.getElementById('locationSteps');
  if(isAppleTouchDevice()){
    if(text)text.textContent='iOS bloqueó el permiso de ubicación para este sitio. Cámbialo en los ajustes del sitio y luego vuelve a intentar.';
    if(steps)steps.innerHTML='<li>En Safari, toca el botón de ajustes de la dirección y entra a <b>Configuración del sitio web</b>.</li><li>En <b>Ubicación</b> elige <b>Permitir</b> y vuelve a NovaHub.</li><li>Si está instalado como app, revisa también <b>Ajustes del iPhone → Privacidad y seguridad → Localización → Safari</b>.</li>';
  }else if(text&&steps){
    text.textContent='El navegador bloqueó el permiso de ubicación para este sitio. Corrige el permiso y vuelve a intentar.';
    steps.innerHTML='<li>Abre el candado o el icono de ajustes junto a la dirección.</li><li>En <b>Ubicación</b> selecciona <b>Permitir</b>.</li><li>Recarga NovaHub y pulsa <b>Volver a intentar</b>.</li>';
  }
  document.getElementById('locationModal')?.removeAttribute('hidden');
}
function closeLocationHelp(){document.getElementById('locationModal')?.setAttribute('hidden','')}
async function locationPermissionState(){
  if(!navigator.permissions?.query)return 'prompt';
  try{return (await navigator.permissions.query({name:'geolocation'})).state}catch(error){return 'prompt'}
}
async function withLocationAccess(onSuccess,onFailure,onFallback,options={}){
  if(!navigator.geolocation){onFallback?.();return}
  if(await locationPermissionState()==='denied'){
    if(onFallback){onFallback();return}
    showLocationHelp();
    return
  }
  navigator.geolocation.getCurrentPosition(onSuccess,error=>{
    if(error?.code===1){if(onFallback){onFallback();return}showLocationHelp();return}
    if(error?.code===3){if(onFallback){onFallback();return}toast('La ubicación tardó demasiado. Acerca el teléfono al exterior e inténtalo de nuevo');return}
    if(onFallback){onFallback();return}
    toast(onFailure || 'No se pudo obtener la ubicación. Revisa el permiso del navegador.')
  },{enableHighAccuracy:true,timeout:12000,maximumAge:options.maximumAge ?? 30000});
}
function resetQuickCapture(){
  pendingQuickPointPhoto=false;
  pendingQuickPointFile=null;
  if(pendingQuickPointPreviewUrl){URL.revokeObjectURL(pendingQuickPointPreviewUrl);pendingQuickPointPreviewUrl=null}
  const panel=document.getElementById('quickCapture');
  const photo=document.getElementById('quickCapturePhoto');
  const image=document.getElementById('quickCapturePhotoImage');
  const save=document.getElementById('quickCaptureSave');
  if(photo)photo.hidden=true;
  if(image)image.removeAttribute('src');
  if(save)save.disabled=false;
  if(panel)panel.hidden=true;
}
function updateQuickCaptureSaveState(){
  const input=document.getElementById('quickCaptureName');
  const save=document.getElementById('quickCaptureSave');
  if(save)save.disabled=!String(input?.value||'').trim();
}
function beginQuickPointCapture(source='camera'){
  if(!canForceSales('attachEvidence')&&!canForceSales('importProspects')){toast('Tu rol no tiene permiso para subir imágenes');return}
  const input=document.getElementById(source==='gallery'?'quickPointGalleryInput':'quickPointCameraInput');
  if(!input){toast(source==='gallery'?'La galería no está disponible en este dispositivo':'La cámara no está disponible en este dispositivo');return}
  pendingQuickPointPhoto=true;
  input.value='';
  try{input.click()}catch(error){pendingQuickPointPhoto=false;toast(source==='gallery'?'No se pudo abrir la galería':'No se pudo abrir la cámara')}
}
function clearQuickPointPhoto(){
  pendingQuickPointFile=null;
  if(pendingQuickPointPreviewUrl){URL.revokeObjectURL(pendingQuickPointPreviewUrl);pendingQuickPointPreviewUrl=null}
  const photo=document.getElementById('quickCapturePhoto');
  const image=document.getElementById('quickCapturePhotoImage');
  if(photo)photo.hidden=true;
  if(image)image.removeAttribute('src');
}
function renderQuickPointPhoto(file){
  const photo=document.getElementById('quickCapturePhoto');
  const image=document.getElementById('quickCapturePhotoImage');
  const filename=document.getElementById('quickCapturePhotoName');
  const save=document.getElementById('quickCaptureSave');
  if(!photo||!image||!filename||!save)return;
  if(pendingQuickPointPreviewUrl)URL.revokeObjectURL(pendingQuickPointPreviewUrl);
  pendingQuickPointPreviewUrl=URL.createObjectURL(file);
  image.src=pendingQuickPointPreviewUrl;
  filename.textContent=`${file.name} · ${Math.round(file.size/1024)} KB`;
  photo.hidden=false;
  save.disabled=false;
}
function openQuickPointAt(lat,lng,source='mapa',accuracy=null){
  if(!requireForceSales('importProspects'))return;
  if(source!=='ubicación actual')quickPointLocationRequestId+=1;
  const coordinates=window.NovaForceSalesLocation.normalizeCoordinates({lat,lng});
  if(!coordinates){toast('La ubicación recibida no es válida; marca un punto en el mapa');return}
  const panel=document.getElementById('quickCapture');
  const nameInput=document.getElementById('quickCaptureName');
  const location=document.getElementById('quickCaptureLocation');
  if(!panel || !nameInput || !location)return;
  const isRepositioning=!panel.hidden && Boolean(pendingPointCoords);
  if(!isRepositioning){
    clearFocusedQuickPoint();
    clearPendingQuickPointMarker();
    resetQuickCapture();
    nameInput.value='';
  }
  panel.hidden=false;
  updateQuickCaptureSaveState();
  updatePendingQuickPointPosition(coordinates,{source,accuracy});
  if(!pendingPointMarker){
    pendingPointMarker=window.NovaForceSalesLocation.createDraftMarker({
      createMarker:options=>createMapMarker({...options,content:createQuickPointMarkerContent(false),map:googleMap}),
      position:coordinates,
      onPositionChange:next=>updatePendingQuickPointPosition(next,{source:'mapa',accuracy:null}),
    });
  }else if(pendingPointMarker.setPosition){
    pendingPointMarker.setPosition(coordinates);
  }
  if(!isRepositioning)nameInput.focus();
}
function openQuickPointFromDevice(){
  const requestId=++quickPointLocationRequestId;
  toast('Obteniendo tu ubicación…');
  withLocationAccess(position=>{
    if(requestId!==quickPointLocationRequestId)return;
    showUserLocation(position);
    googleMap.panTo({lat:position.coords.latitude,lng:position.coords.longitude});
    googleMap.setZoom(17);
    openQuickPointAt(position.coords.latitude,position.coords.longitude,'ubicación actual',position.coords.accuracy);
  },'No se pudo capturar la ubicación; marca un punto directamente en el mapa',()=>{
    if(requestId===quickPointLocationRequestId)toast('No se pudo obtener GPS. Toca cualquier punto del mapa para marcar el negocio.');
  },{maximumAge:0});
}
function saveQuickPoint(){
  if(!requireForceSales('importProspects'))return;
  if(!pendingPointCoords)return;
  const nameInput=document.getElementById('quickCaptureName');
  const coords={...pendingPointCoords};
  const locationDetails={captureSource:pendingPointSource,accuracy:pendingPointAccuracy};
  const name=(nameInput?.value || '').trim();
  if(!name){nameInput?.focus({preventScroll:true});toast('Escribe el nombre del negocio para continuar');return}
  if(pendingQuickPointFile && !canForceSales('attachEvidence')&&!canForceSales('importProspects')){toast('Tu rol no tiene permiso para subir imágenes');return}
  const evidenceFile=pendingQuickPointFile;
  clearPendingQuickPointMarker();
  pendingPointCoords=null;
  resetQuickCapture();
  createQuickPointAt(coords.lat,coords.lng,name,locationDetails,evidenceFile);
}
function createQuickPointAt(lat,lng,customName='Negocio capturado en visita',details={},evidenceFile=null){
  if(!requireForceSales('importProspects'))return;
  if(evidenceFile && !canForceSales('attachEvidence')&&!canForceSales('importProspects')){toast('Tu rol no tiene permiso para subir imágenes');return}
  const coords={lat:Number(lat),lng:Number(lng)};
  if(!window.NovaForceSalesLocation.normalizeCoordinates(coords))return;
  const id=`quick-${crypto.randomUUID()}`;
  const name=customName || 'Negocio capturado en visita';
  const address='Punto capturado · ' + coords.lat.toFixed(6) + ', ' + coords.lng.toFixed(6);
  const gpsAccuracy=Number(details.accuracy);
  const precision=details.captureSource==='ubicación actual'
    ? `Ubicación GPS${Number.isFinite(gpsAccuracy)&&gpsAccuracy>=0 ? ` · precisión informada ±${Math.round(gpsAccuracy)} m` : ''}`
    : 'Coordenada seleccionada en el mapa';
  const business={id,sourceKey:id,name,zone:nearestZone(coords.lat,coords.lng),category:'Prospecto por validar',address,source:'Captura móvil NovaHub',sourceUrl:'',lat:coords.lat,lng:coords.lng,precision,score:0,priority:'C',owner:'Fuerza Comercial',phone:'',website:'',rating:null,reviews:0,createdBy:currentUserAttribution()||undefined};
  localPoints.unshift(business);
    localStorage.setItem(LOCAL_POINTS_KEY,JSON.stringify(localPoints.slice(0,2000)));
  const c=stateOf(business); Object.assign(c,{selected:true,stage:'Nuevo',syncPending:true,syncStatus:'Pendiente de sincronización'});
  if(evidenceFile){c.evidenceName=evidenceFile.name;c.evidenceType=evidenceFile.type;c.evidencePreviewUrl=URL.createObjectURL(evidenceFile);c.evidencePending=true}
  persistCommercial();
  mergeBusinesses(); populateFilters();
  document.getElementById('quickCapture').hidden=true;
  pendingPointCoords=null;
  activeView='map';
  updateView();
  focusQuickPoint(business);
  render();
  toast(evidenceFile?'Punto y foto guardados en el dispositivo · sincronizando…':'Punto guardado en el dispositivo · sincronizando…');
  void (async()=>{
    if(evidenceFile)await saveOfflineProspect(business,evidenceFile,[],true);
    const syncResult=await syncProspects([business],evidenceFile);
    const syncedState=stateOf(business);
    if(syncResult && syncedState.remoteId && !syncedState.syncPending && !syncedState.evidencePending)await removeOfflineProspect(keyOf(business));
    render();
    refreshFocusedQuickPointPopup();
    if(!syncedState.remoteId||syncedState.syncPending||syncedState.evidencePending){
      toast(evidenceFile&&syncedState.evidencePending?'Punto guardado localmente; la foto sigue pendiente de sincronización.':'Punto guardado localmente; la sincronización sigue pendiente.');
      return;
    }
    await loadRemoteProspects();
    setSearchStatus('Negocio sincronizado · visible en todos los dispositivos autorizados.');
    toast('Punto sincronizado con NovaHub');
    if(canForceSales('registerVisit')){
      const visitedAt=new Date().toISOString();
      const saved=await persistProspectAction(business,'registerVisit','/visit',{visitLat:business.lat,visitLng:business.lng,visitedAt});
      if(saved){Object.assign(c,{visitedAt,visitLat:business.lat,visitLng:business.lng,stage:'Visitado'});followups[business.id]={status:'Visitado',updatedAt:visitedAt,note:'Punto creado desde el mapa'};localStorage.setItem('novaManaguaFollowupsV4',JSON.stringify(followups));persistCommercial();render()}
    }
  })();
}
document.getElementById('newPoint').addEventListener('click',openQuickPointFromDevice);
document.getElementById('quickCaptureCancel').addEventListener('click',()=>{quickPointLocationRequestId+=1;pendingPointCoords=null;clearPendingQuickPointMarker();resetQuickCapture()});
document.getElementById('quickCaptureTakePhoto').addEventListener('click',()=>beginQuickPointCapture('camera'));
document.getElementById('quickCaptureChoosePhoto').addEventListener('click',()=>beginQuickPointCapture('gallery'));
document.getElementById('quickCaptureRemovePhoto').addEventListener('click',clearQuickPointPhoto);
document.getElementById('quickCaptureName').addEventListener('input',updateQuickCaptureSaveState);
document.getElementById('quickCaptureSave').addEventListener('click',saveQuickPoint);
