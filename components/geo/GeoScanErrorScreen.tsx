'use client';

interface Props {
  url: string;
  message: string;
  onTryAgain: () => void;
  onEditUrl: () => void;
}

export function GeoScanErrorScreen({ url, message, onTryAgain, onEditUrl }: Props) {
  return (
    <section className="screen active scanErrorScreen">
      <div className="scanErrorCard">
        <span className="scanErrorEyebrow">Scan could not complete</span>
        <h2>Couldn&apos;t reach that website</h2>
        <p className="scanErrorTarget">
          <b>{url}</b>
        </p>
        <p className="scanErrorMessage">{message}</p>
        <ul className="scanErrorTips">
          <li>Check spelling — did you mean a .com, .org, or .io address?</li>
          <li>Make sure the site is live and not behind a login wall.</li>
          <li>Need help? Click <b>Talk to Soren</b> on the home screen.</li>
        </ul>
        <div className="scanErrorActions">
          <button type="button" className="btn primary" onClick={onEditUrl}>
            EDIT URL
          </button>
          <button type="button" className="btn secondary" onClick={onTryAgain}>
            TRY AGAIN
          </button>
        </div>
      </div>
    </section>
  );
}
