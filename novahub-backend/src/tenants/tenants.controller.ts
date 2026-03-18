import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { SystemRole } from '@prisma/client';

@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  async create(@Request() req, @Body() createTenantDto: CreateTenantDto) {
    const user = req.user;
    
    const normalizedRole = user.role.toUpperCase();
    if (normalizedRole !== 'ADMIN' && normalizedRole !== 'PARTNER') {
      throw new ForbiddenException('No tienes permiso para crear empresas');
    }

    const partnerId = await this.tenantsService.getPartnerIdByUser(user.userId);
    
    // Si es Admin y no tiene partnerId (Super Admin global), usamos el admin partner
    const finalPartnerId = partnerId || 'master-partner-id';

    return this.tenantsService.create(finalPartnerId, createTenantDto);
  }

  @Get()
  async findAll(@Request() req) {
    const user = req.user;
    
    if (!user || !user.role) {
       return [];
    }

    const role = user.role.toUpperCase();
    
    if (role === 'ADMIN') {
      return this.tenantsService.findAll();
    }
    
    const partnerId = await this.tenantsService.getPartnerIdByUser(user.userId);
    
    if (!partnerId) {
       return [];
    }
    
    return this.tenantsService.findAll(partnerId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTenantDto: any) {
    return this.tenantsService.update(id, updateTenantDto);
  }

  @Post(':id/users')
  async addUser(@Param('id') id: string, @Body() userData: any) {
    return this.tenantsService.addUser({
      clientTenantId: id,
      ...userData,
    });
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.tenantsService.delete(id);
  }
}
