# Free Trial 3 Días — Self-Service Onboarding

> **Para Hermes:** Plan ejecutable tarea por tarea con subagent-driven-development.

**Goal:** Un visitante puede registrarse desde una landing pública, crear su empresa, y obtener 3 días de acceso completo a un set curado de módulos para evaluar el ERP — estilo Zoho.

**Architecture:** Self-service con endpoint `POST /auth/register-tenant` que crea en una transacción: `NovaHubTenant` (huérfano, sin partner) → `ClientTenant` con `expiresAt = now+3d` → `User` admin → `Role` admin con permisos full → `ModuleSubscription[]` pre-activos para el set del trial. Después del trial: login normal; un guard/middleware bloquea acciones de escritura si `expiresAt < now`.

**Tech Stack:** NestJS + Prisma + PostgreSQL (backend), React + Vite + React Hook Form + Zod (frontend), JWT ya existente, bcrypt ya existente.

---

## Parte A — Asesoramiento: ¿qué módulos incluir en el trial?

### Mi recomendación para un ERP como NovaHub

Analicé tu `ModuleType` enum (líneas 2067-2184 del schema) y tu `INVENTORY_SECTIONS` real del front. Mi propuesta es **"Starter Trial" — 4 módulos padre + 13 submódulos clave** que cubren el 80% de lo que un dueño de PyME necesita ver para decidir si paga:

| Módulo Padre | Submódulos incluidos | Por qué |
|---|---|---|
| **INVENTORY** | `INVENTORY_PRODUCTS`, `INVENTORY_WAREHOUSES`, `INVENTORY_MOVEMENTS`, `INVENTORY_TRANSFERS` | Es el corazón del ERP; lo más visual e impactante |
| **SALES** | `SALES_CLIENTS`, `SALES_QUOTES`, `SALES_ORDERS`, `SALES_INVOICES` | El usuario ve el ciclo comercial completo: cliente → cotización → orden → factura |
| **PURCHASES** | `PURCHASES_PROVIDERS`, `PURCHASES_ORDERS`, `PURCHASES_INVOICES` | Cierra el ciclo: compras alimentan inventario |
| **REPORTS** | `REPORTS_SALES`, `REPORTS_INVENTORY`, `REPORTS_FINANCIAL` | El "wow effect" final — dashboard con datos reales que ellos acaban de meter |
| (implícito) | `CONFIG_COMPANY`, `CONFIG_USERS` | Necesarios para que la empresa pueda editar su info y agregar al equipo |

**Lo que NO incluyo en el trial** (escala de monetización):
- `FINANCIAL` (contabilidad) — el más caro de implementar, dejalo para PRO
- `HR` — vertical específico
- `PROJECTS` — vertical específico
- `CONFIG_BRANDING` / `CONFIG_ROLES` / `CONFIG_PLATFORM` — administrativos, no aportan "wow"
- Módulos verticales: `RESTAURANT`, `HEALTHCARE`, `EDUCATION`, `RETAIL_POS`, `TWILIO`, `SUPPORT_TECH` — son add-ons

### Plantilla final `TRIAL_MODULES` (constante en backend)

```typescript
export const TRIAL_MODULES: ModuleType[] = [
  // Inventario
  ModuleType.INVENTORY,
  ModuleType.INVENTORY_PRODUCTS,
  ModuleType.INVENTORY_WAREHOUSES,
  ModuleType.INVENTORY_MOVEMENTS,
  ModuleType.INVENTORY_TRANSFERS,
  // Ventas
  ModuleType.SALES,
  ModuleType.SALES_CLIENTS,
  ModuleType.SALES_QUOTES,
  ModuleType.SALES_ORDERS,
  ModuleType.SALES_INVOICES,
  // Compras
  ModuleType.PURCHASES,
  ModuleType.PURCHASES_PROVIDERS,
  ModuleType.PURCHASES_ORDERS,
  ModuleType.PURCHASES_INVOICES,
  // Reportes
  ModuleType.REPORTS,
  ModuleType.REPORTS_SALES,
  ModuleType.REPORTS_INVENTORY,
  ModuleType.REPORTS_FINANCIAL,
  // Config mínima
  ModuleType.CONFIG_COMPANY,
  ModuleType.CONFIG_USERS,
];
// Total: 19 valores ModuleType, 4 módulos padre visibles en el sidebar
```

### Restricciones del trial (lo que limita la conversión a pago)

- **3 días corridos** desde `createdAt` del `ClientTenant`
- **1 usuario** (el admin que se registró) — no puede invitar más hasta pagar
- **Sin uploads** de logo / branding (campo `whiteLabel` queda `false`)
- **Sin backups** ni export masivo
- **Banner persistente** en el Topbar con countdown: "Te quedan X días de prueba"
- **Al vencer**: `isActive = false`; el login sigue funcionando pero el guard bloquea escrituras y muestra página de upgrade

---

## Parte B — Plan de implementación

### Pre-requisitos verificados
- ✅ NestJS + Prisma + JWT funcionando
- ✅ `ModuleSubscription` model existe
- ✅ `ClientTenant` tiene campo `expiresAt`
- ✅ Enum `ModuleType` tiene los valores necesarios
- ⚠️ No existe `POST /auth/register-tenant` — hay que crearlo
- ⚠️ No existe guard de "trial expirado" — hay que crearlo

### Archivos a tocar

**Backend (NestJS):**
- `prisma/schema.prisma` — agregar campo `trialBannerDismissed` opcional a `ClientTenant`
- `src/auth/dto/register-tenant.dto.ts` — **CREAR** DTO
- `src/auth/auth.service.ts` — agregar método `registerTenant(dto)` con transacción Prisma
- `src/auth/auth.controller.ts` — agregar endpoint `POST /auth/register-tenant`
- `src/common/constants/trial.constants.ts` — **CREAR** constante `TRIAL_MODULES` y `TRIAL_DURATION_DAYS = 3`
- `src/common/guards/trial-active.guard.ts` — **CREAR** guard que bloquea mutaciones si `expiresAt < now`
- `src/common/decorators/is-trial.decorator.ts` — **CREAR** decorator `@RequireActiveTrial()`
- `src/auth/auth.service.spec.ts` — agregar tests para `registerTenant`
- `src/common/guards/trial-active.guard.spec.ts` — **CREAR** tests del guard

**Frontend (React):**
- `src/app/components/auth/RegisterTenantPage.tsx` — **CREAR** página de registro
- `src/app/components/auth/TrialCountdownBanner.tsx` — **CREAR** banner con countdown
- `src/app/components/auth/TrialExpiredPage.tsx` — **CREAR** página cuando expira
- `src/app/services/auth.service.ts` — agregar método `registerTenant(dto)`
- `src/app/contexts/AuthContext.tsx` — agregar `trialDaysRemaining` al estado
- `src/app/components/Topbar.tsx` — integrar `TrialCountdownBanner`
- `src/app/App.tsx` — agregar ruta `/register` y `?expired=true`

### Orden de tareas (bite-sized, 2-5 min cada una)

#### FASE 1 — Backend: schema y constante

**Task 1: Agregar `trialBannerDismissedAt` a ClientTenant**
- File: `prisma/schema.prisma` (línea ~67, junto a `whiteLabel`)
- Add: `trialBannerDismissedAt DateTime?`
- Verify: `npx prisma format` y `npx prisma generate` exit 0

**Task 2: Crear constante de módulos del trial**
- Create: `src/common/constants/trial.constants.ts`
- Content: el array `TRIAL_MODULES` de la sección de asesoramiento + `TRIAL_DURATION_DAYS = 3`
- Test: crear `src/common/constants/trial.constants.spec.ts` que verifica que el array no está vacío, todos los valores son válidos `ModuleType`, y `TRIAL_DURATION_DAYS === 3`

**Task 3: Crear DTO de registro**
- Create: `src/auth/dto/register-tenant.dto.ts`
- Campos: `companyName: string @IsString @MinLength(2) @MaxLength(100)`, `userName: string @IsString @MinLength(2)`, `email: string @IsEmail`, `password: string @MinLength(8) @Matches(/[A-Z]/) @Matches(/[0-9]/)`
- Test: `register-tenant.dto.spec.ts` con casos válidos e inválidos

#### FASE 2 — Backend: servicio de registro

**Task 4: Crear helper para crear NovaHubTenant huérfano (sin partner)**
- En `src/auth/auth.service.ts`, agregar método privado `createOrphanNovaHubTenant(tx)` que crea una `NovaHubTenant` con `name = companyName`
- Test: integrar en el test de Task 5

**Task 5: Implementar `registerTenant` con transacción Prisma**
- En `src/auth/auth.service.ts`, agregar método público:
```typescript
async registerTenant(dto: RegisterTenantDto) {
  const passwordHash = await bcrypt.hash(dto.password, 12);
  const expiresAt = new Date(Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
  
  return this.prisma.$transaction(async (tx) => {
    // 1. NovaHubTenant huérfano
    const novaHubTenant = await tx.novaHubTenant.create({
      data: { name: dto.companyName, isActive: true },
    });
    
    // 2. ClientTenant vinculado
    // ⚠️ partnerId es NOT NULL en el schema actual — hay que hacerlo opcional
    const clientTenant = await tx.clientTenant.create({
      data: {
        name: dto.companyName,
        slug: slugify(dto.companyName) + '-' + nanoid(6),
        partnerId: null, // ⚠️ requiere hacer partnerId nullable
        plan: BillingPlanType.BASIC,
        expiresAt,
        activatedAt: new Date(),
        implementationStatus: 'TRIAL',
        baseUserQuota: 1, // trial = 1 usuario
      },
    });
    
    // 3. Role admin
    const role = await tx.role.create({
      data: {
        name: 'Administrador',
        clientTenantId: clientTenant.id,
        isAdmin: true,
        allowedModules: TRIAL_MODULES as any,
      },
    });
    
    // 4. User admin
    const user = await tx.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.userName,
        role: SystemRole.ADMIN,
        customRoleId: role.id,
        clientTenantId: clientTenant.id,
      },
    });
    
    // 5. ModuleSubscriptions (batch)
    await tx.moduleSubscription.createMany({
      data: TRIAL_MODULES.map((module) => ({
        clientTenantId: clientTenant.id,
        module,
        isActive: true,
        price: 0,
        partnerId: null,
      })),
    });
    
    return { user, clientTenant, expiresAt };
  });
}
```

**Task 6: Hacer `partnerId` nullable en ClientTenant**
- File: `prisma/schema.prisma` línea 45
- Change: `partnerId String` → `partnerId String?`
- Esto requiere migración
- Verify: `npx prisma migrate dev --name make_partner_optional` exit 0

**Task 7: Tests del servicio `registerTenant`**
- File: `src/auth/auth.service.spec.ts`
- Tests: 
  - Crea tenant con todos los módulos
  - Rechaza email duplicado
  - Rechaza companyName < 2 chars
  - Hash de password (no se guarda plano)
  - `expiresAt` es exactamente `now + 3 días` (con tolerancia de 1 segundo)

**Task 8: Agregar endpoint en controller**
- File: `src/auth/auth.controller.ts`
- Add: 
```typescript
@Post('register-tenant')
@HttpCode(201)
@ApiOperation({ summary: 'Registro self-service de empresa trial (3 días)' })
async registerTenant(@Body() dto: RegisterTenantDto) {
  const result = await this.authService.registerTenant(dto);
  // Auto-login: devolver el JWT igual que /login
  return this.authService.login(result.user);
}
```

#### FASE 3 — Backend: guard de trial expirado

**Task 9: Crear decorator `@RequireActiveTrial()`**
- Create: `src/common/decorators/require-active-trial.decorator.ts`
- Metadata key: `'requireActiveTrial'`

**Task 10: Crear `TrialActiveGuard`**
- Create: `src/common/guards/trial-active.guard.ts`
- Lógica: lee `req.user.clientTenantId`, busca el `ClientTenant`, si `expiresAt && expiresAt < new Date()` y el método HTTP es POST/PATCH/PUT/DELETE → lanza `ForbiddenException('Tu período de prueba ha terminado. Actualiza tu plan para continuar.')`
- Test: `trial-active.guard.spec.ts` con casos:
  - GET pasa siempre
  - POST con trial activo pasa
  - POST con trial expirado lanza 403
  - POST sin `expiresAt` (tenant pago) pasa

**Task 11: Aplicar guard a endpoints de mutación críticos**
- Files: `inventory.controller.ts`, `sales.controller.ts`, `purchases.controller.ts` (todos los `@Post`, `@Patch`, `@Delete`)
- Pattern: agregar `@UseGuards(JwtAuthGuard, PermissionsGuard, TrialActiveGuard)` y `@RequireActiveTrial()` al método
- **CUIDADO**: NO aplicar a `@Get` (lectura sigue permitida para que el usuario vea sus datos antes de pagar)

#### FASE 4 — Frontend: página de registro

**Task 12: Agregar método `registerTenant` al auth service**
- File: `src/app/services/auth.service.ts`
- Add: `registerTenant: (dto: RegisterTenantDto) => api.post<AuthResponse>('/auth/register-tenant', dto)`

**Task 13: Crear tipos y validaciones Zod**
- Create: `src/app/components/auth/schemas.ts`
- Content: schema Zod para `RegisterTenantForm`

**Task 14: Crear página de registro**
- Create: `src/app/components/auth/RegisterTenantPage.tsx`
- Componentes: layout split-screen (izquierda: branding + beneficios del trial; derecha: formulario con 4 campos + checkbox de ToS + botón "Comenzar prueba gratis")
- Usar `react-hook-form` + `@hookform/resolvers/zod`
- On success: guardar token en localStorage (`nh-auth-token`), navegar a `/dashboard`
- Manejar errores: 409 email duplicado → "Este email ya está registrado, ¿iniciar sesión?"

**Task 15: Integrar ruta `/register` en App.tsx**
- File: `src/app/App.tsx`
- Add: si pathname es `/register`, renderizar `RegisterTenantPage` sin pasar por guards
- El `LoginPage` debe tener link "¿No tenés cuenta? Probalo gratis"

#### FASE 5 — Frontend: UI de trial activo

**Task 16: Calcular `trialDaysRemaining` en AuthContext**
- File: `src/app/contexts/AuthContext.tsx`
- Add: derivado de `clientTenant.expiresAt`
- Selector: `useAuth()` expone `trialDaysRemaining: number | null` (null si no es trial)

**Task 17: Crear `TrialCountdownBanner`**
- Create: `src/app/components/auth/TrialCountdownBanner.tsx`
- Visual: barra fija en el Topbar con gradiente emerald→amber, icono de reloj, texto "Te quedan X días y Y horas de prueba. [Actualizar plan]"
- Auto-refresh cada 60 segundos con `setInterval`
- Dismiss: botón X guarda `trialBannerDismissedAt` en `ClientTenant` vía nuevo endpoint `PATCH /tenants/dismiss-trial-banner` (agregar en `tenants.controller.ts`)

**Task 18: Integrar banner en Topbar**
- File: `src/app/components/Topbar.tsx`
- Renderizar `<TrialCountdownBanner />` solo si `trialDaysRemaining !== null && trialDaysRemaining <= 3`

**Task 19: Crear `TrialExpiredPage`**
- Create: `src/app/components/auth/TrialExpiredPage.tsx`
- Visual: pantalla completa con beneficios de los planes pagos + CTA "Actualizar plan" + "Contactar ventas"
- Se muestra cuando: `user.clientTenant.expiresAt < new Date()` y se intenta hacer una mutación
- Implementar vía interceptor Axios: en `src/app/services/api.ts`, en `interceptors.response`, si llega 403 con código `TRIAL_EXPIRED` → redirigir a `/?expired=true` y mostrar `TrialExpiredPage` overlay

#### FASE 6 — Verificación end-to-end

**Task 20: Script de prueba manual**
- Crear checklist en `docs/trial-test-checklist.md`:
  1. Ir a `/register` → completar form → verificar redirect a dashboard
  2. Verificar que sidebar muestra solo los 4 módulos del trial
  3. Crear un producto, un cliente, una factura → verificar que se guarda
  4. Verificar banner con countdown correcto
  5. En DB, forzar `expiresAt = now - 1s`
  6. Re-login → intentar crear producto → debe dar error 403
  7. Verificar que `TrialExpiredPage` se muestra

**Task 21: Documentación en README**
- File: `README.md`
- Add: sección "Free Trial" con flujo, módulos incluidos, restricciones, cómo se renueva

---

## Riesgos, tradeoffs y preguntas abiertas

### Riesgos identificados

1. **`partnerId` nullable** — Cambio de schema con impacto en TODOS los `where: { partnerId }` del código. Hay que auditar con `grep "partnerId"` en el backend y verificar que los `null` se manejen bien (ej. `tenants.service.ts`).
2. **Empresas trial "huérfanas"** — sin partner asignado, el Partner Admin no las ve en su panel. Decisión de producto: ¿querés un partner "TRIAL_DEFAULT" que agrupe estos tenants, o dejarlos sin partner y que el partner se asigne al convertir a pago?
3. **Email de bienvenida** — hoy no hay servicio de email. ¿Mandamos uno al registrarse? Si no, el usuario no tiene cómo recuperar password (porque tampoco hay flujo de "forgot password"). Recomiendo agregar **después** del MVP.
4. **Verificación de email** — sin verificación, alguien puede registrar empresas con emails ajenos. **Recomiendo** en MVP no pedir verificación (estilo Zoho) y agregar captcha en un futuro.
5. **Migración de datos existentes** — los `ClientTenant` actuales tienen `partnerId` NOT NULL. La migración a nullable es segura (no pierde datos), pero hay que verificar que no haya tests que asuman NOT NULL.
6. **Slug colisión** — `slugify(nombre) + nanoid(6)` puede no ser único. La constraint `@@unique` en el schema lo va a hacer fallar con 500. Recomiendo un loop con retry (3 intentos).

### Decisiones que necesito que confirmes

| # | Decisión | Mi sugerencia |
|---|---|---|
| 1 | Partner para tenants trial | Partner "TRIAL_DEFAULT" auto-creado |
| 2 | Email de bienvenida | No en MVP, agregar después |
| 3 | Verificación de email | No en MVP |
| 4 | Captcha | No en MVP |
| 5 | Al expirar, ¿puede ver datos o se borran? | Solo lectura, datos intactos |
| 6 | ¿Puede extender el trial? | No, único. Al pagar pasa a plan activo |

### Tradeoffs del enfoque

- **Pro:** Self-service puro = máxima conversión. El usuario no espera a un humano.
- **Pro:** Aprovechamos `expiresAt` que ya existe en `ClientTenant` (cero migración destructiva).
- **Pro:** El set fijo de módulos está alineado con el "wow effect" — Ventas + Inventario + Compras es el flujo natural que un dueño quiere ver.
- **Con:** Hacer `partnerId` nullable abre la puerta a errores de "partner null" en otros lados.
- **Con:** 3 días es corto — algunos usuarios no llegan a probar todo. Alternativa: 7 días trial, 14 días trial. **Recomiendo mantener 3 días como pediste**, pero con el banner agresivo desde el día 1.

---

## Verificación final (smoke test)

```bash
# 1. Backend
cd BackendERPNH
npx prisma migrate dev --name make_partner_optional
npx prisma generate
npm run build
npm run test -- --testPathPattern=trial
npm run test -- --testPathPattern=register

# 2. Frontend
cd ../novahub-frontend
npm run build
# Verificar que TS compila sin errores

# 3. Manual
# - Levantar backend + frontend
# - Ir a http://localhost:5173/register
# - Llenar form con email no existente
# - Verificar redirect a dashboard
# - Verificar banner "Te quedan 3 días"
# - Intentar crear producto, cliente, factura → OK
# - Forzar expiresAt en DB a fecha pasada
# - Reintentar creación → debe dar 403 con TRIAL_EXPIRED
```

---

## Resumen ejecutivo

- **19 valores de ModuleType** pre-activados (4 módulos padre + submódulos clave)
- **1 endpoint nuevo** (`POST /auth/register-tenant`)
- **1 guard nuevo** (`TrialActiveGuard`)
- **2 cambios de schema** (partnerId nullable, trialBannerDismissedAt)
- **6 archivos frontend nuevos** (registro, banner, página expirado)
- **3 archivos backend nuevos** (DTO, guard, constante)
- **Tiempo estimado de implementación**: 4-6 horas con subagentes
