'use client';
import { useCallback, useRef, useState } from 'react';

const TTS_URL =
  'https://toolkit-demo-host-production-ac14.up.railway.app/api/tts';

export function useSorenVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(false);
  const busyRef = useRef(false);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      try { audio.src = ''; } catch { /* ignore */ }
      audioRef.current = null;
    }
    busyRef.current = false;
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string) => {
    if (mutedRef.current) return;

    stop();

    busyRef.current = true;

    try {
      setIsSpeaking(true);

      const res = await fetch(TTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(10000),
      });

      if (mutedRef.current || !busyRef.current) {
        setIsSpeaking(false);
        return;
      }

      if (!res.ok) {
        setIsSpeaking(false);
        busyRef.current = false;
        return;
      }

      const blob = await res.blob();

      if (mutedRef.current || !busyRef.current) {
        setIsSpeaking(false);
        return;
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        busyRef.current = false;
        setIsSpeaking(false);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        busyRef.current = false;
        setIsSpeaking(false);
      };

      await audio.play();
    } catch {
      busyRef.current = false;
      setIsSpeaking(false);
    }
  }, [stop]);

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
