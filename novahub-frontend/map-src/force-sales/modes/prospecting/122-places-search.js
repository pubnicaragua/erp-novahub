function placesCategory(types=[],name=''){
  const x=norm([...types,name].join(' '));
  if(/pharmacy|drugstore/.test(x))return 'Farmacia';
  if(/doctor|clinic|hospital|dentist|health/.test(x))return 'Salud / clínica';
  if(/hardware|home improvement|building|contractor|architect/.test(x))return 'Ferretería / construcción';
  if(/clothing|shoe|jewelry|department|store|shopping/.test(x))return 'Comercio / ropa';
  if(/logistics|moving|storage|transport/.test(x))return 'Logística / transporte';
  if(/marketing|advertising|consulting|agency/.test(x))return 'Marketing / servicios';
  if(/restaurant|cafe|food/.test(x))return 'Restaurante';
  return 'Comercio / servicios';
}
function googlePlaceBiz(place){
  if(place?.googlePlaceId && Number.isFinite(Number(place.lat)) && Number.isFinite(Number(place.lng)))return place;
  const placeId=place?.place_id || place?.id;
  const location=place?.geometry?.location || place?.location; if(!placeId||!location)return null;
  const lat=typeof location.lat==='function'?location.lat():location.lat;
  const lng=typeof location.lng==='function'?location.lng():location.lng;
  if(lat==null||lng==null)return null;
  const name=typeof place.displayName==='string' ? place.displayName : place.displayName?.text || place.name || 'Negocio sin nombre';
  const rating=Number(place.rating || 0) || null;
  const reviews=Number(place.userRatingCount ?? place.user_ratings_total ?? 0);
  const category=placesCategory(place.types||[],name);
  let score=scoreFor(category,{});
  if(rating)score+=Math.round(Math.max(0,rating-3.5)*5);
  if(reviews>=100)score+=5;
  score=Math.min(95,score);
  const isGoogle=window.__novaMapProvider==='GOOGLE';
  return {id:`${isGoogle?'google':'map'}-${placeId}`,googlePlaceId:placeId,name,zone:nearestZone(lat,lng),category,address:place.formattedAddress||place.formatted_address||'Dirección disponible en Nova',source:isGoogle?'Google Maps':'OpenStreetMap',sourceUrl:place.googleMapsURI||place.url||(isGoogle?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`:''),lat,lng,precision:isGoogle?'Ubicación y ficha devueltas por Google Maps':'Ubicación devuelta por el geocodificador configurado; validar antes de visitar',score,priority:score>=78?'A':score>=60?'B':'C',owner:'Fuerza Comercial',phone:place.nationalPhoneNumber||place.formattedPhoneNumber||place.formatted_phone_number||'',website:place.websiteURI||place.website||'',rating,reviews};
}
function boundsKey(bounds){
  if(!bounds)return 'managua';
  const ne=bounds.getNorthEast(), sw=bounds.getSouthWest();
  return [sw.lat(),sw.lng(),ne.lat(),ne.lng()].map(value=>Number(value).toFixed(3)).join(',');
}
function currentBounds(){return googleMap.getBounds?.() || null}
function radiusFromBounds(bounds){
  if(!bounds)return 15000;
  const ne=bounds.getNorthEast(), sw=bounds.getSouthWest();
  const centerLat=(ne.lat()+sw.lat())/2;
  const latMeters=Math.abs(ne.lat()-sw.lat())*111000;
  const lngMeters=Math.abs(ne.lng()-sw.lng())*111000*Math.max(.25,Math.cos(centerLat*Math.PI/180));
  return Math.max(1200,Math.min(25000,Math.round(Math.max(latMeters,lngMeters)/2)));
}
function setSearchStatus(message){
  const node=document.getElementById('searchStatus'); if(node)node.textContent=message;
  const live=document.getElementById('liveStatus'); if(live)live.textContent=message;
}
function cachedGoogleKey(query, bounds){return `novaGooglePlacesCacheV2:${norm(query || 'default')}:${boundsKey(bounds)}`}
function readGoogleCache(query,bounds){
  try{
    const cached=JSON.parse(localStorage.getItem(cachedGoogleKey(query,bounds)) || 'null');
    if(cached && Date.now()-cached.savedAt<GOOGLE_CACHE_TTL && Array.isArray(cached.data))return cached.data;
  }catch(e){}
  return null;
}
function mergeGoogleResults(items){
  const merged=new Map(googlePlaces.map(place=>[place.googlePlaceId,place]));
  items.map(googlePlaceBiz).filter(Boolean).forEach(place=>merged.set(place.googlePlaceId,place));
  googlePlaces=[...merged.values()].slice(-2500);
  localStorage.setItem(GOOGLE_CATALOG_KEY,JSON.stringify(googlePlaces));
}
async function searchTextPlaces(Place,request,query,runId){
  if(runId!==googleSearchRun)return [];
  try{
    const {places=[]}=await Place.searchByText({
      fields:['id','displayName','formattedAddress','location','types','rating','userRatingCount','websiteURI','nationalPhoneNumber','googleMapsURI'],
      textQuery:request.query,
      language:'es',
      region:'ni',
      locationBias:{center:request.location,radius:request.radius},
       maxResultCount:Math.min(20,Math.max(1,Number(request.resultLimit)||20)),
    });
    return Array.isArray(places) ? places : [];
  }catch(error){
    setSearchStatus(`Nova no pudo buscar ${query}.`);
    console.warn('Nova Places searchByText',error);
    return [];
  }
}
function buildNovaDiscoveryPlan(normalizedQuery,visibleOnly,options={}){
  const cursor=Number(readStore(NOVA_SEARCH_CURSOR_KEY,0)) || 0;
  const currentCenter=googleMap.getCenter();
  const center=options.center || [currentCenter?.lat?.() ?? 12.115,currentCenter?.lng?.() ?? -86.26];
  const currentArea={name:options.areaName || (selectedZone==='Todos'?'vista actual':selectedZone),center,radius:Number(options.radius)||radiusFromBounds(currentBounds())};
  if(visibleOnly){
    const queries=normalizedQuery ? [normalizedQuery] : Array.from({length:5},(_,index)=>NOVA_DISCOVERY_QUERIES[(cursor+index)%NOVA_DISCOVERY_QUERIES.length]);
    localStorage.setItem(NOVA_SEARCH_CURSOR_KEY,String((cursor+queries.length)%NOVA_DISCOVERY_QUERIES.length));
    return queries.map(query=>({area:currentArea,query}));
  }
  const fixedArea=NOVA_DISCOVERY_AREAS.find(area=>area.name===selectedZone);
  if(fixedArea){
    const queries=normalizedQuery ? [normalizedQuery] : Array.from({length:5},(_,index)=>NOVA_DISCOVERY_QUERIES[(cursor+index)%NOVA_DISCOVERY_QUERIES.length]);
    localStorage.setItem(NOVA_SEARCH_CURSOR_KEY,String((cursor+queries.length)%NOVA_DISCOVERY_QUERIES.length));
    return queries.map(query=>({area:fixedArea,query}));
  }
  const areaCount=NOVA_DISCOVERY_AREAS.length;
  const areas=Array.from({length:areaCount},(_,index)=>NOVA_DISCOVERY_AREAS[(cursor+index)%NOVA_DISCOVERY_AREAS.length]);
  localStorage.setItem(NOVA_SEARCH_CURSOR_KEY,String(cursor+1));
  const resultLimit=Math.ceil(GOOGLE_SEARCH_MAX_RESULTS/areaCount);
  return areas.map((area,index)=>({area,query:normalizedQuery || NOVA_DISCOVERY_QUERIES[(cursor+index)%NOVA_DISCOVERY_QUERIES.length],resultLimit}));
}
async function searchGooglePlaces(query='', options={}){
  const force=options.force===true;
  const visibleOnly=options.visibleOnly===true;
  activeNearbyCenter=options.center ? {lat:Number(options.center[0]),lng:Number(options.center[1])} : null;
  activeNearbyRadius=options.center ? Number(options.radius)||15000 : null;
  const runId=++googleSearchRun;
  const btn=document.getElementById('refresh'); const searchBtn=document.getElementById('searchGoogle'); const zoneBtn=document.getElementById('searchViewport');
  [btn,searchBtn,zoneBtn].forEach(node=>{if(node)node.disabled=true});
  if(!window.google?.maps?.places){setSearchStatus('El servicio de mapas no está disponible. Revisa la configuración de Nova.');toast('No se pudo cargar el mapa');[btn,searchBtn,zoneBtn].forEach(node=>{if(node)node.disabled=false});return}
  const normalizedQuery=query.trim(); const bounds=visibleOnly ? currentBounds() : null;
  const cache=force ? null : readGoogleCache(normalizedQuery,bounds);
  if(cache){
    const before=googlePlaces.length;
    const cachedBusinesses=cache.map(googlePlaceBiz).filter(Boolean);
    mergeGoogleResults(cache); mergeBusinesses(); populateFilters(); render();
    await syncProspects(cachedBusinesses);
    await loadRemoteProspects();
    setSearchStatus(`${Math.max(0,googlePlaces.length-before)} nuevos · ${googlePlaces.length} negocios Nova acumulados.`);
    [btn,searchBtn,zoneBtn].forEach(node=>{if(node)node.disabled=false}); return;
  }
  const discoveryPlan=buildNovaDiscoveryPlan(normalizedQuery,visibleOnly,options);
  const collected=[];
  try{
    const placesLibrary=await novaMapsLibrary('places');
    const Place=placesLibrary?.Place;
    if(!Place?.searchByText)throw new Error('Place.searchByText no está disponible. Habilita Places API (New).');
    const searchedAreas=[...new Set(discoveryPlan.map(item=>item.area.name))];
    const areasLabel=searchedAreas.length>4 ? `${searchedAreas.slice(0,4).join(', ')} +${searchedAreas.length-4} zonas` : searchedAreas.join(', ');
    setSearchStatus(`Nova está buscando ${discoveryPlan.length} sectores en ${areasLabel}…`);
    for(let index=0;index<discoveryPlan.length && collected.length<GOOGLE_SEARCH_MAX_RESULTS;index+=2){
      const batch=discoveryPlan.slice(index,index+2);
      const responses=await Promise.all(batch.map(item=>{
        const request={query:`${item.query} en ${item.area.name}, Nicaragua`,location:{lat:item.area.center[0],lng:item.area.center[1]},radius:item.area.radius,resultLimit:item.resultLimit};
        return searchTextPlaces(Place,request,item.query,runId);
      }));
      responses.forEach(items=>{if(collected.length<GOOGLE_SEARCH_MAX_RESULTS)collected.push(...items.slice(0,GOOGLE_SEARCH_MAX_RESULTS-collected.length))});
    }
    if(runId!==googleSearchRun)return;
    const uniqueRaw=[]; const seen=new Set();
    collected.forEach(place=>{const placeId=place?.place_id || place?.id;if(placeId&&!seen.has(placeId)){seen.add(placeId);uniqueRaw.push(place)}});
    const mapped=uniqueRaw.map(googlePlaceBiz).filter(Boolean);
    if(mapped.length){
      const previousIds=new Set(googlePlaces.map(place=>place.googlePlaceId));
      mergeGoogleResults(uniqueRaw);
      localStorage.setItem(cachedGoogleKey(normalizedQuery,bounds),JSON.stringify({savedAt:Date.now(),data:mapped}));
      mergeBusinesses(); populateFilters(); render();
      await syncProspects(mapped);
      await loadRemoteProspects();
      const newCount=mapped.filter(place=>!previousIds.has(place.googlePlaceId)).length;
       setSearchStatus(`${newCount} nuevos · ${googlePlaces.length} negocios Nova acumulados · ${areasLabel}.`);
      toast(`${newCount} negocios nuevos encontrados`);
    }else{
      setSearchStatus('Nova no devolvió negocios para esa búsqueda. Prueba otro rubro o acerca el mapa.'); toast('Sin resultados');
    }
  }catch(error){
    setSearchStatus('No se pudo completar la búsqueda de Nova. Revisa la configuración del servicio.'); toast('Error consultando Nova'); console.error(error);
  }finally{[btn,searchBtn,zoneBtn].forEach(node=>{if(node)node.disabled=false});if(btn)btn.textContent='↻ Actualizar negocios Nova'}
}
function loadGooglePlaces(force=false){return searchGooglePlaces('',{force})}
function searchNearbyFromDevice(){
  const query=document.getElementById('search')?.value.trim() || '';
  const radius=Number(document.getElementById('nearbyRadius')?.value || 5000);
  toast('Obteniendo tu ubicación para buscar negocios cercanos…');
  withLocationAccess(position=>{
    const center=[Number(position.coords.latitude),Number(position.coords.longitude)];
    activeNearbyCenter={lat:center[0],lng:center[1]};
    showUserLocation(position);
    googleMap.panTo({lat:center[0],lng:center[1]});
    googleMap.setZoom(radius<=2500?16:radius<=5000?15:14);
    void searchGooglePlaces(query,{force:true,visibleOnly:true,center, radius, areaName:`radio de ${Math.round(radius/1000)} km`});
  },'No se pudo obtener tu ubicación para buscar negocios a la redonda');
}
