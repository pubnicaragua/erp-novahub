const mobileMoreActions=document.querySelector('.mobile-more-actions');
mobileMoreActions?.addEventListener('click',event=>{
  if(event.target instanceof Element&&event.target.closest('button'))mobileMoreActions.open=false;
});
document.addEventListener('click',event=>{
  if(mobileMoreActions?.open&&event.target instanceof Node&&!mobileMoreActions.contains(event.target))mobileMoreActions.open=false;
});
document.getElementById('evidenceSourceCamera').addEventListener('click',()=>chooseExistingEvidenceSource('camera'));
document.getElementById('evidenceSourceGallery').addEventListener('click',()=>chooseExistingEvidenceSource('gallery'));
document.getElementById('evidenceSourceDocument').addEventListener('click',()=>chooseExistingEvidenceSource('document'));
document.getElementById('evidenceSourceCancel').addEventListener('click',()=>{
  document.getElementById('evidenceSourcePicker').hidden=true;
  pendingEvidenceBusinessId=null;
  restoreEvidencePickerFocus();
});
document.getElementById('evidenceSourcePicker').addEventListener('click',event=>{
  if(event.target!==event.currentTarget)return;
  event.currentTarget.hidden=true;
  pendingEvidenceBusinessId=null;
  restoreEvidencePickerFocus();
});
document.addEventListener('keydown',event=>{
  const picker=document.getElementById('evidenceSourcePicker');
  if(!picker||picker.hidden){
    if(event.key==='Escape'&&mobileMoreActions?.open){mobileMoreActions.open=false;mobileMoreActions.querySelector('summary')?.focus({preventScroll:true})}
    return;
  }
  if(event.key==='Escape'){
    event.preventDefault();
    picker.hidden=true;
    pendingEvidenceBusinessId=null;
    restoreEvidencePickerFocus();
    return;
  }
  if(event.key!=='Tab')return;
  const controls=[...picker.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(control=>control.getClientRects().length>0);
  if(!controls.length)return;
  const first=controls[0],last=controls[controls.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});
document.getElementById('discardCancel').addEventListener('click',closeDiscardDialog);
document.getElementById('discardConfirm').addEventListener('click',confirmDiscardDialog);
document.getElementById('discardModal').addEventListener('click',event=>{if(event.target===event.currentTarget)closeDiscardDialog()});
document.getElementById('evidenceClose').addEventListener('click',()=>{document.getElementById('evidenceModal').hidden=true;document.getElementById('evidenceModalMedia').innerHTML=''});
document.getElementById('evidenceModal').addEventListener('click',event=>{if(event.target===event.currentTarget){document.getElementById('evidenceModal').hidden=true;document.getElementById('evidenceModalMedia').innerHTML=''}});
document.getElementById('locationClose').addEventListener('click',closeLocationHelp);
document.getElementById('locationRetry').addEventListener('click',()=>{closeLocationHelp();locateMe()});
document.getElementById('locationModal').addEventListener('click',event=>{if(event.target===event.currentTarget)closeLocationHelp()});
document.getElementById('routeClose').addEventListener('click',closeRoutePanel);
document.getElementById('routePanelClose').addEventListener('click',closeRoutePanel);
document.getElementById('businessDetailClose').addEventListener('click',()=>closeBusinessDetailPopup());
document.getElementById('routeClear').addEventListener('click',clearRoute);
const routeAssigneeSearchInput=document.getElementById('routeAssigneeSearch');
const routeAssigneeOptions=document.getElementById('routeAssigneeOptions');
function routeAssigneeOptionFromEventTarget(target){
  const element=target?.nodeType===1?target:target?.parentElement;
  return element?.closest?.('#routeAssigneeOptions [role="option"]')||null;
}
routeAssigneeSearchInput.addEventListener('focus',()=>{routeAssigneePickerOpen=true;routeAssigneeActiveOptionIndex=0;routeAssigneeSearchInput.value='';renderSavedRouteOptions()});
routeAssigneeSearchInput.addEventListener('input',()=>{routeAssigneePickerOpen=true;routeAssigneeActiveOptionIndex=-1;renderSavedRouteOptions()});
routeAssigneeSearchInput.addEventListener('keydown',event=>{
  const choices=[...routeAssigneeOptions.querySelectorAll('[role="option"]')];
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault();routeAssigneePickerOpen=true;
    routeAssigneeActiveOptionIndex=choices.length?(routeAssigneeActiveOptionIndex+(event.key==='ArrowDown'?1:-1)+choices.length)%choices.length:-1;
    renderSavedRouteOptions();
  }else if(event.key==='Enter'&&routeAssigneePickerOpen){
    event.preventDefault();const choice=choices[routeAssigneeActiveOptionIndex>=0?routeAssigneeActiveOptionIndex:0];if(choice)chooseRouteAssignee(choice.dataset.assigneeId||'');
  }else if(event.key==='Escape'&&routeAssigneePickerOpen){
    event.preventDefault();routeAssigneePickerOpen=false;routeAssigneeActiveOptionIndex=-1;renderSavedRouteOptions();
  }
});
routeAssigneeOptions.addEventListener('pointerdown',event=>{
  const option=routeAssigneeOptionFromEventTarget(event.target);if(!option)return;
  event.preventDefault();chooseRouteAssignee(option.dataset.assigneeId||'');
});
routeAssigneeOptions.addEventListener('click',event=>{
  if(event.detail!==0)return;
  const option=routeAssigneeOptionFromEventTarget(event.target);if(!option)return;
  chooseRouteAssignee(option.dataset.assigneeId||'');
});
routeAssigneeSearchInput.addEventListener('blur',()=>window.setTimeout(()=>{if(document.activeElement?.closest?.('#routeAssigneePicker'))return;routeAssigneePickerOpen=false;routeAssigneeActiveOptionIndex=-1;renderSavedRouteOptions()},120));
document.getElementById('routeAssigneeRetry').addEventListener('click',()=>{void loadAssignees()});
document.getElementById('routeListRetry').addEventListener('click',()=>{void loadRemoteRoutes()});
document.getElementById('routeNew').addEventListener('click',startNewRoute);
document.getElementById('routeVicinityMode').addEventListener('change',renderRouteVicinityPreview);
document.getElementById('routeVicinityCount').addEventListener('input',renderRouteVicinityPreview);
document.getElementById('routeVicinityRadius').addEventListener('input',renderRouteVicinityPreview);
document.getElementById('routeVicinityRadiusUnit').addEventListener('change',()=>{
  const input=document.getElementById('routeVicinityRadius'),unit=document.getElementById('routeVicinityRadiusUnit'),previous=input.dataset.unit||'m',next=unit.value,value=Number(input.value);
  if(Number.isFinite(value)&&value>0){const meters=value*(previous==='km'?1000:1);input.value=String(Number((meters/(next==='km'?1000:1)).toFixed(4)))}
  input.dataset.unit=next;input.max=next==='km'?'50':'50000';input.step=next==='km'?'0.1':'50';renderRouteVicinityPreview();
});
document.getElementById('routeVicinityClose').addEventListener('click',clearRouteVicinityPreview);
document.getElementById('routeVicinityCancel').addEventListener('click',clearRouteVicinityPreview);
document.getElementById('routeVicinityCandidates').addEventListener('change',event=>{
  const checkbox=event.target.closest('input[data-vicinity-key]');if(checkbox)toggleRouteVicinityCandidate(checkbox.dataset.vicinityKey,true);
});
document.getElementById('routeVicinityAdd').addEventListener('click',addRouteVicinityPoints);
document.getElementById('routePlanTab').addEventListener('click',()=>setRoutePlannerTab('plan'));
document.getElementById('routeListTab').addEventListener('click',()=>{setRoutePlannerTab('routes');void loadRemoteRoutes()});
document.getElementById('routeCatalogSearch').addEventListener('input',renderRouteCatalog);
document.getElementById('routeCatalogRetry').addEventListener('click',()=>{void loadRemoteRoutes()});
document.querySelectorAll('[data-route-filter]').forEach(button=>button.addEventListener('click',()=>{routeCatalogFilter=button.dataset.routeFilter;document.querySelectorAll('[data-route-filter]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));renderRouteCatalog()}));
document.addEventListener('click',event=>{
  const retryButton=event.target instanceof Element?event.target.closest('.assignee-retry'):null;
  if(retryButton){event.preventDefault();void loadAssignees()}
});
document.getElementById('routeName').addEventListener('input',markRouteDraftChanged);
document.getElementById('routeFrequency').addEventListener('change',()=>{markRouteDraftChanged();renderRoutePlanner()});
document.getElementById('routeScheduledFor').addEventListener('change',markRouteDraftChanged);
document.getElementById('routeTransferOwnership').addEventListener('change',()=>{markRouteDraftChanged();renderRoutePlanner()});
document.getElementById('routeImport').addEventListener('click',()=>window.parent?.postMessage({source:'novahub-force-sales',type:'request-import-file'},'*'));
renderSavedRouteOptions();
document.getElementById('routeOptimize').addEventListener('click',optimizeRoute);
document.getElementById('routeDraw').addEventListener('click',drawRouteOnMap);
document.getElementById('routeStart').addEventListener('click',()=>void startCurrentRoute());
document.getElementById('routeCompleteStop').addEventListener('click',()=>void completeCurrentRouteStop());
document.getElementById('routeOpenMaps').addEventListener('click',()=>openNextRouteStop('waze'));
document.getElementById('routeOpenGoogleMaps').addEventListener('click',()=>openNextRouteStop('google'));
document.getElementById('routeOpenFullGoogleMaps').addEventListener('click',()=>openFullRouteInGoogleMaps());
document.getElementById('routeRetryActions').addEventListener('click',()=>void retryBlockedRouteActions());
document.getElementById('routeVisitNotes').addEventListener('input',()=>{
  const context=currentRouteVisitContext();
  if(context)saveRouteVisitDraft(context.routeId,context.stopId,document.getElementById('routeVisitNotes').value);
});
document.getElementById('routeSyncNotice').addEventListener('click',event=>{
  const button=event.target instanceof Element?event.target.closest('[data-retry-route-action]'):null;
  if(button)void retryBlockedRouteAction(button.dataset.retryRouteAction);
});
document.getElementById('routeSave').addEventListener('click',()=>{void saveRouteAssignment()});
document.getElementById('routeModal').addEventListener('click',event=>{if(event.target===event.currentTarget)closeRoutePanel()});
document.getElementById('routeTop').addEventListener('click',()=>openRoutePlanner([]));
window.addEventListener('message',event=>{
  if(event.source!==window.parent||event.origin!==window.location.origin||event.data?.source!=='novahub-force-sales')return;
  if(event.data?.type==='force-sales-import-error'){toast(event.data.message || 'No se pudo leer el archivo');return}
  if(event.data?.type==='force-sales-import-rows')void importForceSalesRows(event.data);
});
document.getElementById('searchNearby').addEventListener('click',searchNearbyFromDevice);
document.getElementById('toggle3d').addEventListener('click',toggleMap3D);
document.getElementById('zoneManager').addEventListener('click',openZoneManager);
document.getElementById('zoneClose').addEventListener('click',()=>{document.getElementById('zoneModal').hidden=true});
document.getElementById('zoneModal').addEventListener('click',event=>{if(event.target===event.currentTarget)event.currentTarget.hidden=true});
document.getElementById('zoneAssignmentZone').addEventListener('change',populateZoneAssignment);
document.getElementById('zoneAssignmentCell').addEventListener('change',populateZoneAssignment);
document.getElementById('zoneTogglePolygons').addEventListener('click',()=>{zonesVisible=!zonesVisible;renderZonePolygons();document.getElementById('zoneTogglePolygons').textContent=zonesVisible?'Ocultar zonas':'Mostrar zonas'});
document.getElementById('zoneAssign').addEventListener('click',()=>{void assignZoneProspects()});
document.getElementById('deleteCancel').addEventListener('click',()=>{pendingDeleteId=null;document.getElementById('deleteModal').hidden=true});
document.getElementById('deleteConfirm').addEventListener('click',()=>{void confirmDeleteBusiness()});
document.getElementById('deleteModal').addEventListener('click',event=>{if(event.target===event.currentTarget){pendingDeleteId=null;event.currentTarget.hidden=true}});
