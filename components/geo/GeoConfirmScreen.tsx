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
    <section className="screen active">
      <div className="confirmBig">
        <label>Soren heard this website</label>
        <button type="button" className="heard" onClick={onEdit}>
          {heardUrl}
          <small>Click this card to pause the countdown and edit spelling.</small>
        </button>
        <div className="confirmRow">
          <div className="timer">{countdown}</div>
          <button type="button" className="btn secondary" onClick={onEdit}>
            EDIT SPELLING
          </button>
          <button type="button" className="btn amber" onClick={onConfirmNow}>
            CONFIRM NOW
          </button>
        </div>
        <div className={`editPanel${editing ? ' show' : ''}`}>
          <input
            autoFocus={editing}
            value={heardUrl}
            onChange={(e) => onHeardChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSaveScan()}
          />
          <button type="button" className="btn" onClick={onSaveScan}>
            SAVE &amp; SCAN
          </button>
          <button type="button" className="btn secondary" onClick={onResume}>
            RESUME 8 SEC
          </button>
        </div>
      </div>
    </section>
  );
}
