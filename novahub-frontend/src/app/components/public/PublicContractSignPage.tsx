import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileSignature, Loader2, Printer } from 'lucide-react';
import { employeeProfileService, type PublicContract } from '../../services/employee-profile.service';
import { printContract } from '../hr/employee/EmployeeContractPanel';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'short' }) : '');
const failure = (error: unknown) => (error as any)?.response?.data?.message?.toString?.() || (error as Error)?.message || 'No se pudo completar la acción.';

/** Cuadro para dibujar la firma con el dedo o el mouse. Devuelve una imagen PNG (data URL) o null si está vacío. */
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * event.currentTarget.width, y: ((event.clientY - rect.top) / rect.height) * event.currentTarget.height };
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const { x, y } = point(event);
    context.lineWidth = 3; context.lineCap = 'round'; context.strokeStyle = '#111';
    context.beginPath(); context.moveTo(x, y);
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    const { x, y } = point(event);
    context.lineTo(x, y); context.stroke();
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvas.current?.toDataURL('image/png') ?? null);
  };
  const clear = () => {
    const element = canvas.current;
    element?.getContext('2d')?.clearRect(0, 0, element.width, element.height);
    onChange(null);
  };

  return (
    <div>
      <canvas ref={canvas} width={600} height={180} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} aria-label="Cuadro para dibujar tu firma" className="w-full touch-none rounded-xl border border-dashed border-slate-400 bg-white" />
      <button type="button" onClick={clear} className="mt-1 text-xs font-semibold text-slate-600 underline">Borrar y empezar de nuevo</button>
    </div>
  );
}

/** Página pública (sin sesión): el empleado lee su contrato y lo firma con el enlace de un solo uso. */
export function PublicContractSignPage() {
  const token = decodeURIComponent(window.location.pathname.split('/').filter(Boolean).pop() || '');
  const [contract, setContract] = useState<PublicContract | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [accept, setAccept] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ signedAt: string; documentHash: string } | null>(null);

  useEffect(() => {
    let active = true;
    employeeProfileService.getPublicContract(token)
      .then((value) => { if (active) setContract(value); })
      .catch((reason) => { if (active) setError(failure(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const sign = async () => {
    setBusy(true);
    setError(null);
    try {
      setDone(await employeeProfileService.signPublicContract(token, { signerName: name.trim(), accept, signatureData: signature ?? undefined }));
    } catch (reason) { setError(failure(reason)); } finally { setBusy(false); }
  };

  const canSign = contract?.status === 'SENT' && !done;
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex items-center gap-3"><FileSignature className="size-7 text-emerald-700" aria-hidden /><div><h1 className="text-xl font-bold">{contract?.title ?? 'Contrato de trabajo'}</h1><p className="text-sm text-slate-600">Lee el contrato completo antes de firmar.</p></div></header>

        {loading && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" /> Cargando contrato…</p>}
        {!loading && !contract && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error ?? 'El enlace no es válido.'}</p>}

        {contract && (
          <>
            {contract.status === 'EXPIRED' && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Este enlace venció. Pide uno nuevo a Recursos Humanos.</p>}
            {contract.status === 'CANCELLED' && <p role="alert" className="rounded-xl border border-slate-300 bg-slate-100 p-4 text-sm">Este contrato fue cancelado por la empresa.</p>}
            {contract.status === 'DRAFT' && <p role="alert" className="rounded-xl border border-slate-300 bg-slate-100 p-4 text-sm">Este contrato todavía no está listo para firmar.</p>}
            {contract.body && <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><pre className="whitespace-pre-wrap break-words font-serif text-[14px] leading-relaxed">{contract.body}</pre></article>}

            {(contract.status === 'SIGNED' || done) && (
              <div className="space-y-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-5" role="status">
                <p className="flex items-center gap-2 font-bold text-emerald-900"><CheckCircle2 className="size-5" aria-hidden /> Contrato firmado</p>
                <p className="text-sm text-emerald-900">Firmó {contract.signerName ?? name.trim()} el {when(done?.signedAt ?? contract.signedAt)}.</p>
                <p className="break-all text-xs text-emerald-900/80">Huella del documento: {done?.documentHash ?? contract.documentHash}</p>
                <button type="button" onClick={() => printContract({ title: contract.title, body: contract.body, signerName: contract.signerName ?? name.trim(), signedAt: done?.signedAt ?? contract.signedAt, documentHash: done?.documentHash ?? contract.documentHash, companySignerName: contract.companySignerName, companySignedAt: contract.companySignedAt, signatureData: signature })} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700 px-3 py-1.5 text-sm font-semibold text-emerald-900"><Printer className="size-4" aria-hidden /> Imprimir o guardar copia</button>
              </div>
            )}

            {canSign && (
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="sign-title">
                <h2 id="sign-title" className="font-bold">Firmar</h2>
                <div className="space-y-1.5">
                  <label htmlFor="signer" className="text-sm font-semibold">Escribe tu nombre completo: {contract.employeeName}</label>
                  <input id="signer" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" />
                </div>
                <div className="space-y-1.5"><p className="text-sm font-semibold">Dibuja tu firma (opcional)</p><SignaturePad onChange={setSignature} /></div>
                <label className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-1" /> Leí el contrato completo y estoy de acuerdo con su contenido. Entiendo que mi nombre, la fecha, mi IP y una huella del texto quedan registrados como mi firma.</label>
                {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
                <button type="button" onClick={() => void sign()} disabled={busy || !accept || name.trim().length < 3} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy && <Loader2 className="size-4 animate-spin" aria-hidden />}Firmar contrato</button>
                <p className="text-xs text-slate-500">Este enlace es personal y de un solo uso{contract.expiresAt ? `; vence el ${when(contract.expiresAt)}` : ''}.</p>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
