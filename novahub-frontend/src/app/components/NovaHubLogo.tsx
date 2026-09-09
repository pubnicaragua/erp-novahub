
import isotipo from '../../assets/branding/novahub-isotipo.png';

interface NovaHubLogoProps {
  size?: number;
  className?: string;
}

/**
 * NovaHub official standalone isotipo.
 * The source image is the approved 3D green mark from contenido-landing.
 */
export function NovaHubLogo({ size = 48, className = '' }: NovaHubLogoProps) {
  return <img src={isotipo} width={size} height={size} alt="NovaHub" className={`object-contain ${className}`} draggable={false} />;
}

/**
 * Full horizontal lockup: icon + wordmark
 */
export function NovaHubLogoFull({ size = 40, className = '' }: NovaHubLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <NovaHubLogo size={size} />
      <div className="flex flex-col leading-none">
        <span className="font-black text-xl tracking-tight text-foreground">Nova<span className="text-emerald-500">Hub</span></span>
        <span className="text-[10px] text-muted-foreground tracking-widest uppercase font-medium">ERP Platform</span>
      </div>
    </div>
  );
}
