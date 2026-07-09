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

/** HUD welcome-view activation audio chain — verbatim. */
export function fireActivationAudio(): void {
  const { muted, volume } = getAudioPrefs();
  void playWakeSting({ muted, volume }).then(() => playGreeting({ muted, volume }));
}
