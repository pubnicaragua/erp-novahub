import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BedDouble, CalendarDays, Check, CircleDollarSign, ClipboardList, DoorOpen, Link2, Loader2, Plus, X } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { BranchScopeFilter } from './ui/BranchScopeFilter';
import { useBranchScope } from '../hooks/useBranchScope';
import { useAuth } from '../contexts/AuthContext';
import { cajaService } from '../services/caja.service';
import { inventoryService } from '../services/inventario.service';
import { getApiErrorMessage } from '../services/api';
import { hotelService, type HotelReservation } from '../services/hotel.service';
import { HotelCalendarView } from './hospedaje/HotelCalendarView';
import { HotelReservationsView } from './hospedaje/HotelReservationsView';
import { HotelRoomsView } from './hospedaje/HotelRoomsView';

type HotelTab = 'calendario' | 'habitaciones' | 'reservas';
const tabToSubmodule: Record<HotelTab, string> = { calendario: 'calendario-hospedaje', habitaciones: 'habitaciones', reservas: 'reservas' };
const submoduleToTab: Record<string, HotelTab> = { 'calendario-hospedaje': 'calendario', habitaciones: 'habitaciones', reservas: 'reservas' };
const statusLabel: Record<string, string> = { CONFIRMED: 'Confirmada', CHECKED_IN: 'En curso', CHECKED_OUT: 'Finalizada', CANCELLED: 'Cancelada', NO_SHOW: 'No llegó' };
const money = (value: number, currency = 'NIO') => `${currency === 'USD' ? '$' : 'C$'} ${Number(value || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateOnly = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const addCalendarDays = (value: string, days: number) => { const date = new Date(`${value}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
const stayNights = (reservation: HotelReservation) => Math.max(1, Math.round((new Date(`${reservation.checkOut.slice(0, 10)}T00:00:00Z`).getTime() - new Date(`${reservation.checkIn.slice(0, 10)}T00:00:00Z`).getTime()) / 86_400_000));

type ReservationDraft = { guestName: string; guestEmail: string; guestPhone: string; checkIn: string; checkOut: string; roomId: string };
const emptyDraft = (): ReservationDraft => ({ guestName: '', guestEmail: '', guestPhone: '', checkIn: dateOnly(new Date()), checkOut: addCalendarDays(dateOnly(new Date()), 1), roomId: '' });

interface HospedajePageProps { activeSubModule?: string; onSubModuleChange?: (subModule?: string) => void }

export function HospedajePage({ activeSubModule, onSubModuleChange }: HospedajePageProps) {
  const { canPerform } = useAuth();
  const { accessibleBranches, selectedBranchId, isLoading: branchesLoading } = useBranchScope();
  const queryClient = useQueryClient();
  const branchId = selectedBranchId || accessibleBranches[0]?.id || '';
  const canViewRooms = canPerform('HOTEL_ROOMS', 'view');
  const canViewReservations = canPerform('HOTEL_RESERVATIONS', 'view');
  const canManageRooms = canPerform('HOTEL_ROOMS', 'create') || canPerform('HOTEL_ROOMS', 'edit');
  const canCreateReservation = canPerform('HOTEL_RESERVATIONS', 'create');
  const canApproveReservation = canPerform('HOTEL_RESERVATIONS', 'approve');
  const canEditReservation = canPerform('HOTEL_RESERVATIONS', 'edit');
  const visibleTabs = useMemo(() => ([
    { id: 'calendario' as const, label: 'Calendario', icon: CalendarDays, visible: canViewReservations },
    { id: 'habitaciones' as const, label: 'Habitaciones', icon: BedDouble, visible: canViewRooms },
    { id: 'reservas' as const, label: 'Reservas y estadías', icon: ClipboardList, visible: canViewReservations },
  ]).filter((tab) => tab.visible), [canViewReservations, canViewRooms]);
  const [localTab, setLocalTab] = useState<HotelTab>('calendario');
  const requestedTab = activeSubModule ? submoduleToTab[activeSubModule] : undefined;
  const tab = requestedTab && visibleTabs.some((view) => view.id === requestedTab)
    ? requestedTab
    : visibleTabs.some((view) => view.id === localTab) ? localTab : visibleTabs[0]?.id || 'calendario';
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [reservationModal, setReservationModal] = useState(false);
  const [draft, setDraft] = useState<ReservationDraft>(emptyDraft);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [editingReservation, setEditingReservation] = useState(false);
  const [editDraft, setEditDraft] = useState<Partial<ReservationDraft>>({});
  const [checkoutReservation, setCheckoutReservation] = useState<HotelReservation | null>(null);
  const [checkoutRegisterId, setCheckoutRegisterId] = useState('');
  const [registers, setRegisters] = useState<Array<{ id: string; name: string }>>([]);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'PENDING'>('CASH');
  const [statusFilter, setStatusFilter] = useState('');

  const selectTab = (nextTab: HotelTab) => {
    setLocalTab(nextTab);
    onSubModuleChange?.(tabToSubmodule[nextTab]);
  };

  const invalidateHotel = async () => queryClient.invalidateQueries({ queryKey: ['hotel'] });
  const roomTypesQuery = useQuery({ queryKey: ['hotel', 'room-types', branchId], queryFn: () => hotelService.listRoomTypes(branchId), enabled: canViewRooms && Boolean(branchId) });
  const roomsQuery = useQuery({ queryKey: ['hotel', 'rooms', branchId], queryFn: () => hotelService.listRooms(branchId), enabled: canViewRooms && Boolean(branchId) });
  const reservationsQuery = useQuery({ queryKey: ['hotel', 'reservations', branchId, statusFilter], queryFn: () => hotelService.listReservations({ ...(branchId ? { branchId } : {}), ...(statusFilter ? { status: statusFilter } : {}) }), enabled: canViewReservations });
  const selectedQuery = useQuery({ queryKey: ['hotel', 'reservation', selectedReservationId], queryFn: () => hotelService.getReservation(selectedReservationId!), enabled: Boolean(selectedReservationId) });
  const serviceProductsQuery = useQuery({
    queryKey: ['hotel', 'service-products'],
    queryFn: async () => {
      const response = await inventoryService.getAllProductLookupPages({ pageSize: 200, type: 'SERVICE' });
      const records = Array.isArray(response?.data) ? response.data : [];
      return records.filter((product: any) => product.type === 'SERVICE' || product.itemType === 'SERVICE').map((product: any) => ({ id: product.id, code: product.code, name: product.name, salePrice: Number(product.salePrice ?? product.price ?? 0), priceCurrency: product.priceCurrency || product.currency || 'NIO', type: product.type || product.itemType, isActive: product.isActive !== false }));
    }, enabled: canViewRooms,
  });
  const availabilityQuery = useQuery({
    queryKey: ['hotel', 'availability', branchId, draft.checkIn, draft.checkOut],
    queryFn: () => hotelService.availability({ branchId, checkIn: draft.checkIn, checkOut: draft.checkOut }),
    enabled: reservationModal && Boolean(branchId) && canCreateReservation && draft.checkIn < draft.checkOut,
  });
  const reservations = reservationsQuery.data || [];
  const selectedReservation = selectedQuery.data || reservations.find((item) => item.id === selectedReservationId) || null;

  const roomTypeMutation = useMutation({ mutationFn: (body: { code: string; name: string; rateProductId: string; capacity: number }) => hotelService.createRoomType({ branchId, ...body }), onSuccess: invalidateHotel, onError: (error) => toast.error(getApiErrorMessage(error, 'No se pudo crear el tipo de habitación.')) });
  const roomMutation = useMutation({ mutationFn: (body: { roomTypeId: string; code: string; name: string; floor?: string }) => hotelService.createRoom({ branchId, ...body }), onSuccess: invalidateHotel, onError: (error) => toast.error(getApiErrorMessage(error, 'No se pudo crear la habitación.')) });
  const reservationMutation = useMutation({ mutationFn: (body: ReservationDraft) => hotelService.createReservation({ branchId, ...body, guestEmail: body.guestEmail.trim() || undefined, guestPhone: body.guestPhone.trim() || undefined }), onSuccess: async (reservation) => { await invalidateHotel(); setReservationModal(false); setDraft(emptyDraft()); setSelectedReservationId(reservation.id); toast.success(`Reserva ${reservation.reservationNumber} creada.`); }, onError: (error) => toast.error(getApiErrorMessage(error, 'No se pudo crear la reserva. Revisa la disponibilidad.')) });
  const updateReservationMutation = useMutation({ mutationFn: (body: Partial<ReservationDraft>) => hotelService.updateReservation(selectedReservationId!, { ...body, ...(body.guestEmail !== undefined ? { guestEmail: body.guestEmail.trim() || null } : {}), ...(body.guestPhone !== undefined ? { guestPhone: body.guestPhone.trim() || null } : {}) }), onSuccess: async () => { await invalidateHotel(); setEditingReservation(false); toast.success('Estadía actualizada.'); }, onError: (error) => toast.error(getApiErrorMessage(error, 'No se pudo actualizar la estadía.')) });
  const actionMutation = useMutation({ mutationFn: async ({ action, id, active }: { action: 'check-in' | 'cancel' | 'no-show' | 'toggle-room' | 'toggle-type'; id: string; active?: boolean }) => {
    if (action === 'check-in') return hotelService.checkIn(id);
    if (action === 'cancel') return hotelService.cancel(id);
    if (action === 'no-show') return hotelService.noShow(id);
    if (action === 'toggle-room') return hotelService.updateRoom(id, { isActive: active });
    return hotelService.updateRoomType(id, { isActive: active });
  }, onSuccess: invalidateHotel, onError: (error) => toast.error(getApiErrorMessage(error, 'No se pudo completar la acción.')) });
  const guestLinkMutation = useMutation({ mutationFn: ({ id, revoke }: { id: string; revoke: boolean }) => revoke ? hotelService.revokeGuestLink(id) : hotelService.issueGuestLink(id), onSuccess: async (result, variables) => {
    await invalidateHotel();
    if (!variables.revoke && 'token' in result) {
      const link = `${window.location.origin}/hotel/guest/${result.token}`;
      try { await navigator.clipboard.writeText(link); toast.success('Enlace del huésped copiado.'); }
      catch { window.prompt('Copia el enlace de la estadía:', link); }
    } else toast.success('Enlace del huésped revocado.');
  }, onError: (error) => toast.error(getApiErrorMessage(error, 'No se pudo actualizar el enlace.')) });
  const checkoutMutation = useMutation({ mutationFn: async () => {
    if (!checkoutReservation || !checkoutRegisterId) throw new Error('Selecciona una caja.');
    const session = await cajaService.getActiveSession(checkoutRegisterId);
    if (!session?.id) throw new Error('La caja no tiene una sesión abierta. Ábrela para continuar.');
    const total = stayNights(checkoutReservation) * Number(checkoutReservation.nightlyRate);
    return hotelService.checkOut(checkoutReservation.id, { registerId: checkoutRegisterId, sessionId: session.id, payments: paymentMode === 'CASH' ? [{ method: 'CASH', amount: total, currency: checkoutReservation.currency === 'USD' ? 'USD' : 'NIO' }] : [] });
  }, onSuccess: async (reservation) => { await invalidateHotel(); setCheckoutReservation(null); toast.success(`Alojamiento facturado en ${reservation.invoice?.number || 'Caja'}.`); }, onError: (error) => toast.error(getApiErrorMessage(error, 'No se pudo facturar el check-out.')) });

  const openCheckout = async (reservation: HotelReservation) => {
    try {
      const available = await cajaService.getRegisterLookup();
      const branchRegisters = (available || []).filter((register) => !register.branchId || register.branchId === reservation.branchId);
      if (!branchRegisters.length) { toast.error('No hay una caja habilitada para la sucursal de esta estadía.'); return; }
      setRegisters(branchRegisters.map((register) => ({ id: register.id, name: register.name })));
      setCheckoutRegisterId(branchRegisters[0]?.id || '');
      setPaymentMode('CASH');
      setCheckoutReservation(reservation);
    } catch (error) { toast.error(getApiErrorMessage(error, 'No se pudieron cargar las cajas disponibles.')); }
  };

  const openDetails = (reservation: HotelReservation) => {
    setSelectedReservationId(reservation.id);
    setEditingReservation(false);
    setEditDraft({ guestName: reservation.guestName, guestEmail: reservation.guestEmail || '', guestPhone: reservation.guestPhone || '', checkIn: reservation.checkIn.slice(0, 10), checkOut: reservation.checkOut.slice(0, 10), roomId: reservation.roomId });
  };

  const loadError = reservationsQuery.isError || (tab === 'habitaciones' && (roomsQuery.isError || roomTypesQuery.isError));
  const loading = reservationsQuery.isLoading || (tab === 'habitaciones' && (roomsQuery.isLoading || roomTypesQuery.isLoading));

  return <div className="min-h-full min-w-0 overflow-x-hidden bg-background p-4 sm:p-6 md:p-10">
    <div className="mx-auto max-w-[1700px] min-w-0 space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div className="min-w-0"><div className="mb-2 flex items-center gap-2 text-primary"><BedDouble className="size-5" /><span className="text-xs font-black uppercase tracking-[0.18em]">Operación de hospedaje</span></div><h1 className="text-3xl font-black tracking-tight">Hospedaje</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Gestiona habitaciones, reservas y estadías; conecta los pedidos de huéspedes con Restaurante y factura el alojamiento por Caja.</p></div><div className="flex flex-wrap items-center gap-2"><BranchScopeFilter showLabel={false} />{canCreateReservation && <Button onClick={() => { setDraft(emptyDraft()); setReservationModal(true); }}><Plus className="size-4" />Nueva reserva</Button>}</div></header>

      <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Habitaciones activas</p><p className="mt-2 text-2xl font-black">{(roomsQuery.data || []).filter((room) => room.isActive).length}</p></div><div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Estadías en curso</p><p className="mt-2 text-2xl font-black">{reservations.filter((item) => item.status === 'CHECKED_IN').length}</p></div><div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Llegadas confirmadas</p><p className="mt-2 text-2xl font-black">{reservations.filter((item) => item.status === 'CONFIRMED' && item.checkIn.slice(0, 10) === dateOnly(new Date())).length}</p></div></div>

      <div className="flex min-w-0 gap-1 overflow-x-auto rounded-xl border border-border/60 bg-muted/30 p-1">{visibleTabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => selectTab(id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition ${tab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'}`}><Icon className="size-4" />{label}</button>)}</div>

      {statusFilter !== undefined && tab === 'reservas' && <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{reservations.length} registros visibles</p><select aria-label="Filtrar estado de reserva" className="h-10 max-w-full rounded-xl border border-border bg-card px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Todos los estados</option><option value="CONFIRMED">Confirmadas</option><option value="CHECKED_IN">En curso</option><option value="CHECKED_OUT">Finalizadas</option><option value="CANCELLED">Canceladas</option><option value="NO_SHOW">No llegó</option></select></div>}

      {!branchId && (tab === 'habitaciones' || canCreateReservation) && !branchesLoading && <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center"><p className="font-bold">Selecciona una sucursal</p><p className="mt-1 text-sm text-muted-foreground">La configuración de habitaciones y las reservas pertenecen a una sucursal.</p></div>}
      {loading ? <div className="flex min-h-48 items-center justify-center rounded-2xl border border-border/60 bg-card text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" />Cargando hospedaje…</div>
        : loadError ? <div className="rounded-2xl border border-rose-300/60 bg-card p-8 text-center"><p className="font-bold">No se pudieron cargar los datos.</p><Button variant="outline" className="mt-3" onClick={() => void invalidateHotel()}>Reintentar</Button></div>
          : tab === 'calendario' ? <HotelCalendarView reservations={reservations} month={month} onMonthChange={setMonth} onSelect={openDetails} />
            : tab === 'reservas' ? <HotelReservationsView reservations={reservations} onSelect={openDetails} onCreate={() => { setDraft(emptyDraft()); setReservationModal(true); }} />
              : <HotelRoomsView roomTypes={roomTypesQuery.data || []} rooms={roomsQuery.data || []} services={serviceProductsQuery.data || []} canManage={canManageRooms} saving={roomTypeMutation.isPending || roomMutation.isPending || actionMutation.isPending}
                  onCreateType={(body) => new Promise<void>((resolve, reject) => roomTypeMutation.mutate(body, { onSuccess: () => { toast.success('Tipo de habitación creado.'); resolve(); }, onError: reject }))}
                  onCreateRoom={(body) => new Promise<void>((resolve, reject) => roomMutation.mutate(body, { onSuccess: () => { toast.success('Habitación creada.'); resolve(); }, onError: reject }))}
                  onToggleType={(roomType) => actionMutation.mutate({ action: 'toggle-type', id: roomType.id, active: !roomType.isActive })}
                  onToggleRoom={(room) => actionMutation.mutate({ action: 'toggle-room', id: room.id, active: !room.isActive })} />}
    </div>

    {reservationModal && <div className="nh-modal-root fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="hotel-reservation-title"><form className="nh-modal-surface my-auto max-h-[min(92vh,calc(100dvh-1.5rem))] w-full min-w-0 max-w-2xl overflow-y-auto rounded-3xl border border-border/60 bg-card p-4 shadow-2xl sm:p-6" onSubmit={(event) => { event.preventDefault(); reservationMutation.mutate(draft); }}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Nueva estadía</p><h2 id="hotel-reservation-title" className="mt-1 text-2xl font-black">Reserva de habitación</h2></div><button type="button" className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Cerrar" onClick={() => setReservationModal(false)}><X className="size-5" /></button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><Input aria-label="Nombre del huésped" placeholder="Nombre del huésped" value={draft.guestName} onChange={(event) => setDraft({ ...draft, guestName: event.target.value })} required /><Input aria-label="Teléfono del huésped" placeholder="Teléfono (opcional)" value={draft.guestPhone} onChange={(event) => setDraft({ ...draft, guestPhone: event.target.value })} /><Input aria-label="Correo del huésped" type="email" placeholder="Correo (opcional)" value={draft.guestEmail} onChange={(event) => setDraft({ ...draft, guestEmail: event.target.value })} /><div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold text-muted-foreground">Entrada<Input className="mt-1" type="date" value={draft.checkIn} onChange={(event) => setDraft({ ...draft, checkIn: event.target.value, roomId: '' })} required /></label><label className="text-xs font-bold text-muted-foreground">Salida<Input className="mt-1" type="date" min={addCalendarDays(draft.checkIn, 1)} value={draft.checkOut} onChange={(event) => setDraft({ ...draft, checkOut: event.target.value, roomId: '' })} required /></label></div>
        <div className="sm:col-span-2"><label className="text-xs font-bold text-muted-foreground">Habitación disponible</label><select className="mt-1 h-10 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm" value={draft.roomId} onChange={(event) => setDraft({ ...draft, roomId: event.target.value })} required disabled={availabilityQuery.isLoading || !availabilityQuery.data?.length}><option value="">{availabilityQuery.isLoading ? 'Consultando disponibilidad…' : !availabilityQuery.data?.length ? 'No hay habitaciones disponibles en estas fechas' : 'Selecciona una habitación'}</option>{(availabilityQuery.data || []).map((room) => <option key={room.id} value={room.id}>{room.code} · {room.name} — {room.roomType.name} · {money(Number(room.roomType.rateProduct?.salePrice || 0), room.roomType.rateProduct?.priceCurrency)}</option>)}</select><p className="mt-1 text-xs text-muted-foreground">La disponibilidad se vuelve a validar al guardar; las fechas usan entrada incluida y salida excluida.</p></div></div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setReservationModal(false)}>Cancelar</Button><Button type="submit" disabled={reservationMutation.isPending || !draft.roomId || !branchId}>{reservationMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Confirmar reserva</Button></div>
    </form></div>}

    {selectedReservationId && selectedReservation && <div className="nh-modal-root fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="hotel-stay-title"><div className="nh-modal-surface my-auto max-h-[min(92vh,calc(100dvh-1.5rem))] w-full min-w-0 max-w-2xl overflow-y-auto rounded-3xl border border-border/60 bg-card p-4 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Detalle de estadía</p><h2 id="hotel-stay-title" className="mt-1 break-words text-2xl font-black">{selectedReservation.reservationNumber} · {selectedReservation.guestName}</h2><p className="mt-1 text-sm text-muted-foreground">{selectedReservation.room?.code} · {selectedReservation.room?.name} · {statusLabel[selectedReservation.status]}</p></div><button type="button" className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Cerrar" onClick={() => setSelectedReservationId(null)}><X className="size-5" /></button></div>
      {editingReservation ? <div className="mt-5 grid gap-3 sm:grid-cols-2"><Input aria-label="Nombre del huésped" value={editDraft.guestName || ''} onChange={(event) => setEditDraft({ ...editDraft, guestName: event.target.value })} /><Input aria-label="Teléfono" value={editDraft.guestPhone || ''} onChange={(event) => setEditDraft({ ...editDraft, guestPhone: event.target.value })} placeholder="Teléfono" /><Input aria-label="Correo" type="email" value={editDraft.guestEmail || ''} onChange={(event) => setEditDraft({ ...editDraft, guestEmail: event.target.value })} placeholder="Correo" /><select aria-label="Habitación asignada" className="h-10 rounded-xl border border-border bg-background px-3 text-sm" value={editDraft.roomId || ''} onChange={(event) => setEditDraft({ ...editDraft, roomId: event.target.value })}>{(roomsQuery.data || []).filter((room) => room.isActive || room.id === selectedReservation.roomId).map((room) => <option key={room.id} value={room.id}>{room.code} · {room.name}</option>)}</select><label className="text-xs font-bold text-muted-foreground">Entrada<Input className="mt-1" type="date" value={editDraft.checkIn || ''} onChange={(event) => setEditDraft({ ...editDraft, checkIn: event.target.value })} /></label><label className="text-xs font-bold text-muted-foreground">Salida<Input className="mt-1" type="date" min={addCalendarDays(editDraft.checkIn || selectedReservation.checkIn.slice(0, 10), 1)} value={editDraft.checkOut || ''} onChange={(event) => setEditDraft({ ...editDraft, checkOut: event.target.value })} /></label><div className="flex gap-2 sm:col-span-2"><Button variant="outline" onClick={() => setEditingReservation(false)}>Cancelar</Button><Button disabled={updateReservationMutation.isPending} onClick={() => updateReservationMutation.mutate(editDraft)}><Check className="size-4" />Guardar cambios</Button></div></div>
        : <><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-muted/30 p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Fechas</p><p className="mt-1 font-semibold">{selectedReservation.checkIn.slice(0, 10)} → {selectedReservation.checkOut.slice(0, 10)} · {stayNights(selectedReservation)} noches</p></div><div className="rounded-xl bg-muted/30 p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Alojamiento</p><p className="mt-1 font-semibold">{money(Number(selectedReservation.nightlyRate) * stayNights(selectedReservation), selectedReservation.currency)} · {money(selectedReservation.nightlyRate, selectedReservation.currency)} por noche</p></div><div className="rounded-xl bg-muted/30 p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Huésped</p><p className="mt-1 break-all text-sm">{selectedReservation.guestEmail || 'Sin correo'} · {selectedReservation.guestPhone || 'Sin teléfono'}</p></div><div className="rounded-xl bg-muted/30 p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Factura de alojamiento</p><p className="mt-1 font-semibold">{selectedReservation.invoice?.number || 'Pendiente de check-out'}</p></div></div>
          <div className="mt-5 flex flex-wrap gap-2">{canEditReservation && selectedReservation.status === 'CONFIRMED' && <Button variant="outline" onClick={() => setEditingReservation(true)}>Editar reserva</Button>}{canEditReservation && ['CONFIRMED', 'CHECKED_IN'].includes(selectedReservation.status) && <Button variant="outline" onClick={() => guestLinkMutation.mutate({ id: selectedReservation.id, revoke: false })} disabled={guestLinkMutation.isPending}><Link2 className="size-4" />Copiar enlace de servicios</Button>}{canEditReservation && selectedReservation.guestLinkActive && <Button variant="outline" onClick={() => guestLinkMutation.mutate({ id: selectedReservation.id, revoke: true })} disabled={guestLinkMutation.isPending}>Revocar enlace</Button>}{canApproveReservation && selectedReservation.status === 'CONFIRMED' && <><Button onClick={() => actionMutation.mutate({ action: 'check-in', id: selectedReservation.id })}><DoorOpen className="size-4" />Check-in</Button><Button variant="outline" onClick={() => actionMutation.mutate({ action: 'no-show', id: selectedReservation.id })}>Marcar no llegó</Button><Button variant="destructive" onClick={() => actionMutation.mutate({ action: 'cancel', id: selectedReservation.id })}>Cancelar</Button></>}{canApproveReservation && selectedReservation.status === 'CHECKED_IN' && <Button onClick={() => void openCheckout(selectedReservation)}><CircleDollarSign className="size-4" />Facturar check-out</Button>}</div>
          <div className="mt-5 border-t border-border/60 pt-4"><h3 className="font-black">Pedidos de Restaurante asociados</h3>{selectedReservation.restaurantOrders?.length ? <div className="mt-2 space-y-2">{selectedReservation.restaurantOrders.map((order) => <div key={order.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 text-sm"><span>{order.number} · {statusLabel[order.status] || order.status}</span><strong>{money(Number(order.total), order.currency)}</strong></div>)}</div> : <p className="mt-2 text-sm text-muted-foreground">Esta estadía todavía no tiene solicitudes del huésped.</p>}</div></>}
    </div></div>}

    {checkoutReservation && <div className="nh-modal-root fixed inset-0 z-[60] flex items-center justify-center bg-foreground/50 p-3" role="dialog" aria-modal="true" aria-labelledby="hotel-checkout-title"><div className="nh-modal-surface my-auto w-full max-w-md rounded-3xl border border-border/60 bg-card p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Cobro por Caja</p><h2 id="hotel-checkout-title" className="mt-1 text-xl font-black">Check-out · {checkoutReservation.reservationNumber}</h2></div><button type="button" aria-label="Cerrar" className="rounded-lg p-2 hover:bg-muted" onClick={() => setCheckoutReservation(null)}><X className="size-4" /></button></div><div className="my-4 rounded-xl bg-primary p-4 text-primary-foreground"><p className="text-xs uppercase tracking-wider text-primary-foreground/70">Alojamiento · {stayNights(checkoutReservation)} noches</p><p className="mt-1 text-2xl font-black">{money(Number(checkoutReservation.nightlyRate) * stayNights(checkoutReservation), checkoutReservation.currency)}</p></div><label className="text-sm font-bold">Caja<select className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3" value={checkoutRegisterId} onChange={(event) => setCheckoutRegisterId(event.target.value)}><option value="">Selecciona caja</option>{registers.map((register) => <option key={register.id} value={register.id}>{register.name}</option>)}</select></label><label className="mt-3 block text-sm font-bold">Forma de emisión<select className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3" value={paymentMode} onChange={(event) => setPaymentMode(event.target.value as 'CASH' | 'PENDING')}><option value="CASH">Cobrar en efectivo</option><option value="PENDING">Emitir factura pendiente de pago</option></select></label><p className="mt-3 text-xs leading-5 text-muted-foreground">Se requiere una sesión abierta. Caja emite y contabiliza la factura con el producto de servicio reservado.</p><Button className="mt-5 w-full" disabled={!checkoutRegisterId || checkoutMutation.isPending} onClick={() => checkoutMutation.mutate()}>{checkoutMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <CircleDollarSign className="size-4" />}{paymentMode === 'CASH' ? 'Facturar y cobrar' : 'Emitir factura'}</Button></div></div>}
  </div>;
}
