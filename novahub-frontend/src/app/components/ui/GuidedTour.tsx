import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Lightbulb, X } from 'lucide-react';
import { cn } from './utils';

export interface GuidedTourStep {
  target: string;
  title: string;
  description: string;
  tip?: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
}

interface GuidedTourProps {
  steps: GuidedTourStep[];
  onClose: () => void;
  onComplete?: () => void;
  title?: string;
  allowTargetInteraction?: boolean;
}

interface HighlightRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface TooltipSize {
  width: number;
  height: number;
}

const TARGET_PADDING = 7;
const TOOLTIP_GAP = 16;
const TOOLTIP_WIDTH = 368;
const TOOLTIP_ESTIMATED_HEIGHT = 280;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function GuidedTour({ steps, onClose, onComplete, title = 'Tutorial guiado', allowTargetInteraction = false }: GuidedTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [highlight, setHighlight] = useState<HighlightRect | null>(null);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [tooltipSize, setTooltipSize] = useState<TooltipSize>({ width: 0, height: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  const updateHighlight = useCallback(() => {
    if (!currentStep) return;
    const element = document.querySelector<HTMLElement>(currentStep.target);
    if (!element) {
      setHighlight(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    const left = clamp(rect.left - TARGET_PADDING, 8, window.innerWidth - 8);
    const top = clamp(rect.top - TARGET_PADDING, 8, window.innerHeight - 8);
    const right = clamp(rect.right + TARGET_PADDING, 8, window.innerWidth - 8);
    const bottom = clamp(rect.bottom + TARGET_PADDING, 8, window.innerHeight - 8);
    setHighlight({ top, left, right, bottom, width: right - left, height: bottom - top });
    setViewport({ width: window.innerWidth, height: window.innerHeight });
  }, [currentStep]);

  useEffect(() => {
    const element = document.querySelector<HTMLElement>(currentStep?.target || '');
    element?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    const timer = window.setTimeout(updateHighlight, 320);
    const frame = window.requestAnimationFrame(updateHighlight);
    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
    };
  }, [currentStep, updateHighlight]);

  useEffect(() => {
    const syncPosition = () => window.requestAnimationFrame(updateHighlight);
    window.addEventListener('resize', syncPosition);
    document.addEventListener('scroll', syncPosition, true);
    return () => {
      window.removeEventListener('resize', syncPosition);
      document.removeEventListener('scroll', syncPosition, true);
    };
  }, [updateHighlight]);

  const complete = useCallback(() => {
    onComplete?.();
    onClose();
  }, [onClose, onComplete]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && stepIndex > 0) setStepIndex(index => index - 1);
      if (event.key === 'ArrowRight') {
        if (isLastStep) complete();
        else setStepIndex(index => index + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [complete, isLastStep, onClose, stepIndex]);

  useEffect(() => {
    tooltipRef.current?.focus();
  }, [stepIndex]);

  useEffect(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    const updateTooltipSize = () => {
      const rect = tooltip.getBoundingClientRect();
      setTooltipSize(previous => {
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);
        return previous.width === width && previous.height === height ? previous : { width, height };
      });
    };

    updateTooltipSize();
    const observer = new ResizeObserver(updateTooltipSize);
    observer.observe(tooltip);
    return () => observer.disconnect();
  }, [stepIndex]);

  const tooltipStyle = (() => {
    const maxHeight = Math.max(120, viewport.height - 24);

    if (viewport.width < 640 || !highlight) {
      return { left: 12, right: 12, bottom: 12, maxHeight };
    }

    const width = Math.min(TOOLTIP_WIDTH, viewport.width - 24);
    const height = Math.min(tooltipSize.height || TOOLTIP_ESTIMATED_HEIGHT, maxHeight);
    const maxLeft = viewport.width - width - 12;
    const centeredLeft = clamp(highlight.left + highlight.width / 2 - width / 2, 12, maxLeft);
    const maxTop = Math.max(12, viewport.height - height - 12);
    const placements = [...new Set([currentStep?.placement, 'right', 'left', 'bottom', 'top'].filter(Boolean))];

    for (const placement of placements) {
      if (placement === 'right' && viewport.width - highlight.right >= width + TOOLTIP_GAP) {
        return { left: highlight.right + TOOLTIP_GAP, top: clamp(highlight.top, 12, maxTop), width, maxHeight };
      }
      if (placement === 'left' && highlight.left >= width + TOOLTIP_GAP) {
        return { left: highlight.left - width - TOOLTIP_GAP, top: clamp(highlight.top, 12, maxTop), width, maxHeight };
      }
      if (placement === 'bottom' && viewport.height - highlight.bottom >= height + TOOLTIP_GAP) {
        return { left: centeredLeft, top: highlight.bottom + TOOLTIP_GAP, width, maxHeight };
      }
      if (placement === 'top' && highlight.top >= height + TOOLTIP_GAP) {
        return { left: centeredLeft, top: highlight.top - height - TOOLTIP_GAP, width, maxHeight };
      }
    }

    return { left: centeredLeft, top: clamp(highlight.bottom + TOOLTIP_GAP, 12, maxTop), width, maxHeight };
  })();

  if (!currentStep || typeof document === 'undefined') return null;

  return createPortal(
    <div className={cn('fixed inset-0 z-[10000]', allowTargetInteraction && 'pointer-events-none')} aria-live="polite">
      {highlight ? (
        <>
          <div className={cn('fixed left-0 top-0 w-full bg-slate-950/75 backdrop-blur-[2px]', allowTargetInteraction && 'pointer-events-auto')} style={{ height: highlight.top }} />
          <div className={cn('fixed left-0 bg-slate-950/75 backdrop-blur-[2px]', allowTargetInteraction && 'pointer-events-auto')} style={{ top: highlight.top, width: highlight.left, height: highlight.height }} />
          <div className={cn('fixed right-0 bg-slate-950/75 backdrop-blur-[2px]', allowTargetInteraction && 'pointer-events-auto')} style={{ top: highlight.top, width: viewport.width - highlight.right, height: highlight.height }} />
          <div className={cn('fixed bottom-0 left-0 w-full bg-slate-950/75 backdrop-blur-[2px]', allowTargetInteraction && 'pointer-events-auto')} style={{ top: highlight.bottom }} />
          <div className="pointer-events-none fixed z-[10001]" style={{ top: highlight.top, left: highlight.left, width: highlight.width, height: highlight.height }} />
          <div
            className="pointer-events-none fixed z-[10002] rounded-xl border-2 border-cyan-400 shadow-[0_0_0_3px_rgba(34,211,238,0.18),0_0_34px_rgba(34,211,238,0.5)] transition-all duration-200"
            style={{ top: highlight.top, left: highlight.left, width: highlight.width, height: highlight.height }}
          />
        </>
      ) : (
        <div className={cn('fixed inset-0 bg-slate-950/75 backdrop-blur-[2px]', allowTargetInteraction && 'pointer-events-auto')} />
      )}

      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${title}: ${currentStep.title}`}
        tabIndex={-1}
        className="pointer-events-auto fixed z-[10003] overflow-y-auto overscroll-contain rounded-2xl border border-cyan-400/30 bg-slate-950 text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)] outline-none"
        style={tooltipStyle}
      >
        <div className="h-1 bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-300" />
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-cyan-400/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                  Paso {stepIndex + 1} de {steps.length}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-white">{currentStep.title}</h2>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white" aria-label="Cerrar tutorial">
              <X className="size-4" />
            </button>
          </div>

          <p className="text-sm leading-6 text-slate-300">{currentStep.description}</p>
          {currentStep.tip && (
            <div className="mt-4 flex gap-3 rounded-xl border border-amber-300/15 bg-amber-300/10 p-3">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-300" />
              <p className="text-xs leading-5 text-amber-100">{currentStep.tip}</p>
            </div>
          )}

          <div className="mt-5 flex items-center gap-1.5" aria-hidden="true">
            {steps.map((_, index) => (
              <span key={index} className={cn('h-1.5 rounded-full transition-all', index === stepIndex ? 'w-7 bg-cyan-400' : index < stepIndex ? 'w-3 bg-emerald-400/70' : 'w-3 bg-slate-700')} />
            ))}
          </div>

          <div className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-5 flex flex-col gap-3 border-t border-white/10 bg-slate-950/95 px-4 pb-4 pt-4 backdrop-blur sm:-mx-5 sm:-mb-5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:pb-5">
            <button type="button" onClick={onClose} className="text-left text-xs font-bold text-slate-400 hover:text-white">Salir del tutorial</button>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
              <button
                type="button"
                onClick={() => setStepIndex(index => index - 1)}
                disabled={stepIndex === 0}
                className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-bold text-slate-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowLeft className="size-3.5" /> Anterior
              </button>
              <button
                type="button"
                onClick={() => isLastStep ? complete() : setStepIndex(index => index + 1)}
                className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-cyan-400 px-3.5 text-xs font-black text-slate-950 transition-colors hover:bg-cyan-300"
              >
                {isLastStep ? <><CheckCircle2 className="size-3.5" /> Finalizar</> : <>Siguiente <ArrowRight className="size-3.5" /></>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
