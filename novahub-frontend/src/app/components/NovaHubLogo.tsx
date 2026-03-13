import React from 'react';

interface NovaHubLogoProps {
  size?: number;
  className?: string;
}

/**
 * NovaHub official logo — SVG icon
 * Colors: Black background · White strokes · Emerald green accent
 */
export function NovaHubLogo({ size = 48, className = '' }: NovaHubLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Rounded square background */}
      <rect width="100" height="100" rx="22" fill="#0A0A0A" />

      {/* Left vertical stem */}
      <rect x="22" y="20" width="12" height="60" rx="4" fill="white" />

      {/* Right vertical stem */}
      <rect x="66" y="20" width="12" height="60" rx="4" fill="white" />

      {/* Top diagonal — white */}
      <path
        d="M22 20 L78 20 L78 35 L34 35 Z"
        fill="white"
      />

      {/* Diagonal connector — emerald green accent */}
      <path
        d="M28 22 L72 58 L72 72 L28 36 Z"
        fill="#22C55E"
      />

      {/* Bottom right fill */}
      <path
        d="M66 65 L78 65 L78 80 L66 80 Z"
        fill="white"
        rx="2"
      />
    </svg>
  );
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
