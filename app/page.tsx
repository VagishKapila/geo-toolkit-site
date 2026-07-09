'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SorenBrain, type BrainMode } from '../components/SorenBrain';
import { FixDeliveryCards } from '../components/FixDeliveryCards';
import { useSorenVoice } from '../hooks/useSorenVoice';
import { useSorenSTT } from '../hooks/useSorenSTT';
import { useSorenChat } from '../hooks/useSorenChat';
import { useCredits } from '../hooks/useCredits';
import { cleanForSpeech } from '../lib/cleanForSpeech';
import { extractWebsiteFromSpeech } from '../lib/extractWebsiteFromSpeech';

const GEO_URL =
  'https://toolkit-demo-host-production-ac14.up.railway.app/api/geo-audit';
const FIX_URL =
  'https://toolkit-demo-host-production-ac14.up.railway.app/api/soren/fix';

interface AuditResult {
  url: string;
  score: number;
  grade: string;
  topFixes: string[];
  checks: { name: string; passed: boolean; maxPoints: number; tip?: string }[];
}

interface FixPackage {
  platform: string;
  summary: string;
  files: { filename: string; description: string; content: string }[];
  instructions: { title: string; detail: string }[];
  sorenSays: string;
}

type AuditWithPlatform = AuditResult & { platform?: string };

const INTRO =
  'Good afternoon, Sir. Say the website and I will confirm it before I run the audit.';

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  return t.startsWith('http') ? t : `https://${t}`;
}

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

const CHECK_INFO: Record<string, { plain: string; why: string }> = {
  'llms.txt': {
    plain: "AI engines can't find your product guide",
    why: 'ChatGPT looks for llms.txt first. Without it, AI guesses what your product does — and guessing leads to wrong answers.',
  },
  'robots.txt AI crawlers': {
    plain: "You're blocking AI from reading your site",
    why: "Your robots file doesn't allow GPTBot, ClaudeBot, or PerplexityBot. They treat your site as off-limits.",
  },
  'JSON-LD script': {
    plain: "AI doesn't know what type of product you are",
    why: 'Without structured data, AI has to guess your business category, your company name, and what you do.',
  },
  'Open Graph tags': {
    plain: 'Your site shows blank when shared',
    why: 'Open Graph tags control how your link appears in Slack, LinkedIn, and iMessage. AI also uses these to understand your page.',
  },
  'Twitter card tag': {
    plain: 'Missing social sharing signal',
    why: 'The Twitter card tag signals that your content is meant to be shared. AI uses this as a trust signal.',
  },
  'Heading structure': {
    plain: "AI can't understand your page structure",
    why: "AI uses heading tags like a book's table of contents. Without them AI reads your page but can't organize what it learned.",
  },
  'sitemap.xml': {
    plain: 'AI crawlers are missing your key pages',
    why: 'A sitemap tells AI crawlers exactly which pages exist. Without one they may miss your most important content.',
  },
  'Canonical link': {
    plain: 'AI may be reading duplicate versions of your site',
    why: 'Without a canonical tag AI may index multiple versions of the same page with conflicting information.',
  },
  'Schema.org entity': {
    plain: "AI doesn't know who built this product",
    why: 'Schema markup connects your product to your company. This is how you get cited as a trustworthy source.',
  },
};

export default function SorenApp() {
  const { speak, speakAndWait, stop, isSpeaking, isMuted, toggleMute } = useSorenVoice();

  const speakOnce = useCallback((text: string) => {
    speak(cleanForSpeech(text));
  }, [speak]);

  const { sendMessage } = useSorenChat((reply: string) => {
    speakOnce(reply);
  });

  const { email, balance, saveEmail, fetchBalance } = useCredits();

  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [fixPackage, setFixPackage] = useState<FixPackage | null>(null);
  const [isThinking, setIsThinking] = useState(false);

  const [brainMode, setBrainMode] = useState<BrainMode>('idle');
  const [draft, setDraft] = useState('varshyl.com');
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const [confirmSeconds, setConfirmSeconds] = useState(5);
  const [showFix, setShowFix] = useState(false);
  const [fixLoading, setFixLoading] = useState(false);
  const [openCheck, setOpenCheck] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([INTRO]);
  const confirmTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const appendLog = useCallback((text: string) => {
    setLogs((prev) => [...prev, text]);
  }, []);

  const clearFixPackage = useCallback(() => setFixPackage(null), []);
  const restoreFixPackage = useCallback((pkg: FixPackage) => setFixPackage(pkg), []);

  const resetAudit = useCallback(() => {
    setAuditResult(null);
    setFixPackage(null);
  }, []);

  const runAudit = useCallback(
    async (url: string) => {
      setIsThinking(true);
      try {
        const res = await fetch(GEO_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const data = (await res.json()) as AuditResult;
        setAuditResult(data);
        const summary = `I checked ${url}. Score: ${data.score}/100, grade ${data.grade}.`;
        appendLog(summary);
      } catch (e) {
        console.error('[AUDIT]', e);
        appendLog('I could not reach that site. Make sure it is live and try again.');
        throw e;
      } finally {
        setIsThinking(false);
      }
    },
    [appendLog],
  );

  const clearConfirmTimer = useCallback(() => {
    if (confirmTimerRef.current) {
      clearInterval(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
  }, []);

  const handleUrlConfirm = useCallback(
    async (url: string) => {
      clearConfirmTimer();
      setPendingUrl(null);
      setEditOpen(false);
      clearFixPackage();
      setShowFix(false);
      setBrainMode('scanning');
      appendLog(`Scanning ${url}...`);
      try {
        await runAudit(url);
      } catch {
        setBrainMode('idle');
      }
    },
    [appendLog, runAudit, clearFixPackage, clearConfirmTimer],
  );

  const beginConfirm = useCallback((raw: string) => {
    stopListeningRef.current?.();
    resetAudit();
    clearFixPackage();
    setShowFix(false);
    setOpenCheck(null);
    const url = normalizeUrl(raw);
    setDraft(displayUrl(url));
    setPendingUrl(url);
    setEditDraft(displayUrl(url));
    setEditOpen(false);
    setConfirmSeconds(5);
    setBrainMode('confirming');
    const line = `I heard ${displayUrl(url)}. I will start in five seconds unless you edit it.`;
    appendLog(line);
    speakOnce(line);
  }, [appendLog, resetAudit, clearFixPackage, speakOnce]);

  const restartListeningRef = useRef<(() => void) | null>(null);
  const stopListeningRef = useRef<(() => void) | null>(null);

  const handleSTTResult = useCallback(
    async (text: string) => {
      appendLog(`I heard: "${text}"`);
      const website = extractWebsiteFromSpeech(text);
      if (website) {
        beginConfirm(website);
        return;
      }
      setBrainMode('thinking');
      appendLog('Thinking...');
      await sendMessage(text);
      restartListeningRef.current?.();
    },
    [beginConfirm, sendMessage, appendLog],
  );

  const stt = useSorenSTT(handleSTTResult);
  restartListeningRef.current = stt.startListening;
  stopListeningRef.current = stt.stopListening;

  const handleMicClick = useCallback(async () => {
    if (stt.state === 'listening') {
      stt.stopListening();
      return;
    }
    stop();
    stt.stopListening();
    try {
      appendLog('Say the website — for example, att.com');
      await speakAndWait('Say the website.');
      stt.startListening();
    } catch (e) {
      console.error('[MIC]', e);
      appendLog('Microphone error. Check browser permissions.');
    }
  }, [stt, stop, appendLog, speakAndWait]);

  useEffect(() => {
    if (!pendingUrl || editOpen) {
      clearConfirmTimer();
      return;
    }
    setConfirmSeconds(5);
    clearConfirmTimer();
    confirmTimerRef.current = setInterval(() => {
      setConfirmSeconds((s) => {
        if (s <= 1) {
          clearConfirmTimer();
          void handleUrlConfirm(pendingUrl);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return clearConfirmTimer;
  }, [pendingUrl, editOpen, handleUrlConfirm, clearConfirmTimer]);

  useEffect(() => {
    if (isSpeaking) {
      setBrainMode('speaking');
      return;
    }
    if (stt.state === 'listening') {
      setBrainMode('listening');
      return;
    }
    if (pendingUrl && !auditResult) {
      setBrainMode(editOpen ? 'idle' : 'confirming');
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
  }, [
    isSpeaking, stt.state, isThinking, auditResult,
    showFix, pendingUrl, editOpen,
  ]);

  useEffect(() => {
    if (!auditResult) return;
    const failing = auditResult.checks?.filter((c) => !c.passed).length ?? 0;
    appendLog(
      `Analysis complete. Score: ${auditResult.score}/100. ` +
      `${failing} signal${failing !== 1 ? 's' : ''} need fixing.`,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        siteInfo: { url: auditResult.url },
      }),
    })
      .then((r) => r.json())
      .then((pkg) => {
        if (pkg?.files) restoreFixPackage(pkg);
      })
      .catch((e) => console.error('[FIX prefetch]', e));
  }, [auditResult, fixPackage, restoreFixPackage]);

  const pauseForEdit = useCallback(() => {
    clearConfirmTimer();
    setEditOpen(true);
    setBrainMode('idle');
    appendLog('Timer paused. Edit the website spelling, then save and continue.');
  }, [clearConfirmTimer, appendLog]);

  const saveEdit = useCallback(() => {
    const url = normalizeUrl(editDraft);
    setPendingUrl(url);
    setDraft(displayUrl(url));
    setEditOpen(false);
    appendLog(`Saved ${displayUrl(url)}. Continuing now.`);
    void handleUrlConfirm(url);
  }, [editDraft, appendLog, handleUrlConfirm]);

  const confirmNow = useCallback(() => {
    if (!pendingUrl) return;
    void handleUrlConfirm(pendingUrl);
  }, [pendingUrl, handleUrlConfirm]);

  const submitTypedUrl = useCallback(() => {
    if (!draft.trim()) return;
    beginConfirm(draft.trim());
  }, [draft, beginConfirm]);

  const handleFixIt = useCallback(async () => {
    if (!auditResult) return;

    if (fixPackage) {
      setShowFix(true);
      setBrainMode('repair');
      appendLog('Master Repair Plan ready. Choose how you want to proceed.');
      speakOnce('I have your repair plan ready. Choose how you would like to proceed.');
      return;
    }

    setFixLoading(true);
    try {
      const failing = (auditResult.checks ?? [])
        .filter((c) => !c.passed)
        .map((c) => ({
          name: c.name,
          tip: c.tip ?? c.name,
        }));

      const ar = auditResult as AuditWithPlatform;
      const res = await fetch(FIX_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: ar.platform ?? 'static-html',
          failingChecks: failing,
          siteInfo: { url: auditResult.url },
        }),
      });
      const pkg = await res.json();
      if (pkg?.files) restoreFixPackage(pkg);
      setShowFix(true);
      setBrainMode('repair');
      appendLog('Master Repair Plan ready. Choose how you want to proceed.');
      speakOnce('I have your repair plan ready. Choose how you would like to proceed.');
    } catch (e) {
      console.error('[FIX]', e);
      appendLog('I could not build the repair plan. Please try again.');
    } finally {
      setFixLoading(false);
    }
  }, [auditResult, fixPackage, restoreFixPackage, appendLog, speakOnce]);

  const toggleCheck = useCallback((name: string, tip: string, passed: boolean) => {
    setOpenCheck((prev) => (prev === name ? null : name));
    if (!passed && tip) {
      appendLog(tip);
      speakOnce(tip);
    }
  }, [appendLog, speakOnce]);

  const speakForCards = useCallback((text: string) => {
    speakOnce(text);
  }, [speakOnce]);

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
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pkgData) },
        )
          .then((r) => r.blob())
          .then((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `soren-fix-${pkgData.platform}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            appendLog('Your AI package is downloading. Paste the prompt into ChatGPT.');
            speakOnce('Your AI package is downloading. Paste the prompt into ChatGPT.');
          });
      }
    }
    const callSuccess = params.get('call_success');
    const calendly = params.get('calendly');
    if (callSuccess === 'true' && calendly) {
      window.history.replaceState({}, '', window.location.pathname);
      window.open(decodeURIComponent(calendly), '_blank');
      appendLog('Payment confirmed. Your booking page just opened.');
      speakOnce('Payment confirmed. Your booking page just opened.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const voiceButton = (
    <button
      type="button"
      onClick={() => void handleMicClick()}
      style={{
        width: '100%',
        borderRadius: 16,
        padding: 14,
        fontWeight: 800,
        cursor: 'pointer',
        letterSpacing: '.04em',
        textTransform: 'uppercase' as const,
        fontSize: 13,
        marginBottom: 8,
        background: stt.state === 'listening'
          ? 'rgba(255,95,210,.2)'
          : 'linear-gradient(135deg,var(--cyan),#91f9ff)',
        color: stt.state === 'listening' ? 'var(--pink)' : '#041014',
        border: stt.state === 'listening'
          ? '1px solid rgba(255,95,210,.5)'
          : '0',
      }}
    >
      {stt.state === 'listening' ? '🎙 Listening — speak naturally' : '▶ Talk to Soren'}
    </button>
  );

  const findings = auditResult?.checks?.map((c, i) => ({
    label: c.name.split(' ')[0].slice(0, 4).toUpperCase(),
    kind: (c.passed ? 'pass' : 'fail') as 'fail' | 'warn' | 'pass',
    a: -1.75 + (i * (3.5 / (auditResult.checks.length || 1))),
    r: 260 + (i % 3) * 25,
  })) ?? [];

  const auditPlatform = auditResult
    ? (auditResult as AuditWithPlatform).platform ?? 'Website'
    : 'Website';

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

  const failingCount = auditResult?.checks?.filter((c) => !c.passed).length ?? 0;
  const showHero = !pendingUrl && !auditResult;
  const showConfirm = !!pendingUrl;
  const showAudit = !!auditResult;

  return (
    <>
      <SorenBrain mode={brainMode} findings={findings} fullscreen />

      <div className="soren-app" style={{
        position: 'relative',
        zIndex: 2,
        minHeight: '100vh',
        display: 'grid',
        gridTemplateRows: '70px 34px 1fr',
        color: 'var(--text, #eaffff)',
      }}
      >
        <header style={{
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: 'rgba(0,0,0,.50)',
          backdropFilter: 'blur(14px)',
        }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            color: 'var(--cyan)',
            fontWeight: 900,
            letterSpacing: '.34em',
            fontSize: 13,
          }}
          >
            <span style={{
              width: 12,
              height: 12,
              border: '2px solid var(--cyan)',
              borderRadius: '50%',
              boxShadow: '0 0 18px var(--cyan)',
            }}
            />
            SOREN · FIXES · IT
            <span style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '.14em' }}>
              procedural brain · full flow
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {balance > 0 && (
              <span className="soren-pill" style={{ color: 'var(--cyan)' }}>
                {balance}
                {' '}
                credits
              </span>
            )}
            <button
              type="button"
              onClick={toggleMute}
              className="soren-pill"
              style={{ cursor: 'pointer', color: isMuted ? 'var(--red)' : 'var(--green)' }}
            >
              {isMuted ? '🔇 Muted' : '🔊 Sound'}
            </button>
            <span className="soren-pill soren-pill-live">
              ●
              {' '}
              {brainMode.toUpperCase()}
            </span>
          </div>
        </header>

        <div className="soren-ticker">
          <span><b />VOICE WEBSITE CONFIRMATION</span>
          <span><b />5 SECOND EDIT WINDOW</span>
          <span><b />GEO AUDIT</span>
          <span><b />ADA BASIC SCAN</span>
          <span><b />SECURITY SIGNALS</span>
          <span><b />SOREN GUARDIAN</span>
        </div>

        <div className="soren-layout" style={{
          display: 'grid',
          gridTemplateColumns: '410px 1fr',
          minHeight: 'calc(100vh - 104px)',
        }}
        >
          <aside className="soren-left" style={{
            borderRight: '1px solid var(--line)',
            display: 'grid',
            gridTemplateRows: '1fr auto',
            padding: 24,
            background: 'rgba(0,0,0,.22)',
          }}
          >
            <div className="soren-hero" style={{
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
              minHeight: 420,
            }}
            >
              <div>
                <h2 style={{
                  fontSize: 34,
                  letterSpacing: '.36em',
                  color: 'var(--cyan)',
                  fontWeight: 900,
                  margin: '0 0 8px',
                }}
                >
                  SOREN
                </h2>
                <div style={{
                  color: 'var(--muted)',
                  fontSize: 11,
                  letterSpacing: '.24em',
                  textTransform: 'uppercase',
                  lineHeight: 1.7,
                }}
                >
                  procedural intelligence brain
                  <br />
                  GEO · ADA · Security · Monitor
                </div>
                <div className="soren-wave-bar" />
              </div>
            </div>

            <div style={{ paddingTop: 10 }}>
              <input
                className="soren-url-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitTypedUrl();
                }}
                placeholder="varshyl.com"
              />
              {voiceButton}
              {!stt.isSupported && (
                <p style={{
                  fontSize: 11,
                  color: 'var(--red)',
                  textAlign: 'center',
                  margin: '4px 0 8px',
                }}
                >
                  ⚠ Voice input needs Chrome or Safari
                </p>
              )}
              <button
                type="button"
                className="soren-btn soren-btn-primary"
                style={{ width: '100%', marginTop: 10 }}
                onClick={submitTypedUrl}
              >
                Check Website
              </button>
              <p className="soren-hint">
                After voice or typed entry, Soren shows the site for 5 seconds so you can edit spelling.
              </p>
            </div>
          </aside>

          <main style={{ padding: 22, overflow: 'auto' }}>
            <div style={{ maxWidth: 1180, margin: '0 auto' }}>
              {showHero && (
                <section className="soren-panel soren-hero-panel">
                  <div>
                    <div className="soren-micro">voice-first website intelligence</div>
                    <h1>Say the website. Soren confirms it before the audit.</h1>
                    <p>
                      Because accents and domain names can be tricky, Soren shows what it heard
                      for five seconds. Tap edit to pause, fix spelling, then continue.
                    </p>
                  </div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <button
                      type="button"
                      className="soren-btn soren-btn-primary"
                      onClick={() => void handleMicClick()}
                    >
                      Start voice flow
                    </button>
                    <button
                      type="button"
                      className="soren-btn soren-btn-ghost"
                      onClick={() => {
                        speakOnce(INTRO);
                        appendLog(INTRO);
                      }}
                    >
                      Hear Soren intro
                    </button>
                  </div>
                </section>
              )}

              {showConfirm && (
                <section className="soren-panel soren-confirm-panel">
                  <div className="soren-confirm-inner">
                    <div>
                      <h2>Soren heard this website:</h2>
                      <div className="soren-heard-site">{displayUrl(pendingUrl!)}</div>
                      <p>Audit starts automatically unless you edit it.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div className="soren-timer">{editOpen ? '—' : confirmSeconds}</div>
                      <button type="button" className="soren-btn soren-btn-ghost" onClick={pauseForEdit}>
                        Edit
                      </button>
                      <button type="button" className="soren-btn soren-btn-primary" onClick={confirmNow}>
                        Confirm
                      </button>
                    </div>
                  </div>
                  {editOpen && (
                    <div className="soren-edit-box open">
                      <input
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); }}
                        autoFocus
                      />
                      <button type="button" className="soren-btn soren-btn-primary" onClick={saveEdit}>
                        Save &amp; Continue
                      </button>
                    </div>
                  )}
                </section>
              )}

              {showAudit && auditResult && (
                <section className="soren-panel">
                  <div className="soren-result-head">
                    <div className="soren-score-num">{auditResult.score}</div>
                    <div>
                      <div className="soren-micro">AI readiness audit result</div>
                      <h2>{auditResult.url}</h2>
                      <p>
                        {auditResult.checks.filter((c) => c.passed).length}
                        /
                        {auditResult.checks.length}
                        {' '}
                        signals active · score
                        {' '}
                        {auditResult.score}
                        /100 · click any issue to hear Soren explain it.
                      </p>
                    </div>
                  </div>

                  <div className="soren-modules">
                    {auditResult.checks.map((c) => (
                      <div key={c.name} className="soren-module">
                        <button
                          type="button"
                          className="soren-module-btn"
                          onClick={() => toggleCheck(c.name, c.tip ?? '', c.passed)}
                        >
                          <span style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                            <span style={{ color: c.passed ? 'var(--green)' : 'var(--red)' }}>
                              {c.passed ? '✓' : '✕'}
                            </span>
                            {c.name}
                          </span>
                          <span
                            className="soren-points"
                            style={{ color: c.passed ? 'var(--cyan)' : 'var(--red)' }}
                          >
                            {c.passed ? `+${c.maxPoints}` : `0/${c.maxPoints}`}
                          </span>
                        </button>
                        {openCheck === c.name && (
                          <div className="soren-detail open">
                            <div className="soren-detail-top">
                              <div className="soren-mini-brain">S</div>
                              <div>
                                <div className="soren-analysis-label">SOREN ANALYSIS</div>
                                <h3 style={{ margin: '4px 0 8px', fontSize: 16, color: 'var(--orange)' }}>
                                  {c.passed ? 'This signal looks good.' : `${c.name} needs attention.`}
                                </h3>
                                <p style={{ margin: '0 0 12px', color: '#d9fff5', lineHeight: 1.45 }}>
                                  {CHECK_INFO[c.name]?.plain ?? c.tip ?? 'No additional notes for this check.'}
                                </p>
                                {!c.passed && (
                                  <div className="soren-quote">
                                    {CHECK_INFO[c.name]?.why ?? c.tip ?? 'I can generate the exact files and instructions to fix this.'}
                                  </div>
                                )}
                                <div className="soren-detail-actions">
                                  {!c.passed && (
                                    <button
                                      type="button"
                                      className="soren-btn soren-btn-primary"
                                      onClick={() => void handleFixIt()}
                                      disabled={fixLoading}
                                    >
                                      {fixLoading ? 'Building plan…' : 'Fix this with Soren →'}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="soren-btn soren-btn-ghost"
                                    onClick={() => appendLog(c.tip ?? c.name)}
                                  >
                                    Explain
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {failingCount > 0 && !showFix && (
                    <div style={{ padding: 14, borderTop: '1px solid var(--line)' }}>
                      <button
                        type="button"
                        className="soren-btn soren-btn-primary"
                        style={{ width: '100%' }}
                        onClick={() => void handleFixIt()}
                        disabled={!auditResult || fixLoading}
                      >
                        {fixLoading ? '⟳ BUILDING PLAN...' : '✦ BUILD MASTER REPAIR PLAN'}
                      </button>
                    </div>
                  )}
                </section>
              )}

              <section className="soren-panel soren-conversation" style={{ marginTop: 16 }}>
                <div className="soren-conversation-head">
                  <span>conversation log</span>
                  <span style={{ color: 'var(--cyan)' }}>● live</span>
                </div>
                <div>
                  {logs.map((line, i) => (
                    <p key={`${i}-${line.slice(0, 24)}`} className="soren-logline">
                      <b>soren:</b>
                      {' '}
                      {line}
                    </p>
                  ))}
                </div>
              </section>
            </div>
          </main>
        </div>
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
          speak={speakForCards}
        />
      )}
    </>
  );
}
