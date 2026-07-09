'use client';

import type { GeoAudit } from '@/lib/geoApi';
import { projectedScore } from '@/lib/geoMetrics';

interface Props {
  mode: string;
  timerLabel: string;
  audit: GeoAudit | null;
  lines: string[];
}

export function HudRightRail({ mode, timerLabel, audit, lines }: Props) {
  const issues = audit?.checks.filter((c) => !c.passed).length ?? null;
  const projected = audit ? projectedScore(audit) : null;

  return (
    <aside className="right">
      <section className="panel">
        <div className="sideTitle">System</div>
        <div className="sideBlock">
          <div className="row">
            <span>Mode</span>
            <b>{mode}</b>
          </div>
          <div className="row">
            <span>Timer</span>
            <b>{timerLabel}</b>
          </div>
          <div className="row">
            <span>Product</span>
            <b>GEO Toolkit</b>
          </div>
          <div className="row">
            <span>Plan</span>
            <b>Master Repair</b>
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="sideTitle">Metrics</div>
        <div className="sideBlock">
          <div className="row">
            <span>Current Score</span>
            <b>{audit ? audit.score : '—'}</b>
          </div>
          <div className="row">
            <span>Projected Score</span>
            <b>{projected ?? '—'}</b>
          </div>
          <div className="row">
            <span>Issues</span>
            <b>{issues ?? '—'}</b>
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="sideTitle">Conversation Log</div>
        <div className="log">
          {lines.map((line, i) => (
            <p key={`${line}-${i}`}>
              <b>Soren:</b> {line}
            </p>
          ))}
        </div>
      </section>
    </aside>
  );
}
