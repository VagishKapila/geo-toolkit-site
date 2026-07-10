'use client';

import { CALENDLY } from '@/lib/fixDeliveryActions';

interface Props {
  onClose: () => void;
}

export function BookingConfirmed({ onClose }: Props) {
  return (
    <section className="screen active bookingConfirmed">
      <div className="fixPackageHeader">
        <div>
          <h2>Booking confirmed!</h2>
          <p>
            Your screen-share session is scheduled. We&apos;ll apply the fixes
            together on the call.
          </p>
        </div>
        <button type="button" className="closeScreenBtn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="fixPackageActions">
        <a
          href={CALENDLY}
          target="_blank"
          rel="noopener noreferrer"
          className="btn primary"
        >
          OPEN CALENDLY
        </a>
        <button type="button" className="btn secondary" onClick={onClose}>
          CONTINUE
        </button>
      </div>
    </section>
  );
}
