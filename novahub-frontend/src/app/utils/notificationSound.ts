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

/**
 * Volumen maestro del aviso (1 = máximo sin saturar). La señal pasa por un compresor y un limitador
 * suave: sube el volumen percibido sin distorsionar ni cortar los picos.
 */
const MASTER_GAIN = 1.0;
/** Notas del acorde ascendente (Do6 – Mi6 – Sol6 – Do7): más audible que un tono único. */
const CHIME: Array<{ frequency: number; offset: number; duration: number }> = [
  { frequency: 1046.5, offset: 0, duration: 0.2 },
  { frequency: 1318.5, offset: 0.12, duration: 0.2 },
  { frequency: 1568, offset: 0.24, duration: 0.24 },
  { frequency: 2093, offset: 0.38, duration: 0.42 },
];

/** Reproduce un aviso sonoro fuerte sin requerir un archivo de audio. */
export function playNotificationSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  installUnlockListeners();

  const play = () => {
    if (ctx.state !== 'running') return;
    try {
      const now = ctx.currentTime;

      // Cadena: tonos → ganancia maestra → compresor → salida.
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 12;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.15;
      const master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(compressor);
      compressor.connect(ctx.destination);

      for (const note of CHIME) {
        const start = now + note.offset;
        const end = start + note.duration;
        // Onda triangular + octava superior sinusoidal: más armónicos = más presencia a igual amplitud.
        for (const [type, ratio, peak] of [['triangle', 1, 1.0], ['sine', 2, 0.35]] as const) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = type;
          osc.frequency.value = note.frequency * ratio;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, end);
          osc.connect(gain);
          gain.connect(master);
          osc.start(start);
          osc.stop(end + 0.02);
        }
      }
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
