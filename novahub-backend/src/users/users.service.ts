import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Asegúrate de la ruta
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  // Inyectamos Prisma para hablar con Supabase
  constructor(private prisma: PrismaService) { }

  private throwFriendlyPrismaError(error: any): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('El correo ya está registrado en Nova Hub');
      }
      if (error.code === 'P2003') {
        throw new BadRequestException('No se puede completar la operación por una relación de datos inválida');
      }
    }
    throw error;
  }

  async create(createUserDto: CreateUserDto) {
    try {
      return await this.prisma.user.create({
        data: createUserDto,
      });
    } catch (error) {
      this.throwFriendlyPrismaError(error);
    }
  }

  async findAll(clientTenantId: string) {
    return this.prisma.user.findMany({
      where: { clientTenantId }
    });
  }

  async findOne(id: string, clientTenantId: string) {
    const user = await this.prisma.user.findFirst({ 
      where: { id, clientTenantId } 
    });
    if (!user) throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    return user;
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { clientTenant: true }
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { clientTenant: true }
    });
  }

  async update(id: string, clientTenantId: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({
      where: { id, clientTenantId }
    });
    if (!user) throw new NotFoundException(`Usuario con ID ${id} no encontrado`);

    try {
      return await this.prisma.user.update({
        where: { id },
        data: updateUserDto,
      });
    } catch (error) {
      this.throwFriendlyPrismaError(error);
    }
  }

  async remove(id: string, clientTenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, clientTenantId }
    });
    if (!user) throw new NotFoundException(`Usuario con ID ${id} no encontrado`);

    try {
      return await this.prisma.user.delete({
        where: { id }
      });
    } catch (error) {
      this.throwFriendlyPrismaError(error);
    }
  }
}
