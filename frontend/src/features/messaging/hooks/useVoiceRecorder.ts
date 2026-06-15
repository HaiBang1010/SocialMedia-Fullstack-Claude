import { useCallback, useEffect, useRef, useState } from 'react';
import { VOICE_MAX_DURATION } from '@/lib/audio';

// Phase 5.4b — tap-to-toggle voice recording via MediaRecorder (WebM/Opus, Q1/Q2). Duration is
// measured by a wall-clock timer (WebM from MediaRecorder has no reliable duration metadata).
// Auto-stops at VOICE_MAX_DURATION. `denied`/`unsupported` surface as states for an inline error.
export type RecorderState = 'idle' | 'requesting' | 'recording' | 'denied' | 'unsupported';

const PREFERRED_MIME = 'audio/webm;codecs=opus';

export interface VoiceResult {
  blob: Blob;
  duration: number; // seconds
}

export function useVoiceRecorder(onComplete: (result: VoiceResult) => void) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startAtRef = useRef(0);
  const cancelledRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const cleanup = useCallback(() => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const start = useCallback(async () => {
    if (state === 'recording' || state === 'requesting') return;
    if (
      typeof MediaRecorder === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      !MediaRecorder.isTypeSupported('audio/webm')
    ) {
      setState('unsupported');
      return;
    }

    setState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported(PREFERRED_MIME) ? PREFERRED_MIME : 'audio/webm';
      const rec = new MediaRecorder(stream, { mimeType });
      recorderRef.current = rec;
      chunksRef.current = [];
      cancelledRef.current = false;

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const duration = Math.round((Date.now() - startAtRef.current) / 1000);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const cancelled = cancelledRef.current;
        cleanup();
        setState('idle');
        setElapsed(0);
        if (!cancelled && blob.size > 0 && duration > 0) {
          onCompleteRef.current({ blob, duration: Math.min(duration, VOICE_MAX_DURATION) });
        }
      };

      startAtRef.current = Date.now();
      rec.start();
      setState('recording');
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        const e = Math.floor((Date.now() - startAtRef.current) / 1000);
        setElapsed(e);
        if (e >= VOICE_MAX_DURATION && rec.state !== 'inactive') rec.stop(); // auto-stop at cap
      }, 250);
    } catch {
      cleanup();
      setState('denied');
    }
  }, [state, cleanup]);

  // Finalize → onComplete (via onstop).
  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      cancelledRef.current = false;
      rec.stop();
    }
  }, []);

  // Discard the recording.
  const cancel = useCallback(() => {
    const rec = recorderRef.current;
    cancelledRef.current = true;
    if (rec && rec.state !== 'inactive') {
      rec.stop();
    } else {
      cleanup();
      setState('idle');
      setElapsed(0);
    }
  }, [cleanup]);

  // Release the mic if the component unmounts mid-record.
  useEffect(() => () => cleanup(), [cleanup]);

  return { state, elapsed, start, stop, cancel };
}
