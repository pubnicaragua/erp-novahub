import React, { useState } from 'react';
import { 
  Users, UserPlus, Search, TrendingUp, CreditCard, CheckCircle2, Eye, Trash2
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { customersService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import type { Customer } from '../../types';
import { Badge } from '../ui/badge';

interface ClientesViewProps {
  data: Customer[];
  loading: boolean;
  onRefresh: () => void;
}

export function ClientesView({ data, loading, onRefresh }: ClientesViewProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = data.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdate = async (id: string | number, updates: Partial<Customer>) => {
    try {
      await customersService.update(id.toString(), updates);
      toast.success('Cliente actualizado correctamente');
      onRefresh();
    } catch (error) {
      toast.error('Error al actualizar cliente');
      throw error;
    }
  };

  const handleAddClient = async () => {
    try {
      const code = `CLI-${Date.now().toString().slice(-6)}`;
      const resp = await customersService.create({
        code,
        name: 'Nuevo Cliente',
        type: 'COMPANY'
      });
      toast.success('Nuevo cliente creado');
      onRefresh();
    } catch (error) {
      console.error('Error creating customer:', error);
      toast.error('Error al crear cliente');
    }
  };

  const columns: ColumnDef<Customer>[] = [
    { 
      key: 'code', 
      header: 'ID / Código', 
      width: '120px',
      render: (val, row) => <span className="text-[11px] font-black font-mono text-muted-foreground/60">{val || row.id.slice(0, 8)}</span>
    },
    { 
      key: 'name', 
      header: 'Nombre del Cliente', 
      editable: true,
      render: (val) => (
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center font-black text-primary text-xs border border-primary/20">
            {val.charAt(0)}
          </div>
          <span className="text-[13px] font-bold text-foreground">{val}</span>
        </div>
      )
    },
    { key: 'contactName', header: 'Contacto', editable: true },
    { key: 'email', header: 'Email / Envío', editable: true },
    { 
      key: 'balance', 
      header: 'Saldo Deudor', 
      width: '150px',
      render: (val) => (
        <span className={cn(
          "text-[13px] font-black tabular-nums",
          (val || 0) > 0 ? "text-rose-500" : "text-emerald-500"
        )}>
          ${(val || 0).toLocaleString()}
        </span>
      )
    },
    { 
      key: 'status', 
      header: 'Estado', 
      width: '120px',
      editable: true,
      type: 'select',
      options: [
        { label: 'Operativo', value: 'active', color: 'bg-emerald-500/10 text-emerald-500' },
        { label: 'Inactivo', value: 'inactive', color: 'bg-muted/20 text-muted-foreground' }
      ],
      render: (val) => (
        <Badge variant="outline" className={cn(
          "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none",
          val === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted/20 text-muted-foreground'
        )}>
          {val === 'active' ? 'Operativo' : 'Inactivo'}
        </Badge>
      )
    }
  ];

  const kpis = [
    { title: 'Clientes Activos', value: data.filter(c => c.status === 'active').length, icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Saldo Pendiente', value: `$${data.reduce((acc, c) => acc + (c.balance || 0), 0).toLocaleString()}`, icon: CreditCard, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Nuevos (Mes)', value: '12', icon: TrendingUp, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { title: 'Tasa Retención', value: '98%', icon: CheckCircle2, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* KPIs Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden relative group">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-xl shadow-inner", kpi.bg, kpi.color)}>
                  <kpi.icon className="size-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p>
                  <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{kpi.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Directorio de Clientes</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Gestión integral Excel-like sin interrupciones.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input 
                placeholder="Buscar cliente..." 
                className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold uppercase tracking-widest"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button 
               onClick={handleAddClient}
               className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20"
            >
              <UserPlus className="size-4" /> Nuevo Cliente
            </Button>
          </div>
        </div>

        <EditableDataTable 
          data={filtered}
          columns={columns}
          onRowUpdate={handleUpdate}
          onAddRow={handleAddClient}
          isLoading={loading}
          actions={(row) => (
            <div className="flex items-center gap-1">
               <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"><Eye className="size-4" /></Button>
               <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={() => customersService.delete(row.id).then(() => onRefresh())}><Trash2 className="size-4" /></Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
