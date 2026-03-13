# NovaHub ERP - Especificación Completa del Demo 100% Funcional

## Visión General

NovaHub ERP es un sistema empresarial completo diseñado para adaptarse a cualquier tipo de negocio, con especial énfasis en estudios de arquitectura. Esta especificación detalla la arquitectura frontend-backend para una implementación 100% funcional.

## Arquitectura General

### Stack Tecnológico
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: NestJS + Supabase (PostgreSQL)
- **ORM**: Prisma
- **UI**: TailwindCSS + shadcn/ui + Radix UI
- **Estado**: React Context + Hooks
- **Rutas**: React Router v7

### Diseño y Branding
- **Color Principal**: Verde (#10b981) como predominante en toda la UI, es personalizable desde el módulo de Configuración segun los colores corporativos de cada empresa.
- **Logo**: Nova Hub representado por "NovaHub" con estilo moderno y minimalista
- **Layout**: 100% responsive (desktop, tablet, móvil)
- **Header**: Incluye notificaciones, perfil de usuario y dropdown de usuario

### Modelo Multi-Tenancy Jerárquico

NovaHub opera con una arquitectura de tres niveles:

```
NovaHub (Super Admin)
├── Partner A (Revendedor)
│   ├── Cliente Arquitectura 1
│   ├── Cliente Arquitectura 2
│   └── Cliente Limpieza 1
├── Partner B (Revendedor)
│   ├── Cliente Celulares 1
│   ├── Cliente Computadoras 1
│   └── Cliente Servicios 1
└── Partner C (Revendedor)
    └── Cliente Retail 1
```

#### Roles y Permisos

**🏢 NovaHub (Super Admin)**
- Visibilidad total de todos los partners y sus clientes
- Dashboard consolidado de ingresos y rendimiento
- Gestión de partners (crear, suspender, eliminar)
- Configuración global de planes y precios
- Soporte técnico de nivel 3
- Analytics cross-industry

**🤝 Partner (Revendedor)**
- Gestión de sus clientes asignados
- Dashboard de rendimiento de su cartera
- Activación/desactivación de módulos por cliente
- Configuración de planes y precios a sus clientes
- Soporte técnico de nivel 2
- Analytics de su portafolio

**🏢 Cliente Final**
- Acceso solo a sus datos y módulos contratados
- Dashboard de su negocio específico
- Configuración limitada de su instancia
- Soporte técnico a través de su partner

#### Tipos de Industria Soportadas

- **🏗️ Arquitectura** - Gestión de proyectos, planos, recursos
- **📱 Celulares** - Control de inventario, reparaciones, ventas
- **💻 Computadoras** - Servicios técnicos, ventas de hardware/software
- **🧹 Limpieza** - Programación de servicios, personal, insumos
- **🔧 Servicios** - Gestión de tickets, técnicos, facturación
- **🛍️ Retail** - POS, inventario, clientes, proveedores
- **🍽️ Restaurantes** - Mesas, menú, inventario, personal
- **🏥 Salud** - Citas, pacientes, facturación médica
- **🎓 Educación** - Estudiantes, cursos, pagos, certificados
- **🎓 Cualquier otro tipo de industria, esa es la gran flexibilidad de este ERP**

## Estructura del Proyecto Frontend (Otro repositorio aparte)

```
src/
├── app/
│   ├── components/           # Componentes globales reutilizables
│   │   ├── ui/              # Componentes UI base (shadcn/ui)
│   │   ├── layout/          # Layout components
│   │   ├── tables/          # Tablas genéricas
│   │   ├── forms/           # Formularios genéricos
│   │   └── charts/          # Componentes de gráficos
│   ├── contexts/            # React Context providers
│   ├── hooks/               # Hooks personalizados
│   ├── services/            # Servicios de API
│   ├── types/               # Tipos TypeScript globales
│   ├── utils/               # Utilidades
│   └── modules/             # Módulos de negocio
│       ├── core/            # Autenticación, usuarios, tenant
│       ├── admin/           # Administración NovaHub (partners, clientes globales)
│       ├── partner/         # Dashboard de partners (clientes, rendimiento)
│       ├── sales/           # Ventas (clientes, facturas, etc.)
│       ├── purchases/       # Compras (proveedores, órdenes, etc.)
│       ├── financial/       # Finanzas (cuentas, gastos, etc.)
│       ├── inventory/       # Inventario (productos, almacenes)
│       ├── hr/              # Recursos Humanos
│       ├── projects/        # Gestión de proyectos (especial para arquitectura)
│       ├── services/        # Gestión de servicios (limpieza, técnicos, etc.)
│       ├── retail/          # POS y retail (tiendas, inventario)
│       ├── restaurant/      # Gestión restaurant (mesas, menú, etc.)
│       ├── healthcare/      # Gestión salud (citas, pacientes, etc.)
│       ├── education/       # Gestión educación (estudiantes, cursos, etc.)
│       └── tools/           # Herramientas (tickets, documentos, etc.)
├── styles/                  # Estilos globales
└── main.tsx                 # Entry point
```

## Módulos Completos del ERP

### 1. Core (Módulo Base)
**Funcionalidad**: Autenticación, gestión de usuarios y multi-tenancy jerárquico

**Componentes**:
- Login, Register, Forgot Password (con detección de rol)
- User Management (CRUD por rol)
- Tenant Settings (configuración por industria)
- Role-Based Access Control (RBAC jerárquico)
- Dashboard Principal (adaptable por rol)

**Endpoints Backend**:
```typescript
// Autenticación
POST   /auth/login
POST   /auth/register
POST   /auth/logout
POST   /auth/refresh
GET    /auth/profile

// Usuarios
GET    /users
POST   /users
GET    /users/:id
PUT    /users/:id
DELETE /users/:id

// Tenant
GET    /tenant/settings
PUT    /tenant/settings
GET    /tenant/users
GET    /tenant/industry-type
PUT    /tenant/industry-type
```

### 2. Admin NovaHub (Super Admin)
**Funcionalidad**: Gestión global de partners y clientes

**Componentes**:
- Partner Management (CRUD de partners)
- Global Client Overview (todos los clientes)
- Revenue Analytics (consolidado por partner)
- Plan Management (configuración de planes)
- Support Tickets (nivel 3)
- Industry Analytics (métricas por industria)
- Partner Performance Dashboard

**Endpoints Backend**:
```typescript
// Partners
GET    /admin/partners
POST   /admin/partners
GET    /admin/partners/:id
PUT    /admin/partners/:id
DELETE /admin/partners/:id
POST   /admin/partners/:id/suspend
POST   /admin/partners/:id/activate

// Clientes Globales
GET    /admin/all-clients
GET    /admin/all-clients/:id
GET    /admin/clients-by-partner/:partnerId

// Analytics
GET    /admin/revenue/consolidated
GET    /admin/analytics/by-industry
GET    /admin/analytics/by-partner
GET    /admin/performance/metrics

// Planes
GET    /admin/plans
POST   /admin/plans
PUT    /admin/plans/:id
DELETE /admin/plans/:id
```

### 3. Partner Dashboard
**Funcionalidad**: Gestión de cartera de clientes

**Componentes**:
- Client Portfolio (clientes asignados)
- Client Onboarding (activación de módulos)
- Revenue Dashboard (ingresos por cliente)
- Module Management (activar/desactivar módulos)
- Client Support (tickets nivel 2)
- Performance Analytics (métricas de cartera)
- Billing Management (facturación a clientes)

**Endpoints Backend**:
```typescript
// Clientes del Partner
GET    /partner/clients
POST   /partner/clients
GET    /partner/clients/:id
PUT    /partner/clients/:id
DELETE /partner/clients/:id

// Módulos por Cliente
GET    /partner/clients/:id/modules
PUT    /partner/clients/:id/modules
POST   /partner/clients/:id/modules/activate
DELETE /partner/clients/:id/modules/deactivate

// Analytics del Partner
GET    /partner/revenue/dashboard
GET    /partner/analytics/client-performance
GET    /partner/analytics/module-usage
GET    /partner/analytics/churn-rate

// Facturación
GET    /partner/billing/invoices
POST   /partner/billing/invoices
GET    /partner/billing/revenue
```

### 4. Ventas/Sales
**Funcionalidad**: Gestión completa del ciclo de ventas

**Componentes**:
- Customer Management (Clientes)
- Estimates/Quotes (Cotizaciones)
- Sales Orders (Órdenes de Venta)
- Invoices (Facturas)
- Recurring Invoices (Facturas Recurrentes)
- Payment Tracking (Pagos Recibidos)
- Sales Returns (Devoluciones)
- Credit Notes (Notas de Crédito)
- Sales Dashboard

**Endpoints Backend**:
```typescript
// Clientes
GET    /customers
POST   /customers
GET    /customers/:id
PUT    /customers/:id
DELETE /customers/:id

// Cotizaciones
GET    /estimates
POST   /estimates
GET    /estimates/:id
PUT    /estimates/:id
DELETE /estimates/:id
POST   /estimates/:id/convert-to-order

// Órdenes de Venta
GET    /sales-orders
POST   /sales-orders
GET    /sales-orders/:id
PUT    /sales-orders/:id
DELETE /sales-orders/:id
POST   /sales-orders/:id/convert-to-invoice

// Facturas
GET    /invoices
POST   /invoices
GET    /invoices/:id
PUT    /invoices/:id
DELETE /invoices/:id
POST   /invoices/:id/pay
GET    /invoices/:id/pdf

// Pagos Recibidos
GET    /payments-received
POST   /payments-received
GET    /payments-received/:id
PUT    /payments-received/:id
DELETE /payments-received/:id
```

### 5. Compras/Purchases
**Funcionalidad**: Gestión de proveedores y compras

**Componentes**:
- Supplier Management (Proveedores)
- Purchase Orders (Órdenes de Compra)
- Purchase Receipts (Recepciones)
- Supplier Invoices (Facturas de Proveedor)
- Recurring Supplier Invoices
- Payment Made (Pagos Realizados)
- Supplier Credits (Créditos del Proveedor)
- Purchase Dashboard

**Endpoints Backend**:
```typescript
// Proveedores
GET    /suppliers
POST   /suppliers
GET    /suppliers/:id
PUT    /suppliers/:id
DELETE /suppliers/:id

// Órdenes de Compra
GET    /purchase-orders
POST   /purchase-orders
GET    /purchase-orders/:id
PUT    /purchase-orders/:id
DELETE / /purchase-orders/:id
POST   /purchase-orders/:id/receive

// Recepciones
GET    /purchase-receipts
POST   /purchase-receipts
GET    /purchase-receipts/:id
PUT    /purchase-receipts/:id

// Facturas de Proveedor
GET    /supplier-invoices
POST   /supplier-invoices
GET    /supplier-invoices/:id
PUT    /supplier-invoices/:id
DELETE /supplier-invoices/:id
POST   /supplier-invoices/:id/pay
```

### 6. Finanzas/Financial
**Funcionalidad**: Contabilidad y gestión financiera

**Componentes**:
- Chart of Accounts (Plan de Cuentas)
- Income Management (Ingresos)
- Expense Management (Gastos)
- Recurring Expenses (Gastos Recurrentes)
- Journal Entries (Asientos Contables)
- Transaction Ledger (Libro Mayor)
- Balance Sheet (Balance General)
- P&L Statement (Estado de Resultados)
- Cash Flow (Flujo de Caja)
- Financial Dashboard

**Endpoints Backend**:
```typescript
// Cuentas
GET    /accounts
POST   /accounts
GET    /accounts/:id
PUT    /accounts/:id
DELETE /accounts/:id

// Ingresos
GET    /income
POST   /income
GET    /income/:id
PUT    /income/:id
DELETE /income/:id

// Gastos
GET    /expenses
POST   /expenses
GET    /expenses/:id
PUT    /expenses/:id
DELETE /expenses/:id

// Asientos Contables
GET    /journal-entries
POST   /journal-entries
GET    /journal-entries/:id
PUT    /journal-entries/:id
POST   /journal-entries/:id/post

// Reportes
GET    /reports/balance-sheet
GET    /reports/profit-loss
GET    /reports/cash-flow
GET    /reports/trial-balance
```

### 7. Inventario/Inventory
**Funcionalidad**: Gestión de productos y stock

**Componentes**:
- Product Catalog (Catálogo de Productos)
- Category Management (Categorías)
- Warehouse Management (Almacenes)
- Stock Levels (Niveles de Inventario)
- Inventory Movements (Movimientos)
- Stock Transfers (Transferencias)
- Low Stock Alerts
- Inventory Dashboard

**Endpoints Backend**:
```typescript
// Productos
GET    /products
POST   /products
GET    /products/:id
PUT    /products/:id
DELETE /products/:id

// Categorías
GET    /categories
POST   /categories
GET    /categories/:id
PUT    /categories/:id
DELETE /categories/:id

// Almacenes
GET    /warehouses
POST   /warehouses
GET    /warehouses/:id
PUT    /warehouses/:id
DELETE /warehouses/:id

// Inventario
GET    /inventory/levels
GET    /inventory/movements
POST   /inventory/adjust
GET    /inventory/transfers
POST   /inventory/transfers
```

### 8. Recursos Humanos/HR
**Funcionalidad**: Gestión de empleados y nóminas

**Componentes**:
- Employee Management (Empleados)
- Payroll Processing (Nóminas)
- Time Off Management (Vacaciones)
- Attendance Control (Asistencia)
- Performance Reviews (Evaluaciones)
- HR Analytics
- Employee Dashboard

**Endpoints Backend**:
```typescript
// Empleados
GET    /employees
POST   /employees
GET    /employees/:id
PUT    /employees/:id
DELETE /employees/:id

// Nóminas
GET    /payroll
POST   /payroll
GET    /payroll/:id
PUT    /payroll/:id
POST   /payroll/:id/process
POST   /payroll/:id/approve

// Tiempo Libre
GET    /time-off
POST   /time-off
GET    /time-off/:id
PUT    /time-off/:id
POST   /time-off/:id/approve
POST   /time-off/:id/reject
```

### 9. Projects (Especial para Arquitectura)
**Funcionalidad**: Gestión de proyectos arquitectónicos

**Componentes**:
- Project Portfolio (Portafolio de Proyectos)
- Project Timeline (Línea de Tiempo)
- Resource Allocation (Asignación de Recursos)
- Budget Tracking (Seguimiento de Presupuesto)
- Milestone Management (Hitos)
- Document Management (Gestión de Documentos)
- Client Collaboration (Colaboración con Clientes)
- Project Analytics

**Endpoints Backend**:
```typescript
// Proyectos
GET    /projects
POST   /projects
GET    /projects/:id
PUT    /projects/:id
DELETE /projects/:id
POST   /projects/:id/assign-members
GET    /projects/:id/timeline
GET    /projects/:id/budget

// Tareas
GET    /projects/:id/tasks
POST   /projects/:id/tasks
PUT    /tasks/:id
DELETE /tasks/:id
POST   /tasks/:id/complete

// Documentos
GET    /projects/:id/documents
POST   /projects/:id/documents
DELETE /documents/:id
```

### 10. Tools/Tools
**Funcionalidad**: Herramientas de productividad

**Componentes**:
- Support Tickets (Tickets de Soporte)
- Document Manager (Gestor de Documentos)
- Activity Tracker (Seguimiento de Actividades)
- Notifications Center
- Reports Generator
- System Settings

**Endpoints Backend**:
```typescript
// Tickets
GET    /tickets
POST   /tickets
GET    /tickets/:id
PUT    /tickets/:id
DELETE /tickets/:id

// Documentos
GET    /documents
POST   /documents
GET    /documents/:id
DELETE /documents/:id

// Actividades
GET    /activities
POST   /activities
GET    /activities/:id

// Notificaciones
GET    /notifications
PUT    /notifications/:id/read
DELETE /notifications/:id
```

## Módulos Específicos por Industria

### 11. Services (Limpieza, Mantenimiento, etc.)
**Funcionalidad**: Gestión de servicios programados

**Componentes**:
- Service Scheduling (programación de servicios)
- Technician Management (gestión de técnicos)
- Service Routes (rutas de servicio)
- Customer Locations (ubicaciones de clientes)
- Service Reports (reportes de servicios)
- Inventory Management (insumos y equipos)
- Billing per Service (facturación por servicio)

**Endpoints Backend**:
```typescript
// Servicios
GET    /services
POST   /services
GET    /services/:id
PUT    /services/:id
DELETE /services/:id
POST   /services/:id/complete

// Técnicos
GET    /technicians
POST   /technicians
GET    /technicians/:id/schedule
PUT    /technicians/:id/assign

// Rutas
GET    /service-routes
POST   /service-routes
GET    /service-routes/:id/optimize
```

### 12. Retail (Tiendas, POS)
**Funcionalidad**: Gestión de punto de venta y retail

**Componentes**:
- Point of Sale (POS)
- Product Catalog (catálogo de productos)
- Inventory Management (gestión de inventario)
- Customer Management (clientes y lealtad)
- Sales Analytics (análisis de ventas)
- Supplier Management (proveedores)
- Promotions and Discounts (promociones)

**Endpoints Backend**:
```typescript
// POS
GET    /pos/sales
POST   /pos/sales
GET    /pos/daily-summary
POST   /pos/cash-drawer/close

// Productos Retail
GET    /retail/products
POST   /retail/products
GET    /retail/products/barcode/:barcode
PUT    /retail/products/:id/stock

// Clientes
GET    /retail/customers
POST   /retail/customers/loyalty-points
GET    /retail/customers/:id/purchase-history
```

### 13. Restaurant (Restaurantes, Cafés)
**Funcionalidad**: Gestión de restaurantes

**Componentes**:
- Table Management (gestión de mesas)
- Menu Management (gestión de menú)
- Order Taking (toma de pedidos)
- Kitchen Display (cocina)
- Inventory & Recipes (inventario y recetas)
- Staff Scheduling (programación de personal)
- Customer Reservations (reservas)

**Endpoints Backend**:
```typescript
// Mesas
GET    /restaurant/tables
POST   /restaurant/tables
PUT    /restaurant/tables/:id/status
GET    /restaurant/tables/availability

// Pedidos
GET    /restaurant/orders
POST   /restaurant/orders
PUT    /restaurant/orders/:id/status
POST   /restaurant/orders/:id/send-to-kitchen

// Menú
GET    /restaurant/menu
POST   /restaurant/menu/items
PUT    /restaurant/menu/items/:id/availability
```

### 14. Healthcare (Salud)
**Funcionalidad**: Gestión de consultorios médicos

**Componentes**:
- Patient Management (gestión de pacientes)
- Appointment Scheduling (citas médicas)
- Medical Records (historial clínico)
- Billing & Insurance (facturación y seguros)
- Prescription Management (recetas médicas)
- Staff Management (personal médico)
- Lab Results (resultados de laboratorio)

**Endpoints Backend**:
```typescript
// Pacientes
GET    /healthcare/patients
POST   /healthcare/patients
GET    /healthcare/patients/:id/medical-history
PUT    /healthcare/patients/:id

// Citas
GET    /healthcare/appointments
POST   /healthcare/appointments
PUT    /healthcare/appointments/:id/confirm
POST   /healthcare/appointments/:id/cancel

// Facturación Médica
GET    /healthcare/billing
POST   /healthcare/billing/claims
GET    /healthcare/billing/insurance/:id
```

### 15. Education (Educación)
**Funcionalidad**: Gestión educativa

**Componentes**:
- Student Management (gestión de estudiantes)
- Course Management (gestión de cursos)
- Class Scheduling (programación de clases)
- Grade Management (gestión de calificaciones)
- Attendance Tracking (control de asistencia)
- Tuition & Billing (matrícula y facturación)
- Certificate Management (certificados)

**Endpoints Backend**:
```typescript
// Estudiantes
GET    /education/students
POST   /education/students
GET    /education/students/:id/grades
GET    /education/students/:id/attendance

// Cursos
GET    /education/courses
POST   /education/courses
GET    /education/courses/:id/enrollments
PUT    /education/courses/:id/schedule

// Matrícula
GET    /education/tuition
POST   /education/tuition/payments
GET    /education/tuition/student/:id/balance
```

## Schema Prisma Completo

El schema incluye 50+ modelos con relaciones completas para soportar toda la funcionalidad del ERP multi-tenancy:

### Modelos Core Multi-Tenancy
- **NovaHubTenant**: Configuración global NovaHub
- **Partner**: Partners/revendedores
- **ClientTenant**: Clientes finales
- **User**: Usuarios con RBAC jerárquico
- **Role**: Roles por nivel (NovaHub, Partner, Client)
- **SystemSetting**: Configuración por tenant
- **ModuleSubscription**: Módulos activos por cliente
- **BillingPlan**: Planes de facturación
- **Subscription**: Suscripciones activas

### Modelos de Ventas
- **Customer**: Directorio de clientes
- **Estimate**: Cotizaciones
- **SalesOrder**: Órdenes de venta
- **Invoice**: Facturas
- **RecurringInvoice**: Facturas recurrentes
- **PaymentReceived**: Pagos recibidos
- **SalesReturn**: Devoluciones
- **CreditNote**: Notas de crédito

### Modelos de Compras
- **Supplier**: Directorio de proveedores
- **PurchaseOrder**: Órdenes de compra
- **PurchaseReceipt**: Recepciones
- **SupplierInvoice**: Facturas de proveedor
- **RecurringSupplierInvoice**: Facturas recurrentes
- **PaymentMade**: Pagos realizados
- **SupplierCredit**: Créditos de proveedor

### Modelos Financieros
- **Account**: Plan de cuentas
- **Income**: Ingresos
- **Expense**: Gastos
- **RecurringExpense**: Gastos recurrentes
- **JournalEntry**: Asientos contables
- **Transaction**: Transacciones

### Modelos de Inventario
- **Product**: Catálogo de productos
- **Category**: Categorías
- **ProductVariant**: Variantes
- **Warehouse**: Almacenes
- **InventoryLevel**: Niveles de stock
- **InventoryMovement**: Movimientos

### Modelos de RRHH
- **Employee**: Empleados
- **Payroll**: Nóminas
- **PayrollItem**: Detalles de nómina
- **TimeOff**: Solicitudes de tiempo libre

### Modelos de Servicios
- **Service**: Servicios programados
- **Technician**: Técnicos
- **ServiceRoute**: Rutas de servicio
- **ServiceReport**: Reportes de servicio

### Modelos de Retail
- **POSSale**: Ventas POS
- **RetailProduct**: Productos retail
- **CustomerLoyalty**: Programa de lealtad
- **Promotion**: Promociones

### Modelos de Restaurant
- **Table**: Mesas
- **MenuItem**: Items de menú
- **RestaurantOrder**: Pedidos
- **Reservation**: Reservas

### Modelos de Salud
- **Patient**: Pacientes
- **Appointment**: Citas
- **MedicalRecord**: Historial médico
- **Prescription**: Recetas

### Modelos de Educación
- **Student**: Estudiantes
- **Course**: Cursos
- **Enrollment**: Matrículas
- **Grade**: Calificaciones

### Modelos de Herramientas
- **Activity**: Actividades y tareas
- **Ticket**: Tickets de soporte
- **Document**: Gestión de documentos
- **Notification**: Notificaciones
- **Transfer**: Transferencias de inventario

## Tabla Completa de Módulos y Endpoints

| Módulo | Funcionalidad Principal | Endpoints Backend | Modelo Prisma | Estado Actual |
|--------|-----------------------|-------------------|---------------|--------------|
| **Core/Auth** | Autenticación y usuarios | POST /auth/login<br>POST /auth/logout<br>GET /auth/profile<br>POST /users<br>GET /users<br>PUT /users/:id<br>DELETE /users/:id | User, Tenant | ✅ Implementado |
| **Configuración** | Personalización de colores y branding | GET /tenant/settings<br>PUT /tenant/settings<br>POST /tenant/logo<br>PUT /tenant/colors<br>GET /tenant/theme<br>PUT /tenant/theme | Tenant (logo, primaryColor) | ✅ Implementado |
| **Clientes** | Gestión de clientes | GET /customers<br>POST /customers<br>GET /customers/:id<br>PUT /customers/:id<br>DELETE /customers/:id | Customer | ✅ Implementado |
| **Ventas** | Ciclo completo de ventas | GET /sales<br>POST /sales<br>GET /estimates<br>POST /estimates<br>GET /invoices<br>POST /invoices<br>GET /payments-received<br>POST /payments-received | Estimate, Invoice, PaymentReceived | ✅ Implementado |
| **Compras** | Gestión de proveedores y compras | GET /suppliers<br>POST /suppliers<br>GET /purchase-orders<br>POST /purchase-orders<br>GET /supplier-invoices<br>POST /supplier-invoices | Supplier, PurchaseOrder, SupplierInvoice | ✅ Implementado |
| **Inventario** | Control de stock y productos | GET /products<br>POST /products<br>GET /inventory/levels<br>POST /inventory/adjust<br>GET /warehouses<br>POST /warehouses | Product, InventoryLevel, Warehouse | ✅ Implementado |
| **Finanzas** | Contabilidad y finanzas | GET /accounts<br>POST /accounts<br>GET /income<br>POST /income<br>GET /expenses<br>POST /expenses<br>GET /reports/balance-sheet | Account, Income, Expense | ✅ Implementado |
| **RRHH** | Gestión de empleados y nóminas | GET /employees<br>POST /employees<br>GET /payroll<br>POST /payroll<br>GET /time-off<br>POST /time-off | Employee, Payroll, TimeOff | ✅ Implementado |
| **Proyectos** | Gestión de proyectos (arquitectura) | GET /projects<br>POST /projects<br>GET /projects/:id/tasks<br>POST /projects/:id/tasks<br>GET /projects/:id/documents | Project, Task, Document | ✅ Implementado |
| **Actividades** | Seguimiento de tareas y actividades | GET /activities<br>POST /activities<br>GET /activities/:id<br>PUT /activities/:id<br>DELETE /activities/:id | Activity | ✅ Implementado |
| **Documentos** | Gestión de archivos | GET /documents<br>POST /documents<br>GET /documents/:id<br>DELETE /documents/:id | Document | ✅ Implementado |
| **Tickets** | Sistema de soporte técnico | GET /tickets<br>POST /tickets<br>GET /tickets/:id<br>PUT /tickets/:id<br>DELETE /tickets/:id | Ticket | ✅ Implementado |
| **Transferencias** | Movimientos de inventario | GET /transfers<br>POST /transfers<br>GET /transfers/:id<br>PUT /transfers/:id<br>DELETE /transfers/:id | Transfer, TransferItem | ✅ Implementado |
| **Notificaciones** | Centro de notificaciones | GET /notifications<br>PUT /notifications/:id/read<br>DELETE /notifications/:id<br>POST /notifications | Notification | ✅ Implementado |
| **Reportes** | Generación de reportes | GET /reports/sales<br>GET /reports/inventory<br>GET /reports/financial<br>GET /reports/hr<br>POST /reports/export | Report | ✅ Implementado |
| **Roles** | Gestión de roles y permisos | GET /roles<br>POST /roles<br>GET /roles/:id<br>PUT /roles/:id<br>DELETE /roles/:id | Role | ✅ Implementado |

## Dashboards por Rol

### NovaHub Super Admin Dashboard
| Componente | Funcionalidad | Endpoint |
|-------------|---------------|----------|
| Revenue Overview | Ingresos totales por partner | GET /admin/revenue/consolidated |
| Partner Performance | Ranking de partners por ingresos | GET /admin/analytics/by-partner |
| Industry Analytics | Distribución por tipo de industria | GET /admin/analytics/by-industry |
| Client Growth | Crecimiento de clientes globales | GET /admin/analytics/client-growth |
| System Health | Estado de servidores y performance | GET /admin/system/health |

### Partner Dashboard
| Componente | Funcionalidad | Endpoint |
|-------------|---------------|----------|
| Revenue by Client | Ingresos desglosados por cliente | GET /partner/revenue/dashboard |
| Client Portfolio | Estado de todos los clientes asignados | GET /partner/clients |
| Module Usage | Uso de módulos por cliente | GET /partner/analytics/module-usage |
| Billing Overview | Facturación pendiente y cobrada | GET /partner/billing/overview |

### Client Dashboard (Adaptable por Industria)
| Industria | Componentes Principales | Endpoints Específicos |
|-----------|-----------------------|---------------------|
| Arquitectura | Projects Pipeline, Budget Control, Resource Allocation | GET /projects<br>GET /projects/:id/budget<br>GET /projects/:id/resources |
| Retail | Daily Sales, Inventory Levels, Customer Analytics | GET /retail/sales<br>GET /retail/inventory<br>GET /retail/analytics |
| Restaurantes | Table Occupancy, Daily Revenue, Staff Performance | GET /restaurant/tables<br>GET /restaurant/revenue<br>GET /restaurant/staff |
| Servicios | Service Schedule, Technician Productivity, Route Optimization | GET /services/schedule<br>GET /services/technicians<br>GET /services/routes |
| Salud | Patient Appointments, Revenue by Service, Insurance Claims | GET /healthcare/appointments<br>GET /healthcare/revenue<br>GET /healthcare/claims |
| Educación | Student Enrollment, Course Completion, Tuition Collection | GET /education/enrollment<br>GET /education/courses<br>GET /education/tuition |

## Endpoints Específicos de Configuración

### Configuración de Tema y Colores
| Endpoint | Método | Descripción | Modelo Prisma |
|----------|--------|-------------|---------------|
| /tenant/settings | GET | Obtener configuración actual del tenant | Tenant |
| /tenant/settings | PUT | Actualizar configuración general | Tenant |
| /tenant/theme | GET | Obtener configuración de colores | Tenant |
| /tenant/theme | PUT | Actualizar colores del tema | Tenant |
| /tenant/logo | POST | Subir logo corporativo | Tenant |
| /tenant/branding | GET | Obtener branding completo | Tenant |

### Campos del Modelo Tenant para Configuración
```prisma
model Tenant {
  id              String    @id @default(uuid())
  name            String
  slug            String    @unique
  logo            String?   // URL del logo
  primaryColor    String?   // Color primario #10b981
  sidebarColor    String?   // Color sidebar
  accentColor     String?   // Color acento
  customCSS       String?   // CSS personalizado
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

## Módulos Adicionales por Implementar

| Módulo | Funcionalidad | Endpoints Requeridos | Estado |
|--------|---------------|---------------------|---------|
| **Services** | Gestión de servicios programados | GET /services<br>POST /services<br>GET /technicians<br>POST /technicians<br>GET /service-routes | 🔄 Pendiente |
| **Retail POS** | Punto de venta y tienda | GET /pos/sales<br>POST /pos/sales<br>GET /retail/products<br>GET /retail/customers | 🔄 Pendiente |
| **Restaurant** | Gestión de restaurante | GET /restaurant/tables<br>GET /restaurant/menu<br>POST /restaurant/orders | 🔄 Pendiente |
| **Healthcare** | Gestión médica | GET /healthcare/patients<br>GET /healthcare/appointments<br>POST /healthcare/billing | 🔄 Pendiente |
| **Education** | Gestión educativa | GET /education/students<br>GET /education/courses<br>GET /education/enrollment | 🔄 Pendiente |

## Módulos Multi-Tenancy Faltantes

| Módulo | Funcionalidad | Endpoints | Modelo Prisma | Prioridad |
|--------|---------------|-----------|---------------|-----------|
| **Admin NovaHub** | Gestión global de partners | GET /admin/partners<br>POST /admin/partners<br>GET /admin/all-clients<br>GET /admin/analytics<br>PUT /admin/partners/:id/suspend<br>GET /admin/revenue/consolidated | NovaHubTenant, Partner, ClientTenant | 🔴 Alta |
| **Partner Dashboard** | Gestión de cartera | GET /partner/clients<br>PUT /partner/clients/:id/modules<br>GET /partner/revenue/dashboard<br>GET /partner/analytics/module-usage<br>POST /partner/billing/invoices | Partner, ClientTenant, ModuleSubscription | 🔴 Alta |
| **Module Subscriptions** | Activación de módulos | GET /subscriptions<br>POST /subscriptions<br>PUT /subscriptions/:id<br>GET /billing/plans<br>POST /billing/plans<br>GET /billing/invoices | ModuleSubscription, BillingPlan, Subscription | 🟡 Media |

### Modelos Prisma Multi-Tenancy Adicionales

```prisma
// Multi-Tenancy Core
model NovaHubTenant {
  id            String    @id @default(uuid())
  name          String    // "NovaHub Admin"
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  partners      Partner[]
  systemSettings SystemSetting[]
}

model Partner {
  id            String    @id @default(uuid())
  novaHubTenantId String  @default("novahub-global")
  name          String
  email         String    @unique
  phone         String?
  commissionRate Decimal  @default(0.10) // 10%
  maxClients    Int       @default(100)
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  clients       ClientTenant[]
  subscriptions ModuleSubscription[]
  invoices      PartnerInvoice[]
}

model ClientTenant {
  id            String    @id @default(uuid())
  partnerId     String
  name          String
  industry      IndustryType @default(OTHER)
  plan          BillingPlanType @default(BASIC)
  isActive      Boolean   @default(true)
  expiresAt     DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  partner       Partner   @relation(fields: [partnerId], references: [id])
  users         User[]
  customers     Customer[]
  subscriptions ModuleSubscription[]
}

model ModuleSubscription {
  id            String    @id @default(uuid())
  clientTenantId String
  partnerId     String
  module        ModuleType
  isActive      Boolean   @default(true)
  subscribedAt  DateTime  @default(now())
  expiresAt     DateTime?
  
  clientTenant  ClientTenant @relation(fields: [clientTenantId], references: [id])
  partner       Partner     @relation(fields: [partnerId], references: [id])
}

model BillingPlan {
  id            String    @id @default(uuid())
  name          String
  type          BillingPlanType
  monthlyPrice   Decimal
  modules       ModuleType[]
  maxUsers      Int
  storageLimit  Int       // MB
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
}

// Enums
enum IndustryType {
  ARCHITECTURE
  MOBILE_PHONES
  COMPUTERS
  CLEANING
  SERVICES
  RETAIL
  RESTAURANT
  HEALTHCARE
  EDUCATION
  OTHER
}

enum ModuleType {
  SALES
  PURCHASES
  INVENTORY
  FINANCIAL
  HR
  PROJECTS
  SERVICES
  RETAIL_POS
  RESTAURANT
  HEALTHCARE
  EDUCATION
  TOOLS
}

enum BillingPlanType {
  BASIC
  PROFESSIONAL
  ENTERPRISE
  CUSTOM
}
```

## Sistema de Multi-Tenancy

### Aislamiento de Datos
- **Row Level Security (RLS)**: Cada tenant solo ve sus datos
- **Database Partitioning**: Partición por tenant para performance
- **API Gateway**: Enrutamiento por tenant
- **Cache Isolation**: Redis separado por tenant

### Configuración por Tenant
- **Industry Type**: Define módulos disponibles
- **Module Subscriptions**: Módulos activos/pagos
- **Custom Branding**: Logo y colores personalizados
- **Feature Flags**: Activación de funcionalidades específicas

### Escalabilidad
- **Horizontal Scaling**: Múltiples instancias por tenant
- **Resource Allocation**: CPU/Memory por plan contratado
- **Storage Limits**: Cuotas por tipo de plan
- **API Rate Limiting**: Límites por tenant

## Mejores Prácticas de Arquitectura

### Separación Frontend/Backend

**✅ Recomendado: Repositorios Separados**
```
novahub-frontend/     # React + Vite + TypeScript
novahub-backend/      # NestJS + Supabase + Prisma
```

**Ventajas:**
- Desarrollo paralelo por equipos especializados
- Deploy independiente (frontend en Vercel/Netlify, backend en Railway/Heroku)
- Versionado y CI/CD separados
- Escalabilidad independiente
- Stack tecnológico optimizado para cada capa

**Comunicación:**
- API RESTful con TypeScript
- DTOs tipados compartidos (paquete npm)
- Documentación automática con Swagger
- Environment variables por entorno

### Estructura Backend Recomendada (NestJS)

```
src/
├── common/           # Decoradores, guards, interceptors
├── config/           # Configuración de módulos
├── database/         # Migraciones y seeds
├── modules/
│   ├── auth/          # Autenticación y JWT
│   ├── users/         # Gestión de usuarios
│   ├── tenants/       # Multi-tenancy
│   ├── partners/      # Gestión de partners
│   ├── admin/         # Dashboard NovaHub
│   ├── sales/         # Módulo de ventas
│   ├── purchases/     # Módulo de compras
│   ├── inventory/     # Módulo de inventario
│   ├── financial/     # Módulo financiero
│   ├── hr/           # Recursos humanos
│   ├── projects/      # Gestión de proyectos
│   ├── services/      # Servicios programados
│   ├── retail/        # POS y retail
│   ├── restaurant/    # Gestión restaurant
│   ├── healthcare/    # Gestión salud
│   ├── education/     # Gestión educación
│   └── tools/         # Herramientas generales
├── shared/           # DTOs, entidades, interfaces
└── main.ts
```

### Guards y Middleware Multi-Tenancy

```typescript
// tenant.guard.ts
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.headers['x-tenant-id'];
    const user = request.user;
    
    // Validar acceso al tenant
    return user.tenantId === tenantId || user.role === 'NOVAHUB_ADMIN';
  }
}

// role.guard.ts
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    const user = context.switchToHttp().getRequest().user;
    
    return requiredRoles.includes(user.role);
  }
}
```

## Endpoints Backend (NestJS)

### Estructura del Proyecto Backend
```
src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── sales/
│   ├── purchases/
│   ├── financial/
│   ├── inventory/
│   ├── hr/
│   ├── projects/
│   └── tools/
├── common/
├── config/
└── database/
```

### Controllers Principales

Cada módulo tiene su controller con endpoints RESTful:

```typescript
// Ejemplo: sales/customers.controller.ts
@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  @Get()
  findAll(@Query() query: QueryCustomersDto) { }

  @Post()
  create(@Body() createCustomerDto: CreateCustomerDto) { }

  @Get(':id')
  findOne(@Param('id') id: string) { }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto) { }

  @Delete(':id')
  remove(@Param('id') id: string) { }
}
```

### Middleware y Guards

- **JwtAuthGuard**: Protección de rutas
- **RolesGuard**: Control de acceso por rol
- **TenantGuard**: Aislamiento de datos por tenant
- **AuditInterceptor**: Auditoría de cambios

### Validaciones

Usando class-validator para DTOs:
```typescript
export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;
}
```

## Configuración de Supabase

### Database Setup
- PostgreSQL como motor principal
- Row Level Security (RLS) para multi-tenancy
- Índices optimizados para consultas frecuentes
- Backups automáticos

### Autenticación
- JWT tokens con refresh
- Proveedores: email/password, Google, Microsoft
- Políticas de contraseña seguras

### Storage
- Bucket para documentos y archivos
- Políticas de acceso por tenant
- CDN para assets estáticos

## Testing y QA

### Frontend Testing
- Unit tests con Jest + React Testing Library
- E2E tests con Playwright
- Visual testing con Chromatic

### Backend Testing
- Unit tests con Jest
- Integration tests con Supertest
- API documentation con Swagger

### Test Data
- Seeds para desarrollo
- Fixtures para testing
- Data factories con Prisma

## Deployment

### Frontend (Vercel/Netlify)
- Build optimizado
- Environment variables
- CI/CD con GitHub Actions

### Backend (Railway/Heroku)
- Docker container
- Environment management
- Health checks

### Database (Supabase)
- Migrations automáticas
- Backup strategy
- Monitoring

## Seguridad

### Frontend
- Sanitización de inputs
- CSRF protection
- XSS prevention
- Secure headers

### Backend
- Input validation
- SQL injection prevention
- Rate limiting
- Audit logs

## Performance

### Frontend Optimizations
- Code splitting por ruta
- Lazy loading de componentes
- Memoization con React.memo
- Virtual scrolling para tablas grandes

### Backend Optimizations
- Database indexing
- Query optimization
- Caching con Redis
- Pagination y filtering

## Internacionalización

### Multi-language Support
- i18n con react-i18next
- Traducciones por módulo
- Formatos de fecha/moneda localizados
- Soporte RTL

## Accesibilidad

### WCAG 2.1 AA
- Semántica HTML5
- ARIA labels
- Keyboard navigation
- Screen reader support
- Color contrast compliance

## Analytics y Monitoring

### Frontend Analytics
- Google Analytics 4
- User behavior tracking
- Performance metrics
- Error tracking

### Backend Monitoring
- Application logs
- Performance metrics
- Error tracking
- Uptime monitoring

## Escalabilidad

### Horizontal Scaling
- Stateless backend
- Load balancing
- Database replication
- CDN integration

### Vertical Scaling
- Resource optimization
- Memory management
- CPU optimization
- Storage scaling

Esta especificación proporciona una base completa para implementar un ERP 100% funcional adaptable a cualquier negocio, con especialización en estudios de arquitectura.