import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Mic, MicOff, X } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { toast } from '@/app/services/toast';
import { parseSpanishSalesDictation, type VoiceSaleCatalogProduct, type VoiceSaleLine, type VoiceSaleMetadata } from '../../utils/voice-sale-parser';
import { NovaHubLogo } from '../NovaHubLogo';

interface RecognitionResultLike {
  0?: { transcript?: string };
}

interface RecognitionEventLike {
  results: ArrayLike<RecognitionResultLike>;
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
  title?: string;
  description?: string;
  onApply: (lines: VoiceSaleLine<TProduct>[], metadata: VoiceSaleMetadata) => void;
}

export function VoiceSaleComposer<TProduct extends VoiceSaleCatalogProduct>({
  products,
  disabled = false,
  title = 'Venta rápida por voz',
  description = 'Dictá productos y cantidades. Revisá el borrador antes de agregarlo a la venta.',
  onApply,
}: VoiceSaleComposerProps<TProduct>) {
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lines, setLines] = useState<VoiceSaleLine<TProduct>[]>([]);
  const [unmatchedText, setUnmatchedText] = useState('');
  const [metadata, setMetadata] = useState<VoiceSaleMetadata>({ customerText: '', total: null, paymentMethod: null, notes: '', unmatchedText: '' });
  const [listening, setListening] = useState(false);
  const [wakeMode, setWakeMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const wakeModeRef = useRef(false);

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
    setMetadata(parsed.metadata);
  };

  const reset = () => {
    setTranscript('');
    setLines([]);
    setUnmatchedText('');
    setMetadata({ customerText: '', total: null, paymentMethod: null, notes: '', unmatchedText: '' });
    setError(null);
  };

  const stopRecognition = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    wakeModeRef.current = false;
    setWakeMode(false);
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
    const recognition = new recognitionConstructor();
    recognition.lang = 'es-NI';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0]?.transcript || '').join(' ').trim();
      if (/\bhola\s+nova\b/i.test(text)) {
        wakeModeRef.current = false;
        setWakeMode(false);
        recognition.stop();
        recognitionRef.current = null;
        window.setTimeout(() => startRecognition(), 120);
      }
    };
    recognition.onerror = () => {
      wakeModeRef.current = false;
      setWakeMode(false);
      setListening(false);
      setError('No se pudo mantener la activación por voz. Podés usar Dictar directamente.');
    };
    recognition.onend = () => {
      setListening(false);
      if (wakeModeRef.current) setWakeMode(false);
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
    setOpen(true);
    const recognition = new recognitionConstructor();
    recognition.lang = 'es-NI';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      updateTranscript(Array.from(event.results).map((result) => result[0]?.transcript || '').join(' ').trim());
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
    onApply(lines, metadata);
    close();
    toast.success(`${lines.length} línea(s) agregada(s) al borrador`);
  };

  useEffect(() => () => {
    stopRecognition();
  }, []);

  return (
    <Card className="border-primary/20 bg-primary/[0.025] shadow-sm" data-tour="pos-voice">
      <CardContent className="p-4 sm:p-5">
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
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {recognitionConstructor && <Button type="button" size="sm" variant={wakeMode ? 'secondary' : 'outline'} className="h-10 rounded-xl px-3 font-black" onClick={wakeMode ? stopRecognition : startWakeWord} disabled={disabled || !hasCatalog}>
              <NovaHubLogo size={18} className="mr-2 rounded-full" />
              {wakeMode ? 'Escuchando “Hola Nova”' : 'Decir “Hola Nova”'}
            </Button>}
            <Button type="button" size="sm" variant={listening && !wakeMode ? 'destructive' : 'default'} className="h-10 rounded-xl px-3 font-black" onClick={listening && !wakeMode ? stopRecognition : startRecognition} disabled={disabled || !hasCatalog || wakeMode}>
              {listening ? <MicOff className="mr-2 size-4" /> : <Mic className="mr-2 size-4" />}
              {listening && !wakeMode ? 'Detener dictado' : 'Dictar'}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">Parser local: no usa IA, API de transcripción ni tokens. “Hola Nova” funciona mientras esta pantalla está abierta y el navegador mantiene el micrófono autorizado.</p>

        {!hasCatalog && <p className="mt-3 rounded-xl border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs text-amber-800">Cargá el catálogo para poder validar productos antes de agregarlos.</p>}

        {open && <div className="mt-4 space-y-3 rounded-2xl border border-primary/20 bg-background/80 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-primary">Borrador controlado</p>
              <p className="mt-1 text-[11px] text-muted-foreground">No se factura automáticamente. Ejemplo: “30 platos de asado, dos tiras de res y una gaseosa”.</p>
            </div>
            <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg" onClick={close} aria-label="Cerrar venta por voz"><X className="size-4" /></Button>
          </div>
          <Textarea value={transcript} onChange={(event) => updateTranscript(event.target.value)} placeholder="Dictá o escribí la venta…" className="min-h-20 resize-y rounded-xl border-primary/20 bg-background text-sm" aria-label="Texto de la venta dictada" />
          {error && <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}
          {lines.length > 0 && <div className="grid gap-2 sm:grid-cols-2">
            {lines.map((line) => <div key={`${line.product.id}-${line.variantName || 'base'}`} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2"><div className="min-w-0"><p className="truncate text-xs font-bold text-foreground">{line.product.name}</p>{line.variantName && <p className="truncate text-[10px] text-amber-700">Variante: {line.variantName}</p>}</div><Badge className="shrink-0 bg-primary/10 text-primary">× {line.quantity}</Badge></div>)}
          </div>}
          {(metadata.customerText || metadata.total !== null || metadata.paymentMethod || metadata.notes) && <div className="grid gap-2 rounded-xl border border-sky-200/50 bg-sky-50/60 p-3 text-xs text-sky-950 sm:grid-cols-2">
            <p><span className="font-bold">Cliente:</span> {metadata.customerText || 'No detectado'}</p>
            <p><span className="font-bold">Total dictado:</span> {metadata.total === null ? 'No detectado' : metadata.total.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</p>
            <p><span className="font-bold">Pago:</span> {metadata.paymentMethod === 'CASH' ? 'Efectivo' : metadata.paymentMethod === 'CARD' ? 'Tarjeta' : metadata.paymentMethod === 'TRANSFER' ? 'Transferencia' : metadata.paymentMethod === 'CREDIT' ? 'Crédito' : 'No detectado'}</p>
            {metadata.notes && <p className="sm:col-span-2"><span className="font-bold">Nota:</span> {metadata.notes}</p>}
          </div>}
          {unmatchedText && <p className="rounded-xl border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs text-amber-800">No encontré en el catálogo: <span className="font-bold">{unmatchedText}</span>. No se agregará silenciosamente.</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" className="rounded-xl" onClick={close}>Cancelar</Button><Button type="button" className="rounded-xl font-black" onClick={apply} disabled={!lines.length}><Check className="mr-2 size-4" /> Agregar al borrador</Button></div>
        </div>}
      </CardContent>
    </Card>
  );
}
