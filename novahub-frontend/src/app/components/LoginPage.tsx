import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { NovaHubLogo } from './NovaHubLogo';

interface LoginPageProps {
  onLogin: (email: string, password: string) => void;
}

const demoUsers = [
  { email: 'superadmin@novahub.com', password: 'admin123', role: 'Super Admin', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { email: 'partner@demo.com',    password: 'admin123', role: 'Partner',    color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  { email: 'gerente@empresa-demo.com', password: 'Gerente2025!', role: 'Gerente (Demo)', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
];

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Ingresa tu correo y contraseña');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onLogin(email, password);
    } catch (err: any) {
      setError(err.message || 'Credenciales incorrectas. Verifica tu correo y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (u: typeof demoUsers[0]) => {
    setEmail(u.email);
    setPassword(u.password);
    setError('');
    setLoading(true);
    try {
      await onLogin(u.email, u.password);
    } catch (err: any) {
      setError(err.message || 'Error en el acceso rápido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Background ambient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-60 -right-60 size-[500px] rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute -bottom-60 -left-60 size-[500px] rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[800px] rounded-full bg-emerald-500/3 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        <Card className="border-border/40 shadow-2xl shadow-black/20 backdrop-blur-sm">
          <CardContent className="p-8 md:p-10">

            {/* Logo + Brand */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="mb-8 text-center"
            >
              <div className="flex justify-center mb-4">
                <NovaHubLogo size={64} />
              </div>
              <h1 className="text-2xl font-black tracking-tight">
                Nova<span className="text-emerald-500">Hub</span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">Enterprise Resource Planning</p>
            </motion.div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {error}
                </motion.div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@empresa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Contraseña</Label>
                  <button type="button" className="text-xs text-emerald-500 hover:text-emerald-400 hover:underline transition-colors">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Ingresa tu contraseña"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="remember" />
                <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                  Mantener sesión iniciada
                </label>
              </div>

              <Button type="submit" className="w-full h-11 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                {loading ? 'Ingresando...' : 'Iniciar Sesión'}
              </Button>
            </form>

            {/* Demo credentials */}
            <div className="mt-8 pt-6 border-t border-border/40">
              <p className="text-[11px] font-semibold text-muted-foreground mb-3 uppercase tracking-widest text-center">
                Acceso Demo — Click para ingresar
              </p>
              <div className="grid gap-2">
                {demoUsers.map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => quickLogin(u)}
                    className="flex justify-between items-center px-3 py-2 rounded-lg bg-muted/20 hover:bg-muted/50 border border-border/40 hover:border-emerald-500/30 transition-all text-xs text-left group"
                  >
                    <span className="font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                      {u.email}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${u.color}`}>
                      {u.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <p className="mt-6 text-center text-[11px] text-muted-foreground/50">
              Nova<span className="text-emerald-500/70">Hub</span> ERP v1.0.0 &copy; 2026
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
