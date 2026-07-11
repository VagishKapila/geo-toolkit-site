'use client';

import { useEffect, useRef } from 'react';
import {
  RoomEvent,
  type Participant,
  type Room,
  type TranscriptionSegment,
} from 'livekit-client';

const SDK_NOISE_PATTERN =
  /connected to.*Server|connection state changed|publishing track|signal connect|unpublishing track/i;

function isFilteredTranscript(text: string): boolean {
  if (text.length < 3) return true;
  return SDK_NOISE_PATTERN.test(text);
}

export interface TranscriptLogHandlers {
  onUserLine: (text: string) => void;
  onSorenLine: (text: string) => void;
}

/**
 * Subscribe to LiveKit voice STT transcripts (not text chat).
 * livekit-client@2.20.1 delivers finals on RoomEvent.TranscriptionReceived.
 */
export function useTranscriptLog(room: Room, handlers: TranscriptLogHandlers) {
  const seenRef = useRef<Set<string>>(new Set());
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onTranscription = (
      segments: TranscriptionSegment[],
      participant?: Participant,
    ) => {
      const localIdentity = room.localParticipant.identity;

      for (const segment of segments) {
        if (!segment.final) continue;
        if (seenRef.current.has(segment.id)) continue;
        seenRef.current.add(segment.id);

        const text = segment.text.trim();
        if (!text) continue;

        const isLocal =
          participant?.isLocal === true
          || participant?.identity === localIdentity;

        if (isLocal && isFilteredTranscript(text)) {
          console.debug('[transcript] filtered SDK noise', text);
          continue;
        }

        if (isLocal) {
          handlersRef.current.onUserLine(text);
        } else {
          handlersRef.current.onSorenLine(text);
        }
      }
    };

    room.on(RoomEvent.TranscriptionReceived, onTranscription);
    return () => {
      room.off(RoomEvent.TranscriptionReceived, onTranscription);
    };
  }, [room]);

  useEffect(() => {
    const onDisconnected = () => {
      seenRef.current.clear();
    };
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [room]);
}
