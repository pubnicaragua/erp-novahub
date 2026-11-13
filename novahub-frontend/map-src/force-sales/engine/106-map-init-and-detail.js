let zonePolygons = new Map();
let zonesVisible = false;
let map3DEnabled = mapQuery.get('map3d') !== 'false';
let activeNearbyCenter = null;
let activeNearbyRadius = null;

if(NOVAHUB_ISOTIPO_URL){
  const brandIcon=document.querySelector('.logoicon');
  if(brandIcon) brandIcon.innerHTML=`<img src="${esc(NOVAHUB_ISOTIPO_URL)}" alt="NovaHub">`;
}
function setCompanyLogo(uri){
  const brandIcon=document.querySelector('.logoicon');
  const logo=String(uri || '').trim();
  if(!brandIcon)return;
  brandIcon.innerHTML=logo ? `<img src="${esc(logo)}" alt="Logo de la empresa">` : '<span>NH</span>';
}
setCompanyLogo(ROUTE_LOGO_URI);

if(!window.google?.maps?.Map){
  window.__novaShowMapError('Nova Maps no está disponible. Verifica la clave y el origen actual del ERP.');
}

const restoredCameraCenter={lat:Number(mapReloadCamera?.center?.lat),lng:Number(mapReloadCamera?.center?.lng)};
const hasRestoredCamera=Number.isFinite(restoredCameraCenter.lat)&&restoredCameraCenter.lat>=-90&&restoredCameraCenter.lat<=90&&Number.isFinite(restoredCameraCenter.lng)&&restoredCameraCenter.lng>=-180&&restoredCameraCenter.lng<=180;
const restoredCameraZoom=Number(mapReloadCamera?.zoom);
const googleMap = new google.maps.Map(document.getElementById('map'), {
  center: hasRestoredCamera?restoredCameraCenter:{lat:12.115,lng:-86.26}, zoom:Number.isFinite(restoredCameraZoom)?Math.max(2,Math.min(21,restoredCameraZoom)):11,
  mapId: CAN_TOGGLE_BASE_PLACES&&!mapLayers.basePlaces?GOOGLE_CLEAN_MAP_ID:GOOGLE_MAP_ID,
  tilt: map3DEnabled ? 45 : 0,
  heading: 0,
  mapTypeControl:false, streetViewControl:false, fullscreenControl:false,
  zoomControl:true, clickableIcons:false, gestureHandling:'greedy', scrollwheel:true
});
const initial3dButton=document.getElementById('toggle3d');
if(initial3dButton){initial3dButton.classList.toggle('active',map3DEnabled);initial3dButton.textContent=map3DEnabled?'2D':'3D'}
let googleTilesLoaded = false;
google.maps.event.addListenerOnce(googleMap, 'tilesloaded', () => {
  googleTilesLoaded = true;
  const status = document.getElementById('mapStatus');
  if(status) status.hidden = true;
  const live = document.getElementById('liveStatus');
  if(live) live.textContent = 'Nova Maps activo · datos comerciales listos.';
});
setTimeout(() => {
  if(googleTilesLoaded)return;
  // Algunos mapas vectoriales no avisan que terminaron de cargar aunque ya se ven: si hay mosaicos dibujados, no se alerta.
  if(document.querySelector('#map .leaflet-tile-loaded, #map .gm-style canvas, #map .gm-style img[src*="googleapis"]'))return;
  window.__novaShowMapError('El mapa está tardando en cargar. Revisa tu conexión y recarga la página; si sigue igual, avisa al administrador.');
}, 15000);
function resizeGoogleMap(){
  const mapElement=document.getElementById('map');
  if(!mapElement || mapElement.offsetWidth===0 || mapElement.offsetHeight===0) return;
  const center=googleMap.getCenter();
  google.maps.event.trigger(googleMap,'resize');
  if(center) googleMap.setCenter(center);
  if(typeof renderPresenceClusters==='function')renderPresenceClusters();
  scheduleBusinessDetailPosition();
}
window.addEventListener('resize',resizeGoogleMap);
window.addEventListener('load',resizeGoogleMap);
if(window.ResizeObserver){new ResizeObserver(resizeGoogleMap).observe(document.getElementById('map'));}
requestAnimationFrame(()=>{resizeGoogleMap();setTimeout(resizeGoogleMap,250);});
const infoWindow = new google.maps.InfoWindow();
let presenceProjectionOverlay=null;
if(typeof googleMap.projectToContainer!=='function'&&google.maps.OverlayView){
  presenceProjectionOverlay=new google.maps.OverlayView();
  presenceProjectionOverlay.onAdd=()=>{};
  presenceProjectionOverlay.draw=()=>{};
  presenceProjectionOverlay.onRemove=()=>{};
  presenceProjectionOverlay.setMap(googleMap);
}
function projectPresencePosition(position){
  const coordinates=window.NovaForceSalesLocation.normalizeCoordinates(position);
  if(!coordinates)return null;
  if(typeof googleMap.projectToContainer==='function')return googleMap.projectToContainer(coordinates);
  const projection=presenceProjectionOverlay?.getProjection?.();
  if(!projection)return null;
  const point=projection.fromLatLngToContainerPixel(new google.maps.LatLng(coordinates.lat,coordinates.lng));
  return point?{x:Number(point.x),y:Number(point.y)}:null;
}
function unprojectPresencePosition(x,y){
  if(typeof googleMap.containerToCoordinates==='function')return googleMap.containerToCoordinates(x,y);
  const projection=presenceProjectionOverlay?.getProjection?.();
  if(!projection)return null;
  const point=projection.fromContainerPixelToLatLng(new google.maps.Point(Number(x),Number(y)));
  return point?window.NovaForceSalesLocation.normalizeCoordinates(point):null;
}
function activeBusinessDetail(){
  return findBusiness(currentPopupBusinessId)||businesses.find(item=>String(item.id)===String(currentPopupBusinessId||''));
}
function positionBusinessDetailOverlay(){
  if(!currentPopupBusinessId)return;
  const business=activeBusinessDetail();
  const overlay=document.getElementById('businessDetailOverlay');
  const card=document.getElementById('businessDetailCard');
  const mapElement=document.getElementById('map');
  if(!business||!overlay||overlay.hidden||!card||!mapElement){if(!business&&currentPopupBusinessId)closeBusinessDetailPopup();return}
  const mapRect=mapElement.getBoundingClientRect();
  const projected=projectPresencePosition({lat:Number(business.lat),lng:Number(business.lng)});
  const viewportTop=Math.max(0,Number(window.visualViewport?.offsetTop)||0)+8;
  const viewportBottom=Math.min(window.innerHeight,(Number(window.visualViewport?.offsetTop)||0)+(Number(window.visualViewport?.height)||window.innerHeight))-8;
  const cardWidth=card.offsetWidth,cardHeight=card.offsetHeight;
  const minLeft=mapRect.left+8;
  const maxLeft=Math.max(minLeft,mapRect.right-cardWidth-8);
  const anchorX=projected?mapRect.left+projected.x:mapRect.left+mapRect.width/2;
  const anchorY=projected?mapRect.top+projected.y:mapRect.top+24;
  const left=Math.max(minLeft,Math.min(maxLeft,anchorX-cardWidth/2));
  let top=anchorY-cardHeight-14;
  if(top<viewportTop)top=anchorY+14;
  top=Math.max(viewportTop,Math.min(Math.max(viewportTop,viewportBottom-cardHeight),top));
  card.style.left=`${Math.round(left)}px`;
  card.style.top=`${Math.round(top)}px`;
}
function scheduleBusinessDetailPosition(){
  if(!currentPopupBusinessId||businessDetailPositionFrame)return;
  businessDetailPositionFrame=window.requestAnimationFrame(()=>{
    businessDetailPositionFrame=0;
    positionBusinessDetailOverlay();
  });
}
function refreshBusinessDetailOverlay(){
  if(!currentPopupBusinessId)return;
  const business=activeBusinessDetail();
  const overlay=document.getElementById('businessDetailOverlay');
  const content=document.getElementById('businessDetailContent');
  if(!business||!overlay||!content){closeBusinessDetailPopup();return}
  overlay.hidden=false;
  ensurePointExtras(business);
  const html=popupHtml(business);
  const active=document.activeElement;
  const editing=content.contains(active)&&/^(INPUT|SELECT|TEXTAREA)$/.test(active?.tagName||'');
  if(!editing&&content.innerHTML!==html){
    const scrollTop=content.scrollTop;
    content.innerHTML=html;
    content.scrollTop=scrollTop;
  }
  scheduleBusinessDetailPosition();
}
function openBusinessDetailPopup(marker){
  const markerBusiness=marker?._b;
  const id=String(markerBusiness?.id??'');
  const business=findBusiness(id)||businesses.find(item=>String(item.id)===id)||markerBusiness;
  if(!id||!business)return;
  const overlay=document.getElementById('businessDetailOverlay');
  const wasAlreadyOpen=!overlay?.hidden&&String(currentPopupBusinessId||'')===id;
  if(nativeInfoWindowOpen){
    closingInfoWindowForRefresh=true;
    infoWindow.close();
    closingInfoWindowForRefresh=false;
    nativeInfoWindowOpen=false;
  }
  presenceClusterListOpen=false;
  presenceClusterListGroupKey=null;
  currentPopupBusinessId=id;
  focusedQuickPointPopupOpen=marker===focusedQuickPointMarker;
  refreshBusinessDetailOverlay();
  if(!wasAlreadyOpen)document.getElementById('businessDetailClose')?.focus({preventScroll:true});
}
function closeBusinessDetailPopup({clearFocusedMarker=true}={}){
  const closedId=currentPopupBusinessId;
  currentPopupBusinessId=null;
  focusedQuickPointPopupOpen=false;
  const overlay=document.getElementById('businessDetailOverlay');
  if(overlay)overlay.hidden=true;
  if(clearFocusedMarker&&closedId&&String(focusedQuickPointBusinessId||'')===String(closedId))clearFocusedQuickPoint({closeWindow:false});
}
let focusedQuickPointPopupOpen=false;
let closingInfoWindowForRefresh=false;
infoWindow.addListener?.('close',()=>{
  nativeInfoWindowOpen=false;
  if(presenceClusterListOpen){presenceClusterListOpen=false;if(activeView==='map')requestAnimationFrame(()=>renderPresenceClusters())}
  if(!closingInfoWindowForRefresh&&focusedQuickPointBusinessId){
    clearFocusedQuickPoint({closeWindow:false});
    if(activeView==='map')requestAnimationFrame(()=>render());
  }
});
const map = {
  getZoom(){return googleMap.getZoom() || 11},
  projectToContainer(position){return projectPresencePosition(position)},
  containerToCoordinates(x,y){return unprojectPresencePosition(x,y)},
  flyTo(coords, zoom){googleMap.panTo({lat:coords[0],lng:coords[1]});googleMap.setZoom(zoom)},
  on(event, handler){return google.maps.event.addListener(googleMap,event==='zoomend'?'zoom_changed':event,handler)}
};
let mapViewportRenderTimer = null;
let focusRenderLockUntil = 0;
function scheduleMapViewportRender(){
  window.clearTimeout(mapViewportRenderTimer);
  if(Date.now()<focusRenderLockUntil)return;
  mapViewportRenderTimer=window.setTimeout(()=>{if(activeView==='map' && Date.now()>=focusRenderLockUntil){renderPresenceClusters();render()}},180);
}
googleMap.addListener('dragend',scheduleMapViewportRender);
googleMap.addListener('zoom_changed',scheduleMapViewportRender);
googleMap.addListener('idle',scheduleMapViewportRender);
googleMap.addListener('bounds_changed',scheduleBusinessDetailPosition);
googleMap.addListener('dragstart',()=>clearFocusedQuickPoint());
googleMap.addListener('click', event => {
  if(activeView !== 'map' || !event.latLng)return;
  if(handleWorkZoneMapClick(event))return;
  if(routePlanningMode){toast('Pulsa un marcador comercial existente para agregar ese punto a la ruta');return}
  openQuickPointAt(event.latLng.lat(), event.latLng.lng(), 'mapa');
});
