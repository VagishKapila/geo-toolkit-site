'use client';

import { Mic } from 'lucide-react';
import type { BrainMode } from '@/components/SorenBrain';
import { SorenBrain } from '@/components/SorenBrain';

interface Props {
  brainMode: BrainMode;
  modeLine: string;
  connected: boolean;
  onTalk: () => void;
  onEnterUrl: () => void;
  onViewMaster: () => void;
  hasResult: boolean;
  showEnterUrl: boolean;
}

export function HudLeftPanel({
  brainMode,
  modeLine,
  connected,
  onTalk,
  onEnterUrl,
  onViewMaster,
  hasResult,
  showEnterUrl,
}: Props) {
  return (
    <section className="panel left">
      <div className="leftHead">
        <h2>SOREN</h2>
        <p>
          Ambient GEO assistant — brain stays live while you type or talk.
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
        {showEnterUrl && (
          <button
            type="button"
            aria-label="Enter a website URL"
            className="btn soft enterUrlBtn"
            onClick={onEnterUrl}
          >
            Check another URL
          </button>
        )}
        <button
          type="button"
          aria-label={connected ? 'Start a new conversation' : 'Talk to Soren'}
          className="btn soft talkSorenBtn"
          onClick={onTalk}
        >
          <Mic size={16} aria-hidden="true" />
          {connected ? 'New Conversation' : 'Talk to Soren'}
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
