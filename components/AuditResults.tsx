'use client';

import { useEffect, useState } from 'react';
import { MasterPlan } from '@/components/geo/MasterPlan';
import { PartnerAccessScreen } from '@/components/geo/PartnerAccessScreen';
import { ResultFindings } from '@/components/geo/ResultFindings';
import { type GeoAudit } from '@/lib/geoApi';
import type { RailStep } from '@/lib/geoMetrics';
import type { usePromo } from '@/hooks/usePromo';

type FilterKind = 'all' | 'issue' | 'warn' | 'pass';
type PromoState = ReturnType<typeof usePromo>;

interface Props {
  audit: GeoAudit;
  autoOpenFix: boolean;
  email: string;
  showMaster: boolean;
  showPartner: boolean;
  onShowMaster: (v: boolean) => void;
  onShowPartner: (v: boolean) => void;
  onRailStep: (step: RailStep) => void;
  onLog: (msg: string) => void;
  onGoHome: () => void;
  onBackToResults: () => void;
  promo: PromoState;
}

export default function AuditResults({
  audit,
  autoOpenFix,
  email,
  showMaster,
  showPartner,
  onShowMaster,
  onShowPartner,
  onRailStep,
  onLog,
  onGoHome,
  onBackToResults,
  promo,
}: Props) {
  const [filter, setFilter] = useState<FilterKind>('all');
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    if (autoOpenFix) {
      onShowMaster(true);
      onRailStep('execute');
      onLog('Master Repair Plan opened from voice agent.');
    }
  }, [autoOpenFix, onLog, onRailStep, onShowMaster]);

  if (showPartner) {
    return (
      <PartnerAccessScreen
        promo={promo}
        onClose={onGoHome}
        onContinue={() => {
          onShowPartner(false);
          onShowMaster(true);
          onRailStep('execute');
          onLog('Continuing to the Master Repair Plan with sponsored access.');
        }}
        onLog={onLog}
      />
    );
  }

  if (showMaster) {
    return (
      <MasterPlan
        audit={audit}
        promo={promo}
        accountEmail={email}
        onOpenPartner={() => {
          onShowPartner(true);
          onRailStep('execute');
          onLog('Partner and invitation access screen opened.');
        }}
        onBackToResults={onBackToResults}
        onClose={onGoHome}
        onLog={onLog}
      />
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
        onGoHome={onGoHome}
        onShowAll={() => {
          setFilter('all');
          setOpenKey(null);
          onRailStep('result');
          onLog('Full scan restored. Showing all checks.');
        }}
      />
    </section>
  );
}
