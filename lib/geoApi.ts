const BASE = 'https://toolkit-demo-host-production-ac14.up.railway.app';
const SCAN_TIMEOUT_MS = 30_000;

export interface GeoCheck {
  name: string;
  passed: boolean;
  points?: number;
  maxPoints?: number;
  tip?: string;
  category?: string;
  info?: boolean;
}

export interface GeoAuditComparison {
  previousScore: number;
  previousGrade: string;
  improvement: number;
  newlyPassing: string[];
  issuesFixed: number;
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
  comparison?: GeoAuditComparison;
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

export function looksLikeWebsite(raw: string): boolean {
  const normalized = normalizeUrl(raw);
  try {
    const host = new URL(normalized).hostname.toLowerCase();
    if (!host || host.length < 3) return false;
    if (host === 'localhost' || host.endsWith('.localhost')) return true;
    if (!host.includes('.') || host.startsWith('.') || host.endsWith('.')) return false;
    return true;
  } catch {
    return false;
  }
}

function friendlyScanError(status: number, apiError: string | undefined, url: string): string {
  const lower = (apiError ?? '').toLowerCase();
  if (
    status === 502
    || lower.includes('cannot reach')
    || lower.includes('enotfound')
    || lower.includes('fetch failed')
  ) {
    return `I couldn't find or reach ${url}. Check the spelling, make sure the site is live, and try again.`;
  }
  if (status === 400 || lower.includes('invalid url')) {
    return `That doesn't look like a valid website address. Try something like example.com.`;
  }
  if (status === 408 || lower.includes('timeout') || lower.includes('aborted')) {
    return `The scan timed out before ${url} responded. The site may be down — try again in a moment.`;
  }
  if (apiError) return apiError;
  return `Scan failed for ${url}. Check the address and try again.`;
}

export async function runAudit(
  url: string,
  options?: { previousAudit?: GeoAudit },
): Promise<GeoAudit> {
  const normalized = normalizeUrl(url);
  if (!looksLikeWebsite(normalized)) {
    throw new Error(
      `That doesn't look like a valid website. Enter a domain like example.com and try again.`,
    );
  }

  const params = new URLSearchParams();
  if (options?.previousAudit) {
    params.set('compare', String(options.previousAudit.score));
  }
  const query = params.toString();
  const endpoint = `${BASE}/api/geo-audit${query ? `?${query}` : ''}`;

  const body: {
    url: string;
    previousChecks?: { name: string; passed: boolean }[];
  } = { url: normalized };
  if (options?.previousAudit) {
    body.previousChecks = options.previousAudit.checks.map((c) => ({
      name: c.name,
      passed: c.passed,
    }));
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
    });
  } catch (err) {
    const isTimeout =
      err instanceof Error
      && (err.name === 'TimeoutError' || err.name === 'AbortError');
    throw new Error(
      isTimeout
        ? `The scan timed out — ${normalized} didn't respond in time. Check the URL and try again.`
        : `I couldn't reach ${normalized}. Check your connection and the website address.`,
    );
  }

  if (!res.ok) {
    let apiError: string | undefined;
    try {
      const body = (await res.json()) as { error?: string };
      apiError = body?.error;
    } catch {
      /* keep undefined */
    }
    throw new Error(friendlyScanError(res.status, apiError, normalized));
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
