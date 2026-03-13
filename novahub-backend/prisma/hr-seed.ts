import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🚀 Starting HR module seed...');

  // Delete ALL existing HR data first to avoid conflicts
  console.log('🗑️  Eliminando datos HR antiguos...');
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
  console.log('✅ Datos eliminados\n');

  // Use the EXACT tenant that Super Admin user has: client-demo-001
  let tenant = await prisma.clientTenant.findUnique({
    where: { id: 'client-demo-001' },
  });

  if (!tenant) {
    console.error('❌ Tenant client-demo-001 not found. Please run the main seed first: npm run seed');
    process.exit(1);
  }

  console.log('✅ Usando tenant correcto:', tenant.name, '(ID:', tenant.id, ')');

  console.log('✅ Partner and Tenant ready');

  // Create Departments
  const departments = [
    { code: 'ENG', name: 'Engineering', description: 'Software Development & IT', budget: 500000 },
    { code: 'SALES', name: 'Sales', description: 'Sales and Business Development', budget: 300000 },
    { code: 'MKT', name: 'Marketing', description: 'Marketing and Communications', budget: 200000 },
    { code: 'HR', name: 'Human Resources', description: 'People Operations', budget: 150000 },
    { code: 'FIN', name: 'Finance', description: 'Finance and Accounting', budget: 180000 },
    { code: 'OPS', name: 'Operations', description: 'Operations and Logistics', budget: 250000 },
    { code: 'CS', name: 'Customer Success', description: 'Customer Support', budget: 120000 },
    { code: 'PROD', name: 'Product', description: 'Product Management', budget: 220000 },
  ];

  const createdDepartments: any = {};
  for (const dept of departments) {
    const created = await prisma.department.upsert({
      where: { clientTenantId_code: { clientTenantId: tenant.id, code: dept.code } },
      update: {},
      create: { ...dept, clientTenantId: tenant.id },
    });
    createdDepartments[dept.code] = created;
  }

  console.log('✅ Created 8 departments');

  // Create Positions
  const positions = [
    { code: 'CEO', title: 'Chief Executive Officer', departmentCode: 'ENG', level: 'Executive', minSalary: 200000, maxSalary: 350000 },
    { code: 'CTO', title: 'Chief Technology Officer', departmentCode: 'ENG', level: 'Executive', minSalary: 180000, maxSalary: 300000 },
    { code: 'CFO', title: 'Chief Financial Officer', departmentCode: 'FIN', level: 'Executive', minSalary: 180000, maxSalary: 300000 },
    { code: 'VP-ENG', title: 'VP of Engineering', departmentCode: 'ENG', level: 'VP', minSalary: 150000, maxSalary: 250000 },
    { code: 'VP-SALES', title: 'VP of Sales', departmentCode: 'SALES', level: 'VP', minSalary: 140000, maxSalary: 240000 },
    { code: 'SR-ENG', title: 'Senior Software Engineer', departmentCode: 'ENG', level: 'Senior', minSalary: 120000, maxSalary: 180000 },
    { code: 'ENG', title: 'Software Engineer', departmentCode: 'ENG', level: 'Mid', minSalary: 80000, maxSalary: 130000 },
    { code: 'JR-ENG', title: 'Junior Software Engineer', departmentCode: 'ENG', level: 'Junior', minSalary: 60000, maxSalary: 90000 },
    { code: 'PROD-MGR', title: 'Product Manager', departmentCode: 'PROD', level: 'Mid', minSalary: 100000, maxSalary: 150000 },
    { code: 'SR-PROD', title: 'Senior Product Manager', departmentCode: 'PROD', level: 'Senior', minSalary: 130000, maxSalary: 180000 },
    { code: 'SALES-REP', title: 'Sales Representative', departmentCode: 'SALES', level: 'Mid', minSalary: 60000, maxSalary: 100000 },
    { code: 'SR-SALES', title: 'Senior Sales Executive', departmentCode: 'SALES', level: 'Senior', minSalary: 90000, maxSalary: 150000 },
    { code: 'MKT-MGR', title: 'Marketing Manager', departmentCode: 'MKT', level: 'Mid', minSalary: 70000, maxSalary: 110000 },
    { code: 'HR-MGR', title: 'HR Manager', departmentCode: 'HR', level: 'Mid', minSalary: 75000, maxSalary: 120000 },
    { code: 'ACCT', title: 'Accountant', departmentCode: 'FIN', level: 'Mid', minSalary: 60000, maxSalary: 95000 },
  ];

  const createdPositions: any = {};
  for (const pos of positions) {
    const { departmentCode, ...posData } = pos;
    const created = await prisma.position.upsert({
      where: { clientTenantId_code: { clientTenantId: tenant.id, code: pos.code } },
      update: {},
      create: {
        ...posData,
        clientTenantId: tenant.id,
        departmentId: createdDepartments[departmentCode].id,
      },
    });
    createdPositions[pos.code] = created;
  }

  console.log('✅ Created 15 positions');

  // Create 50+ Employees with realistic data
  const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'William', 'Jennifer', 'James', 'Mary', 'Christopher', 'Patricia', 'Daniel', 'Linda', 'Matthew', 'Barbara', 'Anthony', 'Elizabeth', 'Mark', 'Susan', 'Donald', 'Jessica', 'Steven', 'Karen', 'Paul', 'Nancy', 'Andrew', 'Betty', 'Joshua', 'Margaret', 'Kenneth', 'Sandra', 'Kevin', 'Ashley', 'Brian', 'Kimberly', 'George', 'Emily', 'Timothy', 'Donna', 'Ronald', 'Michelle', 'Edward', 'Carol', 'Jason', 'Amanda', 'Jeffrey', 'Melissa', 'Ryan', 'Deborah', 'Jacob', 'Stephanie', 'Gary', 'Dorothy'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'];

  const contractTypes = ['FULL_TIME', 'FULL_TIME', 'FULL_TIME', 'FULL_TIME', 'PART_TIME', 'CONTRACTOR'];
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'];

  const employeeData: any[] = [];
  const positionKeys = Object.keys(createdPositions);

  for (let i = 0; i < 55; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const posKey = positionKeys[i % positionKeys.length];
    const position = createdPositions[posKey];
    const hireDate = new Date(2020 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
    const salary = Number(position.minSalary) + Math.random() * (Number(position.maxSalary) - Number(position.minSalary));

    employeeData.push({
      employeeNumber: `EMP${String(i + 1).padStart(4, '0')}`,
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@democompany.com`,
      phone: `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
      dateOfBirth: new Date(1970 + Math.floor(Math.random() * 30), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
      hireDate,
      departmentId: position.departmentId,
      positionId: position.id,
      contractType: contractTypes[Math.floor(Math.random() * contractTypes.length)],
      employmentStatus: i < 50 ? 'ACTIVE' : 'INACTIVE',
      salary: Math.round(salary),
      currency: 'USD',
      city: cities[Math.floor(Math.random() * cities.length)],
      country: 'USA',
      clientTenantId: tenant.id,
    });
  }

  const employees: any[] = [];
  for (const empData of employeeData) {
    const emp = await prisma.employee.upsert({
      where: { employeeNumber: empData.employeeNumber },
      update: {},
      create: empData,
    });
    employees.push(emp);
  }

  console.log('✅ Created 55 employees');

  // Assign managers
  await prisma.employee.update({
    where: { employeeNumber: 'EMP0002' },
    data: { managerId: employees[0].id },
  });
  await prisma.employee.update({
    where: { employeeNumber: 'EMP0003' },
    data: { managerId: employees[0].id },
  });

  // Update department managers
  await prisma.department.update({
    where: { id: createdDepartments['ENG'].id },
    data: { managerId: employees[1].id },
  });
  await prisma.department.update({
    where: { id: createdDepartments['SALES'].id },
    data: { managerId: employees[4].id },
  });

  console.log('✅ Assigned managers');

  // Create Payroll records (last 6 months)
  const payrollRecords: any[] = [];
  const now = new Date();
  for (let month = 0; month < 6; month++) {
    const periodStart = new Date(now.getFullYear(), now.getMonth() - month, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() - month + 1, 0);

    for (const emp of employees.slice(0, 40)) {
      const bonuses = Math.random() > 0.7 ? Math.random() * 5000 : 0;
      const overtime = Math.random() > 0.8 ? Math.random() * 2000 : 0;
      const deductions = Math.random() * 500;
      const taxes = Number(emp.salary) * 0.25 / 12;
      const grossPay = Number(emp.salary) / 12 + bonuses + overtime;
      const netPay = grossPay - deductions - taxes;

      payrollRecords.push({
        clientTenantId: tenant.id,
        employeeId: emp.id,
        periodStart,
        periodEnd,
        baseSalary: Number(emp.salary) / 12,
        bonuses,
        deductions,
        overtime,
        grossPay,
        netPay,
        taxes,
        status: month === 0 ? 'PENDING' : 'PAID',
        paymentDate: month === 0 ? null : new Date(periodEnd.getTime() + 5 * 24 * 60 * 60 * 1000),
      });
    }
  }

  await prisma.payroll.createMany({
    data: payrollRecords,
    skipDuplicates: true,
  });

  console.log('✅ Created 240 payroll records');

  // Create Attendance records (last 30 days)
  const attendanceRecords: any[] = [];
  for (let day = 0; day < 30; day++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
    if (date.getDay() === 0 || date.getDay() === 6) continue; // Skip weekends

    for (const emp of employees.slice(0, 45)) {
      const rand = Math.random();
      const status = rand > 0.95 ? 'ABSENT' : rand > 0.9 ? 'LATE' : rand > 0.85 ? 'REMOTE' : 'PRESENT';
      const checkIn = status !== 'ABSENT' ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60)) : null;
      const checkOut = checkIn ? new Date(checkIn.getTime() + (8 + Math.random() * 2) * 60 * 60 * 1000) : null;
      const hoursWorked = checkIn && checkOut ? (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60) : 0;

      attendanceRecords.push({
        clientTenantId: tenant.id,
        employeeId: emp.id,
        date,
        checkIn,
        checkOut,
        status,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        overtimeHours: hoursWorked > 8 ? Math.round((hoursWorked - 8) * 100) / 100 : 0,
      });
    }
  }

  await prisma.attendance.createMany({
    data: attendanceRecords,
    skipDuplicates: true,
  });

  console.log('✅ Created 900+ attendance records');

  // Create Leave Requests
  const leaveTypes = ['VACATION', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY'];
  const leaveStatuses = ['PENDING', 'APPROVED', 'APPROVED', 'REJECTED'];
  const leaveRequests: any[] = [];

  for (let i = 0; i < 30; i++) {
    const emp = employees[i % 40];
    const startDate = new Date(now.getFullYear(), now.getMonth() + Math.floor(Math.random() * 3), Math.floor(Math.random() * 28) + 1);
    const days = Math.floor(Math.random() * 10) + 1;
    const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
    const status = leaveStatuses[Math.floor(Math.random() * leaveStatuses.length)];

    leaveRequests.push({
      clientTenantId: tenant.id,
      employeeId: emp.id,
      leaveType: leaveTypes[Math.floor(Math.random() * leaveTypes.length)],
      startDate,
      endDate,
      days,
      reason: 'Personal reasons',
      status,
      approvedBy: status === 'APPROVED' ? employees[0].id : null,
      approvedAt: status === 'APPROVED' ? new Date() : null,
      rejectionReason: status === 'REJECTED' ? 'Insufficient leave balance' : null,
    });
  }

  await prisma.leaveRequest.createMany({
    data: leaveRequests,
  });

  console.log('✅ Created 30 leave requests');

  // Create Performance Reviews
  const reviews: any[] = [];
  for (let i = 0; i < 25; i++) {
    const emp = employees[i];
    const reviewPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
    const reviewPeriodEnd = new Date(now.getFullYear() - 1, 11, 31);

    reviews.push({
      clientTenantId: tenant.id,
      employeeId: emp.id,
      reviewerId: employees[0].id,
      reviewPeriodStart,
      reviewPeriodEnd,
      overallRating: 3 + Math.random() * 2,
      goals: 'Improve technical skills and team collaboration',
      achievements: 'Successfully delivered 5 major projects',
      areasOfImprovement: 'Communication and time management',
      comments: 'Great performance overall',
      status: i < 20 ? 'COMPLETED' : 'IN_PROGRESS',
      completedAt: i < 20 ? new Date() : null,
    });
  }

  await prisma.performanceReview.createMany({
    data: reviews,
  });

  console.log('✅ Created 25 performance reviews');

  // Create Trainings
  const trainings = [
    { title: 'Leadership Skills Workshop', description: 'Develop leadership capabilities', instructor: 'John Trainer', location: 'Conference Room A', startDate: new Date(2024, 5, 15), endDate: new Date(2024, 5, 16), capacity: 20, cost: 500, status: 'COMPLETED' as any },
    { title: 'Advanced React Development', description: 'Master React hooks and patterns', instructor: 'Sarah Developer', location: 'Online', startDate: new Date(2024, 6, 10), endDate: new Date(2024, 6, 12), capacity: 30, cost: 800, status: 'COMPLETED' as any },
    { title: 'Sales Techniques Masterclass', description: 'Improve sales conversion', instructor: 'Mike Sales', location: 'Training Center', startDate: new Date(2024, 7, 5), endDate: new Date(2024, 7, 6), capacity: 25, cost: 600, status: 'IN_PROGRESS' as any },
    { title: 'Data Analytics Fundamentals', description: 'Learn data analysis basics', instructor: 'Anna Analyst', location: 'Online', startDate: new Date(2024, 8, 20), endDate: new Date(2024, 8, 22), capacity: 40, cost: 700, status: 'SCHEDULED' as any },
    { title: 'Project Management Certification', description: 'PMP certification prep', instructor: 'Robert PM', location: 'Conference Room B', startDate: new Date(2024, 9, 1), endDate: new Date(2024, 9, 5), capacity: 15, cost: 1200, status: 'SCHEDULED' as any },
  ];

  const createdTrainings: any[] = [];
  for (const training of trainings) {
    const created = await prisma.training.create({
      data: { ...training, clientTenantId: tenant.id },
    });
    createdTrainings.push(created);
  }

  console.log('✅ Created 5 trainings');

  // Enroll employees in trainings
  const enrollments: any[] = [];
  for (let i = 0; i < 40; i++) {
    const training = createdTrainings[i % createdTrainings.length];
    const emp = employees[i];
    const isCompleted = training.status === 'COMPLETED';

    enrollments.push({
      employeeId: emp.id,
      trainingId: training.id,
      status: isCompleted ? 'COMPLETED' : training.status,
      completedAt: isCompleted ? new Date() : null,
      score: isCompleted ? 80 + Math.random() * 20 : null,
    });
  }

  await prisma.employeeTraining.createMany({
    data: enrollments,
    skipDuplicates: true,
  });

  console.log('✅ Created 40 training enrollments');

  // Create Benefits
  const benefits = [
    { name: 'Health Insurance', description: 'Comprehensive health coverage', type: 'HEALTH', provider: 'Blue Cross', cost: 500 },
    { name: 'Dental Insurance', description: 'Dental care coverage', type: 'DENTAL', provider: 'Delta Dental', cost: 100 },
    { name: '401(k) Matching', description: '5% employer match', type: 'RETIREMENT', provider: 'Fidelity', cost: 0 },
    { name: 'Life Insurance', description: 'Term life insurance', type: 'LIFE', provider: 'MetLife', cost: 50 },
    { name: 'Gym Membership', description: 'Fitness center access', type: 'WELLNESS', provider: 'LA Fitness', cost: 80 },
    { name: 'Remote Work Stipend', description: 'Home office equipment', type: 'STIPEND', provider: null, cost: 100 },
  ];

  const createdBenefits: any[] = [];
  for (const benefit of benefits) {
    const created = await prisma.benefit.create({
      data: { ...benefit, clientTenantId: tenant.id },
    });
    createdBenefits.push(created);
  }

  console.log('✅ Created 6 benefits');

  // Assign benefits to employees
  const benefitAssignments: any[] = [];
  for (const emp of employees.slice(0, 45)) {
    for (const benefit of createdBenefits.slice(0, 3)) {
      benefitAssignments.push({
        employeeId: emp.id,
        benefitId: benefit.id,
        startDate: emp.hireDate,
        status: 'ACTIVE',
      });
    }
  }

  await prisma.employeeBenefit.createMany({
    data: benefitAssignments,
    skipDuplicates: true,
  });

  console.log('✅ Created 135 benefit assignments');

  // Create Employee Documents
  const documentTypes = ['CONTRACT', 'ID', 'RESUME', 'CERTIFICATE', 'PERFORMANCE_REVIEW'];
  const documents: any[] = [];

  for (let i = 0; i < 50; i++) {
    const emp = employees[i % 40];
    documents.push({
      clientTenantId: tenant.id,
      employeeId: emp.id,
      title: `${documentTypes[i % documentTypes.length]} - ${emp.firstName} ${emp.lastName}`,
      type: documentTypes[i % documentTypes.length],
      fileUrl: `https://storage.example.com/docs/${emp.employeeNumber}_${documentTypes[i % documentTypes.length]}.pdf`,
      uploadedAt: new Date(),
      expiryDate: i % 3 === 0 ? new Date(2025, 11, 31) : null,
    });
  }

  await prisma.employeeDocument.createMany({
    data: documents,
  });

  console.log('✅ Created 50 employee documents');

  console.log('🎉 HR module seed completed successfully!');
  console.log(`
  📊 Summary:
  - 8 Departments
  - 15 Positions
  - 55 Employees
  - 240 Payroll records
  - 900+ Attendance records
  - 30 Leave requests
  - 25 Performance reviews
  - 5 Trainings with 40 enrollments
  - 6 Benefits with 135 assignments
  - 50 Employee documents
  `);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding HR module:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
