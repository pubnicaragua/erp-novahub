import { SystemRole } from "@prisma/client";

export class User {
    id: string;
    clientTenantId: string;
    email: string;
    name: string;
    avatar?: string;
    role: SystemRole;
    isActive: boolean;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
