'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  createLocalAudioTrack,
  type RemoteTrack,
  type RemoteParticipant,
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
}

async function publishWakeTrigger(room: Room) {
  await room.localParticipant.publishData(
    new TextEncoder().encode(JSON.stringify({ source: 'geo-toolkit-site' })),
    { reliable: true, topic: WAKE_TOPIC },
  );
}

function isAgentParticipant(participant: { isAgent?: boolean; identity?: string }) {
  return Boolean(
    participant.isAgent
    || participant.identity?.startsWith('agent'),
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
    set('connecting');
    setError('');
    clearWakeInterval();

    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
      cleanupAudioElements();
    }

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
        _pub,
        participant: RemoteParticipant,
      ) => {
        if (!isAgentParticipant(participant)) return;
        if (track.kind !== Track.Kind.Audio) return;

        set('speaking');

        const audioEl = track.attach() as HTMLAudioElement;
        audioEl.autoplay = true;
        audioEl.volume = 1;
        audioEl.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;';
        audioEl.setAttribute('data-soren-audio', 'attached');
        document.body.appendChild(audioEl);
        void audioEl.play().catch(() => {});

        track.on('ended', () => {
          audioEl.remove();
          if (roomRef.current) {
            set('listening');
            void publishWakeTrigger(roomRef.current).catch(() => {});
          }
        });
      });

      room.on(RoomEvent.TrackUnsubscribed, (
        track: RemoteTrack,
        _pub,
        participant: RemoteParticipant,
      ) => {
        if (!isAgentParticipant(participant)) return;
        if (track.kind === Track.Kind.Audio) track.detach();
        if (roomRef.current) set('listening');
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

      await room.connect(liveKitUrl, token, { autoSubscribe: true });

      try {
        const micTrack = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
        await room.localParticipant.publishTrack(micTrack);
      } catch (micErr) {
        console.warn('[LK] createLocalAudioTrack failed, falling back:', micErr);
        await room.localParticipant.setMicrophoneEnabled(true);
      }

      try {
        await room.startAudio();
      } catch (e) {
        console.warn('[LK] startAudio:', e);
      }

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
  }, [clearWakeInterval, set, startWakeKeepalive]);

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
