'use client';

/**
 * AgentSessionProvider
 *
 * Thin wrapper that:
 *  - Provides the livekit SessionContext via <SessionProvider>
 *  - Mounts <RoomAudioRenderer> so remote audio plays automatically
 *
 * Usage:
 *   const session = useSession(tokenFactory);
 *   <AgentSessionProvider session={session}>…</AgentSessionProvider>
 */

import { SessionProvider, RoomAudioRenderer } from '@livekit/components-react';
import type { UseSessionReturn } from '@livekit/components-react';
import type { ReactNode } from 'react';

interface AgentSessionProviderProps {
  session: UseSessionReturn;
  children: ReactNode;
}

export function AgentSessionProvider({ session, children }: AgentSessionProviderProps) {
  return (
    <SessionProvider session={session}>
      <RoomAudioRenderer />
      {children}
    </SessionProvider>
  );
}
