import { EmployeeStatus } from "@prisma/client";

export class Employee {
    id: string;
    clientTenantId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
    hireDate: Date;
    jobTitle?: string;
    status: EmployeeStatus;
    createdAt: Date;
    updatedAt: Date;
}
