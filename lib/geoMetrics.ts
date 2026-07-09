import type { GeoAudit } from '@/lib/geoApi';

export function projectedScore(audit: GeoAudit): number {
  const recoverable = audit.checks
    .filter((c) => !c.passed)
    .reduce((sum, c) => sum + (c.maxPoints ?? 0), 0);
  return Math.min(99, audit.score + recoverable);
}

export type RailStep =
  | 'input'
  | 'confirm'
  | 'scan'
  | 'result'
  | 'investigate'
  | 'execute';

export function phaseToRail(phase: string): RailStep {
  if (phase === 'scanning') return 'scan';
  if (phase === 'input' || phase === 'confirm' || phase === 'result') {
    return phase as RailStep;
  }
  return 'input';
}

export function sessionStatusLabel(
  connected: boolean,
  agentState: string | undefined,
): string {
  if (!connected) return 'READY';
  if (
    !agentState
    || agentState === 'disconnected'
    || agentState === 'failed'
  ) {
    return 'READY';
  }
  return agentState.toUpperCase();
}
