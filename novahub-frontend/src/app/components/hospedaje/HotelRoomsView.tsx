import { useMemo, useState } from 'react';
import { BedDouble, Check, CircleOff, Plus, Tags } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import type { HotelRoom, HotelRoomType } from '../../services/hotel.service';

type ServiceProduct = { id: string; code?: string; name: string; salePrice: number; priceCurrency?: string; itemType?: string; type?: string; isActive?: boolean };
const money = (value: number, currency?: string) => `${currency === 'USD' ? '$' : 'C$'}${Number(value || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}`;

export function HotelRoomsView({ roomTypes, rooms, services, canManage, saving, onCreateType, onCreateRoom, onToggleType, onToggleRoom }: {
  roomTypes: HotelRoomType[];
  rooms: HotelRoom[];
  services: ServiceProduct[];
  canManage: boolean;
  saving: boolean;
  onCreateType: (body: { code: string; name: string; rateProductId: string; capacity: number }) => Promise<void>;
  onCreateRoom: (body: { roomTypeId: string; code: string; name: string; floor?: string }) => Promise<void>;
  onToggleType: (roomType: HotelRoomType) => void;
  onToggleRoom: (room: HotelRoom) => void;
}) {
  const [typeForm, setTypeForm] = useState({ code: '', name: '', rateProductId: '', capacity: '2' });
  const [roomForm, setRoomForm] = useState({ roomTypeId: '', code: '', name: '', floor: '' });
  const activeTypes = useMemo(() => roomTypes.filter((type) => type.isActive), [roomTypes]);

  return <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
    <section className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-start gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Tags className="size-5" /></div><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Catálogo de hospedaje</p><h2 className="mt-1 text-xl font-black">Tipos de habitación</h2><p className="mt-1 text-sm text-muted-foreground">La tarifa se toma de un servicio de Inventario.</p></div></div>
      {canManage && <form className="grid gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void onCreateType({ ...typeForm, capacity: Math.max(1, Number(typeForm.capacity) || 1) }); setTypeForm({ code: '', name: '', rateProductId: '', capacity: '2' }); }}>
        <Input aria-label="Código del tipo" placeholder="Código · DBL" value={typeForm.code} onChange={(event) => setTypeForm({ ...typeForm, code: event.target.value })} required />
        <Input aria-label="Nombre del tipo" placeholder="Nombre · Habitación doble" value={typeForm.name} onChange={(event) => setTypeForm({ ...typeForm, name: event.target.value })} required />
        <select aria-label="Servicio asociado a la tarifa" className="h-10 min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm sm:col-span-2" value={typeForm.rateProductId} onChange={(event) => setTypeForm({ ...typeForm, rateProductId: event.target.value })} required><option value="">Selecciona servicio de tarifa</option>{services.filter((service) => service.isActive !== false).map((service) => <option key={service.id} value={service.id}>{service.code ? `${service.code} · ` : ''}{service.name} · {money(service.salePrice, service.priceCurrency)}</option>)}</select>
        <Input aria-label="Capacidad máxima" type="number" min="1" max="50" value={typeForm.capacity} onChange={(event) => setTypeForm({ ...typeForm, capacity: event.target.value })} />
        <Button type="submit" disabled={saving || !services.length}><Plus className="size-4" />Agregar tipo</Button>
      </form>}
      {!services.length && <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">Crea primero el producto de tipo Servicio en Inventario para asociarlo a la tarifa.</p>}
      <div className="mt-4 space-y-2">
        {roomTypes.map((type) => <div key={type.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-border/60 p-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><BedDouble className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{type.name}</p><Badge variant="outline">{type.code}</Badge>{!type.isActive && <Badge variant="secondary">Inactivo</Badge>}</div><p className="mt-1 truncate text-xs text-muted-foreground">{type.rateProduct?.name || 'Servicio no disponible'} · Capacidad {type.capacity} · {type._count?.rooms ?? rooms.filter((room) => room.roomTypeId === type.id).length} habitaciones</p></div>{canManage && <Button variant="ghost" size="icon" aria-label={type.isActive ? `Inhabilitar ${type.name}` : `Habilitar ${type.name}`} disabled={saving} onClick={() => onToggleType(type)}>{type.isActive ? <CircleOff className="size-4" /> : <Check className="size-4" />}</Button>}</div>)}
        {!roomTypes.length && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Agrega tipos de habitación para comenzar.</p>}
      </div>
    </section>

    <section className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-start gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><BedDouble className="size-5" /></div><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Unidades físicas</p><h2 className="mt-1 text-xl font-black">Habitaciones</h2><p className="mt-1 text-sm text-muted-foreground">Cada habitación se reserva por fechas y sucursal.</p></div></div>
      {canManage && <form className="grid gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void onCreateRoom(roomForm); setRoomForm({ roomTypeId: '', code: '', name: '', floor: '' }); }}>
        <select aria-label="Tipo de habitación" className="h-10 min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm" value={roomForm.roomTypeId} onChange={(event) => setRoomForm({ ...roomForm, roomTypeId: event.target.value })} required><option value="">Tipo de habitación</option>{activeTypes.map((type) => <option key={type.id} value={type.id}>{type.code} · {type.name}</option>)}</select>
        <Input aria-label="Código de la habitación" placeholder="Código · 201" value={roomForm.code} onChange={(event) => setRoomForm({ ...roomForm, code: event.target.value })} required />
        <Input aria-label="Nombre de la habitación" placeholder="Nombre · Suite 201" value={roomForm.name} onChange={(event) => setRoomForm({ ...roomForm, name: event.target.value })} required />
        <Input aria-label="Piso o ubicación" placeholder="Piso / ubicación" value={roomForm.floor} onChange={(event) => setRoomForm({ ...roomForm, floor: event.target.value })} />
        <Button type="submit" className="sm:col-span-2" disabled={saving || !activeTypes.length}><Plus className="size-4" />Agregar habitación</Button>
      </form>}
      <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2">
        {rooms.map((room) => <article key={room.id} className={`min-w-0 rounded-xl border p-3 ${room.isActive ? 'border-border/60 bg-background/50' : 'border-border/40 bg-muted/30 opacity-70'}`}><div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-black">{room.code} · {room.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{room.roomType?.name || 'Tipo'}{room.floor ? ` · ${room.floor}` : ''}</p></div>{canManage && <Button variant="ghost" size="icon" aria-label={room.isActive ? `Inhabilitar ${room.name}` : `Habilitar ${room.name}`} disabled={saving} onClick={() => onToggleRoom(room)}>{room.isActive ? <CircleOff className="size-4" /> : <Check className="size-4" />}</Button>}</div><Badge variant={room.isActive ? 'outline' : 'secondary'} className="mt-3">{room.isActive ? 'Habilitada' : 'Inactiva'}</Badge></article>)}
        {!rooms.length && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground sm:col-span-2">Agrega las habitaciones físicas de esta sucursal.</p>}
      </div>
    </section>
  </div>;
}
