'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useVoiceAssistant } from '@livekit/components-react';
import {
  ParticipantKind,
  Room,
  RoomEvent,
  type RemoteParticipant,
} from 'livekit-client';
import { isIntroDone, onIntroDone, resetIntroSession } from './intro-session';

/** Matches varshyl-voice agent-entry.ts WAKE_TOPIC + test.html publishData. */
const WAKE_TOPIC = 'wake-trigger';
const WAKE_DELAY_MS = 300;
const PUBLISH_ON_BEHALF_ATTR = 'lk.publish_on_behalf';

function publishWakeTrigger(room: Room) {
  const payload = new TextEncoder().encode(
    JSON.stringify({ type: 'wake-trigger' }),
  );
  return room.localParticipant.publishData(payload, {
    reliable: true,
    topic: WAKE_TOPIC,
  });
}

function isPrimaryAgent(participant: RemoteParticipant): boolean {
  return (
    participant.kind === ParticipantKind.AGENT
    && !(PUBLISH_ON_BEHALF_ATTR in participant.attributes)
  );
}

/**
 * Publish wake-trigger once agent has joined AND intro mp3s finished,
 * then +300ms. Once per agent; rearm on disconnect.
 */
export function useWakeTrigger(room: Room) {
  const { agent } = useVoiceAssistant();
  const sentForAgentRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentIdentityRef = useRef<string | null>(null);

  const disarm = useCallback(() => {
    sentForAgentRef.current = null;
    agentIdentityRef.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    resetIntroSession();
  }, []);

  const tryScheduleWake = useCallback(() => {
    const agentIdentity = agentIdentityRef.current;
    if (!agentIdentity || !isIntroDone()) return;
    if (sentForAgentRef.current === agentIdentity) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      sentForAgentRef.current = agentIdentity;
      void publishWakeTrigger(room)
        .then(() => console.log('[wake] trigger sent to agent'))
        .catch(() => {
          sentForAgentRef.current = null;
        });
    }, WAKE_DELAY_MS);
  }, [room]);

  const noteAgent = useCallback(
    (agentIdentity: string) => {
      agentIdentityRef.current = agentIdentity;
      tryScheduleWake();
    },
    [tryScheduleWake],
  );

  useEffect(() => {
    if (!agent) return;
    noteAgent(agent.identity);
  }, [agent, noteAgent]);

  useEffect(() => {
    return onIntroDone(() => {
      tryScheduleWake();
    });
  }, [tryScheduleWake]);

  useEffect(() => {
    const onParticipantConnected = (participant: RemoteParticipant) => {
      if (!isPrimaryAgent(participant)) return;
      noteAgent(participant.identity);
    };

    room.on(RoomEvent.Disconnected, disarm);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    return () => {
      room.off(RoomEvent.Disconnected, disarm);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      disarm();
    };
  }, [room, disarm, noteAgent]);
}
