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

export function extractWebsiteFromSpeech(text: string): string | null {
  let normalized = text.trim().toLowerCase();

  normalized = normalized.replace(
    /^(please\s+)?(open|check|scan|audit|go to|visit|look at)\s+(the\s+)?(website\s+)?/i,
    '',
  );
  normalized = normalized.replace(/\s+dot\s+/g, '.');
  normalized = normalized.replace(/\s+point\s+/g, '.');
  normalized = normalized.replace(/\s+/g, '');

  const dotted = normalized.match(
    /(?:https?:\/\/)?(?:www\.)?([a-z0-9][-a-z0-9]*(?:\.[a-z0-9][-a-z0-9]*)+)/i,
  );
  if (dotted) {
    const host = dotted[1] ?? dotted[0];
    return host.replace(/^www\./, '');
  }

  const spaced = text.trim().toLowerCase().match(
    /\b([a-z0-9][-a-z0-9]*)\s+(com|org|net|io|co|edu|gov|dev|app)\b/i,
  );
  if (spaced) {
    return `${spaced[1]}.${spaced[2]}`;
  }

  return null;
}
