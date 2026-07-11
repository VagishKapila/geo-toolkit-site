'use client';

import { useRef } from 'react';

interface ConfirmProps {
  heardUrl: string;
  countdown: number;
  editing: boolean;
  scanInFlight?: boolean;
  onEdit: () => void;
  onConfirmNow: () => void;
  onHeardChange: (v: string) => void;
  onSaveScan: () => void;
  onResume: () => void;
}

export function GeoConfirmScreen({
  heardUrl,
  countdown,
  editing,
  scanInFlight = false,
  onEdit,
  onConfirmNow,
  onHeardChange,
  onSaveScan,
  onResume,
}: ConfirmProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const focusAndPause = () => {
    onEdit();
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  return (
    <section className="screen active">
      <div className="confirmBig">
        <label>Soren heard this website</label>
        <div
          className="heardCard"
          role="button"
          tabIndex={0}
          onClick={focusAndPause}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              focusAndPause();
            }
          }}
        >
          <input
            ref={inputRef}
            className="heardInput"
            value={heardUrl}
            aria-label="Heard website URL"
            onChange={(e) => onHeardChange(e.target.value)}
            onFocus={onEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSaveScan();
              }
            }}
          />
          <small>Click this card to pause the countdown and edit spelling.</small>
        </div>
        <div className="confirmRow">
          <div className="timer">{countdown}</div>
          <button type="button" className="btn secondary" onClick={focusAndPause}>
            EDIT SPELLING
          </button>
          <button
            type="button"
            className={`btn amber${scanInFlight ? ' scanWebsiteBtn--scanning' : ''}`}
            disabled={scanInFlight}
            onClick={onConfirmNow}
          >
            {scanInFlight ? 'Scanning…' : 'CONFIRM NOW'}
          </button>
        </div>
        {editing && (
          <div className="editActions">
            <button
              type="button"
              className={`btn${scanInFlight ? ' scanWebsiteBtn--scanning' : ''}`}
              disabled={scanInFlight}
              onClick={onSaveScan}
            >
              {scanInFlight ? 'Scanning…' : 'SAVE & SCAN'}
            </button>
            <button type="button" className="btn secondary" onClick={onResume}>
              RESUME 8 SEC
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
