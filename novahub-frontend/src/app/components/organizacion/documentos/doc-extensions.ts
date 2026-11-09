/** Extensiones propias del editor de texto: tamaño y tipo de letra, interlineado, imágenes y búsqueda con resaltado. */
import { Extension } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

export const FONT_FAMILIES = [
  { label: 'Predeterminada', value: '' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Calibri', value: 'Calibri, Carlito, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
] as const;
export const FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 24, 28, 36] as const;
export const LINE_HEIGHTS = ['1', '1.15', '1.5', '2'] as const;

/** Primer nombre de una familia tipográfica CSS («"Times New Roman", serif» → Times New Roman). */
export const firstFont = (css: unknown): string | undefined => {
  if (typeof css !== 'string' || !css.trim()) return undefined;
  return css.split(',')[0].trim().replace(/^["']|["']$/g, '') || undefined;
};

/** Atributos de texto (tamaño y tipo de letra, sobre la marca de estilo) e interlineado (sobre párrafos y títulos). */
export const TextFormatting = Extension.create({
  name: 'textFormatting',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.fontSize || null,
            renderHTML: (attrs: Record<string, unknown>) => (attrs.fontSize ? { style: `font-size: ${String(attrs.fontSize)}` } : {}),
          },
          fontFamily: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.fontFamily?.replace(/['"]+/g, '"') || null,
            renderHTML: (attrs: Record<string, unknown>) => (attrs.fontFamily ? { style: `font-family: ${String(attrs.fontFamily)}` } : {}),
          },
        },
      },
      {
        types: ['paragraph', 'heading'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.lineHeight || null,
            renderHTML: (attrs: Record<string, unknown>) => (attrs.lineHeight ? { style: `line-height: ${String(attrs.lineHeight)}` } : {}),
          },
        },
      },
    ];
  },
});

/** Imágenes incrustadas (base64) como bloque propio. */
export const DocImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      /** Ancho en píxeles (por omisión, el natural, con tope de la página). */
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => Number(el.getAttribute('width')) || null,
        renderHTML: (attrs: Record<string, unknown>) => (attrs.width ? { width: String(attrs.width), style: `width: ${String(attrs.width)}px` } : {}),
      },
    };
  },
}).configure({ inline: false, allowBase64: true, HTMLAttributes: { class: 'org-doc-img' } });

// ───────────── Búsqueda con resaltado ─────────────
export interface Match { from: number; to: number }
export const findKey = new PluginKey<{ term: string; index: number }>('orgDocFind');

/** Coincidencias (sin distinguir mayúsculas) dentro de cada fragmento de texto del documento. */
export function findMatches(doc: PMNode, term: string): Match[] {
  const out: Match[] = [];
  if (!term) return out;
  const needle = term.toLowerCase();
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const hay = node.text.toLowerCase();
    for (let at = hay.indexOf(needle); at >= 0 && out.length < 5000; at = hay.indexOf(needle, at + needle.length)) out.push({ from: pos + at, to: pos + at + needle.length });
  });
  return out;
}

export const FindHighlight = Extension.create({
  name: 'findHighlight',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: findKey,
      state: {
        init: () => ({ term: '', index: 0 }),
        apply: (tr, value) => (tr.getMeta(findKey) as { term: string; index: number } | undefined) ?? value,
      },
      props: {
        decorations(state) {
          const value = findKey.getState(state);
          if (!value?.term) return DecorationSet.empty;
          const matches = findMatches(state.doc, value.term);
          return DecorationSet.create(state.doc, matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === value.index ? 'org-find org-find-current' : 'org-find' })));
        },
      },
    })];
  },
});
