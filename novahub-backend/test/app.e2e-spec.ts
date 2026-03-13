import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('NovaHub ERP (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    // Login mock o real para obtener token
    // Nota: El usuario debe existir en la DB de pruebas
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@novahub.com', password: 'password123' });
    
    authToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('/auth/profile (GET) - Should return 401 without token', () => {
    return request(app.getHttpServer())
      .get('/auth/profile')
      .expect(401);
  });

  describe('Ventas Module', () => {
    it('/sales/customers (POST) - Create Customer', () => {
      return request(app.getHttpServer())
        .post('/sales/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cliente Test E2E', code: 'CUST-001' })
        .expect(201);
    });

    it('/sales/customers (GET) - List Customers', () => {
      return request(app.getHttpServer())
        .get('/sales/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });

  describe('Inventario Module', () => {
    it('/inventory/products (POST) - Create Product', () => {
      return request(app.getHttpServer())
        .post('/inventory/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Producto E2E', code: 'PROD-001', price: 100 })
        .expect(201);
    });
  });

  describe('Proyectos Module', () => {
    it('/projects (POST) - Create Project', () => {
      return request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Proyecto E2E', startDate: new Date() })
        .expect(201);
    });
  });
});
