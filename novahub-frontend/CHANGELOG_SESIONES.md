# Registro de Cambios — Sesiones Recientes (Jul 2026)

## 📊 Reporte de Ventas — Rediseño

**Archivos modificados (Frontend):**
- `src/app/components/reportes/SalesReportTab.tsx`

**Qué se hizo:**
- **Proyección de Ventas**: Nuevo gráfico de líneas (2/3 ancho) que muestra facturación real + estimación a 3 meses usando tasa de crecimiento promedio
- **Composición de Ventas**: Donut corregido — ahora muestra categorías reales de facturas (no datos dummy)
- **Facturación vs Cobranza**: Movido debajo de la proyección, junto a Evolución Acumulada
- **Salud de Cartera**: Expandido a 4 columnas (Nuevos Clientes, Ventas/Cliente, Ticket Promedio, Facturas)
- **Top 5 Clientes**: Clickable → abre modal con detalle (total facturado, # facturas, ranking)
- **Top 5 Productos**: Cambiado a "Más Vendidos" (por cantidad, no margen). Clickable → modal con unidades + ingresos
- Nuevos cálculos: `topProductsByQty`, `catComposition`, `projectionData`

---

## 📥 Importar Facturas de Proveedor (CSV) *Lo dejaste en la vista general, y debe ser en el detalle de la factura, en xlsx o PDF no CSV*

**Archivos modificados (Frontend):**
- `src/app/components/compras/FacturasProveedorView.tsx`

**Dónde está en la UI:**
- Vista "Facturas de Proveedor" en módulo **Compras**
- Botón **"Importar CSV"** junto al botón "Nueva Factura" (arriba a la derecha de la tabla)

**Qué hace:**
- Sube archivo CSV con columnas: `number, supplier, date, dueDate, currency, status, description, quantity, unitPrice, total`
- Soporta alias en español: `proveedor, fecha, descripcion, cantidad, precio unitario, estado, moneda, etc.`
- Auto-detecta delimitador (`,` `;` `\t`)
- Busca proveedor por nombre exacto (case-insensitive) contra la lista existente
- Valida: descripción obligatoria, total o precio unitario debe ser > 0
- Crea una factura por fila vía `billsService.create()` con 1 item
- Muestra resultado: total filas / creadas / omitidas + errores
- Plantilla descargable
- **Solo Frontend** — usa el endpoint `billsService.create()` existente

---

## 📥 Importar Asistencia (Excel .xlsx)

**Archivos modificados (Frontend):**
- `src/app/components/hr/AsistenciaView.tsx`

**Dónde está en la UI:**
- Vista "Asistencia" en módulo **RRHH**
- Botón **"Importar"** junto a los botones Entrada/Salida/Tutorial

**Qué hace:**
- Sube archivo Excel (.xlsx) con columnas: `employeeNumber, date, checkIn, checkOut, status, hoursWorked, overtimeHours, location`
- Soporta alias en español: `codigo, fecha, entrada, salida, estado, horas, horasextra, ubicacion`
- Busca empleado por `employeeNumber` (código) o nombre completo
- Usa `hrService.createAttendance()` por fila
- Valida: empleado debe existir en el sistema
- Muestra resultado: total filas / creados / omitidos + errores
- Plantilla descargable
- **Solo Frontend** — usa el endpoint `hrService.createAttendance()` existente

---

## 🛡️ Error Boundaries para Módulos Críticos

**Archivos creados (Frontend):**
- `src/app/components/ui/ModuleErrorBoundary.tsx`

**Archivos modificados (Frontend):**
- `src/app/App.tsx`

**Módulos envueltos con error boundary individual:**
| Módulo | Líneas aprox | Riesgo |
|--------|-------------|--------|
| Inventario | ~430 | Alto (ProductosView 2053 líneas) |
| Ventas | ~414 | Alto (FacturacionCajaView 1284 líneas) |
| Compras | - | Alto (múltiples sub-vistas) |
| Finanzas | - | Alto (FinanceDashboardView + BalanceView con Recharts) |
| Configuración / Roles | ~2022 | Crítico (monolítico) |

**Qué hace:**
- Si un módulo crashea en render, NO se cae la app entera — solo ese módulo muestra pantalla de error
- UI: ícono ⚠️, nombre del módulo, mensaje, stack trace, botones "Reintentar" y "Recargar página"
- No reemplaza el Sentry.ErrorBoundary global — es una capa adicional por módulo

---

## 🏢 Permisos por Sucursal — Infraestructura

**Archivos modificados (Frontend):**
- `src/app/contexts/AuthContext.tsx` — campo `branchIds` añadido al `User` interface + mapeo desde API

**Archivos creados (Frontend):**
- `src/app/hooks/useBranchScope.ts`
- `src/app/components/ui/BranchScopeFilter.tsx`

**Archivos modificados (Frontend) — integración ejemplo:**
- `src/app/components/InventarioPage.tsx`

**Dónde se ve en la UI:**
- Módulo **Inventario** → arriba de los tabs de navegación, aparece un dropdown "Sucursal" si hay 2+ sucursales

**Qué hace:**
- Hook `useBranchScope()`:
  - Obtiene todas las sucursales vía `api.get('/sucursales')`
  - Si el usuario tiene `branchIds` restringidos, filtra solo esas sucursales
  - Admins ven todas las sucursales
  - Provee `filterByBranch(items)` para filtrar arrays por sucursal seleccionada
  - Provee `hasBranchAccess(branchId)` para verificar acceso a una sucursal
- Componente `BranchScopeFilter`:
  - Dropdown de selección de sucursal
  - Solo se renderiza si hay 2+ sucursales accesibles
- **Solo Frontend** — asume que el backend devuelve `branchIds` o `branchAccess[]` en el payload del usuario

**Para usar en otras páginas:**
```tsx
import { useBranchScope } from '../../hooks/useBranchScope';
import { BranchScopeFilter } from '../ui/BranchScopeFilter';

// En el componente:
const { selectedBranchId, accessibleBranches, filterByBranch, hasBranchAccess } = useBranchScope();

// Filtra datos:
const filteredData = filterByBranch(myData);

// En el JSX:
<BranchScopeFilter />
```

---

## 📍 Resumen por Ubicación en la UI

| Feature | Módulo | Vista | Ubicación exacta |
|---------|--------|-------|-----------------|
| Proyección de Ventas | Reportes | Ventas | 1er row de charts (2/3 ancho) |
| Composición de Ventas | Reportes | Ventas | 1er row de charts (1/3 ancho, derecha) |
| Top 5 Clientes clickable | Reportes | Ventas | Último row, columna izquierda |
| Top 5 Productos (uds) clickable | Reportes | Ventas | Último row, columna derecha |
| Salud de Cartera (4 cols) | Reportes | Ventas | Entre Facts vs Cobranza y Top 5s |
| Importar CSV facturas | Compras | Facturas de Proveedor | Botón junto a "Nueva Factura" |
| Importar Excel asistencia | RRHH | Asistencia | Botón junto a Entrada/Salida/Tutorial |
| Error boundaries | Global | App.tsx | Envuelve 5 módulos críticos |
| Filtro por sucursal | Inventario | (encabezado) | Arriba de los tabs, visible solo si hay 2+ sucursales |

---

## ⚠️ Notas

- **Botón "Solicitar Compra" (carrito) en ProductosView**: No fue agregado por estas sesiones. Ya existía previamente en el código (líneas 1402 y 1593 de `ProductosView.tsx`). Si debe eliminarse, avísame.
- **Permisos por sucursal**: Es infraestructura base. Para que funcione completamente, el backend debe devolver `branchIds` o `branchAccess` en el objeto de usuario. La integración en otras páginas (Ventas, Compras, Finanzas) queda pendiente — actualmente solo Inventario tiene el filtro visible.

---

## 🔧 Correcciones Rápidas — Sesión Actual

### OrdenesCompraView — Renombrar filtro

**Archivos modificados:**
- `src/app/components/compras/OrdenesCompraView.tsx`

**Qué se hizo:**
- Etiqueta "Personalizado" → "Rango por fechas" en el selector de presets de fecha

---

### ProveedoresView — Eliminar → Desactivar

**Archivos modificados:**
- `src/app/components/compras/ProveedoresView.tsx`

**Qué se hizo:**
- Eliminado botón "Recalcular Saldo" (ícono RefreshCw)
- Botón "Eliminar" (Trash2) → "Desactivar" (Ban)
- ConfirmDialog: cambia texto, usa `suppliersService.update(id, { isActive: false })` en vez de `delete()`

---

### GastosView — Limpiar presets de fecha

**Archivos modificados:**
- `src/app/components/compras/GastosView.tsx`

**Qué se hizo:**
- Eliminados presets "4 días" y "9 días"
- Quedan solo "Último mes" y "Último año"

---

### ProductosView — Eliminar botón carrito por fila

**Archivos modificados:**
- `src/app/components/inventory/ProductosView.tsx`

**Qué se hizo:**
- Eliminado botón "Solicitar Compra" (ShoppingCart) de las acciones por fila (vista desktop y mobile)
- El botón del dialog de crear solicitud se conserva (es el submit del form)

---

## 🧹 Sesión 2 — Correcciones Rápidas (Frontend)

### OrdenesCompraView — Filtro por estado (KPI cards clickables)

**Archivos modificados:**
- `src/app/components/compras/OrdenesCompraView.tsx`

**Qué se hizo:**
- Agregado `statusFilter` state (default: 'ALL')
- KPI cards ahora son clickables — filtran la tabla por estado
- KPI añadido: "Anuladas" (CANCELLED)
- La tabla filtra por `statusFilter` además del search term
- Diseño cambió de Cards estáticas a botones con highlight del filtro activo

---

### ProductosView — Traducir etiqueta "PRODUCT"

**Archivos modificados:**
- `src/app/components/inventory/ProductosView.tsx`

**Qué se hizo:**
- Cambiadas etiquetas "🏷 Productos" → "Productos" y "⚙ Servicios" → "Servicios" en el filtro de tipo

---

### SalesReportTab — Tarjeta "Saldo Pendiente Clientes"

**Archivos modificados:**
- `src/app/components/reportes/SalesReportTab.tsx`

**Qué se hizo:**
- Agregado cálculo `totalPending` (totalBilled - totalPaid)
- Nueva 5ta tarjeta KPI: "Saldo Pendiente" (ícono Clock, color rose) que muestra por cobrar
- Grid expandido de 4 a 5 columnas en lg

---

### FacturasProveedorView — Import xlsx movido a detalle

**Archivos modificados:**
- `src/app/components/compras/FacturasProveedorView.tsx`

**Qué se hizo:**
- **Botón "Importar" eliminado de la toolbar (vista de lista)**
- **Botón "Importar" agregado en el header del detalle** (junto a Descargar/Anular)
- **Formato cambiado de CSV a .xlsx** (Excel)
- `parseCsv` + `splitCsvLine` reemplazados por `parseXlsx` (usa `XLSX.read`)
- `downloadTemplate` ahora genera .xlsx (usa `XLSX.writeFile`)
- Input de archivo cambiado a `accept=".xlsx,.xls"`
- Textos actualizados: "CSV" → "Excel" / "archivo Excel"
- Import `* as XLSX from 'xlsx'` agregado

---

### EmpleadosView — Eliminar → Desactivar

**Archivos modificados:**
- `src/app/components/hr/EmpleadosView.tsx`

**Qué se hizo:**
- `handleDelete` ahora usa `hrService.updateEmployee(id, { employmentStatus: 'INACTIVE' })`
- Ícono Trash2 → Ban en tabla y vista de tarjetas
- ConfirmDialog: título "¿Eliminar Empleado?" → "¿Desactivar Empleado?"
- Descripción actualizada: "El empleado quedará inactivo..."
- Botón `title` agregado: "Desactivar"

---

---

## 🧹 Sesión 2b — Correcciones adicionales

### FinanceBalanceView — Fixed Tailwind JIT purge bug

**Archivos modificados:**
- `src/app/components/finanzas/FinanceBalanceView.tsx`

**Qué se hizo:**
- Reemplazada interpolación dinámica `border-${...}-500/20` con `cn()` y clases estáticas
- Tailwind JIT no detecta clases con interpolación parcial, causando que el borde del card "Balance Neto" nunca se renderizara

---

### MovimientosView — Overflow horizontal + null safety

**Archivos modificados:**
- `src/app/components/inventory/MovimientosView.tsx`

**Qué se hizo:**
- `overflow-hidden` → `overflow-x-auto` en el contenedor de la tabla (evita clipping en mobile)
- Agregado `(warehouses || [])` para evitar crash si warehouses es null/undefined

---

### SalesReportTab — KPI Saldo Pendiente

**Archivos modificados:**
- `src/app/components/reportes/SalesReportTab.tsx`

**Qué se hizo:**
- Cálculo `totalPending = totalBilled - totalPaid`
- Nueva tarjeta KPI #5 (grid lg:grid-cols-5)
- Import `Clock` de lucide-react agregado

---

## ⏳ Pendientes no realizados (no detectados o inexistentes)

| Tarea | Estado | Nota |
|-------|--------|------|
| ComisionesView — ícono | ❌ No existe | No hay archivo ComisionesView en el código |
| IncomeBreakdownTab — sin rangos | ❌ No existe | Archivo no encontrado en finanzas/ |
| AsistenciaView — responsive | ✅ OK | Layout responsive ya funciona correctamente |
| ProveedoresView — categorías | ✅ OK | No hay categorías internas cargándose |
| Dialog normalization | ⏸️ Pausado | GastosView usa native `<select>` vs shadcn `<Select>` en OrdenesCompra. Tarea cosmética. |

---

## 🏪 Sesión 4 — Branch Scope + Reportes

### BranchScopeFilter integrado en VentasPage, ComprasPage, FinanzasPage

**Archivos modificados:**
- `src/app/components/VentasPage.tsx`
- `src/app/components/ComprasPage.tsx`
- `src/app/components/FinanzasPage.tsx`

**Archivos creados:**
- `src/app/components/ui/BranchAccessError.tsx`

**Qué se hizo:**
- Import `useBranchScope` + `BranchScopeFilter` en las 3 páginas
- `<BranchScopeFilter className="ml-auto" showLabel={false} />` agregado en el header de cada página
- Badge de sucursal(es) visible cuando `isRestricted` es true
- Datos filtrados por sucursal vía `filterByBranch()` antes de pasarlos a las sub-vistas
- Creado componente `BranchAccessError.tsx` con mensajes claros: "No tienes acceso a esta sucursal. Contacta al administrador."

**Integración específica por página:**
| Página | Filtrado aplicado en |
|--------|---------------------|
| VentasPage | clientes, estimaciones, ordenes, facturas, recurrentes, pagos, devoluciones, notasCredito |
| ComprasPage | proveedores, gastos, gastosRec, ordenes, recepciones, facturasProv, facturasRec, pagos, creditos, solicitudes, gestion |
| FinanzasPage | incomes, expenses, recurringExpenses, recurringIncomes, accounts |

---

## 🔷 Sesión 5 — Backend + DB + Config

### Hallazgos (sin cambios de código — se documentan para próxima sesión)

| Tarea | Resultado |
|-------|-----------|
| **CategoriasView** | No existe como archivo separado. `CategoriasGastosView` existe solo en contabilidad. La creación de tabla `inventario_categorias` depende del backend. |
| **Recomendación compra (2 de 9)** | `ProductosView` crea solicitudes por producto individual (el usuario hace clic en un producto). No hay función "recomendar todo" — es una feature request, no un bug. |
| **Configuración de Compras** | No existe vista de configuración dedicada en el módulo Compras. La config global está en `ConfiguracionPage.tsx`. |

---

## 🧹 Sesión 6 — Correcciones post-merge + Features solicitados

### Fixes generales post-merge

| Issue | Archivo | Cambio |
|-------|---------|--------|
| `typeFilter is not defined` | `ProductosView.tsx` | Agregado `const [typeFilter, setTypeFilter] = useState<string>('all')` |
| `Adjacent JSX elements` | `FacturasProveedorView.tsx` | Envuelto `<div>` + `<Dialog>` en fragmento `<>...</>` |
| Dashboard infinite loading | `App.tsx` | OverviewDashboard envuelto en `ModuleErrorBoundary` |
| Dashboard loading forever | `TenantOverview.tsx` | Agregado `setLoading(false)` en early return cuando setup incompleto |
| BranchScope admin filter | `useBranchScope.ts`, `BranchScopeFilter.tsx` | Admins inician sin sucursal (ven todos los datos). Opción "Todas las sucursales" solo para admins |
| `customers` sin filtrar | `VentasPage.tsx` | `PagosRecibidosView` usa `filteredData.clientes` en vez de `data.clientes` |

### ProductosView — Corrección de columnas + remover duplicado

| Cambio | Detalle |
|--------|---------|
| Botón duplicar | Eliminado (tanto UI como handler `handleDuplicateProduct`) |
| Columna margen (`salePrice - costPrice`) | Eliminada — no tenía header correspondiente, rompía el layout |
| `duplicatingIds` state | Eliminado |
| Imports limpiados | `Copy`, `ShoppingCart`, `Loader2`, `flushSync` eliminados |

### AsistenciaView — KPIs unificados + traducción

| Cambio | Detalle |
|--------|---------|
| KPIs | Reemplazados gradients por patrón estándar del ERP (card con icono semitransparente) — azul/esmeralda/rosa |
| Texto importación | Traducido a español: `estado: PRESENT (Presente) / ABSENT (Ausente) / LATE (Tardanza) / REMOTE (Remoto)` |
| Iconos | `UserCheck` y `UserX` agregados |

### OrdenesCompraView — Evidencia multi-archivo + stock simplificado

| Cambio | Detalle |
|--------|---------|
| Evidencia | Soportado múltiples archivos (`multiple` en input, array de `File`) |
| Vista previa | Imágenes se muestran como thumbnail (`URL.createObjectURL`) |
| Eliminar | Cada archivo tiene botón `X` para removerlo individualmente |
| Stock input | Simplificado: checkbox `stockApplies` y campo `stock` eliminados. Stock actual se muestra como badge read-only |
| Error message | Mejorado: detecta 404 / "no existe" y muestra: "Uno de los productos seleccionados ya no está disponible." |

### ProductosView — Removido botón "Crear Solicitud" (ShoppingCart)

| Cambio | Detalle |
|--------|---------|
| Dialog "Solicitar Compra" | Eliminado completamente del inventario. `ShoppingCart`, `Loader2`, `purchaseRequestsService`, `prProduct`, `prQuantity`, `prSubmitting`, `handleCreatePurchaseRequest`, `handleConfirmPurchaseRequest` — todo removido. |

### FacturasProveedorView — KPIs clickables + Número editable

| Cambio | Detalle |
|--------|---------|
| KPIs clickables | Similar a OrdenesCompraView: cada KPI filtra la tabla (Todo / Pendiente / Vencidas / Pagadas) con ring highlight |
| Número de factura | Cambiado de `disabled` + autogenerado a campo editable |
| Validación | `handleSaveDoc` valida que el número no esté vacío antes de guardar |
| Placeholder | `Ej: F001-000001` |

### ProveedoresView — Ajustes de UI

| Cambio | Detalle |
|--------|---------|
| Columna Saldo | Ancho aumentado de `130px` a `170px` para evitar corte |
| Header `contactName` | Corregido de "direccion" a "Contacto" |

### ProductosView — Restaurado a commit cef1657

| Cambio | Detalle |
|--------|---------|
| Versión exacta | Restaurado `ProductosView.tsx` al commit `cef1657` (el dev original). Sin ShoppingCart, sin Loader2, sin dialog "Solicitar Compra". |

### Compras — Fusión Solicitud + Gestión

| Cambio | Detalle |
|--------|---------|
| Nueva `SolicitudCompraView` | Reescribir completo: formato tabla (antes cards). Columnas: N°, Estado, Prioridad, Proveedor, Cotización, Total, Items, Solicitante, Fecha, Acciones. |
| Gestión integrada | Cada solicitud muestra su gestión (proveedor, cotización, total) si existe. Detail dialog muestra info completa de solicitud + gestión. |
| Tab "Gestión Compra" | Eliminado. Ya no existe pestaña separada — todo se maneja desde Solicitudes. |
| `GestionCompraView.tsx` | Archivo eliminado. |
| Acciones contextuales | Por estado: cambio de estado (workflow), aprobar/rechazar gestión, convertir a OC — todo desde la misma tabla. |

### Pull Remote — Contabilidad actualizada

| Cambio | Detalle |
|--------|---------|
| `chartOfAccountsCsv.ts` | Nuevo utility con headers exactos: `codigo, nombre, tipo_cuenta, subtipo, tipo_detalle, moneda, codigo_padre, permite_manual, activa, notas`. Formato 1/0 para booleanos. |
| `accounting.ts` | Nuevos tipos `ChartAccountCsvRow` |
| `PlanCuentasView.tsx` | Actualizado: import CSV con mapeo a las columnas, export con formato 1/0, template descargable. |
| Backend schema | Pull remoto: `subtype`, `detailType`, `allowManualEntry` ya existen en DB. |
