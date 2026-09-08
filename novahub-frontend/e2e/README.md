# Pruebas E2E con Playwright (grabadas desde el navegador)

## Suite Dual Full-Stack

La suite de `e2e/specs/` ejecuta el frontend contra una instancia NestJS que
recibe exclusivamente `DATABASE_URL_E2E`. No se inicia ni reutiliza el backend
normal. Antes de ejecutarla, crea una base PostgreSQL separada, aplica las
migraciones desde `Backend/` y define las salvaguardas:

```powershell
$env:DATABASE_URL_E2E = 'postgresql://usuario:clave@host:5432/novahub_e2e'
$env:E2E_ALLOW_DATABASE_MUTATIONS = '1'
$env:E2E_ISOLATED_DATABASE = '1'
$env:E2E_DUAL_FULLSTACK = '1'
$env:E2E_BACKEND_PORT = '3310'
$env:E2E_SCHEMA_MODE = 'datamodel'
npx playwright test e2e/specs/module-smoke.spec.ts
```

También puedes copiar `e2e/.env.e2e.example` como referencia; Playwright no
carga archivos `.env` automáticamente, por lo que las variables deben estar
exportadas en la sesión de PowerShell o en el pipeline.
`E2E_SCHEMA_MODE=datamodel` prepara una base E2E vacía a partir del schema
Prisma sin ejecutar el historial de migraciones cuando existe drift conocido;
la suite nunca aplica ese modo contra la URL normal.
La ejecución dual no reutiliza un Vite ya levantado: si `5173` está ocupado,
detén ese proceso o define `E2E_FRONTEND_PORT` y `E2E_BASE_URL` con otro puerto.

El flujo transaccional de referencia se ejecuta así:

```powershell
npx playwright test e2e/specs/ventas-inventario-contabilidad.spec.ts
```

Ese caso crea una orden desde la UI, la convierte en factura, registra un
cobro, valida Kardex/inventario y asiento contable en Prisma, repite la
operación con la misma clave de idempotencia, comprueba aislamiento con un
segundo tenant y provoca stock insuficiente para verificar rollback.

La corrida usa un tenant y un `runId` únicos, limita los workers a uno y limpia
la base E2E al inicio y al terminar cada fixture mutante. Si falta cualquiera
de las variables, el test se detiene antes de registrar datos.

Los comandos de revisión de la infraestructura son:

```powershell
npx tsc --noEmit -p e2e/tsconfig.json
npx playwright test --list
npm run build
```

La matriz de módulos está en `e2e/module-catalog.ts`. El smoke general confirma
renderizado, acceso/denegación, errores de API y overflow; no sustituye todavía
los flujos de negocio con aserciones de inventario y contabilidad, que se
incorporan por dominio.

La separación exacta entre cobertura profunda y cobertura de superficie está en
`e2e/COVERAGE_MATRIX.md`; sirve para que un probe no se reporte como una prueba
de persistencia completa.

`e2e/specs/module-boundaries.spec.ts` recorre la misma matriz usando un tenant
con módulos limitados. Comprueba que cada superficie pueda renderizarse o
muestre protección de acceso, que los probes autenticados no apunten a rutas
404 y que los probes sin JWT conserven el límite 401/403. Es la cobertura
transversal de módulo deshabilitado; no inventa una operación de negocio para
controllers backend-only.

Los flujos duales profundos actualmente trazan estas cadenas: Ventas →
Inventario → Contabilidad, Compras → Recepción → Inventario → Contabilidad,
Inventario/Catálogo, Tracking, Actividades, Restaurante → Cocina, Proyectos →
Costos, Asesoría Legal, Tickets, NovaChat, Financiamiento PYME, Finanzas,
Recursos Humanos, Documentos, Notificaciones, Soporte Técnico, Clientes,
Proveedores, Transferencias, Contabilidad y Configuración
(bodega origen → bodega destino → Kardex → Contabilidad). Los demás
módulos quedan cubiertos por la matriz UI/API y sus contratos explícitos; una
mutación específica solo se marca como confirmada cuando existe payload,
transición y aserción Prisma verificables.

El smoke y los probes de superficie usan `full-auth.fixture.ts`, que registra
un tenant temporal con los módulos funcionales disponibles. Los flujos de
negocio usan `auth.fixture.ts`/`seed-data.fixture.ts` con un tenant mínimo y
datos controlados; esa separación permite cubrir tanto módulos habilitados como
escenarios de módulo deshabilitado sin mezclar semillas.

Los probes autenticados y sus controles negativos sin JWT están en
`e2e/specs/api-contract-probes.spec.ts`. Cubren cada contrato API declarable;
la clasificación de los 49 controllers y sus 1.018 rutas está en
`e2e/scripts/verify-backend-surfaces.mjs`. Esto incluye superficies backend-only
sin inventar una pantalla UI para ellas.

Nota de contrato: Compras ya protege la creación y aprobación de órdenes con
`IdempotencyService`. Las mutaciones de recepción también envían
`Idempotency-Key` desde el cliente para dejar el contrato observable. La
actualización de recepción ya se ejecuta dentro del servicio de idempotencia,
preservando el bloque transaccional de inventario, costos y contabilidad; la
matriz mantiene `PENDIENTE` únicamente para crear y aprobar recepciones.

El inventario de controllers se verifica por separado con
`npm run test:e2e:backend-surfaces`. Este chequeo enumera cada controller y
ruta real de `Backend/src`, y obliga a clasificarlo como superficie UI,
backend-only, infraestructura o pública; un controller nuevo sin clasificación
hace fallar la verificación.

## Grabar una prueba nueva (RECOMENDADO)

Abrí el navegador de grabación y navegá como usuario real; Playwright genera el test:

```
npx playwright codegen http://localhost:5173/register
```

Para vistas que requieren sesión, primero entrá al login dentro del navegador de codegen
(o usá la sesión guardada). Al terminar, copiá el código generado en `e2e/onboarding.spec.ts`
(o un archivo nuevo en `e2e/vistas/`).

## Captura de errores (automática)

Todos los tests usan el fixture `captureErrors` (ver `e2e/helpers/errorCapture.ts`):
registra y **hace fallar la prueba** si aparece cualquiera de estos:

- `console.error` de la aplicación
- errores de JavaScript no capturados (`pageerror`)
- peticiones a `/api/*` que fallan en la red (`requestfailed`)
- respuestas de la API con HTTP 500+

Para ver el detalle exacto del error: `npx playwright show-report` (abre el reporte HTML)
o `npx playwright show-trace` sobre un trace generado.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run test:e2e` | Ejecuta todas las pruebas headless |
| `npm run test:e2e:ui` | Abre la UI de Playwright (elegís qué correr) |
| `npm run test:e2e:codegen` | Navegador de grabación apuntando a `/register` |
| `npm run test:e2e:report` | Abre el reporte HTML de la última corrida |

## Sesión

El proyecto `setup` hace login una vez (devjair@agency.com / 123456, o variables
`E2E_EMAIL` / `E2E_PASSWORD`) y guarda la sesión en `e2e/.auth/user.json`, que usan
las pruebas de `vistas`. Los tests de `onboarding` no usan sesión.

## Consejos al grabar

- Antes de grabar: `Ctrl+F5` en la pestaña normal para refrescar el código nuevo.
- Para el onboarding: grabá el paso 1 completo (empresa, contacto, cargo, WhatsApp,
  email, contraseña, términos) y el envío del mensaje de WhatsApp; marcá después
  "Sí, ya envié el mensaje" para no depender del navegador externo.
- Usá selectores por texto/label (`getByLabel`, `getByRole`, `getByText`) y evita
  los selectores con `#root > div > div` que genera codegen por defecto.
