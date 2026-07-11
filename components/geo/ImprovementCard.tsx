'use client';

import { useCallback, useRef, useState } from 'react';
import type { GeoAuditComparison } from '@/lib/geoApi';
import {
  buildShareText,
  COMPLIANCE_FOOTNOTE,
  improvementLine,
  STANDARDS_REFERENCED,
} from '@/lib/complianceCopy';

interface Props {
  comparison: GeoAuditComparison;
  afterScore: number;
  afterGrade: string;
  onLog?: (msg: string) => void;
}

const VISIBLE_MAX = 6;

export function ImprovementCard({
  comparison,
  afterScore,
  afterGrade,
  onLog,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const items = comparison.newlyPassing.map((name) => ({
    name,
    line: improvementLine(name),
  }));
  const hiddenCount = Math.max(0, items.length - VISIBLE_MAX);
  const visibleItems = expanded ? items : items.slice(0, VISIBLE_MAX);

  const handleShare = useCallback(async () => {
    const text = buildShareText(
      comparison.previousScore,
      comparison.previousGrade,
      afterScore,
      afterGrade,
    );
    try {
      await navigator.clipboard.writeText(text);
      setShareStatus('Copied to clipboard');
      onLog?.('Improvement summary copied to clipboard.');
    } catch {
      setShareStatus('Could not copy — select text manually');
    }
    window.setTimeout(() => setShareStatus(null), 3000);
  }, [afterGrade, afterScore, comparison, onLog]);

  const handleScreenshot = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0f1419',
        scale: 2,
      });
      const link = document.createElement('a');
      link.download = `soren-improvement-${afterScore}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      onLog?.('Improvement card screenshot downloaded.');
    } catch {
      onLog?.('Could not capture screenshot.');
    }
  }, [afterScore, onLog]);

  return (
    <div className="improvementCardWrap">
      <div ref={cardRef} className="improvementCard">
        <span className="improvementEyebrow">Your improvement</span>
        <div className="improvementScores">
          <div className="improvementScoreBlock">
            <span className="improvementLabel">BEFORE</span>
            <strong>
              {comparison.previousScore}
              <span className="improvementGrade">/{comparison.previousGrade}</span>
            </strong>
          </div>
          <span className="improvementArrow" aria-hidden="true">
            →
          </span>
          <div className="improvementScoreBlock improvementScoreBlock--after">
            <span className="improvementLabel">AFTER</span>
            <strong>
              {afterScore}
              <span className="improvementGrade">/{afterGrade}</span>
            </strong>
          </div>
        </div>

        <h3 className="improvementSectionTitle">What changed</h3>
        <ul className="improvementList">
          {visibleItems.map((item) => (
            <li key={item.name}>
              <span aria-hidden="true">✅</span>
              <span>
                <b>{item.name}</b> — {item.line}
              </span>
            </li>
          ))}
        </ul>
        {!expanded && hiddenCount > 0 && (
          <button
            type="button"
            className="improvementMoreBtn"
            onClick={() => setExpanded(true)}
          >
            +{hiddenCount} more
          </button>
        )}

        <p className="improvementStandards">
          Standards referenced: {STANDARDS_REFERENCED}
        </p>
        <p className="improvementFootnote">{COMPLIANCE_FOOTNOTE}</p>
        <p className="improvementBrand">Soren Fixes It — soren.varshyl.com</p>
      </div>

      <div className="improvementActions">
        <button type="button" className="btn soft" onClick={() => void handleShare()}>
          Share this result
        </button>
        <button type="button" className="btn soft" onClick={() => void handleScreenshot()}>
          Download screenshot
        </button>
        {shareStatus && <span className="improvementShareStatus">{shareStatus}</span>}
      </div>
    </div>
  );
}
