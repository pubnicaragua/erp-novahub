function normalizeImportHeader(value){
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
function importCell(row, aliases){
  const entries=Object.entries(row || {});
  const wanted=new Set(aliases.map(normalizeImportHeader));
  const match=entries.find(([header])=>wanted.has(normalizeImportHeader(header)));
  return match?.[1] ?? '';
}
function importNumber(value){
  if(typeof value==='number'&&Number.isFinite(value))return value;
  const normalized=String(value ?? '').replace(/[^0-9,.-]/g,'').replace(/\.(?=.*\.)/g,'').replace(',','.');
  const parsed=Number(normalized);
  return Number.isFinite(parsed)?parsed:null;
}
function importAssignee(value){
  const token=normalizeImportHeader(value);
  if(!token)return null;
  return assignees.find(item=>[item.id,item.name,item.email].some(candidate=>normalizeImportHeader(candidate)===token)) || null;
}
function importedBusinessFromRow(row,index){
  const name=String(importCell(row,['Nombre del Cliente','Cliente','Nombre','Razón social','Razon social']) || '').trim();
  if(!name)return null;
  const sourceKey=String(importCell(row,['No.','No','Código','Codigo','ID cliente','Cuenta','Cédula','Cedula']) || `${name}-${index+1}`).trim();
  const routeName=String(importCell(row,['Ruta','Ruta comercial','Nombre de ruta','Route']) || '').trim();
  const assigneeValue=importCell(row,['Gestor','Vendedor','Responsable','Assigned to','Usuario']);
  const assignee=importAssignee(assigneeValue);
  const lat=importNumber(importCell(row,['Latitud','Lat','Latitude']));
  const lng=importNumber(importCell(row,['Longitud','Lng','Long','Longitude']));
  const address=String(importCell(row,['Dirección','Direccion','Domicilio','Dirección del cliente','Address']) || '').trim();
  const phone=String(importCell(row,['Teléfono','Telefono','Celular','Móvil','Movil','WhatsApp','Phone']) || '').trim();
  const zone=String(importCell(row,['Zona','Barrio','Sector','Municipio','Ciudad']) || '').trim();
  const category=String(importCell(row,['Categoría','Categoria','Tipo de cliente','Giro','Rubro']) || 'Cliente de crédito').trim();
  const business={
    id:sourceKey || `import-${index}`, name, sourceKey, zone:zone || nearestZone(lat ?? 12.115,lng ?? -86.26), category,
    address:address || 'Dirección pendiente de georreferenciar', source:'Importación de clientes', sourceUrl:'',
    lat, lng, precision:lat!==null&&lng!==null?'Coordenadas importadas':'Pendiente de georreferenciar', score:0, priority:'C', owner:'Fuerza Comercial', phone,
    createdBy:currentUserAttribution()||undefined,
    importRouteName:routeName, importAssigneeId:assignee?.id || '', importAssigneeLabel:String(assigneeValue || '').trim(), importSourceKey:sourceKey,
  };
  const state=stateOf(business);
  state.assignedToId=assignee?.id || null;
  state.selected=true;
  return business;
}
function geocodeImportedAddress(address){
  if(!address)return Promise.resolve(null);
  if(window.google?.maps?.Geocoder){
    return new Promise(resolve=>{
      new google.maps.Geocoder().geocode({address:`${address}, Nicaragua`},(results,status)=>{
        if(status!=='OK'||!results?.[0]?.geometry?.location){resolve(null);return}
        const location=results[0].geometry.location;resolve({lat:location.lat(),lng:location.lng(),precision:'Georreferenciado por Google Maps'});
      });
    });
  }
  const geocoder=forceSalesConfig?.mapGeocoderUrl;
  if(!geocoder)return Promise.resolve(null);
  const separator=geocoder.includes('?')?'&':'?';
  return fetch(`${geocoder}${separator}q=${encodeURIComponent(address)}`,{headers:apiHeaders(),cache:'no-store'}).then(response=>response.ok?response.json():null).then(result=>{
    const item=Array.isArray(result)?result[0]:result?.results?.[0] || result;
    const lat=importNumber(item?.lat ?? item?.latitude),lng=importNumber(item?.lon ?? item?.lng ?? item?.longitude);
    return lat===null||lng===null?null:{lat,lng,precision:'Georreferenciado por el catálogo configurado'};
  }).catch(()=>null);
}
async function geocodeImportedBusinesses(items){
  const pending=items.filter(item=>Number.isFinite(item.lat)===false||Number.isFinite(item.lng)===false).filter(item=>item.address && !/^direccion pendiente/i.test(item.address));
  for(let index=0;index<pending.length;index++){
    const item=pending[index];
    const location=await geocodeImportedAddress(item.address);
    if(location){item.lat=location.lat;item.lng=location.lng;item.precision=location.precision}
    const status=document.getElementById('routeImportStatus');
    if(status)status.textContent=`Georreferenciando ${index+1}/${pending.length} · ${item.name}`;
  }
}
async function persistImportedRouteGroups(items){
  const groups=new Map();
  const scheduledFor=document.getElementById('routeScheduledFor')?.value || localRouteDate();
  items.forEach(item=>{
    const routeName=String(item.importRouteName || '').trim();
    const remoteId=stateOf(item).remoteId;
    if(!routeName||!remoteId)return;
    const key=normalizeImportHeader(routeName);
    if(!groups.has(key))groups.set(key,{name:routeName,scheduledFor,assigneeId:stateOf(item).assignedToId || CURRENT_USER_ID || null,prospectIds:[]});
    const group=groups.get(key);
    group.prospectIds.push(remoteId);
    if(!group.assigneeId&&stateOf(item).assignedToId)group.assigneeId=stateOf(item).assignedToId;
  });
  for(const group of groups.values()){
    if(!group.prospectIds.length)continue;
    const existing=remoteRoutes.find(route=>normalizeImportHeader(route.name)===normalizeImportHeader(group.name));
    if(existing){
      const existingIds=new Set((existing.stops || []).map(stop=>String(stop.prospectId)));
      const appendProspectIds=[...new Set(group.prospectIds)].filter(prospectId=>!existingIds.has(String(prospectId)));
      if(appendProspectIds.length){
        const updated=await forceSalesRequest(`/force-sales/routes/${encodeURIComponent(existing.id)}`,{method:'PATCH',body:JSON.stringify({appendProspectIds,scheduledFor:group.scheduledFor})});
        if(updated)remoteRoutes=[updated,...remoteRoutes.filter(route=>route.id!==updated.id)];
      }
      continue;
    }
    const payload={name:group.name,scheduledFor:group.scheduledFor,prospectIds:[...new Set(group.prospectIds)],logoUri:ROUTE_LOGO_URI || null};
    if(group.assigneeId&&CAN_ASSIGN_TEAM&&canForceSales('assignRoute'))payload.assignedToId=group.assigneeId;
    const saved=await forceSalesRequest('/force-sales/routes',{method:'POST',body:JSON.stringify(payload)});
    if(saved)remoteRoutes=[saved,...remoteRoutes.filter(route=>route.id!==saved.id)];
  }
  renderSavedRouteOptions();
}
async function importForceSalesRows(message){
  if(!canForceSales('importProspects')){toast('Tu rol no puede importar clientes');return}
  const rows=Array.isArray(message?.rows)?message.rows.map(row=>({...row})):[];
  const sheets=message?.sheets && typeof message.sheets==='object' ? message.sheets : {};
  const routeRows=Object.entries(sheets).filter(([name])=>normalizeImportHeader(name).includes('ruta')).flatMap(([,items])=>Array.isArray(items)?items:[]);
  if(routeRows.length){
    const routeByClient=new Map(routeRows.map(row=>[
      String(importCell(row,['No.','No','Código','Codigo','ID cliente','Cuenta','Cédula','Cedula']) || '').trim(),
      {route:importCell(row,['Ruta','Ruta comercial','Nombre de ruta','Route']),assignee:importCell(row,['Gestor','Vendedor','Responsable','Assigned to','Usuario'])},
    ]).filter(([key])=>key));
    rows.forEach(row=>{
      const key=String(importCell(row,['No.','No','Código','Codigo','ID cliente','Cuenta','Cédula','Cedula']) || '').trim();
      const route=routeByClient.get(key);
      if(route){if(!importCell(row,['Ruta','Ruta comercial','Nombre de ruta','Route']))row.Ruta=route.route;if(!importCell(row,['Gestor','Vendedor','Responsable','Assigned to','Usuario']))row.Gestor=route.assignee}
    });
  }
  const imported=rows.map(importedBusinessFromRow).filter(Boolean).slice(0,500);
  if(!imported.length){toast('El archivo no contiene filas con nombre de cliente');return}
  const status=document.getElementById('routeImportStatus');
  if(status)status.textContent=`Preparando ${imported.length} clientes…`;
  await geocodeImportedBusinesses(imported);
  const existingKeys=new Set(localPoints.map(item=>String(item.sourceKey || keyOf(item))));
  imported.forEach(item=>{if(!existingKeys.has(String(item.sourceKey || keyOf(item))))localPoints.push(item)});
  localStorage.setItem(LOCAL_POINTS_KEY,JSON.stringify(localPoints));
  mergeBusinesses();populateFilters();render();
  const result=await syncProspects(imported);
  if(!result && imported.some(item=>!stateOf(item).remoteId)){
    if(status)status.textContent='Clientes guardados localmente; se sincronizarán al recuperar conexión.';
    toast('Importación guardada offline');
    return;
  }
  await loadRemoteProspects();
  await loadRemoteRoutes();
  await persistImportedRouteGroups(imported);
  const routeCount=new Set(imported.map(item=>item.importRouteName).filter(Boolean)).size;
  if(status)status.textContent=`${imported.length} clientes importados${routeCount?` · ${routeCount} rutas vinculadas`:''}.`;
  toast(`${imported.length} clientes importados correctamente`);
}
