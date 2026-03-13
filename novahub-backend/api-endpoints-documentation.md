# NovaHub ERP - Guía Definitiva de Endpoints de la API

Esta documentación detalla el 100% de los endpoints disponibles, reflejando fielmente el esquema de base de datos y la lógica de negocio multitenant.

**Seguridad**: Todos los endpoints (excepto `/auth/login`) requieren el encabezado `Authorization: Bearer <JWT>`.

---

## 🔐 1. Autenticación y Usuarios
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/login` | Login con `{email, password}`. Devuelve `access_token`. |
| GET | `/auth/profile` | Perfil del usuario autenticado. |
| GET | `/users` | Listar usuarios del tenant actual. |
| POST | `/users` | Crear usuario. Requiere DTO completo. |
| GET | `/users/:id` | Ver detalle de usuario. |
| PATCH | `/users/:id` | Actualización parcial de usuario. |
| DELETE | `/users/:id` | Eliminar usuario. |

## 💰 2. Ventas e Ingresos (Sales)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/sales/customers` | Listado de clientes. |
| POST | `/sales/customers` | Crear cliente (Individual/Empresa). |
| GET | `/sales/estimates` | Listar cotizaciones con sus ítems. |
| POST | `/sales/estimates` | Crear cotización (Soporta múltiples productos). |
| GET | `/sales/orders` | Listar órdenes de venta confirmadas. |
| POST | `/sales/orders` | Generar orden de venta. |
| GET | `/sales/invoices` | Listar facturas emitidas. |
| POST | `/sales/invoices` | Crear factura legal. |
| POST | `/sales/payments` | Registrar pago recibido de un cliente. |
| GET | `/sales/payments` | Historial de pagos recibidos. |

## 🛒 3. Compras y Gastos (Purchases)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/purchases/suppliers` | Listar proveedores. |
| POST | `/purchases/suppliers` | Crear nuevo proveedor. |
| GET | `/purchases/orders` | Listar órdenes de compra. |
| POST | `/purchases/orders` | Generar orden de compra a proveedor. |
| GET | `/purchases/invoices` | Listar facturas recibidas de proveedores. |
| POST | `/purchases/invoices` | Registrar factura de proveedor. |

## 📦 4. Inventario (Inventory)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/inventory/products` | Catálogo de productos y servicios. |
| POST | `/inventory/products` | Crear producto/servicio. |
| GET | `/inventory/warehouses` | Listar almacenes físicos. |
| POST | `/inventory/warehouses` | Crear nuevo almacén. |
| GET | `/inventory/stock/:warehouseId` | Stock detallado por almacén. |
| GET | `/inventory/transfers` | Listado de transferencias entre almacenes. |
| POST | `/inventory/transfers` | Crear nueva transferencia. |

## 🏦 5. Finanzas y Contabilidad (Financials)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/financials/accounts` | Consultar Plan de Cuentas. |
| POST | `/financials/accounts` | Crear cuenta contable. |
| GET | `/financials/income` | Registro de otros ingresos no operacionales. |
| POST | `/financials/income` | Crear registro de ingreso. |
| GET | `/financials/expenses` | Listado de gastos del periodo. |
| POST | `/financials/expenses` | Registrar gasto administrativo/operativo. |
| POST | `/financials/journals` | Crear asiento contable (Partida doble). |

## 👷 6. Proyectos y Tareas (Projects)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/projects` | Listar proyectos (Obras/Diseños). |
| POST | `/projects` | Crear proyecto con fecha inicio/fin. |
| GET | `/projects/:id` | Detalle, tareas y documentos del proyecto. |
| POST | `/projects/:id/tasks` | Agregar tarea específica al cronograma. |
| GET | `/projects/:id/tasks` | Listar tareas del proyecto. |
| GET | `/projects/:id/timeline` | Cronograma ordenado por vencimiento. |

## 👥 7. Recursos Humanos (HR)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/hr/employees` | Listar ficha de empleados. |
| POST | `/hr/employees` | Contratar/Registrar empleado. |
| GET | `/hr/payroll` | Historial de nóminas procesadas. |
| POST | `/hr/payroll` | Ejecutar cálculo de nómina. |
| GET | `/hr/time-off` | Consultar vacaciones/permisos. |
| POST | `/hr/time-off` | Solicitar tiempo libre. |

## 🛠️ 8. Herramientas y Soporte (Tools)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/tools/tickets` | Sistema de tickets de soporte interno. |
| POST | `/tools/tickets` | Abrir nuevo ticket. |
| GET | `/tools/documents` | Repositorio de documentos del tenant. |
| POST | `/tools/documents` | Subir referencia de documento. |
| GET | `/tools/activities` | Listar actividades CRM/Calendario. |
| POST | `/tools/activities` | Registrar nueva actividad. |

## 🔐 9. Roles y Configuración
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/roles` | Listar roles y permisos del tenant. |
| POST | `/roles` | Crear nuevo rol personalizado. |
| PATCH | `/roles/:id` | Actualizar permisos de un rol. |
| DELETE | `/roles/:id` | Eliminar un rol. |
| GET | `/tenants/:id` | Ver configuración del tenant (Colores, Logo). |
| PATCH | `/tenants/:id` | Actualizar configuración corporativa. |

## 🔔 10. Notificaciones
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/tools/notifications` | Listar notificaciones del usuario autenticado. |
| PATCH | `/tools/notifications/:id/read` | Marcar notificación como leída. |
| PATCH | `/tools/notifications/read-all` | Marcar todas las notificaciones como leídas. |

---

> **Notas:**  
> - Todos los endpoints están protegidos con `JwtAuthGuard` y aislados por `clientTenantId`.  
> - El campo `clientTenantId` se inyecta automáticamente desde el JWT — no es necesario enviarlo en el body.  
> - Las respuestas paginadas (listas largas) incluyen metadata: `{ data: [], meta: { total, page, pageSize, totalPages } }`.
