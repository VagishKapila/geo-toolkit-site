'use client';

import type { GeoAudit } from '@/lib/geoApi';
import { projectedScore } from '@/lib/geoMetrics';

const CALENDLY = 'https://calendly.com/vaakapila';

interface Props {
  audit: GeoAudit;
  onOpenFix: () => void;
  onLog: (msg: string) => void;
}

export function MasterPlan({ audit, onOpenFix, onLog }: Props) {
  const projected = projectedScore(audit);

  return (
    <section className="screen active">
      <div className="masterHero">
        <h2>Master Repair Plan</h2>
        <p>
          One plan fixes the full scan. This is not one problem at a time. It
          packages every failing GEO signal into one complete repair plan.
        </p>
        <div className="beforeAfter">
          <div className="ba">
            <span>Current</span>
            <b style={{ color: 'var(--red)' }}>{audit.score}</b>
          </div>
          <div className="arrow">→</div>
          <div className="ba">
            <span>Projected</span>
            <b style={{ color: 'var(--green)' }}>{projected}</b>
          </div>
        </div>
      </div>
      <div className="execGrid">
        <div className="execCard">
          <h3>Do it yourself</h3>
          <div className="price">ZIP</div>
          <p>
            One complete package with files, snippets, and instructions. No
            payment. We ask for a GitHub star if it helps.
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              onLog('DIY complete ZIP selected.');
              onOpenFix();
            }}
          >
            DOWNLOAD PACKAGE
          </button>
        </div>
        <div className="execCard">
          <h3>AI Assist</h3>
          <div className="price">$1.99</div>
          <p>
            Soren writes one complete prompt and code package for Claude,
            ChatGPT, or Cursor.
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              onLog('AI Assist selected.');
              onOpenFix();
            }}
          >
            USE AI ASSIST
          </button>
        </div>
        <div className="execCard">
          <h3>Done with you</h3>
          <div className="price">$5</div>
          <p>
            Soren guides the full repair plan with you and re-checks the score
            afterward.
          </p>
          <button
            type="button"
            className="btn amber"
            onClick={() => {
              onLog('Done-with-you full fix selected.');
              window.open(CALENDLY, '_blank', 'noopener,noreferrer');
            }}
          >
            START FULL FIX
          </button>
        </div>
      </div>
    </section>
  );
}
