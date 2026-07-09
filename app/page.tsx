'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SorenBrain, type BrainMode } from '../components/SorenBrain';
import { FixDeliveryCards } from '../components/FixDeliveryCards';
import { useSorenVoice } from '../hooks/useSorenVoice';
import { useSorenSTT } from '../hooks/useSorenSTT';
import { useSorenChat, type AuditResult } from '../hooks/useSorenChat';
import { useCredits } from '../hooks/useCredits';
import { cleanForSpeech } from '../lib/cleanForSpeech';

const FIX_URL =
  'https://toolkit-demo-host-production-ac14.up.railway.app/api/soren/fix';

type AuditWithPlatform = AuditResult & { platform?: string };

export default function SorenApp() {
  const {
    speak, stop, isSpeaking, isMuted, toggleMute,
  } = useSorenVoice();

  const speakOnce = useCallback((text: string) => {
    speak(cleanForSpeech(text));
  }, [speak]);

  const {
    messages, auditResult, fixPackage,
    isThinking, sendMessage,
    runAuditFromChat, clearFixPackage, restoreFixPackage,
  } = useSorenChat((reply: string) => {
    speakOnce(reply);
  });

  const {
    email, balance, saveEmail,
    fetchBalance,
  } = useCredits();

  const [brainMode, setBrainMode] = useState<BrainMode>('idle');
  const [draft, setDraft] = useState('');
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [toast, setToast] = useState('The core is visible and breathing softly.');
  const [showFix, setShowFix] = useState(false);
  const [, setVoiceEnabled] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUrlConfirm = useCallback(
    async (url: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setPendingUrl(null);
      clearFixPackage();
      setShowFix(false);
      setBrainMode('scanning');
      setToast(`Scanning ${url}...`);
      try {
        await runAuditFromChat(url);
      } catch (e) {
        console.error('[CONFIRM]', e);
        setToast('Scan failed. Try again.');
        setBrainMode('idle');
      }
    },
    [runAuditFromChat, clearFixPackage],
  );

  const runTypedScan = useCallback(async (raw: string) => {
    if (!raw.trim()) return;
    const url = raw.startsWith('http') ? raw : `https://${raw}`;
    setDraft('');
    clearFixPackage();
    setShowFix(false);
    setPendingUrl(null);
    setBrainMode('scanning');
    setToast(`Scanning ${url}...`);
    try {
      await runAuditFromChat(url);
    } catch (e) {
      console.error('[SCAN]', e);
      setToast('Scan failed. Try again.');
      setBrainMode('idle');
    }
  }, [clearFixPackage, runAuditFromChat]);

  const handleSTTResult = useCallback(
    async (text: string) => {
      setToast(`I heard: ${text}`);

      const urlMatch = text.match(
        /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/\S*)?)/i,
      );
      if (urlMatch) {
        const raw = urlMatch[0];
        const norm = raw.startsWith('http') ? raw : `https://${raw}`;
        setPendingUrl(norm);
        setBrainMode('thinking');
        setToast(`I heard ${norm}. Confirming...`);
        timerRef.current = setTimeout(() => handleUrlConfirm(norm), 3000);
        return;
      }

      setBrainMode('thinking');
      setToast('Thinking...');
      await sendMessage(text);
    },
    [sendMessage, handleUrlConfirm],
  );

  const stt = useSorenSTT(handleSTTResult);

  useEffect(() => {
    if (isSpeaking) {
      setBrainMode('speaking');
      return;
    }
    if (stt.state === 'listening') {
      setBrainMode('listening');
      return;
    }
    if (showFix) {
      setBrainMode('repair');
      return;
    }
    if (auditResult && !showFix) {
      setBrainMode('results');
      return;
    }
    setBrainMode((prev) => {
      if (prev === 'scanning') return prev;
      if (isThinking) return 'thinking';
      return 'idle';
    });
  }, [isSpeaking, isThinking, stt.state, auditResult, showFix]);

  useEffect(() => {
    if (stt.transcript) {
      setToast(`I heard: "${stt.transcript}"`);
    }
  }, [stt.transcript]);

  useEffect(() => {
    const unlock = () => {
      setAudioUnlocked(true);
      document.removeEventListener('click', unlock);
    };
    document.addEventListener('click', unlock, { once: true });
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role === 'assistant') {
      setToast(last.content);
    }
  }, [messages]);

  useEffect(() => {
    if (!auditResult) return;
    const failing = auditResult.checks?.filter((c) => !c.passed).length ?? 0;
    setToast(
      `Analysis complete. Score: ${auditResult.score}/100. ` +
      `${failing} signal${failing !== 1 ? 's' : ''} need fixing.`,
    );
  }, [auditResult]);

  useEffect(() => {
    if (!auditResult || fixPackage) return;
    const failing = auditResult.checks.filter((c) => !c.passed);
    if (!failing.length) return;
    const ar = auditResult as AuditWithPlatform;
    const platform = ar.platform ?? 'Website';
    void fetch(FIX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        failingChecks: failing.map((c) => ({ name: c.name, tip: c.tip ?? '' })),
        siteUrl: auditResult.url,
      }),
    })
      .then((r) => r.json())
      .then((pkg) => {
        if (pkg?.files) restoreFixPackage(pkg);
      })
      .catch(() => { /* prefetch is best-effort */ });
  }, [auditResult, fixPackage, restoreFixPackage]);

  const handleMicClick = useCallback(() => {
    if (stt.state === 'listening') {
      stt.stopListening();
      return;
    }
    setVoiceEnabled(true);
    stop();
    setTimeout(() => {
      try {
        stt.startListening();
      } catch (e) {
        console.error('[MIC]', e);
        setToast('Microphone error. Check browser permissions.');
      }
    }, 350);
  }, [stt, stop]);

  const handleFixIt = useCallback(() => {
    if (!auditResult) return;
    setShowFix(true);
    setBrainMode('repair');
    setToast('Master Repair Plan ready.');
    speakOnce(
      'I have your repair plan ready. Choose how you would like to proceed.',
    );
  }, [auditResult, speakOnce]);

  useEffect(() => {
    if (!messages.length || !auditResult) return;
    const last = messages[messages.length - 1];
    if (last.role !== 'user') return;
    const txt = last.content.toLowerCase();
    if (
      txt.includes('fix') ||
      txt.includes('yes') ||
      txt.includes('do it') ||
      txt.includes('repair')
    ) {
      handleFixIt();
    }
  }, [messages, auditResult, handleFixIt]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('credits_success') === 'true') {
      window.history.replaceState({}, '', window.location.pathname);
      const urlEmail = params.get('email');
      if (urlEmail) {
        saveEmail(urlEmail);
        void fetchBalance(urlEmail).then(() => {
          speakOnce('Your credits are ready. Want me to apply the fix now?');
        });
      }
      const pending = sessionStorage.getItem('soren_pending_fix');
      if (pending) {
        sessionStorage.removeItem('soren_pending_fix');
        setShowFix(true);
        setBrainMode('repair');
      }
    }

    const aiSuccess = params.get('ai_package_success');
    if (aiSuccess === 'true') {
      window.history.replaceState({}, '', window.location.pathname);
      const saved = sessionStorage.getItem('soren_ai_package_data');
      if (saved) {
        sessionStorage.removeItem('soren_ai_package_data');
        const pkgData = JSON.parse(saved);
        void fetch(
          'https://toolkit-demo-host-production-ac14.up.railway.app/api/soren/fix/ai-package',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pkgData),
          },
        )
          .then((r) => r.blob())
          .then((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `soren-fix-${pkgData.platform}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            speakOnce(
              'Your AI package is downloading. Paste the prompt into ChatGPT. Your AI will guide you through the rest.',
            );
          });
      }
    }

    const callSuccess = params.get('call_success');
    const calendly = params.get('calendly');
    if (callSuccess === 'true' && calendly) {
      window.history.replaceState({}, '', window.location.pathname);
      window.open(decodeURIComponent(calendly), '_blank');
      speakOnce('Payment confirmed. Your booking page just opened.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const findings = auditResult?.checks?.map((c, i) => ({
    label: c.name.split(' ')[0].slice(0, 4).toUpperCase(),
    kind: (c.passed ? 'pass' : 'fail') as 'fail' | 'warn' | 'pass',
    a: -1.75 + (i * (3.5 / (auditResult.checks.length || 1))),
    r: 260 + (i % 3) * 25,
  })) ?? [];

  const auditPlatform = auditResult
    ? (auditResult as AuditWithPlatform).platform ?? '—'
    : '—';

  const readout: Record<BrainMode, [string, string]> = {
    idle: [
      'Idle intelligence',
      'The core is breathing softly. Say a website name or type it below.',
    ],
    listening: [
      'Listening',
      'Voice input is active. Speak the website.',
    ],
    thinking: [
      'Thinking',
      'The network is interpreting your request.',
    ],
    scanning: [
      'Scanning site',
      `Checking ${auditResult?.url ?? 'the site'} across GEO, ADA, and monitoring.`,
    ],
    results: [
      'Results ready',
      `Score: ${auditResult?.score ?? '—'}/100. ` +
      `${findings.filter((f) => f.kind === 'fail').length} issues found. Say "fix it" to continue.`,
    ],
    repair: [
      'Master Repair Plan',
      'One plan. Three execution paths. Choose how you want to fix everything.',
    ],
    speaking: [
      'Speaking',
      'Soren is explaining the next step.',
    ],
  };

  const [readoutTitle, readoutBody] = readout[brainMode];

  const deliveryAudit = auditResult
    ? {
        url: auditResult.url,
        score: auditResult.score,
        grade: auditResult.grade,
        platform: auditPlatform,
        checks: auditResult.checks.map((c) => ({
          name: c.name,
          passed: c.passed,
          tip: c.tip,
        })),
      }
    : null;

  return (
    <div style={{
      height: '100vh',
      display: 'grid',
      gridTemplateRows: '66px 1fr',
      background:
        'radial-gradient(circle at 50% 35%,rgba(77,234,255,.08),transparent 40%),#02070b',
      overflow: 'hidden',
      color: 'var(--text)',
      fontFamily:
        '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,Arial,sans-serif',
    }}
    >
      <header style={{
        height: 66,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid var(--line)',
        background: 'rgba(0,0,0,.48)',
        backdropFilter: 'blur(16px)',
      }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 14,
            background: 'linear-gradient(135deg,var(--cyan),var(--pink))',
            boxShadow: '0 0 28px rgba(77,234,255,.4)',
          }}
          />
          <div>
            <div style={{
              letterSpacing: '.22em',
              color: 'var(--cyan)',
              fontWeight: 800,
              fontSize: 15,
            }}
            >
              SOREN
            </div>
            <div style={{ display: 'block', color: 'var(--muted)', fontSize: 11 }}>
              Neural Core · GEO Discoverability
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {balance > 0 && (
            <div style={{
              border: '1px solid var(--line)',
              borderRadius: 999,
              padding: '6px 12px',
              color: 'var(--cyan)',
              background: 'rgba(255,255,255,.04)',
              fontSize: 11,
            }}
            >
              {balance}
              {' '}
              credits
            </div>
          )}
          <button
            type="button"
            onClick={toggleMute}
            style={{
              border: '1px solid var(--line)',
              borderRadius: 999,
              padding: '6px 12px',
              color: isMuted ? 'var(--red)' : 'var(--green)',
              background: 'rgba(255,255,255,.04)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {isMuted ? '🔇 Muted' : '🔊 Sound'}
          </button>
          <div style={{
            border: '1px solid var(--line)',
            borderRadius: 999,
            padding: '8px 12px',
            color: 'var(--green)',
            background: 'rgba(255,255,255,.04)',
            fontSize: 12,
            fontWeight: 600,
          }}
          >
            {brainMode.toUpperCase()}
          </div>
        </div>
      </header>

      <main
        className="soren-neural-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '330px 1fr 370px',
          gap: 18,
          padding: 18,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <aside style={{
          border: '1px solid var(--line)',
          borderRadius: 26,
          background: 'var(--panel)',
          backdropFilter: 'blur(16px)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
        }}
        >
          <div>
            <h1 style={{ fontSize: 28, lineHeight: 1.05, margin: '0 0 10px' }}>
              {brainMode === 'idle' && 'Is your site visible to AI?'}
              {brainMode === 'listening' && 'Listening...'}
              {brainMode === 'thinking' && 'Thinking...'}
              {brainMode === 'scanning' && 'Scanning site'}
              {brainMode === 'results' && 'Analysis complete'}
              {brainMode === 'repair' && 'Repair plan ready'}
              {brainMode === 'speaking' && 'Soren speaking'}
            </h1>
            <p style={{
              color: 'var(--muted)',
              lineHeight: 1.5,
              fontSize: 13,
              marginBottom: 20,
            }}
            >
              {readoutBody}
            </p>

            <button
              type="button"
              onClick={handleMicClick}
              style={{
                width: '100%',
                borderRadius: 16,
                padding: 14,
                marginBottom: 8,
                fontWeight: 800,
                cursor: 'pointer',
                letterSpacing: '.04em',
                textTransform: 'uppercase',
                fontSize: 13,
                background: stt.state === 'listening'
                  ? 'rgba(255,96,112,.15)'
                  : 'linear-gradient(135deg,var(--cyan),#91f9ff)',
                color: stt.state === 'listening' ? 'var(--red)' : '#041014',
                border: stt.state === 'listening'
                  ? '1px solid rgba(255,96,112,.5)'
                  : '0',
              }}
            >
              {stt.state === 'listening' ? '⬛ Stop' : '🎙 Speak'}
            </button>
            {stt.state === 'listening' && (
              <p style={{
                fontSize: 12,
                color: 'var(--cyan)',
                textAlign: 'center',
                margin: '6px 0 0',
              }}
              >
                Speak now — I&apos;m listening
              </p>
            )}
            {brainMode === 'scanning' && (
              <p style={{
                fontSize: 12,
                color: 'var(--muted)',
                textAlign: 'center',
                margin: '6px 0 0',
              }}
              >
                Scanning...
              </p>
            )}

            {auditResult && !showFix && (
              <button
                type="button"
                onClick={handleFixIt}
                style={{
                  width: '100%',
                  border: '1px solid rgba(99,255,163,.5)',
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 8,
                  fontWeight: 800,
                  cursor: 'pointer',
                  letterSpacing: '.04em',
                  textTransform: 'uppercase',
                  fontSize: 13,
                  background: 'rgba(99,255,163,.11)',
                  color: 'var(--green)',
                }}
              >
                ✦ Build Repair Plan
              </button>
            )}
          </div>

          <div style={{
            borderTop: '1px solid var(--line)',
            paddingTop: 16,
            marginTop: 16,
          }}
          >
            <label style={{
              fontSize: 11,
              letterSpacing: '.13em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
            }}
            >
              Website to scan
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 72px',
              gap: 8,
              marginTop: 8,
            }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && draft.trim()) {
                    void runTypedScan(draft.trim());
                  }
                }}
                placeholder="varshyl.com"
                style={{
                  minWidth: 0,
                  background: '#08161d',
                  border: '1px solid var(--line)',
                  borderRadius: 15,
                  color: 'var(--text)',
                  padding: 13,
                  fontSize: 13,
                }}
              />
              <button
                type="button"
                onClick={async () => {
                  const raw = draft.trim();
                  if (!raw) return;
                  const url = raw.startsWith('http')
                    ? raw : `https://${raw}`;
                  setDraft('');
                  clearFixPackage();
                  setShowFix(false);
                  setPendingUrl(null);
                  setBrainMode('scanning');
                  setToast(`Scanning ${url}...`);
                  try {
                    await runAuditFromChat(url);
                  } catch (e) {
                    console.error('[SCAN]', e);
                    setToast('Scan failed. Try again.');
                    setBrainMode('idle');
                  }
                }}
                style={{
                  border: 0,
                  borderRadius: 15,
                  padding: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: 13,
                  background: 'linear-gradient(135deg,var(--cyan),#91f9ff)',
                  color: '#041014',
                }}
              >
                Scan
              </button>
            </div>
            {!audioUnlocked && (
              <p style={{
                fontSize: 11,
                color: 'var(--muted)',
                textAlign: 'center',
                marginTop: 8,
              }}
              >
                Click anywhere to enable voice
              </p>
            )}
          </div>
        </aside>

        <section
          className="soren-neural-core"
          style={{
            border: '1px solid var(--line)',
            borderRadius: 26,
            background:
              'radial-gradient(circle at center,rgba(77,234,255,.08),rgba(0,0,0,.04) 38%,rgba(0,0,0,.42))',
            position: 'relative',
            overflow: 'hidden',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(77,234,255,.035) 1px,transparent 1px),' +
              'linear-gradient(90deg,rgba(77,234,255,.035) 1px,transparent 1px)',
            backgroundSize: '44px 44px',
            zIndex: 0,
          }}
          />

          <SorenBrain mode={brainMode} findings={findings} />

          {pendingUrl && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-50%)',
              background: 'rgba(5,16,22,.95)',
              border: '1px solid var(--cyan)',
              borderRadius: 20,
              padding: '24px 28px',
              zIndex: 10,
              minWidth: 320,
              boxShadow: '0 0 40px rgba(77,234,255,.2)',
              animation: 'soren-card-in .25s ease',
            }}
            >
              <div style={{
                fontSize: 10,
                letterSpacing: 1.5,
                color: 'var(--muted)',
                marginBottom: 10,
              }}
              >
                ◉ SOREN HEARD
              </div>
              <input
                autoFocus
                defaultValue={pendingUrl}
                onChange={(e) => {
                  if (timerRef.current) clearTimeout(timerRef.current);
                  const v = e.target.value;
                  timerRef.current = setTimeout(() => handleUrlConfirm(v), 2000);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (timerRef.current) clearTimeout(timerRef.current);
                    handleUrlConfirm((e.target as HTMLInputElement).value);
                  }
                }}
                style={{
                  width: '100%',
                  background: '#08161d',
                  border: '1px solid var(--cyan)',
                  borderRadius: 12,
                  color: 'var(--cyan)',
                  padding: '10px 14px',
                  fontSize: 15,
                  fontWeight: 700,
                  marginBottom: 12,
                  outline: 'none',
                }}
              />
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  color: 'var(--muted)',
                  marginBottom: 5,
                }}
                >
                  <span>AUTO-SCANNING IN</span>
                  <span style={{ color: 'var(--cyan)' }}>3s</span>
                </div>
                <div style={{
                  height: 2,
                  background: 'rgba(77,234,255,.12)',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
                >
                  <div style={{
                    height: '100%',
                    background: 'var(--cyan)',
                    animation: 'soren-countdown 3s linear forwards',
                  }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => handleUrlConfirm(pendingUrl)}
                  style={{
                    flex: 1,
                    padding: '9px 0',
                    borderRadius: 10,
                    border: '1px solid rgba(77,234,255,.4)',
                    background: 'rgba(77,234,255,.12)',
                    color: 'var(--cyan)',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  ✓ SCAN NOW
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (timerRef.current) clearTimeout(timerRef.current);
                    setPendingUrl(null);
                    setBrainMode('idle');
                  }}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,.1)',
                    background: 'transparent',
                    color: 'var(--muted)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div style={{
            position: 'absolute',
            left: 24,
            right: 24,
            bottom: 24,
            textAlign: 'center',
            zIndex: 2,
            pointerEvents: 'none',
            background: 'linear-gradient(transparent,rgba(2,7,11,.86) 30%)',
            paddingTop: 90,
          }}
          >
            <h2 style={{ fontSize: 36, margin: '0 0 8px' }}>
              {brainMode === 'idle' && 'Soren Neural Core'}
              {brainMode === 'listening' && 'Listening...'}
              {brainMode === 'thinking' && 'Thinking'}
              {brainMode === 'scanning' && 'Scanning Website'}
              {brainMode === 'results' && 'Findings Detected'}
              {brainMode === 'repair' && 'Master Repair Plan'}
              {brainMode === 'speaking' && 'Speaking'}
            </h2>
            <p style={{
              color: 'var(--muted)',
              margin: '0 auto',
              maxWidth: 500,
              lineHeight: 1.45,
              fontSize: 13,
            }}
            >
              {readoutBody}
            </p>
            <div style={{
              width: 320,
              height: 32,
              margin: '16px auto 0',
              background:
                'repeating-linear-gradient(90deg,rgba(77,234,255,.4) 0 4px,transparent 4px 9px)',
              WebkitMaskImage:
                'linear-gradient(90deg,transparent,#000 15%,#000 85%,transparent)',
              maskImage:
                'linear-gradient(90deg,transparent,#000 15%,#000 85%,transparent)',
              animation: 'soren-wave 1.1s ease-in-out infinite',
              display:
                brainMode === 'speaking' || brainMode === 'listening'
                  ? 'block'
                  : 'none',
            }}
            />
          </div>
        </section>

        <aside style={{
          border: '1px solid var(--line)',
          borderRadius: 26,
          background: 'var(--panel)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        >
          <div style={{
            padding: 18,
            borderBottom: '1px solid var(--line)',
          }}
          >
            <h2 style={{ color: 'var(--cyan)', margin: '0 0 8px', fontSize: 16 }}>
              {readoutTitle}
            </h2>
            <p style={{
              margin: 0,
              color: '#dcebf2',
              lineHeight: 1.45,
              fontSize: 13,
            }}
            >
              {toast}
            </p>
          </div>

          {auditResult && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
              padding: 14,
              borderBottom: '1px solid var(--line)',
            }}
            >
              {[
                { label: 'Score', value: `${auditResult.score}/100`, color: 'var(--cyan)' },
                {
                  label: 'Projected',
                  value: auditResult.score < 90 ? '95+' : '100',
                  color: 'var(--green)',
                },
                {
                  label: 'Issues',
                  value: `${auditResult.checks?.filter((c) => !c.passed).length ?? 0}`,
                  color: 'var(--red)',
                },
                {
                  label: 'Platform',
                  value: auditPlatform.slice(0, 10),
                  color: 'var(--muted)',
                },
              ].map((m) => (
                <div
                  key={m.label}
                  style={{
                    border: '1px solid var(--line)',
                    borderRadius: 16,
                    padding: 13,
                    background: 'rgba(255,255,255,.03)',
                  }}
                >
                  <b style={{ fontSize: 22, display: 'block', color: m.color }}>
                    {m.value}
                  </b>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{
            padding: 14,
            display: 'grid',
            gap: 9,
            overflowY: 'auto',
            flex: 1,
          }}
          >
            {!auditResult && (
              <p style={{
                color: 'var(--muted)',
                fontSize: 13,
                textAlign: 'center',
                paddingTop: 20,
              }}
              >
                Run an audit to see findings
              </p>
            )}
            {auditResult?.checks?.map((c, i) => (
              <div
                key={c.name}
                style={{
                  border: `1px solid ${c.passed ? 'rgba(99,255,163,.25)' : 'rgba(255,96,112,.25)'}`,
                  borderRadius: 16,
                  padding: 13,
                  background: 'rgba(255,255,255,.035)',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 10,
                  animation: `soren-fade-up .3s ease ${i * 40}ms both`,
                }}
              >
                <div>
                  <strong style={{
                    display: 'block',
                    fontSize: 12,
                    color: c.passed ? 'var(--green)' : 'var(--red)',
                  }}
                  >
                    {c.passed ? '✅' : '❌'}
                    {' '}
                    {c.name}
                  </strong>
                  {!c.passed && (
                    <small style={{
                      color: 'var(--muted)',
                      fontSize: 11,
                      lineHeight: 1.4,
                    }}
                    >
                      {c.tip}
                    </small>
                  )}
                </div>
                <span style={{
                  fontWeight: 900,
                  fontSize: 13,
                  color: c.passed ? 'var(--green)' : 'var(--red)',
                  alignSelf: 'center',
                }}
                >
                  {c.passed ? `+${c.maxPoints}` : `0/${c.maxPoints}`}
                </span>
              </div>
            ))}
          </div>

          {brainMode === 'repair' && auditResult && (
            <div style={{
              padding: 16,
              borderTop: '1px solid var(--line)',
              background:
                'linear-gradient(135deg,rgba(99,255,163,.08),rgba(77,234,255,.04))',
            }}
            >
              <h2 style={{ color: 'var(--green)', margin: '0 0 10px', fontSize: 14 }}>
                Before → After
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                gap: 8,
                alignItems: 'center',
              }}
              >
                <div style={{
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: 12,
                  textAlign: 'center',
                }}
                >
                  <span style={{ display: 'block', color: 'var(--muted)', fontSize: 11 }}>
                    Now
                  </span>
                  <b style={{ fontSize: 28 }}>{auditResult.score}</b>
                </div>
                <div style={{
                  fontSize: 24,
                  color: 'var(--green)',
                  fontWeight: 900,
                  textAlign: 'center',
                }}
                >
                  →
                </div>
                <div style={{
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: 12,
                  textAlign: 'center',
                }}
                >
                  <span style={{ display: 'block', color: 'var(--muted)', fontSize: 11 }}>
                    After fix
                  </span>
                  <b style={{ fontSize: 28 }}>
                    {Math.min(
                      auditResult.score +
                      auditResult.checks
                        ?.filter((c) => !c.passed)
                        .reduce((s, c) => s + (c.maxPoints || 0), 0),
                      100,
                    )}
                  </b>
                </div>
              </div>
            </div>
          )}
        </aside>
      </main>

      <div style={{
        position: 'fixed',
        left: '50%',
        bottom: 24,
        transform: 'translateX(-50%)',
        zIndex: 5,
        width: 'min(760px,calc(100% - 40px))',
        border: '1px solid var(--line)',
        borderRadius: 22,
        background: 'rgba(5,18,25,.88)',
        backdropFilter: 'blur(18px)',
        padding: '14px 18px',
        color: '#dcebf2',
        fontSize: 13,
        pointerEvents: 'none',
      }}
      >
        <b style={{ color: 'var(--cyan)' }}>Soren:</b>
        {' '}
        {toast}
      </div>

      {showFix && deliveryAudit && fixPackage && (
        <FixDeliveryCards
          auditResult={deliveryAudit}
          email={email ?? ''}
          onClose={() => {
            setShowFix(false);
            clearFixPackage();
            setBrainMode('results');
          }}
          speak={speakOnce}
        />
      )}
    </div>
  );
}
