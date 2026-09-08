# NovaHub ERP — reglas de pruebas E2E Dual Full-Stack

## Alcance

Estas reglas aplican a las pruebas de `Frontend/novahub-frontend/e2e` que usan el
runner de Playwright. La suite Dual Full-Stack debe separar cuatro evidencias:

1. interacción y renderizado real del navegador;
2. peticiones HTTP y contratos de API;
3. persistencia, invariantes ERP y aislamiento multi-tenant;
4. limpieza, reintentos y resiliencia.

Un `npm run build` no sustituye ninguna de las otras capas.

## Base de datos y seguridad de datos

- Las pruebas que registran o modifican datos requieren `DATABASE_URL_E2E`.
- También requieren `E2E_ALLOW_DATABASE_MUTATIONS=1` y
  `E2E_ISOLATED_DATABASE=1`.
- La URL E2E debe apuntar a una base separada cuyo nombre incluya `e2e`, `test`
  o `qa`, salvo que se declare explícitamente `E2E_DATABASE_NAME`.
- Nunca se usa `Backend/.env` como fuente de datos de prueba.
- La suite rechaza usar la misma URL en `DATABASE_URL` y `DATABASE_URL_E2E`.
- El backend de Playwright recibe `DATABASE_URL_E2E` como su `DATABASE_URL`.
- La base E2E se limpia al iniciar la corrida y después de cada fixture que
  crea datos. La limpieza global solo es válida porque la base debe ser
  exclusiva de E2E y los workers están limitados a uno.
- No se limpian tablas de una base compartida ni se borran datos por nombre,
  prefijo o coincidencia amplia en entornos normales.

## Datos y tenants

- Cada corrida usa un `runId` único y nombres/códigos únicos.
- Los IDs de tenant, sucursal, bodega, producto, variante y documento se
  conservan en el contexto del test.
- Toda aserción debe comprobar `clientTenantId` y, cuando corresponda,
  `branchId`, `warehouseId` y `variantId`.
- Los datos de otro tenant son un control negativo obligatorio para flujos que
  lean, modifiquen o eliminen entidades.

## Red y mutaciones

- Las mutaciones críticas deben enviar `Idempotency-Key` y el test debe
  comprobarlo en la petición real.
- Si un endpoint mutante no implementa todavía `IdempotencyService`, la suite
  debe registrarlo como `PENDIENTE`; enviar una cabecera desde el cliente no
  convierte por sí solo la operación en idempotente.
- Se aceptan códigos exitosos definidos por el endpoint: normalmente 200/201,
  y también 202/204 cuando el contrato los establezca.
- Se valida latencia por petición; un test no debe ocultar una API lenta con
  esperas artificiales.
- Se deben probar, según aplique, éxito, validación 4xx, permiso denegado,
  tenant ajeno, sucursal fuera de alcance, repetición idempotente y fallo
  intermedio sin registros parciales.

## Navegador

- Usar accesibilidad semántica o `data-testid` estable; evitar selectores de
  estructura generados por el navegador.
- No usar `page.waitForTimeout`.
- Esperar mediante respuesta HTTP, URL, selector, estado visible, evento o
  condición observable.
- Validar 375, 768, 1024 y 1440 px cuando el flujo tenga UI relevante.
- Validar claro/oscuro, teclado, foco visible, loading, vacío, error y éxito
  cuando existan esos estados.
- El viewport no puede adquirir scroll horizontal accidental.
- Todo error de consola, `pageerror`, fallo de red `/api/*` o respuesta 500+
  hace fallar la prueba salvo una excepción documentada y acotada.

## ERP y atomicidad

- Inventario: el delta debe coincidir exactamente con la operación, sin stock
  negativo y en la bodega/variante correctas.
- Contabilidad: cada asiento relevante debe estar balanceado (`Debe == Haber`)
  y conservar su referencia al documento origen.
- Estados: se comprueban las transiciones permitidas y se evita borrar
  documentos que deben conservar historial.
- Un happy path no demuestra rollback. Los flujos críticos deben inyectar o
  provocar un fallo intermedio controlado y comprobar ausencia de efectos
  parciales.

## Cierre

Cada entrega debe reportar por separado `confirmado`, `fallido`, `no ejecutado`
o `no aplicable` para estático/build, API, navegador, persistencia y entorno
productivo/integraciones. Nunca se debe afirmar producción o multiusuario con
evidencia local.
