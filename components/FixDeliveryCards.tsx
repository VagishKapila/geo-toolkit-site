'use client';

import { useState, type ReactNode } from 'react';
import { getSharedRoom, teardownSession } from '@/lib/soren-voice/session-lifecycle';

const API =
  'https://toolkit-demo-host-production-ac14.up.railway.app';

const CALENDLY = 'https://calendly.com/vaakapila';
const GITHUB = 'https://github.com/VagishKapila/varshyl-toolkit';

interface FixDeliveryCardsProps {
  auditResult: {
    url: string;
    score: number;
    grade: string;
    platform: string;
    checks: { name: string; passed: boolean; tip?: string }[];
  };
  email: string;
  onClose: () => void;
  speak: (text: string) => void;
}

type Screen =
  | 'options'
  | 'star-gate'
  | 'downloading'
  | 'done-free'
  | 'done-ai'
  | 'done-call';

function DeliveryModal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(92vw, 780px)',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#0A0E0D',
          border: '1px solid rgba(94,234,212,0.25)',
          borderRadius: 16,
          padding: '24px',
          zIndex: 101,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          animation: 'hud-card-in .3s ease',
        }}
      >
        {children}
      </div>
    </>
  );
}

export function FixDeliveryCards({
  auditResult,
  email,
  onClose,
  speak,
}: FixDeliveryCardsProps) {
  const [screen, setScreen] = useState<Screen>('options');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const failingChecks = auditResult.checks
    .filter((c) => !c.passed)
    .map((c) => ({ name: c.name, tip: c.tip ?? '' }));

  const siteInfo = {
    url: auditResult.url,
  };

  const handleFreeDownload = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/soren/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: auditResult.platform,
          failingChecks,
          siteInfo,
        }),
      });
      const pkg = await res.json();

      pkg.files.forEach((file: { content: string; filename: string }, i: number) => {
        setTimeout(() => {
          const blob = new Blob([file.content], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.filename;
          a.click();
          URL.revokeObjectURL(url);
        }, i * 400);
      });

      setScreen('done-free');
      speak(
        'Your fix files are downloading. Apply them to your site then run the audit again.',
      );
    } catch {
      setError('Download failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAiPackage = async () => {
    if (!email) {
      setError('Enter your email first to purchase the AI package.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/credits/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          option: 'ai-package',
          siteUrl: auditResult.url,
          successUrl:
            `${window.location.origin}` +
            `?ai_package_success=true` +
            `&platform=${encodeURIComponent(auditResult.platform)}` +
            `&url=${encodeURIComponent(auditResult.url)}`,
          cancelUrl: window.location.href,
        }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        sessionStorage.setItem(
          'soren_ai_package_data',
          JSON.stringify({
            platform: auditResult.platform,
            failingChecks,
            siteInfo,
          }),
        );
        await teardownSession(getSharedRoom());
        window.location.href = data.checkoutUrl;
      } else {
        setError('Could not start checkout. Try again.');
      }
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookCall = async () => {
    if (!email) {
      setError('Enter your email first to book a call.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/credits/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          option: 'do-it-for-me',
          siteUrl: auditResult.url,
          successUrl:
            `${window.location.origin}` +
            `?call_success=true` +
            `&calendly=${encodeURIComponent(CALENDLY)}`,
          cancelUrl: window.location.href,
        }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        await teardownSession(getSharedRoom());
        window.location.href = data.checkoutUrl;
      } else {
        setError('Could not start checkout. Try again.');
      }
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const card = (accent: string) => ({
    background: '#0F1513',
    border: `1px solid ${accent}`,
    borderRadius: 14,
    padding: '22px 18px',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 10,
    flex: '1 1 200px',
    minWidth: 200,
    maxWidth: '100%',
    position: 'relative' as const,
    overflow: 'hidden' as const,
  });

  const btn = (bg: string, color: string, border: string) => ({
    width: '100%',
    padding: '11px 0',
    borderRadius: 8,
    border: `1px solid ${border}`,
    background: bg,
    color,
    fontFamily: "'JetBrains Mono',monospace",
    fontSize: 12,
    fontWeight: 700 as const,
    cursor: 'pointer' as const,
    letterSpacing: 0.3,
    marginTop: 'auto' as const,
  });

  if (screen === 'star-gate') {
    return (
      <DeliveryModal onClose={onClose}>
        <div
          style={{
            background: '#0F1513',
            border: '1px solid rgba(94,234,212,0.3)',
            borderRadius: 14,
            padding: '28px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
          <h3
            style={{
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: '#E7EFEC',
              marginBottom: 8,
            }}
          >
            Keep Soren free for everyone
          </h3>
          <p
            style={{
              fontFamily: 'Inter,sans-serif',
              fontSize: 13,
              color: 'rgba(231,239,236,0.6)',
              lineHeight: 1.7,
              marginBottom: 24,
              maxWidth: 340,
              margin: '0 auto 24px',
            }}
          >
            Your files are ready. Before you download, a quick GitHub star helps other
            builders find Soren and keeps this tool free. It takes 3 seconds.
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              maxWidth: 320,
              margin: '0 auto',
            }}
          >
            <a
              href={GITHUB}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                setTimeout(() => {
                  void handleFreeDownload();
                }, 800);
              }}
              style={{
                display: 'block',
                padding: '12px 0',
                borderRadius: 8,
                background: 'rgba(94,234,212,0.1)',
                border: '1px solid rgba(94,234,212,0.4)',
                color: '#5EEAD4',
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
                textAlign: 'center',
                letterSpacing: 0.3,
              }}
            >
              ⭐ STAR ON GITHUB — THEN DOWNLOAD
            </a>
            <button
              onClick={() => {
                void handleFreeDownload();
              }}
              style={{
                background: 'transparent',
                border: '1px solid rgba(231,239,236,0.15)',
                color: 'rgba(231,239,236,0.4)',
                padding: '9px 0',
                borderRadius: 8,
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Skip — just download
            </button>
          </div>
        </div>
      </DeliveryModal>
    );
  }

  if (screen === 'done-free') {
    return (
      <DeliveryModal onClose={onClose}>
        <div
          style={{
            background: '#0F1513',
            border: '1px solid rgba(52,211,153,0.3)',
            borderRadius: 14,
            padding: '28px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          <h3
            style={{
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: 17,
              fontWeight: 700,
              color: '#E7EFEC',
              marginBottom: 8,
            }}
          >
            Files downloading now
          </h3>
          <p
            style={{
              fontFamily: 'Inter,sans-serif',
              fontSize: 13,
              color: 'rgba(231,239,236,0.6)',
              lineHeight: 1.7,
              marginBottom: 20,
            }}
          >
            Apply the files to your site, then come back and run the audit again. Soren
            will confirm your score improved.
          </p>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(94,234,212,0.2)',
              color: 'rgba(94,234,212,0.7)',
              padding: '9px 24px',
              borderRadius: 8,
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            ← Run another audit
          </button>
        </div>
      </DeliveryModal>
    );
  }

  if (screen === 'done-call') {
    return (
      <DeliveryModal onClose={onClose}>
        <div
          style={{
            background: '#0F1513',
            border: '1px solid rgba(168,85,247,0.3)',
            borderRadius: 14,
            padding: '28px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>📞</div>
          <h3
            style={{
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: 17,
              fontWeight: 700,
              color: '#E7EFEC',
              marginBottom: 8,
            }}
          >
            Payment confirmed
          </h3>
          <p
            style={{
              fontFamily: 'Inter,sans-serif',
              fontSize: 13,
              color: 'rgba(231,239,236,0.6)',
              lineHeight: 1.7,
              marginBottom: 20,
            }}
          >
            Book your fix session below. We will screen share and fix everything
            together — usually takes under 30 minutes.
          </p>
          <a
            href={CALENDLY}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'block',
              padding: '12px 0',
              borderRadius: 8,
              background: 'linear-gradient(135deg,#6366f1,#a855f7,#ec4899)',
              color: 'white',
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
              marginBottom: 12,
            }}
          >
            📅 BOOK YOUR FIX SESSION →
          </a>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(94,234,212,0.2)',
              color: 'rgba(94,234,212,0.7)',
              padding: '9px 24px',
              borderRadius: 8,
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>
        </div>
      </DeliveryModal>
    );
  }

  return (
    <DeliveryModal onClose={onClose}>
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 9,
                color: 'rgba(94,234,212,0.6)',
                letterSpacing: 1.5,
                marginBottom: 4,
              }}
            >
              FIX DELIVERY — {failingChecks.length} SIGNALS
            </div>
            <div
              style={{
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: 15,
                fontWeight: 700,
                color: '#E7EFEC',
              }}
            >
              How would you like to fix this?
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(231,239,236,0.4)',
              cursor: 'pointer',
              fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            style={{
              fontSize: 12,
              color: '#F87171',
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.2)',
              borderRadius: 6,
              padding: '8px 12px',
              marginBottom: 12,
              fontFamily: 'Inter,sans-serif',
            }}
          >
            ⚠ {error}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {/* CARD B */}
          <div style={card('rgba(52,211,153,0.25)')}>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: 'linear-gradient(90deg,#34D399,#059669)',
              }}
            />
            <div style={{ fontSize: 28 }}>📁</div>
            <div
              style={{
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: 15,
                fontWeight: 700,
                color: '#E7EFEC',
              }}
            >
              I&apos;ll do it myself
            </div>
            <div
              style={{
                fontFamily: 'Inter,sans-serif',
                fontSize: 12,
                color: 'rgba(231,239,236,0.55)',
                lineHeight: 1.65,
                flex: 1,
              }}
            >
              Get all the fix files pre-built for your platform. Apply them yourself
              using your hosting panel, FTP, or file manager.
            </div>
            <button
              onClick={() => setScreen('star-gate')}
              disabled={isLoading}
              style={btn('rgba(52,211,153,0.1)', '#34D399', 'rgba(52,211,153,0.4)')}
            >
              {isLoading ? 'PREPARING...' : 'Get the files →'}
            </button>
          </div>

          {/* CARD C */}
          <div style={card('rgba(94,234,212,0.25)')}>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: 'linear-gradient(90deg,#5EEAD4,#0891B2)',
              }}
            />
            <div style={{ fontSize: 28 }}>🤖</div>
            <div
              style={{
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: 15,
                fontWeight: 700,
                color: '#E7EFEC',
              }}
            >
              AI Package
            </div>
            <div
              style={{
                fontFamily: 'Inter,sans-serif',
                fontSize: 12,
                color: 'rgba(231,239,236,0.55)',
                lineHeight: 1.65,
                flex: 1,
              }}
            >
              Download your fixes plus a ready-to-paste ChatGPT prompt. Your AI walks
              you through applying everything.
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 20,
                fontWeight: 700,
                color: '#5EEAD4',
              }}
            >
              $1.99
            </div>
            <button
              onClick={() => {
                void handleAiPackage();
              }}
              disabled={isLoading}
              style={btn('rgba(94,234,212,0.1)', '#5EEAD4', 'rgba(94,234,212,0.4)')}
            >
              {isLoading ? 'LOADING...' : 'GET AI PACKAGE →'}
            </button>
          </div>

          {/* CARD A */}
          <div style={card('rgba(168,85,247,0.35)')}>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: 'linear-gradient(90deg,#6366f1,#a855f7,#ec4899)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: 'rgba(168,85,247,0.2)',
                border: '1px solid rgba(168,85,247,0.35)',
                color: '#a855f7',
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 8,
                letterSpacing: 1,
                padding: '2px 8px',
                borderRadius: 100,
              }}
            >
              MOST POPULAR
            </div>
            <div style={{ fontSize: 28 }}>📞</div>
            <div
              style={{
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: 15,
                fontWeight: 700,
                color: '#E7EFEC',
              }}
            >
              Do it for me
            </div>
            <div
              style={{
                fontFamily: 'Inter,sans-serif',
                fontSize: 12,
                color: 'rgba(231,239,236,0.55)',
                lineHeight: 1.65,
                flex: 1,
              }}
            >
              Book a 30-minute screen share session. We jump on a call and fix everything
              together. You watch, we apply.
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 20,
                fontWeight: 700,
                color: '#a855f7',
              }}
            >
              $9.00
            </div>
            <button
              onClick={() => {
                void handleBookCall();
              }}
              disabled={isLoading}
              style={btn('linear-gradient(135deg,#6366f1,#a855f7)', 'white', 'transparent')}
            >
              {isLoading ? 'LOADING...' : 'BOOK A CALL →'}
            </button>
          </div>
        </div>
      </div>
    </DeliveryModal>
  );
}
