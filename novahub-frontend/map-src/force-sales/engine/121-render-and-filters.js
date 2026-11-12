function renderHistory(){
  const history=document.getElementById('historyView');
  if(!history) return;
  const tracked=businesses.filter(b=>isKanban(b)||isVisited(b)||stateOf(b).remoteId||stateOf(b).evidenceName).sort((a,b)=>{
    const aDate=stateOf(a).visitedAt || followups[a.id]?.updatedAt || '';
    const bDate=stateOf(b).visitedAt || followups[b.id]?.updatedAt || '';
    return String(bDate).localeCompare(String(aDate));
  });
  const userOptions=CAN_ASSIGN_TEAM ? `<label for="locationTrailUser">Vendedor<select id="locationTrailUser"><option value="">Todos los vendedores</option>${assignees.map(item=>`<option value="${esc(item.id)}">${esc(item.name||item.email||'Vendedor')}</option>`).join('')}</select></label>` : '';
  history.innerHTML=`<section class="history-card location-trail-controls"><div class="history-card-top"><div><h3>Trayectoria GPS aproximada</h3><div class="meta">Une las lecturas recibidas en línea recta; no representa necesariamente las calles recorridas.</div></div></div><div class="location-trail-fields"><label for="locationTrailDate">Día<input id="locationTrailDate" type="date" value="${localDateInputValue()}"></label>${userOptions}<button class="primary-action" id="loadLocationTrail" type="button">Ver recorrido</button></div><label class="history-originals-toggle" for="historyTrailOriginals"><input id="historyTrailOriginals" type="checkbox"> Ver lecturas originales, aisladas</label><div class="map-layer-legend" id="locationTrailLegend" aria-label="Leyenda del recorrido GPS"></div><div class="meta" id="locationTrailStatus" role="status" aria-live="polite">Elige un día para consultar los puntos sincronizados.</div></section>` + (tracked.length ? tracked.map(b=>{
    const c=stateOf(b); const f=followups[b.id] || {};
    const when=c.visitedAt || f.updatedAt;
    return `<article class="history-card">
      <div class="history-card-top"><div><h3>${esc(b.name)}</h3><div class="meta">${esc(b.zone)} · ${esc(b.category)}</div></div><span class="history-status">${esc(statusOf(b))}</span></div>
      <div class="meta">${when ? `Actualizado ${new Date(when).toLocaleString('es-NI',{dateStyle:'short',timeStyle:'short'})}` : 'Guardado en Fuerza Comercial'}${c.visitLat != null ? ` · ubicación ${Number(c.visitLat).toFixed(5)}, ${Number(c.visitLng).toFixed(5)}` : ''}</div>
      ${f.note ? `<div class="meta">${esc(f.note)}</div>` : ''}
      ${c.evidenceName ? `<div class="meta">Evidencia: ${esc(c.evidenceName)}${c.evidencePending ? ' · pendiente de sincronizar' : ''}</div>` : ''}
      <div class="history-card-actions"><button class="primary-action" data-history-open="${esc(b.id)}">Ver en mapa</button>${c.evidenceUri ? `<button data-history-evidence="${esc(b.id)}">Ver evidencia</button>` : ''}</div>
    </article>`;
  }).join('') : '<div class="history-empty">Todavía no hay seguimientos comerciales guardados. Los recorridos GPS aparecerán arriba cuando existan puntos sincronizados.</div>');
  syncTrailUserSelect(document.getElementById('locationTrailUser'));
  history.querySelector('#loadLocationTrail')?.addEventListener('click',()=>void loadLocationTrail({fitCamera:true}));
  history.querySelector('#locationTrailDate')?.addEventListener('change',()=>void loadLocationTrail({fitCamera:true}));
  history.querySelector('#locationTrailUser')?.addEventListener('change',()=>void loadLocationTrail({fitCamera:true}));
  history.querySelector('#historyTrailOriginals')?.addEventListener('change',renderLocationTrail);
  history.querySelectorAll('[data-history-open]').forEach(el=>el.addEventListener('click',()=>{
    const b=findBusiness(el.dataset.historyOpen); if(!b)return;
    activeView='map'; updateView(); pipelineFilter='all'; render();
    googleMap.panTo({lat:b.lat,lng:b.lng}); googleMap.setZoom(16);
    setTimeout(()=>markerById.get(b.id)?.openPopup(),500);
  }));
  history.querySelectorAll('[data-history-evidence]').forEach(el=>el.addEventListener('click',()=>window.openEvidence(el.dataset.historyEvidence)));
}
function updateView(){
  const list=document.getElementById('list'); const board=document.getElementById('kanbanBoard'); const history=document.getElementById('historyView'); const toggle=document.getElementById('kanbanToggle');
  const mapView=activeView==='map'; const kanban=activeView==='kanban';
  document.body.classList.toggle('embedded-view',mapQuery.get('embedded')==='1');
  document.body.classList.toggle('standalone-view',!mapView);
  document.body.classList.toggle('workspace-kanban',kanban);
  document.body.classList.toggle('workspace-history',!mapView&&!kanban);
  if(list)list.hidden=!mapView;
  if(board)board.hidden=!kanban;
  if(history)history.hidden=mapView||kanban;
  const heading=document.getElementById('workspaceHeading');
  const headingTitle=document.getElementById('workspaceHeadingTitle');
  const headingMeta=document.getElementById('workspaceHeadingMeta');
  if(heading){heading.hidden=mapView;if(headingTitle)headingTitle.textContent=kanban?'Kanban comercial':'Historial de visitas';if(headingMeta)headingMeta.textContent=kanban?'Prospectos asignados y etapas':'Visitas, notas y evidencias'}
  if(!mapView){closeBusinessDetailPopup();infoWindow.close()}
  if(toggle)toggle.textContent=kanban?'▦ Volver al mapa':'▦ Ver Kanban';
  document.querySelectorAll('#viewTabs [data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===activeView));
  const sheet=document.getElementById('sheet');
  if(sheet && innerWidth<=820){
     sheet.classList.toggle('workspace-view',!mapView);
     if(!mapView){sheet.classList.remove('collapsed');sheet.style.removeProperty('height')}
    else sheet.style.removeProperty('height');
  }
  if(kanban)renderKanban();
  if(!mapView&&!kanban)renderHistory();
}
function render(){
  const layerVisibleBusinesses=businesses.filter(business=>window.NovaForceSalesLocation.isBusinessVisibleInLayers(business,mapLayers,focusedQuickPointBusinessId));
  filtered = layerVisibleBusinesses.filter(pass);
  if(activeNearbyCenter){
    filtered.sort((a,b)=>distanceMetersFromActive(a)-distanceMetersFromActive(b)||a.name.localeCompare(b.name));
  }else filtered.sort((a,b)=>a.priority.localeCompare(b.priority)||b.score-a.score||a.name.localeCompare(b.name));
  if(routeVicinityPreview)renderRouteVicinityPreview();
  cluster.clearLayers();
  markerById.clear();
  const currentBounds=googleMap.getBounds?.();
  const zoom=googleMap.getZoom() || 11;
  const mapLimit=innerWidth<=820 ? (zoom<13 ? 60 : 100) : (zoom<13 ? 180 : 320);
  const selectedMapBusinesses=window.NovaForceSalesLocation.selectMapBusinesses({
    filteredBusinesses:filtered,
    allBusinesses:layerVisibleBusinesses,
    currentBounds,
    limit:mapLimit,
    focusedId:focusedQuickPointBusinessId,
  });
  const routeStopKeys=new Set(routeBusinesses.map(keyOf));
  const mapBusinesses=selectedMapBusinesses.filter(b=>String(b.id)!==String(focusedQuickPointBusinessId || '')&&(!routePlanningMode||!routeStopKeys.has(keyOf(b))));
  mapBusinesses.forEach(b => {
    const m = L.marker([b.lat, b.lng], {icon: icon(b), title:b.name});
    m._b = b;
    m.bindPopup(() => popupHtml(b), {maxWidth:340});
    markerById.set(b.id, m);
    cluster.addLayer(m);
  });
  cluster.refresh();
  renderRouteMarkers();
  if(focusedQuickPointMarker && focusedQuickPointBusinessId){
    const focusedBusiness=findBusiness(focusedQuickPointBusinessId);
    if(focusedBusiness){
      focusedQuickPointMarker._b=focusedBusiness;
      bindMapMarkerPopup(focusedQuickPointMarker,()=>popupHtml(focusedBusiness));
      markerById.set(focusedBusiness.id,focusedQuickPointMarker);
    }else clearFocusedQuickPoint();
  }
  if(currentPopupBusinessId)refreshBusinessDetailOverlay();
  applyLabels();

  updatePipelineKpis(layerVisibleBusinesses);
  document.getElementById('resultText').textContent = `${filtered.length} de ${layerVisibleBusinesses.length}`;
  const showAllBusinesses=document.getElementById('showAllBusinesses');
  const categoryFilter=document.getElementById('category');
  const sourceFilter=document.getElementById('source');
  const stateFilter=document.getElementById('state');
  const searchFilter=document.getElementById('search');
  const hasActiveFilters=selectedZone!=='Todos'||categoryFilter.value!=='all'||sourceFilter.value!=='all'||stateFilter.value!=='all'||Boolean(searchFilter.value.trim())||pipelineFilter!=='all'||Boolean(activeNearbyCenter&&activeNearbyRadius);
  showAllBusinesses.hidden=!hasActiveFilters;
  const selectedCount=selectedBusinesses().length;
  const routeTop=document.getElementById('routeTop');
  if(routeTop)routeTop.textContent=routeDraftDirty ? `Retomar ruta (${routeBusinesses.length})` : 'Armar ruta';
  document.getElementById('bulkbar')?.classList.toggle('is-empty',selectedCount===0);

  const list = document.getElementById('list');
  const visibleResults = filtered.slice(0, listLimit);
  list.innerHTML = visibleResults.map(b => `
    <div class="item ${isSelected(b)?'selected-item ':''}${isKanban(b)?'kanban-item':''}" data-id="${esc(b.id)}">
      <div class="itemtop">
        <input class="check" type="checkbox" data-action="select" data-id="${esc(b.id)}" ${isSelected(b)?'checked':''} aria-label="Seleccionar ${esc(b.name)}">
        <div>
          <div class="itemname">${esc(b.name)}</div>
          <div class="meta">${esc(b.zone)} · ${esc(b.category)}${activeNearbyCenter ? ` · ${esc(distanceLabel(b))}` : ''}</div>
        </div>
      </div>
      <span class="status">${esc(isKanban(b)?'En Kanban':statusOf(b))} · ${b.score}% afinidad</span>
       <div class="item-actions">
         <button data-action="select" data-id="${esc(b.id)}">${isSelected(b)?'✓ Seleccionado':'Seleccionar'}</button>
         ${canForceSales('changeStage') ? `<button class="primary-action" data-action="kanban" data-id="${esc(b.id)}">${isKanban(b)?'✓ Kanban':'Kanban'}</button>` : ''}
         ${canForceSales('registerVisit') ? `<button class="visit-action" data-action="visit" data-id="${esc(b.id)}">Visitar</button>` : ''}
         ${CAN_DELETE_TEST ? `<button data-action="delete" data-id="${esc(b.id)}">Eliminar</button>` : ''}
       </div>
    </div>`).join('') + (filtered.length > listLimit ? `<div class="item"><button class="show-more-results" id="showMoreResults" type="button">Mostrar más resultados (${filtered.length - listLimit} disponibles)</button></div>` : '');
  document.querySelectorAll('.item[data-id]').forEach(el => el.addEventListener('click', () => {
    const b = businesses.find(x => x.id === el.dataset.id);
    if(!b) return;
    clearFocusedQuickPoint();
    focusRenderLockUntil=Date.now()+1400;
    map.flyTo([b.lat, b.lng], 16, {duration:.65});
    if(innerWidth <= 820) document.getElementById('sheet').classList.add('collapsed');
    setTimeout(() => {render();requestAnimationFrame(()=>markerById.get(b.id)?.openPopup())}, 620);
  }));
  document.querySelectorAll('[data-action="select"]').forEach(el => el.addEventListener('click', e => {e.stopPropagation();toggleSelected(el.dataset.id)}));
  document.querySelectorAll('[data-action="kanban"]').forEach(el => el.addEventListener('click', e => {e.stopPropagation();addToKanban(el.dataset.id)}));
  document.querySelectorAll('[data-action="visit"]').forEach(el => el.addEventListener('click', e => {e.stopPropagation();registerVisit(el.dataset.id)}));
  document.querySelectorAll('[data-action="delete"]').forEach(el => el.addEventListener('click', e => {e.stopPropagation();deleteBusiness(el.dataset.id)}));
  document.getElementById('showMoreResults')?.addEventListener('click', () => {listLimit += 140; render()});
  updateView();
}
function populateFilters(){
  const preferredZones=['Carretera Norte','Masaya','Ticuantepe','Managua','Ciudad Sandino','Veracruz'];
  const orderedZones=[...preferredZones.filter(zone=>centers[zone]),...Object.keys(centers).filter(zone=>!preferredZones.includes(zone))];
  const zonesList = ['Todos',...orderedZones];
  document.getElementById('zoneChips').innerHTML = zonesList.map(z => `<button class="chip ${z===selectedZone?'active':''}" data-zone="${z}">${z}</button>`).join('');
  const zoneSearchButton=document.getElementById('searchViewport');
  if(zoneSearchButton)zoneSearchButton.textContent=selectedZone==='Todos'?'Buscar vista':'Buscar zona';
  document.querySelectorAll('[data-zone]').forEach(btn => btn.addEventListener('click', () => {
    clearFocusedQuickPoint();
    selectedZone = btn.dataset.zone;
    activeNearbyCenter=null;
    activeNearbyRadius=null;
    document.querySelectorAll('[data-zone]').forEach(x => x.classList.toggle('active', x === btn));
    const zoneSearchButton=document.getElementById('searchViewport');
    if(zoneSearchButton)zoneSearchButton.textContent=selectedZone==='Todos'?'Buscar vista':'Buscar zona';
    render();
    if(selectedZone === 'Todos') map.flyTo([12.115,-86.26], 11, {duration:.6});
    else map.flyTo(centers[selectedZone], selectedZone==='Ciudad Sandino'||selectedZone==='Veracruz' ? 14 : 13, {duration:.6});
  }));
  const cats = [...new Set(businesses.map(x => x.category))].sort();
  const sel = document.getElementById('category');
  const cur = sel.value;
  sel.innerHTML = '<option value="all">Todos los rubros</option>' + cats.map(c => `<option>${esc(c)}</option>`).join('');
  if(cats.includes(cur)) sel.value = cur;
  syncFilterSummary();
}
function syncFilterSummary(){
  const summary=document.getElementById('filterSummaryText');
  if(!summary)return;
  const values=['category','source','state'].map(id=>{
    const control=document.getElementById(id);
    return control?.selectedOptions?.[0]?.textContent?.trim()||'';
  }).filter(Boolean);
  summary.textContent=values.join(' · ');
  summary.title=values.join(' · ');
}
