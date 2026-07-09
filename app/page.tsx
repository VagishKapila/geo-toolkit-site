'use client';

import { useState, useEffect, useCallback } from 'react';
import { SorenBrain, type BrainMode } from '../components/SorenBrain';
import { FixDeliveryCards } from '../components/FixDeliveryCards';
import { useLiveKitSoren } from '../hooks/useLiveKitSoren';
import { useCredits } from '../hooks/useCredits';

const GEO_URL =
  'https://toolkit-demo-host-production-ac14.up.railway.app/api/geo-audit';
const FIX_URL =
  'https://toolkit-demo-host-production-ac14.up.railway.app/api/soren/fix';

interface AuditResult {
  url: string;
  score: number;
  grade: string;
  topFixes: string[];
  platform?: string;
  checks: { name: string; passed: boolean; maxPoints: number; tip?: string }[];
}

interface FixPackage {
  platform: string;
  summary: string;
  files: { filename: string; description: string; content: string }[];
  instructions: { title: string; detail: string }[];
  sorenSays: string;
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
  const { email, balance, saveEmail, fetchBalance } = useCredits();

  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [fixPackage, setFixPackage] = useState<FixPackage | null>(null);
  const [showFix, setShowFix] = useState(false);
  const [brainMode, setBrainMode] = useState<BrainMode>('idle');
  const [openCheck, setOpenCheck] = useState<string | null>(null);
  const [fixLoading, setFixLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [toast, setToast] = useState('Say a website. Soren will check it.');
  const [logs, setLogs] = useState<string[]>([]);

  const appendLog = useCallback((text: string) => {
    setLogs((prev) => [...prev, text]);
  }, []);

  const lk = useLiveKitSoren(
    (s) => {
      if (s === 'connecting') {
        setBrainMode('thinking');
        setToast('Connecting to Soren...');
      }
      if (s === 'listening') {
        setBrainMode((prev) =>
          ['results', 'repair', 'scanning'].includes(prev) ? prev : 'idle',
        );
        setToast('Listening. Say a website name.');
      }
      if (s === 'speaking') {
        setBrainMode('speaking');
      }
      if (s === 'disconnected') {
        setBrainMode('idle');
      }
      if (s === 'error') {
        setBrainMode('idle');
      }
    },
    (msg) => {
      if (msg.type === 'geo_audit_result') {
        const data = msg.data as AuditResult;
        setAuditResult(data);
        setBrainMode('results');
        const f = (data.checks ?? []).filter((c) => !c.passed).length;
        const line =
          `${data.url} scores ${data.score}/100. ` +
          `${f} signal${f !== 1 ? 's' : ''} need fixing.`;
        setToast(line);
        appendLog(line);
      }
      if (msg.type === 'show_fix_modal') {
        setFixPackage(msg.data as FixPackage);
        setShowFix(true);
        setBrainMode('repair');
        appendLog('Master Repair Plan ready. Choose how you want to proceed.');
      }
    },
  );

  const handleTypedScan = useCallback(async (rawUrl: string) => {
    const url = rawUrl.trim().startsWith('http')
      ? rawUrl.trim()
      : `https://${rawUrl.trim()}`;
    setBrainMode('scanning');
    setToast(`Scanning ${url}...`);
    setAuditResult(null);
    setShowFix(false);
    setFixPackage(null);
    try {
      const res = await fetch(GEO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as AuditResult;
      if (!res.ok || !data.url || typeof data.score !== 'number') {
        throw new Error('Audit failed');
      }
      setAuditResult(data);
      setBrainMode('results');
      const f = (data.checks ?? []).filter((c) => !c.passed).length;
      const line =
        `${data.url} scores ${data.score}/100. ` +
        `${f} signal${f !== 1 ? 's' : ''} need fixing.`;
      setToast(line);
      appendLog(line);
    } catch {
      setBrainMode('idle');
      setToast('Could not reach that site. Try again.');
      appendLog('Could not reach that site. Try again.');
    }
  }, [appendLog]);

  const handleFixIt = useCallback(async () => {
    if (!auditResult) return;
    if (fixPackage) {
      setShowFix(true);
      setBrainMode('repair');
      return;
    }
    setFixLoading(true);
    try {
      const res = await fetch(FIX_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: auditResult.platform ?? 'static-html',
          failingChecks: (auditResult.checks ?? [])
            .filter((c) => !c.passed)
            .map((c) => ({ name: c.name, tip: c.name })),
          siteInfo: { url: auditResult.url },
        }),
      });
      const pkg = await res.json();
      setFixPackage(pkg);
      setShowFix(true);
      setBrainMode('repair');
      appendLog('Master Repair Plan ready. Choose how you want to proceed.');
    } catch (e) {
      console.error('[FIX]', e);
      appendLog('I could not build the repair plan. Please try again.');
    } finally {
      setFixLoading(false);
    }
  }, [auditResult, fixPackage, appendLog]);

  const toggleCheck = useCallback((name: string, tip: string, passed: boolean) => {
    setOpenCheck((prev) => (prev === name ? null : name));
    if (!passed && tip) {
      appendLog(tip);
    }
  }, [appendLog]);

  useEffect(() => {
    if (!auditResult || fixPackage) return;
    const failing = auditResult.checks.filter((c) => !c.passed);
    if (!failing.length) return;
    void fetch(FIX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: auditResult.platform ?? 'Website',
        failingChecks: failing.map((c) => ({ name: c.name, tip: c.tip ?? '' })),
        siteInfo: { url: auditResult.url },
      }),
    })
      .then((r) => r.json())
      .then((pkg) => {
        if (pkg?.files) setFixPackage(pkg);
      })
      .catch((e) => console.error('[FIX prefetch]', e));
  }, [auditResult, fixPackage]);

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
        borderRadius: 16,
        padding: 14,
        fontWeight: 800,
        cursor: 'pointer',
        letterSpacing: '.04em',
        textTransform: 'uppercase' as const,
        fontSize: 13,
        marginBottom: 8,
        background: lk.state === 'connecting'
          ? 'rgba(77,234,255,0.1)'
          : 'linear-gradient(135deg,var(--cyan),#91f9ff)',
        color: lk.state === 'connecting' ? 'var(--cyan)' : '#041014',
        border: lk.state === 'connecting'
          ? '1px solid rgba(77,234,255,0.3)'
          : '0',
      }}
    >
      {lk.state === 'connecting' ? '⟳ CONNECTING...' : '▶ TALK TO SOREN'}
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
            ? 'rgba(99,255,163,.1)'
            : 'rgba(255,95,210,.1)',
          border: `1px solid ${lk.state === 'speaking'
            ? 'rgba(99,255,163,.5)'
            : 'rgba(255,95,210,.5)'}`,
          color: lk.state === 'speaking' ? 'var(--green)' : 'var(--pink)',
        }}
      >
        {lk.state === 'speaking' ? '● SOREN SPEAKING' : '🎙 LISTENING'}
      </button>
      <button
        type="button"
        onClick={() => void lk.toggleMute()}
        style={{
          padding: 14,
          borderRadius: 16,
          border: '1px solid var(--line)',
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

  const deliveryAudit = auditResult
    ? {
        url: auditResult.url,
        score: auditResult.score,
        grade: auditResult.grade,
        platform: auditResult.platform ?? 'Website',
        checks: auditResult.checks.map((c) => ({
          name: c.name,
          passed: c.passed,
          tip: c.tip,
        })),
      }
    : null;

  const failingCount = auditResult?.checks?.filter((c) => !c.passed).length ?? 0;
  const showHero = !auditResult;
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
          <span><b />LIVE SOREN VOICE</span>
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
                  if (e.key === 'Enter' && draft.trim()) {
                    void handleTypedScan(draft);
                    setDraft('');
                  }
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
                onClick={() => {
                  if (draft.trim()) {
                    void handleTypedScan(draft);
                    setDraft('');
                  }
                }}
              >
                Check Website
              </button>
              <p className="soren-hint">{toast}</p>
            </div>
          </aside>

          <main style={{ padding: 22, overflow: 'auto' }}>
            <div style={{ maxWidth: 1180, margin: '0 auto' }}>
              {showHero && (
                <section className="soren-panel soren-hero-panel">
                  <div>
                    <div className="soren-micro">voice-first website intelligence</div>
                    <h1>Talk to Soren. He audits your site live.</h1>
                    <p>
                      Click Talk to Soren and say a website name — or type one below.
                      Soren runs the GEO audit and speaks the results in his real voice.
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
                      onClick={() => void lk.connect()}
                    >
                      Hear Soren intro
                    </button>
                  </div>
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
                        /100 · click any issue for details.
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
                  {logs.length === 0 && (
                    <p className="soren-logline">
                      <b>soren:</b>
                      {' '}
                      {toast}
                    </p>
                  )}
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
            setFixPackage(null);
            setBrainMode('results');
          }}
          speak={appendLog}
        />
      )}
    </>
  );
}
