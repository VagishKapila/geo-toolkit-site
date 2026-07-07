'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { useSorenVoice } from "../hooks/useSorenVoice";
import { useSorenSTT } from "../hooks/useSorenSTT";
import { useSorenChat } from "../hooks/useSorenChat";
import { cleanForSpeech } from "../lib/cleanForSpeech";
import { FixPackage } from "../components/FixPackage";

type CheckInfo = { label: string; icon: string; brief: string; detail: string; sorenSays: string };
type AuditCheck = { name: string; passed: boolean; points?: number; maxPoints: number; tip?: string };
type AuditResult = {
  url: string;
  score: number;
  grade?: string;
  checks?: AuditCheck[];
  topFixes?: string[];
  error?: string;
};
type MissionPhase = "idle" | "scanning" | "briefing";
type OrbState = "idle" | "listening" | "thinking" | "speaking";

// ── DESIGN TOKENS ──────────────────────────────────────────
const C = {
  bg:        "#07000F",
  surface:   "#0F0520",
  raised:    "#160830",
  border:    "#2A1545",
  smoke:     "#3D2260",
  muted:     "#5C3D8A",
  gray:      "#8B6DB8",
  text:      "#D4B8F0",
  white:     "#F0E8FF",
  // Soren gradient
  violet:    "#6366f1",
  purple:    "#a855f7",
  pink:      "#ec4899",
  // Status
  cyan:      "#22D3EE",
  green:     "#4ADE80",
  amber:     "#FBBF24",
  red:       "#F87171",
};

const sorenGradient = `linear-gradient(135deg, ${C.violet}, ${C.purple}, ${C.pink})`;

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes soren-breathe {
    0%,100% { transform: scale(1); opacity: 0.9; }
    50% { transform: scale(1.06); opacity: 1; }
  }
  @keyframes soren-ring {
    0% { transform: scale(0.8); opacity: 0.6; }
    100% { transform: scale(2.2); opacity: 0; }
  }
  @keyframes soren-rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes soren-scan {
    0%,100% { transform: translateY(-100%); opacity: 0; }
    20%,80% { opacity: 0.4; }
    50% { transform: translateY(100%); }
  }
  @keyframes wave-bar {
    0%,100% { transform: scaleY(0.3); }
    50% { transform: scaleY(1); }
  }
  @keyframes token-appear {
    from { opacity: 0; transform: translateX(-6px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes check-slide {
    from { opacity: 0; transform: translateX(-12px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes score-count {
    from { opacity: 0; transform: scale(0.7); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes drawer-open {
    from { opacity: 0; transform: translateY(-8px); max-height: 0; }
    to { opacity: 1; transform: translateY(0); max-height: 400px; }
  }
  @keyframes cursor-blink {
    0%,100% { opacity: 1; }
    50% { opacity: 0; }
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes float {
    0%,100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
  @keyframes ping-out {
    0% { transform: scale(1); opacity: 0.8; }
    100% { transform: scale(2.5); opacity: 0; }
  }
`;

// ── PLAIN ENGLISH CHECK DATA ───────────────────────────────
const CHECK_INFO: Record<string, CheckInfo> = {
  "llms.txt": {
    label: "AI product guide",
    icon: "📡",
    brief: "AI engines can't find your product guide",
    detail: "When ChatGPT or Claude searches for products like yours, they look for a file called llms.txt first. It's like a briefing document written specifically for AI. Without it, they have to guess what your product does — and guessing leads to wrong answers about you.",
    sorenSays: "I'd generate your llms.txt pre-filled with your real product details. One file, deployed in 30 seconds.",
  },
  "robots.txt AI crawlers": {
    label: "AI crawler access",
    icon: "🚫",
    brief: "You're blocking AI from reading your site",
    detail: "Your robots.txt file — the one that tells crawlers what they're allowed to read — doesn't list the major AI crawlers. This means GPTBot, ClaudeBot, and PerplexityBot are treating your site as off-limits.",
    sorenSays: "I'd update your robots.txt to explicitly allow the AI crawlers that matter. Takes me 10 seconds.",
  },
  "JSON-LD script": {
    label: "Machine identity",
    icon: "🧠",
    brief: "AI doesn't know what type of product you are",
    detail: "JSON-LD is a tag that tells AI engines your exact product category, company name, and key facts in a format they can reliably read. Without it, AI has to infer your identity from your page text — which is unreliable.",
    sorenSays: "I'd generate the exact JSON-LD for your product type, pre-filled with your company and product information.",
  },
  "Open Graph tags": {
    label: "Link preview data",
    icon: "🔗",
    brief: "Your site shows as a blank when shared",
    detail: "Open Graph tags control how your link looks when shared in Slack, LinkedIn, iMessage, and email. They also signal to AI systems what your page title, description, and key image are.",
    sorenSays: "I'd add all four required Open Graph tags to your page header with your real content.",
  },
  "Twitter card tag": {
    label: "Social signal",
    icon: "📨",
    brief: "Missing social sharing metadata",
    detail: "The Twitter/X card tag signals that your content is meant to be shared and cited — a trust signal that AI engines use when deciding whether to reference you.",
    sorenSays: "One meta tag. I'd add it in seconds.",
  },
  "Heading structure": {
    label: "Content hierarchy",
    icon: "📑",
    brief: "AI can't understand your page structure",
    detail: "AI engines use heading tags (H1, H2) to understand what a page is about — like a book's table of contents. A page without clear headings is like a document without chapters. AI reads it but can't organize what it learned.",
    sorenSays: "I'd add the missing heading tags in the right places without changing your visual design.",
  },
  "sitemap.xml": {
    label: "Page discovery map",
    icon: "🗺️",
    brief: "AI crawlers are missing your key pages",
    detail: "A sitemap tells AI crawlers exactly which pages exist on your site and how important they are. Without one, crawlers stumble through your site randomly and may completely miss your most important content.",
    sorenSays: "I'd generate a complete sitemap.xml for all your pages and configure it to auto-update.",
  },
  "Canonical link": {
    label: "Source of truth",
    icon: "📍",
    brief: "AI may be reading duplicate versions of your site",
    detail: "The canonical tag tells AI which version of a page is the definitive one. Without it, if your site appears at multiple URLs, AI may treat them as separate sources with conflicting information — splitting your authority.",
    sorenSays: "I'd add the canonical tag pointing to your primary URL on every page.",
  },
  "Schema.org entity": {
    label: "Identity graph",
    icon: "🕸️",
    brief: "AI doesn't know who built this product",
    detail: "Schema.org markup connects your product to your company and the people behind it — building the knowledge graph that AI systems use to determine credibility and attribution. This is how you get cited as a trustworthy source.",
    sorenSays: "I'd generate the complete entity graph connecting your product, company, and founder identity.",
  },
};

function getCheckInfo(name: string): CheckInfo {
  return CHECK_INFO[name] || {
    label: name,
    icon: "⚡",
    brief: name,
    detail: "This signal helps AI engines better understand your site.",
    sorenSays: "I can fix this for you automatically.",
  };
}

// ── SOREN ORB ──────────────────────────────────────────────
function SorenOrb({ size = 80, state = "idle" }: { size?: number; state?: OrbState }) {
  const listening = state === "listening";
  const thinking = state === "thinking";
  const speaking = state === "speaking";
  const active = listening || thinking || speaking;
  const ringColor = listening ? C.cyan : C.violet;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {/* Outer rings */}
      {active && [0, 600, 1200].map(d => (
        <div key={d} style={{
          position: "absolute", inset: -size * 0.15,
          borderRadius: "50%",
          border: `1px solid ${ringColor}`,
          animation: `ping-out ${listening ? 1.2 : 2.4}s ease-out ${d}ms infinite`,
          pointerEvents: "none",
        }} />
      ))}
      {/* Glow */}
      <div style={{
        position: "absolute", inset: -size * 0.2,
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(168,85,247,0.3), transparent 70%)`,
        filter: "blur(8px)",
        animation: `soren-breathe ${listening ? 1.2 : 3}s ease-in-out infinite`,
      }} />
      {/* Orb body */}
      <div style={{
        position: "absolute", inset: 0,
        borderRadius: "50%",
        background: sorenGradient,
        animation: `soren-breathe ${listening ? 1.2 : 3}s ease-in-out infinite`,
        boxShadow: `0 0 ${size * 0.4}px ${listening ? "rgba(34,211,238,0.45)" : "rgba(168,85,247,0.5)"}, inset 0 2px 4px rgba(255,255,255,0.2)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {/* Specular highlight */}
        <div style={{
          position: "absolute", top: "15%", left: "20%",
          width: "35%", height: "25%",
          background: "radial-gradient(ellipse, rgba(255,255,255,0.5), transparent)",
          borderRadius: "50%",
          transform: "rotate(-30deg)",
        }} />
        {/* Scan line when active */}
        {active && (
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)",
            animation: "soren-scan 2s ease-in-out infinite",
          }} />
        )}
        {/* S */}
        <span style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: size * 0.38,
          fontWeight: 700,
          color: "rgba(255,255,255,0.95)",
          position: "relative", zIndex: 1,
          textShadow: "0 1px 4px rgba(0,0,0,0.3)",
        }}>S</span>
      </div>
      {/* Speaking waves */}
      {speaking && (
        <div style={{
          position: "absolute", bottom: -size * 0.45,
          left: "50%", transform: "translateX(-50%)",
          display: "flex", gap: 3, alignItems: "center",
        }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{
              width: 3, height: 14,
              borderRadius: 2,
              background: C.purple,
              animation: `wave-bar 0.8s ease ${i * 0.1}s infinite`,
              transformOrigin: "bottom",
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── TYPING TEXT ────────────────────────────────────────────
function TypingText({ text, speed = 28, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const i = useRef(0);
  useEffect(() => {
    i.current = 0;
    setDisplayed("");
    const interval = setInterval(() => {
      if (i.current < text.length) {
        setDisplayed(text.slice(0, ++i.current));
      } else {
        clearInterval(interval);
        onDone?.();
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text]);
  return (
    <span>
      {displayed}
      {displayed.length < text.length && (
        <span style={{
          display: "inline-block", width: 2, height: "1em",
          background: C.purple, marginLeft: 2, verticalAlign: "text-bottom",
          animation: "cursor-blink 0.8s step-end infinite",
        }} />
      )}
    </span>
  );
}

// ── SCORE RING ─────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const [val, setVal] = useState(0);
  const r = 54, circ = 2 * Math.PI * r;
  useEffect(() => {
    let s: number | null = null;
    const dur = 1600;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 4);
      setVal(Math.round(score * e));
      if (p < 1) s = requestAnimationFrame(tick);
    };
    s = requestAnimationFrame(tick);
    return () => { if (s !== null) cancelAnimationFrame(s); };
  }, [score]);
  const pct = val / 100;
  const color = score >= 90 ? C.green : score >= 75 ? C.cyan : score >= 55 ? C.amber : C.red;
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 55 ? "C" : score >= 35 ? "D" : "F";
  return (
    <div style={{ position: "relative", width: 128, height: 128 }}>
      <svg width="128" height="128" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="64" cy="64" r={r} fill="none" stroke={C.raised} strokeWidth="7" />
        <circle cx="64" cy="64" r={r} fill="none" stroke={color}
          strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${pct * circ} ${circ}`}
          style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: "stroke-dasharray 50ms" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        animation: "score-count 0.5s ease",
      }}>
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 30, fontWeight: 700, color, lineHeight: 1 }}>{val}</span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color, opacity: 0.8, marginTop: 2 }}>{grade}</span>
      </div>
    </div>
  );
}

// ── CHECK ROW ──────────────────────────────────────────────
function CheckRow({
  check,
  index,
  openKey,
  setOpenKey,
  onSpeak,
}: {
  check: AuditCheck;
  index: number;
  openKey: string | null;
  setOpenKey: (key: string | null) => void;
  onSpeak?: (text: string) => void;
}) {
  const info = getCheckInfo(check.name);
  const isOpen = openKey === check.name;
  const color = check.passed ? C.green : C.red;

  useEffect(() => {
    if (isOpen) {
      onSpeak?.(`${info.brief}. ${info.sorenSays}`);
    }
  }, [isOpen, info.brief, info.sorenSays, onSpeak]);

  return (
    <div style={{
      borderRadius: 10,
      border: `1px solid ${check.passed ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)"}`,
      background: check.passed ? "rgba(74,222,128,0.04)" : "rgba(248,113,113,0.04)",
      overflow: "hidden",
      animation: `check-slide 0.35s ease ${index * 80}ms both`,
    }}>
      <button
        onClick={() => !check.passed && setOpenKey(isOpen ? null : check.name)}
        style={{
          width: "100%", background: "transparent", border: "none",
          padding: "11px 14px",
          display: "flex", alignItems: "center", gap: 10,
          cursor: check.passed ? "default" : "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0 }}>{info.icon}</span>
        <span style={{
          fontFamily: "'Inter',sans-serif",
          fontSize: 13, fontWeight: 500, color: C.text, flex: 1,
        }}>{info.label}</span>
        {!check.passed && (
          <span style={{ fontSize: 11, color: C.amber, fontFamily: "'JetBrains Mono',monospace", opacity: 0.7 }}>
            tap to fix
          </span>
        )}
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color, fontWeight: 600 }}>
          {check.passed ? `+${check.maxPoints}` : `0/${check.maxPoints}`}
        </span>
        <span style={{ fontSize: 14 }}>{check.passed ? "✅" : "❌"}</span>
      </button>

      {!check.passed && isOpen && (
        <div style={{
          borderTop: `1px solid ${C.border}`,
          padding: "16px 16px 18px",
          animation: "drawer-open 0.25s ease",
          overflow: "hidden",
        }}>
          {/* Soren says */}
          <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
            <SorenOrb size={32} state="thinking" />
            <div>
              <div style={{
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: 12, fontWeight: 600, color: C.purple, marginBottom: 5,
              }}>SOREN ANALYSIS</div>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: C.text, lineHeight: 1.65, margin: 0 }}>
                {info.brief}. {info.detail}
              </p>
            </div>
          </div>

          {/* Soren offer */}
          <div style={{
            background: "rgba(168,85,247,0.08)",
            border: `1px solid rgba(168,85,247,0.25)`,
            borderRadius: 8, padding: "12px 14px",
            display: "flex", gap: 10, alignItems: "flex-start",
            marginBottom: 14,
          }}>
            <span style={{ fontSize: 16 }}>💬</span>
            <p style={{
              fontFamily: "'Inter',sans-serif",
              fontSize: 13, color: C.gray, lineHeight: 1.55, margin: 0, fontStyle: "italic",
            }}>
              {`"${info.sorenSays}"`}
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                alert("Coming soon — Soren will handle this automatically with credits. Sign up for early access at geo-toolkit-site.netlify.app");
              }}
              style={{
                background: sorenGradient,
                border: "none", color: "white",
                padding: "9px 18px", borderRadius: 8,
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: 13, fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(168,85,247,0.35)",
              }}>
              Let Soren handle this — 5 credits
            </button>
            <button
              onClick={() => setOpenKey(null)}
              style={{
                background: C.raised, border: `1px solid ${C.border}`,
                color: C.gray, padding: "9px 18px", borderRadius: 8,
                fontFamily: "'Inter',sans-serif", fontSize: 13,
                cursor: "pointer",
              }}>
              I&apos;ll fix it myself
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SCAN PHASE DISPLAY ─────────────────────────────────────
const SCAN_STEPS = [
  { msg: "Connecting to your site...", icon: "🔌" },
  { msg: "Reading page structure...", icon: "📄" },
  { msg: "Checking AI crawler access...", icon: "🤖" },
  { msg: "Scanning metadata signals...", icon: "📡" },
  { msg: "Analyzing structured data...", icon: "🧠" },
  { msg: "Mapping entity relationships...", icon: "🕸️" },
  { msg: "Checking social signals...", icon: "📨" },
  { msg: "Verifying sitemap coverage...", icon: "🗺️" },
  { msg: "Compiling discoverability score...", icon: "📊" },
];

function ScanPhase({ domain }: { domain: string }) {
  const [step, setStep] = useState(0);
  const [history, setHistory] = useState<Array<{ msg: string; icon: string }>>([]);

  useEffect(() => {
    const delays = [0, 380, 720, 1050, 1360, 1640, 1900, 2140, 2360];
    const timers = delays.map((d, i) =>
      setTimeout(() => {
        setStep(i);
        if (i > 0) setHistory(h => [...h, SCAN_STEPS[i - 1]]);
      }, d)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div style={{ padding: "24px 0" }}>
      {/* Domain being scanned */}
      <div style={{
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 13, color: C.purple, marginBottom: 20,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ color: C.muted }}>$</span> soren scan <span style={{ color: C.cyan }}>{domain}</span>
      </div>

      {/* History */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
        {history.map((h, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 8,
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 12, color: C.muted,
            animation: "token-appear 0.2s ease",
          }}>
            <span>{h.icon}</span>
            <span>{h.msg}</span>
            <span style={{ color: C.green, marginLeft: "auto" }}>✓</span>
          </div>
        ))}
      </div>

      {/* Current step */}
      {step < SCAN_STEPS.length && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 12, color: C.text,
          animation: "token-appear 0.2s ease",
        }}>
          <span>{SCAN_STEPS[step].icon}</span>
          <span>{SCAN_STEPS[step].msg}</span>
          <div style={{ display: "flex", gap: 3, marginLeft: "auto" }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: "50%",
                background: C.purple,
                animation: `wave-bar 0.8s ease ${i * 0.2}s infinite`,
                transformOrigin: "center",
              }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── NORMALIZE URL ─────────────────────────────────────────
function normalizeUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, "");
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  try { new URL(url); return url; }
  catch { return ""; }
}

function extractFirstUrl(text: string): string {
  const match = text.match(/((https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?)/i);
  if (!match) return "";
  return normalizeUrl(match[0]);
}

function buildBriefingText(result: AuditResult): string {
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

// ── MAIN APP ──────────────────────────────────────────────
export default function SorenOS() {
  const [draft, setDraft] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [phase, setPhase] = useState<MissionPhase>("idle");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [greeting, setGreetingDone] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [scanDomain, setScanDomain] = useState("");
  const [activeInput, setActiveInput] = useState("");
  const resultRef = useRef<HTMLElement | null>(null);
  const speakGuardRef = useRef(false);
  const { speak, isSpeaking, isMuted, toggleMute } = useSorenVoice();

  const speakOnce = useCallback(async (text: string) => {
    if (speakGuardRef.current) return;
    speakGuardRef.current = true;
    await speak(cleanForSpeech(text));
    speakGuardRef.current = false;
  }, [speak]);

  const {
    messages,
    auditResult,
    fixPackage,
    isThinking,
    sendMessage,
    runAuditFromChat,
    reset: resetChat,
    clearFixPackage,
  } = useSorenChat((replyText) => {
    void speakOnce(replyText);
  });

  const handleUserText = async (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;
    setError("");
    setActiveInput(text);
    const normalizedUrl = extractFirstUrl(text);
    if (normalizedUrl) {
      setScanDomain(new URL(normalizedUrl).hostname);
      setPhase("scanning");
      await runAuditFromChat(normalizedUrl);
      return;
    }
    await sendMessage(text);
  };

  const {
    state: sttState,
    transcript,
    startListening,
    stopListening,
    isSupported: isSttSupported,
  } = useSorenSTT((recognizedText) => {
    void handleUserText(recognizedText);
  });

  const GREETING = "I'm Soren. Give me any website and I'll tell you exactly how visible your product is to AI engines — and what needs to change.";

  useEffect(() => {
    const enableVoice = () => setVoiceEnabled(true);
    document.addEventListener("click", enableVoice, { once: true });
    return () => document.removeEventListener("click", enableVoice);
  }, []);

  useEffect(() => {
    if (voiceEnabled && greeting) {
      void speakOnce(GREETING);
    }
  }, [voiceEnabled, greeting, speakOnce, GREETING]);

  useEffect(() => {
    if (isThinking) {
      setPhase("scanning");
      return;
    }
    if (auditResult) {
      const mappedResult: AuditResult = {
        ...auditResult,
        checks: auditResult.checks.map((check) => ({
          name: check.name,
          passed: check.passed,
          maxPoints: check.maxPoints,
        })),
      };
      setResult(mappedResult);
      setPhase("briefing");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      return;
    }
    setPhase("idle");
  }, [isThinking, auditResult]);

  useEffect(() => {
    if (!auditResult) return;
    const text = buildBriefingText(auditResult as AuditResult);
    void speakOnce(text);
  }, [auditResult, speakOnce]);

  const orbState: OrbState = isSpeaking
    ? "speaking"
    : sttState === "listening"
    ? "listening"
    : isThinking || sttState === "processing"
    ? "thinking"
    : "idle";

  const scoreColor = (s: number) => s >= 90 ? C.green : s >= 75 ? C.cyan : s >= 55 ? C.amber : C.red;
  const gradeLabel = (s: number) => s >= 90 ? "Strong signal" : s >= 75 ? "Good coverage" : s >= 55 ? "Weak signal" : "Off the grid";
  const failCount = result?.checks?.filter((c) => !c.passed).length ?? 0;

  return (
    <>
      <style>{css}</style>
      <div style={{
        background: C.bg, minHeight: "100vh", color: C.text,
        fontFamily: "'Inter', system-ui, sans-serif",
        overflowX: "hidden",
      }}>
        {/* ── NAV ── */}
        <nav style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "rgba(7,0,15,0.85)", backdropFilter: "blur(20px)",
          borderBottom: `1px solid ${C.border}`,
          padding: "0 40px", height: 56,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: sorenGradient,
              boxShadow: "0 0 12px rgba(168,85,247,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color: "white",
            }}>S</div>
            <span style={{
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: 15, fontWeight: 700, color: C.white,
              letterSpacing: "-0.02em",
            }}>SOREN</span>
            <span style={{
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 10, color: C.muted, letterSpacing: "0.08em",
            }}>AI DISCOVERABILITY</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <a href="#how" style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>How it works</a>
            <a href="https://www.npmjs.com/package/@varshylinc/geo" target="_blank"
              style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>npm</a>
            <button onClick={toggleMute} style={{
              background: "transparent",
              border: `1px solid ${C.border}`,
              color: isMuted ? C.muted : C.purple,
              padding: "6px 12px", borderRadius: 8,
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
              transition: "all 0.2s",
            }}>
              {isMuted ? "🔇 Muted" : "🔊 Sound on"}
            </button>
            <button style={{
              background: sorenGradient, border: "none",
              color: "white", padding: "6px 16px", borderRadius: 8,
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              boxShadow: "0 0 16px rgba(168,85,247,0.35)",
            }}>Get credits</button>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section style={{
          padding: "60px 40px 40px",
          display: "flex", flexDirection: "column", alignItems: "center",
          position: "relative", overflow: "hidden",
          minHeight: "80vh", justifyContent: "center",
        }}>
          {/* Background glow */}
          <div style={{
            position: "absolute", top: "20%", left: "50%",
            transform: "translateX(-50%)",
            width: 600, height: 300,
            background: "radial-gradient(ellipse, rgba(168,85,247,0.12) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          {/* Soren presence */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 32, maxWidth: 700, width: "100%", position: "relative",
          }}>
            {/* Orb + greeting */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
              <div style={{ animation: "float 4s ease-in-out infinite" }}>
                <SorenOrb size={90} state={orbState} />
              </div>

              <div style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 16, padding: "18px 24px",
                maxWidth: 540,
                position: "relative",
              }}>
                {/* Speech bubble tail */}
                <div style={{
                  position: "absolute", top: -8, left: "50%",
                  width: 16, height: 16,
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderBottom: "none", borderRight: "none",
                  transform: "translateX(-50%) rotate(45deg)",
                }} />
                <p style={{
                  fontFamily: "'Space Grotesk',sans-serif",
                  fontSize: 16, lineHeight: 1.65, color: C.white,
                  margin: 0, fontWeight: 400,
                }}>
                  <TypingText text={GREETING} speed={22} onDone={() => setGreetingDone(true)} />
                </p>
              </div>
            </div>

            {/* Conversation interface */}
            {greeting && (
              <div style={{
                width: "100%",
                maxWidth: 640,
                animation: "token-appear 0.4s ease",
              }}>
                <div style={{
                  background: C.surface,
                  border: `1px solid ${isThinking ? C.purple : sttState === "listening" ? C.cyan : C.border}`,
                  borderRadius: 14,
                  padding: "14px 14px 10px",
                  boxShadow: isThinking ? "0 0 24px rgba(168,85,247,0.2)" : "none",
                }}>
                  <div style={{
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 11,
                    color: C.muted,
                    marginBottom: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                  }}>
                    <span>
                      {sttState === "listening"
                        ? "listening..."
                        : sttState === "processing"
                        ? "processing voice..."
                        : isThinking
                        ? "soren thinking..."
                        : "voice conversation ready"}
                    </span>
                    <span style={{ color: C.purple }}>
                      {activeInput ? `target: ${activeInput}` : "say: check my site varshyl.com"}
                    </span>
                  </div>

                  <div style={{
                    minHeight: 180,
                    maxHeight: 240,
                    overflowY: "auto",
                    padding: "6px 4px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}>
                    {messages.length === 0 ? (
                      <p style={{
                        fontFamily: "'Inter',sans-serif",
                        fontSize: 13,
                        color: C.gray,
                        lineHeight: 1.6,
                      }}>
                        Start by speaking or typing. Example: &quot;Check my website varshyl.com&quot; or &quot;How can I improve my AI discoverability?&quot;
                      </p>
                    ) : (
                      messages.slice(-8).map((message, index) => (
                        <div key={`${message.role}-${index}`} style={{
                          alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                          maxWidth: "88%",
                          background: message.role === "user" ? "rgba(168,85,247,0.16)" : C.raised,
                          border: `1px solid ${message.role === "user" ? "rgba(168,85,247,0.35)" : C.border}`,
                          borderRadius: 10,
                          padding: "8px 10px",
                        }}>
                          <div style={{
                            fontFamily: "'JetBrains Mono',monospace",
                            fontSize: 10,
                            color: message.role === "user" ? C.purple : C.cyan,
                            marginBottom: 4,
                            textTransform: "uppercase",
                            letterSpacing: "0.07em",
                          }}>
                            {message.role === "user" ? "You" : "Soren"}
                          </div>
                          <p style={{
                            margin: 0,
                            fontFamily: "'Inter',sans-serif",
                            fontSize: 13,
                            color: C.text,
                            lineHeight: 1.5,
                          }}>
                            {message.content}
                          </p>
                        </div>
                      ))
                    )}

                    {sttState === "listening" && transcript && (
                      <div style={{
                        alignSelf: "flex-end",
                        maxWidth: "88%",
                        background: "rgba(34,211,238,0.1)",
                        border: "1px solid rgba(34,211,238,0.25)",
                        borderRadius: 10,
                        padding: "8px 10px",
                      }}>
                        <div style={{
                          fontFamily: "'JetBrains Mono',monospace",
                          fontSize: 10,
                          color: C.cyan,
                          marginBottom: 4,
                          textTransform: "uppercase",
                          letterSpacing: "0.07em",
                        }}>
                          Listening
                        </div>
                        <p style={{ margin: 0, fontFamily: "'Inter',sans-serif", fontSize: 13, color: C.text }}>
                          {transcript}
                        </p>
                      </div>
                    )}
                  </div>

                  {showTextInput && (
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                      <input
                        value={draft}
                        onChange={(event) => {
                          setDraft(event.target.value);
                          setError("");
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && draft.trim()) {
                            void handleUserText(draft);
                            setDraft("");
                          }
                        }}
                        placeholder="Type to Soren..."
                        style={{
                          flex: 1,
                          background: C.raised,
                          border: `1px solid ${C.border}`,
                          borderRadius: 8,
                          color: C.white,
                          fontFamily: "'Inter',sans-serif",
                          fontSize: 13,
                          padding: "10px 12px",
                          outline: "none",
                        }}
                      />
                      <button
                        onClick={() => {
                          if (!draft.trim()) return;
                          void handleUserText(draft);
                          setDraft("");
                        }}
                        style={{
                          background: sorenGradient,
                          border: "none",
                          color: "white",
                          borderRadius: 8,
                          fontFamily: "'Space Grotesk',sans-serif",
                          fontSize: 13,
                          fontWeight: 600,
                          padding: "0 16px",
                          cursor: "pointer",
                        }}
                      >
                        Send
                      </button>
                    </div>
                  )}

                  <div style={{
                    marginTop: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}>
                    <button
                      onClick={() => {
                        if (!isSttSupported) {
                          setError("Speech recognition is not supported in this browser.");
                          return;
                        }
                        if (sttState === "listening") {
                          stopListening();
                          return;
                        }
                        startListening();
                      }}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        border: `1px solid ${sttState === "listening" ? "rgba(34,211,238,0.55)" : C.border}`,
                        background: sttState === "listening" ? "rgba(34,211,238,0.2)" : C.raised,
                        color: sttState === "listening" ? C.cyan : C.text,
                        cursor: "pointer",
                        fontSize: 17,
                        flexShrink: 0,
                      }}
                      title={sttState === "listening" ? "Stop listening" : "Start listening"}
                    >
                      🎙️
                    </button>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <button
                        onClick={toggleMute}
                        title={isMuted ? "Unmute Soren" : "Mute Soren"}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          background: isMuted
                            ? "rgba(248,113,113,0.15)"
                            : "rgba(255,255,255,0.08)",
                          border: `1px solid ${isMuted
                            ? "rgba(248,113,113,0.4)"
                            : "rgba(255,255,255,0.15)"}`,
                          color: isMuted ? "#F87171" : "#9CA3AF",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 18,
                          flexShrink: 0,
                          transition: "all 0.2s",
                        }}
                      >
                        {isMuted ? "🔇" : "🔊"}
                      </button>
                      <div style={{
                        fontSize: 10,
                        color: "rgba(255,255,255,0.4)",
                        textAlign: "center",
                        marginTop: 4,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        {isMuted ? "muted" : "sound on"}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowTextInput((prev) => !prev)}
                      style={{
                        background: "transparent",
                        border: `1px solid ${C.border}`,
                        color: C.gray,
                        borderRadius: 8,
                        padding: "8px 12px",
                        fontFamily: "'Inter',sans-serif",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {showTextInput ? "Hide text input" : "Type instead"}
                    </button>
                    <button
                      onClick={() => {
                        resetChat();
                        setResult(null);
                        setPhase("idle");
                        setOpenKey(null);
                        setError("");
                        setActiveInput("");
                        clearFixPackage();
                      }}
                      style={{
                        background: "transparent",
                        border: `1px solid ${C.border}`,
                        color: C.gray,
                        borderRadius: 8,
                        padding: "8px 12px",
                        fontFamily: "'Inter',sans-serif",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Reset conversation
                    </button>
                  </div>
                </div>

                {error && (
                  <p style={{
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 13,
                    color: C.red,
                    marginTop: 8,
                    paddingLeft: 4,
                  }}>
                    ⚠ {error}
                  </p>
                )}

                {phase === "scanning" && (
                  <div style={{
                    marginTop: 12,
                    width: "100%",
                    maxWidth: 640,
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 14,
                    padding: "4px 20px 20px",
                    animation: "token-appear 0.3s ease",
                  }}>
                    <ScanPhase domain={scanDomain || "your-site.com"} />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── MISSION BRIEFING ── */}
        {phase === "briefing" && result && (
          <section ref={resultRef} style={{ padding: "0 40px 60px" }}>
            <div style={{
              maxWidth: 700, margin: "0 auto",
              animation: "token-appear 0.4s ease",
            }}>
              {/* Soren briefing header */}
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 16,
                marginBottom: 24,
              }}>
                <SorenOrb size={44} state="thinking" />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 11, color: C.purple, marginBottom: 6,
                  }}>MISSION BRIEFING — {result.url}</div>
                  <p style={{
                    fontFamily: "'Space Grotesk',sans-serif",
                    fontSize: 15, color: C.white, lineHeight: 1.6, margin: 0,
                  }}>
                    {result.score >= 90
                      ? `Strong signal. Your site is broadcasting clearly to AI engines. ${failCount > 0 ? "One vulnerability remains." : "All signals confirmed."}`
                      : result.score >= 75
                      ? `Good coverage, but ${failCount} signal${failCount !== 1 ? "s are" : " is"} degraded. AI engines can find you, but they're working with incomplete information.`
                      : result.score >= 55
                      ? `Weak signal. AI engines are struggling to understand your product. ${failCount} signals are missing — your site exists but it's not being cited.`
                      : `Off the grid. ${failCount} critical signals are missing. When someone asks AI about products like yours, you don't exist in the answer.`
                    }
                  </p>
                </div>
              </div>

              {/* Score + checks */}
              <div style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 16, overflow: "hidden",
              }}>
                {/* Score header */}
                <div style={{
                  background: C.raised, borderBottom: `1px solid ${C.border}`,
                  padding: "20px 24px",
                  display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
                }}>
                  <ScoreRing score={result.score} />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: "'Space Grotesk',sans-serif",
                      fontSize: 22, fontWeight: 700, color: C.white,
                      marginBottom: 4,
                    }}>{gradeLabel(result.score)}</div>
                    <div style={{
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 12, color: C.muted,
                    }}>
                      {result.checks?.filter(c => c.passed).length}/{result.checks?.length} signals active
                    </div>
                    {/* Signal bars */}
                    <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 18, marginTop: 10 }}>
                      {[4, 8, 12, 16, 20].map((h, i) => (
                        <div key={i} style={{
                          width: 10, height: h, borderRadius: 2,
                          background: i < Math.ceil(result.score / 20) ? scoreColor(result.score) : C.border,
                          boxShadow: i < Math.ceil(result.score / 20) ? `0 0 6px ${scoreColor(result.score)}80` : "none",
                          transition: `background ${0.3 + i * 0.1}s ease`,
                        }} />
                      ))}
                    </div>
                  </div>
                  {failCount > 0 && (
                    <div style={{
                      background: "rgba(251,191,36,0.1)",
                      border: "1px solid rgba(251,191,36,0.2)",
                      padding: "8px 14px", borderRadius: 8,
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 12, color: C.amber,
                    }}>
                      {failCount} fix{failCount !== 1 ? "es" : ""} available
                    </div>
                  )}
                </div>

                {/* Check list */}
                <div style={{ padding: "16px 16px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {result.checks?.map((check, i) => (
                    <CheckRow key={check.name} check={check} index={i}
                      openKey={openKey} setOpenKey={setOpenKey} onSpeak={speakOnce} />
                  ))}
                </div>

                {/* Quick fixes summary */}
                {(result.topFixes?.length ?? 0) > 0 && (
                  <div style={{
                    borderTop: `1px solid ${C.border}`,
                    padding: "18px 20px",
                    display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap",
                  }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{
                        fontFamily: "'Space Grotesk',sans-serif",
                        fontSize: 12, fontWeight: 600, color: C.white, marginBottom: 8,
                      }}>Top fixes:</div>
                      {(result.topFixes ?? []).slice(0, 3).map((f, i) => (
                        <div key={i} style={{
                          display: "flex", gap: 8, marginBottom: 5,
                          fontSize: 12, color: C.gray, fontFamily: "'Inter',sans-serif",
                        }}>
                          <span style={{ color: C.amber, flexShrink: 0 }}>→</span>{f}
                        </div>
                      ))}
                    </div>
                    <div style={{
                      background: C.raised, border: `1px solid ${C.border}`,
                      borderRadius: 10, padding: "14px 16px", flexShrink: 0,
                    }}>
                      <div style={{
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 11, color: C.muted, marginBottom: 8,
                      }}>auto-fix everything:</div>
                      <div style={{
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 13, color: C.cyan, marginBottom: 6,
                      }}>pnpm add @varshylinc/geo</div>
                      <div style={{
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 13, color: C.purple,
                      }}>npx varshyl-geo init</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Scan again */}
              <div style={{ textAlign: "center", marginTop: 20 }}>
                <button onClick={() => { setPhase("idle"); setResult(null); setDraft(""); setOpenKey(null); resetChat(); setActiveInput(""); clearFixPackage(); }}
                  style={{
                    background: "transparent", border: `1px solid ${C.border}`,
                    color: C.gray, padding: "8px 20px", borderRadius: 8,
                    fontFamily: "'Inter',sans-serif", fontSize: 13,
                    cursor: "pointer",
                  }}>
                  ← Scan another site
                </button>
              </div>
            </div>
          </section>
        )}

        {fixPackage && (
          <section style={{ padding: "0 40px 40px" }}>
            <div style={{ maxWidth: 700, margin: "0 auto" }}>
              <FixPackage
                pkg={fixPackage}
                onClose={() => clearFixPackage()}
              />
            </div>
          </section>
        )}

        {/* ── HOW IT WORKS ── */}
        <section id="how" style={{
          padding: "80px 40px",
          background: C.surface, borderTop: `1px solid ${C.border}`,
        }}>
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            <div style={{
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase",
              color: C.purple, marginBottom: 16, textAlign: "center",
            }}>How Soren works</div>
            <h2 style={{
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: "clamp(26px,3vw,38px)",
              fontWeight: 700, letterSpacing: "-0.02em",
              color: C.white, textAlign: "center", marginBottom: 48,
            }}>From invisible to cited in minutes</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                { n:"01", title:"Soren scans your site", desc:"Enter any URL. Soren checks 9 AI discoverability signals — the exact signals ChatGPT, Claude, and Perplexity use to decide whether to cite your product.", icon:"📡" },
                { n:"02", title:"You see what's missing", desc:"Every failing signal explained in plain English. Not 'JSON-LD not found' — but 'AI doesn't know what type of product you are, and here's why that matters.'", icon:"🔍" },
                { n:"03", title:"Soren fixes it for you", desc:"Click any failing check. Soren explains the issue and offers to handle the fix — generating the exact code or file your platform needs, pre-filled with your real product details.", icon:"⚡" },
                { n:"04", title:"Your score reaches 100", desc:"Apply the fixes. Rescan. Watch your signal strength climb. Soren Watch monitors weekly and alerts you the moment anything breaks.", icon:"✅" },
              ].map((step, i) => (
                <div key={i} style={{
                  display: "flex", gap: 20, padding: "24px 0",
                  borderBottom: i < 3 ? `1px solid ${C.border}` : "none",
                  animation: `token-appear 0.4s ease ${i * 100}ms both`,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: "rgba(168,85,247,0.1)",
                    border: `1px solid rgba(168,85,247,0.2)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18,
                  }}>{step.icon}</div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 10, color: C.purple, letterSpacing: "0.1em",
                      }}>{step.n}</span>
                      <span style={{
                        fontFamily: "'Space Grotesk',sans-serif",
                        fontSize: 15, fontWeight: 600, color: C.white,
                      }}>{step.title}</span>
                    </div>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: C.gray, lineHeight: 1.65, margin: 0 }}>
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{
          borderTop: `1px solid ${C.border}`,
          padding: "28px 40px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              background: sorenGradient, fontSize: 10, fontWeight: 700,
              color: "white", display: "flex", alignItems: "center", justifyContent: "center",
            }}>S</div>
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 600, color: C.white }}>SOREN</span>
            <span style={{ fontSize: 12, color: C.muted }}>
              by{" "}
              <a href="https://vagishkapila.com" target="_blank" style={{ color: C.purple, textDecoration: "none" }}>
                Vagish Kapila
              </a>
              {" "}· Varshyl Inc. · Apache-2.0
            </span>
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            {[["npm", "https://www.npmjs.com/package/@varshylinc/geo"],
              ["GitHub", "https://github.com/VagishKapila/varshyl-toolkit"],
              ["@varshylinc/geo", "https://www.npmjs.com/package/@varshylinc/geo"]
            ].map(([l, h]) => (
              <a key={l} href={h} target="_blank"
                style={{ fontSize: 12, color: C.muted, textDecoration: "none" }}>{l}</a>
            ))}
          </div>
        </footer>

        {!voiceEnabled && (
          <div style={{
            position: "fixed", bottom: 24, left: "50%",
            transform: "translateX(-50%)",
            background: C.surface,
            border: `1px solid ${C.purple}`,
            borderRadius: 100, padding: "10px 20px",
            fontFamily: "'Inter', sans-serif",
            fontSize: 13, color: C.text,
            cursor: "pointer", zIndex: 200,
            boxShadow: "0 8px 32px rgba(168,85,247,0.3)",
            animation: "token-appear 0.4s ease 2s both",
          }}>
            🔊 Tap anywhere to enable Soren&apos;s voice
          </div>
        )}
      </div>
    </>
  );
}
