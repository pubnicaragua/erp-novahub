export interface MessageTextPart {
  text: string;
  href?: string;
}

const MESSAGE_URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;

export function parseMessageText(content: string): MessageTextPart[] {
  const parts: MessageTextPart[] = [];
  let cursor = 0;

  for (const match of content.matchAll(MESSAGE_URL_PATTERN)) {
    const rawUrl = match[0];
    const start = match.index ?? cursor;
    const url = rawUrl.replace(/[.,!?;:]+$/, '');
    if (!url) continue;

    const destination = /^www\./i.test(url) ? `https://${url}` : url;
    try {
      const { protocol } = new URL(destination);
      if (protocol !== 'http:' && protocol !== 'https:') continue;
    } catch {
      continue;
    }

    if (start > cursor) parts.push({ text: content.slice(cursor, start) });
    parts.push({ text: url, href: destination });
    if (rawUrl.length > url.length) parts.push({ text: rawUrl.slice(url.length) });
    cursor = start + rawUrl.length;
  }

  if (cursor < content.length || parts.length === 0) parts.push({ text: content.slice(cursor) });
  return parts;
}
