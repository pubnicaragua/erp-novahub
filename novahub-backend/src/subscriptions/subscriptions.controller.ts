import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionRequestDto } from './dto/create-subscription-request.dto';
import { UpdateSubscriptionStatusDto } from './dto/update-subscription-status.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantsService } from '../tenants/tenants.service';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    @Inject(forwardRef(() => TenantsService))
    private readonly tenantsService: TenantsService
  ) {}

  @Post('request')
  @ApiOperation({ summary: 'Partner solicita habilitar un módulo para un cliente' })
  async createRequest(@Request() req, @Body() dto: CreateSubscriptionRequestDto) {
    let partnerId = await this.tenantsService.getPartnerIdByUser(req.user.userId);
    
    // Si no hay partnerId pero es ADMIN, usamos el primer partner disponible
    if (!partnerId && req.user.role.toUpperCase() === 'ADMIN') {
      const firstPartner = await this.tenantsService.getFirstPartner();
      partnerId = firstPartner?.id || null;
    }

    if (!partnerId) throw new ForbiddenException('No posees un perfil de Partner válido');
    return this.subscriptionsService.createRequest(partnerId, dto);
  }

  @Get('requests')
  @ApiOperation({ summary: 'Listar todas las solicitudes (Super Admin)' })
  findAllRequests() {
    return this.subscriptionsService.findAllRequests();
  }

  @Get('requests/partner')
  @ApiOperation({ summary: 'Listar solicitudes propias del Partner' })
  async findPartnerRequests(@Request() req) {
    const partnerId = await this.tenantsService.getPartnerIdByUser(req.user.userId);
    if (!partnerId) return [];
    return this.subscriptionsService.findPartnerRequests(partnerId);
  }

  @Patch('requests/:id/status')
  @ApiOperation({ summary: 'Aprobar o rechazar solicitud (Super Admin)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateSubscriptionStatusDto) {
    return this.subscriptionsService.updateRequestStatus(id, dto);
  }

  @Get('enabled/:clientTenantId')
  @ApiOperation({ summary: 'Obtener módulos habilitados para un tenant' })
  getEnabledModules(@Param('clientTenantId') clientTenantId: string) {
    return this.subscriptionsService.getEnabledModules(clientTenantId);
  }
}
