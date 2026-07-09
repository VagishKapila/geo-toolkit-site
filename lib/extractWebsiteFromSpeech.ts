const ECHO_PHRASES = [
  'i am listening',
  'say the website',
  'good afternoon',
  'confirm it before',
  'run the audit',
];

export function isSorenEcho(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  return ECHO_PHRASES.some((phrase) => t.includes(phrase));
}

export function extractWebsiteFromSpeech(transcript: string): string | null {
  const text = transcript.toLowerCase().trim();

  const dotted = text
    .replace(/\s+dot\s+/gi, '.')
    .replace(/\s+period\s+/gi, '.')
    .replace(/\s+punto\s+/gi, '.');

  const cleaned = dotted
    .replace(/^(can you |please |)?(check|open|scan|audit|search|look at|analyze|test|go to|visit|try)\s+/i, '')
    .replace(/^(the\s+)?(website|site|url|page|domain)\s+(is\s+)?/i, '')
    .replace(/^for\s+/i, '')
    .trim();

  const domainMatch = cleaned.match(
    /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:\/\S*)?)/i,
  );

  if (!domainMatch) return null;

  const raw = domainMatch[0];

  if (raw.startsWith('http')) return raw;
  return `https://${raw}`;
}
