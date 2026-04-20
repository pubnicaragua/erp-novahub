import { useState } from 'react';
import { Truck, Plus, Search, Eye, Trash2, TrendingDown, CheckCircle2, UserX, RefreshCw, UserPlus } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { suppliersService } from '../../services/compras.service';
import type { Supplier } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { SupplierHistoryModal } from './SupplierHistoryModal';
import { useCurrency } from '../../contexts/CurrencyContext';

interface ProveedoresViewProps { data: Supplier[]; loading: boolean; onRefresh: () => void; }

export function ProveedoresView({ data, loading, onRefresh }: ProveedoresViewProps) {
  const { canPerform } = useAuth();
  const { formatConvertedAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [balanceOrder, setBalanceOrder] = useState<'all' | 'highest' | 'lowest'>('all');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedSupplierForHistory, setSelectedSupplierForHistory] = useState<Supplier | null>(null);

  const filtered = data.filter(s => {
    const search = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(search) ||
      (s.email || '').toLowerCase().includes(search) ||
      (s.code || '').toLowerCase().includes(search) ||
      (s.phone || '').toLowerCase().includes(search)
    );
  });

  const filteredAndSorted = [...filtered].sort((a, b) => {
    if (balanceOrder === 'highest') return Number(b.balance || 0) - Number(a.balance || 0);
    if (balanceOrder === 'lowest') return Number(a.balance || 0) - Number(b.balance || 0);
    return 0;
  });

  const statusOptions = [
    { label: 'Activo',   value: 'ACTIVE',   color: 'bg-emerald-500/10 text-emerald-500' },
    { label: 'Inactivo', value: 'INACTIVE', color: 'bg-muted/20 text-muted-foreground' },
  ];

  const columns: ColumnDef<Supplier>[] = [
    { key: 'code',        header: 'Código',    width: '110px', editable: canPerform('proveedores', 'edit') },
    { key: 'name',        header: 'Nombre',    editable: canPerform('proveedores', 'edit') },
    { key: 'contactName', header: 'Contacto',  editable: canPerform('proveedores', 'edit') },
    { key: 'email',       header: 'Email',     editable: canPerform('proveedores', 'edit') },
    { key: 'phone',       header: 'Teléfono',  width: '130px', editable: canPerform('proveedores', 'edit') },
    { key: 'balance', header: 'Saldo', width: '130px',
      render: (val) => {
        const amount = Number(val || 0);
        return (
          <span className={cn(
            "font-black tabular-nums",
            amount > 0 ? "text-rose-500" : "text-emerald-500"
          )}>
            {formatConvertedAmount(Math.abs(amount), 'NIO')}
          </span>
        );
      }
    },
    { key: 'status', header: 'Estado', width: '120px', editable: canPerform('proveedores', 'edit'), type: 'select', options: statusOptions,
      render: (val) => {
        const opt = statusOptions.find(o => o.value === (val||'').toUpperCase());
        return <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none', opt?.color || 'bg-muted/20 text-muted-foreground')}>{opt?.label || val}</Badge>;
      }
    },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Supplier>) => {
    try { 
      const sanitized: any = { ...updates };
      if (sanitized.email === '') sanitized.email = undefined;
      
      await suppliersService.update(id as string, sanitized); 
      toast.success('Proveedor actualizado'); 
      onRefresh(); 
    }
    catch (e: any) { 
      toast.error('Error al actualizar: ' + (e.response?.data?.message || e.message)); 
      throw e; 
    }
  };

  const handleAdd = async () => {
    try {
      const code = `PROV-${Date.now().toString().slice(-6)}`;
      await suppliersService.create({ 
        code,
        name: 'Nuevo Proveedor',
        status: 'ACTIVE' as any
      });
      toast.success('Proveedor creado'); 
      onRefresh();
    } catch { 
      toast.error('Error al crear proveedor'); 
    }
  };

  const kpis = [
    { title: 'Total',     value: data.length,                                                                              icon: Truck,         color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Activos',   value: data.filter(s => (s.status||'').toUpperCase() === 'ACTIVE').length,                       icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Saldo Total', value: formatConvertedAmount(data.reduce((a, s) => a + Number(s.balance||0), 0), 'NIO'),              icon: TrendingDown,  color: 'text-rose-500',    bg: 'bg-rose-500/10'    },
    { title: 'Inactivos', value: data.filter(s => (s.status||'').toUpperCase() === 'INACTIVE').length,                     icon: UserX,         color: 'text-amber-500',   bg: 'bg-amber-500/10'   },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <Card key={i} className="bg-card border-border/50 rounded-2xl shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className={cn('p-3 rounded-xl', k.bg, k.color)}><k.icon className="size-5" /></div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{k.title}</p>
                  <p className="text-2xl font-black tabular-nums">{k.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Directorio de Proveedores</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 text-left">Gestión de relaciones comerciales</p>
          </div>
          {canPerform('proveedores', 'create') && (
            <Button onClick={handleAdd} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
              <UserPlus className="size-4" /> Agregar Proveedor
            </Button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-muted/5 p-2 rounded-2xl border border-border/40">
           <div className="flex flex-wrap items-center gap-2 flex-1">
              <Select value={balanceOrder} onValueChange={(value: 'all' | 'highest' | 'lowest') => setBalanceOrder(value)}>
                <SelectTrigger className="h-9 w-40 bg-background/50 border-border/50 rounded-xl text-xs">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Sin ordenar</SelectItem>
                  <SelectItem value="highest">Mayor saldo</SelectItem>
                  <SelectItem value="lowest">Menor saldo</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="outline" className="h-9 px-4 rounded-xl border-border/50 bg-background/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                {data.length} Proveedores
              </Badge>
           </div>
           
           <div className="relative w-full lg:w-72">
             <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
             <Input 
               placeholder="Buscar..." 
               className="pl-9 h-10 w-full bg-background border-border/50 rounded-xl text-xs focus:ring-primary/20" 
               value={searchTerm} 
               onChange={e => setSearchTerm(e.target.value)} 
             />
           </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
          <EditableDataTable
            data={filteredAndSorted}
            columns={columns}
            onRowUpdate={handleUpdate}
            isLoading={loading}
            allowAddRow={false}
            actions={(row) => (
               <div className="flex gap-1">
                 <Button title="Ver Historial" variant="ghost" size="icon" className="size-8 rounded-lg text-primary hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setSelectedSupplierForHistory(row)}><Eye className="size-4" /></Button>
                 <Button title="Recalcular Saldo" variant="ghost" size="icon" className="size-8 rounded-lg text-amber-500 hover:bg-amber-500/10 hover:text-amber-500 transition-colors" onClick={async () => {
                    try {
                      const result = await suppliersService.recalculateBalance(row.id);
                      toast.success(`Saldo recalculado: ${formatConvertedAmount(result.newBalance)}`);
                      onRefresh();
                    } catch (e: any) {
                      toast.error('Error al recalcular: ' + (e.response?.data?.message || e.message));
                    }
                 }}><RefreshCw className="size-4" /></Button>
                 {canPerform('proveedores', 'delete') && (
                   <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg text-rose-500 hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
                 )}
               </div>
            )}
          />
        </div>
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
        title="¿Eliminar proveedor?"
        description="Si el proveedor tiene transacciones activas, no se podrá eliminar."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          try {
            setDeleteLoading(true);
            await suppliersService.delete(pendingDeleteId);
            toast.success('Proveedor eliminado correctamente');
            onRefresh();
          } catch (error: any) {
             toast.error('Error al eliminar');
          } finally {
            setDeleteLoading(false);
            setPendingDeleteId(null);
          }
        }}
      />

      <SupplierHistoryModal
        supplier={selectedSupplierForHistory}
        open={!!selectedSupplierForHistory}
        onOpenChange={(open) => !open && setSelectedSupplierForHistory(null)}
      />
    </div>
  );
}
