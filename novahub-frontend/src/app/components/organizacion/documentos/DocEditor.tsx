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
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Heading1, Heading2, Heading3, Highlighter, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, Strikethrough,
  Table2, Trash2, Underline as UnderlineIcon, Undo2,
} from 'lucide-react';
import { cn } from '../../ui/utils';
import { toast } from '../../../services/toast';
import { DOCX_MIME, docxToHtml, editorJsonToDocx, readEmbeddedEditorState } from './docx-convert';
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
  const loading = useRef(Boolean(source));
  const changeRef = useRef(onChange);
  useEffect(() => { changeRef.current = onChange; });

  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline, TextStyle, Color, Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
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
      editor.commands.setContent(saved ?? (html || '<p></p>'), false);
      loading.current = false; setReady(true);
      if (warnings > 0) toast.info('Algunos elementos del archivo original (como imágenes) no se pueden mostrar en el editor.');
    }).catch(() => { if (active) { loading.current = false; setLoadError('No se pudo abrir este archivo de Word. Puedes descargarlo desde la lista.'); } });
    return () => { active = false; };
  }, [editor, source]);

  useImperativeHandle(ref, () => ({
    build: async () => {
      if (!editor) throw new Error('El editor todavía no está listo');
      return { blob: await editorJsonToDocx(editor.getJSON(), title), searchText: editor.getText({ blockSeparator: ' ' }).slice(0, 20_000) };
    },
  }), [editor, title]);

  if (loadError) return <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">{loadError}</p>;
  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-3">
      {!readOnly && editor && <Toolbar editor={editor} />}
      <div className="org-doc-scroll min-w-0 overflow-auto rounded-xl border border-border bg-muted/40 p-3 sm:p-6" aria-busy={!ready}>
        <EditorContent editor={editor} />
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

function Toolbar({ editor }: { editor: Editor }) {
  // Vuelve a pintar la barra cuando cambia la selección o el formato.
  const [, force] = useState(0);
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
  const inTable = editor.isActive('table');
  return (
    <div role="toolbar" aria-label="Formato del documento" className="flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-card p-1.5">
      <Btn label="Deshacer" disabled={!editor.can().undo()} onClick={() => chain().undo().run()}><Undo2 className="size-4" /></Btn>
      <Btn label="Rehacer" disabled={!editor.can().redo()} onClick={() => chain().redo().run()}><Redo2 className="size-4" /></Btn>
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
        <span aria-hidden="true" className="text-[14px] font-bold leading-none" style={{ color: (editor.getAttributes('textStyle').color as string | undefined) ?? 'currentColor', borderBottom: '3px solid currentColor' }}>A</span>
        <input type="color" aria-label="Color del texto" className="absolute inset-0 cursor-pointer opacity-0" value={(editor.getAttributes('textStyle').color as string | undefined) ?? '#000000'} onChange={(e) => chain().setColor(e.target.value).run()} />
      </label>
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
      <Sep />
      <Btn label="Insertar tabla de 3 × 3" onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 className="size-4" /></Btn>
      {inTable && (
        <>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chain().addRowAfter().run()} className="h-8 rounded-md px-2 text-[12px] font-semibold hover:bg-muted">+ Fila</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chain().addColumnAfter().run()} className="h-8 rounded-md px-2 text-[12px] font-semibold hover:bg-muted">+ Columna</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chain().deleteRow().run()} className="h-8 rounded-md px-2 text-[12px] font-semibold hover:bg-muted">− Fila</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chain().deleteColumn().run()} className="h-8 rounded-md px-2 text-[12px] font-semibold hover:bg-muted">− Columna</button>
          <Btn label="Eliminar tabla" onClick={() => chain().deleteTable().run()}><Trash2 className="size-4" /></Btn>
        </>
      )}
    </div>
  );
}
