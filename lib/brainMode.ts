import type { BrainMode } from '@/components/SorenBrain';

type AgentState =
  | 'disconnected'
  | 'connecting'
  | 'pre-connect-buffering'
  | 'failed'
  | 'initializing'
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | undefined;

type Phase = 'input' | 'confirm' | 'scanning' | 'result';

export function resolveBrainMode(
  phase: Phase,
  agentState: AgentState | string | undefined,
  connected: boolean,
  voiceRequestedFix: boolean,
): BrainMode {
  if (phase === 'scanning') return 'scanning';
  if (phase === 'confirm') return 'confirming';
  if (phase === 'result') return voiceRequestedFix ? 'repair' : 'results';
  if (!connected) return 'idle';
  if (agentState === 'speaking') return 'speaking';
  if (agentState === 'thinking') return 'thinking';
  if (
    agentState === 'listening'
    || agentState === 'idle'
    || agentState === 'initializing'
    || agentState === 'pre-connect-buffering'
  ) {
    return 'listening';
  }
  return 'idle';
}
