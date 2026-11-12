// Modo «Entregas»: ruta de un punto a otro, con regreso o con varias paradas. Los lugares de referencia de
// Google sí se ven (la gente da direcciones por referencia). Usa el planificador de rutas del motor.
window.NovaForceSalesModes.register({
  id:'delivery',
  title:'Entregas',
  searchPlaceholder:'Buscar entrega, cliente o dirección…',
  primaryAction:()=>({label:'Nueva ruta',disabled:!canForceSales('createRoute'),run:()=>document.getElementById('routePlannerQuick')?.click()}),
  kpis:()=>{
    const route=typeof activeRemoteRoute==='function'?activeRemoteRoute():null;
    const stops=Array.isArray(routeBusinesses)?routeBusinesses.length:0;
    const done=route&&typeof routeCompletedStopCount==='function'?routeCompletedStopCount(route):routeProgress;
    const next=route&&typeof routeNextPendingIndex==='function'?routeBusinesses[routeNextPendingIndex(route)]:routeBusinesses[routeProgress];
    return [
      {id:'routes',label:'Rutas activas',value:remoteRoutes.filter(item=>['PLANNED','IN_PROGRESS'].includes(String(item.status||'').toUpperCase())).length},
      {id:'stops',label:'Paradas en la ruta',value:stops},
      {id:'done',label:'Completadas',value:Number(done)||0},
      {id:'next',label:'Siguiente parada',value:next?.name||'—'},
    ];
  },
  search:(query)=>{
    const input=document.getElementById('search');
    if(!input)return;
    input.value=query;
    input.dispatchEvent(new Event('input',{bubbles:true}));
  },
});
