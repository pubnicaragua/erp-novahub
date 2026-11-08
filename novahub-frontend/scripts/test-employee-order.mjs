import assert from 'node:assert/strict';
import test from 'node:test';
import { compareEmployees, sortEmployees } from '../src/app/components/hr/employeeOrder.ts';

const e = (employeeNumber, employmentStatus, firstName = 'A') => ({ employeeNumber, employmentStatus, firstName, lastName: 'X' });

test('primero los activos por código y al final los inactivos y terminados', () => {
  const sorted = sortEmployees([e('EMP0010', 'TERMINATED'), e('EMP0002', 'ACTIVE'), e('EMP0001', 'INACTIVE'), e('EMP0001', 'ACTIVE'), e('EMP0003', 'ON_LEAVE')]);
  assert.deepEqual(sorted.map((row) => `${row.employeeNumber}:${row.employmentStatus}`), ['EMP0001:ACTIVE', 'EMP0002:ACTIVE', 'EMP0003:ON_LEAVE', 'EMP0001:INACTIVE', 'EMP0010:TERMINATED']);
});

test('los códigos se comparan como números (9 antes que 10) y no se altera la lista original', () => {
  const original = [e('E-10', 'ACTIVE'), e('E-9', 'ACTIVE')];
  assert.deepEqual(sortEmployees(original).map((row) => row.employeeNumber), ['E-9', 'E-10']);
  assert.equal(original[0].employeeNumber, 'E-10');
  assert.equal(compareEmployees(e('1', 'ACTIVE'), e('1', 'ACTIVE')), 0);
  assert.deepEqual(sortEmployees(null), []);
});
