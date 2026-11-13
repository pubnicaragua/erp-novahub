import { useState } from 'react';
import { Copy, ExternalLink, Inbox, MessageSquare, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Skeleton } from '../../ui/skeleton';
import { cn } from '../../ui/utils';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { toast } from '../../../services/toast';
import { businessLeadsService, type PasteResult, type PlanTask } from '../../../services/business-leads.service';
import { failure } from './leadUtils';
import { MapsSearch } from './MapsSearch';

const KIND_LABEL: Record<PlanTask['kind'], string> = { REVIEW: 'Revisar', SEARCH: 'Buscar', SOCIAL: 'Redes sociales', FOLLOWUP: 'Seguimiento' };
const KIND_TONE: Record<PlanTask['kind'], string> = { REVIEW: 'bg-amber-100 text-amber-900', SEARCH: 'bg-sky-100 text-sky-900', SOCIAL: 'bg-indigo-100 text-indigo-900', FOLLOWUP: 'bg-emerald-100 text-emerald-900' };
const copy = async (text: string) => {
  try { await navigator.clipboard.writeText(text); toast.success('Copiado. Pégalo en ChatGPT o Claude.'); } catch { toast.error('El navegador no permitió copiar el texto. Selecciónalo y cópialo manualmente.'); }
};

function TaskCard({ task, onNavigate }: { task: PlanTask; onNavigate: (view: 'review' | 'table') => void }) {
  const [showPrompt, setShowPrompt] = useState(false);
  return (
    <li className="min-w-0 space-y-2 rounded-xl border border-border/60 bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2"><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black uppercase', KIND_TONE[task.kind])}>{KIND_LABEL[task.kind]}</span><p className="min-w-0 break-words text-sm font-bold">{task.title}</p></div>
      <p className="text-xs text-muted-foreground">{task.why}</p>
      <div className="flex flex-wrap gap-2">
        {task.action === 'REVIEW' && <Button type="button" size="sm" onClick={() => onNavigate('review')}><Inbox className="mr-1.5 size-4" />Ir a «Por revisar»</Button>}
        {task.action === 'FOLLOWUPS' && <Button type="button" size="sm" variant="outline" onClick={() => onNavigate('table')}>Abrir mis leads</Button>}
        {task.prompt && <Button type="button" size="sm" variant="outline" onClick={() => void copy(task.prompt as string)}><Copy className="mr-1.5 size-4" />Copiar prompt</Button>}
        {task.chatgptUrl && <Button asChild type="button" size="sm" variant="outline"><a href={task.chatgptUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 size-4" />Abrir en ChatGPT</a></Button>}
        {task.claudeUrl && <Button asChild type="button" size="sm" variant="outline"><a href={task.claudeUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 size-4" />Abrir en Claude</a></Button>}
        {task.links.map((link) => <Button key={link.label} asChild type="button" size="sm" variant="ghost"><a href={link.url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 size-3.5" />{link.label}</a></Button>)}
      </div>
      {task.prompt && (
        <div>
          <button type="button" className="text-[11px] font-semibold text-primary underline" onClick={() => setShowPrompt((value) => !value)} aria-expanded={showPrompt}>{showPrompt ? 'Ocultar el prompt' : 'Ver el prompt'}</button>
          {showPrompt && <pre className="mt-1.5 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-2 text-[11px]">{task.prompt}</pre>}
        </div>
      )}
    </li>
  );
}

function PasteSection({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState('');
  const [verify, setVerify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PasteResult | null>(null);
  const send = async () => {
    setBusy(true);
    try {
      const data = await businessLeadsService.pasteResults(text, verify);
      setResult(data);
      if (data.created) { toast.success(`${data.created} negocio${data.created === 1 ? '' : 's'} enviado${data.created === 1 ? '' : 's'} a «Por revisar»`); setText(''); onDone(); }
    } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  return (
    <section className="space-y-2 rounded-2xl border border-border/60 bg-card p-4" aria-label="Pegar lo que respondió ChatGPT o Claude">
      <h3 className="flex items-center gap-1.5 nh-section-title"><MessageSquare className="size-4 text-primary" aria-hidden /> Pegar lo que te respondió ChatGPT o Claude</h3>
      <p className="text-xs text-muted-foreground">Pega la tabla tal como la dio. NovaHub la lee, descarta los repetidos y, si quieres, revisa si el sitio web de cada uno abre y qué tan abandonado está. Nada entra directo al embudo: queda en «Por revisar».</p>
      <textarea aria-label="Respuesta de ChatGPT o Claude" className="h-40 w-full rounded-xl border border-border/60 bg-background p-3 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary" value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} placeholder={'Empresa | Teléfono | País | Giro | Sitio o perfil | Enlace de donde salió | Señales | Notas\nClínica Vida | 2311-0000 | Nicaragua | Clínica | facebook.com/clinicavida | https://maps.google.com/... | No tiene sitio web | Atiende 2 sedes'} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={verify} onChange={(e) => setVerify(e.target.checked)} /><ShieldCheck className="size-4 text-primary" aria-hidden />Verificar los sitios web (tarda unos segundos)</label>
        <Button type="button" onClick={() => void send()} disabled={busy || !text.trim()}>{busy ? 'Verificando…' : 'Verificar y enviar a «Por revisar»'}</Button>
      </div>
      {result && (
        <div className="space-y-1 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs" role="status">
          <p className="font-bold">{result.created} enviado{result.created === 1 ? '' : 's'} a «Por revisar»{result.verified ? ` · ${result.verified} sitio${result.verified === 1 ? '' : 's'} verificado${result.verified === 1 ? '' : 's'}` : ''}{result.duplicates.length ? ` · ${result.duplicates.length} ya existía${result.duplicates.length === 1 ? '' : 'n'}` : ''}.</p>
          {result.duplicates.map((item) => <p key={`d${item.row}`} className="text-muted-foreground">«{item.company}» ya está como «{item.existingCompany}» ({item.why}).</p>)}
          {result.errors.map((item) => <p key={`e${item.row}`} className="text-destructive">Fila {item.row}: {item.message}</p>)}
        </div>
      )}
    </section>
  );
}

/** «Prospectar»: lo que toca hoy (con prompts listos), pegar lo que devuelve la IA y buscar negocios reales en Google Maps. */
export function ProspectPanel({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate: (view: 'review' | 'table') => void }) {
  const client = useQueryClient();
  const plan = useTenantQuery(['sales', 'business-leads-plan'], (signal) => businessLeadsService.plan(signal), { staleTime: 30_000 });
  const refresh = () => { void client.invalidateQueries({ queryKey: ['tenant-module'] }); };
  const data = plan.data;
  const pct = data && data.progress.goal > 0 ? Math.min(100, Math.round((data.progress.count / data.progress.goal) * 100)) : 0;
  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-label="Plan del día">
        {plan.isLoading ? <Skeleton className="h-40 w-full rounded-2xl" aria-busy="true" />
          : !data ? <p className="text-sm text-destructive" role="alert">No se pudo armar el plan de hoy.</p>
          : (
            <>
              <div className="rounded-2xl border border-border/60 bg-card p-4">
                <p className="text-base font-black">{data.headline}</p>
                {data.progress.goal > 0 && <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de la meta de hoy"><div className={cn('h-full rounded-full', pct >= 100 ? 'bg-emerald-600' : 'bg-primary')} style={{ width: `${pct}%` }} /></div>}
                <p className="mt-2 text-xs text-muted-foreground">Esto es lo que te propongo hacer hoy, en orden. Los prompts ya traen quiénes somos, lo que vendemos, tu cliente ideal y el formato en que debe responder la IA.</p>
              </div>
              <ol className="grid gap-3 lg:grid-cols-2">{data.tasks.map((task) => <TaskCard key={task.id} task={task} onNavigate={onNavigate} />)}</ol>
            </>
          )}
      </section>
      <PasteSection onDone={refresh} />
      <MapsSearch isAdmin={isAdmin} onSaved={refresh} />
    </div>
  );
}
