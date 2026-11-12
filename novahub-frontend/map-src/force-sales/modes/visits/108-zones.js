function hexPath(lat,lng,latRadius=.045,lngRadius=.065){
  return Array.from({length:6},(_,index)=>{
    const angle=Math.PI/6 + index * Math.PI/3;
    return {lat:lat + Math.sin(angle)*latRadius,lng:lng + Math.cos(angle)*lngRadius};
  });
}
const zoneShapes=Object.fromEntries(Object.entries(centers).map(([zone,[lat,lng]])=>[zone,hexPath(lat,lng)]));
const CELL_OFFSETS=[[0,0],[.026,0],[.013,.034],[-.013,.034],[-.026,0],[-.013,-.034],[.013,-.034]];
const zoneCells=Object.fromEntries(Object.entries(centers).map(([zone,[lat,lng]])=>[zone,CELL_OFFSETS.map(([latOffset,lngOffset],index)=>({
  id:`${zone}::${index+1}`,
  label:`${zone} · sector ${index+1}`,
  lat:lat+latOffset,
  lng:lng+lngOffset,
  paths:hexPath(lat+latOffset,lng+lngOffset,.015,.023)
}))]));
function nearestZoneCell(b){
  const cells=zoneCells[b?.zone] || [];
  return cells.reduce((best,cell)=>{
    const distance=(Number(b?.lat||0)-cell.lat)**2+(Number(b?.lng||0)-cell.lng)**2;
    return !best || distance<best.distance ? {cell,distance} : best;
  },null)?.cell || null;
}
function clearZonePolygons(){zonePolygons.forEach(polygon=>polygon.setMap(null));zonePolygons.clear()}
function renderZonePolygons(){
  clearZonePolygons();
  if(!zonesVisible)return;
  Object.entries(zoneCells).forEach(([zone,cells],zoneIndex)=>cells.forEach((cell,index)=>{
    const color=(zoneIndex+index)%2?'#0b8e69':'#2364d2';
    const polygon=new google.maps.Polygon({map:googleMap,paths:cell.paths,strokeColor:color,strokeOpacity:.58,strokeWeight:1.5,fillColor:color,fillOpacity:.06,clickable:true,zIndex:2});
    polygon.addListener('click',()=>{clearFocusedQuickPoint();selectedZone=zone;document.querySelectorAll('[data-zone]').forEach(button=>button.classList.toggle('active',button.dataset.zone===zone));render();googleMap.panTo({lat:cell.lat,lng:cell.lng});googleMap.setZoom(14)});
    zonePolygons.set(cell.id,polygon);
  }));
}
function populateZoneAssignment(){
  const zoneSelect=document.getElementById('zoneAssignmentZone');
  const cellSelect=document.getElementById('zoneAssignmentCell');
  const assigneeSelect=document.getElementById('zoneAssignmentAssignee');
  const assigneeLabel=document.getElementById('zoneAssignmentAssigneeLabel');
  const description=document.getElementById('zoneAssignmentDescription');
  if(assigneeSelect)assigneeSelect.hidden=!IS_PLATFORM_ADMIN;
  if(assigneeLabel)assigneeLabel.hidden=!IS_PLATFORM_ADMIN;
  if(description)description.textContent=IS_PLATFORM_ADMIN
    ? 'Visualiza las zonas operativas y asigna prospectos cargados a un vendedor. La asignación queda guardada en NovaHub.'
    : 'Visualiza las zonas y asigna cuadrantes a los prospectos de tu cartera. La asignación queda guardada en NovaHub.';
  const currentZone=zoneSelect?.value || selectedZone;
  if(zoneSelect)zoneSelect.innerHTML=Object.keys(zoneShapes).map(zone=>`<option value="${esc(zone)}" ${zone===currentZone?'selected':''}>${esc(zone)}</option>`).join('');
  const zone=zoneSelect?.value || selectedZone;
  const currentCell=cellSelect?.value || '';
  if(cellSelect)cellSelect.innerHTML='<option value="">Toda la zona</option>' + (zoneCells[zone] || []).map(cell=>`<option value="${esc(cell.id)}" ${cell.id===currentCell?'selected':''}>${esc(cell.label)}</option>`).join('');
  if(assigneeSelect)assigneeSelect.innerHTML='<option value="">Mi zona</option>' + assignees.map(item=>`<option value="${esc(item.id)}">${esc(item.name || item.email || 'Vendedor')}</option>`).join('');
  const cell=cellSelect?.value || '';
  const count=businesses.filter(b=>b.zone===zone&&!isDiscarded(b)&&(!cell || nearestZoneCell(b)?.id===cell)).length;
  const summary=document.getElementById('zoneAssignmentSummary');
  if(summary)summary.textContent=`${count} prospectos cargados en ${cell || zone}. La asignación se aplica a los registros visibles en NovaHub.`;
}
function openZoneManager(){populateZoneAssignment();document.getElementById('zoneModal').hidden=false}
async function assignZoneProspects(){
  if(!requireForceSales('assignProspect'))return;
  const zone=document.getElementById('zoneAssignmentZone')?.value || selectedZone;
  const cell=document.getElementById('zoneAssignmentCell')?.value || '';
  const assigneeId=IS_PLATFORM_ADMIN?(document.getElementById('zoneAssignmentAssignee')?.value || CURRENT_USER_ID || null):(CURRENT_USER_ID || null);
  const selected=businesses.filter(b=>b.zone===zone&&!isDiscarded(b)&&(!cell || nearestZoneCell(b)?.id===cell));
  if(!selected.length){toast('No hay prospectos cargados en esta zona');return}
  document.getElementById('zoneModal').hidden=true;
  let assignedCount=0;
  for(const business of selected){
    const assignedCellId=cell || nearestZoneCell(business)?.id || null;
    const saved=await persistProspectAction(business,'assignProspect','',{assignedToId:assigneeId,zoneCellId:assignedCellId});
    if(!saved)continue;
    const state=stateOf(business);state.assignedToId=assigneeId;state.assignedCellId=assignedCellId;assignedCount++;
  }
  persistCommercial();render();
  toast(`${assignedCount} de ${selected.length} prospectos asignados · ${cell || 'zona completa'}`);
}

