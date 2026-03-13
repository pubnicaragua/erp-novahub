import { PrismaClient, ModuleType, ApprovalStatus } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function runTest() {
  console.log('🚀 Iniciando Prueba de Integración: Multitenancia y Módulos');

  try {
    // 1. Limpieza y Preparación (Opcional, usando IDs conocidos)
    const partnerId = 'partner-demo-001';
    const clientTenantId = 'client-demo-001';

    console.log('--- PASO 1: Partner solicita un módulo (SALES) ---');
    const request = await prisma.subscriptionRequest.create({
      data: {
        partnerId,
        clientTenantId,
        requestedModule: ModuleType.SALES,
        customPrice: 45.50,
        notes: 'Precio especial para cliente fiel',
        status: ApprovalStatus.PENDING
      }
    });
    console.log(`✅ Solicitud creada ID: ${request.id}`);

    console.log('\n--- PASO 2: Super Admin aprueba la solicitud ---');
    const updatedRequest = await prisma.subscriptionRequest.update({
      where: { id: request.id },
      data: { status: ApprovalStatus.APPROVED }
    });
    
    // Simular lógica del servicio (Upsert ModuleSubscription)
    await prisma.moduleSubscription.upsert({
      where: {
        clientTenantId_module: {
          clientTenantId,
          module: ModuleType.SALES,
        },
      },
      create: {
        clientTenantId,
        partnerId,
        module: ModuleType.SALES,
        price: 45.50,
        isActive: true,
      },
      update: {
        price: 45.50,
        isActive: true,
      },
    });
    console.log('✅ Solicitud aprobada y suscripción activada.');

    console.log('\n--- PASO 3: Verificación de acceso para el cliente ---');
    const activeSubs = await prisma.moduleSubscription.findMany({
      where: { clientTenantId, isActive: true }
    });
    const hasSales = activeSubs.some(s => s.module === ModuleType.SALES);
    
    if (hasSales) {
      console.log('🎉 EXITO: El módulo SALES está habilitado para el cliente.');
    } else {
      console.error('❌ ERROR: El módulo no se habilitó correctamente.');
    }

    // Limpieza post-test
    // await prisma.subscriptionRequest.delete({ where: { id: request.id } });
    
  } catch (error) {
    console.error('❌ ERROR DURANTE LA PRUEBA:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
