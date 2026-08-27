import { useEffect, useMemo, useState } from 'react';
import { ChefHat, Loader2, Minus, Plus, Send, ShoppingBag, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { getApiErrorMessage } from '../../services/api';
import { restaurantService, type RestaurantMenuCategory, type RestaurantPublicBranding } from '../../services/restaurant.service';

type MenuTheme = RestaurantPublicBranding['theme'];

const DEFAULT_BRANDING: RestaurantPublicBranding = {
  name: 'Restaurante',
  logo: null,
  primaryColor: '#10b981',
  accentColor: '#064e3b',
  theme: 'modern',
  showImages: true,
  whiteLabel: false,
};

const money = (value: number) => `C$ ${Number(value || 0).toFixed(2)}`;

function themeStyles(theme: MenuTheme, primary: string, accent: string) {
  switch (theme) {
    case 'classic':
      return {
        page: 'bg-[#faf7f0]',
        header: `bg-gradient-to-b from-[${accent}] to-[#00000055]`,
        card: 'bg-white border-2 border-[#e7ddc9]',
        category: 'font-serif text-2xl font-bold',
        itemName: 'font-serif font-bold',
        price: `font-serif font-black text-[${primary}]`,
        addButton: 'bg-[#2b2b2b] hover:bg-[#3d3d3d] text-white rounded-md',
        badge: `bg-[${primary}]`,
      };
    case 'elegant':
      return {
        page: 'bg-[#0f0f13] text-slate-100',
        header: `bg-gradient-to-b from-[#16161d] to-transparent`,
        card: 'bg-[#18181f] border border-white/10',
        category: 'text-2xl font-light tracking-[0.3em] uppercase',
        itemName: 'font-light',
        price: `font-light text-[${primary}]`,
        addButton: 'bg-white/10 hover:bg-white/20 text-white rounded-full',
        badge: `bg-[${primary}] text-slate-900`,
      };
    case 'rustic':
      return {
        page: 'bg-[#f5efe4]',
        header: 'bg-[#3e2f1f]',
        card: 'bg-[#fffcf5] border border-[#d8c7a8]',
        category: 'text-xl font-black uppercase tracking-wide',
        itemName: 'font-bold',
        price: `font-black text-[#8a5a2b]`,
        addButton: 'bg-[#6b4a2a] hover:bg-[#5a3d22] text-white rounded-md',
        badge: 'bg-[#6b4a2a]',
      };
    default:
      return {
        page: 'bg-[#f2faf5]',
        header: `bg-gradient-to-br from-[${accent}] to-[${primary}]`,
        card: 'bg-white/80 backdrop-blur-sm border border-white/60',
        category: 'text-xl font-black',
        itemName: 'font-bold',
        price: `font-black text-[${primary}]`,
        addButton: 'bg-[#0d1f1a] hover:bg-[#174a3a] text-white rounded-xl',
        badge: `bg-[${primary}]`,
      };
  }
}

export function PublicRestaurantMenuPage({ tableToken }: { tableToken: string }) {
  const [table, setTable] = useState<{ name: string; code: string } | null>(null);
  const [categories, setCategories] = useState<RestaurantMenuCategory[]>([]);
  const [branding, setBranding] = useState<RestaurantPublicBranding>(DEFAULT_BRANDING);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sentNumber, setSentNumber] = useState('');
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    restaurantService.getPublicMenu(tableToken, controller.signal).then((result) => {
      setTable(result.table);
      setCategories(result.categories || []);
      if (result.branding) setBranding({ ...DEFAULT_BRANDING, ...result.branding });
    }).catch((error: unknown) => {
      if (!(error instanceof Error) || error.name !== 'AbortError') toast.error(getApiErrorMessage(error, 'Esta carta no está disponible.'));
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [tableToken]);

  const t = themeStyles(branding.theme, branding.primaryColor, branding.accentColor);
  const isDark = branding.theme === 'elegant';

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
      setShowCart(false);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo enviar el pedido.'));
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className={`flex min-h-screen items-center justify-center ${isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}`}><Loader2 className="mr-2 size-5 animate-spin" />Cargando carta…</div>;

  const featured = categories.flatMap((category) => category.items.filter((item) => item.isFeatured));

  return <main className={`min-h-screen px-4 pb-28 pt-6 text-slate-900 sm:px-6 ${t.page}`}>
    <div className="mx-auto max-w-5xl">
      <header className={`relative overflow-hidden rounded-3xl p-6 shadow-xl sm:p-8 ${t.header}`} style={{ background: `linear-gradient(135deg, ${branding.accentColor}, ${branding.primaryColor})` }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {branding.logo ? <img src={branding.logo} alt={branding.name} className="size-14 rounded-2xl border border-white/20 object-cover shadow-lg" /> : <div className="flex size-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur"><ChefHat className="size-7" /></div>}
            <div>
              <h1 className="text-2xl font-black text-white sm:text-4xl">{branding.name}</h1>
              <p className="mt-1 text-sm font-medium text-white/80">Mesa {table?.code || '—'} · {table?.name || 'Carta digital'}</p>
            </div>
          </div>
          {featured.length > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
              <Star className="size-3.5 fill-amber-300 text-amber-300" /> Recomendados de la casa
            </div>
          )}
        </div>
      </header>

      {sentNumber ? (
        <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-600 text-white"><Send className="size-6" /></div>
          <h2 className="mt-4 text-2xl font-black text-emerald-900">Pedido recibido</h2>
          <p className="mt-2 text-emerald-800">Tu comanda <strong>{sentNumber}</strong> fue enviada al restaurante.</p>
          <Button className="mt-5" style={{ background: branding.primaryColor }} onClick={() => setSentNumber('')}>Hacer otro pedido</Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
          <section className="space-y-5">
            {categories.map((category) => (
              <div key={category.id} className={`rounded-3xl p-5 shadow-sm ${t.card}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className={t.category} style={{ color: branding.accentColor }}>{category.name}</h2>
                    {category.description && <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{category.description}</p>}
                  </div>
                  <span className="h-px flex-1 mx-4 bg-current opacity-10" />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {category.items.map((item) => {
                    const qty = cart[item.id] || 0;
                    return (
                      <div key={item.id} className={`rounded-2xl p-4 transition-all ${isDark ? 'bg-white/[0.04] border border-white/10' : 'bg-white/70 border border-slate-100 hover:border-slate-200 hover:shadow-md'}`}>
                        <div className="flex justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={t.itemName}>{item.name}</p>
                              {item.isFeatured && <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />}
                            </div>
                            <p className={`mt-1 text-xs leading-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.description || 'Preparado al momento.'}</p>
                          </div>
                          {branding.showImages && item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="size-16 shrink-0 rounded-xl object-cover" />
                          ) : (
                            <span className={`shrink-0 ${t.price}`}>{money(item.price)}</span>
                          )}
                        </div>
                        {branding.showImages && item.imageUrl && <p className={`mt-2 text-right ${t.price}`}>{money(item.price)}</p>}
                        <div className="mt-3 flex items-center justify-end gap-2">
                          {qty > 0 ? (
                            <div className="flex items-center gap-2">
                              <button type="button" aria-label="Quitar uno" onClick={() => change(item.id, -1)} className="flex size-8 items-center justify-center rounded-full border border-slate-300 text-slate-600 active:scale-90"><Minus className="size-3.5" /></button>
                              <span className="min-w-5 text-center text-sm font-black">{qty}</span>
                              <button type="button" aria-label="Agregar uno" onClick={() => change(item.id, 1)} className="flex size-8 items-center justify-center rounded-full text-white active:scale-90" style={{ background: branding.primaryColor }}><Plus className="size-3.5" /></button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => change(item.id, 1)} className={`flex h-9 items-center gap-1.5 px-4 text-xs font-black uppercase tracking-wide text-white active:scale-95 ${t.addButton}`} style={{ background: t.addButton.includes('bg-[') ? undefined : branding.primaryColor }}>
                              <Plus className="size-3.5" /> Agregar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <div className={`rounded-3xl p-10 text-center ${t.card}`}>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>La carta todavía no tiene platillos. Regresa pronto.</p>
              </div>
            )}
          </section>

          <aside className="hidden lg:block">
            <div className={`sticky top-6 rounded-3xl p-5 shadow-lg ${t.card}`}>
              <div className="flex items-center gap-2">
                <ShoppingBag className="size-4" style={{ color: branding.primaryColor }} />
                <h3 className="text-sm font-black uppercase tracking-widest">Tu pedido</h3>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-black text-white ${t.badge}`} style={{ background: branding.primaryColor }}>{lines.length}</span>
              </div>
              {lines.length ? (
                <div className="mt-4 space-y-2">
                  {lines.map(({ item, quantity }) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate"><strong>{quantity}×</strong> {item.name}</span>
                      <span className="shrink-0 font-bold">{money(Number(item.price) * quantity)}</span>
                    </div>
                  ))}
                  <div className="mt-3 border-t pt-3">
                    <div className="flex justify-between text-base font-black"><span>Total</span><span style={{ color: branding.primaryColor }}>{money(total)}</span></div>
                  </div>
                </div>
              ) : <p className={`mt-4 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Todavía no agregas platillos. Explora la carta y toca «Agregar».</p>}
              <div className="mt-4 space-y-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre (opcional)" className="h-10 rounded-xl text-sm" />
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono (opcional)" className="h-10 rounded-xl text-sm" />
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas para la cocina" className="h-10 rounded-xl text-sm" />
                <Button className="w-full h-11 rounded-xl font-black uppercase tracking-wide" disabled={!lines.length || sending} style={{ background: branding.primaryColor }} onClick={sendOrder}>
                  {sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />} Enviar pedido
                </Button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>

    {/* Carrito móvil flotante */}
    {!sentNumber && lines.length > 0 && (
      <div className="fixed inset-x-4 bottom-4 z-40 lg:hidden">
        <button type="button" onClick={() => setShowCart(!showCart)} className="flex w-full items-center justify-between rounded-2xl px-5 py-4 text-white shadow-2xl" style={{ background: branding.accentColor }}>
          <span className="flex items-center gap-2 text-sm font-black"><ShoppingBag className="size-4" /> {lines.length} platillo{lines.length === 1 ? '' : 's'} · {money(total)}</span>
          <span className="text-xs font-bold uppercase tracking-wide">Ver pedido</span>
        </button>
        {showCart && (
          <div className={`mt-2 max-h-72 overflow-y-auto rounded-2xl p-4 shadow-2xl ${t.card}`}>
            {lines.map(({ item, quantity }) => (
              <div key={item.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <span className="min-w-0 truncate"><strong>{quantity}×</strong> {item.name}</span>
                <span className="shrink-0 font-bold">{money(Number(item.price) * quantity)}</span>
              </div>
            ))}
            <div className="mt-2 space-y-2 border-t pt-3">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre (opcional)" className="h-10 rounded-xl text-sm" />
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas para la cocina" className="h-10 rounded-xl text-sm" />
              <Button className="w-full h-11 rounded-xl font-black uppercase" disabled={sending} style={{ background: branding.primaryColor }} onClick={sendOrder}>
                {sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />} Enviar pedido
              </Button>
            </div>
          </div>
        )}
      </div>
    )}
  </main>;
}
