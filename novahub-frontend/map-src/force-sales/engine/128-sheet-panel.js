const sheet = document.getElementById('sheet');
const toggle = document.getElementById('mobileSheetToggle');
const togglePresence = document.getElementById('togglePresence');
togglePresence?.addEventListener('click',()=>void setPresenceSharing(!presenceSharingEnabled));
updatePresenceToggle();
if(canForceSales('updatePresence')&&presenceSharingEnabled){
  presenceWatchRequested=true;
  startPresenceWatch();
}
let sheetDrag=null;
let lastSheetDragMoved=false;
function updateToggle(){
  const expanded=!sheet.classList.contains('collapsed');
  toggle.textContent='Panel';
  toggle.setAttribute('aria-label',expanded?'Ocultar panel':'Abrir panel');
  toggle.setAttribute('aria-expanded',String(expanded));
}
function setSheetPreset(mode){
  if(innerWidth>820)return;
  sheet.classList.remove('dragging');
  sheet.classList.toggle('workspace-view',activeView!=='map');
  sheet.style.removeProperty('height');
  sheet.classList.toggle('collapsed',mode==='collapsed');
  updateToggle();
}
function snapSheet(height){
  const min=126, max=Math.max(min,innerHeight-14), points=[min,Math.min(Math.round(innerHeight*.52),480),Math.min(Math.round(innerHeight*.86),max)];
  const target=points.reduce((best,point)=>Math.abs(point-height)<Math.abs(best-height)?point:best,points[0]);
  sheet.classList.remove('dragging');
  sheet.classList.toggle('collapsed',target===min);
  sheet.style.height=`${target}px`;
  updateToggle();
}
function beginSheetDrag(event){
  if(innerWidth>820||event.target.closest('button,input,select,a'))return;
  sheetDrag={startY:event.clientY,startHeight:sheet.getBoundingClientRect().height,moved:false};
  lastSheetDragMoved=false;
  sheet.classList.add('dragging');
  event.currentTarget.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}
function moveSheetDrag(event){
  if(!sheetDrag)return;
  const delta=event.clientY-sheetDrag.startY;
  if(Math.abs(delta)>6){sheetDrag.moved=true;lastSheetDragMoved=true}
  const next=Math.max(126,Math.min(innerHeight-14,sheetDrag.startHeight-delta));
  sheet.classList.remove('collapsed');sheet.style.height=`${next}px`;
  event.preventDefault();
}
function endSheetDrag(){
  if(!sheetDrag)return;
  const height=sheet.getBoundingClientRect().height; const moved=sheetDrag.moved; sheetDrag=null;
  if(moved)snapSheet(height); else {sheet.classList.remove('dragging');updateToggle()}
}
const sheetHeader=document.getElementById('sheetHeader');
sheetHeader.addEventListener('pointerdown',beginSheetDrag);
sheetHeader.addEventListener('pointermove',moveSheetDrag);
sheetHeader.addEventListener('pointerup',endSheetDrag);
sheetHeader.addEventListener('pointercancel',endSheetDrag);
sheetHeader.addEventListener('click',()=>{
  if(innerWidth<=820&&!lastSheetDragMoved){setSheetPreset(sheet.classList.contains('collapsed')?'expanded':'collapsed')}
  lastSheetDragMoved=false;
});
toggle.addEventListener('click', () => setSheetPreset(sheet.classList.contains('collapsed')?'expanded':'collapsed'));
window.addEventListener('resize',()=>{
  if(innerWidth>820){sheet.classList.remove('collapsed','workspace-view','dragging');sheet.style.removeProperty('height')}
  else if(activeView!=='map'){sheet.classList.add('workspace-view');sheet.classList.remove('collapsed');sheet.style.removeProperty('height')}
  updateToggle();
});
