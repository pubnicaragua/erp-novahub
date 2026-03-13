import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo proyecto' })
  create(@Body() createProjectDto: any, @Request() req) {
    return this.projectsService.create(createProjectDto, req.user.clientTenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los proyectos del tenant' })
  findAll(@Request() req) {
    return this.projectsService.findAll(req.user.clientTenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalles de un proyecto' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.projectsService.findOne(id, req.user.clientTenantId);
  }

  @Post(':id/tasks')
  @ApiOperation({ summary: 'Agregar una tarea al proyecto' })
  addTask(@Param('id') id: string, @Body() createTaskDto: any, @Request() req) {
    return this.projectsService.addTask(id, createTaskDto, req.user.clientTenantId);
  }

  @Get(':id/tasks')
  @ApiOperation({ summary: 'Listar tareas de un proyecto' })
  findTasks(@Param('id') id: string, @Request() req) {
    return this.projectsService.findTasks(id, req.user.clientTenantId);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Ver cronograma del proyecto' })
  getTimeline(@Param('id') id: string, @Request() req) {
    return this.projectsService.getTimeline(id, req.user.clientTenantId);
  }
}
