'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SorenBrain, type BrainMode } from '../components/SorenBrain';
import { FixDeliveryCards } from '../components/FixDeliveryCards';
import { useLiveKitSoren } from '../hooks/useLiveKitSoren';
import { useCredits } from '../hooks/useCredits';
import { cleanForSpeech } from '../lib/cleanForSpeech';

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

export default function SorenApp() {
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
  const [openCheck, setOpenCheck] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([INTRO]);
  const confirmTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lk = useLiveKitSoren((s) => {
    if (s === 'speaking') setBrainMode('speaking');
    if (s === 'listening') {
      setBrainMode((prev) =>
        prev === 'results' || prev === 'repair' || prev === 'scanning'
          ? prev
          : 'idle',
      );
    }
  });

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
  }, [appendLog, resetAudit, clearFixPackage]);

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
    if (lk.state === 'speaking') {
      setBrainMode('speaking');
      return;
    }
    if (lk.state === 'listening' && lk.isConnected) {
      setBrainMode((prev) =>
        prev === 'results' || prev === 'repair' || prev === 'scanning'
          ? prev
          : 'listening',
      );
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
    lk.state, lk.isConnected, isThinking, auditResult,
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

  const handleFixIt = useCallback(() => {
    if (!auditResult) return;
    setShowFix(true);
    setBrainMode('repair');
    appendLog('Master Repair Plan ready. Choose how you want to proceed.');
  }, [auditResult, appendLog]);

  const toggleCheck = useCallback((name: string, tip: string, passed: boolean) => {
    setOpenCheck((prev) => (prev === name ? null : name));
    if (!passed && tip) appendLog(tip);
  }, [appendLog]);

  const speakLog = useCallback((text: string) => {
    appendLog(cleanForSpeech(text));
  }, [appendLog]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('credits_success') === 'true') {
      window.history.replaceState({}, '', window.location.pathname);
      const urlEmail = params.get('email');
      if (urlEmail) {
        saveEmail(urlEmail);
        void fetchBalance(urlEmail).then(() => {
          appendLog('Your credits are ready. Want me to apply the fix now?');
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
          });
      }
    }
    const callSuccess = params.get('call_success');
    const calendly = params.get('calendly');
    if (callSuccess === 'true' && calendly) {
      window.history.replaceState({}, '', window.location.pathname);
      window.open(decodeURIComponent(calendly), '_blank');
      appendLog('Payment confirmed. Your booking page just opened.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const voiceButton = !lk.isConnected ? (
    <button
      type="button"
      onClick={() => void lk.connect()}
      style={{
        width: '100%',
        border: 0,
        borderRadius: 16,
        padding: 14,
        fontWeight: 800,
        cursor: 'pointer',
        letterSpacing: '.04em',
        textTransform: 'uppercase' as const,
        fontSize: 13,
        marginBottom: 8,
        background: 'linear-gradient(135deg,var(--cyan),#91f9ff)',
        color: '#041014',
      }}
    >
      {lk.state === 'connecting' ? '⟳ Connecting...' : '▶ Talk to Soren'}
    </button>
  ) : (
    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
      <button
        type="button"
        onClick={lk.disconnect}
        style={{
          flex: 1,
          borderRadius: 16,
          padding: 14,
          fontWeight: 800,
          cursor: 'pointer',
          fontSize: 13,
          background: lk.state === 'speaking'
            ? 'rgba(99,255,163,.15)'
            : 'rgba(255,95,210,.15)',
          border: `1px solid ${lk.state === 'speaking'
            ? 'rgba(99,255,163,.5)'
            : 'rgba(255,95,210,.5)'}`,
          color: lk.state === 'speaking' ? 'var(--green)' : 'var(--pink)',
        }}
      >
        {lk.state === 'speaking'
          ? '● Soren speaking'
          : '🎙 Listening — speak naturally'}
      </button>
      <button
        type="button"
        onClick={() => void lk.toggleMute()}
        style={{
          padding: '14px 16px',
          border: '1px solid var(--line)',
          borderRadius: 16,
          background: 'rgba(255,255,255,.04)',
          color: lk.isMuted ? 'var(--red)' : 'var(--muted)',
          cursor: 'pointer',
          fontSize: 16,
        }}
      >
        {lk.isMuted ? '🔇' : '🎙'}
      </button>
    </div>
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
            {lk.isConnected && (
              <button
                type="button"
                onClick={() => void lk.toggleMute()}
                className="soren-pill"
                style={{ cursor: 'pointer', color: lk.isMuted ? 'var(--red)' : 'var(--green)' }}
              >
                {lk.isMuted ? '🔇 Muted' : '🔊 Sound'}
              </button>
            )}
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
              {lk.error && (
                <p style={{
                  fontSize: 11,
                  color: 'var(--red)',
                  textAlign: 'center',
                  margin: '4px 0 8px',
                }}
                >
                  ⚠
                  {' '}
                  {lk.error}
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
                      onClick={() => void lk.connect()}
                    >
                      Start voice flow
                    </button>
                    <button
                      type="button"
                      className="soren-btn soren-btn-ghost"
                      onClick={() => appendLog(INTRO)}
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
                                  {c.tip ?? 'No additional notes for this check.'}
                                </p>
                                {!c.passed && (
                                  <div className="soren-quote">
                                    “I can generate the exact files and instructions to fix this.”
                                  </div>
                                )}
                                <div className="soren-detail-actions">
                                  {!c.passed && (
                                    <button
                                      type="button"
                                      className="soren-btn soren-btn-primary"
                                      onClick={handleFixIt}
                                    >
                                      Fix this
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
                        onClick={handleFixIt}
                      >
                        ✦ Build Master Repair Plan
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
          speak={speakLog}
        />
      )}
    </>
  );
}
