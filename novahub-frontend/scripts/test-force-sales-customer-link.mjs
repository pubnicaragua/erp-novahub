import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const map = await readFile(new URL('../public/maps/diseñoui_mapas_freelancers.html', import.meta.url), 'utf8');
const shell = await readFile(new URL('../src/app/components/FuerzaComercialPage.tsx', import.meta.url), 'utf8');
const customerView = await readFile(new URL('../src/app/components/ventas/ClientesView.tsx', import.meta.url), 'utf8');
const salesService = await readFile(new URL('../src/app/services/ventas.service.ts', import.meta.url), 'utf8');

assert.match(shell, /import \{ customersService \} from '\.\.\/services\/ventas\.service'/, 'El mapa usa el servicio tipado de clientes desde el shell React');
assert.match(shell, /canPerform\('SALES_CLIENTS',\s*'read'\)/, 'La búsqueda del cliente requiere permiso de lectura de Ventas');
assert.match(shell, /canPerform\('FORCE_SALES',\s*'updateProspect'\)/, 'El vínculo requiere permiso para editar prospectos');
assert.match(shell, /customersService\.getLookup/, 'La búsqueda reutiliza el endpoint de lookup de clientes');
assert.match(shell, /force-sales-customer-search-result/, 'El shell responde por postMessage al iframe del mapa');

assert.match(map, /force-sales-customer-search/, 'El mapa solicita resultados de clientes al shell');
assert.match(map, /force-sales-customer-search-result/, 'El mapa consume respuestas del shell');
assert.match(map, /role="combobox"/, 'La búsqueda del cliente expone semántica accesible de combobox');
assert.ok(map.includes('data-customer-link-trigger'), 'El selector muestra un control desplegable antes de buscar');
assert.ok(/data-customer-link-dropdown[^>]*hidden/.test(map), 'El campo de búsqueda abre dentro de un menú cerrado inicialmente');
assert.ok(map.includes('function toggleCustomerLookup('), 'El selector permite abrir y cerrar el menú de búsqueda');
assert.match(map, /data-customer-link/, 'Las opciones permiten seleccionar una ficha de cliente');
assert.match(map, /customerId:\s*customerId|customerId\s*\?\s*customerId\s*:\s*null/, 'El mapa guarda o quita la referencia mediante el PATCH de prospectos');
assert.match(map, /navigator\.onLine/, 'La vinculación queda deshabilitada sin conexión y no entra en la cola offline');
assert.match(map, /Buscando clientes/, 'La búsqueda comunica su estado de carga');
assert.match(map, /No se encontraron clientes activos/, 'La búsqueda comunica un estado vacío');
assert.match(map, /message\.error/, 'La búsqueda comunica errores del servicio');
assert.match(map, /ArrowDown|ArrowUp/, 'El selector permite recorrer opciones con el teclado');

assert.match(customerView, /CUSTOMER_HAS_FORCE_SALES_POINT/, 'La lista reconoce el conflicto de borrado de un cliente vinculado');
assert.match(customerView, /punto.*(?:desvincular|vínculo|vincul)/is, 'El borrado confirmado advierte que se quitará el vínculo del punto');
assert.match(customerView, /confirmUnlinkForceSalesPoint/, 'La confirmación explícita se envía al backend');
assert.match(salesService, /confirmUnlinkForceSalesPoint/, 'El servicio de clientes expone el parámetro explícito de confirmación');

console.log('force-sales customer link: permissions, customer lookup bridge, map link controls, offline behavior, and deletion warning passed');
