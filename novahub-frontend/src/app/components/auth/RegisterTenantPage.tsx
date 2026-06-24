/**
 * RegisterTenantPage
 *
 * Pantalla self-service de registro para el Free Trial 3 días.
 * Split-screen: izquierda branding/beneficios; derecha formulario de 4 campos
 * + checkbox de ToS + submit con emerald CTA.
 *
 * PREREQUISITOS (tareas previas del plan `2026-06-22_2330-free-trial-onboarding`):
 *   - Task 12: `src/app/services/auth.service.ts` con `registerTenant(dto)`
 *   - Task 13: `src/app/components/auth/schemas.ts` con `registerTenantSchema`
 *             y el tipo `RegisterTenantFormValues`
 *   - Refactor de `src/app/contexts/AuthContext.tsx` para exponer
 *     `login(token: string, user: User)` (hoy expone `login(email, password)`).
 *   - Dependencias a instalar: `zod` y `@hookform/resolvers` (no presentes aún).
 *
 * Ajustes aplicados respecto al snippet original:
 *   - `react-router-dom` → `react-router` (este proyecto usa react-router v7,
 *     no existe el paquete `-dom`; las exports `useNavigate` y `Link` viven
 *     en el paquete raíz).
 *   - Sin el type `User` importado (AuthContext ya lo exporta; lo usamos
 *     solo a nivel de contrato en la respuesta de authService).
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link } from 'react-router';
import {
  Package,
  Mail,
  Lock,
  User,
  Building2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Loader2,
} from 'lucide-react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { cn } from '../ui/utils';

import { authService } from '../../services/auth.service';
import { useAuth } from '../../contexts/AuthContext';
import { registerTenantSchema, type RegisterTenantFormValues } from './schemas';

export function RegisterTenantPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterTenantFormValues>({
    resolver: zodResolver(registerTenantSchema),
    defaultValues: {
      companyName: '',
      userName: '',
      email: '',
      password: '',
      acceptTerms: false,
    },
  });

  const onSubmit = async (values: RegisterTenantFormValues) => {
    setSubmitting(true);
    try {
      const response: any = await authService.registerTenant({
        companyName: values.companyName,
        userName: values.userName,
        email: values.email,
        password: values.password,
      });

      const token = response?.access_token || response?.data?.access_token;
      const user = response?.user || response?.data?.user;

      if (token && user) {
        setSession(token, user);
        toast.success('¡Bienvenido! Tu prueba de 3 días comenzó');
        navigate('/dashboard');
      } else {
        toast.error('Respuesta inesperada del servidor');
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.message || e?.message || 'Error al crear la cuenta';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ===== Columna izquierda: branding ===== */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute -top-20 -right-20 size-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 size-96 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="size-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Package className="size-7 text-white" />
            </div>
            <span className="text-2xl font-black tracking-tighter">NovaHub</span>
          </div>

          <h1 className="text-5xl font-black tracking-tighter leading-tight mb-6">
            Probá NovaHub
            <br />
            gratis por 3 días
          </h1>
          <p className="text-emerald-100 text-lg max-w-md mb-10">
            Acceso completo a las herramientas que usan las empresas que crecen.
            Sin tarjeta, sin compromiso.
          </p>

          <ul className="space-y-3 max-w-md">
            {[
              'Ventas, Inventario y Compras integrados',
              'Reportes en tiempo real con datos reales',
              'Configura tu empresa en minutos',
              'Soporte por email incluido',
            ].map((benefit) => (
              <li key={benefit} className="flex items-start gap-3">
                <CheckCircle2 className="size-5 text-emerald-300 shrink-0 mt-0.5" />
                <span className="text-emerald-50">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 text-xs text-emerald-200/80">
          © {new Date().getFullYear()} NovaHub. Todos los derechos reservados.
        </div>
      </div>

      {/* ===== Columna derecha: formulario ===== */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-10 bg-background">
        <div className="w-full max-w-md space-y-6">
          {/* Logo mobile (oculto en lg+) */}
          <div className="lg:hidden flex items-center gap-3 mb-4">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package className="size-6 text-primary" />
            </div>
            <span className="text-xl font-black tracking-tighter">NovaHub</span>
          </div>

          <div>
            <h2 className="text-3xl font-black tracking-tighter uppercase italic">
              Crear <span className="text-primary">cuenta</span>
            </h2>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Empezá tu prueba gratuita. Sin tarjeta de crédito.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* companyName */}
            <div className="space-y-1.5">
              <Label
                htmlFor="companyName"
                className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1"
              >
                Nombre de empresa
              </Label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="companyName"
                  {...register('companyName')}
                  placeholder="Ej: Mi Empresa S.A."
                  autoComplete="organization"
                  className={cn(
                    'h-11 pl-11 rounded-xl bg-white/5 border-white/10',
                    errors.companyName && 'border-destructive',
                  )}
                />
              </div>
              {errors.companyName && (
                <p className="text-xs text-destructive ml-1">
                  {errors.companyName.message}
                </p>
              )}
            </div>

            {/* userName */}
            <div className="space-y-1.5">
              <Label
                htmlFor="userName"
                className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1"
              >
                Tu nombre
              </Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="userName"
                  {...register('userName')}
                  placeholder="Juan Pérez"
                  autoComplete="name"
                  className={cn(
                    'h-11 pl-11 rounded-xl bg-white/5 border-white/10',
                    errors.userName && 'border-destructive',
                  )}
                />
              </div>
              {errors.userName && (
                <p className="text-xs text-destructive ml-1">
                  {errors.userName.message}
                </p>
              )}
            </div>

            {/* email */}
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1"
              >
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="email"
                  {...register('email')}
                  type="email"
                  placeholder="tu@empresa.com"
                  autoComplete="email"
                  className={cn(
                    'h-11 pl-11 rounded-xl bg-white/5 border-white/10',
                    errors.email && 'border-destructive',
                  )}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive ml-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* password */}
            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1"
              >
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="password"
                  {...register('password')}
                  type="password"
                  placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número"
                  autoComplete="new-password"
                  className={cn(
                    'h-11 pl-11 rounded-xl bg-white/5 border-white/10',
                    errors.password && 'border-destructive',
                  )}
                />
              </div>
              {errors.password && (
                <p className="text-xs text-destructive ml-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* acceptTerms */}
            <div className="space-y-1.5 pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  id="acceptTerms"
                  {...register('acceptTerms')}
                  className="mt-1 size-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/30"
                />
                <span className="text-xs text-muted-foreground">
                  Acepto los{' '}
                  <a href="#" className="text-primary hover:underline">
                    términos de servicio
                  </a>{' '}
                  y la{' '}
                  <a href="#" className="text-primary hover:underline">
                    política de privacidad
                  </a>
                  .
                </span>
              </label>
              {errors.acceptTerms && (
                <p className="text-xs text-destructive ml-1">
                  {errors.acceptTerms.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest gap-2 shadow-lg shadow-emerald-900/40 mt-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creando cuenta...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Comenzar prueba gratis
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground pt-2">
              ¿Ya tenés cuenta?{' '}
              <Link to="/login" className="text-primary font-bold hover:underline">
                Iniciar sesión
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default RegisterTenantPage;
