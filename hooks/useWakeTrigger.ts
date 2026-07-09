'use client';

import { useEffect, useRef } from 'react';
import { Room, RoomEvent } from 'livekit-client';

/** Matches varshyl-voice agent-entry.ts WAKE_TOPIC + test.html publishData. */
const WAKE_TOPIC = 'wake-trigger';

function publishWakeTrigger(room: Room) {
  const payload = new TextEncoder().encode(
    JSON.stringify({ type: 'wake-trigger' }),
  );
  return room.localParticipant.publishData(payload, {
    reliable: true,
    topic: WAKE_TOPIC,
  });
}

/** Publish wake-trigger once per room connection; re-publish on reconnect. */
export function useWakeTrigger(room: Room, connected: boolean) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (!connected) {
      sentRef.current = false;
      return;
    }
    if (sentRef.current) return;

    sentRef.current = true;
    void publishWakeTrigger(room).catch(() => {
      sentRef.current = false;
    });
  }, [room, connected]);

  useEffect(() => {
    const onDisconnected = () => {
      sentRef.current = false;
    };
    const onConnected = () => {
      if (sentRef.current) return;
      sentRef.current = true;
      void publishWakeTrigger(room).catch(() => {
        sentRef.current = false;
      });
    };

    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.Connected, onConnected);
    return () => {
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.Connected, onConnected);
    };
  }, [room]);
}
