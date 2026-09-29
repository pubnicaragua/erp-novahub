import isotipoPngUrl from '../../assets/branding/novahub-isotipo.png';
import logotipoPngUrl from '../../assets/branding/novahub-logotipo-transparent.png';

/** Shared PDF-safe NovaHub isotipo used by the ERP and its documents. */
export const NOVAHUB_LOGO_DATA_URL = isotipoPngUrl;
/** Horizontal NovaHub wordmark used in document headers. */
export const NOVAHUB_LOGOTIPO_DATA_URL = logotipoPngUrl;

async function getPngDataUrl(imageUrl: string, fallbackWidth: number, fallbackHeight: number) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return imageUrl;
  return new Promise<string>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || fallbackWidth;
      const height = image.naturalHeight || fallbackHeight;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        resolve(imageUrl);
        return;
      }
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => resolve(imageUrl);
    image.src = imageUrl;
  });
}

export async function getNovaHubLogoPng(): Promise<string> {
  return getPngDataUrl(isotipoPngUrl, 720, 720);
}

export async function getNovaHubLogotipoPng(): Promise<string> {
  return getPngDataUrl(logotipoPngUrl, 1792, 512);
}
