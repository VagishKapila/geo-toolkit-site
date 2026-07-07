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

const CHECK_PLAIN: Record<string, { title: string; why: string; sorenFix: string }> = {
  'llms.txt': {
    title: 'AI engines can\'t find your product guide',
    why: 'When ChatGPT or Claude searches for products like yours, they look for an AI guide file first. Without it, they guess what your product does — and guessing leads to wrong answers.',
    sorenFix: 'I\'d generate your AI guide file pre-filled with your real product details. One file, deployed in 30 seconds.',
  },
  'robots.txt AI crawlers': {
    title: 'You\'re blocking AI from reading your site',
    why: 'Your robots file doesn\'t list the major AI crawlers. GPTBot, ClaudeBot, and PerplexityBot are treating your site as off-limits.',
    sorenFix: 'I\'d update your robots file to explicitly allow the AI crawlers that matter. Takes me 10 seconds.',
  },
  'JSON-LD script': {
    title: 'AI doesn\'t know what type of product you are',
    why: 'Structured data tells AI engines your exact product category and key facts. Without it, AI infers from page text — which is unreliable.',
    sorenFix: 'I\'d generate the exact structured data for your product type, pre-filled with your company and product information.',
  },
  'Open Graph tags': {
    title: 'Your site shows as a blank when shared',
    why: 'Open Graph tags control how your link looks when shared and signal to AI systems what your page title, description, and key image are.',
    sorenFix: 'I\'d add all four required Open Graph tags to your page header with your real content.',
  },
  'Twitter card tag': {
    title: 'Missing social sharing metadata',
    why: 'The Twitter card tag signals that your content is meant to be shared and cited — a trust signal AI engines use when deciding whether to reference you.',
    sorenFix: 'One meta tag. I\'d add it in seconds.',
  },
  'Heading structure': {
    title: 'AI can\'t understand your page structure',
    why: 'AI engines use heading tags to understand what a page is about. A page without clear headings is like a document without chapters.',
    sorenFix: 'I\'d add the missing heading tags in the right places without changing your visual design.',
  },
  'sitemap.xml': {
    title: 'AI crawlers are missing your key pages',
    why: 'A sitemap tells AI crawlers exactly which pages exist on your site. Without one, crawlers stumble through randomly and may miss important content.',
    sorenFix: 'I\'d generate a complete sitemap for all your pages and configure it to auto-update.',
  },
  'Canonical link': {
    title: 'AI may be reading duplicate versions of your site',
    why: 'The canonical tag tells AI which version of a page is definitive. Without it, AI may treat duplicate URLs as separate conflicting sources.',
    sorenFix: 'I\'d add the canonical tag pointing to your primary URL on every page.',
  },
  'Schema.org entity': {
    title: 'AI doesn\'t know who built this product',
    why: 'Schema markup connects your product to your company — building the knowledge graph AI systems use to determine credibility and attribution.',
    sorenFix: 'I\'d generate the complete entity graph connecting your product, company, and founder identity.',
  },
};

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
function SorenOrb({ state, size = 160, compact = false }: { state: OrbState; size?: number; compact?: boolean }) {
  const listening = state === 'listening';
  const thinking = state === 'thinking';
  const speaking = state === 'speaking';
  return (
    <div className="soren-orb-wrap" style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
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
      {!compact && [0, 1, 2].map((i) => (
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
function ActionCard({
  card,
  onDismiss,
  sticky = false,
}: {
  card: ActionCardData;
  onDismiss: () => void;
  sticky?: boolean;
}) {
  return (
    <div
      style={{
        background: HUD.panel,
        border: `1px solid ${HUD.tealFaint}`,
        borderRadius: 8,
        padding: '14px 16px',
        animation: 'hud-card-in .25s ease',
        marginBottom: 10,
        ...(sticky
          ? { position: 'sticky', top: 0, zIndex: 10 }
          : {}),
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
  const [openCheck, setOpenCheck] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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
              void sendMessage('yes fix it guide me through the steps');
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
      setOpenCheck(null);
      setActiveCard(null);
      setDeliveryOption(null);
      shownCardForUrl.current = null;
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

  const handleTextSubmit = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text) return;
      setError('');
      setActiveInput(text);

      const urlMatch = text.match(
        /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/\S*)?)/i,
      );
      if (urlMatch) {
        const raw = urlMatch[0];
        const normalized = raw.startsWith('http') ? raw : `https://${raw}`;
        clearFixPackage();
        setOpenCheck(null);
        setActiveCard(null);
        setDeliveryOption(null);
        shownCardForUrl.current = null;
        setPendingUrl(normalized);
        setDraft('');
        return;
      }

      await sendMessage(text);
      setDraft('');
    },
    [sendMessage, clearFixPackage],
  );

  const {
    state: sttState,
    transcript,
    startListening,
    stopListening,
    isSupported: isSttSupported,
  } = useSorenSTT((recognizedText) => {
    void handleTextSubmit(recognizedText);
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
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

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
        className="soren-ticker"
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
          <div className="soren-left-orb">
            <SorenOrb state={orbState} size={isMobile ? 100 : 160} compact={isMobile} />
          </div>

          <div className="soren-left-meta" style={{ textAlign: 'center' }}>
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

          <div className="soren-left-waveform" style={{ display: 'flex', gap: 2, height: 12, alignItems: 'center' }}>
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
            <div className="soren-left-controls" style={{ width: '100%', maxWidth: 280, marginTop: 'auto' }}>
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
                      void handleTextSubmit(draft);
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
                  {sttState === 'listening' ? '⬛ STOP LISTENING' : '🎙 SPEAK'}
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
              <p
                style={{
                  fontSize: 9,
                  color: HUD.textDim,
                  marginTop: 8,
                  textAlign: 'center',
                  fontFamily: MONO,
                }}
              >
                Speak — Soren listens automatically
              </p>
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
          {activeCard && (
            <ActionCard card={activeCard} onDismiss={dismissCard} sticky={isMobile} />
          )}

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

          {fixPackage && deliveryOption === 'B' && (
            <div
              style={{
                border: `1px solid ${HUD.panelBorder}`,
                borderRadius: 8,
                background: HUD.panel,
                padding: '16px 18px',
                animation: 'hud-slide-right .4s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 9,
                      color: HUD.textDim,
                      fontFamily: MONO,
                      letterSpacing: 1.5,
                      marginBottom: 4,
                    }}
                  >
                    GUIDED FIX — {fixPackage.platform?.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: HUD.text }}>
                    Step by step instructions
                  </div>
                </div>
                <button
                  onClick={() => setDeliveryOption(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: HUD.textDim,
                    cursor: 'pointer',
                    fontSize: 16,
                  }}
                >
                  ✕
                </button>
              </div>

              {fixPackage.instructions?.map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 12,
                    marginBottom: 14,
                    padding: '10px 12px',
                    borderRadius: 6,
                    background: 'rgba(94,234,212,0.04)',
                    border: `1px solid ${HUD.tealFaint}`,
                    animation: `hud-fade-up .3s ease ${i * 60}ms both`,
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: 'rgba(94,234,212,0.15)',
                      border: `1px solid ${HUD.teal}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: 10,
                      fontWeight: 700,
                      color: HUD.teal,
                      fontFamily: MONO,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: HUD.text,
                        marginBottom: 3,
                        fontFamily: 'Inter,sans-serif',
                      }}
                    >
                      {step.title}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: HUD.textDim,
                        fontFamily: 'Inter,sans-serif',
                        lineHeight: 1.6,
                      }}
                    >
                      {step.detail}
                    </div>
                  </div>
                </div>
              ))}

              {fixPackage.files?.map((file, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: 6,
                    background: 'rgba(94,234,212,0.04)',
                    border: `1px solid ${HUD.tealFaint}`,
                    marginBottom: 8,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: HUD.teal,
                        fontFamily: MONO,
                        marginBottom: 2,
                      }}
                    >
                      {file.filename}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: HUD.textDim,
                        fontFamily: 'Inter,sans-serif',
                      }}
                    >
                      {file.description}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const blob = new Blob([file.content], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = file.filename;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    style={{
                      background: 'rgba(94,234,212,0.08)',
                      border: `1px solid ${HUD.teal}`,
                      color: HUD.teal,
                      padding: '6px 14px',
                      borderRadius: 5,
                      fontFamily: MONO,
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                      marginLeft: 12,
                    }}
                  >
                    ↓ DOWNLOAD
                  </button>
                </div>
              ))}

              <button
                onClick={() => {
                  setDeliveryOption(null);
                  void speak(
                    cleanForSpeech(
                      'Done. Tell me the website again and I will re-check your score.',
                    ),
                  );
                }}
                style={{
                  width: '100%',
                  padding: '10px 0',
                  borderRadius: 6,
                  marginTop: 8,
                  border: `1px solid ${HUD.tealFaint}`,
                  background: 'transparent',
                  color: HUD.textDim,
                  fontFamily: MONO,
                  fontSize: 10,
                  cursor: 'pointer',
                }}
              >
                ✓ DONE — RE-CHECK MY SCORE
              </button>
            </div>
          )}

          {fixPackage && (deliveryOption === 'A' || deliveryOption === 'C') && (
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

          {auditResult && phase !== 'scanning' && (
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
                  background:
                    auditResult.score >= 90
                      ? 'rgba(52,211,153,0.08)'
                      : auditResult.score >= 75
                        ? 'rgba(94,234,212,0.08)'
                        : auditResult.score >= 55
                          ? 'rgba(251,191,36,0.08)'
                          : 'rgba(248,113,113,0.08)',
                }}
              >
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: isMobile ? 32 : 28,
                    fontWeight: 700,
                    color:
                      auditResult.score >= 90
                        ? HUD.green
                        : auditResult.score >= 75
                          ? HUD.teal
                          : auditResult.score >= 55
                            ? HUD.amber
                            : HUD.red,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  {auditResult.score}
                </div>
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
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 5,
                  padding: '12px 16px',
                }}
              >
                {auditResult.checks?.map((c, i) => {
                  const isOpen = openCheck === c.name;
                  return (
                    <div key={c.name} style={!c.passed && isOpen ? { gridColumn: '1 / -1' } : undefined}>
                      <div
                        role={c.passed ? undefined : 'button'}
                        onClick={() => {
                          if (c.passed) return;
                          setOpenCheck(isOpen ? null : c.name);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          padding: '6px 9px',
                          borderRadius: 5,
                          background: c.passed
                            ? 'rgba(52,211,153,0.04)'
                            : 'rgba(248,113,113,0.04)',
                          border: `1px solid ${c.passed ? 'rgba(52,211,153,0.1)' : isOpen ? HUD.tealFaint : 'rgba(248,113,113,0.1)'}`,
                          animation: `hud-fade-up .3s ease ${i * 35}ms both`,
                          cursor: c.passed ? 'default' : 'pointer',
                        }}
                      >
                        <span style={{ fontSize: 10 }}>{c.passed ? '✅' : '❌'}</span>
                        <span
                          style={{
                            flex: 1,
                            fontFamily: 'Inter,sans-serif',
                            fontSize: 11,
                            color: HUD.text,
                          }}
                        >
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
                      {!c.passed && isOpen && (
                        <div
                          style={{
                            marginTop: 4,
                            background: 'rgba(10,14,13,0.9)',
                            border: '1px solid rgba(248,113,113,0.2)',
                            borderRadius: 6,
                            padding: '12px 14px',
                            animation: 'hud-card-in .2s ease',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              gap: 10,
                              marginBottom: 10,
                              alignItems: 'flex-start',
                            }}
                          >
                            <div
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                background: HUD.grad,
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 700,
                                color: 'white',
                                marginTop: 2,
                              }}
                            >
                              S
                            </div>
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: HUD.teal,
                                  fontFamily: MONO,
                                  marginBottom: 5,
                                  letterSpacing: 0.5,
                                }}
                              >
                                SOREN ANALYSIS
                              </div>
                              {CHECK_PLAIN[c.name] ? (
                                <>
                                  <p
                                    style={{
                                      fontSize: 12,
                                      color: HUD.amber,
                                      fontFamily: 'Inter,sans-serif',
                                      fontWeight: 600,
                                      lineHeight: 1.5,
                                      margin: '0 0 6px',
                                    }}
                                  >
                                    {CHECK_PLAIN[c.name].title}
                                  </p>
                                  <p
                                    style={{
                                      fontSize: 12,
                                      color: HUD.text,
                                      fontFamily: 'Inter,sans-serif',
                                      lineHeight: 1.65,
                                      margin: 0,
                                    }}
                                  >
                                    {CHECK_PLAIN[c.name].why}
                                  </p>
                                </>
                              ) : (
                                <p
                                  style={{
                                    fontSize: 12,
                                    color: HUD.text,
                                    fontFamily: 'Inter,sans-serif',
                                    lineHeight: 1.65,
                                    margin: 0,
                                  }}
                                >
                                  {c.tip}
                                </p>
                              )}
                            </div>
                          </div>

                          {CHECK_PLAIN[c.name] && (
                            <div
                              style={{
                                background: 'rgba(94,234,212,0.04)',
                                border: `1px solid ${HUD.tealFaint}`,
                                borderRadius: 6,
                                padding: '8px 12px',
                                fontSize: 12,
                                color: HUD.textDim,
                                fontFamily: 'Inter,sans-serif',
                                fontStyle: 'italic',
                                marginBottom: 12,
                                lineHeight: 1.5,
                              }}
                            >
                              &ldquo;{CHECK_PLAIN[c.name].sorenFix}&rdquo;
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenCheck(null);
                                setActiveCard({
                                  label: `Fix: ${c.name}`,
                                  message:
                                    CHECK_PLAIN[c.name]?.sorenFix ??
                                    'I can fix this for you. Five credits — about one dollar. Shall I begin?',
                                  actions: [
                                    {
                                      label: '✓ LET SOREN FIX — 5 CREDITS',
                                      fn: () => {
                                        setDeliveryOption('C');
                                        setActiveCard(null);
                                        void sendMessage('yes fix it for me').then(() => {
                                          void handleApplyFix();
                                        });
                                      },
                                    },
                                    {
                                      label: "I'LL DO IT MYSELF",
                                      fn: () => {
                                        setDeliveryOption('A');
                                        setActiveCard(null);
                                        void sendMessage("I'll fix it myself");
                                      },
                                    },
                                  ],
                                });
                              }}
                              style={{
                                flex: 1,
                                padding: '8px 0',
                                borderRadius: 5,
                                border: `1px solid ${HUD.teal}`,
                                background: 'rgba(94,234,212,0.08)',
                                color: HUD.teal,
                                fontFamily: MONO,
                                fontSize: 10,
                                fontWeight: 700,
                                cursor: 'pointer',
                                minWidth: 160,
                              }}
                            >
                              LET SOREN FIX — 5 CREDITS
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenCheck(null);
                              }}
                              style={{
                                padding: '8px 14px',
                                borderRadius: 5,
                                border: `1px solid ${HUD.tealFaint}`,
                                background: 'transparent',
                                color: HUD.textDim,
                                fontFamily: MONO,
                                fontSize: 10,
                                cursor: 'pointer',
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div
            style={{
              border: `1px solid ${HUD.panelBorder}`,
              borderRadius: 8,
              background: HUD.panel,
              padding: '14px 16px',
              flex: isMobile && !showLog ? undefined : 1,
              minHeight: isMobile && !showLog ? undefined : 180,
            }}
          >
            <button
              type="button"
              onClick={() => isMobile && setShowLog((v) => !v)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: isMobile && !showLog ? 0 : 12,
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: isMobile ? 'pointer' : 'default',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: HUD.textDim }}>
                CONVERSATION LOG
                {isMobile && (
                  <span style={{ marginLeft: 8, color: HUD.tealDim }}>
                    {showLog ? '▲' : '▼'} {messages.length} message{messages.length !== 1 ? 's' : ''}
                  </span>
                )}
              </span>
              {voiceEnabled && (!isMobile || showLog) && (
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
            </button>
            {(!isMobile || showLog) && (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>

      <DockedTray cards={dockedCards} onReopen={reopenCard} />
    </div>
  );
}
