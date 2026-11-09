import { useMemo, useState } from 'react';
import { ClipboardPaste, Plus } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { EditableDataTable, type ColumnDef } from '../../ui/EditableDataTable';
import { toast } from '../../../services/toast';
import { SOURCE_LABEL, STAGES, businessLeadsService, formatMoney, type LeadInput, type LeadRow, type LeadSource, type LeadStage } from '../../../services/business-leads.service';
import { failure, parsePastedLeads } from './leadUtils';

const CURRENCIES = ['USD', 'NIO', 'EUR'];
const fieldClass = 'h-9 rounded-lg border border-border/60 bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary';

interface TableRow extends Omit<LeadRow, 'nextActionAt'> { nextActionAt: string }

interface Props {
  items: LeadRow[];
  canCreate: boolean;
  canEdit: boolean;
  countries: string[];
  businessLines: string[];
  onStageChange: (lead: LeadRow, stage: LeadStage) => Promise<void>;
  onOpen: (id: string) => void;
  onChanged: () => void;
}

/** Pegar desde Excel o Google Sheets: se leen las filas, se muestra cuántas entran y se cargan todas de una vez. */
function PasteDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Array<{ row: number; message: string }>>([]);
  const parsed = useMemo(() => parsePastedLeads(text), [text]);
  const submit = async () => {
    setBusy(true);
    try {
      const result = await businessLeadsService.bulkCreate(parsed.leads);
      if (result.created) toast.success(`${result.created} lead${result.created === 1 ? '' : 's'} cargado${result.created === 1 ? '' : 's'}`);
      setErrors(result.errors);
      onDone();
      if (result.errors.length === 0) onClose();
    } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="nh-module-title">Pegar leads desde Excel</DialogTitle>
          <DialogDescription>Copia las filas de tu hoja y pégalas aquí. Si la primera fila trae encabezados (Empresa, Contacto, Teléfono, Correo, País, Línea, Valor, Origen…) se usan; si no, se asume ese orden.</DialogDescription>
        </DialogHeader>
        <textarea aria-label="Filas pegadas" className="h-52 w-full rounded-xl border border-border/60 bg-background p-3 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary" value={text} onChange={(e) => { setText(e.target.value); setErrors([]); }} placeholder={'Empresa\tContacto\tTeléfono\tPaís\tLínea\tValor\nStarcell\tLuis Solís\t8888-0000\tNicaragua\tPáginas web\t$1,200'} />
        <p className="text-xs text-muted-foreground" role="status">{parsed.leads.length ? `${parsed.leads.length} lead${parsed.leads.length === 1 ? '' : 's'} listo${parsed.leads.length === 1 ? '' : 's'} para cargar${parsed.skipped ? ` · ${parsed.skipped} fila${parsed.skipped === 1 ? '' : 's'} sin empresa se omiten` : ''}.` : 'Aún no hay filas válidas.'}</p>
        {errors.length > 0 && <ul className="max-h-28 overflow-y-auto rounded-lg bg-destructive/5 p-2 text-xs text-destructive">{errors.map((error) => <li key={error.row}>Fila {error.row}: {error.message}</li>)}</ul>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cerrar</Button><Button type="button" onClick={() => void submit()} disabled={busy || parsed.leads.length === 0}>Cargar {parsed.leads.length || ''} lead{parsed.leads.length === 1 ? '' : 's'}</Button></div>
      </DialogContent>
    </Dialog>
  );
}

/** Los leads como hoja de cálculo: se edita cada celda con un clic, se agregan filas al vuelo y se pega desde Excel. */
export function LeadsTable({ items, canCreate, canEdit, countries, businessLines, onStageChange, onOpen, onChanged }: Props) {
  const [draft, setDraft] = useState({ company: '', country: '', businessLine: '', value: '', currency: 'USD' });
  const [adding, setAdding] = useState(false);
  const [pasting, setPasting] = useState(false);
  const rows = useMemo<TableRow[]>(() => items.map((lead) => ({ ...lead, nextActionAt: lead.nextActionAt ? lead.nextActionAt.slice(0, 10) : '' })), [items]);

  const addRow = async () => {
    const company = draft.company.trim();
    if (!company) return;
    setAdding(true);
    try {
      const value = draft.value.trim() ? Number(draft.value.replace(/,/g, '')) : null;
      const input: LeadInput = { company, country: draft.country.trim() || null, businessLine: draft.businessLine.trim() || null, currency: draft.currency, estimatedValue: value !== null && Number.isFinite(value) ? value : null };
      await businessLeadsService.create(input);
      // Se conservan país, línea y moneda para registrar varios seguidos sin repetirlos.
      setDraft((current) => ({ ...current, company: '', value: '' }));
      onChanged();
    } catch (error) { toast.error(failure(error)); } finally { setAdding(false); }
  };

  const update = async (id: string | number, updates: Partial<TableRow>) => {
    const lead = items.find((item) => item.id === id);
    if (!lead) return;
    const { stage, ...rest } = updates;
    try {
      if (stage && stage !== lead.stage) await onStageChange(lead, stage as LeadStage);
      const changes: LeadInput = {};
      for (const [key, value] of Object.entries(rest)) {
        if (key === 'estimatedValue') changes.estimatedValue = value === '' || value === null ? null : Number(value);
        else if (key === 'probability') changes.probability = Number(value);
        else if (key === 'nextActionAt') changes.nextActionAt = value ? String(value) : null;
        else (changes as Record<string, unknown>)[key] = value === '' ? null : value;
      }
      if (Object.keys(changes).length) await businessLeadsService.update(lead.id, changes);
      onChanged();
    } catch (error) { toast.error(failure(error)); throw error; }
  };

  const columns: ColumnDef<TableRow>[] = [
    { key: 'company', header: 'Empresa', editable: canEdit, type: 'text', width: '190px' },
    { key: 'contactName', header: 'Contacto', editable: canEdit, type: 'text', width: '150px' },
    { key: 'phone', header: 'Teléfono', editable: canEdit, type: 'text', width: '120px' },
    { key: 'country', header: 'País', editable: canEdit, type: 'text', width: '120px' },
    { key: 'businessLine', header: 'Línea', editable: canEdit, type: 'text', width: '130px' },
    { key: 'stage', header: 'Etapa', editable: canEdit, type: 'select', width: '130px', options: STAGES.map((stage) => ({ label: stage.label, value: stage.id })) },
    { key: 'estimatedValue', header: 'Podría representar', editable: canEdit, type: 'number', width: '140px', render: (value, row) => (value === null || value === undefined || value === '' ? '—' : formatMoney(Number(value), row.currency)) },
    { key: 'currency', header: 'Moneda', editable: canEdit, type: 'select', width: '90px', options: CURRENCIES.map((code) => ({ label: code, value: code })) },
    { key: 'probability', header: 'Prob. %', editable: canEdit, type: 'number', width: '80px' },
    { key: 'source', header: 'Origen', editable: canEdit, type: 'select', width: '130px', options: (Object.keys(SOURCE_LABEL) as LeadSource[]).map((key) => ({ label: SOURCE_LABEL[key], value: key })) },
    { key: 'nextAction', header: 'Siguiente paso', editable: canEdit, type: 'text', width: '170px' },
    { key: 'nextActionAt', header: 'Cuándo', editable: canEdit, type: 'date', width: '120px' },
    { key: 'website', header: 'Sitio o red social', editable: canEdit, type: 'text', width: '160px' },
  ];

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Haz clic en cualquier celda para editarla; se guarda sola. Para varios a la vez, pega desde Excel.</p>
        {canCreate && <Button type="button" variant="outline" size="sm" onClick={() => setPasting(true)}><ClipboardPaste className="mr-1.5 size-4" />Pegar desde Excel</Button>}
      </div>

      {canCreate && (
        <form className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border bg-muted/20 p-2.5" onSubmit={(event) => { event.preventDefault(); void addRow(); }} aria-label="Agregar una fila nueva">
          <div className="min-w-[200px] flex-1"><label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground" htmlFor="lt-company">Empresa o prospecto</label><Input id="lt-company" value={draft.company} maxLength={160} onChange={(e) => setDraft({ ...draft, company: e.target.value })} placeholder="Escribe y presiona Enter" /></div>
          <div><label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground" htmlFor="lt-country">País</label><input id="lt-country" list="lt-countries" className={`${fieldClass} w-36`} value={draft.country} maxLength={80} onChange={(e) => setDraft({ ...draft, country: e.target.value })} /><datalist id="lt-countries">{countries.map((name) => <option key={name} value={name} />)}</datalist></div>
          <div><label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground" htmlFor="lt-line">Línea</label><input id="lt-line" list="lt-lines" className={`${fieldClass} w-36`} value={draft.businessLine} maxLength={80} onChange={(e) => setDraft({ ...draft, businessLine: e.target.value })} /><datalist id="lt-lines">{businessLines.map((name) => <option key={name} value={name} />)}</datalist></div>
          <div><label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground" htmlFor="lt-value">Valor</label><div className="flex gap-1"><input id="lt-value" inputMode="decimal" className={`${fieldClass} w-28`} value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} /><select aria-label="Moneda" className={fieldClass} value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })}>{CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}</select></div></div>
          <Button type="submit" disabled={adding || !draft.company.trim()}><Plus className="mr-1.5 size-4" />Agregar fila</Button>
        </form>
      )}

      {rows.length === 0
        ? <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Aún no hay leads. Escribe el primero arriba o pega varios desde Excel.</p>
        : <EditableDataTable<TableRow> data={rows} columns={columns} idField="id" onRowUpdate={update} canEdit={canEdit} layoutMode="table" actions={(row) => <Button type="button" variant="ghost" size="sm" onClick={() => onOpen(row.id)}>Abrir</Button>} />}
      {pasting && <PasteDialog onClose={() => setPasting(false)} onDone={onChanged} />}
    </div>
  );
}
