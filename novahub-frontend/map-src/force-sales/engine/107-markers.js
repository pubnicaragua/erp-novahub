function svgDataUrl(svg){return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg)}
function userInitials(name){
  const particles=new Set(['de','del','la','las','los','y']);
  const words=String(name||'').trim().split(/\s+/).filter(Boolean).filter(word=>!particles.has(word.toLocaleLowerCase('es-NI')));
  if(!words.length)return '';
  const initials=words.length>1?`${words[0][0]}${words[words.length-1][0]}`:words[0].slice(0,2);
  return initials.toLocaleUpperCase('es-NI');
}
function currentUserAttribution(){
  const name=String(CURRENT_USER_NAME||'').trim();
  return name?{id:CURRENT_USER_ID||null,name}:null;
}
function markerSvg(b){
  const state=stateClass(b);
  const ring=state==='interested'?'#0b9d68':state==='visited'?'#84d795':state==='kanban'?'#12aa7b':state==='selected'?'#3287e8':state==='discarded'?'#86958f':'#9cacaa';
  const fill=b.priority==='A'?'#08785a':b.priority==='B'?'#eea13d':'#83928d';
  const commercial=stateOf(b);
  const hasExplicitUnassigned=Object.prototype.hasOwnProperty.call(commercial,'assignedToId')&&commercial.assignedToId===null;
  const assignedToId=commercial.assignedToId||b.assignedToId||b.assignedTo?.id||null;
  const assignedName=hasExplicitUnassigned?'':commercial.assignedToName||assignees.find(item=>String(item.id)===String(assignedToId||''))?.name||b.assignedTo?.name||b.assignedToName||'';
  const attribution={responsibleName:String(assignedName).trim(),responsibleInitials:userInitials(assignedName)};
  if(NOVAHUB_ISOTIPO_URL){
    return {url:NOVAHUB_ISOTIPO_URL,scaledSize:new google.maps.Size(26,26),anchor:new google.maps.Point(13,13),responsiveBusinessPoint:true,...attribution};
  }
  return {url:svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42"><circle cx="21" cy="21" r="18" fill="white" stroke="${ring}" stroke-width="3"/><rect x="7" y="7" width="28" height="28" rx="9" fill="${fill}"/><path d="M14 13v16M28 13v16M14 13l14 14" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round"/><path d="M14 29l14-16" fill="none" stroke="#8df1be" stroke-width="3.2" stroke-linecap="round"/></svg>`),scaledSize:new google.maps.Size(42,42),anchor:new google.maps.Point(21,21),...attribution};
}
function clusterSvg(count){
  if(NOVAHUB_ISOTIPO_URL){
    return {url:NOVAHUB_ISOTIPO_URL,scaledSize:new google.maps.Size(24,24),anchor:new google.maps.Point(12,12)};
  }
  return {url:svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="58" height="58"><circle cx="29" cy="29" r="25" fill="#123f35" stroke="#b4f4d8" stroke-width="4"/><path d="M20 17v24M38 17v24M20 17l18 18M20 41l18-24" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round"/><text x="29" y="34" text-anchor="middle" font-family="Poppins,Arial" font-size="11" font-weight="900" fill="#8df1be">${count}</text></svg>`),scaledSize:new google.maps.Size(58,58),anchor:new google.maps.Point(29,29)};
}
function markerContentFromIcon(icon,title,label){
  if(!icon?.url)return undefined;
  const wrapper=document.createElement('div');
  wrapper.className='nova-map-marker-content';
  if(icon.responsiveBusinessPoint)wrapper.classList.add('nova-business-point-marker');
  wrapper.style.position='relative';
  const image=document.createElement('img');
  image.src=icon.url;
  image.alt=title || '';
  image.width=Number(icon.scaledSize?.width)||32;
  image.height=Number(icon.scaledSize?.height)||32;
  image.style.width=image.width+'px';
  image.style.height=image.height+'px';
  wrapper.appendChild(image);
  if(icon.responsibleInitials){
    const responsibleBadge=document.createElement('span');
    responsibleBadge.className='nova-map-marker-responsible';
    responsibleBadge.textContent=icon.responsibleInitials;
    responsibleBadge.title=`Responsable: ${icon.responsibleName}`;
    responsibleBadge.setAttribute('aria-hidden','true');
    wrapper.title=`${title||'Punto comercial'} · Responsable: ${icon.responsibleName}`;
    wrapper.setAttribute('aria-label',wrapper.title);
    wrapper.appendChild(responsibleBadge);
  }
  if(label){
    const badge=document.createElement('span');
    badge.className='nova-map-marker-badge';
    badge.textContent=String(label);
    wrapper.appendChild(badge);
  }
  return wrapper;
}
function setNovaMarkerMap(marker,mapInstance){
  if(!marker)return;
  const Advanced=window.__novaAdvancedMarkerElement;
  if(Advanced && marker instanceof Advanced){marker.map=mapInstance || null;return}
  if(typeof marker.setMap==='function')marker.setMap(mapInstance || null);
}
function createMapMarker(options={}){
  const Advanced=window.__novaAdvancedMarkerElement;
  if(!Advanced)throw new Error('Nova AdvancedMarkerElement unavailable');
  const marker=new Advanced({
    map:options.map ?? null,
    position:options.position,
    title:options.title || '',
    content:options.content || markerContentFromIcon(options.icon,options.title,options.label),
    gmpClickable:true,
    gmpDraggable:Boolean(options.draggable||options.gmpDraggable),
    zIndex:options.zIndex
  });
  if(typeof marker.setPosition!=='function')marker.setPosition=(position)=>{marker.position=position};
  marker.setLabel=()=>marker;
  return marker;
}
function createQuickPointMarkerContent(saved=false){
  const content=document.createElement('div');
  content.className=`nova-quick-point-marker${saved?' saved':''}`;
  content.textContent='+';
  content.setAttribute('role',saved?'img':'button');
  content.setAttribute('aria-label',saved?'Punto comercial guardado':'Punto provisional, arrastra o usa las flechas del teclado para ajustar');
  if(!saved)content.tabIndex=0;
  return content;
}
function bindMapMarkerPopup(marker,factory){
  if(factory!==undefined)marker._popupFactory=factory;
  marker.openPopup=function(){
    if(!marker._popupFactory)return;
    openBusinessDetailPopup(marker);
  };
  marker.bindPopup=function(nextFactory){bindMapMarkerPopup(marker,nextFactory);return marker};
  if(!marker._popupOpenListener){
    const open=()=>{
      if(routePlanningMode&&marker._b&&canEditRouteComposition()){toggleRouteBusiness(marker._b);return;}
      if(focusedQuickPointMarker&&marker!==focusedQuickPointMarker)clearFocusedQuickPoint();
      marker.openPopup();
    };
    if(typeof marker.addEventListener==='function')marker.addEventListener('gmp-click',open);
    else marker.addListener?.('click',open);
    marker._popupOpenListener=open;
  }
  return marker;
}
function createGoogleMarker(coords, options){
  const marker=createMapMarker({position:{lat:coords[0],lng:coords[1]},title:options.title||'',icon:options.icon||undefined});
  setNovaMarkerMap(marker,null);
  bindMapMarkerPopup(marker);
  marker.bindTooltip=function(content,options={}){if(options.permanent){marker.setLabel({text:String(content).replace(/<[^>]+>/g,''),color:'#173b31',fontSize:'10px',fontWeight:'600'})}return marker};
  marker.unbindTooltip=function(){marker.setLabel(null);return marker};
  return marker;
}
const L={marker:createGoogleMarker};
const cluster={
  markers:[],clusterer:null,
  addLayer(marker){this.markers.push(marker)},
  clearLayers(){this.clusterer?.clearMarkers();this.markers.forEach(marker=>setNovaMarkerMap(marker,null));this.markers=[]},
  refresh(){
    this.clusterer?.clearMarkers();
    if(window.markerClusterer?.MarkerClusterer){
       this.clusterer=new window.markerClusterer.MarkerClusterer({map:googleMap,markers:this.markers,renderer:{render:({count,position})=>createMapMarker({map:googleMap,position,icon:clusterSvg(count),label:NOVAHUB_ISOTIPO_URL?String(count):undefined,zIndex:1000+count})}});
    }else this.markers.forEach(marker=>setNovaMarkerMap(marker,googleMap));
  }
};
window.__novaRefreshClusters=()=>cluster.refresh();
