import { useCallback, useEffect, useRef, useState } from 'react';

export interface RecordedVoice {
  file: File;
  durationSeconds: number;
}

const PREFERRED_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
/** Una nota de voz puede durar hasta 10 minutos (mismo tope que el servidor). */
export const MAX_VOICE_SECONDS = 600;

/** Graba una nota de voz con el micrófono. El archivo sale con el tipo base (`audio/webm`), sin parámetros de códec. */
export function useVoiceRecorder(onAutoStop?: (voice: RecordedVoice) => void) {
  const onAutoStopRef = useRef(onAutoStop);
  useEffect(() => { onAutoStopRef.current = onAutoStop; });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const resolveRef = useRef<((voice: RecordedVoice | null) => void) | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const supported = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

  const cleanup = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRecording(false);
  }, []);

  useEffect(() => () => {
    // Si se cierra la pantalla grabando, se apaga el micrófono y se descarta lo grabado.
    resolveRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    cleanup();
  }, [cleanup]);

  const stop = useCallback((): Promise<RecordedVoice | null> => new Promise((resolve) => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') { resolve(null); return; }
    resolveRef.current = resolve;
    recorder.stop();
  }), []);

  const start = useCallback(async () => {
    setError('');
    if (!supported) { setError('Tu navegador no permite grabar audio.'); return false; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const duration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const type = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0];
        const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const file = new File(chunksRef.current, `nota-de-voz.${extension}`, { type });
        cleanup();
        const resolve = resolveRef.current;
        resolveRef.current = null;
        const voice = file.size ? { file, durationSeconds: Math.min(duration, MAX_VOICE_SECONDS) } : null;
        if (resolve) resolve(voice);
        // Terminó sola al llegar al tope de duración: nadie pidió detenerla, así que se entrega por el callback.
        else if (voice) onAutoStopRef.current?.(voice);
      };
      startedAtRef.current = Date.now();
      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
        setSeconds(elapsed);
        if (elapsed >= MAX_VOICE_SECONDS && recorder.state !== 'inactive') recorder.stop();
      }, 500);
      return true;
    } catch {
      cleanup();
      setError('No se pudo usar el micrófono. Revisa el permiso del navegador.');
      return false;
    }
  }, [cleanup, supported]);

  return { supported, recording, seconds, error, start, stop };
}
