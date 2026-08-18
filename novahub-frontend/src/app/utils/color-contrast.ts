const DARK_FOREGROUND = '#111827';
const LIGHT_FOREGROUND = '#ffffff';

function parseRgbChannel(value: string): number | null {
  const channel = Number(value.trim());
  if (!Number.isFinite(channel)) return null;
  return channel > 1 ? Math.min(255, Math.max(0, channel)) / 255 : Math.min(1, Math.max(0, channel));
}

function toLinearRgb(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/** Returns an approximate relative luminance for the CSS colors used by themes. */
export function relativeLuminance(color: string): number | null {
  const value = color.trim().toLowerCase();
  let channels: [number, number, number] | null = null;

  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const expanded = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex;
    channels = [
      parseInt(expanded.slice(0, 2), 16) / 255,
      parseInt(expanded.slice(2, 4), 16) / 255,
      parseInt(expanded.slice(4, 6), 16) / 255,
    ];
  }

  const rgb = value.match(/^rgba?\(([^)]+)\)$/)?.[1];
  if (!channels && rgb) {
    const parts = rgb.split(',').slice(0, 3).map(parseRgbChannel);
    if (parts.every((part): part is number => part !== null)) channels = parts as [number, number, number];
  }

  if (channels) {
    const [r, g, b] = channels.map(toLinearRgb);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // ThemeContext stores generated brand colors as OKLCH. L is perceptual, so
  // this approximation is only used to choose between black and white.
  const oklchLightness = value.match(/^oklch\(\s*([\d.]+)%?/i)?.[1];
  if (oklchLightness) {
    const lightness = Number(oklchLightness);
    if (Number.isFinite(lightness)) return (lightness > 1 ? lightness / 100 : lightness) ** 2.4;
  }

  return null;
}

export function getReadableForeground(background: string): string {
  const luminance = relativeLuminance(background);
  return luminance !== null && luminance > 0.179 ? DARK_FOREGROUND : LIGHT_FOREGROUND;
}

export function ensureReadableForeground(background: string, foreground?: string): string {
  if (!foreground) return getReadableForeground(background);

  const backgroundLuminance = relativeLuminance(background);
  const foregroundLuminance = relativeLuminance(foreground);
  if (backgroundLuminance === null || foregroundLuminance === null) return foreground;

  const lighter = Math.max(backgroundLuminance, foregroundLuminance);
  const darker = Math.min(backgroundLuminance, foregroundLuminance);
  return (lighter + 0.05) / (darker + 0.05) >= 4.5
    ? foreground
    : getReadableForeground(background);
}
