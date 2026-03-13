import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsNumber, IsDateString, IsEnum, IsDecimal, IsInt, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// ===== DEPARTMENT DTOs =====
export class CreateDepartmentDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  budget?: number;
}

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}

// ===== POSITION DTOs =====
export class CreatePositionDto {
  @ApiProperty()
  @IsString()
  departmentId: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  minSalary?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  maxSalary?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  responsibilities?: string;
}

export class UpdatePositionDto extends PartialType(CreatePositionDto) {}

// ===== EMPLOYEE DTOs =====
export class CreateEmployeeDto {
  @ApiProperty()
  @IsString()
  employeeNumber: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty()
  @IsDateString()
  hireDate: string;

  @ApiProperty()
  @IsString()
  departmentId: string;

  @ApiProperty()
  @IsString()
  positionId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiProperty({ enum: ['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN', 'TEMPORARY', 'FREELANCE'] })
  @IsEnum(['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN', 'TEMPORARY', 'FREELANCE'])
  contractType: string;

  @ApiProperty()
  @IsNumber()
  salary: number;

  @ApiProperty({ default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {}

export class BulkImportEmployeeDto {
  @ApiProperty({ type: [CreateEmployeeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEmployeeDto)
  employees: CreateEmployeeDto[];
}

// ===== PAYROLL DTOs =====
export class CreatePayrollDto {
  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty()
  @IsDateString()
  periodStart: string;

  @ApiProperty()
  @IsDateString()
  periodEnd: string;

  @ApiProperty()
  @IsNumber()
  baseSalary: number;

  @ApiProperty({ default: 0 })
  @IsOptional()
  @IsNumber()
  bonuses?: number;

  @ApiProperty({ default: 0 })
  @IsOptional()
  @IsNumber()
  deductions?: number;

  @ApiProperty({ default: 0 })
  @IsOptional()
  @IsNumber()
  overtime?: number;

  @ApiProperty({ default: 0 })
  @IsOptional()
  @IsNumber()
  taxes?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkProcessPayrollDto {
  @ApiProperty()
  @IsDateString()
  periodStart: string;

  @ApiProperty()
  @IsDateString()
  periodEnd: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  employeeIds?: string[];
}

// ===== ATTENDANCE DTOs =====
export class ClockInDto {
  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ClockOutDto {
  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateAttendanceDto {
  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiProperty({ enum: ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'REMOTE'] })
  @IsEnum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'REMOTE'])
  status: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  checkOut?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  hoursWorked?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  overtimeHours?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ===== LEAVE REQUEST DTOs =====
export class CreateLeaveRequestDto {
  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty({ enum: ['VACATION', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'UNPAID', 'BEREAVEMENT', 'OTHER'] })
  @IsEnum(['VACATION', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'UNPAID', 'BEREAVEMENT', 'OTHER'])
  leaveType: string;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiProperty()
  @IsNumber()
  days: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ApproveLeaveRequestDto {
  @ApiProperty()
  @IsString()
  approvedBy: string;
}

export class RejectLeaveRequestDto {
  @ApiProperty()
  @IsString()
  rejectionReason: string;
}

// ===== PERFORMANCE REVIEW DTOs =====
export class CreatePerformanceReviewDto {
  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty()
  @IsString()
  reviewerId: string;

  @ApiProperty()
  @IsDateString()
  reviewPeriodStart: string;

  @ApiProperty()
  @IsDateString()
  reviewPeriodEnd: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  overallRating?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  goals?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  achievements?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  areasOfImprovement?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comments?: string;
}

export class UpdatePerformanceReviewDto extends PartialType(CreatePerformanceReviewDto) {}

// ===== TRAINING DTOs =====
export class CreateTrainingDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  instructor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  capacity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  cost?: number;
}

export class UpdateTrainingDto extends PartialType(CreateTrainingDto) {}

export class EnrollEmployeeDto {
  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty()
  @IsString()
  trainingId: string;
}

export class CompleteTrainingDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  score?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  certificateUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ===== BENEFIT DTOs =====
export class CreateBenefitDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  cost?: number;
}

export class UpdateBenefitDto extends PartialType(CreateBenefitDto) {}

export class AssignBenefitDto {
  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty()
  @IsString()
  benefitId: string;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ===== DOCUMENT DTOs =====
export class CreateEmployeeDocumentDto {
  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty()
  @IsString()
  fileUrl: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
