/**
 * Conversión entre el editor de texto (TipTap) y archivos .docx: mammoth abre el .docx como HTML y la librería
 * `docx` genera el archivo a partir del contenido del editor. Se conservan párrafos, títulos, negrita/cursiva/
 * subrayado/tachado, color y resaltado, enlaces, listas, tablas, citas y alineación (las imágenes no se incluyen).
 */
import type { JSONContent } from '@tiptap/react';
import JSZip from 'jszip';
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, HeadingLevel, LevelFormat, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType,
  type ParagraphChild, type FileChild,
} from 'docx';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Abre un .docx y devuelve HTML limpio para el editor, más el texto plano para buscar. */
export async function docxToHtml(source: Blob): Promise<{ html: string; text: string; warnings: number }> {
  const mammoth = (await import('mammoth')).default ?? (await import('mammoth'));
  const arrayBuffer = await source.arrayBuffer();
  const [html, raw] = await Promise.all([
    mammoth.convertToHtml({ arrayBuffer }, {
      // Las imágenes embebidas harían pesadísimo el documento y el editor no las soporta: se omiten.
      convertImage: mammoth.images.imgElement(async () => ({ src: '' })),
      styleMap: ['p[style-name=\'Title\'] => h1:fresh', 'p[style-name=\'Subtitle\'] => h2:fresh', 'u => u'],
    }),
    mammoth.extractRawText({ arrayBuffer }),
  ]);
  return { html: html.value.replace(/<img[^>]*src=""[^>]*>/g, ''), text: raw.value, warnings: html.messages.length };
}

const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED,
};
const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];

interface Mark { type: string; attrs?: Record<string, unknown> }
interface Ctx { numbering: Array<{ reference: string; ordered: boolean }>; counter: number }

const hexColor = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const m = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (m) return m[1].toUpperCase();
  const rgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i.exec(value.trim());
  return rgb ? [rgb[1], rgb[2], rgb[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase() : undefined;
};

function runs(nodes: JSONContent[] | undefined, extra: { bold?: boolean } = {}): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  for (const node of nodes ?? []) {
    if (node.type === 'hardBreak') { out.push(new TextRun({ break: 1 })); continue; }
    if (node.type !== 'text' || node.text === undefined) continue;
    const marks = (node.marks ?? []) as Mark[];
    const has = (type: string) => marks.some((m) => m.type === type);
    const style = marks.find((m) => m.type === 'textStyle');
    const highlight = marks.find((m) => m.type === 'highlight');
    const color = hexColor(style?.attrs?.color);
    const fill = hexColor(highlight?.attrs?.color) ?? (highlight ? 'FFF59D' : undefined);
    const run = new TextRun({
      text: node.text, bold: has('bold') || extra.bold, italics: has('italic'), strike: has('strike'),
      underline: has('underline') ? {} : undefined, color, font: has('code') ? 'Consolas' : undefined,
      shading: fill ? { type: 'clear', fill, color: 'auto' } : undefined,
    });
    const link = marks.find((m) => m.type === 'link');
    const href = typeof link?.attrs?.href === 'string' ? link.attrs.href : '';
    out.push(/^(https?:|mailto:)/i.test(href) ? new ExternalHyperlink({ link: href, children: [run] }) : run);
  }
  return out;
}

function blocks(nodes: JSONContent[] | undefined, ctx: Ctx, list?: { reference: string; level: number }): FileChild[] {
  const out: FileChild[] = [];
  for (const node of nodes ?? []) {
    const align = ALIGN[String(node.attrs?.textAlign ?? '')];
    switch (node.type) {
      case 'paragraph':
        out.push(new Paragraph({ children: runs(node.content), alignment: align, numbering: list ? { reference: list.reference, level: list.level } : undefined }));
        break;
      case 'heading':
        out.push(new Paragraph({ heading: HEADINGS[Math.min(6, Math.max(1, Number(node.attrs?.level) || 1)) - 1], children: runs(node.content), alignment: align }));
        break;
      case 'blockquote':
        for (const child of blocks(node.content, ctx)) out.push(child);
        break;
      case 'codeBlock':
        out.push(new Paragraph({ children: [new TextRun({ text: (node.content ?? []).map((c) => c.text ?? '').join(''), font: 'Consolas' })], shading: { type: 'clear', fill: 'F3F4F6', color: 'auto' } }));
        break;
      case 'horizontalRule':
        out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } } }));
        break;
      case 'bulletList':
      case 'orderedList': {
        const ordered = node.type === 'orderedList';
        const level = list ? list.level + 1 : 0;
        // Cada lista numerada tiene su propia referencia para que reinicie en 1.
        const reference = list && list.reference.startsWith(ordered ? 'ol-' : 'ul') ? list.reference : ordered ? `ol-${ctx.counter++}` : 'ul';
        if (!ctx.numbering.some((n) => n.reference === reference)) ctx.numbering.push({ reference, ordered });
        for (const item of node.content ?? []) out.push(...blocks(item.content, ctx, { reference, level: Math.min(level, 8) }));
        break;
      }
      case 'table': {
        const rows = (node.content ?? []).map((row) => new TableRow({
          tableHeader: (row.content ?? []).every((cell) => cell.type === 'tableHeader'),
          children: (row.content ?? []).map((cell) => {
            const children = blocks(cell.content, ctx) as Paragraph[];
            return new TableCell({
              children: children.length ? children : [new Paragraph('')],
              columnSpan: Number(cell.attrs?.colspan) > 1 ? Number(cell.attrs?.colspan) : undefined,
              rowSpan: Number(cell.attrs?.rowspan) > 1 ? Number(cell.attrs?.rowspan) : undefined,
              shading: cell.type === 'tableHeader' ? { type: 'clear', fill: 'E5E7EB', color: 'auto' } : undefined,
            });
          }),
        }));
        if (rows.length) out.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }), new Paragraph(''));
        break;
      }
      default:
        if (node.content) out.push(...blocks(node.content, ctx, list));
    }
  }
  return out;
}

/** Genera el archivo .docx a partir del contenido del editor. */
export async function editorJsonToDocx(json: JSONContent, title: string): Promise<Blob> {
  const ctx: Ctx = { numbering: [{ reference: 'ul', ordered: false }], counter: 1 };
  const children = blocks(json.content, ctx);
  if (!children.length) children.push(new Paragraph(''));
  const levels = (ordered: boolean) => Array.from({ length: 9 }, (_, level) => ({
    level, format: ordered ? LevelFormat.DECIMAL : LevelFormat.BULLET, text: ordered ? `%${level + 1}.` : level % 2 ? '◦' : '•',
    alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
  }));
  const doc = new Document({
    creator: 'NovaHub', title,
    numbering: { config: ctx.numbering.map((n) => ({ reference: n.reference, levels: levels(n.ordered) })) },
    sections: [{ children }],
  });
  return embedEditorState(await Packer.toBlob(doc), json);
}

// ───────────── Copia fiel del editor dentro del .docx ─────────────
// mammoth no lee alineación, colores ni resaltado, así que el .docx generado lleva además una copia del contenido del
// editor en una parte propia (invisible para Word). Al reabrir se usa esa copia solo si el cuerpo del .docx sigue
// siendo el mismo (huella SHA-256); si alguien lo editó en Word, se abre con mammoth.
const STATE_PATH = 'novahub/editor.json';

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function embedEditorState(blob: Blob, json: JSONContent): Promise<Blob> {
  try {
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const body = await zip.file('word/document.xml')?.async('string');
    const types = await zip.file('[Content_Types].xml')?.async('string');
    if (!body || !types) return blob;
    zip.file(STATE_PATH, JSON.stringify({ v: 1, hash: await sha256(body), json }));
    zip.file('[Content_Types].xml', types.replace('</Types>', `<Override PartName="/${STATE_PATH}" ContentType="application/json"/></Types>`));
    return await zip.generateAsync({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' });
  } catch { return blob; }
}

/** Contenido del editor guardado dentro del .docx, si existe y el documento no se cambió fuera del ERP. */
export async function readEmbeddedEditorState(source: Blob): Promise<JSONContent | null> {
  try {
    const zip = await JSZip.loadAsync(await source.arrayBuffer());
    const stored = await zip.file(STATE_PATH)?.async('string');
    const body = await zip.file('word/document.xml')?.async('string');
    if (!stored || !body) return null;
    const parsed = JSON.parse(stored) as { v?: number; hash?: string; json?: JSONContent };
    return parsed.v === 1 && parsed.hash === (await sha256(body)) && parsed.json?.type === 'doc' ? parsed.json : null;
  } catch { return null; }
}
