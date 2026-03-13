-- ============================================================
-- DIAGNÓSTICO: Por qué Gerente Demo no ve módulo HR
-- ============================================================

-- 1. Buscar usuario "cliente@demo.com"
SELECT 
  id, 
  email, 
  name, 
  role, 
  "clientTenantId",
  "isActive"
FROM "User"
WHERE email LIKE '%demo%'
ORDER BY email;

-- 2. Ver tenant de ese usuario
SELECT 
  ct.id,
  ct.name,
  ct.slug,
  ct.plan,
  ct."partnerId",
  ct."isActive"
FROM "ClientTenant" ct
WHERE ct.id IN (
  SELECT "clientTenantId" FROM "User" WHERE email LIKE '%demo%'
);

-- 3. Ver módulos suscritos para ese tenant
SELECT 
  ms.id,
  ms."clientTenantId",
  ms.module,
  ms."isActive",
  ms.price,
  ms."createdAt",
  ct.name as tenant_name
FROM "ModuleSubscription" ms
JOIN "ClientTenant" ct ON ct.id = ms."clientTenantId"
WHERE ms."clientTenantId" IN (
  SELECT "clientTenantId" FROM "User" WHERE email LIKE '%demo%'
)
ORDER BY ms."createdAt" DESC;

-- 4. Ver solicitudes de suscripción pendientes/aprobadas
SELECT 
  sr.id,
  sr."requestedModule",
  sr.status,
  sr."createdAt",
  ct.name as tenant_name
FROM "SubscriptionRequest" sr
JOIN "ClientTenant" ct ON ct.id = sr."clientTenantId"
WHERE sr."clientTenantId" IN (
  SELECT "clientTenantId" FROM "User" WHERE email LIKE '%demo%'
)
ORDER BY sr."createdAt" DESC;

-- 5. SOLUCIÓN: Habilitar HR manualmente si no existe
-- Ejecutar esto si HR no está en ModuleSubscription:
/*
INSERT INTO "ModuleSubscription" (
  id,
  "clientTenantId",
  "partnerId",
  module,
  price,
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT 
  gen_random_uuid(),
  u."clientTenantId",
  ct."partnerId",
  'HR',
  0,
  true,
  NOW(),
  NOW()
FROM "User" u
JOIN "ClientTenant" ct ON ct.id = u."clientTenantId"
WHERE u.email LIKE '%cliente@demo.com%'
  AND NOT EXISTS (
    SELECT 1 FROM "ModuleSubscription" 
    WHERE "clientTenantId" = u."clientTenantId" 
    AND module = 'HR'
  );
*/

-- 6. Verificar todos los módulos habilitados
SELECT 
  ct.name as tenant,
  ct.slug,
  array_agg(ms.module ORDER BY ms.module) as modulos_habilitados
FROM "ClientTenant" ct
LEFT JOIN "ModuleSubscription" ms ON ms."clientTenantId" = ct.id AND ms."isActive" = true
WHERE ct.slug LIKE '%demo%'
GROUP BY ct.id, ct.name, ct.slug;
