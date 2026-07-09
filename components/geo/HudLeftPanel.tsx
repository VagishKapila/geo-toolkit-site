'use client';

import type { BrainMode } from '@/components/SorenBrain';
import { SorenBrain } from '@/components/SorenBrain';

interface Props {
  brainMode: BrainMode;
  modeLine: string;
  connected: boolean;
  onTalk: () => void;
  onTypedStart: () => void;
  onViewMaster: () => void;
  hasResult: boolean;
}

export function HudLeftPanel({
  brainMode,
  modeLine,
  connected,
  onTalk,
  onTypedStart,
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
        {!connected && (
          <button type="button" className="btn" onClick={onTalk}>
            TALK TO SOREN
          </button>
        )}
        <button type="button" className="btn secondary" onClick={onTypedStart}>
          CHECK TYPED WEBSITE
        </button>
        {hasResult && (
          <button type="button" className="btn amber" onClick={onViewMaster}>
            VIEW MASTER PLAN
          </button>
        )}
      </div>
    </section>
  );
}
