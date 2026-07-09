const BASE = 'https://toolkit-demo-host-production-ac14.up.railway.app';

export interface GeoCheck {
  name: string;
  passed: boolean;
  points?: number;
  maxPoints?: number;
  tip?: string;
}

export interface GeoAudit {
  url: string;
  score: number;
  grade: string;
  platform: string;
  checks: GeoCheck[];
  topFixes?: string[];
  installCommand?: string;
  platformConfidence?: string;
  platformSignals?: string[];
  fixApproach?: string;
}

export interface FixPackage {
  platform: string;
  summary: string;
  files: { filename: string; content: string; description?: string }[];
  instructions: { step?: number; title: string; detail: string }[];
  sorenSays?: string;
  creditsRequired?: number;
}

export function normalizeUrl(raw: string): string {
  const t = raw.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export async function runAudit(url: string): Promise<GeoAudit> {
  const normalized = normalizeUrl(url);
  const res = await fetch(`${BASE}/api/geo-audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: normalized }),
  });
  if (!res.ok) {
    let msg = `Scan failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (
        body?.error === 'Cannot reach URL'
        || /cannot reach/i.test(body?.error ?? '')
      ) {
        msg = `I couldn't reach ${normalized} — the site isn't responding. Check the address and try again.`;
      } else if (body?.error) {
        msg = body.error;
      }
    } catch {
      /* keep default */
    }
    throw new Error(msg);
  }
  const data = (await res.json()) as GeoAudit;
  return { ...data, url: normalized };
}

export async function requestFix(audit: GeoAudit): Promise<FixPackage> {
  const failingChecks = audit.checks.filter((c) => !c.passed);
  const res = await fetch(`${BASE}/api/soren/fix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform: audit.platform,
      failingChecks,
      siteInfo: { url: audit.url },
    }),
  });
  if (!res.ok) throw new Error(`Fix request failed: ${res.status}`);
  return (await res.json()) as FixPackage;
}
