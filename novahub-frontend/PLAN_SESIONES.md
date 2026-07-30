# Plan de Trabajo — Correcciones ERP (Actualizado Jul 2026)

## ✅ Completado

### Sesión 1 (Base)
- SalesReportTab rediseño
- Importar Facturas Proveedor (→ detalle + xlsx en Sesión 2)
- Importar Asistencia (Excel)
- ModuleErrorBoundary + wrapping 5 módulos
- Branch scope infrastructure (hook + filter)

### Sesión 2 (Correcciones rápidas)
| # | Tarea | Estado |
|---|-------|--------|
| 1 | OrdenesCompraView: "Personalizado" → "Rango por fechas" | ✅ |
| 2 | ProveedoresView: Eliminar→Desactivar + quitar recalcular | ✅ |
| 3 | GastosView: Eliminar presets 4d/9d | ✅ |
| 4 | ProductosView: Eliminar carrito por fila | ✅ |
| 5 | OrdenesCompraView: KPI cards clickables (filtro por estado) | ✅ |
| 6 | ProductosView: etiqueta "PRODUCT" traducida | ✅ |
| 7 | SalesReportTab: tarjeta "Saldo Pendiente Clientes" | ✅ |
| 8 | FacturasProveedorView: import movido a detalle + xlsx | ✅ |
| 9 | EmpleadosView: Eliminar→Desactivar | ✅ |
| 10 | FinanceBalanceView: fixed Tailwind JIT bug (border dinámico) | ✅ |
| 11 | MovimientosView: overflow-x-auto + null safety warehouses | ✅ |

### No realizados (inexistentes o sin issue claro)
- ComisionesView: archivo no existe
- IncomeBreakdownTab: archivo no existe
- ProveedoresView categorías: no hay categorías cargándose
- AsistenciaView responsive: layout correcto

---

## 🔷 Sesión 4 — Branch Scope + Reportes (1-2h)

| # | Módulo | Tarea | Dificultad | Dependencias |
|---|--------|-------|-----------|--------------|
| 1 | Global | Integrar BranchScopeFilter en Ventas, Compras, Finanzas | Alta | Sesión 1 (branch scope) |
| 2 | Reportes | AccountsReceivableTab: revisar datos y layout | Media | — |

---

## 🔷 Sesión 5 — Backend + DB + Config (1-2h)

| # | Módulo | Tarea | Dificultad | Dependencias |
|---|--------|-------|-----------|--------------|
| 1 | Compras | CategoriasView: verificar tabla `inventario_categorias` en DB | Media | Backend |
| 2 | Inventario | ProductosView: recomendación compra solo muestra 2 de 9 | Media | Backend |
| 3 | Compras | Configuración de Compras — revisar | Media | — |

---

## ⚪ Sesión 6 — Refinamiento UX/UI (Opcional)

| # | Módulo | Tarea | Dificultad |
|---|--------|-------|-----------|
| 1 | Compras | GastosView: normalizar native `<select>` → shadcn `<Select>` | Baja |
| 2 | Global | Tooltips en botones de acción | Baja |
| 3 | Global | Estados vacíos consistentes | Baja |
| 4 | Global | Mensajes de error amigables | Baja |

---

## Resumen

| Prioridad | Sesión | Tareas | Estado |
|-----------|--------|--------|--------|
| 🔴 Alta | 1-2 | Correcciones base + rápidas | ✅ Listo |
| 🟡 Media | 4 | Branch scope + Reportes | ⏳ Pendiente |
| 🔵 Media | 5 | Backend/DB/Config | ⏳ Pendiente |
| ⚪ Baja | 6 | Refinamiento UX | ⏳ Opcional |
