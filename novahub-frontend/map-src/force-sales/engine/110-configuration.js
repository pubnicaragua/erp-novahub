async function loadForceSalesConfiguration(){
  if(!localStorage.getItem('nh-auth-token'))return;
  try{
    forceSalesConfig=await forceSalesRequest('/force-sales/config');
    lastForceSalesConfigRefreshAt=Date.now();
    ROUTE_LOGO_URI=forceSalesConfig?.routeLogoUri || mapQuery.get('companyLogo') || NOVAHUB_ISOTIPO_URL;
    setCompanyLogo(ROUTE_LOGO_URI);
    LOCATION_REQUIRED=forceSalesConfig?.locationRequiredNow ?? forceSalesConfig?.locationRequired===true;
    CAN_SHARE_PRESENCE=forceSalesConfig?.canDisableLocation!==false;
    CAN_MANAGE_CONFIGURATION=forceSalesConfig?.canManageConfiguration===true;
    // El modo lo define el ERP (activación por empresa en Suscripciones); la prospección solo existe en su modo.
    LEAD_DISCOVERY_ENABLED=ACTIVE_MODE==='prospecting';
    applyOperatingMode();
    applyMapConfigurationSettings();
    if(LOCATION_REQUIRED && forceSalesConfig?.canDisableLocation===false){
      presenceSharingEnabled=true;
      localStorage.setItem(PRESENCE_STORAGE_KEY,'true');
      if(EXTERNAL_DURABLE_TRACKING)window.parent.postMessage({source:'novahub-force-sales',type:'presence-sharing-changed',enabled:true},location.origin);
      presenceWatchRequested=true;
      startPresenceWatch();
    }
    updatePresenceToggle();
    if(LOCATION_REQUIRED) requestCurrentLocation();
    forceSalesSyncErrors.delete('configuración');
    updateOfflineStatus();
  }catch(error){
    console.warn('No se pudo cargar la política de ubicación de Fuerza Comercial',error);
    setForceSalesSyncError('configuración',error);
  }
}
function applyOperatingMode(){
  applyModeVisibility();
  if(activeView==='kanban' && ACTIVE_MODE!=='prospecting')activeView='map';
  const title=document.getElementById('resultsTitle');
  if(title)title.textContent=window.NovaForceSalesModes.titleFor(ACTIVE_MODE);
  mergeBusinesses();
  populateFilters();
  render();
}
function applyMapConfigurationSettings(){
  const settings=document.getElementById('mapConfigurationSettings');
  if(settings)settings.hidden=!CAN_MANAGE_CONFIGURATION;
  const quickButton=document.getElementById('mapConfigurationButton');
  if(quickButton)quickButton.hidden=!CAN_MANAGE_CONFIGURATION;
  const provider=document.getElementById('mapProviderSelect');
  const searchMode=document.getElementById('mapSearchModeSelect');
  const tile=document.getElementById('mapTileUrlInput');
  const geocoder=document.getElementById('mapGeocoderUrlInput');
  if(provider)provider.value=String(forceSalesConfig?.mapProvider || window.__novaMapProvider || 'GOOGLE').toUpperCase();
  if(searchMode)searchMode.value=String(forceSalesConfig?.mapSearchMode || window.__novaMapSearchMode || 'EXTERNAL').toUpperCase();
  if(tile)tile.value=String(forceSalesConfig?.mapTileUrl || window.__novaMapTileUrl || '');
  if(geocoder)geocoder.value=String(forceSalesConfig?.mapGeocoderUrl || window.__novaMapGeocoderUrl || '');
  const help=document.getElementById('mapConfigurationHelp');
  if(help)help.textContent=String(forceSalesConfig?.mapProvider || window.__novaMapProvider || 'GOOGLE').toUpperCase()==='GOOGLE'
    ? 'Google Maps usa la clave pública configurada en el entorno del frontend.'
    : 'El cambio se aplicará al recargar el mapa y requiere un geocodificador propio cuando la búsqueda externa esté activa.';
}
async function saveMapConfiguration(){
  if(!CAN_MANAGE_CONFIGURATION)return;
  const provider=document.getElementById('mapProviderSelect')?.value || 'GOOGLE';
  const mapSearchMode=document.getElementById('mapSearchModeSelect')?.value || 'EXTERNAL';
  const mapTileUrl=document.getElementById('mapTileUrlInput')?.value.trim() || null;
  const mapGeocoderUrl=document.getElementById('mapGeocoderUrlInput')?.value.trim() || null;
  try{
    const saved=await forceSalesRequest('/force-sales/config',{method:'PATCH',body:JSON.stringify({mapProvider:provider,mapSearchMode,mapTileUrl,mapGeocoderUrl})});
    forceSalesConfig={...(forceSalesConfig||{}),...saved};
    applyMapConfigurationSettings();
    window.parent?.postMessage({source:'novahub-force-sales',type:'configuration-updated',configuration:forceSalesConfig},'*');
    toast('Configuración de mapas guardada · recargando motor');
  }catch(error){toast('No se pudo guardar la configuración de mapas')}
}
function openMapConfiguration(){
  if(!CAN_MANAGE_CONFIGURATION){toast('Solo el administrador de la empresa puede configurar el mapa');return}
  const title=document.getElementById('locationTitle');
  const help=document.getElementById('locationHelpText');
  const steps=document.getElementById('locationSteps');
  const privacy=document.getElementById('locationPrivacy');
  const mode=document.getElementById('commercialModeSettings');
  const settings=document.getElementById('mapConfigurationSettings');
  if(title)title.textContent='Configuración del mapa';
  if(help)help.textContent='Elige el proveedor, la fuente de búsqueda y cómo se georreferenciarán los clientes importados.';
  if(steps)steps.hidden=true;
  if(privacy)privacy.hidden=true;
  if(mode)mode.hidden=true;
  if(settings)settings.hidden=false;
  document.getElementById('locationModal').hidden=false;
  applyMapConfigurationSettings();
}
function openLocationSettings(){
  const title=document.getElementById('locationTitle');
  const help=document.getElementById('locationHelpText');
  const steps=document.getElementById('locationSteps');
  const settings=document.getElementById('mapConfigurationSettings');
  if(title)title.textContent='Ubicación y privacidad';
  if(help)help.textContent='La ubicación del teléfono puede estar activa, pero el navegador tiene bloqueado el permiso para este sitio.';
  if(steps)steps.hidden=false;
  if(settings)settings.hidden=true;
  document.getElementById('locationModal').hidden=false;
  updatePresenceToggle();
}
