import JSZip from 'jszip';
import { getSharedRoom, teardownSession } from '@/lib/soren-voice/session-lifecycle';
import type { GeoAudit } from '@/lib/geoApi';

export const FIX_API = 'https://toolkit-demo-host-production-ac14.up.railway.app';
const CALENDLY = 'https://calendly.com/vaakapila';

export interface FixPackageFile {
  filename: string;
  content: string;
  description?: string;
}

export interface FixPackageResponse {
  platform: string;
  summary?: string;
  files: FixPackageFile[];
  readme?: string;
  prompt?: string;
  zipUrl?: string;
}

export interface StoredAiPackageData {
  platform: string;
  failingChecks: { name: string; tip: string }[];
  siteInfo: { url: string };
}

export interface FixFileMeta {
  check: string;
  points: number | null;
}

function failingChecks(audit: GeoAudit) {
  return audit.checks
    .filter((c) => !c.passed)
    .map((c) => ({ name: c.name, tip: c.tip ?? '' }));
}

function domainSlug(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').replace(/\./g, '-');
  } catch {
    return 'site';
  }
}

export function zipFilename(siteUrl: string): string {
  const domain = domainSlug(siteUrl);
  const date = new Date().toISOString().slice(0, 10);
  return `soren-fix-${domain}-${date}.zip`;
}

/** Parse API description like "Fixes llms.txt (+20 pts)". */
export function parseFixFileMeta(file: FixPackageFile): FixFileMeta {
  const match = file.description?.match(/Fixes (.+?) \(\+(\d+) pts\)/i);
  if (match) {
    return { check: match[1], points: Number(match[2]) };
  }
  return { check: file.filename, points: null };
}

export function isFixPayloadFile(filename: string): boolean {
  return filename !== 'README.md' && filename !== 'PROMPT.txt';
}

export async function fetchFixPackage(
  audit: GeoAudit,
  tier: 'diy' | 'ai' = 'diy',
): Promise<FixPackageResponse> {
  const url = `${FIX_API}/api/soren/fix${tier === 'ai' ? '?tier=ai' : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform: audit.platform,
      failingChecks: failingChecks(audit),
      siteInfo: { url: audit.url },
    }),
  });
  if (!res.ok) throw new Error('Fix package request failed');
  return res.json() as Promise<FixPackageResponse>;
}

export async function fetchFixPackageFromStored(
  data: StoredAiPackageData,
  tier: 'diy' | 'ai' = 'ai',
): Promise<FixPackageResponse> {
  const url = `${FIX_API}/api/soren/fix${tier === 'ai' ? '?tier=ai' : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Fix package request failed');
  return res.json() as Promise<FixPackageResponse>;
}

async function buildZipBlob(pkg: FixPackageResponse, tier: 'diy' | 'ai'): Promise<Blob> {
  const zip = new JSZip();
  const readme =
    pkg.readme
    ?? pkg.files.find((f) => f.filename === 'README.md')?.content
    ?? 'See included fix files.';
  const prompt =
    pkg.prompt
    ?? pkg.files.find((f) => f.filename === 'PROMPT.txt')?.content;

  zip.file('README.md', readme);
  if (tier === 'ai' && prompt) {
    zip.file('PROMPT.txt', prompt);
  }
  for (const file of pkg.files) {
    if (file.filename === 'README.md' || file.filename === 'PROMPT.txt') continue;
    zip.file(file.filename, file.content);
  }

  return zip.generateAsync({ type: 'blob' });
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

export async function downloadFixZip(
  pkg: FixPackageResponse,
  siteUrl: string,
  tier: 'diy' | 'ai' = 'diy',
): Promise<void> {
  const filename = zipFilename(siteUrl);

  if (pkg.zipUrl) {
    const zipFull = pkg.zipUrl.startsWith('http')
      ? pkg.zipUrl
      : `${FIX_API}${pkg.zipUrl}`;
    const res = await fetch(zipFull);
    if (res.ok) {
      const blob = await res.blob();
      triggerBlobDownload(blob, filename);
      return;
    }
  }

  triggerBlobDownload(await buildZipBlob(pkg, tier), filename);
}

export async function deliverDiyPackage(audit: GeoAudit): Promise<FixPackageResponse> {
  const pkg = await fetchFixPackage(audit, 'diy');
  await downloadFixZip(pkg, audit.url, 'diy');
  return pkg;
}

export async function deliverAiPackage(audit: GeoAudit): Promise<FixPackageResponse> {
  const pkg = await fetchFixPackage(audit, 'ai');
  await downloadFixZip(pkg, audit.url, 'ai');
  return pkg;
}

export async function deliverAiPackageFromStored(
  data: StoredAiPackageData,
): Promise<FixPackageResponse> {
  const pkg = await fetchFixPackageFromStored(data, 'ai');
  await downloadFixZip(pkg, data.siteInfo.url, 'ai');
  return pkg;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function triggerAiPackageCheckout(
  audit: GeoAudit,
  email: string,
): Promise<string | null> {
  const res = await fetch(`${FIX_API}/api/credits/checkout`, {
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

  const stored: StoredAiPackageData = {
    platform: audit.platform,
    failingChecks: failingChecks(audit),
    siteInfo: { url: audit.url },
  };
  sessionStorage.setItem('soren_ai_package_data', JSON.stringify(stored));
  await teardownSession(getSharedRoom());
  window.location.href = data.checkoutUrl;
  return null;
}

export async function triggerDoItForMeCheckout(
  audit: GeoAudit,
  email: string,
): Promise<string | null> {
  const res = await fetch(`${FIX_API}/api/credits/checkout`, {
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

export { CALENDLY };
