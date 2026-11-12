function norm(s=''){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function safeId(s){return String(s).replace(/[^a-zA-Z0-9_-]/g,'_')}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function keyOf(b){return b?.googlePlaceId || b?.id || b}
function stateOf(b){const key=keyOf(b); if(!commercialState[key]) commercialState[key]={}; return commercialState[key]}
function persistCommercial(){localStorage.setItem('novaFuerzaComercialV1', JSON.stringify(commercialState))}
function statusOf(b){return followups[b.id]?.status || stateOf(b).stage || 'Nuevo'}
function isSelected(b){return stateOf(b).selected === true}
function isKanban(b){return stateOf(b).kanban === true}
function isVisited(b){return Boolean(stateOf(b).visitedAt || statusOf(b)==='Visitado')}
function isInterested(b){return statusOf(b)==='Interesado'}
function isDiscarded(b){return stateOf(b).discarded === true || statusOf(b)==='Descartado'}
function isGoogleFound(b){return String(b?.source || '').includes('Nova')}
function stateClass(b){if(isDiscarded(b)) return 'discarded'; if(isInterested(b)) return 'interested'; if(isVisited(b)) return 'visited'; if(isKanban(b)) return 'kanban'; if(isSelected(b)) return 'selected'; return ''}
function selectedBusinesses(){return businesses.filter(isSelected)}
function distanceMetersFromActive(b){
  if(!activeNearbyCenter)return Infinity;
  return Math.hypot((Number(b.lat)-activeNearbyCenter.lat)*111000,(Number(b.lng)-activeNearbyCenter.lng)*111000*Math.cos(activeNearbyCenter.lat*Math.PI/180));
}
function distanceLabel(b){
  if(!activeNearbyCenter)return '';
  const meters=distanceMetersFromActive(b);
  return meters<1000 ? `${Math.round(meters)} m` : `${(meters/1000).toFixed(1)} km`;
}
const stages = ['Nuevo','Contactado','Visitado','Interesado','Demo','Negociación','Cliente','Descartado'];
const apiStageByUi = {Nuevo:'NEW',Contactado:'CONTACTED',Visitado:'VISITED',Interesado:'INTERESTED',Demo:'DEMO','Negociación':'NEGOTIATION',Cliente:'CLIENT',Descartado:'DISCARDED'};
const uiStageByApi = Object.fromEntries(Object.entries(apiStageByUi).map(([ui,api]) => [api,ui]));
function stageToApi(stage){return apiStageByUi[stage] || 'NEW'}
function stageToUi(stage){return uiStageByApi[String(stage || '').toUpperCase()] || 'Nuevo'}
function apiHeaders(token=localStorage.getItem('nh-auth-token')){
  return token ? {'Content-Type':'application/json',Authorization:`Bearer ${token}`} : {'Content-Type':'application/json'};
}
async function forceSalesRequest(path, options={}){
  const token=localStorage.getItem('nh-auth-token') || '';
  if(token&&!window.NovaForceSalesOfflineIdentity.tokenMatchesIdentity(token,CURRENT_IDENTITY)){
    throw new Error('La sesión activa cambió. Actualiza Fuerza Comercial antes de sincronizar.');
  }
  const response=await fetch(`${API_BASE}${path}`,{...options,headers:{...apiHeaders(token),...(options.headers||{})},cache:'no-store'});
  const text=await response.text();
  let body=null;
  try{body=text ? JSON.parse(text) : null}catch(error){body=text || null}
  if(!response.ok){
    const message=typeof body==='string' ? body : body?.message || body?.error || `HTTP ${response.status}`;
    const failure=new Error(String(message));
    failure.status=response.status;
    failure.payload=body;
    throw failure;
  }
  return body;
}
function forceSalesRefreshScopeFor(event){
  // Un aviso del servidor dice qué cambió y solo eso se recarga (un aviso de recorrido ya no recarga prospectos ni
  // rutas). Una llamada interna (reconexión, vuelta de la conexión, acción de la persona) recarga todo.
  const resource=event&&event.eventId?String(event.resource||''):'';
  if(resource==='location-trail')return['trail'];
  if(resource==='presence')return['presence'];
  if(resource==='route')return['routes','presence'];
  if(resource==='prospect')return['prospects','routes'];
  return event&&event.resource==='location-trail'?['prospects','routes','presence','trail']:['prospects','routes','presence'];
}
function scheduleForceSalesRefresh(){
  if(forceSalesRefreshInFlight||forceSalesRefreshTimer||!forceSalesRefreshScope.size)return;
  const wait=forceSalesRefreshImmediate?0:Math.max(0,forceSalesLastRefreshAt+FORCE_SALES_REFRESH_MIN_MS-Date.now());
  if(wait>0){forceSalesRefreshTimer=setTimeout(()=>{forceSalesRefreshTimer=0;scheduleForceSalesRefresh()},wait);return}
  forceSalesRefreshImmediate=false;
  forceSalesRefreshInFlight=true;
  const scope=forceSalesRefreshScope;
  forceSalesRefreshScope=new Set();
  const work=[];
  if(scope.has('prospects'))work.push(loadRemoteProspects());
  if(scope.has('routes'))work.push(loadRemoteRoutes());
  if(scope.has('routes')&&ACTIVE_MODE==='visits')work.push(loadWorkZones());
  if(scope.has('presence'))work.push(loadSellerPresence());
  if(scope.has('trail')&&shouldLoadLocationTrail())work.push(loadLocationTrail({fitCamera:false}));
  void Promise.all(work).catch(()=>undefined).finally(()=>{
    forceSalesRefreshInFlight=false;
    forceSalesLastRefreshAt=Date.now();
    scheduleForceSalesRefresh();
  });
}
function refreshForceSalesData(event={}){
  if(event.clientTenantId&&CURRENT_TENANT_ID&&event.clientTenantId!==CURRENT_TENANT_ID)return;
  forceSalesRefreshScopeFor(event).forEach(item=>forceSalesRefreshScope.add(item));
  // Los avisos del servidor (varios por minuto con muchos vendedores) se agrupan: como máximo un refresco cada 5 s.
  // Una acción de la persona o una reconexión recarga sin esperar.
  if(!event.eventId){
    forceSalesRefreshImmediate=true;
    if(forceSalesRefreshTimer){clearTimeout(forceSalesRefreshTimer);forceSalesRefreshTimer=0}
  }
  scheduleForceSalesRefresh();
}
function setForceSalesSyncError(resource,error){
  const message=String(error?.message || error || '').trim();
  if(message)forceSalesSyncErrors.set(resource,message);
  else forceSalesSyncErrors.delete(resource);
  updateOfflineStatus();
}
function setCustomerLookupStatus(panel,message){
  const status=panel?.querySelector('[data-customer-link-status]');
  if(status)status.textContent=String(message||'');
}
function setCustomerLookupAvailability(panel){
  if(!panel)return;
  const business=findBusiness(panel.dataset.customerLinkPanel);
  const state=business?stateOf(business):{};
  const linked=Boolean(business?.customerId||business?.customer?.id);
  const unavailable=!navigator.onLine||!state.remoteId||state.syncPending;
  panel.querySelectorAll('[data-customer-link-control]').forEach(control=>{control.disabled=unavailable});
  if(!navigator.onLine)setCustomerLookupStatus(panel,linked?'Conéctate para quitar el vínculo. Esta acción no se guarda offline.':'Conéctate para seleccionar un cliente. Esta acción no se guarda offline.');
  else if(!state.remoteId||state.syncPending)setCustomerLookupStatus(panel,'Sincroniza primero este punto comercial para cambiar el vínculo.');
  else if(linked)setCustomerLookupStatus(panel,'Quita el vínculo actual para seleccionar otro cliente.');
}
function requestCustomerLinkSelection(trigger){
  const panel=trigger?.closest?.('[data-customer-link-panel]');
  const pointId=String(panel?.dataset.customerLinkPanel||'').trim();
  const business=findBusiness(pointId);
  const state=business?stateOf(business):{};
  if(!panel||trigger.disabled||!pointId)return;
  if(!CAN_LINK_CUSTOMER||!canForceSales('updateProspect'))return requireForceSales('updateProspect');
  if(!navigator.onLine||!state.remoteId||state.syncPending){setCustomerLookupAvailability(panel);return}
  setCustomerLookupStatus(panel,'Selecciona un cliente activo.');
  window.parent?.postMessage({source:'novahub-force-sales',type:'force-sales-open-customer-link',pointId,point:{name:String(business?.name||''),address:String(business?.address||''),phone:String(business?.phone||'')}},location.origin);
}
document.addEventListener('click',event=>{
  const trigger=event.target?.closest?.('[data-customer-link-trigger]');
  if(trigger){event.preventDefault();requestCustomerLinkSelection(trigger);return}
  const unlink=event.target?.closest?.('[data-customer-link-unlink]');
  if(unlink){event.preventDefault();void saveCustomerLink(unlink.closest('[data-customer-link-panel]')?.dataset.customerLinkPanel,null,null)}
});
function updateCustomerLookupAvailability(){document.querySelectorAll('[data-customer-link-panel]').forEach(setCustomerLookupAvailability)}
window.addEventListener('online',updateCustomerLookupAvailability);
window.addEventListener('offline',updateCustomerLookupAvailability);
window.addEventListener('message',event=>{
  if(event.source!==window.parent||event.origin!==window.location.origin||event.data?.source!=='novahub-force-sales')return;
  if(event.data?.type==='force-sales-refresh')refreshForceSalesData(event.data.event||{});
  if(event.data?.type==='force-sales-customer-link-selected'){
    const pointId=String(event.data.pointId||'').trim();
    const customer=event.data.customer;
    if(pointId&&customer?.id)void saveCustomerLink(pointId,String(customer.id),customer);
  }
  if(event.data?.type==='force-sales-stream-status'){
    forceSalesRealtimeConnected=event.data.status==='connected';
    updateOfflineStatus();
    if(forceSalesRealtimeConnected)refreshForceSalesData({resource:'location-trail'});
  }
  if(event.data?.type==='force-sales-focus-prospect')void focusProspectFromNotification(event.data.targetId);
  if(event.data?.type==='force-sales-focus-route')void focusRouteFromNotification(event.data.routeId);
});
