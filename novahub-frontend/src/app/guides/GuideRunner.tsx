import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Lightbulb, MapPin, X } from 'lucide-react';
import { cn } from '../components/ui/utils';
import { useAuth } from '../contexts/AuthContext';
import { safeGetItem, safeRemoveItem, safeSetItem } from '../services/safe-storage';
import { findGuide } from './catalog';
import { START_GUIDE_EVENT, parseGuideRoute } from './events';
import { findGuideTarget } from './target';

const STORAGE_KEY = 'erp-guide-runner';
const MISSING_AFTER_MS = 3500;

interface RunnerState { id: string; step: number; minimized?: boolean }
interface Rect { key: string; top: number; left: number; width: number; height: number; clickable: boolean }

function readState(): RunnerState | null {
  try {
    const raw = safeGetItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.id === 'string' && findGuide(parsed.id) ? { id: parsed.id, step: Math.max(0, Number(parsed.step) || 0), minimized: Boolean(parsed.minimized) } : null;
  } catch { return null; }
}

function writeState(state: RunnerState | null) {
  if (state) safeSetItem(STORAGE_KEY, JSON.stringify(state)); else safeRemoveItem(STORAGE_KEY);
}

/**
 * Panel que acompaña al usuario mientras sigue una guía: lo lleva a cada pantalla,
 * resalta el botón del paso y avanza solo cuando lo presiona. No bloquea la pantalla:
 * el usuario trabaja normalmente con el panel abierto.
 */
export function GuideRunner() {
  const { hasAccess } = useAuth();
  const [state, setState] = useState<RunnerState | null>(() => readState());
  const [trackedRect, setRect] = useState<Rect | null>(null);
  // Paso cuyo botón no aparece en pantalla (se guarda la clave para que al cambiar de paso se limpie solo).
  const [missingKey, setMissingKey] = useState<string | null>(null);
  // Paso cuya pantalla no se pudo abrir (sección no activada para la empresa o sin permiso).
  const [routeFailedKey, setRouteFailedKey] = useState<string | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const scrolledRef = useRef(false);

  const guide = state ? findGuide(state.id) : null;
  const step = guide && state ? guide.steps[Math.min(state.step, guide.steps.length - 1)] : null;
  const stepIndex = guide && state ? Math.min(state.step, guide.steps.length - 1) : 0;
  const isLast = guide ? stepIndex === guide.steps.length - 1 : false;
  const route = step?.to ? parseGuideRoute(step.to) : null;
  const blocked = Boolean(route && !hasAccess(route.module));
  const stepKey = state ? `${state.id}:${stepIndex}` : '';
  const rect = trackedRect && trackedRect.key === stepKey ? trackedRect : null;
  const missing = missingKey === stepKey;
  const routeFailed = routeFailedKey === stepKey;

  const update = useCallback((next: RunnerState | null) => {
    setState(next);
    writeState(next);
  }, []);

  // Iniciar desde el chat o el centro de capacitación.
  useEffect(() => {
    const handler = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id && findGuide(id)) update({ id, step: 0 });
    };
    window.addEventListener(START_GUIDE_EVENT, handler);
    return () => window.removeEventListener(START_GUIDE_EVENT, handler);
  }, [update]);

  // Llevar al usuario a la pantalla del paso.
  useEffect(() => {
    if (!route || blocked) return;
    window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: route.module, subModule: route.subModule } }));
    // Si la sección no está habilitada, la app se queda en otra pantalla sin avisar: lo detectamos por la URL.
    const key = stepKey;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const opened = params.get('m') === route.module && (!route.subModule || params.get('sm') === route.subModule);
      setRouteFailedKey(opened ? null : key);
    }, 1800);
    return () => window.clearTimeout(timer);
    // Solo al entrar al paso: si el usuario se mueve a otra pantalla, no lo regresamos a la fuerza.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.id, stepIndex, blocked]);

  // Buscar y seguir el botón del paso.
  useEffect(() => {
    scrolledRef.current = false;
    targetRef.current = null;
    if (!step?.target || blocked) return undefined;
    const startedAt = Date.now();
    const track = () => {
      const element = findGuideTarget(step.target);
      targetRef.current = element;
      if (!element) {
        setRect(null);
        if (Date.now() - startedAt > MISSING_AFTER_MS) setMissingKey(stepKey);
        return;
      }
      setMissingKey(null);
      if (!scrolledRef.current) {
        scrolledRef.current = true;
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
      const box = element.getBoundingClientRect();
      setRect((previous) => {
        const clickable = Boolean(element.closest('button, a, [role="tab"], [role="combobox"], [role="menuitem"], select, input, label'));
        const next = { key: stepKey, clickable, top: Math.round(box.top), left: Math.round(box.left), width: Math.round(box.width), height: Math.round(box.height) };
        return previous && previous.key === next.key && previous.clickable === next.clickable && previous.top === next.top && previous.left === next.left && previous.width === next.width && previous.height === next.height ? previous : next;
      });
    };
    track();
    const interval = window.setInterval(track, 400);
    const onScroll = () => window.requestAnimationFrame(track);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [step, blocked, stepKey]);

  const goTo = useCallback((index: number) => {
    if (!state || !guide) return;
    if (index >= guide.steps.length) { update(null); return; }
    update({ ...state, step: Math.max(0, index), minimized: false });
  }, [guide, state, update]);

  // Avanzar solo cuando el usuario presiona el botón resaltado.
  useEffect(() => {
    if (!step?.target || isLast) return undefined;
    const onClick = (event: MouseEvent) => {
      const element = targetRef.current;
      if (element && event.target instanceof Node && element.contains(event.target)) {
        window.setTimeout(() => goTo(stepIndex + 1), 450);
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [goTo, isLast, step, stepIndex]);

  if (!guide || !step || !state || typeof document === 'undefined') return null;
  const pad = 6;

  return createPortal(
    <div data-guide-runner="" aria-live="polite">
      {rect && !state.minimized && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[9998] rounded-xl border-[3px] border-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.25),0_0_28px_rgba(251,191,36,0.55)] motion-safe:animate-pulse"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      )}
      <section
        role="dialog"
        aria-label={`Guía: ${guide.title}`}
        // Un formulario abierto en ventana modal se cierra si detecta un clic afuera: el panel no debe cerrarlo.
        onPointerDown={(event) => event.stopPropagation()}
        className="pointer-events-auto fixed inset-x-3 bottom-20 z-[9999] mx-auto max-w-md rounded-2xl border border-primary/30 bg-card text-card-foreground shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-28 sm:w-[23rem]"
      >
        <header className="flex items-center gap-2 rounded-t-2xl bg-primary px-4 py-2.5 text-primary-foreground">
          <MapPin className="size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide opacity-80">{guide.area} · Paso {stepIndex + 1} de {guide.steps.length}</p>
            <h2 className="truncate text-sm font-bold">{guide.title}</h2>
          </div>
          <button type="button" onClick={() => update({ ...state, minimized: !state.minimized })} className="flex size-8 items-center justify-center rounded-lg hover:bg-white/15" aria-label={state.minimized ? 'Mostrar la guía' : 'Minimizar la guía'}>
            {state.minimized ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          <button type="button" onClick={() => update(null)} className="flex size-8 items-center justify-center rounded-lg hover:bg-white/15" aria-label="Cerrar la guía">
            <X className="size-4" />
          </button>
        </header>
        {!state.minimized && (
          <div className="space-y-3 p-4">
            {stepIndex === 0 && guide.requires && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-800 dark:text-amber-200">{guide.requires}</p>
            )}
            <p className="text-[15px] leading-6">{step.text}</p>
            {step.tip && (
              <p className="flex gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground"><Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-500" />{step.tip}</p>
            )}
            {blocked && (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">Tu usuario no tiene acceso a {guide.area}. Pide al administrador que te dé permiso para seguir esta guía.</p>
            )}
            {!blocked && step.target && rect && (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{rect.clickable && !isLast ? 'Te marqué el botón en amarillo. Al presionarlo pasamos al siguiente paso.' : 'Te lo marqué en amarillo en la pantalla.'}</p>
            )}
            {!blocked && routeFailed && (
              <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-800 dark:text-amber-200">No pude abrir esa pantalla. Puede que tu empresa no tenga activada esta sección o que tu usuario no tenga permiso. Pide al administrador que la habilite.</p>
            )}
            {!blocked && !routeFailed && missing && (
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">No veo ese botón en tu pantalla. Puede que aún esté cargando, que esté en otra pestaña, que tu empresa no tenga activada esta sección o que tu usuario no tenga ese permiso. Si no aparece, pide ayuda al administrador; puedes seguir con «Siguiente».</p>
            )}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button type="button" onClick={() => goTo(stepIndex - 1)} disabled={stepIndex === 0} className="flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-40">
                <ArrowLeft className="size-4" /> Anterior
              </button>
              <div className="flex gap-1" aria-hidden="true">
                {guide.steps.map((_, index) => <span key={index} className={cn('h-1.5 rounded-full', index === stepIndex ? 'w-5 bg-primary' : index < stepIndex ? 'w-2 bg-primary/50' : 'w-2 bg-muted-foreground/25')} />)}
              </div>
              <button type="button" onClick={() => goTo(stepIndex + 1)} className="flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                {isLast ? <><CheckCircle2 className="size-4" /> Terminar</> : <>Siguiente <ArrowRight className="size-4" /></>}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}
