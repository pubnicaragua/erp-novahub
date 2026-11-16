import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { ERP_GUIDES } from '../src/app/guides/catalog.ts';
import { confidentMatch, isHowToQuestion, matchGuides } from '../src/app/guides/match.ts';

// Preguntas como las hacen los clientes (con y sin tildes, con faltas comunes).
const QUESTIONS = [
  ['¿Cómo ingreso un cliente?', 'ventas-crear-cliente'],
  ['como le facturo a un cliente', 'ventas-facturar'],
  ['Cómo manejo un préstamo', 'ventas-prestamo'],
  ['como manejo un credito', 'ventas-credito'],
  ['no entiendo como manejar la lista de precios', 'ventas-listas-precios'],
  ['quiero cambiar el precio mayorista', 'ventas-listas-precios'],
  ['¿Dónde veo los reportes?', 'reportes-ventas'],
  ['como abro la caja', 'ventas-facturar-caja'],
  ['cómo hago el cierre de caja', 'ventas-cerrar-caja'],
  ['como registro un gasto', 'compras-gasto'],
  ['como creo un producto nuevo', 'inventario-producto'],
  ['como paso productos de una bodega a otra', 'inventario-transferencia'],
  ['como hago la planilla', 'rh-nomina'],
  ['como registro las vacaciones de un empleado', 'rh-vacaciones'],
  ['como agrego un empleado', 'rh-empleado'],
  ['como hago una cotizacion', 'ventas-cotizar'],
  ['como le pago a un proveedor', 'compras-pagar-proveedor'],
  ['como registro el pago de un cliente', 'ventas-registrar-pago'],
  ['como cobro una cuota del credito', 'ventas-cobrar-credito'],
  ['donde veo quien me debe', 'finanzas-cuentas-cobrar'],
  ['como creo un usuario', 'config-usuarios'],
  ['como importo mis productos desde excel', 'inventario-importar'],
  ['como hago una devolucion', 'ventas-devolucion'],
  ['como recibo la mercaderia del proveedor', 'compras-recepcion'],
  ['como hago una orden de compra', 'compras-orden-compra'],
  ['como asigno una tarea', 'act-tarea'],
];

for (const [question, expected] of QUESTIONS) {
  test(`«${question}» lleva a ${expected}`, () => {
    const matches = matchGuides(question, ERP_GUIDES);
    assert.ok(matches.length, 'sin coincidencias');
    assert.equal(matches[0].guide.id, expected, `ganó ${matches.map((m) => `${m.guide.id}:${m.score}`).join(', ')}`);
  });
}

test('las preguntas de cifras no se confunden con guías', () => {
  for (const question of ['¿Cómo va mi negocio hoy?', '¿Quién me debe más?', '¿Cuánto vendí este mes?', '¿Qué producto genera más utilidad?']) {
    assert.equal(isHowToQuestion(question), false, question);
  }
  for (const question of ['como facturo', 'donde veo los reportes', 'no se como crear un cliente']) {
    assert.equal(isHowToQuestion(question), true, question);
  }
});

test('las preguntas claras tienen una guía ganadora', () => {
  for (const question of ['como facturo', 'como manejo un prestamo', 'como cambio la lista de precios']) {
    assert.ok(confidentMatch(matchGuides(question, ERP_GUIDES)), question);
  }
});

test('el catálogo no tiene ids repetidos y cada pantalla existe en el menú', () => {
  const ids = new Set();
  const sidebar = fs.readFileSync(new URL('../src/app/components/Sidebar.tsx', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
  for (const guide of ERP_GUIDES) {
    assert.ok(!ids.has(guide.id), `id repetido ${guide.id}`);
    ids.add(guide.id);
    assert.ok(guide.steps.length >= 1 && guide.steps.length <= 7, `${guide.id}: entre 1 y 7 pasos`);
    assert.ok(guide.keywords.length >= 2, `${guide.id}: faltan frases clave`);
    for (const step of guide.steps) {
      if (!step.to) continue;
      const [module, sub] = step.to.split('/');
      assert.ok(app.includes(`case '${module}'`), `${guide.id}: el módulo ${module} no existe en App.tsx`);
      if (sub) assert.ok(sidebar.includes(`id: '${sub}'`), `${guide.id}: la pantalla ${step.to} no está en el menú`);
    }
  }
});
