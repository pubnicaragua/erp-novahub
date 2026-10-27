import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getNotificationNavigation } from '../src/app/utils/notificationNavigation.ts';

const notification = {
  title: 'Nuevo punto marcado en el mapa',
  message: 'Ana marcó el punto “Tienda Central”. Pulsa para abrirlo en Fuerza Comercial.',
  link: 'fuerza-comercial',
  metadata: {
    navigation: {
      module: 'fuerza-comercial',
      targetId: 'prospect-123',
    },
  },
};

const destination = getNotificationNavigation(notification);
assert.equal(destination.module, 'fuerza-comercial');
assert.equal(destination.targetId, 'prospect-123', 'El destino conserva el ID exacto del punto');

const inboxSource = await readFile(new URL('../src/app/components/notificaciones/InboxView.tsx', import.meta.url), 'utf8');
assert.match(inboxSource, /getNotificationNavigation\(item\)/, 'El inbox debe abrir también destinos anidados de notificación');
assert.match(inboxSource, /detail: destination/, 'El inbox debe entregar el destino completo al shell de navegación');

const pageSource = await readFile(new URL('../src/app/components/FuerzaComercialPage.tsx', import.meta.url), 'utf8');
const streamEffect = pageSource.match(/subscribeToNotificationEvents\([\s\S]*?\n\s*\);/)?.[0] || '';
assert.ok(streamEffect, 'Fuerza Comercial debe escuchar el stream SSE compartido');
assert.doesNotMatch(streamEffect, /if\s*\(!frame\)\s*return/, 'El stream debe suscribirse aunque el iframe aún no haya terminado de cargar');
assert.match(pageSource, /iframeRef\.current\?\.contentWindow/, 'Las invalidaciones se reenvían cuando el iframe está listo');

console.log('force-sales notification navigation: exact point target and early SSE subscription passed');
