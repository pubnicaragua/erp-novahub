import assert from 'node:assert/strict';
import { getSupportAgentPasswordError } from '../../src/app/components/admin/support-agent-password.ts';

assert.match(getSupportAgentPasswordError('', false) || '', /obligatoria/i, 'la contraseña inicial es obligatoria');
assert.ok(getSupportAgentPasswordError('weak', false), 'una contraseña inicial débil es inválida');
assert.equal(getSupportAgentPasswordError('Support1!', false), null, 'acepta la regla general completa');
assert.equal(getSupportAgentPasswordError('', true), null, 'al editar, omitir contraseña conserva la actual');
assert.ok(getSupportAgentPasswordError('weak', true), 'un restablecimiento débil es inválido');

console.log('OK: política de contraseña para creación y restablecimiento de agentes.');
