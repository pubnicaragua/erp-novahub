import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SalesModule } from './sales/sales.module';
import { PurchasesModule } from './purchases/purchases.module';
import { InventoryModule } from './inventory/inventory.module';
import { FinancialsModule } from './financials/financials.module';
import { HrModule } from './hr/hr.module';
import { ProjectsModule } from './projects/projects.module';
import { TenantsModule } from './tenants/tenants.module';
import { ToolsModule } from './tools/tools.module';
import { RolesModule } from './roles/roles.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { BrandingModule } from './branding/branding.module';
import { ActivitiesModule } from './activities/activities.module';
import { DocumentsModule } from './documents/documents.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CommonModule } from './common/common.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule, 
    CommonModule,
    UsersModule, 
    AuthModule, 
    SalesModule, 
    PurchasesModule, 
    InventoryModule, 
    FinancialsModule, 
    HrModule, 
    ProjectsModule, 
    TenantsModule, 
    ToolsModule, 
    RolesModule, 
    SubscriptionsModule,
    BrandingModule,
    ActivitiesModule,
    DocumentsModule,
    NotificationsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
