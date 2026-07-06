"use client";

import { useMemo, useState } from "react";

type AuditCheck = { name: string; passed: boolean; points: number; maxPoints: number; tip: string };
type AuditResult = {
  url: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  checks: AuditCheck[];
  topFixes: string[];
  installCommand: string;
};

const EXAMPLES = ["https://vagishkapila.github.io/lastmile-toolkit-site/", "https://example.com"];
const API_URL = "https://toolkit-demo-host-production.up.railway.app/api/geo-audit";

function scoreColor(grade: string): string {
  if (grade === "A" || grade === "B") return "#10B981";
  if (grade === "C") return "#F59E0B";
  return "#EF4444";
}

export default function Home() {
  const [url, setUrl] = useState(EXAMPLES[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);

  const gradeColor = useMemo(() => scoreColor(result?.grade ?? "F"), [result?.grade]);

  async function runAudit(): Promise<void> {
    const input = url.trim();
    if (!/^https?:\/\//i.test(input)) {
      setError("Please enter a valid URL starting with https://");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: input }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await res.json()) as AuditResult | { error?: string };
      if (!res.ok || ("error" in data && data.error)) {
        throw new Error(data && "error" in data && data.error ? data.error : "Unable to run GEO audit");
      }
      setResult(data as AuditResult);
    } catch {
      setError("Unable to reach audit service. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="mb-4 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1 text-xs font-semibold tracking-wider text-cyan-300">
          @varshylinc/geo
        </p>
        <h1 className="mb-5 text-5xl font-bold leading-tight text-white md:text-7xl">
          Is your product readable by AI?
        </h1>
        <p className="mb-10 max-w-2xl text-lg text-slate-300">
          Audit any URL in seconds and get exact GEO signals to improve citations in ChatGPT, Claude, and Perplexity.
        </p>

        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 shadow-2xl">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAudit()}
              className="h-12 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 font-mono text-sm text-slate-100 outline-none ring-cyan-400 focus:ring-2"
              placeholder="https://yourproduct.com"
            />
            <button
              onClick={runAudit}
              disabled={loading}
              className="h-12 rounded-xl bg-cyan-400 px-6 font-semibold text-slate-950 disabled:opacity-70"
            >
              {loading ? "Checking..." : "Run Audit"}
            </button>
          </div>
          {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
            {EXAMPLES.map((item) => (
              <button key={item} className="rounded border border-slate-700 px-2 py-1" onClick={() => setUrl(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      {result ? (
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Audit result</p>
                <p className="font-mono text-sm text-slate-200">{result.url}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="grid h-24 w-24 place-items-center rounded-full border-4 text-3xl font-bold" style={{ borderColor: gradeColor, color: gradeColor }}>
                  {result.score}
                </div>
                <p className="text-xl font-bold" style={{ color: gradeColor }}>{result.grade}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {result.checks.map((check) => (
                <div key={check.name} className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <p>{check.passed ? "✅" : "❌"} {check.name}</p>
                    <p className="font-mono text-slate-400">{check.points}/{check.maxPoints}</p>
                  </div>
                  {!check.passed ? <p className="mt-1 text-xs italic text-amber-300">{check.tip}</p> : null}
                </div>
              ))}
            </div>

            {result.topFixes.length ? (
              <div className="mt-6 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
                <p className="mb-2 font-semibold text-orange-300">Quick wins</p>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-orange-100">
                  {result.topFixes.map((fix) => <li key={fix}>{fix}</li>)}
                </ol>
                <p className="mt-3 font-mono text-xs text-orange-200">pnpm add @varshylinc/geo</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
