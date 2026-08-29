import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Copy, GripVertical, Minus, Plus, Redo2, Trash2, Type, Undo2, Table2, Calculator, ImagePlus, Square, Move } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../ui/utils';
import { getPdfTemplateTarget } from '../../services/pdf-document-catalog';
import { getTemplateTokenSample, resolveTemplateToken, TEMPLATE_TOKENS, type PdfTemplateData, type PdfTemplateDefinition, type PdfTemplateNode, type PdfTemplateNodeType } from '../../services/pdf-template-definition';

type CanvasSettings = {
  paperSize: string;
  orientation: 'portrait' | 'landscape';
  primaryColor?: string;
  textColor?: string;
  lineColor?: string;
  fontFamily?: string;
  fontSize?: number;
};

interface PdfTemplateCanvasEditorProps {
  definition: PdfTemplateDefinition;
  settings: CanvasSettings;
  targetKey: string;
  data?: PdfTemplateData;
  onChange: (definition: PdfTemplateDefinition) => void;
}

type DragState = { id: string; mode: 'move' | 'resize'; startX: number; startY: number; x: number; y: number; width: number; height: number; rect: DOMRect };

const SAMPLE_DATA: PdfTemplateData = {
  company: { name: 'NovaHub Comercial', fiscalInfo: 'RUC J0310000000000', address: 'Managua, Nicaragua', phone: '+505 2255-0000', email: 'contacto@empresa.com' },
  document: { title: 'COTIZACIÓN', number: 'COT-000123', date: '29/08/2026', status: 'Pendiente', notes: 'Gracias por solicitar una propuesta. Esta nota puede editarse desde el documento.' },
  customer: { name: 'Cliente de ejemplo', taxId: 'J0310000000000', address: 'Dirección del cliente', phone: '+505 8888-0000' },
  items: [
    { description: 'Producto de muestra', quantity: '2', unitPrice: 'C$ 500.00', total: 'C$ 1,000.00' },
    { description: 'Servicio adicional', quantity: '1', unitPrice: 'C$ 150.00', total: 'C$ 150.00' },
  ],
  totals: { subtotal: 'C$ 1,000.00', tax: 'C$ 150.00', discount: 'C$ 0.00', total: 'C$ 1,150.00' },
};

function pageAspect(settings: CanvasSettings) {
  const dimensions = settings.paperSize === 'A4' ? [210, 297] : settings.paperSize === 'OFICIO' ? [216, 330] : settings.paperSize === 'LEGAL' ? [216, 356] : [216, 279];
  return settings.orientation === 'landscape' ? `${dimensions[1]} / ${dimensions[0]}` : `${dimensions[0]} / ${dimensions[1]}`;
}

function nodeText(node: PdfTemplateNode, data: PdfTemplateData) {
  if (node.type === 'field') return resolveTemplateToken(node.token, data, node.sample || getTemplateTokenSample(node.token));
  return node.text || node.sample || node.label;
}

function nodeStyle(node: PdfTemplateNode, settings: CanvasSettings) {
  return {
    left: `${node.x}%`, top: `${node.y}%`, width: `${node.width}%`, height: `${node.height}%`,
    color: node.color || settings.textColor || '#334155', backgroundColor: node.backgroundColor || 'transparent',
    borderColor: node.borderColor || settings.lineColor || '#e2e8f0', borderRadius: `${node.borderRadius || 0}px`,
    fontSize: `${node.fontSize || settings.fontSize || 9}px`, fontFamily: settings.fontFamily || 'Inter, sans-serif',
    textAlign: node.align || 'left', padding: `${node.padding ?? 1.5}%`, fontWeight: node.bold ? 700 : 400, fontStyle: node.italic ? 'italic' : 'normal',
  } as const;
}

function updateNode(definition: PdfTemplateDefinition, id: string, patch: Partial<PdfTemplateNode>) {
  return { ...definition, nodes: definition.nodes.map(node => node.id === id ? { ...node, ...patch } : node) };
}

export function PdfTemplateCanvasEditor({ definition, settings, targetKey, data, onChange }: PdfTemplateCanvasEditorProps) {
  const [selectedId, setSelectedId] = useState(definition.nodes.find(node => node.enabled !== false)?.id || null);
  const [zoom, setZoom] = useState(72);
  const [history, setHistory] = useState<PdfTemplateDefinition[]>([]);
  const [future, setFuture] = useState<PdfTemplateDefinition[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const target = getPdfTemplateTarget(targetKey);
  const sampleData = data || SAMPLE_DATA;
  const selected = definition.nodes.find(node => node.id === selectedId) || null;
  const activeNodes = useMemo(() => definition.nodes.filter(node => node.enabled !== false && (node.page || 1) === 1), [definition.nodes]);

  useEffect(() => {
    if (!drag) return;
    const move = (event: PointerEvent) => {
      const dx = ((event.clientX - drag.startX) / drag.rect.width) * 100;
      const dy = ((event.clientY - drag.startY) / drag.rect.height) * 100;
      const next = drag.mode === 'resize'
        ? { width: Math.max(4, Math.min(100 - drag.x, drag.width + dx)), height: Math.max(2, Math.min(100 - drag.y, drag.height + dy)) }
        : { x: Math.max(0, Math.min(100 - drag.width, drag.x + dx)), y: Math.max(0, Math.min(100 - drag.height, drag.y + dy)) };
      onChange(updateNode(definition, drag.id, next));
    };
    const stop = () => setDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
  }, [definition, drag, onChange]);

  const commit = (next: PdfTemplateDefinition) => {
    setHistory(items => [...items.slice(-19), definition]);
    setFuture([]);
    onChange(next);
  };

  const addNode = (type: PdfTemplateNodeType) => {
    const id = `${type}-${Date.now()}`;
    const defaults: Record<PdfTemplateNodeType, Partial<PdfTemplateNode>> = {
      section: { label: 'Sección', backgroundColor: '#f8fafc', borderColor: settings.lineColor || '#e2e8f0', width: 40, height: 10 },
      text: { label: 'Texto', text: 'Nuevo texto', width: 34, height: 6 },
      field: { label: 'Campo', token: 'document.number', width: 34, height: 5 },
      table: { label: 'Tabla', width: 60, height: 18, columns: [{ id: 'description', label: 'Descripción', token: 'description', width: 70 }, { id: 'total', label: 'Total', token: 'total', width: 30, align: 'right' }] },
      totals: { label: 'Totales', width: 35, height: 12, backgroundColor: '#f8fafc' },
      image: { label: 'Logo', width: 22, height: 12 },
      divider: { label: 'Separador', width: 60, height: 1, borderColor: settings.lineColor || '#e2e8f0' },
      spacer: { label: 'Espacio', width: 20, height: 5 },
    };
    const nextNode = { id, type, x: 10, y: 18 + (definition.nodes.length % 5) * 8, enabled: true, fontSize: settings.fontSize || 9, color: settings.textColor || '#334155', padding: 1.5, ...defaults[type] } as PdfTemplateNode;
    setSelectedId(id);
    commit({ ...definition, nodes: [...definition.nodes, nextNode] });
  };

  const removeSelected = () => {
    if (!selected) return;
    commit({ ...definition, nodes: definition.nodes.filter(node => node.id !== selected.id) });
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const copy = { ...selected, id: `${selected.type}-${Date.now()}`, x: Math.min(90 - selected.width, selected.x + 3), y: Math.min(95 - selected.height, selected.y + 3), label: `${selected.label} copia` };
    setSelectedId(copy.id);
    commit({ ...definition, nodes: [...definition.nodes, copy] });
  };

  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory(items => items.slice(0, -1));
    setFuture(items => [...items, definition]);
    onChange(previous);
  };

  const redo = () => {
    const next = future[future.length - 1];
    if (!next) return;
    setFuture(items => items.slice(0, -1));
    setHistory(items => [...items, definition]);
    onChange(next);
  };

  const beginDrag = (event: ReactPointerEvent, node: PdfTemplateNode, mode: 'move' | 'resize') => {
    event.stopPropagation();
    event.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSelectedId(node.id);
    setDrag({ id: node.id, mode, startX: event.clientX, startY: event.clientY, x: node.x, y: node.y, width: node.width, height: node.height, rect });
  };

  const selectedPatch = (patch: Partial<PdfTemplateNode>) => {
    if (!selected) return;
    commit(updateNode(definition, selected.id, patch));
  };

  const handleKeyDown = (event: ReactKeyboardEvent) => {
    if (!selected) return;
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelected(); return; }
    const delta = event.shiftKey ? 2 : 0.5;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      selectedPatch({ x: selected.x + (event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0), y: selected.y + (event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0) });
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#101827] text-slate-100 shadow-2xl" data-testid="pdf-template-canvas-editor">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-[#0b1220] px-3 py-2">
        <div className="mr-2 flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300"><Move size={15} /></div>
          <div className="min-w-0"><p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Canvas de plantilla</p><p className="truncate text-[10px] text-slate-500">{target.label} · arrastra y redimensiona</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-1 border-l border-slate-800 pl-2">
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => addNode('field')}><Plus size={14} /> Campo</Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => addNode('text')}><Type size={14} /> Texto</Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => addNode('table')}><Table2 size={14} /> Tabla</Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => addNode('totals')}><Calculator size={14} /> Totales</Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => addNode('image')}><ImagePlus size={14} /> Imagen</Button>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Deshacer" disabled={!history.length} onClick={undo}><Undo2 size={15} /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Rehacer" disabled={!future.length} onClick={redo}><Redo2 size={15} /></Button>
          <span className="mx-1 h-5 w-px bg-slate-800" />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Alejar" onClick={() => setZoom(value => Math.max(45, value - 8))}><Minus size={15} /></Button>
          <span className="w-10 text-center text-[11px] text-slate-400">{zoom}%</span>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Acercar" onClick={() => setZoom(value => Math.min(120, value + 8))}><Plus size={15} /></Button>
        </div>
      </div>
      <div className="grid min-h-[580px] grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1fr)_245px]">
        <div className="relative overflow-auto bg-[radial-gradient(#243247_1px,transparent_1px)] [background-size:16px_16px] p-7 sm:p-10" onKeyDown={handleKeyDown} tabIndex={0}>
          <div className="mx-auto transition-transform duration-200" style={{ width: `${zoom}%`, maxWidth: 850, minWidth: 340 }}>
            <div ref={canvasRef} className="relative w-full overflow-hidden rounded-sm bg-white shadow-[0_22px_70px_rgba(0,0,0,0.45)]" style={{ aspectRatio: pageAspect(settings), backgroundColor: definition.page.background || '#fff' }} onPointerDown={() => setSelectedId(null)}>
              {activeNodes.map(node => {
                const isSelected = selectedId === node.id;
                return <div key={node.id} data-template-node={node.id} className={cn('group absolute overflow-visible border transition-shadow', node.type === 'divider' ? 'border-t-2 border-x-0 border-b-0' : 'border-transparent', isSelected ? 'z-20 shadow-[0_0_0_2px_#34d399,0_8px_20px_rgba(16,185,129,0.20)]' : 'hover:z-10 hover:shadow-[0_0_0_1px_#93c5fd]')} style={nodeStyle(node, settings)} onPointerDown={event => beginDrag(event, node, 'move')} onClick={event => { event.stopPropagation(); setSelectedId(node.id); }}>
                  {node.type === 'image' ? <div className="flex h-full items-center justify-center text-slate-300"><ImagePlus size={22} /><span className="ml-1 text-[8px]">Logo</span></div> : node.type === 'table' ? <div className="h-full overflow-hidden rounded-[inherit] border" style={{ borderColor: node.borderColor }}><div className="flex border-b bg-slate-100 px-2 py-1 text-[7px] font-bold uppercase tracking-wide text-slate-500">{(node.columns || []).map(column => <span key={column.id} style={{ width: `${column.width || 25}%`, textAlign: column.align || 'left' }}>{column.label}</span>)}</div>{(sampleData.items || sampleData.rows || [{ description: 'Fila de muestra', quantity: '1', unitPrice: 'C$ 0.00', total: 'C$ 0.00' }]).slice(0, 4).map((row, index) => <div key={index} className="flex border-b px-2 py-1 text-[7px] text-slate-600 last:border-0">{(node.columns || []).map(column => <span key={column.id} className="truncate" style={{ width: `${column.width || 25}%`, textAlign: column.align || 'left' }}>{String(row[column.token] ?? row[column.id] ?? '')}</span>)}</div>)}</div> : node.type === 'totals' ? <div className="space-y-1 text-[8px]"><p className="mb-1 text-[7px] font-bold uppercase tracking-wider opacity-60">Totales</p>{['subtotal', 'tax', 'discount', 'total'].map(key => <div key={key} className={cn('flex justify-between gap-2', key === 'total' && 'border-t pt-1 font-bold')}><span>{key === 'subtotal' ? 'Subtotal' : key === 'tax' ? 'Impuestos' : key === 'discount' ? 'Descuento' : 'Total'}</span><span>{resolveTemplateToken(`totals.${key}`, sampleData)}</span></div>)}</div> : <span className="block truncate leading-tight">{nodeText(node, sampleData)}</span>}
                  {isSelected && <><span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full border-2 border-[#101827] bg-emerald-400" /><span className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full border-2 border-[#101827] bg-emerald-400" /><span className="absolute -bottom-1.5 -left-1.5 h-3 w-3 rounded-full border-2 border-[#101827] bg-emerald-400" /><button type="button" aria-label="Redimensionar elemento" className="absolute -bottom-2 -right-2 flex h-4 w-4 cursor-nwse-resize items-center justify-center rounded-full border-2 border-[#101827] bg-emerald-400 text-[#101827]" onPointerDown={event => beginDrag(event, node, 'resize')}><GripVertical size={8} /></button></>}
                </div>;
              })}
              {!activeNodes.length && <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Agrega un elemento desde la barra de herramientas</div>}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-500"><Square size={11} /> Papel {settings.paperSize} · {settings.orientation === 'portrait' ? 'Vertical' : 'Horizontal'} · Usa las flechas para precisión</div>
        </div>
        <aside className="border-t border-slate-800 bg-[#0d1726] p-4 xl:border-l xl:border-t-0">
          {selected ? <div className="space-y-4" key={selected.id}>
            <div className="flex items-start justify-between gap-2"><div><p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">Elemento seleccionado</p><p className="mt-1 text-sm font-semibold text-white">{selected.label}</p></div><Badge className="border-slate-700 bg-slate-800 text-[10px] text-slate-300">{selected.type}</Badge></div>
            <div className="grid grid-cols-2 gap-2"><div><Label className="text-[10px] text-slate-400">X</Label><Input type="number" value={selected.x} onChange={event => selectedPatch({ x: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div><div><Label className="text-[10px] text-slate-400">Y</Label><Input type="number" value={selected.y} onChange={event => selectedPatch({ y: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div><div><Label className="text-[10px] text-slate-400">Ancho</Label><Input type="number" value={selected.width} onChange={event => selectedPatch({ width: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div><div><Label className="text-[10px] text-slate-400">Alto</Label><Input type="number" value={selected.height} onChange={event => selectedPatch({ height: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div></div>
            {selected.type === 'field' && <div><Label className="text-[10px] text-slate-400">Campo de datos</Label><select value={selected.token || ''} onChange={event => selectedPatch({ token: event.target.value, label: TEMPLATE_TOKENS.find(item => item.token === event.target.value)?.label || selected.label })} className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white"><option value="">Selecciona un campo</option>{TEMPLATE_TOKENS.map(item => <option key={item.token} value={item.token}>{item.label}</option>)}</select><p className="mt-1 text-[10px] text-slate-500">Vista previa: {getTemplateTokenSample(selected.token)}</p></div>}
            {(selected.type === 'text' || selected.type === 'section') && <div><Label className="text-[10px] text-slate-400">Contenido</Label><Input value={selected.text || ''} onChange={event => selectedPatch({ text: event.target.value })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div>}
            <div className="grid grid-cols-2 gap-2"><div><Label className="text-[10px] text-slate-400">Tamaño</Label><Input type="number" min={5} max={72} value={selected.fontSize || 9} onChange={event => selectedPatch({ fontSize: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div><div><Label className="text-[10px] text-slate-400">Radio</Label><Input type="number" min={0} max={24} value={selected.borderRadius || 0} onChange={event => selectedPatch({ borderRadius: Number(event.target.value) })} className="mt-1 h-8 border-slate-700 bg-slate-900 text-xs text-white" /></div></div>
            <div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8 text-slate-400', selected.align === 'left' && 'bg-slate-700 text-white')} aria-label="Alinear a la izquierda" onClick={() => selectedPatch({ align: 'left' })}><AlignLeft size={14} /></Button><Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8 text-slate-400', selected.align === 'center' && 'bg-slate-700 text-white')} aria-label="Centrar" onClick={() => selectedPatch({ align: 'center' })}><AlignCenter size={14} /></Button><Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8 text-slate-400', selected.align === 'right' && 'bg-slate-700 text-white')} aria-label="Alinear a la derecha" onClick={() => selectedPatch({ align: 'right' })}><AlignRight size={14} /></Button><Button type="button" variant="ghost" size="icon" className={cn('ml-1 h-8 w-8 text-slate-400', selected.bold && 'bg-slate-700 text-white')} aria-label="Negrita" onClick={() => selectedPatch({ bold: !selected.bold })}><strong>B</strong></Button></div>
            <div className="grid grid-cols-2 gap-2"><div><Label className="text-[10px] text-slate-400">Color</Label><Input type="color" value={selected.color || '#334155'} onChange={event => selectedPatch({ color: event.target.value })} className="mt-1 h-8 w-full cursor-pointer border-slate-700 bg-slate-900 p-1" /></div><div><Label className="text-[10px] text-slate-400">Fondo</Label><Input type="color" value={selected.backgroundColor && selected.backgroundColor !== 'transparent' ? selected.backgroundColor : '#ffffff'} onChange={event => selectedPatch({ backgroundColor: event.target.value })} className="mt-1 h-8 w-full cursor-pointer border-slate-700 bg-slate-900 p-1" /></div></div>
            <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-3"><Button type="button" variant="outline" size="sm" className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white" onClick={duplicateSelected}><Copy size={13} /> Duplicar</Button><Button type="button" variant="outline" size="sm" className="border-rose-900/60 bg-transparent text-rose-300 hover:bg-rose-950/60 hover:text-rose-200" onClick={removeSelected}><Trash2 size={13} /> Eliminar</Button></div>
          </div> : <div className="flex h-full min-h-[180px] flex-col items-center justify-center text-center"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-slate-500"><GripVertical size={20} /></div><p className="text-sm font-medium text-slate-300">Selecciona un elemento</p><p className="mt-1 max-w-[180px] text-[11px] leading-relaxed text-slate-500">Cada bloque es independiente. Puedes moverlo, cambiar su tamaño y conectar campos reales.</p></div>}
        </aside>
      </div>
    </div>
  );
}
