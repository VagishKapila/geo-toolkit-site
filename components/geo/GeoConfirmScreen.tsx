'use client';

interface ConfirmProps {
  heardUrl: string;
  countdown: number;
  editing: boolean;
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
  onEdit,
  onConfirmNow,
  onHeardChange,
  onSaveScan,
  onResume,
}: ConfirmProps) {
  return (
    <section className="geo-screen geo-confirm">
      <label>Soren heard this website</label>
      <button type="button" className="geo-heard" onClick={onEdit}>
        {heardUrl}
        <small>Tap to pause and edit spelling.</small>
      </button>
      {!editing ? (
        <div className="geo-confirm-row">
          <div className="geo-timer">{countdown}</div>
          <button type="button" className="geo-btn" onClick={onEdit}>
            EDIT SPELLING
          </button>
          <button type="button" className="geo-btn geo-btn-primary" onClick={onConfirmNow}>
            CONFIRM NOW
          </button>
        </div>
      ) : (
        <div className="geo-confirm-row geo-confirm-edit">
          <input
            autoFocus
            value={heardUrl}
            onChange={(e) => onHeardChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSaveScan()}
          />
          <button type="button" className="geo-btn geo-btn-primary" onClick={onSaveScan}>
            SAVE &amp; SCAN
          </button>
          <button type="button" className="geo-btn" onClick={onResume}>
            RESUME 8 SEC
          </button>
        </div>
      )}
    </section>
  );
}
