'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  useSession,
  useSessionContext,
  useVoiceAssistant,
} from '@livekit/components-react';
import type { UseSessionReturn } from '@livekit/components-react';
import { ConnectionState, type Room } from 'livekit-client';
import { AgentSessionProvider } from './agent-session-provider';
import { StartAudioButton } from './start-audio-button';
import { NameModal } from './name-modal';
import { fireActivationAudio } from './activation-audio';
import { mapAgentState, STATE_BADGE } from './agent-state';
import {
  armTokenFetch,
  getSharedRoom,
  getSharedTokenSource,
  isRoomSessionLive,
  releaseConnect,
  resetForNewSession,
  teardownSession,
  tryAcquireConnect,
} from './session-lifecycle';
import { USER_NAME_KEY } from './constants';

export interface SorenVoiceContextValue {
  room: Room;
  session: UseSessionReturn;
  activate: () => void;
  isConnected: boolean;
  rawAgentState: string | undefined;
  agentBadge: string;
  statusLabel: string;
}

const SorenVoiceContext = createContext<SorenVoiceContextValue | null>(null);

function SorenVoiceBridge({
  room,
  session,
  activate,
  showNameModal,
  onNameSubmit,
  children,
}: {
  room: Room;
  session: UseSessionReturn;
  activate: () => void;
  showNameModal: boolean;
  onNameSubmit: (name: string) => void;
  children: ReactNode;
}) {
  const { isConnected } = useSessionContext();
  const { state: rawAgentState } = useVoiceAssistant();
  const agentState = mapAgentState(rawAgentState as string | undefined);
  const agentBadge = STATE_BADGE[agentState] ?? '○ STANDBY';
  const statusLabel = isConnected ? agentBadge.replace(/^[○◉◈◇]\s*/, '') : 'READY';

  const value = useMemo<SorenVoiceContextValue>(
    () => ({
      room,
      session,
      activate,
      isConnected,
      rawAgentState: rawAgentState as string | undefined,
      agentBadge,
      statusLabel,
    }),
    [room, session, activate, isConnected, rawAgentState, agentBadge, statusLabel],
  );

  return (
    <SorenVoiceContext.Provider value={value}>
      {showNameModal && <NameModal onSubmit={onNameSubmit} />}
      {children}
      <StartAudioButton label="🔊 Tap to enable audio" />
    </SorenVoiceContext.Provider>
  );
}

/** HUD voice brainstem — one room, one token per user-initiated session. */
export function SorenVoiceProvider({ children }: { children: ReactNode }) {
  const [showNameModal, setShowNameModal] = useState(false);
  const pendingConnectRef = useRef(false);
  const connectAttemptRef = useRef(false);

  const room = getSharedRoom();
  const tokenSource = getSharedTokenSource();
  const session = useSession(tokenSource, { room });

  useEffect(() => {
    const onUnload = () => {
      void teardownSession(room);
    };
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [room]);

  const connect = useCallback(async () => {
    if (connectAttemptRef.current || isRoomSessionLive(room) || !tryAcquireConnect()) {
      console.log('[HUD] connect skipped — session already active or in flight');
      return;
    }
    connectAttemptRef.current = true;
    try {
      if (room.state !== ConnectionState.Disconnected) {
        await room.disconnect();
      }
      resetForNewSession();
      armTokenFetch();
      console.log('[HUD] session.start()');
      await session.start();
    } finally {
      connectAttemptRef.current = false;
      releaseConnect();
    }
  }, [room, session]);

  const activate = useCallback(() => {
    if (isRoomSessionLive(room) || connectAttemptRef.current) {
      console.log('[HUD] activate skipped — session already active');
      return;
    }
    fireActivationAudio();
    const storedName = localStorage.getItem(USER_NAME_KEY);
    if (!storedName) {
      pendingConnectRef.current = true;
      setShowNameModal(true);
      return;
    }
    void connect();
  }, [connect, room]);

  const handleNameSubmit = useCallback(
    (name: string) => {
      if (isRoomSessionLive(room) || connectAttemptRef.current) {
        console.log('[HUD] name submit skipped — session already active');
        setShowNameModal(false);
        pendingConnectRef.current = false;
        return;
      }
      localStorage.setItem(USER_NAME_KEY, name);
      setShowNameModal(false);
      if (pendingConnectRef.current) {
        pendingConnectRef.current = false;
        void connect();
      }
    },
    [connect, room],
  );

  return (
    <AgentSessionProvider session={session}>
      <SorenVoiceBridge
        room={room}
        session={session}
        activate={activate}
        showNameModal={showNameModal}
        onNameSubmit={handleNameSubmit}
      >
        {children}
      </SorenVoiceBridge>
    </AgentSessionProvider>
  );
}

export function useSorenVoice(): SorenVoiceContextValue {
  const ctx = useContext(SorenVoiceContext);
  if (!ctx) {
    throw new Error('useSorenVoice must be used within SorenVoiceProvider');
  }
  return ctx;
}
