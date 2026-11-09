import { useEffect, useState } from 'react';
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { cn } from '../../ui/utils';
import type { OrgDocKind } from '../../../services/org-documents.service';
import { Field, controlClass } from '../OrgBits';
import { DOC_TEMPLATES, SHEET_TEMPLATES } from './doc-templates';

/** Nombre y plantilla para un documento u hoja nueva. */
export function NewDocumentDialog({ kind, busy, onClose, onCreate }: { kind: OrgDocKind; busy: boolean; onClose: () => void; onCreate: (title: string, templateId: string) => void }) {
  const templates = kind === 'DOC' ? DOC_TEMPLATES : SHEET_TEMPLATES;
  const [templateId, setTemplateId] = useState('blank');
  const [title, setTitle] = useState('');
  const Icon = kind === 'DOC' ? FileText : FileSpreadsheet;
  const label = kind === 'DOC' ? 'Nuevo documento' : 'Nueva hoja de cálculo';
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);
  const name = title.trim() || (templateId === 'blank' ? '' : templates.find((t) => t.id === templateId)?.title ?? '');
  return (
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && onClose()}>
      <form className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-border bg-background p-5 shadow-xl" onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => { event.preventDefault(); if (name && !busy) onCreate(name.slice(0, 160), templateId); }}>
        <div>
          <p className="text-base font-semibold">{label}</p>
          <p className="text-[12px] text-muted-foreground">Elige una plantilla para empezar más rápido. Podrás cambiar el nombre y con quién lo compartes cuando quieras.</p>
        </div>
        <Field label="Nombre" htmlFor="new-doc-title">
          <input id="new-doc-title" autoFocus value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} className={controlClass}
            placeholder={templateId === 'blank' ? (kind === 'DOC' ? 'Plan comercial 2027' : 'Presupuesto mensual') : templates.find((t) => t.id === templateId)?.title} />
        </Field>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-[12px] font-semibold">Plantilla</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {templates.map((template) => (
              <button key={template.id} type="button" aria-pressed={templateId === template.id} onClick={() => setTemplateId(template.id)}
                className={cn('flex min-w-0 items-start gap-2 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', templateId === template.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50')}>
                <Icon className="mt-0.5 size-4 shrink-0 text-primary dark:text-accent" aria-hidden="true" />
                <span className="min-w-0"><span className="block text-[13px] font-semibold">{template.title}</span><span className="block text-[11px] text-muted-foreground">{template.description}</span></span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={busy || !name}>{busy && <Loader2 className="size-4 animate-spin" />}Crear</Button>
        </div>
      </form>
    </div>
  );
}
