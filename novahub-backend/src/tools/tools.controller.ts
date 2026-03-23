import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CreateTicketDto, UpdateTicketDto, CreateDocumentDto, CreateActivityDto } from './dto/tools.dto';

@ApiTags('tools')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  // ─── TICKETS ─────────────────────────────────────────────────────────────
  @Post('tickets')
  @ApiOperation({ summary: 'Crear nuevo ticket de soporte' })
  createTicket(@Body() data: CreateTicketDto, @Request() req) {
    return this.toolsService.createTicket(data, req.user.clientTenantId);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'Listar tickets del tenant' })
  findAllTickets(@Request() req) {
    return this.toolsService.findAllTickets(req.user.clientTenantId);
  }

  @Patch('tickets/:id')
  @ApiOperation({ summary: 'Actualizar ticket' })
  updateTicket(@Param('id') id: string, @Body() data: UpdateTicketDto, @Request() req) {
    return this.toolsService.updateTicket(id, data, req.user.clientTenantId);
  }

  @Delete('tickets/:id')
  @ApiOperation({ summary: 'Eliminar ticket' })
  removeTicket(@Param('id') id: string, @Request() req) {
    return this.toolsService.removeTicket(id, req.user.clientTenantId);
  }

  // ─── DOCUMENTOS ──────────────────────────────────────────────────────────
  @Post('documents')
  @ApiOperation({ summary: 'Registrar nuevo documento' })
  createDocument(@Body() data: CreateDocumentDto, @Request() req) {
    return this.toolsService.createDocument(data, req.user.clientTenantId);
  }

  @Get('documents')
  @ApiOperation({ summary: 'Listar documentos' })
  findAllDocuments(@Request() req) {
    return this.toolsService.findAllDocuments(req.user.clientTenantId);
  }

  @Delete('documents/:id')
  @ApiOperation({ summary: 'Eliminar documento' })
  removeDocument(@Param('id') id: string, @Request() req) {
    return this.toolsService.removeDocument(id, req.user.clientTenantId);
  }

  // ─── ACTIVIDADES ─────────────────────────────────────────────────────────
  @Post('activities')
  @ApiOperation({ summary: 'Registrar nueva actividad' })
  createActivity(@Body() data: CreateActivityDto, @Request() req) {
    return this.toolsService.createActivity(data, req.user.clientTenantId);
  }

  @Get('activities')
  @ApiOperation({ summary: 'Listar actividades' })
  findAllActivities(@Request() req) {
    return this.toolsService.findAllActivities(req.user.clientTenantId);
  }

  @Patch('activities/:id')
  @ApiOperation({ summary: 'Actualizar actividad' })
  updateActivity(@Param('id') id: string, @Body() data: any, @Request() req) {
    return this.toolsService.updateActivity(id, data, req.user.clientTenantId);
  }

  @Delete('activities/:id')
  @ApiOperation({ summary: 'Eliminar actividad' })
  removeActivity(@Param('id') id: string, @Request() req) {
    return this.toolsService.removeActivity(id, req.user.clientTenantId);
  }

  // ─── NOTIFICACIONES ──────────────────────────────────────────────────────
  @Get('notifications')
  @ApiOperation({ summary: 'Listar notificaciones del usuario' })
  findAllNotifications(@Request() req) {
    return this.toolsService.findAllNotifications(req.user.id);
  }

  @Patch('notifications/read-all')
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  readAllNotifications(@Request() req) {
    return this.toolsService.readAllNotifications(req.user.id);
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  readNotification(@Param('id') id: string) {
    return this.toolsService.readNotification(id);
  }

  // ─── TASA DE CAMBIO ──────────────────────────────────────────────────────
  @Get('exchange-rate')
  @ApiOperation({ summary: 'Obtener tasa de cambio actual' })
  getExchangeRate(@Request() req) {
    return this.toolsService.getExchangeRate(req.user.clientTenantId);
  }

  @Post('exchange-rate')
  @ApiOperation({ summary: 'Configurar tasa de cambio' })
  updateExchangeRate(
    @Body()
    data: {
      rate?: number;
      auto?: boolean;
      displayCurrency?: 'USD' | 'NIO';
      allowCurrencySwitch?: boolean;
    },
    @Request() req,
  ) {
    return this.toolsService.updateExchangeRate(req.user.clientTenantId, data);
  }
}
