# Matriz de cobertura E2E Dual Full-Stack

La matriz distingue una prueba de negocio completa de una prueba de superficie.
Una entrada `superficie` confirma navegación, responsive, autorización, probe
HTTP y ausencia de 5xx/404; no afirma que cada mutación del módulo tenga una
aserción de persistencia.

`Dual profunda` identifica un flujo implementado con UI, red y aserciones
Prisma. La evidencia runtime de esos flujos queda `no ejecutada` mientras no
se configure `DATABASE_URL_E2E`; no se considera reemplazada por el build o el
typecheck.

| Superficie | Cobertura actual | Persistencia/invariantes comprobados |
|---|---|---|
| Ventas | Dual profunda | tenant, bodega, estados, idempotencia, Kardex, asiento balanceado, rollback |
| Compras | Dual profunda | tenant, sucursal/bodega, recepción, Kardex, asiento balanceado |
| Inventario | Dual profunda | tenant, stock inicial exacto, bodega, Kardex, no negativo |
| Tracking | Dual profunda | tenant, estados, historial de eventos |
| Actividades | Dual profunda | tenant, estado, evidencia, alcance del actor |
| Restaurante | Dual profunda | tenant, sucursal, comanda, cocina, transiciones |
| Proyectos | Dual profunda | tenant, sucursal, estado, planificación, costos, idempotencia por fuente |
| Asesoría legal | Dual profunda | tenant, caso, notas, documentos, mensajes, recordatorios |
| Tickets | Dual profunda | tenant, creador, comentarios, auditoría, estados |
| NovaChat | Dual profunda | tenant, conversación, mensajes, estado |
| Financiamiento PYME | Dual parcial | tenant, expediente, documento, nota, estado y prefill cruzado |
| Dashboard | Superficie UI/API | sesión/tenant |
| Finanzas | Dual profunda | ingreso persistido, cuenta vinculada, validación 4xx, tenant y responsive |
| Recursos Humanos | Dual profunda | catálogos HR, empleado persistido, estructura laboral, validación 4xx, tenant y responsive |
| Clientes | Dual profunda | creación UI, persistencia, estado activo, validación 4xx y aislamiento tenant |
| Proveedores | Dual profunda | creación UI, persistencia, RUC/email, validación 4xx y aislamiento tenant |
| Fuerza Comercial | Superficie UI/API de plataforma | rol de plataforma, asignación de actor y catálogo global |
| Documentos | Dual profunda | archivo persistido, ownership tenant, validación 4xx y mutación visual de contratos |
| Notificaciones | Dual profunda | alerta personal persistida, destinatario, validación 4xx y aislamiento tenant |
| Transferencias | Dual profunda | tenant, solicitud pendiente, saldo origen/destino, Kardex, no negativo, asiento balanceado, repetición segura y rollback 4xx |
| Reportes | Superficie UI/API | tenant/sucursal/consistencia de lectura |
| Configuración | Dual profunda | tema privado por usuario, tenant y tokens de tema |
| Suscripciones | Superficie UI/API | tenant, entitlement e historial |
| Administración de tenants | Superficie UI/API | rol de plataforma y límite de tenant |
| Esquema Prisma | Superficie UI protegida de plataforma | rol de plataforma |
| Centro de capacitación | Superficie UI/API | tenant o contenido público según contrato |
| Soporte técnico | Dual profunda | ticket creado desde UI, actor, estado, validación 4xx y aislamiento tenant |
| Contabilidad | Dual profunda | cuenta creada desde UI, tenant, catálogo, validación duplicada, aislamiento y responsive |
| QA Console | Superficie UI/API | rol de plataforma e historial |
| Guía de implementación | Superficie UI protegida de plataforma | rol de plataforma |

## Escenarios transversales

El catálogo de contratos exige para cada superficie: happy path, validación 4xx,
permiso denegado, módulo deshabilitado, cruce de tenant, alcance de sucursal o
bodega, repetición idempotente, rollback transaccional y teardown. Cuando una
operación real aún no expone `IdempotencyService`, el contrato queda marcado
`PENDIENTE`; la cabecera enviada por el frontend no se considera garantía.

La ejecución runtime de los casos que escriben datos requiere una base
PostgreSQL exclusiva identificada por `DATABASE_URL_E2E`. Sin esa variable y
las dos banderas de seguridad, el backend E2E se detiene antes de migrar,
registrar tenants o truncar tablas.
