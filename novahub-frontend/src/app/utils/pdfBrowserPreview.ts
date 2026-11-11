export interface PdfBrowserPreviewSession {
  window: Window;
  title: string;
}

let pendingPreview: PdfBrowserPreviewSession | null = null;

function showLoadingState(previewWindow: Window, title: string) {
  const previewDocument = previewWindow.document;
  previewDocument.title = `Vista previa · ${title}`;
  previewDocument.body.replaceChildren();
  Object.assign(previewDocument.body.style, {
    margin: '0',
    display: 'grid',
    minHeight: '100vh',
    placeItems: 'center',
    background: '#111827',
    color: '#f8fafc',
    fontFamily: 'Segoe UI, Arial, sans-serif',
  });
  const message = previewDocument.createElement('p');
  message.textContent = 'Preparando la previsualización…';
  message.style.padding = '24px';
  message.style.textAlign = 'center';
  previewDocument.body.appendChild(message);
}

/** Abre el visor vacío durante el gesto del usuario para evitar bloqueos de ventanas emergentes. */
export function beginPdfBrowserPreview(title = 'Documento PDF'): PdfBrowserPreviewSession | null {
  if (typeof window === 'undefined') return null;
  const previewWindow = window.open('', '_blank', 'width=1000,height=850');
  if (!previewWindow) return null;

  const session = { window: previewWindow, title };
  showLoadingState(previewWindow, title);
  pendingPreview = session;
  return session;
}

/** Reutiliza el visor abierto por el botón o crea uno para exportaciones directas. */
export function ensurePdfBrowserPreview(title = 'Documento PDF'): PdfBrowserPreviewSession | null {
  if (pendingPreview && !pendingPreview.window.closed) return pendingPreview;
  return beginPdfBrowserPreview(title);
}

export function showPdfInBrowserPreview(
  blob: Blob,
  fileName: string,
  session: PdfBrowserPreviewSession | null = pendingPreview,
) {
  const activeSession = session && !session.window.closed ? session : beginPdfBrowserPreview(fileName);
  if (!activeSession) {
    throw new Error('No se pudo abrir la previsualización. Habilita las ventanas emergentes para NovaHub.');
  }

  const previewUrl = URL.createObjectURL(blob);
  try {
    activeSession.window.document.title = fileName;
    activeSession.window.location.replace(previewUrl);
    if (pendingPreview === activeSession) pendingPreview = null;
    window.setTimeout(() => URL.revokeObjectURL(previewUrl), 10 * 60 * 1000);
    return { previewUrl, fileName };
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    activeSession.window.close();
    if (pendingPreview === activeSession) pendingPreview = null;
    throw error;
  }
}

export function closePdfBrowserPreview(session: PdfBrowserPreviewSession | null) {
  if (!session) return;
  if (pendingPreview === session) pendingPreview = null;
  if (!session.window.closed) session.window.close();
}
