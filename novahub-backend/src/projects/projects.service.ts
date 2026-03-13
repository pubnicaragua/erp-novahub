import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async create(createProjectDto: any, clientTenantId: string) {
    return this.prisma.project.create({
      data: {
        ...createProjectDto,
        clientTenantId,
      },
    });
  }

  async findAll(clientTenantId: string) {
    return this.prisma.project.findMany({
      where: { clientTenantId },
      include: { tasks: true },
    });
  }

  async findOne(id: string, clientTenantId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, clientTenantId },
      include: { tasks: true, documents: true },
    });
    if (!project) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    return project;
  }

  async addTask(projectId: string, createTaskDto: any, clientTenantId: string) {
    return this.prisma.task.create({
      data: {
        ...createTaskDto,
        projectId,
        clientTenantId,
      },
    });
  }

  async findTasks(projectId: string, clientTenantId: string) {
    return this.prisma.task.findMany({
      where: { projectId, clientTenantId },
    });
  }

  async getTimeline(projectId: string, clientTenantId: string) {
    // Lógica simplificada de cronograma: tareas ordenadas por fecha
    return this.prisma.task.findMany({
      where: { projectId, clientTenantId },
      orderBy: { dueDate: 'asc' },
    });
  }
}
