/** Reproduce un aviso corto sin requerir un archivo de audio ni una ruta pública. */
export function playNotificationSound() {
  if (typeof window === 'undefined') return;
  const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return;

  try {
    const context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(740, now);
    oscillator.frequency.setValueAtTime(980, now + 0.09);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.25);
    oscillator.addEventListener('ended', () => void context.close(), { once: true });
  } catch {
    // El navegador puede bloquear audio automático; la notificación visual
    // debe continuar funcionando en ese caso.
  }
}
