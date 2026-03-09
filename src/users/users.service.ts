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

  async findAll() {
    return this.prisma.user.findMany();
  }

  async findOne(id: string) { // Cambiamos a string porque usamos UUID
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  async remove(id: string) {
    return this.prisma.user.delete({
      where: { id }
    });
  }
}