import { api } from './api';

/**
 * Tipo de respuesta devuelto por `/auth/login` y `/auth/register-tenant`.
 * El backend devuelve un JWT + el usuario creado/recuperado.
 */
export interface AuthResponse {
  access_token: string;
  user: any;
}

/**
 * Payload para el registro self-service de tenant (free trial 3 días).
 * Endpoint: `POST /auth/register-tenant`
 */
export interface RegisterTenantDto {
  companyName: string;
  userName: string;
  email: string;
  password: string;
}

export const authService = {
  /**
   * Login clásico.
   */
  login: (dto: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', dto),

  /**
   * Registro self-service de un nuevo tenant con trial de 3 días.
   * Devuelve el mismo `AuthResponse` que `/auth/login` para hacer auto-login.
   */
  registerTenant: (dto: RegisterTenantDto) =>
    api.post<AuthResponse>('/auth/register-tenant', dto),
};