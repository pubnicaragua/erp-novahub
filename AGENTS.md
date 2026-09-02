# Reglas del frontend de NovaHub

Estas reglas complementan el [`AGENTS.md`](../AGENTS.md) del workspace. El frontend es un repositorio Git independiente y su aplicación vive en `Frontend/novahub-frontend`; ejecuta los comandos desde esa carpeta.

## Integración

- Leer `../docs/ai/README.md` y [`novahub-frontend/DESIGN_GUIDE.md`](novahub-frontend/DESIGN_GUIDE.md) antes de crear o renovar una vista.
- `src/app/App.tsx`, `AuthContext`, `Sidebar`, `Topbar` y el shell de Ventas determinan navegación, autenticación, tema y composición global.
- Las vistas deben usar servicios existentes y `src/app/services/api.ts`; no agregar `fetch` ad hoc en componentes.
- Para cache, búsquedas, paginación y estados de carga, seguir el patrón vigente de TanStack Query en Ventas: query keys estables, invalidación de dominio y debounce cuando corresponda.
- Respetar `hasAccess`, `canPerform`, `enabledModules`, `useBranchScope` y las reglas de tenant/sucursal. Ocultar una acción mejora UX, pero el backend debe autorizarla también.

## UI y responsive

- Ventas es la referencia visual y responsive: tokens de tema, componentes UI compartidos, jerarquía KPI/filtros/contenido, estados loading/vacío/error/éxito y tablas con scroll localizado.
- Mantener `min-w-0`, `max-w-full`, `overflow-x-hidden`, espaciado responsive, tabs desplazables y acciones apilables. No introducir scroll horizontal del viewport.
- Verificar móvil, tablet, escritorio compacto y escritorio amplio; revisar claro/oscuro, teclado, focus visible y acciones con `aria-label` útil.
- Mantener los textos de interfaz en español y los cambios acotados al módulo solicitado.

## Verificación

- Ejecutar `npm run build` desde `Frontend/novahub-frontend` para toda modificación de UI.
- Para flujos relevantes, usar Playwright y distinguir evidencia de build, navegador, red/API y persistencia.
- Si cambia un contrato del backend, actualizar tipos/servicios y revisar todos los consumidores.

Referencias: [`docs/ai/permissions.md`](../docs/ai/permissions.md), [`docs/ai/evidence-levels.md`](../docs/ai/evidence-levels.md), [`docs/ai/feature-plan.md`](../docs/ai/feature-plan.md).
