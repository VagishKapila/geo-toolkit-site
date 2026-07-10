'use client';

import type { usePromo } from '@/hooks/usePromo';

type PromoState = ReturnType<typeof usePromo>;

interface Props {
  promo: PromoState;
  onClose: () => void;
  onContinue: () => void;
  onLog: (msg: string) => void;
}

export function PartnerAccessScreen({
  promo,
  onClose,
  onContinue,
  onLog,
}: Props) {
  const handleVerify = async () => {
    const ok = await promo.verify();
    if (ok) {
      onLog('Partner access verified. Full sponsored access unlocked.');
    } else {
      onLog('Partner or invitation code could not be verified.');
    }
  };

  return (
    <section className="screen active">
      <div className="screenTopBar">
        <span className="screenHint">Partner and invitation access.</span>
        <button
          type="button"
          aria-label="Close partner access and return home"
          className="closeScreenBtn"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="partnerScreen">
        <div className="partnerHero">
          <div className="partnerEyebrow">
            Partner · Invitation · Sponsored Access
          </div>
          <h2>Unlock the complete repair plan.</h2>
          <p>
            Use a valid partner or invitation code to access eligible paid
            services without checkout. Soren can also recognize the code by
            voice.
          </p>
        </div>
        <div className="partnerCodeCard">
          <label htmlFor="partnerEmailInput">Email (required to redeem)</label>
          <input
            id="partnerEmailInput"
            type="email"
            autoComplete="email"
            className="partnerEmailInput"
            placeholder="you@company.com"
            value={promo.email}
            onChange={(e) => promo.setEmail(e.target.value)}
          />
          <label htmlFor="partnerCodeInput">Partner or invitation code</label>
          <div className="partnerCodeRow">
            <input
              id="partnerCodeInput"
              autoComplete="off"
              placeholder="ENTER CODE"
              value={promo.code}
              onChange={(e) => promo.setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && void handleVerify()}
            />
            <button type="button" className="btn primary" onClick={() => void handleVerify()}>
              {promo.verifying ? 'Verifying…' : 'Verify Access'}
            </button>
          </div>
          <div className="partnerVoice">
            <b>Voice option:</b> Say, &ldquo;Soren, my invitation code is
            SORVIP.&rdquo; In production, route the detected code through the
            same secure server validation.
          </div>
          <div className="demoHint">
            Prototype test codes: <b>SORVIP</b> or <b>VARSHYL100</b>. Remove
            these hints before release.
          </div>
          {promo.message && (
            <div className={`promoMessage ${promo.message.type}`}>
              {promo.message.text}
            </div>
          )}
        </div>
        {promo.unlocked && (
          <div className="partnerSuccess show">
            <h3>✓ Sponsored access verified</h3>
            <p>
              Your invitation includes the complete repair plan. No payment is
              required for eligible execution options.
            </p>
            <div className="partnerBenefits">
              <div className="partnerBenefit">DIY Package Included</div>
              <div className="partnerBenefit">AI Assist Included</div>
              <div className="partnerBenefit">Done With You Included</div>
            </div>
            <button type="button" className="btn primary" onClick={onContinue}>
              Continue to Master Repair Plan
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
