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

// Tarjeta de un punto en la lista de entregas: marcarlo para la ruta y abrir la navegación.
function deliveryItemHtml(b){
  const picked=isSelected(b);
  return '<div class="item visit-item'+(picked?' selected-item':'')+'" data-id="'+esc(b.id)+'">'
    +'<div class="itemtop"><input class="check" type="checkbox" data-action="select" data-id="'+esc(b.id)+'"'+(picked?' checked':'')+' aria-label="Agregar '+esc(b.name)+' a la ruta">'
    +'<div><div class="itemname">'+esc(b.name)+'</div><div class="meta">'+esc(b.address||b.zone||'Sin dirección')+'</div></div></div>'
    +'<div class="item-actions">'
    +'<button class="visit-action" data-action="select" data-id="'+esc(b.id)+'">'+(picked?'✓ En la ruta':'Agregar a la ruta')+'</button>'
    +'<button data-action="navigate-google" data-id="'+esc(b.id)+'">Google Maps</button>'
    +'<button data-action="navigate-waze" data-id="'+esc(b.id)+'">Waze</button>'
    +'</div></div>';
}
