import { useEffect, useMemo, useState } from 'react';
import { Check, ChefHat, Loader2, Minus, Plus, Send, ShoppingBag, Star, X } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { getApiErrorMessage } from '../../services/api';
import { restaurantService, type RestaurantMenuCategory, type RestaurantMenuItem, type RestaurantMenuOptionGroup, type RestaurantPublicBranding } from '../../services/restaurant.service';
import { hotelService } from '../../services/hotel.service';
import { getReadableForeground, getReadableForegroundForBackgrounds } from '../../utils/color-contrast';

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

function themeStyles(theme: MenuTheme, _primary: string, _accent: string) {
  switch (theme) {
    case 'classic':
      return {
        page: 'bg-[#faf7f0]',
        header: 'bg-[#3a3a3a]',
        card: 'bg-white border-2 border-[#e7ddc9]',
        category: 'font-serif text-2xl font-bold',
        itemName: 'font-serif font-bold',
        price: 'font-serif font-black',
        addButton: 'bg-[#2b2b2b] hover:bg-[#3d3d3d] text-white rounded-md',
        badge: 'rounded-full',
      };
    case 'elegant':
      return {
        page: 'bg-[#0f0f13] text-slate-100',
        header: `bg-gradient-to-b from-[#16161d] to-transparent`,
        card: 'bg-[#18181f] border border-white/10',
        category: 'text-2xl font-light tracking-[0.3em] uppercase',
        itemName: 'font-light',
        price: 'font-light',
        addButton: 'bg-white/10 hover:bg-white/20 text-white rounded-full',
        badge: 'rounded-full text-slate-900',
      };
    case 'rustic':
      return {
        page: 'bg-[#f5efe4]',
        header: 'bg-[#3e2f1f]',
        card: 'bg-[#fffcf5] border border-[#d8c7a8]',
        category: 'text-xl font-black uppercase tracking-wide',
        itemName: 'font-bold',
        price: 'font-black text-[#8a5a2b]',
        addButton: 'bg-[#6b4a2a] hover:bg-[#5a3d22] text-white rounded-md',
        badge: 'rounded-full bg-[#6b4a2a]',
      };
    case 'neon':
      return {
        page: 'bg-[#0b1020] text-slate-100',
        header: 'bg-[#111827]',
        card: 'border border-cyan-300/15 bg-[#131b2f] shadow-2xl shadow-cyan-950/20',
        category: 'text-2xl font-black tracking-tight uppercase',
        itemName: 'font-semibold',
        price: 'font-black text-cyan-300',
        addButton: 'rounded-xl bg-cyan-300 text-slate-950 hover:bg-cyan-200',
        badge: 'rounded-full',
      };
    case 'tropical':
      return {
        page: 'bg-[#fff8e7]',
        header: 'bg-[#0f766e]',
        card: 'border border-amber-200 bg-white/90 shadow-md',
        category: 'text-2xl font-black text-teal-900',
        itemName: 'font-bold',
        price: 'font-black text-orange-600',
        addButton: 'rounded-full bg-orange-500 text-white hover:bg-orange-600',
        badge: 'rounded-full',
      };
    case 'editorial':
      return {
        page: 'bg-[#f5f2eb]',
        header: 'bg-[#7c2d12]',
        card: 'border border-stone-200 bg-[#fffdf8]',
        category: 'font-serif text-3xl font-black tracking-tight',
        itemName: 'font-serif font-bold',
        price: 'font-serif font-black text-orange-900',
        addButton: 'rounded-none border border-orange-900 bg-transparent text-orange-900 hover:bg-orange-50',
        badge: 'rounded-full',
      };
    case 'retro':
      return {
        page: 'bg-[#f9edcf]',
        header: 'bg-[#9f1239]',
        card: 'border-2 border-amber-900/20 bg-[#fffaf0] shadow-[6px_6px_0_rgba(159,18,57,.15)]',
        category: 'text-2xl font-black uppercase tracking-wide text-rose-900',
        itemName: 'font-black',
        price: 'font-black text-rose-700',
        addButton: 'rounded-none bg-amber-400 text-rose-950 hover:bg-amber-300',
        badge: 'rounded-full',
      };
    default:
      return {
        page: 'bg-[#f2faf5]',
        header: 'bg-gradient-to-br from-[#064e3b] to-[#10b981]',
        card: 'bg-white/80 backdrop-blur-sm border border-white/60',
        category: 'text-xl font-black',
        itemName: 'font-bold',
        price: 'font-black',
        addButton: 'bg-[#0d1f1a] hover:bg-[#174a3a] text-white rounded-xl',
        badge: 'rounded-full',
      };
  }
}

type SelectedOptions = Record<string, string | string[]>;
type GuestCartLine = { itemId: string; quantity: number; selectedOptions: SelectedOptions };

export function PublicRestaurantMenuPage({ tableToken, hotelToken }: { tableToken?: string; hotelToken?: string }) {
  const isHotelStay = Boolean(hotelToken);
  const [table, setTable] = useState<{ name: string; code: string } | null>(null);
  const [categories, setCategories] = useState<RestaurantMenuCategory[]>([]);
  const [branding, setBranding] = useState<RestaurantPublicBranding>(DEFAULT_BRANDING);
  const [cart, setCart] = useState<Record<string, GuestCartLine>>({});
  const [selectingItem, setSelectingItem] = useState<RestaurantMenuItem | null>(null);
  const [selectionDraft, setSelectionDraft] = useState<SelectedOptions>({});
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sentNumber, setSentNumber] = useState('');
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const request = hotelToken
      ? hotelService.getGuestMenu(hotelToken, controller.signal)
      : tableToken ? restaurantService.getPublicMenu(tableToken, controller.signal) : Promise.reject(new Error('Enlace no disponible.'));
    request.then((result) => {
      setTable(result.table);
      setCategories(result.categories || []);
      if (result.branding) setBranding({ ...DEFAULT_BRANDING, ...result.branding });
    }).catch((error: unknown) => {
      if (!(error instanceof Error) || error.name !== 'AbortError') toast.error(getApiErrorMessage(error, 'Esta carta no está disponible.'));
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [hotelToken, tableToken]);

  const t = themeStyles(branding.theme, branding.primaryColor, branding.accentColor);
  const isDark = branding.theme === 'elegant';
  const primaryForeground = getReadableForeground(branding.primaryColor);
  const accentForeground = getReadableForeground(branding.accentColor);
  const headerForeground = getReadableForegroundForBackgrounds([branding.accentColor, branding.primaryColor]);

  const itemById = useMemo(() => new Map(categories.flatMap((category) => category.items).map((item) => [item.id, item])), [categories]);
  const lines = useMemo(() => Object.entries(cart).flatMap(([key, line]) => {
    const item = itemById.get(line.itemId);
    return item ? [{ key, item, quantity: line.quantity, selectedOptions: line.selectedOptions }] : [];
  }), [cart, itemById]);
  const optionPrice = (item: RestaurantMenuItem, selected: SelectedOptions) => (item.options || []).reduce((total, group) => {
    const value = selected[group.id];
    const ids = Array.isArray(value) ? value : value ? [value] : [];
    return total + ids.reduce((sum, id) => sum + Number(group.choices.find((choice) => choice.id === id)?.priceAdjustment || 0), 0);
  }, 0);
  const optionNames = (item: RestaurantMenuItem, selected: SelectedOptions) => (item.options || []).flatMap((group) => {
    const value = selected[group.id];
    const ids = Array.isArray(value) ? value : value ? [value] : [];
    return ids.map((id) => group.choices.find((choice) => choice.id === id)?.name).filter(Boolean);
  }).join(' · ');
  const lineTotal = (item: RestaurantMenuItem, selected: SelectedOptions, quantity: number) => {
    const base = Number(item.price || 0) + optionPrice(item, selected);
    return base * quantity * (1 + Number(item.taxRate || 0) / 100);
  };
  const total = lines.reduce((sum, line) => sum + lineTotal(line.item, line.selectedOptions, line.quantity), 0);
  const addItem = (item: RestaurantMenuItem, selectedOptions: SelectedOptions = {}) => {
    const selectionKey = JSON.stringify(Object.fromEntries(Object.entries(selectedOptions).sort(([a], [b]) => a.localeCompare(b))));
    const key = `${item.id}:${selectionKey}`;
    setCart((current) => ({ ...current, [key]: { itemId: item.id, quantity: (current[key]?.quantity || 0) + 1, selectedOptions } }));
  };
  const addFromMenu = (item: RestaurantMenuItem) => {
    if (item.options?.length) {
      setSelectingItem(item);
      setSelectionDraft({});
    } else addItem(item);
  };
  const change = (key: string, delta: number) => setCart((current) => {
    const next = { ...current };
    const line = next[key];
    if (!line) return current;
    const quantity = line.quantity + delta;
    if (quantity <= 0) delete next[key];
    else next[key] = { ...line, quantity };
    return next;
  });

  const confirmOptions = () => {
    if (!selectingItem) return;
    const missing = (selectingItem.options || []).find((group) => group.required && !selectionDraft[group.id]);
    if (missing) { toast.error(`Selecciona una opción para ${missing.name}.`); return; }
    addItem(selectingItem, selectionDraft);
    setSelectingItem(null);
  };

  const sendOrder = async () => {
    if (!lines.length) return;
    setSending(true);
    try {
      const payload = { items: lines.map(({ item, quantity, selectedOptions }) => ({ menuItemId: item.id, quantity, selectedOptions })), ...(notes.trim() ? { notes: notes.trim() } : {}) };
      const order = isHotelStay
        ? await hotelService.createGuestOrder(hotelToken!, payload)
        : await restaurantService.createPublicOrder(tableToken!, { ...payload, customerName: name || undefined, customerPhone: phone || undefined });
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
      <header className={`relative overflow-hidden rounded-3xl p-6 shadow-xl sm:p-8 ${t.header}`} style={{ background: `linear-gradient(135deg, ${branding.accentColor}, ${branding.primaryColor})`, color: headerForeground }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {branding.logo ? <img src={branding.logo} alt={branding.name} className="size-14 rounded-2xl border border-white/20 object-cover shadow-lg" /> : <div className="flex size-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur"><ChefHat className="size-7" /></div>}
            <div>
            <h1 className="text-2xl font-black sm:text-4xl" style={{ color: headerForeground }}>{branding.name}</h1>
            <p className="mt-1 text-sm font-medium" style={{ color: headerForeground }}>{isHotelStay ? table?.name || 'Servicios para tu estadía' : `Mesa ${table?.code || '—'} · ${table?.name || 'Carta digital'}`}</p>
            </div>
          </div>
          {featured.length > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur" style={{ color: headerForeground }}>
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
          <Button className="mt-5" style={{ background: branding.primaryColor, color: primaryForeground }} onClick={() => setSentNumber('')}>Hacer otro pedido</Button>
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
                    const qty = Object.values(cart).filter((line) => line.itemId === item.id).reduce((sum, line) => sum + line.quantity, 0);
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
                            <span className={`shrink-0 ${t.price}`} style={{ color: branding.primaryColor }}>{item.options?.length ? `Desde ${money(item.price)}` : money(item.price)}</span>
                          )}
                        </div>
                        {branding.showImages && item.imageUrl && <p className={`mt-2 text-right ${t.price}`} style={{ color: branding.primaryColor }}>{item.options?.length ? `Desde ${money(item.price)}` : money(item.price)}</p>}
                        <div className="mt-3 flex items-center justify-end gap-2">
                          {qty > 0 && !item.options?.length ? (
                            <div className="flex items-center gap-2">
                              <button type="button" aria-label="Quitar uno" onClick={() => { const line = lines.find((current) => current.item.id === item.id); if (line) change(line.key, -1); }} className="flex size-8 items-center justify-center rounded-full border border-slate-300 text-slate-600 active:scale-90"><Minus className="size-3.5" /></button>
                              <span className="min-w-5 text-center text-sm font-black">{qty}</span>
                              <button type="button" aria-label="Agregar uno" onClick={() => addFromMenu(item)} className="flex size-8 items-center justify-center active:scale-90" style={{ background: branding.primaryColor, color: primaryForeground }}><Plus className="size-3.5" /></button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => addFromMenu(item)} className={`flex h-9 items-center gap-1.5 px-4 text-xs font-black uppercase tracking-wide active:scale-95 ${t.addButton}`}>
                              <Plus className="size-3.5" /> {item.options?.length ? 'Elegir opciones' : 'Agregar'}
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
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-black ${t.badge}`} style={{ background: branding.primaryColor, color: primaryForeground }}>{lines.length}</span>
              </div>
              {lines.length ? (
                <div className="mt-4 space-y-2">
                  {lines.map(({ key, item, quantity, selectedOptions }) => (
                    <div key={key} className="flex items-start justify-between gap-2 text-sm">
                      <span className="min-w-0"><strong>{quantity}×</strong> {item.name}{optionNames(item, selectedOptions) && <small className="block text-xs text-muted-foreground">{optionNames(item, selectedOptions)}</small>}</span>
                      <span className="flex shrink-0 items-center gap-1"><strong>{money(lineTotal(item, selectedOptions, quantity))}</strong><button type="button" aria-label={`Quitar una unidad de ${item.name}`} onClick={() => change(key, -1)} className="rounded bg-muted px-2 py-0.5">−</button><button type="button" aria-label={`Agregar una unidad de ${item.name}`} onClick={() => change(key, 1)} className="rounded bg-muted px-2 py-0.5">+</button></span>
                    </div>
                  ))}
                  <div className="mt-3 border-t pt-3">
                    <div className="flex justify-between text-base font-black"><span>Total</span><span style={{ color: branding.primaryColor }}>{money(total)}</span></div>
                  </div>
                </div>
              ) : <p className={`mt-4 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Todavía no agregas platillos. Explora la carta y toca «Agregar».</p>}
              <div className="mt-4 space-y-2">
                {!isHotelStay && <><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre (opcional)" className="h-10 rounded-xl text-sm" /><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono (opcional)" className="h-10 rounded-xl text-sm" /></>}
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas para la cocina" className="h-10 rounded-xl text-sm" />
                <Button className="w-full h-11 rounded-xl font-black uppercase tracking-wide" disabled={!lines.length || sending} style={{ background: branding.primaryColor, color: primaryForeground }} onClick={sendOrder}>
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
        <button type="button" onClick={() => setShowCart(!showCart)} className="flex w-full items-center justify-between rounded-2xl px-5 py-4 shadow-2xl" style={{ background: branding.accentColor, color: accentForeground }}>
          <span className="flex items-center gap-2 text-sm font-black"><ShoppingBag className="size-4" /> {lines.length} platillo{lines.length === 1 ? '' : 's'} · {money(total)}</span>
          <span className="text-xs font-bold uppercase tracking-wide">Ver pedido</span>
        </button>
        {showCart && (
          <div className={`mt-2 max-h-72 overflow-y-auto rounded-2xl p-4 shadow-2xl ${t.card}`}>
            {lines.map(({ key, item, quantity, selectedOptions }) => (
              <div key={key} className="flex items-start justify-between gap-2 py-1.5 text-sm">
                <span className="min-w-0"><strong>{quantity}×</strong> {item.name}{optionNames(item, selectedOptions) && <small className="block text-xs text-muted-foreground">{optionNames(item, selectedOptions)}</small>}</span>
                <span className="flex shrink-0 items-center gap-1"><strong>{money(lineTotal(item, selectedOptions, quantity))}</strong><button type="button" aria-label={`Quitar una unidad de ${item.name}`} onClick={() => change(key, -1)} className="rounded bg-muted px-2 py-0.5">−</button><button type="button" aria-label={`Agregar una unidad de ${item.name}`} onClick={() => change(key, 1)} className="rounded bg-muted px-2 py-0.5">+</button></span>
              </div>
            ))}
            <div className="mt-2 space-y-2 border-t pt-3">
              {!isHotelStay && <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre (opcional)" className="h-10 rounded-xl text-sm" />}
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas para la cocina" className="h-10 rounded-xl text-sm" />
              <Button className="w-full h-11 rounded-xl font-black uppercase" disabled={sending} style={{ background: branding.primaryColor, color: primaryForeground }} onClick={sendOrder}>
                {sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />} Enviar pedido
              </Button>
            </div>
          </div>
        )}
      </div>
    )}
    {selectingItem && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3" role="dialog" aria-modal="true" aria-labelledby="guest-options-title"><div className={`max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl p-5 shadow-2xl ${t.card}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest" style={{ color: branding.primaryColor }}>Personaliza tu platillo</p><h2 id="guest-options-title" className="mt-1 text-xl font-black">{selectingItem.name}</h2></div><button type="button" aria-label="Cerrar opciones" onClick={() => setSelectingItem(null)} className="rounded-lg p-2 hover:bg-black/5"><X className="size-5" /></button></div><div className="mt-4 space-y-4">{(selectingItem.options || []).map((group: RestaurantMenuOptionGroup) => <fieldset key={group.id}><legend className="text-sm font-black">{group.name}{group.required && <span className="ml-1 text-rose-600">*</span>}<span className="ml-2 text-xs font-medium text-muted-foreground">{group.multiple ? 'Puedes elegir varios' : 'Elige uno'}</span></legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{group.choices.map((choice) => { const value = selectionDraft[group.id]; const active = Array.isArray(value) ? value.includes(choice.id) : value === choice.id; return <button key={choice.id} type="button" aria-pressed={active} onClick={() => setSelectionDraft((current) => ({ ...current, [group.id]: group.multiple ? (Array.isArray(current[group.id]) ? (current[group.id] as string[]).includes(choice.id) ? (current[group.id] as string[]).filter((id) => id !== choice.id) : [...(current[group.id] as string[]), choice.id] : [choice.id]) : choice.id }))} className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left text-sm transition ${active ? 'border-primary bg-primary/10 ring-2 ring-primary/15' : 'border-border/60 hover:border-primary/40'}`}><span className="font-semibold">{choice.name}</span><span className="flex items-center gap-2 font-bold">{Number(choice.priceAdjustment) > 0 ? `+${money(choice.priceAdjustment)}` : 'Incluido'}{active && <Check className="size-4 text-primary" />}</span></button>; })}</div></fieldset>)}</div><div className="mt-5 flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold">Precio estimado: <strong>{money(Number(selectingItem.price) + optionPrice(selectingItem, selectionDraft))}</strong></p><div className="flex gap-2"><Button variant="outline" onClick={() => setSelectingItem(null)}>Cancelar</Button><Button onClick={confirmOptions} style={{ background: branding.primaryColor, color: primaryForeground }}>Agregar al pedido</Button></div></div></div></div>}
  </main>;
}
