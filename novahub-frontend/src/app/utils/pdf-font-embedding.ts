export interface PdfFontFaceRuleSource {
  cssText: string;
  baseUrl: string;
}

export interface PdfFontAsset {
  bytes: ArrayBuffer;
  contentType?: string;
}

export type PdfFontAssetLoader = (url: string) => Promise<PdfFontAsset>;

const fontDataUrlCache = new Map<string, Promise<string>>();

function defaultPdfFontAssetLoader(url: string): Promise<PdfFontAsset> {
  return fetch(url, { credentials: 'same-origin' }).then(async response => {
    if (!response.ok) throw new Error(`No se pudo cargar la fuente (${response.status}).`);
    return {
      bytes: await response.arrayBuffer(),
      contentType: response.headers.get('content-type') || undefined,
    };
  });
}

function toBase64(bytes: ArrayBuffer) {
  const data = new Uint8Array(bytes);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    binary += String.fromCharCode(...data.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function parseFontSources(source: string) {
  const matches = [...source.matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^)'"\s]+))\s*\)\s*(?:format\(\s*(?:"([^"]+)"|'([^']+)'|([^)'"\s]+))\s*\))?/gi)];
  return matches.map(match => {
    const url = match[1] || match[2] || match[3];
    const format = match[4] || match[5] || match[6] || '';
    return { url, format };
  }).filter((source): source is { url: string; format: string } => Boolean(source.url));
}

function inferFontFormat(url: string, declaredFormat: string) {
  const format = declaredFormat.trim().toLowerCase();
  if (format) return format;
  const path = url.split(/[?#]/, 1)[0].toLowerCase();
  if (path.endsWith('.woff2')) return 'woff2';
  if (path.endsWith('.woff')) return 'woff';
  if (path.endsWith('.otf')) return 'opentype';
  if (path.endsWith('.ttf')) return 'truetype';
  return '';
}

function inferFontMimeType(url: string, contentType?: string) {
  const normalizedType = contentType?.split(';', 1)[0].trim().toLowerCase();
  if (normalizedType && normalizedType !== 'application/octet-stream') return normalizedType;
  const path = url.split(/[?#]/, 1)[0].toLowerCase();
  if (path.endsWith('.woff2')) return 'font/woff2';
  if (path.endsWith('.woff')) return 'font/woff';
  if (path.endsWith('.otf')) return 'font/otf';
  if (path.endsWith('.ttf')) return 'font/ttf';
  return 'application/octet-stream';
}

function findFontSourceDeclaration(cssText: string) {
  const declaration = /\bsrc\s*:/i.exec(cssText);
  if (!declaration) return null;

  const valueStart = declaration.index + declaration[0].length;
  let parentheses = 0;
  let quote = '';
  let escaped = false;
  for (let index = valueStart; index < cssText.length; index += 1) {
    const character = cssText[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '(') parentheses += 1;
    else if (character === ')') parentheses = Math.max(0, parentheses - 1);
    else if (character === ';' && parentheses === 0) {
      return {
        full: cssText.slice(declaration.index, index + 1),
        value: cssText.slice(valueStart, index),
      };
    }
  }
  return null;
}

async function inlineFontSource(
  source: { url: string; format: string },
  baseUrl: string,
  loadAsset: PdfFontAssetLoader,
) {
  if (source.url.startsWith('data:')) {
    return { url: source.url, format: source.format || inferFontFormat(source.url, '') };
  }

  const resolvedUrl = new URL(source.url, baseUrl).href;
  let dataUrlPromise = fontDataUrlCache.get(resolvedUrl);
  if (!dataUrlPromise) {
    dataUrlPromise = loadAsset(resolvedUrl).then(asset => {
      const mimeType = inferFontMimeType(resolvedUrl, asset.contentType);
      return `data:${mimeType};base64,${toBase64(asset.bytes)}`;
    });
    fontDataUrlCache.set(resolvedUrl, dataUrlPromise);
    void dataUrlPromise.catch(() => {
      if (fontDataUrlCache.get(resolvedUrl) === dataUrlPromise) fontDataUrlCache.delete(resolvedUrl);
    });
  }
  const dataUrl = await dataUrlPromise;
  const format = source.format || inferFontFormat(resolvedUrl, '');
  return {
    url: dataUrl,
    format,
  };
}

/** Makes @font-face rules self-contained so html2canvas carries them into its SVG capture. */
export async function inlinePdfFontFaceRules(
  rules: readonly PdfFontFaceRuleSource[],
  loadAsset: PdfFontAssetLoader = defaultPdfFontAssetLoader,
) {
  const embeddedRules = await Promise.all(rules.map(async rule => {
    const srcDeclaration = findFontSourceDeclaration(rule.cssText);
    if (!srcDeclaration) throw new Error('La regla de fuente no contiene un recurso src válido.');

    const sources = parseFontSources(srcDeclaration.value);
    if (!sources.length) throw new Error('La regla de fuente no contiene un archivo tipográfico compatible.');
    const selected = sources.find(source => inferFontFormat(source.url, source.format) === 'woff2') || sources[0];
    const embedded = await inlineFontSource(selected, rule.baseUrl, loadAsset);
    const format = embedded.format ? ` format("${embedded.format}")` : '';
    const replacement = `src: url("${embedded.url}")${format};`;
    return rule.cssText.replace(srcDeclaration.full, replacement);
  }));

  return embeddedRules.join('\n');
}
