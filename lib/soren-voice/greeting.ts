/**
 * lib/greeting.ts
 * Pass 21 — Greeting rotation engine (Next.js / Ops Deck)
 *
 * Plays one of 7 pre-recorded ElevenLabs greetings (/sounds/greetings/greeting-1..7.mp3),
 * avoiding the last 3 played (stored in sessionStorage).
 * Lazy-loaded — Audio created on first call, not on page load.
 * Skips playback silently if muted.
 *
 * Caller is responsible for the ~500ms delay after playWakeSting() before calling this.
 */

const GREETING_HISTORY_KEY = 'gr_history'; // sessionStorage key
const LOAD_TIMEOUT_MS      = 5000;         // max ms to wait for canplaythrough

export const GREETING_TEXTS: readonly string[] = [
  'Hello, sir Vagish. Soren here. What can I do for you today?',
  'Vagish, sir. Ready when you are.',
  "Welcome back, sir. What's the move?",
  'Soren reporting, sir. How can I help?',
  'Sir Vagish. At your service.',
  "Back online, sir. What's first?",
  'Soren here. Where are we starting today, sir?',
] as const;

const GREETING_COUNT = GREETING_TEXTS.length; // 7

// ── History helpers ──────────────────────────────────────────────────────────

function readHistory(key: string): number[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? '[]') as number[];
  } catch {
    return [];
  }
}

function pushHistory(key: string, index: number, maxLen = 3): void {
  if (typeof sessionStorage === 'undefined') return;
  const hist = readHistory(key);
  hist.push(index);
  while (hist.length > maxLen) hist.shift();
  sessionStorage.setItem(key, JSON.stringify(hist));
}

function pickAvoidingLast(count: number, historyKey: string, avoidCount = 3): number {
  const hist = readHistory(historyKey);
  const avoid = new Set(hist.slice(-avoidCount));
  let pool = Array.from({ length: count }, (_, i) => i).filter((i) => !avoid.has(i));
  if (pool.length === 0) pool = Array.from({ length: count }, (_, i) => i);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Load helper ───────────────────────────────────────────────────────────────

function waitForCanPlay(audio: HTMLAudioElement, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (audio.readyState >= 3) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      console.warn('[greeting] canplaythrough timeout — attempting play anyway');
      resolve();
    }, timeoutMs);
    audio.addEventListener('canplaythrough', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    audio.addEventListener('error', (e) => {
      clearTimeout(timer);
      console.error('[greeting] audio load error:', e);
      resolve();
    }, { once: true });
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface GreetingOptions {
  /** Volume 0–1. Default 0.3. */
  volume?: number;
  /** If true, skip playback silently. */
  muted?: boolean;
}

/**
 * Play a random greeting (non-repeating within last 3).
 * Chain after playWakeSting() with ~500ms delay (playWakeSting resolves after that delay).
 * If muted, returns immediately.
 * Must be called inside a user-gesture handler (click, keydown).
 */
export async function playGreeting(opts: GreetingOptions = {}): Promise<void> {
  const { volume = 0.3, muted = false } = opts;
  if (muted) return;

  const index  = pickAvoidingLast(GREETING_COUNT, GREETING_HISTORY_KEY);
  pushHistory(GREETING_HISTORY_KEY, index);

  const url    = `/sounds/greetings/greeting-${index + 1}.mp3`;

  console.log(`[greeting] playing ${url} at volume ${volume}`);

  const audio   = new Audio();
  audio.preload = 'auto';
  audio.volume  = Math.max(0, Math.min(1, volume));
  audio.src     = url;
  audio.load();

  await waitForCanPlay(audio, LOAD_TIMEOUT_MS);

  try {
    await audio.play();
    console.log('[greeting] play() succeeded');
  } catch (err) {
    console.error('[greeting] play() failed:', err);
  }
}
