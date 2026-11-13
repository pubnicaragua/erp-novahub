let renderFrame=0;
function scheduleRender(){cancelAnimationFrame(renderFrame);renderFrame=requestAnimationFrame(render)}
['search','category','source','state'].forEach(id => {
  document.getElementById(id).addEventListener(id==='search' ? 'input' : 'change', id==='search' ? () => {clearFocusedQuickPoint();listLimit=140;scheduleRender()} : () => {clearFocusedQuickPoint();listLimit=140;render()});
});
document.querySelectorAll('#labels button').forEach(btn => btn.addEventListener('click', () => {
  labelMode = window.NovaForceSalesLocation.normalizeMapLayers({...mapLayers,labelMode:btn.dataset.mode}).labelMode;
  mapLayers={...mapLayers,labelMode};
  persistMapLayers();
  syncBusinessLabelControls();
  applyLabels();
}));
function syncBusinessLabelControls(){
  document.querySelectorAll('#labels button').forEach(button=>{
    const active=button.dataset.mode===labelMode;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
}
document.getElementById('refresh').addEventListener('click', () => loadGooglePlaces(true));
document.getElementById('currentZoneButton')?.addEventListener('click',event=>{
  event.stopPropagation();
  document.querySelector('#zoneChips [data-zone="Managua"]')?.click();
});
document.getElementById('toggleAllZones')?.addEventListener('click',event=>{
  const button=event.currentTarget;
  const chips=document.getElementById('zoneChips');
  if(!chips)return;
  const expanded=chips.classList.toggle('expanded');
  button.setAttribute('aria-expanded',String(expanded));
  button.innerHTML=expanded?'Ver menos <span aria-hidden="true">↑</span>':'Ver todas <span aria-hidden="true">→</span>';
});
document.getElementById('filterControls')?.addEventListener('change',syncFilterSummary);
document.getElementById('searchGoogle').addEventListener('click', () => searchGooglePlaces(document.getElementById('search').value,{force:true}));
document.getElementById('searchViewport').addEventListener('click', () => {
  const inSelectedZone=selectedZone && selectedZone!=='Todos';
  searchGooglePlaces(document.getElementById('search').value,{force:true,visibleOnly:!inSelectedZone});
});
document.getElementById('search').addEventListener('keydown', event => {if(event.key==='Enter'){event.preventDefault();searchGooglePlaces(event.currentTarget.value,{force:true})}});
document.getElementById('clearGoogleCache').addEventListener('click', () => {
  Object.keys(localStorage).filter(key=>key.startsWith('novaGooglePlacesCacheV')).forEach(key=>localStorage.removeItem(key));
  setSearchStatus('Datos locales de Nova limpiados. La próxima búsqueda será en vivo.'); toast('Datos limpiados');
});
document.getElementById('clearCatalog').addEventListener('click', async () => {
  if(!requireForceSales('delete'))return;
  if(!window.confirm('Se eliminarán clientes, rutas y paradas de la empresa activa. ¿Continuar?'))return;
  try{
    const result=await forceSalesRequest('/force-sales/prospects',{method:'DELETE'});
    localPoints=[];googlePlaces=[];remoteProspects=[];remoteRoutes=[];lastRemoteProspectsSignature='';
    localStorage.removeItem(LOCAL_POINTS_KEY);localStorage.removeItem(GOOGLE_CATALOG_KEY);
    Object.keys(localStorage).filter(key=>key.startsWith('novaGooglePlacesCacheV')).forEach(key=>localStorage.removeItem(key));
    mergeBusinesses();populateFilters();render();renderSavedRouteOptions();
    toast(`${result?.deleted || 0} clientes eliminados`);
  }catch(error){
    toast(error?.message || 'No se pudo limpiar la base comercial');
  }
});
function setActiveView(view){
  const changed=activeView!==view;
  const previousView=activeView;
  if(changed)clearFocusedQuickPoint();
  if(changed&&view!=='map'&&view!=='history'){locationTrailRequestId++;locationTrailRefreshRequested=false;currentLocationTrailData=null;clearLocationTrail()}
  activeView=view;
  if(changed)document.getElementById('sheet')?.querySelector('.scroll')?.scrollTo({top:0,behavior:'auto'});
  if(view==='map'){pipelineFilter='all';if(!mapLayers.gpsTrail){locationTrailRequestId++;locationTrailRefreshRequested=false;currentLocationTrailData=null;clearLocationTrail()}render();loadSellerPresence();if(mapLayers.gpsTrail)void loadLocationTrail({fitCamera:false});return}
  if(view==='kanban')pipelineFilter='kanban';
  updateView();
  if(view==='history'&&CAN_ASSIGN_TEAM)void loadLocationTrail({fitCamera:false});
}
document.getElementById('kanbanToggle').addEventListener('click',()=>setActiveView(activeView==='kanban'?'map':'kanban'));
document.getElementById('historyToggle').addEventListener('click',()=>setActiveView(activeView==='history'?'map':'history'));
document.querySelectorAll('#viewTabs [data-view]').forEach(button=>button.addEventListener('click',()=>setActiveView(button.dataset.view)));
document.querySelectorAll('[data-map-layer]').forEach(input=>input.addEventListener('change',event=>setMapLayer(event.currentTarget.dataset.mapLayer,event.currentTarget.checked)));
document.getElementById('resetMapLayers').addEventListener('click',resetCleanMap);
document.getElementById('openMapLayers')?.addEventListener('click',openMapLayers);
document.getElementById('loadMapTrail').addEventListener('click',()=>void loadLocationTrail({fitCamera:true}));
document.getElementById('mapTrailOriginals').addEventListener('change',renderLocationTrail);
document.getElementById('mapTrailDate').value=localDateInputValue();
updateMapLayerControls();
document.querySelectorAll('.kpi[data-pipeline]').forEach(el=>el.addEventListener('click',()=>{clearFocusedQuickPoint();pipelineFilter=el.dataset.pipeline;render()}));
document.getElementById('opportunities').addEventListener('click',()=>{clearFocusedQuickPoint();activeView='map';pipelineFilter='opportunities';render();toast('Mostrando oportunidades con afinidad de 70% o más')});
document.getElementById('selectVisible').addEventListener('click',()=>{filtered.forEach(b=>stateOf(b).selected=true);persistCommercial();render();toast(`${filtered.length} negocios seleccionados`)});
document.getElementById('clearSelection').addEventListener('click',()=>{businesses.forEach(b=>stateOf(b).selected=false);persistCommercial();render();toast('Selección limpiada')});
document.getElementById('showAllBusinesses').addEventListener('click',()=>{
  selectedZone='Todos';
  document.getElementById('category').value='all';
  document.getElementById('source').value='all';
  document.getElementById('state').value='all';
  visitFilter='all';
  syncVisitChips();
  document.getElementById('search').value='';
  activeNearbyCenter=null;
  activeNearbyRadius=null;
  pipelineFilter='all';
  listLimit=140;
  clearFocusedQuickPoint();
  populateFilters();
  map.flyTo([12.115,-86.26],11,{duration:.6});
  render();
});
document.getElementById('bulkKanban').addEventListener('click',addSelectedToKanban);
document.getElementById('bulkRoute').addEventListener('click',addSelectedToRoute);
document.getElementById('routeImportQuick').addEventListener('click',()=>{openRoutePlanner([]);window.parent?.postMessage({source:'novahub-force-sales',type:'request-import-file'},'*')});
document.getElementById('routePlannerQuick').addEventListener('click',()=>openRoutePlanner([]));
document.getElementById('bulkVisit').addEventListener('click',visitSelected);
document.getElementById('bulkWhatsApp').addEventListener('click',sendSelectedWhatsApp);
document.getElementById('bulkDiscard').addEventListener('click',discardSelected);
document.getElementById('locateMe').addEventListener('click',locateMe);
document.getElementById('locationSettings').addEventListener('click',openLocationSettings);
document.getElementById('mapConfigurationButton').addEventListener('click',openMapConfiguration);
document.getElementById('saveMapConfiguration').addEventListener('click',()=>void saveMapConfiguration());
map.on('zoomend', applyLabels);
function updateOfflineStatus(){
  const label=document.getElementById('offlineStatusText');
  if(!label)return;
  const firstError=forceSalesSyncErrors.entries().next().value;
  document.getElementById('panelStatus')?.setAttribute('data-ok',String(navigator.onLine&&!firstError));
  const detail=!navigator.onLine
    ? 'Sin sincronizar · sin conexión; el catálogo compartido no está confirmado'
    : firstError
      ? `Sin sincronizar · ${firstError[0]}: ${firstError[1]}`
      : forceSalesRealtimeConnected
        ? 'Conectado · catálogo y ubicaciones compartidos'
        : 'Reconectando · respaldo de sincronización cada 15 s';
  label.title=detail;
  label.textContent=(!navigator.onLine||firstError)?'Sin sincronizar · toca para ver el detalle':detail;
  if(!label.dataset.bound){label.dataset.bound='1';label.addEventListener('click',()=>{if(label.title&&/^Sin sincronizar/.test(label.title))toast(label.title)})}
}
window.addEventListener('online',()=>{updateOfflineStatus();void loadPendingRouteActions().then(()=>flushPendingRouteActions());flushOutbox().finally(()=>refreshForceSalesData({resource:'location-trail'}));startPresenceWatch()});
window.addEventListener('offline',updateOfflineStatus);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){void loadPendingRouteActions().then(()=>{if(navigator.onLine)void flushPendingRouteActions()});if(navigator.onLine){refreshForceSalesData({resource:'location-trail'});startPresenceWatch()}}else stopPresenceWatch()});
void loadPendingRouteActions().then(()=>{if(navigator.onLine)void flushPendingRouteActions()});
window.setInterval(()=>{
    if(document.visibilityState!=='visible'||!navigator.onLine)return;
    if(Date.now()-lastForceSalesConfigRefreshAt>=60000){
      lastForceSalesConfigRefreshAt=Date.now();
      loadForceSalesConfiguration();
    }
    loadSellerPresence();
    if(Date.now()-lastOutboxFlushAt>=10000){
      lastOutboxFlushAt=Date.now();
      flushOutbox().finally(()=>refreshForceSalesData());
      void loadPendingRouteActions().then(()=>flushPendingRouteActions());
    }
    if(Date.now()-lastRemoteRefreshAt>=(forceSalesRealtimeConnected?60000:15000)){
      lastRemoteRefreshAt=Date.now();
      refreshForceSalesData();
    }
    if(shouldLoadLocationTrail()&&Date.now()-lastLocationTrailRefreshAt>=15000)void loadLocationTrail({fitCamera:false});
  },3000);

