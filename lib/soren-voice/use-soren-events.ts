'use client';

import { useEffect } from 'react';
import { Room, RoomEvent } from 'livekit-client';

/** Voice engine adapter events (soren-fixes-it publishToolUiEvents). */
export interface SorenEvent {
  type: 'geo_audit_result' | 'show_fix_modal' | string;
  data?: unknown;
  payload?: unknown;
}

export function useSorenEvents(room: Room, onEvent: (e: SorenEvent) => void) {
  useEffect(() => {
    const handler = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload)) as SorenEvent;
        if (msg && typeof msg.type === 'string') onEvent(msg);
      } catch {
        /* non-JSON packets ignored */
      }
    };
    room.on(RoomEvent.DataReceived, handler);
    return () => {
      room.off(RoomEvent.DataReceived, handler);
    };
  }, [room, onEvent]);
}
