import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  // Ubicación del archivo de esquema
  schema: "prisma/schema.prisma",
  
  // En Prisma 7, el bloque datasource en el config sustituye al del schema para el CLI
  datasource: {
    // Usamos DIRECT_URL para tener permisos de creación de tablas/enums en Supabase
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },

  // Configuración para las migraciones
  migrations: {
    path: "prisma/migrations",
  },
});