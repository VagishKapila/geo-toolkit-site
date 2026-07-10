'use client';

import { useRef } from 'react';
import { Mic } from 'lucide-react';

interface Props {
  url: string;
  error: string | null;
  onUrlChange: (v: string) => void;
  onStart: () => void;
  onStartVoice: () => void;
}

export function GeoInputScreen({
  url,
  error,
  onUrlChange,
  onStart,
  onStartVoice,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="screen active hero heroTextFirst">
      <h2>Check your website</h2>
      <p>
        Enter any live URL for a free GEO readiness scan. You&apos;ll confirm
        spelling for eight seconds before the scan begins.
      </p>

      <div className="urlBox urlBoxHero">
        <div>
          <label htmlFor="websiteInput">Website URL</label>
          <input
            ref={inputRef}
            id="websiteInput"
            value={url}
            placeholder="example.com"
            autoComplete="url"
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && url.trim() && onStart()}
          />
        </div>
        <button
          type="button"
          className="btn primary startScanBtn"
          disabled={!url.trim()}
          onClick={onStart}
        >
          START
        </button>
      </div>

      <div className="voiceSecondaryRow">
        <button
          type="button"
          aria-label="Talk to Soren instead of typing"
          className="voiceSecondaryBtn"
          onClick={onStartVoice}
        >
          <Mic size={16} aria-hidden="true" />
          Talk to Soren instead
        </button>
        <span className="voiceSecondaryHint">Optional — speak your URL naturally</span>
      </div>

      <div className="startCards">
        <div className="infoCard">
          <b>Analysis first</b>
          <p>
            Findings open as dropdown investigation cards. No single-fix pricing
            appears there.
          </p>
        </div>
        <div className="infoCard">
          <b>Execution second</b>
          <p>One Master Repair Plan packages every recommended fix together.</p>
        </div>
      </div>
      {error && <p className="geo-hud-error">{error}</p>}
    </section>
  );
}

export function focusWebsiteInput() {
  const el = document.getElementById('websiteInput') as HTMLInputElement | null;
  el?.focus();
  el?.select();
}
