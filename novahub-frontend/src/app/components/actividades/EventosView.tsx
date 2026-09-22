import React from 'react';
import { useEffect, useState } from 'react';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { Event } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, CalendarDays, DollarSign, TrendingUp, TrendingDown, Copy, Mail, Users, Eye, CheckCircle2, Loader2, Video, Download, Share2, QrCode, Phone, ExternalLink, UserPlus, UserCheck, Trash2, Building2, Globe } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { eventsService } from '../../services/actividades.service';
import { hrService } from '../../services/hr.service';
import { incomeService, expensesService, accountsService } from '../../services/finanzas.service';
import { contabilidadService } from '../../services/contabilidad.service';
import { InventoryViewTutorial } from '../inventory/InventoryViewTutorial';
import { useCurrency, type Currency } from '../../contexts/CurrencyContext';
import { toast } from '@/app/services/toast';
import { cn } from '../ui/utils';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { asList, fetchAllReportPages, useTenantQuery } from '../../hooks/useTenantQuery';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Combobox } from '../ui/Combobox';
import { normalizeCurrency, summarizeAmountsByCurrency, type SupportedCurrency } from '../../utils/currency';
import { ActivityDetailSheet } from './ActivityDetailSheet';
import { DateTimePickerField } from '../ui/DateTimePickerField';
import { detectMeetingUrl } from '../../utils/meetingLink';

interface EventosViewProps {
  data: Event[];
  loading: boolean;
  onRefresh: () => void;
}

const parseGuestEmails = (value: string) => [...new Set(value.split(',').map(item => item.trim().toLowerCase()).filter(Boolean))];

const accountName = (account: any) => account?.name || account?.accountName || account?.nombre || 'Cuenta sin nombre';
const accountLabel = (account: any) => [account?.code || account?.accountCode, accountName(account)].filter(Boolean).join(' · ');

const EVENT_COST_REASONS = [
  { value: 'PUBLICIDAD', label: 'Publicidad', accountCode: '5200-001' },
  { value: 'PROMOCIONES', label: 'Regalías y promociones', accountCode: '5200-004' },
  { value: 'VIAJES', label: 'Gastos de viajes', accountCode: '5100-007-001' },
  { value: 'ALIMENTACION_TRANSPORTE', label: 'Alimentación y transporte', accountCode: '5100-007-002' },
  { value: 'COMBUSTIBLE', label: 'Combustible', accountCode: '5100-007-003' },
  { value: 'ALQUILER', label: 'Rentas o alquileres', accountCode: '5100-002-004' },
  { value: 'MATERIALES', label: 'Materiales y suministros', accountCode: '5100-003-006' },
  { value: 'SERVICIOS_TERCERIZADOS', label: 'Servicios tercerizados', accountCode: '5100-003-014' },
  { value: 'OTROS', label: 'Otros gastos', accountCode: '5100-003-016' },
];

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
  const { currency, displayCurrency, displayMode, valuationMode, valuationModeSuffix, convertAmount, convertCurrentAmount, formatExplicitAmount } = useCurrency();
  const { canPerform } = useAuth();
  const canPerformEventAction = (action: Parameters<typeof canPerform>[1]) => (
    ['ACTIVITIES_EVENTS', 'ACTIVITIES_CALENDAR', 'ACTIVITIES_MEETINGS'].some((module) => canPerform(module, action))
  );
  const canCompleteEvent = canPerform('ACTIVITIES_EVENTS', 'approve') || canPerform('ACTIVITIES_MEETINGS', 'approve');
  const canViewFinance = canPerform('FINANCIAL', 'view');
  const canViewAccounts = canViewFinance
    || canPerform('FINANCIAL_ACCOUNTS', 'view')
    || canPerform('ACTIVITIES_EVENTS', 'view')
    || canPerform('ACTIVITIES_CALENDAR', 'view')
    || canPerform('ACTIVITIES_MEETINGS', 'view');
  const canViewAccountingConfig = canPerform('ACCOUNTING', 'view');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [costReason, setCostReason] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [completingEventId, setCompletingEventId] = useState<string | null>(null);
  const [completedEventIds, setCompletedEventIds] = useState<Set<string>>(new Set());
  const [newEvent, setNewEvent] = useState({
    title: '', description: '', location: '', startDate: '', endDate: '', cost: '', income: '', guestEmails: '', expenseAccountId: '', incomeAccountId: '',
  });

  const employeesQuery = useTenantQuery<any[]>(
    ['hr', 'event-employees-lookup'],
    (signal) => hrService.getEmployeeLookup(undefined, signal),
  );
  const companyEmployees = asList(employeesQuery.data);

  const [guestTypeMode, setGuestTypeMode] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [selectedInternalUserId, setSelectedInternalUserId] = useState<string>('');
  const [guestDraft, setGuestDraft] = useState<{
    name: string;
    email: string;
    phone: string;
    role: 'GUEST' | 'SPEAKER' | 'STAFF' | 'HOST';
  }>({
    name: '',
    email: '',
    phone: '',
    role: 'GUEST',
  });
  const [addedGuests, setAddedGuests] = useState<Array<{
    guestType: 'INTERNAL' | 'EXTERNAL';
    internalUserId?: string;
    name: string;
    email: string;
    phone?: string;
    role: 'GUEST' | 'SPEAKER' | 'STAFF' | 'HOST';
  }>>([]);

  const handleSelectInternalUser = (employeeId: string) => {
    setSelectedInternalUserId(employeeId);
    const empFound = companyEmployees.find((e: any) => String(e.id) === employeeId);
    if (empFound) {
      const fullName = `${empFound.firstName || ''} ${empFound.lastName || ''}`.trim() || 'Empleado';
      setGuestDraft(prev => ({
        ...prev,
        name: fullName,
        email: empFound.email || '',
        phone: empFound.phone || '',
      }));
    }
  };

  const handleAddGuestToList = () => {
    if (guestTypeMode === 'INTERNAL') {
      if (!selectedInternalUserId) {
        toast.error('Selecciona un empleado de la empresa');
        return;
      }
      const empFound = companyEmployees.find((e: any) => String(e.id) === selectedInternalUserId);
      const name = guestDraft.name.trim() || `${empFound?.firstName || ''} ${empFound?.lastName || ''}`.trim() || 'Empleado';
      const email = guestDraft.email.trim() || empFound?.email || '';
      const phone = guestDraft.phone.trim() || empFound?.phone || '';

      if (addedGuests.some(g => g.internalUserId === selectedInternalUserId)) {
        toast.error('Este empleado ya está en la lista de invitados');
        return;
      }

      setAddedGuests(prev => [
        ...prev,
        {
          guestType: 'INTERNAL',
          internalUserId: empFound?.user?.id || selectedInternalUserId,
          name,
          email,
          phone,
          role: guestDraft.role,
        },
      ]);
      setSelectedInternalUserId('');
      setGuestDraft({ name: '', email: '', phone: '', role: 'GUEST' });
      toast.success(`${name} agregado a la lista`);
    } else {
      if (!guestDraft.name.trim()) {
        toast.error('Ingresa el nombre del invitado');
        return;
      }
      if (!guestDraft.email.trim() && !guestDraft.phone.trim()) {
        toast.error('Ingresa al menos un correo o teléfono para poder invitarlo');
        return;
      }
      if (guestDraft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestDraft.email.trim())) {
        toast.error('Formato de correo no válido');
        return;
      }
      if (guestDraft.email.trim() && addedGuests.some(g => g.email && g.email.toLowerCase() === guestDraft.email.trim().toLowerCase())) {
        toast.error('Ya existe un invitado con este correo');
        return;
      }

      setAddedGuests(prev => [
        ...prev,
        {
          guestType: 'EXTERNAL',
          name: guestDraft.name.trim(),
          email: guestDraft.email.trim(),
          phone: guestDraft.phone.trim(),
          role: guestDraft.role,
        },
      ]);
      setGuestDraft({ name: '', email: '', phone: '', role: 'GUEST' });
      toast.success(`${guestDraft.name.trim()} agregado como invitado externo`);
    }
  };

  const handleRemoveGuestFromList = (index: number) => {
    setAddedGuests(prev => prev.filter((_, i) => i !== index));
  };
  const [invitation, setInvitation] = useState<{ text: string; guests: string[] } | null>(null);
  const [qrModalEvent, setQrModalEvent] = useState<Event | null>(null);
  const [meetingLoadingId, setMeetingLoadingId] = useState<string | null>(null);

  const handleScheduleMeeting = async (event: Event, platform: 'GOOGLE_MEET' | 'TEAMS' | 'ZOOM') => {
    try {
      setMeetingLoadingId(String(event.id));
      const detected = detectMeetingUrl(event.location) || detectMeetingUrl(event.meetingUrl) || detectMeetingUrl(event.description);
      const requestedPlatform = detected?.platform || platform;
      const updated = await eventsService.scheduleMeeting(String(event.id), requestedPlatform);
      toast.success(`Videollamada agendada con ${updated.meetingPlatform || requestedPlatform}`);
      if (selectedEvent?.id === event.id) {
        setSelectedEvent(updated);
      }
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Error al agendar videollamada');
    } finally {
      setMeetingLoadingId(null);
    }
  };

  const handleDownloadIcs = async (event: Event) => {
    try {
      await eventsService.downloadIcs(String(event.id), event.title);
      toast.success('Archivo .ics descargado');
    } catch (err: any) {
      toast.error(err?.message || 'Error al descargar archivo de calendario');
    }
  };

  const handleSendInvitations = async (event: Event) => {
    try {
      await eventsService.sendInvitations(String(event.id));
      toast.success('Invitaciones enviadas a la bandeja de notificaciones');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Error al enviar invitaciones');
    }
  };

  const handleShareWhatsapp = (event: Event) => {
    const text = encodeURIComponent(
      `Invitación a Evento: ${event.title}\n\n` +
      `Inicio: ${event.startDate ? new Date(event.startDate).toLocaleString('es-NI') : 'Por definir'}\n` +
      `Fin:* ${event.endDate ? new Date(event.endDate).toLocaleString('es-NI') : 'Por definir'}\n` +
      (event.location ? `Ubicación: ${event.location}\n` : '') +
      (event.meetingUrl ? `Enlace Reunión: ${event.meetingUrl}\n` : '') +
      (event.description ? `\nDetalles: ${event.description}\n` : '') +
      `\n¡Te esperamos!`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };
  const accountsQuery = useTenantQuery<any[]>(['finance', 'accounts-lookup'], () => fetchAllReportPages((filters) => accountsService.getLookup(filters), { page: 1, pageSize: 200 }), {
    enabled: canViewAccounts,
  });
  const accountingConfigQuery = useTenantQuery<any>(['accounting', 'config'], (signal) => contabilidadService.getConfig(signal), {
    enabled: canViewAccountingConfig,
  });
  const accountOptions = asList(accountsQuery.data);
  const activeAccountOptions = accountOptions.filter((account: any) => account?.isActive !== false);
  const accountingConfig = accountingConfigQuery.data?.config || accountingConfigQuery.data || {};
  const accountMappings = accountingConfig.accountMappings || {};
  const configuredEventExpenseCode = accountMappings?.EVENTOS?.expense
    || accountMappings?.events?.expense
    || accountMappings?.event?.expense
    || accountMappings?.financialExpense?.expense;
  const configuredEventIncomeCode = accountMappings?.EVENTOS?.income
    || accountMappings?.events?.income
    || accountMappings?.event?.income
    || accountMappings?.financialIncome?.income;
  const configuredExpenseAccountId = activeAccountOptions.find((account: any) => String(account?.code) === String(configuredEventExpenseCode))?.id || '';
  const configuredIncomeAccountId = activeAccountOptions.find((account: any) => String(account?.code) === String(configuredEventIncomeCode))?.id || '';
  const accountComboboxOptions = accountOptions.map((account: any) => ({
    label: accountLabel(account),
    value: String(account.id),
    description: account?.isActive === false ? 'Cuenta deshabilitada' : 'Cuenta activa',
    disabled: account?.isActive === false,
  }));
  const costReasonComboboxOptions = EVENT_COST_REASONS.map((reason) => {
    const account = accountOptions.find((candidate: any) => String(candidate?.code) === reason.accountCode);
    const disabled = !account || account?.isActive === false;
    return {
      label: reason.label,
      value: reason.value,
      description: account ? `${accountLabel(account)}${disabled ? ' · Cuenta deshabilitada' : ''}` : 'Cuenta no configurada',
      disabled,
    };
  });
  const hasCostAmount = newEvent.cost.trim() !== '';
  const hasIncomeAmount = newEvent.income.trim() !== '';
  const selectedExpenseAccountIsActive = activeAccountOptions.some((account: any) => String(account.id) === String(newEvent.expenseAccountId));
  const selectedIncomeAccountIsActive = activeAccountOptions.some((account: any) => String(account.id) === String(newEvent.incomeAccountId));
  useEffect(() => {
    if (!hasCostAmount && !hasIncomeAmount) return;
    setNewEvent((current) => ({
      ...current,
      ...(hasCostAmount && !current.expenseAccountId && configuredExpenseAccountId ? { expenseAccountId: String(configuredExpenseAccountId) } : {}),
      ...(hasIncomeAmount && !current.incomeAccountId && configuredIncomeAccountId ? { incomeAccountId: String(configuredIncomeAccountId) } : {}),
    }));
  }, [configuredExpenseAccountId, configuredIncomeAccountId, hasCostAmount, hasIncomeAmount]);
  const eventExpenseQuery = useTenantQuery<any>(['finance', 'event-expense', selectedEvent?.expenseId], () => expensesService.getById(selectedEvent!.expenseId!), {
    enabled: Boolean(canViewFinance && selectedEvent?.expenseId),
  });
  const eventIncomeQuery = useTenantQuery<any>(['finance', 'event-income', selectedEvent?.incomeId], () => incomeService.getById(selectedEvent!.incomeId!), {
    enabled: Boolean(canViewFinance && selectedEvent?.incomeId),
  });
  const expenseAccountId = eventExpenseQuery.data?.accountId;
  const incomeAccountId = eventIncomeQuery.data?.accountId;
  const eventExpenseAccountQuery = useTenantQuery<any>(['finance', 'event-expense-account', expenseAccountId], () => accountsService.getById(expenseAccountId!), {
    enabled: Boolean(canViewAccounts && expenseAccountId && !accountOptions.some((account: any) => String(account.id) === String(expenseAccountId))),
  });
  const eventIncomeAccountQuery = useTenantQuery<any>(['finance', 'event-income-account', incomeAccountId], () => accountsService.getById(incomeAccountId!), {
    enabled: Boolean(canViewAccounts && incomeAccountId && !accountOptions.some((account: any) => String(account.id) === String(incomeAccountId))),
  });
  const canViewAccountingBooks = canPerform('ACCOUNTING', 'view')
    || canPerform('ACCOUNTING_JOURNAL', 'view')
    || canPerform('ACCOUNTING_LEDGER', 'view');
  const eventExpenseJournalQuery = useTenantQuery<any[]>(['accounting', 'event-expense-journal', selectedEvent?.expenseId], async (signal) => {
    if (!selectedEvent?.expenseId) return [];
    return asList(await contabilidadService.getJournals({ referenceId: selectedEvent.expenseId, page: 1, pageSize: 10 }, signal));
  }, {
    enabled: Boolean(canViewAccountingBooks && selectedEvent?.expenseId),
  });
  const eventIncomeJournalQuery = useTenantQuery<any[]>(['accounting', 'event-income-journal', selectedEvent?.incomeId], async (signal) => {
    if (!selectedEvent?.incomeId) return [];
    return asList(await contabilidadService.getJournals({ referenceId: selectedEvent.incomeId, page: 1, pageSize: 10 }, signal));
  }, {
    enabled: Boolean(canViewAccountingBooks && selectedEvent?.incomeId),
  });

  const columns: ColumnDef<Event>[] = [
    { key: 'title', header: 'Título', width: '25%', editable: canPerformEventAction('edit') },
    { key: 'location', header: 'Ubicación', width: '20%', editable: canPerformEventAction('edit') },
    { key: 'startDate', header: 'Fecha Inicio', width: '130px', editable: canPerformEventAction('edit'), type: 'datetime-local', render: (val: any) => val ? format(new Date(val), 'dd/MM/yyyy HH:mm') : '-' },
    { key: 'endDate', header: 'Fecha Fin', width: '130px', editable: canPerformEventAction('edit'), type: 'datetime-local', render: (val: any) => val ? format(new Date(val), 'dd/MM/yyyy HH:mm') : '-' },
    { key: 'status', header: 'Estado', width: '110px', editable: false, render: (val: any, row: Event) => { const status = completedEventIds.has(String(row.id)) ? 'COMPLETED' : String(val || 'PENDING').toUpperCase(); const label = status === 'COMPLETED' ? 'Completado' : status === 'CANCELLED' ? 'Cancelado' : 'Pendiente'; return <span className={cn('text-[10px] font-black uppercase', status === 'COMPLETED' ? 'text-emerald-600' : status === 'CANCELLED' ? 'text-rose-600' : 'text-amber-600')}>{label}</span>; } },
    { key: 'cost', header: 'Costo', width: '100px', editable: canPerformEventAction('edit'), type: 'number', render: (val: any, row: Event) => <CurrencyValuationAmount amount={Number(val || 0)} sourceCurrency={row.currency || 'USD'} sourceExchangeRate={row.exchangeRate} className="font-bold text-rose-500" /> },
    { key: 'income', header: 'Ingreso', width: '100px', editable: canPerformEventAction('edit'), type: 'number', render: (val: any, row: Event) => <CurrencyValuationAmount amount={Number(val || 0)} sourceCurrency={row.currency || 'USD'} sourceExchangeRate={row.exchangeRate} className="font-bold text-emerald-500" /> },
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
            description: updates.title || event.title || 'Evento',
          });
        } else if ((event as any).expense?.accountId || (event as any).expenseAccountId) {
          const existingExpenseAccountId = (event as any).expense?.accountId || (event as any).expenseAccountId;
          const expense = await expensesService.create({ 
            amount: Number(updates.cost), 
            date: new Date().toISOString(), 
            currency: (updates.currency || event.currency || 'USD') as Currency,
            category: 'EVENTOS', 
            description: updates.title || event.title || 'Evento', 
            source: 'Eventos',
            reference: String(event.id),
            notes: '',
            accountId: existingExpenseAccountId,
            status: 'PAID',
            paymentSource: 'CASH',
          });
          if(expense) updates.expenseId = expense.id;
        } else {
          toast.warning('No se pudo enviar el gasto a Finanzas: el evento no tiene una cuenta contable configurada.');
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
        } else if ((event as any).income?.accountId || (event as any).incomeAccountId) {
          const existingIncomeAccountId = (event as any).income?.accountId || (event as any).incomeAccountId;
          const inc = await incomeService.create({ 
            amount: Number(updates.income), 
            date: new Date().toISOString(), 
            currency: (updates.currency || event.currency || 'USD') as Currency,
            category: 'EVENTOS', 
            description: updates.title || event.title || 'Evento', 
            source: 'Eventos',
            reference: String(event.id),
            notes: '',
            accountId: existingIncomeAccountId
          });
          if(inc) updates.incomeId = inc.id;
        } else {
          toast.warning('No se pudo enviar el ingreso a Finanzas: el evento no tiene una cuenta contable configurada.');
        }
      }

      await eventsService.update(id as string, updates); 
      toast.success('Evento actualizado en Base de Datos'); 
      onRefresh(); 
    }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error de integración con Finanzas'); console.error(e); }
  };

  const handleCompleteEvent = async (event: Event) => {
    if (!canCompleteEvent || String(event.status || '').toUpperCase() === 'COMPLETED') return;
    const eventId = String(event.id);
    const cost = Number(event.cost || 0);
    const income = Number(event.income || 0);
    const expenseAccountId = (event as any).expense?.accountId || (event as any).expenseAccountId;
    const incomeAccountId = (event as any).income?.accountId || (event as any).incomeAccountId;
    setCompletingEventId(eventId);
    try {
      if (cost > 0 && event.expenseId) {
        await expensesService.update(event.expenseId, {
          status: 'PAID',
          paymentSource: (event as any).expense?.paymentSource || 'CASH',
        });
      } else if (cost > 0 && expenseAccountId) {
        const createdExpense = await expensesService.create({
          amount: cost,
          date: new Date().toISOString(),
          currency: (event.currency || currency) as Currency,
          category: 'EVENTOS',
          description: event.title || 'Evento',
          source: 'Eventos',
          reference: eventId,
          notes: '',
          accountId: expenseAccountId,
          status: 'PAID',
          paymentSource: 'CASH',
        });
        if (createdExpense?.id) await eventsService.update(eventId, { expenseId: createdExpense.id });
      } else if (cost > 0) {
        throw new Error('No hay una cuenta de gasto vinculada al evento.');
      }

      if (income > 0 && !event.incomeId && incomeAccountId) {
        const createdIncome = await incomeService.create({
          amount: income,
          date: new Date().toISOString(),
          currency: (event.currency || currency) as Currency,
          category: 'EVENTOS',
          description: event.title || 'Evento',
          source: 'Eventos',
          reference: eventId,
          notes: '',
          accountId: incomeAccountId,
        });
        if (createdIncome?.id) await eventsService.update(eventId, { incomeId: createdIncome.id });
      } else if (income > 0 && !event.incomeId) {
        throw new Error('No hay una cuenta de ingreso vinculada al evento.');
      }

      await eventsService.update(eventId, { status: 'COMPLETED' } as any);
      setCompletedEventIds((current) => {
        const next = new Set(current);
        next.add(eventId);
        return next;
      });
      setSelectedEvent((current) => current?.id === event.id ? { ...current, status: 'COMPLETED' } : current);
      toast.success('Evento completado y enviado a Contabilidad');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo completar el evento ni generar su asiento');
    } finally {
      setCompletingEventId(null);
    }
  };

  const handleAdd = async () => {
    if (!newEvent.title.trim()) { toast.error('El título del evento es obligatorio'); return; }
    const guestEmailsFromList = addedGuests.map(g => g.email).filter(Boolean);
    const manualGuestEmails = parseGuestEmails(newEvent.guestEmails);
    const allGuestEmails = [...new Set([...guestEmailsFromList, ...manualGuestEmails])];
    if (hasCostAmount && !selectedExpenseAccountIsActive) {
      toast.error('Selecciona una cuenta de gasto activa para registrar el costo del evento.');
      return;
    }
    if (hasIncomeAmount && !selectedIncomeAccountIsActive) {
      toast.error('Selecciona una cuenta de ingreso activa para registrar el ingreso del evento.');
      return;
    }
    if (manualGuestEmails.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      toast.error('Revisa los correos de invitados; deben tener un formato válido.');
      return;
    }
    if (newEvent.startDate && newEvent.endDate && newEvent.endDate < newEvent.startDate) {
      toast.error('La fecha y hora de finalización debe ser posterior a la fecha de inicio');
      return;
    }
    try {
      const defaultDates = getDefaultEventDateRange();
      const startDate = newEvent.startDate ? new Date(newEvent.startDate).toISOString() : defaultDates.startDate;
      const endDate = newEvent.endDate ? new Date(newEvent.endDate).toISOString() : defaultDates.endDate;
      if (new Date(endDate).getTime() <= new Date(startDate).getTime()) {
        toast.error('La fecha de fin debe ser posterior a la fecha de inicio');
        return;
      }
      const detectedLink = detectMeetingUrl(newEvent.location) || detectMeetingUrl(newEvent.description);
      const created = await eventsService.create({
        title: newEvent.title.trim(),
        description: newEvent.description,
        location: newEvent.location,
        startDate,
        endDate,
        cost: newEvent.cost === '' ? 0 : Number(newEvent.cost),
        income: newEvent.income === '' ? 0 : Number(newEvent.income),
        currency,
        guestEmails: allGuestEmails,
        guests: addedGuests.map(g => ({
          guestType: g.guestType,
          internalUserId: g.internalUserId,
          externalName: g.name,
          externalEmail: g.email || undefined,
          externalPhone: g.phone || undefined,
          role: g.role,
        })),
        status: 'PENDING',
        meetingUrl: detectedLink?.url || undefined,
        meetingPlatform: detectedLink?.platform || undefined,
      });
      const createdId = (created as any)?.id;
      if (createdId && Number(newEvent.cost) > 0 && selectedExpenseAccountIsActive) {
        const expense = await expensesService.create({
          amount: Number(newEvent.cost),
          date: new Date().toISOString(),
          currency,
          category: 'EVENTOS',
          description: newEvent.title.trim(),
          source: 'Eventos',
          reference: String(createdId),
          notes: '',
          accountId: newEvent.expenseAccountId,
          status: 'PENDING',
          paymentSource: 'CASH',
        });
        if (expense?.id) await eventsService.update(createdId, { expenseId: expense.id });
      }
      if (createdId && Number(newEvent.income) > 0 && selectedIncomeAccountIsActive) {
        const income = await incomeService.create({
          amount: Number(newEvent.income),
          date: new Date().toISOString(),
          currency,
          category: 'EVENTOS',
          description: newEvent.title.trim(),
          source: 'Eventos',
          reference: String(createdId),
          notes: '',
          accountId: newEvent.incomeAccountId,
        });
        if (income?.id) await eventsService.update(createdId, { incomeId: income.id });
      }
      toast.success('Evento creado; completa el evento para contabilizar el costo');
      if (allGuestEmails.length > 0) {
        setInvitation({
          guests: allGuestEmails,
          text: buildInvitationText({ title: newEvent.title.trim(), startDate, endDate, location: newEvent.location.trim(), guests: allGuestEmails }),
        });
      }
      setIsAddOpen(false);
      setCostReason('');
      setNewEvent({ title: '', description: '', location: '', startDate: '', endDate: '', cost: '', income: '', guestEmails: '', expenseAccountId: '', incomeAccountId: '' });
      setAddedGuests([]);
      setSelectedInternalUserId('');
      setGuestDraft({ name: '', email: '', phone: '', role: 'GUEST' });
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
  const originalCurrencies = summarizeAmountsByCurrency(data, () => 0, (row) => row.currency || 'USD').map((item) => item.currency);
  const originalSum = (field: 'income' | 'cost', currencyCode: SupportedCurrency) => data
    .filter((row) => normalizeCurrency(row.currency || 'USD') === currencyCode)
    .reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
  const moneyKpis = displayMode === 'ORIGINAL'
    ? originalCurrencies.flatMap((currencyCode) => {
      const income = originalSum('income', currencyCode);
      const cost = originalSum('cost', currencyCode);
      return [
        { title: `Ingresos Totales (${currencyCode})`, value: formatExplicitAmount(income, currencyCode), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { title: `Costos Totales (${currencyCode})`, value: formatExplicitAmount(cost, currencyCode), icon: TrendingDown, color: 'text-rose-500', bg: 'bg-rose-500/10' },
        { title: `Balance General (${currencyCode})`, value: formatExplicitAmount(income - cost, currencyCode), icon: DollarSign, color: income - cost >= 0 ? 'text-emerald-500' : 'text-rose-500', bg: income - cost >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10' },
      ];
    })
    : [
      { title: `Ingresos Totales (${displayCurrency}${valuationModeSuffix})`, value: formatExplicitAmount(totalIncome, displayCurrency), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
      { title: `Costos Totales (${displayCurrency}${valuationModeSuffix})`, value: formatExplicitAmount(totalCost, displayCurrency), icon: TrendingDown, color: 'text-rose-500', bg: 'bg-rose-500/10' },
      { title: `Balance General (${displayCurrency}${valuationModeSuffix})`, value: formatExplicitAmount(totalBalance, displayCurrency), icon: DollarSign, color: totalBalance >= 0 ? 'text-emerald-500' : 'text-rose-500', bg: totalBalance >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10' },
    ];

  const kpis = [
    { title: 'Total Eventos', value: data.length, icon: CalendarDays, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    ...moneyKpis,
  ];

  const filtered = data.filter(e => e.title?.toLowerCase().includes(searchTerm.toLowerCase()) || e.location?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="min-w-0 rounded-2xl border-border/50 bg-card/80 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("p-3 rounded-2xl flex items-center justify-center", kpi.bg)}><kpi.icon className={cn("size-6", kpi.color)} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p><p className="text-2xl font-black tracking-tight">{kpi.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="min-w-0 overflow-hidden rounded-3xl border-border/50 bg-card/80 shadow-sm">
        <div className="flex min-w-0 flex-col gap-4 border-b border-border/50 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0"><h2 className="break-words text-xl font-black uppercase tracking-tight">Eventos</h2></div>
          <div className="erp-list-toolbar flex min-w-0 flex-wrap items-center gap-3">
            <InventoryViewTutorial label="Qué son los Eventos" targetPrefix="eventos-tutorial" compact stepKeys={['title', 'data', 'actions']} copy={{ title: { title: 'Eventos', description: 'Los eventos representan reuniones, conferencias, ferias o cualquier actividad programada. Puedes registrar costos e ingresos asociados para análisis financiero.' }, data: { title: 'Crear evento', description: 'Haz clic en "Nuevo Evento". Define título, ubicación, fechas de inicio/fin, y opcionalmente costos e ingresos.' }, actions: { title: 'Seguimiento', description: 'Edita en la tabla, revisa los KPIs de balance y exporta los datos.' } }} />
            <div className="relative w-full sm:w-56"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="h-10 w-full rounded-xl border-border/50 bg-background/50 pl-9 text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            {canPerformEventAction('create') && (
              <Button data-toolbar-role="primary" onClick={() => setIsAddOpen(true)} className="shrink-0 rounded-xl px-4 h-10 gap-2 bg-primary font-black uppercase text-[10px] tracking-widest text-primary-foreground hover:bg-primary/90"><Plus className="size-4" /> Nuevo Evento</Button>
            )}
          </div>
        </div>
        <EditableDataTable 
          data={filtered} 
          columns={columns} 
          onRowUpdate={canPerformEventAction('edit') ? handleUpdate : undefined}
          onRowClick={(row) => setSelectedEvent(row)}
          isLoading={loading} 
          onRowDelete={canPerformEventAction('delete') ? async (id) => { try { await eventsService.delete(id as string); toast.success('Evento eliminado'); onRefresh(); } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar evento'); } } : undefined}
          actions={(row: Event) => {
            const isCompleted = completedEventIds.has(String(row.id)) || String(row.status || '').toUpperCase() === 'COMPLETED';
            return (
              <div className="flex min-w-max items-center justify-end gap-1" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                <Button type="button" variant="ghost" size="icon" title="Ver detalle del evento" aria-label="Ver detalle del evento" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary" onClick={() => setSelectedEvent(row)}><Eye className="size-4" /></Button>
                
                {/* Download .ics */}
                <Button type="button" variant="ghost" size="icon" title="Descargar .ics" aria-label="Descargar .ics" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary" onClick={() => handleDownloadIcs(row)}><Download className="size-4" /></Button>
                
                {/* Share WhatsApp */}
                <Button type="button" variant="ghost" size="icon" title="Compartir en WhatsApp" aria-label="Compartir en WhatsApp" className="size-8 rounded-lg text-emerald-600 hover:bg-emerald-500/10" onClick={() => handleShareWhatsapp(row)}><Phone className="size-4" /></Button>

                {/* QR Code */}
                <Button type="button" variant="ghost" size="icon" title="Ver Código QR" aria-label="Ver Código QR" className="size-8 rounded-lg text-blue-600 hover:bg-blue-500/10" onClick={() => setQrModalEvent(row)}><QrCode className="size-4" /></Button>

                {/* Schedule direct Meeting if not completed */}
                {!isCompleted && canPerformEventAction('edit') && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" title="Agendar videollamada" aria-label="Agendar videollamada" className="size-8 rounded-lg text-purple-600 hover:bg-purple-500/10" disabled={meetingLoadingId === String(row.id)}>
                        {meetingLoadingId === String(row.id) ? <Loader2 className="size-4 animate-spin" /> : <Video className="size-4" />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleScheduleMeeting(row, 'GOOGLE_MEET')}>
                        <span className="font-medium">Google Meet</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleScheduleMeeting(row, 'TEAMS')}>
                        <span className="font-medium">Microsoft Teams</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleScheduleMeeting(row, 'ZOOM')}>
                        <span className="font-medium">Zoom Meeting</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Complete Event */}
                {!isCompleted && canCompleteEvent && (
                  <Button type="button" variant="ghost" size="icon" title="Completar evento y generar asiento" aria-label="Completar evento y generar asiento" className="size-8 rounded-lg text-emerald-600 hover:bg-emerald-500/10" disabled={completingEventId === String(row.id)} onClick={() => { setSelectedEvent(null); void handleCompleteEvent(row); }}>
                    {completingEventId === String(row.id) ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  </Button>
                )}
              </div>
            );
          }}
          actionsWidth="w-56"
        />
      </Card>

      <ActivityDetailSheet
        kind="event"
        item={selectedEvent}
        accounts={accountOptions}
        linkedExpense={eventExpenseQuery.data}
        linkedIncome={eventIncomeQuery.data}
        linkedExpenseAccount={eventExpenseAccountQuery.data}
        linkedIncomeAccount={eventIncomeAccountQuery.data}
        linkedExpenseJournal={eventExpenseJournalQuery.data?.[0]}
        linkedIncomeJournal={eventIncomeJournalQuery.data?.[0]}
        extraActions={
          selectedEvent ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => handleDownloadIcs(selectedEvent)}
              >
                <Download className="mr-1.5 size-4" /> .ics
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                onClick={() => handleShareWhatsapp(selectedEvent)}
              >
                <Phone className="mr-1.5 size-4" /> WhatsApp
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                onClick={() => setQrModalEvent(selectedEvent)}
              >
                <QrCode className="mr-1.5 size-4" /> QR
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => handleSendInvitations(selectedEvent)}
              >
                <Mail className="mr-1.5 size-4" /> Enviar Invitaciones
              </Button>
              {!completedEventIds.has(String(selectedEvent.id)) &&
                String(selectedEvent.status || '').toUpperCase() !== 'COMPLETED' &&
                canCompleteEvent && (
                  <Button
                    type="button"
                    className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={completingEventId === String(selectedEvent.id)}
                    onClick={() => {
                      const event = selectedEvent;
                      setSelectedEvent(null);
                      void handleCompleteEvent(event);
                    }}
                  >
                    <CheckCircle2 className="mr-2 size-4" />
                    Completar evento
                  </Button>
                )}
            </div>
          ) : undefined
        }
        onDelete={canPerformEventAction('delete') && selectedEvent ? async () => {
          try {
            await eventsService.delete(String(selectedEvent.id));
            toast.success('Evento eliminado');
            onRefresh();
            setSelectedEvent(null);
          } catch (e: any) {
            toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar evento');
          }
        } : undefined}
        onOpenChange={(open) => { if (!open) setSelectedEvent(null); }}
      />

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto !max-w-2xl rounded-3xl border-border/60 bg-background/95 p-0 shadow-2xl">
          <DialogHeader className="border-b border-border/50 bg-gradient-to-br from-emerald-500/10 via-background to-background px-6 py-5 sm:px-8">
            <div className="flex items-start gap-3 pr-6"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600"><CalendarDays className="size-5" /></div><div><DialogTitle className="font-black tracking-tight sm:text-lg">Crear evento</DialogTitle><p className="mt-1 text-xs text-muted-foreground">Organiza fechas, invitados y el resumen financiero en un solo lugar.</p></div></div>
          </DialogHeader>
          <div className="grid gap-5 px-6 py-6 sm:px-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label className="text-xs font-bold">Título del evento</Label><Input autoFocus value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} placeholder="Ej. Reunión con clientes" className="h-11 rounded-xl bg-background" /></div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">Inicio</Label>
                <DateTimePickerField
                  value={newEvent.startDate}
                  maxDate={newEvent.endDate || undefined}
                  onChange={val => {
                    setNewEvent(prev => {
                      // Si la fecha de fin quedó antes del nuevo inicio, la adelantamos al nuevo inicio + 1 hora
                      let nextEnd = prev.endDate;
                      if (val && prev.endDate && prev.endDate < val) {
                        try {
                          const parsedStart = parseISO(val);
                          const autoEnd = new Date(parsedStart.getTime() + 3600000);
                          nextEnd = autoEnd.toISOString().slice(0, 16);
                        } catch {
                          nextEnd = val;
                        }
                      }
                      return { ...prev, startDate: val, endDate: nextEnd };
                    });
                  }}
                  placeholder="Fecha y hora de inicio"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">Fin</Label>
                <DateTimePickerField
                  value={newEvent.endDate}
                  minDate={newEvent.startDate || undefined}
                  onChange={val => setNewEvent(prev => ({ ...prev, endDate: val }))}
                  placeholder="Fecha y hora de finalización"
                />
              </div>
              <div className="space-y-2 sm:col-span-2"><Label className="text-xs font-bold">Ubicación</Label><Input value={newEvent.location} onChange={e => setNewEvent({ ...newEvent, location: e.target.value })} placeholder="Sala, dirección o enlace virtual" className="h-11 rounded-xl bg-background" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Descripción / notas</Label><textarea value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} className="min-h-24 w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Objetivo, agenda y notas del evento" /></div>
              {/* Sección de Gestión de Invitados */}
              <div className="space-y-3 sm:col-span-2 rounded-2xl border border-border/60 bg-muted/15 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    <Label className="text-xs font-black uppercase tracking-wider text-foreground">Invitados y Roles</Label>
                  </div>
                  <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {addedGuests.length} {addedGuests.length === 1 ? 'invitado' : 'invitados'}
                  </span>
                </div>

                {/* Conmutador: Usuario interno vs externo */}
                <div className="grid grid-cols-2 gap-1 bg-muted/60 p-1 rounded-xl border border-border/40">
                  <button
                    type="button"
                    onClick={() => {
                      setGuestTypeMode('INTERNAL');
                      setGuestDraft({ name: '', email: '', phone: '', role: 'GUEST' });
                    }}
                    className={cn(
                      'py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5',
                      guestTypeMode === 'INTERNAL'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Building2 className="size-3.5" />
                    Usuario interno (Empresa)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGuestTypeMode('EXTERNAL');
                      setSelectedInternalUserId('');
                      setGuestDraft({ name: '', email: '', phone: '', role: 'GUEST' });
                    }}
                    className={cn(
                      'py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5',
                      guestTypeMode === 'EXTERNAL'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Globe className="size-3.5" />
                    Usuario externo
                  </button>
                </div>

                {/* Formulario de incorporación según modo */}
                {guestTypeMode === 'INTERNAL' ? (
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-muted-foreground">Buscar empleado de la empresa</Label>
                      <Combobox
                        options={companyEmployees.map((e: any) => ({
                          label: `${e.firstName || ''} ${e.lastName || ''}`.trim() + (e.email ? ` · ${e.email}` : ''),
                          value: String(e.id),
                          description: [e.position?.title, e.department?.name, e.employeeNumber ? `#${e.employeeNumber}` : null].filter(Boolean).join(' · '),
                        }))}
                        value={selectedInternalUserId}
                        onChange={handleSelectInternalUser}
                        placeholder={companyEmployees.length ? "Selecciona un empleado..." : "Cargando empleados..."}
                        searchPlaceholder="Buscar por nombre o correo..."
                        emptyMessage="No se encontraron empleados en la empresa"
                        className="h-11 rounded-xl bg-background"
                      />
                    </div>

                    {selectedInternalUserId && (
                      <div className="grid gap-2.5 sm:grid-cols-3 bg-background/60 p-3 rounded-xl border border-border/40">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-muted-foreground">Nombre</Label>
                          <Input
                            value={guestDraft.name}
                            onChange={e => setGuestDraft({ ...guestDraft, name: e.target.value })}
                            className="h-9 rounded-lg text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-muted-foreground">Correo electrónico</Label>
                          <Input
                            type="email"
                            value={guestDraft.email}
                            onChange={e => setGuestDraft({ ...guestDraft, email: e.target.value })}
                            placeholder="correo@empresa.com"
                            className="h-9 rounded-lg text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-muted-foreground">Teléfono / WhatsApp</Label>
                          <Input
                            type="tel"
                            value={guestDraft.phone}
                            onChange={e => setGuestDraft({ ...guestDraft, phone: e.target.value })}
                            placeholder="+505 8888 8888"
                            className="h-9 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <div className="w-48 space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground">Rol en el evento</Label>
                        <select
                          value={guestDraft.role}
                          onChange={e => setGuestDraft({ ...guestDraft, role: e.target.value as any })}
                          className="h-9 w-full rounded-xl border border-input bg-background px-2.5 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="GUEST">Invitado</option>
                          <option value="SPEAKER">Conferencista / Ponente</option>
                          <option value="STAFF">Staff / Personal</option>
                          <option value="HOST">Anfitrión</option>
                        </select>
                      </div>
                      <div className="flex-1 pt-4">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleAddGuestToList}
                          className="h-9 w-full rounded-xl text-xs font-bold gap-1.5"
                        >
                          <UserPlus className="size-3.5" />
                          Agregar a la lista
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground">Nombre completo *</Label>
                        <Input
                          value={guestDraft.name}
                          onChange={e => setGuestDraft({ ...guestDraft, name: e.target.value })}
                          placeholder="Ej. Ing. Roberto Gómez"
                          className="h-10 rounded-xl text-xs bg-background"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground">Correo electrónico</Label>
                        <Input
                          type="email"
                          value={guestDraft.email}
                          onChange={e => setGuestDraft({ ...guestDraft, email: e.target.value })}
                          placeholder="roberto@externo.com"
                          className="h-10 rounded-xl text-xs bg-background"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground">Teléfono / WhatsApp</Label>
                        <Input
                          type="tel"
                          value={guestDraft.phone}
                          onChange={e => setGuestDraft({ ...guestDraft, phone: e.target.value })}
                          placeholder="+505 8888 8888"
                          className="h-10 rounded-xl text-xs bg-background"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-48 space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground">Rol en el evento</Label>
                        <select
                          value={guestDraft.role}
                          onChange={e => setGuestDraft({ ...guestDraft, role: e.target.value as any })}
                          className="h-9 w-full rounded-xl border border-input bg-background px-2.5 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="GUEST">Invitado</option>
                          <option value="SPEAKER">Conferencista / Ponente</option>
                          <option value="STAFF">Staff / Personal</option>
                          <option value="HOST">Anfitrión</option>
                        </select>
                      </div>
                      <div className="flex-1 pt-4">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleAddGuestToList}
                          className="h-9 w-full rounded-xl text-xs font-bold gap-1.5"
                        >
                          <UserPlus className="size-3.5" />
                          Agregar invitado externo
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lista de Invitados ya agregados */}
                {addedGuests.length > 0 ? (
                  <div className="space-y-1.5 pt-2 border-t border-border/40 max-h-48 overflow-y-auto">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Invitados registrados para este evento:</p>
                    {addedGuests.map((g, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border/40 bg-background/80 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground truncate">{g.name}</span>
                            <span className={cn(
                              'text-[10px] px-1.5 py-0.2 rounded font-semibold',
                              g.guestType === 'INTERNAL'
                                ? 'bg-primary/10 text-primary'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            )}>
                              {g.guestType === 'INTERNAL' ? 'Interno' : 'Externo'}
                            </span>
                            <span className="text-[10px] bg-muted px-1.5 py-0.2 rounded text-muted-foreground">
                              {g.role === 'SPEAKER' ? 'Conferencista' : g.role === 'STAFF' ? 'Staff' : g.role === 'HOST' ? 'Anfitrión' : 'Invitado'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                            {g.email && <span className="truncate">{g.email}</span>}
                            {g.phone && <span>· 📞 {g.phone}</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveGuestFromList(idx)}
                          className="p-1 rounded-lg text-muted-foreground/60 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Remover de la lista"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic text-center py-2">
                    Aún no has agregado personas a la lista de invitados.
                  </p>
                )}
              </div>
              <div className="space-y-2"><Label className="text-xs font-bold">Costo ({currency})</Label><Input type="number" min="0" step="0.01" value={newEvent.cost} onChange={e => { const value = e.target.value; setNewEvent(current => ({ ...current, cost: value, ...(value.trim() === '' ? { expenseAccountId: '' } : {}) })); if (value.trim() === '') setCostReason(''); }} className="h-11 rounded-xl bg-background" /></div>
              <div className="space-y-2"><Label className="text-xs font-bold">Ingreso ({currency})</Label><Input type="number" min="0" step="0.01" value={newEvent.income} onChange={e => { const value = e.target.value; setNewEvent(current => ({ ...current, income: value, ...(value.trim() === '' ? { incomeAccountId: '' } : {}) })); }} className="h-11 rounded-xl bg-background" /></div>
              {hasCostAmount && (
                <>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs font-bold">Motivo del costo <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                    <Combobox
                      options={costReasonComboboxOptions}
                      value={costReason}
                      onChange={(value) => {
                        const reason = EVENT_COST_REASONS.find((item) => item.value === value);
                        setCostReason(value);
                        if (!reason?.accountCode) return;
                        const matched = activeAccountOptions.find((candidate: any) => String(candidate?.code) === reason.accountCode);
                        if (matched) setNewEvent((current) => ({ ...current, expenseAccountId: String(matched.id) }));
                      }}
                      placeholder="Selecciona el motivo contable del costo"
                      searchPlaceholder="Buscar motivo"
                      emptyMessage="No se encontraron motivos"
                      maxVisibleOptions={costReasonComboboxOptions.length}
                      className="h-11 rounded-xl bg-background"
                    />
                    <p className="text-[10px] text-muted-foreground">Es un dato de referencia. Al elegirlo, propone automáticamente la cuenta de gasto asociada.</p>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs font-bold">Cuenta de gasto <span className="text-destructive">*</span></Label>
                    <Combobox
                      options={accountComboboxOptions}
                      value={newEvent.expenseAccountId}
                      onChange={value => setNewEvent(current => ({ ...current, expenseAccountId: value }))}
                      placeholder={activeAccountOptions.length ? 'Seleccionar cuenta de gasto' : accountOptions.length ? 'No hay cuentas activas disponibles' : 'Configura una cuenta en Finanzas'}
                      searchPlaceholder="Buscar por código o nombre"
                      emptyMessage="No se encontraron cuentas"
                      maxVisibleOptions={accountComboboxOptions.length}
                      disabled={!accountOptions.length}
                      className={cn('h-11 rounded-xl bg-background', !selectedExpenseAccountIsActive && 'border-amber-500/60')}
                    />
                    <p className={cn('text-[10px]', !selectedExpenseAccountIsActive ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>{!selectedExpenseAccountIsActive ? 'Selecciona una cuenta de gasto activa para guardar el costo.' : `${accountOptions.length} cuentas visibles · ${activeAccountOptions.length} activas. Las deshabilitadas se muestran como referencia.`}</p>
                  </div>
                </>
              )}
              {hasIncomeAmount && (
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs font-bold">Cuenta de ingreso <span className="text-destructive">*</span></Label>
                  <Combobox
                    options={accountComboboxOptions}
                    value={newEvent.incomeAccountId}
                    onChange={value => setNewEvent(current => ({ ...current, incomeAccountId: value }))}
                    placeholder={activeAccountOptions.length ? 'Seleccionar cuenta de ingreso' : accountOptions.length ? 'No hay cuentas activas disponibles' : 'Configura una cuenta en Finanzas'}
                    searchPlaceholder="Buscar por código o nombre"
                    emptyMessage="No se encontraron cuentas"
                    maxVisibleOptions={accountComboboxOptions.length}
                    disabled={!accountOptions.length}
                    className={cn('h-11 rounded-xl bg-background', !selectedIncomeAccountIsActive && 'border-amber-500/60')}
                  />
                  <p className={cn('text-[10px]', !selectedIncomeAccountIsActive ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>{!selectedIncomeAccountIsActive ? 'Selecciona una cuenta de ingreso activa para guardar el ingreso.' : `${accountOptions.length} cuentas visibles · ${activeAccountOptions.length} activas. Las deshabilitadas se muestran como referencia.`}</p>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Al completar el evento, el costo se marcará como pagado en efectivo para generar su asiento; el ingreso usa la cuenta seleccionada. Ambos movimientos quedan vinculados al evento.</p>
          </div>
          <DialogFooter className="border-t border-border/50 bg-muted/[0.12] px-6 py-4 sm:px-8"><Button variant="outline" className="rounded-xl" onClick={() => setIsAddOpen(false)}>Cancelar</Button><Button className="rounded-xl px-5" onClick={handleAdd}>Crear evento</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(invitation)} onOpenChange={open => { if (!open) setInvitation(null); }}>
        <DialogContent className="w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto !max-w-lg rounded-3xl border-border/60 bg-background/95 p-0 shadow-2xl">
          <DialogHeader className="border-b border-border/50 bg-gradient-to-br from-primary/10 via-background to-background px-6 py-5 sm:px-8">
            <DialogTitle className="flex items-center gap-2 font-black tracking-tight"><Mail className="size-5 text-primary" /> Invitación lista</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-6 py-6 sm:px-8">
            <p className="text-sm text-muted-foreground">El evento quedó guardado. Copia este texto para enviarlo a los invitados:</p>
            <textarea readOnly value={invitation?.text || ''} className="min-h-40 w-full resize-y rounded-2xl border border-input bg-muted/20 p-3 text-sm outline-none" />
            <p className="text-[10px] font-semibold text-muted-foreground">Destinatarios: {invitation?.guests.join(', ')}</p>
          </div>
          <DialogFooter className="border-t border-border/50 bg-muted/[0.12] px-6 py-4 sm:px-8">
            <Button variant="outline" onClick={() => setInvitation(null)}>Cerrar</Button>
            <Button onClick={async () => { if (!invitation) return; try { await navigator.clipboard.writeText(invitation.text); toast.success('Invitación copiada'); } catch { toast.error('No se pudo copiar; selecciona el texto manualmente.'); } }}><Copy className="mr-2 size-4" /> Copiar invitación</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={Boolean(qrModalEvent)} onOpenChange={(open) => { if (!open) setQrModalEvent(null); }}>
        <DialogContent className="w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto !max-w-md rounded-3xl border-border/60 bg-background/95 p-0 shadow-2xl">
          <DialogHeader className="border-b border-border/50 bg-gradient-to-br from-blue-500/10 via-background to-background px-6 py-5 sm:px-8">
            <DialogTitle className="flex items-center gap-2 font-black tracking-tight">
              <QrCode className="size-5 text-blue-600" /> Código QR del Evento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-6 sm:px-8 text-center flex flex-col items-center">
            {qrModalEvent && (() => {
              const detected = detectMeetingUrl(qrModalEvent.meetingUrl) || detectMeetingUrl(qrModalEvent.location) || detectMeetingUrl(qrModalEvent.description);
              const effectiveUrl = qrModalEvent.meetingUrl || detected?.url || `${window.location.origin}/activities/events/${qrModalEvent.id}`;
              const effectivePlatform = qrModalEvent.meetingPlatform || detected?.platform;

              return (
                <>
                  <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-md inline-block">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(effectiveUrl)}`}
                      alt="Código QR del Evento"
                      className="size-48 object-contain"
                    />
                  </div>
                  <div className="text-left w-full space-y-1">
                    <h4 className="font-bold text-sm text-foreground">{qrModalEvent.title}</h4>
                    <p className="text-xs text-muted-foreground">
                      {effectivePlatform
                        ? `Enlace a videollamada (${effectivePlatform})`
                        : 'Enlace al evento en NovaHub ERP'}
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground truncate bg-muted/30 p-2 rounded-lg">
                      {effectiveUrl}
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
          <DialogFooter className="border-t border-border/50 bg-muted/[0.12] px-6 py-4 sm:px-8 flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setQrModalEvent(null)}>
              Cerrar
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                if (!qrModalEvent) return;
                const detected = detectMeetingUrl(qrModalEvent.meetingUrl) || detectMeetingUrl(qrModalEvent.location) || detectMeetingUrl(qrModalEvent.description);
                const effectiveUrl = qrModalEvent.meetingUrl || detected?.url || `${window.location.origin}/activities/events/${qrModalEvent.id}`;
                await navigator.clipboard.writeText(effectiveUrl);
                toast.success('Enlace copiado al portapapeles');
              }}
            >
              <Copy className="mr-1.5 size-4" /> Copiar Enlace
            </Button>
            {qrModalEvent && (() => {
              const detected = detectMeetingUrl(qrModalEvent.meetingUrl) || detectMeetingUrl(qrModalEvent.location) || detectMeetingUrl(qrModalEvent.description);
              const effectiveUrl = qrModalEvent.meetingUrl || detected?.url;
              if (!effectiveUrl) return null;
              return (
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => window.open(effectiveUrl, '_blank')}
                >
                  <ExternalLink className="mr-1.5 size-4" /> Unirse a reunión
                </Button>
              );
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
