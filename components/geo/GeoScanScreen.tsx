'use client';

interface Props {
  heardUrl: string;
}

export function GeoScanScreen({ heardUrl }: Props) {
  return (
    <section className="screen active">
      <div className="scanGrid">
        <div>
          <h2>Scanning full website...</h2>
          <p>
            Soren is scanning {heardUrl} — the full readiness layer, not one
            issue. The next screen separates analysis from execution.
          </p>
        </div>
        <div className="scanChecks">
          <div className="scanCheck">AI discoverability / GEO signals</div>
          <div className="scanCheck">AI crawler rules</div>
          <div className="scanCheck">Structured data</div>
          <div className="scanCheck">Content clarity</div>
        </div>
      </div>
    </section>
  );
}
