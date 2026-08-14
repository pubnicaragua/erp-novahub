# Pruebas E2E con Playwright (grabadas desde el navegador)

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
