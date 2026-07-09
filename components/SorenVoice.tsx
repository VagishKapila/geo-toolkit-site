'use client';

import {
  useMemo,
  useRef,
  useCallback,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import {
  useSession,
  SessionProvider,
  RoomAudioRenderer,
  useStartAudio,
  useVoiceAssistant,
} from '@livekit/components-react';
import { ConnectionState, Room, RoomEvent, TokenSource } from 'livekit-client';

const ENGINE =
  'https://varshyl-voice-engine-production.up.railway.app';

export type SorenVoiceState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'error';

function useSorenSession(
  onStateChange?: (s: SorenVoiceState) => void,
  onData?: (msg: { type: string; data: unknown }) => void,
) {
  const onStateRef = useRef(onStateChange);
  const onDataRef = useRef(onData);

  useEffect(() => {
    onStateRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  const tokenSource = useMemo(
    () =>
      TokenSource.custom(async () => {
        onStateRef.current?.('connecting');
        const res = await fetch(`${ENGINE}/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: 'soren-fixes-it',
            persona: 'soren',
            interactionMode: 'always-on',
          }),
        });
        if (!res.ok) {
          onStateRef.current?.('error');
          throw new Error(`Token failed: ${res.status}`);
        }
        const json = await res.json();
        return {
          serverUrl: json.data.liveKitUrl,
          participantToken: json.data.token,
        };
      }),
    [],
  );

  const room = useMemo(
    () =>
      new Room({
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      }),
    [],
  );

  const session = useSession(tokenSource, { room });

  useEffect(() => {
    const handler = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload)) as {
          type: string;
          data: unknown;
        };
        onDataRef.current?.(msg);
      } catch {
        // ignore non-JSON payloads
      }
    };

    room.on(RoomEvent.DataReceived, handler);
    return () => {
      room.off(RoomEvent.DataReceived, handler);
    };
  }, [room]);

  return session;
}

function AudioUnlockButton() {
  const { mergedProps, canPlayAudio } = useStartAudio({ props: {} });
  if (canPlayAudio) return null;
  return (
    <button
      type="button"
      {...mergedProps}
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(77,234,255,0.15)',
        border: '1px solid rgba(77,234,255,0.5)',
        color: '#4deaff',
        padding: '12px 28px',
        borderRadius: 10,
        cursor: 'pointer',
        fontFamily: 'monospace',
        fontSize: 13,
        fontWeight: 700,
        zIndex: 200,
      }}
    >
      🔊 Tap to enable audio
    </button>
  );
}

function VoiceAssistantStateBridge({
  onStateChange,
}: {
  onStateChange?: (s: SorenVoiceState) => void;
}) {
  const { state: agentState } = useVoiceAssistant();

  useEffect(() => {
    if (agentState === 'speaking') {
      onStateChange?.('speaking');
    } else if (
      agentState === 'listening'
      || agentState === 'thinking'
      || agentState === 'idle'
      || agentState === 'initializing'
    ) {
      onStateChange?.('listening');
    }
  }, [agentState, onStateChange]);

  return null;
}

interface SorenVoiceProps {
  onStateChange?: (s: SorenVoiceState) => void;
  onData?: (msg: { type: string; data: unknown }) => void;
  children: (controls: {
    isConnected: boolean;
    state: SorenVoiceState;
    connect: () => void;
    disconnect: () => void;
  }) => ReactNode;
}

function SorenVoiceInner({
  onStateChange,
  onData,
  children,
}: SorenVoiceProps) {
  const [state, setState] = useState<SorenVoiceState>('idle');

  const handleState = useCallback(
    (s: SorenVoiceState) => {
      setState(s);
      onStateChange?.(s);
    },
    [onStateChange],
  );

  const session = useSorenSession(handleState, onData);

  useEffect(() => {
    const room = session.room;
    if (!room) return;

    const onConnected = () => {
      handleState('listening');
    };
    const onDisconnected = () => {
      handleState('idle');
    };

    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.Disconnected, onDisconnected);

    if (room.state === ConnectionState.Connected) {
      onConnected();
    }

    return () => {
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [session.room, handleState]);

  const connect = useCallback(async () => {
    try {
      const AC =
        window.AudioContext
        || (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AC) {
        const ctx = new AC();
        await ctx.resume();
        ctx.close();
      }
    } catch {
      // best-effort unlock
    }
    handleState('connecting');
    await session.start();
  }, [session, handleState]);

  const disconnect = useCallback(async () => {
    await session.end();
    handleState('idle');
  }, [session, handleState]);

  const isConnected =
    state !== 'idle' && state !== 'error' && state !== 'connecting';

  return (
    <SessionProvider session={session}>
      <RoomAudioRenderer />
      <AudioUnlockButton />
      <VoiceAssistantStateBridge onStateChange={handleState} />
      {children({
        isConnected,
        state,
        connect,
        disconnect,
      })}
    </SessionProvider>
  );
}

export function SorenVoice(props: SorenVoiceProps) {
  return <SorenVoiceInner {...props} />;
}
