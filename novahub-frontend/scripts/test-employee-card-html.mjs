import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCardsHtml } from '../src/app/components/hr/employee/employee-card-html.ts';

const design = { layout: 'CLASSIC', primaryColor: '#112233', accentColor: '#445566', textColor: '#000000', showQr: true, showPhoto: true, showDepartment: true, footerText: null, backText: null };
const company = { name: 'Mi <Empresa> S.A.', logo: 'https://cdn.example.com/logo.png' };
const employee = { id: 'e1', number: 'E-001', firstName: 'Ana', lastName: 'Gómez', position: 'Gerente', department: 'Ventas', photo: null, hireDate: '2024-01-02', active: true, nationalIdLast4: '001A', qr: 'NOVAHUB|abc|E-001' };

test('el carnet lleva logo, colores de la empresa y frente y reverso por empleado', () => {
  const html = buildCardsHtml({ design, company, employees: [employee, { ...employee, id: 'e2', number: 'E-002' }] }, { qrByEmployee: { e1: 'data:image/png;base64,AAAA', e2: 'data:image/png;base64,BBBB' } });
  assert.match(html, /--p:#112233/);
  assert.match(html, /logo\.png/);
  assert.equal((html.match(/class="card classic front"/g) || []).length, 2);
  assert.equal((html.match(/class="card classic back"/g) || []).length, 2);
  assert.match(html, /@page\{size:85\.6mm 54mm/);
});

test('el texto de la empresa se escapa y las direcciones peligrosas no entran como imagen', () => {
  const html = buildCardsHtml({ design, company: { name: 'A <script>x</script>', logo: 'javascript:alert(1)' }, employees: [{ ...employee, photo: 'javascript:alert(1)' }] }, { qrByEmployee: {} });
  assert.ok(!html.includes('<script>x'));
  assert.ok(!html.includes('javascript:'));
  assert.match(html, /class="photo initials"/); // sin foto válida se usan las iniciales
});

test('la distribución vertical usa el tamaño de tarjeta girado y se puede ocultar QR, foto y departamento', () => {
  const html = buildCardsHtml({ design: { ...design, layout: 'VERTICAL', showQr: false, showPhoto: false, showDepartment: false }, company, employees: [employee] }, { qrByEmployee: { e1: 'data:image/png;base64,AAAA' } });
  assert.match(html, /@page\{size:54mm 85\.6mm/);
  assert.ok(!html.includes('class="qr'));
  assert.ok(!html.includes('class="photo'));
  assert.ok(!html.includes('class="dept"'));
});
