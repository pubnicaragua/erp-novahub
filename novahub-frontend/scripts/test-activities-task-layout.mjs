import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readTaskLayoutPreference,
  writeTaskLayoutPreference,
} from '../src/app/components/actividades/taskViewPreferences.ts';

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('usa Lista por defecto y rechaza valores almacenados desconocidos', () => {
  const storage = createStorage();
  assert.equal(readTaskLayoutPreference('user-a', storage), 'table');
  storage.setItem('nh:activities:task-layout:user-a', 'calendar');
  assert.equal(readTaskLayoutPreference('user-a', storage), 'table');
});

test('recuerda cada uno de los modos admitidos por separado para cada usuario', () => {
  const storage = createStorage();
  const modes = ['table', 'cards', 'kanban', 'categories'];

  modes.forEach((mode, index) => {
    writeTaskLayoutPreference(`user-${index}`, mode, storage);
  });

  modes.forEach((mode, index) => {
    assert.equal(readTaskLayoutPreference(`user-${index}`, storage), mode);
  });
  assert.equal(readTaskLayoutPreference('user-other', storage), 'table');
});

test('omite el almacenamiento cuando no existe una sesión de usuario', () => {
  const storage = createStorage();
  writeTaskLayoutPreference(null, 'kanban', storage);
  assert.equal(readTaskLayoutPreference(null, storage), 'table');
  assert.equal(storage.getItem('nh:activities:task-layout:anon'), null);
});

test('el almacenamiento bloqueado no impide leer ni cambiar la vista en memoria', () => {
  const blockedStorage = {
    getItem() { throw new Error('storage bloqueado'); },
    setItem() { throw new Error('storage bloqueado'); },
  };

  assert.equal(readTaskLayoutPreference('user-a', blockedStorage), 'table');
  assert.doesNotThrow(() => writeTaskLayoutPreference('user-a', 'cards', blockedStorage));
});
