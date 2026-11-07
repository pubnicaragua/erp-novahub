import { pushDevicesService } from '../services/notificaciones.service';

/**
 * Web Push: suscribe este navegador o app instalada para recibir notificaciones aunque esté cerrada.
 * La suscripción se guarda en el servidor por dispositivo; cada persona activa los suyos.
 */

const ENDPOINT_HINT_KEY = 'nh-push-synced-at';
const RESYNC_AFTER_MS = 12 * 60 * 60 * 1000;

export type PushDeviceStatus =
  | 'unsupported'      // el navegador no admite Web Push
  | 'needs-install'    // iPhone/iPad: solo funciona con la app instalada en la pantalla de inicio
  | 'server-disabled'  // el servidor todavía no tiene las llaves VAPID
  | 'blocked'          // el usuario bloqueó el permiso
  | 'off'              // se puede activar
  | 'on';              // este dispositivo está suscrito

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && typeof Notification !== 'undefined';
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches === true
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}

function describeDevice(): string {
  const ua = navigator.userAgent || '';
  const system = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iPhone/iPad' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'Dispositivo';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  return `${browser} en ${system}${isStandalonePwa() ? ' (app instalada)' : ''}`;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

export async function getPushDeviceStatus(): Promise<PushDeviceStatus> {
  if (isIosDevice() && !isStandalonePwa()) return 'needs-install';
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const config = await pushDevicesService.getConfig().catch(() => null);
  if (!config?.enabled) return 'server-disabled';
  const subscription = await currentSubscription();
  return subscription && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Pide permiso (si falta), suscribe este dispositivo y lo registra en el servidor. */
export async function subscribeThisDevice(): Promise<PushDeviceStatus> {
  if (isIosDevice() && !isStandalonePwa()) return 'needs-install';
  if (!isPushSupported()) return 'unsupported';
  const config = await pushDevicesService.getConfig();
  if (!config?.enabled || !config.publicKey) return 'server-disabled';

  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';

  const registration = await navigator.serviceWorker.ready;
  const applicationServerKey = urlBase64ToUint8Array(config.publicKey);
  let subscription = await registration.pushManager.getSubscription();
  // Si el servidor cambió de llaves VAPID la suscripción vieja ya no sirve: se vuelve a crear.
  const existingKey = subscription?.options?.applicationServerKey;
  if (subscription && existingKey && !sameKey(new Uint8Array(existingKey), applicationServerKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription = subscription || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });

  const json = subscription.toJSON();
  await pushDevicesService.subscribe({
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys?.p256dh || '', auth: json.keys?.auth || '' },
    userAgent: navigator.userAgent,
    deviceLabel: describeDevice(),
  });
  try { window.localStorage.setItem('nh-browser-notifications-enabled', 'true'); window.localStorage.setItem(ENDPOINT_HINT_KEY, String(Date.now())); } catch { /* preferencia opcional */ }
  return 'on';
}

export async function unsubscribeThisDevice(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await pushDevicesService.remove(endpoint).catch(() => undefined);
  await subscription.unsubscribe().catch(() => undefined);
  try { window.localStorage.removeItem(ENDPOINT_HINT_KEY); } catch { /* preferencia opcional */ }
}

/**
 * Al abrir la app: si el permiso ya está concedido, vuelve a registrar el dispositivo en el servidor.
 * Los navegadores rotan o expiran las suscripciones; sin esto un celular puede dejar de recibir push
 * sin que nadie lo note. Es idempotente y se limita a una vez cada 12 horas.
 */
export async function ensureThisDeviceSubscribed(): Promise<void> {
  if (!isPushSupported() || Notification.permission !== 'granted') return;
  if (isIosDevice() && !isStandalonePwa()) return;
  try {
    const last = Number(window.localStorage.getItem(ENDPOINT_HINT_KEY) || 0);
    const subscribed = Boolean(await currentSubscription());
    if (subscribed && Date.now() - last < RESYNC_AFTER_MS) return;
    // Quien ya activó las notificaciones antes de existir el push se suscribe sin volver a preguntar.
    if (window.localStorage.getItem('nh-browser-notifications-enabled') === 'false') return;
    await subscribeThisDevice();
  } catch {
    // Opcional: si falla, se reintenta en la próxima apertura.
  }
}

function sameKey(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
