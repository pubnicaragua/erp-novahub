import React, { useState } from 'react';
import { 
  Users, UserPlus, Search, TrendingUp, CreditCard, CheckCircle2, Eye, Trash2, Plus, RefreshCw
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { customersService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import type { Customer } from '../../types';
import { Badge } from '../ui/badge';
import { useCurrency } from '../../contexts/CurrencyContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { CustomerDetailsModal } from './CustomerDetailsModal';

interface ClientesViewProps {
  data: Customer[];
  loading: boolean;
  onRefresh: () => void;
}

export function ClientesView({ data, loading, onRefresh }: ClientesViewProps) {
  const { formatConvertedAmount } = useCurrency();
  const { canPerform } = useAuth();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);


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
      await customersService.create({
        code,
        name: 'Nuevo Cliente',
        type: 'individual' as any
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
      editable: canPerform('SALES_CLIENTS', 'edit'),
      render: (val) => (
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center font-black text-primary text-xs border border-primary/20">
            {val.charAt(0)}
          </div>
          <span className="text-[13px] font-bold text-foreground">{val}</span>
        </div>
      )
    },
    { key: 'contactName', header: 'Contacto', editable: canPerform('SALES_CLIENTS', 'edit') },
    { 
      key: 'type', 
      header: 'Tipo', 
      width: '120px',
      editable: canPerform('SALES_CLIENTS', 'edit'),
      type: 'select',
      options: [
        { label: 'Particular', value: 'INDIVIDUAL', color: 'bg-blue-500/10 text-blue-500' },
        { label: 'Empresa', value: 'COMPANY', color: 'bg-purple-500/10 text-purple-500' }
      ],
      render: (val) => (
        <Badge variant="outline" className={cn(
          "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none",
          (val || '').toUpperCase() === 'COMPANY' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'
        )}>
          {(val || '').toUpperCase() === 'COMPANY' ? 'Empresa' : 'Particular'}
        </Badge>
      )
    },
    { key: 'email', header: 'Email / Envío', editable: canPerform('SALES_CLIENTS', 'edit') },
    { key: 'phone', header: 'Teléfono', width: '130px', editable: canPerform('SALES_CLIENTS', 'edit') },
    { 
      key: 'balance', 
      header: 'Saldo Deudor', 
      width: '150px',
      render: (val) => (
        <span className={cn(
          "text-[13px] font-black tabular-nums",
          (val || 0) > 0 ? "text-rose-500" : "text-emerald-500"
        )}>
          {formatConvertedAmount(val || 0, 'NIO')}
        </span>
      )
    },
    { 
      key: 'status', 
      header: 'Estado', 
      width: '120px',
      editable: canPerform('SALES_CLIENTS', 'edit'),
      type: 'select',
      options: [
        { label: 'Activo', value: 'ACTIVE', color: 'bg-emerald-500/10 text-emerald-500' },
        { label: 'Inactivo', value: 'INACTIVE', color: 'bg-muted/20 text-muted-foreground' }
      ],
      render: (val) => (
        <Badge variant="outline" className={cn(
          "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none",
          (val || '').toUpperCase() === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted/20 text-muted-foreground'
        )}>
          {(val || '').toUpperCase() === 'ACTIVE' ? 'Activo' : 'Inactivo'}
        </Badge>
      )
    }
  ];

  const activeCount = data.filter(c => (c.status || '').toUpperCase() === 'ACTIVE').length;
  const inactiveCount = data.length - activeCount;

  const activeBalance = data.filter(c => (c.status || '').toUpperCase() === 'ACTIVE').reduce((acc, c) => acc + Number(c.balance || 0), 0);
  const inactiveBalance = data.filter(c => (c.status || '').toUpperCase() !== 'ACTIVE').reduce((acc, c) => acc + Number(c.balance || 0), 0);
  const totalBalance = activeBalance + inactiveBalance;

  const kpis = [
    { 
      title: 'Total Clientes', 
      value: data.length, 
      subValue: `${activeCount} Activos / ${inactiveCount} Inactivos`,
      icon: Users, 
      color: 'text-primary', 
      bg: 'bg-primary/10' 
    },
    { 
      title: 'Particulares', 
      value: data.filter(c => (c.type || '').toUpperCase() === 'INDIVIDUAL').length, 
      icon: Users, 
      color: 'text-blue-500', 
      bg: 'bg-blue-500/10' 
    },
    { 
      title: 'Empresas', 
      value: data.filter(c => (c.type || '').toUpperCase() === 'COMPANY').length, 
      icon: CheckCircle2, 
      color: 'text-amber-500', 
      bg: 'bg-amber-500/10' 
    },
    { 
      title: 'Saldo Pendiente', 
      value: formatConvertedAmount(totalBalance, 'NIO'), 
      subValue: `${formatConvertedAmount(activeBalance, 'NIO')} activos`,
      icon: CreditCard, 
      color: 'text-rose-500', 
      bg: 'bg-rose-500/10' 
    },
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
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p>
                  <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{kpi.value}</p>
                  {kpi.subValue && (
                    <p className="text-[10px] font-bold text-muted-foreground/40 mt-0.5 truncate">{kpi.subValue}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Directorio de Clientes</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Gestión integral Excel-like sin interrupciones.</p>
          </div>
          <div className="flex items-center gap-3">
            {canPerform('SALES_CLIENTS', 'create') && (
              <Button 
                onClick={handleAddClient}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20"
              >
                <UserPlus className="size-4" /> Nuevo Cliente
              </Button>
            )}
          </div>
        </div>

        <EditableDataTable 
          data={data}
          showSelection={false}
          onBulkDelete={async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await customersService.delete(id as string);
              }
              toast.success('Elementos eliminados');
              onRefresh();
            } catch (e) {
              toast.error('Error al eliminar');
            }
          }}
          columns={columns}
          onRowUpdate={handleUpdate}
          allowAddRow={false}
          isLoading={loading}
          actions={(row) => (
            <div className="flex items-center gap-1">
               <Button variant="ghost" size="icon" title="Ver detalle" className="size-8 rounded-lg text-primary hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setSelectedCustomer(row)}><Eye className="size-4" /></Button>
               <Button 
                 variant="ghost" 
                 size="icon" 
                 title="Recalcular Saldo" 
                 className="size-8 rounded-lg text-amber-500 hover:bg-amber-500/10 hover:text-amber-500 transition-colors" 
                 onClick={async () => {
                   try {
                     await toast.promise(customersService.recalculateBalance(row.id), {
                       loading: 'Recalculando saldo...',
                       success: 'Saldo recalculado exitosamente',
                       error: 'Error al recalcular saldo'
                     });
                     onRefresh();
                   } catch (e) {
                     console.error(e);
                   }
                 }}
               >
                 <RefreshCw className="size-4" />
               </Button>
               {canPerform('SALES_CLIENTS', 'delete') && (
                 <Button 
                   variant="ghost" 
                   size="icon" 
                   title="Eliminar Cliente" 
                   className="size-8 rounded-lg text-rose-500 hover:bg-rose-500/10 hover:text-rose-500 transition-colors" 
                   onClick={() => setPendingDeleteId(row.id)}
                 >
                   <Trash2 className="size-4" />
                 </Button>
               )}
            </div>
          )}
        />
      </div>

      <CustomerDetailsModal
        customer={selectedCustomer}
        open={selectedCustomer !== null}
        onOpenChange={(open) => !open && setSelectedCustomer(null)}
      />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
        title="¿Eliminar cliente?"
        description="Si el cliente tiene transacciones activas (facturas, pedidos, pagos), no se podrá eliminar."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          try {
            setDeleteLoading(true);
            await customersService.delete(pendingDeleteId);
            toast.success('Cliente eliminado correctamente');
            onRefresh();
          } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || '';
            if (msg.includes('foreign') || msg.includes('constraint') || msg.includes('reference') || error?.status === 409) {
              toast.error('No se puede eliminar: este cliente tiene transacciones activas (facturas, pedidos, pagos, etc.)');
            } else {
              toast.error(`Error al eliminar cliente: ${msg}`);
            }
          } finally {
            setDeleteLoading(false);
            setPendingDeleteId(null);
          }
        }}
      />
    </div>
  );
}

