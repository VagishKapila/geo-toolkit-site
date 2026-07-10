import { playWakeSting } from './wake-sting';
import { playGreeting } from './greeting';

function getAudioPrefs(): { muted: boolean; volume: number } {
  try {
    const muted = localStorage.getItem('soren_muted') === 'true';
    const volume = parseFloat(localStorage.getItem('soren_volume') ?? '0.30');
    return { muted, volume: isNaN(volume) ? 0.30 : volume };
  } catch {
    return { muted: false, volume: 0.30 };
  }
}

/** Plays sting then greeting; resolves when both playback fully ended. */
export async function playActivationAudio(): Promise<void> {
  const { muted, volume } = getAudioPrefs();
  await playWakeSting({ muted, volume });
  await playGreeting({ muted, volume });
}

/** @deprecated use playActivationAudio */
export function fireActivationAudio(): void {
  void playActivationAudio();
}
