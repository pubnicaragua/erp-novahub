/** Plantillas para empezar un documento u hoja de cálculo sin partir de cero. */
import type { JSONContent } from '@tiptap/react';
import type { CellFormat, SheetCell, SheetData, WorkbookData } from './xlsx-convert';
import { emptySheet } from './xlsx-convert';
import { cellKey } from './sheet-formula';

export interface DocTemplate { id: string; title: string; description: string; build: () => JSONContent }
export interface SheetTemplate { id: string; title: string; description: string; build: () => WorkbookData }

// ───────────── Documentos ─────────────
const text = (value: string, bold = false): JSONContent => ({ type: 'text', text: value, ...(bold ? { marks: [{ type: 'bold' }] } : {}) });
const p = (value = '', opts: { bold?: boolean; align?: 'left' | 'center' | 'right' | 'justify' } = {}): JSONContent => ({
  type: 'paragraph', ...(opts.align ? { attrs: { textAlign: opts.align } } : {}), ...(value ? { content: [text(value, opts.bold)] } : {}),
});
const h = (level: 1 | 2 | 3, value: string, align?: 'center'): JSONContent => ({ type: 'heading', attrs: { level, ...(align ? { textAlign: align } : {}) }, content: [text(value)] });
const bullets = (items: string[]): JSONContent => ({ type: 'bulletList', content: items.map((item) => ({ type: 'listItem', content: [p(item)] })) });
const numbered = (items: string[]): JSONContent => ({ type: 'orderedList', content: items.map((item) => ({ type: 'listItem', content: [p(item)] })) });
const grid = (rows: string[][]): JSONContent => ({
  type: 'table',
  content: rows.map((row, i) => ({
    type: 'tableRow',
    content: row.map((cell) => ({ type: i === 0 ? 'tableHeader' : 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [p(cell)] })),
  })),
});
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content });

export const DOC_TEMPLATES: DocTemplate[] = [
  { id: 'blank', title: 'En blanco', description: 'Un documento vacío.', build: () => doc(p()) },
  {
    id: 'letter', title: 'Carta formal', description: 'Membrete, destinatario, asunto y despedida.',
    build: () => doc(
      p('[Nombre de la empresa]', { bold: true, align: 'right' }), p('[Dirección · Teléfono · Correo]', { align: 'right' }), p(),
      p('[Ciudad], [día] de [mes] de [año]'), p(),
      p('[Nombre del destinatario]', { bold: true }), p('[Cargo]'), p('[Empresa]'), p(),
      p('Asunto: [asunto de la carta]', { bold: true }), p(),
      p('Estimado/a [nombre]:'), p(),
      p('[Primer párrafo: presenta el motivo de la carta de forma clara y directa.]', { align: 'justify' }),
      p('[Segundo párrafo: detalla la información, la solicitud o el acuerdo.]', { align: 'justify' }),
      p('[Cierre: indica los próximos pasos y cómo puede contactarte.]', { align: 'justify' }), p(),
      p('Atentamente,'), p(), p(), p('[Nombre y firma]', { bold: true }), p('[Cargo]'),
    ),
  },
  {
    id: 'contract', title: 'Contrato de servicios', description: 'Partes, objeto, plazo, pago y firmas.',
    build: () => doc(
      h(1, 'CONTRATO DE PRESTACIÓN DE SERVICIOS', 'center'),
      p('Entre [Nombre del contratante], con identificación [número], en adelante «EL CONTRATANTE», y [Nombre del prestador], con identificación [número], en adelante «EL PRESTADOR», se acuerda el siguiente contrato:', { align: 'justify' }),
      h(2, 'Primera. Objeto'), p('EL PRESTADOR se obliga a realizar los siguientes servicios: [descripción de los servicios].', { align: 'justify' }),
      h(2, 'Segunda. Plazo'), p('El contrato rige desde el [fecha de inicio] hasta el [fecha de fin], salvo prórroga por escrito.', { align: 'justify' }),
      h(2, 'Tercera. Precio y forma de pago'), p('EL CONTRATANTE pagará la suma de [monto] mediante [forma de pago], dentro de [plazo] días tras recibir la factura.', { align: 'justify' }),
      h(2, 'Cuarta. Obligaciones de las partes'), bullets(['EL PRESTADOR entregará los servicios con la calidad y en los plazos acordados.', 'EL CONTRATANTE proporcionará la información y los accesos necesarios.', 'Ambas partes guardarán confidencialidad sobre la información compartida.']),
      h(2, 'Quinta. Terminación'), p('Cualquiera de las partes puede terminar el contrato con aviso escrito de [número] días.', { align: 'justify' }),
      p('Firmado en [ciudad], el [fecha].'), p(), p(),
      grid([['EL CONTRATANTE', 'EL PRESTADOR'], ['Firma:', 'Firma:'], ['Nombre:', 'Nombre:']]),
    ),
  },
  {
    id: 'minutes', title: 'Acta de reunión', description: 'Asistentes, temas, acuerdos y responsables.',
    build: () => doc(
      h(1, 'Acta de reunión'),
      grid([['Fecha', 'Hora', 'Lugar'], ['[fecha]', '[hora]', '[lugar o enlace]']]),
      h(2, 'Asistentes'), bullets(['[Nombre y cargo]', '[Nombre y cargo]']),
      h(2, 'Agenda'), numbered(['[Tema 1]', '[Tema 2]', '[Tema 3]']),
      h(2, 'Desarrollo'), p('[Resumen de lo conversado en cada tema.]'),
      h(2, 'Acuerdos y tareas'), grid([['Acuerdo', 'Responsable', 'Fecha límite'], ['[acuerdo]', '[nombre]', '[fecha]'], ['', '', '']]),
      h(2, 'Próxima reunión'), p('[Fecha, hora y temas pendientes.]'),
    ),
  },
  {
    id: 'quote', title: 'Cotización', description: 'Datos del cliente, tabla de ítems y condiciones.',
    build: () => doc(
      h(1, 'COTIZACIÓN'), p('[Nombre de la empresa] · [Teléfono] · [Correo]'), p('Cotización N.º [número] · Fecha: [fecha] · Válida por [30] días'), p(),
      p('Cliente: [nombre del cliente]', { bold: true }), p('Atención: [contacto]'), p(),
      grid([['Descripción', 'Cantidad', 'Precio unitario', 'Total'], ['[producto o servicio]', '1', '0.00', '0.00'], ['', '', '', ''], ['', '', '', ''], ['', '', 'Total', '0.00']]),
      p(), h(3, 'Condiciones'), bullets(['Forma de pago: [contado / crédito a X días].', 'Tiempo de entrega: [plazo].', 'Los precios no incluyen impuestos, salvo que se indique.']), p(), p('Quedamos atentos a su respuesta.'),
    ),
  },
];

// ───────────── Hojas de cálculo ─────────────
const HEAD: CellFormat = { b: true, bg: '#01422c', fg: '#ffffff', al: 'center' };
type Spec = string | [string, CellFormat];

function makeSheet(name: string, rows: Spec[][], widths: Record<number, number>, extra: Partial<SheetData> = {}): SheetData {
  const sheet = emptySheet(name);
  const cells: Record<string, SheetCell> = {};
  rows.forEach((row, r) => row.forEach((spec, c) => {
    const [v, f] = typeof spec === 'string' ? [spec, undefined] : spec;
    if (v !== '' || f) cells[cellKey(c, r)] = f ? { v, f } : { v };
  }));
  return { ...sheet, cells, colWidths: widths, ...extra };
}
const money: CellFormat = { nf: 'currency' };
const pct: CellFormat = { nf: 'percent' };
const title = (value: string): Spec => [value, { b: true }];

export const SHEET_TEMPLATES: SheetTemplate[] = [
  { id: 'blank', title: 'En blanco', description: 'Una hoja vacía.', build: () => ({ sheets: [emptySheet()] }) },
  {
    id: 'budget', title: 'Presupuesto mensual', description: 'Presupuestado contra real, con diferencia y ejecución.',
    build: () => {
      const concepts = ['Ventas', 'Servicios', 'Alquiler', 'Salarios', 'Servicios básicos', 'Marketing', 'Transporte', 'Otros'];
      const rows: Spec[][] = [[title('Presupuesto mensual')], [], [['Concepto', HEAD], ['Presupuestado', HEAD], ['Real', HEAD], ['Diferencia', HEAD], ['% de ejecución', HEAD]]];
      concepts.forEach((concept, i) => {
        const r = i + 4;
        rows.push([concept, ['0', money], ['0', money], [`=C${r}-B${r}`, money], [`=SI(B${r}=0;0;C${r}/B${r})`, pct]]);
      });
      rows.push([['Total', { b: true }], [`=SUMA(B4:B${concepts.length + 3})`, { ...money, b: true }], [`=SUMA(C4:C${concepts.length + 3})`, { ...money, b: true }], [`=SUMA(D4:D${concepts.length + 3})`, { ...money, b: true }], [`=SI(B${concepts.length + 4}=0;0;C${concepts.length + 4}/B${concepts.length + 4})`, { ...pct, b: true }]]);
      return { sheets: [makeSheet('Presupuesto', rows, { 0: 180, 1: 130, 2: 130, 3: 130, 4: 130 }, { freezeRow: false })] };
    },
  },
  {
    id: 'cashflow', title: 'Flujo de caja', description: 'Ingresos, egresos y saldo mes a mes.',
    build: () => {
      const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const rows: Spec[][] = [[title('Flujo de caja')], [], [['Mes', HEAD], ['Saldo inicial', HEAD], ['Ingresos', HEAD], ['Egresos', HEAD], ['Saldo final', HEAD]]];
      months.forEach((month, i) => {
        const r = i + 4;
        rows.push([month, i === 0 ? ['0', money] : [`=E${r - 1}`, money], ['0', money], ['0', money], [`=B${r}+C${r}-D${r}`, { ...money, b: true }]]);
      });
      rows.push([['Total del año', { b: true }], '', [`=SUMA(C4:C15)`, { ...money, b: true }], [`=SUMA(D4:D15)`, { ...money, b: true }], ['=E15', { ...money, b: true }]]);
      return { sheets: [makeSheet('Flujo de caja', rows, { 0: 140, 1: 130, 2: 130, 3: 130, 4: 130 })] };
    },
  },
  {
    id: 'inventory', title: 'Control de inventario', description: 'Existencias, valor total y alerta de reposición.',
    build: () => {
      const rows: Spec[][] = [
        [title('Control de inventario')],
        [['Valor total del inventario', { b: true }], '', '', '', '', ['=SUMA(F5:F24)', { ...money, b: true }]],
        [],
        [['Código', HEAD], ['Producto', HEAD], ['Categoría', HEAD], ['Cantidad', HEAD], ['Costo unitario', HEAD], ['Valor total', HEAD], ['Mínimo', HEAD], ['Estado', HEAD]],
      ];
      for (let r = 5; r <= 24; r++) rows.push(['', '', '', '', ['', money], [`=SI(B${r}="";"";D${r}*E${r})`, money], '', [`=SI(B${r}="";"";SI(D${r}<=G${r};"Reponer";"OK"))`, { al: 'center' }]]);
      return { sheets: [makeSheet('Inventario', rows, { 0: 90, 1: 200, 2: 130, 3: 90, 4: 120, 5: 130, 6: 90, 7: 100 }, { freezeRow: false })] };
    },
  },
];

/** Texto plano de un documento (para que la búsqueda por contenido funcione desde el primer momento). */
export function docText(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? '';
  return (node.content ?? []).map(docText).join(' ').replace(/\s+/g, ' ').trim();
}
