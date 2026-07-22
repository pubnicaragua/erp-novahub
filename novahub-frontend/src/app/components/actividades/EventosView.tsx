import React, { useState } from 'react';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { Event } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, CalendarDays, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { eventsService } from '../../services/actividades.service';
import { incomeService, expensesService, accountsService } from '../../services/finanzas.service';
import { useCurrency, type Currency } from '../../contexts/CurrencyContext';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';

interface EventosViewProps {
  data: Event[];
  loading: boolean;
  onRefresh: () => void;
}

export const EventosView: React.FC<EventosViewProps> = ({ data, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [defaultAccountId, setDefaultAccountId] = useState<string>('');
  const { formatAmount, currency, convertAmount, displayCurrency } = useCurrency();
  const { canPerform } = useAuth();

  React.useEffect(() => {
    accountsService.getAll().then((res: any) => {
      const list = Array.isArray(res) ? res : res.data;
      if (list && list.length > 0) setDefaultAccountId(list[0].id);
    }).catch(e => console.error('Error fetching accounts', e));
  }, []);

  const columns: ColumnDef<Event>[] = [
    { key: 'title', header: 'Título', width: '25%', editable: canPerform('ACTIVITIES_EVENTS', 'edit') },
    { key: 'location', header: 'Ubicación', width: '20%', editable: canPerform('ACTIVITIES_EVENTS', 'edit') },
    { key: 'startDate', header: 'Fecha Inicio', width: '130px', editable: canPerform('ACTIVITIES_EVENTS', 'edit'), type: 'datetime-local', render: (val: any) => val ? format(new Date(val), 'dd/MM/yyyy HH:mm') : '-' },
    { key: 'endDate', header: 'Fecha Fin', width: '130px', editable: canPerform('ACTIVITIES_EVENTS', 'edit'), type: 'datetime-local', render: (val: any) => val ? format(new Date(val), 'dd/MM/yyyy HH:mm') : '-' },
    { key: 'cost', header: 'Costo', width: '100px', editable: canPerform('ACTIVITIES_EVENTS', 'edit'), type: 'number', render: (val: any, row: Event) => <span className="text-rose-500 font-bold">{formatAmount(Number(val || 0), row.currency || 'USD')}</span> },
    { key: 'income', header: 'Ingreso', width: '100px', editable: canPerform('ACTIVITIES_EVENTS', 'edit'), type: 'number', render: (val: any, row: Event) => <span className="text-emerald-500 font-bold">{formatAmount(Number(val || 0), row.currency || 'USD')}</span> },
    { key: 'balance', header: 'Balance', width: '100px', render: (_: any, row: Event) => {
        const balance = (Number(row.income) || 0) - (Number(row.cost) || 0);
        return <span className={cn("font-black text-[11px] px-2 py-0.5 rounded-md", balance >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>{formatAmount(balance, row.currency || 'USD')}</span>;
      }
    },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Event>) => {
    try { 
      const event = data.find(e => e.id === id);
      if (!event) return;

      if (updates.cost !== undefined || updates.income !== undefined) {
        updates.currency = currency;
      }

      if (updates.cost !== undefined && updates.cost > 0) {
        if (event.expenseId) {
          await expensesService.update(event.expenseId, { 
            amount: Number(updates.cost), 
            currency: (updates.currency || event.currency || 'USD') as Currency,
            source: 'Eventos',
            description: updates.title || event.title || 'Evento'
          });
        } else if (defaultAccountId) {
          const expense = await expensesService.create({ 
            amount: Number(updates.cost), 
            date: new Date().toISOString(), 
            currency: (updates.currency || event.currency || 'USD') as Currency,
            category: 'EVENTOS', 
            description: updates.title || event.title || 'Evento', 
            source: 'Eventos',
            notes: '',
            accountId: defaultAccountId 
          });
          if(expense) updates.expenseId = expense.id;
        } else {
          toast.warning('No se pudo enviar Gasto a Finanzas: no tienes cuentas bancarias configuradas.');
        }
      }

      if (updates.income !== undefined && updates.income > 0) {
        if (event.incomeId) {
          await incomeService.update(event.incomeId, { 
            amount: Number(updates.income), 
            currency: (updates.currency || event.currency || 'USD') as Currency,
            source: 'Eventos',
            description: updates.title || event.title || 'Evento'
          });
        } else if (defaultAccountId) {
          const inc = await incomeService.create({ 
            amount: Number(updates.income), 
            date: new Date().toISOString(), 
            currency: (updates.currency || event.currency || 'USD') as Currency,
            category: 'EVENTOS', 
            description: updates.title || event.title || 'Evento', 
            source: 'Eventos',
            notes: '',
            accountId: defaultAccountId 
          });
          if(inc) updates.incomeId = inc.id;
        } else {
          toast.warning('No se pudo enviar Ingreso a Finanzas: no tienes cuentas bancarias configuradas.');
        }
      }

      await eventsService.update(id as string, updates); 
      toast.success('Evento actualizado en Base de Datos'); 
      onRefresh(); 
    }
    catch (e) { toast.error('Error de integración con Finanzas'); console.error(e); }
  };

  const handleAdd = async () => {
    try {
      await eventsService.create({ title: 'Nuevo Evento', startDate: new Date().toISOString(), endDate: new Date(Date.now() + 3600000).toISOString(), cost: 0, income: 0, currency });
      toast.success('Evento creado'); onRefresh();
    } catch { toast.error('Error al crear evento'); }
  };

  const totalIncome = data.reduce((acc, row) => acc + convertAmount(Number(row.income) || 0, row.currency || 'USD'), 0);
  const totalCost = data.reduce((acc, row) => acc + convertAmount(Number(row.cost) || 0, row.currency || 'USD'), 0);
  const totalBalance = totalIncome - totalCost;

  const kpis = [
    { title: 'Total Eventos', value: data.length, icon: CalendarDays, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Ingresos Totales', value: formatAmount(totalIncome, displayCurrency), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Costos Totales', value: formatAmount(totalCost, displayCurrency), icon: TrendingDown, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { title: 'Balance General', value: formatAmount(totalBalance, displayCurrency), icon: DollarSign, color: totalBalance >= 0 ? 'text-emerald-500' : 'text-rose-500', bg: totalBalance >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10' },
  ];

  const filtered = data.filter(e => e.title?.toLowerCase().includes(searchTerm.toLowerCase()) || e.location?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="border-none bg-background/50 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("p-3 rounded-2xl flex items-center justify-center", kpi.bg)}><kpi.icon className={cn("size-6", kpi.color)} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p><p className="text-2xl font-black tracking-tight">{kpi.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none bg-background/50 backdrop-blur-xl shadow-sm">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight">Eventos</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Calendario y reuniones</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            {canPerform('ACTIVITIES_EVENTS', 'create') && (
              <Button onClick={handleAdd} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nuevo Evento</Button>
            )}
          </div>
        </div>
        <EditableDataTable 
          data={filtered} 
          columns={columns} 
          onRowUpdate={canPerform('ACTIVITIES_EVENTS', 'edit') ? handleUpdate : undefined} 
          isLoading={loading} 
          onRowDelete={canPerform('ACTIVITIES_EVENTS', 'delete') ? async (id) => { try { await eventsService.delete(id as string); toast.success('Evento eliminado'); onRefresh(); } catch { toast.error('Error al eliminar'); } } : undefined} 
        />
      </Card>
    </div>
  );
};

