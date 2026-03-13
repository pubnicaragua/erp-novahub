import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, Patch } from '@nestjs/common';
import { HrService } from './hr.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreatePositionDto,
  UpdatePositionDto,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  BulkImportEmployeeDto,
  CreatePayrollDto,
  BulkProcessPayrollDto,
  ClockInDto,
  ClockOutDto,
  CreateAttendanceDto,
  CreateLeaveRequestDto,
  ApproveLeaveRequestDto,
  RejectLeaveRequestDto,
  CreatePerformanceReviewDto,
  UpdatePerformanceReviewDto,
  CreateTrainingDto,
  UpdateTrainingDto,
  EnrollEmployeeDto,
  CompleteTrainingDto,
  CreateBenefitDto,
  UpdateBenefitDto,
  AssignBenefitDto,
  CreateEmployeeDocumentDto,
} from './dto/hr.dto';

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr')
export class HrController {
  constructor(private readonly hrService: HrService) {}

  // ===== DEPARTMENTS =====
  @Post('departments')
  @ApiOperation({ summary: 'Create department' })
  createDepartment(@Body() data: CreateDepartmentDto, @Request() req) {
    return this.hrService.createDepartment(data, req.user.clientTenantId);
  }

  @Get('departments')
  @ApiOperation({ summary: 'Get all departments' })
  findAllDepartments(@Request() req) {
    return this.hrService.findAllDepartments(req.user.clientTenantId);
  }

  @Get('departments/:id')
  @ApiOperation({ summary: 'Get department by ID' })
  findDepartment(@Param('id') id: string, @Request() req) {
    return this.hrService.findDepartment(id, req.user.clientTenantId);
  }

  @Patch('departments/:id')
  @ApiOperation({ summary: 'Update department' })
  updateDepartment(@Param('id') id: string, @Body() data: UpdateDepartmentDto, @Request() req) {
    return this.hrService.updateDepartment(id, data, req.user.clientTenantId);
  }

  @Delete('departments/:id')
  @ApiOperation({ summary: 'Delete department' })
  deleteDepartment(@Param('id') id: string, @Request() req) {
    return this.hrService.deleteDepartment(id, req.user.clientTenantId);
  }

  // ===== POSITIONS =====
  @Post('positions')
  @ApiOperation({ summary: 'Create position' })
  createPosition(@Body() data: CreatePositionDto, @Request() req) {
    return this.hrService.createPosition(data, req.user.clientTenantId);
  }

  @Get('positions')
  @ApiOperation({ summary: 'Get all positions' })
  findAllPositions(@Request() req, @Query('departmentId') departmentId?: string) {
    return this.hrService.findAllPositions(req.user.clientTenantId, departmentId);
  }

  @Get('positions/:id')
  @ApiOperation({ summary: 'Get position by ID' })
  findPosition(@Param('id') id: string, @Request() req) {
    return this.hrService.findPosition(id, req.user.clientTenantId);
  }

  @Patch('positions/:id')
  @ApiOperation({ summary: 'Update position' })
  updatePosition(@Param('id') id: string, @Body() data: UpdatePositionDto, @Request() req) {
    return this.hrService.updatePosition(id, data, req.user.clientTenantId);
  }

  @Delete('positions/:id')
  @ApiOperation({ summary: 'Delete position' })
  deletePosition(@Param('id') id: string, @Request() req) {
    return this.hrService.deletePosition(id, req.user.clientTenantId);
  }

  // ===== EMPLOYEES =====
  @Post('employees')
  @ApiOperation({ summary: 'Create employee' })
  createEmployee(@Body() data: CreateEmployeeDto, @Request() req) {
    return this.hrService.createEmployee(data, req.user.clientTenantId);
  }

  @Post('employees/bulk-import')
  @ApiOperation({ summary: 'Bulk import employees' })
  bulkImportEmployees(@Body() data: BulkImportEmployeeDto, @Request() req) {
    return this.hrService.bulkImportEmployees(data.employees, req.user.clientTenantId);
  }

  @Get('employees')
  @ApiOperation({ summary: 'Get all employees' })
  findAllEmployees(
    @Request() req,
    @Query('departmentId') departmentId?: string,
    @Query('positionId') positionId?: string,
    @Query('status') status?: string,
  ) {
    return this.hrService.findAllEmployees(req.user.clientTenantId, { departmentId, positionId, status });
  }

  @Get('employees/export')
  @ApiOperation({ summary: 'Export employees to CSV' })
  exportEmployees(@Request() req) {
    return this.hrService.exportEmployees(req.user.clientTenantId);
  }

  @Get('employees/:id')
  @ApiOperation({ summary: 'Get employee by ID' })
  findEmployee(@Param('id') id: string, @Request() req) {
    return this.hrService.findEmployee(id, req.user.clientTenantId);
  }

  @Get('employees/:id/history')
  @ApiOperation({ summary: 'Get employee history' })
  getEmployeeHistory(@Param('id') id: string, @Request() req) {
    return this.hrService.getEmployeeHistory(id, req.user.clientTenantId);
  }

  @Patch('employees/:id')
  @ApiOperation({ summary: 'Update employee' })
  updateEmployee(@Param('id') id: string, @Body() data: UpdateEmployeeDto, @Request() req) {
    return this.hrService.updateEmployee(id, data, req.user.clientTenantId);
  }

  @Delete('employees/:id')
  @ApiOperation({ summary: 'Delete employee' })
  deleteEmployee(@Param('id') id: string, @Request() req) {
    return this.hrService.deleteEmployee(id, req.user.clientTenantId);
  }

  // ===== PAYROLL =====
  @Post('payroll')
  @ApiOperation({ summary: 'Create payroll entry' })
  createPayroll(@Body() data: CreatePayrollDto, @Request() req) {
    return this.hrService.createPayroll(data, req.user.clientTenantId);
  }

  @Post('payroll/bulk-process')
  @ApiOperation({ summary: 'Bulk process payroll' })
  bulkProcessPayroll(@Body() data: BulkProcessPayrollDto, @Request() req) {
    return this.hrService.bulkProcessPayroll(data, req.user.clientTenantId);
  }

  @Get('payroll')
  @ApiOperation({ summary: 'Get all payroll entries' })
  findAllPayroll(
    @Request() req,
    @Query('employeeId') employeeId?: string,
    @Query('periodStart') periodStart?: string,
    @Query('periodEnd') periodEnd?: string,
  ) {
    return this.hrService.findAllPayroll(req.user.clientTenantId, { employeeId, periodStart, periodEnd });
  }

  @Get('payroll/periods')
  @ApiOperation({ summary: 'Get payroll periods' })
  getPayrollPeriods(@Request() req) {
    return this.hrService.getPayrollPeriods(req.user.clientTenantId);
  }

  @Get('payroll/reports')
  @ApiOperation({ summary: 'Get payroll reports' })
  getPayrollReports(@Request() req, @Query('period') period?: string) {
    return this.hrService.getPayrollReports(req.user.clientTenantId, period);
  }

  @Post('payroll/calculate')
  @ApiOperation({ summary: 'Calculate payroll for period' })
  calculatePayroll(@Body() data: BulkProcessPayrollDto, @Request() req) {
    return this.hrService.calculatePayroll(data, req.user.clientTenantId);
  }

  // ===== ATTENDANCE =====
  @Post('attendance/clock-in')
  @ApiOperation({ summary: 'Clock in' })
  clockIn(@Body() data: ClockInDto, @Request() req) {
    return this.hrService.clockIn(data, req.user.clientTenantId);
  }

  @Post('attendance/clock-out')
  @ApiOperation({ summary: 'Clock out' })
  clockOut(@Body() data: ClockOutDto, @Request() req) {
    return this.hrService.clockOut(data, req.user.clientTenantId);
  }

  @Post('attendance')
  @ApiOperation({ summary: 'Create attendance record' })
  createAttendance(@Body() data: CreateAttendanceDto, @Request() req) {
    return this.hrService.createAttendance(data, req.user.clientTenantId);
  }

  @Get('attendance/records')
  @ApiOperation({ summary: 'Get attendance records' })
  findAllAttendance(
    @Request() req,
    @Query('employeeId') employeeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.hrService.findAllAttendance(req.user.clientTenantId, { employeeId, startDate, endDate });
  }

  @Get('attendance/reports')
  @ApiOperation({ summary: 'Get attendance reports' })
  getAttendanceReports(@Request() req, @Query('month') month?: string) {
    return this.hrService.getAttendanceReports(req.user.clientTenantId, month);
  }

  // ===== LEAVE REQUESTS =====
  @Post('leave/requests')
  @ApiOperation({ summary: 'Create leave request' })
  createLeaveRequest(@Body() data: CreateLeaveRequestDto, @Request() req) {
    return this.hrService.createLeaveRequest(data, req.user.clientTenantId);
  }

  @Get('leave/requests')
  @ApiOperation({ summary: 'Get all leave requests' })
  findAllLeaveRequests(
    @Request() req,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
  ) {
    return this.hrService.findAllLeaveRequests(req.user.clientTenantId, { employeeId, status });
  }

  @Put('leave/requests/:id/approve')
  @ApiOperation({ summary: 'Approve leave request' })
  approveLeaveRequest(@Param('id') id: string, @Body() data: ApproveLeaveRequestDto, @Request() req) {
    return this.hrService.approveLeaveRequest(id, data.approvedBy, req.user.clientTenantId);
  }

  @Put('leave/requests/:id/reject')
  @ApiOperation({ summary: 'Reject leave request' })
  rejectLeaveRequest(@Param('id') id: string, @Body() data: RejectLeaveRequestDto, @Request() req) {
    return this.hrService.rejectLeaveRequest(id, data.rejectionReason, req.user.clientTenantId);
  }

  // ===== PERFORMANCE REVIEWS =====
  @Post('performance/reviews')
  @ApiOperation({ summary: 'Create performance review' })
  createPerformanceReview(@Body() data: CreatePerformanceReviewDto, @Request() req) {
    return this.hrService.createPerformanceReview(data, req.user.clientTenantId);
  }

  @Get('performance/reviews')
  @ApiOperation({ summary: 'Get all performance reviews' })
  findAllPerformanceReviews(@Request() req, @Query('employeeId') employeeId?: string) {
    return this.hrService.findAllPerformanceReviews(req.user.clientTenantId, employeeId);
  }

  @Get('performance/reviews/:id')
  @ApiOperation({ summary: 'Get performance review by ID' })
  findPerformanceReview(@Param('id') id: string, @Request() req) {
    return this.hrService.findPerformanceReview(id, req.user.clientTenantId);
  }

  @Patch('performance/reviews/:id')
  @ApiOperation({ summary: 'Update performance review' })
  updatePerformanceReview(@Param('id') id: string, @Body() data: UpdatePerformanceReviewDto, @Request() req) {
    return this.hrService.updatePerformanceReview(id, data, req.user.clientTenantId);
  }

  @Get('performance/metrics')
  @ApiOperation({ summary: 'Get performance metrics' })
  getPerformanceMetrics(@Request() req) {
    return this.hrService.getPerformanceMetrics(req.user.clientTenantId);
  }

  // ===== TRAINING =====
  @Post('training')
  @ApiOperation({ summary: 'Create training' })
  createTraining(@Body() data: CreateTrainingDto, @Request() req) {
    return this.hrService.createTraining(data, req.user.clientTenantId);
  }

  @Get('training')
  @ApiOperation({ summary: 'Get all trainings' })
  findAllTrainings(@Request() req, @Query('status') status?: string) {
    return this.hrService.findAllTrainings(req.user.clientTenantId, status);
  }

  @Get('training/:id')
  @ApiOperation({ summary: 'Get training by ID' })
  findTraining(@Param('id') id: string, @Request() req) {
    return this.hrService.findTraining(id, req.user.clientTenantId);
  }

  @Patch('training/:id')
  @ApiOperation({ summary: 'Update training' })
  updateTraining(@Param('id') id: string, @Body() data: UpdateTrainingDto, @Request() req) {
    return this.hrService.updateTraining(id, data, req.user.clientTenantId);
  }

  @Post('training/enroll')
  @ApiOperation({ summary: 'Enroll employee in training' })
  enrollEmployee(@Body() data: EnrollEmployeeDto, @Request() req) {
    return this.hrService.enrollEmployee(data, req.user.clientTenantId);
  }

  @Put('training/:trainingId/complete/:employeeId')
  @ApiOperation({ summary: 'Complete training for employee' })
  completeTraining(
    @Param('trainingId') trainingId: string,
    @Param('employeeId') employeeId: string,
    @Body() data: CompleteTrainingDto,
    @Request() req,
  ) {
    return this.hrService.completeTraining(trainingId, employeeId, data, req.user.clientTenantId);
  }

  // ===== BENEFITS =====
  @Post('benefits')
  @ApiOperation({ summary: 'Create benefit' })
  createBenefit(@Body() data: CreateBenefitDto, @Request() req) {
    return this.hrService.createBenefit(data, req.user.clientTenantId);
  }

  @Get('benefits')
  @ApiOperation({ summary: 'Get all benefits' })
  findAllBenefits(@Request() req) {
    return this.hrService.findAllBenefits(req.user.clientTenantId);
  }

  @Patch('benefits/:id')
  @ApiOperation({ summary: 'Update benefit' })
  updateBenefit(@Param('id') id: string, @Body() data: UpdateBenefitDto, @Request() req) {
    return this.hrService.updateBenefit(id, data, req.user.clientTenantId);
  }

  @Delete('benefits/:id')
  @ApiOperation({ summary: 'Delete benefit' })
  deleteBenefit(@Param('id') id: string, @Request() req) {
    return this.hrService.deleteBenefit(id, req.user.clientTenantId);
  }

  @Post('benefits/assign')
  @ApiOperation({ summary: 'Assign benefit to employee' })
  assignBenefit(@Body() data: AssignBenefitDto, @Request() req) {
    return this.hrService.assignBenefit(data, req.user.clientTenantId);
  }

  // ===== DOCUMENTS =====
  @Post('documents')
  @ApiOperation({ summary: 'Create employee document' })
  createDocument(@Body() data: CreateEmployeeDocumentDto, @Request() req) {
    return this.hrService.createDocument(data, req.user.clientTenantId);
  }

  @Get('documents')
  @ApiOperation({ summary: 'Get all employee documents' })
  findAllDocuments(@Request() req, @Query('employeeId') employeeId?: string) {
    return this.hrService.findAllDocuments(req.user.clientTenantId, employeeId);
  }

  @Delete('documents/:id')
  @ApiOperation({ summary: 'Delete employee document' })
  deleteDocument(@Param('id') id: string, @Request() req) {
    return this.hrService.deleteDocument(id, req.user.clientTenantId);
  }

  // ===== DASHBOARD & ANALYTICS =====
  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get HR dashboard statistics' })
  getDashboardStats(@Request() req) {
    return this.hrService.getDashboardStats(req.user.clientTenantId);
  }

  @Get('analytics/headcount')
  @ApiOperation({ summary: 'Get headcount analytics' })
  getHeadcountAnalytics(@Request() req) {
    return this.hrService.getHeadcountAnalytics(req.user.clientTenantId);
  }

  @Get('analytics/turnover')
  @ApiOperation({ summary: 'Get turnover rate' })
  getTurnoverRate(@Request() req) {
    return this.hrService.getTurnoverRate(req.user.clientTenantId);
  }
}
