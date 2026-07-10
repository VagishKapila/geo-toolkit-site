'use client';

import type { BrainMode } from '@/components/SorenBrain';
import { SorenBrain } from '@/components/SorenBrain';

interface Props {
  brainMode: BrainMode;
  modeLine: string;
  onTalk: () => void;
  onTypeWebsite: () => void;
  onViewMaster: () => void;
  hasResult: boolean;
}

export function HudLeftPanel({
  brainMode,
  modeLine,
  onTalk,
  onTypeWebsite,
  onViewMaster,
  hasResult,
}: Props) {
  return (
    <section className="panel left">
      <div className="leftHead">
        <h2>SOREN</h2>
        <p>
          Jarvis-style HUD for GEO audit, voice confirmation, findings, and one
          Master Repair Plan.
        </p>
      </div>
      <div className="coreWrap">
        <div>
          <div className="core">
            <div className="brain-core">
              <SorenBrain mode={brainMode} />
            </div>
          </div>
          <div className="sorenLabel">SOREN</div>
          <div className="sorenMode">{modeLine}</div>
        </div>
      </div>
      <div className="leftActions">
        <button
          type="button"
          aria-label="Talk to Soren"
          className="btn primary talkSorenBtn"
          onClick={onTalk}
        >
          Talk to Soren
        </button>
        <button
          type="button"
          aria-label="Type a website instead"
          className="btn soft typeWebsiteBtn"
          onClick={onTypeWebsite}
        >
          Type Website Instead
        </button>
        {hasResult && (
          <button
            type="button"
            aria-label="View Master Repair Plan"
            className="btn warning"
            onClick={onViewMaster}
          >
            View Master Plan
          </button>
        )}
      </div>
    </section>
  );
}
