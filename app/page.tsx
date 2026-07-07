'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSorenVoice } from '../hooks/useSorenVoice';
import { useSorenSTT } from '../hooks/useSorenSTT';
import { useSorenChat } from '../hooks/useSorenChat';
import { useCredits } from '../hooks/useCredits';
import { cleanForSpeech } from '../lib/cleanForSpeech';
import { FixPackage } from '../components/FixPackage';
import { EmailGate } from '../components/EmailGate';

type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';
type DeliveryOption = 'A' | 'B' | 'C' | null;

const HUD = {
  bg: '#0A0E0D',
  panel: '#0F1513',
  panelBorder: 'rgba(94,234,212,0.14)',
  teal: '#5EEAD4',
  tealDim: 'rgba(94,234,212,0.55)',
  tealFaint: 'rgba(94,234,212,0.18)',
  text: '#E7EFEC',
  textDim: 'rgba(231,239,236,0.45)',
  green: '#34D399',
  amber: '#FBBF24',
  red: '#F87171',
  grad: 'linear-gradient(135deg,#6366f1,#a855f7,#ec4899)',
} as const;

const MONO = "'JetBrains Mono','SF Mono',ui-monospace,monospace";

interface ActionCardData {
  label: string;
  message: string;
  actions: { label: string; fn: () => void }[];
}

function buildBriefingText(result: {
  score: number;
  checks?: { passed: boolean }[];
}): string {
  const failed = result.checks?.filter((c) => !c.passed).length ?? 0;
  if (result.score >= 90) {
    return `Mission complete. Your site is broadcasting strongly to AI engines. Score: ${result.score} out of 100.`;
  }
  if (result.score >= 75) {
    return `Good signal, but ${failed} vulnerabilities detected. Score: ${result.score} out of 100. Click any failing check for my analysis.`;
  }
  if (result.score >= 55) {
    return `Weak signal detected. ${failed} signals are missing. Score: ${result.score} out of 100. AI engines are struggling to understand your product.`;
  }
  return `Off the grid. ${failed} critical signals missing. Score: ${result.score} out of 100. When someone asks AI about products like yours, you don't appear in the answer. I can fix this.`;
}

// ── SorenOrb ──────────────────────────────────────────────
function SorenOrb({ state, size = 160 }: { state: OrbState; size?: number }) {
  const listening = state === 'listening';
  const thinking = state === 'thinking';
  const speaking = state === 'speaking';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {listening && [0, 500, 1000].map((d) => (
        <div
          key={d}
          style={{
            position: 'absolute',
            inset: -size * 0.15,
            borderRadius: '50%',
            border: `1px solid ${HUD.teal}`,
            animation: `hud-ping 2s ease-out ${d}ms infinite`,
            pointerEvents: 'none',
          }}
        />
      ))}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: -7 * (i + 1),
            borderRadius: '50%',
            border: `1px dashed ${HUD.tealFaint}`,
            pointerEvents: 'none',
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          inset: -size * 0.2,
          borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(94,234,212,0.1),transparent 70%)',
          filter: 'blur(10px)',
          animation: 'hud-breathe 3s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: HUD.grad,
          border: `2px solid ${HUD.teal}`,
          animation: 'hud-breathe 3s ease-in-out infinite,hud-float 4s ease-in-out infinite',
          boxShadow: `0 0 ${size * 0.35}px rgba(94,234,212,0.2),0 0 ${size * 0.55}px rgba(168,85,247,0.25)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '14%',
            left: '18%',
            width: '36%',
            height: '26%',
            background: 'radial-gradient(ellipse,rgba(255,255,255,0.4),transparent)',
            borderRadius: '50%',
            transform: 'rotate(-30deg)',
          }}
        />
        {thinking && (
          <div
            style={{
              position: 'absolute',
              inset: 8,
              borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: 'rgba(255,255,255,0.6)',
              animation: 'hud-spin 1s linear infinite',
            }}
          />
        )}
        <span
          style={{
            fontFamily: MONO,
            fontSize: size * 0.3,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.95)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          S
        </span>
      </div>
      {speaking && (
        <div
          style={{
            position: 'absolute',
            bottom: -size * 0.38,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 3,
            alignItems: 'center',
          }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: 16,
                borderRadius: 2,
                background: HUD.teal,
                transformOrigin: 'bottom',
                animation: `hud-wave .8s ease ${i * 0.1}s infinite`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── URLConfirmCard ────────────────────────────────────────
function URLConfirmCard({
  url,
  onConfirm,
  onWrong,
}: {
  url: string;
  onConfirm: (u: string) => void;
  onWrong: () => void;
}) {
  const [val, setVal] = useState(url);
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState(3);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) return;
    if (t === 0) {
      onConfirm(val);
      return;
    }
    const id = setTimeout(() => setT((x) => x - 1), 1000);
    return () => clearTimeout(id);
  }, [t, editing, val, onConfirm]);

  return (
    <div
      style={{
        background: HUD.panel,
        border: `1px solid ${HUD.teal}`,
        borderRadius: 8,
        padding: '14px 16px',
        animation: 'hud-card-in .25s ease',
        boxShadow: '0 0 20px rgba(94,234,212,0.1)',
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: 1.5,
          color: HUD.textDim,
          fontFamily: MONO,
          marginBottom: 8,
        }}
      >
        ◉ SOREN HEARD
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(94,234,212,0.05)',
          border: `1px solid ${editing ? HUD.teal : HUD.tealFaint}`,
          borderRadius: 6,
          padding: '8px 12px',
          marginBottom: 10,
          cursor: 'text',
          transition: 'border-color .15s',
        }}
        onClick={() => {
          setEditing(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <span style={{ color: HUD.tealDim, fontSize: 12 }}>›</span>
        {editing ? (
          <input
            ref={inputRef}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setEditing(false);
                onConfirm(val);
              }
              if (e.key === 'Escape') setEditing(false);
            }}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: MONO,
              fontSize: 14,
              fontWeight: 600,
              color: HUD.teal,
              caretColor: HUD.teal,
            }}
          />
        ) : (
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: HUD.teal }}>{val}</span>
        )}
        <span style={{ fontSize: 11, color: HUD.textDim }}>✏</span>
      </div>

      {!editing && t > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 9,
              color: HUD.textDim,
              fontFamily: MONO,
              marginBottom: 4,
            }}
          >
            <span>AUTO-PROCEEDING</span>
            <span style={{ color: HUD.teal, fontWeight: 700 }}>{t}s</span>
          </div>
          <div
            style={{
              height: 2,
              background: 'rgba(94,234,212,0.1)',
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                background: HUD.teal,
                borderRadius: 1,
                animation: `hud-countdown ${t}s linear forwards`,
              }}
            />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onConfirm(val)}
          style={{
            flex: 1,
            padding: '7px 0',
            borderRadius: 5,
            border: `1px solid ${HUD.teal}`,
            background: 'rgba(94,234,212,0.08)',
            color: HUD.teal,
            fontFamily: MONO,
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ✓ CONFIRM
        </button>
        <button
          onClick={onWrong}
          style={{
            padding: '7px 14px',
            borderRadius: 5,
            border: `1px solid ${HUD.tealFaint}`,
            background: 'transparent',
            color: HUD.textDim,
            fontFamily: MONO,
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          ✕ WRONG
        </button>
      </div>
    </div>
  );
}

// ── ActionCard ────────────────────────────────────────────
function ActionCard({ card, onDismiss }: { card: ActionCardData; onDismiss: () => void }) {
  return (
    <div
      style={{
        background: HUD.panel,
        border: `1px solid ${HUD.tealFaint}`,
        borderRadius: 8,
        padding: '14px 16px',
        animation: 'hud-card-in .25s ease',
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 9, letterSpacing: 1.5, color: HUD.tealDim, fontFamily: MONO }}>
          ◉ SOREN
        </span>
        <button
          onClick={onDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: HUD.textDim,
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
      <p
        style={{
          fontFamily: 'Inter,sans-serif',
          fontSize: 14,
          color: HUD.text,
          lineHeight: 1.65,
          margin: '0 0 12px',
        }}
      >
        {card.message}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {card.actions.map((a, i) => (
          <button
            key={i}
            onClick={a.fn}
            style={{
              padding: '7px 16px',
              borderRadius: 5,
              border: `1px solid ${i === 0 ? HUD.teal : HUD.tealFaint}`,
              background: i === 0 ? 'rgba(94,234,212,0.1)' : 'transparent',
              color: i === 0 ? HUD.teal : HUD.textDim,
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── DockedTray ──────────────────────────────────────────
function DockedTray({
  cards,
  onReopen,
}: {
  cards: { label: string }[];
  onReopen: (i: number) => void;
}) {
  if (!cards.length) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        borderTop: `1px solid ${HUD.panelBorder}`,
        background: 'rgba(10,14,13,0.96)',
        backdropFilter: 'blur(12px)',
        padding: '7px 20px',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        zIndex: 50,
      }}
    >
      <span
        style={{
          fontSize: 9,
          color: HUD.textDim,
          fontFamily: MONO,
          letterSpacing: 1,
          marginRight: 4,
        }}
      >
        MINIMIZED
      </span>
      {cards.map((c, i) => (
        <button
          key={i}
          onClick={() => onReopen(i)}
          style={{
            background: 'rgba(94,234,212,0.07)',
            border: `1px solid ${HUD.tealFaint}`,
            color: HUD.teal,
            padding: '4px 12px',
            borderRadius: 4,
            fontFamily: MONO,
            fontSize: 9,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ◉ {c.label} <span style={{ color: HUD.textDim }}>↑</span>
        </button>
      ))}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────
export default function SorenOS() {
  const [draft, setDraft] = useState('');
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'briefing'>('idle');
  const [error, setError] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [scanDomain, setScanDomain] = useState('');
  const [activeInput, setActiveInput] = useState('');
  const [showEmailGate, setShowEmailGate] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [fixApplied, setFixApplied] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [dockedCards, setDockedCards] = useState<ActionCardData[]>([]);
  const [activeCard, setActiveCard] = useState<ActionCardData | null>(null);
  const [deliveryOption, setDeliveryOption] = useState<DeliveryOption>(null);

  const speakGuardRef = useRef(false);
  const shownCardForUrl = useRef<string | null>(null);
  const { speak, isSpeaking, isMuted, toggleMute } = useSorenVoice();

  const speakOnce = useCallback(
    async (text: string) => {
      if (speakGuardRef.current) return;
      speakGuardRef.current = true;
      await speak(cleanForSpeech(text));
      speakGuardRef.current = false;
    },
    [speak],
  );

  const {
    messages,
    auditResult,
    fixPackage,
    isThinking,
    sendMessage,
    runAuditFromChat,
    clearFixPackage,
    restoreFixPackage,
  } = useSorenChat((replyText) => {
    void speakOnce(replyText);
  });

  const {
    email,
    balance,
    isLoading: creditsLoading,
    saveEmail,
    fetchBalance,
    startCheckout,
    deductCredits,
  } = useCredits();

  const handleApplyFix = useCallback(
    async (overrideEmail?: string) => {
      setApplyError(null);
      const userEmail = overrideEmail ?? email;

      if (!userEmail) {
        setShowEmailGate(true);
        return;
      }

      if (overrideEmail) {
        saveEmail(overrideEmail);
      }

      const currentBalance = await fetchBalance(userEmail);

      if (currentBalance < 5) {
        if (fixPackage) {
          sessionStorage.setItem('soren_pending_fix', JSON.stringify(fixPackage));
        }
        await startCheckout(userEmail, 5, auditResult?.url ?? '');
        return;
      }

      setIsApplying(true);
      const success = await deductCredits(userEmail, 5, `Fix for ${auditResult?.url ?? 'site'}`);

      if (success) {
        setFixApplied(true);
        void speakOnce(
          'Done. Your fix package is ready to download. Apply it and run the audit again. I will check your score.',
        );
      } else {
        if (fixPackage) {
          sessionStorage.setItem('soren_pending_fix', JSON.stringify(fixPackage));
        }
        await startCheckout(userEmail, 5, auditResult?.url ?? '');
      }
      setIsApplying(false);
    },
    [
      email,
      saveEmail,
      fetchBalance,
      startCheckout,
      deductCredits,
      auditResult?.url,
      speakOnce,
      fixPackage,
    ],
  );

  const buildFixOfferCard = useCallback(
    (): ActionCardData => {
      const failing = auditResult?.checks?.filter((c) => !c.passed).length ?? 0;
      return {
        label: 'Fix offer',
        message: `Your site scores ${auditResult?.score ?? 0} out of 100. ${failing} signal${failing !== 1 ? 's are' : ' is'} missing. I can fix ${failing === 1 ? 'it' : 'all of them'} for five credits — about a dollar. How would you like to proceed?`,
        actions: [
          {
            label: '✓ DO IT FOR ME',
            fn: () => {
              setDeliveryOption('C');
              setActiveCard(null);
              void sendMessage('yes fix it for me').then(() => {
                void handleApplyFix();
              });
            },
          },
          {
            label: 'GUIDE ME',
            fn: () => {
              setDeliveryOption('B');
              setActiveCard(null);
              void sendMessage('guide me through the fix');
            },
          },
          {
            label: "I'LL DO IT",
            fn: () => {
              setDeliveryOption('A');
              setActiveCard(null);
              void sendMessage("I'll fix it myself");
            },
          },
        ],
      };
    },
    [auditResult, sendMessage, handleApplyFix],
  );

  const handleUrlConfirm = useCallback(
    async (url: string) => {
      setPendingUrl(null);
      try {
        setScanDomain(new URL(url).hostname);
      } catch {
        setScanDomain(url);
      }
      setPhase('scanning');
      setActiveInput(url);
      await runAuditFromChat(url);
    },
    [runAuditFromChat],
  );

  const handleUserText = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text) return;
      setError('');
      setActiveInput(text);

      const urlMatch = text.match(
        /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/\S*)?)/i,
      );
      if (urlMatch && !auditResult) {
        const rawUrl = urlMatch[0];
        const normalized = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
        setPendingUrl(normalized);
        return;
      }

      await sendMessage(text);
    },
    [auditResult, sendMessage],
  );

  const {
    state: sttState,
    transcript,
    startListening,
    stopListening,
    isSupported: isSttSupported,
  } = useSorenSTT((recognizedText) => {
    void handleUserText(recognizedText);
  });

  const GREETING =
    "I'm Soren. Give me any website and I'll tell you exactly how visible your product is to AI engines — and what needs to change.";

  const handleMicClick = useCallback(() => {
    if (!isSttSupported) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }
    if (sttState === 'listening') {
      stopListening();
      return;
    }
    startListening();
  }, [isSttSupported, sttState, stopListening, startListening]);

  const dismissCard = useCallback(() => {
    if (activeCard) {
      setDockedCards((d) => [...d, activeCard]);
      setActiveCard(null);
    }
  }, [activeCard]);

  const reopenCard = useCallback((i: number) => {
    const card = dockedCards[i];
    setActiveCard(card);
    setDockedCards((d) => d.filter((_, idx) => idx !== i));
  }, [dockedCards]);

  useEffect(() => {
    if (email) {
      void fetchBalance(email);
    }
  }, [email, fetchBalance]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('credits_success') !== 'true') return;

    const urlEmail = params.get('email');
    if (urlEmail) {
      saveEmail(urlEmail);
      void fetchBalance(urlEmail);
    }

    const pendingFix = sessionStorage.getItem('soren_pending_fix');
    if (pendingFix) {
      try {
        const pkg = JSON.parse(pendingFix) as typeof fixPackage;
        if (pkg) {
          restoreFixPackage(pkg);
          sessionStorage.removeItem('soren_pending_fix');

          setTimeout(async () => {
            if (!urlEmail) return;
            const success = await deductCredits(urlEmail, 5, `Fix for ${pkg.platform} site`);
            if (success) {
              setFixApplied(true);
              setDeliveryOption('C');
              void speakOnce(
                'Payment confirmed. Your fix package is ready. Download the files below and follow the steps. Tap the audit button when done and I will check your score.',
              );
            } else if (urlEmail) {
              sessionStorage.setItem('soren_pending_fix', JSON.stringify(pkg));
              await startCheckout(urlEmail, 5, auditResult?.url ?? '');
            }
          }, 1500);
        }
      } catch {
        // JSON parse failed — ignore
      }
    } else {
      void speakOnce('Your credits are ready. Tell me your website and I will fix it.');
    }

    window.history.replaceState({}, '', window.location.pathname);
  }, [
    saveEmail,
    fetchBalance,
    speakOnce,
    restoreFixPackage,
    deductCredits,
    startCheckout,
    auditResult?.url,
  ]);

  useEffect(() => {
    if (!fixPackage) {
      setFixApplied(false);
    }
  }, [fixPackage]);

  useEffect(() => {
    const enableVoice = () => setVoiceEnabled(true);
    document.addEventListener('click', enableVoice, { once: true });
    return () => document.removeEventListener('click', enableVoice);
  }, []);

  useEffect(() => {
    if (!voiceEnabled) return;

    const hasGreeted = sessionStorage.getItem('soren_greeted');
    if (hasGreeted) return;

    sessionStorage.setItem('soren_greeted', '1');
    void speakOnce(GREETING);
  }, [voiceEnabled, speakOnce]);

  useEffect(() => {
    if (isThinking) {
      setPhase('scanning');
      return;
    }
    if (auditResult) {
      setPhase('briefing');
      return;
    }
    setPhase('idle');
  }, [isThinking, auditResult]);

  useEffect(() => {
    if (!auditResult) return;
    const text = buildBriefingText(auditResult);
    void speakOnce(text);
  }, [auditResult, speakOnce]);

  useEffect(() => {
    if (!auditResult) return;
    if (shownCardForUrl.current === auditResult.url) return;
    if (activeCard || deliveryOption) return;

    shownCardForUrl.current = auditResult.url;
    setActiveCard(buildFixOfferCard());
  }, [auditResult, activeCard, deliveryOption, buildFixOfferCard]);

  const orbState: OrbState =
    sttState === 'listening'
      ? 'listening'
      : isThinking
        ? 'thinking'
        : isSpeaking
          ? 'speaking'
          : 'idle';

  const statusText = !voiceEnabled
    ? '● OFFLINE'
    : sttState === 'listening'
      ? '● HEARING YOU...'
      : isThinking
        ? '● PROCESSING...'
        : isSpeaking
          ? '● SOREN SPEAKING'
          : '● LISTENING';

  const auditPlatform =
    auditResult && 'platform' in auditResult
      ? String((auditResult as { platform?: string }).platform ?? 'Website')
      : 'Website';

  return (
    <div
      style={{
        background: HUD.bg,
        minHeight: '100vh',
        fontFamily: MONO,
        color: HUD.text,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* TOP BAR */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          flexShrink: 0,
          borderBottom: `1px solid ${HUD.panelBorder}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              border: `2px solid ${HUD.teal}`,
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, color: HUD.teal }}>
            SOREN · FIXES · IT
          </span>
          <span style={{ fontSize: 9, color: HUD.textDim, letterSpacing: 0.5 }}>
            geo-discoverability · v1.0
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={toggleMute}
            style={{
              background: 'transparent',
              border: `1px solid ${HUD.tealFaint}`,
              color: isMuted ? HUD.red : HUD.textDim,
              padding: '4px 12px',
              borderRadius: 4,
              fontFamily: MONO,
              fontSize: 9,
              cursor: 'pointer',
            }}
          >
            {isMuted ? '🔇 MUTED' : '🎙 LIVE'}
          </button>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              border: `1px solid ${HUD.tealFaint}`,
              borderRadius: 999,
              padding: '5px 14px',
              fontSize: 9,
              fontWeight: 700,
              color: voiceEnabled ? HUD.green : HUD.textDim,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: voiceEnabled ? HUD.green : HUD.textDim,
                animation: voiceEnabled ? 'hud-blink 1.4s infinite' : 'none',
              }}
            />
            {statusText}
          </div>
        </div>
      </div>

      {/* TICKER */}
      <div
        style={{
          overflow: 'hidden',
          borderBottom: `1px solid ${HUD.panelBorder}`,
          padding: '5px 0',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'inline-block', animation: 'hud-marquee 28s linear infinite' }}>
          {[...Array(2)]
            .flatMap(() => [
              'SESSION ACTIVE',
              'GEO AUDIT READY',
              'SOREN · FIXES · IT',
              'VARSHYL INC · PLEASANTON CA',
              'CLAUDE SONNET 4.6',
              'ELEVENLABS TTS',
              'STRIPE CREDITS LIVE',
              'BARGE-IN ENABLED',
              'SYSTEM NOMINAL',
            ])
            .map((x, i) => (
              <span
                key={i}
                style={{ fontSize: 10, color: HUD.tealDim, letterSpacing: 0.5, marginRight: 28 }}
              >
                ● {x}
              </span>
            ))}
        </div>
      </div>

      {/* SPLIT CONTENT */}
      <div
        className="soren-split"
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'clamp(260px,42%,420px) 1fr',
          minHeight: 0,
        }}
      >
        {/* LEFT — SOREN */}
        <div
          className="soren-left"
          style={{
            borderRight: `1px solid ${HUD.panelBorder}`,
            padding: '32px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            overflowY: 'auto',
          }}
        >
          <SorenOrb state={orbState} size={160} />

          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 6,
                color: HUD.teal,
                marginBottom: 4,
              }}
            >
              SOREN
            </div>
            <div style={{ fontSize: 9, color: HUD.textDim, letterSpacing: 1.5, lineHeight: 1.8 }}>
              AI DISCOVERABILITY AGENT
              <br />
              GEO · FIX · MONITOR
            </div>
          </div>

          <div style={{ display: 'flex', gap: 2, height: 12, alignItems: 'center' }}>
            {Array.from({ length: 36 }).map((_, i) => (
              <span
                key={i}
                style={{
                  width: 2,
                  height: 2,
                  borderRadius: 999,
                  background: HUD.teal,
                  animation: `hud-dot 1.6s ease-in-out ${i * 0.04}s infinite`,
                }}
              />
            ))}
          </div>

          {pendingUrl && (
            <div style={{ width: '100%' }}>
              <URLConfirmCard
                url={pendingUrl}
                onConfirm={handleUrlConfirm}
                onWrong={() => {
                  setPendingUrl(null);
                  void speak(cleanForSpeech("I didn't catch that. Please say the website again."));
                }}
              />
            </div>
          )}

          {!voiceEnabled && (
            <div style={{ textAlign: 'center', marginTop: 8, animation: 'hud-fade-up .4s ease' }}>
              <p style={{ fontSize: 12, color: HUD.textDim, lineHeight: 1.7, marginBottom: 16 }}>
                Tap to activate Soren&apos;s voice.
                <br />
                Speak naturally — no button needed.
              </p>
              <button
                onClick={() => setVoiceEnabled(true)}
                style={{
                  background: HUD.grad,
                  border: 'none',
                  color: 'white',
                  padding: '13px 36px',
                  borderRadius: 10,
                  fontFamily: 'Inter,sans-serif',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 8px 28px rgba(168,85,247,0.35)',
                }}
              >
                Talk to Soren
              </button>
            </div>
          )}

          {voiceEnabled && !pendingUrl && (
            <div style={{ width: '100%', maxWidth: 280, marginTop: 'auto' }}>
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  background: HUD.panel,
                  border: `1px solid ${HUD.tealFaint}`,
                  borderRadius: 8,
                  padding: 5,
                  marginBottom: 10,
                }}
              >
                <input
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && draft.trim()) {
                      void handleUserText(draft);
                      setDraft('');
                    }
                  }}
                  placeholder="or type here..."
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontFamily: MONO,
                    fontSize: 12,
                    color: HUD.text,
                    padding: '6px 8px',
                    caretColor: HUD.teal,
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleMicClick}
                  disabled={!!pendingUrl}
                  style={{
                    flex: 1,
                    padding: '11px 0',
                    borderRadius: 7,
                    border: `1px solid ${sttState === 'listening' ? HUD.red : HUD.teal}`,
                    background:
                      sttState === 'listening' ? 'rgba(248,113,113,0.1)' : 'rgba(94,234,212,0.08)',
                    color: sttState === 'listening' ? HUD.red : HUD.teal,
                    fontFamily: MONO,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {sttState === 'listening' ? '■ STOP' : '🎙 SPEAK'}
                </button>
                <button
                  onClick={toggleMute}
                  style={{
                    padding: '11px 14px',
                    borderRadius: 7,
                    border: `1px solid ${HUD.tealFaint}`,
                    background: 'transparent',
                    color: isMuted ? HUD.red : HUD.textDim,
                    fontFamily: MONO,
                    fontSize: 10,
                    cursor: 'pointer',
                  }}
                >
                  {isMuted ? '🔇' : '🎙'}
                </button>
              </div>
              {error && (
                <p
                  style={{
                    fontSize: 11,
                    color: HUD.red,
                    marginTop: 8,
                    fontFamily: 'Inter,sans-serif',
                  }}
                >
                  ⚠ {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — CONVERSATION + RESULTS */}
        <div
          style={{
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflowY: 'auto',
            paddingBottom: dockedCards.length ? 56 : 20,
          }}
        >
          {activeCard && <ActionCard card={activeCard} onDismiss={dismissCard} />}

          {phase === 'scanning' && (
            <div
              style={{
                border: `1px solid ${HUD.panelBorder}`,
                borderRadius: 8,
                background: HUD.panel,
                padding: '14px 16px',
                animation: 'hud-slide-right .4s ease',
              }}
            >
              <div style={{ fontSize: 9, color: HUD.textDim, fontFamily: MONO, marginBottom: 8 }}>
                SCANNING {scanDomain || activeInput || 'your-site.com'}
              </div>
              <div style={{ fontSize: 11, color: HUD.tealDim }}>
                {isThinking ? 'Running GEO audit...' : 'Preparing scan...'}
              </div>
            </div>
          )}

          {fixPackage && deliveryOption && (
            <div style={{ animation: 'hud-slide-right .4s ease' }}>
              {showEmailGate && (
                <div style={{ marginBottom: 16 }}>
                  <EmailGate
                    isLoading={creditsLoading}
                    onSubmit={(e) => {
                      setShowEmailGate(false);
                      void handleApplyFix(e);
                    }}
                  />
                </div>
              )}
              <FixPackage
                pkg={fixPackage}
                onClose={() => {
                  clearFixPackage();
                  setDeliveryOption(null);
                }}
                onApplyFix={handleApplyFix}
                isApplying={isApplying}
                applyError={applyError}
                creditsBalance={balance}
                downloadsUnlocked={fixApplied || deliveryOption === 'C'}
              />
            </div>
          )}

          {auditResult && (
            <div
              style={{
                border: `1px solid ${HUD.panelBorder}`,
                borderRadius: 8,
                background: HUD.panel,
                overflow: 'hidden',
                animation: 'hud-slide-right .4s ease',
              }}
            >
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: `1px solid ${HUD.panelBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 9,
                      color: HUD.textDim,
                      letterSpacing: 1.5,
                      marginBottom: 3,
                    }}
                  >
                    GEO AUDIT RESULT
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: HUD.text }}>
                    {auditResult.url}
                  </div>
                  <div style={{ fontSize: 10, color: HUD.tealDim, marginTop: 2 }}>
                    {auditPlatform} ·{' '}
                    {auditResult.checks?.filter((c) => c.passed).length}/{auditResult.checks?.length}{' '}
                    signals active · score {auditResult.score}/100
                  </div>
                </div>
              </div>
              <div
                style={{
                  padding: '12px 16px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 5,
                }}
              >
                {auditResult.checks?.map((c, i) => (
                  <div
                    key={c.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '6px 9px',
                      borderRadius: 5,
                      background: c.passed ? 'rgba(52,211,153,0.04)' : 'rgba(248,113,113,0.04)',
                      border: `1px solid ${c.passed ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)'}`,
                      animation: `hud-fade-up .3s ease ${i * 35}ms both`,
                    }}
                  >
                    <span style={{ fontSize: 10 }}>{c.passed ? '✅' : '❌'}</span>
                    <span style={{ flex: 1, fontFamily: 'Inter,sans-serif', fontSize: 11, color: HUD.text }}>
                      {c.name}
                    </span>
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 9,
                        color: c.passed ? HUD.green : HUD.red,
                      }}
                    >
                      {c.passed ? `+${c.maxPoints}` : `0/${c.maxPoints}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              border: `1px solid ${HUD.panelBorder}`,
              borderRadius: 8,
              background: HUD.panel,
              padding: '14px 16px',
              flex: 1,
              minHeight: 180,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: HUD.textDim }}>
                CONVERSATION LOG
              </span>
              {voiceEnabled && (
                <span
                  style={{
                    fontSize: 9,
                    color: HUD.green,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: HUD.green,
                      animation: 'hud-blink 1.4s infinite',
                    }}
                  />
                  LIVE
                </span>
              )}
            </div>
            {messages.map((msg, i) => (
              <div
                key={`${msg.role}-${i}`}
                style={{ fontSize: 11, lineHeight: 1.7, animation: 'hud-fade-up .2s ease', marginBottom: 2 }}
              >
                <span style={{ color: HUD.textDim, marginRight: 8 }}>
                  {msg.role === 'user' ? 'you:' : 'soren:'}
                </span>
                <span style={{ color: msg.role === 'user' ? HUD.text : HUD.tealDim }}>{msg.content}</span>
              </div>
            ))}
            {isThinking && (
              <div style={{ fontSize: 11, color: HUD.textDim, animation: 'hud-fade-up .2s ease' }}>
                <span style={{ marginRight: 8 }}>soren:</span>
                <span style={{ animation: 'hud-blink 1s infinite' }}>thinking...</span>
              </div>
            )}
            {transcript && (
              <div style={{ fontSize: 11, color: HUD.amber, animation: 'hud-fade-up .2s ease' }}>
                <span style={{ marginRight: 8 }}>you:</span>
                {transcript}
                <span style={{ animation: 'hud-blink .8s step-end infinite' }}>│</span>
              </div>
            )}
            {voiceEnabled && !pendingUrl && !messages.length && (
              <div style={{ fontSize: 10, color: HUD.textDim, marginTop: 8 }}>
                &gt; speak naturally — no button needed
              </div>
            )}
          </div>
        </div>
      </div>

      <DockedTray cards={dockedCards} onReopen={reopenCard} />
    </div>
  );
}
