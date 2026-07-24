import { api } from './api';

export interface AuthResponse {
  access_token: string;
  user: any;
}

export interface RegisterTenantDto {
  companyName: string;
  userName: string;
  email: string;
  password: string;
  industry?: string;
  subIndustry?: string;
  companySize?: string;
  companyDescription?: string;
  selectedModules?: string[];
  logo?: string;
  roles?: { name: string; allowedModules: string[]; permissions: any[] }[];
  users?: { name: string; email: string; password?: string; roleName?: string }[];
}

export interface ModuleRecommendation {
  module: string;
  name: string;
  price: number;
}

export interface ModuleRecommendationsResponse {
  recommended: ModuleRecommendation[];
  optional: ModuleRecommendation[];
  description: string;
  icon: string;
}

export const authService = {
  login: (dto: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', dto),

  registerTenant: (dto: RegisterTenantDto) =>
    api.post<AuthResponse>('/auth/register-tenant', dto),

  getModuleRecommendations: (industry: string, size?: string) =>
    api.get<ModuleRecommendationsResponse>(`/auth/module-recommendations/${industry}${size ? `?size=${size}` : ''}`),

  checkEmail: (email: string) =>
    api.get<{ exists: boolean }>(`/auth/check-email?email=${encodeURIComponent(email)}`),
};