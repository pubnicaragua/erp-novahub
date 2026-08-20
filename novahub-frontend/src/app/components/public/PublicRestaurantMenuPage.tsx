import { useEffect, useMemo, useState } from 'react';
import { ChefHat, Loader2, Minus, Plus, Send, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { getApiErrorMessage } from '../../services/api';
import { restaurantService, type RestaurantMenuCategory } from '../../services/restaurant.service';

export function PublicRestaurantMenuPage({ tableToken }: { tableToken: string }) {
  const [table, setTable] = useState<{ name: string; code: string } | null>(null);
  const [categories, setCategories] = useState<RestaurantMenuCategory[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sentNumber, setSentNumber] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    restaurantService.getPublicMenu(tableToken, controller.signal).then((result) => {
      setTable(result.table);
      setCategories(result.categories || []);
    }).catch((error: unknown) => {
      if (!(error instanceof Error) || error.name !== 'AbortError') toast.error(getApiErrorMessage(error, 'Esta carta no está disponible.'));
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [tableToken]);

  const lines = useMemo(() => categories.flatMap((category) => category.items.filter((item) => cart[item.id]).map((item) => ({ item, quantity: cart[item.id] }))), [categories, cart]);
  const total = lines.reduce((sum, line) => sum + Number(line.item.price || 0) * line.quantity, 0);
  const change = (id: string, delta: number) => setCart((current) => {
    const next = { ...current, [id]: (current[id] || 0) + delta };
    if (next[id] <= 0) delete next[id];
    return next;
  });

  const sendOrder = async () => {
    if (!lines.length) return;
    setSending(true);
    try {
      const order = await restaurantService.createPublicOrder(tableToken, { items: lines.map(({ item, quantity }) => ({ menuItemId: item.id, quantity })), customerName: name || undefined, customerPhone: phone || undefined, notes: notes || undefined });
      setSentNumber(order.number);
      setCart({});
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo enviar el pedido.'));
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white"><Loader2 className="mr-2 size-5 animate-spin" />Cargando carta…</div>;
  return <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 text-slate-900 sm:px-6"><div className="mx-auto max-w-6xl"><header className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl"><div className="flex items-center gap-3 text-cyan-300"><ChefHat className="size-6" /><span className="text-xs font-bold uppercase tracking-[0.22em]">NovaHub Menu</span></div><h1 className="mt-5 text-3xl font-black sm:text-5xl">{table?.name || 'Carta digital'}</h1><p className="mt-2 text-slate-300">Mesa {table?.code || '—'} · Selecciona tus platillos y envía el pedido.</p></header>{sentNumber ? <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center"><div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-600 text-white"><Send className="size-6" /></div><h2 className="mt-4 text-2xl font-black text-emerald-900">Pedido recibido</h2><p className="mt-2 text-emerald-800">Tu comanda <strong>{sentNumber}</strong> fue enviada al restaurante.</p><Button className="mt-5" onClick={() => setSentNumber('')}>Hacer otro pedido</Button></div> : <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]"><section className="space-y-5">{categories.map((category) => <div key={category.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black">{category.name}</h2>{category.description && <p className="mt-1 text-sm text-slate-500">{category.description}</p>}<div className="mt-4 grid gap-3 sm:grid-cols-2">{category.items.filter((item) => item.isAvailable).map((item) => <div key={item.id} className="rounded-2xl border border-slate-100 p-4"><div className="flex justify-between gap-3"><div><p className="font-bold">{item.name}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.description || 'Preparado al momento.'}</p></div><span className="shrink-0 font-black text-cyan-700">C$ {Number(item.price).toFixed(2)}</span></div><div className="mt-4 flex items-center justify-end gap-2"><button onClick={() => change(item.id, -1)} className="rounded-lg bg-slate-100 p-2"><Minus className="size-4" /></button><span className="w-6 text-center font-black">{cart[item.id] || 0}</span><button onClick={() => change(item.id, 1)} className="rounded-lg bg-slate-950 p-2 text-white"><Plus className="size-4" /></button></div></div>)}</div></div>)}</section><aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-5"><div className="flex items-center gap-2"><ShoppingBag className="size-5 text-cyan-600" /><h2 className="text-xl font-black">Tu pedido</h2></div><div className="mt-4 space-y-2">{lines.length ? lines.map(({ item, quantity }) => <div key={item.id} className="flex justify-between text-sm"><span>{quantity} × {item.name}</span><span className="font-bold">C$ {(Number(item.price) * quantity).toFixed(2)}</span></div>) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Agrega platillos para comenzar.</p>}</div><div className="my-4 flex justify-between border-t border-slate-100 pt-4 font-black"><span>Total estimado</span><span>C$ {total.toFixed(2)}</span></div><div className="space-y-2"><Input placeholder="Nombre (opcional)" value={name} onChange={(e) => setName(e.target.value)} /><Input placeholder="Teléfono (opcional)" value={phone} onChange={(e) => setPhone(e.target.value)} /><textarea className="min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-cyan-500" placeholder="Notas para cocina" value={notes} onChange={(e) => setNotes(e.target.value)} /></div><Button className="mt-4 w-full" disabled={!lines.length || sending} onClick={sendOrder}>{sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Enviar pedido</Button></aside></div>}</div></main>;
}
