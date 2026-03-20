import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Catch, ExceptionFilter, ArgumentsHost, HttpException, BadRequestException } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = exception.getStatus();
    const validationErrors = exception.getResponse();
    fs.appendFileSync('validation-errors.log', JSON.stringify({ path: request.url, body: request.body, errors: validationErrors }) + '\n');
    response.status(status).json(validationErrors);
  }
}


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
  app.useGlobalFilters(new ValidationExceptionFilter());

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
