'use client';

/**
 * useInterrupt — P19.7 fast STOP hook
 *
 * On call:
 *  1. Set muted=true on ALL <audio> elements — RoomAudioRenderer renders these
 *     for each remote participant track. Using .muted is more reliable than
 *     .pause() because LiveKit auto-resumes a paused srcObject stream on the
 *     next audio chunk. .muted=true is sticky until explicitly cleared.
 *  2. Send DataChannel cancel-current-turn → backend calls session.interrupt()
 *     which halts LLM generation + TTS synthesis server-side.
 *  3. After 300ms restore muted=false so next agent turn plays normally.
 *
 * Perceived latency: ~0ms (local mute is instant; server cancel fires in parallel).
 */

import { useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';

export function useInterrupt(): () => void {
  const room = useRoomContext();

  const interrupt = useCallback(() => {
    // 1. Mute all agent audio elements instantly (browser-side, zero latency)
    const audioEls = Array.from(document.querySelectorAll<HTMLAudioElement>('audio'));
    for (const el of audioEls) {
      try { el.muted = true; } catch { /* ignore */ }
    }

    // 2. Send cancel-current-turn DataChannel to backend (parallel to step 1)
    if (room?.localParticipant) {
      try {
        const payload = new TextEncoder().encode(
          JSON.stringify({ type: 'cancel-current-turn' }),
        );
        void room.localParticipant.publishData(payload, { reliable: true });
      } catch (err) {
        console.warn('[useInterrupt] publishData error:', err);
      }
    }

    // 3. Restore audio after 300ms so next agent turn plays normally
    setTimeout(() => {
      const els = Array.from(document.querySelectorAll<HTMLAudioElement>('audio'));
      for (const el of els) {
        try { el.muted = false; } catch { /* ignore */ }
      }
    }, 300);
  }, [room]);

  return interrupt;
}
