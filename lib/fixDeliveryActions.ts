import { getSharedRoom, teardownSession } from '@/lib/soren-voice/session-lifecycle';

const API = 'https://toolkit-demo-host-production-ac14.up.railway.app';
const CALENDLY = 'https://calendly.com/vaakapila';

export interface FixAuditInput {
  url: string;
  platform: string;
  checks: { name: string; passed: boolean; tip?: string }[];
}

function failingChecks(audit: FixAuditInput) {
  return audit.checks
    .filter((c) => !c.passed)
    .map((c) => ({ name: c.name, tip: c.tip ?? '' }));
}

/** DIY zip — POST /api/soren/fix, download files (same as FixDeliveryCards). */
export async function triggerDiyDownload(audit: FixAuditInput): Promise<void> {
  const res = await fetch(`${API}/api/soren/fix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform: audit.platform,
      failingChecks: failingChecks(audit),
      siteInfo: { url: audit.url },
    }),
  });
  const pkg = await res.json();

  pkg.files.forEach((file: { content: string; filename: string }, i: number) => {
    setTimeout(() => {
      const blob = new Blob([file.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
    }, i * 400);
  });
}

/**
 * AI Package $1.99 — POST /api/credits/checkout option: 'ai-package'
 * (Stripe price configured server-side; display-only $1.99 in UI).
 */
export async function triggerAiPackageCheckout(
  audit: FixAuditInput,
  email: string,
): Promise<string | null> {
  const res = await fetch(`${API}/api/credits/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      option: 'ai-package',
      siteUrl: audit.url,
      successUrl:
        `${window.location.origin}` +
        `?ai_package_success=true` +
        `&platform=${encodeURIComponent(audit.platform)}` +
        `&url=${encodeURIComponent(audit.url)}`,
      cancelUrl: window.location.href,
    }),
  });
  const data = await res.json();
  if (!data.checkoutUrl) return 'Could not start checkout. Try again.';

  sessionStorage.setItem(
    'soren_ai_package_data',
    JSON.stringify({
      platform: audit.platform,
      failingChecks: failingChecks(audit),
      siteInfo: { url: audit.url },
    }),
  );
  await teardownSession(getSharedRoom());
  window.location.href = data.checkoutUrl;
  return null;
}

/**
 * Do It For Me $9.00 — POST /api/credits/checkout option: 'do-it-for-me'
 * success redirects to Calendly ({@link CALENDLY}).
 */
export async function triggerDoItForMeCheckout(
  audit: FixAuditInput,
  email: string,
): Promise<string | null> {
  const res = await fetch(`${API}/api/credits/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      option: 'do-it-for-me',
      siteUrl: audit.url,
      successUrl:
        `${window.location.origin}` +
        `?call_success=true` +
        `&calendly=${encodeURIComponent(CALENDLY)}`,
      cancelUrl: window.location.href,
    }),
  });
  const data = await res.json();
  if (!data.checkoutUrl) return 'Could not start checkout. Try again.';

  await teardownSession(getSharedRoom());
  window.location.href = data.checkoutUrl;
  return null;
}
