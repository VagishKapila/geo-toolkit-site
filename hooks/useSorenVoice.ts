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
  const idleWaitersRef = useRef<(() => void)[]>([]);

  const notifyIdle = useCallback(() => {
    if (!isPlayingRef.current && queueRef.current.length === 0) {
      idleWaitersRef.current.splice(0).forEach((fn) => fn());
    }
  }, []);

  const processQueue = useCallback(async () => {
    if (isPlayingRef.current) return;
    if (queueRef.current.length === 0) {
      notifyIdle();
      return;
    }

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
      setTimeout(() => {
        void processQueue();
        notifyIdle();
      }, 150);
    }
  }, [notifyIdle]);

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
    notifyIdle();
  }, [notifyIdle]);

  const speak = useCallback((text: string) => {
    if (mutedRef.current) return;
    queueRef.current.push(text);
    void processQueue();
  }, [processQueue]);

  const waitForIdle = useCallback((): Promise<void> => {
    if (!isPlayingRef.current && queueRef.current.length === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      idleWaitersRef.current.push(resolve);
    });
  }, []);

  const speakAndWait = useCallback(async (text: string): Promise<void> => {
    if (mutedRef.current) return;
    speak(text);
    await waitForIdle();
  }, [speak, waitForIdle]);

  const toggleMute = useCallback(() => {
    const newMuted = !mutedRef.current;
    mutedRef.current = newMuted;
    setIsMuted(newMuted);
    if (newMuted) {
      stop();
    }
  }, [stop]);

  return { speak, speakAndWait, stop, isSpeaking, isMuted, toggleMute };
}
