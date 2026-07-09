'use client';

import { useEffect, useRef } from 'react';
import { useChat, type ReceivedChatMessage } from '@livekit/components-react';

/** Sync HUD useChat messages into GEO conversation log lines. */
export function useSorenChatLog(onAppend: (line: string) => void) {
  const { chatMessages } = useChat();
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const msg of chatMessages) {
      if (seenRef.current.has(msg.id)) continue;
      seenRef.current.add(msg.id);
      const isLocal =
        (msg as ReceivedChatMessage & { isLocal?: boolean }).isLocal
        ?? msg.from?.isLocal
        ?? false;
      const prefix = isLocal ? 'You' : 'Soren';
      onAppend(`${prefix}: ${msg.message}`);
    }
  }, [chatMessages, onAppend]);
}
