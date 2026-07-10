'use client';

import { useEffect, useRef, useState } from 'react';
import type { GeoAudit } from '@/lib/geoApi';
import { projectedScore } from '@/lib/geoMetrics';
import type { usePromo } from '@/hooks/usePromo';
import { FixPackageDelivered } from '@/components/geo/FixPackageDelivered';
import {
  deliverAiPackage,
  deliverDiyPackage,
  downloadFixZip,
  type FixPackageResponse,
  triggerAiPackageCheckout,
  triggerDoItForMeCheckout,
} from '@/lib/fixDeliveryActions';

type PromoState = ReturnType<typeof usePromo>;

interface Props {
  audit: GeoAudit;
  promo: PromoState;
  accountEmail: string;
  onOpenPartner: () => void;
  onBackToResults: () => void;
  onClose: () => void;
  onLog: (msg: string) => void;
}

export function MasterPlan({
  audit,
  promo,
  accountEmail,
  onOpenPartner,
  onBackToResults,
  onClose,
  onLog,
}: Props) {
  const planRef = useRef<HTMLElement>(null);
  const promoPanelRef = useRef<HTMLDivElement>(null);
  const promoCodeRef = useRef<HTMLInputElement>(null);
  const [promoOpen, setPromoOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [delivered, setDelivered] = useState<FixPackageResponse | null>(null);
  const [deliveredTier, setDeliveredTier] = useState<'diy' | 'ai'>('diy');
  const projected = projectedScore(audit);

  useEffect(() => {
    planRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const revealPromo = () => {
    setPromoOpen(true);
    requestAnimationFrame(() => {
      promoPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => promoCodeRef.current?.focus(), 80);
    });
  };

  const resolveEmail = () => (promo.email.trim() || accountEmail.trim());

  const handleVerify = async () => {
    const ok = await promo.verify();
    if (ok) onLog('Partner access verified. Full sponsored access unlocked.');
    else onLog('Partner or invitation code could not be verified.');
  };

  const runDiy = async () => {
    setActionError(null);
    setBusy(true);
    try {
      const pkg = await deliverDiyPackage(audit);
      setDeliveredTier('diy');
      setDelivered(pkg);
      onLog('DIY ZIP downloaded — open README.md first (surgical fixes only).');
    } catch {
      setActionError('Download failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const runAiAssist = async () => {
    setActionError(null);
    if (promo.unlocked) {
      setBusy(true);
      try {
        const pkg = await deliverAiPackage(audit);
        setDeliveredTier('ai');
        setDelivered(pkg);
        onLog('AI Assist ZIP downloaded — paste PROMPT.txt into ChatGPT or Claude.');
      } catch {
        setActionError('Package build failed. Try again.');
      } finally {
        setBusy(false);
      }
      return;
    }
    const email = resolveEmail();
    if (!email) {
      setActionError('Enter your email on the Master Plan to purchase the AI package.');
      revealPromo();
      return;
    }
    setBusy(true);
    try {
      const err = await triggerAiPackageCheckout(audit, email);
      if (err) setActionError(err);
      else onLog('AI Assist selected — redirecting to checkout ($1.99).');
    } catch {
      setActionError('Could not start checkout. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const runDoItForMe = async () => {
    setActionError(null);
    if (promo.unlocked) {
      window.open('https://calendly.com/vaakapila', '_blank', 'noopener,noreferrer');
      onLog('Done-with-you selected with sponsored access.');
      return;
    }
    const email = resolveEmail();
    if (!email) {
      setActionError('Enter your email on the Master Plan to book a fix session.');
      revealPromo();
      return;
    }
    setBusy(true);
    try {
      const err = await triggerDoItForMeCheckout(audit, email);
      if (err) setActionError(err);
      else onLog('Do it for me selected — redirecting to checkout ($9.00).');
    } catch {
      setActionError('Could not start checkout. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const aiLabel = promo.unlocked ? 'Included' : '$1.99';
  const guidedLabel = promo.unlocked ? 'Included' : '$9.00';
  const aiBtn = promo.unlocked ? 'CONTINUE WITH AI ASSIST' : 'USE AI ASSIST';
  const guidedBtn = promo.unlocked
    ? 'START SPONSORED FULL FIX'
    : 'START FULL FIX';

  if (delivered) {
    return (
      <FixPackageDelivered
        pkg={delivered}
        siteUrl={audit.url}
        tier={deliveredTier}
        onClose={() => setDelivered(null)}
        onRedownload={() => void downloadFixZip(delivered, audit.url, deliveredTier)}
      />
    );
  }

  return (
    <section className="screen active" ref={planRef}>
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

      {actionError && (
        <div className="promoMessage error">{actionError}</div>
      )}

      <div
        ref={promoPanelRef}
        className="sponsoredPanel"
        style={promo.unlocked ? { borderColor: '#8bcdbd' } : undefined}
      >
        <div className="sponsoredHeader">
          <div>
            <div className="sponsoredEyebrow">Partner / Invitation Access</div>
            <button type="button" className="promoRevealLink" onClick={revealPromo}>
              <h3>Have a sponsored access code?</h3>
            </button>
            <p>Enter it here to unlock eligible paid services without checkout.</p>
          </div>
          <button type="button" className="btn soft" onClick={onOpenPartner}>
            Open Partner Access
          </button>
        </div>
        <div className={`promoBody${promoOpen ? ' show' : ''}`}>
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
              ref={promoCodeRef}
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
            One ZIP with only your failing checks — README tells you what to
            merge or add. Do not replace your whole site. Free.
          </p>
          <button type="button" className="btn" disabled={busy} onClick={() => void runDiy()}>
            {busy ? 'PREPARING…' : 'GET THE FILES'}
          </button>
        </div>
        <div className={`execCard${promo.unlocked ? ' unlocked' : ''}`}>
          <h3>AI Assist</h3>
          <div className="price">{aiLabel}</div>
          <p>
            ZIP + PROMPT.txt — paste into ChatGPT or Claude and finish in 5–10
            minutes. Surgical fixes only.
          </p>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void runAiAssist()}
          >
            {busy ? 'LOADING…' : aiBtn}
          </button>
        </div>
        <div className={`execCard${promo.unlocked ? ' unlocked' : ''}`}>
          <h3>Do it for me</h3>
          <div className="price">{guidedLabel}</div>
          <p>
            Book a guided fix session. Soren walks through the full repair plan
            with you and re-checks the score afterward.
          </p>
          <button
            type="button"
            className="btn amber"
            disabled={busy}
            onClick={() => void runDoItForMe()}
          >
            {busy ? 'LOADING…' : guidedBtn}
          </button>
        </div>
      </div>
    </section>
  );
}
