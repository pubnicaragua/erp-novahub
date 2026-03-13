import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        // 1. Configuramos el Pool de conexiones usando tu variable de entorno
        // Para NestJS en ejecución, usamos DATABASE_URL (el pooler)
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });

        // 2. Creamos el adaptador específico para Prisma 7
        const adapter = new PrismaPg(pool);

        // 3. Pasamos el adaptador a la clase base (PrismaClient)
        super({ adapter });
    }

    async onModuleInit() {
        // Se ejecuta cuando el servidor de NestJS arranca
        await this.$connect();
        console.log('🚀 Nova Hub: Conexión con Supabase establecida con éxito.');
    }

    async onModuleDestroy() {
        // Se asegura de cerrar la conexión si el servidor se apaga
        await this.$disconnect();
    }
}