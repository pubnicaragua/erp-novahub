/**
 * Limpia empleados y datos HR, recrea departamentos y puestos en español
 * Ejecutar: npx ts-node prisma/hr-clean-spanish.ts
 */
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🧹 Limpiando datos HR y recreando en español...\n');

  // ─── 1. Eliminar TODOS los datos HR (en orden por dependencias) ───────
  console.log('🗑️  Eliminando datos HR...');
  await prisma.employeeDocument.deleteMany({});
  await prisma.employeeBenefit.deleteMany({});
  await prisma.benefit.deleteMany({});
  await prisma.employeeTraining.deleteMany({});
  await prisma.training.deleteMany({});
  await prisma.performanceReview.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.payroll.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.position.deleteMany({});
  await prisma.department.deleteMany({});
  console.log('✅ Todos los datos HR eliminados\n');

  // ─── 2. Obtener el tenant ─────────────────────────────────────────────
  const tenant = await prisma.clientTenant.findUnique({
    where: { id: 'client-demo-001' },
  });

  if (!tenant) {
    console.error('❌ Tenant client-demo-001 no encontrado. Ejecuta primero: npm run seed');
    process.exit(1);
  }
  console.log('✅ Tenant:', tenant.name, '(ID:', tenant.id, ')');

  // ─── 3. Crear departamentos en español ────────────────────────────────
  const departamentos = [
    { code: 'ADMIN', name: 'Administración', description: 'Gestión administrativa y dirección general', budget: 200000 },
    { code: 'CONT', name: 'Contabilidad', description: 'Contabilidad, finanzas y tesorería', budget: 150000 },
    { code: 'RRHH', name: 'Recursos Humanos', description: 'Gestión del talento humano y nóminas', budget: 120000 },
    { code: 'VENT', name: 'Ventas', description: 'Ventas, atención al cliente y comercialización', budget: 250000 },
    { code: 'COMP', name: 'Compras', description: 'Adquisiciones, logística y proveedores', budget: 180000 },
    { code: 'PROD', name: 'Producción', description: 'Producción, manufactura y control de calidad', budget: 300000 },
    { code: 'TI', name: 'Tecnología', description: 'Sistemas, soporte técnico e infraestructura', budget: 180000 },
    { code: 'MKT', name: 'Marketing', description: 'Publicidad, comunicación y redes sociales', budget: 100000 },
    { code: 'LEGAL', name: 'Legal', description: 'Asesoría jurídica y cumplimiento normativo', budget: 80000 },
    { code: 'BODG', name: 'Bodega', description: 'Almacén, inventario y despacho', budget: 120000 },
  ];

  const deptMap: Record<string, any> = {};
  for (const dept of departamentos) {
    const created = await prisma.department.upsert({
      where: { clientTenantId_code: { clientTenantId: tenant.id, code: dept.code } },
      update: { name: dept.name, description: dept.description, budget: dept.budget },
      create: { ...dept, clientTenantId: tenant.id },
    });
    deptMap[dept.code] = created;
  }
  console.log(`✅ ${departamentos.length} departamentos creados en español`);

  // ─── 4. Crear puestos de trabajo en español ───────────────────────────
  const puestos = [
    // Administración
    { code: 'GG', title: 'Gerente General', deptCode: 'ADMIN', level: 'Ejecutivo', minSalary: 3000, maxSalary: 6000 },
    { code: 'ASIST-GG', title: 'Asistente de Gerencia', deptCode: 'ADMIN', level: 'Asistente', minSalary: 800, maxSalary: 1200 },
    { code: 'RECEP', title: 'Recepcionista', deptCode: 'ADMIN', level: 'Operativo', minSalary: 500, maxSalary: 800 },

    // Contabilidad
    { code: 'CONT-GRL', title: 'Contador General', deptCode: 'CONT', level: 'Jefatura', minSalary: 1500, maxSalary: 2500 },
    { code: 'AUX-CONT', title: 'Auxiliar Contable', deptCode: 'CONT', level: 'Operativo', minSalary: 600, maxSalary: 1000 },
    { code: 'TESOR', title: 'Tesorero', deptCode: 'CONT', level: 'Jefatura', minSalary: 1200, maxSalary: 2000 },
    { code: 'FACTUR', title: 'Facturador', deptCode: 'CONT', level: 'Operativo', minSalary: 500, maxSalary: 800 },

    // Recursos Humanos
    { code: 'JEFE-RH', title: 'Jefe de Recursos Humanos', deptCode: 'RRHH', level: 'Jefatura', minSalary: 1500, maxSalary: 2500 },
    { code: 'AUX-RH', title: 'Auxiliar de RRHH', deptCode: 'RRHH', level: 'Operativo', minSalary: 600, maxSalary: 1000 },
    { code: 'NOM', title: 'Encargado de Nómina', deptCode: 'RRHH', level: 'Operativo', minSalary: 700, maxSalary: 1100 },

    // Ventas
    { code: 'GER-VENT', title: 'Gerente de Ventas', deptCode: 'VENT', level: 'Gerencia', minSalary: 2000, maxSalary: 3500 },
    { code: 'VEND', title: 'Vendedor', deptCode: 'VENT', level: 'Operativo', minSalary: 500, maxSalary: 1000 },
    { code: 'EXEC-VENT', title: 'Ejecutivo de Ventas', deptCode: 'VENT', level: 'Medio', minSalary: 800, maxSalary: 1500 },
    { code: 'ATC', title: 'Atención al Cliente', deptCode: 'VENT', level: 'Operativo', minSalary: 500, maxSalary: 800 },

    // Compras
    { code: 'JEFE-COMP', title: 'Jefe de Compras', deptCode: 'COMP', level: 'Jefatura', minSalary: 1500, maxSalary: 2500 },
    { code: 'AUX-COMP', title: 'Auxiliar de Compras', deptCode: 'COMP', level: 'Operativo', minSalary: 600, maxSalary: 1000 },
    { code: 'LOGIST', title: 'Coordinador de Logística', deptCode: 'COMP', level: 'Medio', minSalary: 900, maxSalary: 1500 },

    // Producción
    { code: 'JEFE-PROD', title: 'Jefe de Producción', deptCode: 'PROD', level: 'Jefatura', minSalary: 1500, maxSalary: 2800 },
    { code: 'SUP-PROD', title: 'Supervisor de Producción', deptCode: 'PROD', level: 'Medio', minSalary: 900, maxSalary: 1500 },
    { code: 'OPER', title: 'Operario', deptCode: 'PROD', level: 'Operativo', minSalary: 400, maxSalary: 700 },
    { code: 'CALIDAD', title: 'Inspector de Calidad', deptCode: 'PROD', level: 'Medio', minSalary: 700, maxSalary: 1200 },

    // Tecnología
    { code: 'JEFE-TI', title: 'Jefe de Tecnología', deptCode: 'TI', level: 'Jefatura', minSalary: 2000, maxSalary: 3500 },
    { code: 'DEV', title: 'Desarrollador', deptCode: 'TI', level: 'Medio', minSalary: 1000, maxSalary: 2000 },
    { code: 'SOPORTE', title: 'Soporte Técnico', deptCode: 'TI', level: 'Operativo', minSalary: 600, maxSalary: 1000 },

    // Marketing
    { code: 'JEFE-MKT', title: 'Jefe de Marketing', deptCode: 'MKT', level: 'Jefatura', minSalary: 1500, maxSalary: 2500 },
    { code: 'CM', title: 'Community Manager', deptCode: 'MKT', level: 'Operativo', minSalary: 600, maxSalary: 1000 },
    { code: 'DISEN', title: 'Diseñador Gráfico', deptCode: 'MKT', level: 'Operativo', minSalary: 600, maxSalary: 1100 },

    // Legal
    { code: 'ABOG', title: 'Abogado', deptCode: 'LEGAL', level: 'Medio', minSalary: 1200, maxSalary: 2000 },
    { code: 'AUX-LEGAL', title: 'Auxiliar Legal', deptCode: 'LEGAL', level: 'Operativo', minSalary: 600, maxSalary: 1000 },

    // Bodega
    { code: 'JEFE-BOD', title: 'Jefe de Bodega', deptCode: 'BODG', level: 'Jefatura', minSalary: 1000, maxSalary: 1800 },
    { code: 'DESP', title: 'Despachador', deptCode: 'BODG', level: 'Operativo', minSalary: 400, maxSalary: 700 },
    { code: 'INV', title: 'Encargado de Inventario', deptCode: 'BODG', level: 'Operativo', minSalary: 500, maxSalary: 900 },
  ];

  let posCount = 0;
  for (const pos of puestos) {
    const { deptCode, ...posData } = pos;
    await prisma.position.upsert({
      where: { clientTenantId_code: { clientTenantId: tenant.id, code: pos.code } },
      update: { title: posData.title, level: posData.level, minSalary: posData.minSalary, maxSalary: posData.maxSalary },
      create: {
        ...posData,
        clientTenantId: tenant.id,
        departmentId: deptMap[deptCode].id,
      },
    });
    posCount++;
  }
  console.log(`✅ ${posCount} puestos de trabajo creados en español`);

  console.log('\n🎉 ¡Listo! Departamentos y puestos configurados en español.');
  console.log('   No hay empleados — puedes agregarlos desde el módulo de RRHH.');
  console.log(`\n  📊 Resumen:`);
  console.log(`  - ${departamentos.length} Departamentos`);
  console.log(`  - ${posCount} Puestos de trabajo`);
  console.log(`  - 0 Empleados (listos para agregar)`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
