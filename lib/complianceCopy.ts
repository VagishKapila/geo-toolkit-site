/** Unified compliance footnote — use on results, comparison card, marketing. */
export const COMPLIANCE_FOOTNOTE =
  'These checks address common technical signals referenced by WCAG 2.1, ADA, OWASP, and Section 508 guidelines. This is not a legal compliance certification. Requirements vary by jurisdiction, industry, and audience — verify with a qualified accessibility specialist or legal advisor.';

export const STANDARDS_REFERENCED = 'WCAG 2.1 · ADA · OWASP · Section 508';

/** One-line human summary for each check when it newly passes. */
export const CHECK_IMPROVEMENT_LINES: Record<string, string> = {
  'llms.txt': 'AI crawler guidance file now published',
  'robots.txt AI crawlers': 'AI crawlers allowed in robots.txt',
  'JSON-LD script': 'structured data script added',
  'Open Graph tags': 'social preview metadata complete',
  'Twitter card tag': 'Twitter card metadata added',
  'Heading structure': 'clear heading structure for crawlers',
  'sitemap.xml': 'now discoverable by AI',
  'Canonical link': 'canonical URL declared',
  'Schema.org entity': 'organization entity in structured data',
  'Alt text': 'images now have descriptive alt text',
  'Heading hierarchy': 'sequential heading levels in place',
  'Form labels': 'form inputs linked to labels',
  'Landmarks': 'semantic HTML structure added',
  'Lang attribute': 'page language declared for assistive tech',
  'Strict-Transport-Security': 'HTTPS enforcement enabled',
  'X-Content-Type-Options': 'MIME sniffing blocked',
  'X-Frame-Options': 'clickjacking protection active',
  'Content-Security-Policy': 'content security policy active',
};

export function improvementLine(checkName: string): string {
  return CHECK_IMPROVEMENT_LINES[checkName] ?? 'technical signal now passing';
}

export function buildShareText(
  beforeScore: number,
  beforeGrade: string,
  afterScore: number,
  afterGrade: string,
): string {
  return (
    `My website improved from ${beforeScore}/${beforeGrade} to ${afterScore}/${afterGrade} on AI readiness, accessibility, and security signals. Checked against WCAG 2.1, ADA, OWASP, and Section 508 reference guidelines. Check yours free → soren.varshyl.com`
  );
}
