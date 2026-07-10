'use client';

import { useRef } from 'react';

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
    <section className="screen active hero">
      <h2>Talk to Soren or type your website.</h2>
      <p>
        Soren welcomes every visitor and is ready to listen. Say the website
        naturally, or type it below. Soren then shows what it heard for eight
        seconds so the spelling can be corrected before the scan begins.
      </p>

      <div className="voiceEntryCard">
        <div className="voiceEntryCopy">
          <span className="voiceEyebrow">Voice-first experience</span>
          <h3>
            &ldquo;Hi, I&rsquo;m Soren. Tell me the website you&rsquo;d like me
            to check.&rdquo;
          </h3>
          <p>
            No typing is required. Speak the domain, and Soren will show what it
            heard with an 8-second edit window before starting the scan.
          </p>
        </div>
        <button
          type="button"
          aria-label="Start talking to Soren"
          className="voiceStartBtn"
          onClick={onStartVoice}
        >
          <span aria-hidden="true" className="voicePulse" />
          <span>
            <strong>Talk to Soren</strong>
            <small>Click once, then speak naturally</small>
          </span>
        </button>
      </div>

      <div className="entryDivider">
        <span>or type the website</span>
      </div>

      <div className="urlBox">
        <div>
          <label>Type Website URL</label>
          <input
            ref={inputRef}
            id="websiteInput"
            value={url}
            placeholder="varshyl.com"
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && url.trim() && onStart()}
          />
        </div>
        <button
          type="button"
          className="btn"
          disabled={!url.trim()}
          onClick={onStart}
        >
          Scan Typed Website
        </button>
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
      {error && (
        <div className="geo-hud-errorCard" role="alert">
          <b>Couldn&apos;t scan that website</b>
          <p>{error}</p>
        </div>
      )}
    </section>
  );
}

export function focusWebsiteInput() {
  const el = document.getElementById('websiteInput') as HTMLInputElement | null;
  el?.focus();
  el?.select();
}
