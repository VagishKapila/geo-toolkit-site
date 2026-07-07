'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const CHAT_URL = 'https://toolkit-demo-host-production-ac14.up.railway.app/api/soren/chat';
const GEO_URL = 'https://toolkit-demo-host-production-ac14.up.railway.app/api/geo-audit';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AuditResult {
  url: string;
  score: number;
  grade: string;
  topFixes: string[];
  checks: { name: string; passed: boolean; maxPoints: number }[];
}

interface ChatResponsePayload {
  reply?: string;
}

interface UseSorenChatReturn {
  messages: ChatMessage[];
  auditResult: AuditResult | null;
  isThinking: boolean;
  sendMessage: (text: string) => Promise<string>;
  runAuditFromChat: (url: string) => Promise<void>;
  reset: () => void;
}

export function useSorenChat(onReply: (text: string) => void): UseSorenChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [isThinking, setIsThinking] = useState(false);

  const auditRef = useRef<AuditResult | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string): Promise<string> => {
      const userMessage: ChatMessage = { role: 'user', content: text };
      const outgoingMessages = [...messagesRef.current, userMessage];
      setMessages(outgoingMessages);
      setIsThinking(true);

      try {
        const res = await fetch(CHAT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: outgoingMessages,
            auditContext: auditRef.current,
          }),
        });

        const data = (await res.json()) as ChatResponsePayload;
        const reply = data.reply ?? "I'm having trouble responding right now.";
        const assistantMessage: ChatMessage = { role: 'assistant', content: reply };
        const updatedMessages = [...outgoingMessages, assistantMessage];
        setMessages(updatedMessages);
        onReply(reply);
        return reply;
      } catch {
        const fallback = 'I lost connection. Try again.';
        const assistantMessage: ChatMessage = { role: 'assistant', content: fallback };
        setMessages((prev) => [...prev, assistantMessage]);
        onReply(fallback);
        return fallback;
      } finally {
        setIsThinking(false);
      }
    },
    [onReply]
  );

  const runAuditFromChat = useCallback(
    async (url: string): Promise<void> => {
      setIsThinking(true);
      try {
        const res = await fetch(GEO_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });

        const data = (await res.json()) as AuditResult;
        auditRef.current = data;
        setAuditResult(data);

        const summary = `I just checked ${url}. Score is ${data.score} out of 100, grade ${data.grade}. ${
          data.topFixes?.length
            ? `Top issues: ${data.topFixes.slice(0, 2).join(' and ')}`
            : 'All signals look good.'
        }`;

        const summaryMessages: ChatMessage[] = [
          ...messagesRef.current,
          { role: 'user', content: `Check my website: ${url}` },
          { role: 'assistant', content: summary },
        ];
        setMessages(summaryMessages);

        await sendMessage(
          `I just ran the audit on ${url}. Score: ${data.score}/100. Please summarize the results for me.`
        );
      } catch {
        const fallback = 'I could not reach that site. Make sure it is live and try again.';
        setMessages((prev) => [...prev, { role: 'assistant', content: fallback }]);
        onReply(fallback);
      } finally {
        setIsThinking(false);
      }
    },
    [onReply, sendMessage]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setAuditResult(null);
    auditRef.current = null;
    messagesRef.current = [];
  }, []);

  return { messages, auditResult, isThinking, sendMessage, runAuditFromChat, reset };
}
