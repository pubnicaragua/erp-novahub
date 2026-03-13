import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Asegúrate de la ruta
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  // Inyectamos Prisma para hablar con Supabase
  constructor(private prisma: PrismaService) { }

  async create(createUserDto: CreateUserDto) {
    try {
      return await this.prisma.user.create({
        data: createUserDto,
      });
    } catch (error) {
      // P2002 es el código de Prisma para "Unique constraint failed" (email duplicado)
      if (error.code === 'P2002') {
        throw new ConflictException('El correo ya está registrado en Nova Hub');
      }
      throw error;
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
    return this.prisma.user.update({
      where: { id, clientTenantId },
      data: updateUserDto,
    });
  }

  async remove(id: string, clientTenantId: string) {
    return this.prisma.user.delete({
      where: { id, clientTenantId }
    });
  }
}