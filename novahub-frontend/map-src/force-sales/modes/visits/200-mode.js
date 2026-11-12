// Modo «Visitas y zonas»: solo puntos propios (clientes de la empresa), visitas registradas por un responsable
// y zonas reasignables. No muestra negocios de Google. Las funciones que usa (zonas, rutas, visita) viven en este
// mismo ámbito del motor y se declaran en las partes anteriores.
window.NovaForceSalesModes.register({
  id:'visits',
  title:'Visitas y zonas',
  searchPlaceholder:'Buscar cliente, dirección o gestor…',
  primaryAction:()=>({label:'Nuevo punto',disabled:!canForceSales('importProspects'),run:()=>document.getElementById('newPoint')?.click()}),
  kpis:()=>{
    const points=businesses.filter(item=>stateOf(item).remoteId||item.remoteId);
    const today=new Date().toDateString();
    const visitedToday=points.filter(item=>{const at=stateOf(item).visitedAt;return at&&new Date(at).toDateString()===today}).length;
    const onField=presenceMarkers instanceof Map?presenceMarkers.size:0;
    return [
      {id:'points',label:'Clientes en el mapa',value:points.length},
      {id:'visitedToday',label:'Visitados hoy',value:visitedToday},
      {id:'pending',label:'Por visitar',value:Math.max(0,points.length-visitedToday)},
      {id:'onField',label:'Gestores en campo',value:onField},
      {id:'zonesNoOwner',label:'Zonas sin gestor',value:workZones.filter(zone=>!zone.assignedToId).length},
    ];
  },
  search:(query)=>{
    const input=document.getElementById('search');
    if(!input)return;
    input.value=query;
    input.dispatchEvent(new Event('input',{bubbles:true}));
  },
});
