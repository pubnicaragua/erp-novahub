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
assert.match(shell, /import \{ Combobox \} from '\.\/ui\/Combobox'/, 'La selección reutiliza el Combobox compartido');
assert.match(shell, /force-sales-open-customer-link/, 'El shell abre el selector solicitado por el mapa');
assert.match(shell, /force-sales-customer-link-selected/, 'El shell devuelve el cliente seleccionado al mapa');
assert.match(shell, /onSearchChange=\{searchCustomerLinkCustomers\}/, 'La búsqueda del Combobox consulta clientes en el servidor');

assert.match(map, /force-sales-open-customer-link/, 'El mapa solicita al shell abrir el selector');
assert.match(map, /force-sales-customer-link-selected/, 'El mapa consume el cliente seleccionado por el shell');
assert.ok(map.includes('data-customer-link-trigger'), 'El mapa presenta el acceso al selector compartido');
assert.doesNotMatch(map, /data-customer-link-dropdown|data-customer-link-search|data-customer-link-select/, 'El mapa ya no contiene un buscador propio');
assert.match(map, /customerId:\s*customerId|customerId\s*\?\s*customerId\s*:\s*null/, 'El mapa guarda o quita la referencia mediante el PATCH de prospectos');
assert.match(map, /navigator\.onLine/, 'La vinculación queda deshabilitada sin conexión y no entra en la cola offline');

assert.match(customerView, /CUSTOMER_HAS_FORCE_SALES_POINT/, 'La lista reconoce el conflicto de borrado de un cliente vinculado');
assert.match(customerView, /punto.*(?:desvincular|vínculo|vincul)/is, 'El borrado confirmado advierte que se quitará el vínculo del punto');
assert.match(customerView, /confirmUnlinkForceSalesPoint/, 'La confirmación explícita se envía al backend');
assert.match(salesService, /confirmUnlinkForceSalesPoint/, 'El servicio de clientes expone el parámetro explícito de confirmación');

console.log('force-sales customer link: permissions, customer lookup bridge, map link controls, offline behavior, and deletion warning passed');
