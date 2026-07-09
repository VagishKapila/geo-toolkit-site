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

export type LKState =
  | 'disconnected'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'error';

export function useLiveKitSoren(onStateChange?: (s: LKState) => void) {
  const [state, setState] = useState<LKState>('disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState('');
  const roomRef = useRef<Room | null>(null);

  const set = useCallback((s: LKState) => {
    setState(s);
    onStateChange?.(s);
  }, [onStateChange]);

  const disconnect = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    set('disconnected');
    setError('');
  }, [set]);

  const connect = useCallback(async () => {
    if (roomRef.current) disconnect();
    set('connecting');
    setError('');
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

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind !== Track.Kind.Audio) return;
        set('speaking');
        const audio = new Audio();
        audio.srcObject = new MediaStream([track.mediaStreamTrack]);
        audio.play().catch(console.error);
      });

      room.on(RoomEvent.TrackUnsubscribed, () => {
        if (roomRef.current) set('listening');
      });

      room.on(RoomEvent.ConnectionStateChanged, (s: ConnectionState) => {
        if (s === ConnectionState.Connected) set('listening');
        if (s === ConnectionState.Disconnected) set('disconnected');
      });

      await room.connect(liveKitUrl, token);
      await room.localParticipant.setMicrophoneEnabled(true);
      set('listening');
    } catch (e: unknown) {
      console.error('[LK]', e);
      setError(e instanceof Error ? e.message : 'Connection failed');
      set('error');
      roomRef.current = null;
    }
  }, [disconnect, set]);

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
