import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Esto lo hace disponible en toda la app sin re-importarlo
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // ¡Importante exportarlo!
})
export class PrismaModule { }