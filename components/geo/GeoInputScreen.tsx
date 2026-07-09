'use client';

interface Props {
  url: string;
  error: string | null;
  onUrlChange: (v: string) => void;
  onStart: () => void;
}

export function GeoInputScreen({ url, error, onUrlChange, onStart }: Props) {
  return (
    <section className="screen active hero">
      <h2>Type or speak the website.</h2>
      <p>
        This is the step that was missing. The input is large, obvious, and
        clickable. After this, Soren shows an 8-second confirmation card so the
        user can correct accent/spelling issues before the scan runs.
      </p>
      <div className="urlBox">
        <div>
          <label>Website URL</label>
          <input
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
          START
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
      {error && <p className="geo-hud-error">{error}</p>}
    </section>
  );
}
