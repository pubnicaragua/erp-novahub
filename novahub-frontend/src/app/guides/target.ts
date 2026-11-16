import { normalizeText } from './match';

const TEXT_CANDIDATES = 'button, a, [role="tab"], [role="menuitem"], [role="option"], [role="combobox"], label, summary';
const IGNORED = '[data-guide-runner], [data-nova-ai-chat]';

function isVisible(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element.closest(IGNORED)) return false;
  if (element.closest('[aria-hidden="true"]')) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle(element);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

function findByText(label: string): HTMLElement | null {
  const wanted = normalizeText(label);
  if (!wanted) return null;
  let partial: HTMLElement | null = null;
  for (const element of Array.from(document.querySelectorAll(TEXT_CANDIDATES))) {
    if (!isVisible(element)) continue;
    const names = [element.innerText, element.getAttribute('aria-label'), element.getAttribute('title')]
      .map((value) => normalizeText(value || ''))
      .filter(Boolean);
    if (names.some((name) => name === wanted)) return element;
    if (!partial && names.some((name) => name.startsWith(wanted) && name.length <= wanted.length + 24)) partial = element;
  }
  return partial;
}

/**
 * Busca el elemento de un paso. Acepta selectores CSS y `text:Nombre`; varias opciones
 * separadas por `||` se prueban en orden. Devuelve el primero visible.
 */
export function findGuideTarget(spec: string | undefined): HTMLElement | null {
  if (!spec || typeof document === 'undefined') return null;
  for (const option of spec.split('||').map((value) => value.trim()).filter(Boolean)) {
    if (option.startsWith('text:')) {
      const found = findByText(option.slice(5));
      if (found) return found;
      continue;
    }
    try {
      const found = Array.from(document.querySelectorAll(option)).find(isVisible);
      if (found) return found as HTMLElement;
    } catch {
      /* selector no soportado por este navegador: se prueba la siguiente opción */
    }
  }
  return null;
}
