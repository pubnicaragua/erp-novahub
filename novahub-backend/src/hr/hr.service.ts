import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class HrService {
  constructor(private prisma: PrismaService) {}

  // ===== DEPARTMENTS =====
  async createDepartment(data: any, clientTenantId: string) {
    return this.prisma.department.create({
      data: { ...data, clientTenantId },
      include: { manager: true, parent: true, employees: true },
    });
  }

  async findAllDepartments(clientTenantId: string) {
    return this.prisma.department.findMany({
      where: { clientTenantId, status: 'ACTIVE' },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true } },
        parent: { select: { id: true, name: true } },
        employees: { select: { id: true } },
        positions: { select: { id: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findDepartment(id: string, clientTenantId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, clientTenantId },
      include: {
        manager: true,
        parent: true,
        subDepartments: true,
        employees: true,
        positions: true,
      },
    });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  async updateDepartment(id: string, data: any, clientTenantId: string) {
    await this.findDepartment(id, clientTenantId);
    return this.prisma.department.update({
      where: { id },
      data,
      include: { manager: true, parent: true },
    });
  }

  async deleteDepartment(id: string, clientTenantId: string) {
    await this.findDepartment(id, clientTenantId);
    return this.prisma.department.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  // ===== POSITIONS =====
  async createPosition(data: any, clientTenantId: string) {
    return this.prisma.position.create({
      data: { ...data, clientTenantId },
      include: { department: true },
    });
  }

  async findAllPositions(clientTenantId: string, departmentId?: string) {
    return this.prisma.position.findMany({
      where: {
        clientTenantId,
        status: 'ACTIVE',
        ...(departmentId && { departmentId }),
      },
      include: {
        department: { select: { id: true, name: true } },
        employees: { select: { id: true } },
      },
      orderBy: { title: 'asc' },
    });
  }

  async findPosition(id: string, clientTenantId: string) {
    const position = await this.prisma.position.findFirst({
      where: { id, clientTenantId },
      include: { department: true, employees: true },
    });
    if (!position) throw new NotFoundException('Position not found');
    return position;
  }

  async updatePosition(id: string, data: any, clientTenantId: string) {
    await this.findPosition(id, clientTenantId);
    return this.prisma.position.update({
      where: { id },
      data,
      include: { department: true },
    });
  }

  async deletePosition(id: string, clientTenantId: string) {
    await this.findPosition(id, clientTenantId);
    return this.prisma.position.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  // ===== EMPLOYEES =====
  async createEmployee(data: any, clientTenantId: string) {
    // Only pick fields that exist in the Prisma Employee model
    const employeeData: any = {
      employeeNumber: data.employeeNumber,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      hireDate: new Date(data.hireDate),
      departmentId: data.departmentId,
      positionId: data.positionId,
      managerId: data.managerId || null,
      contractType: data.contractType || 'FULL_TIME',
      salary: Number(data.salary) || 0,
      currency: data.currency || 'USD',
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      country: data.country || null,
      postalCode: data.postalCode || data.zipCode || null,
      emergencyContact: data.emergencyContact || null,
      emergencyPhone: data.emergencyPhone || null,
      notes: data.notes || null,
      clientTenantId,
    };

    return this.prisma.employee.create({
      data: employeeData,
      include: {
        department: true,
        position: true,
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async bulkImportEmployees(employees: any[], clientTenantId: string) {
    const results = await Promise.allSettled(
      employees.map(emp => this.createEmployee(emp, clientTenantId))
    );
    return {
      success: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
      results,
    };
  }

  async findAllEmployees(clientTenantId: string, filters?: any) {
    const where: any = { clientTenantId };
    if (filters?.departmentId) where.departmentId = filters.departmentId;
    if (filters?.positionId) where.positionId = filters.positionId;
    if (filters?.status) where.employmentStatus = filters.status;

    return this.prisma.employee.findMany({
      where,
      include: {
        department: { select: { id: true, name: true } },
        position: { select: { id: true, title: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { lastName: 'asc' },
    });
  }

  async exportEmployees(clientTenantId: string) {
    const employees = await this.findAllEmployees(clientTenantId);
    return {
      data: employees,
      filename: `employees_${new Date().toISOString().split('T')[0]}.csv`,
    };
  }

  async findEmployee(id: string, clientTenantId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, clientTenantId },
      include: {
        department: true,
        position: true,
        manager: true,
        subordinates: true,
        payrolls: { take: 12, orderBy: { periodEnd: 'desc' } },
        attendances: { take: 30, orderBy: { date: 'desc' } },
        leaveRequests: { take: 10, orderBy: { createdAt: 'desc' } },
        reviews: { take: 5, orderBy: { createdAt: 'desc' } },
        trainings: { include: { training: true } },
        benefits: { include: { benefit: true } },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async getEmployeeHistory(id: string, clientTenantId: string) {
    const employee = await this.findEmployee(id, clientTenantId);
    return {
      employee: {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
      },
      payrolls: employee.payrolls,
      attendances: employee.attendances,
      leaveRequests: employee.leaveRequests,
      reviews: employee.reviews,
      trainings: employee.trainings,
    };
  }

  async updateEmployee(id: string, data: any, clientTenantId: string) {
    await this.findEmployee(id, clientTenantId);
    return this.prisma.employee.update({
      where: { id },
      data,
      include: { department: true, position: true, manager: true },
    });
  }

  async deleteEmployee(id: string, clientTenantId: string) {
    await this.findEmployee(id, clientTenantId);
    return this.prisma.employee.update({
      where: { id },
      data: { employmentStatus: 'TERMINATED', terminationDate: new Date() },
    });
  }

  // ===== PAYROLL =====
  async createPayroll(data: any, clientTenantId: string) {
    const bonuses = Number(data.bonuses || 0);
    const deductions = Number(data.deductions || 0);
    const overtime = Number(data.overtime || 0);
    const taxes = Number(data.taxes || 0);
    const baseSalary = Number(data.baseSalary);
    const grossPay = baseSalary + bonuses + overtime;
    const netPay = grossPay - deductions - taxes;

    return this.prisma.payroll.create({
      data: {
        clientTenantId,
        employeeId: data.employeeId,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
        baseSalary,
        bonuses,
        deductions,
        overtime,
        taxes,
        grossPay,
        netPay,
        notes: data.notes,
      },
      include: { employee: true },
    });
  }

  async updatePayrollStatus(id: string, status: string, clientTenantId: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id, clientTenantId },
    });
    if (!payroll) throw new NotFoundException('Payroll record not found');

    return this.prisma.payroll.update({
      where: { id },
      data: {
        status,
        paymentDate: status === 'PAID' ? new Date() : null,
      },
      include: { employee: true },
    });
  }

  async bulkProcessPayroll(data: any, clientTenantId: string) {
    const { periodStart, periodEnd, employeeIds } = data;
    
    const employees = await this.prisma.employee.findMany({
      where: {
        clientTenantId,
        employmentStatus: 'ACTIVE',
        ...(employeeIds && { id: { in: employeeIds } }),
      },
    });

    const payrolls = await Promise.all(
      employees.map(emp =>
        this.createPayroll({
          employeeId: emp.id,
          periodStart,
          periodEnd,
          baseSalary: emp.salary,
        }, clientTenantId)
      )
    );

    return { count: payrolls.length, payrolls };
  }

  async findAllPayroll(clientTenantId: string, filters?: any) {
    const where: any = { clientTenantId };
    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.periodStart) where.periodStart = { gte: new Date(filters.periodStart) };
    if (filters?.periodEnd) where.periodEnd = { lte: new Date(filters.periodEnd) };

    return this.prisma.payroll.findMany({
      where,
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } },
      orderBy: { periodEnd: 'desc' },
    });
  }

  async getPayrollPeriods(clientTenantId: string) {
    const payrolls = await this.prisma.payroll.findMany({
      where: { clientTenantId },
      select: { periodStart: true, periodEnd: true },
      distinct: ['periodStart', 'periodEnd'],
      orderBy: { periodEnd: 'desc' },
    });
    return payrolls;
  }

  async getPayrollReports(clientTenantId: string, period?: string) {
    const payrolls = await this.findAllPayroll(clientTenantId, period ? { periodStart: period } : {});
    
    const totalGross = payrolls.reduce((sum, p) => sum + Number(p.grossPay), 0);
    const totalNet = payrolls.reduce((sum, p) => sum + Number(p.netPay), 0);
    const totalTaxes = payrolls.reduce((sum, p) => sum + Number(p.taxes), 0);

    return {
      period,
      employeeCount: payrolls.length,
      totalGross,
      totalNet,
      totalTaxes,
      payrolls,
    };
  }

  async calculatePayroll(data: any, clientTenantId: string) {
    return this.bulkProcessPayroll(data, clientTenantId);
  }

  // ===== ATTENDANCE =====
  async clockIn(data: any, clientTenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.attendance.findFirst({
      where: {
        clientTenantId,
        employeeId: data.employeeId,
        date: today,
      },
    });

    if (existing) {
      throw new BadRequestException('Already clocked in today');
    }

    return this.prisma.attendance.create({
      data: {
        clientTenantId,
        employeeId: data.employeeId,
        date: today,
        checkIn: new Date(),
        status: 'PRESENT',
        location: data.location,
        notes: data.notes,
      },
      include: { employee: true },
    });
  }

  async clockOut(data: any, clientTenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await this.prisma.attendance.findFirst({
      where: {
        clientTenantId,
        employeeId: data.employeeId,
        date: today,
      },
    });

    if (!attendance) {
      throw new NotFoundException('No clock-in record found for today');
    }

    if (attendance.checkOut) {
      throw new BadRequestException('Already clocked out');
    }

    const checkOut = new Date();
    const hoursWorked = (checkOut.getTime() - new Date(attendance.checkIn!).getTime()) / (1000 * 60 * 60);

    return this.prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOut,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        notes: data.notes,
      },
      include: { employee: true },
    });
  }

  async createAttendance(data: any, clientTenantId: string) {
    return this.prisma.attendance.create({
      data: {
        clientTenantId,
        employeeId: data.employeeId,
        date: new Date(data.date),
        status: data.status,
        checkIn: data.checkIn ? new Date(data.checkIn) : null,
        checkOut: data.checkOut ? new Date(data.checkOut) : null,
        hoursWorked: data.hoursWorked ? Number(data.hoursWorked) : null,
        overtimeHours: data.overtimeHours ? Number(data.overtimeHours) : 0,
        location: data.location,
        notes: data.notes,
      },
      include: { employee: true },
    });
  }

  async findAllAttendance(clientTenantId: string, filters?: any) {
    const where: any = { clientTenantId };
    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.startDate) where.date = { gte: new Date(filters.startDate) };
    if (filters?.endDate) where.date = { ...where.date, lte: new Date(filters.endDate) };

    return this.prisma.attendance.findMany({
      where,
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { date: 'desc' },
    });
  }

  async getAttendanceReports(clientTenantId: string, month?: string) {
    const attendances = await this.findAllAttendance(clientTenantId, month ? { startDate: month } : {});
    
    const summary = {
      totalRecords: attendances.length,
      present: attendances.filter(a => a.status === 'PRESENT').length,
      absent: attendances.filter(a => a.status === 'ABSENT').length,
      late: attendances.filter(a => a.status === 'LATE').length,
      remote: attendances.filter(a => a.status === 'REMOTE').length,
    };

    return { summary, attendances };
  }

  // ===== LEAVE REQUESTS =====
  async createLeaveRequest(data: any, clientTenantId: string) {
    return this.prisma.leaveRequest.create({
      data: {
        clientTenantId,
        employeeId: data.employeeId,
        leaveType: data.leaveType,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        days: Number(data.days),
        reason: data.reason,
      },
      include: { employee: true },
    });
  }

  async findAllLeaveRequests(clientTenantId: string, filters?: any) {
    const where: any = { clientTenantId };
    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.status) where.status = filters.status;

    return this.prisma.leaveRequest.findMany({
      where,
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveLeaveRequest(id: string, approvedBy: string, clientTenantId: string) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, clientTenantId },
    });
    if (!request) throw new NotFoundException('Leave request not found');

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
      include: { employee: true },
    });
  }

  async rejectLeaveRequest(id: string, rejectionReason: string, clientTenantId: string) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, clientTenantId },
    });
    if (!request) throw new NotFoundException('Leave request not found');

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason,
      },
      include: { employee: true },
    });
  }

  // ===== PERFORMANCE REVIEWS =====
  async createPerformanceReview(data: any, clientTenantId: string) {
    return this.prisma.performanceReview.create({
      data: {
        clientTenantId,
        employeeId: data.employeeId,
        reviewerId: data.reviewerId,
        reviewPeriodStart: new Date(data.reviewPeriodStart),
        reviewPeriodEnd: new Date(data.reviewPeriodEnd),
        overallRating: data.overallRating ? Number(data.overallRating) : null,
        goals: data.goals,
        achievements: data.achievements,
        areasOfImprovement: data.areasOfImprovement,
        comments: data.comments,
      },
      include: { employee: true, reviewer: true },
    });
  }

  async findAllPerformanceReviews(clientTenantId: string, employeeId?: string) {
    return this.prisma.performanceReview.findMany({
      where: {
        clientTenantId,
        ...(employeeId && { employeeId }),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        reviewer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPerformanceReview(id: string, clientTenantId: string) {
    const review = await this.prisma.performanceReview.findFirst({
      where: { id, clientTenantId },
      include: { employee: true, reviewer: true },
    });
    if (!review) throw new NotFoundException('Performance review not found');
    return review;
  }

  async updatePerformanceReview(id: string, data: any, clientTenantId: string) {
    await this.findPerformanceReview(id, clientTenantId);
    return this.prisma.performanceReview.update({
      where: { id },
      data,
      include: { employee: true, reviewer: true },
    });
  }

  async getPerformanceMetrics(clientTenantId: string) {
    const reviews = await this.findAllPerformanceReviews(clientTenantId);
    const avgRating = reviews.reduce((sum, r) => sum + Number(r.overallRating || 0), 0) / reviews.length;
    
    return {
      totalReviews: reviews.length,
      averageRating: Math.round(avgRating * 100) / 100,
      completed: reviews.filter(r => r.status === 'COMPLETED').length,
      inProgress: reviews.filter(r => r.status === 'IN_PROGRESS').length,
    };
  }

  // ===== TRAINING =====
  async createTraining(data: any, clientTenantId: string) {
    return this.prisma.training.create({
      data: {
        clientTenantId,
        title: data.title,
        description: data.description,
        instructor: data.instructor,
        location: data.location,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        capacity: data.capacity ? Number(data.capacity) : 20,
        cost: data.cost ? Number(data.cost) : null,
        currency: data.currency || 'USD',
      },
    });
  }

  async findAllTrainings(clientTenantId: string, status?: string) {
    return this.prisma.training.findMany({
      where: {
        clientTenantId,
        ...(status && { status: status as any }),
      },
      include: {
        enrollments: {
          include: { employee: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async findTraining(id: string, clientTenantId: string) {
    const training = await this.prisma.training.findFirst({
      where: { id, clientTenantId },
      include: {
        enrollments: {
          include: { employee: true },
        },
      },
    });
    if (!training) throw new NotFoundException('Training not found');
    return training;
  }

  async updateTraining(id: string, data: any, clientTenantId: string) {
    await this.findTraining(id, clientTenantId);
    return this.prisma.training.update({
      where: { id },
      data,
    });
  }

  async enrollEmployee(data: any, clientTenantId: string) {
    return this.prisma.employeeTraining.create({
      data: {
        employeeId: data.employeeId,
        trainingId: data.trainingId,
      },
      include: { employee: true, training: true },
    });
  }

  async completeTraining(trainingId: string, employeeId: string, data: any, clientTenantId: string) {
    const enrollment = await this.prisma.employeeTraining.findFirst({
      where: { trainingId, employeeId },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    return this.prisma.employeeTraining.update({
      where: { id: enrollment.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        ...data,
      },
      include: { employee: true, training: true },
    });
  }

  // ===== BENEFITS =====
  async createBenefit(data: any, clientTenantId: string) {
    return this.prisma.benefit.create({
      data: {
        clientTenantId,
        name: data.name,
        description: data.description,
        type: data.type,
        provider: data.provider,
        cost: data.cost ? Number(data.cost) : null,
        currency: data.currency || 'USD',
      },
    });
  }

  async findAllBenefits(clientTenantId: string) {
    return this.prisma.benefit.findMany({
      where: { clientTenantId, status: 'ACTIVE' },
      include: {
        employeeBenefits: {
          include: { employee: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
  }

  async updateBenefit(id: string, data: any, clientTenantId: string) {
    return this.prisma.benefit.update({
      where: { id },
      data,
    });
  }

  async deleteBenefit(id: string, clientTenantId: string) {
    return this.prisma.benefit.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  async assignBenefit(data: any, clientTenantId: string) {
    return this.prisma.employeeBenefit.create({
      data: {
        employeeId: data.employeeId,
        benefitId: data.benefitId,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
      include: { employee: true, benefit: true },
    });
  }

  // ===== DOCUMENTS =====
  async createDocument(data: any, clientTenantId: string) {
    return this.prisma.employeeDocument.create({
      data: { ...data, clientTenantId },
      include: { employee: true },
    });
  }

  async findAllDocuments(clientTenantId: string, employeeId?: string) {
    return this.prisma.employeeDocument.findMany({
      where: {
        clientTenantId,
        ...(employeeId && { employeeId }),
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async deleteDocument(id: string, clientTenantId: string) {
    return this.prisma.employeeDocument.delete({
      where: { id },
    });
  }

  // ===== DASHBOARD & ANALYTICS =====
  async getDashboardStats(clientTenantId: string) {
    const [
      totalEmployees,
      activeEmployees,
      departments,
      positions,
      pendingLeaves,
      recentHires,
    ] = await Promise.all([
      this.prisma.employee.count({ where: { clientTenantId } }),
      this.prisma.employee.count({ where: { clientTenantId, employmentStatus: 'ACTIVE' } }),
      this.prisma.department.count({ where: { clientTenantId, status: 'ACTIVE' } }),
      this.prisma.position.count({ where: { clientTenantId, status: 'ACTIVE' } }),
      this.prisma.leaveRequest.count({ where: { clientTenantId, status: 'PENDING' } }),
      this.prisma.employee.count({
        where: {
          clientTenantId,
          hireDate: { gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) },
        },
      }),
    ]);

    return {
      totalEmployees,
      activeEmployees,
      departments,
      positions,
      pendingLeaves,
      recentHires,
    };
  }

  async getHeadcountAnalytics(clientTenantId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { clientTenantId },
      include: { department: true, position: true },
    });

    const byDepartment = employees.reduce((acc: any, emp) => {
      const dept = emp.department.name;
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {});

    const byContractType = employees.reduce((acc: any, emp) => {
      acc[emp.contractType] = (acc[emp.contractType] || 0) + 1;
      return acc;
    }, {});

    return { byDepartment, byContractType, total: employees.length };
  }

  async getTurnoverRate(clientTenantId: string) {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    
    const [totalEmployees, terminated] = await Promise.all([
      this.prisma.employee.count({ where: { clientTenantId } }),
      this.prisma.employee.count({
        where: {
          clientTenantId,
          employmentStatus: 'TERMINATED',
          terminationDate: { gte: startOfYear },
        },
      }),
    ]);

    const turnoverRate = totalEmployees > 0 ? (terminated / totalEmployees) * 100 : 0;

    return {
      totalEmployees,
      terminated,
      turnoverRate: Math.round(turnoverRate * 100) / 100,
      period: 'Year to date',
    };
  }
}
