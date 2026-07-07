'use client';
import { useCallback, useRef, useState } from 'react';

const TTS_URL =
  'https://toolkit-demo-host-production-ac14.up.railway.app/api/tts';

export function useSorenVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(false);
  const queueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  const stop = useCallback(() => {
    queueRef.current = [];
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      try { audio.src = ''; } catch { /* ignore */ }
      audioRef.current = null;
    }
    isPlayingRef.current = false;
    setIsSpeaking(false);
  }, []);

  const processQueue = useCallback(async () => {
    if (isPlayingRef.current) return;
    if (queueRef.current.length === 0) return;

    const text = queueRef.current.shift()!;
    isPlayingRef.current = true;
    setIsSpeaking(true);

    try {
      if (mutedRef.current) return;

      const res = await fetch(TTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok || mutedRef.current) return;

      const blob = await res.blob();
      if (mutedRef.current) return;

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      await new Promise<void>((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          resolve();
        };
        audio.play().catch(() => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          resolve();
        });
      });
    } catch {
      // silent fail
    } finally {
      isPlayingRef.current = false;
      setIsSpeaking(queueRef.current.length > 0);
      setTimeout(processQueue, 150);
    }
  }, []);

  const speak = useCallback(async (text: string) => {
    if (mutedRef.current) return;
    queueRef.current.push(text);
    processQueue();
  }, [processQueue]);

  const toggleMute = useCallback(() => {
    const newMuted = !mutedRef.current;
    mutedRef.current = newMuted;
    setIsMuted(newMuted);
    if (newMuted) {
      stop();
    }
  }, [stop]);

  return { speak, stop, isSpeaking, isMuted, toggleMute };
}
