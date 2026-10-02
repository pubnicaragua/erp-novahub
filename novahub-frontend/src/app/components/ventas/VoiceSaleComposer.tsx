import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Mic, MicOff, X } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { toast } from '@/app/services/toast';
import { parseSpanishSalesDictation, type VoiceSaleCatalogProduct, type VoiceSaleLine, type VoiceSaleMetadata, type VoiceSaleSuggestion } from '../../utils/voice-sale-parser';
import { NovaHubLogo } from '../NovaHubLogo';

interface RecognitionResultLike {
  0?: { transcript?: string };
  isFinal?: boolean;
}

interface RecognitionEventLike {
  results: ArrayLike<RecognitionResultLike>;
  resultIndex?: number;
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type RecognitionConstructor = new () => RecognitionLike;

interface VoiceSaleComposerProps<TProduct extends VoiceSaleCatalogProduct> {
  products: TProduct[];
  disabled?: boolean;
  featureEnabled?: boolean;
  title?: string;
  description?: string;
  onApply: (lines: VoiceSaleLine<TProduct>[], metadata: VoiceSaleMetadata) => void;
}

export function VoiceSaleComposer<TProduct extends VoiceSaleCatalogProduct>({
  products,
  disabled = false,
  featureEnabled = true,
  title = 'Venta rápida por voz',
  description = 'Dictá productos y cantidades. Revisá el borrador antes de agregarlo a la venta.',
  onApply,
}: VoiceSaleComposerProps<TProduct>) {
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lines, setLines] = useState<VoiceSaleLine<TProduct>[]>([]);
  const [unmatchedText, setUnmatchedText] = useState('');
  const [suggestions, setSuggestions] = useState<VoiceSaleSuggestion<TProduct>[]>([]);
  const [metadata, setMetadata] = useState<VoiceSaleMetadata>({ customerText: '', total: null, unitPrice: null, unitPriceCurrency: null, paymentMethod: null, notes: '', unmatchedText: '' });
  const [listening, setListening] = useState(false);
  const [wakeMode, setWakeMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const wakeModeRef = useRef(false);
  const wakeRestartTimerRef = useRef<number | null>(null);
  const wakeTextRef = useRef('');
  const finalTranscriptRef = useRef('');

  const hasCatalog = products.length > 0;
  const recognitionConstructor = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const scope = window as typeof window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
  }, []);

  const updateTranscript = (value: string) => {
    setTranscript(value);
    const parsed = parseSpanishSalesDictation(value, products);
    setLines(parsed.lines);
    setUnmatchedText(parsed.unmatchedText);
    setSuggestions(parsed.suggestions);
    setMetadata(parsed.metadata);
  };

  const reset = () => {
    setTranscript('');
    setLines([]);
    setUnmatchedText('');
    setSuggestions([]);
    setMetadata({ customerText: '', total: null, unitPrice: null, unitPriceCurrency: null, paymentMethod: null, notes: '', unmatchedText: '' });
    setError(null);
  };

  const stopRecognition = () => {
    wakeModeRef.current = false;
    setWakeMode(false);
    if (wakeRestartTimerRef.current !== null) window.clearTimeout(wakeRestartTimerRef.current);
    wakeRestartTimerRef.current = null;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  };

  const startWakeWord = () => {
    if (!recognitionConstructor) {
      setError('Este navegador no ofrece activación por voz. Usá el botón Dictar o el micrófono del teclado.');
      setOpen(true);
      return;
    }
    stopRecognition();
    setError(null);
    setOpen(false);
    wakeModeRef.current = true;
    setWakeMode(true);
    wakeTextRef.current = '';
    const recognition = new recognitionConstructor();
    recognition.lang = 'es-NI';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const startIndex = typeof event.resultIndex === 'number' ? event.resultIndex : Math.max(0, event.results.length - 1);
      const delta = Array.from({ length: event.results.length - startIndex }, (_, offset) => event.results[startIndex + offset]?.[0]?.transcript || '').join(' ').trim();
      if (!delta) return;
      wakeTextRef.current = `${wakeTextRef.current} ${delta}`.replace(/\s+/g, ' ').slice(-180);
      if (/\b(?:hola|ola)\s+nova\b/i.test(wakeTextRef.current)) {
        wakeModeRef.current = false;
        setWakeMode(false);
        recognition.stop();
        recognitionRef.current = null;
        window.setTimeout(() => startRecognition(), 120);
      }
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        wakeModeRef.current = false;
        setWakeMode(false);
        setError('El navegador bloqueó el micrófono. Habilitá el permiso para este sitio.');
      }
      // “no-speech” and temporary service errors are normal on mobile. The
      // onend handler keeps the wake listener alive and starts it again.
    };
    recognition.onend = () => {
      setListening(false);
      if (wakeModeRef.current) {
        wakeRestartTimerRef.current = window.setTimeout(() => {
          if (!wakeModeRef.current || recognitionRef.current !== recognition) return;
          try { recognition.start(); setListening(true); } catch { setWakeMode(false); wakeModeRef.current = false; }
        }, 250);
      } else setWakeMode(false);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      wakeModeRef.current = false;
      setWakeMode(false);
      setError('No se pudo activar el micrófono. Revisá el permiso del sitio.');
    }
  };

  const startRecognition = () => {
    if (!recognitionConstructor) {
      setError('Este navegador no ofrece dictado nativo. Escribí el texto manualmente o usá el micrófono del teclado del dispositivo.');
      setOpen(true);
      return;
    }
    stopRecognition();
    reset();
    finalTranscriptRef.current = '';
    setOpen(true);
    const recognition = new recognitionConstructor();
    recognition.lang = 'es-NI';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const startIndex = typeof event.resultIndex === 'number' ? event.resultIndex : Math.max(0, event.results.length - 1);
      let interim = '';
      for (let index = startIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript || '';
        if (result?.isFinal) finalTranscriptRef.current = `${finalTranscriptRef.current} ${text}`.replace(/\s+/g, ' ').trim();
        else interim = `${interim} ${text}`.trim();
      }
      updateTranscript(`${finalTranscriptRef.current} ${interim}`.replace(/\s+/g, ' ').trim());
    };
    recognition.onerror = (event) => {
      setListening(false);
      setError(event.error === 'not-allowed'
        ? 'El navegador bloqueó el micrófono. Habilitá el permiso para este sitio.'
        : 'No se pudo interpretar el dictado. Podés escribir el texto manualmente.');
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setError('No se pudo iniciar el dictado. Revisá el permiso del micrófono.');
    }
  };

  const close = () => {
    stopRecognition();
    setOpen(false);
  };

  const apply = () => {
    if (!lines.length) {
      toast.error('No encontré productos activos del catálogo en el dictado. Revisá el texto antes de continuar.');
      return;
    }
    const missingVariant = lines.find((line) => (line.product.variants || []).filter((variant) => variant.isActive !== false).length > 1 && !line.variantName);
    if (missingVariant) {
      toast.error(`Seleccioná la variante de ${missingVariant.product.name} antes de continuar.`);
      return;
    }
    onApply(lines, metadata);
    close();
    toast.success(`${lines.length} línea(s) agregada(s) al borrador`);
  };

  const selectSuggestion = (suggestion: VoiceSaleSuggestion<TProduct>) => {
    updateTranscript(`${transcript} ${suggestion.product.name}`.trim());
  };

  const selectVariant = (lineIndex: number, variantName: string) => {
    setLines((current) => current.map((line, index) => index === lineIndex
      ? { ...line, variantName: variantName || undefined }
      : line));
  };

  useEffect(() => () => {
    stopRecognition();
  }, []);

  if (!featureEnabled) {
    return (
      <Card className="rounded-3xl border-dashed border-border/70 bg-muted/20 shadow-none" data-tour="pos-voice-disabled">
        <CardContent className="flex items-start gap-3 p-4 sm:p-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><NovaHubLogo size={23} /></span>
          <div className="min-w-0">
            <p className="text-sm font-black">Venta rápida por voz no habilitada</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">El Super Admin puede activarla para este negocio desde sus módulos operativos. La facturación completa continúa disponible sin cambios.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-3xl border-primary/20 bg-primary/[0.025] shadow-sm" data-tour="pos-voice">
      <CardContent className="p-3 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-primary/20">
                <NovaHubLogo size={25} />
              </span>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight">{title}</h3>
                <p className="text-[11px] text-muted-foreground">{description}</p>
              </div>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
            {recognitionConstructor && <Button type="button" size="sm" variant={wakeMode ? 'secondary' : 'outline'} className="h-10 w-full justify-center rounded-xl px-3 font-black sm:w-auto" onClick={wakeMode ? stopRecognition : startWakeWord} disabled={disabled || !hasCatalog}>
              <NovaHubLogo size={18} className="mr-2 rounded-full" />
              {wakeMode ? 'Escuchando “Hola Nova”' : 'Decir “Hola Nova”'}
            </Button>}
            <Button type="button" size="sm" variant={listening && !wakeMode ? 'destructive' : 'default'} className="h-10 w-full justify-center rounded-xl px-3 font-black sm:w-auto" onClick={listening && !wakeMode ? stopRecognition : startRecognition} disabled={disabled || !hasCatalog || wakeMode}>
              {listening ? <MicOff className="mr-2 size-4" /> : <Mic className="mr-2 size-4" />}
              {listening && !wakeMode ? 'Detener dictado' : 'Dictar'}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Parser local: no usa IA, API de transcripción ni tokens. “Hola Nova” funciona mientras esta pantalla está abierta y el navegador mantiene el micrófono autorizado.</p>

        {!hasCatalog && <p className="mt-3 rounded-xl border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs text-amber-800">Cargá el catálogo para poder validar productos antes de agregarlos.</p>}

        {open && <div className="mt-4 space-y-3 rounded-3xl border border-primary/20 bg-background/80 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-primary">Borrador controlado</p>
              <p className="mt-1 text-[11px] text-muted-foreground">No se factura automáticamente. Ejemplo: “30 platos de asado, dos tiras de res y una gaseosa”.</p>
            </div>
            <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg" onClick={close} aria-label="Cerrar venta por voz"><X className="size-4" /></Button>
          </div>
          <Textarea value={transcript} onChange={(event) => updateTranscript(event.target.value)} placeholder="Dictá o escribí la venta…" className="min-h-24 max-h-56 resize-y rounded-xl border-primary/20 bg-background text-base leading-6 sm:text-sm" aria-label="Texto de la venta dictada" />
          {error && <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}
          {lines.length > 0 && <div className="grid gap-2 sm:grid-cols-2">
            {lines.map((line, lineIndex) => {
              const variants = (line.product.variants || []).filter((variant) => variant.isActive !== false);
              const needsVariant = variants.length > 1 && !line.variantName;
              return <div key={`${line.product.id}-${line.variantName || 'base'}-${lineIndex}`} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${needsVariant ? 'border-amber-300/70 bg-amber-50/60' : 'border-border/60 bg-card'}`}>
                <div className="min-w-0"><p className="truncate text-xs font-bold text-foreground">{line.product.name}</p>{line.variantName && <p className="truncate text-[10px] text-amber-700">Variante: {line.variantName}</p>}{needsVariant && <p className="mt-1 text-[10px] font-semibold text-amber-800">Elegí una variante para continuar</p>}</div>
                <div className="flex shrink-0 items-center gap-2">
                  {variants.length > 1 && <label className="relative"><span className="sr-only">Variante de {line.product.name}</span><select value={line.variantName || ''} onChange={(event) => selectVariant(lineIndex, event.target.value)} className="h-8 max-w-36 appearance-none rounded-lg border border-amber-300 bg-background px-2 pr-7 text-[11px] font-semibold text-foreground outline-none focus:border-primary"><option value="">Variante…</option>{variants.map((variant) => <option key={variant.id} value={variant.name}>{variant.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 top-2 size-3.5 text-muted-foreground" /></label>}
                  <Badge className="bg-primary/10 text-primary">× {line.quantity}</Badge>
                </div>
              </div>;
            })}
          </div>}
          {(metadata.customerText || metadata.total !== null || metadata.unitPrice !== null || metadata.paymentMethod || metadata.notes) && <div className="grid gap-2 rounded-xl border border-sky-200/50 bg-sky-50/60 p-3 text-xs text-sky-950 sm:grid-cols-2">
            <p><span className="font-bold">Cliente:</span> {metadata.customerText || 'No detectado'}</p>
            <p><span className="font-bold">Total dictado:</span> {metadata.total === null ? 'No detectado' : metadata.total.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</p>
            {metadata.unitPrice !== null && <p><span className="font-bold">Precio dictado:</span> {metadata.unitPriceCurrency === 'USD' ? 'US$' : 'C$'}{metadata.unitPrice.toLocaleString('es-NI', { minimumFractionDigits: 2 })} <span className="text-[10px] text-amber-700">(revisar)</span></p>}
            <p><span className="font-bold">Pago:</span> {metadata.paymentMethod === 'CASH' ? 'Efectivo' : metadata.paymentMethod === 'CARD' ? 'Tarjeta' : metadata.paymentMethod === 'TRANSFER' ? 'Transferencia' : metadata.paymentMethod === 'CREDIT' ? 'Crédito' : 'No detectado'}</p>
            {metadata.notes && <p className="sm:col-span-2"><span className="font-bold">Nota:</span> {metadata.notes}</p>}
          </div>}
          {unmatchedText && <div className="space-y-2 rounded-xl border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs text-amber-800"><p>No encontré en el catálogo: <span className="font-bold">{unmatchedText}</span>. No se agregará silenciosamente.</p>{suggestions.length > 0 && <div><p className="font-bold">¿Quisiste decir?</p><div className="mt-2 flex flex-wrap gap-2">{suggestions.map((suggestion) => <Button key={suggestion.product.id} type="button" variant="outline" size="sm" className="h-8 rounded-lg border-amber-300 bg-background text-[11px] text-foreground hover:bg-amber-100" onClick={() => selectSuggestion(suggestion)}>{suggestion.product.name}{(suggestion.product.variants || []).filter((variant) => variant.isActive !== false).length > 1 ? ' · elegir variante' : ''}</Button>)}</div></div>}</div>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" className="rounded-xl" onClick={close}>Cancelar</Button><Button type="button" className="rounded-xl font-black" onClick={apply} disabled={!lines.length}><Check className="mr-2 size-4" /> Agregar al borrador</Button></div>
        </div>}
      </CardContent>
    </Card>
  );
}
