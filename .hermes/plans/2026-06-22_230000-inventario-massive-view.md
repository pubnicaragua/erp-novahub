# Inventario masivo estilo Odoo/Zoho — Plan de implementación

> **Para Hermes:** Implementar este plan task-by-task usando el patrón de subagentes con revisión.

**Goal:** Convertir el módulo de Inventario > Existencias en una pantalla de gestión completa, densa y profesional (tipo Odoo Inventory / Zoho Inventory), donde se vean todos los productos con búsqueda, filtros múltiples, vista de detalle expandible por producto (drawer lateral), kardex por producto, y densidad visual alta.

**Architecture:** Refactor del `ProductosView.tsx` actual sin romper el contrato de props. Mantener compatibilidad con `InventarioPage.tsx`. Agregar:
- Drawer lateral de detalle (Radix Sheet ya está en el proyecto) con tabs: General, Stock por bodega, Kardex, IMEI/Series, Historial.
- Barra de filtros tipo "datagrid" (búsqueda global, multi-filtro por categoría/tipo/estado de stock/almacén con checkboxes).
- Tabla densa con columnas adicionales: Stock Mín/Máx, Última Compra, Última Venta, Valor inventario, Margen %.
- Command palette (`Cmd+K`) para búsqueda rápida de productos.
- Vista de "Selección múltiple" con acciones en bulk (cambiar categoría, ajustar stock, exportar selección).

**Tech Stack:** React 18, TypeScript, Vite, Tailwind v4, shadcn/ui (Radix + lucide), Motion (Framer), Sonner (toasts), XLSX (ya en uso), date-fns (ya en uso).

---

## Contexto del estado actual

Lo que **ya existe** y se conserva:
- `ProductosView.tsx` (1176 líneas) tiene: filtros (search, categoría, tipo, estado stock), tabla con edición inline, importación Excel, modal de detalle básico con stock por almacén y series.
- `inventoryService` en `services/inventario.service.ts` con todos los endpoints REST.
- UI kit completo en `components/ui/`: Sheet, Tabs, Command, Popover, Dropdown, Tooltip, Pagination, Checkbox, Badge, etc.
- Stack visual consistente con el resto del ERP (Tailwind v4 + Radix + Motion).

Lo que **falta** para verse "masivo":
1. Drawer lateral en lugar de modal — más espacio y mejor UX.
2. Tabs dentro del detalle: General / Stock por bodega / Kardex / IMEI / Historial de movimientos.
3. Filtros combinables (más de uno a la vez, multi-select).
4. Columnas de densidad: stock mín/máx, valor de inventario, última compra/venta, margen %.
5. Command palette para búsqueda rápida.
6. Acciones bulk (selección múltiple).
7. Paginación visible si hay muchos productos.
8. Indicadores visuales por estado (chip color en línea, mejor jerarquía).

---

## Task 1: Crear componente `ProductDetailDrawer` (la pieza grande)

**Objective:** Reemplazar el modal pequeño de detalle por un drawer lateral profesional con tabs.

**Files:**
- Create: `novahub-frontend/src/app/components/inventory/ProductDetailDrawer.tsx`
- Modify: `novahub-frontend/src/app/components/inventory/ProductosView.tsx` (quitar el `<Dialog>` de detalle, usar el drawer)

**Step 1:** Crear el componente drawer con Radix Sheet (ya disponible). Estructura:

```tsx
// ProductDetailDrawer.tsx — ~450 líneas
'use client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
// ...lucide icons: Package, Warehouse, History, Hash, TrendingUp, AlertCircle
```

**Tabs internas:**
1. **General** — imagen (placeholder), nombre, SKU, descripción, categoría, tipo, unidad de medida, proveedor preferido, código de barras, precios (costo, venta, margen %), impuestos.
2. **Stock por bodega** — tabla con todas las bodegas y cantidad en cada una + indicador visual (barra de progreso).
3. **Kardex** — movimientos ordenados por fecha (entrada/salida/ajuste/transferencia), saldo resultante, usuario que lo hizo.
4. **IMEI / Series** — tabla paginada de números de serie con estado (disponible, vendido, en transferencia, dañado).
5. **Historial** — log de cambios del producto (auditoría).

**Step 2:** Fetch dinámico al abrir — llamar `inventoryService.getProduct(id)` para traer datos completos (incluye `stockLevels`, `variants`, `movements`, `series`, `auditLog`).

**Step 3:** Reemplazar el `<Dialog>` actual de detalle en `ProductosView.tsx` por el nuevo drawer.

**Step 4:** Verificar visualmente — abrir un producto debe verse como una hoja lateral ancha (~720px en desktop, full-screen en mobile) con tabs claras.

---

## Task 2: Ampliar la tabla principal con columnas de densidad

**Objective:** Que la tabla se vea "llena" de información útil tipo datagrid de Odoo.

**Files:**
- Modify: `novahub-frontend/src/app/components/inventory/ProductosView.tsx`

**Columnas nuevas a agregar** (mantener las existentes):

| Columna | Valor | Notas |
|---|---|---|
| Stock Mín | `stockLevel.minStock` | Tooltip explicando |
| Stock Máx | `stockLevel.maxStock` | |
| Valor Stock | `stock × costPrice` | Formato moneda |
| Última Compra | `lastPurchaseDate` | Formato "hace 3 días" con date-fns |
| Última Venta | `lastSaleDate` | |
| Margen % | `(sale - cost) / sale × 100` | Color verde/rojo |
| Estado | `status` chip | Activo / Inactivo / Descontinuado |

**Step 1:** Ampliar el array de `TableHead` y los `<TableCell>` correspondientes.

**Step 2:** Calcular campos derivados con `useMemo` para no recalcular en cada render.

**Step 3:** Hacer columnas opcionales vía un toggle de "Columnas" (DropdownMenu con Checkbox por columna).

---

## Task 3: Barra de filtros combinables (multi-select)

**Objective:** Permitir filtrar por múltiples bodegas y múltiples categorías a la vez (no solo uno).

**Files:**
- Modify: `novahub-frontend/src/app/components/inventory/ProductosView.tsx`

**Step 1:** Cambiar `categoryFilter: string` por `categoryFilters: string[]` y `warehouseFilters: string[]`.

**Step 2:** Reemplazar los `<Select>` simples por un componente de multi-select. Como no hay uno existente, crear uno ligero usando `Popover` + `Checkbox`:

```tsx
// MultiSelectFilter.tsx — ~80 líneas
function MultiSelectFilter({ options, selected, onChange, label }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {label} {selected.length > 0 && <Badge>{selected.length}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        {options.map(opt => (
          <label key={opt.value} className="flex items-center gap-2 p-1.5 hover:bg-muted rounded">
            <Checkbox checked={selected.includes(opt.value)} onCheckedChange={() => toggle(opt.value)} />
            {opt.label}
          </label>
        ))}
        <Button size="sm" variant="ghost" onClick={() => onChange([])}>Limpiar</Button>
      </PopoverContent>
    </Popover>
  );
}
```

**Step 3:** Actualizar la lógica `filteredProducts` para usar `.some()` o `.every()` según el modo (AND / OR).

**Step 4:** Agregar indicador visual de cuántos filtros están activos.

---

## Task 4: Command palette (Cmd+K) para búsqueda rápida

**Objective:** Atajo de teclado estilo Odoo/Zoho para saltar a un producto.

**Files:**
- Modify: `novahub-frontend/src/app/components/inventory/ProductosView.tsx`

**Step 1:** Usar el `Command` component ya disponible en `components/ui/command.tsx`.

```tsx
<CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
  <CommandInput placeholder="Buscar producto por nombre, código o categoría..." />
  <CommandList>
    <CommandEmpty>No se encontraron productos.</CommandEmpty>
    <CommandGroup heading="Productos">
      {products.slice(0, 50).map(p => (
        <CommandItem key={p.id} onSelect={() => { setSelectedProduct(p); setCmdOpen(false); setDrawerOpen(true); }}>
          <Package /> {p.name} <span className="text-muted-foreground ml-auto">{p.code}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  </CommandList>
</CommandDialog>
```

**Step 2:** Listener global de `Cmd+K` (o `Ctrl+K` en Windows) para abrirlo.

**Step 3:** Botón visible en el toolbar que diga "Buscar... ⌘K".

---

## Task 5: Selección múltiple y acciones bulk

**Objective:** Permitir seleccionar varios productos y aplicar acciones masivas.

**Files:**
- Modify: `novahub-frontend/src/app/components/inventory/ProductosView.tsx`

**Step 1:** Agregar `<Checkbox>` en la primera columna del header (seleccionar todos los filtrados) y en cada fila.

**Step 2:** Estado `selectedIds: Set<string>` y `allSelected: boolean`.

**Step 3:** Cuando hay selección, mostrar una barra flotante (Sticky bottom) con acciones:
- Cambiar categoría (Popover con Select)
- Exportar selección a Excel
- Eliminar selección (con ConfirmDialog)
- Ajustar stock masivo (modal)

---

## Task 6: Paginación en la tabla

**Objective:** Que no se rendericen 10,000 productos de golpe.

**Files:**
- Modify: `novahub-frontend/src/app/components/inventory/ProductosView.tsx`

**Step 1:** Agregar estado `page` y `pageSize` (default 25).

**Step 2:** Slicear `filteredProducts` con `.slice((page-1)*pageSize, page*pageSize)`.

**Step 3:** Usar el componente `Pagination` de shadcn/ui (ya está) abajo de la tabla.

**Step 4:** Indicador "Mostrando 1-25 de 347 productos".

---

## Task 7: Pulido visual y jerarquía

**Objective:** Que se vea "masivo" y profesional, no un tuquito.

**Files:**
- Modify: `novahub-frontend/src/app/components/inventory/ProductosView.tsx`

**Step 1:** Aumentar el ancho máximo del contenedor principal (`max-w-[1800px]` ya está en InventarioPage — verificar que ProductosView use el ancho completo).

**Step 2:** Tabla con `text-xs` en celdas, `font-medium` en datos importantes, `tabular-nums` en números.

**Step 3:** Header sticky de tabla (`sticky top-0 bg-background`) — al hacer scroll las cabeceras permanecen visibles.

**Step 4:** Hover en fila con `hover:bg-muted/40` y cursor pointer.

**Step 5:** Indicador lateral en cada fila (border-left de 3px) según estado:
- Verde: stock OK
- Amarillo: stock bajo
- Rojo: sin stock
- Gris: servicio

**Step 6:** Agregar mini-gráfico sparkline de evolución de stock (últimos 30 días) en una columna opcional (usar Recharts, ya está instalado).

---

## Task 8: Mejoras de densidad en el toolbar superior

**Objective:** Toolbar con más controles visibles, estilo datagrid.

**Files:**
- Modify: `novahub-frontend/src/app/components/inventory/ProductosView.tsx`

**Step 1:** Toolbar en una sola línea (en desktop) con grupos visuales separados por `Separator`:
- Izquierda: Búsqueda + filtros
- Centro: Contador "X productos"
- Derecha: Vista (Tabla / Cards toggle) + Columnas + Densidad + Acciones + Importar + Agregar

**Step 2:** Botón "Densidad" (Cómoda / Compacta / Ultra compacta) que ajusta el padding de las filas.

---

## Task 9: Refactor y cleanup

**Objective:** Dejar el código limpio para que no se vuelva otro tuquito difícil de mantener.

**Files:**
- Modify: `novahub-frontend/src/app/components/inventory/ProductosView.tsx`
- Create: `novahub-frontend/src/app/components/inventory/MultiSelectFilter.tsx`
- Create: `novahub-frontend/src/app/components/inventory/ProductDetailDrawer.tsx`
- Create: `novahub-frontend/src/app/components/inventory/StockSparkline.tsx`

**Step 1:** Mover `MultiSelectFilter`, `ProductDetailDrawer`, `StockSparkline` a archivos separados.

**Step 2:** Extraer lógica de filtrado a un custom hook `useProductFilters(products, filters)`.

**Step 3:** Extraer lógica de columnas a `useProductColumns()`.

**Step 4:** Confirmar que `ProductosView` principal quede en ~600-800 líneas (no 1176).

---

## Validación final

Después de todos los tasks:

1. **Build:** `cd novahub-frontend && npm run build` — debe pasar sin errores TS.
2. **Dev:** `npm run dev` — abrir `/inventario`, sección "Existencias".
3. **Verificar visualmente:**
   - Tabla ancha con 12+ columnas
   - Drawer lateral al hacer clic en un producto, con 5 tabs
   - Cmd+K abre paleta de búsqueda
   - Selección múltiple muestra barra flotante
   - Paginación al final
   - Filtros multi-select funcionan
4. **Probar edge cases:**
   - 0 productos → empty state
   - 1 producto → sin paginación
   - 500 productos → paginación 25 por página
   - Producto con series → tab IMEI poblada
   - Servicio → sin columnas de stock

---

## Riesgos / Notas

- **Backend:** Asumo que `getProduct(id)` ya devuelve `stockLevels`, `variants`, `series`. Si no, hay que agregarlo al backend NestJS (fuera de scope de este plan).
- **Permisos:** Mantener `canPerform('INVENTORY_PRODUCTS', ...)` en cada acción.
- **No romper:** El componente `ProductosView` mantiene la misma firma de props que `InventarioPage.tsx` espera.
- **Mobile:** Drawer full-screen en mobile (Sheet de Radix lo hace nativamente).
- **Performance:** Si hay >1000 productos, memoizar el filtrado y considerar virtualización (`@tanstack/react-virtual` — no instalado, evaluar si se necesita).

---

## Resumen de archivos a tocar

| Acción | Path | Líneas aprox. |
|---|---|---|
| Crear | `components/inventory/ProductDetailDrawer.tsx` | ~450 |
| Crear | `components/inventory/MultiSelectFilter.tsx` | ~80 |
| Crear | `components/inventory/StockSparkline.tsx` | ~60 |
| Modificar | `components/inventory/ProductosView.tsx` | refactor a ~700 |
| (sin cambios) | `services/inventario.service.ts` | reutiliza endpoints |
| (sin cambios) | `InventarioPage.tsx` | mantiene props |