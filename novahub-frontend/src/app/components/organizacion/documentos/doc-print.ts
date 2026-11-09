/** Guardar como PDF: imprime el contenido del documento en un marco oculto (el navegador ofrece «Guardar como PDF»). */
import type { DocMeta } from './docx-convert';

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const STYLES = `
  @page { size: A4; margin: 22mm 20mm; }
  body { font-family: Calibri, Carlito, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #111; margin: 0; }
  h1 { font-size: 20pt; } h2 { font-size: 16pt; } h3 { font-size: 13pt; }
  h1, h2, h3 { line-height: 1.25; margin: 1em 0 0.4em; }
  p { margin: 0 0 0.6em; } img { max-width: 100%; height: auto; }
  ul { list-style: disc; padding-left: 1.6em; } ol { list-style: decimal; padding-left: 1.6em; } li > p { margin: 0; }
  blockquote { border-left: 3px solid #9ca3af; padding-left: 1em; color: #4b5563; margin-left: 0; }
  table { width: 100%; border-collapse: collapse; margin: 0.6em 0; table-layout: fixed; }
  th, td { border: 1px solid #999; padding: 4px 8px; vertical-align: top; }
  th { background: #eceff3; text-align: left; }
  td > p, th > p { margin: 0; }
  mark { background: #fff59d; } a { color: #0b5ed7; } code { font-family: Consolas, monospace; }
  hr { border: 0; border-top: 1px solid #999; }
  .hf { color: #555; font-size: 9pt; text-align: center; margin: 0 0 12pt; }
  .hf.foot { margin: 14pt 0 0; }
`;

/** Abre el cuadro de impresión con el documento; devuelve false si el navegador no permite crear el marco. */
export function printDocument(html: string, title: string, meta: DocMeta): boolean {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  if (!win) { frame.remove(); return false; }
  const head = meta.header ? `<p class="hf">${escapeHtml(meta.header)}</p>` : '';
  const foot = meta.footer ? `<p class="hf foot">${escapeHtml(meta.footer)}</p>` : '';
  win.document.open();
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${STYLES}</style></head><body>${head}${html}${foot}</body></html>`);
  win.document.close();
  const cleanup = () => window.setTimeout(() => frame.remove(), 500);
  win.addEventListener('afterprint', cleanup);
  window.setTimeout(() => { win.focus(); win.print(); window.setTimeout(() => { if (frame.isConnected) frame.remove(); }, 120_000); }, 250);
  return true;
}
