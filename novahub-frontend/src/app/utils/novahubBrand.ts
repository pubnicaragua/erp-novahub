import isotipoPngUrl from '../../assets/branding/novahub-isotipo.png';

/** Shared PDF-safe NovaHub isotipo used by the ERP and its documents. */
export const NOVAHUB_LOGO_DATA_URL = isotipoPngUrl;

export async function getNovaHubLogoPng(): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return isotipoPngUrl;
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 720;
      const context = canvas.getContext('2d');
      if (!context) {
        resolve(NOVAHUB_LOGO_DATA_URL);
        return;
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => resolve(isotipoPngUrl);
    image.src = isotipoPngUrl;
  });
}
