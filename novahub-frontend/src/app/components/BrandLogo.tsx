import { useEffect, useState } from 'react';
import { Building2, Store } from 'lucide-react';
import { storageService } from '../services/storage.service';
import { cn } from './ui/utils';
import { NovaHubLogo } from './NovaHubLogo';

export type BrandLogoKind = 'group' | 'branch' | 'platform';

interface BrandLogoProps {
  src?: string | null;
  alt: string;
  kind?: BrandLogoKind;
  className?: string;
  imageClassName?: string;
}

/**
 * Shared logo renderer for tenant/group surfaces.
 *
 * Older rows may still contain a storage:// URI while newer rows contain the
 * public URL returned by the tenant-branding bucket. Resolve both forms and
 * degrade to a meaningful icon when the object was removed or the URL fails.
 */
export function BrandLogo({
  src,
  alt,
  kind = 'group',
  className,
  imageClassName,
}: BrandLogoProps) {
  const [storageResolution, setStorageResolution] = useState<{ source: string; url: string } | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!src?.startsWith('storage://')) return () => { cancelled = true; };

    storageService.resolveUrl(src)
      .then((url) => {
        if (!cancelled) setStorageResolution({ source: src, url });
      })
      .catch(() => {
        if (!cancelled) setFailedSource(src);
      });

    return () => { cancelled = true; };
  }, [src]);

  const resolvedSrc = src?.startsWith('storage://')
    ? storageResolution?.source === src ? storageResolution.url : ''
    : src || '';
  const showImage = Boolean(resolvedSrc) && failedSource !== src;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10',
        className,
      )}
      title={alt}
      aria-label={alt}
    >
      {showImage ? (
        <img
          src={resolvedSrc}
          alt={alt}
          className={cn('size-full object-contain', imageClassName)}
          onError={() => setFailedSource(src || resolvedSrc)}
        />
      ) : kind === 'platform' ? (
        <NovaHubLogo size={36} />
      ) : kind === 'branch' ? (
        <Store className="size-[42%]" aria-hidden="true" />
      ) : (
        <Building2 className="size-[42%]" aria-hidden="true" />
      )}
    </div>
  );
}

export function BrandLogoLoader({
  logo,
  title,
  description = 'Preparando tu espacio de trabajo…',
  kind = 'group',
}: {
  logo?: string | null;
  title: string;
  description?: string;
  kind?: BrandLogoKind;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.16),transparent_52%)]" />
      <div className="relative flex w-full max-w-sm flex-col items-center text-center">
        <BrandLogo
          src={logo}
          alt={title}
          kind={kind}
          className="size-28 rounded-[2rem] border border-primary/20 bg-card/80 p-3 shadow-2xl shadow-primary/10"
          imageClassName="rounded-[1.35rem]"
        />
        <div className="mt-6 flex items-center gap-2">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          <span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
          <span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
        </div>
        <p className="mt-4 text-lg font-black tracking-tight">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
