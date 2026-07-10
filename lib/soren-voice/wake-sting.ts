/**
 * lib/wake-sting.ts
 * Pass 21.3 — Single-file sting (no rotation until more stings are uploaded)
 *
 * Always plays /sounds/wake-sting-01.mp3 via Web Audio API (AudioContext).
 * HTMLAudioElement.canplaythrough is unreliable for short clips in Chrome.
 * Resolves when sting playback fully ends so caller can chain the greeting.
 *
 * To add variety later: upload wake-sting-02..N.mp3 and bump STING_COUNT.
 * Must be called inside a user-gesture handler (click/keydown).
 */

const STING_FILE        = '/sounds/wake-sting-01.mp3';
const FADE_DURATION_MS  = 1000;   // ms to fade background music

// ── Shared AudioContext ───────────────────────────────────────────────────────

let _audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext();
  if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
  return _audioCtx;
}

// ── Music fade ───────────────────────────────────────────────────────────────

let _musicRef: HTMLAudioElement | null = null;

export function setMusicRef(audio: HTMLAudioElement | null): void {
  _musicRef = audio;
}

function fadeMusicOut(durationMs: number): void {
  const el = _musicRef;
  if (!el || el.paused) return;
  const startVol = el.volume;
  const startTime = performance.now();
  const tick = () => {
    const elapsed  = performance.now() - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    el.volume = startVol * (1 - progress);
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface StingOptions {
  /** Volume 0–1. Default 0.3. */
  volume?: number;
  /** If true, skip playback silently. */
  muted?: boolean;
}

/**
 * Play the wake sting via Web Audio API.
 * Resolves after GREETING_DELAY_MS so the caller can chain the greeting.
 */
export async function playWakeSting(opts: StingOptions = {}): Promise<void> {
  const { volume = 0.3, muted = false } = opts;

  fadeMusicOut(FADE_DURATION_MS);

  if (muted) return;

  console.log(`[wake-sting] fetching ${STING_FILE} at volume ${volume}`);

  return new Promise<void>((resolve) => {
    void (async () => {
      try {
        const ctx = getAudioContext();
        const resp = await fetch(STING_FILE);
        const buf = await resp.arrayBuffer();
        const decoded = await ctx.decodeAudioData(buf);

        const source = ctx.createBufferSource();
        source.buffer = decoded;
        const gain = ctx.createGain();
        gain.gain.value = Math.max(0, Math.min(1, volume));
        source.connect(gain);
        gain.connect(ctx.destination);
        source.onended = () => resolve();
        source.start(0);

        console.log(`[wake-sting] playing ${STING_FILE} — ${decoded.duration.toFixed(3)}s via AudioContext`);
      } catch (err) {
        console.error('[wake-sting] playback failed:', err);
        resolve();
      }
    })();
  });
}
