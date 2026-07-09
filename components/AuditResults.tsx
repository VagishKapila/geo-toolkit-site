'use client';

import { useEffect, useState } from 'react';
import { FixDeliveryCards } from '@/components/FixDeliveryCards';
import { MasterPlan } from '@/components/geo/MasterPlan';
import { ResultFindings } from '@/components/geo/ResultFindings';
import { type GeoAudit } from '@/lib/geoApi';
import type { RailStep } from '@/lib/geoMetrics';

type FilterKind = 'all' | 'issue' | 'warn' | 'pass';

interface Props {
  audit: GeoAudit;
  autoOpenFix: boolean;
  email: string;
  showMaster: boolean;
  onShowMaster: (v: boolean) => void;
  onRailStep: (step: RailStep) => void;
  onLog: (msg: string) => void;
}

export default function AuditResults({
  audit,
  autoOpenFix,
  email,
  showMaster,
  onShowMaster,
  onRailStep,
  onLog,
}: Props) {
  const [showFix, setShowFix] = useState(false);
  const [filter, setFilter] = useState<FilterKind>('all');
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    if (autoOpenFix) {
      onShowMaster(true);
      onRailStep('execute');
      setShowFix(true);
      onLog('Master Repair Plan opened from voice agent.');
    }
  }, [autoOpenFix, onLog, onRailStep, onShowMaster]);

  if (showMaster) {
    return (
      <>
        <MasterPlan
          audit={audit}
          onOpenFix={() => setShowFix(true)}
          onLog={onLog}
        />
        {showFix && (
          <FixDeliveryCards
            auditResult={audit}
            email={email}
            onClose={() => setShowFix(false)}
            speak={() => {}}
          />
        )}
      </>
    );
  }

  return (
    <section className="screen active">
      <ResultFindings
        checks={audit.checks}
        score={audit.score}
        url={audit.url}
        filter={filter}
        openKey={openKey}
        onFilter={(kind) => {
          setFilter(kind);
          onRailStep('investigate');
          onLog(`Filtered findings: ${kind}.`);
        }}
        onOpen={(check) => {
          setOpenKey(check.name);
          onRailStep('investigate');
          onLog(`Opened finding: ${check.name}.`);
        }}
        onCloseDetail={() => setOpenKey(null)}
        onMaster={() => {
          onShowMaster(true);
          onRailStep('execute');
          onLog('Master Repair Plan opened from finding detail.');
        }}
      />
      {showFix && (
        <FixDeliveryCards
          auditResult={audit}
          email={email}
          onClose={() => setShowFix(false)}
          speak={() => {}}
        />
      )}
    </section>
  );
}
