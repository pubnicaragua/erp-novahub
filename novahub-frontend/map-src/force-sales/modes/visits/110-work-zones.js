// Modo «Visitas y zonas»: zonas de trabajo circulares con un gestor responsable. Se pueden crear, ajustar y reasignar
// a otro gestor (por enfermedad o salida de la empresa); al reasignar, los puntos de la zona pasan con ella.
let workZones = [];
let workZoneCircles = new Map();
let workZonesLoading = false;
let workZoneDraft = null;
let workZoneDrawing = false;
let workZoneReassignId = '';
let workZonePreview = null;
const WORK_ZONE_COLORS = ['#2364d2', '#08785a', '#cb5a2b', '#8557b8', '#b18a00', '#167d8d', '#b63872'];

function workZoneColor(zone){
  const key = String(zone.assignedToId || zone.id);
  let hash = 0;
  for(const char of key)hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return zone.assignedToId ? WORK_ZONE_COLORS[hash % WORK_ZONE_COLORS.length] : '#83928d';
}
function workZoneRadiusLabel(meters){
  return meters >= 1000 ? `${(meters / 1000).toLocaleString('es-NI', {maximumFractionDigits:1})} km` : `${meters} m`;
}
function canManageWorkZones(){return canForceSales('createRoute') && CAN_ASSIGN_TEAM}
function workZoneAssigneeName(zone){
  return zone.assignedTo?.name || assignees.find(item => String(item.id) === String(zone.assignedToId || ''))?.name || '';
}
function clearWorkZoneCircles(){
  workZoneCircles.forEach(circle => circle.setMap(null));
  workZoneCircles.clear();
}
function renderWorkZoneCircles(){
  clearWorkZoneCircles();
  if(ACTIVE_MODE !== 'visits' || !window.google?.maps?.Circle || !googleMap)return;
  workZones.forEach(zone => {
    const color = workZoneColor(zone);
    const circle = new google.maps.Circle({map:googleMap, center:{lat:zone.centerLat, lng:zone.centerLng}, radius:zone.radiusMeters, strokeColor:color, strokeOpacity:.75, strokeWeight:2, fillColor:color, fillOpacity:.08, clickable:true, zIndex:1});
    circle.addListener?.('click', () => focusWorkZone(zone.id));
    workZoneCircles.set(zone.id, circle);
  });
}
function renderWorkZoneList(){
  const list = document.getElementById('workZoneList');
  const newButton = document.getElementById('workZoneNew');
  if(newButton)newButton.hidden = !canManageWorkZones();
  if(!list)return;
  if(workZonesLoading && !workZones.length){list.innerHTML = '<div class="meta" role="status">Cargando zonas…</div>';return}
  if(!workZones.length){
    list.innerHTML = `<div class="meta">${canManageWorkZones() ? 'Todavía no hay zonas. Crea una con «Nueva zona»: toca el mapa para marcar el centro.' : 'No tienes zonas asignadas.'}</div>`;
    return;
  }
  list.innerHTML = workZones.map(zone => {
    const owner = workZoneAssigneeName(zone);
    return `<div class="work-zone-item" role="listitem" data-work-zone="${esc(zone.id)}">
      <span class="work-zone-swatch" style="background:${workZoneColor(zone)}" aria-hidden="true"></span>
      <div class="work-zone-copy"><b>${esc(zone.name)}</b><small>${esc(workZoneRadiusLabel(zone.radiusMeters))} · ${owner ? esc(owner) : '<em>Sin gestor</em>'}</small></div>
      <div class="work-zone-actions">
        <button type="button" data-work-zone-action="focus" aria-label="Ver la zona ${esc(zone.name)} en el mapa">Ver</button>
        ${canForceSales('assignRoute') && CAN_ASSIGN_TEAM ? `<button type="button" data-work-zone-action="reassign" aria-label="Reasignar la zona ${esc(zone.name)}">Reasignar</button>` : ''}
        ${canForceSales('editRoute') && CAN_ASSIGN_TEAM ? `<button type="button" data-work-zone-action="delete" aria-label="Quitar la zona ${esc(zone.name)}">Quitar</button>` : ''}
      </div>
    </div>`;
  }).join('');
}
async function loadWorkZones(){
  if(ACTIVE_MODE !== 'visits' || !localStorage.getItem('nh-auth-token'))return;
  if(workZonesLoading)return;
  workZonesLoading = true;
  renderWorkZoneList();
  try{
    const rows = await forceSalesRequest('/force-sales/zones');
    workZones = Array.isArray(rows) ? rows : [];
    forceSalesSyncErrors.delete('zonas');
  }catch(error){
    setForceSalesSyncError('zonas', error);
  }finally{
    workZonesLoading = false;
    renderWorkZoneList();
    renderWorkZoneCircles();
    window.NovaForceSalesModes.requestSummary();
  }
}
function focusWorkZone(id){
  const zone = workZones.find(item => item.id === id);
  if(!zone || !googleMap)return;
  googleMap.panTo({lat:zone.centerLat, lng:zone.centerLng});
  googleMap.setZoom(Math.max(10, Math.min(18, Math.round(15 - Math.log2(Math.max(zone.radiusMeters, 100) / 500)))));
  document.querySelectorAll('[data-work-zone]').forEach(node => node.classList.toggle('active', node.dataset.workZone === id));
}
function fillAssigneeSelect(select, selected){
  if(!select)return;
  select.innerHTML = `<option value="">Sin gestor</option>${assignees.map(item => `<option value="${esc(item.id)}" ${String(item.id) === String(selected || '') ? 'selected' : ''}>${esc(item.name || item.email || item.id)}</option>`).join('')}`;
}
function startWorkZoneDrawing(){
  if(!canManageWorkZones()){requireForceSales('createRoute');return}
  workZoneDrawing = true;
  if(innerWidth <= 820)document.getElementById('sheet')?.classList.add('collapsed');
  const hint = document.getElementById('workZoneHint');
  if(hint)hint.hidden = false;
  document.getElementById('map')?.classList.add('drawing-zone');
}
function stopWorkZoneDrawing(){
  workZoneDrawing = false;
  const hint = document.getElementById('workZoneHint');
  if(hint)hint.hidden = true;
  document.getElementById('map')?.classList.remove('drawing-zone');
}
function openWorkZoneEditor(center){
  workZoneDraft = {centerLat:center.lat, centerLng:center.lng};
  const modal = document.getElementById('workZoneModal');
  if(!modal)return;
  document.getElementById('workZoneName').value = `Zona ${workZones.length + 1}`;
  setWorkZoneRadius(1000);
  showWorkZonePreview(center);
  fillAssigneeSelect(document.getElementById('workZoneAssignee'), '');
  modal.hidden = false;
  const nameInput = document.getElementById('workZoneName');
  nameInput.focus();
  nameInput.select();
}
function showWorkZonePreview(center){
  if(workZonePreview){workZonePreview.setMap(null);workZonePreview = null}
  if(!window.google?.maps?.Circle || !googleMap)return;
  workZonePreview = new google.maps.Circle({map:googleMap, center, radius:Number(document.getElementById('workZoneRadius').value) || 1000, strokeColor:'#08785a', strokeOpacity:.9, strokeWeight:2, fillColor:'#08785a', fillOpacity:.14, clickable:false, zIndex:2});
  const radius = Number(document.getElementById('workZoneRadius').value) || 1000;
  googleMap.panTo(center);
  googleMap.setZoom(Math.max(10, Math.min(17, Math.round(15 - Math.log2(Math.max(radius, 100) / 500)))));
}
function setWorkZoneRadius(meters){
  document.getElementById('workZoneRadius').value = String(meters);
  document.querySelectorAll('#workZoneRadiusChips [data-radius]').forEach(chip => chip.classList.toggle('active', Number(chip.dataset.radius) === Number(meters)));
  workZonePreview?.setRadius(meters);
}
function closeWorkZoneEditor(){
  if(workZonePreview){workZonePreview.setMap(null);workZonePreview = null}
  workZoneDraft = null;
  const modal = document.getElementById('workZoneModal');
  if(modal)modal.hidden = true;
}
async function saveWorkZone(){
  if(!workZoneDraft)return;
  if(!requireForceSales('createRoute'))return;
  const name = document.getElementById('workZoneName').value.trim();
  const radiusMeters = Number(document.getElementById('workZoneRadius').value);
  const assignedToId = document.getElementById('workZoneAssignee').value || null;
  const status = document.getElementById('workZoneEditorStatus');
  if(!name){status.textContent = 'Escribe el nombre de la zona.';return}
  if(!Number.isFinite(radiusMeters) || radiusMeters < 50 || radiusMeters > 50000){status.textContent = 'El radio debe estar entre 50 m y 50 km.';return}
  if(!navigator.onLine){status.textContent = 'Conéctate para guardar la zona. Esta acción no se guarda sin conexión.';return}
  try{
    const saved = await forceSalesRequest('/force-sales/zones', {method:'POST', body:JSON.stringify({name, centerLat:workZoneDraft.centerLat, centerLng:workZoneDraft.centerLng, radiusMeters, assignedToId})});
    workZones = [...workZones.filter(item => item.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    closeWorkZoneEditor();
    renderWorkZoneList();
    renderWorkZoneCircles();
    window.NovaForceSalesModes.requestSummary();
    toast(`Zona «${saved.name}» creada`);
  }catch(error){
    status.textContent = String(error?.message || 'No se pudo guardar la zona.');
  }
}
function openWorkZoneReassign(id){
  const zone = workZones.find(item => item.id === id);
  const modal = document.getElementById('workZoneReassignModal');
  if(!zone || !modal)return;
  workZoneReassignId = id;
  document.getElementById('workZoneReassignTitle').textContent = `Reasignar «${zone.name}»`;
  const owner = workZoneAssigneeName(zone);
  document.getElementById('workZoneReassignInfo').textContent = owner ? `Gestor actual: ${owner}. Elige quién la recibe.` : 'La zona no tiene gestor. Elige quién la recibe.';
  const select = document.getElementById('workZoneReassignAssignee');
  select.innerHTML = `<option value="">Elige un gestor…</option>${assignees.filter(item => String(item.id) !== String(zone.assignedToId || '')).map(item => `<option value="${esc(item.id)}">${esc(item.name || item.email || item.id)}</option>`).join('')}`;
  document.getElementById('workZoneMovePoints').checked = true;
  document.getElementById('workZoneReassignStatus').textContent = '';
  modal.hidden = false;
  select.focus();
}
function closeWorkZoneReassign(){
  workZoneReassignId = '';
  const modal = document.getElementById('workZoneReassignModal');
  if(modal)modal.hidden = true;
}
async function confirmWorkZoneReassign(){
  if(!workZoneReassignId || !requireForceSales('assignRoute'))return;
  const assigneeId = document.getElementById('workZoneReassignAssignee').value;
  const movePoints = document.getElementById('workZoneMovePoints').checked;
  const status = document.getElementById('workZoneReassignStatus');
  if(!assigneeId){status.textContent = 'Elige el gestor que recibe la zona.';return}
  if(!navigator.onLine){status.textContent = 'Conéctate para reasignar. Esta acción no se guarda sin conexión.';return}
  try{
    const result = await forceSalesRequest(`/force-sales/zones/${encodeURIComponent(workZoneReassignId)}/reassign`, {method:'POST', body:JSON.stringify({assigneeId, movePoints})});
    workZones = workZones.map(item => item.id === result.zone.id ? result.zone : item);
    closeWorkZoneReassign();
    renderWorkZoneList();
    renderWorkZoneCircles();
    toast(`Zona reasignada a ${result.zone.assignedTo?.name || 'el nuevo gestor'}${movePoints ? ` · ${result.movedPoints} ${result.movedPoints === 1 ? 'punto pasó' : 'puntos pasaron'} con ella` : ''}`);
    void loadRemoteProspects();
  }catch(error){
    status.textContent = String(error?.message || 'No se pudo reasignar la zona.');
  }
}
async function removeWorkZone(id){
  const zone = workZones.find(item => item.id === id);
  if(!zone || !requireForceSales('editRoute'))return;
  if(!window.confirm(`¿Quitar la zona «${zone.name}»? Los puntos conservan su gestor.`))return;
  try{
    await forceSalesRequest(`/force-sales/zones/${encodeURIComponent(id)}`, {method:'DELETE'});
    workZones = workZones.filter(item => item.id !== id);
    renderWorkZoneList();
    renderWorkZoneCircles();
    window.NovaForceSalesModes.requestSummary();
    toast('Zona quitada');
  }catch(error){toast(String(error?.message || 'No se pudo quitar la zona'))}
}
// El motor tiene un solo manejador de clic en el mapa: mientras se marca el centro de una zona lo atiende esta función.
function handleWorkZoneMapClick(event){
  if(!workZoneDrawing)return false;
  const lat = typeof event?.latLng?.lat === 'function' ? event.latLng.lat() : Number(event?.latLng?.lat);
  const lng = typeof event?.latLng?.lng === 'function' ? event.latLng.lng() : Number(event?.latLng?.lng);
  if(Number.isFinite(lat) && Number.isFinite(lng)){
    stopWorkZoneDrawing();
    openWorkZoneEditor({lat, lng});
  }
  return true;
}
if(ACTIVE_MODE === 'visits'){
  document.getElementById('workZoneNew')?.addEventListener('click', startWorkZoneDrawing);
  document.getElementById('workZoneList')?.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-work-zone-action]');
    const id = event.target?.closest?.('[data-work-zone]')?.dataset.workZone;
    if(!id)return;
    if(!button){focusWorkZone(id);return}
    const action = button.dataset.workZoneAction;
    if(action === 'focus')focusWorkZone(id);
    if(action === 'reassign')openWorkZoneReassign(id);
    if(action === 'delete')void removeWorkZone(id);
  });
  document.getElementById('workZoneSave')?.addEventListener('click', () => void saveWorkZone());
  document.getElementById('workZoneCancel')?.addEventListener('click', closeWorkZoneEditor);
  document.getElementById('workZoneHintCancel')?.addEventListener('click', stopWorkZoneDrawing);
  document.getElementById('workZoneRadiusChips')?.addEventListener('click', event => {
    const chip = event.target?.closest?.('[data-radius]');
    if(chip)setWorkZoneRadius(Number(chip.dataset.radius));
  });
  document.getElementById('workZoneReassignConfirm')?.addEventListener('click', () => void confirmWorkZoneReassign());
  document.getElementById('workZoneReassignCancel')?.addEventListener('click', closeWorkZoneReassign);
}

// ----- Lista de clientes del modo visitas ------------------------------------------------------------------------
function visitItemHtml(b){
  const visited=isVisited(b);
  const at=stateOf(b).visitedAt;
  const when=visited&&at&&!Number.isNaN(new Date(at).getTime())?' · '+new Date(at).toLocaleDateString('es-NI',{day:'numeric',month:'short'}):'';
  return '<div class="item visit-item" data-id="'+esc(b.id)+'">'
    +'<div class="itemtop"><div><div class="itemname">'+esc(b.name)+'</div><div class="meta">'+esc(b.address||b.zone||'Sin dirección')+'</div></div>'
    +'<span class="visit-pill '+(visited?'done':'pending')+'">'+(visited?'Visitado'+when:'Por visitar')+'</span></div>'
    +'<div class="item-actions">'
    +(canForceSales('registerVisit')?'<button class="visit-action" data-action="visit" data-id="'+esc(b.id)+'">Registrar visita</button>':'')
    +'<button data-action="navigate-google" data-id="'+esc(b.id)+'">Google Maps</button>'
    +'<button data-action="navigate-waze" data-id="'+esc(b.id)+'">Waze</button>'
    +'</div></div>';
}
function emptyListHtml(totalInMap){
  let title='Sin resultados';
  let hint='Cambia los filtros o la búsqueda.';
  if(ACTIVE_MODE==='visits'&&!totalInMap){title='Todavía no hay clientes en tu mapa';hint='Importa tus clientes con «Importar clientes» o marca uno con «Nuevo punto».'}
  else if(ACTIVE_MODE==='delivery'&&!totalInMap){title='Sin puntos para la ruta';hint='Pulsa «Nueva ruta» o marca un punto con «Nuevo punto».'}
  else if(ACTIVE_MODE==='prospecting'&&!totalInMap){title='Aún no hay negocios';hint='Usa «Cerca de mí» o «Buscar vista» para encontrar negocios cercanos.'}
  return '<div class="empty-list"><b>'+title+'</b><span>'+hint+'</span></div>';
}
function openNavigationToBusiness(id,app){
  const b=businesses.find(item=>String(item.id)===String(id));
  if(!b||!Number.isFinite(b.lat)||!Number.isFinite(b.lng))return;
  const url=app==='waze'
    ?'https://waze.com/ul?ll='+b.lat+','+b.lng+'&navigate=yes'
    :'https://www.google.com/maps/dir/?api=1&destination='+b.lat+','+b.lng+'&travelmode=driving';
  window.open(url,'_blank','noopener');
}
function fitMapToBusinessesOnce(items){
  const points=items.filter(b=>Number.isFinite(b.lat)&&Number.isFinite(b.lng));
  if(!points.length)return;
  initialFitDone=true;
  if(points.length===1){map.flyTo([points[0].lat,points[0].lng],15,{duration:.4});return}
  const bounds=new google.maps.LatLngBounds();
  points.forEach(b=>bounds.extend({lat:b.lat,lng:b.lng}));
  googleMap.fitBounds(bounds,64);
}
function syncVisitChips(){
  document.querySelectorAll('[data-visit-filter]').forEach(chip=>chip.classList.toggle('active',chip.dataset.visitFilter===visitFilter));
}
document.querySelectorAll('[data-visit-filter]').forEach(chip=>chip.addEventListener('click',()=>{
  visitFilter=chip.dataset.visitFilter||'all';
  syncVisitChips();
  render();
}));
document.getElementById('deliveryNewRoute')?.addEventListener('click',()=>openRoutePlanner(selectedBusinesses()));
