import logoPngUrl from '../../../LOGO_NOVAHUB.png';

/** Shared PDF-safe NovaHub lockup used by commercial documents. */
export const NOVAHUB_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="100" viewBox="0 0 360 100"><rect width="100" height="100" rx="22" fill="#0A0A0A"/><rect x="22" y="20" width="12" height="60" rx="4" fill="#fff"/><rect x="66" y="20" width="12" height="60" rx="4" fill="#fff"/><path d="M22 20h56v15H34z" fill="#fff"/><path d="M28 22l44 36v14L28 36z" fill="#22C55E"/><path d="M66 65h12v15H66z" fill="#fff"/><text x="122" y="58" fill="#0f172a" font-family="Arial,sans-serif" font-size="38" font-weight="800">Nova<tspan fill="#16a34a">Hub</tspan></text><text x="124" y="78" fill="#64748b" font-family="Arial,sans-serif" font-size="11" font-weight="700" letter-spacing="3">ERP PLATFORM</text></svg>`;
export const NOVAHUB_LOGO_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(NOVAHUB_LOGO_SVG)}`;

export async function getNovaHubLogoPng(): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return NOVAHUB_LOGO_DATA_URL;
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 200;
      const context = canvas.getContext('2d');
      if (!context) {
        resolve(NOVAHUB_LOGO_DATA_URL);
        return;
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => resolve(NOVAHUB_LOGO_DATA_URL);
    image.src = logoPngUrl;
  });
}
