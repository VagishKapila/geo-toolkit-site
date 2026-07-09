'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  type RemoteTrack,
} from 'livekit-client';

const ENGINE =
  'https://varshyl-voice-engine-production.up.railway.app';
const WAKE_TOPIC = 'wake-trigger';

export type LKState =
  | 'disconnected'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'error';

function cleanupAudioElements() {
  document.querySelectorAll('[data-soren-audio]').forEach((el) => el.remove());
  document.querySelectorAll('audio').forEach((el) => {
    if (el.parentElement === document.body) el.remove();
  });
}

async function publishWakeTrigger(room: Room) {
  await room.localParticipant.publishData(
    new TextEncoder().encode(JSON.stringify({ source: 'geo-toolkit-site' })),
    { reliable: true, topic: WAKE_TOPIC },
  );
}

export function useLiveKitSoren(
  onStateChange?: (s: LKState) => void,
  onData?: (msg: { type: string; data: unknown }) => void,
) {
  const [state, setState] = useState<LKState>('disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState('');
  const roomRef = useRef<Room | null>(null);
  const onDataRef = useRef(onData);
  const wakeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  const clearWakeInterval = useCallback(() => {
    if (wakeIntervalRef.current) {
      clearInterval(wakeIntervalRef.current);
      wakeIntervalRef.current = null;
    }
  }, []);

  const startWakeKeepalive = useCallback((room: Room) => {
    clearWakeInterval();
    void publishWakeTrigger(room).catch(() => {});
    wakeIntervalRef.current = setInterval(() => {
      void publishWakeTrigger(room).catch(() => {});
    }, 2500);
  }, [clearWakeInterval]);

  const set = useCallback((s: LKState) => {
    setState(s);
    onStateChange?.(s);
  }, [onStateChange]);

  const disconnect = useCallback(() => {
    clearWakeInterval();
    roomRef.current?.disconnect();
    roomRef.current = null;
    cleanupAudioElements();
    set('disconnected');
    setError('');
  }, [clearWakeInterval, set]);

  const connect = useCallback(async () => {
    // Unlock audio context synchronously
    // Must happen in the same call stack as
    // the user click — before any await
    try {
      const AudioContext = window.AudioContext
        || (window as Window & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        await ctx.resume();
        ctx.close();
      }
    } catch {
      // ignore — best-effort unlock
    }

    if (roomRef.current) disconnect();
    set('connecting');
    setError('');
    clearWakeInterval();

    try {
      const res = await fetch(`${ENGINE}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: 'soren-fixes-it',
          persona: 'soren',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.data?.token) {
        throw new Error(data.message ?? 'No token received');
      }
      const { token, liveKitUrl } = data.data;
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (
        track: RemoteTrack,
      ) => {
        if (track.kind !== Track.Kind.Audio) return;
        set('speaking');

        // USE track.attach() — LiveKit's method
        // handles autoplay policy correctly
        const audioEl = track.attach();
        audioEl.style.cssText =
          'position:fixed;width:1px;height:1px;' +
          'opacity:0;pointer-events:none;';
        document.body.appendChild(audioEl);

        audioEl.play().catch(() => {
          // If still blocked, wait for next user tap
          const unlock = () => {
            audioEl.play().catch(console.error);
            document.removeEventListener('click', unlock);
          };
          document.addEventListener('click', unlock,
            { once: true });
        });

        // Cleanup when track ends
        track.on('muted' as any, () => {
          audioEl.remove();
          if (roomRef.current) set('listening');
        });
      });

      room.on(RoomEvent.TrackUnsubscribed, (
        track: RemoteTrack,
      ) => {
        if (track.kind === Track.Kind.Audio) {
          track.detach();
          set('listening');
        }
      });

      room.on(RoomEvent.ConnectionStateChanged, (s: ConnectionState) => {
        if (s === ConnectionState.Connected) set('listening');
        if (s === ConnectionState.Disconnected) set('disconnected');
      });

      room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload)) as {
            type: string;
            data: unknown;
          };
          onDataRef.current?.(msg);
        } catch {
          // ignore non-JSON payloads
        }
      });

      await room.connect(liveKitUrl, token);
      await room.localParticipant.setMicrophoneEnabled(true);

      startWakeKeepalive(room);
      set('listening');
    } catch (e: unknown) {
      console.error('[LK]', e);
      setError(e instanceof Error ? e.message : 'Connection failed');
      set('error');
      roomRef.current = null;
      cleanupAudioElements();
      clearWakeInterval();
    }
  }, [clearWakeInterval, disconnect, set, startWakeKeepalive]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !isMuted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setIsMuted(next);
  }, [isMuted]);

  useEffect(() => () => { disconnect(); }, [disconnect]);

  return {
    state,
    connect,
    disconnect,
    isMuted,
    toggleMute,
    error,
    isConnected: state !== 'disconnected' && state !== 'error',
  };
}
