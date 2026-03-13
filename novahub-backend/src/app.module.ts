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

@Module({
  imports: [
    PrismaModule, 
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
    BrandingModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
