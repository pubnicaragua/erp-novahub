import React from 'react';
import { useState } from 'react';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { Event } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, CalendarDays, DollarSign, TrendingUp, TrendingDown, Copy, Mail, Users } from 'lucide-react';
import { eventsService } from '../../services/actividades.service';
import { incomeService, expensesService, accountsService } from '../../services/finanzas.service';
import { InventoryViewTutorial } from '../inventory/InventoryViewTutorial';
import { useCurrency, type Currency } from '../../contexts/CurrencyContext';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { asList, useTenantQuery } from '../../hooks/useTenantQuery';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';

interface EventosViewProps {
  data: Event[];
  loading: boolean;
  onRefresh: () => void;
}

const parseGuestEmails = (value: string) => [...new Set(value.split(',').map(item => item.trim().toLowerCase()).filter(Boolean))];

const getDefaultEventDateRange = () => {
  const start = new Date();
  return { startDate: start.toISOString(), endDate: new Date(start.getTime() + 3600000).toISOString() };
};

const buildInvitationText = (event: { title: string; startDate: string; endDate: string; location?: string; guests: string[] }) => [
  `INVITACIÓN: ${event.title}`,
  `Fecha: ${new Date(event.startDate).toLocaleString('es-NI')}`,
  `Finaliza: ${new Date(event.endDate).toLocaleString('es-NI')}`,
  event.location ? `Lugar: ${event.location}` : '',
  '',
  'Te esperamos.',
  `Invitados: ${event.guests.join(', ')}`,
].filter(Boolean).join('\n');

export const EventosView: React.FC<EventosViewProps> = ({ data, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { formatAmount, currency, displayCurrency, valuationMode, valuationModeSuffix, convertAmount, convertCurrentAmount } = useCurrency();
  const { canPerform } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '', description: '', location: '', startDate: '', endDate: '', cost: '', income: '', guestEmails: '', accountId: '',
  });
  const [invitation, setInvitation] = useState<{ text: string; guests: string[] } | null>(null);
  const accountsQuery = useTenantQuery<any>(['finance', 'accounts'], signal => accountsService.getAll(undefined, signal));
  const accountOptions = asList(accountsQuery.data);
  const defaultAccountId = accountOptions[0]?.id || '';

  const columns: ColumnDef<Event>[] = [
    { key: 'title', header: 'Título', width: '25%', editable: canPerform('ACTIVITIES_EVENTS', 'edit') },
    { key: 'location', header: 'Ubicación', width: '20%', editable: canPerform('ACTIVITIES_EVENTS', 'edit') },
    { key: 'startDate', header: 'Fecha Inicio', width: '130px', editable: canPerform('ACTIVITIES_EVENTS', 'edit'), type: 'datetime-local', render: (val: any) => val ? format(new Date(val), 'dd/MM/yyyy HH:mm') : '-' },
    { key: 'endDate', header: 'Fecha Fin', width: '130px', editable: canPerform('ACTIVITIES_EVENTS', 'edit'), type: 'datetime-local', render: (val: any) => val ? format(new Date(val), 'dd/MM/yyyy HH:mm') : '-' },
    { key: 'cost', header: 'Costo', width: '100px', editable: canPerform('ACTIVITIES_EVENTS', 'edit'), type: 'number', render: (val: any, row: Event) => <CurrencyValuationAmount amount={Number(val || 0)} sourceCurrency={row.currency || 'USD'} sourceExchangeRate={row.exchangeRate} className="font-bold text-rose-500" /> },
    { key: 'income', header: 'Ingreso', width: '100px', editable: canPerform('ACTIVITIES_EVENTS', 'edit'), type: 'number', render: (val: any, row: Event) => <CurrencyValuationAmount amount={Number(val || 0)} sourceCurrency={row.currency || 'USD'} sourceExchangeRate={row.exchangeRate} className="font-bold text-emerald-500" /> },
    { key: 'guestEmails', header: 'Invitados', width: '110px', render: (_: any, row: Event) => <span className="inline-flex items-center gap-1 text-[11px] font-bold"><Users className="size-3.5 text-primary" />{row.guestEmails?.length || row.attendees?.length || 0}</span> },
    { key: 'balance', header: 'Balance', width: '100px', render: (_: any, row: Event) => {
        const balance = (Number(row.income) || 0) - (Number(row.cost) || 0);
        return <CurrencyValuationAmount amount={balance} sourceCurrency={row.currency || 'USD'} sourceExchangeRate={row.exchangeRate} className={cn("font-black text-[11px] px-2 py-0.5 rounded-md", balance >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")} />;
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
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error de integración con Finanzas'); console.error(e); }
  };

  const handleAdd = async () => {
    if (!newEvent.title.trim()) { toast.error('El título del evento es obligatorio'); return; }
    const guestEmails = parseGuestEmails(newEvent.guestEmails);
    const eventAccountId = newEvent.accountId || defaultAccountId;
    if (guestEmails.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      toast.error('Revisa los correos de invitados; deben tener un formato válido.');
      return;
    }
    try {
      const defaultDates = getDefaultEventDateRange();
      const startDate = newEvent.startDate ? new Date(newEvent.startDate).toISOString() : defaultDates.startDate;
      const endDate = newEvent.endDate ? new Date(newEvent.endDate).toISOString() : defaultDates.endDate;
      const created = await eventsService.create({
        ...newEvent,
        title: newEvent.title.trim(),
        startDate,
        endDate,
        cost: newEvent.cost === '' ? 0 : Number(newEvent.cost),
        income: newEvent.income === '' ? 0 : Number(newEvent.income),
        currency,
        guestEmails,
      });
      const createdId = (created as any)?.id;
      if (createdId && Number(newEvent.cost) > 0 && eventAccountId) {
        const expense = await expensesService.create({ amount: Number(newEvent.cost), date: new Date().toISOString(), currency, category: 'EVENTOS', description: newEvent.title.trim(), source: 'Eventos', notes: '', accountId: eventAccountId });
        if (expense?.id) await eventsService.update(createdId, { expenseId: expense.id });
      } else if (Number(newEvent.cost) > 0 && !eventAccountId) {
        toast.warning('Evento creado, pero no se registró el costo porque no hay una cuenta bancaria configurada.');
      }
      if (createdId && Number(newEvent.income) > 0 && eventAccountId) {
        const income = await incomeService.create({ amount: Number(newEvent.income), date: new Date().toISOString(), currency, category: 'EVENTOS', description: newEvent.title.trim(), source: 'Eventos', notes: '', accountId: eventAccountId });
        if (income?.id) await eventsService.update(createdId, { incomeId: income.id });
      } else if (Number(newEvent.income) > 0 && !eventAccountId) {
        toast.warning('Evento creado, pero no se registró el ingreso porque no hay una cuenta bancaria configurada.');
      }
      toast.success('Evento creado y guardado');
      if (guestEmails.length > 0) {
        setInvitation({
          guests: guestEmails,
          text: buildInvitationText({ title: newEvent.title.trim(), startDate, endDate, location: newEvent.location.trim(), guests: guestEmails }),
        });
      }
      setIsAddOpen(false);
      setNewEvent({ title: '', description: '', location: '', startDate: '', endDate: '', cost: '', income: '', guestEmails: '', accountId: '' });
      onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al crear evento'); }
  };

  const toDisplayAmount = (amount: number, sourceCurrency?: string, sourceExchangeRate?: number) => {
    const sourceAmount = Number(amount || 0);
    return valuationMode === 'CURRENT'
      ? convertCurrentAmount(sourceAmount, sourceCurrency)
      : convertAmount(sourceAmount, sourceCurrency, sourceExchangeRate);
  };
  const totalIncome = data.reduce((acc, row) => acc + toDisplayAmount(Number(row.income) || 0, row.currency || 'USD', row.exchangeRate), 0);
  const totalCost = data.reduce((acc, row) => acc + toDisplayAmount(Number(row.cost) || 0, row.currency || 'USD', row.exchangeRate), 0);
  const totalBalance = totalIncome - totalCost;

  const kpis = [
    { title: 'Total Eventos', value: data.length, icon: CalendarDays, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: `Ingresos Totales (${displayCurrency}${valuationModeSuffix})`, value: formatAmount(totalIncome, displayCurrency), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: `Costos Totales (${displayCurrency}${valuationModeSuffix})`, value: formatAmount(totalCost, displayCurrency), icon: TrendingDown, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { title: `Balance General (${displayCurrency}${valuationModeSuffix})`, value: formatAmount(totalBalance, displayCurrency), icon: DollarSign, color: totalBalance >= 0 ? 'text-emerald-500' : 'text-rose-500', bg: totalBalance >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10' },
  ];

  const filtered = data.filter(e => e.title?.toLowerCase().includes(searchTerm.toLowerCase()) || e.location?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="min-w-0 space-y-6 animate-in fade-in duration-500">
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

      <Card className="min-w-0 overflow-hidden border-none bg-background/50 backdrop-blur-xl shadow-sm">
        <div className="flex min-w-0 flex-col gap-4 border-b border-border/50 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0"><h2 className="text-xl font-black uppercase tracking-tight">Eventos</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Calendario y reuniones</p></div>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <InventoryViewTutorial label="Qué son los Eventos" targetPrefix="eventos-tutorial" compact stepKeys={['title', 'data', 'actions']} copy={{ title: { title: 'Eventos', description: 'Los eventos representan reuniones, conferencias, ferias o cualquier actividad programada. Puedes registrar costos e ingresos asociados para análisis financiero.' }, data: { title: 'Crear evento', description: 'Haz clic en "Nuevo Evento". Define título, ubicación, fechas de inicio/fin, y opcionalmente costos e ingresos.' }, actions: { title: 'Seguimiento', description: 'Edita en la tabla, revisa los KPIs de balance y exporta los datos.' } }} />
            <div className="relative w-full sm:w-56"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="h-10 w-full rounded-xl border-border/50 bg-background/50 pl-9 text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            {canPerform('ACTIVITIES_EVENTS', 'create') && (
              <Button onClick={() => setIsAddOpen(true)} className="shrink-0 rounded-xl px-4 h-10 gap-2 bg-primary font-black uppercase text-[10px] tracking-widest text-primary-foreground hover:bg-primary/90"><Plus className="size-4" /> Nuevo Evento</Button>
            )}
          </div>
        </div>
        <EditableDataTable 
          data={filtered} 
          columns={columns} 
          onRowUpdate={canPerform('ACTIVITIES_EVENTS', 'edit') ? handleUpdate : undefined} 
          isLoading={loading} 
          onRowDelete={canPerform('ACTIVITIES_EVENTS', 'delete') ? async (id) => { try { await eventsService.delete(id as string); toast.success('Evento eliminado'); onRefresh(); } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar evento'); } } : undefined}
          actionsWidth="w-36"
        />
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl rounded-3xl">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-tight">Crear evento</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label>Título</Label><Input autoFocus value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} placeholder="Ej. Reunión con clientes" /></div>
              <div className="space-y-2"><Label>Inicio</Label><Input type="datetime-local" value={newEvent.startDate} onChange={e => setNewEvent({ ...newEvent, startDate: e.target.value })} /></div>
              <div className="space-y-2"><Label>Fin</Label><Input type="datetime-local" value={newEvent.endDate} onChange={e => setNewEvent({ ...newEvent, endDate: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Ubicación</Label><Input value={newEvent.location} onChange={e => setNewEvent({ ...newEvent, location: e.target.value })} placeholder="Sala, dirección o enlace virtual" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Descripción / notas</Label><textarea value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} className="min-h-24 w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Objetivo, agenda y notas del evento" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Invitados</Label><Input value={newEvent.guestEmails} onChange={e => setNewEvent({ ...newEvent, guestEmails: e.target.value })} placeholder="correo1@empresa.com, correo2@empresa.com" /><p className="text-[10px] text-muted-foreground">Se guardan en el evento y se genera una invitación copiable al finalizar.</p></div>
              <div className="space-y-2"><Label>Costo ({currency})</Label><Input type="number" min="0" step="0.01" value={newEvent.cost} onChange={e => setNewEvent({ ...newEvent, cost: e.target.value })} /></div>
              <div className="space-y-2"><Label>Ingreso ({currency})</Label><Input type="number" min="0" step="0.01" value={newEvent.income} onChange={e => setNewEvent({ ...newEvent, income: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Cuenta financiera</Label><select value={newEvent.accountId} onChange={e => setNewEvent({ ...newEvent, accountId: e.target.value })} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" disabled={!accountOptions.length}><option value="">{accountOptions.length ? `Usar cuenta predeterminada (${accountOptions[0]?.name || accountOptions[0]?.code || 'primera cuenta'})` : 'Configura una cuenta en Finanzas'}</option>{accountOptions.map((account: any) => <option key={account.id} value={account.id}>{account.code ? `${account.code} · ` : ''}{account.name}</option>)}</select><p className="text-[10px] text-muted-foreground">Se usa para enlazar el costo y/o ingreso del evento con Finanzas.</p></div>
            </div>
            <p className="text-xs text-muted-foreground">Los costos e ingresos se enlazan automáticamente con Finanzas cuando existe una cuenta bancaria configurada.</p>
          </div>
          <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button><Button onClick={handleAdd}>Crear evento</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(invitation)} onOpenChange={open => { if (!open) setInvitation(null); }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase tracking-tight"><Mail className="size-5 text-primary" /> Invitación lista</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">El evento quedó guardado. Copia este texto para enviarlo a los invitados:</p>
            <textarea readOnly value={invitation?.text || ''} className="min-h-40 w-full resize-y rounded-2xl border border-input bg-muted/20 p-3 text-sm outline-none" />
            <p className="text-[10px] font-semibold text-muted-foreground">Destinatarios: {invitation?.guests.join(', ')}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInvitation(null)}>Cerrar</Button>
            <Button onClick={async () => { if (!invitation) return; try { await navigator.clipboard.writeText(invitation.text); toast.success('Invitación copiada'); } catch { toast.error('No se pudo copiar; selecciona el texto manualmente.'); } }}><Copy className="mr-2 size-4" /> Copiar invitación</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

