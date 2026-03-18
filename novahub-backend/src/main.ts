import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ─── CORS ───────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: [
      'http://localhost:5173',  // Vite dev
      'http://localhost:4173',  // Vite preview
      'http://localhost:3001',  // alt dev
      process.env.FRONTEND_URL, // producción
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ─── Global prefix ───────────────────────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ─── Validation ─────────────────────────────────────────────────────────────
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false }));

  // ─── Swagger ─────────────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('NovaHub ERP API')
    .setDescription('API completa del ERP NovaHub')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 NovaHub API running at http://localhost:${process.env.PORT ?? 3000}/api`);
  console.log(`📖 Swagger docs at   http://localhost:${process.env.PORT ?? 3000}/docs`);
}
bootstrap();
