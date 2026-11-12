// Registro de modos del mapa (visitas y zonas, prospección, entregas, ...).
//
// El mapa base no sabe de negocio: cada modo se registra con su título, su acción principal, su búsqueda
// y sus indicadores, y el motor solo pinta el modo activo. El ERP (React) decide qué modos tiene la empresa
// y abre el mapa con ?mode=<modo activo>&modes=<modos habilitados>. Añadir un cuarto modo es sumar un archivo
// en modes/ que llame a NovaForceSalesModes.register(...); los demás modos no se tocan.
window.NovaForceSalesModes=(()=>{
  const LAYER_KEYS=Object.freeze(['users','manualPoints','catalog','plannedRoutes','gpsTrail','basePlaces']);
  // Valores de respaldo; el ERP envía las capas efectivas de la empresa en ?layerDefaults=.
  const FALLBACK_LAYERS=Object.freeze({
    visits:Object.freeze({users:true,manualPoints:true,catalog:true,plannedRoutes:false,gpsTrail:false,basePlaces:false}),
    prospecting:Object.freeze({users:true,manualPoints:true,catalog:true,plannedRoutes:false,gpsTrail:false,basePlaces:true}),
    delivery:Object.freeze({users:true,manualPoints:true,catalog:true,plannedRoutes:true,gpsTrail:false,basePlaces:true}),
  });
  const MODE_ID=/^[a-z][a-z0-9-]{1,30}$/;
  const definitions=new Map();
  let activeId='';
  let summaryFrame=0;

  function parseModes(value){
    return [...new Set(String(value||'').split(',').map(item=>item.trim()).filter(item=>MODE_ID.test(item)))];
  }
  // Sin parámetros (una pestaña con el ERP anterior) se conserva el comportamiento previo: visitas + prospección.
  function resolve(params){
    const get=key=>typeof params?.get==='function'?params.get(key):'';
    const parsed=parseModes(get('modes'));
    const modes=parsed.length?parsed:['visits','prospecting'];
    const requested=String(get('mode')||'').trim();
    return {modes,mode:modes.includes(requested)?requested:modes[0]};
  }
  function layerDefaults(mode,raw){
    let custom={};
    try{custom=JSON.parse(raw||'{}')||{}}catch{custom={}}
    const base={...(FALLBACK_LAYERS[mode]||FALLBACK_LAYERS.visits)};
    for(const key of LAYER_KEYS)if(typeof custom[key]==='boolean')base[key]=custom[key];
    return base;
  }
  function register(definition){
    if(!definition||!MODE_ID.test(String(definition.id||'')))throw new Error('Modo del mapa sin identificador válido');
    definitions.set(definition.id,Object.freeze({...definition}));
  }
  function activate(id){activeId=definitions.has(id)?id:activeId}
  function active(){return definitions.get(activeId)||null}
  function titleFor(id){return definitions.get(id)?.title||id}

  // Resumen que el ERP dibuja arriba del mapa: título, indicadores, buscador y acción principal.
  function summary(){
    const mode=active();
    if(!mode)return null;
    const primary=typeof mode.primaryAction==='function'?mode.primaryAction():mode.primaryAction;
    return {
      mode:mode.id,
      title:mode.title,
      searchPlaceholder:mode.searchPlaceholder||'Buscar…',
      primaryAction:primary?{label:String(primary.label||''),disabled:Boolean(primary.disabled)}:null,
      kpis:(typeof mode.kpis==='function'?mode.kpis():[]).map(item=>({id:String(item.id),label:String(item.label),value:item.value})),
    };
  }
  function publishSummary(target){
    const data=summary();
    if(!data||!target||typeof target.postMessage!=='function')return;
    target.postMessage({source:'novahub-force-sales',type:'force-sales-summary',...data},window.location.origin);
  }
  // Agrupa varias actualizaciones seguidas en un solo mensaje por cuadro de animación.
  function requestSummary(){
    if(summaryFrame||window.parent===window)return;
    summaryFrame=requestAnimationFrame(()=>{summaryFrame=0;publishSummary(window.parent)});
  }
  function handleShellMessage(event){
    if(event.source!==window.parent||event.origin!==window.location.origin)return;
    const data=event.data;
    if(data?.source!=='novahub-force-sales')return;
    const mode=active();
    if(!mode)return;
    if(data.type==='force-sales-search'&&typeof mode.search==='function')mode.search(String(data.query||''),{submit:data.submit===true});
    if(data.type==='force-sales-primary-action'){
      const primary=typeof mode.primaryAction==='function'?mode.primaryAction():mode.primaryAction;
      if(primary&&!primary.disabled&&typeof primary.run==='function')primary.run();
    }
    if(data.type==='force-sales-request-summary')requestSummary();
  }
  function bind(){
    window.addEventListener('message',handleShellMessage);
    requestSummary();
  }
  return Object.freeze({LAYER_KEYS,FALLBACK_LAYERS,parseModes,resolve,layerDefaults,register,activate,active,titleFor,summary,requestSummary,bind});
})();
