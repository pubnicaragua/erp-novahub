# Reglas del frontend de NovaHub

Estas reglas complementan el [`AGENTS.md`](../AGENTS.md) del workspace cuando está disponible. El frontend es un repositorio Git independiente y su aplicación vive en `Frontend/novahub-frontend`; ejecuta los comandos desde esa carpeta. Una sesión iniciada directamente desde este repositorio debe poder seguir estas reglas sin asumir que el workspace contenedor fue cargado.

## Alcance y fuentes

- La raíz Git contiene una sola aplicación y un solo paquete Node: `novahub-frontend/`. No es un repositorio Git independiente; ejecutar ahí todos los comandos npm. El `package-lock.json` de la raíz no tiene un `package.json` asociado. Este archivo es autocontenido: no asumir que exista un `AGENTS.md` padre ni reglas de un workspace contenedor.
- Los README de la raíz y de `novahub-frontend/` son boilerplate NestJS/Figma obsoleto. Para comandos y arquitectura, respetar `package.json`, configs, código y pruebas.
- Leer `../docs/ai/README.md` y [`novahub-frontend/DESIGN_GUIDE.md`](novahub-frontend/DESIGN_GUIDE.md) antes de crear o renovar una vista.
- Leer `novahub-frontend/DESIGN_GUIDE.md` antes de crear o renovar una vista. Conserva la intención visual, pero sus ejemplos de Framer Motion, hex y radios no siempre coinciden con el código; en caso de conflicto, mandan `src/styles/theme.css`, `src/styles/index.css`, los componentes compartidos y los módulos operativos vecinos.
- `../docs/ai/` no existe en este checkout: no asumir sus reglas ni inventarlas; marcar cualquier dependencia documental como `NO CONFIRMADO`. Usar `novahub-frontend/TEST_RULES.md`, `novahub-frontend/e2e/README.md` y `novahub-frontend/e2e/COVERAGE_MATRIX.md` como autoridades de pruebas y cobertura.

## Entorno y verificación estática

- Usar Node 24 como versión recomendada e `npm ci` desde `novahub-frontend/`; `npm run dev` inicia Vite. Node 24 no está fijado: no hay `.nvmrc` ni `engines`, y algunos checks cargan TypeScript con type stripping.
- `VITE_API_URL`, cuando está definido, determina la API. Sin ella, `api.ts` usa `http://localhost:3000/api` en desarrollo y `https://backenderpnh.onrender.com/api` en producción; Playwright dual inyecta `http://localhost:3310/api` salvo `E2E_API_URL`.
- Para toda modificación de UI o de código ejecutar `npm run lint` y después `npm run build`. `lint` solo cubre `src` y falla con cualquier warning; `build` es únicamente `vite build`, no typecheck.
- No hay script dedicado de typecheck, framework general de unit tests, formatter, CI ni pre-commit. Para una comprobación TypeScript explícita existe `npx tsc --noEmit`; reportar aparte cualquier error preexistente.
- Checks focalizados: `npm run architecture:check` informa ciclos con severidad `warn` y no bloquea; `npm run validate:theme-contrast` valida el tema; `npm run test:pdf-templates` valida catálogo/plantillas PDF y `npm run test:sales-stock` el contrato de existencias de Ventas. `npm run test:e2e:codegen` abre el grabador de Playwright; no genera código de aplicación.

## Arquitectura y datos

- El bootstrap es `src/main.tsx` → `QueryClientProvider` → `BrowserRouter` → `src/app/App.tsx`. `App.tsx` enruta por `location.pathname` y carga vistas con `lazy`; no hay un árbol `<Routes>` al que añadir rutas.
- `src/app/App.tsx`, `AuthContext.tsx`, `Sidebar.tsx` y `Topbar.tsx` son los puntos de control de navegación, sesión, tema y composición global. El shell autenticado regular es `Sidebar` + `Topbar` montado por `DashboardLayout`; no existe un shell propio de Ventas. Manager, portal de clientes, autenticación y superficies públicas tienen composición separada, pero el orden de providers y las barreras de sesión/tenant son globales.
- Las APIs autenticadas del ERP deben pasar por los servicios existentes y `src/app/services/api.ts`; no añadir `fetch` directo a vistas para ellas. Los `fetch` directos actuales corresponden a excepciones como SSE, descargas binarias/blob, uploads firmados, recursos locales o endpoints públicos.
- Ese cliente administra `nh-auth-token`, 401/`session-closed` y deduplicación de GET simultáneos, no de tipo caché TTL. Normaliza fallbacks conocidos de error; `idempotentPost`/`idempotentPatch` envían `Idempotency-Key`, pero la idempotencia efectiva sigue dependiendo del backend.
- Usar el `queryClient` único de `src/app/services/query-client.ts` y query keys estables con alcance de tenant. Preferir `useTenantQuery` o `useAccountingQuery`; con `useQuery` directo, incluir `clientTenantId` en la key. No extender el legacy `useApiData`; los cambios de identidad deben seguir la limpieza centralizada de `AuthContext`. Para búsquedas, paginación y estados de carga, seguir el patrón vigente de TanStack Query en los módulos operativos: invalidación de dominio al mutar y debounce cuando corresponda.
- Respetar `enabledModules`, `hasAccess`, `canPerform` y `useBranchScope`. La UI puede ocultar acciones, pero tenant, sucursal, bodega y permisos deben validarse también en backend.
- Si cambia un contrato backend, actualizar tipos y servicios, revisar todos sus consumidores y ejecutar `npm run test:e2e:catalog`. Es una cadena fail-fast de verificaciones estáticas frontend/backend; un controller nuevo necesita la clasificación que exige `verify-backend-surfaces`. No sustituye evidencia de API, navegador o persistencia.

## UI

- Ventas es la referencia operativa para la jerarquía KPI/filtros/contenido, los estados loading/vacío/error/éxito y las tablas con scroll localizado; no es un shell separado. Para la base visual, `DESIGN_GUIDE.md` señala `SuscripcionesPage.tsx`, siempre contrastada con los tokens y componentes compartidos actuales.
- Usar tokens de `src/styles/theme.css` y componentes compartidos. `src/styles/index.css` tiene reglas de radio en conflicto: al inicio ponen `border-radius: 0` en botones/tabs operativos, pero reglas posteriores terminan aplicando `6px` a controles y `tabs-trigger` de módulos; las opciones de Select/Dropdown mantienen radio `0`. Comprobar la cascada completa antes de fijar radios.
- La librería de animación instalada es `motion` y se importa desde `motion/react`, no `framer-motion`.
- Mantener textos de interfaz en español, `min-w-0`, `max-w-full`, `overflow-x-hidden`, tabs desplazables y acciones apilables; no introducir scroll horizontal del viewport. Verificar móvil, tablet, escritorio compacto y escritorio amplio (375, 768, 1024 y 1440 px), claro/oscuro, teclado, foco visible, `aria-label` útil en acciones de solo icono y estados loading/vacío/error/éxito. Acotar los cambios al módulo solicitado.

## Playwright y E2E

- `npm run test:e2e` sin variables solo recolecta `setup`, `onboarding` y `vistas`; `e2e/specs/**` queda excluido. Ese modo reutiliza `npm run dev` y no aísla la base: no confundirlo con la suite dual. Un focused default es `npx playwright test e2e/vistas/<archivo>.spec.ts --project=vistas`.
- La suite dual exige `E2E_DUAL_FULLSTACK=1`, `DATABASE_URL_E2E`, `E2E_ALLOW_DATABASE_MUTATIONS=1` y `E2E_ISOLATED_DATABASE=1`, más un backend accesible. Playwright no carga `.env`; exportar las variables de `novahub-frontend/e2e/.env.e2e.example`.
- La base E2E debe ser distinta de `DATABASE_URL` y cuyo nombre incluya `e2e`, `test` o `qa`. Solo puede omitirse ese patrón si `E2E_DATABASE_NAME` es exactamente el nombre real de la base. Nunca ejecutar fixtures mutantes contra datos normales; leer `novahub-frontend/TEST_RULES.md` antes de hacerlo.
- El backend no vive en este repositorio. `E2E_BACKEND_DIR` debe apuntar al sibling real (aquí `../../BackendERPNH`); el default `../../Backend` no existe. Varios verificadores de `test:e2e:catalog` y `test:e2e:prisma-contract` tienen `../../Backend` hardcodeado e ignoran esa variable.
- Dual inicia un backend nuevo y, salvo `E2E_MANUAL_SERVER=1`, un Vite nuevo en 5173 con `reuseExistingServer: false`; ese puerto debe estar libre o se define `E2E_FRONTEND_PORT` y, si cambia la URL, `E2E_BASE_URL`. Usa un worker y prueba varios viewports según el proyecto.
- `E2E_SCHEMA_MODE=datamodel` genera el schema desde Prisma cuando la base aún no lo tiene, en vez del historial de migraciones; no reconstruye una base ya provisionada. Para un spec dual: `npx playwright test e2e/specs/<archivo>.spec.ts --project=dual-desktop`.
- `npm run test:e2e:manual` y `npm run test:e2e:smoke` sirven `dist`: requieren `npm run build` previo y el puerto 5173 libre. Un build no sustituye evidencia de navegador, API ni persistencia; reportarlos por separado.

## Verificación

- Ejecutar `npm run build` desde `Frontend/novahub-frontend` para toda modificación de UI.
- Para flujos relevantes, usar Playwright y distinguir evidencia de build, navegador, red/API y persistencia.
- Si cambia un contrato del backend, actualizar tipos/servicios y revisar todos los consumidores.

Referencias: [`docs/ai/permissions.md`](../docs/ai/permissions.md), [`docs/ai/evidence-levels.md`](../docs/ai/evidence-levels.md), [`docs/ai/feature-plan.md`](../docs/ai/feature-plan.md).
