import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Mic, MicOff, X } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { toast } from '@/app/services/toast';
import { parseSpanishExpenseDictation, type VoiceExpenseDraft } from '../../utils/voice-expense-parser';
import { NovaHubLogo } from '../NovaHubLogo';

interface RecognitionEventLike { results: ArrayLike<{ 0?: { transcript?: string } }>; }
interface RecognitionLike { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: RecognitionEventLike) => void) | null; onerror: ((event: { error?: string }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void; }
type RecognitionConstructor = new () => RecognitionLike;

interface Props { disabled?: boolean; onApply: (draft: VoiceExpenseDraft) => void; }

export function VoiceExpenseComposer({ disabled = false, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [draft, setDraft] = useState<VoiceExpenseDraft>(() => parseSpanishExpenseDictation(''));
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const recognitionConstructor = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const scope = window as typeof window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
  }, []);

  const stop = () => { recognitionRef.current?.stop(); recognitionRef.current = null; setListening(false); };
  const update = (value: string) => { setTranscript(value); setDraft(parseSpanishExpenseDictation(value)); };
  const start = () => {
    if (!recognitionConstructor) { setOpen(true); setError('Este navegador no ofrece dictado nativo. Escribí el gasto manualmente.'); return; }
    stop(); setOpen(true); setTranscript(''); setDraft(parseSpanishExpenseDictation('')); setError(null);
    const recognition = new recognitionConstructor();
    recognition.lang = 'es-NI'; recognition.continuous = true; recognition.interimResults = true;
    recognition.onresult = (event) => update(Array.from(event.results).map((result) => result[0]?.transcript || '').join(' ').trim());
    recognition.onerror = (event) => { setListening(false); setError(event.error === 'not-allowed' ? 'El navegador bloqueó el micrófono. Habilitá el permiso para este sitio.' : 'No se pudo interpretar el dictado. Podés escribirlo manualmente.'); };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try { recognition.start(); setListening(true); } catch { setListening(false); setError('No se pudo iniciar el dictado. Revisá el permiso del micrófono.'); }
  };
  useEffect(() => () => stop(), []);

  const apply = () => {
    if (!draft.description || draft.amount === null) { toast.error('Necesito detectar concepto y monto antes de agregar el gasto.'); return; }
    onApply(draft); stop(); setOpen(false); toast.success('Gasto dictado agregado al formulario');
  };

  return <Card className="border-primary/20 bg-primary/[0.025] shadow-sm" data-tour="purchases-expense-voice">
    <CardContent className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2"><span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-primary/20"><NovaHubLogo size={25} /></span><div><p className="text-xs font-black uppercase tracking-tight">Gasto rápido por voz</p><p className="text-[10px] text-muted-foreground">Concepto, monto y método sin depender de IA.</p></div></div>
        <Button type="button" size="sm" variant={listening ? 'destructive' : 'default'} className="h-9 rounded-xl font-black" onClick={listening ? stop : start} disabled={disabled}><>{listening ? <MicOff className="mr-2 size-4" /> : <Mic className="mr-2 size-4" />}</>{listening ? 'Detener' : 'Dictar gasto'}</Button>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">Ejemplo: “pagué mil quinientos córdobas de internet a Claro en transferencia”. Revisá el borrador antes de guardar.</p>
      {open && <div className="mt-3 space-y-3 rounded-2xl border border-primary/20 bg-background/80 p-3">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-primary">Borrador controlado</p><p className="text-[10px] text-muted-foreground">No se registra hasta que confirmés el formulario.</p></div><Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => { stop(); setOpen(false); }} aria-label="Cerrar gasto por voz"><X className="size-4" /></Button></div>
        <Textarea value={transcript} onChange={(event) => update(event.target.value)} placeholder="Dictá o escribí el gasto…" className="min-h-16 rounded-xl border-primary/20 text-sm" aria-label="Texto del gasto dictado" />
        {error && <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}
        <div className="grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-border/60 p-2"><p className="text-[10px] text-muted-foreground">Concepto</p><p className="text-xs font-bold">{draft.description || 'No detectado'}</p></div><div className="rounded-xl border border-border/60 p-2"><p className="text-[10px] text-muted-foreground">Monto</p><p className="text-xs font-bold">{draft.amount === null ? 'No detectado' : draft.amount.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</p></div><div className="rounded-xl border border-border/60 p-2"><p className="text-[10px] text-muted-foreground">Pagado a</p><p className="text-xs font-bold">{draft.paidTo || 'No detectado'}</p></div><div className="rounded-xl border border-border/60 p-2"><p className="text-[10px] text-muted-foreground">Método</p><Badge variant="outline" className="mt-1 text-[10px]">{draft.paymentSource || 'No detectado'}</Badge></div></div>
        {draft.unmatchedText && <p className="rounded-xl border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs text-amber-800">Revisá el texto: faltan concepto o monto.</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" className="rounded-xl" onClick={() => { stop(); setOpen(false); }}>Cancelar</Button><Button type="button" className="rounded-xl font-black" onClick={apply} disabled={!draft.description || draft.amount === null}><Check className="mr-2 size-4" /> Usar en el gasto</Button></div>
      </div>}
    </CardContent>
  </Card>;
}
