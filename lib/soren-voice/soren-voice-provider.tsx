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
  RoomAudioRenderer,
} from '@livekit/components-react';
import type { UseSessionReturn } from '@livekit/components-react';
import {
  ConnectionState,
  RoomEvent,
  type RemoteParticipant,
  type Room,
} from 'livekit-client';
import { AgentSessionProvider } from './agent-session-provider';
import { StartAudioButton } from './start-audio-button';
import { NameModal } from './name-modal';
import { fireActivationAudio } from './activation-audio';
import { mapAgentState, STATE_BADGE } from './agent-state';
import {
  clearSessionTokenCache,
  getSharedRoom,
  getSharedTokenSource,
  isRoomSessionLive,
  markSessionRequested,
  releaseConnect,
  teardownSession,
  tryAcquireConnect,
  voiceSessionLog,
} from './session-lifecycle';
import { useWakeTrigger } from './use-wake-trigger';
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

function VoiceAudioRenderer() {
  useEffect(() => {
    console.log('[voice] audio renderer mounted');
  }, []);
  return <RoomAudioRenderer />;
}

/**
 * LIVE voice stack — sole path from TALK TO SOREN → session.start().
 * HudLeftPanel onClick → GeoHud onTalk={activate} → connect() → session.start()
 */
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
  useWakeTrigger(room);

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
      <VoiceAudioRenderer />
      {showNameModal && <NameModal onSubmit={onNameSubmit} />}
      {children}
      <StartAudioButton label="🔊 Tap to enable audio" />
    </SorenVoiceContext.Provider>
  );
}

export function SorenVoiceProvider({ children }: { children: ReactNode }) {
  const [showNameModal, setShowNameModal] = useState(false);
  const pendingConnectRef = useRef(false);
  const connectAttemptRef = useRef(false);
  const agentJoinedRef = useRef(false);

  const room = getSharedRoom();
  const tokenSource = getSharedTokenSource();
  const session = useSession(tokenSource, { room });

  useEffect(() => {
    const onConnected = () => {
      console.log('[voice] connected');
    };
    const onParticipant = (p: RemoteParticipant) => {
      if (p.isAgent && !agentJoinedRef.current) {
        agentJoinedRef.current = true;
        console.log('[voice] agent joined');
      }
    };
    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.ParticipantConnected, onParticipant);
    return () => {
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.ParticipantConnected, onParticipant);
    };
  }, [room]);

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
      console.log('[voice] connect skipped — session already active or in flight');
      return;
    }
    connectAttemptRef.current = true;
    agentJoinedRef.current = false;
    try {
      if (room.state !== ConnectionState.Disconnected) {
        await room.disconnect();
      }
      clearSessionTokenCache();
      console.log('[voice] connecting');
      voiceSessionLog('Soren: Connecting…');
      await session.start();
    } catch (err) {
      console.error('[voice] connect failed', err);
      voiceSessionLog("Soren: I couldn't connect — try again");
    } finally {
      connectAttemptRef.current = false;
      releaseConnect();
    }
  }, [room, session]);

  const activate = useCallback(() => {
    if (isRoomSessionLive(room) || connectAttemptRef.current) {
      console.log('[voice] activate skipped — session already active');
      return;
    }
    markSessionRequested();
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
        console.log('[voice] name submit skipped — session already active');
        setShowNameModal(false);
        pendingConnectRef.current = false;
        return;
      }
      markSessionRequested();
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

export { setVoiceSessionLog } from './session-lifecycle';
