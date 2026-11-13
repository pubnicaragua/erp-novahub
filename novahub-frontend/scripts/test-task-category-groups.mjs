import assert from 'node:assert/strict';
import test from 'node:test';
import { groupTasksByCategory } from '../src/app/components/actividades/taskCategoryGroups.ts';

const cat = (key, name, extra = {}) => ({ id: key, key, name, description: null, icon: null, color: null, position: 0, isArchived: false, isDefault: false, ...extra });
const categories = [
  cat('RECURSOS_HUMANOS', 'Recursos Humanos'),
  cat('VENTAS', 'Ventas'),
  cat('FINANZAS', 'Finanzas'),
  cat('VIEJA', 'Vieja', { isArchived: true }),
];
const t = (id, categoryId, status = 'PENDING') => ({ id, categoryId, status });

test('agrupa en el orden de las categorías y no mezcla tareas', () => {
  const groups = groupTasksByCategory(
    [t(1, 'VENTAS'), t(2, 'RECURSOS_HUMANOS'), t(3, 'VENTAS'), t(4, 'FINANZAS'), t(5, 'RECURSOS_HUMANOS')],
    categories,
  );
  assert.deepEqual(groups.map((g) => g.name), ['Recursos Humanos', 'Ventas', 'Finanzas']);
  assert.deepEqual(groups.map((g) => g.tasks.map((x) => x.id)), [[2, 5], [1, 3], [4]]);
});

test('omite las categorías sin tareas, así que los filtros reducen sin mezclar', () => {
  const groups = groupTasksByCategory([t(1, 'FINANZAS')], categories);
  assert.deepEqual(groups.map((g) => g.key), ['FINANZAS']);
});

test('«Sin categoría» va al final y las archivadas con tareas se conservan', () => {
  const groups = groupTasksByCategory([t(1, null), t(2, 'VIEJA'), t(3, 'VENTAS')], categories);
  assert.deepEqual(groups.map((g) => g.name), ['Ventas', 'Vieja (archivada)', 'Sin categoría']);
});

test('una clave que ya no existe no desaparece', () => {
  const groups = groupTasksByCategory([t(1, 'cat_redes'), t(2, 'VENTAS')], categories);
  assert.deepEqual(groups.map((g) => g.key), ['VENTAS', 'CAT_REDES']);
  assert.equal(groups[1].name, 'Cat redes');
  assert.equal(groups[1].category, null);
});

test('cuenta las abiertas y no pierde ninguna tarea', () => {
  const tasks = [t(1, 'VENTAS', 'COMPLETED'), t(2, 'VENTAS', 'WAITING_APPROVAL'), t(3, 'VENTAS', 'CANCELLED'), t(4, null, 'IN_PROGRESS')];
  const groups = groupTasksByCategory(tasks, categories);
  assert.equal(groups.find((g) => g.key === 'VENTAS').open, 1);
  assert.equal(groups.reduce((sum, g) => sum + g.tasks.length, 0), tasks.length);
  assert.deepEqual(groupTasksByCategory([], categories), []);
});

test('la clave se compara sin importar mayúsculas', () => {
  const groups = groupTasksByCategory([t(1, 'ventas'), t(2, 'Ventas')], categories);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].tasks.length, 2);
});
