# Preferencias de vista por usuario

## Persistencia y alcance

Las preferencias se leen y escriben mediante `/api/user-preferences/view`. La API toma el usuario y la sucursal activa de la sesión autenticada; el navegador solo envía la clave de vista y los valores de presentación.

- Presentación de listados: por usuario y empresa. Las sucursales de la misma empresa comparten columnas y distribución.
- Orden contable: por usuario y sucursal, con una sección independiente por informe.
- Valores guardados: tabla/tarjetas, columnas visibles, orden de cuentas y posiciones manuales del Kanban de cotizaciones.
- El reinicio de columnas guarda de nuevo todas las columnas como elección del usuario.

## Listados con preferencias persistentes

La tabla compartida `EditableDataTable` ahora guarda columnas y distribución en estas vistas:

| Área | Vistas |
| --- | --- |
| Actividades | Bitácora, eventos, recordatorios y tareas |
| Compras | Créditos de proveedor, facturas y gastos recurrentes, facturas, gastos, órdenes, pagos, proveedores, recepciones y solicitudes |
| Documentos | Archivos, contratos, facturas legales y reportes |
| Inventario | Productos |
| Recursos Humanos | Comisiones y empleados |
| Ventas | Clientes, devoluciones, cotizaciones, facturas recurrentes, facturas, notas de crédito, órdenes, pagos recibidos y leads |
| Configuración y soporte | Roles, usuarios y tickets |

Los controles propios de distribución en Compras, Ventas, tareas, productos y administración también leen y guardan en el servidor. Las tablas consolidadas de Manager tienen columnas configurables para Ventas, Compras, Finanzas, Recursos Humanos, Contabilidad, Reportes y Operaciones.

Pérdidas de inventario en Finanzas tiene distribución tabla/tarjetas y selección de columnas. En Inventario Manager, los listados de auditorías, pérdidas, movimientos y activos también guardan la selección de columnas. Las vistas principales de inventario Manager conservan sus controles de lista/tarjetas y las columnas operativas fijas de cada flujo.

## Orden contable

`BalanceComprobacionView`, `BalanceGeneralView`, `EstadoResultadosView` y `CambiosPatrimonioView` conservan el orden manual en el servidor por sucursal e informe.

## Recuperación de datos locales

- Se importa el orden contable antiguo solo cuando su clave local contiene usuario, sucursal e informe y todavía no existe una preferencia remota para esa vista.
- Se importan las posiciones del Kanban de cotizaciones desde su clave local con usuario y sucursal al espacio independiente `sales.estimates.kanban-positions`.
- Se importa la selección de KPI del Dashboard desde la clave local que identifica usuario y sucursal.
- Las claves globales o compartidas del navegador no se adjudican al primer usuario que inicie sesión. Por eso no se migra la configuración antigua de columnas del Kanban ni las claves antiguas del Dashboard que omiten el usuario.

## Excepciones de diseño

- Las líneas de documentos, matrices editables de precios, formularios de importación y tablas de vista previa se mantienen en tabla: cada celda participa en captura, cálculo o revisión del documento.
- El plan de cuentas conserva su jerarquía de árbol; el balance y los estados financieros conservan reordenamiento dentro de sus secciones.
- La vista de bodegas de Manager se conserva como tarjetas porque cada registro agrega varias sucursales, ubicaciones y disponibilidades.
- En tablas especializadas de inventario con acciones embebidas (asignación de propietario, expansión de ubicaciones o aprobación de transferencia) la configuración de columnas sigue fija para mantener visibles los datos requeridos por esa acción. La presentación tabla/tarjetas sí se guarda donde ambas representaciones están disponibles.

## Despliegue pendiente

La migración aditiva `20261127130000_user_view_preferences` crea la tabla para preferencias. No se ha aplicado a ninguna base de datos ni se han desplegado los servicios; hasta desplegar Backend, aplicar la migración y desplegar Frontend, las preferencias remotas no estarán disponibles en producción.
