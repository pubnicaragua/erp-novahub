function nearestZone(lat,lng){
  let best='Managua', d=Infinity;
  Object.entries(centers).forEach(([n,c])=>{const x=(lat-c[0])**2+(lng-c[1])**2; if(x<d){d=x;best=n}});
  return best;
}
function scoreFor(cat, tags={}){
  const x = norm(cat + ' ' + Object.values(tags).join(' '));
  const hi = ['ferreteria','construccion','distribucion','industria','finanzas','combustible','farmacia','clinica','veterinaria','educacion','hospedaje','automotriz','tecnologia','supermercado','mayorista','centro comercial'];
  const med = ['restaurante','cafeteria','comercio','taller','servicios','mercado','belleza'];
  let s = hi.some(k=>x.includes(k)) ? 83 : med.some(k=>x.includes(k)) ? 68 : 53;
  if(tags.phone || tags['contact:phone']) s += 5;
  if(tags.website || tags['contact:website']) s += 3;
  return Math.min(s, 95);
}
function mergeBusinesses(){
  const m = new Map();
  const catalog = HAS_AUTHENTICATED_TENANT
    ? [...localPoints, ...remoteProspects]
    : (LEAD_DISCOVERY_ENABLED ? [...seed, ...localPoints, ...googlePlaces, ...remoteProspects] : [...remoteProspects]);
  catalog.forEach(b => {
    if(deletedBusinessKeys.has(String(keyOf(b))))return;
    const remoteId=stateOf(b).remoteId;
    const key = b.googlePlaceId ? `google:${b.googlePlaceId}` : remoteId ? `remote:${remoteId}` : `record:${b.id || norm(b.name) + '|' + norm(b.zone)}`;
    if(!m.has(key)) m.set(key, b);
    else {
      const old=m.get(key);
      const oldState=stateOf(old),nextState=stateOf(b);
      Object.assign(nextState,oldState,nextState);
      m.set(key,{...old,...b,source:old.source===b.source?b.source:`${old.source} + ${b.source}`});
    }
  });
  businesses = [...m.values()];
}
function pass(b){
  const q = norm(document.getElementById('search').value);
  const c = document.getElementById('category').value;
  const s = document.getElementById('source').value;
  const st = document.getElementById('state').value;
  if(selectedZone !== 'Todos' && b.zone !== selectedZone) return false;
  if(c !== 'all' && b.category !== c) return false;
  if(s !== 'all' && !b.source.includes(s)) return false;
  if(st === 'all' && isDiscarded(b)) return false;
  if(activeNearbyCenter && activeNearbyRadius && distanceMetersFromActive(b)>activeNearbyRadius) return false;
  if(st !== 'all' && statusOf(b) !== st) return false;
  if(pipelineFilter === 'found' && !isGoogleFound(b)) return false;
  if(pipelineFilter === 'selected' && !isSelected(b)) return false;
  if(pipelineFilter === 'kanban' && !isKanban(b)) return false;
  if(pipelineFilter === 'visited' && !isVisited(b)) return false;
  if(pipelineFilter === 'interested' && !isInterested(b)) return false;
  if(pipelineFilter === 'opportunities' && (b.score < 70 || isDiscarded(b))) return false;
  if(q && !norm([b.name,b.zone,b.category,b.address].join(' ')).includes(q)) return false;
  return true;
}
function icon(b){
  return markerSvg(b);
}
function shouldLabel(b){
  if(labelMode === 'off') return false;
  if(labelMode === 'all') return map.getZoom() >= 12;
  const z = map.getZoom();
  return (b.priority === 'A' && z >= 13) || (b.priority === 'B' && z >= 14) || (b.priority === 'C' && z >= 16);
}
function formatCustomerLinkedAt(value){
  const date=new Date(value);
  if(!value||Number.isNaN(date.getTime()))return null;
  try{return new Intl.DateTimeFormat('es-NI',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Managua'}).format(date)}
  catch{return date.toLocaleString('es-NI')}
}
function popupHtml(b){
  const f = followups[b.id] || {};
  const c = stateOf(b);
  const sid = safeId(b.id);
  const assignedUser=assignees.find(item=>String(item.id)===String(c.assignedToId||''));
  const isCurrentRouteStop=routeBusinesses.some(item=>keyOf(item)===keyOf(b));
  const routeAssigneeId=routeAssigneeDraftValue()||'';
  const routeAssignee=assignees.find(item=>String(item.id)===String(routeAssigneeId));
  const routeAssigneeDisplay=routeAssignee?.name||((routeAssigneeId&&String(routeAssigneeId)===String(CURRENT_USER_ID))?CURRENT_USER_NAME:'')||'Sin responsable de ruta';
  const prospectRoutes=remoteRoutes.filter(route=>(route.stops||[]).some(stop=>String(stop.prospectId||stop.prospect?.id)===String(c.remoteId||'')));
  const assigneeLoading=assigneesLoadState==='loading'&&!assignees.length;
  const assigneeNotice=assigneeStatusMessage();
  const selectedRouteName=document.getElementById('routeName')?.value.trim()||activeRemoteRoute()?.name||'Borrador actual';
  const gm = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.name + ' ' + b.address + ' Managua Nicaragua')}`;
  const syncReadout=c.syncPending
    ? `<div class="sync-readout pending">${esc(c.syncStatus || 'Pendiente de sincronización')} · este punto ya está guardado en el dispositivo.</div>`
    : c.syncStatus==='Sincronizado' ? '<div class="sync-readout synced">Sincronizado con NovaHub.</div>' : '';
  const customerLinkDisabled=!navigator.onLine||!c.remoteId||c.syncPending;
  const hasCustomerLink=Boolean(c.customerId||c.customer?.id);
  const customerLinkedAt=formatCustomerLinkedAt(c.customerLinkedAt);
  const customerLinkAttribution=hasCustomerLink
    ? customerLinkedAt
      ? `<div class="customer-link-attribution">Vinculado por <strong>${esc(c.customerLinkedBy?.name||'Usuario no disponible')}</strong> · ${esc(customerLinkedAt)}</div>`
      : `<div class="customer-link-attribution" role="status">La atribución de este vínculo anterior no está disponible.</div>`
    : '';
  const customerLinkPanel=CAN_LINK_CUSTOMER&&canForceSales('updateProspect')
    ? `<section class="crm customer-link-panel" data-customer-link-panel="${esc(b.id)}" aria-label="Vincular cliente de ventas">
        <div class="quick-heading">Cliente de ventas</div>
        <div class="customer-link-current" data-customer-link-current ${hasCustomerLink?'':'hidden'}>${hasCustomerLink?`${esc(c.customer?.name||'Cliente vinculado')}${c.customer?.code?` · ${esc(c.customer.code)}`:''}`:''}</div>
        ${hasCustomerLink?`${customerLinkAttribution}<button type="button" data-customer-link-unlink data-customer-link-control ${customerLinkDisabled?'disabled':''}>Quitar vínculo</button>`:`<button type="button" class="customer-link-trigger" data-customer-link-trigger data-customer-link-control aria-label="Seleccionar cliente de ventas" ${customerLinkDisabled?'disabled':''}><span>Seleccionar cliente</span><span class="customer-link-chevron" aria-hidden="true">⌄</span></button>`}
        <div class="customer-link-status" data-customer-link-status role="status" aria-live="polite">${!navigator.onLine?`Conéctate para ${hasCustomerLink?'quitar':'buscar'} clientes. Esta acción no se guarda offline.`:!c.remoteId||c.syncPending?'Sincroniza primero este punto comercial para cambiar el vínculo.':hasCustomerLink?'Quita el vínculo actual para seleccionar otro cliente.':'Abre el selector para buscar clientes activos.'}</div>
      </section>`
    : '';
  const evidenceReadout=c.evidencePreviewUrl
    ? `<div class="evidence-preview"><img src="${esc(c.evidencePreviewUrl)}" alt="Vista previa de evidencia"><span>${esc(c.evidenceName || 'Foto lista para guardar')}${c.evidencePending ? ' · pendiente de sincronizar' : ''}</span></div>`
    : c.evidenceName ? `<div class="meta">Evidencia: ${esc(c.evidenceName)}${c.evidencePending ? ' · pendiente de sincronizar' : ''}</div>` : '';
  return `<div class="popup">
    <h3>${esc(b.name)}</h3>
    <div class="sub">${esc(b.category)} · ${esc(b.zone)}</div>
    <div class="grid">
      <b>Dirección</b><span>${esc(b.address)}</span>
      <b>Fuente</b><span>${esc(b.source)}</span>
      <b>Responsable del punto</b><span>${esc(assignedUser?.name || c.assignedToName || 'Sin asignar')}</span>
      <b>Responsable de la ruta actual</b><span>${isCurrentRouteStop?esc(routeAssigneeDisplay):'No forma parte de la ruta actual'}</span>
    </div>
    <div class="route-point-memberships"><b>Rutas que incluyen este punto</b>${prospectRoutes.length?prospectRoutes.map(route=>`<span>${esc(route.name||'Ruta sin nombre')} · ${esc(routeDateLabel(routeDateValue(route)))} · ${esc(route.assignedTo?.name||'Sin asignar')} · ${esc(({PLANNED:'Planificada',IN_PROGRESS:'En curso',COMPLETED:'Completada',CANCELLED:'Cancelada'})[String(route.status||'').toUpperCase()]||'Sin estado')}</span>`).join(''):'<span>No aparece en rutas guardadas de tu alcance.</span>'}${forceSalesSyncErrors.has('rutas')?'<span role="status">No se pudieron comprobar todas las rutas.</span>':''}</div>
    ${customerLinkPanel}
    ${customerDebtHtml(b)}
    ${visitHistoryHtml(b)}
    ${routePlanningMode&&isCurrentRouteStop?`<div class="meta">Parada de la ruta: ${esc(selectedRouteName)}</div>`:''}
    ${CAN_ASSIGN_PROSPECT_OWNER&&canForceSales('assignProspect') ? `<div class="crm"><div class="quick-heading">Asignación comercial</div><label for="point-assignee-${sid}">Responsable del punto</label><select id="point-assignee-${sid}" ${assigneeLoading?'disabled':''}><option value="">Sin asignar</option>${assignees.map(item=>`<option value="${esc(item.id)}" ${String(item.id)===String(c.assignedToId||'')?'selected':''}>${esc(item.name||'Usuario')}</option>`).join('')}</select>${assigneeNotice?`<div class="meta" role="status" aria-live="polite">${esc(assigneeNotice)}</div>`:''}${assigneesLoadState==='error'?'<button class="assignee-retry" type="button">Reintentar carga de usuarios</button>':''}<button type="button" onclick="saveProspectAssignee('${b.id}')" ${assigneeLoading?'disabled':''}>Guardar responsable</button></div>` : ''}
    <div class="warn">${esc(b.precision)}. Validar actividad, ubicación y persona de contacto antes de la visita.</div>
    ${syncReadout}
    ${evidenceReadout}
    <div class="popactions">
      <a href="${gm}" target="_blank">Abrir Maps</a>
      <a href="https://waze.com/ul?ll=${encodeURIComponent(b.lat + ',' + b.lng)}&navigate=yes" target="_blank">Abrir Waze</a>
    </div>
    <div class="popquick">
      <button class="${c.selected?'primary-action':''}" onclick="toggleSelected('${b.id}')">${c.selected?'✓ Seleccionado':'Seleccionar'}</button>
      ${canForceSales('changeStage') ? (c.kanban ? '<button disabled>✓ Ya en Fuerza Comercial</button>' : `<button class="primary-action" onclick="addToKanban('${b.id}')">Agregar al Kanban</button>`) : ''}
      ${visitOutcomeSelectHtml(sid)}
      ${canForceSales('registerVisit') ? `<button class="visit-action" onclick="registerVisit('${b.id}')">⌖ Registrar visita</button>` : ''}
      ${canForceSales('discardProspect') ? `<button onclick="discardBusiness('${b.id}')">Descartar</button>` : ''}
      ${CAN_DELETE_TEST ? `<button onclick="deleteBusiness('${b.id}')">Eliminar negocio</button>` : ''}
    </div>
    ${c.visitedAt ? `<div class="visit-readout">Visita registrada ${new Date(c.visitedAt).toLocaleString('es-NI')} · ${c.visitLat?.toFixed?.(5) || '—'}, ${c.visitLng?.toFixed?.(5) || '—'}</div>` : ''}
    ${(canForceSales('updateProspect') || canForceSales('changeStage') || canForceSales('attachEvidence') || canForceSales('manageConsent')) ? `<div class="crm">
      <div class="quick-heading">Seguimiento rápido</div>
      ${canForceSales('updateProspect') ? `
      <label>Persona de contacto</label>
      <input id="contact-${sid}" maxlength="120" value="${esc(c.contactName || '')}" placeholder="Nombre del contacto">
      <label>Teléfono / WhatsApp</label>
      <input id="phone-${sid}" maxlength="40" value="${esc(c.contactPhone || b.phone || '')}" placeholder="+505 8888 8888">
      ` : ''}
      ${canForceSales('changeStage') ? `
      <label>Estado comercial</label>
      <select id="st-${sid}">
        ${['Nuevo','Contactado','Visitado','Interesado','Demo','Negociación','Cliente'].map(x => `<option ${statusOf(b)===x?'selected':''}>${x}</option>`).join('')}
      </select>
      ` : ''}
      ${canForceSales('updateProspect') ? `
      <label>Próximo contacto</label>
      <input id="dt-${sid}" type="date" value="${esc(f.date||'')}">
      <label>Notas</label>
      <textarea id="nt-${sid}" placeholder="Contacto, tamaño, necesidad, decisión...">${esc(f.note||'')}</textarea>
      ` : ''}
      ${canForceSales('attachEvidence') ? `
      <label>Evidencia opcional</label>
      <input id="ev-${sid}" type="file" accept="image/*,.pdf" capture="environment">
      <div class="evidence-preview" id="ev-preview-${sid}" hidden></div>
      ` : ''}
      ${c.evidenceUri ? `<button type="button" onclick="openEvidence('${b.id}')">Ver evidencia</button>` : ''}
      ${(canForceSales('updateProspect') || canForceSales('changeStage') || canForceSales('attachEvidence')) ? `<button onclick="saveFollowup('${b.id}')">Guardar seguimiento</button>` : ''}
      ${canForceSales('manageConsent') ? `
      <details class="advanced-crm">
        <summary>Opcional: WhatsApp y consentimiento</summary>
        <div class="advanced-content">
          <label>WhatsApp y consentimiento</label>
          <input id="wa-${sid}" type="tel" value="${esc(c.whatsappPhone || b.phone || '')}" placeholder="+505 8888 8888">
          <input id="wa-source-${sid}" type="text" value="${esc(c.whatsappOptInSource || '')}" placeholder="Fuente: formulario, llamada o visita">
          <label class="consent"><input id="wa-optin-${sid}" type="checkbox" ${c.whatsappOptIn?'checked':''}> Confirmo que existe opt-in explícito</label>
          <button type="button" onclick="saveWhatsAppConsent('${b.id}')">Guardar consentimiento</button>
          ${c.whatsappOptIn ? `<div class="meta">Apto para plantilla oficial de Meta · ${esc(c.whatsappOptInSource || 'fuente no indicada')}</div>` : '<div class="meta">Sin opt-in: no se habilita envío automatizado.</div>'}
        </div>
      </details>
      ` : ''}
    </div>` : ''}
  </div>`;
}
function findBusiness(id){return businesses.find(x=>x.id===id)}
function findBusinessByKey(key){return businesses.find(x=>x.id===key || keyOf(x)===key)}
let pendingPointCoords = null;
function clearPendingQuickPointMarker(){
  if(pendingPointMarker)setNovaMarkerMap(pendingPointMarker,null);
  pendingPointMarker=null;
}
function clearFocusedQuickPoint({closeWindow=true}={}){
  if(currentPopupBusinessId&&String(currentPopupBusinessId)===String(focusedQuickPointBusinessId||''))closeBusinessDetailPopup({clearFocusedMarker:false});
  if(focusedQuickPointMarker)setNovaMarkerMap(focusedQuickPointMarker,null);
  if(focusedQuickPointBusinessId && markerById.get(focusedQuickPointBusinessId)===focusedQuickPointMarker)markerById.delete(focusedQuickPointBusinessId);
  focusedQuickPointMarker=null;
  focusedQuickPointBusinessId=null;
  focusedQuickPointPopupOpen=false;
  if(closeWindow)infoWindow.close();
}
async function saveCustomerLink(rawBusinessId,customerId,customerSnapshot){
  const business=findBusiness(String(rawBusinessId||''));
  const panel=[...document.querySelectorAll('[data-customer-link-panel]')].find(item=>item.dataset.customerLinkPanel===String(rawBusinessId||''));
  if(!CAN_LINK_CUSTOMER||!canForceSales('updateProspect'))return requireForceSales('updateProspect');
  if(!navigator.onLine){setCustomerLookupStatus(panel,'Conéctate para guardar el vínculo. Esta acción no se guarda offline.');toast('Vincular clientes requiere conexión');return false}
  if(!localStorage.getItem('nh-auth-token')){setCustomerLookupStatus(panel,'Inicia sesión para vincular clientes.');toast('Inicia sesión para cambiar el vínculo');return false}
  if(!business||!stateOf(business).remoteId||stateOf(business).syncPending){setCustomerLookupStatus(panel,'Sincroniza primero este punto comercial.');toast('El punto debe estar sincronizado para vincular un cliente');return false}
  const state=stateOf(business);
  const controls=panel?.querySelectorAll('[data-customer-link-control]')||[];
  controls.forEach(control=>{control.disabled=true});
  setCustomerLookupStatus(panel,customerId?'Guardando vínculo…':'Quitando vínculo…');
  try{
    const updated=await forceSalesRequest(`/force-sales/prospects/${encodeURIComponent(state.remoteId)}`,{method:'PATCH',body:JSON.stringify({customerId:customerId||null})});
    const linkedCustomer=customerId?(updated?.customer||customerSnapshot||null):null;
    state.customerId=customerId||null;
    state.customer=linkedCustomer;
    state.customerLinkedAt=customerId?updated?.customerLinkedAt||null:null;
    state.customerLinkedBy=customerId?updated?.customerLinkedBy||null:null;
    business.customerId=state.customerId;
    business.customer=linkedCustomer;
    business.customerLinkedAt=state.customerLinkedAt;
    business.customerLinkedBy=state.customerLinkedBy;
    forgetPointExtras(business);
    persistCommercial();
    rerenderKeepingPopup(business);
    toast(customerId?'Cliente vinculado al punto comercial':'Vínculo de cliente retirado');
    return true;
  }catch(error){
    const message=String(error?.message||'No se pudo guardar el vínculo del cliente.');
    setCustomerLookupStatus(panel,message);
    toast(message);
    return false;
  }finally{
    setCustomerLookupAvailability(panel);
  }
}
function refreshFocusedQuickPointPopup(){
  if(!focusedQuickPointMarker || !focusedQuickPointBusinessId)return;
  const business=findBusiness(focusedQuickPointBusinessId);
  if(!business)return;
  focusedQuickPointMarker._b=business;
  bindMapMarkerPopup(focusedQuickPointMarker,()=>popupHtml(business));
  if(focusedQuickPointPopupOpen)focusedQuickPointMarker.openPopup();
}
function focusQuickPoint(business){
  clearFocusedQuickPoint();
  const marker=createMapMarker({
    position:{lat:Number(business.lat),lng:Number(business.lng)},
    title:business.name,
    content:createQuickPointMarkerContent(true),
    map:googleMap,
    zIndex:1700,
  });
  marker._b=business;
  marker.bindTooltip=()=>marker;
  marker.unbindTooltip=()=>marker;
  bindMapMarkerPopup(marker,()=>popupHtml(business));
  focusedQuickPointMarker=marker;
  focusedQuickPointBusinessId=business.id;
  focusedQuickPointPopupOpen=false;
  markerById.set(business.id,marker);
  focusRenderLockUntil=Date.now()+1600;
  map.flyTo([business.lat,business.lng],17);
  let popupOpened=false;
  const openAfterPan=()=>{
    if(popupOpened)return;
    if(focusedQuickPointMarker===marker && focusedQuickPointBusinessId===business.id)marker.openPopup();
    popupOpened=true;
  };
  google.maps.event.addListenerOnce(googleMap,'idle',openAfterPan);
  window.setTimeout(openAfterPan,600);
}
async function focusProspectFromNotification(rawId){
  const targetId=String(rawId||'').trim();
  if(!targetId)return;
  let business=businesses.find(item=>String(stateOf(item).remoteId||'')===targetId);
  if(!business){
    try{
      const prospect=await forceSalesRequest(`/force-sales/prospects/${encodeURIComponent(targetId)}`);
      if(!prospect?.id)throw new Error('No se encontró el punto');
      business=remoteBusiness(prospect);
      stateOf(business).remoteId=prospect.id;
      remoteProspects=[...remoteProspects.filter(item=>String(item.id)!==String(business.id)),business];
      mergeBusinesses();populateFilters();render();
      business=businesses.find(item=>String(stateOf(item).remoteId||'')===targetId)||business;
    }catch(error){
      toast('El punto ya no existe o no pertenece a tu sucursal.');
      window.parent?.postMessage({source:'novahub-force-sales',type:'force-sales-focus-complete'},location.origin);
      return;
    }
  }
  if(!Number.isFinite(Number(business.lat))||!Number.isFinite(Number(business.lng))){
    toast('El punto no tiene coordenadas para mostrar en el mapa.');
    window.parent?.postMessage({source:'novahub-force-sales',type:'force-sales-focus-complete'},location.origin);
    return;
  }
  activeView='map';updateView();focusQuickPoint(business);
  window.parent?.postMessage({source:'novahub-force-sales',type:'force-sales-focus-complete'},location.origin);
}
async function focusRouteFromNotification(rawId){
  const routeId=String(rawId||'').trim();
  if(!routeId)return;
  try{
    const route=await forceSalesRequest(`/force-sales/routes/${encodeURIComponent(routeId)}`);
    if(!route?.id)throw new Error('Ruta no disponible');
    remoteRoutes=[route,...remoteRoutes.filter(item=>String(item.id)!==routeId)];
    activeView='map';updateView();
    if(openSavedRoute(routeId))toast('Ruta abierta desde la notificación');
  }catch(error){
    toast('Esta ruta ya no está disponible para tu usuario o sucursal.');
  }finally{
    window.parent?.postMessage({source:'novahub-force-sales',type:'force-sales-focus-route-complete'},location.origin);
  }
}
function updatePendingQuickPointPosition(position,{source=pendingPointSource,accuracy=pendingPointAccuracy}={}){
  const coordinates=window.NovaForceSalesLocation.normalizeCoordinates(position);
  if(!coordinates)return;
  pendingPointCoords=coordinates;
  pendingPointSource=source;
  pendingPointAccuracy=accuracy != null && accuracy !== '' && Number.isFinite(Number(accuracy)) ? Number(accuracy) : null;
  if(pendingPointMarker?.setPosition)pendingPointMarker.setPosition(coordinates);
  const location=document.getElementById('quickCaptureLocation');
  if(location)location.textContent=window.NovaForceSalesLocation.formatCaptureLocation({...coordinates,source:pendingPointSource,accuracy:pendingPointAccuracy});
}
