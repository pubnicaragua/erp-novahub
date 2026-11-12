function visitSelected(){
  if(!requireForceSales('registerVisit'))return;
  const chosen=selectedBusinesses(); if(!chosen.length){toast('Selecciona negocios para registrar visitas');return}
  toast('Capturando ubicación para la visita…');
  withLocationAccess(position=>{
    void (async()=>{
      let savedCount=0;
      for(const b of chosen){
        const visitedAt=new Date().toISOString();
        const saved=await persistProspectAction(b,'registerVisit','/visit',{visitLat:position.coords.latitude,visitLng:position.coords.longitude,visitedAt});
        if(!saved)continue;
        const c=stateOf(b);c.visitedAt=visitedAt;c.visitLat=position.coords.latitude;c.visitLng=position.coords.longitude;c.stage='Visitado';c.kanban=true;
        followups[b.id]={...(followups[b.id]||{}),status:'Visitado',updatedAt:visitedAt};savedCount++;
      }
      localStorage.setItem('novaManaguaFollowupsV4',JSON.stringify(followups));persistCommercial();render();
      toast(`${savedCount} de ${chosen.length} visitas registradas con ubicación`);
    })();
  },'No se pudo obtener la ubicación para registrar las visitas');
}
function discardSelected(){
  const chosen=selectedBusinesses(); if(!chosen.length){toast('Selecciona negocios para descartar');return}
  openDiscardDialog(chosen.map(b=>b.id));
}
async function sendSelectedWhatsApp(){
  if(!requireForceSales('send'))return;
  const chosen=selectedBusinesses().filter(b=>stateOf(b).whatsappOptIn && (stateOf(b).whatsappPhone || b.phone));
  if(!chosen.length){toast('Selecciona negocios con teléfono y opt-in de WhatsApp');return}
  if(!localStorage.getItem('nh-auth-token')){toast('Inicia sesión para usar WhatsApp oficial');return}
  const templateName=prompt('Nombre exacto de la plantilla aprobada por Meta','novahub_prospeccion');
  if(!templateName)return;
  const languageCode=prompt('Código de idioma de la plantilla','es');
  if(!languageCode)return;
  const consented=chosen.slice(0,50);
  const unsynced=consented.filter(b=>!stateOf(b).remoteId);
  if(unsynced.length){
    if(!requireForceSales('importProspects'))return;
    toast('Preparando prospectos nuevos en el ERP…');
    await syncProspects(unsynced);
  }
  const ids=consented.map(b=>stateOf(b).remoteId).filter(Boolean);
  if(ids.length!==consented.length){toast('No se pudieron preparar todos los prospectos para el envío');return}
  if(!confirm(`Se enviará la plantilla ${templateName} a ${ids.length} prospecto(s) con opt-in. ¿Continuar?`))return;
  try{
    const result=await forceSalesRequest('/force-sales/whatsapp/bulk',{method:'POST',body:JSON.stringify({ids,templateName,languageCode})});
    toast(`${result?.sent || 0} enviados · ${result?.failed || 0} rechazados`);
  }catch(error){console.error(error);toast('Meta no pudo procesar el lote. Revisa configuración y plantilla aprobada.')}
}

