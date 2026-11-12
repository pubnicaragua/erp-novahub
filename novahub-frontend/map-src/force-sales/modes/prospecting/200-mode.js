// Modo «Prospección»: con la ubicación actual encuentra todos los negocios cercanos (Google Places) y los
// lleva por el embudo comercial (selección, Kanban, visita, WhatsApp). Es la función original del mapa.
window.NovaForceSalesModes.register({
  id:'prospecting',
  title:'Prospección',
  searchPlaceholder:'Buscar negocio, rubro o dirección…',
  primaryAction:()=>({label:'Encontrar negocios cerca de mí',disabled:!canForceSales('importProspects'),run:()=>searchNearbyFromDevice()}),
  kpis:()=>{
    const count=id=>Number(document.getElementById(id)?.textContent||0);
    return [
      {id:'found',label:'Encontrados',value:count('foundCount')},
      {id:'selected',label:'Seleccionados',value:count('selectedCount')},
      {id:'kanban',label:'En Kanban',value:count('kanbanCount')},
      {id:'visited',label:'Visitados',value:count('visitedCount')},
      {id:'interested',label:'Interesados',value:count('interestedCount')},
    ];
  },
  search:(query,options={})=>{
    const input=document.getElementById('search');
    if(!input)return;
    input.value=query;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    // Enter en la barra del ERP busca también en Google; escribir solo filtra lo que ya está en el mapa.
    if(options.submit&&query.trim())searchGooglePlaces(query,{force:true});
  },
});
