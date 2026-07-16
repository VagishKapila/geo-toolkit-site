import { GEO } from '@varshylinc/geo';
import type { GEOConfig } from '@varshylinc/geo';

/** Prod/preview: set NEXT_PUBLIC_SITE_URL. Local fallback is for OG/canonical resolution. */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
).replace(/\/+$/, '');

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
