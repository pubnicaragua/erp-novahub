import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BedDouble, Check, CircleOff, Plus, Tags } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { hotelService, type HotelRatePriceListOption, type HotelRoom, type HotelRoomType } from '../../services/hotel.service';

type ServiceProduct = { id: string; code?: string; name: string; salePrice: number; salePriceOriginal?: number; priceCurrency?: string; priceExchangeRate?: number; itemType?: string; type?: string; isActive?: boolean };
const normalizeCurrency = (value?: string) => String(value || '').toUpperCase() === 'USD' ? 'USD' : 'NIO';
const emptyTypeForm = () => ({ code: '', name: '', rateProductId: '', ratePriceListId: '', capacity: '2' });

export function HotelRoomsView({ roomTypes, rooms, services, canCreateRoomTypes, canChangeRoomTypeAvailability, canCreateRooms, canChangeRoomAvailability, saving, onCreateType, onCreateRoom, onToggleType, onToggleRoom }: {
  roomTypes: HotelRoomType[];
  rooms: HotelRoom[];
  services: ServiceProduct[];
  canCreateRoomTypes: boolean;
  canChangeRoomTypeAvailability: boolean;
  canCreateRooms: boolean;
  canChangeRoomAvailability: boolean;
  saving: boolean;
  onCreateType: (body: { code: string; name: string; rateProductId: string; ratePriceListId?: string; capacity: number }) => Promise<void>;
  onCreateRoom: (body: { roomTypeId: string; code: string; name: string; floor?: string }) => Promise<void>;
  onToggleType: (roomType: HotelRoomType) => void;
  onToggleRoom: (room: HotelRoom) => void;
}) {
  const { user } = useAuth();
  const { baseCurrency, displayCurrency, displayMode, formatExplicitAmount, formatConvertedAmount } = useCurrency();
  const [typeForm, setTypeForm] = useState(emptyTypeForm);
  const [roomForm, setRoomForm] = useState({ roomTypeId: '', code: '', name: '', floor: '' });
  const activeTypes = useMemo(() => roomTypes.filter((type) => type.isActive), [roomTypes]);
  const ratePriceListsQuery = useQuery({
    queryKey: ['hotel', 'rate-price-lists', user?.tenantId, typeForm.rateProductId],
    queryFn: ({ signal }) => hotelService.listRatePriceLists(typeForm.rateProductId, signal),
    enabled: canCreateRoomTypes && Boolean(user?.tenantId && typeForm.rateProductId),
  });
  const ratePriceLists: HotelRatePriceListOption[] = useMemo(() => ratePriceListsQuery.data || [], [ratePriceListsQuery.data]);
  const selectedService = services.find((service) => service.id === typeForm.rateProductId);
  const hasConfiguredRatePriceLists = ratePriceLists.some((list) => list.source === 'CONFIGURED');
  const retailRatePriceList = ratePriceLists.find((list) => list.code.toUpperCase() === 'RETAIL');
  const effectiveRatePriceListId = typeForm.ratePriceListId && ratePriceLists.some((list) => list.id === typeForm.ratePriceListId)
    ? typeForm.ratePriceListId
    : retailRatePriceList?.id || '';
  const selectedRatePriceList = ratePriceLists.find((list) => list.id === effectiveRatePriceListId);
  const catalogRate = useMemo(() => {
    if (!selectedService) return null;
    const originalPrice = Number(selectedService.salePriceOriginal);
    const hasOriginalPrice = Number.isFinite(originalPrice) && originalPrice > 0;
    const currency = hasOriginalPrice ? normalizeCurrency(selectedService.priceCurrency) : baseCurrency;
    const price = hasOriginalPrice ? originalPrice : Number(selectedService.salePrice);
    const productRate = Number(selectedService.priceExchangeRate);
    return {
      price,
      currency,
      exchangeRate: currency === baseCurrency ? 1 : Number.isFinite(productRate) && productRate > 0 ? productRate : 1,
    };
  }, [selectedService, baseCurrency]);
  const appliedRate = selectedRatePriceList || catalogRate;
  const appliedRateCurrency = appliedRate ? normalizeCurrency(appliedRate.currency) : undefined;
  const showEquivalent = Boolean(appliedRate && displayMode !== 'ORIGINAL' && displayCurrency !== appliedRateCurrency);

  return <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
    <section className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex min-w-0 items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Tags className="size-5" /></div><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Catálogo de hotel</p><h2 className="mt-1 break-words text-xl font-black">Tipos de habitación</h2><p className="mt-1 text-sm text-muted-foreground">La tarifa se toma de un servicio de Inventario.</p></div></div>
      {canCreateRoomTypes && <form className="grid min-w-0 grid-cols-1 gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 sm:grid-cols-2 sm:items-end" onSubmit={(event) => { event.preventDefault(); void onCreateType({ code: typeForm.code, name: typeForm.name, rateProductId: typeForm.rateProductId, ...(effectiveRatePriceListId ? { ratePriceListId: effectiveRatePriceListId } : {}), capacity: Math.max(1, Number(typeForm.capacity) || 1) }); setTypeForm(emptyTypeForm()); }}>
        <Input aria-label="Código del tipo" placeholder="Código · DBL" value={typeForm.code} onChange={(event) => setTypeForm({ ...typeForm, code: event.target.value })} required />
        <Input aria-label="Nombre del tipo" placeholder="Nombre · Habitación doble" value={typeForm.name} onChange={(event) => setTypeForm({ ...typeForm, name: event.target.value })} required />
        <select aria-label="Servicio asociado a la tarifa" className="h-10 min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm sm:col-span-2" value={typeForm.rateProductId} onChange={(event) => setTypeForm({ ...typeForm, rateProductId: event.target.value, ratePriceListId: '' })} required><option value="">Selecciona servicio de tarifa</option>{services.filter((service) => service.isActive !== false).map((service) => <option key={service.id} value={service.id}>{service.code ? `${service.code} · ` : ''}{service.name}</option>)}</select>
        {typeForm.rateProductId && ratePriceListsQuery.isPending && <p className="text-xs text-muted-foreground sm:col-span-2" role="status">Consultando listas de precios del servicio…</p>}
        {typeForm.rateProductId && ratePriceListsQuery.isError && <div className="flex min-w-0 flex-col gap-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive sm:col-span-2 sm:flex-row sm:items-center sm:justify-between" role="alert"><span>No se pudieron cargar las listas de precios. Reintenta antes de agregar el tipo.</span><Button type="button" variant="outline" size="sm" className="shrink-0" disabled={ratePriceListsQuery.isFetching} onClick={() => void ratePriceListsQuery.refetch()}>Reintentar</Button></div>}
        {hasConfiguredRatePriceLists && <select aria-label="Lista de precios para la tarifa" className="h-10 min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm sm:col-span-2" value={effectiveRatePriceListId} onChange={(event) => setTypeForm({ ...typeForm, ratePriceListId: event.target.value })} required><option value="">Selecciona lista de precios</option>{ratePriceLists.map((list) => <option key={list.id} value={list.id}>{list.name} · {formatExplicitAmount(list.price, normalizeCurrency(list.currency))}</option>)}</select>}
        {typeForm.rateProductId && appliedRate && <div className="min-w-0 rounded-lg border border-primary/15 bg-primary/[0.04] px-3 py-2 sm:col-span-2" aria-live="polite"><div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Tarifa aplicada</p><p className="break-words text-sm font-semibold text-foreground">{selectedRatePriceList?.name || 'Precio de catálogo'}<span className="ml-2 text-xs font-normal text-muted-foreground">{selectedRatePriceList?.source === 'CONFIGURED' ? 'Precio configurado' : 'Precio del catálogo'}</span></p></div><p className="min-w-0 break-words text-sm font-bold tabular-nums text-foreground sm:text-right">{formatExplicitAmount(appliedRate.price, appliedRateCurrency!)}{showEquivalent && <span className="ml-2 text-xs font-medium text-muted-foreground">Equivalente {formatConvertedAmount(appliedRate.price, appliedRateCurrency, appliedRate.exchangeRate)}</span>}</p></div></div>}
        <div className="min-w-0 space-y-1">
          <Label htmlFor="hotel-room-type-capacity" className="ml-1 text-xs font-medium text-muted-foreground">Máximo de personas por habitación</Label>
          <Input id="hotel-room-type-capacity" aria-label="Capacidad máxima" type="number" min="1" max="50" value={typeForm.capacity} onChange={(event) => setTypeForm({ ...typeForm, capacity: event.target.value })} />
        </div>
        <Button type="submit" className="h-10 w-full sm:self-end" disabled={saving || !services.length || Boolean(typeForm.rateProductId && (ratePriceListsQuery.isPending || ratePriceListsQuery.isError)) || (hasConfiguredRatePriceLists && !effectiveRatePriceListId)}><Plus className="size-4" />Agregar tipo</Button>
      </form>}
      {!services.length && <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">Crea primero el producto de tipo Servicio en Inventario para asociarlo a la tarifa.</p>}
      <div className="mt-4 space-y-2">
        {roomTypes.map((type) => <div key={type.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-border/60 p-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><BedDouble className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{type.name}</p><Badge variant="outline">{type.code}</Badge>{!type.isActive && <Badge variant="secondary">Inactivo</Badge>}</div><p className="mt-1 truncate text-xs text-muted-foreground">{type.rateProduct?.name || 'Servicio no disponible'} · Capacidad {type.capacity} · {type._count?.rooms ?? rooms.filter((room) => room.roomTypeId === type.id).length} habitaciones</p></div>{canChangeRoomTypeAvailability && <Button variant="ghost" size="icon" aria-label={type.isActive ? `Inhabilitar ${type.name}` : `Habilitar ${type.name}`} disabled={saving} onClick={() => onToggleType(type)}>{type.isActive ? <CircleOff className="size-4" /> : <Check className="size-4" />}</Button>}</div>)}
        {!roomTypes.length && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Agrega tipos de habitación para comenzar.</p>}
      </div>
    </section>

    <section className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex min-w-0 items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BedDouble className="size-5" /></div><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Unidades físicas</p><h2 className="mt-1 break-words text-xl font-black">Habitaciones</h2><p className="mt-1 text-sm text-muted-foreground">Cada habitación se reserva por fechas y sucursal.</p></div></div>
      {canCreateRooms && <form className="grid min-w-0 grid-cols-1 gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void onCreateRoom(roomForm); setRoomForm({ roomTypeId: '', code: '', name: '', floor: '' }); }}>
        <select aria-label="Tipo de habitación" className="h-10 min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm" value={roomForm.roomTypeId} onChange={(event) => setRoomForm({ ...roomForm, roomTypeId: event.target.value })} required><option value="">Tipo de habitación</option>{activeTypes.map((type) => <option key={type.id} value={type.id}>{type.code} · {type.name}</option>)}</select>
        <Input aria-label="Código de la habitación" placeholder="Código · 201" value={roomForm.code} onChange={(event) => setRoomForm({ ...roomForm, code: event.target.value })} required />
        <Input aria-label="Nombre de la habitación" placeholder="Nombre · Suite 201" value={roomForm.name} onChange={(event) => setRoomForm({ ...roomForm, name: event.target.value })} required />
        <Input aria-label="Piso o ubicación" placeholder="Piso / ubicación" value={roomForm.floor} onChange={(event) => setRoomForm({ ...roomForm, floor: event.target.value })} />
        <Button type="submit" className="h-10 w-full sm:col-span-2" disabled={saving || !activeTypes.length}><Plus className="size-4" />Agregar habitación</Button>
      </form>}
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        {rooms.map((room) => <article key={room.id} className={`min-w-0 rounded-xl border p-3 ${room.isActive ? 'border-border/60 bg-background/50' : 'border-border/40 bg-muted/30 opacity-70'}`}><div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-black">{room.code} · {room.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{room.roomType?.name || 'Tipo'}{room.floor ? ` · ${room.floor}` : ''}</p></div>{canChangeRoomAvailability && <Button variant="ghost" size="icon" aria-label={room.isActive ? `Inhabilitar ${room.name}` : `Habilitar ${room.name}`} disabled={saving} onClick={() => onToggleRoom(room)}>{room.isActive ? <CircleOff className="size-4" /> : <Check className="size-4" />}</Button>}</div><Badge variant={room.isActive ? 'outline' : 'secondary'} className="mt-3">{room.isActive ? 'Habilitada' : 'Inactiva'}</Badge></article>)}
        {!rooms.length && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground sm:col-span-2">Agrega las habitaciones físicas de esta sucursal.</p>}
      </div>
    </section>
  </div>;
}
