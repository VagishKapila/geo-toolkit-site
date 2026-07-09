'use client';

interface Props {
  bottomText: string;
  onInput: () => void;
  onReset: () => void;
}

export function HudBottomBar({ bottomText, onInput, onReset }: Props) {
  return (
    <footer className="bottom">
      <div className="micZone">
        <button type="button" className="mic" aria-label="Microphone status">
          🎙
        </button>
        <div className="micText">
          <b>{bottomText}</b>
          <span>Type, confirm, scan, investigate, master repair plan.</span>
        </div>
      </div>
      <button type="button" className="btn secondary" onClick={onInput}>
        INPUT
      </button>
      <button type="button" className="btn red" onClick={onReset}>
        RESET
      </button>
    </footer>
  );
}
