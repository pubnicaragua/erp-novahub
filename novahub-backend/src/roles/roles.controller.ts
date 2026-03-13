import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nuevo rol' })
  create(@Body() data: any, @Request() req) {
    return this.rolesService.create(data, req.user.clientTenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar roles del tenant' })
  findAll(@Request() req) {
    return this.rolesService.findAll(req.user.clientTenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver detalle de un rol' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.rolesService.findOne(id, req.user.clientTenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar rol' })
  update(@Param('id') id: string, @Body() data: any, @Request() req) {
    return this.rolesService.update(id, req.user.clientTenantId, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar rol' })
  remove(@Param('id') id: string, @Request() req) {
    return this.rolesService.remove(id, req.user.clientTenantId);
  }
}
