'use client';

import { useEffect, useRef } from 'react';
import type { GeoAudit } from '@/lib/geoApi';
import { projectedScore } from '@/lib/geoMetrics';

interface Props {
  mode: string;
  timerLabel: string;
  audit: GeoAudit | null;
  lines: string[];
}

function parseLogLine(line: string): { speaker: string; text: string } {
  const you = line.match(/^You:\s*(.*)$/);
  if (you) return { speaker: 'You', text: you[1] };
  const soren = line.match(/^Soren:\s*(.*)$/);
  if (soren) return { speaker: 'Soren', text: soren[1] };
  return { speaker: 'Soren', text: line };
}

export function HudRightRail({ mode, timerLabel, audit, lines }: Props) {
  const logRef = useRef<HTMLDivElement>(null);
  const issues = audit?.checks.filter((c) => !c.passed).length ?? null;
  const projected = audit ? projectedScore(audit) : null;

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

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
      <section className="panel logPanel">
        <div className="sideTitle">Conversation Log</div>
        <div className="log" ref={logRef}>
          {lines.map((line, i) => {
            const { speaker, text } = parseLogLine(line);
            return (
              <p key={`${line}-${i}`}>
                <b>{speaker}:</b> {text}
              </p>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
