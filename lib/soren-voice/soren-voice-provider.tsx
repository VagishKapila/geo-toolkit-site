'use client';

import {
  createContext,
  useCallback,
  useContext,
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
import { TokenSource, Room } from 'livekit-client';
import { AgentSessionProvider } from './agent-session-provider';
import { StartAudioButton } from './start-audio-button';
import { NameModal } from './name-modal';
import { fireActivationAudio } from './activation-audio';
import { mintVoiceToken } from './mint-voice-token';
import {
  PERSONA,
  PRODUCT_ID,
  TOKEN_URL,
  USER_NAME_KEY,
} from './constants';
import { mapAgentState, STATE_BADGE } from './agent-state';

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

/** HUD app.tsx voice brainstem — verbatim session/room/token wiring. */
export function SorenVoiceProvider({ children }: { children: ReactNode }) {
  const [showNameModal, setShowNameModal] = useState(false);
  const pendingConnectRef = useRef(false);

  const tokenSource = useMemo(
    () =>
      TokenSource.custom(async () => {
        const userVoiceToken = await mintVoiceToken();
        const storedName = localStorage.getItem(USER_NAME_KEY);

        const body: Record<string, unknown> = {
          persona: PERSONA,
          productId: PRODUCT_ID,
        };
        if (userVoiceToken) body.userVoiceToken = userVoiceToken;
        if (storedName) body.userName = storedName;

        const res = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          throw new Error(`Token fetch failed: ${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        if (json.error) throw new Error(`Token error: ${json.message}`);
        return { serverUrl: json.data.liveKitUrl, participantToken: json.data.token };
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

  const connect = useCallback(() => {
    console.log('[HUD] session.start()');
    session.start();
  }, [session]);

  const activate = useCallback(() => {
    fireActivationAudio();
    const storedName = localStorage.getItem(USER_NAME_KEY);
    if (!storedName) {
      pendingConnectRef.current = true;
      setShowNameModal(true);
      return;
    }
    connect();
  }, [connect]);

  const handleNameSubmit = useCallback(
    (name: string) => {
      localStorage.setItem(USER_NAME_KEY, name);
      setShowNameModal(false);
      if (pendingConnectRef.current) {
        pendingConnectRef.current = false;
        connect();
      }
    },
    [connect],
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
