'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';

interface Props {
  url: string;
  error: string | null;
  scanInFlight?: boolean;
  onUrlChange: (v: string) => void;
  onStart: () => void;
  onStartVoice: () => void;
}

function urlErrorMessage(error: string): string {
  if (/doesn't look like a valid website/i.test(error)) {
    return error;
  }
  if (/enter a website/i.test(error)) {
    return error;
  }
  return "We couldn't reach this website. Check the spelling and try again.";
}

export function GeoInputScreen({
  url,
  error,
  scanInFlight = false,
  onUrlChange,
  onStart,
  onStartVoice,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const scanning = scanInFlight || pending;

  useEffect(() => {
    if (error) setPending(false);
  }, [error]);

  const handleStart = () => {
    setPending(true);
    onStart();
  };

  return (
    <section className="screen active hero heroTextFirst">
      <h2>Check your website&apos;s AI readiness</h2>

      <div className="scanHeroForm">
        <label htmlFor="websiteInput" className="scanHeroLabel">
          Website URL
        </label>
        <div className="scanHeroRow">
          <input
            ref={inputRef}
            id="websiteInput"
            className="scanHeroInput"
            value={url}
            placeholder="example.com"
            autoComplete="url"
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && url.trim() && !scanning && handleStart()}
          />
          <button
            type="button"
            className={`scanWebsiteBtn${scanning ? ' scanWebsiteBtn--scanning' : ''}`}
            disabled={!url.trim() || scanning}
            onClick={handleStart}
          >
            {scanning ? 'Scanning…' : 'Scan Website'}
          </button>
        </div>
        {error && (
          <div className="urlScanError" role="alert">
            <span aria-hidden="true">⚠️</span>
            <span>{urlErrorMessage(error)}</span>
          </div>
        )}
      </div>

      <div className="entryDivider heroVoiceDivider">
        <span>or</span>
      </div>

      <div className="orTalkToSoren">
        <p className="orTalkLabel">Or talk to Soren</p>
        <button
          type="button"
          aria-label="Talk to Soren — say your website URL out loud"
          className="orTalkBtn"
          onClick={onStartVoice}
        >
          <Mic size={18} aria-hidden="true" />
          <span>Say your URL out loud — Soren listens and confirms spelling</span>
        </button>
      </div>

      <div className="startCards heroBelowFold">
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
    </section>
  );
}

export function focusWebsiteInput() {
  const el = document.getElementById('websiteInput') as HTMLInputElement | null;
  el?.focus();
  el?.select();
}
