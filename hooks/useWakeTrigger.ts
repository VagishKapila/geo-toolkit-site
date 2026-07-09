'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useVoiceAssistant } from '@livekit/components-react';
import {
  ParticipantKind,
  Room,
  RoomEvent,
  type RemoteParticipant,
} from 'livekit-client';

/** Matches varshyl-voice agent-entry.ts WAKE_TOPIC + test.html publishData. */
const WAKE_TOPIC = 'wake-trigger';
const AGENT_JOIN_DELAY_MS = 500;
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

/** Publish wake-trigger once the agent participant is present (not on room connect). */
export function useWakeTrigger(room: Room) {
  const { agent } = useVoiceAssistant();
  const sentForAgentRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleForAgent = useCallback(
    (agentIdentity: string) => {
      if (sentForAgentRef.current === agentIdentity) return;
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        sentForAgentRef.current = agentIdentity;
        void publishWakeTrigger(room)
          .then(() => console.info('[wake] trigger sent to agent'))
          .catch(() => {
            sentForAgentRef.current = null;
          });
      }, AGENT_JOIN_DELAY_MS);
    },
    [room],
  );

  useEffect(() => {
    if (!agent) return;
    scheduleForAgent(agent.identity);
  }, [agent, scheduleForAgent]);

  useEffect(() => {
    const disarm = () => {
      sentForAgentRef.current = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const onParticipantConnected = (participant: RemoteParticipant) => {
      if (!isPrimaryAgent(participant)) return;
      scheduleForAgent(participant.identity);
    };

    room.on(RoomEvent.Disconnected, disarm);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    return () => {
      room.off(RoomEvent.Disconnected, disarm);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      disarm();
    };
  }, [room, scheduleForAgent]);
}
