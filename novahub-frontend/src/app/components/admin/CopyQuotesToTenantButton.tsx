import { useState } from 'react';
import { Copy, Loader2, Search } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { tenantFeaturesService } from '../../services/tenant-features.service';
import { tenantQuotesService } from '../../services/tenant-quotes.service';
import { cn } from '../ui/utils';

/**
 * SuperAdmin: copia cotizaciones de plataforma a una empresa. Las originales no se modifican y la empresa recibe
 * copias propias (con su numeración). Requiere que la empresa tenga habilitada «Cotizaciones avanzadas».
 */
export function CopyQuotesToTenantButton() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [busy, setBusy] = useState(false);
  const candidates = useTenantQuery(['admin', 'quote-copy-targets', search], (signal) => tenantFeaturesService.searchBranches('ADVANCED_QUOTES', search, signal), { enabled: open, staleTime: 30_000 });

  const copy = async () => {
    if (!tenantId) return;
    setBusy(true);
    try {
      const result = await tenantQuotesService.copyFromPlatform({ targetTenantId: tenantId, all: true });
      const parts = [`${result.copied} copiada(s) a ${result.tenant}`];
      if (result.skippedAlreadyCopied.length) parts.push(`${result.skippedAlreadyCopied.length} ya estaban copiadas`);
      if (result.failed.length) parts.push(`${result.failed.length} con error`);
      (result.failed.length ? toast.error : toast.success)(parts.join(' · ') + '.');
      if (!result.failed.length) setOpen(false);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudieron copiar las cotizaciones.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" className="h-11 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => setOpen(true)}><Copy className="mr-2 size-4" /> Copiar a una empresa</Button>
      <Dialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Copiar cotizaciones a una empresa</DialogTitle>
            <DialogDescription>Se copian todas las cotizaciones de plataforma como cotizaciones propias de la empresa elegida. Las tuyas no se modifican ni se eliminan, y las ya copiadas no se repiten.</DialogDescription>
          </DialogHeader>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empresa…" aria-label="Buscar empresa" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" /></div>
          <ul className="max-h-64 space-y-1.5 overflow-auto" role="listbox" aria-label="Empresas">
            {candidates.isLoading && <li className="p-3 text-sm text-muted-foreground">Buscando…</li>}
            {candidates.data?.map((branch) => (
              <li key={branch.id}>
                <button type="button" role="option" aria-selected={tenantId === branch.id} onClick={() => setTenantId(branch.id)}
                  className={cn('w-full rounded-xl border p-2.5 text-left text-sm transition-colors', tenantId === branch.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40')}>
                  <span className="font-bold">{branch.name}</span><span className="ml-2 text-xs text-muted-foreground">{branch.slug}</span>
                </button>
              </li>
            ))}
            {candidates.data && candidates.data.length === 0 && <li className="p-3 text-sm text-muted-foreground">No hay empresas con ese nombre.</li>}
          </ul>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" disabled={!tenantId || busy} onClick={() => void copy()}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Copiar cotizaciones</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
