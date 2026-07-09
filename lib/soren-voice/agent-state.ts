export type HudAgentState =
  | 'connecting'
  | 'initializing'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'disconnected';

export function mapAgentState(raw: string | undefined): HudAgentState {
  if (!raw) return 'connecting';
  if (raw === 'listening') return 'listening';
  if (raw === 'thinking') return 'thinking';
  if (raw === 'speaking') return 'speaking';
  if (raw === 'disconnected') return 'disconnected';
  if (raw === 'initializing') return 'initializing';
  return 'connecting';
}

export const STATE_BADGE: Record<HudAgentState, string> = {
  connecting: '○ CONNECTING',
  initializing: '○ INITIALIZING',
  listening: '◉ AWAITING INPUT',
  thinking: '◇ REASONING',
  speaking: '◈ SYNTHESIZING',
  disconnected: '○ STANDBY',
};
