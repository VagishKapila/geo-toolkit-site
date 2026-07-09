'use client';

import type { RailStep } from '@/lib/geoMetrics';

const STEPS: { id: RailStep; label: string }[] = [
  { id: 'input', label: 'Input' },
  { id: 'confirm', label: 'Confirm' },
  { id: 'scan', label: 'Scan' },
  { id: 'result', label: 'Result' },
  { id: 'investigate', label: 'Investigate' },
  { id: 'execute', label: 'Execute' },
];

export function StepRail({ active }: { active: RailStep }) {
  return (
    <div className="geo-hud-rail">
      {STEPS.map((s) => (
        <div
          key={s.id}
          className={`geo-hud-step${active === s.id ? ' active' : ''}`}
        >
          {s.label}
        </div>
      ))}
    </div>
  );
}
