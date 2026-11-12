function setMapFullscreenVisual(active){
  document.body.classList.toggle('map-fullscreen',active);
  const button=document.getElementById('fullscreenMap');
  if(button)button.textContent=active?'×':'⛶';
  if(window.parent!==window)window.parent.postMessage({source:'novahub-force-sales',type:'fullscreen',active},'*');
  window.setTimeout(resizeGoogleMap,120);
}
document.getElementById('fullscreenMap').addEventListener('click',async()=>{
  if(document.fullscreenElement){await document.exitFullscreen();return}
  // Safari iOS/PWA may expose no usable Fullscreen API. The visual fallback
  // is coordinated with the React shell so the iframe also covers its header.
  if(!document.documentElement.requestFullscreen||isAppleTouchDevice()){
    setMapFullscreenVisual(!document.body.classList.contains('map-fullscreen'));
    return;
  }
  try{await document.documentElement.requestFullscreen()}
  catch(error){console.warn('Pantalla completa nativa no disponible',error);setMapFullscreenVisual(true)}
});
document.addEventListener('fullscreenchange',()=>{
  const active=Boolean(document.fullscreenElement);
  setMapFullscreenVisual(active);
});
function rerenderKeepingPopup(b){
  const shouldKeepOpen=Boolean(b)&&String(currentPopupBusinessId||'')===String(b.id)&&activeView==='map';
  if(shouldKeepOpen)focusRenderLockUntil=Date.now()+900;
  render();
}
function toggleSelected(id, value){
  const b=findBusiness(id); if(!b) return;
  stateOf(b).selected = value === undefined ? !isSelected(b) : value;
  persistCommercial(); rerenderKeepingPopup(b); toast(stateOf(b).selected ? 'Negocio seleccionado' : 'Selección retirada');
}
window.toggleSelected = toggleSelected;
function addToKanban(id){
  if(!requireForceSales('changeStage'))return;
  const b=findBusiness(id); if(!b) return;
  if(isKanban(b)){toast('Este negocio ya pertenece a Fuerza Comercial');return}
  const c=stateOf(b); c.kanban=true; c.stage=c.stage || 'Nuevo'; persistCommercial(); rerenderKeepingPopup(b);
  void persistProspectAction(b,'changeStage','',{stage:stageToApi(c.stage)}); toast('Negocio agregado a Fuerza Comercial');
}
window.addToKanban = addToKanban;
function addSelectedToKanban(){
  if(!requireForceSales('changeStage'))return;
  const chosen=selectedBusinesses(); if(!chosen.length){toast('Selecciona al menos un negocio');return}
  let added=0, existing=0;
  const addedBusinesses=[];
  chosen.forEach(b=>{if(isKanban(b)){existing++;return} const c=stateOf(b);c.kanban=true;c.stage=c.stage||'Nuevo';addedBusinesses.push(b);added++});
  persistCommercial(); render(); void Promise.all(addedBusinesses.map(b=>persistProspectAction(b,'changeStage','',{stage:stageToApi(stateOf(b).stage)}))); toast(`${added} agregados · ${existing} ya existían`);
}
function registerVisit(id){
  if(!requireForceSales('registerVisit'))return;
  const b=findBusiness(id); if(!b) return;
  toast('Solicitando ubicación del dispositivo…');
  withLocationAccess(position=>{
    showUserLocation(position);
    googleMap.panTo({lat:position.coords.latitude,lng:position.coords.longitude});
    googleMap.setZoom(17);
    const visitedAt=new Date().toISOString();
    void persistProspectAction(b,'registerVisit','/visit',{visitLat:position.coords.latitude,visitLng:position.coords.longitude,visitedAt}).then(saved=>{
      if(!saved)return;
      const c=stateOf(b);c.visitedAt=visitedAt;c.visitLat=position.coords.latitude;c.visitLng=position.coords.longitude;c.stage='Visitado';c.kanban=true;
      followups[b.id]={...(followups[b.id]||{}),status:'Visitado',updatedAt:visitedAt};
      localStorage.setItem('novaManaguaFollowupsV4',JSON.stringify(followups));persistCommercial();rerenderKeepingPopup(b);
      toast('Visita registrada con ubicación');
      if(canForceSales('attachEvidence'))window.setTimeout(()=>requestEvidenceCapture(id),120);
    });
  },'No se pudo obtener la ubicación para registrar la visita');
}
window.registerVisit = registerVisit;
let pendingDiscardIds = [];
function openDiscardDialog(ids){
  pendingDiscardIds=[...new Set(ids)].filter(id=>findBusiness(id));
  if(!pendingDiscardIds.length)return;
  const modal=document.getElementById('discardModal');
  const description=document.getElementById('discardDescription');
  if(description)description.textContent=pendingDiscardIds.length===1 ? 'El prospecto conservará su historial, pero dejará de aparecer como oportunidad activa.' : 'Los prospectos conservarán su historial, pero dejarán de aparecer como oportunidades activas.';
  if(modal)modal.hidden=false;
  document.getElementById('discardReason')?.focus();
}
function closeDiscardDialog(){
  pendingDiscardIds=[];
  const modal=document.getElementById('discardModal');
  if(modal)modal.hidden=true;
}
function confirmDiscardDialog(){
  if(!requireForceSales('discardProspect'))return;
  const reason=document.getElementById('discardReason')?.value || '';
  const note=(document.getElementById('discardNote')?.value || '').trim();
  if(!reason)return;
  const now=new Date().toISOString();
  const chosen=pendingDiscardIds.map(findBusiness).filter(Boolean);
  chosen.forEach(b=>{
    const c=stateOf(b); c.discarded=true;c.discardReason=note ? reason + ' · ' + note : reason;c.discardedAt=now;c.stage='Descartado';
    followups[b.id]={...(followups[b.id]||{}),status:'Descartado',updatedAt:now,note:note || reason};
  });
  localStorage.setItem('novaManaguaFollowupsV4',JSON.stringify(followups));persistCommercial();closeDiscardDialog();render();
  void Promise.all(chosen.map(b=>persistProspectAction(b,'discardProspect','/discard',{reason:stateOf(b).discardReason})));
  toast(`${chosen.length} ${chosen.length===1?'prospecto descartado':'prospectos descartados'}`);
}
function discardBusiness(id){
  if(!requireForceSales('discardProspect'))return;
  openDiscardDialog([id]);
}
window.discardBusiness = discardBusiness;
let pendingDeleteId = null;
function deleteBusiness(id){
  if(!CAN_DELETE_TEST){toast('Solo el Super Admin principal puede eliminar negocios');return}
  if(!findBusiness(id))return;
  pendingDeleteId=id;
  document.getElementById('deleteModal').hidden=false;
}
window.deleteBusiness = deleteBusiness;
async function confirmDeleteBusiness(){
  const b=findBusiness(pendingDeleteId); if(!b)return;
  const c=stateOf(b);
  const businessKey=String(keyOf(b));
  try{
    if(c.remoteId)await forceSalesRequest('/force-sales/prospects/' + encodeURIComponent(c.remoteId),{method:'DELETE'});
    for(let index=localPoints.length-1;index>=0;index--){if(String(keyOf(localPoints[index]))===businessKey)localPoints.splice(index,1)}
    googlePlaces=googlePlaces.filter(item=>String(keyOf(item))!==businessKey);
    deletedBusinessKeys.add(businessKey);
    delete commercialState[businessKey];delete commercialState[b.id];delete followups[b.id];
    localStorage.setItem(LOCAL_POINTS_KEY,JSON.stringify(localPoints));
    localStorage.setItem(GOOGLE_CATALOG_KEY,JSON.stringify(googlePlaces));
    localStorage.setItem(DELETED_BUSINESSES_KEY,JSON.stringify([...deletedBusinessKeys]));
    localStorage.setItem('novaManaguaFollowupsV4',JSON.stringify(followups));
    persistCommercial();remoteProspects=remoteProspects.filter(item=>String(keyOf(item))!==businessKey && item.id!==c.remoteId);mergeBusinesses();populateFilters();render();
    document.getElementById('deleteModal').hidden=true;pendingDeleteId=null;toast('Negocio eliminado');
  }catch(error){console.warn(error);toast('No se pudo eliminar el negocio')}
}
window.openEvidence = async function(id){
  const b=findBusiness(id); const c=b && stateOf(b);
  if(!c?.evidenceUri){toast('La evidencia todavía no está sincronizada');return}
  try{
    const result=await forceSalesRequest('/storage/resolve',{method:'POST',body:JSON.stringify({uri:c.evidenceUri})});
    if(!result?.url) throw new Error('URL no disponible');
    const modal=document.getElementById('evidenceModal');
    const media=document.getElementById('evidenceModalMedia');
    if(!modal || !media){window.open(result.url,'_blank','noopener,noreferrer');return}
    media.innerHTML=c.evidenceType?.startsWith('image/') ? '<img src="' + esc(result.url) + '" alt="Evidencia de ' + esc(b.name) + '">' : '<iframe src="' + esc(result.url) + '" title="Evidencia de ' + esc(b.name) + '"></iframe>';
    modal.hidden=false;
  }catch(error){console.warn(error);toast('No se pudo abrir la evidencia')}
};
function previewEvidence(input){
  const id=String(input.id || '').replace(/^ev-/, '');
  const preview=document.getElementById('ev-preview-'+id);
  const file=input.files?.[0];
  if(!preview || !file){if(preview)preview.hidden=true;return}
  preview.hidden=false;
  if(file.type.startsWith('image/')){
    const url=URL.createObjectURL(file);
    preview.innerHTML=`<img src="${url}" alt="Vista previa de evidencia"><span>${esc(file.name)}<br>${Math.round(file.size/1024)} KB · imagen lista para guardar</span>`;
  }else{
    preview.innerHTML=`<span>📄 ${esc(file.name)}<br>${Math.round(file.size/1024)} KB · PDF listo para guardar</span>`;
  }
}
document.addEventListener('change',event=>{
  if(event.target instanceof HTMLInputElement && event.target.type==='file' && event.target.id.startsWith('ev-')) previewEvidence(event.target);
});
function requestEvidenceCapture(id){
  if(!requireForceSales('attachEvidence'))return;
  const b=findBusiness(id);
  const picker=document.getElementById('evidenceSourcePicker');
  if(!picker || !b)return;
  pendingEvidenceBusinessId=id;
  evidencePickerReturnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  picker.hidden=false;
  document.getElementById('evidenceSourceCamera')?.focus({preventScroll:true});
}
function chooseExistingEvidenceSource(source){
  if(!pendingEvidenceBusinessId)return;
  const input=document.getElementById(source==='camera'?'quickEvidenceCameraInput':source==='gallery'?'quickEvidenceGalleryInput':'quickEvidenceInput');
  const picker=document.getElementById('evidenceSourcePicker');
  if(!input){toast('No se pudo abrir la opción de evidencia');return}
  if(picker)picker.hidden=true;
  input.value='';
  try{input.click()}
  catch(error){console.warn(error);pendingEvidenceBusinessId=null;toast('No se pudo abrir el selector de archivos');evidencePickerReturnFocus?.focus?.({preventScroll:true})}
}
function restoreEvidencePickerFocus(){
  const focusTarget=evidencePickerReturnFocus;
  evidencePickerReturnFocus=null;
  if(focusTarget?.isConnected)focusTarget.focus({preventScroll:true});
}
async function handleEvidenceFileSelection(input){
  const file=input.files?.[0];
  input.value='';
  const isQuickPoint=pendingQuickPointPhoto;
  if(isQuickPoint)pendingQuickPointPhoto=false;
  const validation=window.NovaForceSalesLocation.validateEvidenceFile(file,{allowPdf:!isQuickPoint&&input.id==='quickEvidenceInput'});
  if(!file)return;
  if(!validation.valid){toast(validation.error||'No se pudo leer la evidencia');return}
  if(isQuickPoint){
    if(!canForceSales('attachEvidence')&&!canForceSales('importProspects')){toast('Tu rol no tiene permiso para subir imágenes');return}
    pendingQuickPointFile=file;
    document.getElementById('quickCapture').hidden=false;
    renderQuickPointPhoto(file);
    updateQuickCaptureSaveState();
    return;
  }
  const id=pendingEvidenceBusinessId;
  if(!file || !id)return;
  pendingEvidenceBusinessId=null;
  if(!requireForceSales('attachEvidence'))return;
  const b=findBusiness(id);
  if(!b)return;
  const c=stateOf(b);
  c.evidenceName=file.name;
  c.evidenceType=file.type;
  c.evidencePreviewUrl=URL.createObjectURL(file);
  c.evidencePending=true;
  persistCommercial();
  render();
  toast('Guardando evidencia…');
  const saved=await persistProspectAction(b,'attachEvidence','',{},file);
  if(!saved)return;
  render();
  toast(navigator.onLine?'Evidencia guardada':'Evidencia guardada offline; se sincronizará al volver la conexión');
}
for(const inputId of ['quickPointCameraInput','quickPointGalleryInput','quickEvidenceCameraInput','quickEvidenceGalleryInput','quickEvidenceInput']){
  const input=document.getElementById(inputId);
  input?.addEventListener('change',()=>void handleEvidenceFileSelection(input));
  input?.addEventListener('cancel',()=>{
    if(inputId==='quickPointCameraInput'||inputId==='quickPointGalleryInput')pendingQuickPointPhoto=false;
    else pendingEvidenceBusinessId=null;
    restoreEvidencePickerFocus();
  });
}
