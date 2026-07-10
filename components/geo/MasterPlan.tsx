'use client';

import type { GeoAudit } from '@/lib/geoApi';
import { projectedScore } from '@/lib/geoMetrics';
import type { usePromo } from '@/hooks/usePromo';

const CALENDLY = 'https://calendly.com/vaakapila';

type PromoState = ReturnType<typeof usePromo>;

interface Props {
  audit: GeoAudit;
  promo: PromoState;
  onOpenFix: () => void;
  onOpenPartner: () => void;
  onBackToResults: () => void;
  onClose: () => void;
  onLog: (msg: string) => void;
}

export function MasterPlan({
  audit,
  promo,
  onOpenFix,
  onOpenPartner,
  onBackToResults,
  onClose,
  onLog,
}: Props) {
  const projected = projectedScore(audit);

  const handleVerify = async () => {
    const ok = await promo.verify();
    if (ok) onLog('Partner access verified. Full sponsored access unlocked.');
    else onLog('Partner or invitation code could not be verified.');
  };

  const aiLabel = promo.unlocked ? 'Included' : '$1.99';
  const guidedLabel = promo.unlocked ? 'Included' : '$5';
  const aiBtn = promo.unlocked ? 'CONTINUE WITH AI ASSIST' : 'USE AI ASSIST';
  const guidedBtn = promo.unlocked
    ? 'START SPONSORED FULL FIX'
    : 'START FULL FIX';

  return (
    <section className="screen active">
      <div className="screenTopBar">
        <span className="screenHint">
          Choose how to execute the complete repair plan.
        </span>
        <button
          type="button"
          aria-label="Close repair plan and return home"
          className="closeScreenBtn"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="masterTopBar">
        <button type="button" className="backResultsBtn" onClick={onBackToResults}>
          ← Back to Results
        </button>
        <span>Review findings again before choosing an execution option.</span>
      </div>
      <div className="masterHero">
        <h2>Master Repair Plan</h2>
        <p>
          One plan fixes the full scan. This is not one problem at a time. It
          packages GEO, ADA basics, security hardening, and monitoring
          recommendations together.
        </p>
        <div className="beforeAfter">
          <div className="ba">
            <span>Current</span>
            <b style={{ color: 'var(--red)' }}>{audit.score}</b>
          </div>
          <div className="arrow">→</div>
          <div className="ba">
            <span>Projected</span>
            <b style={{ color: 'var(--green)' }}>{projected}</b>
          </div>
        </div>
      </div>

      <div
        className="sponsoredPanel"
        style={promo.unlocked ? { borderColor: '#8bcdbd' } : undefined}
      >
        <div className="sponsoredHeader">
          <div>
            <div className="sponsoredEyebrow">Partner / Invitation Access</div>
            <h3>Have a sponsored access code?</h3>
            <p>Enter it here to unlock eligible paid services without checkout.</p>
          </div>
          <button type="button" className="btn soft" onClick={onOpenPartner}>
            Open Partner Access
          </button>
        </div>
        <label htmlFor="promoEmailInput" className="promoEmailLabel">
          Email (required to redeem)
        </label>
        <input
          id="promoEmailInput"
          type="email"
          autoComplete="email"
          className="promoEmailInput"
          placeholder="you@company.com"
          value={promo.email}
          onChange={(e) => promo.setEmail(e.target.value)}
        />
        <div className="sponsoredQuickRow">
          <input
            id="promoInput"
            autoComplete="off"
            placeholder="ENTER PARTNER OR INVITATION CODE"
            value={promo.code}
            onChange={(e) => promo.setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && void handleVerify()}
          />
          <button type="button" className="btn primary" onClick={() => void handleVerify()}>
            {promo.verifying ? 'Verifying…' : 'Verify Code'}
          </button>
        </div>
        {promo.message && (
          <div className={`promoMessage ${promo.message.type}`}>
            {promo.message.text}
          </div>
        )}
      </div>

      {promo.unlocked && (
        <div className="promoApplied show">
          ✓ Sponsored access verified. Eligible execution options are included at
          no charge.
        </div>
      )}

      <div className="execGrid">
        <div className="execCard">
          <h3>Do it yourself</h3>
          <div className="price">ZIP</div>
          <p>
            One complete package with files, snippets, and instructions. No
            payment. We ask for a GitHub star if it helps.
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              onLog('DIY complete ZIP selected.');
              onOpenFix();
            }}
          >
            DOWNLOAD PACKAGE
          </button>
        </div>
        <div className={`execCard${promo.unlocked ? ' unlocked' : ''}`}>
          <h3>AI Assist</h3>
          <div className="price">{aiLabel}</div>
          <p>
            Soren writes one complete prompt and code package for Claude,
            ChatGPT, or Cursor.
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              onLog(
                promo.unlocked
                  ? 'AI Assist selected with sponsored access.'
                  : 'AI Assist selected.',
              );
              onOpenFix();
            }}
          >
            {aiBtn}
          </button>
        </div>
        <div className={`execCard${promo.unlocked ? ' unlocked' : ''}`}>
          <h3>Done with you</h3>
          <div className="price">{guidedLabel}</div>
          <p>
            Soren guides the full repair plan with you and re-checks the score
            afterward.
          </p>
          <button
            type="button"
            className="btn amber"
            onClick={() => {
              onLog(
                promo.unlocked
                  ? 'Done-with-you selected with sponsored access.'
                  : 'Done-with-you full fix selected.',
              );
              if (!promo.unlocked) {
                window.open(CALENDLY, '_blank', 'noopener,noreferrer');
              } else {
                onOpenFix();
              }
            }}
          >
            {guidedBtn}
          </button>
        </div>
      </div>
    </section>
  );
}
