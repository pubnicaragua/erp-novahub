import { apiRequest, getApiUrl } from './api';

interface PdfPreviewAuthorization {
  token: string;
  fileName: string;
  expiresAt: string;
}

export async function createPdfPreview(pdf: Blob, fileName: string) {
  const authorization = await apiRequest<PdfPreviewAuthorization>('/pdf-previews', {
    method: 'POST',
    rawBody: pdf,
    headers: {
      'Content-Type': 'application/pdf',
      'X-PDF-Filename': fileName,
    },
  });

  return {
    ...authorization,
    url: getApiUrl(`/pdf-previews/${encodeURIComponent(authorization.fileName)}`, {
      token: authorization.token,
    }),
  };
}
