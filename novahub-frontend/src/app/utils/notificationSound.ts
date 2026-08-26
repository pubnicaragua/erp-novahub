let sharedAudioContext: AudioContext | null = null;
let unlockListenersInstalled = false;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  try {
    sharedAudioContext ??= new AudioContextConstructor();
    return sharedAudioContext;
  } catch {
    return null;
  }
}

function unlockAudio() {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== 'suspended') return;
  void ctx.resume().catch(() => undefined);
}

function installUnlockListeners() {
  if (typeof window === 'undefined' || unlockListenersInstalled) return;
  unlockListenersInstalled = true;
  const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];
  events.forEach((event) => window.addEventListener(event, unlockAudio, { passive: true }));
}

installUnlockListeners();

/** Reproduce un aviso sonoro sin requerir un archivo de audio. */
export function playNotificationSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  installUnlockListeners();

  const play = () => {
    if (ctx.state !== 'running') return;
    try {
      const now = ctx.currentTime;

      // Primer tono: 880 Hz (La5) — 80ms
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.value = 880;
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(0.45, now + 0.012);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.10);

      // Segundo tono: 1175 Hz (Fa#5) — 160ms, empieza a los 80ms
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 1175;
      gain2.gain.setValueAtTime(0.001, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.55, now + 0.092);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.26);
    } catch {
      // El navegador puede bloquear audio automático; la notificación visual
      // debe continuar funcionando en ese caso.
    }
  };

  if (ctx.state === 'suspended') {
    void ctx.resume().then(play).catch(() => undefined);
    return;
  }
  play();
}
