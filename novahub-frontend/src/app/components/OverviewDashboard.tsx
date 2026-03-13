import React from 'react';
import { useAuth, type Module } from '../contexts/AuthContext';
import { AdminOverview } from './AdminOverview';
import { PartnerDashboard } from './PartnerDashboard';
import { TenantOverview } from './TenantOverview';
import { Loader2 } from 'lucide-react';

interface OverviewDashboardProps {
  onNavigate?: (module: Module) => void;
}

export function OverviewDashboard({ onNavigate }: OverviewDashboardProps) {
  const { user } = useAuth();
  const role = user?.role?.toLowerCase();

  // Loading state if user is not yet available
  if (!user) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Loader2 className="size-10 animate-spin text-primary/20" />
        <p className="font-black uppercase tracking-widest text-xs animate-pulse">Sincronizando Workspace NovaHub...</p>
      </div>
    );
  }

  // --- ADMIN ROLE ---
  if (role === 'admin') {
    return <AdminOverview />;
  }

  // --- PARTNER ROLE ---
  if (role === 'partner') {
    return <PartnerDashboard onNavigate={onNavigate} />;
  }

  // --- TENANT ROLE (Default) ---
  return <TenantOverview onNavigate={onNavigate} />;
}
