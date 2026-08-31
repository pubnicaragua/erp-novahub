import { useEffect } from 'react';
import {
  ERP_API_MUTATION_EVENT,
  type ErpApiMutationEventDetail,
} from '../../utils/action-lock';

const FALLBACK_LOCK_MS = 1_200;
const MUTATION_RELEASE_GRACE_MS = 120;
const MUTATION_ASSOCIATION_WINDOW_MS = 1_500;

interface ActionLockRecord {
  button: HTMLButtonElement;
  wasDisabled: boolean;
  hadAriaBusy: boolean;
  previousAriaBusy: string | null;
  startedAt: number;
  sawMutation: boolean;
  fallbackTimer: number;
  releaseTimer?: number;
}

const ACTION_WORDS = /\b(guardar|cre(?:ar|e)|registrar|confirmar|aprobar|emitir|enviar|transfer(?:ir|encia)|pagar|aplicar|importar|exportar|generar|actualizar|editar|eliminar|anular|rechazar|aceptar|asignar|subir|procesar|liquidar|solicitar|publicar|reconciliar|cancel(?:ar|ación)|cerrar caja|abrir caja)\b/i;
const CONTROL_WORDS = /^(cancelar|cerrar|volver|regresar|atras|atrás|x|no|no gracias|ayuda|ver|vista|filtro|limpiar|expandir|contraer|siguiente|anterior)$/i;
const OVERLAY_SELECTOR = '[role="dialog"], [data-slot="dialog-content"], [data-slot="sheet-content"], [data-slot="drawer-content"], .nh-modal-root, .nh-modal-surface';

function getButtonLabel(button: HTMLButtonElement): string {
  return [
    button.getAttribute('aria-label'),
    button.getAttribute('title'),
    button.innerText,
    button.textContent,
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function isLockableAction(button: HTMLButtonElement): boolean {
  const explicit = button.getAttribute('data-action-lock');
  if (explicit === 'false' || button.hasAttribute('data-no-action-lock')) return false;
  if (explicit === 'true') return true;
  if (button.disabled || button.type === 'reset') return false;

  // These controls change local UI state or navigate; locking them makes
  // menus, tabs, filters and the sidebar feel broken without protecting a
  // server mutation.
  if (
    button.getAttribute('role') === 'tab' ||
    button.hasAttribute('aria-haspopup') ||
    button.hasAttribute('aria-expanded') ||
    button.closest('aside, nav, header')
  ) return false;

  const toolbarRole = button.getAttribute('data-toolbar-role');
  if (toolbarRole && ['filters', 'layout', 'help', 'alerts'].includes(toolbarRole)) return false;

  const label = getButtonLabel(button);
  if (!label) return false;
  // A plain Cancelar in a row/card is a server action and must be protected;
  // the same word inside a modal is only the dismiss control.
  if (CONTROL_WORDS.test(label) && !(label.toLowerCase() === 'cancelar' && !button.closest(OVERLAY_SELECTOR))) return false;
  if (toolbarRole === 'primary' || button.type === 'submit') return true;
  return ACTION_WORDS.test(label);
}

function restoreButton(record: ActionLockRecord) {
  const { button } = record;
  if (record.fallbackTimer) window.clearTimeout(record.fallbackTimer);
  if (record.releaseTimer) window.clearTimeout(record.releaseTimer);
  if (!button.isConnected) return;

  delete button.dataset.actionBusy;
  if (record.hadAriaBusy) {
    if (record.previousAriaBusy === null) button.removeAttribute('aria-busy');
    else button.setAttribute('aria-busy', record.previousAriaBusy);
  } else {
    button.removeAttribute('aria-busy');
  }
  // Do not override a disabled state that React may have added while the
  // request was in progress. The original state is restored only when the
  // guard itself disabled the button.
  if (!record.wasDisabled) button.disabled = false;
}

export function ActionClickGuard() {
  useEffect(() => {
    const activeLocks = new Set<ActionLockRecord>();
    let pendingMutations = 0;

    const releaseIfReady = (record: ActionLockRecord) => {
      if (!activeLocks.has(record)) return;
      if (record.sawMutation && pendingMutations > 0) {
        record.fallbackTimer = window.setTimeout(() => releaseIfReady(record), 250);
        return;
      }
      activeLocks.delete(record);
      restoreButton(record);
    };

    const lockButton = (button: HTMLButtonElement) => {
      const record: ActionLockRecord = {
        button,
        wasDisabled: button.disabled,
        hadAriaBusy: button.hasAttribute('aria-busy'),
        previousAriaBusy: button.getAttribute('aria-busy'),
        startedAt: Date.now(),
        sawMutation: false,
        fallbackTimer: 0,
      };
      activeLocks.add(record);
      button.dataset.actionBusy = 'true';
      button.setAttribute('aria-busy', 'true');
      // Let the current click reach React first. Disabling during capture can
      // otherwise interfere with synthetic click handlers in some browsers.
      queueMicrotask(() => {
        if (activeLocks.has(record) && !record.wasDisabled) button.disabled = true;
      });
      record.fallbackTimer = window.setTimeout(() => releaseIfReady(record), FALLBACK_LOCK_MS);
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      const button = target instanceof Element ? target.closest('button') : null;
      if (!(button instanceof HTMLButtonElement)) return;

      // Covers browsers/assistive technologies that dispatch a second click
      // before the disabled property has been reflected in the DOM.
      const existing = Array.from(activeLocks).find((record) => record.button === button);
      if (existing) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (!isLockableAction(button)) return;
      lockButton(button);
    };

    const handleMutation = (event: Event) => {
      const detail = (event as CustomEvent<ErpApiMutationEventDetail>).detail;
      if (!detail || (detail.phase !== 'start' && detail.phase !== 'end')) return;

      if (detail.phase === 'start') {
        pendingMutations += 1;
        const now = Date.now();
        activeLocks.forEach((record) => {
          if (now - record.startedAt <= MUTATION_ASSOCIATION_WINDOW_MS) {
            record.sawMutation = true;
          }
        });
        return;
      }

      pendingMutations = Math.max(0, pendingMutations - 1);
      if (pendingMutations === 0) {
        activeLocks.forEach((record) => {
          if (!record.sawMutation) return;
          if (record.releaseTimer) window.clearTimeout(record.releaseTimer);
          record.releaseTimer = window.setTimeout(() => releaseIfReady(record), MUTATION_RELEASE_GRACE_MS);
        });
      }
    };

    document.addEventListener('click', handleClick, true);
    window.addEventListener(ERP_API_MUTATION_EVENT, handleMutation);

    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener(ERP_API_MUTATION_EVENT, handleMutation);
      activeLocks.forEach(restoreButton);
      activeLocks.clear();
    };
  }, []);

  return null;
}
