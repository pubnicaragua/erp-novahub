import { useCallback, useEffect, useRef, useState } from 'react';

export interface RecordedVoice {
  file: File;
  durationSeconds: number;
}

const PREFERRED_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
/** Una nota de voz puede durar hasta 10 minutos (mismo tope que el servidor). */
export const MAX_VOICE_SECONDS = 600;

/**
 * Graba una nota de voz con el micrófono. El archivo sale con el tipo base (`audio/webm`), sin parámetros de códec.
 * Permite pausar, reanudar y cancelar; `level` (0 a 1) muestra en vivo si el micrófono está captando sonido.
 */
export function useVoiceRecorder(onAutoStop?: (voice: RecordedVoice) => void) {
  const onAutoStopRef = useRef(onAutoStop);
  useEffect(() => { onAutoStopRef.current = onAutoStop; });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const resolveRef = useRef<((voice: RecordedVoice | null) => void) | null>(null);
  // Tiempo grabado sin contar las pausas.
  const activeMsRef = useRef(0);
  const segmentStartRef = useRef(0);
  const discardRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelTimerRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const supported = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

  const elapsedMs = () => activeMsRef.current + (segmentStartRef.current ? Date.now() - segmentStartRef.current : 0);

  const cleanup = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    if (levelTimerRef.current) window.clearInterval(levelTimerRef.current);
    levelTimerRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRecording(false);
    setPaused(false);
    setLevel(0);
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

  /** Descarta lo grabado sin entregarlo. */
  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    discardRef.current = true;
    resolveRef.current = null;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    else cleanup();
  }, [cleanup]);

  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    recorder.pause();
    activeMsRef.current += Date.now() - segmentStartRef.current;
    segmentStartRef.current = 0;
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'paused') return;
    recorder.resume();
    segmentStartRef.current = Date.now();
    setPaused(false);
  }, []);

  const start = useCallback(async () => {
    setError('');
    if (!supported) { setError('Tu navegador no permite grabar audio.'); return false; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      discardRef.current = false;
      activeMsRef.current = 0;
      // Medidor de nivel: confirma en vivo que el micrófono elegido sí capta sonido.
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          ctx.createMediaStreamSource(stream).connect(analyser);
          const data = new Uint8Array(analyser.fftSize);
          audioCtxRef.current = ctx;
          levelTimerRef.current = window.setInterval(() => {
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i += 1) { const v = (data[i] - 128) / 128; sum += v * v; }
            setLevel(Math.min(1, Math.sqrt(sum / data.length) * 3.2));
          }, 90);
        }
      } catch { /* sin medidor: la grabación sigue igual */ }
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const duration = Math.max(1, Math.round(elapsedMs() / 1000));
        const discard = discardRef.current;
        discardRef.current = false;
        segmentStartRef.current = 0;
        const type = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0];
        const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const file = new File(chunksRef.current, `nota-de-voz.${extension}`, { type });
        cleanup();
        const resolve = resolveRef.current;
        resolveRef.current = null;
        const voice = file.size && !discard ? { file, durationSeconds: Math.min(duration, MAX_VOICE_SECONDS) } : null;
        if (resolve) resolve(voice);
        // Terminó sola al llegar al tope de duración: nadie pidió detenerla, así que se entrega por el callback.
        else if (voice) onAutoStopRef.current?.(voice);
      };
      startedAtRef.current = Date.now();
      segmentStartRef.current = Date.now();
      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.round(elapsedMs() / 1000);
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

  return { supported, recording, paused, level, seconds, error, start, stop, pause, resume, cancel };
}
