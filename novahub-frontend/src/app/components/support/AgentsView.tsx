import { useMemo, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Users, UserCheck, UserX, Search, RefreshCw } from 'lucide-react';
import { cn } from '../ui/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supportAgentsService } from '../../services/support.service';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useAuth } from '../../contexts/AuthContext';

interface SupportAgent {
  id: string;
  name: string;
  email: string;
  role?: string;
  isActive?: boolean;
  lastLoginAt?: string | null;
}

interface AgentsViewProps {
  data: SupportAgent[];
  tickets: Array<{ assignedToId?: string | null }>;
  loading: boolean;
  onRefresh: () => void;
}

const roleOptions = ['ADMIN', 'MANAGER', 'EMPLOYEE', 'VIEWER', 'PARTNER'];

export const AgentsView: React.FC<AgentsViewProps> = ({ data, tickets, loading, onRefresh }) => {
  const { canPerform } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const assignedCount = useMemo(() => {
    return tickets.reduce<Record<string, number>>((acc, item) => {
      if (!item.assignedToId) return acc;
      acc[item.assignedToId] = (acc[item.assignedToId] || 0) + 1;
      return acc;
    }, {});
  }, [tickets]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return data;
    return data.filter((agent) =>
      [agent.name, agent.email, agent.role]
        .map((field) => String(field || '').toLowerCase())
        .some((field) => field.includes(q)),
    );
  }, [data, searchTerm]);

  const updateAgent = async (id: string, updates: Partial<SupportAgent>) => {
    try {
      setSavingId(id);
      await supportAgentsService.update(id, updates as any);
      toast.success('Agente actualizado');
      onRefresh();
    } catch (error: any) {
      toast.error(error?.message || 'Error al actualizar agente');
    } finally {
      setSavingId(null);
    }
  };

  const activeAgents = data.filter((agent) => agent.isActive !== false).length;
  const inactiveAgents = data.length - activeAgents;
  const avgLoad = data.length > 0
    ? (data.reduce((sum, agent) => sum + (assignedCount[agent.id] || 0), 0) / data.length).toFixed(1)
    : '0.0';

  const kpis = [
    { title: 'Total Agentes', value: data.length, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Activos', value: activeAgents, icon: UserCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Inactivos', value: inactiveAgents, icon: UserX, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'Carga Promedio', value: avgLoad, icon: RefreshCw, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="border-none bg-background/50 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn('p-3 rounded-2xl flex items-center justify-center', kpi.bg)}>
                <kpi.icon className={cn('size-6', kpi.color)} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p>
                <p className="text-2xl font-black tracking-tight">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none bg-background/50 backdrop-blur-xl shadow-sm">
        <div className="p-4 border-b border-border/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">Agentes de Soporte</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
              Operadores responsables de tickets y seguimiento
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
            <Input
              placeholder="Buscar agente..."
              className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/20">
              <tr>
                <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Agente</th>
                <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Email</th>
                <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Rol</th>
                <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Estado</th>
                <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Tickets Asignados</th>
                <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Último Acceso</th>
                <th className="text-right p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Acción</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                    No hay agentes para mostrar.
                  </td>
                </tr>
              )}

              {filtered.map((agent) => {
                const isRowSaving = savingId === agent.id;
                const isActive = agent.isActive !== false;
                return (
                  <tr key={agent.id} className="border-t border-border/40 hover:bg-muted/10">
                    <td className="p-3">
                      <p className="font-semibold">{agent.name || '-'}</p>
                    </td>
                    <td className="p-3 text-muted-foreground">{agent.email || '-'}</td>
                    <td className="p-3 min-w-[160px]">
                      <Select
                        value={String(agent.role || 'EMPLOYEE').toUpperCase()}
                        onValueChange={(value) => updateAgent(agent.id, { role: value as any })}
                        disabled={isRowSaving || !canPerform('CONFIG_USERS', 'edit')}
                      >
                        <SelectTrigger className="h-9 w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-none text-[10px] font-black uppercase tracking-widest px-2 py-1',
                          isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500',
                        )}
                      >
                        {isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="p-3 font-semibold">{assignedCount[agent.id] || 0}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {agent.lastLoginAt ? format(new Date(agent.lastLoginAt), 'MMM dd, yyyy HH:mm') : 'Sin acceso'}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant={isActive ? 'outline' : 'default'}
                        size="sm"
                        disabled={isRowSaving || !canPerform('CONFIG_USERS', 'edit')}
                        onClick={() => updateAgent(agent.id, { isActive: !isActive })}
                        className="h-8 text-[10px] font-black uppercase tracking-widest"
                      >
                        {isRowSaving ? 'Guardando...' : isActive ? 'Desactivar' : 'Activar'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
