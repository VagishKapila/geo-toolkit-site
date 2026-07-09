'use client';

import { useEffect, useState } from 'react';
import { FixDeliveryCards } from '@/components/FixDeliveryCards';
import { type GeoAudit } from '@/lib/geoApi';

interface Props {
  audit: GeoAudit;
  autoOpenFix: boolean;
  email: string;
  onReset: () => void;
}

export default function AuditResults({
  audit,
  autoOpenFix,
  email,
  onReset,
}: Props) {
  const [showFix, setShowFix] = useState(false);

  useEffect(() => {
    if (autoOpenFix) setShowFix(true);
  }, [autoOpenFix]);

  const failing = audit.checks.filter((c) => !c.passed);
  const passing = audit.checks.filter((c) => c.passed);

  return (
    <section className="geo-screen">
      <header className="geo-scorehead">
        <div className="geo-ring" data-grade={audit.grade}>
          <span>{audit.score}</span>
        </div>
        <div>
          <h2>AI Readiness Score — {audit.grade}</h2>
          <p>
            {audit.url} · {audit.platform} · {failing.length} issues ·{' '}
            {passing.length} passed
          </p>
        </div>
        <button
          type="button"
          className="geo-btn geo-btn-primary"
          onClick={() => setShowFix(true)}
        >
          BUILD MASTER REPAIR PLAN
        </button>
      </header>

      <div className="geo-findings">
        {audit.checks.map((c, i) => (
          <div key={c.name ?? i} className="geo-finding" data-passed={c.passed}>
            <strong>{c.name}</strong>
            {c.tip && <small>{c.tip}</small>}
          </div>
        ))}
      </div>

      {showFix && (
        <FixDeliveryCards
          auditResult={audit}
          email={email}
          onClose={() => setShowFix(false)}
          speak={() => {}}
        />
      )}

      <button type="button" className="geo-btn" onClick={onReset}>
        SCAN ANOTHER SITE
      </button>
    </section>
  );
}
