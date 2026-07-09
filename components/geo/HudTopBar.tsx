'use client';

interface Props {
  status: string;
  onHome: () => void;
}

export function HudTopBar({ status, onHome }: Props) {
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
        <button type="button" className="btn secondary" onClick={onHome}>
          HOME
        </button>
      </div>
    </header>
  );
}
