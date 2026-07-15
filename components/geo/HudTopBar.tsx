'use client';

interface Props {
  status: string;
  muted: boolean;
  onMuteToggle: () => void;
  onStop: () => void;
  onEndSession: () => void;
  onHome: () => void;
}

export function HudTopBar({
  status,
  muted,
  onMuteToggle,
  onStop,
  onEndSession,
  onHome,
}: Props) {
  return (
    <header className="top">
      <div className="brand">
        <div className="logoMark" />
        <div>
          <h1>SOREN GEO</h1>
          <p>AI DISCOVERABILITY TOOLKIT · WORKING CLICK FLOW</p>
        </div>
      </div>
      <div className="topRight">
        <div className="status">{status}</div>
        <button
          type="button"
          className="topControl mute"
          onClick={onMuteToggle}
        >
          {muted ? 'Unmute' : 'Mute'}
        </button>
        <button type="button" className="topControl stop" onClick={onStop}>
          Stop
        </button>
        <button type="button" className="topControl end" onClick={onEndSession}>
          End Session
        </button>
        <a
          href="/"
          aria-label="Return home"
          className="homeIcon"
          title="Home"
          onClick={() => onHome()}
        >
          ⌂
        </a>
      </div>
    </header>
  );
}
