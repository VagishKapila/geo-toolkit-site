'use client';

import type { GeoCheck } from '@/lib/geoApi';

type FilterKind = 'all' | 'issue' | 'warn' | 'pass';

function findingKind(c: GeoCheck): 'issue' | 'warn' | 'pass' {
  if (c.passed) return 'pass';
  if ((c.points ?? 0) > 0) return 'warn';
  return 'issue';
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
}: Props) {
  const failing = checks.filter((c) => !c.passed);
  const warnings = checks.filter((c) => !c.passed && (c.points ?? 0) > 0);
  const passing = checks.filter((c) => c.passed);
  const visible = checks.filter((c) => filter === 'all' || findingKind(c) === filter);
  const openCheck = checks.find((c) => c.name === openKey);
  const ringGradient = `conic-gradient(var(--red) 0 ${score}%, var(--amber) ${score}% ${Math.min(score + 20, 100)}%, rgba(255,255,255,.08) ${Math.min(score + 20, 100)}%)`;

  return (
    <>
      <div className="scoreHead">
        <div className="ring" style={{ background: ringGradient }}>
          <span>{score}</span>
        </div>
        <div className="scoreText">
          <h2>AI Readiness Score</h2>
          <p>
            {url} has {failing.length} issues and {passing.length} passed checks.
            Click any finding to investigate.
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
      <div className="findingGrid">
        {visible.map((c) => {
          const kind = findingKind(c);
          const badge =
            c.maxPoints != null
              ? `${c.points ?? 0}/${c.maxPoints}`
              : c.passed ? 'OK' : 'FAIL';
          const badgeColor =
            kind === 'pass' ? 'var(--green)' : kind === 'warn' ? 'var(--amber)' : 'var(--red)';
          return (
            <button
              key={c.name}
              type="button"
              className="finding"
              data-kind={kind}
              onClick={() => onOpen(c)}
            >
              <span className="badge" style={{ color: badgeColor }}>{badge}</span>
              <strong>{c.name}</strong>
              {c.tip && <small>{c.tip}</small>}
            </button>
          );
        })}
      </div>
      <div className={`detailDrop${openCheck ? ' show' : ''}`}>
        {openCheck && (
          <>
            <h3>{openCheck.name}</h3>
            <p>{openCheck.tip ?? 'No additional detail available.'}</p>
            <div className="quote">
              Soren: &ldquo;This signal affects your AI discoverability score.
              It is included in the Master Repair Plan.&rdquo;
            </div>
            <button type="button" className="btn" onClick={onMaster}>
              BUILD MASTER REPAIR PLAN
            </button>
            {' '}
            <button type="button" className="btn secondary" onClick={onCloseDetail}>
              CLOSE
            </button>
          </>
        )}
      </div>
    </>
  );
}
