import { IndustryType, BillingPlanType } from "@prisma/client";

export class Tenant {
    id: string;
    partnerId: string;
    name: string;
    slug: string;
    logo?: string;
    primaryColor?: string;
    industry: IndustryType;
    plan: BillingPlanType;
    isActive: boolean;
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
