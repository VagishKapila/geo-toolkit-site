'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { GeoCheck } from '@/lib/geoApi';

type FilterKind = 'all' | 'issue' | 'warn' | 'pass';

const CATEGORY_ORDER = [
  'AI discoverability',
  'Accessibility basics',
  'Security hardening',
] as const;

const COMPLIANCE_FOOTNOTE =
  'Technical signals only — not a legal compliance audit. Consult a qualified advisor for full ADA/WCAG/security compliance.';

function findingKind(c: GeoCheck): FilterKind | 'info' {
  if (c.info) return 'info';
  if (c.passed) return 'pass';
  if ((c.points ?? 0) > 0) return 'warn';
  return 'issue';
}

function groupChecks(checks: GeoCheck[]) {
  const groups = new Map<string, GeoCheck[]>();
  for (const check of checks) {
    const category = check.category ?? 'AI discoverability';
    const list = groups.get(category) ?? [];
    list.push(check);
    groups.set(category, list);
  }
  const ordered: { category: string; checks: GeoCheck[] }[] = CATEGORY_ORDER.filter(
    (category) => groups.has(category),
  ).map((category) => ({ category, checks: groups.get(category)! }));
  for (const [category, list] of Array.from(groups.entries())) {
    if (!CATEGORY_ORDER.includes(category as (typeof CATEGORY_ORDER)[number])) {
      ordered.push({ category, checks: list });
    }
  }
  return ordered;
}

interface Props {
  checks: GeoCheck[];
  score: number;
  url: string;
  filter: FilterKind;
  openKey: string | null;
  onFilter: (kind: FilterKind) => void;
  onOpen: (check: GeoCheck) => void;
  onCloseDetail: () => void;
  onMaster: () => void;
  onGoHome: () => void;
  onShowAll: () => void;
}

export function ResultFindings({
  checks,
  score,
  url,
  filter,
  openKey,
  onFilter,
  onOpen,
  onCloseDetail,
  onMaster,
  onGoHome,
  onShowAll,
}: Props) {
  const detailRef = useRef<HTMLDivElement>(null);
  const failing = checks.filter((c) => !c.passed && !c.info);
  const warnings = checks.filter((c) => !c.passed && !c.info && (c.points ?? 0) > 0);
  const passing = checks.filter((c) => c.passed && !c.info);
  const grouped = useMemo(() => groupChecks(checks), [checks]);
  const openCheck = checks.find((c) => c.name === openKey);
  const ringGradient = `conic-gradient(var(--red) 0 ${score}%, var(--amber) ${score}% ${Math.min(score + 20, 100)}%, rgba(255,255,255,.08) ${Math.min(score + 20, 100)}%)`;

  useEffect(() => {
    if (openKey) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [openKey]);

  const renderFinding = (c: GeoCheck) => {
    const kind = findingKind(c);
    const badge = c.info
      ? 'INFO'
      : c.maxPoints != null && c.maxPoints > 0
        ? `${c.points ?? 0}/${c.maxPoints}`
        : c.passed
          ? 'OK'
          : 'FAIL';
    const badgeColor =
      kind === 'info'
        ? 'var(--muted)'
        : kind === 'pass'
          ? 'var(--green)'
          : kind === 'warn'
            ? 'var(--amber)'
            : 'var(--red)';

    return (
      <button
        key={c.name}
        type="button"
        className="finding"
        data-kind={kind}
        onClick={() => onOpen(c)}
      >
        <span className="badge" style={{ color: badgeColor }}>
          {badge}
        </span>
        <strong>{c.name}</strong>
        {c.tip && <small>{c.tip}</small>}
      </button>
    );
  };

  return (
    <>
      <div className="screenTopBar">
        <span className="screenHint">
          Review all findings, filter them, or close to scan another website.
        </span>
        <button
          type="button"
          aria-label="Close results and return home"
          className="closeScreenBtn"
          onClick={onGoHome}
        >
          ×
        </button>
      </div>
      <div className="scoreHead">
        <div className="ring" style={{ background: ringGradient }}>
          <span>{score}</span>
        </div>
        <div className="scoreText">
          <h2>AI Readiness Score</h2>
          <p>
            {url} has {failing.length} issues, {warnings.length} recommendations,
            and {passing.length} passed checks. Click any finding to investigate.
          </p>
        </div>
        <div className="summary">
          <button type="button" onClick={() => onFilter('issue')}>
            <b style={{ color: 'var(--red)' }}>{failing.length}</b>
            <span>Issues</span>
          </button>
          <button type="button" onClick={() => onFilter('warn')}>
            <b style={{ color: 'var(--amber)' }}>{warnings.length}</b>
            <span>Warnings</span>
          </button>
          <button type="button" onClick={() => onFilter('pass')}>
            <b style={{ color: 'var(--green)' }}>{passing.length}</b>
            <span>Passed</span>
          </button>
        </div>
      </div>
      <div className="resultUtilityRow">
        <button type="button" className="btn soft" onClick={onShowAll}>
          Show Full Scan
        </button>
        <button type="button" className="btn soft" onClick={onGoHome}>
          Scan Another Website
        </button>
      </div>
      {grouped.map(({ category, checks: groupChecksList }) => {
        const visible = groupChecksList.filter(
          (c) => filter === 'all' || findingKind(c) === filter,
        );
        if (!visible.length) return null;
        const isCompliance =
          category === 'Accessibility basics' || category === 'Security hardening';
        return (
          <section key={category} className="findingCategory">
            <h3 className="findingCategoryTitle">{category}</h3>
            {isCompliance && (
              <p className="complianceFootnote">{COMPLIANCE_FOOTNOTE}</p>
            )}
            <div className="findingGrid">{visible.map(renderFinding)}</div>
          </section>
        );
      })}
      <div
        ref={detailRef}
        className={`detailDrop${openCheck ? ' show' : ''}`}
      >
        {openCheck && (
          <>
            <h3>{openCheck.name}</h3>
            <p>{openCheck.tip ?? 'No additional detail available.'}</p>
            {!openCheck.info && (
              <div className="quote">
                Soren: &ldquo;This signal affects your readiness score.
                It is included in the Master Repair Plan.&rdquo;
              </div>
            )}
            {!openCheck.info && (
              <button type="button" className="btn" onClick={onMaster}>
                BUILD MASTER REPAIR PLAN
              </button>
            )}
            {' '}
            <button type="button" className="btn secondary" onClick={onCloseDetail}>
              CLOSE
            </button>
          </>
        )}
      </div>
      <div className="fullScanFooter">
        <div>
          <span className="fullScanEyebrow">Full Scan Complete</span>
          <h3>
            {checks.length} checks reviewed across GEO, accessibility, security,
            and monitoring.
          </h3>
          <p>
            Review any item above, or build one Master Repair Plan that packages
            all recommended fixes together.
          </p>
        </div>
        <button type="button" className="btn primary fullPlanBtn" onClick={onMaster}>
          Build Master Repair Plan
        </button>
      </div>
    </>
  );
}
