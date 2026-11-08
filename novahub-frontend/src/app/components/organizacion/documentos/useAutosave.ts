import { useCallback, useEffect, useRef, useState } from 'react';
import { asVersionConflict, blobToBase64, orgDocumentsService, type OrgDocumentDetail, type VersionConflict } from '../../../services/org-documents.service';
import { errorMessage } from '../organizacion.utils';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict' | 'readonly';
export interface BuiltFile { blob: Blob; searchText: string }

const DEBOUNCE_MS = 2500;

/**
 * Guardado automático con control de versiones: cada guardado parte de la versión que se abrió. Si alguien guardó
 * antes, el servidor responde 409 y se queda en estado «conflict» hasta que la persona elija qué hacer.
 */
export function useAutosave({ doc, build, readOnly, onSaved }: {
  doc: OrgDocumentDetail;
  /** Genera el archivo (.docx/.xlsx) a partir del contenido actual del editor. */
  build: () => Promise<BuiltFile>;
  readOnly: boolean;
  onSaved: (detail: OrgDocumentDetail) => void;
}) {
  const [state, setState] = useState<SaveState>(readOnly ? 'readonly' : 'saved');
  const [conflict, setConflict] = useState<VersionConflict | null>(null);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const version = useRef(doc.version);
  const dirty = useRef(false);
  const saving = useRef(false);
  const again = useRef(false);
  const timer = useRef<number | null>(null);
  const buildRef = useRef(build);
  const onSavedRef = useRef(onSaved);
  const blocked = useRef(false);
  useEffect(() => { buildRef.current = build; onSavedRef.current = onSaved; });

  const run = useCallback(async (overwrite = false) => {
    if (readOnly || (blocked.current && !overwrite)) return false;
    if (saving.current) { again.current = true; return false; }
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    saving.current = true; dirty.current = false; setState('saving'); setError('');
    try {
      const { blob, searchText } = await buildRef.current();
      const saved = await orgDocumentsService.saveContent(doc.id, { baseVersion: version.current, contentBase64: await blobToBase64(blob), searchText, overwrite: overwrite || undefined });
      version.current = saved.version; blocked.current = false; setConflict(null);
      setSavedAt(new Date()); onSavedRef.current(saved);
      setState(dirty.current ? 'dirty' : 'saved');
      return true;
    } catch (e) {
      dirty.current = true;
      const info = asVersionConflict(e);
      if (info) { blocked.current = true; setConflict(info); setState('conflict'); } else { setError(errorMessage(e, 'No se pudo guardar')); setState('error'); }
      return false;
    } finally {
      saving.current = false;
      if (again.current) { again.current = false; if (dirty.current && !blocked.current) void run(); }
    }
  }, [doc.id, readOnly]);

  const schedule = useCallback(() => {
    if (readOnly) return;
    dirty.current = true;
    if (!blocked.current && !saving.current) setState('dirty');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { timer.current = null; void run(); }, DEBOUNCE_MS);
  }, [readOnly, run]);

  // Avisa antes de cerrar la pestaña con cambios sin guardar.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty.current || saving.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  return {
    state, conflict, error, savedAt,
    /** Llamar en cada cambio del contenido. */
    markDirty: schedule,
    /** Guarda ya (por ejemplo, antes de cerrar). Devuelve si quedó guardado. */
    saveNow: useCallback(async () => (dirty.current || state === 'error' ? run() : true), [run, state]),
    /** Guarda encima de la versión de la otra persona. */
    overwrite: useCallback(() => run(true), [run]),
    hasPending: () => dirty.current || saving.current,
  };
}
