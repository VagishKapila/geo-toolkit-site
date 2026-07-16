import { GEO } from '@varshylinc/geo';
import type { GEOConfig } from '@varshylinc/geo';

function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    const normalized = raw.replace(/\/+$/, '');
    try {
      return new URL(normalized).toString().replace(/\/+$/, '');
    } catch {
      // Invalid env URL falls back to local dev URL.
    }
  }
  return 'http://localhost:3000';
}

/** Canonical base URL for metadata/OG; set NEXT_PUBLIC_SITE_URL per environment. */
export const siteUrl = resolveSiteUrl();

export const geoConfig: GEOConfig = {
  product: {
    name: 'GEO — AI Discoverability Toolkit',
    tagline: 'Audit and fix your product for AI discoverability in minutes',
    url: siteUrl,
    type: 'WebApplication',
    category: 'DeveloperApplication',
    platform: ['Web'],
    price: '0',
    version: '0.1.0',
    features: [
      'Live GEO audit score',
      'llms.txt generator',
      'robots.txt AI crawler rules',
      'JSON-LD generator',
      'Sitemap generator',
      'App Store description generator',
    ],
    problems_solved: [
      'Low visibility in AI answers',
      'Missing structured metadata for AI crawlers',
      'Inconsistent product facts across web properties',
    ],
    install: 'pnpm add @varshylinc/geo',
  },
  company: {
    name: 'Varshyl Inc.',
    url: 'https://varshyl.com',
    location: 'Pleasanton, CA',
  },
  founder: {
    name: 'Vagish Kapila',
    title: 'Founder & CEO',
    url: 'https://vagishkapila.com',
    credentials: ['Founder', 'Product Engineer', 'AI Systems Builder'],
  },
};

export const geo = new GEO(geoConfig);
