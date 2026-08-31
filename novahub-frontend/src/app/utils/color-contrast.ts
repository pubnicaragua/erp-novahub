// Pure black gives the best available contrast against saturated light brand
// colors such as violet while the chooser still selects white for dark hues.
const DARK_FOREGROUND = '#000000';
const LIGHT_FOREGROUND = '#ffffff';
const WCAG_TEXT_CONTRAST = 4.5;

type Rgb = [number, number, number];

interface ParsedColor {
  rgb: Rgb;
  alpha: number;
}

export interface ContrastPair {
  name: string;
  foreground: string;
  background: string;
  minRatio?: number;
}

export interface ContrastIssue extends ContrastPair {
  ratio: number | null;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function parseAlpha(value: string | undefined): number {
  if (!value) return 1;
  const trimmed = value.trim();
  if (trimmed.endsWith('%')) return clamp(Number(trimmed.slice(0, -1)) / 100);
  return clamp(Number(trimmed));
}

function parseRgbChannel(value: string): number | null {
  const trimmed = value.trim();
  const number = Number(trimmed.endsWith('%') ? trimmed.slice(0, -1) : trimmed);
  if (!Number.isFinite(number)) return null;
  return trimmed.endsWith('%') ? clamp(number / 100) : clamp(number > 1 ? number / 255 : number);
}

function parseHue(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  const number = Number(trimmed.replace(/(deg|grad|rad|turn)$/, ''));
  if (!Number.isFinite(number)) return null;
  if (trimmed.endsWith('grad')) return (number * Math.PI) / 200;
  if (trimmed.endsWith('rad')) return number;
  if (trimmed.endsWith('turn')) return number * Math.PI * 2;
  return (number * Math.PI) / 180;
}

function parsePercentageOrFraction(value: string): number | null {
  const trimmed = value.trim();
  const number = Number(trimmed.endsWith('%') ? trimmed.slice(0, -1) : trimmed);
  if (!Number.isFinite(number)) return null;
  return clamp(trimmed.endsWith('%') ? number / 100 : number > 1 ? number / 100 : number);
}

function parseFunctionalParts(value: string, functionName: string): { channels: string[]; alpha?: string } | null {
  const match = value.match(new RegExp(`^${functionName}\\((.*)\\)$`, 'i'));
  if (!match) return null;
  const [channelText, alphaText] = match[1].split('/');
  const channels = channelText.replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean);
  return { channels, alpha: alphaText?.trim() };
}

function oklabToRgb(lightness: number, a: number, b: number): Rgb {
  const l = Math.pow(lightness + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(lightness - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(lightness - 0.0894841775 * a - 1.291485548 * b, 3);

  const x = 1.2270138511 * l - 0.5577999807 * m - 0.281256149 * s;
  const y = -0.0405801784 * l + 1.1122568696 * m - 0.0716766787 * s;
  const z = -0.0763812845 * l - 0.4214819784 * m + 1.5861632204 * s;

  const linearToSrgb = (channel: number) => {
    const safeChannel = Math.max(0, channel);
    return clamp(safeChannel <= 0.0031308
      ? 12.92 * safeChannel
      : 1.055 * Math.pow(safeChannel, 1 / 2.4) - 0.055);
  };

  return [
    linearToSrgb(3.2409699419 * x - 1.5373831776 * y - 0.4986107603 * z),
    linearToSrgb(-0.9692436363 * x + 1.8759675015 * y + 0.0415550574 * z),
    linearToSrgb(0.0556300797 * x - 0.2039769589 * y + 1.0569715142 * z),
  ];
}

function parseColor(color: string): ParsedColor | null {
  const value = color.trim().toLowerCase();
  if (value === 'white') return { rgb: [1, 1, 1], alpha: 1 };
  if (value === 'black') return { rgb: [0, 0, 0], alpha: 1 };
  if (value === 'transparent') return { rgb: [0, 0, 0], alpha: 0 };

  const hex = value.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i)?.[1];
  if (hex) {
    const expanded = hex.length <= 4 ? hex.split('').map((part) => part + part).join('') : hex;
    return {
      rgb: [
        parseInt(expanded.slice(0, 2), 16) / 255,
        parseInt(expanded.slice(2, 4), 16) / 255,
        parseInt(expanded.slice(4, 6), 16) / 255,
      ],
      alpha: expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1,
    };
  }

  const rgbParts = parseFunctionalParts(value, 'rgba?');
  if (rgbParts && rgbParts.channels.length >= 3) {
    const channels = rgbParts.channels.slice(0, 3).map(parseRgbChannel);
    if (channels.every((channel): channel is number => channel !== null)) {
      return { rgb: channels as Rgb, alpha: parseAlpha(rgbParts.alpha || rgbParts.channels[3]) };
    }
  }

  const hslParts = parseFunctionalParts(value, 'hsla?');
  if (hslParts && hslParts.channels.length >= 3) {
    const hue = parseHue(hslParts.channels[0]);
    const saturation = parsePercentageOrFraction(hslParts.channels[1]);
    const lightness = parsePercentageOrFraction(hslParts.channels[2]);
    if (hue !== null && saturation !== null && lightness !== null) {
      const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
      const x = chroma * (1 - Math.abs(((hue / (Math.PI / 3)) % 2) - 1));
      const normalizedHue = ((hue % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const h = normalizedHue / (Math.PI / 3);
      const [red, green, blue] = h < 1
        ? [chroma, x, 0]
        : h < 2
          ? [x, chroma, 0]
          : h < 3
            ? [0, chroma, x]
            : h < 4
              ? [0, x, chroma]
              : h < 5
                ? [x, 0, chroma]
                : [chroma, 0, x];
      const matchLightness = lightness - chroma / 2;
      return {
        rgb: [red + matchLightness, green + matchLightness, blue + matchLightness],
        alpha: parseAlpha(hslParts.alpha || hslParts.channels[3]),
      };
    }
  }

  const oklchParts = parseFunctionalParts(value, 'oklch');
  if (oklchParts && oklchParts.channels.length >= 3) {
    const lightness = parsePercentageOrFraction(oklchParts.channels[0]);
    const chroma = parsePercentageOrFraction(oklchParts.channels[1]);
    const hue = parseHue(oklchParts.channels[2]);
    if (lightness !== null && chroma !== null && hue !== null) {
      return {
        rgb: oklabToRgb(lightness, chroma * Math.cos(hue), chroma * Math.sin(hue)),
        alpha: parseAlpha(oklchParts.alpha),
      };
    }
  }

  const oklabParts = parseFunctionalParts(value, 'oklab');
  if (oklabParts && oklabParts.channels.length >= 3) {
    const lightness = parsePercentageOrFraction(oklabParts.channels[0]);
    const a = parsePercentageOrFraction(oklabParts.channels[1]);
    const b = parsePercentageOrFraction(oklabParts.channels[2]);
    if (lightness !== null && a !== null && b !== null) {
      return { rgb: oklabToRgb(lightness, a, b), alpha: parseAlpha(oklabParts.alpha) };
    }
  }

  return null;
}

function composite(color: ParsedColor, backdrop: Rgb): Rgb {
  return [
    color.rgb[0] * color.alpha + backdrop[0] * (1 - color.alpha),
    color.rgb[1] * color.alpha + backdrop[1] * (1 - color.alpha),
    color.rgb[2] * color.alpha + backdrop[2] * (1 - color.alpha),
  ];
}

function rgbLuminance(rgb: Rgb): number {
  const toLinear = (channel: number) => channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
  const [r, g, b] = rgb.map(toLinear) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Returns the relative luminance of a CSS color, including common theme formats. */
export function relativeLuminance(color: string): number | null {
  const parsed = parseColor(color);
  return parsed ? rgbLuminance(composite(parsed, [1, 1, 1])) : null;
}

/** Returns the WCAG contrast ratio between foreground and background. */
export function contrastRatio(foreground: string, background: string): number | null {
  const foregroundColor = parseColor(foreground);
  const backgroundColor = parseColor(background);
  if (!foregroundColor || !backgroundColor) return null;

  const backgroundRgb = composite(backgroundColor, [1, 1, 1]);
  const foregroundRgb = composite(foregroundColor, backgroundRgb);
  const foregroundLuminance = rgbLuminance(foregroundRgb);
  const backgroundLuminance = rgbLuminance(backgroundRgb);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getReadableForeground(background: string): string {
  const darkRatio = contrastRatio(DARK_FOREGROUND, background);
  const lightRatio = contrastRatio(LIGHT_FOREGROUND, background);
  if (darkRatio === null && lightRatio === null) return LIGHT_FOREGROUND;
  if (darkRatio === null) return LIGHT_FOREGROUND;
  if (lightRatio === null) return DARK_FOREGROUND;
  // En un empate visual, blanco funciona mejor sobre superficies de marca
  // saturadas y evita que pestañas/botones queden con apariencia pesada.
  return lightRatio >= darkRatio ? LIGHT_FOREGROUND : DARK_FOREGROUND;
}

export function getReadableForegroundForBackgrounds(backgrounds: readonly string[]): string {
  const candidates = [DARK_FOREGROUND, LIGHT_FOREGROUND];
  return candidates.reduce((best, candidate) => {
    const candidateScore = Math.min(...backgrounds.map((background) => contrastRatio(candidate, background) ?? 0));
    const bestScore = Math.min(...backgrounds.map((background) => contrastRatio(best, background) ?? 0));
    return candidateScore >= bestScore ? candidate : best;
  });
}

export function ensureReadableForeground(
  background: string,
  foreground?: string,
  minRatio = WCAG_TEXT_CONTRAST,
): string {
  const automaticForeground = getReadableForeground(background);
  const automaticRatio = contrastRatio(automaticForeground, background) ?? 0;
  const requestedRatio = foreground ? contrastRatio(foreground, background) ?? 0 : 0;

  // A manually configured foreground is kept only when it is at least as
  // readable as the automatic black/white choice. This prevents an old theme
  // value from leaving black text over a blue primary surface while still
  // allowing a custom brand color when it genuinely meets the requirement.
  if (foreground && requestedRatio >= minRatio && requestedRatio >= automaticRatio) {
    return foreground;
  }
  return automaticForeground;
}

/**
 * Checks semantic foreground/background pairs after all CSS custom properties
 * have been applied. This is used in development and by the theme validation
 * script so a new palette cannot silently reintroduce unreadable text.
 */
export function validateContrastPairs(pairs: readonly ContrastPair[]): ContrastIssue[] {
  return pairs.flatMap((pair) => {
    const ratio = contrastRatio(pair.foreground, pair.background);
    const minRatio = pair.minRatio ?? WCAG_TEXT_CONTRAST;
    return ratio !== null && ratio >= minRatio ? [] : [{ ...pair, ratio }];
  });
}

export function validateThemeRoot(root: HTMLElement): ContrastIssue[] {
  const styles = getComputedStyle(root);
  const token = (name: string) => styles.getPropertyValue(name).trim();
  return validateContrastPairs([
    { name: 'primary', foreground: token('--primary-foreground'), background: token('--primary') },
    { name: 'accent', foreground: token('--accent-foreground'), background: token('--accent') },
    { name: 'sidebar', foreground: token('--sidebar-foreground'), background: token('--sidebar') },
    { name: 'sidebar-primary', foreground: token('--sidebar-primary-foreground'), background: token('--sidebar-primary') },
    { name: 'sidebar-accent', foreground: token('--sidebar-accent-foreground'), background: token('--sidebar-accent') },
    { name: 'card', foreground: token('--card-foreground'), background: token('--card') },
    { name: 'popover', foreground: token('--popover-foreground'), background: token('--popover') },
  ]);
}
