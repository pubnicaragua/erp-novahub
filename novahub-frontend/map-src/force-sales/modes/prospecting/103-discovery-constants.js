const GOOGLE_CACHE_TTL = 6 * 60 * 60 * 1000;
const GOOGLE_SEARCH_MAX_RESULTS = 100;
const GOOGLE_CATALOG_KEY = HAS_AUTHENTICATED_TENANT ? `novaGooglePlacesCatalogV1:${TENANT_SCOPE_KEY}` : 'novaGooglePlacesCatalogV1';
const DELETED_BUSINESSES_KEY = 'novaFuerzaDeletedBusinessesV1';
const NOVA_SEARCH_CURSOR_KEY = 'novaDiscoveryCursorV1';
const NOVA_DISCOVERY_AREAS = [
  {name:'Managua',center:[12.1364,-86.2514],radius:12000},
  {name:'Carretera a Masaya',center:[12.081,-86.219],radius:9000},
  {name:'Carretera Norte',center:[12.145,-86.191],radius:9000},
  {name:'Ciudad Sandino',center:[12.1587,-86.3442],radius:9000},
  {name:'Veracruz',center:[12.0525,-86.186],radius:8000},
  {name:'Ticuantepe',center:[12.0227,-86.2046],radius:8000},
  {name:'Masaya',center:[11.9744,-86.0942],radius:9000},
  {name:'Diriamba',center:[11.856,-86.239],radius:8000},
  {name:'Jinotepe / Carazo',center:[11.8496,-86.199],radius:8000},
];
const NOVA_DISCOVERY_QUERIES = [
  'empresas y negocios',
  'tiendas y comercios',
  'distribuidoras y mayoristas',
  'ferreterías y materiales de construcción',
  'farmacias clínicas y consultorios',
  'restaurantes cafeterías y comida',
  'talleres repuestos y automotriz',
  'servicios profesionales oficinas y tecnología',
  'logística transporte y bodegas',
  'hoteles hospedajes y centros comerciales',
];

