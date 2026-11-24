// Guarda contra un error que ya ocurrió: un archivo enviado con `api.post(ruta, formData)` se convierte a JSON y el servidor
// nunca lo recibe («Adjunta un archivo»). Todo FormData debe viajar como `rawBody` con `apiRequest`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('el módulo de WhatsApp envía los archivos como multipart (rawBody)', () => {
  const source = readFileSync(new URL('../src/app/services/whatsapp.service.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('new FormData()'), 'se esperaba que el servicio arme un FormData');
  assert.ok(source.includes('rawBody: form'), 'sendMedia debe enviar el FormData como rawBody');
  const lines = source.split(/\r?\n/);
  const mediaCall = lines.find((line) => line.includes('/media`'));
  assert.ok(mediaCall && mediaCall.includes('apiRequest'), 'la llamada de archivos debe usar apiRequest, no api.post');
  assert.ok(!lines.some((line) => /api\.(post|put|patch)\b.*\bform\b/.test(line)), 'no se debe pasar un FormData a api.post/put/patch');
});
