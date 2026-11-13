import { useEffect, useImperativeHandle, forwardRef, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, FileDown, Heading1, Heading2, Heading3, Highlighter, ImagePlus, Italic, Link2, List, ListOrdered, Minus, PanelTop,
  Quote, Redo2, RemoveFormatting, Search, Strikethrough, Table2, Trash2, Underline as UnderlineIcon, Undo2, X,
} from 'lucide-react';
import { cn } from '../../ui/utils';
import { toast } from '../../../services/toast';
import { DOCX_MIME, docxToHtml, editorJsonToDocx, readEmbeddedEditorState, type DocMeta } from './docx-convert';
import { DocImage, FONT_FAMILIES, FONT_SIZES, FindHighlight, LINE_HEIGHTS, TextFormatting, findKey, findMatches } from './doc-extensions';
import { printDocument } from './doc-print';
import type { BuiltFile } from './useAutosave';
import './documentos.css';

export interface DocEditorHandle { build: () => Promise<BuiltFile> }

interface Props {
  title: string;
  /** Archivo .docx guardado; null si el documento todavía está vacío. */
  source: Blob | null;
  readOnly: boolean;
  onChange: () => void;
}

/** Editor de documentos de texto: se abre un .docx, se edita en pantalla y se vuelve a generar el .docx al guardar. */
export const DocEditor = forwardRef<DocEditorHandle, Props>(function DocEditor({ title, source, readOnly, onChange }, ref) {
  const [ready, setReady] = useState(!source);
  const [loadError, setLoadError] = useState('');
  const [meta, setMeta] = useState<DocMeta>({});
  const [panel, setPanel] = useState<'find' | 'page' | null>(null);
  const loading = useRef(Boolean(source));
  const changeRef = useRef(onChange);
  const metaRef = useRef(meta);
  useEffect(() => { changeRef.current = onChange; metaRef.current = meta; });

  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline, TextStyle, Color, Highlight.configure({ multicolor: true }), TextFormatting, DocImage, FindHighlight,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } }),
      TextAlign.configure({ types: ['heading', 'paragraph', 'image'] }),
      Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
      Placeholder.configure({ placeholder: readOnly ? '' : 'Empieza a escribir…' }),
    ],
    content: '',
    editorProps: { attributes: { class: 'org-doc-page', 'aria-label': `Contenido de ${title}`, role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: () => { if (!loading.current) changeRef.current(); },
  });

  useEffect(() => { editor?.setEditable(!readOnly, false); }, [editor, readOnly]);

  // Abre el .docx guardado dentro del editor.
  useEffect(() => {
    if (!editor || !source) return undefined;
    let active = true;
    loading.current = true;
    readEmbeddedEditorState(source).then(async (saved) => {
      if (saved) return { saved, html: '', warnings: 0 };
      return { saved: null, ...(await docxToHtml(source)) };
    }).then(({ saved, html, warnings }) => {
      if (!active) return;
      editor.commands.setContent(saved?.json ?? (html || '<p></p>'), false);
      if (saved) setMeta(saved.meta);
      loading.current = false; setReady(true);
      if (warnings > 0) toast.info('Algunos elementos del archivo original no se pueden mostrar en el editor.');
    }).catch(() => { if (active) { loading.current = false; setLoadError('No se pudo abrir este archivo de Word. Puedes descargarlo desde la lista.'); } });
    return () => { active = false; };
  }, [editor, source]);

  useImperativeHandle(ref, () => ({
    build: async () => {
      if (!editor) throw new Error('El editor todavía no está listo');
      return { blob: await editorJsonToDocx(editor.getJSON(), title, metaRef.current), searchText: editor.getText({ blockSeparator: ' ' }).slice(0, 20_000) };
    },
  }), [editor, title]);

  const updateMeta = (patch: Partial<DocMeta>) => { setMeta((current) => ({ ...current, ...patch })); changeRef.current(); };
  const exportPdf = () => {
    if (!editor) return;
    if (!printDocument(editor.getHTML(), title, meta)) toast.error('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio y vuelve a intentarlo.');
    else toast.info('Elige «Guardar como PDF» como destino de impresión.');
  };

  if (loadError) return <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">{loadError}</p>;
  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-3">
      {editor && <Toolbar editor={editor} readOnly={readOnly} panel={panel} onPanel={setPanel} onPdf={exportPdf} />}
      {editor && panel === 'find' && <FindBar editor={editor} readOnly={readOnly} onClose={() => setPanel(null)} />}
      {panel === 'page' && !readOnly && <PagePanel meta={meta} onChange={updateMeta} onClose={() => setPanel(null)} />}
      <div className="org-doc-scroll min-w-0 overflow-auto rounded-xl border border-border bg-muted/40 p-3 sm:p-6" aria-busy={!ready}>
        {meta.header && <p className="org-doc-hf" aria-label="Encabezado">{meta.header}</p>}
        <EditorContent editor={editor} />
        {(meta.footer || meta.pageNumbers) && <p className="org-doc-hf" aria-label="Pie de página">{[meta.footer, meta.pageNumbers ? 'Página 1 de N' : ''].filter(Boolean).join('   ·   ')}</p>}
      </div>
    </div>
  );
});

export { DOCX_MIME };

function Btn({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={active} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-md text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40', active && 'bg-primary/15 text-primary dark:text-accent')}>
      {children}
    </button>
  );
}
const Sep = () => <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />;
const selectClass = 'h-8 shrink-0 rounded-md border border-border bg-background px-1.5 text-[12px] disabled:opacity-40';
const textBtn = 'h-8 rounded-md px-2 text-[12px] font-semibold hover:bg-muted';

/** Reduce la imagen elegida (máximo 1200 px de ancho) y la devuelve como dato incrustado PNG o JPEG. */
async function imageToDataUri(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  const keepAlpha = file.type === 'image/png' || file.type === 'image/gif' || file.type === 'image/webp';
  if (!keepAlpha) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return keepAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);
}

function Toolbar({ editor, readOnly, panel, onPanel, onPdf }: { editor: Editor; readOnly: boolean; panel: 'find' | 'page' | null; onPanel: (panel: 'find' | 'page' | null) => void; onPdf: () => void }) {
  // Vuelve a pintar la barra cuando cambia la selección o el formato.
  const [, force] = useState(0);
  const imageInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const update = () => force((n) => n + 1);
    editor.on('selectionUpdate', update); editor.on('transaction', update);
    return () => { editor.off('selectionUpdate', update); editor.off('transaction', update); };
  }, [editor]);
  const chain = () => editor.chain().focus();
  const setLink = () => {
    const previous = (editor.getAttributes('link').href as string | undefined) ?? '';
    const url = window.prompt('Dirección del enlace (déjala vacía para quitarlo)', previous);
    if (url === null) return;
    if (!url.trim()) { chain().extendMarkRange('link').unsetLink().run(); return; }
    if (!/^(https?:\/\/|mailto:)/i.test(url.trim())) { toast.error('El enlace debe empezar por https:// o mailto:'); return; }
    chain().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };
  const addImage = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|gif|webp)$/i.test(file.type)) { toast.error('Usa una imagen PNG, JPG, GIF o WebP.'); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error('La imagen pesa más de 8 MB.'); return; }
    try { chain().setImage({ src: await imageToDataUri(file), alt: file.name.replace(/\.[^.]+$/, '') }).run(); } catch { toast.error('El archivo de imagen no pudo leerse. Comprueba que sea válido y vuelve a seleccionarlo.'); }
  };
  const textStyle = editor.getAttributes('textStyle') as { fontSize?: string | null; fontFamily?: string | null; color?: string };
  const lineHeight = (editor.getAttributes('heading').lineHeight ?? editor.getAttributes('paragraph').lineHeight ?? '') as string;
  const sizeValue = /^(\d+)pt$/.exec(textStyle.fontSize ?? '')?.[1] ?? '';
  const familyValue = FONT_FAMILIES.find((f) => f.value && f.value.replace(/['"]/g, '') === (textStyle.fontFamily ?? '').replace(/['"]/g, ''))?.value ?? '';
  const inTable = editor.isActive('table');
  const setStyle = (patch: { fontSize?: string | null; fontFamily?: string | null }) => chain().setMark('textStyle', patch).run();
  const setLineHeight = (value: string) => chain().updateAttributes('paragraph', { lineHeight: value || null }).updateAttributes('heading', { lineHeight: value || null }).run();
  return (
    <div role="toolbar" aria-label="Formato del documento" className="flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-card p-1.5">
      {!readOnly && (
        <>
          <Btn label="Deshacer" disabled={!editor.can().undo()} onClick={() => chain().undo().run()}><Undo2 className="size-4" /></Btn>
          <Btn label="Rehacer" disabled={!editor.can().redo()} onClick={() => chain().redo().run()}><Redo2 className="size-4" /></Btn>
          <Sep />
          <select aria-label="Tipo de letra" className={cn(selectClass, 'w-32')} value={familyValue} onChange={(e) => setStyle({ fontFamily: e.target.value || null })}>
            {FONT_FAMILIES.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
          </select>
          <select aria-label="Tamaño de letra" className={cn(selectClass, 'w-16')} value={sizeValue} onChange={(e) => setStyle({ fontSize: e.target.value ? `${e.target.value}pt` : null })}>
            <option value="">Auto</option>
            {FONT_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select aria-label="Interlineado" className={cn(selectClass, 'w-20')} value={LINE_HEIGHTS.includes(lineHeight as (typeof LINE_HEIGHTS)[number]) ? lineHeight : ''} onChange={(e) => setLineHeight(e.target.value)}>
            <option value="">Interl.</option>
            {LINE_HEIGHTS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <Sep />
          <Btn label="Título 1" active={editor.isActive('heading', { level: 1 })} onClick={() => chain().toggleHeading({ level: 1 }).run()}><Heading1 className="size-4" /></Btn>
          <Btn label="Título 2" active={editor.isActive('heading', { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()}><Heading2 className="size-4" /></Btn>
          <Btn label="Título 3" active={editor.isActive('heading', { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()}><Heading3 className="size-4" /></Btn>
          <Sep />
          <Btn label="Negrita" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}><Bold className="size-4" /></Btn>
          <Btn label="Cursiva" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}><Italic className="size-4" /></Btn>
          <Btn label="Subrayado" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}><UnderlineIcon className="size-4" /></Btn>
          <Btn label="Tachado" active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()}><Strikethrough className="size-4" /></Btn>
          <Btn label="Resaltar" active={editor.isActive('highlight')} onClick={() => chain().toggleHighlight({ color: '#fff59d' }).run()}><Highlighter className="size-4" /></Btn>
          <label className="relative inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-muted" title="Color del texto">
            <span className="sr-only">Color del texto</span>
            <span aria-hidden="true" className="text-[14px] font-bold leading-none" style={{ color: textStyle.color ?? 'currentColor', borderBottom: '3px solid currentColor' }}>A</span>
            <input type="color" aria-label="Color del texto" className="absolute inset-0 cursor-pointer opacity-0" value={textStyle.color ?? '#000000'} onChange={(e) => chain().setColor(e.target.value).run()} />
          </label>
          <Btn label="Quitar el formato" onClick={() => chain().unsetAllMarks().clearNodes().run()}><RemoveFormatting className="size-4" /></Btn>
          <Btn label="Enlace" active={editor.isActive('link')} onClick={setLink}><Link2 className="size-4" /></Btn>
          <Sep />
          <Btn label="Alinear a la izquierda" active={editor.isActive({ textAlign: 'left' })} onClick={() => chain().setTextAlign('left').run()}><AlignLeft className="size-4" /></Btn>
          <Btn label="Centrar" active={editor.isActive({ textAlign: 'center' })} onClick={() => chain().setTextAlign('center').run()}><AlignCenter className="size-4" /></Btn>
          <Btn label="Alinear a la derecha" active={editor.isActive({ textAlign: 'right' })} onClick={() => chain().setTextAlign('right').run()}><AlignRight className="size-4" /></Btn>
          <Btn label="Justificar" active={editor.isActive({ textAlign: 'justify' })} onClick={() => chain().setTextAlign('justify').run()}><AlignJustify className="size-4" /></Btn>
          <Sep />
          <Btn label="Lista con viñetas" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}><List className="size-4" /></Btn>
          <Btn label="Lista numerada" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}><ListOrdered className="size-4" /></Btn>
          <Btn label="Cita" active={editor.isActive('blockquote')} onClick={() => chain().toggleBlockquote().run()}><Quote className="size-4" /></Btn>
          <Btn label="Línea separadora" onClick={() => chain().setHorizontalRule().run()}><Minus className="size-4" /></Btn>
          <Btn label="Insertar una imagen" onClick={() => imageInput.current?.click()}><ImagePlus className="size-4" /></Btn>
          <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" aria-label="Elegir una imagen" tabIndex={-1}
            onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; void addImage(file); }} />
          <Btn label="Insertar tabla de 3 × 3" onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 className="size-4" /></Btn>
          {inTable && (
            <>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chain().addRowAfter().run()} className={textBtn}>+ Fila</button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chain().addColumnAfter().run()} className={textBtn}>+ Columna</button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chain().deleteRow().run()} className={textBtn}>− Fila</button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chain().deleteColumn().run()} className={textBtn}>− Columna</button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chain().mergeOrSplit().run()} className={textBtn}>Combinar</button>
              <Btn label="Eliminar tabla" onClick={() => chain().deleteTable().run()}><Trash2 className="size-4" /></Btn>
            </>
          )}
          {editor.isActive('image') && [25, 50, 75, 100].map((pct) => (
            <button key={pct} type="button" aria-label={`Imagen al ${pct} % del ancho de la página`} onMouseDown={(e) => e.preventDefault()} onClick={() => chain().updateAttributes('image', { width: Math.round(6 * pct) }).run()} className={textBtn}>{pct}%</button>
          ))}
          <Sep />
        </>
      )}
      <Btn label="Buscar y reemplazar" active={panel === 'find'} onClick={() => onPanel(panel === 'find' ? null : 'find')}><Search className="size-4" /></Btn>
      {!readOnly && <Btn label="Encabezado, pie y número de página" active={panel === 'page'} onClick={() => onPanel(panel === 'page' ? null : 'page')}><PanelTop className="size-4" /></Btn>}
      <Btn label="Guardar como PDF (imprimir)" onClick={onPdf}><FileDown className="size-4" /></Btn>
    </div>
  );
}

function FindBar({ editor, readOnly, onClose }: { editor: Editor; readOnly: boolean; onClose: () => void }) {
  const [term, setTerm] = useState('');
  const [replacement, setReplacement] = useState('');
  const [index, setIndex] = useState(0);
  const [, force] = useState(0);
  useEffect(() => {
    const update = () => force((n) => n + 1);
    editor.on('update', update);
    return () => { editor.off('update', update); };
  }, [editor]);
  // Al cerrar la barra se quitan los resaltados.
  useEffect(() => () => { if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(findKey, { term: '', index: 0 })); }, [editor]);

  const matches = findMatches(editor.state.doc, term);
  const current = matches.length ? Math.min(index, matches.length - 1) : 0;
  const mark = (nextTerm: string, nextIndex: number) => {
    setTerm(nextTerm); setIndex(nextIndex);
    editor.view.dispatch(editor.state.tr.setMeta(findKey, { term: nextTerm, index: nextIndex }));
    const hit = findMatches(editor.state.doc, nextTerm)[nextIndex];
    if (hit) editor.chain().setTextSelection(hit).scrollIntoView().run();
  };
  const step = (delta: number) => { if (matches.length) mark(term, (current + delta + matches.length) % matches.length); };
  const replaceOne = () => {
    const hit = matches[current]; if (!hit) return;
    editor.chain().insertContentAt({ from: hit.from, to: hit.to }, replacement).run();
    mark(term, current);
  };
  const replaceAll = () => {
    if (!matches.length) return;
    const tr = editor.state.tr;
    [...matches].reverse().forEach((m) => { if (replacement) tr.insertText(replacement, m.from, m.to); else tr.delete(m.from, m.to); });
    editor.view.dispatch(tr);
    toast.success(`Se reemplazaron ${matches.length} coincidencias`);
    mark(term, 0);
  };
  const input = 'h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[13px]';
  return (
    <div role="search" aria-label="Buscar y reemplazar" className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
      <input autoFocus aria-label="Buscar" placeholder="Buscar" value={term} className={cn(input, 'min-w-32')}
        onChange={(e) => mark(e.target.value, 0)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') onClose(); }} />
      {!readOnly && <input aria-label="Reemplazar con" placeholder="Reemplazar con" value={replacement} className={cn(input, 'min-w-32')} onChange={(e) => setReplacement(e.target.value)} />}
      <span className="text-[12px] text-muted-foreground" aria-live="polite">{term ? (matches.length ? `${current + 1} de ${matches.length}` : 'Sin resultados') : ''}</span>
      <button type="button" className={textBtn} disabled={!matches.length} onClick={() => step(-1)}>Anterior</button>
      <button type="button" className={textBtn} disabled={!matches.length} onClick={() => step(1)}>Siguiente</button>
      {!readOnly && <button type="button" className={textBtn} disabled={!matches.length} onClick={replaceOne}>Reemplazar</button>}
      {!readOnly && <button type="button" className={textBtn} disabled={!matches.length} onClick={replaceAll}>Reemplazar todo</button>}
      <Btn label="Cerrar la búsqueda" onClick={onClose}><X className="size-4" /></Btn>
    </div>
  );
}

function PagePanel({ meta, onChange, onClose }: { meta: DocMeta; onChange: (patch: Partial<DocMeta>) => void; onClose: () => void }) {
  const input = 'h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[13px]';
  return (
    <div role="group" aria-label="Encabezado y pie de página" className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
      <input aria-label="Texto del encabezado" placeholder="Encabezado (se repite en cada página)" maxLength={200} value={meta.header ?? ''} className={cn(input, 'min-w-48')} onChange={(e) => onChange({ header: e.target.value })} />
      <input aria-label="Texto del pie de página" placeholder="Pie de página" maxLength={200} value={meta.footer ?? ''} className={cn(input, 'min-w-48')} onChange={(e) => onChange({ footer: e.target.value })} />
      <label className="inline-flex items-center gap-2 text-[12px] font-semibold"><input type="checkbox" checked={Boolean(meta.pageNumbers)} onChange={(e) => onChange({ pageNumbers: e.target.checked })} />Numerar las páginas</label>
      <Btn label="Cerrar" onClick={onClose}><X className="size-4" /></Btn>
    </div>
  );
}

