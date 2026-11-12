function openOfflineDb(){
  if(!('indexedDB' in window)) return Promise.resolve(null);
  if(offlineDbPromise) return offlineDbPromise;
  offlineDbPromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open(OFFLINE_DB_NAME,OFFLINE_DB_VERSION);
    request.onupgradeneeded=()=>{
      const database=request.result;
      if(!database.objectStoreNames.contains(OFFLINE_STORE_LEGACY))database.createObjectStore(OFFLINE_STORE_LEGACY,{keyPath:'sourceKey'});
      if(!database.objectStoreNames.contains(OFFLINE_STORE_V2)){
        const store=database.createObjectStore(OFFLINE_STORE_V2,{keyPath:'queueKey'});
        store.createIndex('byIdentity','identityKey',{unique:false});
      }
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>{offlineDbPromise=null;reject(request.error || new Error('IndexedDB no disponible'))};
  });
  return offlineDbPromise;
}
function offlineTransaction(mode, operation, storeName=OFFLINE_STORE_V2){
  return openOfflineDb().then(db=>new Promise((resolve,reject)=>{
    if(!db){resolve(null);return}
    const tx=db.transaction(storeName,mode); const store=tx.objectStore(storeName);
    let result;
    try{result=operation(store)}catch(error){reject(error);return}
    if(result?.onsuccess!==undefined){result.onsuccess=()=>resolve(result.result);result.onerror=()=>reject(result.error)}
    else{tx.oncomplete=()=>resolve(result)}
    tx.onerror=()=>reject(tx.error);
  }));
}
function readLegacyLocalPointCaches(){
  const caches=[];
  const prefix='novaFuerzaLocalPointsV1:';
  try{
    for(let index=0;index<localStorage.length;index++){
      const key=localStorage.key(index);
      if(!key?.startsWith(prefix))continue;
      const tenantId=key.slice(prefix.length);
      const points=readStore(key,[]);
      if(tenantId&&Array.isArray(points))caches.push({tenantId,points});
    }
  }catch(error){console.warn('No se pudo revisar el propietario de la cola local anterior',error)}
  return caches;
}
function migrateLegacyOfflineProspects(){
  if(legacyOfflineMigrationPromise)return legacyOfflineMigrationPromise;
  legacyOfflineMigrationPromise=(async()=>{
    try{
      const database=await openOfflineDb();
      if(!database)return {migrated:0,quarantined:0};
      const caches=readLegacyLocalPointCaches();
      const result=await new Promise((resolve,reject)=>{
        const transaction=database.transaction([OFFLINE_STORE_LEGACY,OFFLINE_STORE_V2],'readwrite');
        const legacyStore=transaction.objectStore(OFFLINE_STORE_LEGACY);
        const scopedStore=transaction.objectStore(OFFLINE_STORE_V2);
        const cursorRequest=legacyStore.openCursor();
        let migrated=0,quarantined=0;
        cursorRequest.onerror=()=>reject(cursorRequest.error || new Error('No se pudo leer la cola offline anterior'));
        cursorRequest.onsuccess=()=>{
          const cursor=cursorRequest.result;
          if(!cursor)return;
          const entry=cursor.value;
          const owner=window.NovaForceSalesOfflineIdentity.findLegacyOwner(entry,caches);
          const identityKey=owner&&window.NovaForceSalesOfflineIdentity.scopeKey(owner);
          if(!owner||!identityKey){quarantined++;cursor.continue();return}
          const queueKey=window.NovaForceSalesOfflineIdentity.queueKey(owner,entry.sourceKey);
          scopedStore.put({...entry,...owner,identityKey,queueKey});
          cursor.delete();
          migrated++;
          cursor.continue();
        };
        transaction.oncomplete=()=>resolve({migrated,quarantined});
        transaction.onerror=()=>reject(transaction.error || new Error('No se pudo migrar la cola offline anterior'));
        transaction.onabort=()=>reject(transaction.error || new Error('Se canceló la migración de la cola offline anterior'));
      });
      setForceSalesSyncError('cola offline anterior',result.quarantined
        ? `${result.quarantined} elemento(s) antiguo(s) siguen guardados sin propietario verificable; no se enviarán con esta cuenta.`
        : null);
      return result;
    }catch(error){
      legacyOfflineMigrationPromise=null;
      console.warn('No se pudo migrar la cola offline anterior',error);
      return {migrated:0,quarantined:0,error};
    }
  })();
  return legacyOfflineMigrationPromise;
}
async function saveOfflineProspect(b, evidenceFile, operations=[], syncProfile=true){
  const sourceKey=keyOf(b);
  const identity=CURRENT_IDENTITY;
  const identityKey=window.NovaForceSalesOfflineIdentity.scopeKey(identity);
  const queueKey=window.NovaForceSalesOfflineIdentity.queueKey(identity,sourceKey);
  if(!identityKey||!queueKey){
    setForceSalesSyncError('cola offline','No se guardó el cambio: vuelve a iniciar sesión para validar usuario y empresa.');
    return false;
  }
  try{
    if(!await openOfflineDb()) return false;
    const previous=await offlineTransaction('readonly',store=>store.get(queueKey));
    const entry={
      ...(previous || {}), queueKey,identityKey,tenantId:identity.tenantId,userId:identity.userId,sourceKey,remoteId:stateOf(b).remoteId || previous?.remoteId || null,
      payload:prospectPayload(b), syncProfile:syncProfile || previous?.syncProfile===true,
      pendingOperations:[...(previous?.pendingOperations || []),...operations],
      evidence:evidenceFile?{name:evidenceFile.name,type:evidenceFile.type,size:evidenceFile.size,blob:evidenceFile}:previous?.evidence || null,
      queuedAt:new Date().toISOString(),
    };
    await offlineTransaction('readwrite',store=>store.put(entry));
    return true;
  }catch(error){
    console.warn('No se pudo guardar la cola offline',error);
    return false;
  }
}
async function removeOfflineProspect(sourceKey,identity=CURRENT_IDENTITY){
  const queueKey=window.NovaForceSalesOfflineIdentity.queueKey(identity,sourceKey);
  if(!queueKey)return;
  try{await offlineTransaction('readwrite',store=>store.delete(queueKey))}catch(error){console.warn('No se pudo limpiar la cola offline',error)}
}
async function readOfflineProspects(identity=CURRENT_IDENTITY){
  const identityKey=window.NovaForceSalesOfflineIdentity.scopeKey(identity);
  if(!identityKey)return [];
  try{
    const entries=(await offlineTransaction('readonly',store=>store.index('byIdentity').getAll(identityKey),OFFLINE_STORE_V2)) || [];
    return entries.filter(entry=>window.NovaForceSalesOfflineIdentity.entryMatchesIdentity(entry,identity));
  }catch(error){console.warn('No se pudo leer la cola offline',error);return []}
}
async function restoreOfflineEvidencePreviews(){
  await migrateLegacyOfflineProspects();
  const entries=await readOfflineProspects(CURRENT_IDENTITY);
  let restored=false;
  for(const entry of entries){
    if(!entry.evidence?.blob)continue;
    const business=findBusinessByKey(entry.sourceKey);
    if(!business)continue;
    const state=stateOf(business);
    if(!state.evidencePreviewUrl || state.evidencePreviewUrl.startsWith('blob:')){
      if(state.evidencePreviewUrl?.startsWith('blob:'))URL.revokeObjectURL(state.evidencePreviewUrl);
      state.evidencePreviewUrl=URL.createObjectURL(entry.evidence.blob);
    }
    state.evidenceName=entry.evidence.name || state.evidenceName;
    state.evidenceType=entry.evidence.type || state.evidenceType;
    state.evidencePending=true;
    state.syncPending=true;
    state.syncStatus='Pendiente de sincronización';
    restored=true;
  }
  if(restored){persistCommercial();render();refreshFocusedQuickPointPopup()}
}
async function uploadEvidence(file){
  if(!canForceSales('attachEvidence')&&!canForceSales('importProspects'))throw new Error('No tienes permiso para adjuntar evidencia');
  // La foto de un teléfono pesa de 3 a 7 MB: se reduce antes de subirla (conserva el EXIF; ante cualquier fallo sube la original).
  if(window.NovaForceSalesEvidenceImage)file=await window.NovaForceSalesEvidenceImage.prepare(file);
  const metadata=await forceSalesRequest('/storage/uploads/force-sales-evidence',{method:'POST',body:JSON.stringify({fileName:file.name,mimeType:file.type || 'application/octet-stream',size:file.size})});
  if(!metadata?.signedUrl || !metadata?.uri) throw new Error('El ERP no autorizó la subida de evidencia');
  const upload=await fetch(metadata.signedUrl,{method:'PUT',headers:{'Content-Type':file.type || 'application/octet-stream'},body:file});
  if(!upload.ok) throw new Error('No se pudo subir la evidencia al almacenamiento');
  return metadata;
}
async function flushOutbox(){
  const token=localStorage.getItem('nh-auth-token') || '';
  if(flushingOutbox || !navigator.onLine || !token||!window.NovaForceSalesOfflineIdentity.tokenMatchesIdentity(token,CURRENT_IDENTITY)) return;
  flushingOutbox=true;
  let syncedAny=false;
  try{
    await migrateLegacyOfflineProspects();
    if(localStorage.getItem('nh-auth-token')!==token)return;
    const entries=await readOfflineProspects(CURRENT_IDENTITY);
    for(const entry of entries){
      if(!window.NovaForceSalesOfflineIdentity.entryMatchesIdentity(entry,CURRENT_IDENTITY))continue;
      const payload={...(entry.payload || {})};
      try{
        const business=businesses.find(item=>keyOf(item)===entry.sourceKey);
        let remoteId=entry.remoteId || (business && stateOf(business).remoteId) || null;
        if(entry.syncProfile!==false){
          if(remoteId){
            if(!canForceSales('updateProspect'))continue;
            try{
              await forceSalesRequest(`/force-sales/prospects/${encodeURIComponent(remoteId)}`,{method:'PATCH',body:JSON.stringify(profilePayloadFromPayload(payload))});
            }catch(error){
              if(error?.status!==404||!canForceSales('importProspects'))throw error;
              remoteId=null;
              const recreated=await forceSalesRequest('/force-sales/prospects/bulk',{method:'POST',body:JSON.stringify({prospects:[payload]})});
              remoteId=recreated?.prospects?.[0]?.id || null;
              if(!remoteId)throw new Error('El ERP no pudo recrear el cliente pendiente');
            }
          }else{
            if(!canForceSales('importProspects'))continue;
            const result=await forceSalesRequest('/force-sales/prospects/bulk',{method:'POST',body:JSON.stringify({prospects:[payload]})});
            remoteId=result?.prospects?.[0]?.id || null;
          }
        }
        if(!remoteId && (entry.evidence?.blob || entry.pendingOperations?.length))continue;
        if(entry.evidence?.blob){
          if(!canForceSales('attachEvidence')&&!canForceSales('importProspects'))continue;
          const uploaded=await uploadEvidence(entry.evidence.blob);
          await forceSalesRequest(`/force-sales/prospects/${encodeURIComponent(remoteId)}`,{method:'PATCH',body:JSON.stringify({evidenceUri:uploaded.uri,evidenceName:entry.evidence.name,evidenceType:entry.evidence.type})});
          if(business){const state=stateOf(business);state.evidenceUri=uploaded.uri;state.evidencePreviewUrl=URL.createObjectURL(entry.evidence.blob);state.evidencePending=false;persistCommercial()}
        }
        if((entry.pendingOperations || []).some(operation=>(operation.actions || [operation.action]).some(action=>!canForceSales(action))))continue;
        for(const operation of entry.pendingOperations || []){
          await forceSalesRequest(`/force-sales/prospects/${encodeURIComponent(remoteId)}${operation.suffix || ''}`,{method:operation.method || 'PATCH',body:JSON.stringify(operation.body || {})});
        }
        if(business){
          const state=stateOf(business);
          if(remoteId)state.remoteId=remoteId;
          state.syncPending=false;
          state.syncStatus='Sincronizado';
          persistCommercial();
        }
        await removeOfflineProspect(entry.sourceKey);
        syncedAny=true;
      }catch(error){console.warn('La cola offline seguirá pendiente',error)}
    }
  }finally{
    flushingOutbox=false;
    if(syncedAny){
      mergeBusinesses();
      render();
      refreshFocusedQuickPointPopup();
    }
  }
}
function profilePayloadFromPayload(payload){
  return {name:payload.name,phone:payload.phone || null,website:payload.website || null,address:payload.address || null,zone:payload.zone || null,category:payload.category || null,priority:payload.priority || 'C',notes:payload.notes || null};
}
function prospectPayload(b){
  const c=stateOf(b);
  return {
    sourceKey:keyOf(b), clientTenantId:CURRENT_TENANT_ID || null, googlePlaceId:b.googlePlaceId || null, name:b.name, phone:b.phone || null,
    website:b.website || null, address:b.address || null, zone:b.zone || null, category:b.category || null,
    lat:b.lat, lng:b.lng, rating:b.rating || null, reviews:b.reviews || 0, novaFitScore:b.score || 0,
    priority:b.priority || 'C', selected:Boolean(c.selected), stage:stageToApi(statusOf(b)),
    discardedReason:c.discardReason || null, assignedToId:c.assignedToId || null, zoneCellId:c.assignedCellId || null,
    visitedAt:c.visitedAt || null, visitLat:c.visitLat ?? null, visitLng:c.visitLng ?? null,
    notes:(followups[b.id] || {}).note || null, evidenceName:c.evidenceName || null, evidenceType:c.evidenceType || null, evidenceUri:c.evidenceUri || null,
    whatsappPhone:c.whatsappPhone || b.phone || null,
    whatsappOptIn:c.whatsappOptIn === undefined ? undefined : Boolean(c.whatsappOptIn),
    whatsappOptInSource:c.whatsappOptInSource || null,
  };
}
function prospectProfilePayload(b){
  const followup=followups[b.id] || {};
  return {
    name:b.name, phone:b.phone || null, website:b.website || null, address:b.address || null,
    zone:b.zone || null, category:b.category || null, priority:b.priority || 'C',
    notes:followup.note || null,
  };
}
async function syncProspects(list, evidenceFile=null){
  const items=list.filter(Boolean);
  if(!items.length) return null;
  const pendingEvidence=evidenceFile;
  if(pendingEvidence && !canForceSales('attachEvidence')&&!canForceSales('importProspects')){toast('Tu rol no tiene permiso para subir imágenes');return null}
  const syncable=items.filter(item=>{
    const state=stateOf(item);
    return state.remoteId ? canForceSales('updateProspect') || Boolean(pendingEvidence&&canForceSales('attachEvidence')) : canForceSales('importProspects');
  });
  if(syncable.length<items.length)toast('Se omitieron perfiles que tu rol no puede editar o importar');
  if(!syncable.length)return null;
  syncable.forEach(item=>{if(!stateOf(item).remoteId)item.createdBy=item.createdBy||currentUserAttribution()||undefined});
  if(!navigator.onLine || !localStorage.getItem('nh-auth-token')){
    const queued=await Promise.all(syncable.map(item=>{
      const state=stateOf(item);
      state.syncPending=true;
      state.syncStatus='Pendiente de sincronización';
      const syncProfile=state.remoteId ? canForceSales('updateProspect') : canForceSales('importProspects');
      return saveOfflineProspect(item,evidenceFile,[],syncProfile);
    }));
    if(queued.every(Boolean)) toast('Guardado offline · se sincronizará al recuperar conexión');
    return null;
  }
  try{
    const saved=[];
    for(const business of syncable){
      const state=stateOf(business);
      state.syncPending=true;
      state.syncStatus='Sincronizando';
      if(!state.remoteId){
        const result=await forceSalesRequest('/force-sales/prospects/bulk',{method:'POST',body:JSON.stringify({prospects:[prospectPayload(business)]})});
        const prospect=result?.prospects?.[0];
        if(!prospect)throw new Error('El ERP no registró el cliente importado');
        state.remoteId=prospect.id;
        if(prospect.createdBy)business.createdBy=prospect.createdBy;
        saved.push(prospect);
      }else if(canForceSales('updateProspect')){
        try{
          const prospect=await forceSalesRequest(`/force-sales/prospects/${encodeURIComponent(state.remoteId)}`,{method:'PATCH',body:JSON.stringify(prospectProfilePayload(business))});
          if(prospect)saved.push(prospect);
        }catch(error){
          if(error?.status!==404||!canForceSales('importProspects'))throw error;
          state.remoteId=null;
          const result=await forceSalesRequest('/force-sales/prospects/bulk',{method:'POST',body:JSON.stringify({prospects:[prospectPayload(business)]})});
          const prospect=result?.prospects?.[0];
          if(!prospect)throw new Error('El ERP no pudo recrear el cliente importado');
          state.remoteId=prospect.id;
          if(prospect.createdBy)business.createdBy=prospect.createdBy;
          saved.push(prospect);
        }
      }
      if(pendingEvidence){
        const uploaded=await uploadEvidence(pendingEvidence);
        state.evidenceUri=uploaded.uri;
        if(state.remoteId){
          const evidence=await forceSalesRequest(`/force-sales/prospects/${encodeURIComponent(state.remoteId)}`,{method:'PATCH',body:JSON.stringify({evidenceUri:uploaded.uri,evidenceName:pendingEvidence.name,evidenceType:pendingEvidence.type})});
          if(evidence)saved.push(evidence);
          state.evidencePending=false;
        }
      }
      state.syncPending=false;
      state.syncStatus='Sincronizado';
    }
    persistCommercial();
    return {total:saved.length,prospects:saved};
  }catch(e){
    console.warn('Fuerza Comercial local: no se pudo sincronizar con el ERP',e);
    toast(e?.message || 'No se pudo sincronizar el cliente con el ERP');
    const queued=await Promise.all(syncable.map(item=>{
      const state=stateOf(item);
      state.syncPending=true;
      state.syncStatus='Pendiente de sincronización';
      const syncProfile=state.remoteId ? canForceSales('updateProspect') : canForceSales('importProspects');
      return saveOfflineProspect(item,pendingEvidence,[],syncProfile);
    }));
    if(queued.every(Boolean)) toast('Cambios guardados offline · se sincronizarán automáticamente');
    return null;
  }
}
async function persistProspectAction(b,action,suffix,body,evidenceFile=null){
  const actions=Array.isArray(action)?action:[action];
  for(const requiredAction of actions)if(!canForceSales(requiredAction))return requireForceSales(requiredAction);
  const state=stateOf(b);
  if(!localStorage.getItem('nh-auth-token')){toast('Inicia sesión para sincronizar esta acción');return false}
  const method=suffix==='/visit'||suffix==='/discard'? 'POST':'PATCH';
  if(!navigator.onLine){
    if(!state.remoteId && !requireForceSales('importProspects'))return false;
    const queued=await saveOfflineProspect(b,evidenceFile,[{actions,suffix,method,body}],!state.remoteId);
    if(queued)toast('Acción guardada offline · se sincronizará automáticamente');
    return queued;
  }
  if(!state.remoteId){
    if(!requireForceSales('importProspects'))return false;
    await syncProspects([b]);
  }
  if(!state.remoteId){toast('Punto guardado en el mapa; la sincronización con el ERP sigue pendiente');return false}
  const requestBody={...(body || {})};
  if(evidenceFile){
    if(!requireForceSales('attachEvidence'))return false;
    const uploaded=await uploadEvidence(evidenceFile);
    requestBody.evidenceUri=uploaded.uri;requestBody.evidenceName=evidenceFile.name;requestBody.evidenceType=evidenceFile.type;
    state.evidenceUri=uploaded.uri;state.evidencePending=false;persistCommercial();
  }
  try{
    await forceSalesRequest(`/force-sales/prospects/${encodeURIComponent(state.remoteId)}${suffix}`,{method,body:JSON.stringify(requestBody)});
    return true;
  }catch(error){console.warn('No se pudo sincronizar la acción comercial',error);toast(error?.message || 'El ERP rechazó la acción comercial');return false}
}
function remoteBusiness(prospect){
  const id=prospect.googlePlaceId ? `google-${prospect.googlePlaceId}` : prospect.sourceKey || `remote-${prospect.id}`;
  const lat=Number(prospect.lat),lng=Number(prospect.lng);
  const hasCoordinates=Number.isFinite(lat)&&Number.isFinite(lng);
  return {id,sourceKey:prospect.sourceKey || undefined,googlePlaceId:prospect.googlePlaceId || undefined,zoneCellId:prospect.zoneCellId || undefined,name:prospect.name || 'Prospecto sin nombre',zone:prospect.zone || nearestZone(hasCoordinates?lat:12.115,hasCoordinates?lng:-86.26),category:prospect.category || 'Comercio / servicios',address:prospect.address || 'Dirección pendiente de validar',source:prospect.googlePlaceId?'Nova':'Fuerza Comercial',sourceUrl:prospect.sourceUrl || '',lat:hasCoordinates?lat:null,lng:hasCoordinates?lng:null,precision:hasCoordinates?'Prospecto persistido en NovaHub':'Pendiente de georreferenciar',score:Number(prospect.novaFitScore)||0,priority:prospect.priority || 'C',owner:'Fuerza Comercial',phone:prospect.phone || '',website:prospect.website || '',rating:prospect.rating || null,reviews:prospect.reviews || 0,assignedToName:prospect.assignedTo?.name || null,createdById:prospect.createdById||prospect.createdBy?.id||null,createdBy:prospect.createdBy?.name?{id:prospect.createdBy.id,name:prospect.createdBy.name}:null,customerId:prospect.customerId||null,customer:prospect.customer||null,customerLinkedAt:prospect.customerLinkedAt||null,customerLinkedBy:prospect.customerLinkedBy||null};
}
async function loadRemoteProspects(){
  if(!localStorage.getItem('nh-auth-token')) return;
  if(remoteProspectsLoading){remoteProspectsRefreshRequested=true;return}
  remoteProspectsLoading=true;
  lastRemoteRefreshAt=Date.now();
  try{
    const data=await forceSalesRequest('/force-sales/prospects');
    if(!Array.isArray(data))throw new Error('La respuesta del catálogo no tiene el formato esperado.');
    forceSalesSyncErrors.delete('catálogo');
    updateOfflineStatus();
    const remoteGoogleKeys=new Set(data.filter(prospect=>prospect.googlePlaceId).map(prospect=>String(prospect.googlePlaceId)));
    const legacyLocal=LEAD_DISCOVERY_ENABLED
      ? googlePlaces.filter(place=>place.googlePlaceId && !remoteGoogleKeys.has(String(place.googlePlaceId))).slice(0,500)
      : [];
    if(legacyLocal.length && !legacyCatalogSyncInFlight){
      legacyCatalogSyncInFlight=true;
      let migrated=null;
      try{migrated=await syncProspects(legacyLocal)}finally{legacyCatalogSyncInFlight=false}
      if(migrated){
        remoteProspectsLoading=false;
        return loadRemoteProspects();
      }
      setForceSalesSyncError('catálogo','No se pudieron sincronizar los negocios guardados en este dispositivo.');
      return;
    }
    const signature=data.map(prospect=>`${prospect.id}:${prospect.updatedAt || ''}:${prospect.stage || ''}:${prospect.assignedToId || ''}:${prospect.createdById || ''}:${prospect.createdBy?.name || ''}`).sort().join('|');
    if(signature===lastRemoteProspectsSignature)return;
    lastRemoteProspectsSignature=signature;
    remoteProspects=data.map(prospect=>{
      const business=remoteBusiness(prospect); const key=keyOf(business); const current=commercialState[key] || {};
      const stage=stageToUi(prospect.stage);
      commercialState[key]={...current,remoteId:prospect.id,customerId:prospect.customerId||null,customer:prospect.customer||null,customerLinkedAt:Object.prototype.hasOwnProperty.call(prospect,'customerLinkedAt')?prospect.customerLinkedAt:current.customerLinkedAt,customerLinkedBy:Object.prototype.hasOwnProperty.call(prospect,'customerLinkedBy')?prospect.customerLinkedBy:current.customerLinkedBy,selected:Boolean(prospect.selected),kanban:current.kanban || Boolean(prospect.selected) || stage!=='Nuevo',stage,discarded:stage==='Descartado',discardReason:prospect.discardedReason || current.discardReason,assignedToId:Object.prototype.hasOwnProperty.call(prospect,'assignedToId')?prospect.assignedToId:current.assignedToId,assignedToName:prospect.assignedTo?.name || (Object.prototype.hasOwnProperty.call(prospect,'assignedToId')&&!prospect.assignedToId?null:current.assignedToName),assignedCellId:prospect.zoneCellId ?? current.assignedCellId,visitedAt:prospect.visitedAt || current.visitedAt,visitLat:prospect.visitLat ?? current.visitLat,visitLng:prospect.visitLng ?? current.visitLng,evidenceName:prospect.evidenceName || current.evidenceName,evidenceType:prospect.evidenceType || current.evidenceType,evidenceUri:prospect.evidenceUri || current.evidenceUri,whatsappPhone:prospect.phone || current.whatsappPhone,whatsappOptIn:Boolean(prospect.whatsappOptIn),whatsappOptInSource:prospect.whatsappOptInSource || current.whatsappOptInSource};
      return business;
    });
    // Online, NovaHub is the shared catalog. The device cache remains only as
    // a fallback while offline so different devices converge on one count.
    if(LEAD_DISCOVERY_ENABLED)googlePlaces=remoteProspects.filter(item=>item.googlePlaceId);
    localStorage.setItem(GOOGLE_CATALOG_KEY,JSON.stringify(googlePlaces));
    persistCommercial(); mergeBusinesses(); populateFilters(); render();
  }catch(e){
    console.warn('No se pudo sincronizar el catálogo compartido de Fuerza Comercial',e);
    setForceSalesSyncError('catálogo',e);
  }
  finally{
    remoteProspectsLoading=false;
    if(remoteProspectsRefreshRequested){remoteProspectsRefreshRequested=false;void loadRemoteProspects();}
  }
}
function updatePipelineKpis(visibleBusinesses=businesses){
  // This KPI is Nova's shared discovered catalog. It is synchronized with the
  // persisted CRM records so it stays consistent across devices.
  document.getElementById('foundCount').textContent=visibleBusinesses.filter(isGoogleFound).length;
  document.getElementById('selectedCount').textContent=visibleBusinesses.filter(isSelected).length;
  document.getElementById('kanbanCount').textContent=visibleBusinesses.filter(isKanban).length;
  document.getElementById('visitedCount').textContent=visibleBusinesses.filter(isVisited).length;
  document.getElementById('interestedCount').textContent=visibleBusinesses.filter(isInterested).length;
  document.querySelectorAll('.kpi[data-pipeline]').forEach(el=>el.classList.toggle('active',el.dataset.pipeline===pipelineFilter));
  document.getElementById('selectionSummary').textContent=`${visibleBusinesses.filter(isSelected).length} seleccionados`;
  window.NovaForceSalesModes.requestSummary();
}
function formatSellerTotals(totals){
  return (Array.isArray(totals) ? totals : []).map(item => `${item.currency} ${Number(item.total || 0).toLocaleString('es-NI',{minimumFractionDigits:2,maximumFractionDigits:2})}`).join(' · ') || '—';
}
async function loadSellerSummary(){
  if(!localStorage.getItem('nh-auth-token'))return;
  try{
    const summary=await forceSalesRequest('/force-sales/summary');
    const total=Number(summary?.prospects?.total || 0);
    const quoteTotals=Array.isArray(summary?.quotes?.totals) ? summary.quotes.totals : [];
    const acceptedTotals=Array.isArray(summary?.quotes?.accepted) ? summary.quotes.accepted : [];
    document.getElementById('sellerProspects').textContent=String(total);
    document.getElementById('sellerQuotes').textContent=String(quoteTotals.reduce((sum,item)=>sum + Number(item.count || 0),0));
    document.getElementById('sellerAccepted').textContent=String(acceptedTotals.reduce((sum,item)=>sum + Number(item.count || 0),0));
    document.getElementById('sellerQuotedValue').textContent=formatSellerTotals(quoteTotals);
    document.getElementById('sellerSummary').hidden=false;
  }catch(error){console.warn('No se pudo cargar el resumen comercial',error)}
}
async function loadAssignees(){
  assigneesLoadState='loading';
  refreshAssigneeViews();
  if(!localStorage.getItem('nh-auth-token')){
    assigneesLoadState='error';
    refreshAssigneeViews();
    return;
  }
  try{
    const rows=await forceSalesRequest('/force-sales/assignees');
    const unique=new Map();
    (Array.isArray(rows) ? rows : []).filter(item=>item?.id).forEach(item=>unique.set(String(item.id),item));
    assignees=[...unique.values()];
    assigneesLoadState='ready';
    refreshAssigneeViews();
  }catch(error){
    assigneesLoadState='error';
    console.warn('No se pudo cargar la lista de vendedores',error);
    refreshAssigneeViews();
  }
}
function refreshAssigneeViews(){
  syncTrailUserSelect(document.getElementById('mapTrailUser'));
  renderSavedRouteOptions();
  renderRoutePlanner();
  if(activeView==='history')renderHistory();
  const openBusiness=findBusiness(currentPopupBusinessId);
  if(openBusiness)rerenderKeepingPopup(openBusiness);
}
